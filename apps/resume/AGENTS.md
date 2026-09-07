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
└── media/               # 四条素材流水线：音频 / 门贴纸 / 纹理 / 字体子集
                         # 都支持 --check，CI 会跑（见 media-src/AGENTS.md）
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
| [20260903140616](../../docs/adr/20260903140616-lab-xstate-and-zustand-replace-context.md) | 生命周期用 XState 状态图；共享状态用 zustand | **房间生命周期已接线**（`20260903211338`）：`SceneContext` 用 `useMachine(roomMachine)`，手写的 `roomLoadMachine.ts` + `doorEntryFlow.ts` 已删；8 秒超时是 `loading` 的一行 `after`（取代 `setTimeout` + 3 个互相看护的 ref），进房所有权从机器 context 派生，**审计 A8 的 `entered → failed` 边现在运行时真的存在**。`useDoorEntryOrchestrator` 从 5 个 effect / 4 个 ref 缩到 2 个 effect / 1 个 ref。`@xstate/graph` 已用于全路径覆盖（`roomMachineFlow.test.ts`）。<br>**仍未接线**：`corridor.machine` 运行时零引用（走廊传送仍是 `SceneContext` 里的手写 state + `cancelTeleport`，`teleporting.aborted` 那条边没有消费方）；`dockMachine` 只有 Projects 用，Publications 仍是 `publicationMotionMachine`。<br>**接线时发现的五个缺口**（机器定义好但从未被运行时走过，所以没人发现）：① `mounting` 缺 `READY` 边——纹理已缓存的房间不 Suspend、拿不到 `MOUNTED`，会永久卡住（即「第二次进同一间房」这条最常见路径）；② `tryRoom` 若读渲染快照而非 actor，同一 tick 内连点两下门会两次都判合法；③ **`MOUNTED` 没有发送方**（`RoomInterior.onLoading` 默认 NOOP、`DoorSection` 没传）→ `loading` 生产不可达 → **8 秒加载超时永远不启动**；④ **`EXIT_DONE` 没有发送方**——退场收尾复用了 `RESET`，现已拆成 `finishRoomExit()`；⑤ **`BACK` 4 条边全是死的**——目标与动作和 `RESET` 逐字相同且无人发送，已删。③④⑤ 由新门禁 `__tests__/machineEventWiring.test.ts` 抓出：**图上有边 ≠ 运行时有人发**，而机器测试与全路径覆盖都会自己 `send()`，照样全绿 |
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
- **E2E 走全部进入路径**（`classicReveal.spec.ts`）：此前只从顶部进过 `/classic/`。
  hash 用例必须断言目标**落在视口顶部**——只断言"在 DOM 里"时跳转没发生也是绿的。

两条测试都做过变异验证：塞回一个 `getAll()` 门禁红；把 `revert` 换成 `kill`，
StrictMode 残值那条红。

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

`e2e/` 下 128 个用例（64 条 spec × chromium / mobile-safari 两个形态），分两个文件：

| 文件 | 覆盖 |
|------|------|
| `staticExport.spec.ts` | 静态导出的产物形态：路由可达性、`trailingSlash` 的目录结构、主题与语言的持久化、门户页语言切换 |
| `lab.spec.ts` | Lab 的**行为**：进房 / 退房 / 传送 / ESC / 面板 / 教程 / 语言切换 / 首访 / 无 JS 兜底 |
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

## 命令

```bash
pnpm dev:resume          # 从仓库根起（:3000）
cd apps/resume
pnpm test                # vitest run
pnpm type-check          # tsc --noEmit
pnpm build               # 静态导出到 out/

# 素材流水线（改了 media-src/ 下的源才需要跑；--check 只报告）
node scripts/lab/gen-asset-manifest.mjs      # 纹理预载表（派生生成物）
node scripts/media/encode-audio.mjs          # 音频重编码
node scripts/media/gallery-door.mjs          # Gallery 门贴纸
node scripts/media/optimize-textures.mjs     # 入口页纹理
node scripts/media/optimize-credentials.mjs  # 荣誉与证书页图片（原图 7 MB → webp）
python3 scripts/media/subset-fonts.py        # 字体子集 + woff2
pnpm build && node scripts/media/entry-firstframe.mjs   # 手机端入口的静态首帧
```

> `entry-firstframe.mjs` 需要**已构建的 `out/`** ——它是截图，构图来自 3D
> 场景，拼贴拼不出同一个画面。

> `pnpm lint` **当前跑不起来**：`eslint.config.mjs` 按 flat config 写，但装的
> `eslint-config-next@15.5.20` 导出的是旧版 eslintrc 对象 → `nextVitals is not iterable`。
> 这是依赖版本不匹配，从未跑通过，CI 刻意不跑（见根 `CLAUDE.md`「已知负债」）。
> 要修先写 ADR：升 `eslint-config-next`，或把配置改回 eslintrc 形态。
