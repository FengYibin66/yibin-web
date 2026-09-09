<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# apps/resume/

作品集站 `resume.yibinfeng.com`。Next.js 15 静态导出 + React Three Fiber 3D 场景。

> 上方 `nextjs-agent-rules` 块由工具自动注入维护，**不要手改块内内容**。项目约定写在本分隔线以下。

## 硬约束：纯静态，不能加运行时后端

`next.config.js` 是 `output: 'export'`，构建产物由 nginx 直接提供，**没有 Node 运行时**（ADR 20260822120803）。

因此：**不能在本应用内新增 API route、Server Action、或任何需要运行时的 Next.js 特性。** 需要后端时调 portal 的接口或另立服务。这不是风格偏好——加一个 route 就会让整站退回 SSR，从"一堆 nginx 托管的文件"变回"一个需要监控和重启的服务"。

## 结构

```
app/                     # Next.js App Router（路由与页面）
├── page.tsx             # 入口
├── classic/             # Classic 简历视图
├── lab/                 # Lab 3D 视图
└── gallery/             # 画廊（独立路由，绕过 R3F 房间挂载流程）
components/              # 组件
├── canvas/ entry/ layout/ providers/ ui/
├── classic/ lab/ rooms/ sections/
│   ├── rooms/registry.ts  # roomId → 视图组件（lazy）；RoomInterior 唯一的分发处
│   └── rooms/projects/    # 「深夜实验室」（ADR 20260903140619）
└── gallery/
lib/
├── content/             # 简历内容数据
├── lab/
│   ├── domain/          # 纯声明：房间、走廊、音频、状态图、手写层
│   │   ├── rooms/       # RoomDefinition（含 projects/scene.ts 空间声明）
│   │   ├── machines/    # XState 状态图
│   │   ├── sketch/      # 手写层的类型与 plan（纯函数）
│   │   └── audio/       # 音频清单
│   ├── app/             # 编排：相机所有者、音频混音器、store、ESC 消费栈
│   │   ├── camera/      # CameraDirector —— 唯一能写相机的地方
│   │   ├── audio/       # AudioMixer（howler）
│   │   └── assets/      # manifest.gen.ts（派生生成物，勿手改）+ preload.ts（运行时入口）
│   └── infra/           # 外部依赖实现（roughjs 栅格化、纹理缓存）
├── scene/ animations/ gallery/
media-src/               # 原始素材，**不部署**（见该目录的 AGENTS.md）
context/                 # React Context（Scene / Performance / Achievements）
hooks/                   # 通用 hooks
scripts/
├── lab/                 # 预载表生成器
├── media/               # 五条素材流水线：音频 / 门贴纸 / 纹理 / 证书图片 / 字体子集
│                        # 都支持 --check，CI 会跑（见 media-src/AGENTS.md）
└── qa/                  # 用户路径巡检（Classic + Lab）：每步一张整屏截图，**给人看、不断言**
__tests__/               # vitest
```

分层方向单向朝内：`domain` 不感知 React / three / DOM，`app` 编排，`infra`
实现外部依赖。与 `auto-wechat/backend` 同一套（见根 CLAUDE.md「分层」）。

**`features/` 不是本应用的分层，git 里不存在它。** `git ls-files` 无任何 `apps/resume/features/` 条目——本地若看到 `features/lab/` 下 8 个空子目录（experience / context / loading / corridor / hooks / shaders / dom），那是从未落地的骨架残留（空目录不入 git，所以只在工作副本里）。清理：`rm -r apps/resume/features`。

`lab` 的真实实现在 `components/lab/`（视图）与 `lib/lab/`（逻辑）两处。**不要往 `features/` 加代码，也不要重建它**——若确需第三个落点，先说明为什么现有两处不够。

## 当前有效的验收报告与目标架构

**当前有效**：`docs/reviews/2026-09-02-resume-lab-full-audit.md` —— 全部 147 个源文件逐个通读 + 实机截图，63 条问题（16 P1 / 31 P2 / 15 P3 / 1 ARCH）、六个根因模式、六项已定稿的产品决定。

`docs/reviews/2026-07-12-resume-lab-room-audit.md` **已被它取代**（头部有前向指针），不要再以旧报告下结论。旧报告 4 条 P1 中 3 条已修，第 4 条（26 个纹理 loader）并入下表的 ADR 20260903140619。

### 现状 ≠ 目标

六步已全部实施，但**不是每一份 ADR 都完全落地**——下表的「取代的现状」列
记的是实际状态。改动前先看清那一栏。

### 落地状态（读之前先读这一段）

**「已定义、未接线」不算落地。** 2026-09-03 的四份独立 review 查出：三份 ADR 的主体
（房间注册表的消费路径、`room`/`corridor` 状态图、派生预载表）代码写了、测试绿了，
**但运行时从没引用过它们**，而这张表上一版把它们写成「已落地 / 已用」。后果不是「文档不整洁」，
而是下一个人会相信 About/Contact 的取景由 `entryPose` 驱动、房间生命周期由状态图保护，
然后基于错误前提往上叠设计——根 CLAUDE.md 用 libSQL 被写成 MySQL 那次事故举的正是这个例子。

判断落地的操作性标准，改动这张表时照着做：

```bash
grep -rl <模块> app components context hooks lib   # 有非测试命中才算接线
```

接线计划见 ADR [20260903211338](../../docs/adr/20260903211338-finish-wiring-lab-registry-and-machines.md)。

