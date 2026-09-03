# components/rooms/projects/

Projects 房间 —— 「深夜实验室」（ADR 20260903140619）。

## 这里没有坐标常量

空间全部由 `lib/lab/domain/rooms/projects/scene.ts` 声明：墙在哪、桌子多大、
白板挂哪面墙、机柜几个槽、便签贴哪、电缆从哪到哪。这些组件只负责遍历声明去画。

**加一块墙面装饰是往声明里加一项，不是往这里加 JSX。**

原实现的坐标散在组件里十几个魔数中（`TOWER_RADIUS`、`TOWER_Z_START`、
`CAMERA_Y_OFFSET`…），而相机取景在另一个文件里靠另一组魔数猜。审计 A4 就是
这两组数对不上——相机离塔 13 单位而不是意图的 6。坐标只有一个来源，
「取景对不对」才是可验证的。

## 文件

| 文件 | 职责 |
|------|------|
| `ProjectsRoomView.tsx` | 注册表入口，把 `RoomViewProps.phase` 翻成 `isExiting` |
| `ProjectsRoom.tsx` | 组合 + 接相机所有者与 dock 状态机 |
| `LabShell.tsx` | 地板 / 天花 / 三面墙（复用走廊纹理 + `SHELL_TINT` 压暗） |
| `LabFurniture.tsx` | 工作台、台灯、机柜（含 LED 呼吸）、其余墙面陈设 |
| `ProjectMonitor.tsx` | 一块项目显示器（线稿 → 彩绘显形、停靠交互） |
| `SketchPanel.tsx` | 把 `SketchSpec` 贴到平面上的通用出口 |

## 三个必须知道的约束

**坐标系有两层。** `rootRef` 那一层是房间根（**门坐标系**：原点在门平面、
+Z 指向门外），内层 `<group position={[0, 0, ROOM_ORIGIN_Z]}>` 是桌心坐标系
（scene.ts 里所有坐标所在的空间）。唯一的换算点就是那一个 group 与
`toDoorFrame()`。

**相机不在这里写。** 只调 `cameraDirector.enterRoom(pose, root, freedom)`，
退房前 `suspend()` 交还。见 `lib/lab/app/camera/AGENTS.md`。

**ESC 要认领，不能自己挂监听。** 用 `pushEscapeConsumer`——ESC 已绑定
「退出房间」，自己挂 window 监听会让两者同时触发，房间退场把收回打断
（实机相位序列 `docked → undocking → undocking(exiting)`）。

## 「看起来不对」是测不出来的吗？不是

`__tests__/projectsScene.test.ts` 用**真透视投影**断言构图：桌心投在画面正中、
六块显示器连边缘都在画面内且左右对称、白板四角可见且不被显示器挡住、
台灯在视野里（主光源看不见的话光就是「从空气里来」）、机柜与刻度盘在
`cameraFreedom` 能转到的范围内。

早期版本用的是「距离 d 处可见半宽 vs 内容最大横向偏移」的近似——它忽略各物体
各自的深度，给出的是**假的信心**：断言是绿的，而实机上桌心原点投在 NDC
x = −1.66（画面外）。构图是刚体变换下的不变量，所以在桌心坐标系里算出的 NDC
就是实机的 NDC（用 `window.__labCamera.projectRoom()` 验证过一致）。

## 调试出口

`window.__labProjects` 只读暴露 `phase()` / `selectedIndex()` / `isExiting()` /
`log()`（相位序列）。「点了没反应」可能是没命中、可能是相机没动、也可能是
状态机停在一个不接受该事件的相位里——画面上分不出来。实机排查停靠正是靠
相位序列才定位到 ESC 冲突。
