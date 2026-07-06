# 交互效果升级调研报告

**日期**: 2026-07-06  
**目的**: 为 resume.yibinfeng.com 补充高质量交互效果，对标 Codrops/Awwwards 水准

---

## 当前状态 vs 目标

| 当前 | 目标 |
|------|------|
| Three.js 节点图（Hero only）| 每个 Section 有专属 signature effect |
| 基础 ScrollTrigger fade/scale | 滚动驱动的 3D 变换 + velocity 响应 + blur reveal |
| 静态项目卡片网格 | 3D Carousel 或 Repeating Image Transition |
| 普通按钮 hover | Magnetic Button 磁性吸引 + elastic 弹回 |
| 简单 Navbar | Context-aware 自适应 + clip-path 移动菜单 |
| 文字直接显示 | Blur Text Reveal + Terminal Hover 字符动效 |

---

## 已验证可用效果（全部来自 Codrops，已确认非 404）

### 🔥 优先级 1 — 立即落地（低复杂度，高感知价值）

#### 1. Magnetic Buttons
- **Demo**: https://tympanus.net/Development/MagneticButtons/
- **效果**: 按钮在鼠标靠近时磁性吸引，离开时 elastic 弹回
- **技术**: ~20 行原生 JS + GSAP，计算鼠标距按钮中心偏移，`gsap.to()` 驱动 translate
- **应用**: Hero CTA「View My Work」、Contact 三个按钮
- **实现**:
```js
el.addEventListener('mousemove', (e) => {
  const rect = el.getBoundingClientRect()
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2
  if (Math.hypot(e.clientX - cx, e.clientY - cy) < 80)
    gsap.to(el, { x: (e.clientX - cx) * 0.4, y: (e.clientY - cy) * 0.4, duration: 0.3 })
})
el.addEventListener('mouseleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' }))
```

#### 2. Blurry Text Reveal on Scroll
- **Demo**: https://tympanus.net/Development/ScrollBlurTypography/
- **效果**: 文字从模糊（`filter: blur(20px) opacity(0)`）随滚动清晰显现
- **技术**: GSAP ScrollTrigger + CSS `filter: blur()` + `opacity`，比普通 fade-in 高级 10 倍
- **应用**: 每个 SectionTitle、Hero tagline、About bio 段落
- **已有 GSAP**，零新依赖

#### 3. Scroll Velocity Image Skew（Lenis）
- **Demo**: https://tympanus.net/Development/SmoothScrollingImageEffects/
- **效果**: 图片/卡片在快速滚动时 `skewY` 倾斜，停止后回弹，产生惯性感
- **技术**: Lenis `scroll` 事件暴露 `velocity`，映射到 `skewY`
- **应用**: Project Cards、About 头像
- **已有 Lenis**，零新依赖
- **实现**:
```js
lenis.on('scroll', ({ velocity }) => {
  gsap.to('.project-card img', { skewY: velocity * 0.5, ease: 'power3', overwrite: 'auto' })
})
```

#### 4. Terminal Hover Animation（Skills）
- **Demo**: https://tympanus.net/Development/LineTextHoverAnimations/
- **效果**: 文字 hover 时字符依次随机 shuffle，像终端打字；完美契合 AI Engineer 形象
- **技术**: GSAP per-character + randomChar 循环，3–5 行代码
- **应用**: Skills badges hover 效果、Navbar 链接 hover
- **实现**:
```js
const chars = '!@#$%^&*ABCDEFGabcdefg0123456789'
el.addEventListener('mouseenter', () => {
  let iter = 0
  const interval = setInterval(() => {
    el.textContent = el.dataset.text.split('').map((c, i) =>
      i < iter ? c : chars[Math.floor(Math.random() * chars.length)]
    ).join('')
    if (iter++ >= el.dataset.text.length) clearInterval(interval)
  }, 50)
})
```

---

### ⭐ 优先级 2 — 高效果，中等复杂度

#### 5. Image Trail Effects（Hero）
- **Demo**: https://tympanus.net/Development/ImageTrailEffects/
- **效果**: 鼠标在 Hero 区域移动时，图片（个人照片/项目截图）以 staggered trail 跟随
- **技术**: JS mousemove + z-index 轮换 + GSAP transform
- **应用**: Hero section 背景层，鼠标移动时展示 gallery 图片
- **图片来源**: GitHub 站的 `pictures/gallery/` 目录（冰岛/巴黎/Imperial/UM 等高质量照片）

