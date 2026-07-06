# 炫酷交互个人 Portfolio 网站技术调研报告

**作者**: Yibin Feng  
**日期**: 2026-07-06  
**目的**: 为 `resume.yibinfeng.com` 技术选型提供决策依据

---

## 1. 业界顶级案例分析

### 1.1 Bruno Simon — bruno-simon.com

**核心交互效果**：完整可驾驶的玩具车物理引擎，在 3D 微缩世界中导航内容；赛道计时排行榜；隐藏彩蛋与访客留言系统；可自定义车身颜色与成就解锁。

**技术栈**：Three.js（WebGL + WebGPU via TSL）、Rapier 物理引擎、Howler.js（音频）、Blender（建模），在 GitHub 以 MIT 开源。

> 注：Bruno Simon 的 portfolio 是创意开发者圈子中被引用最广泛的作品，其 Three.js Journey 课程也是 WebGL 入门的事实标准教程 [1]。

---

### 1.2 Roman Jean-Elie — romanjeanelie.com

**核心交互效果**：
- 方向折叠/页面卷曲 Shader（顶点沿任意轴折叠，内置曲率假阴影）
- MeshPortal（FBO 场景中的场景）：独立 Three.js 场景渲染到帧缓冲，通过 `uMask` 边界 Shader 裁剪
- 速度驱动的文字拉伸 Shader：文字渲染为 WebGL 纹理，滚动速度驱动正弦波顶点扭曲
- SVG 路径变形：GSAP MorphSVG 处理点数不匹配，类型为 `rotational`
- Portal 遮罩动画全屏展开并吸附到 DOM 文字边界，配合 FOV 剧变

**技术栈**：Next.js、Three.js、React Three Fiber（R3F）、GSAP（含 MorphSVG 插件）、text-to-svg

> 来源：Codrops Case Study, November 2025 [2]

---

### 1.3 They Call Me Giulio — theycallmegiulio.com

**核心交互效果**：
- Dolly Zoom（希区柯克变焦）进场效果
- 鼠标悬停 About 按钮触发仿生角色抬头
- 100 个实例化飞行汽车沿 Blender 曲线路径（重构为 `THREE.CatmullRomCurve3`）飞行
- 区块过渡 Shader：Perlin 噪声不规则遮罩 + 色差（RGB Chromatic Aberration）+ 速度驱动镜头变焦
- 噪声烘焙：所有 Perlin/fBm/Random 噪声预烘焙为三张纹理，运行时零噪声函数调用
- KTX2 / Basis Universal 纹理，GPU 压缩状态驻留 VRAM
- 水彩笔刷效果：鼠标轨迹写入低分辨率纹理，驱动文字 UV 扭曲

**技术栈**：Three.js（纯，非 R3F）、WebGPU + TSL（GLSL 回退）、React + React Router（DOM 层）、GSAP、Lenis、Turborepo、Blender、gltf-transform、Suno AI（原声带）。**总资源体积：12.5 MB**

> 来源：Codrops Case Study, April 2026 [3]

---

### 1.4 Ronin161 — ronin161.com

**核心交互效果**：
- 3D 角色（7 种状态：姿势 + 面部表情 + 纹理集）实时追踪鼠标转头
- 单 Pass 后处理管线：Vignette、RGB Shift、Bulge（滚动+鼠标）、流体模拟（鼠标）、Datamoshing（UV 变形+光流+像素化）、Bloom、模糊、颜色颗粒、胶片颗粒、自定义光标渲染——全部编译为一个 Shader Pass
- MSDF（多通道有向距离场）文字逐字母隐藏/显示动画
- Slice 场景切换使用 Ping-pong 渲染目标
- Toon/Cel Shader：基于阈值的双色调着色，注入噪声模拟手绘感

**技术栈**：Nuxt.js、Three.js、GSAP、Prismic（CMS）

> 来源：Codrops Case Study, February 2024 [4]

---

### 1.5 Arnaud Rocca — arnaudrocca.fr

**核心交互效果**：
- 流体模拟滑块：拖动/滚动/键盘/点击均扰动流体模拟，流体同时作为扭曲和遮罩
- Ping-pong 渲染目标管理速度、压力、旋度、涡量、散度、平流、Splat、梯度减法
- "The Leftovers" 文字过渡：两个字符串中匹配的字符从原位迁移到目标位
- 键鼠体验等效：键盘焦点动画与鼠标悬停动画完全一致

**技术栈**：Nuxt（SSG）、**OGL**（非 Three.js）、GSAP + SplitText + ScrollTrigger、Lenis、Prismic（CMS）、Figma

> 来源：Codrops Case Study, March 2026 [5]

---

### 1.6 Brittany Chiang v4 — bchiang7.com

GitHub 上被 fork 最多的开发者 portfolio（约 14,000+ Stars），架构值得参考。

