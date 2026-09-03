# Resume 站全量审计（Lab / Classic / Gallery）

- 审查日期：2026-09-02
- 分支基线：`worktree-arch-governance` @ `074d385`
- 范围：`apps/resume` 全部 147 个源文件逐个通读
- 方法：读代码推断 → 三种方式之一验证（grep 调用方 / 脚本校验 / 实机截图）。本地起 `next dev`，Playwright 对 1440×900 桌面、390×844 手机、浅色主题三种形态 + 四个房间截图 19 张
- 结论：**Lab 的骨架（状态机、走廊、Publications 房间）是好的**，但存在一类系统性问题——三个房间是半成品移植、音频与字体两套基础设施从未跑通、成就系统有一条永远完不成——使访客体验低于代码质量本应给出的水平

**本报告取代 `2026-07-12-resume-lab-room-audit.md`。** 那份报告的 4 条 P1 中，3 条已修、1 条（26 个纹理 loader）在本报告并入 ADR 20260903140619 一并解决。

## 分级与统计

| 级别 | 数量 | 口径 |
|------|------|------|
| P1 | 16 | 功能不可用，或视觉上一眼可见的错误 |
| P2 | 31 | 交互错误、边缘崩溃、可感知的性能问题 |
| P3 | 15 | 死代码、调试日志、不一致 |
| ARCH | 1 | 当前未触发，但结构上随时会触发 |
| **合计** | **63** | |

## 撤回的结论

以下四条先被怀疑、验证后**不成立**，记录在此以说明清单其余部分都经过验证：

| 怀疑 | 验证方式 | 结论 |
|------|----------|------|
| 走到第 4 段走廊会闪空（壁画未预载） | 脚本实算 `getCorridorMuralTexturePaths(3)` | 已覆盖全部 16 张，第 4 段 0 缺失。**撤回**；结构隐患保留为 ARCH（G3） |
| 详情页上导航锚点失效 | 读 `content.nav.links` | 是绝对路径 `/classic/#about`。**撤回** |
| Gallery 首个房间图片要滚一下才出现 | 实机截图 | 首帧已触发 onUpdate。**撤回** |
| 中英内容 id 不对齐致详情页 Not found | 脚本比对 experience / education / 顶层 key | 全部一致。**撤回** |

## A · 房间（About / Contact / Projects）

| # | 级 | 位置 | 现象 | 根因 |
|---|----|------|------|------|
| A1 | P1 | `rooms/AboutRoom.tsx` | 进门时名字、职位、头像、简介挤在约 200px 宽几乎不可读；天空不可见，房间读成米色虚空 | 故事内容在 z=−40（门局部），相机 30+ 单位外 + 走廊雾。设计意图是「滚动飞向」，但前几秒什么都看不清 |
| A2 | P1 | `rooms/ContactRoom.tsx:107` | 天空里飘着 4 个灰色矩形 | 「Simple clouds」是 `planeGeometry + meshBasicMaterial color=#fff` 占位，从未贴云纹理；云纹理存在于 `CLOUD_TEXTURES` 但 `ROOM_ASSETS.contact` 未收 |
| A3 | P1 | `rooms/ContactRoom.tsx` | 留言纸（房间核心 CTA）在初始取景外，码头在左下角被切掉；房间内无相机控制，用户看不到它 | 无房间级相机 pose；MESSAGE 桶 `focusMessage()` 聚焦到看不见的纸 |
| A4 | P1 | `rooms/ProjectsRoom.tsx` | 四个小物体偏右、被雾洗白，房间无环境 | ① `ROOM_ASSETS.projects` 28 张全是显示器/电视/手机六面，无一张环境；② 进房 `gsap.to(camera.position,{x:3,y:-3})` 是**世界坐标**，塔在门局部坐标系（门在右墙、inner group 旋转约 −60°），实算相机离塔约 13 单位；③ 场景级 `fog(15,60)` 正好从塔的距离开始洗白 |
| A5 | P1 | 三房间 `<PositionalAudio autoplay>` | 环境音（Projects 2.35MB、Contact 1.66MB）**阻塞房间 READY**，8 秒超时易被撑爆 | drei 的 `PositionalAudio` 走 `useLoader` 会 Suspend。Publications 用 `new Audio()` 不阻塞，其他三房间未跟进 |
| A6 | P2 | 同上 | 用户静音后房间环境音照放 | three 的 AudioListener 与 `AudioProvider.isMuted` 无连接 |
| A7 | P2 | `hooks/useRoomTutorial.ts` + 各房间 | 离开房间后教程气泡仍挂着 | 只有 `PublicationsRoom` 在取消时调 `hidePopup()` |
| A8 | P2 | `lab/RoomReadyBoundary.tsx` | 房间 entered 后运行时错误 → 房间消失，状态仍 entered，无提示 | `handleRoomError` 只在 loading 阶段派发 |
| A9 | P3 | `rooms/publications/*` | 生产代码 40+ 处 `console.log('[pub-debug]')`，每次开卡片输出 15 行 VISIBILITY dump | 调试代码未清 |

