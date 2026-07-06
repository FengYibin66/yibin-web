# Dual Entry + Immersive Corridor — Design Spec

**Date:** 2026-07-07  
**Scope:** resume.yibinfeng.com 双入口架构 + 走廊体验（/lab）+ Classic 优化  
**Reference:** itomdev.com (portfolio-itom, MIT-equivalent open source)  
**Status:** Approved for implementation planning

---

## 1. Overview

用户访问 `resume.yibinfeng.com` 时看到一个分屏选择页，左侧"The Lab"（沉浸式3D走廊），右侧"Classic"（当前实现）。两侧各自通向独立路由。

---

## 2. Route Architecture

```
/           → 入口选择页（新）
/classic    → 当前 7-section 实现（原 / 平移）
/lab        → 3D 走廊沉浸体验（新）
/gallery    → 欧式画廊（已有，不动）
```

**技术约束：**
- Next.js 14 App Router，`output: 'export'`（静态）
- 所有新路由均为 `app/classic/page.tsx`、`app/lab/page.tsx` 形式
- 走廊场景必须 `next/dynamic(..., { ssr: false })`

---

## 3. 入口选择页（`/`）

### 视觉设计

全屏分割布局（Flexbox），左右各 50%。中间一条 `1px rgba(255,255,255,0.1)` 分隔线。

**左半（The Lab）：**
- 背景：走廊透视截图（静态 `public/lab-preview.webp`，从 itomdev 走廊截图或从 `/lab` 路由生成）
- 文字：
  - 大标题 `The Lab`（Space Grotesk Bold，白色）
  - 副标题 `Immersive · 3D · Interactive`（text-muted，小字）
- 右下角：`→` 箭头图标

**右半（Classic）：**
- 背景：当前 resume 截图（静态 `public/classic-preview.webp`）
- 文字：
  - 大标题 `Classic`
  - 副标题 `Clean · Fast · Standard`
- 右下角：`→` 箭头图标

### 交互（GSAP）

```
默认:   左 50% | 右 50%
Hover 左: 左 flex-basis → 68%, 右 → 32%，duration 0.5s ease power2.out
Hover 右: 右 flex-basis → 68%, 左 → 32%
Hover 任意: 对应背景 scale(1.05)，另一侧 scale(1.0)，duration 0.4s
Click:    router.push('/lab') 或 router.push('/classic')
```

**入场动画（页面首次加载）：**
- 两半从中间向外展开（初始宽度 0→50%），stagger 0.1s，duration 0.8s
- 文字从下方 translateY(20px)→0，opacity 0→1，delay 0.6s

### 底部
极小文字居中：`resume.yibinfeng.com · 2025`，`var(--text-muted)`

---

## 4. `/classic` 路由

### 改动内容

1. `app/page.tsx` 改为入口选择页（上方 Section 3）
2. 新建 `app/classic/page.tsx`：内容 = 原 `app/page.tsx` 全部内容，零功能变化
3. Navbar 的锚点链接更新为 `#about`（不变，因为是同页锚点）
4. **新增 GalleryDoorSection**（在 ContactSection 之后）

### GalleryDoorSection

**视觉：** 一扇欧式木质门，居中展示，占 section 全宽。

**门的实现方式（CSS 3D，非 R3F，保持 classic 路由轻量）：**

```css
.gallery-door {
  perspective: 1200px;
  /* 门框：深色木质渐变 */
  /* 门板：两扇，各 rotateY(0deg) → hover: rotateY(-70deg/70deg) */
  /* 门后光：box-shadow 内发光 #f5e6a3 暖黄色 */
  /* 标牌：The Gallery，Cormorant Garamond，金色 */
}
```

**交互：**
- Hover：左右两扇门各向外开启（CSS transition `transform: rotateY(-70deg)` / `rotateY(70deg)`）
- 门后：暖黄光晕 + 模糊虚影（代表画廊内部）
- 门下方标签：`The Collection · 2019–2024`
- Click：触发开门动画，500ms 后 `router.push('/gallery')`

**背景：** section 背景与当前 glass-card 深色主题保持一致，门在中央像一件"艺术装置"

---

## 5. `/lab` 路由——3D 走廊体验

### 技术栈

- **React Three Fiber v9** + **@react-three/drei v10**（已在 package.json）
- **GSAP 3.14**（已安装）
- Three.js v0.182（已安装）
- 贴图来源：`/Users/tal/Desktop/Code/personal_yibin/portfolio-itom/public/textures/` → 复制到 `apps/resume/public/textures/corridor/`

### 走廊场景规划

| Z 位置 | 节点 | 门贴图 | 对应内容 |
|--------|------|--------|----------|
| z=0 | 入口 | 正门 + 姓名标牌 | Hero：Yibin Feng, AI Engineer |
| z=-18 | About 门 | `drzwiabout.webp` | About + Skills |
| z=-32 | Projects 门 | `drzwiprojekty.webp` | Projects |
| z=-48 | Publications 门 | 论文标牌 | Publications / Research |
| z=-62 | Gallery 门 | `drzwisocial.webp` | → /gallery |
| z=-75 | Contact 门 | `drzwikontakt.webp` | Contact |

### 相机系统（来自 itomdev useInfiniteCamera.js）

