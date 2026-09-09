# Lab 走廊：会讲故事的走廊（时间线 · 窗 · 加载显形 · 第二圈 · 路线 · 声音）

> 状态：**已批准**，随 ADR 20260908204302（路线）/ 20260908204303（时间线与窗）/ 20260908204304（声音）落地。
> 活物（狗、猫）另见 [`lab-companions.md`](./lab-companions.md)。架构落点见 `docs/architecture/lab-corridor-world.md`。
> 本文是产品行为的权威来源；数值以本文为准，实现里的常量必须能在这里找到出处。

## 0. 一句话

走廊第 0 段是一条 **2017 → 2026 的时间轴**：墙脚有年份刻度，墙上按年挂着经历与教育的手写便签，三扇窗透出伦敦、新加坡、北京此刻的天色；加载时走廊被「画出来」而不是等一个进度环；走第二圈时走廊记得你；不想操作的人点一下「带我走一遍」60 秒看完；一路听得见脚步、爪音、叫声与纸声。

## 1. 加载期：走廊被画出来（决定 D）

| 项 | 值 |
|---|---|
| 提前撕开阈值 | 加载进度 **≥ 30%** 时 `LabLoader` 的纸开始撕开（复用 `PaperTransition` 的撕痕） |
| 撕开后 | 进度环从屏幕中央收到**右下角**（直径 44 px、继续显示百分比），直到 100% 消失 |
| 画出来 | 所有 `inkable` 地标 + 地板 + 壁画的 `RevealMaterial` 新增 uniform `uDraw`（0 → 1：透明 → 线稿），由 `loadIntroInk(progress)` 驱动：`uDraw = clamp((progress − 0.3) / 0.6)`，即 30% 开始、90% 画完；地板沿 −z 方向画（`uDirection`），墙面物件用噪声擦除 |
| 输入 | 撕开到 100% 之间 `rail.hold('loader')`，玩家不能动；100% 后 `release` |
| 与稳态显形的关系 | `uDraw` 只管「有没有画出来」，`uProgress`（= `inkLevel`，ADR 20260908172231）只管「上没上色」；两个 uniform 独立，加载结束后 `uDraw` 恒 1、`uProgress` 由记忆 / 圈数 / 悬停决定 |
| reduced motion | **照常**——出现内容不是运动；但撕开动画本身按既有规则跳到终态 |
| 门禁 | `corridorInk.test.ts` 加 `loadIntroInk` 的单调性与端点；E2E `lab.spec.ts` 现有的加载用例不变（`lab-ui` 出现时机不变） |

## 2. 时间线（ADR 20260908204303）

### 2.1 映射

```
TIMELINE = { startYear: 2017, endYear: 2026, fromRelativeZ: -6, toRelativeZ: -90 }   // 只在第 0 段
relativeZOfYear(y) = fromRelativeZ + (y − startYear) / (endYear − startYear) × (toRelativeZ − fromRelativeZ)
```

2017 → −6，2018 → −15.3，… 2026 → −90。每年约 9.3 单位。

### 2.2 年份刻度（`year-mark` 地标，10 个）

- 位置：墙脚 y = **−1.45**，宽 0.5、高 0.18 的手写年份（`SketchSpec: yearMark`，字体走 `fontForText`）+ 一小段 0.3 的竖线刻度。
- 侧别：**优先左墙**；同侧 3.5 单位内有门或家具 → 换右墙；两侧都有 → 取距离更远的一侧。落进段末门 `keepOut`（−95 ± 5.5）→ z 贴到 −89。
- 派生：`placeYearMarks()` 生成，进 `CORRIDOR_LANDMARKS`（`inkable: false`，`keepOut` 半径 0.6 只对壁画生效）。
- 结果（按规则算出，门禁校验）：2017 右 −6 · 2018 左 −15.3 · 2019 右 −24.7（左有书桌）· 2020 右 −34（左有出版物门）· 2021 左 −43.3（右有画廊门）· 2022 左 −52.7 · 2023 右 −62（左有盆栽）· 2024 左 −71.3 · 2025 左 −80.7 · 2026 左 −89。

### 2.3 履历便签（`SketchSpec: timelineNote`，每条经历 / 教育一张）

- 内容：第一行 机构（`company` / `school`）、第二行 角色或学位、第三行 城市 · 年份区间（`years` 渲染，`Present` 按语言）。文字按可用宽度反解字号（sketch 三条规则）。
- 尺寸：便签 1.4 × 0.9 世界单位（纹理 448 × 288，宽高比一致），带折角与一枚胶带。
- 位置：z = `relativeZOfYear(start + min(end − start, 1) / 2)`；y = **1.15**；侧别取**没有门在 6.5 单位内**的那面墙，两面都没有 → 与上一张相反；同侧间距 < 2.4 → 沿 −z 推到满足。`placeTimelineNotes(entries)` 纯函数。
- 数据：`lib/content/{en,zh}.ts` 每条加 `years: { start, end? }` 与 `cityId`。当前条目：