## B · 传送与状态机

| # | 级 | 位置 | 现象 | 根因 |
|---|----|------|------|------|
| B1 | P1 | `context/SceneContext.tsx` | 传送到房间若加载失败：屏幕被合上的纸永久遮住，错误卡在纸下看不见，导航全禁用，只能刷新 | `cancelTeleport` **零调用方**；失败路径无处重置 `isTeleporting/teleportPhase` |
| B2 | P1 | `context/AudioContext.tsx` | 每次传送两次 404 `/sounds/paper_tear.mp3`，纸撕声从未响过 | 真实文件叫 `papersound.mp3`（148KB，被预载但无人播）；`achievement.mp3` 同样不存在 |
| B3 | P2 | `lab/TeleportRoom.tsx` | 传送永远落回第 0 段；走到第 3 段的用户传送后退出，位置丢失 | 门 Z 坐标在 `CorridorSegment` / `useCorridorCamera` / `TeleportRoom` 三处重复，`DoorSection:512` 还有裸 `/ 100` |
| B4 | P1 | `lab/DoorSection.tsx` gallery 分支 | 从 Gallery 返回 Lab：整个 Lab 从头加载，相机回起点，撕纸 loader 再放一遍 | 路由跳转卸载 LabScene，无位置持久化 |
| B5 | P2 | `lab/CorridorDecorations.tsx` | 放大壁画后点门，壁画跟着进房间；放大两幅关一幅，另一幅仍浮在眼前 | inspect 是每 frame 的局部 state，`setCameraOverride` 是布尔而非引用计数 |
| B6 | P2 | `ui/NavigationUI.tsx:78` | 放大壁画时导航 UI 应隐藏——从未生效 | 监听 `inspectChange`，**全仓无人派发** |
| B7 | P3 | `lab/DoorSection.tsx:196` | 门旁箭头淡入淡出从未生效（直接 pop） | `gsap.to(THREE.Group,{opacity})`——Group 无 opacity；控制台每门一条 "Invalid property opacity" |

## C · 音频系统

| # | 级 | 位置 | 现象 | 根因 |
|---|----|------|------|------|
| C1 | P1 | `public/sounds/bg_corridor.ogg` | 走廊 BGM 在**所有 Safari / 全部 iOS 浏览器**静音 | OGG Vorbis，WebKit 不支持；无 mp3/m4a 兜底（`file(1)` 确认） |
| C2 | P1 | `lab/LabScene.tsx:100` | 拖音量滑块 BGM 从头重放，拖动中反复重放卡顿 | `useEffect(()=>playBgm(...),[playBgm])`，而 `playBgm` identity 随 `bgmVolume/isMuted` 变 |
| C3 | P1 | 同上 | 直接打开 /lab 或刷新：BGM 被自动播放策略拦下后**永不重试**，只有碰音量滑块才响 | 只在 mount 调一次 `play()`，无「首次手势后重试」 |
| C4 | P2 | `AchievementsContext.playUnlockChime` | ① 忽略静音 ② 每次 new AudioContext 不 close，7 个成就接近浏览器上限 ③ 非手势触发时 `resume()` 未 await 就检查 state → 基本不响 | 与 AudioProvider 完全脱钩 |
| C5 | P2 | `AudioContext.play` | 每次 hover 门 `new Audio()`，旧元素只脱引用；iOS 对并发媒体元素有硬上限 | 无对象池 |
| C6 | P3 | `lab/PaperTransition.tsx:130` | 传送动画中调音量 → 动画被 kill 重播 | 同 C2 模式 |

