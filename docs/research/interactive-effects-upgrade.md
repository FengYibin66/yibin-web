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
