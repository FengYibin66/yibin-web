# 20260903140617. Lab 相机收归单一导演，底层换成 camera-controls；手势统一用 @use-gesture

- 状态：提议
- 索引：resume 的 Lab 只允许 `lib/lab/app/camera/CameraDirector` 写 `camera.position/rotation/lookAt`，底层委托 `camera-controls`（drei `<CameraControls>`）；房间内相机自由度由 `RoomDefinition.cameraFreedom` 声明；四套手写 wheel/pointer/touch 处理统一换成 `@use-gesture/react`
- 日期：2026-09-03

## 背景

`apps/resume/AGENTS.md` 已经写着一条约定：「房间转场的 `camera.position` 动画由 `DoorSection` 统一编排。房间组件只应提供目标 pose，不要自行起 tween」。这条约定是在修 P1-1（`ProjectsRoom` 与 `DoorSection` 争抢相机）之后写下的——**但它只是文档请求，没有任何机制保证**，而审计发现现在有五处在写相机：

1. `hooks/useCorridorCamera.ts` —— 每帧 lerp 走廊位置与视角。
2. `components/lab/DoorSection.tsx` —— 门前对齐、飞入、退出的两段 gsap tween（对 `rotation` 用 proxy 对象 + `onUpdate` 手写）。
3. `components/lab/TeleportRoom.tsx` —— 直接 `camera.position.set()` 瞬移。
4. `components/rooms/ProjectsRoom.tsx` —— 进房 `gsap.to(camera.position, {x:3, y:-3})`，且这是**世界坐标**，而塔在门的局部坐标系里（门在右墙、inner group 旋转约 −60°），实算相机离塔中心约 13 单位，于是四个物体在画面上只有指甲大且偏右（审计 A4）。
5. `components/lab/CorridorDecorations.tsx` —— 壁画 inspect 时把画框贴到相机前，用一个**布尔** `setCameraOverride` 夺取控制权。

由此产生的具体故障：`ProjectsRoom` 取景错误（A4）、`AboutRoom` 与 `ContactRoom` 没有房间级相机导致内容在取景外（A1/A3，Contact 的留言纸——房间唯一的 CTA——根本看不到）、放大一幅壁画后点门会把壁画一起带进房间（B5，因为布尔而非引用计数）、`NavigationUI` 监听的 `inspectChange` 事件**全仓无人派发**所以放大时 UI 从未隐藏（B6）。

手势侧同样是四套：`useCorridorCamera`（wheel + keydown + touchstart/move + 一个 1000ms 的「合成 mousemove」抑制窗口）、`ProjectsRoom`（pointerdown/move/up 拖拽）、`usePublicationCarousel`（pointer 事件 + 手写轴锁 + `setPointerCapture` + `lostpointercapture`）、`GalleryRoom`（wheel + touch）。其中三套各自实现了轴锁与惯性，语义互不一致；`hooks/useWheelRouter.tsx` 是为了协调它们而手写的一个 wheel 事件路由器。

不决策会发生什么：AGENTS.md 那条约定会继续被违反——它已经被违反了四次，因为没有任何东西能阻止一个组件写 `camera.position`。

## 选项

- **A. 保持现状，把 AGENTS.md 的约定写得更醒目。** 优点：零成本。缺点：已经证明无效（约定写下之后又新增了三处违反）。
- **B. 自写 `CameraDirector`，内部仍用 gsap tween。** 优点：解决所有权，不新增依赖，手感与现在完全一致。缺点：需要自己实现平滑 `setLookAt`、状态保存/恢复、受限 orbit、`fitToBox`——这些都是 `camera-controls` 已经做了六年且被 drei 官方封装的东西；自写是本次设计明确要避免的「盲目手搓」。
- **C. `CameraDirector` + `camera-controls` + `@use-gesture`。** 导演暴露 intent 级 API（`alignToDoor` / `enterRoom` / `dock` / `inspect` / `restore`），内部全部委托 `camera-controls`；房间自由度由声明给出；手势统一为 `@use-gesture`（pmndrs 官方，与 R3F 同一团队），其作用域机制取代手写的 `useWheelRouter`。优点：平滑过渡、状态保存恢复、受限 orbit、包围盒适配全部是库能力；`inspect` 用引用计数，B5 结构上不可能；手势语义统一，轴锁/惯性/指针捕获不再各写一遍。缺点：+约 23KB gzip；走廊手感由 lerp 改为 `camera-controls` 的阻尼，需要 A/B 校准；`useWheelRouter` 及其测试删除。
- **D. 换成 drei `<OrbitControls>` / `<PresentationControls>`。** 优点：已在依赖里。缺点：`OrbitControls` 没有平滑 `setLookAt` 与状态保存，覆盖不了「门前对齐 → 飞入 → 房间 pose → 停靠特写 → 恢复」这条链；`PresentationControls` 是展示用的受限旋转，不适合走廊漫游。

## 决策

选 **C**。

**判定原则：当一份文档约定已被违反三次以上，就把它换成机制；机制的形式是「只留一个能做这件事的地方」。** 与 ADR 20260822120809（用 PreToolUse hooks 而非文档请求做红线）同一条思路。

强制手段分两级：

1. 一条 vitest grep 测试断言除 `lib/lab/app/camera/**` 外无文件出现 `camera.position` / `camera.rotation` / `camera.lookAt` 的赋值。
2. 全仓 lint 恢复后（根 `CLAUDE.md`「已知负债」里登记的那项）转为 ESLint `no-restricted-syntax`。

导演同时接管**雾**：进房时按 `RoomDefinition.fog` 替换 `scene.fog`，出房恢复走廊雾。这是 A1/A4「被雾洗白」的修法，放在导演里是因为雾与相机距离是同一个取景问题。

走廊手感迁移纪律：步骤实施时旧实现保留在一个 flag 后一周，用 E2E 截图基线 + 主观评审对齐后再删除。

## 影响

- 正面：审计 A1/A3/A4（三个房间取景）、B5（壁画跟进房间）、B6（inspectChange 无人派发）、E4（空格键被走廊吞掉，@use-gesture 的 target 作用域可正确排除交互元素）被消除；房间取景变成 `RoomDefinition` 里的数据，可用截图基线锁定；四套手势归一。
- 负面：+约 23KB gzip；走廊手感需要一次校准，存在「不如现在」的风险（缓解：flag + A/B）；`hooks/useWheelRouter.tsx` 与 `__tests__/wheelRouter.test.ts` 删除。
- 影响面：新增 `apps/resume/lib/lab/app/camera/**`、`lib/lab/infra/cameraControls.ts`；改动 `hooks/useCorridorCamera.ts`、`components/lab/{DoorSection,TeleportRoom,CorridorDecorations}.tsx`、`components/rooms/**`；删除 `hooks/useWheelRouter.tsx`；`package.json` 增 `camera-controls`、`@use-gesture/react`；`apps/resume/AGENTS.md` 的「相机所有权」一节改为指向本 ADR 与那条 grep 测试。
