/**
 * Understand My Meal — Meal Analysis Screen
 * ------------------------------------------------------------------------
 * Four input methods (photo / takeout screenshot / search / free text).
 * AI recognition is MOCKED in v0 — we pick a plausible result from the
 * meal database based on the input path, then show the verdict.
 *
 * The verdict follows the product's voice: short, warm, non-judgemental.
 * Detailed numbers stay hidden unless the user opens them.
 *
 * Low-confidence results (sourceType = vision_estimate / semantic_estimate)
 * always ship with:
 *   - a range instead of a point estimate
 *   - a confidence badge (A/B/C/D)
 *   - ONE follow-up question that would most reduce uncertainty
 */

import { MEALS, getMealById } from '../data/meals.js?v=39';
import {
  VERDICT_HEADLINE, VERDICT_BODY_TEMPLATES, STAPLE_ADVICE, pickLine, mealTypeForHour,
} from '../data/copy.js?v=39';
import { sumIntake, computeGaps } from '../engine/recommend.js?v=39';
import {
  interpretMealInput, resolveMatchToMeal, refineWithAnswer, getLastMatch,
} from '../engine/matching.js?v=39';

const METHOD_TILES = [
  { id: 'photo',    label: '拍一张照片',   sub: '任意一餐',           icon: iconCamera(),   primary: true  },
  { id: 'screenshot', label: '外卖订单截图', sub: '美团 / 饿了么',     icon: iconReceipt() },
  { id: 'search',   label: '搜一个套餐',   sub: '麦当劳、麻辣烫…',     icon: iconSearch()  },
  { id: 'text',     label: '写一句话',     sub: '"中午吃了麻辣烫…"',   icon: iconPen()     },
];

const SEARCH_SUGGESTIONS = [
  '板烧鸡腿堡', '麻辣烫', '老乡鸡小炒肉', '米村烤牛肉拌饭',
  '火鸡胸三明治', '超级碗热烹沙拉', '罗森鸡胸三明治',
];

const TEXT_EXAMPLES = [
  '中午吃了麻辣烫，牛肉、豆腐、很多菜和半份面',
  '中午吃了老乡鸡小炒肉和蒸蛋',
  '麦当劳板烧鸡腿堡',
  '罗森全麦鸡胸肉三明治',
];

/* Curated brand shortcuts shown as "最近常吃". Each maps to an exact
   `brand` value in the demo database; the SKU count is derived live so the
   row always reflects how deep the data actually is. Brands with < 3 SKUs
   are hidden to keep the promise honest. */
const BRAND_META = [
  { brand: '老乡鸡',            e: '🍗', show: '老乡鸡' },
  { brand: '麦当劳',            e: '🍔', show: '麦当劳' },
  { brand: '肯德基',            e: '🍗', show: '肯德基' },
  { brand: '米村拌饭',          e: '🍲', show: '米村拌饭' },
  { brand: 'Subway 赛百味中国', e: '🥖', show: 'Subway' },
  { brand: '沙野轻食',          e: '🥗', show: '沙野轻食' },
  { brand: '超级碗 FOODBOWL',   e: '🥗', show: '超级碗' },
  { brand: '罗森',              e: '🏪', show: '罗森' },
];

function mealsByBrand(brand) {
  return MEALS.filter((m) => m.brand === brand);
}
function brandOptions() {
  return BRAND_META
    .map((b) => ({ ...b, count: mealsByBrand(b.brand).length }))
    .filter((b) => b.count >= 3);
}

/**
 * @param {HTMLElement} root
 * @param {object} params    { step?: 'input'|'analyzing'|'result', method?: string, mealId?: string, slot?: string }
 * @param {{ navigate: Function, store: object }} ctx
 */
