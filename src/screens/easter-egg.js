/**
 * Easter egg — "One More Thing": fake delivery app with a hidden bill.
 * ------------------------------------------------------------------------
 * Standalone demo flow. Touches NOTHING in the main product:
 * no nutrition DB, no engines, no main screens. All data isFictional.
 *
 * Flow: browse → store → item → cart → checkout(¥47.80) → submit
 *       → pause「等一下。」→ hidden bill rolls up to ¥430.80
 *       → A 帮我改一下 (back into EAT design, deterministic swaps)
 *       → B 我今天就想这样吃 (「也行。吃吧。」)
 *       → tapping 支付 on the hidden bill → 「吓你的。」popup
 */

import { FAKE_STORES, FAKE_HIDDEN_FEES, FAKE_ADJUSTMENTS } from '../data/fakeDelivery.js?v=39';

const state = { storeId: null, itemId: null, inCart: false, branch: null };

export function renderEasterEgg(root, params, ctx) {
  const step = params.step || 'browse';
  switch (step) {
    case 'store':   return paintStore(root, params, ctx);
    case 'item':    return paintItem(root, params, ctx);
    case 'cart':    return paintCart(root, params, ctx);
    case 'checkout':return paintCheckout(root, params, ctx);
    case 'adjust':  return paintAdjust(root, params, ctx);
    case 'accept':  return paintAccept(root, params, ctx);
    default:        return paintBrowse(root, params, ctx);
  }
}

/* ---------- shared chrome ---------- */

function feHeader(title, ctx, sub) {
  return `
    <div class="fe-hero">
      <div class="row-between">
        <button class="flow-icon-btn" data-act="exit" aria-label="离开">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span class="fe-badge">演示彩蛋 · 全部虚构</span>
      </div>
      <h1 class="fe-title">${title}</h1>
      ${sub ? `<p class="fe-sub">${sub}</p>` : ''}
    </div>`;
}

function bindExit(root, ctx) {
  root.querySelectorAll('[data-act="exit"]').forEach((el) => {
    el.addEventListener('click', () => { state.branch = null; state.inCart = false; ctx.navigate('next'); });
  });
}

/* ---------- 1. browse ---------- */

function paintBrowse(root, params, ctx) {
  root.innerHTML = `
    <div class="screen fe">
      ${feHeader('饿搜外卖', ctx, '一个非常正常的外卖平台。真的。')}
      <div class="fe-search">🔍 搜索：炸鸡 / 芝士 / 深夜</div>
      <div class="fe-cat-row">
        ${['🍔 汉堡', '🍗 炸鸡', '🍜 面食', '🧋 奶茶', '🍰 甜品'].map((c) => `<span class="chip">${c}</span>`).join('')}
      </div>
      <div class="reco-list" style="margin-top:14px">
        ${FAKE_STORES.map((s) => `
          <button class="reco-card fe-store" data-store="${s.id}">
            <div class="row" style="gap:12px;align-items:flex-start">
              <span class="fe-store__img">${s.img ? `<img src="${s.img}" alt="" />` : s.emoji}</span>
              <div style="flex:1;min-width:0">
                <div class="row" style="gap:6px">
                  <h3 class="reco-card__name" style="font-size:15.5px">${s.name}</h3>
                </div>
                <p class="t-caption" style="margin:2px 0 6px">${s.slogan}</p>
                <div class="row" style="gap:8px;flex-wrap:wrap">
                  <span class="fe-tag fe-tag--score">⭐ ${s.rating}</span>
                  <span class="fe-tag">月售 ${s.monthlySales}</span>
                  <span class="fe-tag">${s.eta}</span>
                  <span class="fe-tag">${s.minOrder}</span>
                  <span class="fe-tag">${s.distance}</span>
                </div>
              </div>
            </div>
          </button>
        `).join('')}
      </div>
      <p class="t-caption center" style="margin-top:16px">店名、菜品、价格、销量均为虚构，仅供演示</p>
    </div>`;
  bindExit(root, ctx);
  root.querySelectorAll('[data-store]').forEach((el) => {
    el.addEventListener('click', () => ctx.navigate('easter', { step: 'store', id: el.dataset.store }));
  });
}

