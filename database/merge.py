#!/usr/bin/env python3
"""Merge brands/*.json -> the 4 derived CSVs (meals_master / nutrition_sources /
brand_menu_coverage / needs_estimation). Idempotent: safe to re-run after each
brand lands. brand_landscape.csv and generic_meal_templates.csv are curated by
hand and NOT touched by this script."""
import json, csv, glob, os

BASE = os.path.dirname(os.path.abspath(__file__))
BR = os.path.join(BASE, 'brands')
TODAY = '2026-09-18'

MASTER_COLS = ["id","brand","brand_category","product_name","product_name_normalized",
 "menu_category","product_description","serving_size","serving_size_unit","energy_kcal",
 "protein_g","carbs_g","fat_g","fiber_g","sodium_mg","sugar_g","nutrition_value_type",
 "energy_min_kcal","energy_max_kcal","protein_min_g","protein_max_g","carbs_min_g",
 "carbs_max_g","fat_min_g","fat_max_g","primary_source_type","primary_source_url",
 "primary_source_title","primary_source_date","secondary_source_url","source_notes",
 "confidence_grade","merchant_claims","xiaohongshu_keywords","common_modifications",
 "tags","research_status","last_verified_date","item_type","combo_components",
 "calorie_uncertainty_drivers","conflicting_sources","best_current_estimate"]

SRC_COLS = ["source_id","sku_id","brand","product_name","source_type","source_url",
 "source_title","source_author","source_date","method_notes","is_official",
 "confidence_grade","values_reported","notes"]

COV_COLS = ["brand","estimated_total_food_skus","researched_skus","coverage_percentage",
 "missing_categories","status"]

NEED_COLS = ["sku","brand","existing_info","missing_info","recommended_estimation_method",
 "worth_further_research"]

def num(v):
    return '' if v is None else v

def jlist(v):
    if v is None: return ''
    if isinstance(v, list): return '; '.join(str(x) for x in v)
    return str(v)

def jdict(v):
    if not v: return ''
    return '; '.join(f'{k}={x}' for k, x in v.items())

def jconf(v):
    if not v: return ''
    out = []
    for c in v:
        out.append(' | '.join([str(c.get('source_a','')), str(c.get('source_b','')),
                               str(c.get('difference','')), str(c.get('possible_reason',''))]))
    return ' // '.join(out)

rows_m, rows_s, rows_c, rows_n = [], [], [], []