export function renderMealAnalysis(root, params, ctx) {
  const step = params.step || 'input';
  if (step === 'pick' && params.brand) {
    return paintBrandPicker(root, params.brand, params.slot, ctx);
  }
  if (step === 'result' && params.mealId) {
    const meal = getMealById(params.mealId) || getResolved(params.mealId);
    const rawSlot = (params.slot && params.slot !== 'undefined') ? params.slot : null;
    if (meal) {
      let slot = rawSlot || mealTypeForHour();
      // 2-meal users have no breakfast slot — fold early meals into lunch
      if (ctx.store.get().profile?.mealsPerDay === 2 && slot === 'breakfast') slot = 'lunch';
      return paintResult(root, meal, slot, ctx, params.followUp, params.mode === 'detail');
    }
  }
  if (step === 'analyzing' && params.method) {
    return paintAnalyzing(root, params, ctx);
  }
  paintInput(root, params, ctx);
}

/* ------------------------------------------------------------------ */
/* Step 1 — Input                                                     */
/* ------------------------------------------------------------------ */

function paintInput(root, params, ctx) {
  const presetSlot = params.slot;
  const RECENT_BRANDS = brandOptions();
  root.innerHTML = `
    <div class="screen">
      <header style="padding:2px 2px 0">
        <h1 class="t-nav">记一顿</h1>
        <p class="t-body" style="margin:8px 0 0">怎么方便怎么来，热量的事交给我们。${presetSlot ? ` 记到「${slotLabel(presetSlot)}」。` : ''}</p>
      </header>

      <!-- hidden real file inputs -->
      <input type="file" accept="image/*" class="hidden" data-file="screenshot" id="file-screenshot" />
      <input type="file" accept="image/*" capture="environment" class="hidden" data-file="photo" id="file-photo" />

      <div class="sec-head">
        <h3 class="sec-head__title">选一种方式</h3>
      </div>
      <div class="method-grid">
        <button class="method-card method-card--wide" data-method="search">
          <span class="method-card__icon" style="background:var(--accent-soft);color:var(--accent)">${iconSearch()}</span>
          <span class="row" style="gap:8px;flex:1">
            <span>
              <div class="method-card__label">搜套餐</div>
              <div class="method-card__sub">直接找名字，最快最准</div>
            </span>
          </span>
        </button>
        <button class="method-card" data-method="screenshot">
          <span class="method-card__icon" style="background:var(--good-soft);color:var(--good)">${iconReceipt()}</span>
          <span>
            <div class="method-card__label">截订单</div>
            <div class="method-card__sub">美团 / 饿了么</div>
          </span>
        </button>
        <button class="method-card" data-method="photo">
          <span class="method-card__icon" style="background:var(--warm-soft);color:var(--warm)">${iconCamera()}</span>
          <span>
            <div class="method-card__label">拍一张</div>
            <div class="method-card__sub">对着刚吃的拍</div>
          </span>
        </button>
      </div>

      <div class="sec-head">
        <h3 class="sec-head__title">或者写一句</h3>
      </div>
      <div class="input-card">
        <textarea class="input-field" data-out="text" placeholder="比如：中午吃了老乡鸡小炒肉和蒸蛋"></textarea>
        <div class="input-actions">
          <span class="t-caption" style="font-size:11.5px">随时补一句，不用称重</span>
          <button class="btn btn--primary btn--sm" data-act="submit-text" disabled>看看</button>
        </div>
      </div>

      <div class="sec-head">
        <h3 class="sec-head__title">最近常吃</h3>
        <span class="sec-head__note">点进去挑具体那道</span>
      </div>
      <div class="recent-row">
        ${RECENT_BRANDS.map((r) => `
          <button class="recent-card" data-brand="${r.brand}">
            <span class="recent-card__emoji">${r.e}</span>
            <span class="recent-card__name">${r.show}</span>
            <span class="recent-card__count">${r.count} 道</span>
          </button>`).join('')}
      </div>

      <div class="chip-row" style="margin-top:12px">
        ${TEXT_EXAMPLES.map((t, i) => `<button class="chip" data-example="${i}">${t.slice(0, 12)}…</button>`).join('')}
      </div>

      <div data-panel="search" class="hidden" style="margin-top:12px;padding:var(--sp-4);background:var(--bg-elev);border-radius:var(--r-m);border:1px solid var(--line)">
        <p class="t-caption" style="margin-bottom:10px">热门搜索</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${SEARCH_SUGGESTIONS.map((s) => `<button class="chip" data-search="${s}">${s}</button>`).join('')}
        </div>
      </div>
    </div>
  `;

  // Text area gating
  const ta = root.querySelector('[data-out="text"]');
  const submit = root.querySelector('[data-act="submit-text"]');
  ta.addEventListener('input', () => { submit.disabled = ta.value.trim().length < 4; });

  root.querySelectorAll('[data-example]').forEach((el) => {
    el.addEventListener('click', () => {
      ta.value = TEXT_EXAMPLES[Number(el.dataset.example)];
      submit.disabled = false;
      ta.focus();
    });
  });

  root.querySelectorAll('[data-brand]').forEach((el) => {
    el.addEventListener('click', () => {
      ctx.navigate('meal', { step: 'pick', brand: el.dataset.brand, slot: presetSlot });
    });
  });

  submit.addEventListener('click', () => {
    ctx.navigate('meal', {
      step: 'analyzing', method: 'text', text: ta.value.trim(), slot: presetSlot,
    });
  });

  // Method tiles
  root.querySelectorAll('[data-method]').forEach((el) => {
    el.addEventListener('click', () => {
      const method = el.dataset.method;
      if (method === 'search') {
        const panel = root.querySelector('[data-panel="search"]');
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
          panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }
      // screenshot / photo → real file picker (image is read as data URL and
      // carried through the flow via sessionStorage; the recognition itself
      // is still mock, the pipeline/preview is real).
      const input = root.querySelector(`[data-file="${method}"]`);
      if (input) input.click();
    });
  });

  root.querySelectorAll('[data-file]').forEach((input) => {
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { sessionStorage.setItem('eat.upload.image', String(reader.result)); } catch {}
        ctx.navigate('meal', { step: 'analyzing', method: input.dataset.file, slot: presetSlot });
      };
      reader.readAsDataURL(file);
      input.value = '';
    });
  });

  root.querySelectorAll('[data-search]').forEach((el) => {
    el.addEventListener('click', () => {
      ctx.navigate('meal', {
        step: 'analyzing', method: 'search', text: el.dataset.search, slot: presetSlot,
      });
    });
  });
}

