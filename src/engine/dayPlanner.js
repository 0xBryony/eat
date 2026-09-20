/**
 * Day Planner — generate "典型一天" reference day cards from the USER's plan.
 * ------------------------------------------------------------------------
 * Pure function over (NutritionPlan, meals[]). Not an LLM.
 *
 * A day card = breakfast combo (optional) + two same-brand takeout units
 * (main + ≤2 add-ons). Tiers, in order of preference:
 *   strict            — energy/protein/fat all inside plan bands + veg covered
 *   fat_flex          — fat ≤ ceiling +12% (spec §15: soft upper guidance)
 *   protein_addon     — protein ≥72% of target, closed by a tea-egg×2 add-on
 *   energy_relaxed    — energy within ±12% of range (day runs light/heavy)
 *
 * Selection = diversity greedy (novelty on lunch base, dinner base, brands)
 * so cards don't collapse into the same two high-protein brands.
 *
 * No forbidden language; carbs are soft reference (spec §16/§17).
 */

const VEGTAG = ['vegetable_rich', 'high_fiber', 'salad', 'vegetable'];
const BF_SUB = (m) => (((m.tags || []).find((t) => t.startsWith('bf_'))) || '').slice(3);
const isVeg = (m) => VEGTAG.some((t) => (m.tags || []).includes(t))
  || /蔬菜|沙拉|西兰花|藜麦|杂粮/.test(m.productName || '')
  || (m.id || '').startsWith('shaye-') || (m.id || '').startsWith('foodbowl-');
const isSide = (m) => (m.tags || []).some((t) => ['side', 'drink', 'add_on'].includes(t))
  || /主食|加料|单加/.test(m.menuCategory || '');

const ADDONS = [
  { id: 'bf-tea-egg', qty: 2, extra: null,          label: '茶叶蛋×2（加餐）', e: 144, p: 12.4, f: 10.6, c: 0.8 },
  { id: 'bf-tea-egg', qty: 2, extra: 'bf-greek-yogurt', label: '茶叶蛋×2＋希腊酸奶（加餐）', e: 203, p: 22.4, f: 11.0, c: 4.4 },
  { id: 'bf-tea-egg', qty: 2, extra: 'bf-milk',     label: '茶叶蛋×2＋牛奶（加餐）', e: 309, p: 20.4, f: 20.1, c: 12.8 },
];