| ADR | 目标 | 实际状态 |
|-----|------|-----------|
| [20260903140615](../../docs/adr/20260903140615-lab-room-registry-and-derived-assets.md) | 房间由 `lib/lab/domain/rooms/` 的 `RoomDefinition` 声明；预载表是**派生生成物** | **已接线**（`20260903211338`）：`RoomInterior` 按 `components/rooms/registry.ts` 分发（`React.lazy`，没有 `switch`）、教程从 `RoomDefinition.tutorial` 读、预载走 `lib/lab/app/assets/preload.ts`（读生成物），手写的 `roomAssets.ts` 与 `texturePreload.ts` 的走廊部分已删。首屏壁画 3 段 → 1 段，**省 1466 KB**。`view` 已移出 domain（它曾让 domain import react）。<br>`entryPose` / `cameraFreedom` 三间房（Projects / About / Contact）都已消费（2026-09-04 接上 About / Contact，带截图标定；门禁 `roomCameraWiring.test.ts`）。<br>**已核实为误判**：PR #12 说「生成物未加入 hook 保护名单」是错的——`.claude/hooks/pre-generated-edit.sh` 按 `\.gen\.(ts|tsx|go|py)$` 匹配，`manifest.gen.ts` 天然受保护（实测被拦）。|
| [20260903140616](../../docs/adr/20260903140616-lab-xstate-and-zustand-replace-context.md) | 生命周期用 XState 状态图；共享状态用 zustand | **房间生命周期已接线**（`20260903211338`）：`SceneContext` 用 `useMachine(roomMachine)`，手写的 `roomLoadMachine.ts` + `doorEntryFlow.ts` 已删；8 秒超时是 `loading` 的一行 `after`（取代 `setTimeout` + 3 个互相看护的 ref），进房所有权从机器 context 派生，**审计 A8 的 `entered → failed` 边现在运行时真的存在**。`useDoorEntryOrchestrator` 从 5 个 effect / 4 个 ref 缩到 2 个 effect / 1 个 ref。`@xstate/graph` 已用于全路径覆盖（`roomMachineFlow.test.ts`）。<br>**`corridor.machine` 已接线**（[20260908204302](../../docs/adr/20260908204302-corridor-touring-mode-wires-the-corridor-machine.md)，2026-09-08）：`SceneContext` 的五个传送布尔 + `useRef` 镜像改为机器快照派生，`teleporting.aborted` 有了消费方（`cancelTeleport` → `ROOM_FAILED` / `TELEPORT_ABORT`），新增 `touring`；走廊模式 `free / touring / teleporting / inRoom` 由它派生到 `world.mode` 与 `html[data-lab-mode]`。机器从 `loading` 起步，`LabLoader` 稳定完成后经模块级信号 `lib/lab/app/labLoaded.ts` 送 `LOADED`（LabLoader 与 SceneProvider 在 `LabClient` 里是兄弟，不能用 context——第一版这么写把整个 Lab 弄崩了）。<br>**仍未接线**：`dockMachine` 只有 Projects 用，Publications 仍是 `publicationMotionMachine`。<br>**接线时发现的五个缺口**（机器定义好但从未被运行时走过，所以没人发现）：① `mounting` 缺 `READY` 边——纹理已缓存的房间不 Suspend、拿不到 `MOUNTED`，会永久卡住（即「第二次进同一间房」这条最常见路径）；② `tryRoom` 若读渲染快照而非 actor，同一 tick 内连点两下门会两次都判合法；③ **`MOUNTED` 没有发送方**（`RoomInterior.onLoading` 默认 NOOP、`DoorSection` 没传）→ `loading` 生产不可达 → **8 秒加载超时永远不启动**；④ **`EXIT_DONE` 没有发送方**——退场收尾复用了 `RESET`，现已拆成 `finishRoomExit()`；⑤ **`BACK` 4 条边全是死的**——目标与动作和 `RESET` 逐字相同且无人发送，已删。③④⑤ 由新门禁 `__tests__/machineEventWiring.test.ts` 抓出：**图上有边 ≠ 运行时有人发**，而机器测试与全路径覆盖都会自己 `send()`，照样全绿 |
| [20260903140617](../../docs/adr/20260903140617-lab-single-camera-owner.md) | **只有 `lib/lab/app/camera/CameraDirector` 能写相机**，底层 `camera-controls`；手势用 `@use-gesture` | **部分落地，且所有权形态已被 [20260903211244](../../docs/adr/20260903211244-lab-camera-owner-is-explicit-not-suspended-flag.md) 修订**：`suspended` 布尔让三处出错——进房时导演与 DoorSection 的 gsap **同帧双写约 2 秒**（靠 rAF 顺序侥幸不出事）、传送的 `moveToWorld({duration:0})` 在挂起态是**空操作**、About 的 `setLean` 是**死代码**。手势未迁移，`@use-gesture` 未安装 |
| [20260903140618](../../docs/adr/20260903140618-lab-audio-howler-mixer.md) | 单一 `AudioMixer`（howler + spatial），三条总线 | **已落地**：四套实现收成一套，环境音重编码 6.8MB → 1.7MB。这是五份里唯一完整落地的 |
| [20260903140619](../../docs/adr/20260903140619-lab-external-assets-and-runtime-sketch.md) | 外部素材许可记录 + Rough.js 运行时草图；Projects 重做 | **部分落地**：手写层（roughjs）+ Projects 重做 + 平台隐喻已去 + Gallery 门贴纸已换。许可记录（`public/CREDITS.md`）当时**未创建**，已补；ADR 表里列的 Doodle Icons / Open Doodles / freesound / Excalidraw **实际一个都没用**，出入见 `public/CREDITS.md` 文末 |

### 源码门禁：一个 AST 扫描器，三条规则 + 一条接线检查

三条门禁（相机所有权、Lab 漏译、覆盖层对比度）共用
`__tests__/helpers/sourceScan.ts`——基于 `typescript` 编译器 API，提供
`cameraWrites` / `userStrings` / `colorLiterals` 三个查询。决策与理由见 ADR
[20260903211320](../../docs/adr/20260903211320-source-gates-use-ts-ast-not-regex.md)。

**为什么不是正则。** 第一版三条都是 grep + 手写字符串剥离器，独立 review 构造
20 个绕过形态**活了 10 个**：`camera.rotation.set(`（`DoorSection.tsx` 眼下在用、
白名单注释里也登记过的写法）、`position.setZ(`、`rotateX(`、
`gsap.to(camera.rotation`、别名 `const cam = camera` 全不认；一个 JSX 里的
`Don't` 撇号或一条含 `//` 的 URL 就能吞掉同文件后面所有代码；漏译那条要求
「2 个以上单词」，于是 `Back` / `Skip` / `Mute` 全溜过去、门禁报告「无漏译」而
截图满屏英文；对比度那条只认 `rgba()`，`#hex` 与 `opacity` 的二次衰减都看不见。

**三条共同的形态是棘轮，不是布尔。**

| 门禁 | 棘轮 | 当前基线 |
|------|------|---------|
| `cameraOwnership.test.ts` | `{ 文件: 期望写点数 }` | 8 文件 / 34 写点 |
| `labI18n.test.ts` | `KNOWN_LEAKS`（按文件记漏译条数） | 1 文件 / 1 条 |
| `labContrast.test.ts` | `KNOWN_LOW_CONTRAST`（同上） | **空** |
| `labFonts.test.ts` | 无棘轮（全禁写死路径） | 0 |
| `machineEventWiring.test.ts` | 无棘轮（全禁孤儿事件） | 0 |
| `roomCameraWiring.test.ts` | 无棘轮（全禁死声明 entryPose） | 0 |
| `noGlobalScrollTriggerKill.test.ts` | 无棘轮（全禁 `ScrollTrigger.getAll()`） | 0 |
| `railWriter.test.ts` | 无棘轮（`setRail` 只许 `useCorridorCamera` 调） | 0 |
| `motionConsumers.test.ts` | `ROOM_LEVEL_PENDING`（房间层未接动效开关的文件） | **空**（走廊层与房间层都零例外） |
| `corridorLandmarks.test.ts` | 无棘轮（地标表必须有生产消费者；活物距同侧门 > 15） | 0 |

漏译剩的那一条是 `HeroText` 的 3D 标语 `<AI Engineer />`——不是"忘了翻"而是
**换文案要重做排版**（三个 `<Text>` 的 `baseX` 按那 11 个拉丁字符的宽度逐个手调
过，相机靠近时会向两侧裂开）。理由写在 `KNOWN_LEAKS` 的 note 里。

对比度那张表**刻意留空而不是删掉**：它是机制的一部分。下一处低对比出现时
「没有新增」那条会直接红，而不是被悄悄加进一张有先例的表里。

数字只能往下：写点变少了要把数字改小（有一条断言专门管这个），否则棘轮留一截
空档，下一个人可以在不触发红灯的情况下加回去。文件级白名单的漏洞正是这个
——已在名单里的文件再加 20 个写点也是绿的。

**验收标准在 `__tests__/gateMutations.test.ts`**：那 20 个变异形态固化成清单，
每条标明当年是被杀还是存活。这份清单只能增不能删——删一条就是把一个已知的
绕过形态重新变成盲区。

**第四条门禁：状态机事件必须有运行时发送方**（`machineEventWiring.test.ts`）。
它不用那个 AST 扫描器（只需 `type: 'X'` 字面量），但属于同一类机制：
**「定义了」与「接上了」是两件事，而只有后者用户能感知到。**
接线 `room.machine` 时它抓出三个孤儿事件：`MOUNTED` 没人发（于是 8 秒加载超时
永远不启动）、`EXIT_DONE` 没人发（退场收尾复用了 `RESET`）、`BACK` 的 4 条边
与 `RESET` 逐字相同且无人发送（已删）。三者的机器测试、`@xstate/graph` 全路径
覆盖都是绿的，因为那些测试自己 `send()`。

**它自己也踩了一次同样的坑。** 第一版按文本匹配 `type:` 后跟大写串，于是
`DoorSection.tsx` 里一句解释旧实现的**注释**被当成了 `BACK` 的发送方——门禁绿着，
4 条死边照样在。改走 AST（`sourceScan.eventTypeLiterals`）之后才暴露，
理由与那三条门禁改用 AST 完全一样。变异形态记在 `gateMutations.test.ts` 的
`EVENT_WIRING_MUTATIONS`（W1–W3）。

**扫描器的已知边界**（写在这里以免被当成已覆盖）：别名只追一层；CSS module 里
的颜色与祖先节点的 `opacity` 看不到（`RoomLoadingIndicator` 的错误详情就落在
这个盲区，实算约 2.5 而门禁测得 0 条）；Tailwind 的透明度工具类看不到；
`app/` 下页面的文案与 `<head>` metadata 不在漏译门禁范围内。各条的理由写在
`labContrast.test.ts` 顶部与 `sourceScan.ts` 的文档注释里。

