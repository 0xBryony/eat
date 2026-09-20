/**
 * Onboarding Screen
 * ------------------------------------------------------------------------
 * A step-driven flow. Collects the NutritionProfile, then shows a short
 * "明白了。以后这些事我来算。" moment before dropping the user on Today.
 *
 * Steps mix factual inputs (age / height / weight) with product-personality
 * questions ("你愿意每天算卡路里吗？"). The persona questions are what make
 * this app feel different from a clinical calorie tracker.
 */

const STEPS = [
  'welcome',
  'age',
  'sex',
  'height',
  'weight',
  'goal',
  'activity',
  'training',
  'takeout',
  'mealsPerDay',         // feeds NutritionPlan meal guidance (2/3/4)
  'breakfastHabit',      // context for breakfast recommendations
  'calorieAttitude',     // persona question
  'numbersPreference',   // do they want to see raw kcal/macros?
  'summary',             // "明白了。以后这些事我来算。"
];

const DRAFT_KEY = 'eat.onboarding.draft';

/* remembers the last painted step so we can animate forward vs backward */
let lastIdx = -1;

/**
 * @param {HTMLElement} root
 * @param {object} params
 * @param {{ navigate: Function, store: object }} ctx
 */
export function renderOnboarding(root, params, ctx) {
  const draft = loadDraft();
  const startStep = params.step && STEPS.includes(params.step) ? params.step : 'welcome';
  paint(root, startStep, draft, ctx);
}

function loadDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveDraft(d) {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch {}
}

function paint(root, step, draft, ctx) {
  const idx = STEPS.indexOf(step);
  const goingBack = lastIdx !== -1 && idx < lastIdx;
  lastIdx = idx;
  const progress = idx / (STEPS.length - 1);

  root.innerHTML = '';
  const screen = document.createElement('div');
  screen.className = 'screen screen--edge' + (goingBack ? ' ob-flow--back' : '');
  screen.style.padding = '0';
  screen.style.minHeight = '100%';
  screen.style.display = 'flex';
  screen.style.flexDirection = 'column';

  // Header with back button + progress
  if (step !== 'welcome' && step !== 'summary') {
    const header = document.createElement('div');
    header.className = 'flow-header';
    header.innerHTML = `
      <button class="flow-icon-btn" data-act="back" aria-label="上一步">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div class="flow-progress"><div class="flow-progress__bar" style="width:${Math.max(6, progress * 100)}%"></div></div>
      <span style="width:32px;text-align:right;font-size:12px;color:var(--ink-3);letter-spacing:0.02em">${idx}/${STEPS.length - 2}</span>
    `;
    screen.appendChild(header);
    header.querySelector('[data-act="back"]').addEventListener('click', () => {
      const prev = STEPS[Math.max(0, idx - 1)];
      ctx.navigate('onboarding', { step: prev });
    });
  }

  const body = document.createElement('div');
  body.style.flex = '1';
  body.style.display = 'flex';
  body.style.flexDirection = 'column';
  screen.appendChild(body);

  const stepRenderer = STEP_RENDERERS[step];
  stepRenderer(body, draft, ctx);

  root.appendChild(screen);
}

/* ------------------------------------------------------------------ */
/* Individual steps                                                   */
/* ------------------------------------------------------------------ */

