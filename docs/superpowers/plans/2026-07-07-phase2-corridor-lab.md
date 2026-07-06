# Phase 2: Immersive Corridor (/lab) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/lab` route as a full 3D corridor experience using React Three Fiber, where scrolling moves the camera through a hallway with 5 doors leading to About, Projects, Publications, Gallery, and Contact sections.

**Architecture:** Three layers: (1) R3F Canvas with corridor geometry (PlaneGeometry walls/floor/ceiling + door meshes), (2) `useCorridorCamera` hook ported from itomdev's `useInfiniteCamera.js` — wheel/touch → `targetZ` → lerp in `useFrame`, (3) React DOM overlay rendered above Canvas via `position:fixed z-50` that shows section content when a door is entered. Paper transition animation covers the scene during room enter/exit.

**Tech Stack:** Next.js 14 App Router (`output: 'export'`), React Three Fiber v9 (`@react-three/fiber`), `@react-three/drei` v9, Three.js 0.168, GSAP 3.14, TypeScript strict

## Global Constraints

- `output: 'export'` static site — no server APIs, `next/dynamic(..., { ssr: false })` on all R3F components
- `@react-three/fiber` and `@react-three/drei` must be added to `apps/resume/package.json` (they exist in the monorepo's pnpm store already — `pnpm install` will link them without downloading)
- `pnpm --filter @yibin/resume type-check` must pass (0 errors) after every task
- `pnpm --filter @yibin/resume build` must succeed after all tasks
- All R3F files use `.tsx` extension (TypeScript)
- Texture paths: `/textures/corridor/` (copied from portfolio-itom in Task 1 of this plan)
- Corridor doors at Z positions: About z=-18 (left), Projects z=-32 (right), Publications z=-48 (left), Gallery z=-62 (right), Contact z=-75 (left)
- Camera smoothing: `lerp factor = 0.035` (matches itomdev — produces weighted "heavy" feel)
- After every dev server use: kill process and clean ports 3000, 3001, 5173

---

## File Structure

```
apps/resume/
├── app/lab/page.tsx                         # MODIFY: replace stub with LabPage
├── components/lab/
│   ├── LabScene.tsx                         # CREATE: R3F Canvas root, Suspense, camera setup
│   ├── CorridorGeometry.tsx                 # CREATE: floor/walls/ceiling PlaneGeometry
│   ├── CorridorDoor.tsx                     # CREATE: single door mesh + hover painted shader
│   ├── RoomOverlay.tsx                      # CREATE: fixed-position DOM overlay for room content
│   └── PaperTransition.tsx                  # CREATE: white paper cover animation (GSAP)
├── hooks/
│   └── useCorridorCamera.ts                 # CREATE: camera lerp + door glance (ported from itomdev)
└── public/textures/corridor/               # CREATE: copied from portfolio-itom
    ├── wall_texture.webp
    ├── floor_wood.webp  (kawalekpodlogi.webp)
    ├── ceiling_texture.webp
    ├── bokilampy.webp
    └── doors/
        ├── drzwiabout.webp + _painted.webp
        ├── drzwiprojekty.webp + _painted.webp
        ├── drzwikontakt.webp + _painted.webp
        ├── drzwisocial.webp + _painted.webp
        ├── klamkadodrzwi.webp + _painted.webp
        ├── ramkasingledoors.webp
        ├── doorrleft.webp + dorright.webp
        └── backsingledoors.webp
```

---

### Task 1: Add R3F dependencies + copy corridor textures

**Files:**
- Modify: `apps/resume/package.json`
- Create: `apps/resume/public/textures/corridor/` (directory + files)

**Interfaces:**
- Produces: `@react-three/fiber` and `@react-three/drei` importable in resume app; texture files at `/textures/corridor/`

- [ ] **Step 1: Add R3F and drei to package.json**

Read `apps/resume/package.json` then add to `"dependencies"`:

```json
"@react-three/fiber": "^9.6.1",
"@react-three/drei": "^9.122.0"
```

- [ ] **Step 2: Install**

```bash
cd /Users/tal/Desktop/Code/personal_yibin/yibin_web
pnpm install
```
Expected: packages link from monorepo store (no download needed, they're already in `.pnpm`)

- [ ] **Step 3: Copy corridor textures**

```bash
SRC=/Users/tal/Desktop/Code/personal_yibin/portfolio-itom/public/textures/corridor
DEST=/Users/tal/Desktop/Code/personal_yibin/yibin_web/apps/resume/public/textures/corridor

mkdir -p "$DEST/doors"

# Base corridor textures
cp "$SRC/wall_texture.webp" "$DEST/"
cp "$SRC/kawalekpodlogi.webp" "$DEST/floor_wood.webp"
cp "$SRC/ceiling_texture.webp" "$DEST/"
cp "$SRC/bokilampy.webp" "$DEST/"

# Door textures
for f in drzwiabout drzwiprojekty drzwikontakt drzwisocial klamkadodrzwi; do
  cp "$SRC/doors/${f}.webp" "$DEST/doors/"
  cp "$SRC/doors/${f}_painted.webp" "$DEST/doors/"
done
cp "$SRC/doors/ramkasingledoors.webp" "$DEST/doors/"
cp "$SRC/doors/doorrleft.webp" "$DEST/doors/"
cp "$SRC/doors/dorright.webp" "$DEST/doors/"
cp "$SRC/doors/backsingledoors.webp" "$DEST/doors/"

echo "Copied:"
ls "$DEST/" && ls "$DEST/doors/"
```

- [ ] **Step 4: Type-check**

```bash
pnpm --filter @yibin/resume type-check 2>&1 | tail -3
```
Expected: clean

- [ ] **Step 5: Commit**

```bash
git add apps/resume/package.json apps/resume/public/textures/corridor/
git commit -m "feat(lab): add R3F/drei deps, copy corridor textures from portfolio-itom

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: useCorridorCamera hook

**Files:**
- Create: `apps/resume/hooks/useCorridorCamera.ts`

**Interfaces:**
- Consumes: `useFrame`, `useThree` from `@react-three/fiber`; `THREE.MathUtils.lerp` from `three`
- Produces: `useCorridorCamera({ scrollEnabled?, glanceIntensity? }): { getCameraZ(): number }`

This is a simplified port of itomdev's `useInfiniteCamera.js`. No Achievements context, no segment tracking, no GSAP Observer — just the core camera mechanic.

- [ ] **Step 1: Create `apps/resume/hooks/useCorridorCamera.ts`**

```typescript
'use client'

import { useRef, useEffect, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Door Z positions and which side they're on (for auto-glance)
const DOOR_POSITIONS = [
  { z: -18, side: 'left'  },  // About
  { z: -32, side: 'right' },  // Projects
  { z: -48, side: 'left'  },  // Publications
  { z: -62, side: 'right' },  // Gallery
  { z: -75, side: 'left'  },  // Contact
] as const

interface UseCorridorCameraOptions {
  scrollSpeed?: number        // deltaY multiplier (default 0.02)
  smoothing?: number          // lerp factor per frame (default 0.035 — itomdev value)
  parallaxIntensity?: number  // mouse parallax strength (default 0.3)
  glanceIntensity?: number    // door auto-glance strength (default 0.15)
  scrollEnabled?: boolean
}

export function useCorridorCamera({
  scrollSpeed = 0.02,
  smoothing = 0.035,
  parallaxIntensity = 0.3,
  glanceIntensity = 0.15,
  scrollEnabled = true,
}: UseCorridorCameraOptions = {}) {
  const { camera } = useThree()

  // Core camera state
  const targetZ   = useRef(10)   // where camera wants to be
  const currentZ  = useRef(10)   // where camera is (smoothed)
  const glance    = useRef(0)    // current auto-glance offset
  const targetGlance = useRef(0)

  // Mouse parallax
  const parallax  = useRef({ x: 0, y: 0 })
  const targetParallax = useRef({ x: 0, y: 0 })

  // Scroll boundary: don't go past last door
  const MIN_Z = -90
  const MAX_Z = 12

  const scrollEnabledRef = useRef(scrollEnabled)
  useEffect(() => { scrollEnabledRef.current = scrollEnabled }, [scrollEnabled])

  // Wheel handler
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!scrollEnabledRef.current) return
    e.preventDefault()
    targetZ.current = Math.max(MIN_Z, Math.min(MAX_Z, targetZ.current - e.deltaY * scrollSpeed))
  }, [scrollSpeed])

  // Keyboard handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!scrollEnabledRef.current) return
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    const delta: Record<string, number> = {
      ArrowDown: 80, ArrowUp: -80, PageDown: 300, PageUp: -300, ' ': 150,
    }
    const d = delta[e.key]
    if (d !== undefined) {
      e.preventDefault()
      targetZ.current = Math.max(MIN_Z, Math.min(MAX_Z, targetZ.current - d * scrollSpeed))
    }
  }, [scrollSpeed])

  // Mouse move for parallax
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1
    const ny = (e.clientY / window.innerHeight) * 2 - 1
    targetParallax.current.x = nx * parallaxIntensity
    targetParallax.current.y = -ny * parallaxIntensity * 0.5
  }, [parallaxIntensity])

  // Touch for mobile scroll
  const touchStart = useRef({ y: 0 })
  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStart.current.y = e.touches[0].clientY
  }, [])
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!scrollEnabledRef.current) return
    const delta = (touchStart.current.y - e.touches[0].clientY) * scrollSpeed * 1.5
    targetZ.current = Math.max(MIN_Z, Math.min(MAX_Z, targetZ.current - delta))
    touchStart.current.y = e.touches[0].clientY
  }, [scrollSpeed])

  useEffect(() => {
    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [handleWheel, handleKeyDown, handleMouseMove, handleTouchStart, handleTouchMove])

  // Per-frame camera update
  useFrame(() => {
    if (!scrollEnabledRef.current) return

    // Smooth Z
    currentZ.current = THREE.MathUtils.lerp(currentZ.current, targetZ.current, smoothing)

    // Smooth parallax
    parallax.current.x = THREE.MathUtils.lerp(parallax.current.x, targetParallax.current.x, smoothing * 0.8)
    parallax.current.y = THREE.MathUtils.lerp(parallax.current.y, targetParallax.current.y, smoothing * 0.8)

    // Auto-glance: compute target glance based on proximity to doors
    let bestStrength = 0
    let bestDir = 0
    const START_DIST = 15, PEAK_DIST = 8, END_DIST = -2
    for (const door of DOOR_POSITIONS) {
      const dist = currentZ.current - door.z
      let strength = 0
      if (dist > PEAK_DIST && dist < START_DIST) {
        strength = (START_DIST - dist) / (START_DIST - PEAK_DIST)
      } else if (dist <= PEAK_DIST && dist > END_DIST) {
        strength = (dist - END_DIST) / (PEAK_DIST - END_DIST)
      }
      if (strength > 0) {
        const eased = strength * (2 - strength)
        const dir = door.side === 'left' ? -1 : 1
        if (eased > bestStrength) { bestStrength = eased; bestDir = dir }
      }
    }
    targetGlance.current = bestDir * bestStrength * glanceIntensity * 3.5

    // Slow to glance, fast to release
    const releasing = Math.abs(targetGlance.current) < Math.abs(glance.current)
    glance.current = THREE.MathUtils.lerp(glance.current, targetGlance.current, releasing ? 0.08 : 0.03)

    // Apply to camera
    camera.position.z = currentZ.current
    camera.position.x = parallax.current.x
    camera.position.y = 0.2 + parallax.current.y

    const lookX = parallax.current.x * 0.3 + glance.current * 3
    camera.lookAt(lookX, 0.13 + parallax.current.y, currentZ.current - 10)
  })

  return {
    getCameraZ: () => currentZ.current,
  }
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/tal/Desktop/Code/personal_yibin/yibin_web
pnpm --filter @yibin/resume type-check 2>&1 | tail -3
```
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add apps/resume/hooks/useCorridorCamera.ts
git commit -m "feat(lab): useCorridorCamera hook — wheel/touch/keyboard → Z lerp + door glance

Port of itomdev's useInfiniteCamera.js. smoothing=0.035 produces
the heavy weighted camera feel. Auto-glance toward doors using
proximity easing (START_DIST=15 → PEAK_DIST=8 → END_DIST=-2).

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: CorridorGeometry component

**Files:**
- Create: `apps/resume/components/lab/CorridorGeometry.tsx`

**Interfaces:**
- Consumes: texture files at `/textures/corridor/` (Task 1)
- Produces: `<CorridorGeometry />` R3F component — walls, floor, ceiling PlaneGeometry with textures

- [ ] **Step 1: Create `apps/resume/components/lab/CorridorGeometry.tsx`**

```tsx
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'

const CORRIDOR_HEIGHT = 3.5
const CORRIDOR_WIDTH = 7
const CORRIDOR_LENGTH = 120   // Long enough for all doors
const FLOOR_Y = -CORRIDOR_HEIGHT / 2
const CEILING_Y = CORRIDOR_HEIGHT / 2

export function CorridorGeometry() {
  const wallTex = useTexture('/textures/corridor/wall_texture.webp')
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping
  wallTex.repeat.set(CORRIDOR_LENGTH / 4, CORRIDOR_HEIGHT / 2)

  const floorTex = useTexture('/textures/corridor/floor_wood.webp')
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping
  floorTex.repeat.set(CORRIDOR_WIDTH / 3, CORRIDOR_LENGTH / 3)

  const ceilingTex = useTexture('/textures/corridor/ceiling_texture.webp')
  ceilingTex.wrapS = ceilingTex.wrapT = THREE.RepeatWrapping
  ceilingTex.repeat.set(CORRIDOR_WIDTH / 2, CORRIDOR_LENGTH / 4)

  // Corridor Z center: camera starts at z=10 and goes to z=-90, so center is z=-40
  const centerZ = -40

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, centerZ]}>
        <planeGeometry args={[CORRIDOR_WIDTH, CORRIDOR_LENGTH]} />
        <meshBasicMaterial map={floorTex} color="#d0c8b8" />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, CEILING_Y, centerZ]}>
        <planeGeometry args={[CORRIDOR_WIDTH, CORRIDOR_LENGTH]} />
        <meshBasicMaterial map={ceilingTex} color="#e8e4dc" />
      </mesh>

      {/* Left wall */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-CORRIDOR_WIDTH / 2, 0, centerZ]}>
        <planeGeometry args={[CORRIDOR_LENGTH, CORRIDOR_HEIGHT]} />
        <meshBasicMaterial map={wallTex} color="#e0ddd4" />
      </mesh>

      {/* Right wall */}
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[CORRIDOR_WIDTH / 2, 0, centerZ]}>
        <planeGeometry args={[CORRIDOR_LENGTH, CORRIDOR_HEIGHT]} />
        <meshBasicMaterial map={wallTex} color="#e0ddd4" />
      </mesh>

      {/* Back wall (end of corridor) */}
      <mesh position={[0, 0, -90]}>
        <planeGeometry args={[CORRIDOR_WIDTH, CORRIDOR_HEIGHT]} />
        <meshBasicMaterial color="#c8c4bc" />
      </mesh>

      {/* Ambient light for warm corridor feel */}
      <ambientLight intensity={1.2} color="#f5f0e8" />
      <pointLight position={[0, 1.5, 5]}  intensity={0.8} color="#fff8e8" distance={30} />
      <pointLight position={[0, 1.5, -20]} intensity={0.6} color="#fff8e8" distance={30} />
      <pointLight position={[0, 1.5, -45]} intensity={0.6} color="#fff8e8" distance={30} />
      <pointLight position={[0, 1.5, -70]} intensity={0.6} color="#fff8e8" distance={30} />
    </group>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm --filter @yibin/resume type-check 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
