# Lab 走廊活物规格：引路的小狗、守相框的猫

**状态**：设计稿，随 ADR [20260908160918](../adr/20260908160918-lab-companions-are-paper-puppets-on-the-rail.md) 提交；ADR 接受后按本文实现。
**调研依据**：`../research/2026-09-08-lab-liveliness.md`。
**读法**：§1–§4 是产品行为（用户能感知的），§5–§8 是实现约束（架构与测试）。改产品行为先改本文，再改代码。

---

## 1. 目标与非目标

**目标**：让走廊"有人陪"。访客滚动前进时有东西与他同行、在他停下时回应他、在门口替他指出"这里有内容"；一只猫守着柜子上的相框，成为一个可以撸、有叙事的落点。

**非目标**：不做宠物养成、不做对话、不做寻路与避障、不做物理、不做 3D 转身、不改任何相机行为、不改走廊几何。

**成功标准**（第 1 期结束时）：

1. 巡检截图里，走廊任意一屏至少有一个非玩家的运动主体，且没有一帧出现活物遮挡门或站在视野中央。
2. 玩家静止 2.5 s 内，狗转身面向相机坐下；再滚动，狗在 0.5 s 内起身领跑。
3. 玩家点门进房，狗在门开之前到达门前坐下；退房完成后 1 s 内狗起身。
4. 猫在相机距柜子 8 单位内睁眼并跟指针，点击后有反馈与成就；12 单位外回到睡态。
5. 系统开启"减少动效"时，狗不移动、猫不做伸懒腰，其余行为不变。
6. 新增纹理合计 <200 KB；移动端 LOW 档帧率不因活物下降（巡检时对比 `performance.now()` 帧间隔的中位数，差异 <10%）。

---

## 2. 狗：行为

### 2.1 输入

每帧 reducer 只看这几个量，全部来自走廊导轨与房间状态机，**不读 DOM、不读相机以外的任何 three 对象**：

| 输入 | 来源 | 含义 |
|------|------|------|
| `camZ` | `camera.position.z`（由导轨每帧写入） | 玩家位置 |
| `camV` | 导轨的 `targetZ − currentZ` 的每帧差分，经 0.2 的 EMA 平滑 | 玩家速度（负数 = 前进） |
| `phase` | `room.machine` 相位（`idle` / `aligning` / … / `entered` / `exiting`） | 是否在进出房间 |
| `targetDoorZ` / `targetDoorSide` | 进房流程开始时来自 `doorForRoom` + 段号 | 玩家要去的门 |
| `nextDoor` | `layout.ts` 派生：`camZ` 前方最近的门（世界 z 与 side） | 用于选侧道 |
| `reducedMotion` | `lib/lab/app/motion.ts` | 0 或 1 |
| `dt` | `useFrame` 的 delta，夹在 [0, 0.05] | 防止标签页切回时一步跳很远 |

### 2.2 状态

| 状态 | 进入条件 | 位置目标 | 姿态 | 退出 |
|------|----------|----------|------|------|
| `offstage` | 初始态；玩家尚未产生首次位移 | 不渲染 | — | 首次 `|camV|` > ε → `arrive` |
| `arrive` | 从 `offstage` 出 | 从起点门旁（`segmentStartZ(0) − 6`，侧道）以 `run` 速度跑进视野到 `camZ − LEAD`，0.8 s；脚下一圈淡灰墨点扩散 0.4 s（登场瞬间，调研 §3.5） | 跑姿 | 到位 → `trot`；reduced 下改为直接出现在门旁 `sit` |
| `trot` | `|camV|` ∈ (ε, V_RUN) | `camZ − LEAD`，LEAD = 5；侧道 x = `lane` | 腿摆频率 = `k · |位移|`，尾巴中速 | 速度变化 / 静止 |
| `run` | `|camV|` ≥ V_RUN | 同上，但若落后（`z > camZ − LEAD + 3`）则以 2× lerp 追上 | 腿摆更快，身体前倾 6° | 速度回落 |
| `sit` | 静止（`|camV|` < ε）持续 SIT_AFTER = 2.5 s | 原地 | 坐姿部件（正面），面向相机 | 玩家再动 → 0.3 s 内回 `trot` |
| `idle-look` | 在 `sit` 中每 6–9 s（确定性伪随机，种子取 `floor(camZ)`） | 原地 | 头部 ±12° 摆一次，0.6 s | 自动回 `sit` |
| `wait-at-door` | `phase` 进入 `aligning` | `targetDoorZ + 1.5`，x = 门同侧 `±(WALL_X − 1.2)` | 到达后坐姿，面向门 | `phase` 回到 `idle`（退房完成） |
| `greet` | 从 `wait-at-door` 退出的第一帧 | 原地 | 身体 y 小跳一次（0.35 s，高 0.15） | 自动回 `trot` |

