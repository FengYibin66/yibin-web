# 20260903211244. 相机所有权改为显式持有者，取代「挂起布尔」；走廊传送不再经由导演

- 状态：已接受
- 索引：修订 ADR 20260903140617 的所有权形态——`CameraDirector.suspended` 布尔改为显式 `claim(root, pose, freedom)` / `release()`，进房飞行由导演持有（删掉 `DoorSection` 直接写相机的 gsap tween），走廊传送改写走廊导轨的 z 而不再调用导演；`CameraRig` 在开发态每帧断言「本帧只有持有者写过相机」，让所有权违规在首次实机运行就炸而不是靠肉眼看截图
- 日期：2026-09-03

## 背景

ADR 20260903140617 立了一条正确的规则——只有 `CameraDirector` 能写相机——并用 `__tests__/cameraOwnership.test.ts` 的白名单 grep 门禁守住。实现之后请四位专家视角做独立 review，其中 3D/R3F 视角查出三条缺陷，逐条核实全部成立，而且**根因是同一个**：

所有权的开关是一个布尔 `suspended`，它把「此刻谁在写相机」变成了**隐式的运行时状态**，且调用方在导演睡着时下命令不会得到任何反馈。

1. **进房时两个写者重叠约 2 秒。** 房间在 `CAMERA_ALIGNED` 就挂载（`doorEntryFlow.ts` 的 `MOUNT_ROOM`），`ProjectsRoom` 的 effect 随即 `enterRoom()` → 导演唤醒、每帧 `controls.update()` 写相机；而开门动画之后 `DoorSection` 的 `gsap.to(camera.position)`（进房飞行 8 个单位）才开始写。谁赢取决于 gsap 的 rAF 与 R3F 渲染循环谁后注册。今天恰好是导演后写、逐帧覆盖，所以**飞行动画被静默吞掉、画面看起来正常**；一旦注册顺序翻转就是 1.5 秒抖动。这正是 ADR 617 要消灭的故障形态，以更难察觉的方式活着。
2. **传送不再瞬移。** `TeleportRoom` 调 `moveToWorld({duration: 0})`，它走 `push()` → `controls.setLookAt(..., false)`，而 camera-controls 的 `setLookAt` 只改内部 `_target/_spherical`，相机位姿要等 `update()` 才应用——但导演在走廊里是挂起的，`update()` 第一行就 return。相机一动不动，随后的对齐 tween 从**旧位置**飞过去。测试断言的是导演内部的 `snapshot()` 而不是 `camera.position`，所以没抓到。
3. **About 房间的探身效果被删掉了。** `AboutRoom` 每帧调 `setLean(pitch, bank)`，值写进 `this.lean` 后无人应用——`applyLean()` 在 `update()` 内、挂起检查之后，而 About 从不 `enterRoom`/`resume`。迁移时测的是「不抢写相机」，没测「效果还在」。

同一次 review 还查出：`RoomDefinition.entryPose` 除 Projects 外无人消费，所以 ADR 615 声称「A1/A3（About/Contact 无房间级相机）由 entryPose 修复」在运行时并不成立。

不决策会发生什么：白名单门禁只保证「不在组件里写相机」，不保证「导演在正确的时刻醒着」。这类缺陷不报错、不掉帧、在开发机上截图正常，只在别人的浏览器上以 1.5 秒抖动或「传送变成穿廊飞行」的形式出现——正是 ADR 617 想终结的那一类。

## 选项

