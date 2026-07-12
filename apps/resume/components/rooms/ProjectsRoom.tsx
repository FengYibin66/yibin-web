'use client'

import { useRef, useEffect, useCallback, memo, useMemo } from 'react'
import { useFrame, useThree, useLoader } from '@react-three/fiber'
import { Text, PositionalAudio } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { useAchievements } from '@/context/AchievementsContext'
import { useScene } from '@/context/SceneContext'
import { useRoomTutorial } from '@/hooks/useRoomTutorial'
import { useWheelRouter } from '@/hooks/useWheelRouter'
import { useLocale } from '@/hooks/useLocale'
import { getProjectRoomItems } from '@/lib/content/projectsRoom'
import '@/components/lab/shaders/RevealMaterial'

// ─── Tower constants (itomdev values) ────────────────────────────────────────

const TOWER_RADIUS      = 2.2
const MONITORS_PER_RING = 4
const VERTICAL_SPACING  = 2.5
const BASE_FALL_SPEED   = 0.3
const TOWER_HEIGHT      = 12
const TOWER_Y_START     = -5
const TOWER_Z_START     = -13   // itomdev value
const SCROLL_SENSITIVITY = 0.006
const SWIPE_SENSITIVITY  = 0.005
const SPEED_DECAY        = 0.985
const DRAG_SENSITIVITY   = 0.008
const FRICTION           = 0.98
const CAMERA_Y_OFFSET    = -3   // camera height when viewing tower

// ─── Content data ─────────────────────────────────────────────────────────────

type Platform = 'blog' | 'youtube' | 'tiktok'