git add apps/resume/components/lab/CorridorGeometry.tsx
git commit -m "feat(lab): CorridorGeometry — PlaneGeometry walls/floor/ceiling with textures

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: CorridorDoor component

**Files:**
- Create: `apps/resume/components/lab/CorridorDoor.tsx`

**Interfaces:**
- Consumes: door texture files at `/textures/corridor/doors/`
- Produces: `<CorridorDoor position side type label onEnter />` R3F mesh — door panels, handle, hover glow, click handler

- [ ] **Step 1: Create `apps/resume/components/lab/CorridorDoor.tsx`**

```tsx
import { useRef, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture, Text } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'

interface CorridorDoorProps {
  position: [number, number, number]
  side: 'left' | 'right'
  /** Matches texture filename: 'about' | 'projekty' | 'kontakt' | 'social' */
  type: string
  label: string
  onEnter: () => void
}

export function CorridorDoor({ position, side, type, label, onEnter }: CorridorDoorProps) {
  const doorTex     = useTexture(`/textures/corridor/doors/drzwi${type}.webp`)
  const handleTex   = useTexture('/textures/corridor/doors/klamkadodrzwi.webp')
  const frameTex    = useTexture('/textures/corridor/doors/ramkasingledoors.webp')

  const leftPanelRef  = useRef<THREE.Mesh>(null)
  const rightPanelRef = useRef<THREE.Mesh>(null)
  const glowRef       = useRef<THREE.Mesh>(null)
  const isNearRef     = useRef(false)
  const isOpenRef     = useRef(false)
  const glowOpacity   = useRef(0)

  const { camera } = useThree()

  const DOOR_WIDTH  = 1.2
  const DOOR_HEIGHT = 2.2

  // Rotation based on which wall the door is on
  const wallRotY = side === 'left' ? Math.PI / 2 : -Math.PI / 2

  useFrame(() => {
    const dist = Math.abs(camera.position.z - position[2])
    const near = dist < 10
    if (near !== isNearRef.current) {
      isNearRef.current = near
      // Animate glow opacity
      if (glowRef.current) {
        const mat = glowRef.current.material as THREE.MeshBasicMaterial
        gsap.to(mat, { opacity: near ? 0.25 : 0, duration: 0.5 })
      }
    }
  })

  const handleClick = useCallback(() => {
    if (isOpenRef.current) return
    isOpenRef.current = true

    const left  = leftPanelRef.current
    const right = rightPanelRef.current
    if (!left || !right) return

    // Open door panels outward
    gsap.to(left.rotation,  { y: wallRotY - Math.PI * 0.45, duration: 0.7, ease: 'power2.inOut' })
    gsap.to(right.rotation, { y: wallRotY + Math.PI * 0.45, duration: 0.7, ease: 'power2.inOut',
      onComplete: () => onEnter()
    })
  }, [wallRotY, onEnter])

  return (
    <group position={position} rotation={[0, wallRotY, 0]}>
      {/* Door frame */}
      <mesh>
        <planeGeometry args={[DOOR_WIDTH + 0.25, DOOR_HEIGHT + 0.25]} />
        <meshBasicMaterial map={frameTex} transparent alphaTest={0.1} />
      </mesh>

      {/* Left door panel */}
      <mesh
        ref={leftPanelRef}
        position={[-DOOR_WIDTH / 4, 0, 0.01]}
        rotation={[0, wallRotY, 0]}
        onClick={handleClick}
      >
        <planeGeometry args={[DOOR_WIDTH / 2, DOOR_HEIGHT]} />
        <meshBasicMaterial map={doorTex} />
      </mesh>

      {/* Right door panel */}
      <mesh
        ref={rightPanelRef}
        position={[DOOR_WIDTH / 4, 0, 0.01]}
        rotation={[0, wallRotY, 0]}
        onClick={handleClick}
      >
        <planeGeometry args={[DOOR_WIDTH / 2, DOOR_HEIGHT]} />
        <meshBasicMaterial map={doorTex} />
      </mesh>

      {/* Door handle */}
      <mesh position={[DOOR_WIDTH * 0.1, -0.1, 0.06]}>
        <planeGeometry args={[0.08, 0.22]} />
        <meshBasicMaterial map={handleTex} transparent alphaTest={0.1} />
      </mesh>

      {/* Proximity glow */}
      <mesh ref={glowRef} position={[0, 0, -0.05]}>
        <planeGeometry args={[DOOR_WIDTH + 1, DOOR_HEIGHT + 1]} />
        <meshBasicMaterial color="#f5e6a3" transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Label above door */}
      <Text
        position={[0, DOOR_HEIGHT / 2 + 0.3, 0.1]}
        fontSize={0.18}
        color="#8b7355"
        font="/fonts/Cormorant_Garamond/CormorantGaramond-Regular.ttf"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  )
}
```

