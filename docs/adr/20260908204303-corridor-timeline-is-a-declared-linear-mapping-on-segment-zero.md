# 20260908204303. 走廊时间线是第 0 段上一条声明式的线性年份映射；简历条目加结构化年份与城市字段，`period` 字符串由门禁保证一致

- 状态：已接受
- 索引：resume 的 Lab 走廊要「会讲履历」：墙脚有年份刻度、墙上按年份挂着经历 / 教育的手写便签、三扇窗透出三座城市此刻的天色。三条决定：① 时间线是 domain 里一份**声明**（`TIMELINE = { startYear: 2017, endYear: 2026, fromRelativeZ: −6, toRelativeZ: −90 }`）、只在第 0 段、z ↔ 年份线性，`year-mark` 与便签位置**由它派生**，不手写坐标；② `ExperienceItem` / `EducationEntry` 新增 `years: { start, end? }` 与 `cityId`，原 `period` 字符串保留给 Classic 显示，门禁 `contentYears.test.ts` 断言「解析 `period` 得到的年份 == `years`、en/zh 同值、`cityId` 合法」；③ 便签与刻度的落点由纯函数按地标表的避让区计算（不与门 / 家具 / 壁画重叠，同侧最小间距 2.4），门禁断言。判定原则：**位置是派生的，内容是声明的；两者都不许手写坐标**
- 日期：2026-09-08

## 背景

走廊今天是一条与简历内容无关的通道：门通向房间，墙上是装饰性壁画。Classic 形态有完整的时间线（`lib/content/{en,zh}.ts` 的 `experience` / `education`），Lab 里完全没有——一个招聘官在走廊里走 60 秒，除了门牌什么都不知道。

数据侧的现状：`period` 是自由字符串（`"2019 – 2021"`、`"Oct 2022 – Jun 2023"`、`"Sep 2024 – Present"`），`location` 也是（`"Beijing (China) · Silicon Valley (US)"`）。把它们画到墙上需要**数**：哪一年、哪座城。从字符串里现场解析等于把解析规则散到每个消费者。

空间侧的现状：走廊第 0 段从 relativeZ 0 到 −100，门在 −8 / −20 / −32 / −44 / −56，家具在 −27 / −49 / −63，壁画 13 个槽位，猫在 −68，段末门 −95。地标表（ADR 20260908172231）已经给每个占位物声明了 `keepOut`，壁画生成器据此避让。往墙上再放 10 个刻度 + 9 张便签 + 3 扇窗，**手写坐标必然撞**，而且下次挪一扇门就全错。

不决策会发生什么：便签坐标写死在组件里，撞了就人肉挪；年份从 `period` 里 `parseInt`，遇到 `"Present"` 各写一个特判。

## 选项

### 时间怎么映射到走廊

- **A1. 第 0 段线性**：`yearAt(z)` 是一条直线；84 单位铺 9 年，每年约 9.3 单位——比门距（12）略密，走一扇门约过一年多，节奏合适。只在第 0 段有：走廊无限延伸，但一个人的履历不无限。
- **A2. 每段一个时代**（第 0 段学生时代、第 1 段工作……）：段与段结构相同，时代感要靠内容差异撑，而后续段今天只有重复的门；且访客大多走不到第 1 段。
- **A3. 不做刻度只贴便签**：少一层结构；但便签之间没有尺，「2021 在哪」要靠读便签。刻度是便签的坐标轴。

### 年份从哪来

- **B1. 现场解析 `period`**：零字段改动；解析规则（`" – "`、月份缩写、`Present`）散在消费者里，en/zh 两份字符串还可能不一致。
- **B2. 新增结构字段 `years` / `cityId`，`period` 保留**：内容作者写两遍（字符串 + 数）；由门禁保证两遍一致——这与 ADR 20260822120808「不手写可派生的代码」方向相反？不是：`period` 是**展示文案**（可以写 `"Sep 2024 – Present"`），`years` 是**数据**，两者不是派生关系而是两种表达，门禁守的是一致性。
- **B3. 只保留 `years`，`period` 改为派生渲染**：Classic 时间线的文案格式有 4 种写法（年 / 年月 / Present / 中英不同），派生函数要覆盖所有格式，改动扩散到 Classic——本 ADR 明确「不改 Classic」。

### 落点怎么算

- **C1. 手写坐标**：见背景。
- **C2. 纯函数按地标表避让**：`placeYearMarks()` / `placeTimelineNotes(entries)`，输入是 `TIMELINE` + 地标表的 `keepOut`，输出带侧别的坐标；冲突时按确定性规则挪（先换墙，再沿 −z 推，最小间距 2.4）。可以在 vitest 里对全部条目断言零重叠。

## 决策

**A1 + B2 + C2。**

