# 第三方素材与许可

resume.yibinfeng.com 用到的第三方字体、音频、图形素材与库的来源与许可。
ADR [20260903140619](https://github.com/FengYibin66/yibin-web/blob/main/docs/adr/20260903140619-lab-external-assets-and-runtime-sketch.md)
承诺过这份记录，但当时并未创建；本文按**实际装船的内容**补齐——不是按那份 ADR 的计划，
两者有出入的地方在文末「与 ADR 20260903140619 的出入」一节列明。

最后核对：2026-09-03。

## 字体

全部来自 [Google Fonts](https://fonts.google.com/)，均为 SIL Open Font License 1.1（OFL）。
仓库内以子集化后的 `.woff2`（DOM）与 latin 子集 `.ttf`（3D 文字，troika 不支持 woff2）装船；
原始 TTF 在 `apps/resume/media-src/fonts/`。

| 字体 | 版权 | 许可 | 用途 |
|------|------|------|------|
| [Cabin Sketch](https://fonts.google.com/specimen/Cabin+Sketch) | Copyright Impallari Type | OFL 1.1 | 标题、走廊门牌（英文） |
| [Fredericka the Great](https://fonts.google.com/specimen/Fredericka+the+Great) | Copyright Tart Workshop | OFL 1.1 | 装饰性大字 |
| [Rubik Scribble](https://fonts.google.com/specimen/Rubik+Scribble) | Copyright Rubik Project Authors | OFL 1.1 | 手绘感强调字 |
| [Patrick Hand](https://fonts.google.com/specimen/Patrick+Hand) | Copyright (c) 2010-2012 Patrick Wagesreiter | OFL 1.1（全文见 [`/fonts/PatrickHand-OFL.txt`](/fonts/PatrickHand-OFL.txt)） | 便签、手写标注 |
| [ZCOOL KuaiLe](https://fonts.google.com/specimen/ZCOOL+KuaiLe) | Copyright 2018 The ZCOOL KuaiLe Project Authors | OFL 1.1（全文见 [`/fonts/ZCOOLKuaiLe-OFL.txt`](/fonts/ZCOOLKuaiLe-OFL.txt)） | 中文手写体：论文卡片、走廊门牌（中文） |

**待补**：Cabin Sketch / Fredericka the Great / Rubik Scribble 三款的 OFL 全文尚未随仓库装船
（Patrick Hand 与 ZCOOL KuaiLe 已有）。OFL 要求随字体分发许可全文，这三份需要补上。

## 音频

| 文件 | 用途 | 来源与许可 |
|------|------|-----------|
| `bg_corridor.{m4a,ogg}` | 走廊背景音 | **来源未记录** |
| `amb_about.m4a` / `amb_projects.m4a` / `amb_contact.m4a` / `amb_publications.m4a` | 四间房的环境音（由 `media-src/sounds/szum*.mp3` 重编码而来） | **来源未记录** |
| `door_open.mp3` / `door_close.mp3` / `door_hover.mp3` | 门交互音效 | **来源未记录** |
| `papersound.mp3` | 传送时的撕纸声 | **来源未记录** |
| `achievement_chime.m4a` | 成就解锁提示音 | **来源未记录** |
| `baloonpoop.mp3` | 入口页彩蛋 | **来源未记录** |

**「来源未记录」是一条待偿负债，不是「无需署名」。** 这些文件由早于本仓库许可制度的提交
（`4b0b6104`、`349b28b3`）引入，当时没有登记来源。本次重构只做了格式转码与音量归一，
没有引入新音频。在来源查清之前，它们的再分发资格未经确认。

处置计划：逐个查证来源；查不到出处的，用 [freesound.org](https://freesound.org/) 的 CC0
音效替换并在此登记。

## 图形素材

走廊与入口页的手绘纹理（砖墙、石板路、树、窗、猫、鼠标、鸭子、涂鸦等，
位于 `public/textures/` 与 `media-src/textures/`）同样由上述早期提交引入，**来源未记录**，
与音频同一条负债。

门贴纸（`public/textures/{corridor,gallery}/*.webp`）由
`apps/resume/scripts/media/gallery-door.mjs` 在构建期**程序化生成**，
底图是仓库内的门板纹理，图形部分由 `scripts/media/stickerArt.mjs` 用代码绘制，无外部素材。

## 库

以下是**运行时会把代码发到访客浏览器**的第三方库中，需要署名或值得记录的部分。
完整依赖树见 `apps/resume/package.json` 与 `pnpm-lock.yaml`。

| 库 | 许可 | 用途 |
|----|------|------|
| [Rough.js](https://roughjs.com/) | MIT | 运行时生成手绘 `CanvasTexture`（白板图、便签、机柜、刻度盘）。Excalidraw 的渲染引擎 |
| [three.js](https://threejs.org/) | MIT | 3D 渲染 |
| [React Three Fiber](https://github.com/pmndrs/react-three-fiber) / [drei](https://github.com/pmndrs/drei) | MIT | three.js 的 React 绑定与组件库 |
| [troika-three-text](https://github.com/protectwise/troika) | MIT | 3D 文字（drei `<Text>` 的底层） |
| [camera-controls](https://github.com/yomotsu/camera-controls) | MIT | 相机轨道控制与阻尼 |
| [GSAP](https://gsap.com/) | 标准 GSAP 许可（免费层，无需署名；不含 Club 插件） | 编排动画（开门、传送、页面转场） |
| [Howler.js](https://howlerjs.com/) | MIT | 音频播放与 3D 定位 |
| [XState](https://stately.ai/docs/xstate) | MIT | 生命周期状态图 |
| [Zustand](https://github.com/pmndrs/zustand) | MIT | 共享状态 |
| [Next.js](https://nextjs.org/) | MIT | 框架（静态导出） |
| [React](https://react.dev/) | MIT | UI |

构建期工具（`sharp`、`fontTools`、`Playwright`、`vitest` 等）不进产物，未列入。

## 与 ADR 20260903140619 的出入

那份 ADR 的许可表列了六项计划引入的素材，实际装船情况如下——**记录在此以免下一个人
（或下一个 AI 会话）以为它们在仓库里**：

| ADR 里列的 | 实际 |
|-----------|------|
| Rough.js（MIT） | ✅ 已用 |
| Google Fonts OFL（Patrick Hand、Caveat） | ⚠️ 部分：Patrick Hand 已引入；**Caveat 未引入** |
| Excalidraw（MIT，作为白板图源） | ❌ 未用。白板图由 Rough.js 在运行时生成，没有导入任何 Excalidraw 导出的 SVG |
| Doodle Icons（Khushmeen Sidhu） | ❌ 未引入 |
| Open Doodles（CC0） | ❌ 未引入 |
| freesound.org CC0 音效（台灯、键盘、铅笔、风扇） | ❌ 未引入。Projects 房间没有新音效 |

ADR 不可变，所以那份文件的正文保持原样；它的 `索引：` 字段已追加前向指针指向本文与
ADR 20260903211338。
