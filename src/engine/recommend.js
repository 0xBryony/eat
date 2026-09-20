/**
 * Recommendation Engine v1 — deterministic, plan-driven, preference-aware.
 * ------------------------------------------------------------------------
 * Not an LLM. Every candidate meal/combo gets:
 *   fitScore, fitStatus (strong_fit|workable|needs_adjustment|weak_fit),
 *   reasons[] (actionable, no forbidden language), adjustments[].
 *
 * Considers (weights in nutritionRules/v1.js):
 *   proteinNeedFit, fatFit, energyFit, carbFit, remainingDayFlexibility,
 *   nutritionConfidence, userPreferenceMatch, categoryMatch.
 *
 * Principles honoured:
 *  - User preference carries real weight (§28): a stated craving is never
 *    drowned by "mathematically prettier" salads.
 *  - Uncertainty enters scoring and reason certainty (§34): C/D confidence
 *    never reads as absolute fact.
 *  - Recording a meal really changes the next recommendation (§33) because
 *    ranking is computed from remainingDayNutrition, not from copy.
 *  - No over_budget / failed / exceeded anywhere (§9, §22).
 */

import * as R from './nutritionRules/v1.js?v=39';
import { CRAVING_TO_TAGS } from '../data/cravingTags.js?v=39';
import { computeDayState } from './dayState.js?v=39';

/* ------------------------------------------------------------------ */
/* Legacy helpers (kept for screens that still use gap math)           */
/* ------------------------------------------------------------------ */

export function sumIntake(entries = []) {
  return entries.reduce(
    (acc, { meal, quantity = 1 }) => ({
      energyKcal: acc.energyKcal + (meal.energyKcal ?? 0) * quantity,
      proteinG: acc.proteinG + (meal.proteinG ?? 0) * quantity,
      carbG: acc.carbG + (meal.carbG ?? 0) * quantity,
      fatG: acc.fatG + (meal.fatG ?? 0) * quantity,
      fiberG: acc.fiberG + (meal.fiberG ?? 0) * quantity,
      sodiumMg: acc.sodiumMg + (meal.sodiumMg ?? 0) * quantity,
      count: acc.count + 1,
    }),
    { energyKcal: 0, proteinG: 0, carbG: 0, fatG: 0, fiberG: 0, sodiumMg: 0, count: 0 }
  );
}

export function computeGaps(targets, intake) {
  const remainingEnergyKcal = Math.max(0, targets.targetCalories - intake.energyKcal);
  const remainingProteinG = Math.max(0, targets.proteinTargetG - intake.proteinG);
  const remainingFiberG = Math.max(0, (targets.fiberTargetG ?? 25) - intake.fiberG);
  const proteinGapPct = targets.proteinTargetG > 0 ? remainingProteinG / targets.proteinTargetG : 0;
  const plantsGapPct = targets.fiberTargetG > 0 ? remainingFiberG / targets.fiberTargetG : 0;
  const energyGapPct = targets.targetCalories > 0 ? remainingEnergyKcal / targets.targetCalories : 0;
  const ranked = [
    { key: 'protein', pct: proteinGapPct },
    { key: 'plants', pct: plantsGapPct },
    { key: 'energy', pct: energyGapPct },
  ].sort((a, b) => b.pct - a.pct);
  return {
    remainingEnergyKcal, remainingProteinG, remainingFiberG,
    proteinGapPct, plantsGapPct, energyGapPct,
    dominantGap: ranked[0].pct < 0.15 ? 'balanced' : ranked[0].key,
  };
}

/* ------------------------------------------------------------------ */
/* Fit scoring                                                         */
/* ------------------------------------------------------------------ */

const clamp01 = (v) => Math.min(1, Math.max(0, v));

function fitComponents(norm, day, craving, mealType, plan) {
  const rem = day.remaining;

  const proteinNeedFit = rem.proteinG <= 1
    ? 0.5
    : clamp01((norm.proteinG ?? 0) / rem.proteinG);

  const fatBudget = Math.max(10, rem.fatG);
  const fatOver = Math.max(0, (norm.fatG ?? 0) - fatBudget);
  const fatFit = 1 - clamp01(fatOver / fatBudget);

  const energyBudget = Math.max(150, rem.calories);
  const energyOver = Math.max(0, (norm.calories ?? 0) - energyBudget);
  let energyFit = Math.max(0.15, 1 - energyOver / Math.max(600, energyBudget));

  const carbBudget = Math.max(20, rem.carbsG);
  const carbOver = Math.max(0, (norm.carbsG ?? 0) - carbBudget);
  const carbFit = 1 - clamp01(carbOver / carbBudget);

  // Meal reflow: if the day already ran substantial, heavy candidates soften.
  let flexibility = 0.7;
  if (day.reflow?.triggered && day.reflow.direction === 'lighter_next') {
    energyFit *= 0.8;
    flexibility = 0.4;
  }

  const nutritionConfidence = R.recommendation.confidenceScore[norm.confidence] ?? 0.5;

  let userPreferenceMatch = 0.35;
  if (!craving || craving === 'surprise') userPreferenceMatch = 0.75;
  else {
    const tags = CRAVING_TO_TAGS[craving] ?? [];
    if (tags.length && (norm.tags || []).some((t) => tags.includes(t))) userPreferenceMatch = 1.0;
  }

  const categoryMatch = !norm.mealTypes || norm.mealTypes.length === 0 || norm.mealTypes.includes(mealType) ? 1.0 : 0.55;

  return { proteinNeedFit, fatFit, energyFit, carbFit, remainingDayFlexibility: flexibility, nutritionConfidence, userPreferenceMatch, categoryMatch };
}

