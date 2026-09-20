/**
 * What Should I Eat Next? — Recommendation Screen
 * ------------------------------------------------------------------------
 * The most important page in the product. It:
 *   1. Reads the NutritionProfile + today's intake from the store.
 *   2. Asks what the user actually feels like eating (the craving chips).
 *   3. Runs the deterministic scoring engine (see engine/recommend.js).
 *   4. Renders the top pick as an editorial hero line ("今天完全吃得下一个汉堡。")
 *      plus 2–3 alternates with a structured reason.
 *
 * Never shows kcal numbers by default. Numbers live behind "查看营养详情".
 */

import { MEALS, getMealById, CRAVING_TO_TAGS } from '../data/meals.js?v=39';
import { scoreNextMeal, sumIntake, computeGaps } from '../engine/recommend.js?v=39';
import { NEXT_MEAL_HERO, pickLine, mealTypeForHour } from '../data/copy.js?v=39';
import { fitStatusCopy } from '../engine/nutritionRules/v1.js?v=39';

const CRAVINGS = [
  { key: 'chinese',  label: '中餐',    emoji: '🍚' },
  { key: 'burger',   label: '汉堡',    emoji: '🍔' },
  { key: 'noodles',  label: '面',      emoji: '🍜' },
  { key: 'hotpot',   label: '麻辣烫',  emoji: '🍲' },
  { key: 'light',    label: '轻食',    emoji: '🥗' },
  { key: 'japanese', label: '日料',    emoji: '🍙' },
  { key: 'surprise', label: '随便帮我选', emoji: '✨' },
];

/**
 * @param {HTMLElement} root
 * @param {object} params    { craving?: string }
 * @param {{ navigate: Function, store: object }} ctx
 */
export function renderNextMeal(root, params, ctx) {
  const state = ctx.store.get();
  const mealType = params.mealType || mealTypeForHour();
  const craving = params.craving || null;

  const consumedEntries = state.today.meals
    .map((e) => ({ meal: getMealById(e.mealId), quantity: e.quantity, slot: e.slot }))
    .filter((x) => x.meal);
  const consumedNormalized = consumedEntries.map((x) => x.meal._norm);
  const eatenMealTypes = [...new Set(consumedEntries.map((x) => x.slot))];
  const intake = sumIntake(consumedEntries);
  const gaps = computeGaps(state.targets, intake);

  // Build the candidate pool.
  //   - A specific craving NARROWS the ranking pool so the top pick respects
  //     what the user actually wants to eat (product thesis: recommend real
  //     takeout the user craves, not just chicken breast).
  //   - 'surprise' / no craving ranks the whole catalog.
  //   - comboPool is always the full catalog so the combo builder can attach
  //     sides and drinks regardless of the craving filter.
  const allMains = MEALS.filter((m) => !m.tags.includes('drink') && !m.tags.includes('side'));
  let candidates = allMains;
  if (craving && craving !== 'surprise') {
    const tags = CRAVING_TO_TAGS[craving] ?? [];
    const filtered = allMains.filter((m) => tags.some((t) => m.tags.includes(t)));
    if (filtered.length > 0) candidates = filtered;
  }

  const { ranking, reason, dayState } = craving
    ? scoreNextMeal({
        plan: state.targets,
        consumedNormalized,
        candidates,
        comboPool: MEALS,
        craving,
        mealType,
        eatenMealTypes,
        limit: 4,
      })
    : { ranking: null, reason: null, dayState: null };

  root.innerHTML = `
    <div class="screen">
      <header style="padding:2px 2px 0">
        <h1 class="t-nav">下一顿吃什么</h1>
        <p class="t-body" style="margin:8px 0 0">${contextLine(gaps, intake, state.targets)}</p>
      </header>

      <div class="sec-head">
        <h3 class="sec-head__title">${mealTypeLabel(mealType)} · 想吃什么</h3>
      </div>
      <div class="cat-grid">
        ${CRAVINGS.map((c) => `
          <button class="cat-card ${craving === c.key ? 'is-active' : ''}" data-craving="${c.key}">
            <span class="cat-card__emoji">${c.emoji}</span>
            <span class="cat-card__label">${c.label}</span>
          </button>
        `).join('')}
      </div>

      ${craving && ranking && ranking.length ? renderResults(ranking, reason, craving, mealType, state) : renderPlaceholder(craving)}

      <!-- easter egg entry — deliberately low-key -->
      <button class="promo" data-act="go-easter" style="margin-top:20px">
        <span class="promo__icon" style="background:var(--bg-soft)">😈</span>
        <span class="promo__body">
          <span class="promo__title">今天就想吃点狠的？</span>
          <span class="promo__sub">看看你的「真实账单」</span>
        </span>
        <svg class="promo__chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
      </button>
    </div>
  `;

  root.querySelector('[data-act="go-easter"]')?.addEventListener('click', () => ctx.navigate('easter'));

  root.querySelectorAll('[data-craving]').forEach((el) => {
    el.addEventListener('click', () => {
      ctx.navigate('next', { craving: el.dataset.craving, mealType });
    });
  });

  root.querySelectorAll('[data-act="pick"]').forEach((el) => {
    el.addEventListener('click', () => {
      const mealId = el.dataset.mealId;
      ctx.navigate('meal', { step: 'result', mealId, slot: mealType });
    });
  });

  root.querySelector('[data-act="toggle-reason"]')?.addEventListener('click', () => {
    const d = root.querySelector('[data-out="reason-detail"]');
    const l = root.querySelector('[data-out="reason-label"]');
    const open = d.classList.toggle('is-open');
    l.textContent = open ? '收起' : '为什么这样推荐？';
  });
}

