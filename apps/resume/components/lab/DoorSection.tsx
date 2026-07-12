'use client'

import { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture, Text } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { useRouter } from 'next/navigation'
import { useAudio } from '@/context/AudioContext'
import { useScene } from '@/context/SceneContext'
import { useAchievements } from '@/context/AchievementsContext'
import type { RoomId } from '@/context/SceneContext'
import {
  decideDoorEntry,
  type DoorEntryCommand,
} from '@/lib/lab/doorEntryFlow'
import { isDoorEntryOwner } from '@/lib/lab/roomLoadMachine'
import { preloadRoomAssets } from '@/lib/lab/roomAssets'
import '@/components/lab/shaders/RevealMaterial'
import { RoomInterior } from './RoomInterior'
import { useDoorEntryOrchestrator } from './useDoorEntryOrchestrator'

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

interface DoorEscapeState {
  isInsideRoom: boolean
  isAnimating: boolean
  isTeleporting: boolean
}

export function handleDoorEscape(
  event: KeyboardEvent,
  state: DoorEscapeState,
  requestExit: () => void,
): void {
  if (event.key !== 'Escape') return
  if (!state.isInsideRoom || state.isAnimating || state.isTeleporting) return
  requestExit()
}

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
  const { unlockAchievement } = useAchievements()
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
    dispatchDoorEntry,
    markRoomOpening,
    timeoutRoomLoad,
    resetRoomLoad,
    resetRoomLoadForTeleport,
    requestExit,
  } = useScene()
  const { camera } = useThree()

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

  const isEntryOwner = isDoorEntryOwner(roomLoadState, roomId, segmentIndex)

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
  useFrame(() => {
    const inner = innerGroupRef.current
    if (!inner) return

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
      if (arrowGroupRef.current) {
        gsap.to(arrowGroupRef.current, { opacity: near ? 1 : 0, duration: 0.5 })
        arrowGroupRef.current.visible = near
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
    const result = dispatchDoorEntry({ type: 'ENTRY_COMPLETED' })
    if (!result?.commands.includes('ENTER_ROOM')) return
    enterRoom(roomId)
    setIsAnimating(false)
    setIsInsideRoom(true)
    unlockAchievement('corridor_enter')
    if (useFastMode) signalRoomReady()
  }, [dispatchDoorEntry, enterRoom, roomId, signalRoomReady, unlockAchievement])

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

  const handleRoomReady = useCallback(() => {
    if (!isEntryOwner) return
    if (roomLoadState.phase !== 'loading') return
    dispatchDoorEntry({ type: 'ROOM_READY' })
  }, [dispatchDoorEntry, isEntryOwner, roomLoadState.phase])

  const handleRoomError = useCallback((message: string) => {
    if (!isEntryOwner) return
    if (roomLoadState.phase !== 'loading') return
    dispatchDoorEntry({ type: 'ROOM_ERROR', message })
  }, [dispatchDoorEntry, isEntryOwner, roomLoadState.phase])

  // ─── Main click / teleport handler ──────────────────────────────────────────
  const handleClick = useCallback((opts?: { isTeleport?: boolean }) => {
    if (isAnimating || isOpenRef.current) return

    const isTeleport = opts?.isTeleport ?? false
    if (roomId !== 'gallery') {
      const result = dispatchDoorEntry({ type: 'CLICK', roomId, segmentIndex })
      if (!result?.commands.includes('ALIGN_CAMERA')) return
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

        const result = dispatchDoorEntry({ type: 'CAMERA_ALIGNED' })
        if (!result?.commands.includes('MOUNT_ROOM')) return
        setShowRoom(true)
      },
    })
  }, [camera, dispatchDoorEntry, isAnimating, isFastTeleport, position, roomId, router, segmentIndex, setCameraOverride, side, unlockAchievement])

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

  const executeFailureCleanup = useCallback((commands: DoorEntryCommand[]) => {
    if (commands.includes('RESTORE_CAMERA')) restoreSavedCamera()
    if (commands.includes('CLOSE_DOOR')) resetDoorVisuals()
    if (commands.includes('RESET_LOCAL_STATE')) {
      setIsInsideRoom(false)
      setIsAnimating(false)
      setShowRoom(false)
    }
    if (commands.includes('RELEASE_CAMERA_OVERRIDE')) setCameraOverride(false)
  }, [resetDoorVisuals, restoreSavedCamera, setCameraOverride])

  useDoorEntryOrchestrator({
    roomId,
    segmentIndex,
    roomLoadState,
    isEntryOwner,
    isFastTeleport,
    markRoomOpening,
    timeoutRoomLoad,
    openDoorPanels,
    flyIntoRoom,
    onFailureReset: executeFailureCleanup,
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
                resetRoomLoad()
              })
            })
          }
        })
      }
    })
  }, [isEntryOwner, isInsideRoom, isAnimating, camera, closeDoorPanels, contextExitRoom, resetRoomLoad, setCameraOverride])

  // ─── ESC key listener ────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleDoorEscape(
        e,
        { isInsideRoom, isAnimating, isTeleporting },
        requestExit,
      )
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isAnimating, isInsideRoom, isTeleporting, requestExit])

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
    const currentSeg = Math.floor((10 - camera.position.z) / 100)
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
    <group position={[pivotX, position[1], position[2]]}>
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
          <RoomInterior
            roomId={roomId}
            showRoom={showRoom}
            onReady={handleRoomReady}
            onError={handleRoomError}
            isExiting={isInsideRoom && isAnimating}
          />
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
            font="/fonts/CabinSketch-Bold.ttf"
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
            <meshBasicMaterial map={arrowTex} transparent alphaTest={0.05} depthWrite={false} />
          </mesh>
          <mesh position={[(DOOR_WIDTH / 2 + 0.35), 0, 0]} scale={[-1, 1, 1]}>
            <planeGeometry args={[0.3, 0.3]} />
            <meshBasicMaterial map={arrowTex} transparent alphaTest={0.05} depthWrite={false} />
          </mesh>
        </group>

      </group>
    </group>
  )
}
