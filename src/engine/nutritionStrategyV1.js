/**
 * Nutrition Strategy v1 — pure domain service (no UI, no LLM).
 * ------------------------------------------------------------------------
 * Implements the v1 spec: eligibility guard → Mifflin-St Jeor RMR →
 * activity factor (non-training activity only) → TDEE → deficit → soft
 * calorie target → energy safety guard → protein reference weight (BMI cap
 * heuristic) → protein target → fat rules with conflict protection → carbs
 * as remaining energy → macro validation (reference ranges as benchmark) →
 * training/rest day split → meal guidance budgets.
 *
 * Every number comes from nutritionRules/v1.js. Uncertainty and boundary
 * cases return explicit assumptions[] / warnings[] and a status; we never
 * silently emit a "looks scientific" result.
 */

import * as R from './nutritionRules/v1.js?v=39';

/* ------------------------------------------------------------------ */
/* Eligibility                                                         */
/* ------------------------------------------------------------------ */

/**
 * @param {object} input NutritionProfileInput
 * @returns {{eligible:boolean, reasons:string[], warnings:string[]}}
 */
export function validateEligibility(input) {
  const reasons = [];
  const warnings = [];
  let eligible = true;

  if (input.age == null || input.age < R.eligibility.minAgeYears) {
    eligible = false;
    reasons.push(`age_below_${R.eligibility.minAgeYears}`);
  }
  if (input.pregnant) { eligible = false; reasons.push('pregnancy'); }
  if (input.breastfeeding) { eligible = false; reasons.push('breastfeeding'); }
  if (input.specialMedicalNutritionNeeds) {
    eligible = false;
    reasons.push('special_medical_nutrition_needs');
  }
  // v1 onboarding does not collect pregnancy/lactation/medical flags for all
  // users; when absent we plan but disclose the assumption instead of
  // silently assuming.
  if (eligible && input.pregnant == null && input.biologicalSex === 'female') {
    warnings.push('eligibility_pregnancy_status_not_collected');
  }
  if (eligible && input.specialMedicalNutritionNeeds == null) {
    warnings.push('eligibility_medical_nutrition_status_not_collected');
  }
  return { eligible, reasons, warnings };
}

/* ------------------------------------------------------------------ */
/* RMR / activity / TDEE                                               */
/* ------------------------------------------------------------------ */

export function computeRmrKcal(input) {
  const c = R.msj.sexConstant[input.biologicalSex] ?? R.msj.sexConstant.unspecified;
  return R.msj.weightCoef * input.weightKg
    + R.msj.heightCoef * input.heightCm
    - R.msj.ageCoef * input.age
    + c;
}

/**
 * Activity band from steps/occupation. Training sessions are deliberately
 * NOT added here (avoid double counting).
 */
export function resolveActivity(input) {
  const assumptions = [];
  let bandKey = null;
  let conflict = false;

  const fromSteps = input.averageDailySteps != null
    ? R.activity.bands.find((b) =>
        (b.stepsMin == null || input.averageDailySteps >= b.stepsMin) &&
        (b.stepsMax == null || input.averageDailySteps < b.stepsMax))?.key
    : null;
  const fromOcc = input.occupationActivity
    ? R.activity.occupationToBand[input.occupationActivity] ?? null
    : null;

  if (fromSteps && fromOcc && fromSteps !== fromOcc) {
    conflict = true;
    // Do not silently pick one: choose the more conservative (lower) band and
    // disclose, per config conflictPolicy.
    const order = R.activity.bands.map((b) => b.key);
    bandKey = order.indexOf(fromSteps) < order.indexOf(fromOcc) ? fromSteps : fromOcc;
    assumptions.push(
      `Steps (~${input.averageDailySteps}/day) and occupation (${input.occupationActivity}) suggest different activity bands (${fromSteps} vs ${fromOcc}); the lower band "${bandKey}" was used and flagged.`
    );
  } else {
    bandKey = fromSteps || fromOcc;
  }

  if (!bandKey && input.activityLevel) {
    bandKey = R.activity.legacyCategoryToBand[input.activityLevel] ?? 'low';
    assumptions.push(
      `Daily steps and occupation were not collected; activity band "${bandKey}" was derived from the onboarding activity category "${input.activityLevel}".`
    );
  }
  if (!bandKey) {
    bandKey = 'low';
    assumptions.push('No activity signal available; default band "low" used.');
  }

  const band = R.activity.bands.find((b) => b.key === bandKey);
  const reason = input.averageDailySteps != null
    ? `Average ~${input.averageDailySteps} steps/day${input.occupationActivity ? ` and ${input.occupationActivity} work` : ''} → ${bandKey} activity estimate.`
    : `Activity band "${bandKey}" from ${input.activityLevel ? 'onboarding category' : 'default'}.`;

  return {
    bandKey,
    activityFactor: band.factor,
    activityFactorReason: reason,
    conflict,
    assumptions,
    uncertain: input.averageDailySteps == null && input.occupationActivity == null,
  };
}

