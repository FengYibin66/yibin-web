'use client'

import dynamic from 'next/dynamic'
import { useScene } from '@/context/SceneContext'
import { useWheelRouter } from '@/hooks/useWheelRouter'
import { useEffect } from 'react'

const GalleryTrack = dynamic(
  () => import('@/components/gallery/GalleryTrack').then(m => ({ default: m.GalleryTrack })),
  { ssr: false, loading: () => null }
)

/**
 * GalleryRoomPortal — 纯 React DOM 组件，完全不经过 R3F Canvas 树。
 * 在 LabScene 的 Canvas 外部 div 中条件渲染，通过 currentRoom === 'gallery' 触发。
 */
export function GalleryRoomPortal() {
  const { requestExit } = useScene()
  const router = useWheelRouter()

  useEffect(() => {
    // 进场：停走廊，激活 gallery（GSAP ScrollTrigger 自己监听 wheel）
    router.activate('room:gallery')
    router.deactivate('corridor')
    window.scrollTo(0, 0)

    // GSAP ScrollTrigger 需要真实的 window 滚动。
    // 给 body 加一个超大的 min-height 使得页面产生滚动空间，
    // 同时覆盖掉走廊 Canvas 的 overflow 限制。
    const prevOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'auto'
    document.body.style.overflow = 'auto'

    return () => {
      // 退场：恢复走廊
      router.activate('corridor')
      router.deactivate('room:gallery')
      document.documentElement.style.overflow = prevOverflow
      document.body.style.overflow = ''
    }
  }, [router])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#f0ece4',
        overflowY: 'auto',
      }}
    >
      <button
        onClick={requestExit}
        style={{
          position: 'fixed',
          top: 20,
          left: 20,
          zIndex: 10001,
          background: 'rgba(255,255,255,0.9)',
          border: '1.5px solid rgba(42,31,14,0.15)',
          borderRadius: 6,
          padding: '8px 14px',
          fontFamily: "'CabinSketch-Bold', serif",
          fontSize: 13,
          color: '#2a1f0e',
          cursor: 'pointer',
        }}
        aria-label="Back to corridor"
      >
        ← Back to Corridor
      </button>

      <GalleryTrack />
    </div>
  )
}