/* ---------- 2. store ---------- */

function paintStore(root, params, ctx) {
  const store = FAKE_STORES.find((s) => s.id === params.id) || FAKE_STORES[0];
  state.storeId = store.id;
  root.innerHTML = `
    <div class="screen fe">
      <div class="fe-hero" style="padding-top:6px">
        <div class="row-between">
          <button class="flow-icon-btn" data-act="back-list" aria-label="返回">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <span class="fe-badge">演示彩蛋 · 全部虚构</span>
        </div>
        <div class="row" style="gap:12px;margin-top:12px">
          <span class="fe-store__img" style="font-size:34px;width:64px;height:64px">${store.img ? `<img src="${store.img}" alt="" />` : store.emoji}</span>
          <div>
            <h1 class="fe-title" style="font-size:22px">${store.name}</h1>
            <p class="fe-sub" style="margin-top:2px">「${store.slogan}」 · ⭐${store.rating} · 月售 ${store.monthlySales}</p>
          </div>
        </div>
      </div>
      <div class="reco-list">
        ${store.items.map((it) => `
          <button class="reco-card fe-item" data-item="${it.id}">
            <div class="row" style="gap:12px">
              <span class="fe-item__img">${(it.img || store.img) ? `<img src="${it.img || store.img}" alt="" />` : it.emoji}</span>
              <div style="flex:1;min-width:0">
                <h3 class="reco-card__name" style="font-size:15px">${it.name}</h3>
                <p class="t-caption" style="margin:2px 0 4px">${it.desc} · 月售 ${it.monthlySales} · ${it.praise}</p>
                <div class="row-between">
                  <span class="fe-price">¥${it.price.toFixed(2)}</span>
                  <span class="fe-add">＋</span>
                </div>
              </div>
            </div>
          </button>
        `).join('')}
      </div>
    </div>`;
  root.querySelector('[data-act="back-list"]').addEventListener('click', () => ctx.navigate('easter'));
  root.querySelectorAll('[data-item]').forEach((el) => {
    el.addEventListener('click', () => ctx.navigate('easter', { step: 'item', id: store.id, item: el.dataset.item }));
  });
}

/* ---------- 3. item detail (normal at first) ---------- */

function paintItem(root, params, ctx) {
  const store = FAKE_STORES.find((s) => s.id === params.id) || FAKE_STORES[0];
  const item = store.items.find((i) => i.id === params.item) || store.items[0];
  state.storeId = store.id; state.itemId = item.id;
  root.innerHTML = `
    <div class="screen fe">
      <div class="fe-hero" style="padding-top:6px">
        <div class="row-between">
          <button class="flow-icon-btn" data-act="back-store" aria-label="返回">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <span class="fe-badge">${store.name}</span>
        </div>
      </div>
      <div class="fe-item-hero">
        <span class="fe-item-hero__img">${(item.img || store.img) ? `<img src="${item.img || store.img}" alt="" />` : item.emoji}</span>
        <h1 class="t-title" style="margin-top:14px">${item.name}</h1>
        <p class="t-body" style="margin-top:4px">${item.desc}</p>
        ${item.includes ? `
          <div class="combo" style="margin-top:12px;text-align:left">
            ${item.includes.map((l) => `<div class="combo__item"><span class="combo__name">${l}</span></div>`).join('')}
          </div>` : ''}
        <div class="row" style="gap:8px;margin-top:12px;justify-content:center">
          <span class="fe-tag fe-tag--score">⭐ ${item.praise}</span>
          <span class="fe-tag">月售 ${item.monthlySales}</span>
          <span class="fe-tag">${store.eta}送达</span>
        </div>
        <div class="fe-price fe-price--big" style="margin-top:16px">¥${item.price.toFixed(2)}</div>
      </div>
      <button class="btn fe-cta" data-act="add-cart">加入购物车</button>
    </div>`;
  root.querySelector('[data-act="back-store"]').addEventListener('click', () => ctx.navigate('easter', { step: 'store', id: store.id }));
  root.querySelector('[data-act="add-cart"]').addEventListener('click', () => {
    state.inCart = true;
    ctx.navigate('easter', { step: 'cart', id: store.id, item: item.id });
  });
}