/* ------------------------------------------------------------------ */
/* Rendering                                                          */
/* ------------------------------------------------------------------ */

function renderPlaceholder(craving) {
  if (!craving) {
    return `
      <div style="padding:var(--sp-7) 0;text-align:center">
        <div style="font-size:44px;margin-bottom:12px;opacity:0.5">🍽</div>
        <p class="t-card" style="color:var(--ink-2)">先选一个想吃的方向</p>
        <p class="t-caption" style="margin-top:6px">选好就出推荐，会考虑你今天已经吃了什么</p>
      </div>
    `;
  }
  return `
    <div style="padding:var(--sp-7) 0;text-align:center">
      <p class="t-card" style="color:var(--ink-2)">这个方向今天没什么合适的</p>
      <p class="t-caption" style="margin-top:6px">换一个试试</p>
    </div>
  `;
}

function renderResults(ranking, reason, craving, mealType, state) {
  const [top, ...rest] = ranking;
  const cravingLabel = CRAVINGS.find((c) => c.key === craving)?.label || '';
  const hero = buildHeroLine(top, cravingLabel, reason);

  return `
    <div class="sec-head">
      <h3 class="sec-head__title">${cravingLabel} · 帮你挑的</h3>
      <span class="t-caption">${hero.headline}</span>
    </div>

    <div class="reco-list">
      ${recoCard(top, true, reason.combo)}
      ${rest.slice(0, 3).map((m) => recoCard(m, false)).join('')}
    </div>

    <div style="margin-top:var(--sp-4)">
      <button class="link" data-act="toggle-reason">
        <span data-out="reason-label">为什么这样推荐？</span>
      </button>
      <div class="nutri-detail" data-out="reason-detail">
        <div class="nutri-detail__inner" style="border-top:0;padding-top:var(--sp-3)">
          <div class="nutri-grid">
            ${reasonCell('剩余热量', Math.round(reason.remainingEnergyKcal), 'kcal')}
            ${reasonCell('还需蛋白质', Math.round(reason.remainingProteinG), 'g')}
            ${reasonCell('还需纤维', Math.round(reason.remainingFiberG), 'g')}
            ${reasonCell('主要缺口', dominantGapLabel(reason.dominantGap), '')}
          </div>
          <p class="t-caption" style="margin-top:12px;color:var(--ink-4);font-size:11.5px">
            按你今天吃过的算的，每记一顿会重新排。
          </p>
        </div>
      </div>
    </div>
  `;
}

