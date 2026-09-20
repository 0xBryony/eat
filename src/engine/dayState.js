/**
 * Day State — consumed / remaining / reflow, and the soft UI statuses.
 * ------------------------------------------------------------------------
 * Pure functions over (NutritionPlan, NormalizedMealNutrition[]).
 * UI statuses (spec §25) are the ONLY thing the default UI shows:
 *   Protein: enough | needs_more | no_need_to_prioritize  (+ next_meal_opportunity)
 *   Plants : good | could_use_more
 *   Energy : comfortable | substantial | light
 * Meal reflow (§22): an over-share lunch never returns over_budget; we
 * recompute remainingDayNutrition and guide the next meal softly.
 */

import * as R from './nutritionRules/v1.js?v=39';
import { proteinStatus } from './nutritionStrategyV1.js?v=39';

export function sumConsumed(items) {
  const acc = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, fiberKnown: false, count: 0 };
  for (const it of items) {
    acc.calories += it.calories ?? 0;
    acc.proteinG += it.proteinG ?? 0;
    acc.carbsG += it.carbsG ?? 0;
    acc.fatG += it.fatG ?? 0;
    if (it.fiberG != null) { acc.fiberG += it.fiberG; acc.fiberKnown = true; }
    acc.count++;
  }
  return acc;
}

/**
 * @param {object} plan NutritionPlan
 * @param {Array} consumedNormalized
 * @param {object} opts { mealsPerDay, eatenMealTypes:string[] }
 */
export function computeDayState(plan, consumedNormalized, opts = {}) {
  const consumed = sumConsumed(consumedNormalized);
  const remaining = {
    calories: Math.max(0, plan.calorieTarget - consumed.calories),
    proteinG: Math.max(0, plan.proteinTargetG - consumed.proteinG),
    carbsG: Math.max(0, plan.carbTargetG - consumed.carbsG),
    fatG: Math.max(0, plan.fatTargetG - consumed.fatG),
    fiberG: plan.fiberTargetG ? Math.max(0, plan.fiberTargetG - consumed.fiberG) : null,
  };
  const mealsPerDay = opts.mealsPerDay ?? 3;
  const eaten = opts.eatenMealTypes || [];
  const allTypes = (R.mealDistribution[mealsPerDay] ?? R.mealDistribution[3]).map((m) => m.mealType);
  const remainingMeals = allTypes.filter((t) => !eaten.includes(t));

  return {
    consumed, remaining, remainingMeals,
    statuses: computeStatuses(plan, consumed),
    reflow: computeReflow(plan, consumed, eaten, mealsPerDay),
  };
}

export function computeStatuses(plan, consumed) {
  // Accept either an array of NormalizedMealNutrition or an already-summed
  // aggregate. (Passing the raw array used to silently yield NaN → needs_more;
  // regression-tested in "statuses accept array input".)
  const c = Array.isArray(consumed) ? sumConsumed(consumed) : consumed;
  const protein = proteinStatus(c.proteinG, plan.proteinTargetG);

  // Plants: fiber when known, else vegetable-tag presence; never fabricate.
  let plants;
  const fiberPct = plan.fiberTargetG ? c.fiberG / plan.fiberTargetG : null;
  if (fiberPct != null && c.fiberKnown) {
    plants = fiberPct >= R.plants.goodIfFiberPercentOfTarget ? 'good' : 'could_use_more';
  } else {
    plants = 'could_use_more';   // incomplete fiber data → soft nudge, disclosed
  }

  // Energy: relative to target, soft bands.
  const ePct = plan.calorieTarget ? c.calories / plan.calorieTarget : 0;
  const energy = ePct >= 1.05 ? 'substantial' : ePct >= 0.55 ? 'comfortable' : 'light';

  return { protein, plants, energy, fiberKnown: c.fiberKnown };
}

/**
 * Meal reflow (§22). If a consumed meal exceeded its planning share, we do
 * NOT flag over_budget; we return soft guidance for the next meal.
 */
export function computeReflow(plan, consumed, eatenMealTypes, mealsPerDay) {
  const budgets = plan.mealGuidanceBudgets || [];
  const over = [];
  for (const t of eatenMealTypes) {
    const b = budgets.find((x) => x.mealType === t);
    if (!b) continue;
    // we don't have per-meal breakdown here beyond totals; use share heuristic
    // on the LAST consumed meal is caller's job; keep simple: compare total so far
  }
  // Simple, honest reflow: compare consumed calories against the sum of the
  // planning shares of meals already eaten.
  const eatenShare = budgets.filter((b) => eatenMealTypes.includes(b.mealType))
    .reduce((s, b) => s + b.planningShare, 0);
  const expectedSoFar = plan.calorieTarget * eatenShare;
  const delta = consumed.calories - expectedSoFar;
  const tolerance = plan.calorieTarget * 0.10;
  if (eatenShare > 0 && delta > tolerance) {
    return {
      triggered: true,
      direction: 'lighter_next',
      guidanceKey: 'lunch_substantial_dinner_lighter',
      remainingCalories: Math.max(0, plan.calorieTarget - consumed.calories),
      note: '中午吃得比较足，晚上正常吃一顿偏清爽的就够了。',
    };
  }
  if (eatenShare > 0 && delta < -tolerance) {
    return {
      triggered: true,
      direction: 'heartier_next',
      guidanceKey: 'eaten_light_next_can_be_normal',
      remainingCalories: Math.max(0, plan.calorieTarget - consumed.calories),
      note: '今天前面吃得偏轻，下一顿可以吃得实在一点。',
    };
  }
  return { triggered: false, direction: null, guidanceKey: null, remainingCalories: Math.max(0, plan.calorieTarget - consumed.calories), note: null };
}