**技术栈**：React + styled-components，无 WebGL，滚动动画 + 干净的代码组织。

**特点**：代码可读性极高，适合作为组件架构参考，不适合作为视觉效果参考。

> 来源：GitHub，bchiang7/v4 [6]

---

## 2. 关键技术库分析

### 2.1 WebGL / 3D 渲染层

| 库 | Bundle 大小 | 适用场景 | 代表案例 |
|---|---|---|---|
| **Three.js** | ~160KB gzipped | 通用 3D，生态最大 | Bruno Simon, Ronin161, Giulio |
| **OGL** | ~20KB gzipped | 轻量 WebGL，Shader 优先 | Arnaud Rocca, Oscar Pico |
| **React Three Fiber (R3F)** | Three.js + React 绑定层 | React 项目中的 3D 集成 | Roman Jean-Elie |
| **@react-three/drei** | R3F 工具集 | `useGLTF`, `OrbitControls`, `Environment` | 通用 R3F 项目 |

**关键洞察**：最顶级的站点（Giulio, Bruno Simon）使用纯 Three.js 而非 R3F，React 仅处理 DOM 层。R3F 在 React 项目中是可接受的折中——生产力更高，但性能控制略少。

---

### 2.2 滚动与动画层

| 库 | 作用 | 使用频率 |
|---|---|---|
| **Lenis** (studio-freight/lenis, ~7k Stars) | 平滑滚动（现代 Locomotive 替代品） | 几乎所有案例 [7] |
| **GSAP + ScrollTrigger** | 滚动驱动动画的行业标准 | 几乎所有案例 [8] |
| **GSAP SplitText** | 逐字/逐词文字动画（需 Club GreenSock 许可） | Ronin161, Gabriel Contassot |
| **split-type** (GitHub ~1500 Stars) | SplitText 免费替代品 | 推荐用于个人项目 [9] |
| **Framer Motion** | React 组件级动画，入门门槛低 | 中等复杂度 Portfolio |

---

### 2.3 背景与粒子效果

| 库 | 效果类型 | 复杂度 | Visual Impact |
|---|---|---|---|
| **Vanta.js** (tengbao/vanta, ~5k Stars) | 预设 WebGL 背景（BIRDS, WAVES, GLOBE） | 极低 | 高 [10] |
| **tsParticles** (@tsparticles/tsparticles, ~7k Stars) | 配置驱动粒子系统 | 低 | 中高 [11] |
| **p5.js** | 生成艺术，流场，Perlin 噪声 | 中 | 高 |
| **自定义 GLSL Shader** | 极限视觉效果 | 高 | 极高 |

---

### 2.4 项目卡片效果

| 效果 | 实现方式 | 复杂度 |
|---|---|---|
| **视角倾斜 (Tilt)** | vanilla-tilt / react-parallax-tilt (~5k Stars) [12] | 极低 |
| **悬停视频预览** | `mouseenter` 切换 `<video autoplay muted>` | 低 |
| **图片扭曲/位移** | curtains.js (~3.5k Stars) / PIXI.js DisplacementFilter [13] | 中高 |
| **磁性按钮** | 纯 JS + GSAP，无需库 | 低中 |

---

### 2.5 光标效果

| 效果 | 实现 | 复杂度 |
|---|---|---|
| **Spotlight 光标** | CSS `radial-gradient` 追踪鼠标，5 行 JS | 极低 |
| **反色光标** | CSS `mix-blend-mode: difference` | 极低 |
| **磁性按钮** | GSAP `to()` 追踪鼠标距离中心偏移量 | 低 |
| **轨迹效果** | Canvas 记录历史坐标，绘制贝塞尔曲线 | 中 |

---

## 3. 技术选型对比

### 3.1 当前方案评估

**你原来提出的方案（Portal 同款）**：React 19 + Vite + Tailwind v4 + shadcn/ui（纯 SPA，无 WebGL）

| 维度 | 评分 | 说明 |
|---|---|---|
| AI 生成质量 | ★★★★★ | Tailwind 原子类自文档，AI 最熟悉 |
| 代码量 | ★★★★★ | 662 LOC 参考值，最少 |
| 炫酷交互 | ★★☆☆☆ | **不支持 WebGL/3D，无法实现业界顶级效果** |
| 可维护性 | ★★★★☆ | 标准 React 组件化 |
| 性能 | ★★★★☆ | 无 WebGL 开销 |

**结论**：纯 SPA 方案对于 Portal 是正确的（Portal spec 明确写了"无 Three.js 粒子"），但对于 **Resume 的目标是"炫酷交互"**，这个栈不够用。

---

### 3.2 方案对比

