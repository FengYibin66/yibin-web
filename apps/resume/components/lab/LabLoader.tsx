'use client'
import { useEffect, useRef, useMemo, useState } from 'react'
import gsap from 'gsap'
import { useLabLabels } from '@/hooks/useLabLabels'
import { useStableProgress } from '@/hooks/useStableProgress'
import { corridorRailHold, corridorRailRelease } from '@/lib/lab/app/camera/corridorRail'
import { markLabLoaded } from '@/lib/lab/app/labLoaded'
import { useCorridorStore } from '@/lib/lab/app/stores/corridorStore'
import { INTRO_TEAR_AT } from '@/lib/lab/domain/corridor/ink'
import { buildTearPoints, tearEdgeCoords } from '@/lib/lab/tearEdge'

const SLOW_LOAD_HINT_MS = 8000
/** 导轨独占者名（ADR 20260908204302 的 hold / release） */
const RAIL_OWNER = 'loader'
/** 纸撕开的时长；门"被画出来"与它同步 */
const TEAR_S = 1.8

export function LabLoader() {
  const labels = useLabLabels()
  // Monotonic progress (never jumps back to 0 between load waves);
  // `complete` only fires after loading has been quiet for a while.
  const { progress, complete } = useStableProgress(600)
  const containerRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const exitedRef = useRef(false)
  /** 导轨是否已被本组件独占（导轨挂载可能晚于首个进度事件，要重试） */
  const heldRef = useRef(false)

  // Escape hatch — on slow connections (mobile), offer the classic view
  // instead of leaving the user staring at a progress ring.
  const [showSlowHint, setShowSlowHint] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!exitedRef.current) setShowSlowHint(true)
    }, SLOW_LOAD_HINT_MS)
    return () => clearTimeout(timer)
  }, [])

  // 撕痕顶点来自 lib/lab/tearEdge —— 与 PaperTransition 共用同一条撕痕，且坐标
  // 已量化到 3 位小数。本组件会被 SSR，全精度的 Math.sin 结果在 Node 与浏览器
  // 之间可能末位不同，那会导致 React hydration 不匹配（审计 G4）。
  const tearPoints = useMemo(() => buildTearPoints(), [])
  const edge = useMemo(() => tearEdgeCoords(tearPoints), [tearPoints])

  const leftClip = `polygon(0% 0%, ${edge}, 0% 100%)`
  const rightClip = `polygon(100% 0%, ${edge}, 100% 100%)`

  // Direct DOM update for progress text — bypass React re-renders
  useEffect(() => {
    if (textRef.current) {
      textRef.current.textContent = `${progress}%`
    }
  }, [progress])

  /*
    加载期的两件事（规格 lab-corridor-story.md §1）：

    1. 进度进世界状态。门的 `uDraw` 订阅它——但加载中一直压在 `INTRO_TEAR_AT` 以下，
       门保持"一笔没画"；真正的"画出来"发生在纸撕开的那 1.8 秒（见 complete 分支）。
    2. 独占导轨：这张纸 `pointerEvents: none`，滚轮本来能穿过去在纸后面把走廊滚跑。
       导轨可能比首个进度事件更晚挂载，所以每次进度变化都试着 hold，直到成功。

    决定 D 的初稿是"30% 就撕开、看着走廊一笔笔画出来"。实测（限速到 2 Mbps）撕开后
    是**一片空白**：走廊整个在一个 Suspense 边界里，墙 / 地板 / 门要等最后一张纹理到位
    才一起出现——提前撕开只会让人对着空页面等。所以撕开仍在完成时；"画出来"改为
    与撕纸同步的一段过场。偏差已写回规格。
  */
  useEffect(() => {
    if (exitedRef.current) return
    useCorridorStore.getState().setLoadProgress(Math.min(INTRO_TEAR_AT, progress / 100))
    if (!heldRef.current) heldRef.current = corridorRailHold(RAIL_OWNER, () => {})
  }, [progress])

  // 卸载时别把导轨锁死
  useEffect(() => () => {
    if (heldRef.current) corridorRailRelease(RAIL_OWNER)
  }, [])

  // Trigger exit animation only on STABLE completion (all waves done + quiet)
  useEffect(() => {
    if (complete && !exitedRef.current) {
      exitedRef.current = true
      // 走廊状态机 loading → corridor（ADR 20260908204302）：此前点门 / 传送 / 路线都被拒。
      // LabLoader 不在 SceneProvider 之下（LabClient 里是兄弟），走模块级信号
      markLabLoaded()
      if (heldRef.current) {
        corridorRailRelease(RAIL_OWNER)
        heldRef.current = false
      }
      const container = containerRef.current
      const left = leftRef.current
      const right = rightRef.current
      const store = useCorridorStore.getState()
      if (!container || !left || !right) {
        store.setLoadProgress(1)
        return
      }

      setShowSlowHint(false)
      const tl = gsap.timeline({
        onComplete: () => {
          gsap.set(container, { display: 'none' })
          store.setLoadProgress(1)
        },
      })
      tl.to(left,      { xPercent: -100, rotation: -2, duration: TEAR_S, ease: 'power3.inOut' }, 0)
      tl.to(right,     { xPercent: 100,  rotation: 2,  duration: TEAR_S, ease: 'power3.inOut' }, 0)
      tl.to(container, { opacity: 0, duration: 0.4 }, 1.4)
      // 门与撕纸同步"被画出来"：进度从 INTRO_TEAR_AT 走到 1，靠近入口的门先画完
      const proxy = { p: INTRO_TEAR_AT }
      tl.to(proxy, {
        p: 1,
        duration: TEAR_S,
        ease: 'power1.out',
        onUpdate: () => useCorridorStore.getState().setLoadProgress(proxy.p),
      }, 0)
    }
  }, [complete])

  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {/* Left half */}
      <div
        ref={leftRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '55%',
          background: '#f5f0e8',
          backgroundImage: 'url(/textures/paper-texture.webp)',
          backgroundSize: '400px auto',
          clipPath: leftClip,
        }}
      />

      {/* Right half */}
      <div
        ref={rightRef}
        style={{
          position: 'absolute',
          inset: 0,
          left: '45%',
          width: '55%',
          background: '#f5f0e8',
          backgroundImage: 'url(/textures/paper-texture.webp)',
          backgroundSize: '400px auto',
          clipPath: rightClip,
        }}
      />

      {/* Centre progress indicator */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}
      >
        <div style={{ position: 'relative', width: 100, height: 100 }}>
          {/* Slow-connection escape hatch */}
          {showSlowHint && (
            <a
              href="/classic"
              style={{
                position: 'absolute',
                top: 'calc(100% + 28px)',
                left: '50%',
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 12,
                letterSpacing: '0.08em',
                color: 'rgba(42,31,14,0.65)',
                textDecoration: 'underline',
                textUnderlineOffset: 4,
                pointerEvents: 'auto',
              }}
            >
              {labels.fallback.slowConnection}
            </a>
          )}
          <svg
            width="100"
            height="100"
            viewBox="0 0 100 100"
            style={{ overflow: 'visible' }}
          >
            {/* Outer dashed ring — clockwise spin */}
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke="#2a1f0e"
              strokeWidth="1.5"
              strokeDasharray="10 15"
              style={{
                animation: 'llSpin 10s linear infinite',
                transformOrigin: '50px 50px',
              }}
            />
            {/* Inner dashed ring — counter-clockwise spin */}
            <circle
              cx="50" cy="50" r={28}
              fill="none"
              stroke="#2a1f0e"
              strokeWidth="1"
              strokeDasharray="5 10"
              style={{
                animation: 'llSpinRev 4s linear infinite',
                transformOrigin: '50px 50px',
              }}
            />
            {/* Progress arc */}
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke="rgba(42,31,14,0.3)"
              strokeWidth="1.5"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={offset}
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset 0.3s ease' }}
            />
          </svg>

          {/* Percentage text */}
          <span
            ref={textRef}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontFamily: 'var(--font-sketch-bold)',
              fontSize: 18,
              fontWeight: 'bold',
              color: '#2a1f0e',
              mixBlendMode: 'multiply',
              userSelect: 'none',
            }}
          >
            0%
          </span>
        </div>
      </div>

      <style>{`
        @keyframes llSpin    { to { transform: rotate(360deg)  } }
        @keyframes llSpinRev { to { transform: rotate(-360deg) } }
      `}</style>
    </div>
  )
}