function recoCard(meal, isTop, combo) {
  const comboBlock = combo && combo.items.length > 1 ? `
    <div class="combo">
      ${combo.items.map((it) => `
        <div class="combo__item">
          <span class="combo__emoji">${it.emoji || '🍽'}</span>
          <span class="combo__name">${it.productName}</span>
          <span class="combo__slot">搭一个</span>
        </div>
      `).join('')}
      ${combo.swapNote ? `<p class="t-caption" style="margin:6px 0 0;color:var(--accent);font-weight:500">${combo.swapNote}</p>` : ''}
    </div>
  ` : '';

  return `
    <button class="reco-card ${isTop ? 'is-top' : ''}" data-act="pick" data-meal-id="${meal.id}">
      ${isTop ? '<span class="badge-top" style="margin-bottom:10px">今天最合适</span>' : ''}
      <div class="reco-card__head">
        <span class="reco-card__emoji">${meal.emoji || '🍽'}</span>
        <div style="flex:1;min-width:0">
          <h3 class="reco-card__name">${meal.productName}</h3>
          <p class="reco-card__brand">${meal.brand}${meal.variant ? ' · ' + meal.variant : ''}</p>
        </div>
      </div>
      <p class="reco-card__reason">${meal._reasonText}${(meal.adjustments || []).length ? ' ' + meal.adjustments[0].text : ''}</p>
      ${comboBlock}
      <div class="reco-card__meta">
        <span class="confidence-badge" data-level="${meal.confidence}">
          <span class="confidence-badge__dot"></span>${fitLabel(meal.fitStatus)}
        </span>
        ${meal.tags.slice(0, 2).map((t) => `<span class="tag-pill">${tagLabel(t)}</span>`).join('')}
      </div>
    </button>
  `;
}

function fitLabel(status) {
  return ({ strong_fit: '很合适', workable: '可以', needs_adjustment: '微调更好', weak_fit: '这样搭也行' })[status] || '可以';
}

function reasonCell(label, value, unit) {
  return `
    <div class="nutri-cell">
      <div class="nutri-cell__label">${label}</div>
      <div class="nutri-cell__value">${value}${unit ? `<span class="nutri-cell__unit">${unit}</span>` : ''}</div>
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/* Copy builders                                                      */
/* ------------------------------------------------------------------ */

function buildHeroLine(topMeal, cravingLabel, reason) {
  const n = cravingLabel || topMeal.productName;
  const headline = ({
    strong_fit: `今天完全吃得下${n}。`,
    workable: `${n}今天可以吃。`,
    needs_adjustment: `${n}稍微调一下会更合适。`,
    weak_fit: `如果今天真的很想吃${n}，可以这样搭。`,
  })[topMeal.fitStatus] || fitStatusCopy[topMeal.fitStatus] || '今天可以吃。';

  const certainty = topMeal.reasonCertainty === 'estimated' ? '按目前估算，' : '';
  const why = certainty + (topMeal.reasons || []).slice(0, 2).join('');

  return { headline, why: why || `根据你今天已经吃的，这一份比较合适。` };
}

function contextLine(gaps, intake, targets) {
  if (intake.count === 0) return '今天还没吃东西。先记一顿，或者按现在的想法推荐也行。';
  const bits = [];
  if (gaps.proteinGapPct > 0.30) bits.push('蛋白质还差点');
  if (gaps.plantsGapPct  > 0.45) bits.push('蔬菜偏少');
  if (gaps.remainingEnergyKcal < 300) bits.push('能量空间不多了');
  if (bits.length === 0) bits.push('节奏挺好');
  return `今天${bits.join('，')}。`;
}

function dominantGapLabel(g) {
  return ({ protein: '蛋白质', plants: '蔬菜/纤维', energy: '能量', balanced: '已均衡' })[g] || g;
}

function mealTypeLabel(m) {
  return ({ breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' })[m] || m;
}

function tagLabel(t) {
  return ({
    chinese: '中餐', western: '西式', japanese: '日料', korean: '韩餐',
    burger: '汉堡', noodles: '面', rice_bowl: '盖饭', hotpot: '麻辣烫',
    light: '轻食', salad: '沙拉', soup: '汤', dumpling: '饺子',
    breakfast: '早餐', snack: '加餐', drink: '饮料', side: '小食',
    high_protein: '高蛋白', vegetable_rich: '蔬菜多', high_fiber: '高纤维',
    high_sodium: '偏咸', high_fat: '偏油', refined_carb: '精制碳水',
    whole_grain: '全谷物', zero_sugar: '零糖',
  })[t] || t;
}