/* ------------------------------------------------------------------ */
/* Step 1b — Brand SKU picker (surfaces the per-dish database)        */
/* ------------------------------------------------------------------ */

function paintBrandPicker(root, brand, slot, ctx) {
  const dishes = mealsByBrand(brand);
  const meta = BRAND_META.find((b) => b.brand === brand);
  const showName = meta ? meta.show : brand;
  root.innerHTML = `
    <div class="screen">
      <header>
        <div class="row-between" style="margin-bottom:12px">
          <button class="flow-icon-btn" data-act="back" aria-label="返回">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <span class="t-caption">${dishes.length} 道都在库里</span>
        </div>
        <h1 class="t-nav">${showName}</h1>
        <p class="t-body" style="margin:8px 0 0">点你吃的那一道，我直接给你算。</p>
      </header>

      <div class="section-gap"></div>

      <div class="sku-list">
        ${dishes.map((m, i) => `
          <button class="sku-row ob-rise" data-meal="${m.id}" style="animation-delay:${40 + i * 45}ms">
            <span class="sku-row__emoji">${m.emoji || '🍽'}</span>
            <span class="sku-row__main">
              <span class="sku-row__name">${m.productName}</span>
              <span class="sku-row__meta">${energyLabel(m)}${m.confidence ? ` · ${confidenceWord(m.confidence)}` : ''}</span>
            </span>
            <svg class="sku-row__chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
          </button>`).join('')}
      </div>
    </div>
  `;

  root.querySelector('[data-act="back"]').addEventListener('click', () => ctx.navigate('meal'));
  root.querySelectorAll('[data-meal]').forEach((el) => {
    el.addEventListener('click', () => {
      ctx.navigate('meal', {
        step: 'result', mealId: el.dataset.meal,
        slot: slot || mealTypeForHour(), method: 'search',
      });
    });
  });
}

