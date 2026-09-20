/**
 * Meal Matching — unified structured-output interface for the 3 input modes.
 * ------------------------------------------------------------------------
 *   1. screenshot (外卖订单截图): OCR/vision → brand+product text → fuzzy
 *      semantic match against the DB → DB nutrition.  (highest priority)
 *   2. text (自然语言): entity extraction → SKU match → DB nutrition.
 *   3. photo (食物照片): if no SKU can be determined → component recognition
 *      → generic meal template → nutrition RANGE. Never a fake-precise kcal.
 *
 * In v0 the OCR / vision / NER steps are MOCKED (they just consume the text
 * the demo provides). Everything DOWNSTREAM of them — matching, nutrition
 * lookup, confidence, uncertainty, clarifying question — is real and driven
 * by the frozen database. Swapping in a real vision/LLM pipeline later only
 * replaces `extractText()`.
 *
 * Structured output schema (per product spec):
 *   brand, candidate_product, matched_sku_id, components, quantity_estimate,
 *   confidence, nutrition_source, uncertainty_drivers, clarifying_question
 */

import { MEALS, TEMPLATE_MEALS, getMealById } from '../data/meals.js?v=39';

const BRAND_DICT = [
  [/麦当劳|麦记|mcd/i, '麦当劳'], [/肯德基|kfc/i, '肯德基'], [/老乡鸡/i, '老乡鸡'],
  [/赛百味|subway/i, 'Subway 赛百味中国'], [/超级碗|foodbowl/i, '超级碗 FOODBOWL'],
  [/沙野/i, '沙野轻食'], [/米村/i, '米村拌饭'], [/塔斯汀/i, '塔斯汀中国汉堡'],
  [/全家|familymart/i, '全家便利店'], [/罗森|lawson/i, '罗森'], [/沙县/i, '沙县小吃'],
];

const TEMPLATE_DICT = [
  [/麻辣烫/, 'tpl-malatang'], [/冒菜/, 'tpl-maocai'], [/兰州|牛肉面/, 'tpl-lanzhou'],
  [/重庆小面|小面/, 'tpl-cq-xiaomian'], [/黄焖鸡/, 'tpl-huangmenji'], [/石锅|拌饭/, 'tpl-shiguo-bibimbap'],
  [/烧腊|叉烧|烧鸭/, 'tpl-shaolao'], [/螺蛳粉/, 'tpl-luosifen'], [/馄饨|饺子|蒸饺/, 'tpl-huntun-jiaozi'],
  [/米线|过桥/, 'tpl-mixian'], [/称重|自选/, 'tpl-weighed-dish'], [/盒饭|盖浇|盖饭/, 'tpl-gaifan'],
  [/粥/, 'tpl-congee'], [/寿司|丼|盖饭日/, 'tpl-sushi-don'],
];

/** MOCK vision/OCR/NER — in production this is the only piece replaced. */
function extractText(input) {
  return (input.text || '').trim();
}

function tokens(s) {
  return (s || '').toLowerCase().replace(/[（）()·\s+/]/g, '').split('');
}

/** Char-bigram overlap score between query and product name. */
function similarity(q, name) {
  const a = tokens(q), b = tokens(name);
  if (!a.length || !b.length) return 0;
  const grams = (arr) => {
    const set = new Set();
    for (let i = 0; i < arr.length - 1; i++) set.add(arr[i] + arr[i + 1]);
    if (arr.length === 1) set.add(arr[0]);
    return set;
  };
  const ga = grams(a), gb = grams(b);
  let hit = 0;
  ga.forEach((g) => { if (gb.has(g)) hit++; });
  return hit / Math.max(1, Math.min(ga.size, gb.size));
}

/** Longest common substring length (two-row DP, strings are short). */
function lcsLen(a, b) {
  let prev = new Array(b.length + 1).fill(0);
  let best = 0;
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : 0;
      if (cur[j] > best) best = cur[j];
    }
    prev = cur;
  }
  return best;
}

/** Core product name = menu name without parenthetical variants. */
function coreName(m) {
  return (m.productName || '').replace(/[（(][^）)]*[)）]/g, '').trim();
}

/** Combined match score: bigram similarity OR coverage of the core name. */
function matchScore(text, m) {
  const name = coreName(m);
  const cov = name.length ? lcsLen(tokens(text).join(''), tokens(name).join('')) / tokens(name).length : 0;
  const lcs = lcsLen(tokens(text).join(''), tokens(name).join(''));
  return Math.max(similarity(text, m.productName), lcs >= 3 ? cov : 0);
}

let lastMatch = null;
const resolvedRegistry = new Map();

export function getLastMatch() { return lastMatch; }
export function getResolved(id) { return resolvedRegistry.get(id); }

/**
 * @param {{method:'screenshot'|'photo'|'text'|'search', text?:string}} input
 * @returns {object} unified structured match
 */
