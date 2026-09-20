/**
 * Meal Nutrition Adapter — bridges the frozen外卖 database to the engine.
 * ------------------------------------------------------------------------
 * Rules (spec §24):
 *  1. Never mutate the original database.
 *  2. Preserve existing min/max (low/high) ranges.
 *  3. Single-point estimates are NOT auto-expanded to ±10%; they stay
 *     nutritionValueType='estimated_point' (or 'exact' when official).
 *  4. Official data → 'exact'.
 *  5. Estimated ranges → 'estimated_range'.
 *  6. portionMultiplier (0.5/0.75/1/1.5…) scales calories+macros together.
 *  7. Combos aggregate into CombinedMealNutrition.
 *  8. fiberG stays null when the DB has no fiber (never fabricate).
 */

const CONFIDENCE_ORDER = { A: 0, B: 1, C: 2, D: 3, U: 4 };

/**
 * @param {object} raw a demo_meals.json / meals_master-shaped entry
 * @param {number} [portionMultiplier]
 * @returns {object} NormalizedMealNutrition
 */
export function normalizeMealNutrition(raw, portionMultiplier = 1) {
  const vt = raw.basis?.startsWith('per_100g')
    ? (raw.energyRangeKcal ? 'estimated_range' : 'estimated_point')
    : (raw.basis || raw.nutritionValueType || 'unknown');

  const hasRange = Array.isArray(raw.energyRangeKcal) && raw.energyRangeKcal[0] != null;
  const mult = (v) => (v == null ? null : round1(v * portionMultiplier));

  return {
    itemId: raw.id,
    name: raw.productName,
    servingDescription: `${raw.servingSize ?? 1}${raw.servingUnit ?? '份'}${portionMultiplier !== 1 ? ` ×${portionMultiplier}` : ''}`,
    calories: mult(raw.energyKcal),
    calorieLow: hasRange ? mult(raw.energyRangeKcal[0]) : null,
    calorieHigh: hasRange ? mult(raw.energyRangeKcal[1]) : null,
    proteinG: mult(raw.proteinG),
    proteinLowG: null,
    proteinHighG: null,
    carbsG: mult(raw.carbsG),
    carbsLowG: null,
    carbsHighG: null,
    fatG: mult(raw.fatG),
    fatLowG: null,
    fatHighG: null,
    fiberG: raw.fiberG == null ? null : mult(raw.fiberG),   // §26 keep null
    vegetableScore: null,                                    // reserved
    portionMultiplier,
    confidence: raw.confidence ?? 'U',
    nutritionValueType: vt,
    source: {
      type: raw.sourceType, url: raw.sourceUrl, title: raw.sourceTitle,
      date: raw.sourceDate, basis: raw.basis,
    },
    tags: raw.tags || [],
    uncertaintyDrivers: raw.uncertaintyDrivers || [],
  };
}

/** Apply a supported portion multiplier (0.5 / 0.75 / 1 / 1.5 …). */
export function withPortion(normalized, portionMultiplier) {
  return normalizeFromNormalized(normalized, portionMultiplier);
}

function normalizeFromNormalized(n, mult) {
  const m = (v) => (v == null ? null : round1(v * mult));
  return {
    ...n,
    servingDescription: `${n.servingDescription} ×${mult}`,
    calories: m(n.calories), calorieLow: m(n.calorieLow), calorieHigh: m(n.calorieHigh),
    proteinG: m(n.proteinG), carbsG: m(n.carbsG), fatG: m(n.fatG), fiberG: m(n.fiberG),
    portionMultiplier: (n.portionMultiplier || 1) * mult,
  };
}

/**
 * Aggregate several items into one CombinedMealNutrition.
 * Ranges aggregate conservatively (low=sum of lows, high=sum of highs).
 * Confidence of the combo = worst (least certain) member.
 */
export function combineMealNutrition(items, label = 'combined') {
  const sum = (f) => items.reduce((s, it) => s + (it[f] ?? 0), 0);
  const sumOrNull = (f) => items.every((it) => it[f] == null) ? null : round1(sum(f));
  const lows = items.filter((it) => it.calorieLow != null);
  const highs = items.filter((it) => it.calorieHigh != null);
  const worst = items.reduce((w, it) =>
    (CONFIDENCE_ORDER[it.confidence] ?? 4) > (CONFIDENCE_ORDER[w] ?? 4) ? it.confidence : w, 'A');
  return {
    itemId: `${label}:${items.map((i) => i.itemId).join('+')}`,
    name: items.map((i) => i.name).join(' + '),
    servingDescription: items.map((i) => i.servingDescription).join(' + '),
    calories: round1(sum('calories')),
    calorieLow: lows.length ? round1(lows.reduce((s, i) => s + i.calorieLow, 0)) : null,
    calorieHigh: highs.length ? round1(highs.reduce((s, i) => s + i.calorieHigh, 0)) : null,
    proteinG: sumOrNull('proteinG'),
    carbsG: sumOrNull('carbsG'),
    fatG: sumOrNull('fatG'),
    fiberG: sumOrNull('fiberG'),
    portionMultiplier: 1,
    confidence: worst,
    nutritionValueType: items.some((i) => i.nutritionValueType === 'estimated_range') ? 'estimated_range' : 'estimated_point',
    source: { type: 'combined', members: items.map((i) => i.source) },
    members: items,
  };
}

function round1(v) { return Math.round(v * 10) / 10; }
