'use client'

import { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture, Text } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { useRouter } from 'next/navigation'
import { useAudio } from '@/context/AudioContext'
import { useScene } from '@/context/SceneContext'
import { useAchievementActions } from '@/context/AchievementsContext'
import type { RoomId } from '@/context/SceneContext'
import { isDoorEntryOwner } from '@/lib/lab/domain/machines/room.machine'
import { segmentIndexAtZ } from '@/lib/lab/domain/corridor/layout'
import { LAB_FONT_LATIN_BOLD, fontForText } from '@/lib/lab/domain/labFonts'
import { preloadRoomAssets } from '@/lib/lab/app/assets/preload'
import '@/components/lab/shaders/RevealMaterial'
import { RoomInterior } from './RoomInterior'
import { useDoorEntryOrchestrator } from './useDoorEntryOrchestrator'

/** 裁剪平面每帧重算用的临时量，避免每帧分配 */
const _clipNormal = new THREE.Vector3()
const _clipPoint  = new THREE.Vector3()
/** 房间前墙与走廊墙共面，留一点容差别把它自己裁掉 */
const WALL_CLIP_TOLERANCE = 0.03

// ─── Geometry constants (itomdev DoorSection values) ──────────────────────────
const WALL_X_OUTER    = 3.5
const DOOR_Z_SPAN     = 4
const WALL_DX         = WALL_X_OUTER - 1.7          // 1.8
const WALL_LENGTH     = Math.sqrt(WALL_DX ** 2 + DOOR_Z_SPAN ** 2)  // ≈4.387
const CORRIDOR_HEIGHT = 3.5
const BASE_TILT       = 0.02
const MAX_TILT        = Math.atan2(WALL_DX, DOOR_Z_SPAN) + 0.1      // ≈0.523 rad
const TILT_START      = 15
const TILT_PEAK       = 3

const DOOR_WIDTH    = 1.2
const DOOR_HEIGHT   = 2.5
const FLOOR_Y       = -CORRIDOR_HEIGHT / 2                           // -1.75
const DOOR_CENTER_Y = FLOOR_Y + DOOR_HEIGHT / 2                      // -0.5
const SIDE_WALL_W   = (WALL_LENGTH - DOOR_WIDTH) / 2                 // ≈1.594

// Baseboard strip along bottom of wall fill
const BASEBOARD_H   = 0.14
const BASEBOARD_Y   = FLOOR_Y + BASEBOARD_H / 2

// Camera alignment constants
const DOOR_ALIGN_X  = 1.2
const DOOR_LOOK_ANGLE = Math.PI * 0.334

export interface DoorSectionProps {
  position: [number, number, number]
  side: 'left' | 'right'
  /** Texture filename suffix: 'about' | 'projekty' | 'kontakt' | 'social' */
  type: string
  label: string
  roomId: RoomId
  segmentIndex?: number
  enterDistance?: number
  setCameraOverride: (active: boolean) => void
}

/*
  ESC 的处理已经搬到 `components/lab/useEscapeRouter.ts`（ADR 20260903211244）。

  这里原先有 `handleDoorEscape` 与一个**每个门实例各挂一个**的 window keydown
  监听：15 段走廊各一个，靠各自的 `isInsideRoom` 互斥。加上 `NavigationUI` 与
  `LabTutorial` 各自的一个，一共 17 个监听在抢同一个键。后两者不走消费栈，
  于是在房间里按一次 ESC 会同时关面板**并**让房间退场。

  现在只有一个监听点。退房的守卫也不再重复一套——`requestExit()` 自己就守着
  `phase === 'entered' && !isTeleporting`，比原来那三个每实例 state
  （`isInsideRoom` / `isAnimating` / `isTeleporting`）少一套会漂移的并行判断。
*/

