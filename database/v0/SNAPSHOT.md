# DATABASE V0 SNAPSHOT — frozen 2026-09-18

冻结说明：v0 之后除非明确 demo 需求，不再大范围补数据。原始文件仍在工作目录，v0/ 为不可变快照。

## 总记录数
- meals_master SKU: 791
- nutrition_sources: 830
- generic_meal_templates: 21
- needs_estimation: 420
- brand_landscape: 30
- brand_menu_coverage: 11
- brands/*.json: 11 files

## SKU confidence 分布
- A=255 B=38 C=202 D=13 U=283

## nutrition_value_type 分布
- exact=277 estimated_range=97 estimated_point=134 unknown=283

## item_type / research_status
- item_type: {'custom_combo': 17, 'single_item': 714, 'preset_combo': 60}
- research_status: {'complete': 371, 'nutrition_missing': 122, 'needs_estimation': 172, 'menu_only': 125, 'blocked': 1}

## 来源 confidence 分布
- A=290 B=46 C=235 D=259

## 各品牌 coverage
| brand | est_total | researched | coverage% | status |
|---|---|---|---|---|
| 跨品牌减脂友好选择库(Phase5) | 15 | 15 | 100.0 | swept; nutrition_complete=15/15 |
| 全家便利店 | 250 | 33 | 13.2 | swept; nutrition_complete=22/33 |
| 超级碗 FOODBOWL | 58 | 48 | 82.8 | swept; nutrition_complete=3/48 |
| 肯德基 | 165 | 144 | 87.3 | swept; nutrition_complete=35/144 |
| 老乡鸡 | 191 | 191 | 100.0 | swept; nutrition_complete=191/191 |
| 罗森 | 350 | 60 | 17.1 | swept; nutrition_complete=44/60 |
| 麦当劳 | 60 | 60 | 100.0 | swept; nutrition_complete=58/60 |
| 米村拌饭 | 70 | 64 | 91.4 | swept; nutrition_complete=0/64 |
| 沙野轻食 | 38 | 31 | 81.6 | swept; nutrition_complete=1/31 |
| Subway 赛百味中国 | 78 | 75 | 96.2 | swept; nutrition_complete=1/75 |
| 塔斯汀中国汉堡 | 78 | 70 | 89.7 | swept; nutrition_complete=1/70 |
