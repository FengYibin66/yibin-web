# Lab 走廊：会讲故事的走廊（时间线 · 窗 · 加载显形 · 第二圈 · 路线 · 声音）

> 状态：**已批准**，随 ADR 20260908204302（路线）/ 20260908204303（时间线与窗）/ 20260908204304（声音）落地。
> 活物（狗、猫）另见 [`lab-companions.md`](./lab-companions.md)。架构落点见 `docs/architecture/lab-corridor-world.md`。
> 本文是产品行为的权威来源；数值以本文为准，实现里的常量必须能在这里找到出处。

## 0. 一句话

走廊第 0 段是一条 **2017 → 2026 的时间轴**：墙脚有年份刻度，墙上按年挂着经历与教育的手写便签，三扇窗透出伦敦、新加坡、北京此刻的天色；加载时走廊被「画出来」而不是等一个进度环；走第二圈时走廊记得你；不想操作的人点一下「带我走一遍」60 秒看完；一路听得见脚步、爪音、叫声与纸声。

## 1. 加载期：走廊被画出来（决定 D，实现时修订）

> **修订（2026-09-08 实现时）**：初稿要求「进度 ≥ 30% 提前撕开，看着走廊一笔笔画出来，
> 进度环收到右下角」。实现后限速到 2 Mbps 实测：撕开后是**一片空白**——走廊整个在一个
> Suspense 边界里，墙 / 地板 / 门要等最后一张纹理到位才一起出现，提前撕开只是让人对着
> 空页面等。要做到"边加载边画"得把 Suspense 边界拆到每个物件，那是另一次架构改动。
> 所以：**撕开仍在加载完成时**；"画出来"保留，改为**与撕纸同步的 1.8 s 过场**。

| 项 | 值 |
|---|---|
| 撕开时机 | 加载**稳定完成**（`useStableProgress` 的 `complete`），与修订前相同 |
| 画出来 | `RevealMaterial` 新增 uniform `uDraw`（0 → 1：透明 → 线稿，噪声擦除），由 `loadIntroInk(id, introDrawLevel(progress))` 驱动。加载中 `progress` 被压在 `INTRO_TEAR_AT`（0.3）以下 → 门一笔没画（反正在纸后面）；撕纸开始那一刻 `progress` 用 1.8 s 从 0.3 走到 1 → 五扇门按离入口的远近依次画出来。**范围是五扇门及门把**（走廊里用 `RevealMaterial` 的只有它们）；地板 / 壁画 / 墙面是普通材质，随纸撕开一次性出现 |
| 输入 | 首个进度事件起 `rail.hold('loader')`，完成时 `release`——这张纸 `pointerEvents: none`，滚轮原本能穿过去在纸后面把走廊滚跑 |
| 与稳态显形的关系 | `uDraw` 只管「有没有画出来」，`uProgress`（= `inkLevel`，ADR 20260908172231）只管「上没上色」；两个 uniform 独立，过场结束后 `uDraw` 恒 1、`uProgress` 由记忆 / 圈数 / 悬停决定 |
| reduced motion | 过场照常（出现内容不是运动）；撕纸动画本身按既有规则 |
| 门禁 | `corridorInk.test.ts`：`introDrawLevel` 端点与线性、与 `loadIntroInk` 串联；`usePaintMaterial.test.tsx`：`uDraw` 默认 1、setter 写 uniform；E2E `lab.spec.ts` 现有加载用例不变 |

## 2. 时间线（ADR 20260908204303）

### 2.1 映射

```
TIMELINE = { startYear: 2017, endYear: 2026, fromRelativeZ: -6, toRelativeZ: -90 }   // 只在第 0 段
relativeZOfYear(y) = fromRelativeZ + (y − startYear) / (endYear − startYear) × (toRelativeZ − fromRelativeZ)
```

2017 → −6，2018 → −15.3，… 2026 → −90。每年约 9.3 单位。

### 2.2 年份刻度（`year-mark` 地标，10 个）

