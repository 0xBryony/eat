/**
 * 典型一天 — Day Cards screen.
 * ------------------------------------------------------------------------
 * Lists day cards generated LIVE from the user's NutritionPlan (dayPlanner).
 * Default view: qualitative (items + guidance). Numbers hide behind
 * "查看营养详情". "按这个吃" records the card's matched items into today.
 */

import { MEALS, getMealById } from '../data/meals.js?v=39';
import { generateDayCards } from '../engine/dayPlanner.js?v=39';

const TIER_LABEL = {
  strict: '正常吃版',
  protein_addon: '高蛋白版',
  fat_flex: '满足版',
  energy_relaxed: '轻松版',
  two_meal_addon: '两顿版',
};
const TIER_SUB = {
  strict: '热量和蛋白质都刚好',
  protein_addon: '加一份加餐，蛋白就齐了',
  fat_flex: '油脂略高一点，正常吃也没事',
  energy_relaxed: '全天偏轻，灵活一点',
  two_meal_addon: '不吃早餐也能凑齐',
};

export function renderDayCards(root, params, ctx) {
  const state = ctx.store.get();
  const profile = state.profile || {};
  const cards = generateDayCards(state.targets, MEALS, { mealsPerDay: profile.mealsPerDay ?? 3 });

  if (!cards.length) {
    root.innerHTML = `
      <div class="screen">
        <header>
          <div class="row-between" style="margin-bottom:12px">
            <button class="flow-icon-btn" data-act="back" aria-label="返回">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          </div>
          <h1 class="t-nav">照着点的一天</h1>
          <p class="t-body" style="margin-top:8px">按你现在的目标，暂时配不出刚好的一天。没关系——正常记录每一顿，我们按实际吃的给你下一顿的建议。</p>
        </header>
        <div class="section-gap"></div>
        <button class="btn btn--ghost" data-act="back">回今天</button>
      </div>`;
    root.querySelector('[data-act="back"]').addEventListener('click', () => ctx.navigate('today'));
    return;
  }

  root.innerHTML = `
    <div class="screen">
      <header>
        <div class="row-between" style="margin-bottom:12px">
          <button class="flow-icon-btn" data-act="back" aria-label="返回">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <span class="t-caption">按你的目标实时生成</span>
        </div>
        <h1 class="t-nav">照着点的一天</h1>
        <p class="t-body" style="margin-top:8px">今天不想费脑子的话，挑一个照着点就行，节奏不会乱。</p>
      </header>

      <div class="reco-list" style="margin-top:16px">
        ${cards.map((c) => cardHtml(c)).join('')}
      </div>
    </div>`;

  root.querySelector('[data-act="back"]').addEventListener('click', () => ctx.navigate('today'));
  root.querySelectorAll('[data-act="toggle"]').forEach((el) => {
    el.addEventListener('click', () => {
      const d = el.closest('.day-card').querySelector('.nutri-detail');
      const l = el.querySelector('[data-out="l"]');
      const open = d.classList.toggle('is-open');
      l.textContent = open ? '收起' : '查看营养详情';
    });
  });
  root.querySelectorAll('[data-act="apply"]').forEach((el) => {
    el.addEventListener('click', () => {
      const card = cards.find((c) => c.id === el.dataset.id);
      if (!card) return;
      applyCard(card, ctx);
    });
  });
}

function cardHtml(c) {
  const section = (label, meals) => `
    <div class="combo__item">
      <span class="combo__emoji">${slotEmoji(label)}</span>
      <span class="combo__name">${meals.map((m) => m.productName).join(' + ') || '—'}</span>
      <span class="combo__slot">${label}</span>
    </div>`;
  const addonRow = c.plannedAddon ? `
    <div class="combo__item">
      <span class="combo__emoji">🥚</span>
      <span class="combo__name">${c.plannedAddon.label}</span>
      <span class="combo__slot">加餐</span>
    </div>` : '';
  return `
    <div class="reco-card day-card" style="cursor:default">
      <div class="row-between" style="margin-bottom:2px">
        <span class="tag-pill" style="background:var(--accent-soft);color:var(--accent)">${TIER_LABEL[c.tier] || c.tier}</span>
        <span class="t-caption">${c.brands.join(' × ')}</span>
      </div>
      <p class="t-caption" style="margin:0 0 6px">${TIER_SUB[c.tier] || ''}</p>
      <div class="combo" style="margin-top:8px">
        ${section('早餐', c.breakfast || [])}
        ${section('午餐', c.lunch)}
        ${section('晚餐', c.dinner)}
        ${addonRow}
      </div>
      <p class="reco-card__reason">${c.guidance}</p>
      <div class="reco-card__meta">
        <span class="t-caption">数据 ${c.confidence.join('/')} 级</span>
        <button class="link" data-act="toggle" style="margin-left:auto"><span data-out="l">营养详情</span></button>
      </div>
      <div class="nutri-detail">
        <div class="nutri-detail__inner" style="border-top:0;padding-top:var(--sp-3)">
          <div class="nutri-grid">
            <div class="nutri-cell"><div class="nutri-cell__label">热量</div><div class="nutri-cell__value">${c.totals.energy}<span class="nutri-cell__unit">kcal</span></div></div>
            <div class="nutri-cell"><div class="nutri-cell__label">蛋白质</div><div class="nutri-cell__value">${c.totals.protein}<span class="nutri-cell__unit">g</span></div></div>
            <div class="nutri-cell"><div class="nutri-cell__label">脂肪</div><div class="nutri-cell__value">${c.totals.fat}<span class="nutri-cell__unit">g</span></div></div>
            <div class="nutri-cell"><div class="nutri-cell__label">碳水</div><div class="nutri-cell__value">${c.totals.carbs}<span class="nutri-cell__unit">g</span></div></div>
          </div>
        </div>
      </div>
      <button class="btn btn--dark btn--sm" data-act="apply" data-id="${c.id}" style="margin-top:12px">照着吃，记到今天</button>
    </div>`;
}

function slotEmoji(label) {
  return ({ 早餐: '🌅', 午餐: '🍚', 晚餐: '🌙' })[label] || '🍽';
}

/** Record the card's items into today. plannedAddon = snack slot SKUs. */
function applyCard(card, ctx) {
  const add = (mealId, slot, qty = 1) => {
    const m = getMealById(mealId);
    if (m) ctx.store.addMeal({ slot, mealId, quantity: qty, sourceType: m.sourceType });
  };
  for (const m of card.breakfast || []) add(m.id, 'breakfast');
  for (const m of card.lunch) add(m.id, 'lunch');
  for (const m of card.dinner) add(m.id, 'dinner');
  if (card.plannedAddon) {
    add(card.plannedAddon.id, 'snack', card.plannedAddon.qty);
    if (card.plannedAddon.extra) add(card.plannedAddon.extra, 'snack', 1);
  }
  ctx.navigate('today');
}