Note: The font path `/fonts/Cormorant_Garamond/CormorantGaramond-Regular.ttf` needs to exist. If not present, remove the `font` prop from `<Text>` (drei's default font will be used).

- [ ] **Step 2: Check font file availability**

```bash
ls /Users/tal/Desktop/Code/personal_yibin/yibin_web/apps/resume/public/fonts/ 2>/dev/null || echo "No fonts dir"
```

If no fonts dir, remove the `font` prop from the `<Text>` component (just delete that line).

- [ ] **Step 3: Type-check**

```bash
pnpm --filter @yibin/resume type-check 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
git add apps/resume/components/lab/CorridorDoor.tsx
git commit -m "feat(lab): CorridorDoor — R3F door mesh with proximity glow and open animation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: RoomOverlay + PaperTransition

**Files:**
- Create: `apps/resume/components/lab/RoomOverlay.tsx`
- Create: `apps/resume/components/lab/PaperTransition.tsx`

**Interfaces:**
- Consumes: section components from `@/components/sections` (AboutSection etc.)
- Produces:
  - `<RoomOverlay room={string|null} onClose={() => void} />` — fixed overlay showing section content
  - `<PaperTransition isOpen={boolean} />` — white paper cover GSAP animation

- [ ] **Step 1: Create `apps/resume/components/lab/PaperTransition.tsx`**

```tsx
'use client'

import { useRef, useEffect } from 'react'
import gsap from 'gsap'

interface PaperTransitionProps {
  isOpen: boolean
  onClosed?: () => void
  onOpened?: () => void
}

export function PaperTransition({ isOpen, onClosed, onOpened }: PaperTransitionProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (isOpen) {
      // Paper closes (covers screen)
      gsap.to(el, {
        scaleY: 1,
        duration: 0.4,
        ease: 'power2.inOut',
        onComplete: onClosed,
      })
    } else {
      // Paper opens (reveals)
      gsap.to(el, {
        scaleY: 0,
        duration: 0.5,
        ease: 'power2.inOut',
        transformOrigin: 'top center',
        onComplete: onOpened,
      })
    }
  }, [isOpen, onClosed, onOpened])

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#f5f0e8',
        zIndex: 200,
        transform: 'scaleY(0)',
        transformOrigin: 'bottom center',
        pointerEvents: 'none',
      }}
    />
  )
}
```

- [ ] **Step 2: Create `apps/resume/components/lab/RoomOverlay.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import { AboutSection } from '@/components/sections/AboutSection'
import { ProjectsSection } from '@/components/sections/ProjectsSection'
import { PublicationsSection } from '@/components/sections/PublicationsSection'
import { ContactSection } from '@/components/sections/ContactSection'

