# 20260909182319. resume 的屏幕边缘是一张声明表：浮层占哪个角由 domain 声明、只有一个组件写 `position: fixed`、视口判据收归单一入口

- 状态：提议
- 索引：resume 全站 15 处 `position: fixed` 各自写坐标与 z 值（15 个互不共享的 z：0/1/5/10/20/30/40/50/95/100/110/120/200/9998/9999），四个屏角是无主的共享资源，于是同一坐标被多个互不知情的组件占用，撞不撞取决于内容宽度——2026-09-09 审计实测出四个实例（`/classic` 的 `← Home` × Navbar 品牌 92%、入口页 ExplorerBar × Classic CTA 100%、**桌面**入口页 ExplorerBar × 域名水印 100%、Lab 的 `← Exit Lab` × 图标排 320px 下 80px）。决定：① 新增 `lib/layout/overlays.ts` 声明槽位（九个锚点 + 每锚点内的排布方向与间距）、层序（z 由有序数组下标派生，不手写数字）与每个浮层的 `presence` 谓词；② `components/layout/EdgeLayer.tsx` 是**唯一**允许写 `position: fixed` 的组件（全屏模态/过场层显式例外），同锚点的多个占位者用 flex 排布，几何上不可能重叠；③ 视口判据（`isNarrow` / `isTouch` / `canHover`）收归 `hooks/useViewport.ts`（`pointer: coarse` 现在在六个文件各查一次、`matchMedia` 散在 10 个文件），读点由棘轮门禁只减不增；④ 三条门禁（AST 单写者 + 棘轮、槽位表有真实消费者、同槽位必须可证互斥）。**第一期只收编八个边缘小挂件，全屏层只登记层序、定位不动。** 判定原则：**屏幕的四个角是共享资源；共享资源必须有一张声明表和一个写者**
- 日期：2026-09-09

## 背景

### 这个仓库已经为同一个抽象缺失付过一次钱，账还记在注释里

`app/globals.css` 第 288–296 行：

```
气泡与提示原先都是 `bottom: 32px; left: 50%`，而气泡是白底、z-index 110，
提示是 z-index 10——**气泡把提示整个盖住**。而气泡（教程类）不自动消失，
所以那条提示实际上长期不可见，包括审计 E10 花力气把对比度从 2.4 提到 4.5
的那一条：颜色改对了，但它被压在一块白底下面。

88px = 32（提示的底距） + 提示自身高度（约 20）+ 一段间距。
```

两件事值得单独指出：

1. **一个组件在注释里手算另一个组件的高度**（`88 = 32 + 20 + 间距`）。这是抽象缺失最直接的临床表现——它把「提示有多高」变成了气泡的源码常量，提示改一行字，这个数就悄悄错了，而没有任何东西会报警。
2. **一次对比度审计的成果被一块白底吞掉，而审计本身没有发现**。E10 把对比度从 2.4 提到 4.5，颜色确实改对了；只是那段文字长期不可见。**修对了看不见的东西，等于没修**，而当时没有机制能告诉他。

### 现状：15 处 fixed、15 个 z 值、四个角无主

实测（2026-09-09，`grep` + 浏览器测量）：

| 坐标 | 占位者 | z | 结果 |
|---|---|---|---|
| `top:20 left:20` | `app/classic/page.tsx` 的 `← Home` | 100 | 与 Navbar 品牌重叠 92%（手机）。桌面上不撞是因为 `max-w-6xl mx-auto px-6` 把品牌推到 x≈88——**巧合，不是设计** |
| `top:20 left:20` | `components/lab/LabScene.tsx` 的 `← Exit Lab` | 50 | 与下一行在 320px 下重叠 80px |
| `top:16 right:16` | `components/ui/NavigationUI.tsx` 六个图标一排（6×40 + 5×8 = 280） | 50（容器） | 占 x 24→304；`← Exit Lab` 占 20→104 |
| `top:20 left:20` | `NavigationUI.tsx` 房间内返回按钮 | 50（容器） | 与 `← Exit Lab` **同槽**，靠 `isInRoom` / `!isInRoom` 互斥侥幸不撞——这个约定只存在于两个 JSX 条件里，没有任何地方声明过 |
| `bottom:16 center` | `components/entry/ExplorerBar.tsx` | 100 | 盖住 Classic 面板的「Open the résumé」100% |
| `bottom:16 center` | `app/page.tsx` 的域名水印 | 30 | **桌面上 100% 被 ExplorerBar 盖住**，从 ExplorerBar 上线那天起没人见过 |
| `bottom:32 center` | `LabScene.tsx` 的滚动提示 | 10 | 被上面那段注释里的气泡压过一次，靠手算 88px 躲开 |
| `bottom:88 center` | `globals.css` 的 `.achievement-popup` | 110 | 见上 |