export function DoorSection({
  position,
  side,
  type,
  label,
  roomId,
  segmentIndex = 0,
  enterDistance = 8,
  setCameraOverride,
}: DoorSectionProps) {
  const { play } = useAudio()
  const { unlockAchievement } = useAchievementActions()
  const router = useRouter()

  // Prefetch /gallery as soon as this door mounts (when roomId === 'gallery')
  useEffect(() => {
    if (roomId === 'gallery') {
      router.prefetch('/gallery')
    }
  }, [roomId, router])
  const {
    enterRoom,
    exitRoom: contextExitRoom,
    exitRequested,
    pendingDoorClick,
    isFastTeleport,
    isTeleporting,
    teleportPhase,
    currentRoom,
    signalRoomReady,
    roomLoadState,
    tryRoom,
    failRoomLoad,
    finishRoomExit,
    resetRoomLoadForTeleport,
    requestExit,
  } = useScene()
  const { camera } = useThree()
  /*
    门牌字体按**文案内容**选，不按 locale：含汉字就换成有汉字字形的手写体。
    写死拉丁体时中文门牌是空白的——CabinSketch 没有汉字字形，而 troika 缺字会去
    jsDelivr 取兜底字体（大陆访客取不到）。见 `lib/lab/domain/labFonts.ts`。
  */
  const doorLabelFont = fontForText(label, LAB_FONT_LATIN_BOLD)

  // ─── Textures ───────────────────────────────────────────────────────────────
  const doorTex          = useTexture(`/textures/corridor/doors/drzwi${type}.webp`)
  const paintedTex       = useTexture(`/textures/corridor/doors/drzwi${type}_painted.webp`)
  const handleTex        = useTexture('/textures/corridor/doors/klamkadodrzwi.webp')
  const handlePaintedTex = useTexture('/textures/corridor/doors/klamkadodrzwi_painted.webp')
  const frameTex         = useTexture('/textures/corridor/doors/ramkasingledoors.webp')
  const backTex          = useTexture('/textures/corridor/doors/backsingledoors.webp')
  const wallTex          = useTexture('/textures/corridor/wall_texture.webp')
  const signTex          = useTexture('/textures/corridor/pustatabliczka.webp')
  const arrowTex         = useTexture('/textures/corridor/strzalka.webp')
  const baseboardTex     = useTexture('/textures/corridor/texturadoprogow.webp')

  const wallTexClone = useMemo(() => {
    const t = wallTex.clone()
    t.needsUpdate = true
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(0.5, 0.5)
    t.offset.set(0.5, 0.5)
    return t
  }, [wallTex])

  /**
   * 两个箭头共用一个材质实例，这样淡入淡出只需 tween 它一次。
   * 必须自己 dispose——R3F 卸载时不会回收由 useMemo 造出来的材质。
   */
  const arrowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({
      map: arrowTex,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false,
      opacity: 0,
    }),
    [arrowTex],
  )
  useEffect(() => () => { arrowMaterial.dispose() }, [arrowMaterial])

  const baseboardTexClone = useMemo(() => {
    const t = baseboardTex.clone()
    t.needsUpdate = true
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(SIDE_WALL_W / 2.5, 1)
    return t
  }, [baseboardTex])

  // ─── Refs ────────────────────────────────────────────────────────────────────
  const innerGroupRef    = useRef<THREE.Group>(null)
  const doorRef          = useRef<THREE.Group>(null)
  const textGroupRef     = useRef<THREE.Group>(null)
  const arrowGroupRef    = useRef<THREE.Group>(null)
  const glowRef          = useRef<THREE.Mesh>(null)
  const doorRevealRef    = useRef<{ uProgress: number } | null>(null)
  const handleRevealRef  = useRef<{ uProgress: number } | null>(null)
  const handlePaintedRef = useRef<THREE.Mesh>(null)
  const doorPaintedRef   = useRef<THREE.Mesh>(null)

  const currentTilt      = useRef(BASE_TILT)
  const isNearRef        = useRef(false)
  const isOpenRef        = useRef(false)
  const isTiltLockedRef  = useRef(false)
  const hideDelayRef     = useRef<gsap.core.Tween | null>(null)
  const hasPreloadedNearbyRef = useRef(false)

  /*
    所有权从状态机的 context 派生，不再靠组件里的 ref 记账。

    旧实现在 `useDoorEntryOrchestrator` 里用 `ownedEntryRef` +
    `previousPhaseRef` 互相看护，而它们要靠"观察到 failed → idle 这次转移"来
    复位——中间插进一次别的渲染就永久卡住，表现是「从加载失败退出后再也传送不了」。
  */
  const isEntryOwner = isDoorEntryOwner(
    roomLoadState,
    roomLoadState.phase,
    roomId,
    segmentIndex,
  )

  // Camera state saved before entering (for exit reverse animation)
  const savedCameraState   = useRef({ x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0 })
  const doorAlignedState   = useRef({ x: 0, y: 0, z: 0, rotY: 0 })

  // React state
  const [isInsideRoom, setIsInsideRoom]   = useState(false)
  const [isAnimating, setIsAnimating]     = useState(false)
  const [showRoom, setShowRoom]           = useState(false)

  const pivotX      = side === 'left' ? -WALL_X_OUTER : WALL_X_OUTER
  const wallOffsetX = side === 'left' ? WALL_LENGTH / 2 : -WALL_LENGTH / 2

  // ─── Per-frame: tilt, scale-compensation, glow, arrows ──────────────────────
  /*
    ── 房间不得越过走廊墙面 ──────────────────────────────────────────────

    门段是一块"翻板"：相机靠近时整段绕外墙边缘朝你转最多 30°（`MAX_TILT`），
    进房期间锁在最大角。房间是这块翻板的子节点——于是 11 单位宽的 Projects
    房间也跟着转 30°，它那面深棕侧墙的一端就穿过静止的走廊墙，立在走廊里
    （进房 / 退房期间门旁边那块竖直的深色板）。

    不能把翻板扳直：相机对齐（`DOOR_LOOK_ANGLE` = 90° − 30°）与进房飞行
    （沿相机朝向推进）都建立在倾斜的门面上。所以改为**裁剪**：以走廊墙所在的
    平面为界，房间材质在墙外那一侧的片元一律丢弃。平面每帧从外层 group 的
    世界矩阵算（走廊有整体摇摆，不能写死世界坐标）。

    只挂到房间自己的材质上；`ShaderMaterial` 若没声明 `clipping: true` 会被
    跳过——three 的裁剪要着色器配合，硬塞进去是黑屏而不是裁剪。
  */
  const outerGroupRef = useRef<THREE.Group>(null)
  const roomRootRef   = useRef<THREE.Group>(null)
  const wallClipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(side === 'left' ? -1 : 1, 0, 0), 0), [side])
  const clippedMaterials = useRef(new WeakSet<THREE.Material>())

  const applyWallClip = useCallback(() => {
    const root = roomRootRef.current
    if (!root) return
    root.traverse(obj => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of mats) {
        if (!m || clippedMaterials.current.has(m)) continue
        if ((m as THREE.ShaderMaterial).isShaderMaterial && !(m as THREE.ShaderMaterial).clipping) continue
        m.clippingPlanes = [wallClipPlane]
        m.needsUpdate = true
        clippedMaterials.current.add(m)
      }
    })
  }, [wallClipPlane])

  // 房间子树在 Suspense 解析后才有材质：相位每变一次就再扫一遍（扫的是这扇门自己的房间，量不大）
  useEffect(() => { applyWallClip() }, [applyWallClip, roomLoadState.phase, showRoom])

  useFrame(() => {
    const inner = innerGroupRef.current
    if (!inner) return

    // 裁剪平面：外层 group 的局部 x=0 平面（即走廊墙），法向朝房间那一侧
    const outer = outerGroupRef.current
    if (outer && roomRootRef.current) {
      _clipNormal.set(side === 'left' ? -1 : 1, 0, 0).transformDirection(outer.matrixWorld)
      _clipPoint.setFromMatrixPosition(outer.matrixWorld)
      wallClipPlane.setFromNormalAndCoplanarPoint(_clipNormal, _clipPoint)
      wallClipPlane.constant -= WALL_CLIP_TOLERANCE
    }

    const dist = Math.abs(camera.position.z - position[2])
    if (roomId !== 'gallery' && !hasPreloadedNearbyRef.current && dist < TILT_START) {
      hasPreloadedNearbyRef.current = true
      preloadRoomAssets(roomId)
    }

    let targetTilt = BASE_TILT
    if (isTiltLockedRef.current) {
      targetTilt = MAX_TILT
    } else if (dist < TILT_START && dist > TILT_PEAK) {
      const t = (TILT_START - dist) / (TILT_START - TILT_PEAK)
      targetTilt = BASE_TILT + (MAX_TILT - BASE_TILT) * (t * (2 - t))
    } else if (dist <= TILT_PEAK) {
      targetTilt = MAX_TILT
    }
    currentTilt.current = THREE.MathUtils.lerp(currentTilt.current, targetTilt, 0.06)

    const baseDir  = side === 'left' ? 1 : -1
    const tiltDir  = side === 'left' ? -1 : 1
    const rotation = (Math.PI / 2 * baseDir) + (currentTilt.current * tiltDir)
    inner.rotation.y = rotation

    const absSin = Math.abs(Math.sin(rotation))
    const exactScale = absSin > 0.1 ? (DOOR_Z_SPAN - 0.01) / (WALL_LENGTH * absSin) : 1.0
    inner.scale.x = THREE.MathUtils.clamp(exactScale, 0.8, 1.1)

    if (textGroupRef.current) {
      textGroupRef.current.scale.x = 1 / inner.scale.x
    }

    const near = dist < 10
    if (near !== isNearRef.current) {
      isNearRef.current = near
      if (glowRef.current) {
        const mat = glowRef.current.material as THREE.MeshBasicMaterial
        gsap.to(mat, { opacity: near ? 0.22 : 0, duration: 0.5 })
      }
      const arrowGroup = arrowGroupRef.current
      if (arrowGroup) {
        // 原先是 gsap.to(arrowGroup, { opacity }) —— THREE.Group **没有 opacity
        // 属性**，GSAP 每扇门报一次 "Invalid property opacity set to 1"，箭头
        // 只会硬切不会淡入淡出（审计 B7）。淡的是材质，不是 Group。
        if (near) arrowGroup.visible = true
        gsap.to(arrowMaterial, {
          opacity: near ? 1 : 0,
          duration: 0.5,
          overwrite: true,
          // 淡出结束才隐藏，否则 visible 立刻翻掉、淡出动画看不见
          onComplete: () => { if (!isNearRef.current) arrowGroup.visible = false },
        })
      }
    }
  })

  // ─── Open door panels ────────────────────────────────────────────────────────
  const openDoorPanels = useCallback((fastMode: boolean, onComplete: () => void) => {
    const door = doorRef.current
    if (!door) { onComplete(); return }

    isOpenRef.current = true
    play('door_open')

    const dur = fastMode ? 0.01 : 0.7
    gsap.to(door.rotation, {
      y: side === 'left' ? Math.PI * 0.75 : -Math.PI * 0.75,
      duration: dur,
      ease: fastMode ? 'none' : 'power2.out',
      onComplete,
    })
  }, [play, side])

  // ─── Close door panels ───────────────────────────────────────────────────────
  const closeDoorPanels = useCallback((fastMode: boolean, onComplete?: () => void) => {
    const door = doorRef.current
    if (!door) { onComplete?.(); return }

    isOpenRef.current = false
    play('door_close')

    const dur = fastMode ? 0.01 : 0.6
    gsap.to(door.rotation, {
      y: 0,
      duration: dur,
      ease: 'power2.in',
      onComplete,
    })

    // Reverse reveal materials
    for (const ref of [doorRevealRef, handleRevealRef]) {
      if (ref.current) gsap.to(ref.current, { uProgress: 0.0, duration: 0.6, ease: 'power2.out', overwrite: true })
    }
    if (hideDelayRef.current) hideDelayRef.current.kill()
    hideDelayRef.current = gsap.delayedCall(0.65, () => {
      if (handlePaintedRef.current) handlePaintedRef.current.visible = false
      if (doorPaintedRef.current) doorPaintedRef.current.visible = false
    })
  }, [play])

  const finishRoomEntry = useCallback((useFastMode: boolean) => {
    // 门开完了。`tryRoom` 返回 false = 这个事件在当前状态下不合法（比如已经
    // 因为超时进了 failed），那就不该继续走"进房成功"的那一串副作用
    if (!tryRoom({ type: 'DOOR_OPENED' })) return
    enterRoom(roomId)
    setIsAnimating(false)
    setIsInsideRoom(true)
    unlockAchievement('corridor_enter')
    if (useFastMode) signalRoomReady()
  }, [tryRoom, enterRoom, roomId, signalRoomReady, unlockAchievement])

  const flyIntoRoom = useCallback((useFastMode: boolean) => {
    const direction = new THREE.Vector3()
    camera.getWorldDirection(direction)
    const duration = useFastMode ? 0.01 : 1.5
    gsap.to(camera.position, {
      x: camera.position.x + direction.x * enterDistance,
      z: camera.position.z + direction.z * enterDistance,
      duration,
      ease: useFastMode ? 'none' : 'power2.inOut',
      onComplete: () => finishRoomEntry(useFastMode),
    })
  }, [camera, enterDistance, finishRoomEntry])

  /**
   * 房间开始 Suspend —— 纹理真的在下载了。
   *
   * **这个回调必须接上，否则 8 秒加载超时永远不会启动。** `RoomInterior` 的
   * `onLoading` 默认值是 NOOP，接线时漏掉它的后果是：机器停在 `mounting`，
   * 而超时那条 `after` 挂在 `loading` 上——弱网下用户看着加载卡转到世界末日，
   * 既不失败也不重试。
   *
   * 旧实现的超时是 `setTimeout`，在**相机对齐**时就起（`aligning → loading`
   * 是一步），所以不需要这个信号；机器把"挂载了"与"在下载"分成两个状态之后
   * 就需要了。这类"多了一个状态、于是多了一个必须接的信号"的缺口没有编译期
   * 保护，只能靠测试——见 `__tests__/roomSuspenseWiring.test.tsx`。
   */
  const handleRoomLoading = useCallback(() => {
    if (!isEntryOwner) return
    tryRoom({ type: 'MOUNTED' })
  }, [isEntryOwner, tryRoom])

  const handleRoomReady = useCallback(() => {
    if (!isEntryOwner) return
    /*
      `mounting` 也要接：纹理**已在缓存里**时房间不会 Suspend，于是没有
      `MOUNTED`（那个事件的来源是 Suspense fallback 挂载），相位会停在
      `mounting` 直到 `READY` 到达。第二次进同一间房走的就是这条路。
    */
    if (roomLoadState.phase !== 'loading' && roomLoadState.phase !== 'mounting') return
    tryRoom({ type: 'READY' })
  }, [isEntryOwner, roomLoadState.phase, tryRoom])

  const handleRoomError = useCallback((message: string) => {
    if (!isEntryOwner) return
    /*
      **不再限定相位**。旧实现是 `if (phase !== 'loading') return`，于是
      `entered` 之后的运行时错误被直接丢掉——房间静默消失而相位仍是 `entered`，
      没有提示、没有重试、只能刷新（审计 A8）。

      现在交给 `failRoomLoad` 按当前相位选事件（`entered` → `RUNTIME_ERROR`，
      否则 `LOAD_ERROR`），机器两条边都有；相位不合法时 `tryRoom` 自己会拒绝。
    */
    failRoomLoad(message)
  }, [failRoomLoad, isEntryOwner])

  // ─── Main click / teleport handler ──────────────────────────────────────────
  const handleClick = useCallback((opts?: { isTeleport?: boolean }) => {
    if (isAnimating || isOpenRef.current) return

    const isTeleport = opts?.isTeleport ?? false
    if (roomId !== 'gallery') {
      if (!tryRoom({ type: 'BEGIN', roomId, segmentIndex })) return
    }
    setIsAnimating(true)
    setCameraOverride(true)
    isTiltLockedRef.current = true

    // Save camera state before entering
    savedCameraState.current = {
      x: camera.position.x, y: camera.position.y, z: camera.position.z,
      rotX: camera.rotation.x, rotY: camera.rotation.y, rotZ: camera.rotation.z,
    }

    // For teleport, override saved position to a natural corridor position
    if (isTeleport) {
      const corridorGlanceY = side === 'left' ? 0.15 : -0.15
      savedCameraState.current = {
        x: 0, y: 0.2, z: position[2] + 4,
        rotX: 0, rotY: corridorGlanceY, rotZ: 0,
      }
    }

    const useFastMode = isTeleport && isFastTeleport
    const alignDur = useFastMode ? 0.01 : 1.0

    const cameraTargetX = side === 'left' ? DOOR_ALIGN_X : -DOOR_ALIGN_X
    const cameraTargetZ = position[2]

    // Compute rotation target accounting for parent sway
    let parentRotationY = 0
    if (camera.parent) {
      const parentWorldQuat = new THREE.Quaternion()
      camera.parent.getWorldQuaternion(parentWorldQuat)
      const parentEuler = new THREE.Euler().setFromQuaternion(parentWorldQuat, 'YXZ')
      parentRotationY = parentEuler.y
    }
    const worldTargetRotY = side === 'left' ? DOOR_LOOK_ANGLE : -DOOR_LOOK_ANGLE
    const targetRotY = worldTargetRotY - parentRotationY

    const rotProxy = { y: camera.rotation.y }

    gsap.to(camera.position, {
      x: cameraTargetX, z: cameraTargetZ,
      duration: alignDur,
      ease: useFastMode ? 'none' : 'power2.inOut',
    })

    gsap.to(rotProxy, {
      y: targetRotY,
      duration: alignDur,
      ease: useFastMode ? 'none' : 'power2.inOut',
      onUpdate: () => { camera.rotation.y = rotProxy.y },
      onComplete: () => {
        // Save aligned state for exit reverse
        doorAlignedState.current = {
          x: camera.position.x, y: camera.position.y,
          z: camera.position.z, rotY: camera.rotation.y,
        }

        // Gallery: navigate immediately when camera aligns with door.
        // This way page loading starts early, reducing perceived lag.
        if (roomId === 'gallery') {
          setCameraOverride(false)
          unlockAchievement('corridor_enter')
          router.push('/gallery?from=lab')
          return
        }

        if (!tryRoom({ type: 'CAMERA_ALIGNED' })) return
        setShowRoom(true)
      },
    })
  }, [camera, tryRoom, isAnimating, isFastTeleport, position, roomId, router, segmentIndex, setCameraOverride, side, unlockAchievement])

  const restoreSavedCamera = useCallback(() => {
    const saved = savedCameraState.current
    gsap.killTweensOf(camera.position)
    gsap.killTweensOf(camera.rotation)
    camera.position.set(saved.x, saved.y, saved.z)
    camera.rotation.set(saved.rotX, saved.rotY, saved.rotZ)
  }, [camera])

  const resetDoorVisuals = useCallback(() => {
    hideDelayRef.current?.kill()
    if (doorRef.current) {
      gsap.killTweensOf(doorRef.current.rotation)
      doorRef.current.rotation.y = 0
    }
    for (const ref of [doorRevealRef, handleRevealRef]) {
      if (ref.current) ref.current.uProgress = 0
    }
    if (handlePaintedRef.current) handlePaintedRef.current.visible = false
    if (doorPaintedRef.current) doorPaintedRef.current.visible = false
    isOpenRef.current = false
    isTiltLockedRef.current = false
  }, [])

  /*
    回到 idle 时把这扇门的局部状态清干净。

    ## 与旧实现的区别

    原先这是一个 `executeFailureCleanup(commands)`：由 `useDoorEntryOrchestrator`
    在**观察到 `failed → idle` 这次转移**时调用，命令清单来自
    `decideDoorEntry({ type: 'BACK' })`。两处问题：

    1. 「观察到某次转移」只能看见一帧。中间插进一次别的渲染，`previousPhaseRef`
       就被覆盖、清理永远不发生——表现是「从加载失败退出后再也传送不了」
       （`e2e/lab.spec.ts` 那条 `test.fail` 抓的就是它）
    2. 清理内容用「命令清单」间接表达，而这四件事本来就是这扇门自己的局部状态

    现在只看**当前相位**：idle 且我曾是这次进房的门 → 清。不需要知道"从哪来"，
    所以漏不掉。相位从 `failed`、`exiting` 还是 `aligning` 回来都一样处理
    ——它们都意味着"这次进房结束了"。
  */
  const wasEntryOwnerRef = useRef(false)
  useEffect(() => {
    if (isEntryOwner) {
      wasEntryOwnerRef.current = true
      return
    }
    if (!wasEntryOwnerRef.current) return
    if (roomLoadState.phase !== 'idle') return

    wasEntryOwnerRef.current = false
    restoreSavedCamera()
    resetDoorVisuals()
    setIsInsideRoom(false)
    setIsAnimating(false)
    setShowRoom(false)
    setCameraOverride(false)
  }, [
    isEntryOwner,
    resetDoorVisuals,
    restoreSavedCamera,
    roomLoadState.phase,
    setCameraOverride,
  ])

  useDoorEntryOrchestrator({
    roomId,
    roomLoadState,
    isEntryOwner,
    isFastTeleport,
    openDoorPanels,
    flyIntoRoom,
  })

  // ─── Exit room handler ───────────────────────────────────────────────────────
  const exitRoom = useCallback(() => {
    if (!isEntryOwner || !isInsideRoom || isAnimating) return
    setIsAnimating(true)

    const saved    = savedCameraState.current
    const aligned  = doorAlignedState.current

    const startRot = { x: camera.rotation.x, y: camera.rotation.y, z: camera.rotation.z }
    const step1RotProxy = { ...startRot }

    // Step 1: fly back to aligned position
    gsap.to(camera.position, {
      x: aligned.x, y: aligned.y, z: aligned.z,
      duration: 1.5, ease: 'power2.inOut',
    })
    gsap.to(step1RotProxy, {
      x: 0, y: aligned.rotY, z: 0,
      duration: 1.5, ease: 'power2.inOut',
      onUpdate: () => { camera.rotation.set(step1RotProxy.x, step1RotProxy.y, step1RotProxy.z) },
      onComplete: () => {
        // Step 2: animate back to original corridor position
        gsap.to(camera.position, {
          x: saved.x, y: saved.y, z: saved.z,
          duration: 1.0, ease: 'power2.inOut',
        })
        const step2RotProxy = { x: camera.rotation.x, y: camera.rotation.y, z: camera.rotation.z }
        gsap.to(step2RotProxy, {
          x: saved.rotX, y: saved.rotY, z: saved.rotZ,
          duration: 1.0, ease: 'power2.inOut',
          onUpdate: () => { camera.rotation.set(step2RotProxy.x, step2RotProxy.y, step2RotProxy.z) },
          onComplete: () => {
            camera.rotation.set(saved.rotX, saved.rotY, saved.rotZ)
            requestAnimationFrame(() => {
              closeDoorPanels(false, () => {
                setIsInsideRoom(false)
                setIsAnimating(false)
                isTiltLockedRef.current = false
                setShowRoom(false)
                contextExitRoom()
                setCameraOverride(false)
                // 退场动画真的播完了 —— 走 `EXIT_DONE` 而不是 `RESET`
                finishRoomExit()
              })
            })
          }
        })
      }
    })
  }, [isEntryOwner, isInsideRoom, isAnimating, camera, closeDoorPanels, contextExitRoom, finishRoomExit, setCameraOverride])

  // ─── exitRequested listener ──────────────────────────────────────────────────
  useEffect(() => {
    if (
      exitRequested
      && roomLoadState.phase === 'exiting'
      && isEntryOwner
      && isInsideRoom
      && !isAnimating
    ) {
      exitRoom()
    }
  }, [exitRequested, isEntryOwner, isInsideRoom, isAnimating, exitRoom, roomLoadState.phase])

  // ─── pendingDoorClick listener (teleport auto-click) ────────────────────────
  // Respond to the nearest segment's door so teleport works regardless of scroll depth.
  useEffect(() => {
    if (pendingDoorClick !== roomId || isOpenRef.current || isAnimating) return
    // 原先是裸 `/ 100`——段长若改动，这里静默算错段号，传送就点不到门（审计 B3）
    const currentSeg = segmentIndexAtZ(camera.position.z)
    if (segmentIndex === currentSeg) {
      handleClick({ isTeleport: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDoorClick, roomId, segmentIndex])

  // ─── Silent reset on teleport ────────────────────────────────────────────────
  useEffect(() => {
    if (
      isEntryOwner
      && isTeleporting
      && teleportPhase === 'teleporting'
      && isInsideRoom
      && currentRoom === roomId
    ) {
      resetRoomLoadForTeleport()
      contextExitRoom()
      resetDoorVisuals()
      setIsInsideRoom(false)
      setIsAnimating(false)
      setShowRoom(false)
    }
  }, [contextExitRoom, currentRoom, isEntryOwner, isInsideRoom, isTeleporting, resetDoorVisuals, resetRoomLoadForTeleport, roomId, teleportPhase])

  // ─── Hover handlers ──────────────────────────────────────────────────────────
  const handlePointerEnter = useCallback(() => {
    if (roomId !== 'gallery') preloadRoomAssets(roomId)
    if (isOpenRef.current || isAnimating) return
    play('door_hover')
    // Micro-open door on hover
    if (doorRef.current) {
      gsap.to(doorRef.current.rotation, { y: side === 'left' ? 0.25 : -0.25, duration: 0.3, ease: 'power2.out', overwrite: true })
    }
    for (const ref of [doorRevealRef, handleRevealRef]) {
      if (ref.current) gsap.to(ref.current, { uProgress: 1.0, duration: 0.8, ease: 'power2.out', overwrite: true })
    }
    if (hideDelayRef.current) hideDelayRef.current.kill()
    if (handlePaintedRef.current) handlePaintedRef.current.visible = true
    if (doorPaintedRef.current) doorPaintedRef.current.visible = true
  }, [isAnimating, play, roomId, side])

  const handlePointerLeave = useCallback(() => {
    if (isOpenRef.current || isAnimating) return
    // Return door to closed position
    if (doorRef.current) {
      gsap.to(doorRef.current.rotation, { y: 0, duration: 0.3, ease: 'power2.out', overwrite: true })
    }
    for (const ref of [doorRevealRef, handleRevealRef]) {
      if (ref.current) gsap.to(ref.current, { uProgress: 0.0, duration: 0.5, ease: 'power2.out', overwrite: true })
    }
    hideDelayRef.current = gsap.delayedCall(0.55, () => {
      if (handlePaintedRef.current) handlePaintedRef.current.visible = false
      if (doorPaintedRef.current) doorPaintedRef.current.visible = false
    })
  }, [isAnimating])

  // ─── Wall fill x positions ───────────────────────────────────────────────────
  const leftFillX  = wallOffsetX + (side === 'left'
    ? -(DOOR_WIDTH / 2 + SIDE_WALL_W / 2)
    :   DOOR_WIDTH / 2 + SIDE_WALL_W / 2)
  const rightFillX = wallOffsetX + (side === 'left'
    ?   DOOR_WIDTH / 2 + SIDE_WALL_W / 2
    : -(DOOR_WIDTH / 2 + SIDE_WALL_W / 2))

  return (
    // Outer group: pivot at outer wall edge — never rotates
    <group ref={outerGroupRef} position={[pivotX, position[1], position[2]]}>
      {/* Inner group: rotates + scales in useFrame */}
      <group ref={innerGroupRef}>

        {/* ── Wall fill left of door opening ──────────────────────────────── */}
        <mesh position={[leftFillX, 0, 0.005]}>
          <planeGeometry args={[SIDE_WALL_W, CORRIDOR_HEIGHT]} />
          <meshBasicMaterial map={wallTexClone} color="#e0ddd4" />
        </mesh>
        <mesh position={[leftFillX, BASEBOARD_Y, 0.008]}>
          <planeGeometry args={[SIDE_WALL_W, BASEBOARD_H]} />
          <meshBasicMaterial map={baseboardTexClone} color="#c8c4b8" />
        </mesh>

        {/* ── Wall fill right of door opening ─────────────────────────────── */}
        <mesh position={[rightFillX, 0, 0.005]}>
          <planeGeometry args={[SIDE_WALL_W, CORRIDOR_HEIGHT]} />
          <meshBasicMaterial map={wallTexClone} color="#e0ddd4" />
        </mesh>
        <mesh position={[rightFillX, BASEBOARD_Y, 0.008]}>
          <planeGeometry args={[SIDE_WALL_W, BASEBOARD_H]} />
          <meshBasicMaterial map={baseboardTexClone} color="#c8c4b8" />
        </mesh>

        {/* ── Door frame ───────────────────────────────────────────────────── */}
        <mesh position={[wallOffsetX, DOOR_CENTER_Y, 0.01]}>
          <planeGeometry args={[DOOR_WIDTH + 0.25, DOOR_HEIGHT + 0.25]} />
          <meshBasicMaterial map={frameTex} transparent alphaTest={0.1} />
        </mesh>

        {/* ── Room interior (lazy-mounted when showRoom = true) ────────────── */}
        {showRoom && (
          <group ref={roomRootRef}>
            <RoomInterior
              roomId={roomId}
              showRoom={showRoom}
              onLoading={handleRoomLoading}
              onReady={handleRoomReady}
              onError={handleRoomError}
              isExiting={isInsideRoom && isAnimating}
            />
          </group>
        )}

        {/* ── Door panel (single, pivots at hinge edge) ── */}
        <group
          ref={doorRef}
          position={[side === 'left' ? wallOffsetX - DOOR_WIDTH / 2 : wallOffsetX + DOOR_WIDTH / 2, DOOR_CENTER_Y, 0.02]}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          onClick={() => handleClick()}
        >
          {/* painted layer — hidden by default, shown on hover */}
          <mesh ref={doorPaintedRef} position={[side === 'left' ? DOOR_WIDTH / 2 : -DOOR_WIDTH / 2, 0, -0.001]} visible={false}>
            <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
            <meshBasicMaterial map={paintedTex} transparent alphaTest={0.3} />
          </mesh>
          {/* sketch RevealMaterial layer */}
          <mesh position={[side === 'left' ? DOOR_WIDTH / 2 : -DOOR_WIDTH / 2, 0, 0]}>
            <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
            {/* @ts-expect-error revealMaterial registered via extend() */}
            <revealMaterial
              ref={doorRevealRef}
              map={doorTex}
              transparent
              alphaTest={0.3}
              depthWrite={false}
              uProgress={0}
            />
          </mesh>
          {/* back face */}
          <mesh position={[side === 'left' ? DOOR_WIDTH / 2 : -DOOR_WIDTH / 2, 0, -0.005]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
            <meshBasicMaterial map={backTex} transparent alphaTest={0.3} />
          </mesh>
        </group>

        {/* ── Door handle: painted (hidden) + sketch RevealMaterial ─────────── */}
        <mesh
          ref={handlePaintedRef}
          position={[wallOffsetX + DOOR_WIDTH * 0.1, DOOR_CENTER_Y - 0.1, 0.065]}
          visible={false}
        >
          <planeGeometry args={[0.08, 0.22]} />
          <meshBasicMaterial map={handlePaintedTex} transparent alphaTest={0.1} depthWrite={false} />
        </mesh>
        <mesh position={[wallOffsetX + DOOR_WIDTH * 0.1, DOOR_CENTER_Y - 0.1, 0.07]}>
          <planeGeometry args={[0.08, 0.22]} />
          {/* @ts-expect-error revealMaterial registered via extend() */}
          <revealMaterial
            ref={handleRevealRef}
            map={handleTex}
            transparent
            alphaTest={0.1}
            depthWrite={false}
            uProgress={0}
          />
        </mesh>

        {/* ── Proximity glow ───────────────────────────────────────────────── */}
        <mesh ref={glowRef} position={[wallOffsetX, DOOR_CENTER_Y, 0]}>
          <planeGeometry args={[DOOR_WIDTH + 1.2, DOOR_HEIGHT + 1.2]} />
          <meshBasicMaterial color="#f5e6a3" transparent opacity={0} depthWrite={false} />
        </mesh>

        {/* ── Room label sign (pustatabliczka wooden board) ────────────────── */}
        <group ref={textGroupRef} position={[wallOffsetX, DOOR_CENTER_Y + DOOR_HEIGHT / 2 + 0.22, 0.06]}>
          <mesh>
            <planeGeometry args={[0.9, 0.35]} />
            <meshBasicMaterial map={signTex} transparent alphaTest={0.05} depthWrite={false} />
          </mesh>
          <Text
            position={[0, 0, 0.01]}
            fontSize={0.11}
            color="#5c4a2a"
            font={doorLabelFont}
            anchorX="center"
            anchorY="middle"
            maxWidth={0.75}
          >
            {label}
          </Text>
        </group>

        {/* ── Arrow hints (strzalka) — shown when camera is near ───────────── */}
        <group ref={arrowGroupRef} visible={false} position={[wallOffsetX, DOOR_CENTER_Y, 0.06]}>
          <mesh position={[-(DOOR_WIDTH / 2 + 0.35), 0, 0]}>
            <planeGeometry args={[0.3, 0.3]} />
            <primitive object={arrowMaterial} attach="material" />
          </mesh>
          <mesh position={[(DOOR_WIDTH / 2 + 0.35), 0, 0]} scale={[-1, 1, 1]}>
            <planeGeometry args={[0.3, 0.3]} />
            <primitive object={arrowMaterial} attach="material" />
          </mesh>
        </group>

      </group>
    </group>
  )
}