六条，改这块前先读：

1. **`entryPose` 是门坐标系**：原点在门平面、**+Z 指向门外**，所以房间内的
   一切都是负 z。房间自己的内容用「桌心坐标系」，两者差一个 `ROOM_ORIGIN_Z`
   （见 `domain/rooms/projects/scene.ts` 顶部）。混用这两个系就是审计 A4。
2. **位姿锚定在房间根上**：`enterRoom` 换算一次不够——门板与走廊段落在进房
   之后还会动，房间内容整体移动而相机留在旧世界坐标上。`followAnchor()`
   每帧按房间根矩阵的增量同步。
3. **所有权是显式的 `claim()` / `release()`，不是一个布尔**（ADR
   [20260903211244](../../docs/adr/20260903211244-lab-camera-owner-is-explicit-not-suspended-flag.md)）。
   `controls.update()` 每帧都把内部位姿写回相机（`enabled` 只关输入），所以导演
   默认不持有。第一版用 `suspended` 布尔加 `suspend()` / `resume()`，那让"此刻谁在
   写相机"成了隐式运行时状态，且**在非持有态调用动作方法不报错也不生效**——三条
   缺陷都出自这里：

   - `moveToWorld({duration:0})` 传送是**空操作**（`push()` 只写 controls 的内部
     球面坐标，位姿要等 `update()` 才应用）。**已修**：走廊传送改走
     `lib/lab/app/camera/corridorRail.ts` 的导轨命令，不经导演
   - 进房时导演与 `DoorSection` 的 gsap **同帧双写约 2 秒**（靠 rAF 注册顺序侥幸
     看起来正常，飞行动画被静默吞掉）。**已修**：房间等 `phase === 'entered'` 才
     `claim()`，两个写者前后相继
   - About 的 `setLean` 是**死代码**（`applyLean` 在持有检查之后，而 About 从不
     持有）。**未修**——见下方第 5 条

4. **两个持有者，不是一个。** 走廊是一维导轨（x/y 固定、z 随滚动），与
   `camera-controls` 的 orbit 模型是两种东西，`useCorridorCamera` 是它的持有者。
   关键在于同一时刻只有一个在写，由 `cameraDirector.owner` 与 `CameraRig` 的
   **开发态每帧断言**保证（持有期间相机被别人写过就抛）。那条断言比写点棘轮强：
   棘轮守的是"谁写了相机"这个静态事实，守不住"在错误的时刻写"。

5. **About / Contact 的房间级相机已接线**（审计 A1 / A3，2026-09-04）。此前它们的
   `RoomDefinition.entryPose` 是**声明了但没被消费**的数据——运行时只有 Projects 调
   `useRoomCamera`。表现：About 的天空平面（原 400×200，从门口看只覆盖 41.6°
   而相机水平半视角是 46°）四周露出走廊底色，即"蓝框"；Contact 那组数值从未被
   应用，接上时发现相机站在走廊墙里（root z = −5，pose z = +5.6 → 门系 +0.6）。
   两间房都用截图标定过取景；数值旁写了推导。门禁 `roomCameraWiring.test.ts`
   守住"声明了 entryPose 就得有人消费"，豁免（Publications 自有 gsap 相机、Gallery
   是路由）要写理由。
   **仍有一条已知不足**：About 的构图略偏右（约 12%），来源待查，不影响功能。
6. **不要用内部 `snapshot()` 断言相机行为**：传送失效那条就是这么漏过去的
   ——`snapshot()` 是导演**想要**的位姿，不是相机**实际**的位姿，而那个 bug 下两者
   恰好不一致。断言对象必须是 `camera.position`。

### 房间不得越过走廊墙面（DoorSection 的裁剪平面）

门段是一块"翻板"：相机靠近时整段绕外墙边缘朝你转最多 30°（`MAX_TILT`），进房
期间锁在最大角。房间是翻板的子节点——11 单位宽的 Projects 房间跟着转 30°，深棕
侧墙的一端就穿过静止的走廊墙，立在走廊里（进房 / 退房期间门旁那块竖直深色板，
2026-09-04 实机抓到）。

**不能把翻板扳直**：相机对齐（`DOOR_LOOK_ANGLE` = 90° − 30°）与进房飞行（沿相机
朝向推进）都建立在倾斜的门面上。修法是**裁剪**：`DoorSection` 每帧从外层 group 的
世界矩阵算出走廊墙平面，挂到房间全部材质的 `clippingPlanes` 上；`LabScene` 的
Canvas 开了 `localClippingEnabled`。`ShaderMaterial` 若没声明 `clipping: true`
会被跳过（硬塞进去是黑屏而不是裁剪）。

### 入口页的两条路径

手机端（`pointer: coarse` **且**宽度 ≤ 768）不挂 Canvas：`EntryStage` 渲染
54 KB 的静态首帧，点了播 CSS 开门动画再跳 `/lab`。实测手机端下载量
3871 → 856 KB。桌面端不变（canvas 在 592ms 就出现，多一张占位图不值）。

两个条件都要：只看宽度会让拖窄的桌面窗口掉进静态路径，只看 pointer 会让
iPad 横屏掉进去。**Lab 本身仍是完整的 3D，没有砍任何东西**——降级的只是
"预览那扇门"。

静态首帧是生成物（`scripts/media/entry-firstframe.mjs`，需要已构建的
`out/`）。它不存在时手机端是一块空白，而那条路径在桌面开发时看不到，
所以 CI 会 `--check`。

### ESC 的优先级

ESC 已绑定「退出房间」。房间内的细节视图（Projects 的停靠）用
`lib/lab/app/escapeStack` 认领它——栈顶（最内层）先消费。自己挂 window
监听会让两者同时触发，房间退场把收回打断。

### 语言：一份偏好，三处按钮

语言存在 `localStorage.resume-locale`，全站共享；默认 `en`，hydration 之后才读
storage（SSR 与首屏必须一致）。**语言在门户定，进 Lab / Classic 都沿用**——门户
（`/`，左 Lab 右 Classic 那一屏）是全站唯一的入口，2026-09-04 之前它只读语言、没有
切换入口，用户得先进 Classic 再在 Navbar 里切。

三处按钮，**逻辑只有一份**：都调 `useLocale().toggle`，文字都来自
`lib/content/localeToggle.ts` 的 `nextLocaleLabel`（显示**目标**语言的名字、用目标
语言写，英文界面上是「中文」）。

| 位置 | 组件 | testid |
|------|------|--------|
| 门户 `/` 右上角 | `components/entry/EntryLocaleToggle`（包一层固定定位的 `LocaleToggle`） | `locale-toggle` |
| Classic 的 Navbar | `components/ui/LocaleToggle` | `locale-toggle` |
| Lab 顶栏 | `NavigationUI` 第五个 `NavButton` | `nav-locale` |

门户那个带 `data-entry-locale-toggle`：`scripts/media/entry-firstframe.mjs` 截 `/` 的
首帧当手机端占位图，靠这个属性把按钮藏掉（同 `data-explorer-bar`），否则它会被烤进
静态图里，而那张图桌面开发时看不到。

按钮的可见文字与 aria-label 都随语言变，**测试只能按 `data-testid` 定位**。

**加载态**：`ssr: false` 的 dynamic import **必须**配 `loading`。缺它时 chunk 到位前整页只剩背景色；而路由级导航还要额外的 `loading.tsx`——两个时机不同，只补一个仍会白屏。

## 滚动卡顿的两个来源（2026-09-04 采样定位）

滚过第 1/2 段交界时 CPU 采样到两个 >1.2 秒的长任务，0 次着色器编译、0 次网络：

1. **壁画是 `public/gallery/` 的原图**（1703×1280 JPEG，单张最大 959 KB），每挂一段
   走廊就整批解码 + 上传。`AdaptiveMuralFrame` 原先在 `useEffect` 里对 drei 缓存的
   纹理 `needsUpdate = true`，让**已在显存里的图再传一遍**——7.5 秒滚动里 54 次大
   纹理上传、3.2 秒。现在参数在 `useTexture` 的加载回调里配一次。上传 109 → 14 次。
   **仍未做**：壁画只需要 ~1.6 世界单位宽，用原图是浪费；应走 `scripts/media/`
   出一份 768px 的壁画专用 webp。
