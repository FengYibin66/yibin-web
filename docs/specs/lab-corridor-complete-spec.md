# Lab Corridor Complete Spec — itomdev 完整还原

## 差距分析

### P0 — 影响核心体验（必须修复）

| # | 问题 | 文件 | itomdev 实现 | 我们现状 |
|---|---|---|---|---|
| 1 | 入口门 hover 微开 + handle 下压 | EntryPreviewScene.tsx | y:±0.08 开门 + handle z:0.1 | 无 |
| 2 | 入口门 RevealMaterial | EntryPreviewScene.tsx | GLSL uProgress 笔触消隐 | 无（只有纯贴图） |
| 3 | 走廊门 RevealMaterial | CorridorDoor.tsx | GLSL uProgress 笔触消隐 | opacity fade（效果差） |
| 4 | HeroText 字母配置 | HeroText.tsx | ITOM: 4字母独立 ref + splitDir | YIBIN: 需重算 baseX/splitDir |
| 5 | 走廊门标签牌 | CorridorDoor.tsx | pustatabliczka.webp 木质牌 | 纯 Text 组件 |
| 6 | 走廊门箭头提示 | CorridorDoor.tsx | strzalka.webp 两侧箭头 | 无 |

### P1 — 重要细节

| # | 问题 | 文件 | itomdev 实现 | 我们现状 |
|---|---|---|---|---|
| 7 | 踢脚线 | CorridorDoor.tsx | texturadoprogow.webp 1582×94px | 无 |
| 8 | 门背面贴图 | CorridorDoor.tsx | backsingledoors.webp | 无（背面无贴图） |
| 9 | 入口鸭子点击 | EntryPreviewScene.tsx | 随机程序员对话 speech bubble | 无 |
| 10 | 入口猫眼睛 | EntryPreviewScene.tsx | state.pointer lerp 0.1 | 未接入（Cat 组件正确但入口未用） |

### P2 — 锦上添花

| # | 问题 | 描述 |
|---|---|---|
| 11 | PositionalAudio | 3D 空间音效距离衰减 |
| 12 | ShapeGeometry 真实门洞 | 目前用两块 Plane 拼接 |

---

## 实施计划

### Task 1：RevealMaterial GLSL Shader
新建 `components/lab/shaders/RevealMaterial.ts`

itomdev 的核心 shader 逻辑（从 RevealMaterial.jsx 提取）：
- fragment shader 注入 `uProgress` uniform
- `revealNoise()` 函数生成笔触噪声
- `maskValue = (1.0 - vMapUv.y) + noise`，当 `maskValue < uProgress * 1.5` 时 `discard`
- 用 `onBeforeCompile` 注入到 MeshStandardMaterial

接入位置：
- `CorridorDoor.tsx`：门板 sketch overlay 用 RevealMaterial，hover 时 uProgress 0→1
- `EntryPreviewScene.tsx`：入口门同样处理

### Task 2：入口门 hover 微开 + handle 动画
修改 `EntryPreviewScene.tsx`：
- `onPointerEnter`：门左右微开 y:±0.08，handle z:±0.1
- `onPointerLeave`：回到 y:0，handle z:0

### Task 3：走廊门标签牌 + 箭头
修改 `CorridorDoor.tsx`：
- 标签牌：`pustatabliczka.webp`（1.2×0.4 plane）+ Text 叠加，position 在门框上方
- 箭头：`strzalka.webp`，靠近时（dist<8）显示，两侧各一个，rotation 朝向门

### Task 4：HeroText YIBIN 字母重算
修改 `HeroText.tsx`：
- YIBIN 5 个字母，等间距分布
- baseX 重新计算（字体宽度不同于 ITOM）
- tagline 改为 `< AI Engineer />`

### Task 5：走廊门踢脚线 + 背面贴图
修改 `CorridorDoor.tsx`：
- 踢脚线：两块 Plane，position 在墙面底部，高度 0.15，用 texturadoprogow.webp
- 背面：门板 hinge group 内加背面 mesh，rotation.y = Math.PI

---

## 验收标准

- [ ] 入口门 hover 时微开 + handle 下压 + 渐显彩色
- [ ] 走廊门 hover 时笔触消隐效果（从底部向上）
- [ ] YIBIN 5 字母各自有正确的 splitDir，接近时向外飞散
- [ ] 走廊门上方有木质标签牌（pustatabliczka 贴图）
- [ ] 靠近门时左右出现箭头提示
- [ ] 走廊门底部有踢脚线
- [ ] type-check 0 errors
- [ ] Playwright 4 路由零报错

---

## 架构决策：Gallery 路由导航 (2026-07-12)

### 问题

Gallery（画廊）原设计为 R3F Canvas 内的 overlay React 组件，使用 GSAP ScrollTrigger 实现水平滚动。遇到根本问题：

- GSAP ScrollTrigger 的 `pin: true` 需要真实的 window scroll 高度。Canvas 内 fixed 定位的 overlay 无法产生真实 viewport 滚动，导致 ScrollTrigger 无法正确计算进度
- 尝试通过 `createPortal` 到 body 和 imperative `createRoot` 绕过问题，但 React StrictMode 的双重渲染导致 `removeChild` 竞争崩溃

### 方案

**Gallery 使用 Next.js 路由导航，而非 Canvas 内 overlay**

从走廊进入 Gallery：
1. 玩家靠近 Gallery 门，点击进入
2. DoorSection 执行相机对齐动画
3. 相机对齐 onComplete 时调用 `router.push('/gallery?from=lab')`，直接跳转到 `/gallery` 页面
4. 走廊不再执行 fly-in + enterRoom 流程

返回走廊：
1. Gallery 页面顶部显示"← Back to Corridor"按钮（检查 `?from=lab` query 参数）
2. 点击按钮调用 `router.push('/lab')`，返回走廊

Wheel 事件管理：
- WheelRouter 在 Gallery 挂载/卸载时调用 `activate/deactivate` API，保证走廊和 Gallery 轮盘事件互斥
- Gallery 卸载时自动恢复走廊轮盘响应

### 关键文件

| 文件 | 职责 |
|------|------|
| `components/lab/DoorSection.tsx:176-190` | Gallery 门早期导航：相机对齐后直接 `router.push('/gallery?from=lab')` |
| `components/gallery/GalleryBackButton.tsx` | 检查 `?from=lab` query 参数，显示 Back 按钮 |
| `app/gallery/page.tsx` | Gallery 独立页面 |
| `hooks/useWheelRouter.tsx` | 事件互斥 API：`subscribe/activate/deactivate` |

### 优势

✅ GSAP ScrollTrigger 获得真实 window scroll，pin/scrub 动画流畅  
✅ React 生命周期清晰：页面加载 = Gallery 挂载，页面卸载 = Gallery 卸载  
✅ 无 StrictMode 竞争，无 removeChild 崩溃  
✅ 支持浏览器后退按钮返回走廊