// Platform physical dimensions (itomdev values)
const PLATFORM_DIM: Record<Platform, [number, number, number]> = {
  blog:    [1.6, 1.0,   0.15],  // monitor w/h/d
  youtube: [1.6, 1.187, 1.0 ],  // tv
  tiktok:  [0.6, 1.139, 0.1 ],  // phone
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectsRoomProps {
  showRoom: boolean
  isExiting: boolean
}

interface MonitorItem {
  id: string; title: string; sub: string; url?: string
  platform: Platform
  index: number; x: number; baseY: number; z: number; rot: number
  width: number; height: number; depth: number
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProjectsRoom({ showRoom, isExiting }: ProjectsRoomProps) {
  const { isTeleporting, roomLoadState } = useScene()
  const { unlockAchievement } = useAchievements()
  const { camera } = useThree()
  const router = useWheelRouter()
  const { locale } = useLocale()
  const projects = useMemo(() => [...getProjectRoomItems(locale, 4)], [locale])
  useRoomTutorial('projects_inspect')

  const towerRef        = useRef<THREE.Group>(null)
  const showRoomRef     = useRef(showRoom)
  const isDraggingRef   = useRef(false)
  const lastXRef        = useRef(0)
  const lastYRef        = useRef(0)
  const dragDist        = useRef(0)
  const rotVelocity     = useRef(0)
  const autoRotSpeed    = useRef(0.12)
  const fallSpeed       = useRef(BASE_FALL_SPEED)
  const monitorOffsets  = useRef(projects.map(() => 0))
  const monitorRefs     = useRef<(THREE.Group | null)[]>([])

  // Refs for FloatingCodeParticles parallax
  const particleTowerRotation = useRef(0)
  const particleFallOffset    = useRef(0)

  const TOTAL_HEIGHT = projects.length * VERTICAL_SPACING

  const monitors = useMemo<MonitorItem[]>(() =>
    projects.map((p, i) => {
      const angle = (i / MONITORS_PER_RING) * Math.PI * 2
      const [w, h, d] = PLATFORM_DIM[p.platform]
      return {
        ...p, index: i,
        x: Math.cos(angle) * TOWER_RADIUS,
        baseY: i * VERTICAL_SPACING,
        z: Math.sin(angle) * TOWER_RADIUS,
        rot: -angle + Math.PI / 2,
        width: w, height: h, depth: d,
      }
    })
  , [projects])

  useEffect(() => { showRoomRef.current = showRoom }, [showRoom])

  useEffect(() => {
    if (!showRoom || isExiting || roomLoadState.phase !== 'entered') return
    const cameraTween = gsap.to(camera.position, {
      x: 3,
      y: CAMERA_Y_OFFSET,
      duration: 0.8,
      ease: 'power2.inOut',
    })
    return () => {
      cameraTween.kill()
    }
  }, [camera, isExiting, roomLoadState.phase, showRoom])


  useEffect(() => {
    if (isTeleporting) {
      rotVelocity.current  = 0
      autoRotSpeed.current = 0.12
      fallSpeed.current    = BASE_FALL_SPEED
    }
  }, [isTeleporting])

  useFrame((_, delta) => {
    if (isExiting || !towerRef.current) return

    towerRef.current.rotation.y += autoRotSpeed.current * delta + rotVelocity.current
    rotVelocity.current *= FRICTION

    const targetDrift = fallSpeed.current > 0 ? BASE_FALL_SPEED : -BASE_FALL_SPEED
    fallSpeed.current = THREE.MathUtils.lerp(fallSpeed.current, targetDrift, 1.0 - SPEED_DECAY)

    monitors.forEach((mon, i) => {
      monitorOffsets.current[i] -= fallSpeed.current * delta
      const y = mon.baseY + monitorOffsets.current[i]
      if (y < -2 && fallSpeed.current > 0)             monitorOffsets.current[i] += TOTAL_HEIGHT
      if (y > TOTAL_HEIGHT - 2 && fallSpeed.current < 0) monitorOffsets.current[i] -= TOTAL_HEIGHT
      const ref = monitorRefs.current[i]
      if (ref) ref.position.y = mon.baseY + monitorOffsets.current[i]
    })

    // Pass to particles
    particleTowerRotation.current = towerRef.current.rotation.y
    particleFallOffset.current    = fallSpeed.current
  })

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    isDraggingRef.current = true; lastXRef.current = e.clientX; lastYRef.current = e.clientY
    dragDist.current = 0; rotVelocity.current = 0
    document.body.style.cursor = 'grabbing'
  }, [])

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current || !towerRef.current || !showRoomRef.current || isExiting) return
    const dx = e.clientX - lastXRef.current; const dy = e.clientY - lastYRef.current
    lastXRef.current = e.clientX; lastYRef.current = e.clientY
    dragDist.current += Math.abs(dx) + Math.abs(dy)
    if (Math.abs(dx) > 1) autoRotSpeed.current = Math.sign(dx) * 0.12
    rotVelocity.current = dx * DRAG_SENSITIVITY
    towerRef.current.rotation.y += rotVelocity.current
    fallSpeed.current += dy * SWIPE_SENSITIVITY
    unlockAchievement('projects_inspect')
  }, [isExiting, unlockAchievement])

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false; document.body.style.cursor = 'auto'
  }, [])

  const handleWheel = useCallback((e: WheelEvent) => {
    if (!showRoomRef.current || isExiting) return
    fallSpeed.current += e.deltaY * SCROLL_SENSITIVITY
    unlockAchievement('projects_inspect')
  }, [isExiting, unlockAchievement])

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup',   handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup',   handlePointerUp)
    }
  }, [handlePointerMove, handlePointerUp])

  useEffect(() => {
    const unsub = router.subscribe('room:projects', handleWheel)
    return () => { unsub(); router.deactivate('room:projects') }
  }, [router, handleWheel])

  useEffect(() => {
    if (showRoom && !isExiting) {
      router.activate('room:projects')
    } else {
      router.deactivate('room:projects')
    }
  }, [showRoom, isExiting, router])

  if (!showRoom) return null

  return (
    <group position={[0, -1.2, 0]}>
      <PositionalAudio
        url="/sounds/szummonitorow.mp3"
        distanceModel="exponential"
        refDistance={2} rolloffFactor={1.0}
        loop autoplay volume={1}
      />

      <FloatingCodeParticles
        towerRotationRef={particleTowerRotation}
        fallOffsetRef={particleFallOffset}
      />

      {/* Tower */}
      <group ref={towerRef} position={[0, TOWER_Y_START, TOWER_Z_START]} onPointerDown={handlePointerDown}>
        {/* Invisible hit cylinder for easier drag */}
        <mesh visible={false}>
          <cylinderGeometry args={[TOWER_RADIUS + 0.5, TOWER_RADIUS + 0.5, TOWER_HEIGHT * 1.5, 16]} />
          <meshBasicMaterial />
        </mesh>

        {monitors.map((mon) => (
          <MonitorBlock
            key={mon.id}
            item={mon}
            meshRef={(el) => { monitorRefs.current[mon.index] = el }}
            onClick={() => { if (dragDist.current < 5 && mon.url) window.open(mon.url, '_blank') }}
          />
        ))}
      </group>
    </group>
  )
}

