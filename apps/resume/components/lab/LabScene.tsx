'use client'

import { useRef, useCallback, Suspense, useEffect, useState } from 'react'
import { OVERLAY_COLORS } from '@/lib/lab/domain/overlayColors'
import { Canvas } from '@react-three/fiber'

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
gsap.registerPlugin(ScrollTrigger)
import { CameraRig } from './CameraRig'
import { InfiniteCorridorManager } from './InfiniteCorridorManager'
import { SceneFog } from './SceneFog'

// Kick off all texture requests in ONE LoadingManager wave as soon as this
// chunk loads — before components mount and start their suspense waterfalls.
// This is what keeps useProgress from cycling 0→100 multiple times.
if (typeof window !== 'undefined') preloadCorridorTextures()
import { PaperTransition } from './PaperTransition'
import { TeleportRoom } from './TeleportRoom'
import { LabTutorial } from './LabTutorial'
import { useEscapeRouter } from './useEscapeRouter'
import { RoomLoadingIndicator } from './RoomLoadingIndicator'
import { NavigationUI } from '@/components/ui/NavigationUI'

import { useCorridorCamera } from '@/hooks/useCorridorCamera'
import {
  preloadCorridorTextures,
  reloadRoomAssets,
} from '@/lib/lab/app/assets/preload'
import { PerformanceProvider, usePerformance } from '@/context/PerformanceContext'
import { AudioProvider, useAudio } from '@/context/AudioContext'
import { SceneProvider, useScene } from '@/context/SceneContext'
import { AchievementsProvider, useAchievements } from '@/context/AchievementsContext'
import { WheelRouterProvider } from '@/hooks/useWheelRouter'
import { useLabLabels } from '@/hooks/useLabLabels'

