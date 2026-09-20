/**
 * Unit tests — Nutrition Strategy v1 + adapter + recommendation (spec §38).
 * Run:  node --test src/engine/__tests__/
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { computePlan, computeCarbTarget, proteinStatus } from '../nutritionStrategyV1.js?v=39';
import { normalizeMealNutrition, combineMealNutrition } from '../mealNutritionAdapter.js?v=39';
import { computeDayState, computeReflow, computeStatuses } from '../dayState.js?v=39';
import { scoreNextMeal } from '../recommend.js?v=39';

const F = { age: 28, biologicalSex: 'female', heightCm: 165, weightKg: 60, goal: 'fat_loss', activityLevel: 'light', strengthSessionsPerWeek: 2 };
const M = { ...F, biologicalSex: 'male', weightKg: 75, heightCm: 178 };

test('1 ordinary female fat-loss user → valid plan with MSJ RMR', () => {
  const p = computePlan(F);
  assert.equal(p.status, 'valid');
  const rmr = 10 * 60 + 6.25 * 165 - 5 * 28 - 161;
  assert.ok(Math.abs(p.rmrKcal - rmr) < 1e-9);
  assert.equal(p.tdeeSource, 'formula');
  assert.equal(p.calibratedTdeeKcal, null);
  assert.ok(p.calorieTarget < p.estimatedTdeeKcal);
  assert.ok(p.assumptions.length >= 1);
});

test('2 ordinary male fat-loss user → valid plan, higher RMR', () => {
  const p = computePlan(M);
  assert.equal(p.status, 'valid');
  const rmr = 10 * 75 + 6.25 * 178 - 5 * 28 + 5;
  assert.ok(Math.abs(p.rmrKcal - rmr) < 1e-9);
  assert.ok(p.rmrKcal > computePlan(F).rmrKcal);
});

test('3 BMI >= 28 triggers protein reference cap', () => {
  const p = computePlan({ ...F, weightKg: 95 });           // bmi ≈ 34.9
  assert.ok(p.bmi >= 28);
  assert.ok(p.proteinReferenceWeightKg < 95);
  assert.ok(p.warnings.includes('protein_reference_weight_capped'));
  assert.ok(p.assumptions.some((a) => /capped/i.test(a)));
});

test('4 zero strength sessions → 1.3 g/kg coefficient', () => {
  const p = computePlan({ ...F, strengthSessionsPerWeek: 0 });
  assert.ok(Math.abs(p.proteinTargetG - p.proteinReferenceWeightKg * 1.3) < 1e-9);
});

test('5 two strength sessions → 1.5 g/kg', () => {
  const p = computePlan({ ...F, strengthSessionsPerWeek: 2 });
  assert.ok(Math.abs(p.proteinTargetG - p.proteinReferenceWeightKg * 1.5) < 1e-9);
});

test('6 four strength sessions → 1.7 g/kg', () => {
  const p = computePlan({ ...F, strengthSessionsPerWeek: 4 });
  assert.ok(Math.abs(p.proteinTargetG - p.proteinReferenceWeightKg * 1.7) < 1e-9);
});

test('7 six sessions + training-day mode → MVP stays daily_balanced', () => {
  const p = computePlan({ ...F, strengthSessionsPerWeek: 6, useTrainingDayAdjustment: true });
  assert.equal(p.trainingDayTargets, null);
  assert.equal(p.restDayTargets, null);
  assert.ok(p.assumptions.some((a) => /daily_balanced/.test(a)));
});

test('8 extremely low calorie target → review_required + safety warning', () => {
  const p = computePlan({ age: 30, biologicalSex: 'female', heightCm: 150, weightKg: 38, goal: 'fat_loss', activityLevel: 'sedentary', strengthSessionsPerWeek: 0, preferredDeficitLevel: 'faster' });
  assert.equal(p.status, 'review_required');
  assert.ok(p.warnings.includes('energy_target_below_automatic_planning_threshold'));
});

test('9 fatMinimum > fatMaximum → review_required + fat_rule_conflict', () => {
  const p = computePlan({ age: 66, biologicalSex: 'female', heightCm: 160, weightKg: 70, goal: 'fat_loss', activityLevel: 'sedentary', strengthSessionsPerWeek: 0, preferredDeficitLevel: 'faster' });
  assert.equal(p.status, 'review_required');
  assert.ok(p.warnings.includes('fat_rule_conflict'));
});

test('10 carbTarget <= 0 guard flags invalid', () => {
  const r = computeCarbTarget(1200, 250, 60);   // 4*250+9*60 = 1540 > 1200
  assert.equal(r.valid, false);
  assert.ok(r.carbTargetG <= 0);
});

test('11 lunch over planning share triggers soft meal reflow (no over_budget)', () => {
  const plan = computePlan(F);
  const big = { calories: plan.calorieTarget * 0.6, proteinG: 40, carbsG: 60, fatG: 20, fiberG: 5 };
  const day = computeDayState(plan, [big], { eatenMealTypes: ['lunch'] });
  assert.equal(day.reflow.triggered, true);
  assert.equal(day.reflow.direction, 'lighter_next');
  assert.ok(!/over_budget|exceeded|failed/.test(JSON.stringify(day)));
});

test('12 explicit burger craving is not drowned by a prettier salad', () => {
  const plan = computePlan(F);
  const burger = { id: 'b', calories: 430, proteinG: 26, carbsG: 47, fatG: 15, fiberG: 3, confidence: 'C', tags: ['burger'], mealTypes: ['lunch', 'dinner'] };
  const salad = { id: 's', calories: 380, proteinG: 32, carbsG: 34, fatG: 12, fiberG: 8, confidence: 'A', tags: ['salad', 'vegetable_rich'], mealTypes: ['lunch', 'dinner'] };
  const { ranking } = scoreNextMeal({ plan, consumedNormalized: [], candidates: [salad, burger], craving: 'burger', mealType: 'dinner', eatenMealTypes: ['lunch'] });
  assert.equal(ranking[0].id, 'b');
});

test('13 low-confidence meal yields estimated certainty, not over-certain copy', () => {
  const plan = computePlan(F);
  const c = { id: 'c', calories: 500, proteinG: 20, carbsG: 60, fatG: 18, confidence: 'D', tags: ['hotpot'], mealTypes: ['dinner'] };
  const { ranking } = scoreNextMeal({ plan, consumedNormalized: [], candidates: [c], craving: 'hotpot', mealType: 'dinner', eatenMealTypes: [] });
  assert.equal(ranking[0].reasonCertainty, 'estimated');
  assert.ok(['strong_fit', 'workable', 'needs_adjustment', 'weak_fit'].includes(ranking[0].fitStatus));
});

test('14 portionMultiplier scales calories and macros together', () => {
  const raw = { id: 'x', productName: 'X', basis: 'exact', energyKcal: 400, proteinG: 20, carbsG: 40, fatG: 10, confidence: 'A' };
  const one = normalizeMealNutrition(raw, 1);
  const half = normalizeMealNutrition(raw, 0.5);
  assert.equal(half.calories, 200);
  assert.equal(half.proteinG, 10);
  assert.equal(half.carbsG, 20);
  assert.equal(half.fatG, 5);
  assert.equal(one.portionMultiplier, 1);
});

test('15 combo aggregation sums ranges and takes worst confidence', () => {
  const a = normalizeMealNutrition({ id: 'a', productName: 'A', basis: 'exact', energyKcal: 300, proteinG: 20, carbsG: 30, fatG: 8, confidence: 'A' });
  const b = normalizeMealNutrition({ id: 'b', productName: 'B', basis: 'estimated_range', energyKcal: 200, energyRangeKcal: [180, 220], proteinG: 5, carbsG: 30, fatG: 6, confidence: 'C' });
  const combo = combineMealNutrition([a, b]);
  assert.equal(combo.calories, 500);
  assert.equal(combo.calorieLow, 180);
  assert.equal(combo.calorieHigh, 220);
  assert.equal(combo.confidence, 'C');
  assert.equal(combo.nutritionValueType, 'estimated_range');
});

test('extra: protein judgement bands', () => {
  assert.equal(proteinStatus(100, 100), 'enough');
  assert.equal(proteinStatus(80, 100), 'next_meal_opportunity');
  assert.equal(proteinStatus(50, 100), 'needs_more');
  assert.equal(proteinStatus(130, 100), 'no_need_to_prioritize');
});

test('extra: eligibility guard blocks pregnancy', () => {
  const p = computePlan({ ...F, pregnant: true });
  assert.equal(p.status, 'requires_professional_guidance');
});

test('regression: statuses accept array input (Today screen bug)', () => {
  const plan = computePlan(F);
  const items = [
    { calories: 59, proteinG: 10, carbsG: 3.6, fatG: 0.4, fiberG: null },
    { calories: 666, proteinG: 36, carbsG: 90, fatG: 18, fiberG: null },
    { calories: 893, proteinG: 42, carbsG: 139, fatG: 24, fiberG: null },
  ];
  const st = computeStatuses(plan, items);
  assert.equal(st.protein, 'enough');       // 88/90 = 98%
  assert.equal(st.energy, 'comfortable');   // 1618/1676 = 96%
});