/* ------------------------------------------------------------------ */
/* Protein reference weight (BMI cap heuristic)                        */
/* ------------------------------------------------------------------ */

export function computeProteinReferenceWeight(input, bmi) {
  const h2 = (input.heightCm / 100) ** 2;
  const capped = bmi >= R.proteinReferenceWeight.bmiCapTrigger;
  const ref = capped
    ? Math.min(input.weightKg, R.proteinReferenceWeight.bmiCapValue * h2)
    : input.weightKg;
  return {
    proteinReferenceWeightKg: ref,
    capped,
    strategy: R.proteinReferenceWeight.strategy,
    evidenceLevel: R.proteinReferenceWeight.evidenceLevel,
  };
}

export function proteinTier(strengthSessionsPerWeek) {
  const s = strengthSessionsPerWeek ?? 0;
  return R.protein.tiers.find((t) =>
    (t.sessionsMax == null || s <= t.sessionsMax) &&
    (t.sessionsMin == null || s >= t.sessionsMin)) ?? R.protein.tiers[0];
}

/* ------------------------------------------------------------------ */
/* Carbs as remaining energy (exported pure for tests)                 */
/* ------------------------------------------------------------------ */

export function computeCarbTarget(calorieTarget, proteinTargetG, fatTargetG) {
  const carbTargetG = (calorieTarget - proteinTargetG * R.proteinKcalPerG - fatTargetG * R.fat.kcalPerG) / R.carbs.kcalPerG;
  return { carbTargetG, valid: carbTargetG > 0 };
}

/* ------------------------------------------------------------------ */
/* Main plan                                                           */
/* ------------------------------------------------------------------ */

/**
 * @param {object} input NutritionProfileInput
 * @returns {object} NutritionPlan
 */