2. **成就气泡的 `TICK`（100ms）让所有 `useAchievements()` 订阅者重渲染**——15 个
   `DoorSection` 每秒渲染 10 次。现在只用动作的组件改走 `useAchievementActions()`
   （value 永不变化）。测试里 mock 这个 context 时两个 hook 都要给。

长任务峰值 1454ms → 281ms；剩下的是段落挂载本身的 React 成本。

## GSAP：谁创建，谁撤销，且只撤销自己的（ADR 20260907120701）

Classic 页的滚动显形在「详情页 → 返回简历（客户端导航 + hash）→ 上滚」这条路上把卡片
留在 3%–83% 透明度（2026-09-07 实机；dev 必现，线上不出现）。三件事叠加：
`ClassicPage` 与 `SmoothScrollProvider` 都在 cleanup 里 `ScrollTrigger.getAll().forEach(t => t.kill())`
——不分归属、连带杀播放中的 tween；StrictMode 双跑 effect 把第一次的 tween 杀在半路；
第二次注册用 `gsap.from`（终点 = 元素**当前值**）把残值当了终点。

规则与机制：

- **一切创建物在 `gsap.context()` 里，cleanup 只 `ctx.revert()`。** `getAll()` 全仓零调用，
  AST 门禁 `noGlobalScrollTriggerKill.test.ts` 守着（`getAll()` 唯一合理用途是读，仓库里没有）。
- **显形声明是数据**：`lib/animations/revealSpecs.ts`（纯数据，E2E 也 import）。运行时
  `scrollReveal.ts` 用 `fromTo`（终点是常量 `REVEAL_END`，不读 DOM）+ `clearProps`；
  带 hash 进入时已在 end 之后的触发器在 `onEnter` 里快进到终点（必须在回调里做：
  `once: true` 的触发器在同一次 update 就自杀）；`prefers-reduced-motion` 下不注册。
- **每条声明的 `targets` / `trigger` 必须匹配到元素**（`scrollReveal.test.tsx`）。前身有三条
  是死的（`#about .edu-card`、`#contact .contact-item`）——教育卡翻转、联系区渐入从来没跑过，
  线上每次进 Classic 打 3 条 gsap 空目标警告。
- **平滑滚动只有 Lenis 一个主人**：`html` 是 `scroll-behavior: auto`，程序化滚动一律
  `behavior: 'instant'` 或 `lenis.scrollTo`。此前 `scroll-behavior: smooth` 让 hash 跳转变成原生
  动画、被 Lenis 掐断在半路——`/classic/#publications` 生产停在 scrollY 30（线上也在），
  旧的 `gsap.from` 不动未触发的元素所以看不出。Lenis 官方基础 CSS 现在在 `layout.tsx` 引入。
- **滚动倾斜（`[data-skew]`）是 Lenis 状态的纯函数，每帧派生**（`lib/animations/scrollSkew.ts`）：
  只在 `isScrolling === 'smooth'` 时非零、夹在 ±8°，Lenis 一停自然归零。前身在 `scroll`
  事件里 `gsap.to(skewY: velocity * 0.35)`：详情返回的 hash 跳转那一帧速度极大，项目卡被推到
  skewY ≈ 88° 后**再没有事件把它拉回**（dev 必现）。事件驱动的值停下就冻住，这是结构问题。
- **E2E 走全部进入路径**（`classicReveal.spec.ts`）：此前只从顶部进过 `/classic/`。
  hash 用例必须断言目标**落在视口顶部**——只断言"在 DOM 里"时跳转没发生也是绿的。
  **断言要量几何，不只量 opacity**：那次 88° 的倾斜下 opacity 是 1，只看透明度全绿。
  `expectAllRevealed` 同时断言 computed transform 恒等。

两条测试都做过变异验证：塞回一个 `getAll()` 门禁红；把 `revert` 换成 `kill`，
StrictMode 残值那条红。

## 走廊世界状态：一个量一个来源、一个写者（ADR 20260908172231）

走廊要加的东西（活物、时间线墙、招聘官路线、墨迹记忆、三扇窗、第二圈变化…）
读的是同一组量：导轨在哪、多快、加载到哪、去过哪、第几圈、要不要减少动效。
它们现在住在一处：

| 层 | 文件 | 职责 |
|----|------|------|
| domain | `lib/lab/domain/corridor/world.ts` | 形状 + 纯派生（`lapAt` / `smoothVelocity` / `motionOf` / `nearestDoorAhead` / `visitedNow`） |
| domain | `lib/lab/domain/corridor/landmarks.ts` | **一切有位置的东西**的一张表（门 / 家具 / 欢迎区 / 彩蛋 / 段末门 / 三扇窗 / 年份刻度 / 猫的驻点）。窗与刻度由 `layout.ts` 的 `CORRIDOR_WINDOWS` 与 `timeline.ts` 的 `placeYearMarks()` **派生**填入，不手写坐标；壁画避让 `muralKeepOuts()` 全部从这张表来（手写对照表已删） |
| domain | `lib/lab/domain/corridor/ink.ts` | 显形策略（稳态 `max(记忆, 圈数, 悬停)`；过场 `loadIntroInk` + `introDrawLevel`，由 LabLoader 经 `loadProgress` 驱动门的 `uDraw`） |
| domain | `lib/lab/domain/corridor/timeline.ts` / `worldClock.ts` | 时间线映射（第 0 段 −6 → −90 铺 2017 → 2026）与刻度 / 便签的避让落点；三扇窗的当地时刻与天色（纯函数、注入 `now`） |
| domain | `lib/lab/domain/corridor/dog.ts` / `companion.ts` / `speech.ts` / `footsteps.ts` / `tour.ts` | 狗的八态 reducer；猫的三态滞回；气泡互斥 / 冷却 / 优先级；按位移计步；招聘官路线的停靠表与计划 |
| domain | `lib/lab/domain/machines/corridor.machine.ts` | 走廊模式（`free / touring / teleporting / inRoom`）的唯一来源；`SceneContext` 的传送字段全部由它派生 |
| app | `lib/lab/app/stores/corridorStore.ts` | 运行时持有者（zustand）。每帧量在模块级对象里，离散量走 selector |
| app | `lib/lab/app/motion.ts` | `prefers-reduced-motion` 的唯一入口 |
| app | `lib/lab/app/memory.ts` | `visited` / `inked` 持久化，带版本号 |
| app | `lib/lab/app/stores/speechStore.ts` | 气泡的持有者（规则在 domain）；`bubble_pop` 在这里响 |
| app | `lib/lab/app/camera/corridorRail.ts` | 导轨命令面：`jumpTo` / `scrollTo` / `hold` / `release`（实现在 `useCorridorCamera` 内，不产生第二个相机写点） |
| hooks | `hooks/useTour.ts` | 招聘官路线控制器：互斥归状态机、运动归导轨、内容归 domain，它只按计划调命令 |

**四条硬规则**：

1. **`setRail` 只有 `hooks/useCorridorCamera.ts` 能调**（门禁 `railWriter.test.ts`，无棘轮）。
   两个写者会让"玩家在哪、多快"有两个答案，而哪个生效取决于 `useFrame` 的注册顺序。
   读取用 `getRail()` / `getWorld()`（每帧、不订阅）或 `useCorridorStore(selector)`（离散量）。
2. **store 不写相机。** 它是导轨状态的镜像；相机所有权（ADR 20260903211244）不变，
   写点棘轮不动。
3. **每帧量不进 zustand。** `rail` 住模块级可变对象——60fps 的 `set` 会遍历所有
   listener 比较 selector，即使没人订阅也是每秒 60 次无用功；一旦有人订阅就是每帧
   全树重渲染（成就 `TICK` 让 15 个 `DoorSection` 每秒渲染 10 次那次事故的形态）。
   `lap` / `visited` 由 `setRail` 派生，**只在真的变化时**才 `set`。