ε = 0.01 单位/帧，V_RUN = 0.35 单位/帧（对应导轨 `smoothing` 下的快速滚动）。

### 2.3 侧道与视野中央禁区

- `lane` ∈ {+1.4, −1.4}。默认取 **下一扇门的对侧**（门在左墙则狗走右道），保证狗不挡门。
- 换道只在两门之间的空档做，而且**必须在相机后方完成**：狗先落后到 `camZ + 2`（相机看不见），换 x，再追上。任何时刻 |x| ≥ 0.6 ——这是不变量，reducer 单测用 2000 步随机输入序列断言，任何一步违反即失败。
- 与家具冲突：`CORRIDOR_FURNITURE` 在 −27（左）/ −49（右）/ −63（左）；狗侧道 x=1.4 与家具贴墙 x≈±3 不相交，不需要避让。

### 2.4 朝向与镜像

- 前进：部件组 `scale.x = +1`，朝 −z 的侧面视图。
- `sit` / `wait-at-door`：切换到"坐姿"部件排布（正面视图，头朝相机）。不做旋转，切换用 0.15 s 交叉淡入（两套部件的 `opacity` 互换）。
- 不做 3D 转身。纸偶的语言就是翻面。

### 2.5 高度与脚下

- 站高 0.6 单位，脚底 `FLOOR_Y = −1.75`。
- 脚下一块 0.5×0.2 的淡灰椭圆（`#c8c4b0`，opacity 0.35）作接触阴影，随身体 y 浮动反向缩放（跳起时变小）。

---

### 2.6 一行字气泡

狗与猫头顶可冒一行手写小字（调研 §3.5 Bruno 的车顶 "THIS IS SO NICE!"），1.8 s 后淡出，同一活物冷却 10 s：

| 时机 | en | zh |
|------|----|----|
| 狗 `greet` | `Welcome back!` | `回来啦！` |
| 狗进入 `wait-at-door` | `In here?` | `进这里？` |
| 猫 `stretch` | `...meow` | `……喵` |

实现：圆角纸片（`THREE.Shape` 圆角矩形 + 尾巴三角，墨线描边）+ `Text`（troika，字号 0.2）+ `fontForText()`，文案进 `labUi.companions`，中英键一致；reduced 下照常显示（文字不是运动）。

## 3. 猫：行为

> **位置已改（2026-09-08 实现时）**：原定「柜顶、守着相框」，实测那个位置永远看不见 ——
> 柜子在 relativeZ −49 而 Gallery 门在 −44，相机走到能看见柜子的距离时，门段的翻板
> 已经绕外墙转了 30°（`DoorSection` 的 `TILT_START` = 15 单位）把它整个遮住。
> 走廊里三件家具距最近同侧门都只有 5–7 单位，所以「活物坐在家具上」在当前布局下
> 都走不通。ADR 20260908160918 的索引已追加注记；新增门禁「活物驻点距同侧门 > 15 单位」
> （`__tests__/corridorLandmarks.test.ts`）。

- **位置**：第 0 段走廊尽头，relativeZ **−68**，侧道 x = **1.9**，坐在**地板**上。
  距最近的同侧门（右墙 −44）24 单位，远在翻板影响范围外；邻居是 bug 彩蛋（−70）
  与段末门（−95）——两个彩蛋凑在「走廊尽头」反而成了一个可辨认的区域。
  **只在第 0 段**（无限走廊的后续段不再出现——猫是一个具体的存在，不是壁纸）。
- **尺寸**：猫身平面 **1.15** 单位见方。0.45 试过太小（6 单位外约 30 像素，看起来是地板上
  的白点）；0.7 能辨认轮廓但验收时仍嫌小；1.15 在同距离约 80 像素、一眼是猫，仍明显
  小于人（`Avatar` 高 2.3，约两倍）。