export function interpretMealInput(input) {
  const method = input.method || 'text';
  const text = extractText(input);

  const brandHit = BRAND_DICT.find(([re]) => re.test(text));
  const brand = brandHit ? brandHit[1] : null;

  // 1) SKU fuzzy match (optionally constrained to the detected brand)
  let pool = MEALS;
  if (brand) pool = MEALS.filter((m) => m.brand === brand);
  let best = null, bestScore = 0;
  for (const m of pool) {
    const score = matchScore(text, m);
    if (score > bestScore) { bestScore = score; best = m; }
  }
  // cross-brand fallback if the brand-constrained pass found nothing
  if (!best || bestScore < 0.34) {
    for (const m of MEALS) {
      const s = matchScore(text, m);
      if (s > bestScore) { bestScore = s; best = m; }
    }
  }

  const matched = best && bestScore >= 0.34 ? best : null;

  if (matched) {
    lastMatch = {
      method,
      match_type: method === 'screenshot' ? 'ocr_fuzzy_match' : method === 'photo' ? 'vision_then_sku_match' : 'semantic_sku_match',
      brand: matched.brand,
      candidate_product: matched.productName,
      matched_sku_id: matched.id,
      matched_template_id: null,
      components: matched.comboComponents || null,
      quantity_estimate: 1,
      confidence: matched.confidence,
      match_score: Math.round(bestScore * 100) / 100,
      nutrition_source: {
        type: matched.sourceType, url: matched.sourceUrl, title: matched.sourceTitle,
        date: matched.sourceDate, confidence: matched.confidence, basis: matched._basis,
      },
      energy_range_kcal: matched.energyRangeKcal,
      uncertainty_drivers: matched.uncertaintyDrivers || [],
      clarifying_question: matched.clarifyingQuestion || null,
    };
    return lastMatch;
  }

  // 2) No SKU → generic template (photo / screenshot / vague description)
  const tplHit = TEMPLATE_DICT.find(([re]) => re.test(text))
    || (method === 'photo' || method === 'screenshot' ? [null, 'tpl-malatang'] : null);
  const tpl = tplHit ? TEMPLATE_MEALS.find((t) => t.id === tplHit[1]) : null;

  if (tpl) {
    resolvedRegistry.set(tpl.id, tpl);
    lastMatch = {
      method,
      match_type: method === 'photo' ? 'vision_component_to_template' : 'semantic_to_template',
      brand: null,
      candidate_product: tpl.productName,
      matched_sku_id: null,
      matched_template_id: tpl.id,
      components: tpl.components,
      quantity_estimate: 1,
      confidence: tpl.confidence,
      match_score: null,
      nutrition_source: {
        type: tpl.sourceType, url: tpl.sourceUrl, title: tpl.sourceTitle,
        confidence: tpl.confidence, basis: 'template_range',
      },
      energy_range_kcal: tpl.energyRangeKcal,
      uncertainty_drivers: tpl.uncertaintyDrivers || [],
      clarifying_question: tpl.clarifyingQuestion || null,
    };
    return lastMatch;
  }

  // 3) Nothing recognizable — honest unknown
  lastMatch = {
    method, match_type: 'no_match', brand, candidate_product: text || null,
    matched_sku_id: null, matched_template_id: null, components: null,
    quantity_estimate: null, confidence: 'U', match_score: 0,
    nutrition_source: null, energy_range_kcal: null,
    uncertainty_drivers: [], clarifying_question: null,
  };
  return lastMatch;
}

/** Resolve a match to a meal-shaped object the screens can render. */
export function resolveMatchToMeal(match) {
  if (match.matched_sku_id) return getMealById(match.matched_sku_id);
  if (match.matched_template_id) return getMealById(match.matched_template_id);
  return null;
}

/**
 * Task 5 — single-question uncertainty.
 * Given the match's ONE clarifying question and the user's answer index,
 * narrow the energy range. Rules are deterministic and disclosed:
 *   portion-style q  → scale range by [0.6, 0.85, 1.0]
 *   sauce/麻酱 q     → subtract [90, 45, 0] kcal
 *   soup q           → subtract [0, 60, 120] kcal
 * Returns { energyRangeKcal, assumption } or null if not applicable.
 */
export function refineWithAnswer(match, answerIndex) {
  if (!match || !match.clarifying_question || !match.energy_range_kcal) return null;
  const q = match.clarifying_question.question;
  const [lo, hi] = match.energy_range_kcal;
  const i = Math.max(0, Math.min(2, Number(answerIndex) || 0));
  let out = null, assumption = '';
  if (/多少|份量|多还是少/.test(q) && !/酱|汤/.test(q)) {
    const f = [0.6, 0.85, 1.0][i];
    out = [Math.round(lo * f), Math.round(hi * f)];
    assumption = `按「${match.clarifying_question.options[i]}」折算份量`;
  } else if (/酱|麻酱/.test(q)) {
    const sub = [90, 45, 0][i];
    out = [Math.max(0, lo - sub), Math.max(0, hi - sub)];
    assumption = `按「${match.clarifying_question.options[i]}」酱料折算`;
  } else if (/汤/.test(q)) {
    const sub = [0, 60, 120][i];
    out = [Math.max(0, lo - sub), Math.max(0, hi - sub)];
    assumption = `按「${match.clarifying_question.options[i]}」汤量折算`;
  }
  return out ? { energyRangeKcal: out, assumption } : null;
}