const STEP_RENDERERS = {

  welcome(body, draft, ctx) {
    body.innerHTML = `
      <div class="ob-stage">
        <div class="ob-rise">
          <img src="./assets/brand/logo-lockup.png?v=39" alt="吃吧 EAT" style="height:72px;width:auto" />
        </div>
        <div class="ob-stage__mid ob-rise" style="animation-delay:140ms">
          <h1 class="t-nav" style="font-size:34px;line-height:1.35">减脂也可以<br/>放心吃外卖</h1>
          <p class="t-body" style="margin-top:var(--sp-6);max-width:20em;line-height:1.85;color:var(--ink-2)">
            热量计算交给我们，你只管下单。<br/>
            老乡鸡、麦当劳、麻辣烫，都能接住。
          </p>
        </div>
        <div class="ob-rise" style="animation-delay:280ms">
          <button class="btn btn--primary" data-act="start">开始</button>
          <p class="t-caption" style="margin-top:var(--sp-4);text-align:center">
            大概 40 秒，不用注册
          </p>
        </div>
      </div>
    `;
    body.querySelector('[data-act="start"]').addEventListener('click', () => {
      ctx.navigate('onboarding', { step: 'age' });
    });
  },

  age(body, draft, ctx) {
    renderStepper(body, draft, ctx, {
      key: 'age',
      title: '你多大？',
      hint: '只用来估算基础代谢。',
      unit: '岁',
      min: 14, max: 90, step: 1, initial: draft.age ?? 28,
    });
  },

  sex(body, draft, ctx) {
    renderChoice(body, draft, ctx, {
      key: 'biologicalSex',
      title: '生理性别',
      hint: '只用来估算能量需求，不同性别的静息代谢率有轻微差异。不会用于其他任何事。',
      options: [
        { value: 'female', label: '女' },
        { value: 'male',   label: '男' },
        { value: 'unspecified', label: '不想说', sub: '会用一个中性的估算' },
      ],
    });
  },

  height(body, draft, ctx) {
    renderStepper(body, draft, ctx, {
      key: 'heightCm',
      title: '身高',
      hint: '',
      unit: 'cm',
      min: 130, max: 220, step: 1, initial: draft.heightCm ?? 170,
    });
  },

  weight(body, draft, ctx) {
    renderStepper(body, draft, ctx, {
      key: 'weightKg',
      title: '现在的体重',
      hint: '我们不会每天问你。',
      unit: 'kg',
      min: 30, max: 200, step: 0.5, initial: draft.weightKg ?? 65,
    });
  },

  goal(body, draft, ctx) {
    renderChoice(body, draft, ctx, {
      key: 'goal',
      title: '你想怎样？',
      hint: '',
      options: [
        { value: 'lose_gentle', label: '温和减脂', sub: '慢慢来，不用饿肚子' },
        { value: 'maintain',    label: '保持状态', sub: '现在这样挺好' },
      ],
    });
  },

  activity(body, draft, ctx) {
    renderChoice(body, draft, ctx, {
      key: 'activityLevel',
      title: '平时的活动量',
      hint: '不算专门训练，就是日常走动。',
      options: [
        { value: 'sedentary',   label: '基本坐着',   sub: '一天走不到 3000 步' },
        { value: 'light',       label: '偶尔走动',   sub: '通勤、买菜、遛弯' },
        { value: 'moderate',    label: '经常走动',   sub: '一天 8000 步左右' },
        { value: 'active',      label: '挺活跃的',   sub: '站立工作 / 每天走路很多' },
        { value: 'very_active', label: '非常活跃',   sub: '体力工作 / 长时间运动' },
      ],
    });
  },

  training(body, draft, ctx) {
    renderChoice(body, draft, ctx, {
      key: 'trainingFrequency',
      title: '每周专门运动几次？',
      hint: '跑步、健身房、球类、瑜伽都算。',
      options: [
        { value: 0, label: '0 次' },
        { value: 1, label: '1 次' },
        { value: 2, label: '2 次' },
        { value: 3, label: '3 次' },
        { value: 4, label: '4 次' },
        { value: 5, label: '5 次以上' },
      ],
    });
  },

  takeout(body, draft, ctx) {
    renderChoice(body, draft, ctx, {
      key: 'takeoutFrequency',
      title: '每周点几次外卖？',
      hint: '这个 App 就是为常点外卖的人做的。',
      options: [
        { value: 0,  label: '几乎不点' },
        { value: 3,  label: '3 次左右' },
        { value: 7,  label: '一周 7 次' , sub: '差不多每天一顿' },
        { value: 12, label: '12 次以上', sub: '基本靠外卖活着' },
      ],
    });
  },

  mealsPerDay(body, draft, ctx) {
    renderChoice(body, draft, ctx, {
      key: 'mealsPerDay',
      title: '一天通常吃几顿？',
      hint: '只用来安排每顿的大致份额，不是硬性预算。',
      options: [
        { value: 2, label: '两顿', sub: '不吃早餐，或早午餐合并' },
        { value: 3, label: '三顿' },
        { value: 4, label: '四顿', sub: '含加餐 / 下午茶' },
      ],
    });
  },

  breakfastHabit(body, draft, ctx) {
    renderChoice(body, draft, ctx, {
      key: 'breakfastHabit',
      title: '早餐通常怎么解决？',
      hint: '会影响我给你推荐早餐的方式。',
      options: [
        { value: 'convenience', label: '便利店 / 面包咖啡' },
        { value: 'home',        label: '自己做' },
        { value: 'skip',        label: '经常不吃' },
        { value: 'mixed',       label: '看情况' },
      ],
    });
  },

  calorieAttitude(body, draft, ctx) {
    // The persona question. This is the moment the app tells you who it is.
    renderChoice(body, draft, ctx, {
      key: '_calorieAttitude',
      title: '你愿意每天算卡路里吗？',
      hint: '',
      persona: true,
      options: [
        { value: 'yes',    label: '愿意',      sub: '喜欢数字带来的确定感' },
        { value: 'no',     label: '我是来减脂的，不是来考营养师的' },
      ],
      after: (val) => val === 'no' ? '明白了。' : '好，你也可以随时看数字。',
    });
  },

  numbersPreference(body, draft, ctx) {
    renderChoice(body, draft, ctx, {
      key: 'wantsNutritionNumbers',
      title: '那要显示详细营养数字吗？',
      hint: '卡路里、蛋白质、碳水、脂肪。默认藏起来，需要时再展开。',
      options: [
        { value: false, label: '不用，说人话就行' },
        { value: true,  label: '显示吧，我想看' },
      ],
    });
  },

  summary(body, draft, ctx) {
    body.innerHTML = `
      <div class="ob-stage">
        <div class="ob-stage__mid">
          <img src="./assets/brand/icon-192.png?v=39" alt="" class="ob-rise" style="width:48px;height:48px;margin-bottom:var(--sp-7)" />
          <p class="t-eyebrow ob-rise" style="color:var(--accent);margin-bottom:var(--sp-4);animation-delay:120ms">明白了</p>
          <h2 class="t-nav ob-rise" style="font-size:32px;line-height:1.35;animation-delay:220ms">
            以后这些事，我们来算
          </h2>
          <p class="t-body ob-rise" style="margin-top:var(--sp-6);line-height:1.85;color:var(--ink-2);animation-delay:320ms">
            你只管吃。<br/>
            我们告诉你这一顿怎么样，下一顿怎么点。
          </p>
        </div>
        <div class="ob-rise" style="animation-delay:460ms">
          <button class="btn btn--primary" data-act="finish">开始用</button>
        </div>
      </div>
    `;
    body.querySelector('[data-act="finish"]').addEventListener('click', () => {
      const profile = buildProfile(draft);
      ctx.store.setProfile(profile);
      try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
      ctx.navigate('today');
    });
  },
};

