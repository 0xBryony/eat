# HANDOFF — 吃吧/EAT Product Integration Phase（2026-09-18）

线上：https://pcvc3cc6.qwenwork.host/ （QW Pages 静态，当前 V9）
工作区：仓库根目录（App 在根、数据库在 `database/`、视频在 `video/`）

## 1. 数据文件位置

| 文件 | 说明 |
|---|---|
| `eat-database/v0/` | **冻结的 v0 快照**（不可变）：meals_master 791 SKU / sources 830 / templates 21 / needs_estimation 420 / landscape 30 / coverage 11 / SNAPSHOT.md |
| `eat-database/*.csv` | 工作副本（与 v0 同内容；merge.py 可重跑） |
| `eat-database/brands/*.json` | 每品牌原始扫库 JSON（含 sources/components/conflicts） |
| `eat-database/gen_demo.py` | 从 meals_master 生成 demo 层的脚本（可重跑） |
| `eat/data/demo_meals.json` | **App 实际读取**：45 条 demo-ready SKU（A13/B12/C20） |
| `eat/data/templates.json` | **App 实际读取**：21 条 generic meal templates（照片/无 SKU 兜底） |

v0 统计：confidence A255/B38/C202/D13/U283；value_type exact277/range97/point134/unknown283。
覆盖率：老乡鸡 100%、麦当劳 100%、米村 91%、塔斯汀 90%、KFC 87%、超级碗 83%、沙野 82%、Subway 96%、全家 13%、罗森 17%（便利店只收减脂子集）。

## 2. App 读取哪个数据文件

`src/data/meals.js`（repository 层）在模块加载时 `fetch('./data/demo_meals.json')` + `fetch('./data/templates.json')`（top-level await）。
它做唯一一次归一化：per-100g × 典型份量中点 → 内部 scoring point；**range 始终保留用于展示**；`_pointIsEstimate=true` 标记非 exact。
换数据 = 重跑 `gen_demo.py`（或直接编辑 demo_meals.json），不改 UI。

## 3. Nutrition Engine 位置

`eat/src/engine/nutrition.js` — NutritionStrategy 接口 + PlaceholderStrategy（已标 TODO 换 Mifflin-St Jeor）。
输入 NutritionProfile（onboarding 收集），输出 maintenance/target kcal + protein/fat/carb/fiber targets。
**后台计算、默认不展示数字**（"The engine calculates. The user doesn't have to."）。targets 存 store，load() 会在缺失时自动重算。

## 4. Recommendation Engine 位置

`eat/src/engine/recommend.js` — deterministic scoring（protein/plants/energy/craving/mealType/confidence 六维加权）+ `suggestCombo()`（main+side+drink 组合与 swap note）。
输出 ranking + structured reason（notes 数组），LLM 只负责把 reason 变成友好语言（当前由 `src/data/copy.js` 模板承担）。
候选池：craving 过滤后的 demo MEALS；comboPool 恒为全 demo 集。

## 5. Meal matching 接口（Task 4/5）

`eat/src/engine/matching.js`：
- `interpretMealInput({method:'screenshot'|'photo'|'text'|'search', text})` → 统一 structured output：
  `{ method, match_type, brand, candidate_product, matched_sku_id, matched_template_id, components, quantity_estimate, confidence, match_score, nutrition_source, energy_range_kcal, uncertainty_drivers, clarifying_question }`
- 匹配算法：brand 词典 → 核心品名覆盖率（去括号 + LCS）与 bigram 相似度取 max，阈值 0.34；无 SKU → generic template；再无 → 诚实 no_match（confidence U）。
- `resolveMatchToMeal(match)` / `getResolved(id)`：把 match 变成屏幕可渲染的 meal（template 伪 meal 注册在 registry）。
- `refineWithAnswer(match, answerIndex)` + `getLastMatch()`：**单问不确定性**——按 clarifying_question 类型（份量/酱/汤）用确定性规则收窄 range，并回显假设（"按「大半份」折算份量"）。
- **OCR/vision/NER 是唯一 mock 环节**（`extractText()` 直接吃 demo 文本）。接真实 pipeline 只替换这一个函数。

## 6. 当前仍为 mock / 待替换的部分

1. `matching.js extractText()` — OCR/vision/NER mock。
2. `nutrition.js PlaceholderStrategy` — 待换循证公式。
3. demo 层 per-100g 的"典型份量"为 estimate（已标 basis/note），非官方份重。
4. 照片路径固定落到 tpl-malatang（无真实组件识别）。
5. KFC 的 A 级来源=CDC 食物成分表，**商业使用需授权**（见 research_log 待人工确认）。
6. UI 视觉未重构（按 Task 7 冻结，等人工 visual references）。

## 7. 下一轮 agent 最应该继续的任务（按价值）

1. **UI 重构**：按人工提供的 visual references / design system 重做视觉（当前仅功能冻结版）。
2. **接真实 OCR/vision/NER** 替换 extractText()，优先外卖订单截图路径。
3. **自有称重补 B 级**：带骨可食部、薯条/鸡米花克重、蛋挞单只、玉米杯杯重、酱料挤量 → 回填 meals_master 并重跑 merge + gen_demo。
4. **老乡鸡 per-100g → per-份** 升级（官方只给 per-100g）。
5. 便利店 2026 在售核对；星巴克/吉野家/永和大王/袁记 第二轮 full-menu。

## 8. 工程约定（勿破）

- 缓存：index.html 与所有相对 import 带 `?v=N`；改动后必须 bump（QW Pages 同域会缓存旧 module）。当前 v10。
- 不假精确：range 优先于伪 point；merchant_claim ≠ nutrition_fact；冲突记 conflicting_sources 不擅自取舍。
- 不绕过登录墙/签名反爬；blocked 一律记录。
- UI 不展示数字为默认；详情折叠在"查看营养详情"。

---

## 9. Nutrition Strategy v1（2026-09-19 增补）

- Engine：`src/engine/nutritionStrategyV1.js`（eligibility → MSJ RMR → activity → TDEE → deficit → safety guard → protein ref cap → protein/fat/carb → macro validation → training split → meal guidance → reflow）
- Rules：`src/engine/nutritionRules/v1.js`（唯一系数/阈值来源）
- Adapter：`src/engine/mealNutritionAdapter.js`（NormalizedMealNutrition / portionMultiplier / combine）
- Day state：`src/engine/dayState.js`（consumed/remaining/statuses/reflow）
- Recommendation：`src/engine/recommend.js`（fitScore/fitStatus/reasons/adjustments；userPreferenceMatch 权重 0.20）
- Tests：`src/engine/__tests__/nutritionV1.test.js`（`node --test src/engine/__tests__/nutritionV1.test.js`，17/17 pass）
- algorithmVersion：`nutrition-engine-v1.0-msj`
- 旧 `src/engine/nutrition.js`（Placeholder）已不再被 app 引用，保留作历史对照。
- 改算法：改 `nutritionRules/v1.js` 系数需新建 v2 文件并升 algorithmVersion；不要改业务代码。