// ─── MonitorBlock (itomdev approach: painted box behind + sketch revealMaterial in front) ──

interface MonitorBlockProps {
  item: MonitorItem
  meshRef: (el: THREE.Group | null) => void
  onClick: () => void
}

const MonitorBlock = memo(function MonitorBlock({ item, meshRef, onClick }: MonitorBlockProps) {
  const groupRef     = useRef<THREE.Group>(null)
  const paintedRef   = useRef<THREE.Mesh>(null)
  const hideDelayRef = useRef<gsap.core.Tween | null>(null)
  const isHoveredRef = useRef(false)

  const matRef0 = useRef<{ uProgress: number } | null>(null)
  const matRef1 = useRef<{ uProgress: number } | null>(null)
  const matRef2 = useRef<{ uProgress: number } | null>(null)
  const matRef3 = useRef<{ uProgress: number } | null>(null)
  const matRef4 = useRef<{ uProgress: number } | null>(null)
  const matRef5 = useRef<{ uProgress: number } | null>(null)
  const matRefs = [matRef0, matRef1, matRef2, matRef3, matRef4, matRef5]

  const setRef = useCallback((el: THREE.Group | null) => {
    groupRef.current = el; meshRef(el)
  }, [meshRef])

  // All platform textures loaded unconditionally (hooks must not be conditional)
  const monFront   = useLoader(THREE.TextureLoader, '/textures/studio/monitor_front.webp')
  const monFrontP  = useLoader(THREE.TextureLoader, '/textures/studio/monitor_front_painted.webp')
  const monBack    = useLoader(THREE.TextureLoader, '/textures/studio/monitor_back.webp')
  const monBackP   = useLoader(THREE.TextureLoader, '/textures/studio/monitor_back_painted.webp')
  const monTop     = useLoader(THREE.TextureLoader, '/textures/studio/monitor_top.webp')
  const monTopP    = useLoader(THREE.TextureLoader, '/textures/studio/monitor_top_painted.webp')
  const monBottom  = useLoader(THREE.TextureLoader, '/textures/studio/monitor_bottom.webp')
  const monBottomP = useLoader(THREE.TextureLoader, '/textures/studio/monitor_bottom_painted.webp')
  const monLeft    = useLoader(THREE.TextureLoader, '/textures/studio/monitor_left.webp')
  const monLeftP   = useLoader(THREE.TextureLoader, '/textures/studio/monitor_left_painted.webp')
  const monRight   = useLoader(THREE.TextureLoader, '/textures/studio/monitor_right.webp')
  const monRightP  = useLoader(THREE.TextureLoader, '/textures/studio/monitor_right_painted.webp')

  const tvFront   = useLoader(THREE.TextureLoader, '/textures/studio/tv_front.webp')
  const tvFrontP  = useLoader(THREE.TextureLoader, '/textures/studio/tv_front_painted.webp')
  const tvBack    = useLoader(THREE.TextureLoader, '/textures/studio/tv_back.webp')
  const tvBackP   = useLoader(THREE.TextureLoader, '/textures/studio/tv_back_painted.webp')
  const tvTop     = useLoader(THREE.TextureLoader, '/textures/studio/tv_top.webp')
  const tvTopP    = useLoader(THREE.TextureLoader, '/textures/studio/tv_top_painted.webp')
  const tvBottom  = useLoader(THREE.TextureLoader, '/textures/studio/tv_bottom.webp')
  const tvBottomP = useLoader(THREE.TextureLoader, '/textures/studio/tv_bottom_painted.webp')
  const tvSide    = useLoader(THREE.TextureLoader, '/textures/studio/tv_side.webp')
  const tvSideP   = useLoader(THREE.TextureLoader, '/textures/studio/tv_side_painted.webp')

  const phoneFront  = useLoader(THREE.TextureLoader, '/textures/studio/phone_front.webp')
  const phoneFrontP = useLoader(THREE.TextureLoader, '/textures/studio/phone_front_painted.webp')
  const phoneBack   = useLoader(THREE.TextureLoader, '/textures/studio/phone_back.webp')
  const phoneBackP  = useLoader(THREE.TextureLoader, '/textures/studio/phone_back_painted.webp')
  const phoneSide   = useLoader(THREE.TextureLoader, '/textures/studio/phone_side.webp')
  const phoneSideP  = useLoader(THREE.TextureLoader, '/textures/studio/phone_side_painted.webp')

  // Set color space once
  useEffect(() => {
    const all = [
      monFront, monFrontP, monBack, monBackP, monTop, monTopP, monBottom, monBottomP, monLeft, monLeftP, monRight, monRightP,
      tvFront, tvFrontP, tvBack, tvBackP, tvTop, tvTopP, tvBottom, tvBottomP, tvSide, tvSideP,
      phoneFront, phoneFrontP, phoneBack, phoneBackP, phoneSide, phoneSideP,
    ]
    all.forEach(t => { t.colorSpace = THREE.SRGBColorSpace })
  }, [monFront, monFrontP, monBack, monBackP, monTop, monTopP, monBottom, monBottomP, monLeft, monLeftP, monRight, monRightP,
      tvFront, tvFrontP, tvBack, tvBackP, tvTop, tvTopP, tvBottom, tvBottomP, tvSide, tvSideP,
      phoneFront, phoneFrontP, phoneBack, phoneBackP, phoneSide, phoneSideP])

  // faceConfig per platform: +X, -X, +Y, -Y, +Z(front), -Z(back)
  const faceConfig = useMemo(() => {
    if (item.platform === 'youtube') return [
      { sketch: tvSide,   painted: tvSideP   },
      { sketch: tvSide,   painted: tvSideP   },
      { sketch: tvTop,    painted: tvTopP    },
      { sketch: tvBottom, painted: tvBottomP },
      { sketch: tvFront,  painted: tvFrontP  },
      { sketch: tvBack,   painted: tvBackP   },
    ]
    if (item.platform === 'tiktok') return [
      { sketch: phoneSide,  painted: phoneSideP  },
      { sketch: phoneSide,  painted: phoneSideP  },
      { sketch: phoneSide,  painted: phoneSideP  },
      { sketch: phoneSide,  painted: phoneSideP  },
      { sketch: phoneFront, painted: phoneFrontP },
      { sketch: phoneBack,  painted: phoneBackP  },
    ]
    // blog / monitor (default)
    return [
      { sketch: monRight,  painted: monRightP  },
      { sketch: monLeft,   painted: monLeftP   },
      { sketch: monTop,    painted: monTopP    },
      { sketch: monBottom, painted: monBottomP },
      { sketch: monFront,  painted: monFrontP  },
      { sketch: monBack,   painted: monBackP   },
    ]
  }, [item.platform,
      monRight, monRightP, monLeft, monLeftP, monTop, monTopP, monBottom, monBottomP, monFront, monFrontP, monBack, monBackP,
      tvSide, tvSideP, tvTop, tvTopP, tvBottom, tvBottomP, tvFront, tvFrontP, tvBack, tvBackP,
      phoneSide, phoneSideP, phoneFront, phoneFrontP, phoneBack, phoneBackP])

  const paintedMaterials = useMemo(() =>
    faceConfig.map(f => new THREE.MeshBasicMaterial({ color: '#e0e0e0', map: f.painted }))
  , [faceConfig])

  const updatePaintState = useCallback(() => {
    const shouldPaint = isHoveredRef.current
    const prog = shouldPaint ? 1.0 : 0.0
    const dur  = shouldPaint ? 0.8 : 0.5
    matRefs.forEach(r => { if (r.current) gsap.to(r.current, { uProgress: prog, duration: dur, ease: 'power2.out', overwrite: true }) })
    if (shouldPaint) {
      hideDelayRef.current?.kill()
      if (paintedRef.current) paintedRef.current.visible = true
    } else {
      const delay = hideDelayRef.current === undefined ? 0.05 : dur + 0.05
      hideDelayRef.current = gsap.delayedCall(delay, () => { if (paintedRef.current) paintedRef.current.visible = false })
    }
  }, []) // eslint-disable-line

  const { width: w, height: h, depth: d } = item

  return (
    <group
      ref={setRef}
      position={[item.x, item.baseY, item.z]}
      rotation={[0, item.rot, 0]}
      onPointerOver={(e) => { e.stopPropagation(); isHoveredRef.current = true;  updatePaintState(); document.body.style.cursor = 'pointer' }}
      onPointerOut={() =>  {                       isHoveredRef.current = false; updatePaintState(); document.body.style.cursor = 'auto' }}
      onPointerUp={(e) => { e.stopPropagation(); onClick() }}
    >
      {/* Painted box — behind, initially hidden; shown on hover */}
      <mesh ref={paintedRef} visible={false}>
        <boxGeometry args={[w, h, d]} />
        {paintedMaterials.map((mat, i) => (
          <primitive key={`p${i}`} attach={`material-${i}`} object={mat} />
        ))}
      </mesh>

      {/* Sketch box — front, revealMaterial on all 6 faces */}
      <mesh>
        <boxGeometry args={[w, h, d]} />
        {faceConfig.map((face, i) => (
          // @ts-expect-error revealMaterial registered via extend()
          <revealMaterial
            key={`s${i}`}
            ref={matRefs[i]}
            attach={`material-${i}`}
            color="#ffffff"
            map={face.sketch}
            transparent={false}
            uProgress={0.0}
          />
        ))}
      </mesh>

      {/* Title + sub on the front face */}
      <Text position={[0, h * 0.2, d / 2 + 0.01]} fontSize={0.1}  color="#1a1a1a" font="/fonts/CabinSketch-Bold.ttf"    anchorX="center" anchorY="middle" maxWidth={w - 0.2}>{item.title}</Text>
      <Text position={[0, 0,       d / 2 + 0.01]} fontSize={0.065} color="#4a4a4a" font="/fonts/CabinSketch-Regular.ttf" anchorX="center" anchorY="middle" maxWidth={w - 0.2}>{item.sub}</Text>
      {item.url && (
        <Text position={[0, -h * 0.28, d / 2 + 0.01]} fontSize={0.065} color="#5577bb" font="/fonts/CabinSketch-Regular.ttf" anchorX="center">↗ Open</Text>
      )}
    </group>
  )
})

