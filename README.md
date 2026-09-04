# 拼豆工作台 Bead Studio

面向个人拼豆玩家的 **本地优先工作台**。目标不是再做一个“图片转拼豆”，而是把：

> 设计 → 豆库 → 库存约束改图 → 采购 → 施工 → 拍照验豆 → 熨烫 → 完工扣库

连成一个完整闭环。

当前版本：**V0.4**。

## 当前能力

### 1. 工作区编辑器

- 图片转 MARD 221 色拼豆图纸
- 圆豆 + 中心孔渲染
- 滚轮缩放，鼠标中键 / 空格拖动画布
- 连续画笔
- 橡皮
- 吸管
- 网格开关
- 撤销 / 重做（最多 60 步）
- 鼠标位置行列、色号提示
- 快捷键：`B` 画笔、`E` 橡皮、`I` 吸管、`H/P` 拖动、`Ctrl/Cmd + Z` 撤销

### 2. 作品库与施工

- 多作品本地管理
- 每个作品独立施工进度
- 按色号聚焦施工
- 逐颗标记完成
- 某色号一键完成
- 拍照验豆的正确格可一键写回施工进度
- 施工达到 100% 后可“完成作品并扣减豆库”
- 扣库后的作品自动锁定，避免图纸和库存失配
- 可撤销扣库，把消耗的豆恢复到库存并重新解锁

### 3. 豆库与采购计划

- 按色号管理库存
- 图纸需求 / 当前库存 / 缺口统计
- 自定义每包颗数
- 自动生成采购清单
- 自动计算需要购买几包以及买后余量
- CSV 导出采购清单

### 4. 库存约束自动改图

#### 0 元改图

整张图做全局分配，而不是逐像素贪心替换：

- 色差：CIEDE2000 / ΔE00
- 优化：Min-Cost Flow
- 约束：`optimized_usage[color] <= inventory[color]`

总库存不够时直接拒绝，不生成“看起来有方案、实际拼不出来”的假结果。

#### 平衡版

允许设置最大替代 ΔE。色差超过阈值时，宁可补买必要原色，再重新跑全局优化。

输出：

- 替换颗数
- 平均 ΔE00
- 需要补买颗数
- 包数
- 具体替换映射

### 5. 拍照验豆

流程：

```text
手机照片
  → 点 左上 / 右上 / 右下 / 左下 四角
  → 透视矫正
  → 每格圆环采色，避开中心孔
  → 中心区域采样
  → 疑似漏豆检测
  → 自动 RGB 光照增益校正
  → Lab + ΔE00
  → 与目标图纸比较
```

结果：

- 红框：明显错色
- 黄框：颜色需人工确认
- 紫框：疑似漏豆

照片只在浏览器本地处理，不需要云端 AI。

> 真实上线前仍需要更多不同手机、灯光、豆品牌和底板颜色的数据来标定阈值。

### 6. 熨烫均匀度实验版

建议用背光照片，通过孔洞透光情况粗分：

- 疑似熔合不足
- 正常
- 疑似过熔

它只用于表面熔融均匀度辅助判断，不能保证结构强度。

### 7. PWA / 本地优先

- 图片不上传服务器
- 豆库保存在浏览器本地
- 作品与施工进度保存在浏览器本地
- Web App Manifest + Service Worker
- JSON 工程导入 / 导出

## 技术栈

- React 18
- TypeScript
- Vite
- Canvas 2D
- LocalStorage
- PWA
- CIEDE2000
- Min-Cost Flow
- Homography / Perspective Rectification

第一阶段刻意不引入后端和大模型，先把工具价值验证清楚。

## 目录

```text
bead-studio/
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── WorkspaceCanvas.tsx
│   │   ├── PatternCanvas.tsx
│   │   ├── PalettePicker.tsx
│   │   ├── InventoryPanel.tsx
│   │   ├── OptimizationPanel.tsx
│   │   ├── InspectionPanel.tsx
│   │   ├── ProjectLibraryPanel.tsx
│   │   └── BuildPanel.tsx
│   └── core/
│       ├── palette.ts
│       ├── engine.ts
│       ├── inventory.ts
│       ├── purchase.ts
│       ├── storage.ts
│       ├── download.ts
│       └── types.ts
├── scripts/
│   └── test-core.cjs
├── tests/
│   └── core.cjs
├── public/
│   ├── manifest.webmanifest
│   └── sw.js
└── .github/workflows/
    ├── pages.yml
    └── package.yml
```

## 本地运行

```bash
npm install
npm run dev
```

构建：

```bash
npm run build
```

核心算法回归：

```bash
npm run test:core
```

## 测试覆盖

当前核心回归至少验证：

- MARD 色卡数量
- 库存约束优化结果不超库存
- 完工扣库
- 扣库恢复
- 库存不足禁止扣库
- 透视矫正 + 拼豆颜色识别

GitHub Actions 使用 Node 24。每次 push / PR 会执行：

```text
npm install
npm run test:core
npm run build
```

`Package Bead Studio` 工作流在 `main` push 或手动运行时还会把 `dist/` 打成 ZIP，并上传为 Actions Artifact。

## 与 Jett-Wu/Perler_Beads_Generator 的关系

本项目参考了 `Jett-Wu/Perler_Beads_Generator` 的产品结构和 MARD 色卡数据。上游采用 MIT License。

上游成熟能力包括图层、WorkspaceCanvas、3D 预览、图片转拼豆、用量与导出。本项目当前优先实现区别化能力：

- 个人豆库
- 库存约束改图
- 施工生命周期
- 实物拍照纠错
- 熨烫检测

后续可以继续吸收上游成熟的图层 / 3D / 导出设计，但会保持库存和实物检测模块独立，方便长期维护。

第三方声明见 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) 和 [`LICENSE-JETT-WU`](./LICENSE-JETT-WU)。

## 下一阶段

优先级从高到低：

1. 真实拼豆照片数据集与验豆阈值标定
2. 自动识别豆板四角，减少手动点四角
3. 图层 / 框选 / 批量替换
4. IndexedDB 替代大工程 LocalStorage
5. 多品牌色卡与品牌间替代
6. 账号同步（确认有真实留存后再上后端）
