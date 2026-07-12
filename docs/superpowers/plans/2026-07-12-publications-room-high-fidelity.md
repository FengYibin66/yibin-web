# Publications Room High-Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以模块化 TypeScript 架构高保真复刻参考项目 Gallery 房间的晾绳循环浏览、paint reveal、纸张弯曲翻面和详情交互，仅替换为论文内容。

**Architecture:** 房间组件只编排场景；carousel 和卡片 motion 分别由纯逻辑 + hook 管理；卡片正反面拆成展示组件；所有论文读取同一内容适配层；输入通过现有 WheelRouter 统一路由。

**Tech Stack:** React 19、TypeScript、React Three Fiber、Drei、Three.js、GSAP、Vitest。

## Global Constraints

- 先达到参考项目行为高保真，再讨论增强。
- `PublicationsRoom.tsx` 不超过 300 行；禁止重新制造 1000+ 行组件。
- 论文数据只有一个源；不保留房间内 `PUBS` 副本。
- 交互状态使用 `CardMotionPhase`，避免 `selectedCard + globalAnimating + local isAnimating` 多份真相。
- 手机使用横向拖动浏览，桌面使用 WheelRouter；展开期间锁定浏览。
- 外链必须使用 `noopener,noreferrer`。
- 本计划依赖 `2026-07-12-room-loading-state-machine.md` 已完成。
- 新纯逻辑先写失败测试；不新增依赖。
- 未获得用户明确授权时不执行 git commit/push。

---

## File Map

- Create `apps/resume/components/rooms/publications/publicationTypes.ts`
- Create `apps/resume/components/rooms/publications/publicationConstants.ts`
- Create `apps/resume/components/rooms/publications/publicationCarouselMath.ts`
- Create `apps/resume/components/rooms/publications/publicationMotionMachine.ts`
- Create `apps/resume/components/rooms/publications/usePublicationCarousel.ts`
- Create `apps/resume/components/rooms/publications/usePublicationCardMotion.ts`
- Create `apps/resume/components/rooms/publications/PublicationCard.tsx`
- Create `apps/resume/components/rooms/publications/PublicationCardFront.tsx`
- Create `apps/resume/components/rooms/publications/PublicationCardBack.tsx`
- Create `apps/resume/components/rooms/publications/PublicationsScenery.tsx`
- Create `apps/resume/components/rooms/publications/PublicationsRoom.tsx`
- Create `apps/resume/lib/content/publications.ts`
- Modify `apps/resume/components/lab/RoomInterior.tsx`
- Delete old `apps/resume/components/rooms/PublicationsRoom.tsx`
- Test `apps/resume/__tests__/publicationCarousel.test.ts`
- Test `apps/resume/__tests__/publicationMotion.test.ts`
- Test `apps/resume/__tests__/publicationData.test.ts`

---

### Task 1: 论文单一数据源与显式类型

**Files:**
- Create: `apps/resume/lib/content/publications.ts`
- Create: `apps/resume/components/rooms/publications/publicationTypes.ts`
- Test: `apps/resume/__tests__/publicationData.test.ts`

**Interfaces:**

```ts
export interface PublicationRoomItem {
  id: string
  title: string
  venue: string
  year: number
  authors: string
  abstract: string
  doi?: string
  keywords: readonly string[]
  featured: boolean
}

export function getPublicationRoomItems(locale: Locale): readonly PublicationRoomItem[]
```

- [ ] **Step 1: 写失败测试**

断言数据从现有 `content.en/zh.publications.items` 适配，ID 稳定且唯一；CSCW 论文 featured；所有有 DOI 的 URL 使用 https；房间文件中不再出现第二份论文标题常量。

- [ ] **Step 2: 运行确认 RED**

- [ ] **Step 3: 实现适配层**

ID 由显式映射生成，禁止由标题 hash 临时生成：

```ts
const PUBLICATION_IDS = ['cscw25', 'acm23', 'chi25'] as const
```

缺失 abstract 时使用一条明确定义的英文/中文摘要 fallback，而不是空字符串。

- [ ] **Step 4: 测试确认 GREEN**

- [ ] **Step 5: 检查点**

---

### Task 2: Carousel 纯数学与最短路径

**Files:**
- Create: `apps/resume/components/rooms/publications/publicationConstants.ts`
- Create: `apps/resume/components/rooms/publications/publicationCarouselMath.ts`
- Test: `apps/resume/__tests__/publicationCarousel.test.ts`

**Interfaces:**

```ts
export function wrapDisplayOffset(rawOffset: number, totalWidth: number): number
export function getNearestCarouselTarget(
  current: number,
  targetIndex: number,
  itemGap: number,
  itemCount: number,
): number
export function applyCarouselDelta(
  currentTarget: number,
  delta: number,
  sensitivity: number,
): number
```

- [ ] **Step 1: 写失败测试**

覆盖正负 wrap、跨首尾最短路径、0 item 防御、连续 delta 可加、不同 viewport 不影响逻辑。

- [ ] **Step 2: 运行确认 RED**

- [ ] **Step 3: 最小实现**