- **气泡**：字号 0.2（0.06 试过，6 单位外约 8 像素、读不出来），字下垫一块 1.1×0.45 的
  纸片（`#fffdf7` 底、`#3a3a3a` 描边、底部小三角指向猫头）——白猫头顶飘灰字在白墙前
  看不见，先有气泡再有字。
- **接触阴影**：脚下一块 0.42 压扁的淡灰椭圆（`#c8c4b0`，opacity 0.32）。没有它，
  白色线稿的猫贴在白地板上像一张贴纸——这正是 HN 对「My Room in 3D」的那条批评
  （椅子会动而阴影不动）。走廊全是 `meshBasicMaterial`，阴影只能手画。
- **叙事**：走廊尽头打盹。教程气泡文案已随位置一起改成"走廊尽头有只猫在打盹"
  （en："A cat naps at the end of the hall"）—— 留着"守相框"的旧文案就是一处
  用户可见的不一致。
- **状态**：

| 状态 | 条件 | 表现 |
|------|------|------|
| `sleep` | 默认；相机距离 > 12 | 闭眼线稿，身体每 3 s 起伏 2%（呼吸）；reduced 下不起伏 |
| `awake` | 相机距离 ≤ 8 | 睁眼线稿（复用现有 `Cat` 的瞳孔跟随），耳朵每 4–7 s 抖一次 |
| `stretch` | 点击 / 触摸 | 0.8 s：身体 y 拉伸 1.15 → 1.0、轻微旋转 ±4°，一声喵（第 2 期），解锁成就 `pet_cat`；reduced 下跳过动画只给成就与提示 |

- 距离滞回（8 进 / 12 出）避免在阈值附近闪切。
- **入口页 `/` 的猫不动**：它是那扇门的预览，已经有自己的位置。两处共用 `Cat` 的瞳孔逻辑，抽成 `useCatEyes()`。

---

## 4. 成就、文案、声音

| 项 | 内容 |
|----|------|
| 成就 `pet_cat` | 点猫一次。`unlockedBy: { kind: 'corridor-interaction', target: 'cat' }`（新 trigger 类型），persisted |
| 成就 `dog_companion` | 狗处于 `trot`/`run` 累计 30 s。`unlockedBy: { kind: 'corridor-interaction', landmarkId: 'guide-dog' }`（与 `pet_cat` 同一 trigger 类型；累计计时在 reducer 里，满 30 s 输出一次事件），persisted |
| 教程气泡 | `labUi.tutorials.pet_cat`（作用域 `corridor`）：en "Curious" / "A cat naps at the end of the hall"；zh "好奇" / "走廊尽头有只猫在打盹"（已随猫的位置改）。`dog_companion`：en "Good Company" / "Keep walking, the dog will follow"；zh "有伴" / "继续走，小狗会跟着你" |
| 音效 | **改为仓库内脚本离线合成，不用外部 CC0**（ADR 20260908204304，参数与触发规则见 `lab-corridor-story.md` §6）：`cat_meow`（`stretch` 进入帧）、`dog_bark`（`greet` 进入帧）、`paw_a/b`（狗 `trot`/`run` 每 0.9 单位一声，spatial 在狗）、`footstep_a/b`（玩家每 1.8 单位一步、a/b 交替、音量按速度分档）、`bubble_pop`（气泡出现）。全部 sfx 总线、经既有 3D 定位、尊重静音；reduced motion 不影响声音 |

---

## 5. 无障碍与性能

- **reduced-motion**：`lib/lab/app/motion.ts` 读 `matchMedia('(prefers-reduced-motion: reduce)')`，暴露 `motionScale: 0 | 1` 与订阅函数；`LabScene` 注入 Provider。第一批消费者：狗（reduced 时直接 `sit` 在起点门旁 `z = segmentStartZ(0) − 4`、不移动）、猫（无 `stretch` 动画）、`Doodles`（不浮动）、`BugEaster`（不游走，仍可点）。
- **移动端 LOW**：不砍活物（合计约 8 个透明平面，十几个三角面）。触摸端"点猫"用 `onPointerDown`，与走廊竖拖走路的 10 px 死区兼容。
- **纹理预算**：`__tests__/textureBudget.test.ts` 新增一组：`public/textures/corridor/companion/` 合计 <200 KB、单张 <60 KB。
- **不写相机、不触发 re-render**：所有每帧状态在 ref 里，React state 只在离散状态切换时更新（用于 `data-lab-companion` 诊断属性）。