// Camera controller lives inside Canvas so it has access to R3F context
function CameraController({
  onSetOverride,
  onExplored,
}: {
  onSetOverride: (fn: (active: boolean) => void) => void
  onExplored: () => void
}) {
  const { setCameraOverride } = useCorridorCamera({
    smoothing: 0.035,
    scrollSpeed: 0.02,
    onExplored,
  })

  useEffect(() => {
    onSetOverride(setCameraOverride)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

function LabCanvas() {
  const labels = useLabLabels()
  const { settings } = usePerformance()
  const { playBgm, stopBgm } = useAudio()
  const {
    currentRoom,
    isInRoom,
    markEntered,
    roomLoadState,
    retryRoomLoad,
    resetRoomLoad,
  } = useScene()
  const { unlockAchievement, enterScope } = useAchievements()

  /*
    场景切换时清掉不属于当前场景的气泡（ADR 20260903211302）。

    这是**唯一**需要调用的清理入口，也是刻意只放一处的：原先「什么时候关掉教程
    气泡」由四个互不知情的房间组件各自负责，结果只有一间房做了——教程气泡退房后
    残留并堵死队列，让后续所有教程永远显示不出来（审计 A7 记过并标为已修，
    实际只修了一间房）。

    清理动作只发生在场景切换这一处，就漏不掉；房间组件的卸载路径里还有一层
    `useRoomTutorial` 的按 id 出队，两条互不依赖（传送时房间可能被整棵子树替换，
    那时组件卸载不一定按预期发生）。
  */
  useEffect(() => {
    enterScope(isInRoom && currentRoom ? `room:${currentRoom}` : 'corridor')
  }, [isInRoom, currentRoom, enterScope])

  // Lab 里唯一的 ESC 监听点（ADR 20260903211244）
  useEscapeRouter()

  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    setIsTouch(window.matchMedia('(pointer: coarse)').matches)
  }, [])

  // Mark as entered immediately — /lab route means the user has entered the corridor
  useEffect(() => { markEntered() }, [markEntered])

  /*
    `corridor_explore` 的解锁点在**走廊导轨的位移**上，不在输入事件上
    （见 `domain/corridor/exploration.ts`）。

    原先监听 `wheel` / `touchmove`，于是键盘前进（↑↓ / PgUp / PgDn / 空格）不算
    ——键盘用户永远拿不到这个成就，而它那条教程气泡**只有被解锁才会消失**
    （教程不自动消失），所以从进 Lab 起就有一条关不掉的白底气泡压在屏幕底部。
  */
  const handleExplored = useCallback(() => {
    unlockAchievement('corridor_explore')
  }, [unlockAchievement])

  const setCameraOverrideRef = useRef<(active: boolean) => void>(() => {})

  const handleSetOverride = useCallback((fn: (active: boolean) => void) => {
    setCameraOverrideRef.current = fn
  }, [])

  const setCameraOverride = useCallback((active: boolean) => {
    setCameraOverrideRef.current(active)
  }, [])

  /**
   * 清掉这间房被"毒化"的纹理缓存。
   *
   * drei 的 `useTexture` 会把**失败的 promise 也缓存起来**。所以一次加载失败之后，
   * 下一次读同一批纹理会立刻拿到同一个 rejection——不重新发请求、不管网络是否
   * 已经恢复。
   *
   * 不清的表现：加载失败 → 返回走廊 → 再进这间房 **立刻又失败**（实测约 1 秒内
   * 就到 `failed`，比第一次的超时快得多）。也就是说那间房**永久坏掉**，
   * 直到用户恰好选了"重试"而不是"返回走廊"——只有重试那条路径清了缓存。
   *
   * 这条是写失败路径 E2E 时查出来的，而我一开始把根因判断成了门的 ref 记账
   * （`ownedEntryRef` / `previousPhaseRef`）。实测数据推翻了那个判断：返回走廊后
   * `phase: idle` / `teleporting: false`，清理其实完全正常。**是缓存的问题，
   * 不是状态机的问题。**
   */
  const clearFailedRoomAssets = useCallback(() => {
    const roomId = roomLoadState.roomId
    if (roomId && roomId !== 'gallery') reloadRoomAssets(roomId)
  }, [roomLoadState.roomId])

  const handleRetryRoomLoad = useCallback(() => {
    clearFailedRoomAssets()
    retryRoomLoad()
  }, [clearFailedRoomAssets, retryRoomLoad])

  /** 放弃这次失败，回到走廊。同样要清缓存，否则这间房再也进不去 */
  const handleBackFromFailure = useCallback(() => {
    clearFailedRoomAssets()
    resetRoomLoad()
  }, [clearFailedRoomAssets, resetRoomLoad])

  useEffect(() => {
    playBgm('corridor_bg')
    return () => stopBgm()
  }, [playBgm, stopBgm])

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#f0ece4', touchAction: 'none', overscrollBehavior: 'none' }}>
      <Canvas
        camera={{ position: [0, 0.2, 28], fov: 60, near: 0.1, far: 400 }}
        style={{ position: 'absolute', inset: 0 }}
        gl={{ antialias: settings.antialias }}
        dpr={settings.dpr}
      >
        <Suspense fallback={null}>
          {/*
            雾按所在空间切换（原先写死在这里，对房间内容也生效——审计 A1/A4
            的第三个原因）。走廊要距离雾，封闭房间不要。见 SceneFog。
          */}
          <SceneFog />
          {/* 相机所有者接进渲染循环，全站唯一一处（ADR 20260903140617） */}
          <CameraRig />
          <CameraController onSetOverride={handleSetOverride} onExplored={handleExplored} />
          <InfiniteCorridorManager setCameraOverride={setCameraOverride} />

          <TeleportRoom />
        </Suspense>
      </Canvas>

      <RoomLoadingIndicator
        state={roomLoadState}
        onRetry={handleRetryRoomLoad}
        onBack={handleBackFromFailure}
      />

      {!isInRoom && (
        <div style={{
          position: 'absolute',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.4em', color: OVERLAY_COLORS.hint, margin: 0 }}>
            {(isTouch ? labels.hints.swipeUpDown : labels.hints.scroll).toUpperCase()}
          </p>
        </div>
      )}

      {!isInRoom && (
        <a
          href="/"
          style={{
            position: 'fixed', top: '20px', left: '20px', zIndex: 50,
            fontFamily: 'var(--font-mono)', fontSize: '12px', color: OVERLAY_COLORS.exitLab,
            textDecoration: 'none', letterSpacing: '0.1em',
          }}
        >
          ← {labels.panels.exitLab}
        </a>
      )}

      <PaperTransition />
      <NavigationUI />
      <LabTutorial />

    </div>
  )
}

export function LabScene() {
  return (
    <PerformanceProvider>
      <AudioProvider>
        <SceneProvider>
          <AchievementsProvider>
            <WheelRouterProvider>
              <LabCanvas />
            </WheelRouterProvider>
          </AchievementsProvider>
        </SceneProvider>
      </AudioProvider>
    </PerformanceProvider>
  )
}