4. **声明必须有生产消费者**（门禁 `corridorLandmarks.test.ts` 的「接线检查」）。
   `CorridorSegment` 改为遍历地标渲染之后，做变异测试时用 `git checkout` 还原文件
   把那次重构**一起还原了**，随后 `git add -A` 提交了旧版 —— 地标表定义完整、
   schema 与等价性断言全绿、巡检截图正常（旧版渲染出的画面一样），而
   `landmarksInSegment` 在生产代码里零引用。这正是 ADR 20260903211338 要防的
   「已定义、未接线」，现在由断言守着。
5. **记忆从 localStorage 恢复必须显式、且在客户端 effect 里**（`hydrateCorridorMemory`，
   `LabScene` 挂载时调）。store 初值不读 storage：回访者盘上有记忆而服务端没有，
   那正是 hydration 不匹配——`LocaleProvider` 当年因此把读 storage 推迟到 `useEffect`。
   落盘一律走 `mergeCorridorMemory`（与盘上取并集），**不要用 `saveCorridorMemory` 覆盖**：
   hydrate 之前内存是空的，覆盖式写入会把盘上已有的记忆擦成空（实现时实测过）。

**动效开关的语义**：唯一读法是 `useMotionScale()`（`hooks/useMotionScale.ts`）。
为 0 时停掉**由时间驱动**的自发运动（涂鸦漂浮、虫子游走、头像逐帧、标题字母漂浮、
云漂移、桶浮动、海浪与船、机柜 LED 呼吸、纸材质 shader 的 uTime、论文卡风摆），
保留**由用户动作驱动**的响应（hover 上色、相机侧瞄、点击反馈、相机距离触发的裂开、
猫的瞳孔跟随）。

三条实现细则：

- **能乘就乘**（`* motion`）：比 `if (reduced) return` 少一类"忘了处理 reduced 分支"
  的 bug，也天然保证停下来时回到**基准姿态**而不是停在半空中。
- **乘不掉的用分支，且冻结在一个好看的值上**：机柜 LED 的 opacity 归零会让整排灯
  全暗、看起来是机柜坏了，所以冻在呼吸区间的中点 0.68。
- **几何同步不是动画**：`PublicationCard` 把文字贴到纸在 shader 里的形变表面上，
  它的 `time` 必须与 `PaperMaterial` 的 `uTime` 取同一个值（reduced 时都是 0），
  否则纸停了而文字还在按流动的时间贴合，两者错位。

门禁 `motionConsumers.test.ts` 守「每个时间驱动的 `useFrame` 都读过开关」，走廊层
与房间层现在都是**零例外**（`ROOM_LEVEL_PENDING` 已清空，只能变短）。

**走廊的活物**（ADR 20260908160918）：一只猫（`ResidentCat`，走廊尽头驻守）和一只狗
（`GuideDog`，跟着玩家跨段跑，由 `LabScene` 全局挂载，**不在地标表里**——地标表的 schema
要求段内位置，一只会动的狗没有；成就用 `corridor-companion` trigger 引用）。狗的素材是仓库内
手写 SVG（`media-src/textures/companion/`），`scripts/media/companion-parts.mjs` 逐组栅格化并
校验枢轴。来自实测的硬约束：

- **活物驻点距同侧门必须 > 15 单位**（门禁 `corridorLandmarks.test.ts`）。猫原本
  坐在柜顶（−49）守着相框，而 Gallery 门在 −44 —— 相机走到能看见柜子的距离时，
  门段的翻板已经绕外墙转了 30°（`TILT_START` = 15）把它整个遮住。走廊里三件家具
  距最近同侧门都只有 5–7 单位，所以"活物坐在家具上"这条路在当前布局下都走不通。
  猫改到走廊尽头（−68）、侧道 x = 1.9、坐地板。
- **必须有接触阴影**。白色线稿的活物贴在白地板上像一张贴纸（HN 对 "My Room in 3D"
  的批评：椅子会动而阴影不动）。走廊全是 `meshBasicMaterial`，阴影只能手画一块
  压扁的淡色椭圆。
- 状态写到 `html[data-lab-cat]` / `html[data-lab-dog]`：3D 物件不在 DOM 里，没有它就无法断言
  "靠近会醒"。同 `data-reveal-arrival` 的先例。**每帧与 DOM 上的当前值比对再写**，不要记
  "上次写过什么"：Suspense 在邻居加载时会把子树隐藏再显示，cleanup 跑过一次属性就没了，
  而 ref 还在——狗第一版就这么丢过。
- **狗不换道**。规格初稿要它走下一扇门的对侧、在相机后方换道；门每 12 单位左右交替，
  狗就每过一扇门消失两秒。几何上侧道 x = 1.4 离墙上的门够远、翻板转 30° 也挡不到，
  换道解决的是不存在的问题。登场选一次道，之后不换（`dog.ts` 文件头）。
- **脚底偏移的符号**：画稿里脚底在画布中心下方，所以画布中心要放在 `FLOOR_Y` **上方**
  `(FOOT_V − 0.5) × 边长`。第一版写成减号，狗整个埋在地板下面，三张巡检截图里一只都没有——
  「状态机在跑、DOM 属性在变、画面里没有」这种组合，先查 y。

**加载期的"画出来"（决定 D，按实测修订）**：走廊整个在一个 Suspense 边界里，墙 / 地板 / 门
等最后一张纹理到位才一起出现——限速到 2 Mbps 实测，"30% 提前撕开"撕开后是一片空白。
所以撕开仍在完成时，`RevealMaterial` 的 `uDraw`（透明 → 线稿）与撕纸同步把五扇门画出来
（1.8 s），加载期 `rail.hold('loader')`：这张纸 `pointerEvents: none`，滚轮原本能穿过去把
走廊滚跑。要真做到"边加载边画"得把 Suspense 边界拆到每个物件，那是另一次架构改动。

**显形（墨迹）**：`RevealMaterial` 的 `uProgress` 有四个来源，而 uniform 只有一个，
所以它是一条策略而不是三处各写。稳态 = `max(记忆, 圈数, 悬停)`；**加载显形不在
稳态里**——加载进度在加载完成后恒为 1，并进 `max` 会让所有门永久上色，「只有看过的
才上色」直接失效（ADR 的索引已就此追加修订注记）。门的基线变化时只"推不拉"
（`uProgress < baseInk` 才写），否则会打断正在进行的 hover 动画。

## `next dev` 跑着的时候不要 `pnpm build`（栽过）

两者共用 `.next/`。`next build` 会覆盖 dev server 的产物，dev 之后发出的 HTML 引用的
`layout.css` / `main-app.js` / `app-pages-internals.js` 已经不存在 → 全部 404，页面变成
**没有任何 CSS 的裸 HTML**：图片按原始像素堆、横向溢出到 3000px、导航散成一行链接。
换 `?v=` 重新加载也救不回来，只能重启 dev（`rm -rf .next` 后再起）。

2026-09-06 实机就是这样：一边跑 E2E 前的 `pnpm build`，一边用户在 dev 上打开
`/classic/credentials/`，看到一页「大 bug」——而那页在 `out/` 里完全正常。
**要 build 就先停 dev**；或者反过来，验收视觉时只看 dev，不在同一时间 build。

## 测试环境的两个坑（都栽过）

**1. 渲染任何读 locale 的组件必须包 `LocaleProvider`。**

`LocaleContext` 的默认值是一个**访问即抛异常**的对象（`components/providers/LocaleProvider.tsx` 的 `throwingDefault`），设计意图是让"忘了包 Provider"立刻失败而不是静默拿到错误语言。代价是测试里直接 `render(<组件 />)` 会炸。写法：

```tsx
import { LocaleProvider } from '@/components/providers/LocaleProvider'

render(<PublicationCard {...props} />, { wrapper: LocaleProvider })
// rerender 会自动继承 wrapper，不用重复传
```

`publicationCard.test.tsx` 与 `projectsRoomCamera.test.tsx` 曾因缺这个 wrapper 共 16 个测试全红。

**2. `localStorage` 在本项目的测试环境需要 stub，已在 `vitest.setup.ts` 处理。**