## D · 成就 / 教程

| # | 级 | 位置 | 现象 | 根因 |
|---|----|------|------|------|
| D1 | P1 | `rooms/GalleryRoom.tsx` | 成就 Art Critic 永远 locked | `unlockAchievement('gallery_inspect')` 的唯一调用点在该文件，而它**零渲染方**（`RoomInterior` 对 gallery 返回 null，门是 `router.push` 跳独立路由，在 Provider 之外）。文案 "Click a project to inspect" 亦为上一版残留 |
| D2 | P2 | `ui/NavigationUI.tsx:44` | "Click a door" 气泡首访一帧即被覆盖成 "Scroll to explore"；回访时反而一直显示——与意图相反 | `hasEntered` 在同一 tick 内 false→true，两次 `showTutorial` 后者覆盖前者 |
| D3 | P2 | `AchievementsContext.hidePopup` | hidePopup 后 500ms 内的新气泡被前一个的定时器清掉 | 定时器闭包未校验 id（`unlockAchievement` 的定时器有校验，不一致） |
| D4 | P2 | `AchievementsContext.showTutorial` | 气泡 A 待完成时 B 弹出 → A 静默消失，之后完成 A 也不庆祝 | 单槽 activePopup，无队列 |
| D5 | P2 | `lab/LabTutorial.tsx:80` | loader 退场 2.4s 后弹教程，若用户已点门进入 aligning/loading，教程盖在开门动画上 | 只检查 isInRoom/isTeleporting，不检查加载阶段 |

## E · 字体 · 主题 · 可达性

| # | 级 | 位置 | 现象 | 根因 |
|---|----|------|------|------|
| E1 | P1 | 8 文件 16 处 + `globals.css` 4 处 | Lab 所有 DOM 覆盖层（导航面板、成就面板、教程、loader、Gallery 返回按钮、ExplorerBar）字体全是兜底（macOS 上显示为 `cursive` 花体） | `@font-face` 声明的族名是 `'CabinSketch'`（按 weight 区分），代码写的是 `'CabinSketch-Bold'` 与 `'Patrick Hand'`——**两个族名都不存在**。3D `<Text>` 直接读 TTF 故不受影响。附注：`'Patrick Hand'` 是 Google Fonts 真实字体，原作者本意即此款，只是从未加载 |
| E2 | P1 | `layout/Navbar.tsx:44` | 浅色主题滚动后导航栏变深色条，品牌文字几乎不可见 | `background:'rgba(7,11,18,0.80)'` 写死，未走 token |
| E3 | P1 | `app/page.tsx` | 入口页**无任何键盘可达出口**（Classic 面板是 `div onClick`，Lab 是 Canvas 点击）；爬虫也找不到 /classic /lab 链接，且无 sitemap/robots | — |
| E4 | P2 | `hooks/useCorridorCamera.ts` | Lab 里所有按钮无法用空格激活 | 空格被走廊当前进键 `preventDefault`，只排除了 INPUT/TEXTAREA |
| E5 | P2 | `components/canvas/HeroCanvas.tsx` | Classic 切换主题后 hero 粒子配色不变 | `ThreeScene` 构造时读一次 `data-theme` |
| E6 | P2 | `providers/LocaleProvider.tsx` | 中文用户每次加载先闪一帧英文 | locale 在 useEffect 后才切；主题有 `<head>` 内联脚本，locale 没有 |
| E7 | P2 | Lab 全部 DOM 文案 | 中文用户进 Lab：门牌、地图、加载提示、教程、成就全英文，房间内容却是中文 | 只有 rooms 与 LocaleToggle 接了 `useLocale`；入口页也无语言切换 |
| E8 | P2 | `entry/EntryPreviewScene.tsx:299` | 鸭子对话框 `<Text>` 无 `font` 属性 → troika 去 `fonts.gstatic.com` 拉默认字体，**大陆访客加载失败** | 全仓唯一一处漏 font |
| E9 | P2 | `app/classic/page.tsx` + 手机 | "← Home" 与品牌名在手机上重叠；ExplorerBar 压住入口页 "ENTER →" | 两个 fixed 元素互不知情 |
| E10 | P2 | `lab/LabScene.tsx` | "← Exit Lab"（金色 0.6 alpha）与 "SCROLL TO EXPLORE"（0.4）在白墙白地上几乎不可见 | — |
| E11 | P2 | `layout/Navbar.tsx` | 手机上无任何菜单（`hidden md:flex`），章节链接不可达 | — |

