/**
 * Today Screen — v2 consumer redesign.
 * ------------------------------------------------------------------------
 * Product-like header (greeting + quick record), status chip row (three
 * small cards), meal slot cards, and two entry promos (典型一天 / 下一顿).
 * Numbers stay behind 查看营养详情. No hero, no serif, no italic.
 */

import { MEALS, getMealById } from '../data/meals.js?v=39';
import { greetingForHour, DAY_TONE, pickLine } from '../data/copy.js?v=39';
import { sumIntake, computeGaps } from '../engine/recommend.js?v=39';
import { computeStatuses } from '../engine/dayState.js?v=39';

const SLOT_ICON = { breakfast: '🌅', lunch: '🍚', dinner: '🌙', snack: '🥚' };

export function renderToday(root, params, ctx) {
  const state = ctx.store.get();
  const { profile, targets, today } = state;

  const consumed = today.meals
    .map((entry) => ({ meal: getMealById(entry.mealId), quantity: entry.quantity }))
    .filter((x) => x.meal);
  const intake = sumIntake(consumed);
  const gaps = computeGaps(targets, intake);
  const statuses = computeStatuses(targets, consumed.map((x) => x.meal._norm));

  const now = new Date();
  const seed = `${today.date}-${profile.age}`;
  const tone = dayTone(targets, intake, gaps);
  const lede = pickLine(DAY_TONE[tone], seed);

  const baseSlots = (profile.mealsPerDay === 2) ? ['lunch', 'dinner'] : ['breakfast', 'lunch', 'dinner'];
  const entriesBySlot = groupBySlot(today.meals);
  const slots = entriesBySlot.snack?.length ? [...baseSlots, 'snack'] : baseSlots;
  const unlogged = baseSlots.filter((s) => !(entriesBySlot[s] || []).length);

  root.innerHTML = `
    <div class="screen">

      <!-- Header: product-style, dense but calm -->
      <header class="row-between" style="padding:2px 2px 0">
        <div>
          <p class="t-caption" style="margin:0 0 2px">${greetingForHour(now.getHours())}</p>
          <h1 class="t-nav">${lede}</h1>
        </div>
        <button class="quick-add" data-act="add-meal">＋ 记一顿</button>
      </header>

      <p class="t-body" style="margin:10px 2px 0">${sublineFor(tone, gaps, intake, targets, unlogged)}</p>

      <!-- Status chips -->
      <div class="sec-head">
        <h3 class="sec-head__title">今天的状态</h3>
        <button class="link" data-act="toggle-detail">
          <span data-out="detail-label">${profile.wantsNutritionNumbers ? '隐藏数字' : '营养详情'}</span>
        </button>
      </div>
      <div class="status-row">
        ${statusChip('蛋白质', proteinLine(statuses))}
        ${statusChip('蔬菜',   plantsLine(statuses))}
        ${statusChip('热量',   energyLine(statuses))}
      </div>

      <div class="nutri-detail ${profile.wantsNutritionNumbers ? 'is-open' : ''}" data-out="detail">
        <div class="nutri-detail__inner">
          <div class="nutri-grid">
            ${nutriCell('热量', intake.energyKcal, targets.targetCalories, 'kcal')}
            ${nutriCell('蛋白质', intake.proteinG, targets.proteinTargetG, 'g')}
            ${nutriCell('碳水', intake.carbG, targets.carbTargetG, 'g')}
            ${nutriCell('脂肪', intake.fatG, targets.fatTargetG, 'g')}
            ${nutriCell('纤维', intake.fiberG, targets.fiberTargetG, 'g')}
            ${nutriCell('钠', intake.sodiumMg, targets.sodiumCeilingMg, 'mg', true)}
          </div>
        </div>
      </div>

      <!-- Meals -->
      <div class="sec-head">
        <h3 class="sec-head__title">今天吃了什么</h3>
        <span class="t-caption">${unlogged.length ? `还有 ${unlogged.length} 顿没记` : '都记好了'}</span>
      </div>
      <div>
        ${slots.map((slot) => mealCardsForSlot(slot, entriesBySlot[slot] || [])).join('')}
      </div>

      <!-- Entries -->
      <div class="sec-head">
        <h3 class="sec-head__title">帮你点</h3>
      </div>
      <button class="promo" data-act="go-next">
        <span class="promo__icon promo__icon--next">🍽</span>
        <span class="promo__body">
          <span class="promo__title">${nextMealNudge(now)}</span>
          <span class="promo__sub">中餐、汉堡、麻辣烫都能帮你接住</span>
        </span>
        <svg class="promo__chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
      </button>
      <button class="promo" data-act="go-days">
        <span class="promo__icon promo__icon--day">📅</span>
        <span class="promo__body">
          <span class="promo__title">不想费脑子？照着点的一天</span>
          <span class="promo__sub">几种配好的参考，照着点也不乱节奏</span>
        </span>
        <svg class="promo__chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
      </button>

    </div>
  `;

  /* ---------- Interactions ---------- */
  root.querySelector('[data-act="toggle-detail"]').addEventListener('click', () => {
    const d = root.querySelector('[data-out="detail"]');
    const label = root.querySelector('[data-out="detail-label"]');
    const open = d.classList.toggle('is-open');
    label.textContent = open ? '收起' : '营养详情';
  });
  root.querySelector('[data-act="add-meal"]').addEventListener('click', () => ctx.navigate('meal'));
  root.querySelector('[data-act="go-next"]').addEventListener('click', () => ctx.navigate('next'));
  root.querySelector('[data-act="go-days"]').addEventListener('click', () => ctx.navigate('days'));
  root.querySelectorAll('[data-act="fill-slot"]').forEach((el) => {
    el.addEventListener('click', () => ctx.navigate('meal', { slot: el.dataset.slot }));
  });
  root.querySelectorAll('[data-act="open-entry"]').forEach((el) => {
    // tapping a recorded meal opens its read-only nutrition detail, not the record flow
    el.addEventListener('click', () => ctx.navigate('meal', {
      step: 'result', mealId: el.dataset.mealId, slot: el.dataset.slot, mode: 'detail',
    }));
  });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function groupBySlot(entries) {
  return entries.reduce((acc, e) => {
    (acc[e.slot] = acc[e.slot] || []).push(e);
    return acc;
  }, {});
}

function statusChip(label, { text, tone }) {
  return `
    <div class="status-chip">
      <span class="status-chip__label">${label}</span>
      <span class="status-chip__value" data-tone="${tone}">${text}</span>
    </div>
  `;
}

function nutriCell(label, value, target, unit, ceiling = false) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const display = value == null ? '–' : (Number.isInteger(value) ? value : value.toFixed(1));
  return `
    <div class="nutri-cell">
      <div class="nutri-cell__label">${label}</div>
      <div class="nutri-cell__value">${display}<span class="nutri-cell__unit">/ ${Math.round(target)}${unit}</span></div>
    </div>
  `;
}

