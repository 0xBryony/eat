/**
 * Nutrition Rules — versioned config v1
 * ------------------------------------------------------------------------
 * ALL thresholds, coefficients and rules live HERE. Business code must never
 * hard-code a number that belongs in this file. Changing any core formula or
 * coefficient REQUIRES a version bump (new file v2.js + algorithmVersion).
 *
 * Each rule is tagged with its epistemic class:
 *   - scientific_formula : peer-reviewed standard equation (Mifflin-St Jeor)
 *   - reference_range    : population reference used only as validation
 *                          benchmark, never as a hard cut
 *   - product_heuristic  : our product strategy for consumer planning;
 *                          explicitly NOT a medical standard
 */

export const ALGORITHM_VERSION = 'nutrition-engine-v1.0-msj';

/* ---------------------------------------------------------------- *
 * Eligibility (safety guard)                                        *
 * ---------------------------------------------------------------- */
export const eligibility = {
  minAgeYears: 18,
  // v1 is a consumer planning engine, not a medical device.
  excludedConditions: ['pregnancy', 'breastfeeding', 'special_medical_nutrition_needs'],
};

/* ---------------------------------------------------------------- *
 * RMR — Mifflin-St Jeor  [scientific_formula]                       *
 * Male:  10*kg + 6.25*cm - 5*age + 5                                *
 * Female:10*kg + 6.25*cm - 5*age - 161                             *
 * (no 9.99/4.92 variants; returns unrounded value)                  *
 * ---------------------------------------------------------------- */
export const msj = {
  weightCoef: 10,
  heightCoef: 6.25,
  ageCoef: 5,
  sexConstant: { male: 5, female: -161, unspecified: -78 }, // unspecified = midpoint, product_heuristic
};

/* ---------------------------------------------------------------- *
 * Activity factor — represents NON-training daily activity only.   *
 * Steps / occupation drive it; training does NOT (avoid double      *
 * counting).                                    [product_heuristic] *
 * ---------------------------------------------------------------- */
export const activity = {
  bands: [
    { key: 'very_low', factor: 1.30, stepsMax: 5000 },
    { key: 'low',      factor: 1.40, stepsMin: 5000,  stepsMax: 8000 },
    { key: 'moderate', factor: 1.50, stepsMin: 8000,  stepsMax: 12000 },
    { key: 'high',     factor: 1.60, stepsMin: 12000 },
  ],
  // Legacy onboarding category → band mapping [product_heuristic].
  // Used when steps/occupation were not collected.
  legacyCategoryToBand: {
    sedentary: 'very_low',
    light: 'low',
    moderate: 'moderate',
    active: 'high',
    very_active: 'high',
  },
  occupationToBand: {
    sedentary: 'very_low',
    mixed: 'low',
    active: 'moderate',
    physical: 'high',
  },
  // steps vs occupation conflict resolution [product_heuristic]
  conflictPolicy: 'prefer_occupation_when_steps_absent_else_weighted_toward_lower',
};

/* ---------------------------------------------------------------- *
 * Deficit                                        [product_heuristic]*
 * ---------------------------------------------------------------- */
export const deficit = {
  levels: { comfortable: 0.10, standard: 0.15, faster: 0.20 },
  defaultLevel: 'standard',
  maxAutomaticRate: 0.20,          // auto plans must never exceed 20%
  maintenanceRate: 0,
  goalToLevel: { gentle_fat_loss: 'comfortable', fat_loss: 'standard', maintenance: null },
};

/* ---------------------------------------------------------------- *
 * Soft calorie target                            [product_heuristic]*
 * NOT a spending budget. Never return over_budget/failed/exceeded.  *
 * ---------------------------------------------------------------- */
export const calorieRange = { lowerFactor: 0.95, upperFactor: 1.05 };

/* Energy safety guard — consumer MVP product-level floor. */
export const energySafety = { minimumAutomaticCalorieTarget: 1200 };

/* ---------------------------------------------------------------- *
 * Protein reference weight cap                   [product_heuristic]*
 * strategy: capped_bmi_reference_weight                             *
 * evidenceLevel: product_heuristic                                  *
 * NEVER surface as "standard/ideal weight" in UI.                   *
 * ---------------------------------------------------------------- */
export const proteinReferenceWeight = {
  strategy: 'capped_bmi_reference_weight',
  evidenceLevel: 'product_heuristic',
  bmiCapTrigger: 28,
  bmiCapValue: 27.9,
};

/* ---------------------------------------------------------------- *
 * Protein target by strength sessions            [product_heuristic]*
 * (fat-loss + possible resistance-training strategy, NOT a uniform  *
 *  medical standard for all adults)                                 *
 * ---------------------------------------------------------------- */
export const protein = {
  tiers: [
    { sessionsMax: 0,        coef: 1.3, range: [1.2, 1.4] },
    { sessionsMin: 1, sessionsMax: 2, coef: 1.5, range: [1.4, 1.6] },
    { sessionsMin: 3,        coef: 1.7, range: [1.6, 1.8] },
  ],
  // judgement logic (section 13)
  adequateAtPercentOfTarget: 0.90,
  opportunityBand: [0.75, 0.90],
  needsMoreBelow: 0.75,
  stopPrioritizingAbove: 1.20,
};