/* ------------------------------------------------------------------ */
/* Reusable step primitives                                           */
/* ------------------------------------------------------------------ */

function renderStepper(body, draft, ctx, cfg) {
  const value = draft[cfg.key] ?? cfg.initial;
  body.innerHTML = `
    <div class="onboarding-q">
      <div class="ob-rise">
        <h2 class="onboarding-q__title">${cfg.title}</h2>
        ${cfg.hint ? `<p class="onboarding-q__hint">${cfg.hint}</p>` : '<div style="height:var(--sp-4)"></div>'}
      </div>
      <div class="stepper ob-rise" style="margin-top:auto;animation-delay:140ms">
        <button class="stepper__btn" data-act="dec" aria-label="减">−</button>
        <div class="stepper__value">
          <span data-out="val" style="display:inline-block">${formatNum(value, cfg.step)}</span><span class="stepper__unit">${cfg.unit}</span>
        </div>
        <button class="stepper__btn" data-act="inc" aria-label="加">+</button>
      </div>
      <div class="flow-cta ob-rise" style="animation-delay:220ms">
        <button class="btn btn--primary btn--block" data-act="next">下一步</button>
      </div>
    </div>
  `;

  let v = value;
  const out = body.querySelector('[data-out="val"]');
  const pop = () => {
    try {
      out.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.16)' }, { transform: 'scale(1)' }],
        { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      );
    } catch {}
  };
  body.querySelector('[data-act="dec"]').addEventListener('click', () => {
    v = clamp(v - cfg.step, cfg.min, cfg.max);
    out.textContent = formatNum(v, cfg.step);
    pop();
  });
  body.querySelector('[data-act="inc"]').addEventListener('click', () => {
    v = clamp(v + cfg.step, cfg.min, cfg.max);
    out.textContent = formatNum(v, cfg.step);
    pop();
  });
  body.querySelector('[data-act="next"]').addEventListener('click', () => {
    draft[cfg.key] = v; saveDraft(draft);
    ctx.navigate('onboarding', { step: nextStep(cfg.key) });
  });
}

