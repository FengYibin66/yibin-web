# Publications Room 高保真重构与房间加载设计

**日期**：2026-07-12  
**状态**：待用户最终审阅  
**当前项目**：`yibin_web/apps/resume`  
**参考项目**：`portfolio-itom`

## 1. 目标与范围

本阶段解决两个问题：

1. Publications 房间未正确还原参考项目 Gallery 房间，卡片点击、居中、翻面、内容展示、循环滚动及移动端交互存在缺失或错误。
2. 点击普通房间门后，资源加载期间没有反馈；现有 `onReady` 仅等待固定帧数，不代表纹理、字体和首帧真正就绪，可能开门后出现空白或逐块加载。

第一阶段优先实现**行为高保真**，仅将项目卡片内容替换为论文数据。高保真完成后，再独立评估视觉与内容增强，避免“还原”和“再设计”混在同一次改动中。

本阶段不重构 Gallery 路由页面，不改变 About、Projects、Contact 的房间视觉；但统一房间加载机制会覆盖所有普通房间门。

## 2. 参考行为基准

Publications 房间以参考项目 `GalleryRoom.jsx` 为交互基准：

- 卡片沿弧形晾绳无限循环排列，并有轻微风摆。
- 桌面滚轮和手机横向拖动均可浏览卡片。
- 点击卡片后，先滚动居中，再执行“下拉脱夹 → 纸张弯曲 → 翻面 → 拉近放大”动画。
- 卡片背面展示详情和明确的外部链接按钮。
- 点击已展开卡片会完整归位；点击另一张时，先关闭当前卡片，再打开目标卡片。
- 展开、关闭、场景 paint reveal 期间锁定冲突输入。
- 桌面 hover 支持手绘到上色 reveal；触屏不依赖 hover。
- 进入房间时保留参考项目的场景 paint reveal；地图快速传送可跳过重复 reveal。
- 纸张文字和按钮随纸张弯曲/风摆更新位置，避免与纸面脱离或穿模。

## 3. 模块边界

禁止直接移植参考项目的单文件巨型组件。按职责拆分：

```text
components/rooms/publications/
├── PublicationsRoom.tsx          # 场景编排，不包含卡片动画细节
├── PublicationCard.tsx           # 单卡片渲染和输入上报
├── PublicationCardFront.tsx      # 正面论文信息
├── PublicationCardBack.tsx       # 背面摘要、关键词、VIEW PAPER
├── PublicationsScenery.tsx       # 地面、栏杆、城市、云、飞鸟
├── usePublicationCarousel.ts     # 无限循环、滚轮/触屏浏览、居中
├── usePublicationCardMotion.ts   # 开合状态与 GSAP 时间线
├── publicationConstants.ts       # 尺寸、时长、灵敏度
└── publicationTypes.ts           # 显式类型

lib/content/
└── publications.ts               # 论文单一数据源或现有内容的适配层

lib/lab/
├── roomAssets.ts                 # RoomId → 资源清单、预加载入口
└── roomLoadMachine.ts            # 纯状态转移函数，可单测

components/lab/
├── RoomInterior.tsx              # Suspense 边界与 ready bridge
└── RoomLoadingIndicator.tsx      # 门内沉浸式加载 UI
```

约束：

- UI 组件不超过 300 行，函数尽量不超过 30 行。
- 论文数据只保留一份；房间不得复制 `PUBS` 常量。
- 卡片通过 props 接收数据，通过 `onSelect`、`onOpenPaper` 等回调上报意图。
- 动画状态用显式联合类型表达，不使用多个互相同步的布尔值。
- 固定样式移出 JSX，动态 Three.js transform 可保留运行时配置。

## 4. Publications 状态与数据流

### 4.1 卡片交互状态

```ts
type CardMotionPhase =
  | 'hanging'
  | 'centering'
  | 'detaching'
  | 'flipping'
  | 'open'
  | 'returning'
```

房间只维护：

- `selectedPublicationId: string | null`
- `motionPhase: CardMotionPhase`

派生：

- `isInteractionLocked = motionPhase !== 'hanging' && motionPhase !== 'open'`
- `canBrowse = selectedPublicationId === null && motionPhase === 'hanging'`

禁止每张卡片各自维护一份全局选中事实。卡片可保留 hover 等纯局部 UI 状态。

### 4.2 点击流程

1. 用户点击未选中卡片。
2. 若有其他卡片展开：等待当前卡片完整 `returning → hanging`。
3. carousel 将目标卡片沿最短路径滚动到中心。
4. 执行 detach / bend / flip / zoom 时间线。
5. 状态变为 `open`，启用背面 `VIEW PAPER` 命中层。
6. 外链使用 `window.open(url, '_blank', 'noopener,noreferrer')`。

动画 Promise 必须在被中断或组件卸载时安全结束，避免 `globalAnimating` 永久锁死。

### 4.3 桌面与移动端

- 桌面：滚轮浏览、hover reveal、点击展开。
- 移动端：单指横向拖动浏览、点击展开；禁止依赖 hover。
- 卡片展开时阻止 carousel 消费滚轮/触摸。
- 使用现有 `WheelRouter` 统一输入所有权，不直接创建不可控的全局 Observer。