// ─── FloatingCodeParticles (itomdev port) ─────────────────────────────────────

const PARTICLE_COUNT  = 60
const VERTICAL_SPREAD = 25
const BASE_OPACITY    = 0.18
const LOOP_BOTTOM     = -15
const LOOP_TOP        = 15
const LOOP_HEIGHT     = LOOP_TOP - LOOP_BOTTOM

const SYMBOLS = [
  { text: '{/}',   size: 0.8, weight: 2 },
  { text: '</>',   size: 0.8, weight: 2 },
  { text: '{ }',   size: 0.7, weight: 1 },
  { text: ';',     size: 0.5, weight: 3 },
  { text: '::',    size: 0.4, weight: 2 },
  { text: '=>',    size: 0.5, weight: 2 },
  { text: '//',    size: 0.5, weight: 2 },
  { text: '&&',    size: 0.4, weight: 1 },
  { text: '0',     size: 0.3, weight: 4 },
  { text: '1',     size: 0.3, weight: 4 },
  { text: '01',    size: 0.35, weight: 3 },
  { text: '0101',  size: 0.4, weight: 2 },
  { text: '00',    size: 0.35, weight: 2 },
  { text: '↑',     size: 0.4, weight: 2 },
  { text: '→',     size: 0.4, weight: 1 },
  { text: '←',     size: 0.4, weight: 1 },
  { text: '×',     size: 0.3, weight: 2 },
  { text: '•',     size: 0.25, weight: 3 },
  { text: '○',     size: 0.3, weight: 2 },
  { text: '▪▪▪',  size: 0.2, weight: 2 },
]

