/**
 * FAKE DELIVERY DATA — easter egg only.
 * ------------------------------------------------------------------------
 * ⚠️ EVERYTHING IN THIS FILE IS FICTIONAL (isFictional: true).
 * Stores, dishes, prices, sales counts are joke/parody content for a demo
 * easter egg. Do NOT import this into the nutrition database, meals_master,
 * the recommendation engine, or any real product surface. No real brands,
 * no real logos, no real payment.
 */

export const FAKE_STORES = [
  {
    id: 'cheese-waterfall',
    isFictional: true,
    img: './assets/fe/cheese-waterfall.png',
    emoji: '🍔',
    name: '芝士瀑布汉堡局',
    slogan: '芝士多到需要防洪',
    rating: 4.9,
    monthlySales: 2847,
    eta: '约 30 分钟',
    minOrder: '¥20 起送',
    distance: '1.2km',
    items: [
      { id: 'double-crisp', name: '双层脆鸡芝士堡', price: 26.9, emoji: '🍔', desc: '脆到能听见', monthlySales: 1921, praise: '97% 好评', isFictional: true, img: './assets/fe/items/double-crisp.png' },
      { id: 'cheese-flood', name: '芝士防洪堤（加料薯条）', price: 8.9, emoji: '🍟', desc: '沙袋已备好', monthlySales: 986, praise: '99% 好评', isFictional: true, img: './assets/fe/items/cheese-fries.png' },
      { id: 'four-cheese-combo', name: '四层芝士脆鸡堡套餐', price: 42.8, emoji: '🍔', desc: '四层芝士牛肉堡 + 双层脆鸡芝士堡各半', includes: ['🍔 四层芝士脆鸡堡', '🍟 大薯', '🥤 奶昔'], monthlySales: 2847, praise: '98% 好评', isFictional: true, img: './assets/fe/items/four-cheese-combo.png' },
      { id: 'cheese-milkshake', name: '芝士瀑布奶昔', price: 16.9, emoji: '🥤', desc: '奶盖多到溢出来', monthlySales: 1654, praise: '98% 好评', isFictional: true, img: './assets/fe/items/milkshake.png' },
      { id: 'cheese-beef-wrap', name: '芝士牛肉卷', price: 24.9, emoji: '🌯', desc: '一卷双满足', monthlySales: 1203, praise: '96% 好评', isFictional: true, img: './assets/fe/items/wrap.png' },
      { id: 'caramel-pie', name: '焦糖芝士派', price: 15.9, emoji: '🥧', desc: '烫嘴警告（真的烫）', monthlySales: 2103, praise: '98% 好评', isFictional: true, img: './assets/fe/items/pie.png' },
    ],
  },
  {
    id: 'midnight-crispy-lab',
    isFictional: true,
    img: './assets/fe/midnight-crispy-lab.png',
    emoji: '🍗',
    name: '深夜脆皮研究所',
    slogan: '一口就安静了',
    rating: 4.8,
    monthlySales: 3521,
    eta: '约 35 分钟',
    minOrder: '¥25 起送',
    distance: '2.0km',
    items: [
      {
        id: 'crispy-bucket-combo',
        name: '脆皮炸鸡桶套餐',
        price: 45.9,
        emoji: '🍗',
        desc: '六块脆皮 + 奶油年糕 + 冰阔落',
        includes: ['🍗 脆皮炸鸡桶', '🍡 奶油年糕', '🥤 冰阔落'],
        monthlySales: 3521,
        praise: '99% 好评',
        isFictional: true,
      },
      { id: 'cream-rice-cake', name: '奶油年糕', price: 15.9, emoji: '🍡', desc: '甜咸双厨狂喜', monthlySales: 1450, praise: '96% 好评', isFictional: true },
    ],
  },
  {
    id: 'butter-carb-shop',
    isFictional: true,
    img: './assets/fe/butter-carb-shop.png',
    emoji: '🍜',
    name: '黄油碳水面馆',
    slogan: '碳水是船，黄油是帆',
    rating: 4.7,
    monthlySales: 1988,
    eta: '约 28 分钟',
    minOrder: '¥18 起送',
    distance: '800m',
    items: [
      {
        id: 'carbonara',
        name: '奶油培根拌面',
        price: 29.9,
        emoji: '🍜',
        desc: '罗马没有意见',
        includes: ['🍜 奶油培根拌面', '🥚 温泉蛋'],
        monthlySales: 1988,
        praise: '97% 好评',
        isFictional: true,
      },
      { id: 'butter-udon', name: '黄油牛肉乌冬', price: 33.9, emoji: '🥄', desc: '勺子会先吃饱', monthlySales: 866, praise: '95% 好评', isFictional: true },
    ],
  },
  {
    id: 'cheese-power',
    isFictional: true,
    img: './assets/fe/cheese-power.png',
    emoji: '🧀',
    name: '芝士就是力量',
    slogan: '知识就是力量，芝士也是',
    rating: 4.8,
    monthlySales: 2310,
    eta: '约 32 分钟',
    minOrder: '¥20 起送',
    distance: '1.5km',
    items: [
      { id: 'baked-rice', name: '爆浆芝士焗饭', price: 32.9, emoji: '🧀', desc: '拉丝一米长', monthlySales: 2310, praise: '98% 好评', isFictional: true },
      { id: 'cheese-chicken-rice', name: '芝士炸鸡饭', price: 35.9, emoji: '🍗', desc: '双厨狂喜Pro', monthlySales: 1204, praise: '97% 好评', isFictional: true },
    ],
  },
  {
    id: 'sugar-station',
    isFictional: true,
    img: './assets/fe/sugar-station.png',
    emoji: '🧋',
    name: '糖分补给总站',
    slogan: '人生苦短，先加珍珠',
    rating: 4.9,
    monthlySales: 5208,
    eta: '约 22 分钟',
    minOrder: '¥12 起送',
    distance: '500m',
    items: [
      { id: 'brown-sugar-milk', name: '黑糖珍珠厚乳', price: 18.9, emoji: '🧋', desc: '珍珠管够', monthlySales: 5208, praise: '99% 好评', isFictional: true },
      { id: 'choco-foam', name: '奶盖巧克力', price: 22.9, emoji: '🍫', desc: '咸甜交界线', monthlySales: 1877, praise: '97% 好评', isFictional: true },
    ],
  },
  {
    id: 'midnight-cream-depot',
    isFictional: true,
    img: './assets/fe/midnight-cream-depot.png',
    emoji: '🍰',
    name: '午夜奶油仓库',
    slogan: '白天属于工作，晚上属于奶油',
    rating: 4.8,
    monthlySales: 1432,
    eta: '约 40 分钟',
    minOrder: '¥30 起送',
    distance: '2.4km',
    items: [
      { id: 'basque-combo', name: '巴斯克 + 拿铁', price: 39.9, emoji: '🍰', desc: '焦面是灵魂', includes: ['🍰 巴斯克芝士', '☕ 拿铁'], monthlySales: 1432, praise: '98% 好评', isFictional: true },
      { id: 'cream-cake', name: '奶油蛋糕切块', price: 19.9, emoji: '🎂', desc: '一人食刚好', monthlySales: 903, praise: '96% 好评', isFictional: true },
    ],
  },
];

