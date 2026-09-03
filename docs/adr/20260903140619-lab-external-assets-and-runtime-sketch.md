# 20260903140619. Lab 引入外部创意素材，风格统一为手绘线稿；程序化草图用 Rough.js 运行时生成

- 状态：已接受
- 索引：resume 的 Lab 首次引入外部创意素材，限定为手绘线稿类并记录许可（Rough.js MIT、Excalidraw MIT、Khushmeen Doodle Icons 免费商用、Open Doodles CC0、Google Fonts OFL、freesound CC0）；重复性草图元素（白板高亮、便签、机柜、刻度盘）用 Rough.js 运行时生成 `CanvasTexture` 而非预制位图；Projects 房间据此重做为「深夜实验室」。注记：许可记录的落点 `apps/resume/public/CREDITS.md` 在本文写下时并未创建，已于 `20260903211338` 那批补齐；中文门牌的字形问题（`CabinSketch` 无汉字字形，troika 缺字时默认回退到 jsDelivr 拉 Noto，大陆访客看到空白门牌）由 `20260903211244` 那批修正为使用仓库内的 `ZCOOLKuaiLe` 并禁用外网回退。
- 日期：2026-09-03

## 背景

Lab 的视觉世界是 itomdev 作品集的移植（代码注释多处写明来源）：铅笔线稿贴在纸板上，hover 时经 `RevealMaterial` 的噪声擦除从线稿变成彩铅。移植时 Publications 房间被完整重做，`About` / `Projects` / `Contact` **只搬了几何没搬环境**，于是留下三处半成品，其中 Projects 最严重——它只有一座塔、一组代码字符粒子和一段音频，`ROOM_ASSETS.projects` 里 28 张纹理全是显示器/电视/手机的六面贴图，**没有一张是环境**（审计 A4）。

同时还留着一批与本站内容模型不符的原版残留：Gallery 门贴的是 Instagram / TikTok / YouTube 贴纸（走廊侧）与 HTML5 / JS / React 技术贴纸（Classic 侧）——而 `/gallery` 是摄影相册；`ProjectItem` 被硬分为 `blog / youtube / tiktok` 三种「平台」，决定它用显示器、电视还是手机作为载体——而本站项目不是自媒体内容。

要把 Projects 做成一个真正的「地方」（对齐 Publications 的完成度），需要的素材超出仓库现有资产：环境几何的线稿、技术图标、架构图、人物、若干音效。此前仓库从未引入外部创意素材，也没有记录许可的地方。

不决策会发生什么：要么 Projects 继续是米色虚空，要么在没有许可记录的情况下引入外部素材——后者对一个公开推 GitHub、且是求职作品集的站点是实际风险。

## 选项

- **A. 只用仓库现有素材做环境。** 优点：零许可风险、零新增下载。缺点：现有资产里没有任何适合做「实验室」的环境元素；能做出来的最好结果是把走廊纹理拼成一个空盒子，与 Publications 的完成度差距明显。
- **B. 引入外部素材，全部预制为位图。** 优点：运行时开销为零、可预测。缺点：便签、白板高亮层、机柜 LED、刻度盘这类元素需要「同一风格的无数变体」，预制会导致纹理数量爆炸（每个项目一张便签 = 8 张，加 hover 态 = 16 张）；且这些变体本质上是**程序化可生成**的。
- **C. 引入外部素材 + Rough.js 运行时生成重复性草图。** 静态的、独一份的（人物、架构图、图标、项目截图）走预制位图；重复性的、需要变体的（便签、白板高亮、机柜、刻度、电缆）用 Rough.js 画进 `CanvasTexture`，只画一次并缓存。优点：纹理数量与下载量都可控；变体无限且风格天然一致（Rough.js 就是 Excalidraw 的渲染引擎，与手绘线稿风同源）；这套「手写层」可复用到 About 的岛标签、Contact 的桶牌。缺点：+约 9KB gzip；低端机首帧多一次 canvas 绘制（缓解：只画一次、白板走预栅格）。
- **D. 换用低模 3D 模型（glTF）做环境。** 优点：生态素材极多（Poly Haven / Sketchfab CC0）。缺点：**与全站视觉语言冲突**——Lab 是纹理平面 + 线稿着色器的世界，低模 PBR 模型会明显打架；且模型体积远大于线稿纹理。