function fitStatusFor(score) {
  const t = R.recommendation.fitStatusThresholds;
  if (score >= t.strong_fit) return 'strong_fit';
  if (score >= t.workable) return 'workable';
  if (score >= t.needs_adjustment) return 'needs_adjustment';
  return 'weak_fit';
}

/** Actionable, non-judgemental reasons (§31) + adjustments. */
function buildReasons(norm, day, parts, plan) {
  const reasons = [];
  const adjustments = [];
  const rem = day.remaining;

  if (day.statuses.protein === 'no_need_to_prioritize') {
    reasons.push('今天蛋白质已经够了，下一餐优先蔬菜和适量主食。');
  } else if (parts.proteinNeedFit >= 0.6) {
    reasons.push('蛋白质合适。');
  } else if (day.statuses.protein === 'needs_more') {
    reasons.push('今天蛋白质还差一点，这一份能补上一些。');
  }

  if (day.statuses.plants === 'could_use_more') {
    reasons.push('今天蔬菜还少一点。');
    if ((norm.tags || []).some((t) => R.plants.vegetableRichTags.includes(t))) {
      reasons.push('这一份蔬菜比较多，正好补上。');
    }
  }

  if ((norm.uncertaintyDrivers || []).some((d) => /酱|麻酱/.test(d))) {
    adjustments.push({ type: 'sauce_on_side', text: '酱汁分装会更适合今天。' });
    reasons.push('酱汁分装会更适合今天。');
  }

  const energyBudget = Math.max(150, rem.calories);
  if ((norm.calories ?? 0) > energyBudget * 1.15) {
    if ((norm.uncertaintyDrivers || []).some((d) => /米饭|主食|面/.test(d))) {
      adjustments.push({ type: 'portion', item: '主食', to: '半份', text: '建议米饭减到半份。' });
      reasons.push('建议米饭减到半份。');
    } else {
      reasons.push('这顿油脂可能偏高，下一餐不用再额外加很多高脂配菜。');
    }
  } else if ((norm.tags || []).includes('refined_carb') && day.statuses.plants === 'could_use_more') {
    adjustments.push({ type: 'swap_side', from: '薯条', to: '玉米杯', text: '不用去掉主食，换掉薯条就比较适合你今天。' });
    reasons.push('米饭不用减。');
  } else {
    reasons.push('米饭不用减。');
  }

  return { reasons: dedupe(reasons), adjustments };
}

function dedupe(arr) { return [...new Set(arr)]; }

/* ------------------------------------------------------------------ */
/* Main entry                                                          */
/* ------------------------------------------------------------------ */

/**
 * @param {object} input
 * @param {object} input.plan NutritionPlan
 * @param {Array}  input.consumedNormalized NormalizedMealNutrition[]
 * @param {Array}  input.candidates legacy meal objects (carry _norm)
 * @param {string|null} input.craving
 * @param {string} input.mealType
 * @param {string[]} input.eatenMealTypes
 * @param {number} [input.limit]
 * @param {Array} [input.comboPool]
 */
