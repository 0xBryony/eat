# 吃吧 / EAT

> **减脂也可以放心吃外卖。热量计算交给我们，你只管下单。**

一个**外卖原生（delivery-native）的减脂 App**。它不是热量记账工具，也不是"只能吃沙拉"的推荐器——老乡鸡、麦当劳、麻辣烫、Subway 都在它的理解范围内。

核心主张：**把卡路里记账这件事从用户手里拿走。** 用户只负责"吃了什么"和"下一顿想吃什么"，营养计算、缺口判断、下一顿建议全部由后台引擎完成。

Vibe Coding 比赛参赛作品。整个项目（App、营养数据库、营养引擎、发布会演示、先导片）由一个人组织一组 AI Agent 完成。

---

## 目录结构

```
.
├── index.html              # App 入口（PWA，无构建步骤）
├── src/
│   ├── app.js              # Hash 路由 + 状态存储
│   ├── screens/            # Today / 记一顿 / 下一顿 / 典型一天 / Onboarding / 彩蛋
│   ├── engine/             # 营养引擎（纯函数，可单测）
│   │   ├── nutritionRules/v1.js     # 全部版本化系数与证据分级
│   │   ├── nutritionStrategyV1.js   # 目标计算主流程
│   │   ├── mealNutritionAdapter.js  # 餐品归一化（保留区间，不造假精度）
│   │   ├── matching.js              # 自然语言 / 截图 / 照片 → SKU
│   │   ├── recommend.js             # 下一顿推荐与 fitScore
│   │   └── dayPlanner.js            # 典型一天组合生成
│   └── data/               # App 实际读取的数据层
├── presentation/           # 全屏 HTML 发布会演示（离线，11 幕）
├── database/               # 中国外卖营养数据库 + 溯源 + 研究日志
└── video/                  # 先导片与分镜脚本
```

## 跑起来

纯静态 ES Module，不需要构建、不需要包管理器。

```bash
# 本地起个静态服务器即可（必须用 http，file:// 下 fetch 会被拦）
python3 -m http.server 8000
# → http://localhost:8000/                App
# → http://localhost:8000/presentation/   发布会演示
```

线上预览：<https://pcvc3cc6.qwenwork.host/>

### 演示用的 URL 参数

| 参数 | 作用 |
|---|---|
| `?demo=1` | 注入一份示例用户画像，跳过 onboarding |
| `?reset=1` | 清空本地状态，重走 onboarding |
| `#/meal?step=pick&brand=老乡鸡` | 直达某品牌的 SKU 选菜页 |
| `#/easter?autostart=1` | 直达彩蛋并自动走完流程 |

### 跑测试

```bash
node --test src/engine/__tests__/nutritionV1.test.js
```

19 个用例覆盖：能量安全下限、缺口不超过 20%、脂肪夹取冲突→`review_required`、碳水残差≤0→`review_required`、训练日碳水下限、禁用语清单等。

---

## 三个值得看的地方

### 1. 营养策略是可审计的版本化配置

所有系数集中在 `src/engine/nutritionRules/v1.js`，算法版本号为 `nutrition-engine-v1.0-msj`（Mifflin-St Jeor）。每个系数都带**证据标签**：

- `scientific_formula` —— 教科书公式（如 MSJ 基础代谢）
- `reference_range` —— 膳食指南参考区间
- `product_heuristic` —— 产品自己的经验值（如 BMI 上限截断的蛋白参考体重）

引擎输出三种状态：`valid` / `review_required` / `requires_professional_guidance`。**不会**在数据不足时硬编一个数字出来。

产品语言层面有硬性约束：热量目标是**软目标**，UI 里不存在 `over_budget` / `失败` / `超标` 这类词，也禁用"罪恶""放纵""作弊餐""爆卡"等道德化表达。

### 2. 数据库带溯源和置信度，且诚实标注未知

`database/` 是对中国主流外卖品牌的逐项扫描：

| | |
|---|---|
| SKU | 804 |
| 营养数据来源条目 | 855 |
| 核心品牌 | 10（+ 便利店/地方菜若干） |
| 通用餐型模板 | 21 |
| 典型一天卡 | 13 |

每条数据带 A/B/C/D 置信度与 `value_type`（exact / range / point / unknown），来源逐条记在 `nutrition_sources.csv`，冲突**保留不消解**。v0 快照在 `database/v0/` 下冻结，不再改动。

置信度分布里 **U（Unknown）283 条是有意保留的**——不知道就是不知道，不为了填满表格硬猜。研究日志 `database/research_log.md` 记录了每次被反爬拦下、需要登录才能看的场景，都标了 blocked 而没有绕过。

### 3. 发布会演示是一个离线 HTML

`presentation/` 不是"网页版 PPT"，是一个 11 幕全屏 reveal 演示系统：零外部依赖（无 CDN、无字体下载、视频本地），双击即用的 52MB 文件夹里包含全部素材。

```
→ / Space   下一步 reveal（走完自动进下一幕）
←           上一步
1–9         跳转前 9 幕      0  跳转 One more thing
F           全屏             P  从 App / 彩蛋返回演示
R           重播当前幕
D           在演示内打开真实 App
```

Scene 10 的"One more thing"会播放一段真实的外卖彩蛋流程录屏；彩蛋本身（`#/easter`）是一个完全虚构的假外卖 App，所有数据 `isFictional: true`，不使用真实品牌、不调用支付、不写入营养数据库。

---

## 已知边界与注意

- **KFC 营养数据**部分引自 CDC 食物成分表，该来源有商业使用限制，公开前需自行确认授权口径。
- 数据库覆盖度不均：老乡鸡、麦当劳接近全量，便利店类只收"减脂相关子集"（有意为之，不是漏采）。
- 照片识别与订单截图识别目前是 **mock 管线**——图像读取和预览是真的，识别结果来自规则匹配 + 模板兜底，没有接真实视觉模型。
- 营养数值用于饮食参考，不构成医疗建议；孕期 / 哺乳期 / 慢性病 / 青少年人群在引擎里会被引导去寻求专业指导。

## 许可

数据与代码版权归项目作者所有。第三方营养数据版权归各来源方（品牌官网、公开成分表、第三方数据库）所有，具体出处见 `database/nutrition_sources.csv`。