for fp in sorted(glob.glob(os.path.join(BR, '*.json'))):
    with open(fp, encoding='utf-8') as f:
        d = json.load(f)
    brand = d.get('brand', '')
    skus = d.get('skus', [])
    for s in skus:
        rows_m.append({
            'id': s.get('id',''), 'brand': s.get('brand', brand),
            'brand_category': s.get('brand_category', d.get('brand_category','')),
            'product_name': s.get('product_name',''),
            'product_name_normalized': s.get('product_name_normalized',''),
            'menu_category': s.get('menu_category',''),
            'product_description': s.get('product_description',''),
            'serving_size': num(s.get('serving_size')),
            'serving_size_unit': s.get('serving_size_unit',''),
            'energy_kcal': num(s.get('energy_kcal')), 'protein_g': num(s.get('protein_g')),
            'carbs_g': num(s.get('carbs_g')), 'fat_g': num(s.get('fat_g')),
            'fiber_g': num(s.get('fiber_g')), 'sodium_mg': num(s.get('sodium_mg')),
            'sugar_g': num(s.get('sugar_g')),
            'nutrition_value_type': s.get('nutrition_value_type',''),
            'energy_min_kcal': num(s.get('energy_min_kcal')),
            'energy_max_kcal': num(s.get('energy_max_kcal')),
            'protein_min_g': num(s.get('protein_min_g')),
            'protein_max_g': num(s.get('protein_max_g')),
            'carbs_min_g': num(s.get('carbs_min_g')),
            'carbs_max_g': num(s.get('carbs_max_g')),
            'fat_min_g': num(s.get('fat_min_g')), 'fat_max_g': num(s.get('fat_max_g')),
            'primary_source_type': s.get('primary_source_type',''),
            'primary_source_url': s.get('primary_source_url',''),
            'primary_source_title': s.get('primary_source_title',''),
            'primary_source_date': s.get('primary_source_date',''),
            'secondary_source_url': s.get('secondary_source_url',''),
            'source_notes': s.get('source_notes',''),
            'confidence_grade': s.get('confidence_grade',''),
            'merchant_claims': jlist(s.get('merchant_claims')),
            'xiaohongshu_keywords': jlist(s.get('xiaohongshu_keywords')),
            'common_modifications': jlist(s.get('common_modifications')),
            'tags': jlist(s.get('tags')),
            'research_status': s.get('research_status',''),
            'last_verified_date': s.get('last_verified_date') or TODAY,
            'item_type': s.get('item_type',''),
            'combo_components': jdict(s.get('combo_components')),
            'calorie_uncertainty_drivers': jlist(s.get('calorie_uncertainty_drivers')),
            'conflicting_sources': jconf(s.get('conflicting_sources')),
            'best_current_estimate': s.get('best_current_estimate',''),
        })
        if s.get('research_status') in ('needs_estimation','nutrition_missing') or s.get('confidence_grade') == 'U':
            missing = []
            if s.get('energy_kcal') is None and s.get('energy_min_kcal') is None: missing.append('energy')
            if s.get('protein_g') is None: missing.append('protein')
            if s.get('carbs_g') is None: missing.append('carbs')
            if s.get('fat_g') is None: missing.append('fat')
            if s.get('sodium_mg') is None: missing.append('sodium')
            have = []
            if s.get('product_description'): have.append('description')
            if s.get('merchant_claims'): have.append('merchant_claim:' + jlist(s.get('merchant_claims'))[:60])
            if s.get('combo_components'): have.append('combo_components')
            if s.get('xiaohongshu_keywords'): have.append('xhs_keywords')
            if s.get('combo_components') or d.get('components'):
                method = 'component_estimate'
            elif s.get('xiaohongshu_keywords'):
                method = 'xiaohongshu_weighed_search'
            else:
                method = 'vision_semantic_estimate'
            rows_n.append({
                'sku': f"{s.get('id','')} {s.get('product_name','')}".strip(),
                'brand': brand,
                'existing_info': '; '.join(have) or 'menu_name_only',
                'missing_info': '; '.join(missing) or 'all_macros',
                'recommended_estimation_method': method,
                'worth_further_research': 'yes' if d.get('brand_category') in ('A','B') else 'no',
            })
    for src in d.get('sources', []):
        rows_s.append({k: ('' if src.get(k) is None else src.get(k)) for k in SRC_COLS})
    est = d.get('estimated_total_food_skus') or len(skus)
    researched = len(skus)
    cov = round(100.0 * researched / est, 1) if est else 0
    complete = sum(1 for s in skus if s.get('research_status') == 'complete')
    rows_c.append({
        'brand': brand, 'estimated_total_food_skus': est, 'researched_skus': researched,
        'coverage_percentage': cov,
        'missing_categories': jlist(d.get('missing_categories')),
        'status': f"swept; nutrition_complete={complete}/{researched}",
    })

def write(path, cols, rows):
    with open(path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow(r)
    print(f'{os.path.basename(path)}: {len(rows)} rows')

write(os.path.join(BASE, 'meals_master.csv'), MASTER_COLS, rows_m)
write(os.path.join(BASE, 'nutrition_sources.csv'), SRC_COLS, rows_s)
write(os.path.join(BASE, 'brand_menu_coverage.csv'), COV_COLS, rows_c)
write(os.path.join(BASE, 'needs_estimation.csv'), NEED_COLS, rows_n)