/* ---------------------------------------------------------------- *
 * Fat rules                                      [product_heuristic]*
 * (using proteinReferenceWeightKg for fatTargetRaw is current       *
 *  product strategy, noted per spec)                                *
 * ---------------------------------------------------------------- */
export const fat = {
  targetRawPerKg: 0.75,
  minimumFromWeightPerKg: 0.6,
  minimumFromEnergyPercent: 0.20,
  maximumFromEnergyPercent: 0.30,
  kcalPerG: 9,
};

/* ---------------------------------------------------------------- *
 * Carbs = remaining energy                       [scientific arithmetic]*
 * ---------------------------------------------------------------- */
export const carbs = {
  kcalPerG: 4,
  rangeFactor: 0.15,   // ±15% soft range
};

export const proteinKcalPerG = 4;

/* ---------------------------------------------------------------- *
 * Macro validation reference ranges             [reference_range]   *
 * Benchmark ONLY — not hard cuts. Prefer adjusting fat/carbs; never *
 * break protein priority to satisfy a percentage.                   *
 * ---------------------------------------------------------------- */
export const macroReferenceRanges = {
  proteinEnergyPercent: [10, 35],
  fatEnergyPercent: [20, 35],
  carbEnergyPercent: [45, 65],
};

/* ---------------------------------------------------------------- *
 * Training-day adjustment                        [product_heuristic]*
 * ---------------------------------------------------------------- */
export const trainingDay = {
  modes: ['daily_balanced', 'training_day_adjusted'],
  defaultMode: 'daily_balanced',
  carbUpliftPercent: 0.10,
  carbUpliftCapG: 30,
  restCarbFloorPercentOfTarget: 0.80,
  minSessionsToSplit: 1,
  maxSessionsToSplit: 5,   // >=6 → MVP stays daily_balanced
};

/* ---------------------------------------------------------------- *
 * Meal guidance distribution                     [product_heuristic]*
 * Shares must sum to 100%. Always soft targets.                     *
 * ---------------------------------------------------------------- */
export const mealDistribution = {
  2: [{ mealType: 'meal1', share: 0.45 }, { mealType: 'meal2', share: 0.45 }],
  3: [{ mealType: 'breakfast', share: 0.25 }, { mealType: 'lunch', share: 0.35 }, { mealType: 'dinner', share: 0.30 }],
  4: [{ mealType: 'breakfast', share: 0.20 }, { mealType: 'lunch', share: 0.30 }, { mealType: 'dinner', share: 0.30 }, { mealType: 'snack', share: 0.15 }],
  flexibleShare: { 2: 0.10, 3: 0.10, 4: 0.05 },
  // protein per-meal guidance weights (lunch/dinner carry more) [product_heuristic]
  proteinShare: {
    2: { meal1: 0.40, meal2: 0.45 },
    3: { breakfast: 0.25, lunch: 0.38, dinner: 0.37 },
    4: { breakfast: 0.22, lunch: 0.32, dinner: 0.31, snack: 0.15 },
  },
};

/* ---------------------------------------------------------------- *
 * Fiber / plants                                 [product_heuristic]*
 * DB fiber is incomplete; keep null, never fabricate.               *
 * ---------------------------------------------------------------- */
export const plants = {
  fiberTargetG: { male: 30, female: 25, unspecified: 28 },
  vegetableRichTags: ['vegetable_rich', 'high_fiber', 'salad'],
  goodIfFiberPercentOfTarget: 0.6,
};

/* ---------------------------------------------------------------- *
 * Recommendation fit                             [product_heuristic]*
 * ---------------------------------------------------------------- */
export const recommendation = {
  weights: {
    proteinNeedFit: 0.24,
    fatFit: 0.14,
    energyFit: 0.16,
    carbFit: 0.08,
    remainingDayFlexibility: 0.06,
    nutritionConfidence: 0.06,
    userPreferenceMatch: 0.20,   // preference must carry real weight
    categoryMatch: 0.06,
  },
  confidenceScore: { A: 1.0, B: 0.85, C: 0.65, D: 0.5, U: 0.3 },
  fitStatusThresholds: { strong_fit: 0.78, workable: 0.62, needs_adjustment: 0.45 }, // below → weak_fit
  // certainty wording switches on confidence
  certainConfidence: ['A', 'B'],
};

/* UI copy mapping for fitStatus (section 30). No forbidden language. */
export const fitStatusCopy = {
  strong_fit: '很适合今天。',
  workable: '今天可以吃。',
  needs_adjustment: '稍微调一下会更合适。',
  weak_fit: '如果今天真的很想吃，可以这样搭。',
};

/* Forbidden UI vocabulary (section 32) — enforced by review, listed here. */
export const forbiddenCopy = ['罪恶', '放纵', '作弊餐', '吃坏了', '爆卡', '脂肪爆炸', '今天毁了', '必须运动抵消', '你只能吃', '禁止吃', '超标'];
