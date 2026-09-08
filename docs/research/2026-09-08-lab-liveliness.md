# Lab 的"生气"：走廊与房间的趣味元素调研与设计提案

**日期**：2026-09-08
**状态**：调研完成，方案**待拍板**（见文末）。落地前按仓库规则先写 ADR，设计与实现分开提交。
**起因**：用户提议"走廊里是不是可以有一只跑动的小狗和小猫"，并要求先学习高质量作品再设计。

---

## 0. 结论先行

1. **用户的直觉是对的，而且是最高回报的一条。** 走廊现在只有静物和光（门、挂画、柜子、盆栽、吊灯），唯一会动的是欢迎区的头像逐帧和一只彩蛋小虫。12 个标杆案例里被人记住的元素，归纳只有三类：**物理反馈、有个性的活物、访客留下的痕迹**。走廊的结构天然适合第二类，第三类要等统一控制台（计划 B）。
2. **不要引入 GLB 骨骼动画或物理引擎。** 全站没有任何 GLTF / SkinnedMesh / 物理依赖；Lab 的视觉语言是**手绘线稿 + 纸纹**（对 itomdev 原作的还原），低模 3D 狗放进去会像贴错的贴纸。推荐做**分层纸偶**：身体 / 头 / 四条腿 / 尾巴各一张线稿，程序化摆动——与现有 `Avatar`（逐帧）、`BugEaster`（三角函数游走）、`Cat`（瞳孔跟随指针）是同一套语言，零新依赖、零素材一致性风险。
3. **两个前置缺口先补，便宜且必须**：Lab 完全不响应 `prefers-reduced-motion`（新增持续运动的活物会放大这个缺口）；Lab 没有截图巡检脚本（`AGENTS.md` 明文要求"改 Lab 视觉前先跑带截图的复现"，Classic 有工具，Lab 没有）。
4. **第一人称走廊比任何标杆更怕晕**：活物**不横穿视野中央**，固定走在侧道；镜头永不为它转动。

---

## 1. 方法

- **像用户一样走了一遍**：Playwright 从门户 `/` 进 Lab，滚过一整段走廊（6 屏），经地图传送进 About / Projects 并退回，共 17 张整屏截图逐张看过。
- **通读 Lab 代码结构**（`apps/resume` 的 `lib/lab/domain|app|infra`、`components/lab|rooms`、门禁测试、E2E、素材流水线），结论每条附文件位置。
- **业界调研**：12 个标杆案例 + 宠物 NPC 的四种实现路径 + 反面教训，每条结论至少一个来源（§3）。

---

## 2. Lab 现状：为什么"没生气"

### 2.1 观感（截图）

| 画面 | 观察 |
|------|------|
| 走廊起点 | 欢迎区：段门上 `while(true) { explore(); }`、涂鸦、进度 100%。头像在做逐帧动画。除此之外**没有任何东西在动** |
| 走廊中段 | 左 About 门（笑脸贴纸）、右 Gallery 门（相机贴纸）、墙上一幅照片、一盆绿植、尽头雾白。构图干净，但像一张静态插画 |
| About 房间 | 云上躺着的漫画人像 + 纸飞机，滚动飞过三个里程碑。有动效，但**没有可点的东西** |
| Projects 房间 | 暗室 + 弧形 8 屏 + 白板 + 便签，点屏幕停靠。这是最有"活"感的一间，因为有 hover 上色与停靠动画 |

### 2.2 事实（代码）