type RoomId = 'about' | 'projects' | 'publications' | 'gallery' | 'contact' | null

interface RoomOverlayProps {
  room: RoomId
  onClose: () => void
}

const ROOM_COMPONENTS: Record<Exclude<RoomId, null>, React.ComponentType> = {
  about:        AboutSection,
  projects:     ProjectsSection,
  publications: PublicationsSection,
  gallery:      () => { window.location.href = '/gallery'; return null },
  contact:      ContactSection,
}

export function RoomOverlay({ room, onClose }: RoomOverlayProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!room) return null

  const SectionComponent = ROOM_COMPONENTS[room]

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        overflowY: 'auto',
        background: 'var(--bg-base)',
      }}
    >
      {/* Back to corridor button */}
      <button
        onClick={onClose}
        style={{
          position: 'fixed',
          top: '20px',
          left: '20px',
          zIndex: 110,
          padding: '8px 16px',
          background: 'rgba(13,18,32,0.8)',
          border: '1px solid rgba(255,255,255,0.15)',
          backdropFilter: 'blur(12px)',
          color: '#f0f4ff',
          fontSize: '13px',
          cursor: 'pointer',
          borderRadius: '6px',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.05em',
        }}
        aria-label="Return to corridor"
      >
        ← Back to corridor
      </button>

      <div style={{ paddingTop: '60px' }}>
        <SectionComponent />
      </div>
    </div>
  )
}
```

Note: The `gallery` room navigates away instead of showing a section — this handles the Gallery door correctly.

- [ ] **Step 3: Type-check**

```bash
pnpm --filter @yibin/resume type-check 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
git add apps/resume/components/lab/RoomOverlay.tsx apps/resume/components/lab/PaperTransition.tsx
git commit -m "feat(lab): RoomOverlay (section content) + PaperTransition (cover animation)

