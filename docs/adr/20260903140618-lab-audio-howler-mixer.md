# 20260903140618. Lab 音频统一为 Howler 混音器；保留 3D 定位，但替换 drei 的 PositionalAudio 包装

- 状态：提议
- 索引：resume 的 Lab 音频收归 `lib/lab/app/audio/AudioMixer`（底层 howler.js + spatial 插件，三条总线 music/sfx/ambience），格式数组解决 Safari 不支持 OGG，自动解锁重试解决自动播放拦截；房间环境音保留距离衰减但不再阻塞房间 READY，全局静音对其生效；替换 `context/AudioContext.tsx`、drei `<PositionalAudio>` 与成就的裸 `AudioContext`
- 日期：2026-09-03

## 背景

Lab 现在有**三套互不知情的音频实现**：

1. `context/AudioContext.tsx` —— 走廊 BGM 与 2D 音效。每次调用 `play()` 都 `new Audio()`，旧元素只脱引用不回收（iOS 对并发媒体元素有硬上限）；`playBgm` 的函数 identity 依赖 `bgmVolume`/`isMuted`，而 `LabScene` 把它放进了 `useEffect` 的依赖数组——**拖一下音量滑块 BGM 就从头重放**（审计 C2），`PaperTransition` 同一模式（C6）；BGM 首次被自动播放策略拦下后**永不重试**，直接打开 `/lab` 或刷新时只有碰音量滑块才会响（C3）。
2. drei 的 `<PositionalAudio autoplay>` —— 三个房间的环境音。它内部走 `useLoader`，因此**会 Suspend**：Projects 的 2.35MB 与 Contact 的 1.66MB 音频挂在房间的 Suspense 边界里，8 秒加载超时很容易被音频撑爆（审计 A5）；它每个实例各建一个 `THREE.AudioListener`，与 `AudioProvider.isMuted` 没有任何连接，**用户静音后房间环境音照放**（A6）。
3. `AchievementsContext.playUnlockChime` —— 裸 `new AudioContext()` 合成提示音。忽略静音；每次解锁新建一个 AudioContext 且从不 close（7 个成就就接近浏览器上限）；`ctx.resume()` 未 await 就检查 `ctx.state`，非手势触发时基本不响（C4）。

另有两个资源侧问题：走廊 BGM 只有 `bg_corridor.ogg` 一种格式，**WebKit 不支持 OGG Vorbis，所有 Safari 与全部 iOS 浏览器完全静音**（C1）；`SOUND_PATHS.paper_tear` 指向不存在的文件（B2，由 ADR 20260903140615 的派生清单 + 存在性测试解决）。

不决策会发生什么：iOS 用户永远听不到 BGM 且不知道为什么；「静音」按钮对一半的声音无效；房间加载会被一个装饰性音频拖到超时。

## 选项

- **A. 保持 drei `<PositionalAudio>`，只修 AudioContext.tsx。** 优点：改动最小。缺点：A5（阻塞 READY）与 A6（无视静音）是 drei 那层包装的固有行为，不改它就修不掉。
- **B. 全部改成 HTMLAudio 池，放弃 3D 定位。** 优点：实现最简单，一套代码；`Publications` 房间已用 `new Audio()` 验证过此路径不阻塞、尊重静音。缺点：**失去距离衰减**——本设计评审时明确要求保留 3D 效果，「能实现更好的效果更好」。
- **C. 自写 `<Ambience>` 组件，直接用 `THREE.PositionalAudio` + 单一共享 listener。** 优点：保留 three 原生 3D 音频；`AudioLoader` 回调式加载不 Suspend；`listener.setMasterVolume()` 一处接静音。缺点：BGM 与 2D 音效仍需另一套实现（HTMLAudio），于是**仍然是两套音频**——这正是本 ADR 要消除的模式；格式兜底、池化、自动播放解锁重试三件事都要自己写。
- **D. Howler.js 统一，含 spatial 插件。** 一个混音器同时管 BGM、2D 音效、3D 环境音。优点：格式数组自动兜底（`['bg.m4a','bg.ogg']` 解 C1）；内置池化与精灵；自动播放被拦时**自动在首次用户手势后重试**（解 C3）；`Howler.mute()` 是真正的全局静音（解 A6 与 C4）；spatial 插件用 Web Audio `PannerNode` 提供与 `THREE.PositionalAudio` 同等的距离衰减模型（`refDistance` / `rolloffFactor` / `distanceModel` 参数一一对应），每帧把相机位姿同步给 `Howler.pos()` / `Howler.orientation()` 即可；加载走 XHR/回调，**不参与 React Suspense**（解 A5）。缺点：+约 10KB gzip；3D 音频从 three 的 AudioListener 换成 Howler 自己的 AudioContext，需要真机验证 iOS 上 PannerNode 的行为。
- **E. Tone.js。** 优点：能力最强。缺点：面向音乐合成，体积与复杂度远超需求。