| 事实 | 位置 |
|------|------|
| 玩家 = 相机，走廊是**一维导轨**（x=0、y≈0.2、z 随滚轮 / 方向键 / 触摸），没有角色实体 | `hooks/useCorridorCamera.ts` |
| 走廊每段 100 单位，宽 7、高 3.5；门在 z −8/−20/−32/−44/−56 左右交替；家具：桌 −27、柜 −49、盆栽 −63；虫 −70；段门 −95 | `lib/lab/domain/corridor/layout.ts`（几何唯一来源） |
| 已有"活物"：`Avatar` 9 帧 ping-pong + 相机靠近侧身闪避；`BugEaster` 双频 sin/cos 游走 + 点击一次性墨点；`Doodles` 5 个浮动涂鸦；`Cat` 瞳孔跟随指针——**但 `Cat` 只在入口页 `/`，不在走廊** | `components/lab/{Avatar,BugEaster,Doodles,Cat}.tsx` |
| **没有** GLTF/GLB/FBX、SkinnedMesh、`useGLTF`/`useAnimations`、物理引擎（rapier/cannon）、后处理、粒子/instancing | 全仓 grep 零命中；`public/models` 不存在 |
| 动效栈：`useFrame` 三角函数 + lerp（主力）、gsap（一次性转场）、framer-motion（DOM 覆盖层）；唯一自定义 shader 是 `RevealMaterial`（sketch→painted 噪声擦除） | — |
| 音频：`AudioMixer`（howler）三条总线 music/sfx/ambience，清单在 domain；房间有环境音，**走廊没有脚步声** | `lib/lab/domain/audio/manifest.ts` |
| 成就系统已有 7 个成就 + 气泡队列；教程系统按房间声明 | `lib/lab/domain/achievements/` |
| **Lab 不响应 `prefers-reduced-motion`**：全仓 5 处命中全在 Classic / 加载指示器 | grep |
| **Lab 没有截图巡检脚本**；Classic 有 `scripts/qa/walkthrough.mjs` | `apps/resume/scripts/qa/` |
| 性能分层：移动端一律 LOW（无 AA、dpr ≤1.25）；材质全是 `meshBasicMaterial`（灯光不参与着色，"开灯"只能靠换色/换贴图） | `context/PerformanceContext.tsx` |
| 走廊/房间纹理**没有体积预算门禁**（只有入口页有 700 KB 上限）；`public/textures/contact` 已 14 MB | `__tests__/textureBudget.test.ts` |
| 手绘风物件有现成流水线：`SketchSpec` → `planSketch()` → roughjs → `CanvasTexture`，按 spec 身份缓存 | `lib/lab/domain/sketch/`、`lib/lab/infra/sketch/` |

### 2.3 新增走廊元素的架构落点（既有模式，照做即可）

1. 位置 / 参数声明进 `lib/lab/domain/corridor/layout.ts`（推荐数据表 + kind 联合，同 `CORRIDOR_FURNITURE`），zod schema 进 `domain/schema.ts`，`roomRegistry.test.ts` 加 `it.each`。
2. 纹理路径若是模板字面量（如分层部件 `dog/${part}.webp`），必须在 `domain/corridor/assets.ts` 按规则声明（`AVATAR_ANIM_FRAMES` 是模板）——静态扫描抓不到模板字面量，漏了的症状是"走到一半突然闪空"。
3. 视图组件放 `components/lab/`，在 `CorridorSegment.tsx` 或 `LabScene` 走廊层挂载；然后 **重跑 `node scripts/lab/gen-asset-manifest.mjs`**（预载表是生成物，受 hook 保护，不能手改；生成器只遍历从 `LabScene` / `CorridorSegment` import 可达的组件）。
4. 音效进 `SOUND_MANIFEST`，原始文件进 `media-src/sounds/`，跑 `encode-audio.mjs`（CI `--check` 指纹）。
5. 用户可见文案进 `content[locale].labUi`，en/zh 键一致；3D 文字字体走 `fontForText()`（全禁写死路径）。
6. **绝不写相机**（棘轮 8 文件 / 34 写点只能往下 + `CameraRig` 每帧所有权断言）。要"引导视线"只能改 `useCorridorCamera` 内部的 glance。
7. 点击 / ESC 交互走 `pushEscapeConsumer`，成就的 `unlockedBy` 必须指向真实渲染方。

---

## 3. 业界调研

### 3.1 标杆与它们的记忆点