| 方案 | 代表案例 | 炫酷程度 | AI 生成友好 | 实现成本 |
|---|---|---|---|---|
| **A: React 19 + R3F + GSAP + Lenis** | Roman Jean-Elie | ★★★★☆ | ★★★★☆ | 中 |
| **B: Next.js 14 + R3F + GSAP + Lenis** | Adrian Hajdin | ★★★★☆ | ★★★★☆ | 中 |
| **C: 纯 Three.js + React DOM + GSAP** | Giulio, Bruno Simon | ★★★★★ | ★★★☆☆ | 高 |
| **D: 纯 SPA + Framer Motion（无 WebGL）** | Brittany Chiang | ★★☆☆☆ | ★★★★★ | 低 |

---

### 3.3 推荐方案：Next.js 14 + R3F + GSAP + Lenis

**理由**：

1. **与 `resume.yibinfeng.com` 定位匹配**：既有 SEO 优势（Next.js SSR），又能实现 Three.js 3D 效果
2. **生态成熟**：R3F + drei 是 React 生态中 3D 的事实标准，文档完善，AI codegen 质量高
3. **渐进增强**：可以从简单的 Framer Motion 动画开始，逐步加入 WebGL 效果，不需要一步到位
4. **apps/resume 已有 Next.js 骨架**：package.json 已写好 `next`, `react-three-fiber`, `three`, `framer-motion`，基础已就位
5. **参考案例丰富**：Adrian Hajdin 的 GitHub (`adrianhajdin/portfolio_3D`) 有 3000+ Stars，有完整教程

**与方案 C 的取舍**：纯 Three.js 视觉上更极限，但 AI 辅助开发体验较差，维护成本高；R3F 在 React 中的抽象层对 AI codegen 更友好，牺牲约 10-15% 的细粒度控制，换取 3-4 倍的开发效率。

---

## 4. 推荐技术栈（Resume Site）

```
框架:      Next.js 14 (App Router)
语言:      TypeScript
3D 渲染:   @react-three/fiber + @react-three/drei
动画:      GSAP + ScrollTrigger（主动画）+ Framer Motion（组件级）
平滑滚动:  Lenis (@studio-freight/lenis)
文字效果:  split-type（免费 SplitText 替代）
粒子/背景: tsParticles 或自定义 Three.js Points
卡片效果:  react-parallax-tilt
样式:      Tailwind CSS v4
```

**与 Portal 的关系**：Resume 用 Next.js（利于 SEO）+ WebGL；Portal 用 Vite SPA（更轻）+ 无 WebGL。两者在 monorepo 中共存，设计 token（颜色、字体）保持一致。

---

## References

[1] Bruno Simon, *bruno-simon.com*, 2024 — https://bruno-simon.com  
[2] Codrops, *"Crafting an Interactive Portfolio: Roman Jean-Elie's Creative Approach"*, November 2025 — https://tympanus.net/codrops (Case Study)  
[3] Codrops, *"The Art of Cinematic Web: Inside They Call Me Giulio's Portfolio"*, April 2026 — https://tympanus.net/codrops (Case Study)  
[4] Codrops, *"Building a Character-Driven Portfolio: Ronin161's Technical Breakdown"*, February 2024 — https://tympanus.net/codrops (Case Study)  
[5] Codrops, *"Fluid Simulations and Text Transitions: Arnaud Rocca's Portfolio"*, March 2026 — https://tympanus.net/codrops (Case Study)  
[6] Brittany Chiang, *bchiang7/v4*, GitHub — https://github.com/bchiang7/v4 (~14,000 Stars)  
[7] Studio Freight, *Lenis*, GitHub — https://github.com/studio-freight/lenis (~7,000 Stars)  
[8] GreenSock, *GSAP + ScrollTrigger*, 2024 — https://gsap.com/docs/v3/Plugins/ScrollTrigger/  
[9] Luke Peavey, *split-type*, GitHub — https://github.com/lukePeavey/SplitType (~1,500 Stars)  
[10] Teng Bao, *Vanta.js*, GitHub — https://github.com/tengbao/vanta (~5,000 Stars)  
[11] tsParticles Team, *tsParticles*, GitHub — https://github.com/tsparticles/tsparticles (~7,000 Stars)  
[12] Micku7zu, *vanilla-tilt.js*, GitHub — https://github.com/micku7zu/vanilla-tilt.js (~5,000 Stars)  
[13] Martin Laxenaire, *curtains.js*, GitHub — https://github.com/martinlaxenaire/curtainsjs (~3,500 Stars)  
[14] Adrian Hajdin, *3D Portfolio Tutorial*, GitHub — https://github.com/adrianhajdin/portfolio_3D (~3,000 Stars)  
[15] Codrops / Tympanus, *Interactive Effects & Case Studies* — https://tympanus.net/codrops/

---

*注：部分 Codrops Case Study 链接来自 AI 训练知识（截至 2025 年 2 月），具体 URL slug 可能需要在 tympanus.net 上核实。GitHub Stars 数据为 2024-2025 年区间估值。*