| id | years | cityId |
|----|-------|--------|
| scujju | 2017–2021 | sichuan |
| um | 2019–2020 | kuala-lumpur |
| imperial | 2021–2022 | london |
| mcallister | 2022–2023 | london |
| nus | 2023–2025 | singapore |
| ai4sg | 2023–2025 | singapore |
| lumi | 2024– | remote |
| xueersi | 2025–2026 | beijing |
| epic | 2026– | silicon-valley |

- 门禁：`contentYears.test.ts`（`period` ↔ `years` 一致、en/zh 同值、`cityId` 合法）；`timelinePlacement.test.ts`（零重叠、不进任何 `keepOut`、每年一个刻度、往返映射精确）。
- 显形：便签 `inkable: false`（手写体本身就是线稿），但参与 `uDraw`（加载期被画出来）。

## 3. 三扇窗（决定 G，ADR 20260908204303）

| 窗 | 侧 | relativeZ | 城市 | 时区 |
|----|----|-----------|------|------|
| A | 右 | −12.5 | 伦敦 | Europe/London |
| B | 左 | −40.5 | 新加坡 | Asia/Singapore |
| C | 右 | −62 | 北京 | Asia/Shanghai |

- 几何：窗框 1.5 × 1.5（复用 `window_sketch.webp`），y = 0.3；窗外一块 1.3 × 1.1 的天色平面，再往外一层 0.9 的城市剪影（`SketchSpec: skyline`，三座城各一组 6–9 个矩形轮廓，罐头味刻意——是纸剪的）。
- 天色：`worldClock.ts`：`localHourIn(tz, now)`（`Intl.DateTimeFormat`，注入 `now`）→ `skyColorAt(hour)`：0–5 深蓝 `#3b4a6b`、5–7 橙粉 `#e8b89a`、7–17 浅天 `#cfe0ee`、17–19 橙 `#e6a878`、19–24 深蓝。**饱和度上限与门贴纸同级**（HSL S ≤ 0.35），走廊内部仍是米色系。每 60 秒重算一次（`setInterval`，不在 `useFrame`）。
- 窗下一行小字：城市名 + 当地时间 `HH:mm`（`fontForText`，字号 0.12），每分钟更新。
- 交互：无（原 `CorridorWindow` 的「头像从窗外探头」删掉——那是入口页的头像，放走廊里语义不通）。
- 门禁：`worldClock.test.ts`（三个时区在给定 `now` 下的小时、跨日、夏令时两侧各一例）；窗的 `keepOut` 半径 1.5 进地标表，`corridorLandmarks.test.ts` 的重叠检查覆盖。
- reduced motion：无运动可减。

## 4. 第二圈（`world.lap ≥ 1`）

走廊无限延伸、结构相同。第二圈要**可辨认**但不喧宾夺主：

| 变化 | 规则 |
|------|------|
| 门全部上色 | 已由 `inkLevel`（lap ≥ 1 → 1）保证，不另做 |
| 段末门的正字计数 | 段末门上一枚 `SketchSpec: tally`，笔画数 = `lap`（上限 10，之后写数字）。第 0 圈无 |
| 猫 | lap ≥ 1 时初始态 `awake` 而不是 `sleep`；首次进入 `visitRadius` 冒一句 `companions.catAgain`（en `You again.` / zh `又是你。`），每圈一次 |
| 狗 | lap 切换那一帧 `greet` 一次，文案 `companions.dogLap`（en `Round two!` / zh `第二圈！`，lap ≥ 2 统一用 `Again!` / `再来！`） |
| 年份刻度 / 便签 / 窗 | **不重复**——只在第 0 段（`segments: [0]`）。第 1 段起墙上只有壁画：履历讲一遍就够 |

## 5. 招聘官路线「带我走一遍」（ADR 20260908204302）

### 5.1 停靠表（`TOUR_STOPS`）

| # | landmarkId | standOff（停在地标前方） | dwell | 字幕键 `labUi.tour.*` |
|---|-----------|------------------------|-------|----------------------|
| 1 | welcome-avatar | 5 | 4 s | `welcome` |
| 2 | door-about | 7 | 4 s | `about` |
| 3 | door-projects | 7 | 4 s | `projects` |
| 4 | door-publications | 7 | 4 s | `publications` |
| 5 | door-gallery | 7 | 4 s | `gallery` |
| 6 | door-contact | 7 | 4 s | `contact` |
| 7 | resident-cat | 6 | 3 s | `cat` |
| 8 | segment-door | 8 | 5 s | `end` |

