# lib/lab/app/camera/

**相机的唯一所有者**（ADR 20260903140617）。

`__tests__/cameraOwnership.test.ts` 用 grep 守住：这个目录之外的文件不能写
`camera.position` / `camera.lookAt` / `camera.rotation` / `camera.quaternion`，
`camera-controls` 也只能被这里 import。白名单里列着尚未迁移的写点，**只能缩**。

## 为什么是机制而不是约定

「房间转场的相机动画由 `DoorSection` 统一编排」这条约定被违反了四次。
后果不是风格不统一，而是**两个 gsap tween 同时写同一个 `camera.position`**：
后一个接管属性，前一个继续跑但被覆盖，相机停在两个目标之间。审计 A4
（Projects 房间四个物体只有指甲大且偏右）正是这么来的。

## 改动前必读的四个坑

**1. 两个坐标系。** `RoomDefinition.entryPose` 是**门坐标系**——原点在门平面、
**+Z 指向门外（走廊一侧）**，所以房间内的一切都是负 z。房间自己的内容用它自己
的坐标系（Projects 是「桌心坐标系」）。混用就是 A4；写成正 z 就是相机站在
走廊里（实机探针读到相机在世界 x=1.61 而走廊墙在 3.5）。

**2. 位姿锚定在房间根上，不是换算一次。** 门板与走廊段落在进房之后还会动，
房间根的世界矩阵一变，房间内容整体移动而相机留在旧世界坐标上。`followAnchor()`
每帧按房间根矩阵的**增量**同步 controls 的 position 与 target——既跟着房间走，
又保留用户的 orbit 输入（不是每帧硬拉回 entryPose，那会让房间里转不动）。

**3. 所有权是显式交接的。** `controls.update()` 每帧都把内部位姿写回相机，
**`enabled` 只关输入、不关姿态应用**。所以只要 controls 在跑，别处对
`camera.position` 的写入都会在同一帧被抹掉。director 默认 `suspended`，
进房 `resume()`、退房 `suspend()`。

**4. 模块级暂存向量会互相踩。** `enterRoom` 先把换算好的位姿放进 `_pos`/`_tgt`，
接着调 `resume()`；如果同步逻辑也用这两个，前者刚算好的值就被覆盖，
entryPose 被静默丢弃（症状与 A4 一模一样）。同步用独立的 `_sync*`。

## 调试出口

`window.__labCamera` 只读暴露 `snapshot()` / `actual()` / `mode()` /
`suspended()` / `project()` / `projectRoom()` / `roomToWorld()`。

留着它是因为**相机取景错了不报任何错**，而生产构建里拿不到 R3F 的内部 state。
从截图像素反推角度极不可靠——做 Projects 房间时照那条路走了两次，两次都得出
错误结论（先是"相机被别人转了 30°"，实测零误差；后是"标记不在声明的位置"）。
直接问「桌心原点投在画面哪里」没有歧义。

只暴露读，不暴露任何能移动相机的方法：这是观察窗，不是遥控器。

## 与 free 模式的一个陷阱

free 模式下 `update()` 会 `syncPoseFromControls()`，所以 `snapshot()` 就是相机
本身——此时拿 `actual()` 和 `snapshot()` 对照**是空断言**（两边同源）。要验
「有没有别人在写相机」，得对照 `projectRoom()` 的投影结果与预期构图。