export function computePlan(input) {
  const assumptions = [];
  const warnings = [];

  const elig = validateEligibility(input);
  if (!elig.eligible) {
    return {
      algorithmVersion: R.ALGORITHM_VERSION,
      status: 'requires_professional_guidance',
      eligibility: elig,
      assumptions, warnings: [...warnings, ...elig.reasons.map((r) => `ineligible:${r}`)],
      generatedAt: new Date().toISOString(),
    };
  }
  assumptions.push(...elig.warnings.map((w) => `Eligibility: ${w}.`));

  const heightM = input.heightCm / 100;
  const bmi = input.weightKg / (heightM * heightM);

  const rmrKcal = computeRmrKcal(input);
  const act = resolveActivity(input);
  assumptions.push(...act.assumptions);
  if (act.uncertain || act.conflict) warnings.push('activity_estimate_uncertain');

  const estimatedTdeeKcal = rmrKcal * act.activityFactor;
  const calibratedTdeeKcal = null;      // adaptive calibration reserved, not implemented
  const tdeeSource = 'formula';

  const goal = input.goal ?? 'maintenance';
  const level = input.preferredDeficitLevel
    ?? (goal === 'maintenance' ? null : (R.deficit.goalToLevel[goal] ?? R.deficit.defaultLevel));
  let deficitRate = goal === 'maintenance' ? R.deficit.maintenanceRate
    : (R.deficit.levels[level] ?? R.deficit.levels[R.deficit.defaultLevel]);
  if (deficitRate > R.deficit.maxAutomaticRate) {
    deficitRate = R.deficit.maxAutomaticRate;
    assumptions.push(`Requested deficit exceeded the automatic maximum; capped at ${R.deficit.maxAutomaticRate * 100}%.`);
  }

  const calorieTarget = estimatedTdeeKcal * (1 - deficitRate);

  // Energy safety guard
  if (calorieTarget < R.energySafety.minimumAutomaticCalorieTarget) {
    warnings.push('energy_target_below_automatic_planning_threshold');
    return {
      algorithmVersion: R.ALGORITHM_VERSION,
      status: 'review_required',
      bmi, rmrKcal,
      activityFactor: act.activityFactor, activityFactorReason: act.activityFactorReason,
      estimatedTdeeKcal, calibratedTdeeKcal, tdeeSource, deficitRate,
      calorieTarget,
      calorieRange: null,
      warnings, assumptions,
      generatedAt: new Date().toISOString(),
    };
  }

  const { proteinReferenceWeightKg, capped } = computeProteinReferenceWeight(input, bmi);
  if (capped) {
    warnings.push('protein_reference_weight_capped');
    assumptions.push('Protein reference weight was capped using the configured BMI heuristic (capped_bmi_reference_weight, product_heuristic). It is an internal reference, not an ideal weight.');
  }

  const tier = proteinTier(input.strengthSessionsPerWeek);
  const proteinTargetG = proteinReferenceWeightKg * tier.coef;
  const proteinRangeG = [proteinReferenceWeightKg * tier.range[0], proteinReferenceWeightKg * tier.range[1]];

  // Fat rules
  const fatTargetRaw = proteinReferenceWeightKg * R.fat.targetRawPerKg;
  const fatMinimumFromWeight = proteinReferenceWeightKg * R.fat.minimumFromWeightPerKg;
  const fatMinimumFromEnergy = (calorieTarget * R.fat.minimumFromEnergyPercent) / R.fat.kcalPerG;
  const fatMinimum = Math.max(fatMinimumFromWeight, fatMinimumFromEnergy);
  const fatMaximum = (calorieTarget * R.fat.maximumFromEnergyPercent) / R.fat.kcalPerG;
  if (fatMinimum > fatMaximum) {
    warnings.push('fat_rule_conflict');
    return {
      algorithmVersion: R.ALGORITHM_VERSION,
      status: 'review_required',
      bmi, rmrKcal,
      activityFactor: act.activityFactor, activityFactorReason: act.activityFactorReason,
      estimatedTdeeKcal, calibratedTdeeKcal, tdeeSource, deficitRate, calorieTarget,
      proteinReferenceWeightKg, proteinTargetG, proteinRangeG,
      warnings, assumptions,
      generatedAt: new Date().toISOString(),
    };
  }
  const fatTargetG = Math.min(Math.max(fatTargetRaw, fatMinimum), fatMaximum);
  const fatRangeG = [fatMinimum, fatMaximum];

  // Carbs as remaining energy
  const carbTargetG = (calorieTarget - proteinTargetG * R.proteinKcalPerG - fatTargetG * R.fat.kcalPerG) / R.carbs.kcalPerG;
  if (carbTargetG <= 0) {
    warnings.push('carbohydrate_target_invalid');
    return {
      algorithmVersion: R.ALGORITHM_VERSION,
      status: 'review_required',
      bmi, rmrKcal,
      activityFactor: act.activityFactor, activityFactorReason: act.activityFactorReason,
      estimatedTdeeKcal, calibratedTdeeKcal, tdeeSource, deficitRate, calorieTarget,
      proteinReferenceWeightKg, proteinTargetG, proteinRangeG, fatTargetG, fatRangeG,
      warnings, assumptions,
      generatedAt: new Date().toISOString(),
    };
  }
  const carbRangeG = [carbTargetG * (1 - R.carbs.rangeFactor), carbTargetG * (1 + R.carbs.rangeFactor)];

  const calorieRangeOut = [calorieTarget * R.calorieRange.lowerFactor, calorieTarget * R.calorieRange.upperFactor];

  // Macro validation (reference ranges as benchmark only)
  const macroDistribution = validateMacroDistribution(proteinTargetG, fatTargetG, carbTargetG, calorieTarget);
  let adjustedFat = fatTargetG, adjustedCarb = carbTargetG;
  if (macroDistribution.outsideReference) {
    warnings.push('macro_distribution_outside_reference_range');
    // Prefer nudging fat/carbs; never break protein priority.
    const adj = nudgeTowardsReference(macroDistribution, calorieTarget, proteinTargetG, fatTargetG, carbTargetG);
    adjustedFat = adj.fatG; adjustedCarb = adj.carbG;
    assumptions.push(`Macro distribution fell outside reference ranges; fat/carbs were nudged (protein untouched): fat ${fatTargetG.toFixed(0)}→${adjustedFat.toFixed(0)}g, carbs ${carbTargetG.toFixed(0)}→${adjustedCarb.toFixed(0)}g.`);
  }

  // Training / rest day split
  const mode = input.useTrainingDayAdjustment ? 'training_day_adjusted' : R.trainingDay.defaultMode;
  let trainingDayTargets = null, restDayTargets = null;
  const s = input.strengthSessionsPerWeek ?? 0;
  if (mode === 'training_day_adjusted' && s >= R.trainingDay.minSessionsToSplit && s <= R.trainingDay.maxSessionsToSplit) {
    let uplift = Math.min(adjustedCarb * R.trainingDay.carbUpliftPercent, R.trainingDay.carbUpliftCapG);
    let trainingCarb = adjustedCarb + uplift;
    let restCarb = (7 * adjustedCarb - s * trainingCarb) / (7 - s);
    const floor = adjustedCarb * R.trainingDay.restCarbFloorPercentOfTarget;
    while (restCarb < floor && uplift > 0) {
      uplift = Math.max(0, uplift - 1);
      trainingCarb = adjustedCarb + uplift;
      restCarb = (7 * adjustedCarb - s * trainingCarb) / (7 - s);
    }
    if (uplift === 0) assumptions.push('Training-day carb uplift reduced to 0 to respect the rest-day carb floor.');
    trainingDayTargets = { calorieTarget: calorieTarget + uplift * R.carbs.kcalPerG, proteinTargetG, fatTargetG: adjustedFat, carbTargetG: trainingCarb };
    restDayTargets = { calorieTarget: calorieTarget - (s * uplift * R.carbs.kcalPerG) / Math.max(1, 7 - s), proteinTargetG, fatTargetG: adjustedFat, carbTargetG: restCarb };
  } else if (mode === 'training_day_adjusted') {
    assumptions.push(`training_day_adjusted requested with ${s} sessions/week; MVP keeps daily_balanced (split only for ${R.trainingDay.minSessionsToSplit}–${R.trainingDay.maxSessionsToSplit} sessions).`);
  }

  const mealsPerDay = input.mealsPerDay ?? 3;
  const mealGuidanceBudgets = buildMealGuidance(mealsPerDay, calorieTarget, proteinTargetG, adjustedCarb, adjustedFat);

  return {
    algorithmVersion: R.ALGORITHM_VERSION,
    status: 'valid',
    eligibility: elig,
    bmi,
    rmrKcal,
    activityFactor: act.activityFactor,
    activityFactorReason: act.activityFactorReason,
    estimatedTdeeKcal,
    calibratedTdeeKcal,
    tdeeSource,
    deficitRate,
    calorieTarget,
    calorieRange: calorieRangeOut,
    proteinReferenceWeightKg,
    proteinTargetG,
    proteinRangeG,
    fatTargetG: adjustedFat,
    fatRangeG,
    carbTargetG: adjustedCarb,
    carbRangeG,
    macroDistribution,
    trainingDayTargets,
    restDayTargets,
    mealGuidanceBudgets,
    assumptions,
    warnings,
    generatedAt: new Date().toISOString(),
    // Legacy aliases so existing screens/engine keep working during migration.
    maintenanceCalories: Math.round(estimatedTdeeKcal),
    targetCalories: Math.round(calorieTarget),
    fiberTargetG: R.plants.fiberTargetG[input.biologicalSex] ?? R.plants.fiberTargetG.unspecified,
    sodiumCeilingMg: 2000,
    strategyId: R.ALGORITHM_VERSION,
    strategyNote: 'Nutrition Strategy v1 (Mifflin-St Jeor + versioned product heuristics).',
  };
}