- 行进：`TOUR_SPEED = 3` 单位/秒（reduced 下 2），`scrollTo` 的 `duration = distance / speed`，ease `power1.inOut`。从起点 28 到段末门前约 84 单位 → 28 s；停留合计 32 s；**总计 ≤ 60 s**（门禁 `tour.test.ts` 断言 `tourTotalMs() ≤ 60_000`；reduced 下 ≤ 75 s）。
- 门前 standOff = 7 落在门自动侧目的峭峰（`GLANCE_PEAK_DIST = 8`）附近，相机会自然转向那扇门，不另写相机。
- 字幕：DOM 层（`NavigationUI` 底部一条纸带，与成就提示同款），每站一句 ≤ 40 字符（en）/ 18 字（zh）；最后一站「再走一圈，或者点一扇门进去 / Loop again, or step through a door」。

### 5.2 状态与退出

- `corridor.machine`：`corridor --TOUR_START--> touring`；`touring --INPUT | TOUR_END--> corridor`；`touring --DOOR_CLICK--> entering`。`teleporting` / `inRoom` 无 `TOUR_START` 边。
- 任何滚轮 / 方向键 / 触摸 / ESC → `INPUT` → 当帧退出，`rail.release('tour')`，正在进行的 `scrollTo` 中止在当前位置（不回弹）。
- `html[data-lab-mode]` ∈ `free | touring | teleporting | inRoom`；`world.mode` 同源。
- 入口：`NavigationUI` 顶栏按钮（图标：一只小脚印，`aria-label` 「带我走一遍 / Show me around」，`data-testid="nav-tour"`）；路线中按钮变为「停止 / Stop」。教程气泡在加载完成后提一次（`labUi.tutorials.tour`，作用域 `corridor`，不持久化）。
- 成就：完整走完解锁 `tour_complete`（en `Guided` / zh `被带着走了一遍`），中途退出不解锁。
- E2E：点 `nav-tour` → `data-lab-mode=touring` → 发一次滚轮 → `free`；再点 → 等到第 2 站字幕出现（`data-tour-stop="door-about"`）。走完全程**不在 E2E 里测**（软渲染 60 秒不可靠），由 `tour.test.ts` 用注入时间跑完，巡检脚本截 8 站。

## 6. 声音（ADR 20260908204304）

| 音效 | 触发 | 总线 / 参数 | 位移或状态来源 |
|------|------|-------------|----------------|
| `footstep_a` / `footstep_b` | 玩家每前进 **1.8** 单位一步，a/b 交替 | sfx，pool 2；walk 0.5 / run 0.8 | `getRail()` 的 z 累计（`domain/corridor/footsteps.ts`） |
| `paw_a` / `paw_b` | 狗 `trot` / `run` 每 **0.9** 单位一声 | sfx，0.35，spatial 在狗 | 狗 reducer 输出的位移 |
| `dog_bark` | 狗 `greet` 进入帧 | sfx，spatial | reducer 事件 |
| `cat_meow` | 猫 `stretch` 进入帧 | sfx，spatial | 猫状态切换 |
| `bubble_pop` | 任何气泡出现 | sfx，pool 2，0.4 | `speech.ts` 的 `show` |

- 合成参数（`synth-sounds.mjs`，全部 44.1 kHz 单声道）：脚步 = 60 ms 低通噪声脉冲（截止 900 Hz，a 与 b 截止相差 15%）；爪音 = 35 ms、截止 1.8 kHz、更轻；狗叫 = 两段 90 ms 的 FM 短音（载波 520 → 380 Hz，调制 40 Hz）间隔 70 ms；猫叫 = 450 ms 锯齿波 620 → 780 → 540 Hz 滑音 + 6 Hz 颤音，低通 2.4 kHz；气泡 = 25 ms 正弦 1.6 kHz 快速衰减。
- 静止不响；房间内不响（导轨不驱动时 `velocity` 衰减到 0，脚步自然停）；静音总开关照常；reduced motion 不影响。
- 门禁：`footsteps.test.ts`（步距、交替、静止不触发、房间内不触发）；`soundManifest.test.ts` 既有的文件存在检查覆盖新条目；`mediaFreshness.test.ts` 覆盖新脚本的指纹。

## 7. 验收清单（用户验收用）

1. 打开 `/lab`：进度到 30% 左右纸撕开，能看见走廊被一笔笔画出来，进度环在右下角；100% 后才能动。
2. 往前走：左右墙脚有年份，墙上方每隔一段有一张手写便签写着学校 / 公司 / 城市 / 年份；壁画位置与之前一致。
3. 右墙 −12.5 附近一扇窗：窗外是伦敦此刻的天色与剪影，窗下有时间；再走看到新加坡、北京两扇。三扇颜色不同（除非三地恰好同为白天）。
4. 一路有脚步声，跑得快声音大；停下没声。
5. 点右上「带我走一遍」：相机自己走，每到一处底下有一行字，60 秒内到段末门；期间滚一下轮，立刻停下还给你。
6. 穿过段末门进第二圈：门全上色、段末门上有一道正字、猫醒着说「又是你」、狗喊「第二圈」。
7. 系统开「减少动效」：以上全部仍可用，只是没有装饰性运动；声音不变。
