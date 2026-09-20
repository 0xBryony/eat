#!/usr/bin/env python3
"""Generate demo-ready meal layer (Task 2) from meals_master.csv.
Selection = high recognition + real delivery scenario + usable nutrition +
variety + supports "normal food can be diet food".
per-100g items get demo_portion_g = typical portion RANGE, explicitly labeled
estimate (no official serving weight). Never fake precision."""
import csv, json, os, re
SPLIT = re.compile(r';\s*')

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, '..', 'eat', 'data')
os.makedirs(OUT, exist_ok=True)

rows = list(csv.DictReader(open(os.path.join(BASE, 'meals_master.csv'))))
byid = {r['id']: r for r in rows}

# (id-or-substring, portion_estimate_or_None)
# portion = (min_g, max_g, note) only for per-100g basis items
SEL = [
    # 麦当劳 (official A, per-serving)
    ('板烧鸡腿堡', None, '麦当劳'), ('原味板烧鸡腿堡', None, '麦当劳'), ('麦辣鸡腿汉堡', None, None), ('薯条', None, '麦当劳'),
    ('巨无霸', None, '麦当劳'), ('双层吉士汉堡', None, '麦当劳'), ('培根安格斯厚牛堡', None, '麦当劳'),
    ('双层猪柳蛋麦满分', None, '麦当劳'), ('双层原味板烧鸡腿麦满分', None, '麦当劳'), ('猪柳蛋麦满分', None, '麦当劳'),
    ('原味板烧鸡腿炒双蛋堡', None, '麦当劳'),
    ('新奥尔良烤鸡腿堡', None, '肯德基'), ('滋滋YES烤鸡腿堡', None, '肯德基'), ('汁汁双层嫩牛堡', None, '肯德基'), ('至珍七虾堡', None, '肯德基'),
    ('卤翅根', (100, 150, '1-2只估重·官方仅per-100g'), '老乡鸡'),
    ('卤大排', (100, 150, '1块估重·官方仅per-100g'), '老乡鸡'),
    ('白灼虾', (100, 120, '8只估重·官方仅per-100g'), '老乡鸡'),
    ('生炸大鸡腿', (150, 200, '1只估重·官方仅per-100g'), '老乡鸡'),
    ('葱油鸡', (120, 180, '1份估重·官方仅per-100g'), '老乡鸡'),
    ('卤素鸡', (80, 120, '1份估重·官方仅per-100g'), '老乡鸡'),
    ('沙拉鸡胸肉', None, '罗森'),
    ('汁汁厚作双层和牛堡', None, '肯德基'),
    ('micun-cn-add-jinqiangyu', None, None), ('micun-cn-add-jidan', None, None),
    ('shaye-cn-jixiongruo-jialiao', None, None), ('shaye-cn-xiaren-jialiao', None, None),
    ('玉米杯', None, '麦当劳'), ('零度', None, '麦当劳'), ('原味板烧鸡腿麦满分', None, None),
    ('圆筒冰淇淋', None, None),
    # KFC
    ('kfc-cn-jin-cui-ji-tui-bao', None, None), ('kfc-cn-xiang-tian-yu-mi-bei', None, None),
    ('kfc-cn-xin-orlean-kao-chi', (80, 110, '2翅可食部估重·无官方份重'), None),
    ('kfc-cn-shu-tiao', (100, 130, '中份估重·无官方份重'), None),
    ('kfc-cn-lao-bei-jing-ji-rou-juan', (200, 250, '1卷估重·无官方份重'), None),
    ('kfc-cn-jin-bao-ji-mi-hua', None, None),
    # 老乡鸡 (official A per-100g → portion range estimate)
    ('农家小炒肉', (150, 200, '1份估重·官方仅per-100g'), None),
    ('农家蒸蛋', (100, 150, '1份估重·官方仅per-100g'), None),
    ('卤鸡腿', (100, 130, '1只估重·官方仅per-100g'), '老乡鸡'),
    ('三杯鸡', (150, 200, '1份估重·官方仅per-100g'), None),
    ('糙米饭', (150, 200, '小份估重·官方仅per-100g'), '老乡鸡'),
    ('pick-lxj-01', None, None),
    # Subway (C range/point)
    ('subway-cn-6in-turkey-breast', None, None), ('subway-cn-6in-italian-bmt', None, None),
    ('subway-cn-6in-tuna', None, None), ('subway-cn-6in-teriyaki-chicken', None, None),
    # 超级碗 (C range)
    ('foodbowl-cn-sanwenyu-duodanbai-reweng-shala', None, None),
    ('foodbowl-cn-dongyingong-jirou-xianshuguo', None, None),
    ('foodbowl-cn-banban-jirou-shishu-banmian', None, None),
    ('foodbowl-cn-yamaziyou-kaoxia-superbowl', None, None),
    # 沙野 (B measured + C range)
    ('shaye-cn-danbai-duoduo-jixiong-reneng-wan', None, None),
    ('shaye-cn-xiangjian-jixiong-limai-zaliang-wan', None, None),
    ('shaye-cn-taishi-dabao-jixiongruo-sui-culiang-wan', None, None),
    # 米村 (B)
    ('micun-cn-kaoniurou-banfan', None, None), ('micun-cn-zhaoshao-jitui-banfan', None, None),
    ('石锅拌饭', None, '米村拌饭'), ('micun-cn-wugu-zaliang-fan', (150, 200, '1份估重'), None),
    # 塔斯汀 (C)
    ('tastien-cn-xiang-la-nen-ji-rou', None, None), ('tastien-cn-duo-zhi-niu-rou', None, None),
    ('tastien-cn-ta-ta-ji-kuai', None, None),
    # 全家 (B label)
    ('familymart-cn-quanmai-xunji-shala-sanmingzhi', None, None),
    ('familymart-cn-ludan-xiangchang-zimi-cifantuan', None, None),
    ('familymart-cn-aoerliang-kaoji-dakou-fantuan', (130, 160, '1个估重·来源仅per-100g'), None),
    ('familymart-cn-quanmai-huotui-dan-shala-sanmingzhi', (100, 130, '1个估重·来源仅per-100g'), None),
    # 罗森 (B label)
    ('lawson-cn-wholewheat-chicken-breast-sandwich', (100, 120, '1个估重·来源仅per-100g'), None),
    ('lawson-cn-devil-onigiri-original', None, None),
    ('lawson-cn-wholewheat-smoked-chicken-sandwich', None, None),
    ('lawson-cn-five-color-vegetable-salad', (80, 120, '1份估重·来源仅per-100g'), None),
    # Phase5 picks (custom combos, C range)
    ('pick-mcd-02', None, None), ('pick-kfc-01', None, None), ('pick-micun-01', None, None),
    ('pick-shaxian-01', None, None),
    # v1.1: staples + simple office breakfast singles (macro-filled 2026-09-19)
    ('laoxiangji-cn-141-mifan', (150, 200, '小份估重·官方仅per-100g'), None),
    ('laoxiangji-cn-140-hongmicaomihongshufan', (150, 200, '小份估重·官方仅per-100g'), None),
    ('bf-tea-egg', None, None), ('bf-boiled-egg', None, None), ('bf-greek-yogurt', None, None),
    ('bf-milk', None, None), ('bf-soymilk', None, None),
    ('bf-wholewheat-bread', None, None), ('bf-corn', None, None),
    ('lanzhou-noodle-standard', None, None), ('cq-xiaomian-qing', None, None),
    ('malatang-qingdang', None, None), ('tanglao-beef-cup', None, None),
    ('bf-oatmeal', None, None), ('bf-banana', None, None),
]