/* ---------- 4. cart ---------- */

function paintCart(root, params, ctx) {
  const store = FAKE_STORES.find((s) => s.id === params.id) || FAKE_STORES[0];
  const item = store.items.find((i) => i.id === params.item) || store.items[0];
  root.innerHTML = `
    <div class="screen fe">
      ${feHeader('购物车', ctx)}
      <div class="reco-card" style="text-align:left;cursor:default">
        <p class="t-caption" style="margin-bottom:8px">${store.name}</p>
        <div class="row" style="gap:12px">
          <span class="fe-item__img">${item.emoji}</span>
          <div style="flex:1">
            <h3 class="reco-card__name" style="font-size:15px">${item.name}</h3>
            <p class="t-caption">×1</p>
          </div>
          <span class="fe-price">¥${item.price.toFixed(2)}</span>
        </div>
      </div>
      <div class="card" style="margin-top:12px;text-align:left">
        <div class="row-between"><span class="t-body">商品金额</span><span class="t-body">¥${item.price.toFixed(2)}</span></div>
        <div class="row-between" style="margin-top:6px"><span class="t-body">配送费</span><span class="t-body">¥3.00</span></div>
        <div class="row-between" style="margin-top:6px"><span class="t-body">包装费</span><span class="t-body">¥2.00</span></div>
      </div>
      <div class="fe-bottombar">
        <div>
          <div class="t-caption">合计</div>
          <div class="fe-price fe-price--big" style="text-align:left">${(item.price + 5).toFixed(2)}</div>
        </div>
        <button class="btn fe-cta" style="width:auto;padding:13px 26px" data-act="go-checkout">去结算</button>
      </div>
    </div>`;
  bindExit(root, ctx);
  root.querySelector('[data-act="go-checkout"]').addEventListener('click', () =>
    ctx.navigate('easter', { step: 'checkout', id: store.id, item: item.id }));
}

/* ---------- 5. checkout → hidden bill ---------- */

function paintCheckout(root, params, ctx) {
  const store = FAKE_STORES.find((s) => s.id === params.id) || FAKE_STORES[0];
  const item = store.items.find((i) => i.id === params.item) || store.items[0];
  const base = item.price + 5;
  const hidden = FAKE_HIDDEN_FEES.reduce((s, f) => s + f.amount, 0);
  const total = base + hidden;

  root.innerHTML = `
    <div class="screen fe">
      ${feHeader('确认订单', ctx)}
      <div class="reco-card" style="text-align:left;cursor:default">
        <div class="row" style="gap:12px">
          <span class="fe-item__img">${item.emoji}</span>
          <div style="flex:1"><h3 class="reco-card__name" style="font-size:15px">${item.name}</h3><p class="t-caption">${store.name} · ×1</p></div>
          <span class="fe-price">¥${item.price.toFixed(2)}</span>
        </div>
      </div>
      <div class="card" style="margin-top:12px;text-align:left" id="bill">
        <div class="row-between"><span class="t-body">商品金额</span><span class="t-body">¥${item.price.toFixed(2)}</span></div>
        <div class="row-between" style="margin-top:6px"><span class="t-body">配送费</span><span class="t-body">¥3.00</span></div>
        <div class="row-between" style="margin-top:6px"><span class="t-body">包装费</span><span class="t-body">¥2.00</span></div>
        <div class="divider"></div>
        <div class="row-between"><span class="t-card">合计</span><span class="fe-price" id="totalPrice" style="font-size:22px">¥${base.toFixed(2)}</span></div>
      </div>
      <div class="fe-bottombar">
        <div><div class="t-caption">实付</div><div class="fe-price fe-price--big" style="text-align:left" id="bottomTotal">${base.toFixed(2)}</div></div>
        <button class="btn fe-cta" style="width:auto;padding:13px 26px" data-act="submit">提交订单</button>
      </div>
    </div>`;
  bindExit(root, ctx);

  const submitBtn = root.querySelector('[data-act="submit"]');
  // Demo/capture hook: ?autostart=1 auto-submits so the reveal can be
  // screenshotted headlessly. No effect in normal use.
  if (params.autostart) setTimeout(() => submitBtn.click(), 400);
  submitBtn.addEventListener('click', () => {
    submitBtn.disabled = true;
    // pause → 「等一下。」→ reveal hidden bill
    const wait = document.createElement('div');
    wait.className = 'fe-wait';
    wait.textContent = '等一下。';
    root.querySelector('.screen').appendChild(wait);
    setTimeout(() => {
      wait.textContent = '你是不是漏看了一张账单？';
      wait.classList.add('fe-wait--sub');
    }, 900);
    setTimeout(() => {
      wait.remove();
      revealHiddenBill(root, base, total, hidden, params, ctx);
    }, 1800);
  }, { once: true });
}