function energyLabel(m) {
  if (m.energyRangeKcal && m.energyRangeKcal[0] != null && m.energyRangeKcal[1] != null) {
    return `约 ${m.energyRangeKcal[0]}–${m.energyRangeKcal[1]} 千卡`;
  }
  if (m.energyKcal != null) return `约 ${Math.round(m.energyKcal)} 千卡`;
  return '热量待补';
}
function confidenceWord(c) {
  return ({ A: '数据较准', B: '数据可靠', C: '大致估算', D: '仅供参考' })[c] || '大致估算';
}

/* ------------------------------------------------------------------ */
/* Step 2 — Analyzing (mock AI thinking)                              */
/* ------------------------------------------------------------------ */

function paintAnalyzing(root, params, ctx) {
  const method = params.method;
  const hasImage = method === 'screenshot' || method === 'photo';
  let imageData = null;
  try { imageData = sessionStorage.getItem('eat.upload.image'); } catch {}
  const showPreview = hasImage && imageData;

  const label = {
    photo: '在看这张照片',
    screenshot: '在看订单',
    search: '在查这个套餐',
    text: '在看这句话',
  }[method] || '在看';

  const steps = method === 'screenshot'
    ? ['读取截图', '认出商家和菜品', '对上数据库']
    : method === 'photo'
      ? ['看图认菜', '估一下份量', '对上数据库']
      : ['找到了', '对上数据库'];

  root.innerHTML = `
    <div class="screen" style="min-height:70vh;display:flex;flex-direction:column;justify-content:center">
      ${showPreview ? `
        <div style="border-radius:var(--r-l);overflow:hidden;box-shadow:var(--shadow-pop);margin-bottom:20px;position:relative">
          <img src="${imageData}" alt="上传的图片" style="width:100%;display:block;max-height:300px;object-fit:cover" />
          <div style="position:absolute;inset:0;background:rgba(29,29,31,0.18);backdrop-filter:blur(1.5px)"></div>
          <div style="position:absolute;left:12px;bottom:12px;background:rgba(29,29,31,0.75);color:#fff;border-radius:var(--r-pill);padding:5px 12px;font-size:12px;font-weight:500;display:inline-flex;align-items:center;gap:6px">
            <span class="thinking" style="transform:scale(0.85)"><span></span><span></span><span></span></span>
            ${label}
          </div>
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;align-items:center;text-align:center;margin-bottom:20px">
          <div style="width:64px;height:64px;border-radius:50%;background:var(--bg-soft);display:grid;place-items:center;margin-bottom:14px">
            <span class="thinking"><span></span><span></span><span></span></span>
          </div>
          <p class="t-card">${label}</p>
        </div>
      `}

      <div style="display:flex;flex-direction:column;gap:8px">
        ${steps.map((s, i) => `
          <div class="row" data-step="${i}" style="gap:10px;opacity:0;transition:opacity 300ms">
            <span style="width:22px;height:22px;border-radius:50%;background:var(--bg-soft);display:grid;place-items:center;flex-shrink:0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            </span>
            <span class="t-body">${s}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // reveal steps one by one
  const els = root.querySelectorAll('[data-step]');
  els.forEach((el, i) => {
    setTimeout(() => { el.style.opacity = '1'; }, 250 + i * 380);
  });

  const match = interpretMealInput(params);
  const picked = resolveMatchToMeal(match);
  const delay = 300 + steps.length * 380 + 350;
  setTimeout(() => {
    if (!picked) {
      // Honest unknown: nothing matched and no template applies.
      try { sessionStorage.removeItem('eat.upload.image'); } catch {}
      ctx.navigate('meal', {});
      return;
    }
    ctx.navigate('meal', {
      step: 'result',
      mealId: picked.id,
      slot: params.slot || mealTypeForHour(),
      method,
    });
  }, delay);
}

/* ------------------------------------------------------------------ */
/* Step 3 — Result (the "吃吧。" moment)                              */
/* ------------------------------------------------------------------ */