```javascript
// wheel → targetZ
window.addEventListener('wheel', e => { targetZ.current -= e.deltaY * 0.025 })

// useFrame lerp（关键：smoothing=0.06 制造重量感）
currentZ.current = THREE.MathUtils.lerp(currentZ.current, targetZ.current, 0.06)
camera.position.z = currentZ.current
camera.position.x = parallaxX  // 鼠标视差 ±0.4
camera.position.y = 0.2 + parallaxY

// 自动瞥视门（在门 Z 位置附近自动偏转相机）
const doorZPositions = [-18, -32, -48, -62, -75]
const glanceOffset = computeGlance(currentZ, doorZPositions)
camera.lookAt(glanceOffset * 3.5, 0.13, currentZ - 10)
```

### 走廊几何（PlaneGeometry，无 Blender）

```jsx
// 地板
<mesh rotation-x={-Math.PI/2} position={[0, 0, -40]}>
  <planeGeometry args={[4, 100]} />
  <meshBasicMaterial map={floorTexture} />
</mesh>

// 左墙、右墙、天花板 — 同样用 PlaneGeometry + wall_texture.webp
```

### 进门交互

点击门：
1. `PaperTransition` 组件展开（白色纸张遮挡，直接用 itomdev 的动画逻辑）
2. Camera GSAP 飞入房间 overlay 位置
3. 纸张打开，展示对应内容（React overlay，在 Canvas 上方）
4. ESC / 返回按钮：逆向动画，回到走廊

### 房间内容实现

走廊 Canvas 之上叠一层 `position: fixed` 的 React DOM overlay。进入房间时这个 overlay 显示对应内容（直接复用 `/classic` 中的 AboutSection、ProjectsSection 等组件），走廊 Canvas 模糊在后面。

### 文件结构

```
app/lab/page.tsx                    # dynamic import LabScene, ssr:false
components/lab/
  LabScene.tsx                      # R3F Canvas + scene root
  CorridorGeometry.tsx              # 走廊几何体（墙、地板、天花板）
  CorridorDoor.tsx                  # 单扇门组件（贴图 + 点击 + painted shader）
  RoomOverlay.tsx                   # 进门后的 React DOM overlay
  PaperTransition.tsx               # 纸张过渡动画
hooks/
  useCorridorCamera.ts              # 相机 lerp + 瞥视 + 视差
  usePaintMaterial.ts               # hover painted shader（来自 itomdev）
```

---

## 6. 贴图资产处理

从 `portfolio-itom` 复制以下贴图到 `apps/resume/public/textures/`：

**走廊基础：**
- `textures/corridor/wall_texture.webp`
- `textures/corridor/floor_wood.webp`
- `textures/corridor/ceiling_texture.webp`
- `textures/corridor/bokilampy.webp`（灯）

**门：**
- `textures/corridor/doors/drzwiabout.webp` + `_painted.webp`
- `textures/corridor/doors/drzwiprojekty.webp` + `_painted.webp`
- `textures/corridor/doors/drzwikontakt.webp` + `_painted.webp`
- `textures/corridor/doors/drzwisocial.webp` + `_painted.webp`
- `textures/corridor/doors/klamkadodrzwi.webp` + `_painted.webp`（门把手）
- `textures/corridor/doors/doorrleft.webp` + `dorright.webp`（门板）

**装饰：**
- `textures/corridor/decorations/coffee_debug.webp`
- `textures/corridor/decorations/while_true_loop.webp`
- `textures/corridor/decorations/idea_process.webp`

**GalleryDoor（CSS 版）：**
- `textures/doors/door_left_painted.webp`
- `textures/doors/door_right_painted.webp`
- `textures/doors/handle_left_painted.webp`
- `textures/doors/handle_right_painted.webp`

---

## 7. 实现顺序（建议分阶段）

### Phase 1（本次计划）：入口页 + Classic 迁移
1. `app/page.tsx` → 入口选择页（GSAP 分屏，两扇门选择）
2. `app/classic/page.tsx` → 原内容平移
3. `app/classic/` 内新增 GalleryDoorSection（CSS 3D 木门）
4. Navbar 更新（两个路由下的 Navbar 各自调整 brand link）

### Phase 2（下一个计划）：走廊体验
1. 贴图复制到 public/
2. useCorridorCamera.ts
3. CorridorGeometry.tsx
4. CorridorDoor.tsx + usePaintMaterial.ts
5. RoomOverlay.tsx
6. PaperTransition.tsx
7. LabScene.tsx 组装
8. app/lab/page.tsx

---

## 8. 验收标准

### Phase 1
- [ ] 访问 `/` 看到左右分屏选择页
- [ ] Hover 左/右，对应半边展开 68%，GSAP 动画平滑
- [ ] Click 左 → `/lab`（暂时 404 或占位），Click 右 → `/classic`
- [ ] `/classic` 内容与原 `/` 完全一致
- [ ] `/classic` 末尾有 GalleryDoorSection，CSS 3D 门 hover 开门，click → `/gallery`
- [ ] Build 零错误，0 hydration warnings

### Phase 2
- [ ] `/lab` 走廊加载，相机随滚动前进（lerp 0.06 重量感）
- [ ] 鼠标移动产生视差
- [ ] 接近门时相机自动瞥视（约 15 度）
- [ ] 点击门触发纸张遮挡动画，进入房间 overlay
- [ ] 房间内容正确（About/Projects/Publications/Gallery/Contact）
- [ ] ESC 返回走廊
- [ ] 移动端降级提示（走廊体验需要桌面端）