Node 25 内置了一个实验性 `localStorage` 全局，未带 `--localstorage-file` 启动时一经访问就抛 `SecurityError`，且它盖过了 vitest jsdom 环境提供的实现。`LocaleProvider` 的 `useEffect` 读 `resume-locale` 正好命中。`vitest.setup.ts` 装了内存实现顶掉它——**不要删那段**，删了所有碰 storage 的组件测试会一起红。

这两条合起来是同一个教训：**CI 从不跑测试期间，main 分支的 16 个失败一直没人发现**。现在 `ci.yml` 会跑，保持它绿。

## E2E（Playwright）

`e2e/` 下 188 个用例（94 条 spec × chromium / mobile-safari 两个形态），分三个文件：

| 文件 | 覆盖 |
|------|------|
| `staticExport.spec.ts` | 静态导出的产物形态：路由可达性、`trailingSlash` 的目录结构、主题与语言的持久化、门户页语言切换 |
| `lab.spec.ts` | Lab 的**行为**：进房 / 退房 / 传送 / ESC / 面板 / 教程 / 语言切换 / 首访 / 无 JS 兜底 / 走廊世界状态（动效开关取值、墨迹记忆跨刷新） |
| `classicReveal.spec.ts` | Classic 滚动显形的**全部进入路径**：四个 hash 直达、详情 → 返回 → 上滚（原始事故路径）、浏览器后退、切语言、reduced-motion、顶部滚到底。断言对象是每个显形目标的 computed opacity，选择器从 `lib/animations/revealSpecs.ts` 导入 |

`lab.spec.ts` 是 ADR
[20260903211338](../../docs/adr/20260903211338-finish-wiring-lab-registry-and-machines.md)
要求的安全网——它之前 `/lab` 只断言了返回 200。写这一批时踩到的五件事，改它之前先读：

1. **`fullyParallel` 对 Lab 不成立。** 每条用例都要起一个 WebGL 上下文并加载
   1.5MB 资源，而 headless 是 SwiftShader 软渲染；并行跑会互相饿死，表现为一批
   用例集体超时在「点不到按钮」上（单独跑每条都过）。该文件用
   `test.describe.configure({ mode: 'default', timeout: 120_000 })`：单 worker 顺序跑，
   且放宽用例超时（最慢那条实测 29 秒，贴着默认的 30 秒）。用 `default` 而不是
   `serial`，因为 serial 下一条失败会跳过后面全部，而这里有刻意的预期失败用例。
2. **选择器只能用 `data-testid`。** aria-label 全是本地化的（`LocaleToggle` 那次
   三个 E2E 一起红就是这个原因）；门是 R3F 的 mesh，根本不在 DOM 里，所以
   「点门进房」走地图面板的传送按钮代替。Lab 的状态从 `[data-testid=lab-ui]` 上的
   `data-lab-room` / `data-lab-in-room` / `data-lab-teleporting` /
   `data-lab-phase`（房间状态机的相位）/ `data-lab-teleport-phase`（纸动画相位）读。
   后两个是诊断「传送卡住」时唯一能分辨卡在哪一步的信息——`test.fail` 那条
   「返回走廊后还能再进房」的根因就是靠它们从"编排器 ref 记账"纠正到
   "drei 缓存了被拒绝的 promise"的。
3. **首访的操作说明是 `inset: 0` 的遮罩，会拦下所有点击。** 不要去猜它什么时候
   出现（时机是「加载进度稳定 600ms」再加 2.4 秒，软渲染下不确定）——在
   `addInitScript` 里把 `lab_tutorial_seen` 置上，以回访用户身份进场；首访那条
   路径本身另有一条专门用例。
4. **ESC 处理器都在 `useEffect` 里，而 `useEffect` 在绘制之后才跑。** 元素可见 ≠
   监听已挂上，直接按一次 ESC 会间歇性失败。用 `pressEscapeUntil()`（内部是
   `expect().toPass()` 重试），不要用 `waitForTimeout` 猜延迟。
5. **退房要 2–3 秒**（两段各 1 秒的 gsap 加关门）。断言「没有退房」必须先等，
   否则查得太早会假绿——「ESC 关面板不该连带退房」那条第一版就是这么"通过"的。

6. **运行时断言在 E2E 里是开着的，且任何 `pageerror` 都算失败。** 静态导出永远是
   production，`CameraRig` 的相机所有权断言原先只看 `NODE_ENV`，于是 122 个用例
   一次都没执行过它——首帧假阳性（`take()` 没记基线）在全绿的情况下漏到实机，
   进 Projects 每帧抛、交互全死（2026-09-04）。现在 `openLab()` 通过
   `localStorage.lab_asserts` 打开断言（`lib/lab/app/labAsserts.ts`），
   `beforeEach/afterEach` 夹具收集 `pageerror` 并要求为空。

**E2E 看不见画面。** 2026-09-04 实机验收抓到的四个缺陷里三个是纯视觉的（About
的蓝框、Projects 门口的深棕色块、滚动卡顿），`data-*` 属性断言对它们全部失明。
排查时用的是 Playwright 截图 + CDP CPU 采样 + WebGL 调用打桩（脚本形态见 PR #21
说明）。**改 Lab 的视觉或性能之前，先跑一遍这种带截图的复现，再看 E2E。**

**两边都有现成工具了**（`scripts/qa/AGENTS.md`）：
`node scripts/qa/walkthrough.mjs` 走 Classic（门户 → 三种详情页 → 返回 → 上下滚）；
`node scripts/qa/lab-walkthrough.mjs` 走 Lab（走廊 8 屏 → 地图 → 四个房间进出 → 地图 →
刷新回访），加 `REDUCED=1` 再跑一遍对比动效开关。都是每步一张整屏。

**验证"动画停了"不要用整幅截图比较**（实测踩过两次）：整幅截图包含 DOM 覆盖层
（教程气泡、成就倒计时条）的动画，只截 3D 区域又会被相机插值的长尾干扰——两次都会
把"还在收敛"误判成"动画没停"。3D 物体的 transform 不在 DOM 里，所以先看
`data-lab-motion` 这个诊断属性（E2E 断言它），再用巡检截图看画面。
2026-09-07 滚动显形那次，E2E 与复现脚本全绿，截图里卡片半透明、hash 落在半路、卡片扭成
88°——都是看一眼就能发现的。改了视觉，**提 PR 前跑一遍并逐张看完**；断言守已知的坏法，
巡检抓没想到的坏法。

**已知缺陷用 `test.fail()` / `test.fixme()` 固化，不用 TODO 注释。**
`test.fail()` 在缺陷修好时会报错，强迫人回来把标记去掉；TODO 不会提醒任何人。
依平台而异的竞态用 `fixme`——`fail` 会在「碰巧通过」的那个形态上报
"Expected to fail, but passed"，把真实缺陷变成 CI 噪声。当前固化的三条：
房间内 ESC 连带退房、退房后教程气泡残留、地图开着时点不到别的导航按钮
（面板盖住整排按钮）。

**打在静态产物 `out/` 上，不打 `next dev`。** 这是刻意的：生产由 nginx 直接提供 `out/`，而 `next dev` 有 HMR、按需编译、不同的路由解析——测它测不到真实部署形态，尤其是 `trailingSlash: true` 的 `dir/index.html` 结构（`next.config.js` 的注释记着一次真实故障：`/gallery` 直接访问返回 403）。

`e2e/staticServer.mjs` 是手写的极简静态服务器，**刻意不做 SPA fallback**——找不到就 404。现成 dev server 的自动兜底会把"页面根本没导出"掩盖成"页面正常"。

```bash
pnpm build               # 必须先构建，E2E 打的是产物
pnpm test:e2e            # 全部形态
pnpm test:e2e --project=chromium   # 只跑一个形态
pnpm test:e2e:ui         # 带 UI 调试
pnpm exec playwright install chromium webkit   # 首次需装浏览器
```

写 E2E 时的两条经验（都踩过）：

- **选择器用 `aria-label` 等可访问性属性**，别用 class。本项目 class 是 Tailwind 生成的长串，一改样式就断。
- **断言要基于真实机制，别照直觉猜**。主题不是改 `body` 的 backgroundColor（那是透明的），而是 `<html data-theme>`；且深色是"属性缺失"而非 `data-theme="dark"`——详见 `e2e/staticExport.spec.ts` 主题那一节的注释。

