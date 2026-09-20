# 中国都市减脂/健康饮食外卖数据库 — Schema v1

本文件是所有调研 agent 与合并脚本的**唯一数据契约**。任何写入 `brands/*.json`
或最终 CSV 的记录都必须严格遵守本 schema。

核心原则（不可违反）：
1. **AI shouldn't fake precision.** 官方给了精确值才写精确值；只有组成信息给 range；
   连组成都不确定就 `unknown` 并进 `needs_estimation`。
2. **merchant_claim ≠ nutrition_fact。** 商家"低卡/轻盈/健康"标签只记进
   `merchant_claims`，绝不填进营养数值字段。
3. **来源可追溯。** 每条营养数值必须有 `primary_source_*`；没有来源的数值禁止填写。
4. **冲突不擅自取舍。** 多源冲突写进 `conflicting_sources`，并给 `best_current_estimate`
   及理由，保留全部 provenance。

---

## 1. 品牌级 JSON（每个 core brand 一个文件）

文件：`brands/<brand_slug>.json`

```jsonc
{
  "brand": "麦当劳",
  "brand_slug": "mcdonalds-cn",
  "brand_category": "B",              // A 专业轻食 | B 主流连锁 | C 非品牌场景 | D 组合式
  "menu_inventory_source": {          // 菜单事实来源（美团/饿了么/官方菜单）
    "type": "official_menu | meituan | eleme | xiaohongshu | other",
    "url": "...",
    "title": "...",
    "date": "YYYY-MM-DD",
    "notes": "..."
  },
  "estimated_total_food_skus": 62,    // 该品牌当前外卖菜单正餐 SKU 总数估计
  "missing_categories": ["..."],      // 本次未扫到的分类
  "components": [ /* 仅 customizable 品牌填写，见 §4 */ ],
  "skus": [ /* 见 §2 */ ],
  "sources": [ /* 见 §3；本品牌所有被引用来源，sku_id 关联到 skus[].id */ ]
}
```

## 2. SKU 记录（meals_master 的行）

```jsonc
{
  "id": "mcd-cn-banban-grilled-chicken-burger",   // <brand_slug>-<slug>
  "brand": "麦当劳",
  "brand_category": "B",
  "product_name": "板烧鸡腿堡",                    // 菜单原文
  "product_name_normalized": "grilled chicken burger (banban)",
  "menu_category": "汉堡",                          // 品牌菜单实际分类
  "product_description": "...",
  "serving_size": 1, "serving_size_unit": "份",
  "energy_kcal": 430,            // 仅当 nutrition_value_type=exact 或 estimated_point
  "protein_g": 26, "carbs_g": 47, "fat_g": 15,
  "fiber_g": 3, "sodium_mg": 850, "sugar_g": 6,
  "nutrition_value_type": "exact | estimated_range | estimated_point | unknown",
  "energy_min_kcal": null, "energy_max_kcal": null,
  "protein_min_g": null, "protein_max_g": null,
  "carbs_min_g": null, "carbs_max_g": null,
  "fat_min_g": null, "fat_max_g": null,
  "primary_source_type": "official_label | official_menu | third_party_analysis | vision_estimate | semantic_estimate | merchant_claim_only | none",
  "primary_source_url": "...",
  "primary_source_title": "...",
  "primary_source_date": "YYYY-MM-DD",
  "secondary_source_url": "...",
  "source_notes": "...",
  "confidence_grade": "A | B | C | D | U",   // U = 尚无可用数据
  "merchant_claims": ["低卡"],                // 营销标签，非事实
  "xiaohongshu_keywords": ["麦当劳 减脂", "板烧鸡腿堡 热量"],
  "common_modifications": ["去酱", "薯条换玉米杯"],
  "tags": ["burger", "high_protein"],
  "research_status": "complete | nutrition_missing | menu_only | needs_estimation | blocked",
  "last_verified_date": "YYYY-MM-DD",
  "item_type": "single_item | preset_combo | custom_combo | generic_template",
  "combo_components": { "burger": "...", "side": "...", "drink": "..." },
  "calorie_uncertainty_drivers": ["酱汁", "米饭实际份量"],
  "conflicting_sources": [
    { "source_a": "...", "source_b": "...", "difference": "...", "possible_reason": "..." }
  ],
  "best_current_estimate": "..."
}
```