function mealCardsForSlot(slot, entries) {
  const label = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' }[slot];
  if (entries.length === 0) {
    return `
      <button class="meal-card meal-card--empty" data-act="fill-slot" data-slot="${slot}">
        <div class="meal-card__icon">${SLOT_ICON[slot] || '🍽'}</div>
        <div class="meal-card__body">
          <p class="meal-card__title">${label}</p>
          <p class="meal-card__meta">还没记</p>
        </div>
        <span class="meal-card__act">记一下 ›</span>
      </button>
    `;
  }
  return entries.map((entry) => {
    const meal = getMealById(entry.mealId);
    if (!meal) return '';
    return `
      <button class="meal-card" data-act="open-entry" data-meal-id="${meal.id}" data-slot="${slot}">
        <div class="meal-card__icon">${meal.emoji || '🍽'}</div>
        <div class="meal-card__body">
          <p class="meal-card__title">${meal.productName}</p>
          <p class="meal-card__meta">${label} · ${meal.brand}${meal.confidence === 'C' || meal.confidence === 'D' ? ' · 估算' : ''}</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ink-4);flex-shrink:0"><path d="M9 6l6 6-6 6"/></svg>
      </button>
    `;
  }).join('');
}

/* Soft statuses → chip text */
function proteinLine(s) {
  return ({
    enough:                { text: '够了',     tone: 'good' },
    next_meal_opportunity: { text: '还差一点', tone: 'warm' },
    needs_more:            { text: '有点少',   tone: 'warm' },
    no_need_to_prioritize: { text: '很够',     tone: 'good' },
  })[s.protein] || { text: '还差一点', tone: 'warm' };
}
function plantsLine(s) {
  return s.plants === 'good'
    ? { text: '不错',   tone: 'good' }
    : { text: '可以更多', tone: 'warm' };
}
function energyLine(s) {
  return ({
    comfortable: { text: '舒服',   tone: 'good' },
    substantial: { text: '挺足',   tone: 'good' },
    light:       { text: '偏少',   tone: 'ink'  },
  })[s.energy] || { text: '还行', tone: 'good' };
}

function dayTone(targets, intake, gaps) {
  if (intake.count === 0) return 'empty';
  const spentPct = intake.energyKcal / targets.targetCalories;
  if (spentPct > 1.10) return 'over';
  if (spentPct < 0.55) return 'light';
  if (gaps.proteinGapPct < 0.25 && gaps.plantsGapPct < 0.45) return 'great';
  return 'ok';
}

function sublineFor(tone, gaps, intake, targets, unlogged) {
  if (intake.count === 0) return '记上一顿，后面我帮你看着节奏。';
  if (unlogged.length) {
    if (gaps.dominantGap === 'plants')  return '蔬菜可以再补一点，别的都还行。';
    if (gaps.dominantGap === 'protein') return '蛋白质还差一点，下一顿补上就行。';
    if (tone === 'great') return '节奏很稳，照常吃就好。';
    return '整体挺自然，不用刻意调整。';
  }
  if (tone === 'over')  return '今天吃得挺满足，明天照常。';
  if (tone === 'light') return '今天吃得偏轻，睡前饿了就正常吃点。';
  return '都记齐了，今天收工。';
}

function nextMealNudge(now) {
  const h = now.getHours();
  if (h < 10) return '早餐想吃什么？';
  if (h < 15) return '午餐想吃什么？';
  if (h < 17) return '下午想吃点什么？';
  return '晚餐想吃什么？';
}