function paintResult(root, meal, slot, ctx, followUpAnswered, readOnly) {
  const state = ctx.store.get();
  let uploadImage = null;
  try { uploadImage = sessionStorage.getItem('eat.upload.image'); } catch {}
  // detail mode (opened from Today) shows its own numbers, not a stale upload
  const showThumb = !readOnly && !!uploadImage;
  const consumed = state.today.meals
    .map((e) => ({ meal: getMealById(e.mealId), quantity: e.quantity }))
    .filter((x) => x.meal);
  const intake = sumIntake(consumed);
  const gaps = computeGaps(state.targets, intake);

  const verdict = buildVerdict(meal, gaps);
  const seed = meal.id + state.today.date;

  const lowConfidence = meal.confidence === 'C' || meal.confidence === 'D';
  const needsFollowUp = lowConfidence && meal.followUpQuestion && !followUpAnswered;
  // Deep-link support: when arriving straight at ?followUp=N (no live match
  // in memory), synthesize one from the meal so the refined range renders.
  const synthMatch = {
    clarifying_question: meal.clarifyingQuestion || (meal.followUpQuestion
      ? { question: meal.followUpQuestion, options: meal.followUpOptions } : null),
    energy_range_kcal: meal.energyRangeKcal,
  };
  const refined = followUpAnswered != null
    ? (refineWithAnswer(getLastMatch(), followUpAnswered) || refineWithAnswer(synthMatch, followUpAnswered))
    : null;
  const shownRange = refined ? refined.energyRangeKcal : meal.energyRangeKcal;

  root.innerHTML = `
    <div class="screen">
      <header>
        <div class="row-between" style="margin-bottom:14px">
          <button class="flow-icon-btn" data-act="back" aria-label="返回">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <span class="confidence-badge" data-level="${meal.confidence}">
            <span class="confidence-badge__dot"></span>
            ${sourceLabel(meal.sourceType)}
          </span>
        </div>
        <div class="row" style="gap:14px;align-items:center">
          ${showThumb ? `
            <img src="${uploadImage}" alt="你刚上传的图" style="width:58px;height:58px;border-radius:var(--r-s);object-fit:cover;box-shadow:var(--shadow-card);flex-shrink:0" />
          ` : `
            <div style="font-size:42px;line-height:1">${meal.emoji || '🍽'}</div>
          `}
          <div style="flex:1;min-width:0">
            <p class="t-caption" style="margin-bottom:1px">${meal.brand}</p>
            <h1 class="t-title">${meal.productName}</h1>
            ${showThumb ? `<p class="t-caption" style="margin-top:2px">从你发的图认出来的</p>` : ''}
            ${shownRange ? `
              <p class="estimate-range" style="margin-top:3px">
                约 ${shownRange[0]}–${shownRange[1]} 千卡${refined ? ' · ' + refined.assumption : ''}
              </p>
            ` : ''}
          </div>
        </div>
      </header>

      <div class="section-gap"></div>

      <!-- Verdict -->
      <section class="verdict-card">
        <h2 class="verdict__title">${verdict.headline}</h2>
        <div class="verdict__body">${verdict.body}</div>
      </section>

      <!-- Follow-up question if low confidence -->
      ${needsFollowUp ? `
        <div class="section-gap"></div>
        <section class="followup">
          <p class="followup__label">问一句就更准</p>
          <p class="followup__q">${meal.followUpQuestion}</p>
          <div class="followup__opts">
            ${(meal.followUpOptions || verdict.followUpOptions).map((o, i) => `<button class="followup__opt" data-fu="${i}">${o}</button>`).join('')}
          </div>
        </section>
      ` : ''}

      <!-- Detailed nutrition (secondary; readOnly shows its own grid below) -->
      ${readOnly ? '' : `
      <div style="margin-top:var(--sp-4)">
        <button class="link" data-act="toggle-detail">
          <span data-out="detail-label">营养详情</span>
        </button>
        <div class="nutri-detail" data-out="detail">
          <div class="nutri-detail__inner" style="border-top:0;padding-top:var(--sp-3)">
            <div class="nutri-grid">
              ${nutriCellSimple('热量', meal.energyKcal, 'kcal')}
              ${nutriCellSimple('蛋白质', meal.proteinG, 'g')}
              ${nutriCellSimple('碳水', meal.carbG, 'g')}
              ${nutriCellSimple('脂肪', meal.fatG, 'g')}
              ${nutriCellSimple('纤维', meal.fiberG, 'g')}
              ${nutriCellSimple('钠', meal.sodiumMg, 'mg')}
            </div>
          </div>
        </div>
      </div>
      `}

      <!-- CTAs -->
      <div class="section-gap"></div>
      ${readOnly ? `
        <div class="nutri-detail is-open">
          <div class="nutri-detail__inner" style="border-top:0;padding-top:0">
            <div class="nutri-grid">
              ${nutriCellSimple('热量', meal.energyKcal, 'kcal')}
              ${nutriCellSimple('蛋白质', meal.proteinG, 'g')}
              ${nutriCellSimple('碳水', meal.carbG, 'g')}
              ${nutriCellSimple('脂肪', meal.fatG, 'g')}
              ${nutriCellSimple('纤维', meal.fiberG, 'g')}
              ${nutriCellSimple('钠', meal.sodiumMg, 'mg')}
            </div>
          </div>
        </div>
        <div class="section-gap"></div>
        <button class="btn btn--ghost" data-act="back">返回今天</button>
      ` : `
        <button class="btn btn--primary" data-act="add">${slotCtaLabel(slot)}</button>
        <button class="btn btn--ghost" data-act="next-meal" style="margin-top:10px">顺便看看下一顿吃什么</button>
      `}
    </div>
  `;

  root.querySelector('[data-act="back"]').addEventListener('click', () =>
    ctx.navigate(readOnly ? 'today' : 'meal'));
  root.querySelector('[data-act="toggle-detail"]')?.addEventListener('click', () => {
    const d = root.querySelector('[data-out="detail"]');
    const l = root.querySelector('[data-out="detail-label"]');
    const open = d.classList.toggle('is-open');
    l.textContent = open ? '收起' : '查看营养详情';
  });
  root.querySelectorAll('[data-fu]').forEach((el) => {
    el.addEventListener('click', () => {
      root.querySelectorAll('[data-fu]').forEach((o) => o.classList.remove('is-selected'));
      el.classList.add('is-selected');
      setTimeout(() => {
        ctx.navigate('meal', {
          step: 'result', mealId: meal.id, slot, followUp: el.dataset.fu,
        });
      }, 280);
    });
  });
  const clearUpload = () => { try { sessionStorage.removeItem('eat.upload.image'); } catch {} };
  root.querySelector('[data-act="add"]')?.addEventListener('click', () => {
    ctx.store.addMeal({ slot, mealId: meal.id, quantity: 1, sourceType: meal.sourceType });
    ctx.store.setLastAnalysis({ mealId: meal.id, slot, at: new Date().toISOString() });
    clearUpload();
    ctx.navigate('today');
  });
  root.querySelector('[data-act="next-meal"]')?.addEventListener('click', () => {
    // Add first, then jump to next-meal recommendations
    ctx.store.addMeal({ slot, mealId: meal.id, quantity: 1, sourceType: meal.sourceType });
    clearUpload();
    ctx.navigate('next');
  });
}