EMOJI = [('burger', '🍔'), ('noodles', '🍜'), ('rice_bowl', '🍛'), ('salad', '🥗'),
         ('hotpot', '🍲'), ('dumpling', '🥟'), ('congee', '🥣'), ('sandwich', '🥪'),
         ('onigiri', '🍙'), ('drink', '🥤'), ('side', '🌽'), ('dessert', '🍦'),
         ('breakfast', '🍳'), ('chicken', '🍗'), ('rice', '🍚')]

def emoji_for(r):
    blob = (r['menu_category'] + r['product_name'] + r['tags']).lower()
    for k, e in EMOJI:
        if k in blob:
            return e
    if '堡' in r['product_name']: return '🍔'
    if '饭' in r['product_name']: return '🍚'
    if '面' in r['product_name']: return '🍜'
    if '沙拉' in r['product_name'] or '碗' in r['product_name']: return '🥗'
    return '🍽'

def meal_types(r):
    blob = r['menu_category'] + r['product_name']
    out = []
    if any(k in blob for k in ['早餐', '麦满分', '粥', '豆浆']): out.append('breakfast')
    out += ['lunch', 'dinner']
    if any(k in blob for k in ['小食', '冰淇淋', '饮料', '果汁']): out.append('snack')
    return out

def clarifying(r):
    d = (r['calorie_uncertainty_drivers'] or '').lower()
    if '麻酱' in d or '酱' in d and '拌饭' in d: return '这份的酱/麻酱加了多少？', ['没有', '一点', '正常量']
    if '米饭' in d or '主食' in d or '饭' in d: return '这份米饭大概吃了多少？', ['小半份', '大半份', '基本吃完']
    if '汤' in d: return '汤喝了多少？', ['全喝了', '喝了一半', '没怎么喝']
    if '酱' in d: return '酱料加了吗？', ['没加', '加了一点', '正常加']
    if '份量' in d or '克' in d: return '这份比平时多还是少？', ['少一些', '差不多', '多一些']
    return None