function renderChoice(body, draft, ctx, cfg) {
  const current = draft[cfg.key];
  body.innerHTML = `
    <div class="onboarding-q">
      <div class="ob-rise">
        <h2 class="onboarding-q__title">${cfg.title}</h2>
        ${cfg.hint ? `<p class="onboarding-q__hint">${cfg.hint}</p>` : '<div style="height:var(--sp-4)"></div>'}
      </div>
      <div class="onboarding-q__options">
        ${cfg.options.map((o, i) => `
          <button class="opt ob-rise ${current === o.value ? 'is-selected' : ''}" data-i="${i}" style="animation-delay:${120 + i * 70}ms">
            <span class="opt__main">
              <span>${o.label}</span>
              ${o.sub ? `<span class="opt__sub">${o.sub}</span>` : ''}
            </span>
            <span class="opt__check">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="opacity:0"><path d="M20 6L9 17l-5-5"/></svg>
            </span>
          </button>
        `).join('')}
      </div>
      ${cfg.after && current !== undefined ? `<p class="ob-after">${cfg.after(current)}</p>` : '<div class="ob-after" style="display:none"></div>'}
      <div class="flow-cta ob-rise" style="animation-delay:${160 + cfg.options.length * 70}ms">
        <button class="btn btn--primary btn--block" data-act="next" ${current === undefined ? 'disabled' : ''}>下一步</button>
      </div>
    </div>
  `;

  const opts = body.querySelectorAll('.opt');
  const nextBtn = body.querySelector('[data-act="next"]');
  const afterLine = body.querySelector('.ob-after');
  let selected = current;

  opts.forEach((el) => {
    el.addEventListener('click', () => {
      const i = Number(el.dataset.i);
      selected = cfg.options[i].value;
      opts.forEach((o, j) => {
        o.classList.toggle('is-selected', j === i);
        o.querySelector('.opt__check svg').style.opacity = j === i ? '1' : '0';
      });
      nextBtn.disabled = false;
      // For the persona question, show a follow-up line immediately.
      if (cfg.after) {
        afterLine.textContent = cfg.after(selected);
        afterLine.style.display = '';
      }
    });
  });

  nextBtn.addEventListener('click', () => {
    draft[cfg.key] = selected;
    saveDraft(draft);
    ctx.navigate('onboarding', { step: nextStep(cfg.key) });
  });
}

function nextStep(currentKey) {
  const map = {
    age: 'sex',
    biologicalSex: 'height',
    heightCm: 'weight',
    weightKg: 'goal',
    goal: 'activity',
    activityLevel: 'training',
    trainingFrequency: 'takeout',
    takeoutFrequency: 'mealsPerDay',
    mealsPerDay: 'breakfastHabit',
    breakfastHabit: 'calorieAttitude',
    _calorieAttitude: 'numbersPreference',
    wantsNutritionNumbers: 'summary',
  };
  return map[currentKey] ?? 'summary';
}

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function formatNum(v, step) {
  return step < 1 ? v.toFixed(1) : String(Math.round(v));
}

/* ------------------------------------------------------------------ */
/* Draft → NutritionProfile                                           */
/* ------------------------------------------------------------------ */

function buildProfile(d) {
  return {
    age: Number(d.age) || 28,
    biologicalSex: d.biologicalSex || 'unspecified',
    heightCm: Number(d.heightCm) || 170,
    weightKg: Number(d.weightKg) || 65,
    activityLevel: d.activityLevel || 'light',
    trainingFrequency: Number(d.trainingFrequency) || 0,
    goal: d.goal || 'maintain',
    takeoutFrequency: Number(d.takeoutFrequency) || 7,
    mealsPerDay: Number(d.mealsPerDay) || 3,
    breakfastHabit: d.breakfastHabit || 'mixed',
    wantsNutritionNumbers: Boolean(d.wantsNutritionNumbers),
    calorieAttitude: d._calorieAttitude || 'no',   // product-personality signal
  };
}