/* ------------------------------------------------------------------ */
/* Verdict builder — this is the product voice                        */
/* ------------------------------------------------------------------ */

function buildVerdict(meal, gaps) {
  const proteinGood = meal.proteinG >= 18;
  const plantsGood  = meal.fiberG   >= 5  || meal.tags.includes('vegetable_rich');
  const heavy       = meal.energyKcal >= 650;

  let key;
  if (heavy && gaps.remainingEnergyKcal < meal.energyKcal * 0.5) {
    key = 'heavy_but_fine';
  } else if (proteinGood && plantsGood) key = 'protein_good_all_good';
  else if (proteinGood && !plantsGood)  key = 'protein_good_veg_low';
  else if (!proteinGood && plantsGood)  key = 'protein_low_veg_good';
  else                                   key = 'protein_low_veg_low';

  const staple = stapleLine(meal);
  const variants = VERDICT_BODIES[key] || VERDICT_BODIES.protein_low_veg_low;
  const body = pickLine(variants, meal.id).replace('{staple}', staple);

  const headlineTone = key === 'protein_good_all_good' ? 'great'
                     : key === 'heavy_but_fine'        ? 'mixed'
                     : proteinGood || plantsGood       ? 'ok'
                     : 'low';
  const headline = pickLine(VERDICT_HEADLINE[headlineTone], meal.id);

  const followUpOptions = guessFollowUpOptions(meal);
  return { headline, body, followUpOptions };
}