- `lib/lab/domain/corridor/timeline.ts`：`TIMELINE` 声明；`relativeZOfYear(year)` / `yearAt(relativeZ)`；`placeYearMarks()` 生成 2017–2026 十个 `year-mark` 地标（墙脚 y = −1.45，宽 0.5；侧别：优先左墙，同侧 3.5 单位内有门或家具则换右墙；落进段末门避让区则贴边）；`placeTimelineNotes(entries)`：每条经历 / 教育一张便签，z 取 `start + min(duration, 1)/2` 对应位置，侧别取**没有门在 6.5 单位内**的那面墙（都没有取与上一张相反的墙），同侧间距 < 2.4 时沿 −z 推；y = 1.15（壁画在 0.1–0.2 一带、高约 1.2，便签在其上方不相交）。`year-mark` 地标进 `CORRIDOR_LANDMARKS`（由派生函数展开），便签是壁画层的一种 `SketchSpec`（`timelineNote`，走 sketch 流水线，`docs/../sketch/AGENTS.md` 的三条规则适用）。
- `lib/content/types.ts`：`ExperienceItem` / `EducationEntry` 加 `years: { start: number; end?: number }`（`end` 缺省 = 至今）与 `cityId: CityId`；`CityId = 'sichuan' | 'kuala-lumpur' | 'london' | 'singapore' | 'beijing' | 'silicon-valley' | 'remote'`。
- 门禁 `__tests__/contentYears.test.ts`：对 en/zh 每条，`parsePeriod(period)` 的起止年 == `years`（`Present` ↔ `end` 缺省）；en 与 zh 的 `years` / `cityId` 相同；`cityId ∈ CITY_IDS`。门禁 `__tests__/timelinePlacement.test.ts`：刻度与便签零重叠、不落入任何 `keepOut`、每年恰一个刻度、`yearAt(relativeZOfYear(y)) === y`。
- 三扇窗（`window` 地标）落在按同一避让规则算出的三个空位：右 −12.5（伦敦）、左 −40.5（新加坡）、右 −62（北京）——顺着走恰是时间顺序。窗外天色由 `worldClock.ts` 的 `localHourIn(tz, now)` + `skyColorAt(hour)` 决定（纯函数、可注入 `now`）；**窗外允许有颜色**，走廊内部仍是米色系（About 那次「房间变蓝」的教训针对的是室内），饱和度上限与门贴纸同级（产品决定，写进规格 §3）。

**判定原则**：*位置是派生的，内容是声明的；两者都不许手写坐标。* 走廊里下一个「挂到墙上」的东西也按这个来。

## 影响

- 正面：走廊会讲履历；简历数据第一次有可计算的年份与城市；三扇窗让「此刻」进入走廊（伦敦的夜、新加坡的午后、北京的清晨同时出现）；便签与刻度不会因为挪门而错位。
- 负面：内容作者每条要多填两个字段（门禁替他检查）；便签 9 张 + 刻度 10 个是 19 张新的 `CanvasTexture`（按 `specKey` 缓存、Rough.js 运行时生成，不增加下载量，但首帧多约 19 次小画布栅格化——在 `LabLoader` 期间完成，不进交互帧）；壁画生成器的可用槽位因为窗的 `keepOut` 略减（实测三扇窗都不与现有 13 个槽位相交，壁画布局不变，巡检截图对比确认）。
- 影响面：新增 `domain/corridor/{timeline,worldClock}.ts`、`domain/sketch` 的 `timelineNote` / `yearMark` 两种 spec、`components/lab/{TimelineNotes,YearMarks,CorridorWindow}.tsx`（`CorridorWindow.tsx` 现为零引用死代码，重写复活）；改 `lib/content/{types,en,zh}.ts`、`domain/corridor/landmarks.ts`（`window` / `year-mark` 条目由派生函数填入）、`CorridorSegment.tsx`（两个 `return null` 的 case 接上组件）。规格见 `docs/specs/lab-corridor-story.md` §2–§3。

## 与既有 ADR 的关系

- [20260908172231](./20260908172231-corridor-world-state-single-writer.md)（地标一张表）：**沿用**。`year-mark` / `window` 是它预留的两种 kind，现在有了生成方与消费者。
- [20260903140619](./20260903140619-lab-external-assets-and-runtime-sketch.md)（Rough.js 运行时草图）：**沿用**。便签与刻度是 `SketchSpec` 的两种新 spec。
- [20260822120808](./20260822120808-portal-types-derived-from-schema.md)（不手写可派生的代码）：`years` 与 `period` 不是派生关系（见选项 B2 的辨析），门禁守一致性；本 ADR 与其不冲突。
- [20260908160918](./20260908160918-lab-companions-are-paper-puppets-on-the-rail.md)（活物）：猫在 −68，年份刻度 2023 落 −62 右墙、2024 落 −71.3 左墙，均不进猫的 `visitRadius`；避让函数把 `companion-anchor` 的 keepOut 也算进去。