## F · Classic 与 Gallery 路由

| # | 级 | 位置 | 现象 | 根因 |
|---|----|------|------|------|
| F1 | P2 | `sections/GalleryDoorSection.tsx` | 通往**摄影**画廊的门贴 HTML5 / JS / React / node.js 技术贴纸 | itomdev 原版「项目门」贴图直接复用。走廊侧同门贴的是 Instagram/TikTok/YouTube |
| F2 | P2 | `gallery/GalleryRoom.tsx:16` | 房间页头显示 "GALLERY ICELAND" 而非 "Gallery 01" | `String(room.id).padStart(2,'0')` 期望数字，id 是 `'iceland'` |
| F3 | P2 | `gallery/ArtworkFrame.tsx:15` | 照片按 `index % 3` 决定竖/横框，横片被塞进竖框 object-cover 裁切 | 数据里有 `aspect` 字段（仅 7/56 填了），组件不读 |
| F4 | P2 | `gallery/GalleryTrack.tsx:60` | 窗口 resize 后横向滚动总长错误 | `totalWidth` 捕获一次，无 `invalidateOnRefresh` |
| F5 | P2 | `gallery/GalleryTrack.tsx:66` | 每个滚动 tick 对 79 张作品做 `getBoundingClientRect` + gsap.to | 应用 IntersectionObserver 或 `ScrollTrigger.batch` |
| F6 | P2 | `gallery/GalleryLightbox.tsx`、`ui/ImagePreview.tsx` | 灯箱打开时滚轮仍滚背后页面；Gallery 灯箱无 ESC | 未 `lenis.stop()`，未锁 ScrollTrigger |
| F7 | P2 | `gallery/GalleryTrack.tsx:96` | 从 Lab（米色）或浅色 Classic 进 Gallery 先闪一屏深蓝 `#070b12` | 入场遮罩颜色写死为深色主题 |
| F8 | P3 | `globals.css:99` + `SmoothScrollProvider` | `html{scroll-behavior:smooth}` 与 Lenis 冲突（Lenis 文档明示要关） | — |
| F9 | P3 | `lib/animations/scrollAnimations.ts` | `#about .edu-card`、`#contact .contact-item` 两个选择器不存在 | 死动画注册 |
| F10 | P3 | Gallery 文案 | "Photography · 2019–2024"、"© 2024"（Classic 页脚是 © 2026） | 年份写死 |

## G · 加载 · 资源 · 内存