## 5. 房间加载状态机

### 5.1 状态

```ts
type RoomLoadPhase =
  | 'idle'
  | 'aligning'
  | 'loading'
  | 'ready'
  | 'opening'
  | 'entered'
  | 'failed'
  | 'exiting'
```

合法主路径：

```text
idle → aligning → loading → ready → opening → entered → exiting → idle
```

失败路径：

```text
loading → failed
failed → loading   (Retry)
failed → idle      (Back to corridor)
```

### 5.2 Ready 的真实语义

删除各 Room 中“渲染 10/20 帧后调用 onReady”的契约。

房间 ready 必须同时满足：

1. 房间模块及其当前渲染树退出 Suspense；
2. 当前房间资源清单已完成预加载；
3. Room ready sentinel 至少完成两个 `requestAnimationFrame`，确保首帧提交；
4. 组件未被退出或传送流程取消。

8 秒只用于展示 `failed/slow` 操作，不允许“超时后强行开门”。

### 5.3 加载体验

点击门后：

1. 镜头按现有动画对齐门。
2. 门保持关闭，门牌附近显示手绘墨迹循环动画。
3. 显示房间语义化文案，例如 `Preparing Publications…`。
4. ready 后加载指示器淡出，门打开，镜头穿门。
5. 超过 8 秒显示：
   - `Retry`
   - `Back to corridor`

加载 UI 为统一 DOM overlay，但视觉锚定在当前门区域；不使用全屏撕纸遮罩，以保持空间连续性。地图传送仍可使用现有 PaperTransition，二者状态由同一房间加载状态机协调。

### 5.4 预加载时机

- 门进入接近范围或 hover/focus 时，调用 `preloadRoomAssets(roomId)`。
- 用户点击后再次调用是幂等的。
- 低性能设备只预载当前门对应房间，不进行全房间 GPU warmup。
- 高性能设备可在浏览器空闲时预载相邻门房间，但不作为第一阶段必需项。

## 6. 错误处理与资源清理

- 资源加载错误进入 `failed`，不得留下已锁定的 camera override。
- Retry 必须重新建立加载尝试，不复用已失败状态。
- Back 必须恢复相机控制、关闭加载 UI、复位门和本地状态。
- GSAP timeline、timeout、RAF、事件订阅在卸载/退出时全部清理。
- 外链缺失时不渲染 `VIEW PAPER`，不创建空点击区域。
- 音频加载或自动播放失败不得阻止房间 ready。

## 7. 测试策略（TDD）

### 7.1 纯逻辑测试

先写失败测试，再实现：

- `roomLoadMachine` 只允许合法状态转移。
- loading 超时进入 failed，不进入 opening。
- retry / back 正确复位。
- carousel 循环位置和最短路径计算。
- 卡片切换严格执行 close-current → open-target。
- 动画被取消时锁定态可以释放。

### 7.2 组件测试

- Room Suspense 未解决时显示 `Preparing Publications…`。
- ready sentinel 完成前门不开启。
- ready 后 loading 消失并触发一次开门。
- failed 提供 Retry / Back，按钮可键盘操作。
- 移动端横向拖动更新 carousel，展开时不更新。
- `VIEW PAPER` 仅在 open 状态可点击，并带安全窗口参数。

### 7.3 回归验证

- 现有全量 Vitest。
- TypeScript type-check。
- Next.js production build。
- 桌面：滚轮、hover、开合、切卡、退出、重入。
- 手机：横向拖动、点击、展开内容可读、返回。
- 慢网：门内加载可见；失败不穿门。
- 地图传送：PaperTransition 与 room loading 不互相提前揭开。

## 8. 第一阶段验收标准

1. Publications 空间、晾绳、场景 reveal、卡片滚动及完整翻转行为与参考项目一致。
2. 论文数据正确，背面内容无反向、穿模、截断或无法点击问题。
3. 桌面和触屏都有明确且互不冲突的浏览方式。
4. 同时只能有一张卡片处于展开/动画状态。
5. 所有普通房间门在真实 ready 前保持关闭并显示加载反馈。
6. 加载失败不进入空房间；用户可 Retry 或 Back。
7. 不再使用固定帧数作为资源就绪信号。
8. 新逻辑有失败先行的自动化测试，全量测试、type-check、production build 通过。

## 9. 后续走查（不阻塞第一阶段）

第一阶段完成后单独输出全房间问题清单，按 P0/P1/P2 排序。已知重点包括：

- Projects 房间与 DoorSection 同时修改相机造成动画竞争。
- About / Projects 的大量逐项纹理加载可能形成 Suspense 瀑布。
- Gallery 路由动态组件缺少独立页面加载反馈。
- Gallery 存在历史 3D 房间/Portal 死代码，需要明确保留或删除。
- SceneContext 与 DoorSection 本地状态双轨，后续可收敛为统一 entry controller。

这些问题先记录，不在 Publications 高保真重构中顺带大范围修改。