function revealHiddenBill(root, base, total, hidden, params, ctx) {
  const bill = root.querySelector('#bill');
  const hiddenRows = FAKE_HIDDEN_FEES.map((f) => `
    <div class="row-between fe-hidden-row" style="margin-top:6px;opacity:0">
      <span class="t-caption">${f.emoji} ${f.name}</span>
      <span class="fe-price" style="color:var(--fe-red)">¥${f.amount.toFixed(2)}</span>
    </div>`).join('');
  bill.insertAdjacentHTML('beforeend', `
    <div class="divider" style="margin:12px 0"></div>
    <p class="fe-hidden-title" style="opacity:0">隐藏账单 · 全部虚构</p>
    ${hiddenRows}
    <div class="row-between" style="margin-top:8px"><span class="t-caption">这些费用纯属玩笑</span><span class="t-caption">但热量不是</span></div>
  `);
  // stagger rows
  const rows = bill.querySelectorAll('.fe-hidden-row, .fe-hidden-title');
  rows.forEach((el, i) => setTimeout(() => { el.style.transition = 'opacity 260ms, transform 260ms'; el.style.opacity = '1'; }, 120 * i));
  // roll up price
  const start = performance.now();
  const dur = 900;
  const priceEl = root.querySelector('#totalPrice');
  const bottomEl = root.querySelector('#bottomTotal');
  const tick = (now) => {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    const v = base + (total - base) * eased;
    priceEl.textContent = `¥${v.toFixed(2)}`;
    bottomEl.textContent = v.toFixed(2);
    if (p < 1) requestAnimationFrame(tick);
  };
  setTimeout(() => requestAnimationFrame(tick), 120 * rows.length + 200);

  // punchline + two choices
  setTimeout(() => {
    const bottom = root.querySelector('.fe-bottombar');
    bottom.insertAdjacentHTML('beforebegin', `
      <div class="verdict-card" id="punch" style="margin-bottom:12px;opacity:0;transform:translateY(8px);transition:all 320ms">
        <h2 class="verdict__title">倒也不是不能吃。</h2>
        <p class="verdict__body">但好像不用这么吃。<br/>42 块的快乐，怎么突然看起来这么贵？</p>
        <div class="row" style="gap:10px;margin-top:14px">
          <button class="btn fe-cta" style="flex:1;width:auto" data-act="branch-a">帮我改一下</button>
          <button class="btn btn--ghost" style="flex:1;width:auto" data-act="branch-b">我今天就想这样吃</button>
        </div>
        <p class="t-caption" style="margin-top:10px;text-align:center">（试试点右边的「支付」？）</p>
      </div>`);
    const punch = root.querySelector('#punch');
    requestAnimationFrame(() => { punch.style.opacity = '1'; punch.style.transform = 'none'; });
    root.querySelector('[data-act="branch-a"]').addEventListener('click', () =>
      ctx.navigate('easter', { step: 'adjust', id: params.id, item: params.item }));
    root.querySelector('[data-act="branch-b"]').addEventListener('click', () =>
      ctx.navigate('easter', { step: 'accept', id: params.id, item: params.item }));
    // easter egg: tapping the (now scary) pay button
    const payBtn = root.querySelector('[data-act="submit"]');
    payBtn.disabled = false;
    payBtn.textContent = `支付 ¥${total.toFixed(2)}`;
    payBtn.addEventListener('click', () => showScarePopup(root, params, ctx), { once: true });
  }, 120 * rows.length + 1300);
}