z 值取到 15 个互不共享的数：`0 1 5 10 20 30 40 50 95 100 110 120 200 9998 9999`。屏角内边距同时存在 `16` / `20` / `24` / `32` 四种，没有共识。

**最后一条最有说服力**：域名水印那条在**桌面**上。它证明这批缺陷与「手机」无关——手机只是让内容更宽、把巧合掀翻。真正的病是**屏幕的角是共享资源，而它没有所有权**。

### 第二半：形态判据也没有主人

`768` 这个数字有三个独立表示，且边界语义相反：

| 表示 | 位置 | 生效区间 |
|---|---|---|
| Tailwind `md:`（47 处 / 15 文件） | 组件 className | **≥ 768** |
| `@media (max-width: 768px)`（2 条） | `globals.css:379, 497` | **≤ 768** |
| `matchMedia('(max-width: 768px)')` | `app/page.tsx` 的 `isStacked` | **≤ 768** |

**768px 整点上「手机 CSS」与「桌面 Tailwind」同时生效**，是一条真实的 off-by-one；而 E2E 的 `mobile-safari` 形态是 iPhone 13（390px），结构上永远测不到这一点。

`pointer: coarse` 在**六个**文件各查一次、各存一份 state（`EntryStage` / `ExplorerBar` / `EntryPreviewScene` / `ArtworkFrame` / `LabScene` / `LabTutorial`）；`matchMedia` 全站出现在 **10** 个文件。而 `hooks/useMotionScale.ts` 的文件头注释逐字写着这个病：「地方：有人订阅 store、有人调 `matchMedia`、有人干脆自己存一份，于是同一时刻…」——**reduced-motion 已经因此收归 `lib/lab/app/motion.ts` 单一入口并由 `motionConsumers.test.ts` 守着（零例外）。触屏与窄屏判据没有做同样的事。**

### 不决策会发生什么

四个实例逐个修掉坐标，然后：汉堡菜单要占 `top-right`，而 Lab 的图标排也在 `top-right`；`← Home` 删了，但汉堡的面板与品牌又在同一条水平线上。**每加一个屏角挂件，都要人肉回忆另外十四个在哪**，而回忆失败的表现是「在某个宽度上重叠」——不是报错，是变丑，且只在没人测的那个视口上。

## 选项

- **A. 只加一张 z-index 常量表**（`lib/layout/zLayers.ts`），定位仍各自写。代价最小，消灭那 15 个魔数；**但修不掉上表四个实例**——它们是位置冲突不是层序冲突，`← Home` 与品牌撞是因为都在 `left:20/24`，不是因为 z 排错。
- **B. 声明式槽位表 + 单一 `EdgeLayer` 消费者 + AST 单写者门禁**（推荐）。同锚点的占位者由一个 flex 容器排布，「两组绝对定位撞 80px」变成「一行里第二组可用宽度变窄」，几何上不可能重叠。代价：约十处改动、一层间接、全屏层定序有风险（故分两期，见「决策」）。
- **C. 不要抽象，逐个修坐标，把「新增 fixed 前先看一遍现有的」写进 `AGENTS.md` 靠 review 守。** 代价：零机制。**本仓库已有直接反例**——`globals.css` 那个 `88px = 32 + 20 + 间距` 修的就是同类重叠，注释还在那里，而三个月后又出了四个新实例。写进文档没有阻止它。
- **D. CSS anchor positioning（`position-anchor` / `position-try`）让浮层互相避让。** 浏览器原生、零抽象；但 Safari 支持太新（本站要管 iOS），且它解决「贴着某个元素定位」，不解决「多个互不知情的浮层共享一个屏角」——避让目标仍要人指定。