def fnum(v):
    if v in (None, ''): return None
    try: return round(float(v), 1)
    except ValueError: return None

out, missing = [], []
for key, portion, brandf in SEL:
    r = byid.get(key) if not brandf else None
    if not r:
        cand = [x for x in rows if key in x['product_name'] and (not brandf or x['brand'] == brandf)]
        pref = [x for x in cand if not x['id'].startswith('pick-')]
        r = (pref or cand)[0] if cand else None
    if not r:
        missing.append(key); continue
    u = (r['serving_size_unit'] or '').lower()
    per100 = (str(r['serving_size']).strip() == '100' and u in ('克', 'g', 'grams')) or ('100g' in u) or ('每100' in u)
    basis = r['nutrition_value_type']
    e = fnum(r['energy_kcal']); emin = fnum(r['energy_min_kcal']); emax = fnum(r['energy_max_kcal'])
    entry = {
        'id': r['id'], 'brand': r['brand'], 'productName': r['product_name'],
        'menuCategory': r['menu_category'], 'emoji': emoji_for(r),
        'itemType': r['item_type'],
        'comboComponents': r['combo_components'] or None,
        'basis': ('per_100g_' + basis) if per100 else basis,
        'servingSize': r['serving_size'], 'servingUnit': r['serving_size_unit'],
        'energyKcal': e, 'proteinG': fnum(r['protein_g']), 'carbsG': fnum(r['carbs_g']),
        'fatG': fnum(r['fat_g']), 'fiberG': fnum(r['fiber_g']), 'sodiumMg': fnum(r['sodium_mg']),
        'energyRangeKcal': [emin, emax] if (emin is not None or emax is not None) else None,
        'demoPortionG': ({'min': portion[0], 'max': portion[1], 'basis': 'estimate', 'note': portion[2]}
                         if portion else None),
        'sourceType': r['primary_source_type'], 'sourceUrl': r['primary_source_url'],
        'sourceTitle': r['primary_source_title'], 'sourceDate': r['primary_source_date'],
        'confidence': r['confidence_grade'],
        'tags': [t.strip() for t in SPLIT.split(r['tags'] or '') if t.strip()],
        'mealTypes': meal_types(r),
        'uncertaintyDrivers': [t.strip() for t in SPLIT.split(r['calorie_uncertainty_drivers'] or '') if t.strip()],
        'merchantClaims': [t.strip() for t in SPLIT.split(r['merchant_claims'] or '') if t.strip()],
    }
    q = clarifying(r)
    if q:
        entry['clarifyingQuestion'] = {'question': q[0], 'options': q[1]}
    out.append(entry)

seen=set(); ded=[]
for x in out:
    if x['id'] in seen or x['basis']=='unknown': continue
    seen.add(x['id']); ded.append(x)
out=ded
json.dump(out, open(os.path.join(OUT, 'demo_meals.json'), 'w'), ensure_ascii=False, indent=1)

# templates json for photo fallback
tpl = list(csv.DictReader(open(os.path.join(BASE, 'generic_meal_templates.csv'))))
tj = []
for t in tpl:
    er = t['energy_range_kcal']
    pr = t['protein_range_g']
    tj.append({
        'id': t['template_id'], 'name': t['name'], 'category': t['category'],
        'components': [x.strip() for x in SPLIT.split(t['typical_components'] or '') if x.strip()],
        'variableParameters': [x.strip() for x in SPLIT.split(t['variable_parameters'] or '') if x.strip()],
        'typicalPortion': t['typical_portion'],
        'energyRangeKcal': [int(x) for x in er.split('-')] if er and er != 'unknown' else None,
        'proteinRangeG': [int(x) for x in pr.split('-')] if pr else None,
        'uncertaintyDrivers': [x.strip() for x in SPLIT.split(t['uncertainty_drivers'] or '') if x.strip()],
        'confidence': t['confidence_grade'], 'sources': t['sources'],
    })
json.dump(tj, open(os.path.join(OUT, 'templates.json'), 'w'), ensure_ascii=False, indent=1)

print('demo_meals.json:', len(out), 'entries')
print('templates.json:', len(tj))
if missing: print('MISSING:', missing)
from collections import Counter
print('confidence:', dict(Counter(x['confidence'] for x in out)))
print('basis:', dict(Counter(x['basis'] for x in out)))