export function generateDayCards(plan, meals, { limit = 12, mealsPerDay = 3 } = {}) {
  if (!plan || plan.status !== 'valid' || !Array.isArray(meals)) return [];

  const full = meals.filter((m) => m.proteinG != null && m.energyKcal != null && !(m.id || '').startsWith('pick-'));
  const bfS = full.filter((m) => m.id.startsWith('bf-'));
  const rest = full.filter((m) => !m.id.startsWith('bf-'));
  const mains = rest.filter((m) => !isSide(m) && m.menuCategory !== '主食' && m.energyKcal >= 150);
  const addOns = rest.filter((m) => isSide(m) || m.menuCategory === '主食');
  if (mains.length < 2) return [];

  // same-brand units: main [+ ≤2 same-brand add-ons]
  const units = [];
  for (const m of mains) {
    units.push({ meals: [m], base: m.productName, brand: m.brand, cf: m.confidence,
      e: m.energyKcal, p: m.proteinG, f: m.fatG, c: m.carbG, veg: isVeg(m) });
    for (const s of addOns) {
      if (s.brand !== m.brand) continue;
      units.push({ meals: [m, s], base: m.productName, brand: m.brand, cf: m.confidence,
        e: m.energyKcal + s.energyKcal, p: m.proteinG + s.proteinG, f: m.fatG + s.fatG, c: m.carbG + s.carbG, veg: isVeg(m) || isVeg(s) });
      for (const s2 of addOns) {
        if (s2.brand !== m.brand || s2.id <= s.id) continue;
        units.push({ meals: [m, s, s2], base: m.productName, brand: m.brand, cf: m.confidence,
          e: m.energyKcal + s.energyKcal + s2.energyKcal, p: m.proteinG + s.proteinG + s2.proteinG, f: m.fatG + s.fatG + s2.fatG, c: m.carbG + s.carbG + s2.carbG, veg: isVeg(m) || isVeg(s) || isVeg(s2) });
      }
    }
  }

  // breakfast combos: single, or pair across DIFFERENT subtypes
  const bfCombos = [];
  for (const a of bfS) bfCombos.push({ meals: [a], e: a.energyKcal, p: a.proteinG, f: a.fatG, c: a.carbG });
  for (const a of bfS) for (const b of bfS) {
    if (b.id <= a.id || BF_SUB(a) === BF_SUB(b)) continue;
    bfCombos.push({ meals: [a, b], e: a.energyKcal + b.energyKcal, p: a.proteinG + b.proteinG, f: a.fatG + b.fatG, c: a.carbG + b.carbG });
  }

  const [lo, hi] = plan.calorieRange;
  const pT = plan.proteinTargetG;
  const [fLo, fHi] = plan.fatRangeG;
  const cT = plan.carbTargetG;

  const pool = [];
  const consider = (bf, a, d) => {
    const veg = a.veg || d.veg;
    if (!veg) return;
    const E0 = (bf ? bf.e : 0) + a.e + d.e;
    const P0 = (bf ? bf.p : 0) + a.p + d.p;
    const F0 = (bf ? bf.f : 0) + a.f + d.f;
    const C0 = (bf ? bf.c : 0) + a.c + d.c;
    if (E0 >= lo && E0 <= hi && P0 >= pT * 0.9 && F0 >= fLo && F0 <= fHi) {
      pool.push({ tier: 'strict', bf, a, d, E: E0, P: P0, F: F0, C: C0, addon: null });
      return;
    }
    if (E0 >= lo && E0 <= hi && F0 > fHi && F0 <= fHi * 1.12 && P0 >= pT * 0.9) {
      pool.push({ tier: 'fat_flex', bf, a, d, E: E0, P: P0, F: F0, C: C0, addon: null });
      return;
    }
    // protein closure via escalating add-on snacks
    if (E0 >= lo * 0.85 && E0 <= hi && F0 >= fLo && F0 <= fHi && P0 < pT * 0.9 && P0 >= pT * 0.72) {
      for (const ad of ADDONS) {
        if (P0 + ad.p >= pT * 0.9 && E0 + ad.e <= hi && E0 + ad.e >= lo && F0 + ad.f <= fHi) {
          pool.push({ tier: 'protein_addon', bf, a, d, E: E0 + ad.e, P: P0 + ad.p, F: F0 + ad.f, C: C0 + ad.c, addon: ad });
          return;
        }
      }
    }
    if (E0 >= lo * 0.85 && E0 <= hi * 1.12 && P0 >= pT * 0.9 && F0 >= fLo && F0 <= fHi) {
      pool.push({ tier: 'energy_relaxed', bf, a, d, E: E0, P: P0, F: F0, C: C0, addon: null });
    }
  };

  if (mealsPerDay >= 3) {
    for (const bc of bfCombos) for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) {
      if (units[i].base === units[j].base) continue;
      consider(bc, units[i], units[j]);
    }
  }
  // 2-meal day: no breakfast, escalating snack closures
  for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) {
    if (units[i].base === units[j].base) continue;
    const a = units[i], d = units[j];
    const E0 = a.e + d.e, P0 = a.p + d.p, F0 = a.f + d.f, C0 = a.c + d.c;
    if (!(a.veg || d.veg)) continue;
    for (const ad of ADDONS) {
      const E = E0 + ad.e, P = P0 + ad.p, F = F0 + ad.f;
      if (E >= lo * 0.9 && E <= hi && P >= pT * 0.9 && F >= fLo && F <= fHi) {
        pool.push({ tier: 'two_meal_addon', bf: null, a, d, E, P, F, C: C0 + ad.c, addon: ad });
        break;
      }
    }
  }
  if (pool.length === 0) return [];

  // diversity greedy
  const useL = {}, useD = {}, useB = {};
  const pen = (c) => (useL[c.a.base] || 0) + (useD[c.d.base] || 0) + (useB[c.a.brand] || 0) * 0.6 + (useB[c.d.brand] || 0) * 0.6;
  const tierRank = { strict: 0, protein_addon: 1, fat_flex: 2, energy_relaxed: 3, two_meal_addon: 1 };
  pool.sort((x, y) => (tierRank[x.tier] - tierRank[y.tier]) || (y.P - x.P));
  const picked = [];
  const remaining = [...pool];
  while (picked.length < limit && remaining.length) {
    remaining.sort((x, y) => (pen(x) - pen(y)) || (tierRank[x.tier] - tierRank[y.tier]) || (y.P - x.P));
    const c = remaining.shift();
    picked.push(c);
    useL[c.a.base] = (useL[c.a.base] || 0) + 1;
    useD[c.d.base] = (useD[c.d.base] || 0) + 1;
    useB[c.a.brand] = (useB[c.a.brand] || 0) + 1;
    useB[c.d.brand] = (useB[c.d.brand] || 0) + 1;
  }

  return picked.map((c, idx) => ({
    id: `day-${String(idx + 1).padStart(2, '0')}`,
    tier: c.tier,
    breakfast: c.bf ? c.bf.meals : (c.addon && c.tier === 'two_meal_addon' ? [] : []),
    plannedAddon: c.addon,
    lunch: c.a.meals,
    dinner: d2meals(c.d),
    brands: [...new Set([c.a.brand, c.d.brand])],
    confidence: [...new Set([c.a.cf, c.d.cf, ...(c.bf ? c.bf.meals.map((m) => m.confidence) : [])])],
    totals: { energy: Math.round(c.E), protein: Math.round(c.P), fat: Math.round(c.F), carbs: Math.round(c.C) },
    guidance: guidanceFor(c, cT),
  }));
}

function d2meals(d) { return d.meals; }

function guidanceFor(c, carbTarget) {
  const parts = [];
  if (c.tier === 'fat_flex') parts.push('油脂比今日参考略高——另一餐不用再额外加高脂配菜就好。');
  if (c.tier === 'protein_addon' || c.tier === 'two_meal_addon') parts.push('蛋白靠一份茶叶蛋加餐补齐。');
  if (c.C < carbTarget * 0.85) parts.push('主食正常吃即可，不追加不削减。');
  if (c.tier === 'energy_relaxed') parts.push('全天偏轻/偏足一点，用灵活额度找平。');
  if (parts.length === 0) parts.push('节奏很好，不用改什么。');
  return parts.join(' ');
}