## 决策

**B，分两期，第二期不做。**

### domain：`lib/layout/overlays.ts`（纯声明，不 import react / three）

- `OVERLAY_LAYERS`：有序枚举 `hint < chrome < panel < popup < caption < transition < modal`，**z 值由数组下标派生**（`index * 10`），不手写数字。这一条独立地消灭那 15 个魔数。
- `EDGE_SLOTS`：九个锚点（`top-left` … `bottom-right`）+ 每锚点的 inset token + 同锚点内的排布方向与间距。inset 统一为 `12px`（<768）/ `16px`（≥768），并一律叠加 `env(safe-area-inset-*)`。
- `OVERLAY_REGISTRY`：每个浮层一条 `{ id, slot, layer, presence }`。`presence` 是**判定谓词的声明**（`'always' | 'desktop' | 'narrow' | 'in-room' | 'not-in-room' | 'first-visit'`）。它必须存在：`← Exit Lab` 与房间内返回按钮**合法地共用 `top-left`**，靠 `isInRoom` 互斥——今天这个约定只活在两个 JSX 条件里，声明出来才能被断言。

### app：`components/layout/EdgeLayer.tsx` 是唯一写者

全仓唯一允许 `position: fixed` 的组件（全屏 `inset:0` 的模态与过场层是显式例外，理由见「影响」）。同锚点多个占位者交给一个 flex 容器排布。

### 视口判据：`hooks/useViewport.ts`

返回 `{ isNarrow, isTouch, canHover }`，一次 `matchMedia` + 订阅 change，SSR/首帧返回 `null` 中间态（**照抄 `EntryStage.tsx` 已有的写法与它为什么必须存在的注释，别重新发明**）。断点常量出自 `lib/layout/breakpoints.ts` 的 `NARROW_MAX = 767.98`，`globals.css` 那两条 `@media` 同步改掉整点重叠。

**三个字段不许压成一个布尔**：`GlowButton` 用的是 `(pointer: fine)`，`app/page.tsx` 用的是 `(hover: hover) and (pointer: fine)`，`EntryStage` 要 `coarse && ≤768` 两个条件同时成立——`AGENTS.md` 记着为什么（只看宽度会让拖窄的桌面窗口掉进静态路径，只看 pointer 会让 iPad 横屏掉进去）。任何「简化」都会重新引入这两个已知回归。

### 门禁三条

| 门禁 | 形态照谁 | 守什么 |
|---|---|---|
| `overlayOwnership.test.ts` | `railWriter.test.ts`（`setRail` 单调用方）+ `cameraOwnership.test.ts`（`{文件: 写点数}` 棘轮，只能往下） | 生产代码里 `position: fixed` 只许出现在 `EdgeLayer.tsx` 与例外清单，清单是棘轮 |
| `overlayRegistry.test.ts` | `corridorLandmarks.test.ts` 的接线检查 | ① 表里每条都有真实消费者（"已定义未接线"是债务，ADR 20260903211338）；② **同 slot 的两个占位者必须有可证互斥的 presence** |
| `viewportReaders.test.ts` | `cameraOwnership.test.ts`（**棘轮**，`{文件: 读点数}`，只能往下） | `matchMedia` 的读点收敛。**不能做成「只许两个文件」的硬白名单**：实测全站 10 个文件读它，其中 `lib/animations/scrollReveal.ts` 与 `hooks/useMotionScale.ts` 是合法的 reduced-motion 读者，硬白名单第一天就红。棘轮记下当前 10 个、只减不增 |

需要给 `__tests__/helpers/sourceScan.ts` 新增**一个**查询 `styleProps`（对象字面量的 `position` 属性值 + className 字面量里的 `fixed`/`sticky`/`z-[N]` token）。这是本 ADR 对 sourceScan 的唯一扩展。