/* ------------------------------------------------------------------ */
/* Macro validation                                                    */
/* ------------------------------------------------------------------ */

export function validateMacroDistribution(proteinG, fatG, carbG, calorieTarget) {
  const pE = (proteinG * R.proteinKcalPerG / calorieTarget) * 100;
  const fE = (fatG * R.fat.kcalPerG / calorieTarget) * 100;
  const cE = (carbG * R.carbs.kcalPerG / calorieTarget) * 100;
  const inRange = (v, [lo, hi]) => v >= lo && v <= hi;
  const outside = [];
  if (!inRange(pE, R.macroReferenceRanges.proteinEnergyPercent)) outside.push('protein');
  if (!inRange(fE, R.macroReferenceRanges.fatEnergyPercent)) outside.push('fat');
  if (!inRange(cE, R.macroReferenceRanges.carbEnergyPercent)) outside.push('carb');
  return {
    proteinEnergyPercent: pE,
    fatEnergyPercent: fE,
    carbEnergyPercent: cE,
    outsideReference: outside.length > 0,
    outsideMacros: outside,
  };
}

/** Nudge fat/carbs toward reference ranges; protein untouched. */
function nudgeTowardsReference(dist, calorieTarget, proteinG, fatG, carbG) {
  let f = fatG, c = carbG;
  const [fLo, fHi] = R.macroReferenceRanges.fatEnergyPercent;
  const fE = dist.fatEnergyPercent;
  if (fE < fLo) f = (calorieTarget * (fLo + 1) / 100) / R.fat.kcalPerG;
  if (fE > fHi) f = (calorieTarget * (fHi - 1) / 100) / R.fat.kcalPerG;
  // carbs = whatever energy remains after protein + (nudged) fat
  c = (calorieTarget - proteinG * R.proteinKcalPerG - f * R.fat.kcalPerG) / R.carbs.kcalPerG;
  return { fatG: f, carbG: Math.max(0, c) };
}

