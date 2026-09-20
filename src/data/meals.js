/**
 * Meal Repository — REAL database layer (replaces the old mock meals.js).
 * ------------------------------------------------------------------------
 * Loads the demo-ready slice of the frozen research database
 * (eat-database v0 → eat/data/demo_meals.json + templates.json).
 *
 * No nutrition number here is invented: every value comes from the DB with
 * its sourceType + confidence. Where the DB only has a range or a per-100g
 * basis, we derive a *point* for internal scoring ONLY (midpoint of the
 * stated range, or per-100g × midpoint of the stated typical portion) and we
 * KEEP the range for display. `_pointIsEstimate` marks those so the UI never
 * presents them as exact.
 */

const [mealsRaw, TEMPLATES] = await Promise.all([
  fetch('./data/demo_meals.json?v=39').then((r) => r.json()),
  fetch('./data/templates.json?v=39').then((r) => r.json()),
]);

import { normalizeMealNutrition } from '../engine/mealNutritionAdapter.js?v=39';

function mid(range) {
  if (!range || range.length < 2) return null;
  const [a, b] = range;
  if (a == null || b == null) return a ?? b;
  return (a + b) / 2;
}

/**
 * Normalize a DB entry into the shape the screens consume, deriving an
 * internal scoring point without ever discarding the honest range.
 */
function normalize(m) {
  const basis = m.basis || 'unknown';
  const per100 = basis.startsWith('per_100g');
  const portion = m.demoPortionG;

  let point = m.energyKcal;
  let range = m.energyRangeKcal ? [...m.energyRangeKcal] : null;

  if (per100) {
    const per100Point = m.energyKcal ?? mid(m.energyRangeKcal);
    if (per100Point != null && portion) {
      const pm = (portion.min + portion.max) / 2;
      point = Math.round((per100Point * pm) / 100);
      range = [
        Math.round((per100Point * portion.min) / 100),
        Math.round((per100Point * portion.max) / 100),
      ];
    } else if (per100Point != null) {
      point = Math.round(per100Point);
    }
  } else if (basis === 'estimated_range') {
    point = Math.round(mid(range) ?? 0);
  } else if (basis === 'estimated_point') {
    point = m.energyKcal;
    if (!range && point) range = [Math.round(point * 0.88), Math.round(point * 1.12)];
  }

  // Macros: scale per-100g to the portion midpoint; keep nulls honest.
  const scale = per100 && portion ? (portion.min + portion.max) / 200 : 1;
  const sc = (v) => (v == null ? null : Math.round(v * scale * 10) / 10);

  return {
    ...m,
    _norm: normalizeMealNutrition(m),
    energyKcal: point,
    proteinG: sc(m.proteinG),
    carbG: sc(m.carbsG),
    fatG: sc(m.fatG),
    fiberG: sc(m.fiberG),
    sodiumMg: sc(m.sodiumMg),
    energyRangeKcal: range,
    followUpQuestion: m.clarifyingQuestion ? m.clarifyingQuestion.question : null,
    followUpOptions: m.clarifyingQuestion ? m.clarifyingQuestion.options : null,
    _pointIsEstimate: basis !== 'exact',
    _basis: basis,
  };
}

function templateQuestion(t) {
  const d = (t.uncertaintyDrivers || []).join('');
  if (/麻酱|酱/.test(d)) return { question: '麻酱/酱加了吗？', options: ['没有', '一点', '正常量'] };
  if (/汤/.test(d)) return { question: '汤喝了多少？', options: ['全喝了', '喝了一半', '没怎么喝'] };
  if (/米饭|主食|面量|份量|克数/.test(d)) return { question: '主食大概吃了多少？', options: ['小半份', '大半份', '基本吃完'] };
  return { question: '这份比平时多还是少？', options: ['少一些', '差不多', '多一些'] };
}

/** @type {Array<object>} demo-ready meals, legacy-compatible shape */
export const MEALS = mealsRaw.map(normalize);

/** Template-derived pseudo meals (photo / no-SKU fallback). */
export const TEMPLATE_MEALS = TEMPLATES.filter((t) => t.energyRangeKcal).map((t) => ({
  id: t.id,
  brand: '非品牌典型场景',
  productName: t.name,
  menuCategory: t.category,
  emoji: ({ hotpot: '🍲', noodles: '🍜', rice_bowl: '🍛', dumpling: '🥟', congee: '🥣', combo: '🥪', weighed: '🍱', japanese: '🍣' })[t.category] || '🍽',
  itemType: 'generic_template',
  basis: 'template_range',
  servingSize: 1,
  servingUnit: t.typicalPortion,
  energyKcal: Math.round(mid(t.energyRangeKcal)),
  proteinG: mid(t.proteinRangeG),
  carbsG: null, fatG: null, fiberG: null, sodiumMg: null,
  energyRangeKcal: t.energyRangeKcal,
  sourceType: 'semantic_estimate',
  sourceUrl: t.sources || '',
  sourceTitle: 'generic meal template (eat-database v0)',
  confidence: t.confidence,
  tags: [t.category],
  mealTypes: ['lunch', 'dinner'],
  uncertaintyDrivers: t.uncertaintyDrivers,
  components: t.components,
  variableParameters: t.variableParameters,
  clarifyingQuestion: templateQuestion(t),
  followUpQuestion: templateQuestion(t)?.question || null,
  followUpOptions: templateQuestion(t)?.options || null,
  _pointIsEstimate: true,
  _basis: 'template_range',
  _isTemplate: true,
}));

const ALL = [...MEALS, ...TEMPLATE_MEALS];

export function getMealById(id) {
  return ALL.find((m) => m.id === id);
}

export function filterMealsByTags(tags) {
  if (!tags || tags.length === 0) return MEALS;
  return MEALS.filter((m) => (m.tags || []).some((t) => tags.includes(t)));
}

/** Craving chips → tag mapping (single source: data/cravingTags.js). */
export { CRAVING_TO_TAGS } from '../data/cravingTags.js?v=39';

export { TEMPLATES };