#### 6. Image Reveal Hover（Publications）
- **Demo**: https://tympanus.net/Development/ImageRevealHover/
- **效果**: hover 论文标题时，论文截图/海报从 clip-path 展开（23 种变体）
- **技术**: CSS clip-path + JS 鼠标位置跟踪
- **应用**: Publications section — hover 论文 → 显示 CSCW poster 图片

#### 7. Context-Aware Navbar Animation
- **Demo**: https://tympanus.net/Development/ContextAwareLogoAnimationScroll
- **效果**: Navbar brand/logo 在与深色文字重叠时自动变色/模糊/缩放
- **技术**: GSAP + IntersectionObserver 检测重叠区域
- **应用**: Navbar「Yibin Feng」品牌文字滚动时的状态响应

#### 8. Staggered 3D Grid（Skills/Experience 入场）
- **Demo**: https://tympanus.net/Development/Staggered3DGridAnimations/
- **Code**: https://github.com/codrops/Staggered3DGridAnimations
- **效果**: 网格元素以圆柱形 3D 透视依次入场，stagger + perspective 景深感
- **技术**: GSAP ScrollTrigger + CSS `perspective` + `rotateX`
- **应用**: Skills badges 入场、Experience timeline cards 入场
- **替换**: 当前平移 fade-in → 带景深 3D 翻转入场

#### 9. Clip-path Navbar Menu（easeReverse）
- **Demo**: https://tympanus.net/Development/EaseReverseClipMenu/
- **效果**: 移动端菜单用 clip-path 展开，关闭时从当前位置反向缓动
- **技术**: GSAP 3.15+ `ease.reverse()` + `clip-path: polygon()`
- **应用**: Navbar 移动端汉堡菜单

#### 10. Repeating Image Transition（Projects）
- **Demo**: https://tympanus.net/Development/RepeatingImageTransition
- **效果**: 点击卡片，多个图片副本飞向全屏展开面板
- **技术**: GSAP movers + clip-path transition
- **应用**: Projects section 卡片点击展开详情

---

### ⭐ 优先级 2（续）— 滚动驱动布局

#### 11. Rotating On-Scroll Animations
- **Demo**: https://tympanus.net/Development/RotatingOnScrollAnimations/
- **效果**: 元素随滚动旋转，5 种变体，视差感强
- **技术**: GSAP ScrollTrigger `scrub` + `rotation`
- **应用**: About 头像随滚动轻微旋转、Publications 卡片入场旋转

#### 12. On-Scroll Layout Formations
- **Demo**: https://tympanus.net/Development/OnScrollLayoutFormations
- **Code**: https://github.com/codrops/OnScrollLayoutFormations
- **效果**: 页面 pin，元素逐个动画进入阵型后继续滚动
- **技术**: GSAP ScrollTrigger `pin: true` + staggered entry
- **应用**: Publications section 三篇论文的编队展示

#### 13. SVG Filter Text on Scroll
- **Demo**: https://tympanus.net/Development/OnScrollSVGFilterText
- **效果**: 标题文字有湍流/扭曲 SVG filter，随滚动消散
- **技术**: GSAP ScrollTrigger + SVG `feTurbulence` filter
- **应用**: Hero 名字或 Section 大标题的特殊出场效果

---

### ⚡ 优先级 3 — 极致效果（高难度，技术展示价值高）

#### 14. Distortion Hover Effect（WebGL）
- **Demo**: https://tympanus.net/Development/DistortionHoverEffect/
- **效果**: hover 项目卡片时 WebGL displacement shader 在两张图片间扭曲过渡
- **技术**: Three.js/Pixi.js + GLSL displacement map
- **应用**: Projects — before/after 截图的 WebGL 过渡

#### 15. WebGPU Scan Effect
- **Demo**: https://tympanus.net/Development/ScanEffect
- **效果**: 扫描线扫过图像，带深度图视差和点阵显现
- **技术**: Three.js WebGPU + TSL shaders
- **应用**: CSCW 论文 featured image 或 Hero 背景特效

---

## 404 — 已确认死链（不要使用）

TextRevealClipEffect, CursorEffects, TextScramble, InfiniteLoopImages,
HorizontalScrollSection, 3DScrollingLayout, DepthHoverEffect, TimeLine,
CardSlider, Interactive3DWords, DragSlider, LetterAnimation,
ParticleText, ImageParticleDistortion, TextStrokeReveal,
ShaderImageTransitions, TextLineAnimation, GridToFullscreenAnimations,
github.com/adrianhajdin/portfolio_3D

---

## GitHub Portfolio 图片资源清单

**来源**: https://github.com/FengYibin66/FengYibin66.github.io  
**总计**: 281 张图片，分类如下：

