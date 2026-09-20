/**
 * Copy — natural-language templates.
 * ------------------------------------------------------------------------
 * The product's voice is warm, tolerant, and non-preachy. Never say
 * "超标", "罪恶", "禁止", "扣分". Prefer "很舒服", "可以更多", "还差一点".
 *
 * Copy is separated from logic so we can A/B the tone without touching the
 * recommendation engine.
 */

/** Greeting line on the Today screen, keyed by hour of day. */
export const GREETINGS = {
  morning:   ['早上好', '新的一天', '早安'],
  midday:    ['中午好', '下午好'],
  afternoon: ['下午好', '喝口水'],
  evening:   ['晚上好', '辛苦一天了'],
  night:     ['夜深了', '还没睡'],
};

/** Overall tone of the day, based on how close the user is to target. */
export const DAY_TONE = {
  great:    ['今天吃得不错。', '今天挺舒服。', '节奏很好。'],
  ok:       ['还行。', '今天过得去。', '挺自然的。'],
  light:    ['吃得偏少了一点。', '今天有点清淡。'],
  over:     ['今天吃得挺满足。', '没什么问题。'],
  empty:    ['今天还没开始。', '慢慢来。'],
};

/** Per-nutrient status lines. Never show numbers by default. */
export const NUTRIENT_LINE = {
  protein: {
    enough:    '蛋白质够了。',
    close:     'Protein — 还差一点。',
    low:       'Protein — 有点少。',
    very_low:  'Protein — 今天基本没吃到。',
    over:      'Protein — 今天很够。',
  },
  plants: {   // vegetables / fiber
    enough:    'Plants — 很舒服。',
    close:     'Plants — 可以更多。',
    low:       'Plants — 蔬菜偏少。',
    very_low:  'Plants — 今天几乎没吃菜。',
    over:      'Plants — 吃得很足。',
  },
  energy: {
    enough:    'Energy — 很舒服。',
    close:     'Energy — 差不多。',
    low:       'Energy — 还有点空间。',
    very_low:  'Energy — 今天吃得少。',
    over:      'Energy — 今天挺满足。',
  },
};

/** The verdict headline on the Meal Analysis screen. Kept short and calm. */
export const VERDICT_HEADLINE = {
  great:  ['吃吧。', '挺好。', '这一顿没毛病。'],
  ok:     ['可以。', '没问题。', '吃吧。'],
  mixed:  ['还行。', '凑合。', '基本可以。'],
  low:    ['能吃。', '先这样。', '没事。'],
};

/** Verdict body — a couple of sentences that name what's good and what's short. */
export const VERDICT_BODY_TEMPLATES = {
  protein_good_veg_low:
    '蛋白质够了。<br/>蔬菜少了一点。<br/>{stapleAdvice}',
  protein_good_all_good:
    '这一顿很稳。<br/>不用改什么。',
  protein_low_veg_good:
    '菜吃得挺好。<br/>蛋白质差一点，下一顿补回来就行。',
  protein_low_veg_low:
    '这一顿偏轻。<br/>下一顿多吃点蛋白质和蔬菜。',
  heavy_but_fine:
    '这一顿挺满足的。<br/>今天不用吃得那么健康，晚上清淡一点就好。',
};

/** Staple (rice / noodles / bread) advice. The product thesis is "米饭不用减". */
export const STAPLE_ADVICE = {
  keep:  '米饭不用减。',
  swap:  '把薯条换成玉米杯会更合适。',
  cut:   '主食可以少一半，但你不想也可以。',
};

/** Next Meal hero line — reassures the user before showing recommendations. */
export const NEXT_MEAL_HERO = {
  fits:       ['今天完全吃得下{n}。', '今晚可以吃{n}。', '{n}没问题。'],
  fits_light: ['想吃{n}也可以，配一份蔬菜更舒服。'],
  neutral:    ['可以，来一份{n}。'],
  careful:    ['{n}今天有点多。换一个类似的、轻一点的选择？'],
};

/** Why this rec, in one sentence. Rendered under the meal name. */
export const RECO_REASON = {
  fills_protein: '午饭蛋白质已经不错，这个组合能接得住。',
  fills_veg:     '蔬菜偏少，这一份能补上。',
  balanced:      '蛋白质、蔬菜、主食都有，比较均衡。',
  light_after_heavy: '之前那顿挺满足，这个更清爽一点。',
  craving_match: '你想吃这个，今天也吃得下。',
  swap_suggestion: '不用去掉主食，换掉薯条就比较适合你今天。',
};

/** Small utility — pick a stable-random line so the copy doesn't jitter
 *  on every re-render, but still varies across days.
 */
export function pickLine(lines, seedStr = '') {
  if (!lines || lines.length === 0) return '';
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
  return lines[h % lines.length];
}

export function greetingForHour(hour = new Date().getHours()) {
  if (hour < 5)  return pickLine(GREETINGS.night);
  if (hour < 11) return pickLine(GREETINGS.morning);
  if (hour < 14) return pickLine(GREETINGS.midday);
  if (hour < 18) return pickLine(GREETINGS.afternoon);
  if (hour < 22) return pickLine(GREETINGS.evening);
  return pickLine(GREETINGS.night);
}

export function mealTypeForHour(hour = new Date().getHours()) {
  if (hour < 10) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 17) return 'snack';
  return 'dinner';
}