| 案例 | 记忆点 | 手法 | 来源 |
|------|--------|------|------|
| Bruno Simon 2019 | 开车撞保龄球、推倒物件——**物理反馈** | three.js + cannon.js，matcap 换帧率 | [案例研究](https://medium.com/@bruno_simon/bruno-simon-portfolio-case-study-960402cc259b) |
| Bruno Simon 2025 | **Whispers**：访客留带国旗的小火苗留言（限 30 条、AI 审核）；成就解锁车皮肤；空间化音效（鸟 / 蟋蟀 / 风） | WebGPU + TSL、Rapier、移动端自动降质。**案例研究未提任何动物/NPC** | [Awwwards 案例研究](https://www.awwwards.com/brunos-portfolio-case-study.html)、[HN 2025](https://news.ycombinator.com/item?id=46206531) |
| Coastal World (Merci-Michel) | **NPC 有个性和自创语言**（每个字母对应音素），会记住回访玩家；靠近可交互物图标自动展开 | three.js + Vue；按帧率降质；物理放 Worker；竖屏单键 | [SOTM 文章](https://www.awwwards.com/coastal-world-by-merci-michel-wins-site-of-the-month-august-2022.html) |
| Jay Ransijn | **一只可以玩接飞盘的狗**、拉杠杆让乐队演奏、撞倒前公司 logo | three.js（无公开技术拆解） | [盘点](https://www.creativedevjobs.com/blog/best-threejs-portfolio-examples-2025) |
| Thibault Introvigne | 收集 10 个收藏品，每件揭示一段经历——**收集品 = 简历条目** | R3F + Blender | [Awwwards](https://www.awwwards.com/sites/thibault-introvigne-portfolio) |
| Robby Leonardi | 游戏元素**就是**数据可视化（食人花高度 = 技能熟练度） | 2D 平台跳跃 | [FWA 幕后](https://thefwa.com/article/the-making-of-robby-leonardi-s-interactive-resume) |
| Henry Heffernan | CRT 电脑里的 Win95，能玩 DOOM——**一个物件做到极致** | R3F + iframe | [入选页](https://threejs-journey.com/selection/henry-heffernan-portfolio) |
| Igloo Inc (SOTY 2024) | 程序化冰晶、粒子随速度变色、**音效与粒子同步** | three.js + BVH + 自研体数据压缩 | [案例研究](https://www.awwwards.com/igloo-inc-case-study.html) |
| Messenger (Abeto) | 能看见其他访客互相挥手；**整站 5.7 MB** | three.js | [盘点](https://www.creativedevjobs.com/blog/best-threejs-portfolio-examples-2025) |

其余（Jesse's Ramen、Lusion、David Heckhoff）见调研原文；Active Theory / akella 的价值在 shader 教学，非 NPC。

**三条规律**：被记住的从来不是"3D 本身"，而是 (1) 物理反馈；(2) 有个性的活物；(3) 访客痕迹。另一条被反复强调：**游戏元素要承载信息**（Robby 的食人花、Thibault 的收藏品），纯装饰会被评为"噱头盖过内容"。

### 3.2 宠物 NPC 的四条实现路径

| 路径 | 做法 | 优点 | 代价 | 对本项目 |
|------|------|------|------|----------|
| A. 低模 GLB + 骨骼动画 | Quaternius CC0 动物包（狗 / 猫，含 idle/walk/run/sit）+ drei `useGLTF`/`useAnimations` | 动作最丰富 | **风格冲突**（3D 低模 vs 手绘线稿）；新增素材类别、动画混合器、实时阴影（否则"贴纸感"）；每只 +200–500 KB；是新架构决策，需 ADR | 不推荐 |
| B. 逐帧手绘 sprite | 6–8 帧跑动 + 坐 + 待机，同 `Avatar` | 与现有语言一致 | **帧间一致性**难保证（线稿由生成工具产出，多帧易走形）；每帧一张纹理 | 备选 |
| C. **分层纸偶**（推荐） | 身体 / 头 / 4 腿 / 尾各一张线稿，程序化摆动（腿 sin 交替、身体上下浮、尾巴弹簧） | 只需 **一张**线稿切成部件，一致性天然保证；动作参数化可绑到实际速度（不滑步）；纸偶感与纸纹世界相合 | 动作表现力有上限（够用：跑 / 走 / 坐 / 回头） | **推荐** |
| D. roughjs 程序化线稿 | 用现有 `SketchSpec` 流水线画狗 | 零素材 | 涂鸦味重于现有精细线稿，与猫 / 头像不同风 | 不推荐（可做"简笔画"彩蛋） |

跟随逻辑通用做法（Reynolds steering：seek / arrive / wander；目标点放在玩家身后 1.5–2 m；到达切 idle → 数秒后 sit）。本项目走廊是**一维导轨**，用不上 Yuka / 寻路 / 物理——纯函数 reducer 足够，且天然可单测。来源：[Reynolds 1999](https://www.red3d.com/cwr/papers/1999/gdc99steer.pdf)、[Nature of Code ch.5](https://natureofcode.com/autonomous-agents/)。

### 3.3 反面教训（与第一人称走廊直接相关）

| 差评 | 规避 |
|------|------|
| **晕 3D**：非玩家控制的镜头运动、视野中央高频横穿 | 活物走固定侧道，不进 x∈(−0.6, 0.6)；镜头永不为它转 |
| 噱头盖过内容 | 狗的行为要**指向内容**：在门口坐下等你 = 提示这里有房间；猫在柜子上 = 柜子相框里是家人照片（"beloved.jpg"），是叙事点 |
| 加载太久 | 纸偶 6 张小 webp（预计 <150 KB）；进走廊预载表 |
| 移动端崩 | 两个 sprite、十来个三角面，LOW 档零压力 |
| 无障碍 | `prefers-reduced-motion` 下狗坐着不跑、猫睡着；这要先有 Lab 级的动效开关（今天没有） |
| 烘焙光照穿帮（动的东西没阴影） | 纸偶脚下一块淡灰椭圆"接触阴影"贴图即可，与手绘阴影一致 |

---

## 4. 候选元素清单（含成本与依赖）

| # | 元素 | 位置 | 效果 | 成本 | 依赖 / 风险 |
|---|------|------|------|------|-------------|
| **P0-a** | **走廊伴侣：小狗** | 走廊侧道，跟着你 | 你走它跑，你停它坐，靠近门它先到门口等你回头看你 | 中 | 需线稿素材；前置 P0-c |
| **P0-b** | **驻守猫** | 柜子（z −49）顶上，相框旁 | 平时睡着；你靠近它睁眼、瞳孔跟指针（复用 `Cat`）；点它伸懒腰 + 一声喵 + 成就「撸猫成功」 | 低 | 复用现有组件；一张睡态线稿 |
| **P0-c** | Lab 级 `prefers-reduced-motion` 策略 | domain + Provider | 一个 `motionScale`（0 或 1）注入所有持续动效；reduced 下狗只坐、猫只睡、涂鸦不浮 | 低 | **前置**；也是长期 a11y 缺口 |
| **P0-d** | Lab 截图巡检脚本 | `scripts/qa/lab-walkthrough.mjs` | 门户 → 走廊 6 屏 → 传送 4 房间进出 → 成就面板，每步一张 | 低 | 今天已用临时脚本跑通 17 张，整理即可 |
| P1-a | 脚步声随导轨速度 | 走廊 | 走动时轻脚步，停即止；sfx 总线，音量随速度 | 低 | CC0 脚步声（OpenGameArt Fantozzi's Footsteps） |
| P1-b | 狗的叫声 / 猫的喵 | 伴侣 | 点狗一声汪；猫一声喵；仅 sfx 总线、尊重静音 | 低 | freesound CC0 各一条 |
| P1-c | 成就：撸猫 / 小狗归队（连续跟随一段） | 成就系统 | 与现有 7 个并列，气泡提示 | 低 | `unlockedBy` 指向真实渲染方 |
| P2-a | 每间房一个"可拨弄"小物 | Projects 台灯 / Publications 晾衣绳 / Contact 纸船 | 点台灯：暗室切亮 tint；拉绳：卡片荡一下；纸船：漂走 | 中 | 三间房三套坐标系，各自 AGENTS.md |
| P2-b | 时间感 | 走廊 | 按访客本地时间在早 / 晚两档间切雾色与吊灯亮度 | 低–中 | About 米色是已定产品决定，配色要在米色系内 |
| P3 | 访客留言墙（Whispers 式） | 走廊尽头段门 | 访客留一句话 + 国旗火苗 | 高 | **依赖计划 B（console 后端）与内容审核**；先 ADR |
| 不做 | 物理可推倒物件 / 鸟群 boids / 镜面 | — | 需物理引擎或后处理，与静态手绘世界冲突，且投入远大于回报 | — | — |

---

## 5. 核心方案：走廊伴侣（狗）+ 驻守猫

### 5.1 行为（狗）

走廊是一维导轨，玩家状态只有 `camZ` 与速度 `v`，狗的状态机（纯函数 reducer，不用物理）：

| 状态 | 进入条件 | 表现 |
|------|----------|------|
| `trot` | 玩家 `|v|` 小于阈值且非零 | 小跑在玩家**前方 4–6 单位**、侧道 x=±1.4，朝前 |
| `run` | `|v|` 大于阈值 | 同上，腿摆频率随速度；落后过远瞬间追上（lerp 加速） |
| `sit` | 玩家静止 > 2.5 s | 停下，转身面向相机坐下（换"坐"部件姿态） |
| `wait-at-door` | 玩家进入房间进入流程 | 跑到该门前 1.5 单位坐下；进房期间不渲染在房内（走廊仍挂载，狗留门口） |
| `greet` | 退房完成 | 原地小跳一下，回到 `trot` |
| `idle-look` | `sit` 中每 6–9 s | 回头看相机 / 抖耳，一次 0.6 s |

侧道选择：取**下一扇门的对侧**（门表在 `layout.ts` 里左右交替），避免挡门；切换侧道在两门之间的空档完成，且**永不穿过 x∈(−0.6, 0.6) 视野中央**——从 +1.4 到 −1.4 的过渡走玩家身后（先落后到相机后方再换边再追上），玩家看不见横穿。

朝向：镜像 `scale.x`；坐姿另一套部件排布（正面），不做 3D 转身。

### 5.2 视觉（纸偶）

- 部件：身体、头、前腿 ×2、后腿 ×2、尾巴，各一张带 alpha 的线稿 webp（从**一张**狗线稿切出，风格对齐现有 `cat_body.webp` / 头像：细线、白填充、无色），外加一块脚下椭圆淡影。
- 尺寸：站高约 0.6 单位（走廊高 3.5），置于 `FLOOR_Y = −1.75` 上。
- 动画：腿角 = `A·sin(φ + offset_i)`，φ 随实际位移增长（不滑步）；身体 y 浮动 = 步频 2 倍；尾巴弹簧（速度越快摆越欢）；`sit` 下腿收起、尾巴慢摆。
- 与现有 `Doodles` 一样全部 `meshBasicMaterial` + `transparent`，不受光照、无阴影开销。

### 5.3 猫

- 位置：柜子顶（`CORRIDOR_FURNITURE` 的 cabinet，z −49）靠近相框。**叙事绑定**：相框里是 `beloved.jpg`，猫守着它。
- 状态：`sleep`（默认，一张闭眼线稿）→ 相机进入 8 单位内 `awake`（现有 `Cat` 组件的瞳孔跟随）→ 点击 `stretch`（0.8 s 缩放 + 轻微旋转，一声喵，解锁成就）→ 回 `awake`；相机离开 12 单位回 `sleep`。
- 入口页 `/` 的猫保持不动（它是那扇门的预览）。

### 5.4 无障碍与性能

- `prefers-reduced-motion: reduce`：狗直接 `sit` 在起点门旁不再移动；猫只在 `sleep`/`awake` 切换，无 `stretch` 动画（仍可点、仍给成就）；涂鸦浮动、虫子游走同一开关一并接入。
- 移动端 LOW 档不砍任何东西：合计 ~8 个透明平面。
- 纹理预算：新增门禁——`public/textures/corridor/companion/` 合计 < 200 KB、单张 < 60 KB（照 `textureBudget.test.ts` 模式扩到走廊）。

### 5.5 声音与文案

- sfx：`dog_bark`（点狗）、`cat_meow`（点猫）、`footstep`（P1）。全部 CC0，许可记入 `public/CREDITS.md`。
- 文案：成就名与描述、hover 提示（"点我"）进 `labUi`，中英各一份。

### 5.6 落点与测试

| 层 | 新增 | 测试 |
|----|------|------|
| `lib/lab/domain/corridor/companion.ts` | `CompanionState`、`stepCompanion(state, {camZ, v, phase, dt, reducedMotion})` 纯函数；常量 `LEAD`、`LANE_X`、`SIT_AFTER_MS`、`CENTER_EXCLUSION` | 单测：跟随距离收敛、静止→坐、进房→门口、**任何输入序列下 x 从不落入中央区**（属性测试式穷举）、reduced 下 z 不变 |
| `lib/lab/domain/corridor/layout.ts` + `schema.ts` | `CORRIDOR_COMPANIONS` 表（kind: dog / cat、锚点） | `roomRegistry.test.ts` schema + 资源存在性 |
| `lib/lab/domain/corridor/assets.ts` | 部件纹理路径规则 | 预载表 `--check` |
| `lib/lab/domain/achievements/defs.ts` | `pet_cat`、`dog_companion` | 现有成就门禁（`unlockedBy` 真实来源） |
| `context/` 或 `lib/lab/app/` | `useReducedMotion()` → `motionScale` | 单测 + E2E 一条（`reducedMotion` 仿真下狗 z 不变） |
| `components/lab/Companion/{Dog,Cat}.tsx` | 视图；`CorridorSegment` 或走廊层挂载 | 巡检截图逐帧看；E2E：走一段后 `data-lab-companion-state` 为 `trot/sit`，点猫成就出现 |
| `scripts/qa/lab-walkthrough.mjs` | Lab 巡检 | 人看 |

E2E 只能读 DOM：给 `lab-ui` 加 `data-lab-companion` 诊断属性（同 `data-lab-phase` 的做法）。**视觉仍靠巡检截图**。

---

## 6. 分期

| 期 | 内容 | 产出 |
|----|------|------|
| 0 | P0-c reduced-motion 开关 + P0-d Lab 巡检脚本 | 两个长期缺口关闭；后续每个 PR 都有截图可看 |
| 1 | P0-a 小狗 + P0-b 猫 + P1-c 成就 + 纹理预算门禁 | 走廊有活物 |
| 2 | P1-a 脚步声 + P1-b 叫声 | 声音层 |
| 3 | P2-a 三间房各一个可拨弄小物 | 房间有"手感" |
| 后 | P3 留言墙 | 等计划 B |

第 0、1 期合写一份 ADR（"走廊活物用分层纸偶 + 纯函数 reducer，不引入 GLTF / 物理"），设计 PR 与实现 PR 分开。

---

## 7. 待拍板

1. **素材**：分层纸偶（推荐，只需一张狗线稿 + 一张睡猫线稿）vs 逐帧 vs GLB。线稿谁来出：用现有猫 / 头像同一生成流程出图，我切部件；还是你有更喜欢的画风。
2. **狗的位置**：前方引路（推荐，符合"看得见的陪伴"，且门口等你 = 内容提示）vs 身后跟随（更真实但看不见）。
3. **叫声**：要不要 sfx（默认走 sfx 总线、尊重静音键）。
4. **第 0 期先行**：reduced-motion 开关 + 巡检脚本（推荐先做，各半天量级）。

---

## 附：调研来源汇总

标杆：Bruno Simon [2019](https://medium.com/@bruno_simon/bruno-simon-portfolio-case-study-960402cc259b) / [2025](https://www.awwwards.com/brunos-portfolio-case-study.html)、[Coastal World](https://www.awwwards.com/coastal-world-by-merci-michel-wins-site-of-the-month-august-2022.html)、[Igloo Inc](https://www.awwwards.com/igloo-inc-case-study.html)、[Henry Heffernan](https://threejs-journey.com/selection/henry-heffernan-portfolio)、[Jesse's Ramen](https://jesse-zhou.medium.com/jesses-ramen-case-study-77bae77ab5f0)、[Lusion](https://www.awwwards.com/sites/lusion-v3)、[Robby Leonardi](https://thefwa.com/article/the-making-of-robby-leonardi-s-interactive-resume)、[Thibault Introvigne](https://www.awwwards.com/sites/thibault-introvigne-portfolio)、[2025 盘点（Jay Ransijn / Messenger 等）](https://www.creativedevjobs.com/blog/best-threejs-portfolio-examples-2025)。
宠物与动画：[Quaternius 动物包 (CC0)](https://quaternius.com/packs/ultimateanimatedanimals.html)、[Kenney Cube Pets (CC0)](https://kenney.nl/assets/cube-pets)、[Reynolds steering](https://www.red3d.com/cwr/papers/1999/gdc99steer.pdf)、[Yuka](https://mugen87.github.io/yuka/)、[Codrops 交互角色](https://tympanus.net/codrops/2019/10/14/how-to-create-an-interactive-3d-character-with-three-js/)、[Wiggle bone](https://www.balazsfarago.dev/blog/wiggle-bone-inverse-kinematics)。
反面：[HN 2025](https://news.ycombinator.com/item?id=46206531)、[HN My Room in 3D](https://news.ycombinator.com/item?id=28496650)、[第一人称晕动缓解](https://nicolas.busseneau.fr/en/blog/2020/09/alleviating-motion-sickness-in-first-person-video-games)、[作品集反思](https://dev.to/i_m_vampire_/the-internet-lied-to-you-about-portfolio-websites-i18)、[react-three-a11y](https://github.com/pmndrs/react-three-a11y)。
音效：[Fantozzi's Footsteps (CC0)](https://opengameart.org/content/fantozzis-footsteps-grasssand-stone)、[freesound 许可说明](https://freesound.org/forum/legal-help-and-attribution-questions/35069/)。
未找到：网页端"跟随玩家的宠物"专门技术拆解；Awwwards 评委关于"跳过 3D 按钮"的明确表态。