function getRandomSymbol() {
  const total = SYMBOLS.reduce((s, sym) => s + sym.weight, 0)
  let r = Math.random() * total
  for (const sym of SYMBOLS) { r -= sym.weight; if (r <= 0) return sym }
  return SYMBOLS[0]
}

interface ParticleData {
  id: number
  symbol: { text: string; size: number }
  initialX: number; initialY: number; z: number
  driftSpeed: number; rotationSpeed: number
  parallaxFactor: number; phaseOffset: number
  opacity: number; rotation: number
}

function generateParticles(): ParticleData[] {
  const X_SPREAD = 50; const Z_MIN = -4; const Z_MAX = -8
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const sym = getRandomSymbol()
    return {
      id: i, symbol: sym,
      initialX: (Math.random() - 0.5) * X_SPREAD,
      initialY: (Math.random() - 0.5) * VERTICAL_SPREAD,
      z: Z_MIN + Math.random() * (Z_MAX - Z_MIN),
      driftSpeed: 0.1 + Math.random() * 0.2,
      rotationSpeed: (Math.random() - 0.5) * 0.3,
      parallaxFactor: 0.3 + Math.random() * 0.7,
      phaseOffset: Math.random() * Math.PI * 2,
      opacity: BASE_OPACITY * (0.5 + Math.random() * 0.5),
      rotation: Math.random() * Math.PI * 2,
    }
  })
}