RoomOverlay: fixed overlay with back button, renders section components.
Gallery room navigates to /gallery directly.
PaperTransition: GSAP scaleY for paper-fold cover/reveal effect.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: LabScene assembly

**Files:**
- Create: `apps/resume/components/lab/LabScene.tsx`
- Modify: `apps/resume/app/lab/page.tsx`

**Interfaces:**
- Consumes: `useCorridorCamera` (Task 2), `CorridorGeometry` (Task 3), `CorridorDoor` (Task 4), `RoomOverlay` + `PaperTransition` (Task 5)
- Produces: complete `/lab` experience

- [ ] **Step 1: Create `apps/resume/components/lab/LabScene.tsx`**

```tsx
'use client'

import { useState, useCallback, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { CorridorGeometry } from './CorridorGeometry'
import { CorridorDoor } from './CorridorDoor'
import { RoomOverlay } from './RoomOverlay'
import { PaperTransition } from './PaperTransition'
import { useCorridorCamera } from '@/hooks/useCorridorCamera'

type RoomId = 'about' | 'projects' | 'publications' | 'gallery' | 'contact' | null

// Camera controller inside Canvas context
function CameraController() {
  useCorridorCamera({ smoothing: 0.035, scrollSpeed: 0.02 })
  return null
}

const DOORS = [
  { z: -18 as const, side: 'left'  as const, type: 'about',    label: 'About',        room: 'about'        as const },
  { z: -32 as const, side: 'right' as const, type: 'projekty', label: 'Projects',     room: 'projects'     as const },
  { z: -48 as const, side: 'left'  as const, type: 'kontakt',  label: 'Publications', room: 'publications' as const },
  { z: -62 as const, side: 'right' as const, type: 'social',   label: 'Gallery',      room: 'gallery'      as const },
  { z: -75 as const, side: 'left'  as const, type: 'kontakt',  label: 'Contact',      room: 'contact'      as const },
]

export function LabScene() {
  const [activeRoom, setActiveRoom] = useState<RoomId>(null)
  const [paperOpen, setPaperOpen] = useState(false)
  const [pendingRoom, setPendingRoom] = useState<RoomId>(null)

  const handleEnterRoom = useCallback((room: RoomId) => {
    setPendingRoom(room)
    setPaperOpen(true)   // close paper over corridor
  }, [])

  const handlePaperClosed = useCallback(() => {
    // Paper is fully closed — switch to room content
    setActiveRoom(pendingRoom)
    setPaperOpen(false)  // start opening paper to reveal room
  }, [pendingRoom])

  const handleCloseRoom = useCallback(() => {
    setPendingRoom(null)
    setPaperOpen(true)   // close paper over room
  }, [])

  const handlePaperClosedOnExit = useCallback(() => {
    setActiveRoom(null)
    setPaperOpen(false)  // reveal corridor
  }, [])

  // Determine which paper closed callback to use
  const onPaperClosed = activeRoom ? handlePaperClosedOnExit : handlePaperClosed

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#1a1208' }}>
      {/* 3D Corridor Canvas */}
      <Canvas
        camera={{ position: [0, 0.2, 10], fov: 60, near: 0.1, far: 200 }}
        style={{ position: 'absolute', inset: 0 }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <CameraController />
          <CorridorGeometry />
          {DOORS.map((door) => (
            <CorridorDoor
              key={door.room}
              position={[door.side === 'left' ? -3.5 : 3.5, 0, door.z]}
              side={door.side}
              type={door.type}
              label={door.label}
              onEnter={() => handleEnterRoom(door.room)}
            />
          ))}
        </Suspense>
      </Canvas>

      {/* Hero text overlay in corridor */}
      {!activeRoom && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.4em', color: 'rgba(200,169,110,0.6)', marginBottom: '8px' }}>
            SCROLL TO EXPLORE
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 700, color: '#f5f0e8', margin: 0 }}>
            Yibin Feng
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'rgba(245,240,232,0.5)', marginTop: '8px', letterSpacing: '0.15em' }}>
            AI Engineer · Researcher · Builder
          </p>
        </div>
      )}

      {/* Back to entry link */}
      {!activeRoom && (
        <a
          href="/"
          style={{
            position: 'fixed', top: '20px', left: '20px', zIndex: 50,
            fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'rgba(200,169,110,0.6)',
            textDecoration: 'none', letterSpacing: '0.1em',
          }}
        >
          ← Exit Lab
        </a>
      )}

      {/* Room overlay */}
      <RoomOverlay
        room={activeRoom}
        onClose={handleCloseRoom}
      />

      {/* Paper transition */}
      <PaperTransition
        isOpen={paperOpen}
        onClosed={onPaperClosed}
      />
    </div>
  )
}
```