- 位置：踢脚线上方 y = **−1.15**，宽 0.8、高 0.29 的手写年份（`SketchSpec: yearMark`）+ 一小段竖线刻度。第一版 0.5 × 0.18 贴墙脚，6 单位外约 28 × 10 px，没人看见（产品评审）。
- 侧别：**优先左墙**；同侧 3.5 单位内有门或家具 → 换右墙；两侧都有 → 取距离更远的一侧。落进段末门 `keepOut`（−95 ± 5.5）→ z 贴到 −89。
- 派生：`placeYearMarks()` 生成，进 `CORRIDOR_LANDMARKS`（`inkable: false`，**不声明 `keepOut`**——刻度在墙脚、壁画在墙中，不同高度不相交，声明了只会白白挤掉壁画槽位）。
- 结果（按规则算出，门禁校验）：2017 右 −6 · 2018 左 −15.3 · 2019 右 −24.7（左有书桌）· 2020 右 −34（左有出版物门）· 2021 左 −43.3（右有画廊门）· 2022 右 −52.7（左有联系门：3.3 < 3.5，第一版规格手算成了左）· 2023 右 −62（左有盆栽）· 2024 左 −71.3 · 2025 左 −80.7 · 2026 左 −89。

### 2.3 履历便签（`SketchSpec: timelineNote`，每条经历 / 教育一张）

- 内容：第一行 机构（`company` / `school`）、第二行 角色或学位、第三行 城市 · 年份区间（`years` 渲染，`Present` 按语言）。文字按可用宽度反解字号（sketch 三条规则）。
- 尺寸：便签 1.4 × 0.9 世界单位（纹理 448 × 288，宽高比一致），四角略不齐的纸 + 顶上一枚胶带。
- 位置：z = `relativeZOfYear(start + min(end − start, 1) / 2)`；y = **1.25**（壁画顶约 0.8，便签 0.8–1.7）；侧别取**没有门在 6.5 单位内**的那面墙，两面都没有 → 与上一张相反；同侧间距 < 2.4 → 沿 −z 推到满足。`placeTimelineNotes(entries)` 纯函数。
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

- 几何：窗框 1.5 × 1.5（复用 `window_sketch.webp`），y = 0.3；窗外一块 1.3 × 1.1 的天色平面，再往外一层 0.9 的城市剪影（`SketchSpec: skyline`，三座城各一组 6–9 个矩形轮廓，**斜线填充**不是实心块，墨色随天色——夜里深一档；罐头味刻意，是纸剪的）。
- 天色：`worldClock.ts`：`localHourIn(tz, now)`（`Intl.DateTimeFormat`，注入 `now`）→ `skyColorAt(hour)`：0–5 灰蓝 `#6b7385`（初稿 `#3b4a6b` 是全场唯一的饱和深块，剪影在上面对比只有 1.35:1——UX 评审）、5–7 灰粉 `#d9c6b8`、7–17 浅天 `#d6e0e8`、17–19 灰橙 `#d3bcac`、19–24 深蓝（第一版的 `#e8b89a` / `#cfe0ee` / `#e6a878` 饱和度 0.48–0.63，被下面那条门禁抓住）。**饱和度上限与门贴纸同级**（HSL S ≤ 0.35），走廊内部仍是米色系。每 60 秒重算一次（`setInterval`，不在 `useFrame`）。
- 窗下两行小字：城市名 + 当地时间 `HH:mm`（字号 0.12），第二行这座城在履历里的年份（`cityYearSpan`，字号 0.10、浅一档）——让窗与便签讲同一件事，不是一个世界时钟挂件。每分钟更新。
- 交互：无（原 `CorridorWindow` 的「头像从窗外探头」删掉——那是入口页的头像，放走廊里语义不通）。
- 门禁：`worldClock.test.ts`（三个时区在给定 `now` 下的小时、跨日、夏令时两侧各一例）；窗的 `keepOut` 半径 1.5 进地标表，`corridorLandmarks.test.ts` 的重叠检查覆盖。
- reduced motion：无运动可减。

## 4. 第二圈（`world.lap ≥ 1`）

走廊无限延伸、结构相同。第二圈要**可辨认**但不喧宾夺主：

| 变化 | 规则 |
|------|------|
| 未访问的门有底色 | `inkLevel`（lap ≥ 1 → `LAP_INK` = 0.55，已访问仍是 1）。**不是全上色**：全上色会抹掉「哪些看过」的记忆、与顶栏「已探索 N / M」互相否证（产品评审） |
| 段末门的正字计数 | 段末门上一枚 `SketchSpec: tally`，笔画数 = `lap`（上限 10，之后写数字）。第 0 圈无 |
| 猫 | lap ≥ 1 时初始态 `awake` 而不是 `sleep`；首次进入 `visitRadius` 冒一句 `companions.catAgain`（en `You again.` / zh `又是你。`），每圈一次 |
| 狗 | lap 切换那一帧 `greet` 一次，文案 lap = 1 用 `companions.dogLap`（en `Round two!` / zh `第二圈！`），lap ≥ 2 用 `dogLapMore`（`Again!` / `又一圈！`） |
| 年份刻度 / 便签 / 窗 | **不重复**——只在第 0 段（`segments: [0]`）。第 1 段起墙上只有壁画：履历讲一遍就够 |

