/**
 * Nutrition Engine
 * ------------------------------------------------------------------------
 * A pluggable strategy interface that turns a user's Nutrition Profile into
 * daily energy and macro targets.
 *
 * IMPORTANT — the current implementation is a PLACEHOLDER.
 * It is intentionally simple so the rest of the app can be built and demoed
 * against a stable contract. It will be replaced by an evidence-based
 * formula (e.g. Mifflin-St Jeor for BMR + a validated activity multiplier +
 * a protein target anchored to g/kg of goal weight).
 *
 * Never inline calorie/macro math into UI components — always go through a
 * NutritionStrategy so the algorithm can be swapped in one place.
 */

/**
 * @typedef {'female' | 'male' | 'unspecified'} BiologicalSex
 *   Biological sex is used only for BMR estimation (different constants in
 *   Mifflin-St Jeor). Users may decline; the strategy then falls back to a
 *   neutral constant.
 *
 * @typedef {'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'} ActivityLevel
 * @typedef {'lose_gentle' | 'maintain'} Goal
 */

/**
 * @typedef {Object} NutritionProfile
 * @property {number} age
 * @property {BiologicalSex} biologicalSex
 * @property {number} heightCm
 * @property {number} weightKg
 * @property {ActivityLevel} activityLevel
 * @property {number} trainingFrequency   // sessions per week, 0..14
 * @property {Goal} goal
 * @property {number} takeoutFrequency    // 0..14 meals per week (unused in the
 *                                        //   placeholder strategy but part of
 *                                        //   the profile contract so downstream
 *                                        //   recommendation logic can consume it)
 * @property {boolean} wantsNutritionNumbers
 */

/**
 * @typedef {Object} NutritionTargets
 * @property {number} maintenanceCalories  // kcal/day
 * @property {number} targetCalories       // kcal/day (goal-adjusted)
 * @property {number} proteinTargetG
 * @property {number} fatTargetG
 * @property {number} carbTargetG
 * @property {number} fiberTargetG
 * @property {number} sodiumCeilingMg
 * @property {string} strategyId           // which strategy produced this
 * @property {string} strategyNote         // human-readable caveat, if any
 */

/**
 * @interface NutritionStrategy
 * @property {string} id
 * @property {string} label
 * @property {(profile: NutritionProfile) => NutritionTargets} computeTargets
 */

/* ------------------------------------------------------------------ */
/* Placeholder strategy — will be replaced                            */
/* ------------------------------------------------------------------ */

const ACTIVITY_MULTIPLIER = {
  sedentary:   1.30,
  light:       1.45,
  moderate:    1.60,
  active:      1.75,
  very_active: 1.90,
};

/**
 * PlaceholderStrategy
 * ------------------------------------------------------------------------
 * Uses a rough Harris-Benedict-like BMR + activity multiplier. Protein is
 * anchored to body weight (1.4 g/kg for gentle loss, 1.2 for maintenance)
 * which is in the neighbourhood of the sports-nutrition literature, but
 * NOT a substitute for a reviewed formula.
 *
 * TODO(evidence): replace with Mifflin-St Jeor and cite the source in
 * strategyNote. Cross-check with a registered dietitian before shipping.
 */
export const PlaceholderStrategy = {
  id: 'placeholder-v0',
  label: 'Placeholder v0 — not evidence-based',

  /**
   * @param {NutritionProfile} p
   * @returns {NutritionTargets}
   */
  computeTargets(p) {
    // Rough BMR (kcal/day). The 'unspecified' branch uses the midpoint of
    // the male/female constants so we never gate on sex.
    const base =
      p.biologicalSex === 'male'   ?   5 :
      p.biologicalSex === 'female' ? -161 :
                                     -78; // midpoint
    const bmr =
      10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + base;

    const activityMult = ACTIVITY_MULTIPLIER[p.activityLevel] ?? 1.45;

    // Small bump for training sessions beyond 3/week (rough, capped).
    const trainingBonus = Math.min(6, Math.max(0, (p.trainingFrequency ?? 0) - 3)) * 40;

    const maintenance = Math.round(bmr * activityMult + trainingBonus);

    // Goal adjustment: gentle loss = ~15% deficit, capped at 400 kcal.
    const deficit =
      p.goal === 'lose_gentle'
        ? Math.min(400, Math.round(maintenance * 0.15))
        : 0;
    const target = maintenance - deficit;

    // Macros — protein anchored to weight, fat to a % of energy, carbs fill.
    const proteinPerKg = p.goal === 'lose_gentle' ? 1.4 : 1.2;
    const proteinG = Math.round(p.weightKg * proteinPerKg);

    const fatKcalPct = 0.28;
    const fatG = Math.round((target * fatKcalPct) / 9);

    const proteinKcal = proteinG * 4;
    const fatKcal = fatG * 9;
    const carbG = Math.max(80, Math.round((target - proteinKcal - fatKcal) / 4));

    const fiberG = p.biologicalSex === 'male' ? 30 : 25;

    return {
      maintenanceCalories: maintenance,
      targetCalories: target,
      proteinTargetG: proteinG,
      fatTargetG: fatG,
      carbTargetG: carbG,
      fiberTargetG: fiberG,
      sodiumCeilingMg: 2000,
      strategyId: this.id,
      strategyNote:
        '当前为 placeholder 算法，用于跑通产品骨架；正式上线前会替换为循证公式（Mifflin-St Jeor + 活动系数）。',
    };
  },
};

/* ------------------------------------------------------------------ */
/* Registry — swap strategies here, no UI change required             */
/* ------------------------------------------------------------------ */

/** @type {Record<string, NutritionStrategy>} */
const registry = {
  [PlaceholderStrategy.id]: PlaceholderStrategy,
};

/**
 * @param {string} id
 * @returns {NutritionStrategy}
 */
export function getStrategy(id = PlaceholderStrategy.id) {
  const s = registry[id];
  if (!s) throw new Error(`Unknown nutrition strategy: ${id}`);
  return s;
}

/**
 * Convenience helper used by the UI layer.
 * @param {NutritionProfile} profile
 * @param {string} [strategyId]
 * @returns {NutritionTargets}
 */
export function computeTargets(profile, strategyId) {
  return getStrategy(strategyId).computeTargets(profile);
}