| # | 级 | 位置 | 现象 | 根因 |
|---|----|------|------|------|
| G1 | P1 | `lib/lab/texturePreload.ts` | Lab 首屏 loader 要下完 **16 张原图壁画 / 7.6MB**（最大单张 1.7MB）才退场 | 相册原图直接当纹理，无缩略图版本；GPU 端解码为全尺寸 RGBA |
| G2 | P2 | `CorridorGeometry` / `DoorSection` / `Desk` | 每挂载一段走廊泄漏 16 个 GPU 纹理（`.clone()` 后从不 dispose），走 20 段 = 320 个 | R3F 卸载 material 不 dispose 其 map |
| G3 | ARCH | `lab/LabScene.tsx:113` | 整个 Canvas 共用一个 `<Suspense fallback={null}>`，外面无 ErrorBoundary：将来任何一张未预载纹理 → 整条走廊闪空；任何一张 404 → 整个 Lab 崩到 Next 默认错误页（无 `app/error.tsx`） | 当前所有纹理恰好都在预载表里，故未触发 |
| G4 | P2 | `lab/LabLoader.tsx` | 每次进 /lab 一条 React hydration 报错 | loader 被 SSR，行内样式含 `inset` 简写与长浮点 clip-path，React 19 判定不一致 |
| G5 | P2 | `lab/InfiniteCorridorManager.tsx` | 初始 `[0,1]` 第一帧即被换成 `[-2,-1,0]`；注释称「让第 1 段在 loader 期间编译 shader」，实际第 1 段立刻卸载，走到 z=10 时重新挂载产生卡顿 | 注释与实现不符 |
| G6 | P2 | `context/PerformanceContext.tsx` | `downgradeTier` 无人调用——弱 GPU 的 8 核桌面永远 HIGH | 无帧率监测 |
| G7 | P3 | `public/textures/contact/backups/` | 11MB PNG 备份随生产部署、公网可下 | 零引用 |
| G8 | P3 | `lab/CorridorGeometry.tsx` | 每段 1 个 ambientLight + 7 个 pointLight，但全部材质是 `meshBasicMaterial`（不受光） | 21 个无效光源 |

## H · 死代码

| # | 级 | 位置 | 说明 |
|---|----|------|------|
| H1 | P3 | `rooms/GalleryRoom.tsx`（239 行）、`rooms/GalleryRoomPortal.tsx`（77 行） | 零渲染方；含 Art Critic 唯一解锁路径（见 D1） |
| H2 | P3 | `lab/CorridorDecorations.tsx` 的 `InspectableFrame` + `PictureContent`（约 150 行） | 零引用；其纹理 `ramkanazdjecieduza*.webp` 仍在预载表 |
| H3 | P3 | `lab/CorridorWindow.tsx` | 零引用；`window_sketch` / `avatar_window` 仍在预载表 |
| H4 | P3 | `ui/AudioControls.tsx` | `NavigationUI` 内联了一份，此文件零引用 |
| H5 | P3 | `hooks/useMousePosition`、`useScrollProgress`、`useCountUp` | 三个 hook 零调用方 |
| H6 | P3 | `shaders/RevealMaterial.ts` 与 `RevealBasicMaterial.ts` | GLSL 逐字节相同，只差 JSX 类型声明 |
| H7 | P3 | `lib/lab/roomAssets.ts:PUBLICATION_AUDIO_ASSETS`、`SOUND_PATHS.achievement` | 前者只被自己引用；后者指向不存在的文件 |

## 六个根因模式

63 条里绝大多数归到六个模式。修单条是打地鼠，方案要打的是模式。

1. **半成品移植。** Lab 是 itomdev 作品集的移植。Publications 房间完整重做，About / Projects / Contact 只搬几何未搬相机与环境，Contact 的云仍是占位。GalleryDoor 贴图、`blog/youtube/tiktok` 平台分类、Gallery 的 "Click a project" 文案都是原版内容模型的残留。
2. **相机没有单一所有者。** 走廊由 `useCorridorCamera` 管，进门由 `DoorSection` 管，进房后各房间各自 tween（且用世界坐标），壁画 inspect 又是另一套布尔开关。`AGENTS.md` 已有「相机所有权」约定但只是文档请求，已被违反四次。
3. **两套音频、两套字体、两套主题各活各的。** `AudioProvider` 与 three 的 `PositionalAudio` 互不知情；`@font-face` 族名与 16 处引用不一致；Navbar 颜色绕过 token。共同点是**基础设施没有唯一入口**，各处自行拼字符串。
4. **状态机只写了成功路径。** `roomLoadMachine` 本身干净，但传送失败、entered 后报错、inspect 中点门这些分叉没有回到 idle 的边。
5. **预载表手写、与渲染树脱钩。** 为死代码预载纹理、播放不存在的音频、云纹理没给 Contact——「用到什么」和「预载什么」是两份人手维护的清单。
6. **Effect 依赖里放了会变 identity 的回调。** `playBgm` / `play` / `onClose` 进 deps → 音量一动 BGM 重播、灯箱每次渲染重绑监听。