## 5. 招聘官路线「带我走一遍」（ADR 20260908204302）

### 5.1 停靠表（`TOUR_STOPS`）

| # | landmarkId | standOff（停在地标前方） | dwell | 字幕键 `labUi.tour.*` |
|---|-----------|------------------------|-------|----------------------|
| 1 | welcome-avatar | 5 | 4 s | `welcome` |
| 2 | door-about | 4.5 | 3.5 s | `about` |
| 3 | door-projects | 4.5 | 3.5 s | `projects` |
| 4 | door-publications | 4.5 | 3.5 s | `publications` |
| 5 | door-gallery | 4.5 | 3 s | `gallery` |
| 6 | door-contact | 4.5 | 3.5 s | `contact` |
| 7 | year-2022（履历便签前） | 3 | 4 s | `timeline` |
| 8 | segment-door | 8 | 5 s | `end` |

> **修订（产品评审后）**：删掉猫站（招聘官的 60 秒不该花在猫上），换成一站停在履历便签前——
> 那是走廊里承载简历事实的东西；门前 standOff 7 → 4.5（7 时门只占画面一小块）；门站停留 4 → 3.5 s，
> 相册 3 s；字幕全部改为带事实的一句（见 `labUi.tour`）；最后一句**常驻到下一次输入**，
> 告诉访客下一步（点门 / 左上角完整简历）。

- 行进：`TOUR_SPEED = 4` 单位/秒（reduced 下 3），`scrollTo` 的 `duration = distance / speed`，ease `power1.inOut`。从起点 28 到段末门前共 **105** 单位（初稿估成 84，实现时按地标算出）→ 26 s；停留合计 30 s；**总计 56 s ≤ 60 s**（门禁 `tour.test.ts` 断言 `tourTotalMs() ≤ 60_000`；reduced 下 35 + 30 = 65 s ≤ 75 s）。
- 门前 standOff = 7 落在门自动侧目的峭峰（`GLANCE_PEAK_DIST = 8`）附近，相机会自然转向那扇门，不另写相机。
- 字幕：DOM 层（`NavigationUI` 底部一条纸带，与成就提示同款），每站一句 ≤ 40 字符（en）/ 18 字（zh）；最后一站「再走一圈，或者点一扇门进去 / Loop again, or step through a door」。

### 5.2 状态与退出

- `corridor.machine`：`corridor --TOUR_START--> touring`；`touring --INPUT | TOUR_END--> corridor`；`touring --DOOR_CLICK--> entering`。`teleporting` / `inRoom` 无 `TOUR_START` 边。
- 任何滚轮 / 方向键 / 触摸 / ESC → `INPUT` → 当帧退出，`rail.release('tour')`，正在进行的 `scrollTo` 中止在当前位置（不回弹）。
- `html[data-lab-mode]` ∈ `free | touring | teleporting | inRoom`；`world.mode` 同源。
- 入口：`NavigationUI` 顶栏按钮（图标：一只**爪印**——掌垫 + 三趾，不是脚印；`aria-label` 「带我走一遍 / Show me around」，`data-testid="nav-tour"`）；路线中按钮变为「停止 / Stop」。
- 引导（**2026-09-09 修订**，本行原写的「教程气泡提一次」已不是实现）：
  - 宽屏按钮带可见文字 `labUi.panels.tourLabel`；窄屏不带（顶栏三个按钮已贴着 320px 边界）。
  - 首访一次的 coach mark（`components/lab/TourCoachMark.tsx`）：贴按钮下方、箭头指向它、**整块可点直接开始路线**；`localStorage.lab_tour_hinted`，6 秒淡出，`pointerdown` / `touchstart` / `wheel` / `keydown` 任一发生立刻收起，路线中不显示，`prefers-reduced-motion` 下无过渡。
  - **决定：不走教程队列。** 原方案是 `labUi.tutorials.tour` 排进队列，实现过并被删掉——它挤掉了原有队列（「开始探索」关掉说明后立刻又冒一条，一条 E2E 断言因此红过；退房后房间教程被占位），当时改为「入口由按钮自己表达（实心反白 + aria-label）」。该结论不成立：`aria-label` 只有读屏用户听得到，而唯一的文字广告是**锁着的成就**的说明，在一个默认关闭的面板里。
  - 门禁：`__tests__/tourCoachMark.test.tsx`（淡出时机）+ `e2e/lab.spec.ts`（渲染几何与命中判定）。
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