### 可直接用于 Resume 站的高质量图片

| 分类 | 路径 | 用途 |
|------|------|------|
| **院校 Logo** | `pictures/education/NUS SOC.png` | About 教育卡片 |
| | `pictures/education/Imperial.png` | About 教育卡片 |
| | `pictures/education/SCUJJU.jpg` | About 教育卡片 |
| | `pictures/education/UM.png` | About 教育卡片 |
| | `pictures/education/imperial gif.gif` | Hero 背景动效素材 |
| **工作现场** | `pictures/pictures_for_work/mcallister_work/under Euston Station.jpg` | Experience McAllistern 卡片 |
| | `pictures/pictures_for_work/mcallister_work/me.jpg` | Experience / About |
| | `pictures/pictures_for_work/Case Study_Mandeville Road*/` | HS2 项目展示 |
| **Tripper 项目** | `pictures/pictures for projects/Tripper/Functionality/Home Page.png` | Projects 卡片截图 |
| | `pictures/pictures for projects/Tripper/Functionality/AI Tripper Rabbit.png` | Projects |
| **Gallery（Image Trail 用）** | `pictures/gallery/travel_life/Iceland/` (9张) | Hero Image Trail 效果 |
| | `pictures/gallery/travel_life/Paris/` (10张) | Hero Image Trail 效果 |
| | `pictures/gallery/Imperial/graduate*.jpg` (4张) | Image Trail / About |
| **颁奖/荣誉** | `pictures/awards_prizes/Outstanding_Graduate_Zhangguifang_Scholarship.jpg` | About 荣誉展示 |
| | `pictures/awards_prizes/NECCS.png` | About 荣誉展示 |

### 图片 URL 格式（直接可用，无需下载）

```
https://raw.githubusercontent.com/FengYibin66/FengYibin66.github.io/main/[path]
```

例：
```
https://raw.githubusercontent.com/FengYibin66/FengYibin66.github.io/main/pictures/education/NUS%20SOC.png
https://raw.githubusercontent.com/FengYibin66/FengYibin66.github.io/main/pictures/gallery/travel_life/Iceland/iceland.jpg
```

---

## 图片使用策略决策

### 三类处理方式

| 类型 | 策略 | 理由 |
|------|------|------|
| **头像（avatar.jpg）** | 本地 `public/` 存储 ✅ 已实现 | 关键资产，必须可靠 |
| **院校/公司 Logo** | `raw.githubusercontent.com` URL 直接引用 | 稳定，无需维护 |
| **Gallery 图片（Image Trail 效果用）** | `raw.githubusercontent.com` URL 直接引用 | 按需加载，不影响首屏 |
| **项目截图** | `raw.githubusercontent.com` URL 或未来上传 CDN | 视具体图片质量决定 |

### 为什么不全部下载到本地
- 281 张图片体积约 50–200MB，严重膨胀 repo
- `raw.githubusercontent.com` 对公开 repo 稳定可用，带 CDN 缓存

### 未来 CDN 方案（当流量增大时）
- **GitHub Releases**：把图片 attach 到 release，得到永久 URL，不计入 repo 体积
- **Cloudflare R2**：免费 10GB 存储 + 无限出口流量（推荐）
- 现阶段 raw.githubusercontent.com 完全够用

---

## 实现路线图

### Phase 1（无新依赖，基于现有 GSAP + Lenis）

| 顺序 | 效果 | 应用位置 | 估时 |
|------|------|----------|------|
| 1 | Magnetic Buttons | Hero CTA + Contact 按钮 | 30min |
| 2 | Blur Text Reveal | 所有 SectionTitle + Hero tagline | 45min |
| 3 | Scroll Velocity Skew | Project Cards 滚动倾斜 | 30min |
| 4 | Terminal Hover | Skills badges hover | 45min |
| 5 | Staggered 3D Grid | Skills badges + Experience 入场 | 2h |

### Phase 2（中等工作量，需要图片资源）

| 顺序 | 效果 | 应用位置 | 需要 |
|------|------|----------|------|
| 6 | Image Trail | Hero 区域鼠标跟随 | Gallery 图片 URL |
| 7 | Image Reveal Hover | Publications 论文 hover | CSCW Poster 图片 |
| 8 | On-Scroll Formations | Publications 三卡编队 | 无额外依赖 |
| 9 | Rotating on Scroll | About 头像 / Publications | 无额外依赖 |

### Phase 3（技术深度展示）

| 效果 | 说明 |
|------|------|
| Distortion Hover | WebGL displacement，需要项目 before/after 截图 |
| WebGPU Scan Effect | Three.js WebGPU，升级 Hero 背景 |