---

## 6. 素材

> **来源已定（2026-09-08，用户拍板）**：狗的线稿**由仓库内的 SVG 手写**，不等外部画稿，也不用 AI 生图切层。
> 理由：① 分层是原生的——每个部件就是 SVG 里的一个 `<g id>`，不存在「从整张栅格图里切缝」的问题；
> ② 与猫（细线、白填充、透明底）同一风格可控；③ 自有、无许可问题；④ 改一笔重跑即得。
> 免费生图（Pollinations）只用作**造型参考**，产物不进仓库。

| 文件 | 内容 | 产出方式 |
|------|------|----------|
| `media-src/textures/companion/dog.svg` | 一张侧面站姿狗线稿，部件各在一个 `<g id="body|head|leg-front|leg-back|tail">`（前后腿各一组，左右腿共用同一张镜像）；线宽 6 / 画布 1024，白填充、`#2b2b2b` 描边、轻微手抖（路径上加 1–2 px 的随机偏移，种子固定） | 手写 |
| `media-src/textures/companion/dog_sit.svg` | 坐姿正面（一张整图，不分部件） | 手写 |
| `public/textures/corridor/companion/dog_{body,head,leg_front,leg_back,tail,sit}.webp` | 由 SVG **逐组**栅格化：脚本对每个 `<g id>` 单独出图（其余组隐藏），画布统一 512，透明底 | `scripts/media/companion-parts.mjs`（sharp 渲染 SVG，`--check` 指纹进 `mediaFreshness.test.ts`） |
| 复用 | `cat_body.webp`（醒态；睡态用两条线画闭眼，见 §3） | 已有 |

部件的**枢轴点与在身体坐标系里的位置**是 domain 声明（`companion.ts` 的 `DOG_PARTS`），渲染组件读它；SVG 里每组的几何中心与 `DOG_PARTS` 的枢轴对齐由脚本在渲染时校验（偏差 > 4 px 报错），改一处两边同步。

---

## 7. 架构落点

```
lib/lab/domain/corridor/
├── companion.ts        CompanionState / CompanionInput / stepCompanion()（纯函数）
│                       常量：LEAD, LANE_X, CENTER_EXCLUSION, SIT_AFTER_MS, V_RUN
│                       DOG_PARTS（部件声明：源矩形、枢轴、位置、摆动轴）
├── layout.ts           CORRIDOR_COMPANIONS = [{ kind:'dog' }, { kind:'cat', anchor:'cabinet', segment:0 }]
├── assets.ts           COMPANION_TEXTURES（路径规则，供预载表生成器）
└── ../schema.ts        corridorCompanionSchema, dogPartSchema
lib/lab/app/
└── motion.ts           reduced-motion 开关（motionScale + subscribe）
components/lab/companions/
├── Dog.tsx             读 stepCompanion 输出，摆部件；ref 里持状态；切换时写 data-lab-companion
├── ResidentCat.tsx     sleep/awake/stretch；复用 useCatEyes()
└── useCatEyes.ts       从 Cat.tsx 抽出的瞳孔跟随
components/lab/CorridorSegment.tsx   在第 0 段挂 ResidentCat；Dog 挂在走廊层（跨段，一只）
scripts/media/companion-parts.mjs    切部件 + 指纹 --check
scripts/qa/lab-walkthrough.mjs       Lab 巡检
```

依赖方向不变：domain 不 import react / three / gsap；`Dog.tsx` 是 reducer 的唯一消费者。

**帧序**：`Dog` 读的是 `camera.position.z`，由走廊导轨在同一帧的 `useFrame` 里写。R3F 同优先级回调按注册顺序执行，`Dog` 在 `LabScene` 里挂在 `CameraController` 之后即可读到本帧值；即使读到上一帧也只差一帧的 lerp，可接受。**不要**给 `Dog` 的 `useFrame` 传正数 priority——那会关闭 R3F 的自动渲染。