interface FloatingCodeParticlesProps {
  towerRotationRef: React.MutableRefObject<number>
  fallOffsetRef:    React.MutableRefObject<number>
}

function FloatingCodeParticles({ towerRotationRef, fallOffsetRef }: FloatingCodeParticlesProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const particles = useMemo(() => generateParticles(), [])
  const meshRefs  = useRef<(THREE.Object3D | null)[]>([])
  const smoothRot = useRef(0)
  const yOffsets  = useRef(particles.map(() => 0))

  useFrame((state, delta) => {
    const time         = state.clock.elapsedTime
    const fallVelocity = fallOffsetRef.current
    const WRAP = 50; const HALF = WRAP / 2

    smoothRot.current = THREE.MathUtils.lerp(smoothRot.current, towerRotationRef.current, 0.08)

    particles.forEach((p, i) => {
      const mesh = meshRefs.current[i]
      if (!mesh) return

      // Vertical
      yOffsets.current[i] -= fallVelocity * delta * p.parallaxFactor * 1.5
      const floatY = Math.sin(time * p.driftSpeed + p.phaseOffset) * 0.3
      let finalY = p.initialY + yOffsets.current[i] + floatY
      while (finalY < LOOP_BOTTOM) { yOffsets.current[i] += LOOP_HEIGHT; finalY += LOOP_HEIGHT }
      while (finalY > LOOP_TOP)    { yOffsets.current[i] -= LOOP_HEIGHT; finalY -= LOOP_HEIGHT }
      mesh.position.y = finalY

      // Horizontal (parallax with tower rotation)
      let finalX = p.initialX + (smoothRot.current * 5.0 * p.parallaxFactor)
      finalX = ((finalX + HALF) % WRAP + WRAP) % WRAP - HALF
      mesh.position.x = finalX
      mesh.position.z = p.z

      // Gentle spin
      mesh.rotation.z = p.rotation + time * p.rotationSpeed
    })
  })

  return (
    <group position={[0, 0, -10]}>
      {particles.map((p, i) => (
        <Text
          key={p.id}
          ref={(el: THREE.Object3D | null) => { meshRefs.current[i] = el }}
          position={[p.initialX, p.initialY, p.z]}
          fontSize={p.symbol.size}
          color="#6688aa"
          anchorX="center"
          anchorY="middle"
          fillOpacity={p.opacity}
          font="/fonts/CabinSketch-Bold.ttf"
        >
          {p.symbol.text}
        </Text>
      ))}
    </group>
  )
}