### 分两期，第二期明确不做

**第一期**收编八个边缘小挂件：`← Exit Lab`、房间内返回、六个图标那一排、`ExplorerBar`、`EntryLocaleToggle`、`GalleryBackButton`、域名水印、Lab 底部提示、成就气泡。这一期偿还上表四个实例的全部。

**第二期**（收编 `LabLoader` 9999 / `PaperTransition` 9998 / `LabTutorial` 200 / `NavigationUI` 容器 50）**不做**。那四个的语义是「盖住一切」而不是「占一个角」；给它们重新定序，若把纸过场排到 loader 之下画面就错，而 `lab.spec.ts` 那 61 条断言读的是 `data-lab-*` 属性，**对 z 序完全失明**——改错了没有任何测试会红。它们只登记进 `OVERLAY_LAYERS` 的最高两档，定位保持现状。

**判定原则**：*屏幕的四个角是共享资源；共享资源必须有一张声明表和一个写者。* 与 ADR 20260903211244（相机所有权）同构：那次治的是「两个写者同帧写相机，靠 rAF 注册顺序侥幸不出事」。

## 影响

- 正面：四个实例一次修掉，且**新增屏角挂件不再需要人肉回忆另外十四个在哪**；15 个 z 魔数变成一张有序表；`isInRoom` 那个隐式互斥约定变成断言；`pointer: coarse` 从六份 state 收成一份，与 reduced-motion 的既有形态对齐；768 整点重叠消掉。
- 负面：多一层间接——「这东西为什么在这」要跳两个文件（相机导演已经付过这笔钱，形态是熟的）；`EdgeLayer` 本身引入新的 `position: fixed` 写点，所以 `overlayOwnership` 的棘轮初值只能在实现完成后才能定；全屏层不进表，读者可能误以为屏角表管住了所有布局——**故在 `EDGE_SLOTS` 的文件头显式写明它不管什么**。
- **它不解决字形溢出类缺陷**（education 详情页标题被挤成 31px、字形越出自身盒 137px）。那是流内布局，不是浮层冲突。**不要把它塞进这个抽象**——会让抽象承担它管不了的责任，然后下一个人以为屏角表管住了所有布局。那条已在 PR #43 单独修掉，规则写进 `AGENTS.md`。
- 影响面：新增 `lib/layout/{overlays,breakpoints}.ts`、`components/layout/EdgeLayer.tsx`、`hooks/useViewport.ts`、三个门禁、`sourceScan.styleProps`；改 `app/classic/page.tsx`、`app/page.tsx`、`components/entry/{ExplorerBar,EntryLocaleToggle}.tsx`、`components/lab/LabScene.tsx`、`components/ui/NavigationUI.tsx`、`components/gallery/GalleryBackButton.tsx`、`app/globals.css`（两条 `@media` 与 `.achievement-popup` 那个手算偏移）、`apps/resume/AGENTS.md`。

## 与既有 ADR 的关系

- [20260903211244](./20260903211244-lab-camera-owner-is-explicit-not-suspended-flag.md)（相机所有权显式、写点棘轮）：**同构，形态照抄**。那次是相机，这次是屏角。
- [20260908172231](./20260908172231-corridor-world-state-single-writer.md)（走廊世界状态单写者）：**同一判定原则的第三次应用**——共享资源要有单一写者与一张声明表。
- [20260903211338](./20260903211338-finish-wiring-lab-registry-and-machines.md)（已定义未接线是债务）：`overlayRegistry.test.ts` 的第一条断言直接来自它。
- [20260903140617](./20260903140617-lab-single-camera-owner.md) / [20260907120701](./20260907120701-gsap-lifecycle-owned-by-context.md)：同一系列的所有权类决策。
- ADR 20260822120807（人工提升 + 先让门禁跑起来）：**援引其授权**，触摸目标与 9px 字号那类「先记账、不一次改完」的棘轮政策不必另立决策。
