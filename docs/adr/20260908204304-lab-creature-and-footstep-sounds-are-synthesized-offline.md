# 20260908204304. Lab 活物与脚步的声音由仓库内脚本离线合成，不引入外部录音，也不在运行时合成

- 状态：已接受
- 索引：resume 的 Lab 新增玩家脚步、狗爪声、狗叫、猫叫、气泡冒出四类音效。决定：全部由 `scripts/media/synth-sounds.mjs`（纯 Node，无依赖，写 WAV）**离线合成**，经既有 `encode-audio.mjs` 编成 m4a + ogg 进 `public/sounds/`，在 `SOUND_MANIFEST` 登记、走 `sfx` 总线与既有的 3D 定位；风格刻意是**卡通短音**（滑音、短噪声脉冲），与纸世界一致，不追求拟真。不用外部 CC0 录音（许可与风格两头不可控）、不在运行时用 WebAudio 合成（重复 ADR 20260903140618 收编裸 AudioContext 前的状态）。判定原则：**声音是素材，素材走流水线；流水线的输入必须在仓库里可复现**
- 日期：2026-09-08

## 背景

走廊要有活物（ADR 20260908160918）与路线（ADR 20260908204302），架构文档 §10 第 5 期是「声：脚步、叫声、纸声」。调研（§3.4）读 Bruno Simon 的源码得到的最重要一条是：**顶级作品的「生气」来自声音与反馈，不来自模型**——鸟叫狼嚎只有声音没有实体。今天 Lab 有一套成熟的音频基础（ADR 20260903140618：Howler 混音器、三条总线、3D 定位、格式数组兜底 Safari），有 6 个音效文件（门开关、纸声、走廊底噪、气球），**没有任何活物或脚步的声音**。

现实约束：项目是单人 + AI 协作，**没有人能去录一声狗叫**；用户明确说「录不了，想办法」。

外部素材的既有纪律（ADR 20260903140619）：引入必须记录来源与许可。

## 选项

- **A. 外部 CC0 / 免费商用录音**（freesound、Pixabay 等）：真实；但每个站点的许可条款不同、下载要账号或 API key、同一批素材风格（录音环境、响度、混响）不统一要再处理；一只真狗的叫声放进纸世界会像贴错的贴纸——与活物 ADR 否决 GLB 低模是同一个理由。
- **B. 运行时 WebAudio 合成**（OscillatorNode + GainNode 现场出声）：零素材、零下载；但绕过了 Howler 混音器——总线音量、静音、3D 定位、并发池都要再做一遍，正是 ADR 20260903140618 把成就提示音从裸 AudioContext 收进混音器时清掉的那种分叉。
- **C. 仓库内脚本离线合成 → 走既有编码流水线**：一份纯 Node 脚本（无 npm 依赖，直接写 PCM WAV）生成源文件进 `media-src/sounds/synth/`，`encode-audio.mjs` 编成 m4a + ogg，进 manifest 后与门声、纸声完全同等地位（总线、静音、定位、池）。风格可控：全部是短促的卡通音（狗叫 = 两段带 FM 的短音，猫叫 = 带颤音的滑音锯齿波，脚步 = 低通噪声脉冲两个变体交替，气泡 = 一声极短的高频噼），与手绘线稿的世界一致；可复现：改参数重跑即得；许可：自有。成就提示音已有这个先例（`encode-audio.mjs` 头部记录了 ffmpeg lavfi 合成命令）。

## 决策

**C。**

- `scripts/media/synth-sounds.mjs`：纯函数式合成（正弦 / 锯齿 / 噪声 + ADSR 包络 + 一阶低通），44.1 kHz 单声道 16-bit WAV，写到 `media-src/sounds/synth/{footstep_a,footstep_b,paw_a,paw_b,dog_bark,cat_meow,bubble_pop}.wav`。参数与随机种子写死在脚本里，重跑逐字节一致。接入 `freshness.mjs` 指纹（`--check` 在 CI 由 `mediaFreshness.test.ts` 覆盖）。
- `encode-audio.mjs` 的列表加这 7 个源：m4a（AAC 64k 单声道）+ ogg（Vorbis q3），沿用格式数组兜底策略。
- `SOUND_MANIFEST`：`footstep_a/b`、`paw_a/b`（`sfx`，`pool: 2`）、`dog_bark`、`cat_meow`（`sfx`，`spatial` 与门 hover 同参数）、`bubble_pop`（`sfx`，`pool: 2`）。`soundManifest.test.ts` 已有的「manifest 里每个 src 文件存在」门禁自动覆盖。
- 触发规则在 domain（`domain/corridor/footsteps.ts`）：玩家每前进 1.8 单位一步、a/b 交替、音量按 `motionOf(velocity)` 分档（walk 0.5 / run 0.8），静止不响；狗在 `trot` / `run` 时每 0.9 单位一声爪音、音量 0.35、定位在狗的位置；狗叫在 `greet`、猫叫在 `stretch`；气泡冒出时 `bubble_pop`。触发是**基于位移**不是基于时间——与「开始探索」的判定同一理由（`exploration.ts`）：滚轮 / 键盘 / 触摸走同一条路径。
- `prefers-reduced-motion` **不影响声音**（减少动效不是减少声音）；静音仍由既有的总开关管。

**判定原则**：*声音是素材，素材走流水线；流水线的输入必须在仓库里可复现。*

## 影响

- 正面：走廊第一次「听得见」；零外部许可；风格与世界一致；参数可调可重跑；三条总线 / 静音 / 3D 定位一分钱不用重做。
- 负面：合成音的表现力有上限——「猫叫」是一声卡通滑音，不是真猫；7 个文件约 60 KB 下载（m4a）；多一个媒体脚本要维护（但与其他四个脚本同一套 `freshness.mjs`）。
- 影响面：新增 `scripts/media/synth-sounds.mjs`、`media-src/sounds/synth/`、`domain/corridor/footsteps.ts` + 单测、`hooks/useFootsteps.ts`；改 `scripts/media/encode-audio.mjs`、`lib/lab/domain/audio/manifest.ts`、`media-src/AGENTS.md`（登记新脚本与「自有合成」许可）、活物组件（挂叫声）。

## 与既有 ADR 的关系

- [20260903140618](./20260903140618-lab-audio-howler-mixer.md)（Howler 混音器）：**沿用**。新音效全部经混音器，不另起 AudioContext。
- [20260903140619](./20260903140619-lab-external-assets-and-runtime-sketch.md)（外部素材记录许可）：**不触发**——没有外部素材；`media-src/AGENTS.md` 登记「合成、自有」。
- [20260908160918](./20260908160918-lab-companions-are-paper-puppets-on-the-rail.md)（活物）：叫声与爪音是活物 reducer 输出的**事件**（`greet` / `stretch` / 位移累计）的消费者，reducer 本身不知道声音。