/* 多套正文，按 meal.id 稳定轮换，避免每顿都是同一句 */
const VERDICT_BODIES = {
  protein_good_all_good: [
    '这一顿很稳。<br/>不用改什么。',
    '蛋白质和蔬菜都到位了。<br/>就按这个节奏来。',
    '挺均衡的一顿。<br/>今天不用为它操心。',
  ],
  protein_good_veg_low: [
    '蛋白质够了。<br/>蔬菜少了一点。<br/>{staple}',
    '这顿蛋白质不错。<br/>下一顿补点蔬菜就行。<br/>{staple}',
    '蛋白质够了，蔬菜稍微差点意思。<br/>{staple}',
  ],
  protein_low_veg_good: [
    '菜吃得挺好。<br/>蛋白质差一点，下一顿补回来就行。<br/>{staple}',
    '这顿蔬菜不错。<br/>蛋白质下一顿接上就好。<br/>{staple}',
  ],
  protein_low_veg_low: [
    '这一顿偏轻。<br/>下一顿多吃点蛋白质和蔬菜。<br/>{staple}',
    '这顿没吃够正形。<br/>下一顿把蛋白质和蔬菜补上。<br/>{staple}',
  ],
  heavy_but_fine: [
    '这一顿挺满足的。<br/>今天不用吃得那么健康，晚上清淡一点就好。',
    '吃得开心最重要。<br/>后面几顿我帮你往回收一点。',
  ],
};

/* 主食提示跟着食物类型走：汉堡不配“米饭不用减” */
function stapleLine(meal) {
  const t = meal.tags || [];
  if (t.includes('burger')) return '汉堡就是主食，不用减。';
  if (t.includes('noodles')) return '面不用减。';
  if (t.includes('rice_bowl')) return '米饭不用减。';
  if (t.includes('hotpot')) return '主食看你自己，不用刻意减。';
  if (t.includes('refined_carb') && t.includes('high_fat')) return STAPLE_ADVICE.swap;
  return '主食不用减。';
}

function pickStapleAdvice(meal, plantsGood) {
  return stapleLine(meal);
}

function guessFollowUpOptions(meal) {
  return meal.followUpOptions || ['少一点', '刚好', '多一点'];
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                      */
/* ------------------------------------------------------------------ */

function nutriCellSimple(label, value, unit) {
  const display = value == null ? '–' : (Number.isInteger(value) ? value : value.toFixed(1));
  return `
    <div class="nutri-cell">
      <div class="nutri-cell__label">${label}</div>
      <div class="nutri-cell__value">${display}<span class="nutri-cell__unit">${unit}</span></div>
    </div>
  `;
}

function sourceLabel(s) {
  return ({
    official_label: '官方标签',
    official_menu: '官方菜单',
    third_party_analysis: '第三方数据库',
    vision_estimate: '照片估算',
    semantic_estimate: '语义估算',
  })[s] || s;
}

function slotLabel(s) {
  return ({ breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' })[s] || '这一顿';
}
function slotCtaLabel(s) {
  const label = slotLabel(s);
  return label === '这一顿' ? '记到今天' : `加到今天的${label}`;
}

/* ------------------------------------------------------------------ */
/* Icons (inline SVG strings so we don't ship an icon font)           */
/* ------------------------------------------------------------------ */

function iconCamera() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h3l2-2h6l2 2h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg>`;
}
function iconReceipt() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>`;
}
function iconSearch() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>`;
}
function iconPen() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M14 6l3 3"/></svg>`;
}