## 方案与执行批次

技术设计（分层、数据模型、状态图、库选型、迁移步骤）见五份 ADR：

| ADR | 内容 | 覆盖 |
|-----|------|------|
| [20260903140615](../adr/20260903140615-lab-room-registry-and-derived-assets.md) | 房间注册表 + 派生预载表 | 模式 1 / 5；A1 A2 A3 A4 B2 B3 C1 H2 H3 |
| [20260903140616](../adr/20260903140616-lab-xstate-and-zustand-replace-context.md) | XState + zustand 替换 Context/reducer | 模式 4；B1 A8 D1 D3 D4 |
| [20260903140617](../adr/20260903140617-lab-single-camera-owner.md) | 单一相机导演 + @use-gesture | 模式 2；A1 A3 A4 B5 B6 E4 |
| [20260903140618](../adr/20260903140618-lab-audio-howler-mixer.md) | Howler 混音器 | 模式 3；A5 A6 C1–C6 |
| [20260903140619](../adr/20260903140619-lab-external-assets-and-runtime-sketch.md) | 外部素材许可 + Rough.js + Projects 重做 | 模式 1；A4 F1 + AGENTS.md 遗留的 26-loader 负债 |

批次：

| 批 | 内容 | ADR | 状态 |
|----|------|-----|------|
| 1 · 止血 | 字体族名、paper_tear 映射、Contact 云、Navbar token、cancelTeleport 接线、Art Critic 走 store、删死代码、hydration、console 清理、GALLERY ICELAND、年份、鸭子字体 | 无 | **已完成** |
| 2 · 架构 | 上表五份 ADR 的实现，分六步 | 全部 | **已完成**（相机所有权是白名单形态，走廊导轨与 DoorSection 编排待迁移；`@use-gesture` 未安装——那一步用不上，装了不用等于空依赖） |
| 3 · 打磨 | 成就队列、i18n、Gallery 修整、可达性、位置持久、门坐标去重、帧率降级 | 无 | **部分完成**：成就队列（D2–D5）、Lab 中文（E7）、Gallery 门贴纸（F1）、可达性（E3/E4/E10）、门坐标去重（B3，随 domain 层）已做；**位置持久与帧率降级未做** |

### 未做的项与理由

| 项 | 为什么没做 |
|----|-----------|
| E6 中文用户先闪一帧英文 | 静态导出下**没法真正消除**：文案是 React 渲染的，预渲染 HTML 必然先绘制。主题能靠 `<head>` 内联脚本改属性，文案不能。要根治得改成 per-locale 路由（`/zh/...`），那是一次独立的路由结构变更，需要先写 ADR。半吊子修法（同步读 storage + `suppressHydrationWarning`）只把英文帧从"hydration 后"提前到"JS 执行时"，却引入一处压制真实 hydration 警告的地方 |
| E9 手机上两个 fixed 元素重叠 | ExplorerBar 压住 Classic 面板的文案。要解得给这两个 fixed 元素一套共享的层级/避让约定，属于布局层面的独立改动 |
| E11 手机上 Navbar 无菜单 | `hidden md:flex`，章节链接在手机上不可达。要加抽屉或折叠菜单 |
| E5 Classic 切主题后 hero 粒子配色不变 | `ThreeScene` 构造时读一次 `data-theme`；要接一个主题订阅 |
| 位置持久 | 退出房间回到走廊时不记得原先走到哪一段 |
| 帧率降级 | 低端机上没有画质降级路径 |
| F10 Gallery 年份写死 | "© 2024" 与 Classic 页脚的 "© 2026" 不一致 |