字段填写规则：
- `nutrition_value_type=exact` → 填 point 值，min/max 留空，confidence 通常 A。
- `estimated_range` → **只填 min/max**，point 留空，confidence B/C/D。
- `estimated_point` → 填 point 值但同时给一个 ±10–15% 的 min/max，confidence B/C。
- `unknown` → 所有数值留空，进 `needs_estimation.csv`。
- 宏量营养素（protein/carbs/fat）与 energy 可以有不同的 value_type 吗？**不可以**——
  一条 SKU 用一个 `nutrition_value_type` 描述整组数值；若只有能量没有宏量，
  宏量字段留空并在 `source_notes` 说明。

## 3. 来源记录（nutrition_sources 的行）

每条被实际引用过的来源一行（一个 SKU 可多行）。

```jsonc
{
  "source_id": "src-mcd-001",
  "sku_id": "mcd-cn-...",
  "brand": "麦当劳",
  "product_name": "...",
  "source_type": "official_label | official_menu | third_party_analysis | xiaohongshu_weighed | xiaohongshu_claim | vision_estimate | semantic_estimate | meituan_menu | eleme_menu",
  "source_url": "...",
  "source_title": "...",
  "source_author": "...",          // 博主/机构名；官方留空或写品牌名
  "source_date": "YYYY-MM-DD",
  "method_notes": "实物称重 312g，拆解配料，按包装营养表计算",  // B 级必填方法
  "is_official": true,
  "confidence_grade": "A | B | C | D",
  "values_reported": "energy=430kcal; protein=26g; ...",
  "notes": "..."
}
```

分级（严格）：
- **A** 品牌官方营养表/菜单标注/包装标签/官方商品页，且给出能量+蛋白+碳水+脂肪。
- **B** 有明确方法的第三方实测（称重/拆解/给出计算过程/有照片份量依据）。必须记方法。
- **C** 基于菜单写明的组成做 component estimate。优先 range。
- **D** 仅图片/菜名/模糊描述的 vision/semantic estimate。必须 range + 声明不确定。

## 4. Component model（customizable 品牌）

不枚举排列组合。分别存组件营养：

```jsonc
{ "component_type": "base|protein|vegetables|toppings|sauce",
  "name": "糙米", "serving": "100g",
  "energy_kcal": 130, "protein_g": 3, "carbs_g": 28, "fat_g": 1,
  "nutrition_value_type": "estimated_point", "confidence_grade": "C",
  "source_url": "...", "source_notes": "..." }
```

同时保留品牌官方 preset bowl / 固定款 SKU（走 §2）。

## 5. Generic meal template（C 类非品牌场景）

```jsonc
{
  "template_id": "tpl-malatang",
  "name": "麻辣烫",
  "category": "hotpot",
  "typical_components": ["肉类", "豆制品", "蔬菜", "丸滑", "主食", "汤底", "麻酱"],
  "variable_parameters": ["是否喝汤", "麻酱份量", "主食种类与份量", "丸滑比例"],
  "typical_portion": "一份 500–700g（含汤）",
  "energy_range_kcal": [450, 800],
  "protein_range_g": [20, 45],
  "uncertainty_drivers": ["麻酱", "烹调油", "丸滑淀粉", "是否喝汤", "主食份量"],
  "confidence_grade": "C",
  "sources": ["..."],
  "notes": "..."
}
```

## 6. 最终交付 CSV（由合并脚本从 brands/*.json 生成）

- `brand_landscape.csv`
- `meals_master.csv`
- `nutrition_sources.csv`
- `brand_menu_coverage.csv`
- `needs_estimation.csv`
- `generic_meal_templates.csv`
- `research_log.md`

列名与 §2/§3/§5 的 key 一一对应（snake_case）。