- **A. 保留 `suspended`，在每个动作方法里补挂起检查并 `console.warn`。** 优点：改动最小，不动调用方。缺点：只把静默失败变成有声失败，「谁该在什么时刻持有相机」仍然没有一处声明；三个调用方仍然要各自记住时序。审计里「修一个症状、同一根因再产三条」的模式会重演。
- **B. 显式持有者 + 持有者转移由编排层驱动 + 开发态每帧断言。** 所有权成为 `claim`/`release` 一对显式动作；进房飞行迁进导演（删掉 `DoorSection` 那条 gsap tween，双写窗口**按构造消失**而不是靠约定避免）；走廊传送不再经由导演，改为写走廊导轨的 z（走廊里相机是沿 z 的一维轨道，`useCorridorCamera` 本就是它的持有者，导演在走廊里根本不该被调用）；`CameraRig` 在开发态比对相机实际位姿与持有者最后写入的位姿，超差即抛。优点：违规在首次运行就炸；`entryPose` 由 `RoomInterior` 统一消费，About/Contact 的取景随之真的生效；白名单从「文件级」收紧为「写点计数棘轮」。缺点：要改 `DoorSection`、`TeleportRoom`、`RoomInterior` 三处编排；Publications 的自有 gsap 相机仍需保留一条例外。
- **C. 相机完全交给 camera-controls，所有动画都用它的 `*ToAsync` API，删掉 gsap 相机 tween。** 优点：只有一个库写相机，物理上不可能双写。缺点：camera-controls 的过渡是阻尼驱动的，`gsap` 那条带 `ease` 的定时编排（开门 0.7s、飞入 1.5s、与门板动画对齐）无法等价表达；进出房编排的时序与门板动画强耦合，改成阻尼会失去可控的节奏。代价与收益不匹配。

## 决策

选 **B**。

**判定原则：所有权必须是一个能被断言的显式状态，而不是一个能被忘记检查的布尔。** 一个「在错误时刻调用会静默无效」的 API，比四处乱写更危险——因为它看起来是对的。凡是引入所有权/独占语义的机制，同时要给出「此刻谁持有」的可观测出口和一条能在开发态炸掉违规的断言，否则这个机制只是一份措辞更自信的约定。

具体形态：

- `claim(root, pose, freedom)`：房间接管相机，从当前实际位姿 tween 到 `entryPose`（房间局部坐标，由 `roomLocalToWorld` 换算并 `followAnchor` 逐帧锚定），`onArrive` 回调驱动编排层进入 `entered`。
- `release()`：交还给走廊。
- 进房飞行由 `claim` 承担：编排层在开门面板动画结束后 `claim`，`DoorSection` 不再写相机。
- 传送改为设置走廊导轨的目标 z（纯 domain 函数从 `corridor/layout.ts` 派生），导演不参与。
- `RoomInterior`（而不是各房间组件）统一 `claim(ROOMS[id].entryPose)`，于是 About/Contact 的 `entryPose` 首次被真正消费，`setLean` 自然生效。
- Publications 保留自有 gsap 相机，但必须先 `release()`；白名单改为写点计数棘轮 `{ 文件: 期望写点数 }`，只能减不能加——文件级白名单的问题是「已在名单里的文件再加 20 个写点也是绿的」。
- `CameraRig` 在 `NODE_ENV !== 'production'` 下每帧断言相机实际位姿与持有者记录一致。

## 影响

- 正面：三条已核实的缺陷（进房双写、传送失效、About 探身丢失）按构造消失而非逐条修补；`entryPose` 从死声明变成生效数据；新增的所有权违规在开发态首次运行即暴露。
- 负面：`RoomInterior` 承担了编排职责（原先各房间自理），房间组件对相机的控制力下降——房间若需要非 `entryPose` 的取景，必须扩 `RoomDefinition` 而不能自己写；Publications 仍是例外，所有权模型在它那里是「显式让位」而非「统一持有」。
- 影响面：`apps/resume/lib/lab/app/camera/CameraDirector.ts`、`components/lab/{CameraRig,DoorSection,TeleportRoom,RoomInterior}.tsx`、`components/rooms/projects/ProjectsRoom.tsx`、`hooks/useCorridorCamera.ts`、`components/rooms/publications/usePublicationBrowseCamera.ts`、`__tests__/cameraOwnership.test.ts`、`__tests__/cameraDirector.test.ts`。
