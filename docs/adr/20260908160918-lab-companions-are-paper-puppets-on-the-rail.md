# 20260908160918. Lab 走廊的活物用分层纸偶 + 导轨上的纯函数 reducer，不引入 GLTF 骨骼动画与物理引擎

- 状态：提议
- 索引：resume 的 Lab 走廊新增陪伴型活物（引路的小狗、守相框的猫）。三条决定：① 视觉用**分层纸偶**（一张线稿切成部件、程序化摆动），不引入 GLB / SkinnedMesh / 物理引擎；② 行为是 `lib/lab/domain/corridor/companion.ts` 里**以导轨状态为输入的纯函数 reducer**，不用 steering 库、不写相机；③ 活物**永不进入视野中央区** x∈(−0.6, 0.6)，且 Lab 首次引入 `prefers-reduced-motion` 开关，活物是它的第一个消费者。判定原则：**走廊里能动的东西，形式必须是纸，驱动必须是纯函数**
- 日期：2026-09-08

## 背景

Lab 走廊里没有任何活物。会动的只有欢迎区头像的 9 帧 ping-pong、一只彩蛋小虫、几个浮动涂鸦；房间里 About 有纸飞机、Publications 有静态的鸟。用户提议"走廊里放一只跑动的小狗和一只猫"，并要求先学习高质量作品再设计。调研结论见
`docs/research/2026-09-08-lab-liveliness.md`：12 个标杆里被记住的元素归纳为三类——物理反馈、有个性的活物、访客痕迹——走廊结构天然适合第二类。

约束：

- **视觉语言是手绘线稿 + 纸纹**。走廊是对 itomdev 原作的还原（纹理文件名全是波兰语），所有活物都是带 alpha 的 webp 平面：`Avatar`（逐帧）、`BugEaster`（三角函数游走）、`Cat`（瞳孔跟随指针，目前只在入口页 `/`）。
- **全站没有 GLTF / GLB / SkinnedMesh / `useGLTF` / `useAnimations` / 物理引擎 / 后处理 / instancing**。引入任何一项都是新的素材类别或新的运行时依赖。
- **玩家 = 相机，走廊是一维导轨**（x=0、y≈0.2、z 随滚轮 / 方向键 / 触摸）。没有角色实体，也就没有"碰撞"可言。
- **相机所有权是硬约束**：只有 `CameraDirector` 与走廊导轨能写相机，棘轮 8 文件 / 34 写点只能往下，`CameraRig` 每帧断言。活物不能为了"吸引注意"去动相机。
- **Lab 完全不响应 `prefers-reduced-motion`**（全仓 5 处命中全在 Classic 与加载指示器）。新增持续运动的活物会让这个缺口从"没人注意"变成"第一屏就晃"。
- 第一人称走廊比任何标杆更怕晕：非玩家控制的镜头运动、视野中央的高频横穿是两大致晕源（调研 §3.3）。
- 标杆的反证：通读 Bruno Simon folio-2025 源码（调研 §3.4），**世界里没有任何 NPC / 动物 / 骨骼动画**——萤火虫、落叶、雨雪全是 GPU 程序化粒子，鸟叫狼嚎只有声音没有实体。顶级作品的"生气"来自声音、粒子与物理反馈，不来自活物模型。这说明"有活物就必须有骨骼动画"是个假前提。

不决策会发生什么：要么有人直接拉一个 Quaternius 低模狗进来（风格冲突、+300 KB、要实时阴影否则像贴纸），要么在组件里散一堆 `Math.sin(t)` 参数（正是审计 A4 与 `components/rooms/projects/AGENTS.md` 反对的形态），两种都没有人能在 review 里说"为什么不行"。

## 选项

### 视觉与素材

- **A. 低模 GLB + 骨骼动画**（Quaternius / Kenney CC0 动物包，drei `useGLTF` + `useAnimations`）：动作最丰富（idle / walk / run / sit 现成）；**风格冲突**——3D 低模放进线稿世界像贴错的贴纸，要加描边 shader 才勉强合，而全站没有后处理；新增素材类别、动画混合器、实时阴影；每只 200–500 KB。
- **B. 逐帧手绘 sprite**（同 `Avatar`，6–8 帧跑动 + 坐 + 待机）：与现有语言完全一致；**帧间一致性靠不住**——线稿由生成工具产出，多帧易走形，且每个动作都是一组新纹理。
- **C. 分层纸偶**（身体 / 头 / 前后腿 / 尾巴各一张线稿，程序化摆动）：**一张线稿切成部件**，一致性天然保证；动作参数化可绑到实际位移（不滑步）；纸偶感与纸纹世界相合；素材 6 张小 webp（预计 <150 KB）。动作表现力有上限——跑 / 走 / 坐 / 回头够用，"打滚"做不了。
- **D. roughjs 程序化线稿**（现有 `SketchSpec` 流水线）：零素材；涂鸦味重于现有的精细线稿，与猫 / 头像不同风。

### 行为驱动