## 屏角挂件：先登记，再用 `<EdgeItem>`，别自己写 `position: fixed`

ADR 20260909182319。**唯一有权写 `fixed` / `sticky` 的文件是
`components/layout/EdgeLayer.tsx`**，由 `__tests__/overlayOwnership.test.ts` 守着
（棘轮，数字只能往下）。

要加一个钉在屏幕角上的东西，两步：

1. 在 `lib/layout/overlays.ts` 的 `OVERLAY_REGISTRY` 登记
   （`slot` / `layer` / `presence` / `order` / `interactive`）
2. 用 `<EdgeItem id="...">` 包起来，放进页面的 `<EdgeLayerRoot>` 里

### 为什么不能自己写坐标

屏幕的四个角是**共享资源**。此前全站 15 处 `position: fixed` 各自写坐标与 z
（15 个互不共享的数），撞不撞取决于内容宽度——2026-09-09 审计实测出四处真实重叠，
其中一处**在桌面上**：入口页的域名水印与底部提示条逐字同坐标、z 差 70，
水印 100% 被盖住，从那条提示上线那天起没人见过。

而这个仓库已经为同一个抽象缺失付过一次钱：`globals.css` 里
`.achievement-popup { bottom: 88px }` 的注释写着
`88 = 32（提示的底距）+ 提示自身高度（约 20）+ 一段间距`——**一个组件手算另一个
组件的高度**。被算的那个改一行字，这个数就悄悄错了，而没有任何东西会报警。

同槽位的挂件是同一个 flex 容器的**兄弟**（不是各自绝对定位），所以同槽位内
几何上不可能重叠。

### 但**跨槽位**照样会撞——`top-bar` 就是为此存在的

「是 flex 兄弟所以不重叠」**只对同一个槽位成立**。Lab 顶栏原先是 `top-left` 的
`← Exit Lab`（20→104）与 `top-right` 的六个图标（24→304），两个不同的槽位，
互相不知道对方多宽，320px 上实测重叠 80px。声明表只统一了坐标来源，没让它们
互相知情。

所以有 `top-bar` 这个 `col: 'stretch'` 的贯通槽位：整行两端钉住、`space-between`
分列两端，两组挂件才真的成为兄弟。**要一行里放两组东西，用它，不要用 top-left
+ top-right。**

而收编本身修不了那 80px：六个 44px 触摸目标加间距是 304px，加退出的 84px
是 388 > 320——**根因是放不下**，收进同槽位只把「重叠」变成「挤压」。
所以窄屏折成三个（路线 + 地图 + 更多）与放大触摸目标是**同一件事的两半，
不能分批做**：只放大不折叠，一排按钮就吃掉整个视口。

### 挂件不许自己再写偏移，包括 CSS 里的

收编 `AchievementPopup` 时我把 `globals.css` 的 `position: fixed; bottom: 88px`
换成了 `position: relative`，但**漏了同一文件里 `@media (max-width: 768px)`
下的第二条 `bottom: 24px`**。`relative` 配 `bottom` 会把元素**往上顶**：320px 上
气泡从 553 挪到 529，正好 100% 压住 530–545 的滚动提示——和收编前一模一样的
缺陷，只是换了实现路径。桌面上量到「不重叠」、窄屏上量到「100% 重叠」，
差的就是那一行。**分档量，别只看桌面截图。**

### 测试里渲染含屏角挂件的组件要用 `LabUiWrapper`

`EdgeItem` 是 portal，容器由 `EdgeLayerRoot` 提供；**没有它时 `EdgeItem` 返回
`null`**，于是退出链接、图标排、房间内返回在测试里根本不渲染，而报错是
`getByTestId('nav-back')` 找不到元素，看不出真实原因（收编 Lab 顶栏时三个测试
文件共 12 条一起红）。用 `__tests__/helpers/labUiWrapper.tsx` 的 `LabUiWrapper`
（它同时包了 `LocaleProvider`）。

**只渲染单个非挂件组件的用例不要包**——`EdgeLayerRoot` 会往容器里放九个空的
槽位容器，`toBeEmptyDOMElement()` 必红。

不让 `EdgeItem` 在缺容器时「就地渲染」降级，是因为那样忘了放 `EdgeLayerRoot`
的页面会静默退回收编前的样子（各自定位、互相压住），**而没有任何测试会红**。
形态与理由同 `LocaleProvider` 的 `throwingDefault`。

### E2E：窄屏折叠后不要给窄屏加 skip

`nav-audio` / `nav-achievements` / `nav-help` / `nav-locale` 在 <768 折进「更多」
面板。`e2e/lab.spec.ts` 的 `navItem()` 助手两种形态都能拿到（直接按钮或面板里的
行），每次返回**新的** locator——点了面板里的行之后面板会 `closeAll()`，
缓存的 locator 立刻失效。

**但测「此刻能不能点到」的用例不能用那个助手**：它在按钮不存在时会先真的点一下
「更多」，而那一下会关掉地图面板，把被测条件本身改掉。实测后果是那条
`test.fail()` 从「预期失败」变成「意外通过」，而 `elementFromPoint` 证明缺陷仍在
（390px 上那个位置命中的是 `map-close`）。**用例形态变了要重新量，
不能因为它变绿就当成修好了。**

### Classic 顶栏：窄屏走汉堡菜单，不是「藏起来」

`components/layout/Navbar.tsx`。改动前那 9 个导航入口（8 个锚点 + Gallery）
是 `hidden md:flex`——**藏起来了而没有替代入口**，而 `/classic/` 在 390px 上
高 18056px，用户只能一路滑。

这类缺陷值得单独记一条，因为它的症状与「布局错乱」不同：**元素还在 DOM 里**
（只是 `display: none`），所以按 `getByText` 断言「链接存在」会全绿，
截图上也看不出「少了什么」——你得知道宽屏有什么才能发现窄屏少了什么。

- 菜单面板放在 `<nav>` **里面**，不是第二个 `fixed` 元素：顶栏自己已经
  `fixed top-0 w-full`，面板作为它的块级子元素天然跟着钉住，不需要再写一处坐标
- 面板背景**不透明**（`var(--bg-base)`），不跟顶栏那层 80% + blur：
  9 行、近半屏高的面板，半透明下文字对比度取决于背后正好是什么。
  这个组件已因背景写死栽过一次（审计 E2），所以用主题变量而不是具体颜色
- ESC 与**滚动**都收起。不锁滚动是刻意的：锁了要动 Lenis（`lenis.stop()`），
  而这是下拉菜单不是模态
- ESC 不接 `lib/lab/app/escapeStack`——那个栈是 Lab 的，Classic 没有第二个
  ESC 消费者，引进去只是让 Classic 依赖 Lab 的运行时

**两层测试各守一半，缺任一层都会漏**：`__tests__/navbarMenu.test.tsx` 守结构与
行为（尤其那条**与宽屏那一排逐条对账**的断言——有人加第 10 个链接却忘了菜单
会红），但 jsdom 不算 CSS，`hidden md:flex` 在那里无效、两组都在 DOM 里；
「哪一档真的看得见、点得到」由 `e2e/staticExport.spec.ts` 在 390px 量渲染结果。

### 触摸目标 44 的适用范围（别把它套到桌面文字链接上）

- **控件**（按钮）两档都要 ≥44
- **窄屏菜单里的行**要 ≥44
- **宽屏平铺的文字链接豁免**：实测高 20px，但它们在 hover 指针下。
  WCAG 2.5.8（AA，下限 24×24）对行内文字链接明确豁免，44 是 2.5.5（AAA）
  针对触摸的要求。把 44 套上去等于为一个不存在的问题重做桌面顶栏——
  我第一版没做这个区分，门禁于是在**桌面**上报出那 9 个链接，
  正是 `.claude/hooks/AGENTS.md` 说的那种会训练人加豁免的误报