## 决策

选 **D**。

**判定原则：同一关注点存在两套以上实现时，优先选一个能覆盖全部用例的成熟库，而不是给每个用例各留一套。** 选项 C 保住了 3D 效果但把「两套音频」这个根因留了下来；D 在保住 3D 效果的同时消除根因。

架构形态：

- `lib/lab/app/audio/AudioMixer.ts` 是唯一入口，暴露 `play / music / ambience / setBus / setMuted / syncListener / unlock`。
- 三条总线 `music / sfx / ambience` 各有独立音量，`Howler.mute()` 作用于全部。
- **状态（音量、静音）放在 `useAudioStore`（zustand，见 ADR 20260903140616），Mixer 订阅 store。React 组件不再持有 `play` 函数引用**——C2/C6 那类「回调进了 effect 依赖数组」的问题结构性消失。
- 环境音由 `RoomDefinition.ambience` 声明（见 ADR 20260903140615），进房 `ambience(id, pos)`、出房 `ambience(null)` 淡出；**房间 READY 与音频无关**。
- 成就音效改为 `play('achievement')`，删除 `playUnlockChime` 的裸 AudioContext。
- `useFrame` 里每帧 `syncListener(camera)`。

资源侧配套（本 ADR 一并决定）：走廊 BGM 追加 m4a 版本；三段房间环境音重编码为**单声道 64kbps**（环境音不需要 320kbps 立体声：Projects 2.35MB → 约 470KB，Contact 1.66MB → 约 660KB，About 411KB → 约 200KB）。编码脚本 `apps/resume/scripts/media/encode-audio.mjs`，通过 `ffmpeg-static` 作为 devDependency，输出入 git（静态导出需要）。

回退方案：若 iOS 上 spatial 表现不佳，关闭 spatial 改为按距离计算音量传给 `Howl.volume()`——howler 原生支持，代码改动仅限 `AudioMixer` 内部，不影响声明与调用方。

## 影响

- 正面：审计 A5（音频阻塞房间加载）、A6（房间环境音无视静音）、C1（Safari/iOS 完全静音）、C2/C3/C4/C5/C6（BGM 重放、永不重试、成就音效三个缺陷、无池化）全部消除；音频总下载量减约 3MB。
- 负面：+约 10KB gzip；3D 音频实现从 three 换到 Web Audio PannerNode，iOS 需真机验证（已备回退方案）；新增一个 ffmpeg 构建脚本与重编码后的音频文件。
- 影响面：新增 `apps/resume/lib/lab/app/audio/**`、`lib/lab/infra/howler.ts`、`scripts/media/encode-audio.mjs`；删除 `context/AudioContext.tsx`、`components/rooms/publications/publicationSceneryRuntime.ts` 的 `usePublicationCityAmbience`、`AchievementsContext.playUnlockChime`；改动三个房间组件去掉 `<PositionalAudio>`；`public/sounds/` 新增 m4a 与重编码文件；`package.json` 增 `howler`、`@types/howler`、`ffmpeg-static`（dev）。