- **E. steering 库**（Yuka：seek / arrive / wander / 避障 + 状态机）：通用、成熟；但走廊是一维导轨，没有避障与寻路的问题，装一个游戏 AI 库解一维问题是过度设计，而且 Yuka 有自己的 `Vehicle`/`EntityManager` 更新循环要与 R3F 的 `useFrame` 对接。
- **F. 纯函数 reducer**（`stepCompanion(state, input, dt)`，输入只有相机 z、速度、房间相位、reduced-motion）：与 `domain/corridor/keyboard.ts` 同一形态，可直接单测（不必起 R3F 场景）；`domainPurity` 门禁天然覆盖；所有常量（前导距离、侧道 x、坐下延迟、中央禁区）集中在 domain。代价是行为要自己写——但一维上的 arrive 就是一个 lerp 加一个阈值。
- **G. XState 状态机**（仓库已有 `room.machine`）：状态显式、可用 `@xstate/graph` 全路径测试；但活物的核心是**连续量**（位置、相位、腿角）而不是离散相位，套状态机只剩 5 个状态名，连续部分照样要写 reducer。

## 决策

**选 C + F。** 视觉用分层纸偶；行为是 domain 里的纯函数 reducer；离散状态（`trot` / `run` / `sit` / `wait-at-door` / `greet` / `idle-look`）作为 reducer 输出的一个字段，不单独上状态机。

三条配套规则，与决定同等效力：

1. **视野中央禁区**：任何走廊活物的 x 不落入 (−0.6, 0.6)。换边（从 +1.4 到 −1.4）必须在相机后方完成（先落后到 `camZ + 2` 以外，换边，再追上）。这条由 reducer 单测以穷举输入序列断言，不靠 review。
2. **活物不写相机**。要"引导视线"只能改 `useCorridorCamera` 内部的 glance，那是导轨持有者的事。
3. **Lab 首次引入 `prefers-reduced-motion` 开关**（`lib/lab/app/motion.ts` 暴露 `motionScale: 0 | 1`，`LabScene` 注入）。活物是第一个消费者：reduced 下狗坐在起点门旁不移动、猫只有睡 / 醒两态、无伸懒腰动画。既有的涂鸦浮动、虫子游走在同一 PR 接入同一开关——不接入就是让新旧动效各行其是。

**判定原则**：走廊里能动的东西，**形式必须是纸，驱动必须是纯函数**。前半句守风格（不引入第二种材质语言），后半句守可测性（不在组件里散三角函数参数）。以后再有"加一只鸟 / 一辆玩具车"的提议，先过这一句。

不选 A 的根本理由不是性能（一两只 SkinnedMesh 没问题，见调研 §3.2），是**风格**：线稿世界里只能有线稿。这条比"省 300 KB"重要，因为它决定的是这个站像一件作品还是一堆素材。

不选 E / G 的理由是尺度：一维导轨上的跟随是一个 lerp 加三个阈值，配套一个游戏 AI 库或一张状态图会让"为什么狗不动"的排查路径变长而不是变短。

## 影响

- 正面：零新依赖、零新素材类别；行为可单测（含"永不横穿中央"的性质测试）；Lab 补上 a11y 的 reduced-motion 缺口；给后续"再加一个活物"立了判定句。
- 负面：动作表现力受纸偶限制；需要产出一张狗线稿与一张睡猫线稿（用现有猫 / 头像同一生成流程），切部件是一次手工；走廊纹理从此需要体积预算门禁（顺带补：`public/textures/corridor/companion/` 合计 <200 KB、单张 <60 KB）。
- 影响面：
  - 新增 `lib/lab/domain/corridor/companion.ts`（reducer + 常量）、`layout.ts` 的 `CORRIDOR_COMPANIONS` 表、`schema.ts` 对应 schema、`assets.ts` 部件纹理路径规则
  - 新增 `lib/lab/app/motion.ts`（reduced-motion 开关）
  - 新增 `components/lab/companions/{Dog,ResidentCat}.tsx`，在 `CorridorSegment` 或走廊层挂载；`Doodles` / `BugEaster` 接入 `motionScale`
  - `domain/achievements/defs.ts` + `ids.ts` 新增 `pet_cat`、`dog_companion`；`content/{en,zh}.ts` 的 `labUi.tutorials` 与 `lab.achievements` 加对应文案
  - `SOUND_MANIFEST` 新增 `dog_bark` / `cat_meow`（第 2 期）
  - 重跑 `scripts/lab/gen-asset-manifest.mjs`；新增 `scripts/qa/lab-walkthrough.mjs`
  - 测试：`companion.test.ts`（性质测试）、`roomRegistry.test.ts` 加 schema 与资源存在性、`textureBudget` 扩到走廊、E2E 一条（reduced-motion 下 `data-lab-companion` 的 z 不变；点猫成就出现）
  - 详细行为与分期见规格 `docs/specs/lab-companions.md`

## 与既有 ADR 的关系

- [20260903140619](./20260903140619-lab-external-assets-and-runtime-sketch.md)（外部素材限手绘线稿、许可记录）：**遵循**。新线稿的来源与许可记入 `public/CREDITS.md`。
- [20260903140615](./20260903140615-lab-room-registry-and-derived-assets.md)（声明驱动、预载表派生）：**遵循**。活物位置与纹理是 domain 声明，预载表重生成。
- [20260903211244](./20260903211244-lab-camera-owner-is-explicit-not-suspended-flag.md)（相机所有权）：**遵循且加严**——活物是第一类被明文禁止写相机的走廊元素。
- [20260907120701](./20260907120701-gsap-lifecycle-owned-by-context.md)：猫的伸懒腰若用 gsap，归 `gsap.context()` 所有。