## 决策

选 **C**。

**判定原则：外部素材的选择先过「风格是否与既有视觉语言同源」，再过体积与许可；三者任一不过就不引入。** 这条原则直接否决了 D（生态最丰富但风格冲突）。

### 许可清单（本 ADR 的核心记录）

| 素材 | 许可 | 用途 |
|------|------|------|
| [Rough.js](https://roughjs.com/) | MIT | 运行时生成手绘 `CanvasTexture`：便签、白板高亮、机柜、刻度盘、电缆 |
| [Excalidraw](https://github.com/excalidraw/excalidraw) | MIT | **作者用的工具**，导出 SVG（内嵌 Virgil 字体）作白板架构图源；其渲染引擎即 Rough.js，风格同源 |
| [Doodle Icons](https://khushmeen.com/icons.html)（Khushmeen Sidhu） | 免费商用、无需署名 | 400+ 手绘技术图标，贴在便签与显示器旁 |
| [Open Doodles](https://www.opendoodles.com/)（Pablo Stanley） | CC0 | 草图人物；生成器可将墨色改为 Lab 的 `#2a1f0e` |
| Google Fonts: Patrick Hand、Caveat | OFL | 手写便签字体。**注**：`globals.css` 原本就引用了 `'Patrick Hand'`，只是从未加载——原作者本意即此款 |
| [freesound.org](https://freesound.org/) CC0 音效 | CC0 | 台灯开关、键盘敲击、铅笔划纸、机柜风扇 |
| 项目截图 | 自有 | Playwright 截自有站点 → sharp Sobel 边缘 + 纸纹叠加 → 草图化 webp |

许可文本与来源 URL 落在 `apps/resume/public/CREDITS.md`，随站点部署；`AGENTS.md` 指向它。

### 连带决定：去掉平台隐喻

`blog / youtube / tiktok` 三分类删除，所有项目统一用显示器载体。这使 `ROOM_ASSETS.projects` 从 28 张降到 12 张，顺带偿还 `apps/resume/AGENTS.md`「验收报告 P1 状态表」里登记的最后一条未修项（每个 `MonitorBlock` 无条件声明 26 个纹理 loader）。项目屏幕改贴草图化截图，`ProjectItem` 增 `image?` 与 `diagramNode?` 字段。

### 连带决定：Gallery 门两侧统一换图

走廊与 Classic 两扇 Gallery 门换成同一套摄影主题贴图（sketch + painted 双层，1024×2048，与现有门同规格）。首选路线：木纹复用现有门板，贴纸用 SVG 绘制（相机 / 胶卷 / 拍立得，`feTurbulence` 模拟彩铅质感），Playwright 栅格为 webp——零成本、可控、配色一致。若手绘感不足，改用 Figma Weave 以现有门为参考图生成（需单独批准积分消耗）。

### 预算约束

Projects 房间新增下载 ≤ 1.2MB（白板栅格约 180KB、人物 40KB、图标合图 60KB、8 张草图化截图约 480KB、机柜若走纹理 80KB）。Rough.js 生成物全部运行时产生、零下载，且**只画一次**缓存到 `CanvasTexture`（LED 灯带例外，64×512 逐帧很便宜）。

## 影响

- 正面：审计 A4（Projects 米色虚空）、F1（Gallery 门贴技术贴纸）与 AGENTS.md 遗留的 26-loader 负债一并解决；Projects 房间完成度对齐 Publications；建立仓库首份外部素材许可记录与「手写层」基础设施，可复用到其余房间。
- 负面：+约 9KB gzip；新增约 1.2MB 静态资产；引入 5 个外部素材来源需长期维护许可记录；Rough.js 绘制在低端机有一次性开销。
- 影响面：新增 `apps/resume/public/CREDITS.md`、`public/projects/**`、`public/textures/projects/**`、`public/textures/doors/**`（替换）、`lib/lab/infra/rough.ts`、`components/rooms/projects/**`、`scripts/media/{sketch-screenshots,rasterize-svg}.mjs`；重写 `components/rooms/ProjectsRoom.tsx`；改动 `lib/content/{types,projectsRoom,en,zh}.ts` 与 `components/sections/GalleryDoorSection.tsx`；`package.json` 增 `roughjs`、`sharp`（dev）。