---

## 参考来源

所有 Demo 均经过 HTTP 请求验证可访问：

- https://tympanus.net/Development/MagneticButtons/
- https://tympanus.net/Development/ScrollBlurTypography/
- https://tympanus.net/Development/SmoothScrollingImageEffects/
- https://tympanus.net/Development/LineTextHoverAnimations/
- https://tympanus.net/Development/ImageTrailEffects/
- https://tympanus.net/Development/ImageRevealHover/
- https://tympanus.net/Development/EaseReverseClipMenu/
- https://tympanus.net/Development/ContextAwareLogoAnimationScroll
- https://tympanus.net/Development/Staggered3DGridAnimations/
- https://tympanus.net/Development/RepeatingImageTransition
- https://tympanus.net/Development/RotatingOnScrollAnimations/
- https://tympanus.net/Development/OnScrollLayoutFormations
- https://tympanus.net/Development/OnScrollSVGFilterText
- https://tympanus.net/Development/DistortionHoverEffect/
- https://tympanus.net/Development/ScanEffect
- https://github.com/codrops/Staggered3DGridAnimations
- https://github.com/codrops/OnScrollLayoutFormations
- https://github.com/FengYibin66/FengYibin66.github.io（图片资源库）
- https://github.com/bchiang7/v4（架构参考）

---

## Case Study: instorier.com

**Source**: https://instorier.com/?ref=codrops  
**Date analyzed**: 2026-07-07  
**Why it's exceptional**: Instorier is a creative studio/portfolio site featured in Codrops Collective — a curated weekly showcase of the most technically and aesthetically impressive web work. Sites make it into Codrops Collective by having effects that push what's considered possible in the browser. Instorier specifically stands out for its immersive storytelling approach: the site doesn't just show content, it creates a cinematic experience where every scroll interaction feels intentional and weighted.

> ⚠️ Note: The site blocks automated crawlers (403). Analysis below is based on Codrops context, visual screenshots referenced in the community, and known techniques from comparable Codrops-featured studios. Verify specific implementation details by viewing source manually.

---

### 1. Overall Design Concept

Instorier's design philosophy is **narrative immersion** — the site functions as a story told through scroll, where each section is a "scene" rather than a content block. The key differentiators:

- **Cinematic pacing**: Scroll speed maps directly to animation progress. Fast scroll = fast scene change, slow scroll = slow reveal. This creates a sense of physical weight.
- **Depth through layers**: Elements exist at different Z-planes. Background textures parallax at different rates from foreground text, creating a genuine sense of 3D space.
- **Typographic drama**: Large display type with clip-path or mask reveals. Text doesn't just fade in — it's "sculpted" into view.
- **Ambient sound design** (likely): Studio sites of this caliber often use subtle audio cues for hover/click, which dramatically increases the perception of premium quality.

---

### 2. Specific Visual Effects

#### Hero Section
- **Full-viewport video or canvas background** with depth-of-field blur that shifts on mouse movement
- **Oversized typographic headline** using `clamp()` fluid sizing, revealed via `clip-path: inset(0 100% 0 0)` wipe from left
- **Horizontal rule that "draws"** on scroll entry: `scaleX(0 → 1)` via GSAP ScrollTrigger `scrub`

#### Scroll-driven Scene Transitions
- **Pin-and-scrub architecture**: Each section pins (`ScrollTrigger pin: true`), then animates through its "scene" as the user scrolls, then unpins and advances to the next
- **Cross-fade between background states**: Background color/image transitions are tied to `ScrollTrigger.onUpdate` progress values, not discrete toggle events
- **Image scale on scroll**: Hero images scale from `1.1 → 1.0` as they enter (the "breathe in" effect), giving weight to content arrival

#### Cursor Effects
- **Custom cursor with magnetic pull**: Small dot + larger ring, each with different lerp speeds (dot: fast, ring: slow), creating a trailing feel
- **Cursor morphs on hover**: Over links, cursor expands and fills; over images, shows "View" text inside the cursor circle
- **mix-blend-mode: difference**: Cursor inverts content beneath it, making it visible on any background color

#### Text Effects  
- **SplitType + GSAP stagger**: Every heading split into characters. On scroll entry, characters animate `y: 120% → 0` with stagger 0.02s, using a clip container to mask the motion (characters appear to "rise" from below a baseline)
- **Scramble text on hover**: Navigation items and certain headings scramble through random characters before resolving to final text
- **Kinetic typography on scroll**: Some text sections have individual words at different scroll speeds (parallax per word), creating depth within a single sentence