/* 隐藏账单 —— 全部是明显荒诞的虚构收费（joke），无医学/羞辱内容 */
export const FAKE_HIDDEN_FEES = [
  { name: '芝士瀑布维护费', amount: 66, emoji: '🧯', isFictional: true },
  { name: '脆皮完整性保护费', amount: 58, emoji: '🛡️', isFictional: true },
  { name: '“都点了就吃完吧”服务费', amount: 88, emoji: '🍽️', isFictional: true },
  { name: '奶油自由基金', amount: 72, emoji: '🫙', isFictional: true },
  { name: '深夜嘴硬附加费', amount: 99, emoji: '🌙', isFictional: true },
];

/* 分支 A 的确定性调整映射（demo 数据，结构上未来可接 recommendation engine） */
export const FAKE_ADJUSTMENTS = {
  'four-cheese-combo': {
    keep: ['🍔 汉堡保留'],
    swaps: [
      { from: '🍟 大薯', to: '🌽 玉米杯或小薯' },
      { from: '🥤 奶昔', to: '🥤 无糖饮料' },
    ],
  },
  'crispy-bucket-combo': {
    keep: ['🍗 炸鸡桶保留（年糕减半）'],
    swaps: [
      { from: '🍡 奶油年糕', to: '🥗 配一份蔬菜' },
      { from: '🥤 冰阔落', to: '🥤 无糖茶' },
    ],
  },
  'carbonara': {
    keep: ['🍜 拌面保留（面量减三分之一）'],
    swaps: [{ from: '🥚 温泉蛋另加', to: '🥚 直接拌进去，不加量' }],
  },
  'baked-rice': { keep: ['🧀 焗饭保留'], swaps: [{ from: '不加菜', to: '🥗 加一份绿叶菜' }] },
  'brown-sugar-milk': { keep: ['🧋 珍珠保留'], swaps: [{ from: '黑糖正常甜', to: '三分糖，快乐不打折' }] },
  'choco-foam': { keep: ['🍫 巧克力保留'], swaps: [{ from: '全糖奶盖', to: '半份奶盖' }] },
  'basque-combo': { keep: ['🍰 巴斯克保留'], swaps: [{ from: '☕ 拿铁', to: '☕ 美式或无糖拿铁' }] },
  'cream-cake': { keep: ['🎂 蛋糕保留'], swaps: [{ from: '一人份', to: '两人分更香' }] },
  'double-crisp': { keep: ['🍔 堡保留'], swaps: [{ from: '套餐薯饮', to: '🌽 玉米杯 + 无糖饮料' }] },
  'cheese-flood': { keep: ['🧀 加料保留'], swaps: [{ from: '双份', to: '单份，留点悬念' }] },
  'butter-udon': { keep: ['🥄 乌冬保留'], swaps: [{ from: '加一份牛肉', to: '加一份青菜' }] },
  'cheese-chicken-rice': { keep: ['🍗 炸鸡饭保留'], swaps: [{ from: '芝士翻倍', to: '芝士正常，加份汤' }] },
};