/* ------------------------------------------------------------------ */
/* Meal guidance                                                       */
/* ------------------------------------------------------------------ */

export function buildMealGuidance(mealsPerDay, calorieTarget, proteinTargetG, carbTargetG, fatTargetG) {
  const shares = R.mealDistribution[mealsPerDay] ?? R.mealDistribution[3];
  const flexible = R.mealDistribution.flexibleShare[mealsPerDay] ?? 0.10;
  const proteinShares = R.mealDistribution.proteinShare[mealsPerDay] ?? R.mealDistribution.proteinShare[3];
  return shares.map((m) => {
    const mealCal = calorieTarget * m.share;
    const pTarget = proteinTargetG * (proteinShares[m.mealType] ?? m.share);
    return {
      mealType: m.mealType,
      planningShare: m.share,
      calorieRange: [mealCal * R.calorieRange.lowerFactor, mealCal * R.calorieRange.upperFactor],
      proteinMinimum: pTarget * R.protein.adequateAtPercentOfTarget,
      proteinTarget: pTarget,
      carbRange: [carbTargetG * m.share * (1 - R.carbs.rangeFactor), carbTargetG * m.share * (1 + R.carbs.rangeFactor)],
      fatMaximum: fatTargetG * m.share * 1.25,
      isSoftTarget: true,
      remainingDayFlexibility: flexible,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Protein judgement (section 13)                                      */
/* ------------------------------------------------------------------ */

export function proteinStatus(consumedProteinG, proteinTargetG) {
  const r = proteinTargetG > 0 ? consumedProteinG / proteinTargetG : 0;
  if (r > R.protein.stopPrioritizingAbove) return 'no_need_to_prioritize';
  if (r >= R.protein.adequateAtPercentOfTarget) return 'enough';
  if (r >= R.protein.opportunityBand[0]) return 'next_meal_opportunity';
  return 'needs_more';
}