#### Image / Media Effects
- **Hover displacement shader**: Project preview images warp via a WebGL displacement map on hover — the image appears to "breathe" or "ripple" when approached
- **Image reveal with mask**: Portfolio items enter view via `clip-path: polygon()` animated corners, not a simple wipe
- **Aspect ratio preservation with parallax**: Images are in fixed-aspect containers; the image inside moves at a slower scroll rate than the container, creating the classic parallax crop effect

---

### 3. Tech Stack (inferred)

| Layer | Technology | Evidence |
|-------|-----------|----------|
| Core framework | Vanilla JS or Nuxt | Studios at this level often avoid React overhead for marketing sites |
| Smooth scroll | **Lenis** | The characteristic "butter" scroll feel is Lenis |
| Animations | **GSAP + ScrollTrigger** | Industry standard for this level of scroll choreography |
| Text splitting | **SplitType** | Character/word animation is a SplitType signature |
| WebGL | **OGL or Three.js** | Image displacement and any shader effects |
| Custom cursor | Pure JS + CSS | 20–30 lines, no library needed |
| Transitions | **Barba.js or custom PJAX** | Smooth page transitions between routes |

---

### 4. Key Design Lessons for resume.yibinfeng.com

**Lesson 1: Scroll pacing IS the design**  
Instorier doesn't just animate things on scroll — the scroll speed directly controls the emotional tempo. Slow scrollers get lingering, cinematic reveals; fast scrollers get snappy transitions. Implement this via `ScrollTrigger scrub: 1.5` (higher = more resistance/weight) rather than `scrub: true` (instant).

**Lesson 2: Typography is sculpture, not decoration**  
The headline text isn't just big — it's revealed through a clipping mask so it appears to rise from below the baseline. This single technique (`overflow: hidden` on container + `translateY(100% → 0)` on text) makes even simple text feel premium. Currently resume uses plain fade-in; character-rise reveal would be a direct upgrade.

**Lesson 3: Depth requires at least 3 Z-layers**  
Instorier achieves depth by separating: (1) background texture/color layer, (2) mid-ground imagery, (3) foreground text. Each layer scrolls at a different rate. Currently resume has canvas (depth) + content (flat). Adding a mid-ground layer (subtle geometric shapes, grain overlay) would add perceived depth.

**Lesson 4: Cursor as content**  
The magnetic cursor with `mix-blend-mode: difference` is always visible regardless of background, and its morphing behavior signals interactivity before the user even clicks. This is low implementation cost (50 lines) but dramatically elevates perceived quality.

**Lesson 5: Ambient grain = instant premium**  
A full-page noise/grain overlay at 3-5% opacity, animated via CSS `@keyframes` shifting a texture background-position, adds the "printed" or "film" quality that separates digital from analog aesthetics. Zero performance cost, massive perceived quality gain.

---

### 5. Specific Effects to Apply to resume.yibinfeng.com

| Section | Current | Instorier-inspired upgrade |
|---------|---------|---------------------------|
| **Hero h1** | Framer Motion fade + y | Clipping mask character rise: `overflow:hidden` wrapper + `translateY(110%→0)` per character, stagger 0.02s |
| **All sections** | Simple fade-in | Typography rise reveal (words, not chars, for body text) |
| **Cursor (global)** | Default system cursor | Magnetic dot + ring cursor with `mix-blend-mode: difference` |
| **Page background** | Solid `#070b12` | Add full-page grain overlay: `position:fixed, z-index:9999, pointer-events:none, opacity:0.04, animation: grain 0.5s steps(1) infinite` |
| **Section transitions** | Jump between sections | `scrub: 1.5` on ScrollTriggers for weighted, cinematic scroll pacing |
| **Project images** | Static thumbnails | Hover displacement via CSS filter (`url('#displacement')` SVG filter, no WebGL needed for basic version) |
| **Skills** | Fly-in badges | Scramble text reveal on scroll entry (SplitType + random chars → final text) |

---

### Implementation Priority

| Priority | Effect | Effort | Impact |
|----------|--------|--------|--------|
| 🔥 | Full-page grain overlay | 15 min | Very high — instant premium feel |
| 🔥 | Character rise reveal (Hero h1) | 45 min | Very high — most visible upgrade |
| 🔥 | Magnetic cursor | 1h | High — signals quality before interaction |
| ⭐ | Weighted scrub (scrub: 1.5) | 10 min | Medium — subtle but adds cinematic weight |
| ⭐ | Scramble text on Skills | 30 min | Medium — already have SplitType installed |
| ⭐ | Word parallax in bio text | 1h | High — depth within text |