`wrapDisplayOffset` 使用标准双 modulo；非法 `itemCount <= 0` 抛 RangeError。

- [ ] **Step 4: 测试确认 GREEN**

- [ ] **Step 5: 检查点**

---

### Task 3: 卡片 motion 状态机

**Files:**
- Create: `apps/resume/components/rooms/publications/publicationMotionMachine.ts`
- Test: `apps/resume/__tests__/publicationMotion.test.ts`

**Interfaces:**

```ts
export type CardMotionPhase =
  | 'hanging'
  | 'centering'
  | 'detaching'
  | 'flipping'
  | 'open'
  | 'returning'

export interface PublicationMotionState {
  selectedId: string | null
  pendingId: string | null
  phase: CardMotionPhase
}
```

- [ ] **Step 1: 写失败测试**

覆盖：

- hanging 点击 A → centering(A)
- open(A) 点击 A → returning(A)
- open(A) 点击 B → returning(A, pending B)
- returned 且 pending B → centering(B)
- animation cancel → hanging/null，不永久锁定
- 非法阶段事件抛错

- [ ] **Step 2: 运行确认 RED**

- [ ] **Step 3: 实现 reducer 与派生 selector**

```ts
export const canBrowse = (state: PublicationMotionState) =>
  state.phase === 'hanging' && state.selectedId === null
```

- [ ] **Step 4: 测试确认 GREEN**

- [ ] **Step 5: 检查点**

---

### Task 4: usePublicationCarousel 输入归一化

**Files:**
- Create: `apps/resume/components/rooms/publications/usePublicationCarousel.ts`
- Test: `apps/resume/__tests__/publicationCarouselHook.test.tsx`

**Interfaces:**

```ts
interface UsePublicationCarouselOptions {
  active: boolean
  locked: boolean
  itemCount: number
  itemGap: number
}

interface PublicationCarouselApi {
  currentScroll: React.MutableRefObject<number>
  centerItem: (index: number) => Promise<void>
}
```

- [ ] **Step 1: 写失败测试**

mock WheelRouter，验证 active 且未锁定才消费 wheel；触屏横向 drag 更新 target；纵向 drag 不更新；cleanup 后不再响应。

- [ ] **Step 2: 运行确认 RED**

- [ ] **Step 3: 实现 hook**

桌面 wheel 使用 `deltaY * 0.005`；触摸维护 `lastTouchX`，使用 Pointer Events 与 pointer capture，不创建 GSAP Observer。`useFrame` 以 `delta * 5` 平滑 lerp。

- [ ] **Step 4: 实现 centerItem Promise**

只 tween target，并在 onComplete 同步 current，避免旧实现双 tween 相互竞争。cleanup 时 kill tween 并 resolve/cancel。

- [ ] **Step 5: 测试确认 GREEN**

- [ ] **Step 6: 检查点**

---

### Task 5: 卡片开合动画 hook

**Files:**
- Create: `apps/resume/components/rooms/publications/usePublicationCardMotion.ts`
- Test: `apps/resume/__tests__/publicationCardMotionHook.test.tsx`

**Interfaces:**

```ts
interface PublicationCardMotionApi {
  paperRef: React.RefObject<THREE.Group | null>
  materialRef: React.RefObject<PaperMaterialHandle | null>
  open: (target: THREE.Vector3) => Promise<void>
  close: () => Promise<void>
  cancel: () => void
}
```

- [ ] **Step 1: 写失败测试**

mock GSAP timeline，验证 open 的阶段顺序：

1. y 下拉 + bend 0.8
2. 上提并翻转约 `Math.PI * 0.8`
3. 拉到世界中心、rotation.x = PI
4. scale = 1.1、bend 回 0

close 逆序归位。unmount/cancel kill timeline 且 Promise 结束，不留下锁。

- [ ] **Step 2: 运行确认 RED**

- [ ] **Step 3: 实现 hook**

所有 duration/ease 从 `publicationConstants.ts` 读取。hook 不访问全局 selected state。

- [ ] **Step 4: 测试确认 GREEN**

- [ ] **Step 5: 检查点**

---

### Task 6: 卡片正反面展示组件

**Files:**
- Create: `apps/resume/components/rooms/publications/PublicationCardFront.tsx`
- Create: `apps/resume/components/rooms/publications/PublicationCardBack.tsx`
- Test: `apps/resume/__tests__/publicationCardContent.test.tsx`

**Interfaces:**

```ts
interface PublicationCardFaceProps {
  publication: PublicationRoomItem
  opacity: number
}
```

- [ ] **Step 1: 写失败测试**

测试可抽成纯 view model，断言正面包含 venue/year/title/authors；背面包含 ABSTRACT、keywords、VIEW PAPER；无 DOI 时按钮不可见。

- [ ] **Step 2: 运行确认 RED**

- [ ] **Step 3: 实现正面**

保持参考项目字体与纸面布局；featured 只作为视觉强调，不改变交互。

- [ ] **Step 4: 实现背面**

按钮由可见 mesh + 独立透明 hit area 组成；仅 open 状态启用 raycast/click；调用：

```ts
window.open(publication.doi, '_blank', 'noopener,noreferrer')
```