function showScarePopup(root, params, ctx) {
  const mask = document.createElement('div');
  mask.className = 'fe-mask';
  mask.innerHTML = `
    <div class="fe-popup">
      <div style="font-size:40px">😄</div>
      <h3 class="t-title" style="margin-top:8px">吓你的。</h3>
      <p class="t-body" style="margin-top:8px">想吃就吃，<br/>我们负责把后面接住。</p>
      <button class="btn fe-cta" style="margin-top:16px" data-act="back-normal">回去正常点</button>
    </div>`;
  root.querySelector('.screen').appendChild(mask);
  mask.querySelector('[data-act="back-normal"]').addEventListener('click', () =>
    ctx.navigate('easter', { step: 'adjust', id: params.id, item: params.item }));
}

/* ---------- 6A. adjust — back into EAT design system ---------- */

function paintAdjust(root, params, ctx) {
  const store = FAKE_STORES.find((s) => s.id === params.id) || FAKE_STORES[0];
  const item = store.items.find((i) => i.id === params.item) || store.items[0];
  const adj = FAKE_ADJUSTMENTS[item.id] || { keep: ['🍔 核心保留'], swaps: [{ from: '重的那部分', to: '轻一点的等价替换' }] };
  root.innerHTML = `
    <div class="screen">
      <header style="padding:2px 2px 0">
        <h1 class="t-nav">行，快乐保留一点。</h1>
        <p class="t-body" style="margin-top:8px">核心想吃的没动，这样更适合你今天。</p>
      </header>
      <div class="sec-head"><h3 class="sec-head__title">原套餐</h3></div>
      <div class="card">
        ${(item.includes || ['🍽 ' + item.name]).map((l) => `<p class="t-body" style="margin:3px 0;text-align:left">${l}</p>`).join('')}
      </div>
      <div class="sec-head"><h3 class="sec-head__title">调整后</h3></div>
      <div class="card">
        ${adj.keep.map((k) => `<p class="t-body" style="margin:3px 0;text-align:left">${k}</p>`).join('')}
        ${adj.swaps.map((s) => `
          <div class="row-between" style="margin-top:8px;text-align:left">
            <span class="t-body" style="text-decoration:line-through;color:var(--ink-4)">${s.from}</span>
            <span class="t-body" style="color:var(--accent);font-weight:600">→ ${s.to}</span>
          </div>`).join('')}
      </div>
      <div class="section-gap"></div>
      <button class="btn btn--primary" data-act="eat-this">按这个吃</button>
      <button class="btn btn--ghost" data-act="swap-another" style="margin-top:10px">再换一个</button>
    </div>`;
  root.querySelector('[data-act="eat-this"]').addEventListener('click', () => ctx.navigate('today'));
  root.querySelector('[data-act="swap-another"]').addEventListener('click', () => ctx.navigate('easter', { step: 'store', id: store.id }));
}

/* ---------- 6B. accept — no food policing ---------- */

function paintAccept(root, params, ctx) {
  const store = FAKE_STORES.find((s) => s.id === params.id) || FAKE_STORES[0];
  const item = store.items.find((i) => i.id === params.item) || store.items[0];
  root.innerHTML = `
    <div class="screen">
      <header style="padding:2px 2px 0">
        <h1 class="t-nav">也行。吃吧。</h1>
        <p class="t-body" style="margin-top:8px">下一顿我帮你接着调。</p>
      </header>
      <div class="card" style="margin-top:20px;text-align:left">
        <div class="row" style="gap:12px">
          <span style="font-size:34px">${item.emoji}</span>
          <div>
            <p class="t-card">${item.name}</p>
            <p class="t-caption">${store.name} · 你今天想这么吃，收到了</p>
          </div>
        </div>
      </div>
      <div class="section-gap"></div>
      <button class="btn btn--primary" data-act="just-eat">就这么吃</button>
      <button class="btn btn--ghost" data-act="back-normal" style="margin-top:10px">回去正常点</button>
    </div>`;
  root.querySelector('[data-act="just-eat"]').addEventListener('click', () => ctx.navigate('today'));
  root.querySelector('[data-act="back-normal"]').addEventListener('click', () => ctx.navigate('easter', { step: 'store', id: store.id }));
}