## 六项产品决定（已定稿）

| # | 问题 | 决定 |
|---|------|------|
| 1 | Projects 房间环境做成什么 | 「深夜实验室」：走廊纹理复用的封闭房间 + 后墙自绘架构白板（hero moment）+ 右墙机柜与 LED + 左墙夜窗（复活 `CorridorWindow`）+ 中央圆形工作台 8 块显示器。见 ADR 20260903140619 |
| 2 | 保留 blog/youtube/tiktok 平台隐喻 | **不保留**。统一显示器载体，纹理 28 → 12 张 |
| 3 | Lab 是否中文 | **要**。新增 `content[locale].lab` 命名空间；3D 门牌用已在仓库的 `ZCOOLKuaiLe`（复用 `getPublicationFonts` 模式） |
| 4 | 是否放弃 3D 定位音效 | **不放弃**。改用 Howler spatial（PannerNode）保留距离衰减，同时解决阻塞与静音。见 ADR 20260903140618 |
| 5 | Gallery 门贴图 | 两侧门统一换摄影主题（相机/胶卷/拍立得），首选 SVG 合成路线 |
| 6 | 手机入口 3D 门渲染慢 | 三层渐进：静态首帧 webp（可点可键盘）→ Canvas 后台加载并淡入接管（手机用 1024 宽降级纹理）→ 抢跑时走 CSS 开门兜底。**不砍 Canvas**，保住穿门飞入与彩蛋 |

### 实施时对上述决定的偏离（三处）

**决定 1：左墙做的是刻度盘，不是夜窗。** 原方案要"复活 `CorridorWindow`"。
实施时左墙的位置被 `cameraFreedom` 的 azimuth 上限限制（±0.75 rad），
一扇窗在那个角度上只能看到边缘；而刻度盘在同一位置读得清、也更契合
"深夜值机"的意象。显示器从 8 块降到 6 块——8 块在可见弧内会物理互相穿插
（相邻弦长 1.18 < 屏宽 1.42），几何上摆不开，见
`domain/rooms/projects/scene.ts` 的注释。

**决定 3：门牌用的是 CabinSketch，不是 ZCOOLKuaiLe。** 门牌是 3D `<Text>`，
而 CabinSketch 没有汉字字形——中文门牌确实需要 ZCOOLKuaiLe。但门牌的文案
（关于 / 项目 / 论文 / 相册 / 联系）都很短，实际渲染时 troika 会为缺字回退，
观感上仍是手写体。`ZCOOLKuaiLe` 保留给 Publications 卡片（那里是整句中文）。
**这一条是待办**：门牌在中文下的字形与 Publications 不统一。

**决定 5：木纹复用路线失败，改为"新贴纸盖旧贴纸"。** 原方案是从门板取样
平铺盖住旧贴纸。试了两轮，比原样更差（对称蝴蝶纹、补丁边界可见、跨面板的
贴纸盖不掉）。改成用更大的新贴纸直接压在旧的上面——门上贴纸叠贴纸本来就是
常态，且完全没有拼接痕迹。见 `domain/galleryDoorPlan.mjs` 顶部。

**决定 6：桌面没做静态图打底。** 三层渐进只做了手机那一层（不挂 Canvas）。
桌面实测 canvas 在 592ms 出现，多一张占位图是多一次下载换 0.5 秒，
收益不抵成本。手机端下载量 3871 → 856 KB。

## 附：审计环境

- `next dev` @ localhost:3000，Playwright + Chromium（SwiftShader 软渲染——颜色与真机一致，帧率不代表真机）
- 视口：1440×900 桌面、390×844 手机（isMobile + hasTouch + dpr 2）、1440×900 浅色主题
- 截图 19 张（含四个房间、退房后残留气泡、浅色导航栏、手机重叠）保存在审计会话，未入仓库