- [ ] **Step 2: Replace `app/lab/page.tsx` stub**

```tsx
import dynamic from 'next/dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'The Lab — Yibin Feng',
  description: 'Immersive 3D corridor portfolio experience.',
}

const LabScene = dynamic(
  () => import('@/components/lab/LabScene').then(m => ({ default: m.LabScene })),
  { ssr: false }
)

export default function LabPage() {
  return <LabScene />
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm --filter @yibin/resume type-check 2>&1 | tail -5
```
Expected: clean (0 errors)

- [ ] **Step 4: Build**

```bash
pnpm --filter @yibin/resume build 2>&1 | tail -12
```
Expected: all 5 routes static (`○ /`, `○ /classic`, `○ /gallery`, `○ /lab`, `○ /_not-found`), no errors

- [ ] **Step 5: Commit**

```bash
git add apps/resume/components/lab/LabScene.tsx apps/resume/app/lab/page.tsx
git commit -m "feat(lab): LabScene — R3F corridor with 5 doors, paper transition, room overlay

Canvas: CameraController (useCorridorCamera) + CorridorGeometry + 5 CorridorDoors.
State machine: enterRoom → paperClose → showRoom → paperClose → showCorridor.
Hero text overlay + Exit Lab link when in corridor.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Verification

- [ ] **Step 1: Start dev server**

```bash
cd /Users/tal/Desktop/Code/personal_yibin/yibin_web
pnpm --filter @yibin/resume dev &
sleep 12
```

- [ ] **Step 2: Verify routes**

```bash
export PATH="/usr/bin:/bin:/usr/local/bin:$PATH"
for path in "/" "/classic" "/lab" "/gallery"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000${path}")
  echo "$path → $code"
done
```
Expected: all 200

- [ ] **Step 3: Check /lab has R3F content**

```bash
export PATH="/usr/bin:/bin:/usr/local/bin:$PATH"
curl -s http://localhost:3000/lab | python3 -c "
import sys; h = sys.stdin.read()
print('Has Lab title:', 'The Lab' in h)
print('Has canvas (dynamic):', 'LabScene' in h or 'lab' in h.lower())
print('Size:', len(h), 'bytes')
"
```

- [ ] **Step 4: Stop server and clean ports**

```bash
pkill -f "next dev -p 3000" 2>/dev/null || true
sleep 2
export PATH="/usr/bin:/bin:/usr/local/bin:$PATH"
for port in 3000 3001 5173; do lsof -ti :$port 2>/dev/null | xargs kill -9 2>/dev/null; done
for port in 3000 3001 5173; do
  r=$(lsof -ti :$port 2>/dev/null)
  [ -n "$r" ] && echo "⚠️ $port still occupied" || echo "✅ $port free"
done
```

- [ ] **Step 5: Commit**

```bash
git add .superpowers/sdd/progress.md 2>/dev/null || true
git commit --allow-empty -m "chore: Phase 2 verification passed

Co-Authored-By: Claude <noreply@anthropic.com>"
```