**成就进度**：`dog_companion` 是"累计 30 s"，是数值进度而非布尔。`AchievementDefinition` 需加可选 `total`（默认 1），进度累加走 `addProgress(id, seconds)`，与 folio-2025 的 group 进度同形态（调研 §3.4）。

---

## 8. 测试

| 层 | 测什么 | 形态 |
|----|--------|------|
| `__tests__/companion.test.ts` | 静止 2.5 s → `sit`；再动 0.3 s 内 → `trot`；`aligning` → 到门前坐下；`idle` 回来 → `greet` 一次；**2000 步随机输入下 |x| ≥ 0.6 恒成立**；换道只发生在 `z > camZ + 2`；reduced 下 z 不变；dt 夹紧 | vitest 纯函数 |
| `roomRegistry.test.ts` | `CORRIDOR_COMPANIONS` 过 schema；声明的每个纹理在磁盘存在；`DOG_PARTS` 源矩形不越界、枢轴在矩形内 | 现有模式 |
| `textureBudget.test.ts` | companion 目录预算 | 现有模式扩一组 |
| `mediaFreshness.test.ts` | `companion-parts` 流水线指纹 | 现有模式加一条 |
| `labI18n` / `labContrast` / `labFonts` | 新文案、新颜色、字体路径 | 自动覆盖 |
| `roomRegistry` 成就分组 | `pet_cat` / `dog_companion` 的 `unlockedBy` 有真实渲染方 | 现有模式 |
| `e2e/lab.spec.ts` | 走廊滚动 3 s 后 `[data-testid=lab-ui]` 的 `data-lab-companion` ∈ {trot,run}；停 3 s 后为 `sit`；`emulateMedia({reducedMotion:'reduce'})` 下始终 `sit`；点猫（DOM 里没有猫，用地图传送到走廊 −49 附近后**用坐标点 canvas**）→ 成就面板出现 `pet_cat` | 现有 lab.spec 模式 |
| 巡检 | `scripts/qa/lab-walkthrough.mjs`：门户 → 走廊 6 屏 → 停 3 s 一屏 → 4 个房间进出各 3 屏 → 猫前一屏 | 人看 |

E2E 只能读 DOM，视觉靠巡检。**提 PR 前跑巡检并逐张看**（`scripts/qa/AGENTS.md` 的规则）。

---

## 9. 分期

| 期 | 内容 | 验收 | 状态 |
|----|------|------|------|
| 0 | `motion.ts` + 接入 Doodles / BugEaster；`lab-walkthrough.mjs` | reduced 下涂鸦不浮；巡检 20+ 张可用 | ✅ PR #33 |
| 1a | 猫 + `pet_cat` | §3 三态、气泡、成就 | ✅ PR #34（尺寸 1.15、气泡纸片见 §3） |
| 1b | 狗（SVG 手写线稿 + 逐组栅格化流水线）+ `dog_companion` + 纹理预算 + `speech.ts` 统一气泡 | §1 成功标准 1–6；reducer 2000 步随机不变量 | ⬜ |
| 2 | 五类音效（离线合成，ADR 20260908204304） | 静音键有效；连点不叠音；静止 / 房间内不响 | ⬜ |
| 3 | 房间小物（Projects 台灯 / Publications 晾衣绳 / Contact 纸船） | 另写规格 | 未排期 |

---

## 10. 已决与待定

**已按调研建议取默认值**（用户未反对即视为接受）：素材走分层纸偶；狗在前方引路；音效放第 2 期；第 0 期先行。

**2026-09-08 补决**：

- 狗的形象：**中小型、柴犬式轮廓**（立耳、卷尾、短吻），无项圈——调研 §3.5 里 Jay Ransijn 的柴犬是被记住的那一个，且卷尾在纸偶里摆起来比垂尾好看；站高 0.6 单位（见 §2.5）。
- 素材来源：仓库内 SVG 手写（§6），不等外部画稿。
- 猫不给名字：气泡里它只说「……喵」，名字会把「走廊尽头一只猫」变成一个需要解释的角色。
- 第二圈：猫 lap ≥ 1 初始 `awake` 并说一次 `catAgain`；狗 lap 切换帧 `greet` 一次说 `dogLap`（`lab-corridor-story.md` §4）。