- [ ] **Step 5: 测试确认 GREEN**

- [ ] **Step 6: 检查点**

---

### Task 7: PublicationCard 纸面绑定与 hover reveal

**Files:**
- Create: `apps/resume/components/rooms/publications/PublicationCard.tsx`
- Reuse: `apps/resume/components/rooms/gallery/PaperMaterial.tsx`
- Test: `apps/resume/__tests__/publicationCard.test.tsx`

- [ ] **Step 1: 写失败测试**

断言触屏不触发 hover reveal；桌面 hover 调整 `uProgress`；selected/transitioning 时忽略外层点击；按钮点击 stopPropagation。

- [ ] **Step 2: 运行确认 RED**

- [ ] **Step 3: 实现卡片**

组件只接收：

```ts
interface PublicationCardProps {
  publication: PublicationRoomItem
  index: number
  displayPosition: THREE.Vector3
  isSelected: boolean
  isLocked: boolean
  canHover: boolean
  onSelect: (id: string) => void
}
```

纸面、文字、按钮的 z/rotation 每帧根据 PaperMaterial bend/wind 统一计算，抽取 `getPaperSurfaceTransform(y, bend, wind, time)` 纯函数并测试。

- [ ] **Step 4: 测试确认 GREEN**

- [ ] **Step 5: 检查点**

---

### Task 8: PublicationsScenery 高保真场景

**Files:**
- Create: `apps/resume/components/rooms/publications/PublicationsScenery.tsx`
- Modify: `apps/resume/lib/lab/roomAssets.ts`

- [ ] **Step 1: 为资源清单写失败测试**

Publications manifest 必须包含 floor、railing、houses、city、bird、clothespin、paper back/button、paper sound、city ambience、paper texture/paint variants。

- [ ] **Step 2: 运行确认 RED**

- [ ] **Step 3: 实现场景**

高保真包含：

- 梯形阳台地面和 outline
- railing + threshold
- 宽弧形 rope（参考点 `[-16…16]`，不是当前压缩的 `[-10…10]`）
- 三层 houses/city；右侧 houses 保留裁切逻辑
- bird 物理与安全 delta
- clouds 65（LOW tier 可降至 32）
- sky sphere
- 城市环境音不阻塞 ready

- [ ] **Step 4: 运行资源测试、type-check**

- [ ] **Step 5: 检查点**

---

### Task 9: PublicationsRoom 场景编排与 paint reveal

**Files:**
- Create: `apps/resume/components/rooms/publications/PublicationsRoom.tsx`
- Modify: `apps/resume/components/lab/RoomInterior.tsx`
- Delete: `apps/resume/components/rooms/PublicationsRoom.tsx`
- Test: `apps/resume/__tests__/publicationsRoom.test.tsx`

- [ ] **Step 1: 写失败测试**

断言：

- 普通进入触发一次 paint reveal 并在 reveal 完成前锁定输入。
- 地图快速传送直接设置 reveal 完成态。
- 选择 B 时等待 A close 后再 open B。
- 退出/传送会取消 timeline、隐藏 tutorial、复位 selected。

- [ ] **Step 2: 运行确认 RED**

- [ ] **Step 3: 实现编排组件**

Room 只组合：

```tsx
<PublicationsScenery paint={paintApi} />
<PublicationClothesline
  publications={items}
  carousel={carousel}
  motion={motion}
/>
```

Paint material 逻辑从参考 `usePaintMaterial` 以 TypeScript 独立 hook 迁移；不把 shader 状态塞回 Room。

- [ ] **Step 4: 更新 RoomInterior import**

指向新目录；删除旧 397 行文件，确保无遗留 import。

- [ ] **Step 5: 测试确认 GREEN**

- [ ] **Step 6: 检查点**

---

### Task 10: 综合验收与走查输出

**Files:**
- Create: `docs/reviews/2026-07-12-resume-lab-room-audit.md`

- [ ] **Step 1: 全量自动验证**

```bash
pnpm --filter @yibin/resume type-check
pnpm --filter @yibin/resume test
pnpm --filter @yibin/resume build
```

Expected: 全部 exit 0，无新增 lint/type warning。

- [ ] **Step 2: Publications 手工验收**

桌面：

- 滚轮无限循环，卡片不跳位。
- hover paint reveal。
- 点击自动居中并完整翻面。
- A→B 严格先关 A。
- VIEW PAPER 安全打开 DOI。

手机：

- 横拖循环，纵拖不抢。
- 点击展开，内容可读且无反向/穿模。
- 展开期间拖动不改变 carousel。

- [ ] **Step 3: 加载手工验收**

Slow 3G、Offline、Retry、Back、地图传送、退出后重入逐项通过。

- [ ] **Step 4: 输出全房间审查**

文档按 P0/P1/P2 记录：

- Projects 相机动画竞争。
- About/Projects 纹理瀑布。
- Gallery 路由 loading 与死代码。
- Contact 空交互。
- DoorSection/SceneContext 双轨状态的后续收敛建议。

- [ ] **Step 5: 检查点**

向用户汇报测试证据与剩余问题；仅在用户明确要求时提交和推送。