export function scoreNextMeal({
  plan, consumedNormalized = [], candidates, craving = null,
  mealType = 'dinner', eatenMealTypes = [], limit = 4, comboPool = null,
}) {
  const day = computeDayState(plan, consumedNormalized, { eatenMealTypes });
  const W = R.recommendation.weights;

  const ranked = candidates.map((meal) => {
    const norm = meal._norm || meal;
    const parts = fitComponents(norm, day, craving, mealType, plan);
    const fitScore =
      W.proteinNeedFit * parts.proteinNeedFit +
      W.fatFit * parts.fatFit +
      W.energyFit * parts.energyFit +
      W.carbFit * parts.carbFit +
      W.remainingDayFlexibility * parts.remainingDayFlexibility +
      W.nutritionConfidence * parts.nutritionConfidence +
      W.userPreferenceMatch * parts.userPreferenceMatch +
      W.categoryMatch * parts.categoryMatch;
    const { reasons, adjustments } = buildReasons(norm, day, parts, plan);
    const certain = R.recommendation.certainConfidence.includes(norm.confidence);
    return {
      ...meal,
      _score: fitScore,
      _parts: parts,
      fitScore,
      fitStatus: fitStatusFor(fitScore),
      reasons,
      adjustments,
      reasonCertainty: certain ? 'high' : 'estimated',
      _reasonText: reasons[0] ?? '',
      _reasonKey: legacyReasonKey(parts, day, craving),
      _flags: [],
    };
  }).sort((a, b) => b.fitScore - a.fitScore).slice(0, limit);

  const gaps = computeGaps(plan, sumIntake(consumedNormalized.map((n) => ({ meal: n, quantity: 1 }))));
  const poolForCombo = comboPool && comboPool.length ? comboPool : candidates;
  const combo = ranked[0] ? suggestCombo(ranked[0], poolForCombo, gaps) : null;

  return {
    ranking: ranked,
    dayState: day,
    reason: {
      remainingEnergyKcal: day.remaining.calories,
      remainingProteinG: day.remaining.proteinG,
      remainingFiberG: day.remaining.fiberG,
      dominantGap: gaps.dominantGap,
      mealType, craving,
      notes: buildNotes(day, craving, ranked[0]),
      combo,
    },
  };
}

function legacyReasonKey(parts, day, craving) {
  if (craving && craving !== 'surprise' && parts.userPreferenceMatch === 1.0) {
    return day.statuses.plants === 'could_use_more' ? 'swap_suggestion' : 'craving_match';
  }
  if (day.statuses.protein === 'needs_more' && parts.proteinNeedFit >= 0.6) return 'fills_protein';
  if (day.statuses.plants === 'could_use_more' && (parts.proteinNeedFit < 0.6)) return 'fills_veg';
  return 'balanced';
}

function buildNotes(day, craving, top) {
  const notes = [];
  if (day.statuses.plants === 'could_use_more') notes.push('vegetables_low_today');
  if (day.statuses.protein === 'needs_more') notes.push('protein_low_today');
  if (day.statuses.protein === 'no_need_to_prioritize') notes.push('protein_already_adequate');
  if (day.reflow?.triggered) notes.push(`reflow_${day.reflow.direction}`);
  if (craving && craving !== 'surprise') notes.push(`craving_${craving}`);
  if (top && !R.recommendation.certainConfidence.includes(top.confidence ?? top._norm?.confidence)) {
    notes.push('limited_nutrition_confidence');
  }
  return notes;
}

/* ------------------------------------------------------------------ */
/* Combo builder (unchanged behaviour from v0)                         */
/* ------------------------------------------------------------------ */

export function suggestCombo(top, pool, gaps) {
  if (!top) return null;
  const isMain = !(top.tags || []).includes('side') && !(top.tags || []).includes('drink');
  if (!isMain) return null;
  const items = [top];
  const budgetLeft = Math.max(0, gaps.remainingEnergyKcal - (top.energyKcal ?? 0));
  let swapNote;
  const isBurgerLike = (top.tags || []).includes('burger');
  const wantVeg = gaps.plantsGapPct > 0.35 || isBurgerLike;
  if (wantVeg && budgetLeft > 60) {
    const sideCandidates = pool.filter((m) => m.id !== top.id && (m.tags || []).includes('side')
      && ((m.tags || []).includes('vegetable_rich') || (m.tags || []).includes('high_fiber') || (m.tags || []).includes('vegetable')));
    const fallbackSides = pool.filter((m) => m.id !== top.id && ((m.tags || []).includes('side') || (m.tags || []).includes('salad')));
    const side = sideCandidates[0] || fallbackSides[0];
    if (side && (side.energyKcal ?? 0) <= budgetLeft * 1.25) {
      items.push(side);
      if (isBurgerLike) {
        const unhealthy = pool.find((m) => (m.tags || []).includes('side') && ((m.tags || []).includes('high_fat') || (m.tags || []).includes('refined_carb')));
        if (unhealthy) swapNote = `把${unhealthy.productName}换成${side.productName}，更适合你今天。`;
      }
    }
  }
  const drink = pool.find((m) => (m.tags || []).includes('drink') && (m.tags || []).includes('zero_sugar'));
  if (drink) items.push(drink);
  const totalEnergyKcal = items.reduce((s, m) => s + (m.energyKcal ?? 0), 0);
  return { items, swapNote, totalEnergyKcal };
}