**判据要量渲染结果，不要做源码棘轮**：小于 44 的形态在这个仓库有三种——
内联 `width: 40, height: 40`、只有 `padding: 4` 的关闭按钮（24×24）、
纯文字链接（高 18–20）。AST 只认第一种，另两种看不见，
于是门禁会在「已经全绿」的情况下漏掉真正咬人的那两种。

### 路线入口的引导

`components/lab/TourCoachMark.tsx` + `lib/lab/tourHintStorage.ts`
（规格 `lab-corridor-story.md` §5.2）。

- **不进屏角声明表**：它贴着按钮，那张表管「各占一个角」的挂件
- **不进教程队列**：那条路走过并被删掉过（挤掉了原有队列，有一条 E2E
  断言「关掉说明后教程数为 0」因此红过）
- **三角相对按钮居中，不写死偏移**：按钮宽度随视口变（窄屏 44、宽屏带文字 143）
- **绝对定位只给 `right` 时收缩宽度按包含块算**：包含块是 44px 的按钮包装层，
  气泡会被挤成 83×113 的细长条。要 `width: 'max-content'` + `maxWidth`
- **6 秒淡出在 E2E 里抓不稳**（软渲染下 Playwright 轮询被长任务饿死）：
  用 `lab_tour_hint_hold` 冻住，淡出时机归单测，渲染几何与命中判定归 E2E

`openLab()` 默认预置 `lab_tour_hinted`（`skipTourHint`）——不预置的话这条提示会
出现在每一条 Lab 用例里，而它 `pointerEvents: auto`、第一次任意 `pointerdown`
就收起。**别手搓 Lab 的打开等待**：`openLab` 会区分「没有 WebGL」与「还没加载完」，
手搓过一次，mobile-safari 上静默跳过、报告只显示 skipped。

### 三个容易踩的点

- **`interactive` 必须显式声明，不能从 `layer` 推断。** 我第一版让包装层无条件
  `pointerEvents: 'auto'`，把入口页那条自己写着 `none` 的提示盖掉了，于是它从
  「视觉遮挡但点得穿」变成**真的挡住主按钮**——实测点下去不跳转，比原样更糟。
  而按 `layer === 'hint'` 推断也会错：路线引导的 coach mark 就是一个**可点的提示**。
- **全屏覆盖层不进这张表**（`LabLoader` 9999 / `PaperTransition` 9998 /
  `LabTutorial` 200 / lightbox 与图片预览）。它们的语义是「盖住一切」而不是
  「占一个角」，重新定序会让画面出错，而 `lab.spec.ts` 那 61 条断言读的是
  `data-lab-*` 属性、**对 z 序完全失明**。ADR 明确划为第二期、不做。
- **视口判据用 `hooks/useViewport()`，不要自己调 `matchMedia`**
  （`__tests__/viewportReaders.test.ts` 棘轮）。返回的三个字段
  `isNarrow` / `isTouch` / `canHover` **不许压成一个布尔**——历史上已有两次回归：
  只看宽度会让拖窄的桌面窗口掉进手机静态图路径；只看 pointer 会让 iPad 横屏掉进去。
  `null` 是「还没判定」，调用方必须处理（否则手机上会闪一下桌面版）。

### 横向 flex 头部的收缩约束

与屏角无关，但同属这次审计修掉的一类（education 详情页标题被挤成 31px 宽、
字形越出自身盒 137px）：

- 刚性项必须有宽度上限。**横版图按宽度限制，不按高度**——
  `NUS SOC.png` 是 5.6:1，`h-12 w-auto` 下宽 269px，320px 视口内容宽 272，
  它一个人就吃光。视口越宽 logo 越宽、文字列越窄，所以 390px 比 320px 更糟。
- **`flex-wrap` 与 `min-w-0` 不得同时出现在同一容器**：`min-w-0` 把可缩项的
  min-content 贡献抹成 0，容器于是永远认为「一行放得下」，`flex-wrap` 永不触发。
- 需要「要么并排、要么换行」的多栏用 grid + 断点显式声明；中栏写
  `minmax(0,1fr)` 而不是 `1fr`（后者的 min 是 `auto`，长单词会撑破网格）。
- 判断溢出**不要只看 `documentElement.scrollWidth`**。它在被 `overflow` 裁掉时
  仍等于视口宽——我就是这样漏掉了「日期行冲出右边缘」那一处，只有整页截图
  （宽 557 CSS px > 390）才暴露。要逐元素查右边界，含 `Range.getClientRects()`
  的**字形**矩形：QS 卡与 h1 的**盒子并不相交**（ix = −16px），越界的是字形。

## 命令

```bash
pnpm dev:resume          # 从仓库根起（:3000）
cd apps/resume
pnpm test                # vitest run
pnpm type-check          # tsc --noEmit
pnpm build               # 静态导出到 out/

# 素材流水线（改了 media-src/ 下的源才需要跑；--check 只报告）
node scripts/lab/gen-asset-manifest.mjs      # 纹理预载表（派生生成物）
#   ↑ 改过任何 useTexture / useLoader 的引用就要重跑：它按 import 可达性派生，
#     漏跑时本地一切正常、CI 的 resume 步骤直接红（栽过：CorridorWindow 复活后漏了窗框纹理）
node scripts/media/encode-audio.mjs          # 音频重编码
node scripts/media/gallery-door.mjs          # Gallery 门贴纸
node scripts/media/optimize-textures.mjs     # 入口页纹理
node scripts/media/optimize-credentials.mjs  # 荣誉与证书页图片（原图 7 MB → webp）
python3 scripts/media/subset-fonts.py        # 字体子集 + woff2
pnpm build && node scripts/media/entry-firstframe.mjs   # 手机端入口的静态首帧

# 验收（给人看，不断言）：像用户一样走一遍，每步一张截图，然后逐张看
node scripts/qa/walkthrough.mjs                # Classic → .qa/walk
node scripts/qa/lab-walkthrough.mjs            # Lab → .qa/lab
REDUCED=1 node scripts/qa/lab-walkthrough.mjs  # Lab，模拟"减少动效"（对比用）
```

> `entry-firstframe.mjs` 需要**已构建的 `out/`** ——它是截图，构图来自 3D
> 场景，拼贴拼不出同一个画面。

> **写下一个此前没出现过的字符（含代码注释里的）之后，指纹就过期了。**
> 子集脚本扫 `app/components/lib/hooks/context` 下所有 `.ts/.tsx/.css`，把**出现过的
> 字符集合**求指纹——所以常见汉字不会让它过期，**新字符会**。
> 曾经这里写的是「扫源码字节」，不准确：那会让人以为改任何一个字节都过期，
> 于是要么过度重跑、要么在「加了中文却没过期」时怀疑机制坏了。
>
> 现在由 **hook H5** 在 `git push` 时自动拦（`.claude/hooks/pre-stale-media.sh`），
> 不必靠人记。CI 的「校验字体子集」仍是最终防线。
> 历史：前人「同一天踩了三次」，2026-09-09 我又踩了第四次——跑过一次重新生成、
> 之后又写了几处中文注释、忘了再跑，CI 十分钟后红。**它必须是提交前的最后一步。**

> **界面字体（Space Grotesk / Inter / JetBrains Mono / Cormorant Garamond）不走上面的
> 子集流水线，也不用 `next/font/google`**——它们是 `@fontsource` npm 依赖，`app/layout.tsx`
> 经 `next/font/local` 引用包内 latin 子集 woff2（ADR 20260909163155）。别把 `next/font/google`
> 加回来：构建机在大陆，Google 不可达；曾经的 `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` mock 让
> 线上每个 woff2 都成了 89 字节的 URL 字符串，四款字体从未生效，而所有测试全绿。
> `e2e/staticExport.spec.ts` 现在断言产物里每个 woff2 以 `wOF2` 魔数开头——那是当时缺的那道门。

> `pnpm lint` **当前跑不起来**：`eslint.config.mjs` 按 flat config 写，但装的
> `eslint-config-next@15.5.20` 导出的是旧版 eslintrc 对象 → `nextVitals is not iterable`。
> 这是依赖版本不匹配，从未跑通过，CI 刻意不跑（见根 `CLAUDE.md`「已知负债」）。
> 要修先写 ADR：升 `eslint-config-next`，或把配置改回 eslintrc 形态。
