'use client'

import { useEffect, useRef, useState } from 'react'

import { useLabLabels } from '@/hooks/useLabLabels'
import { useViewport } from '@/hooks/useViewport'
import { prefersReducedMotion } from '@/lib/lab/app/motion'
import {
  EXPLORER_HINT_MS,
  hasSeenExplorerHint,
  markExplorerHintSeen,
} from '@/lib/entry/explorerHintStorage'

/**
 * 入口页底部的「点一扇门进入」提示。定位由 `EdgeItem` 负责
 * （ADR 20260909182319）。
 *
 * **手机上首访显示、数秒后淡出**：它 100% 盖住 Classic 面板的「打开简历」主按钮，
 * 漏斗第一步就断。桌面屏幕高、不遮挡，保持常驻。
 *
 * `data-explorer-bar` 必须保留：`scripts/media/entry-firstframe.mjs` 截手机端
 * 静态首帧时靠它把这条藏掉。改成靠内联样式匹配会静默失效，
 * 把这条字烤进占位图——而那张图桌面开发时看不到。
 */
export function ExplorerBar() {
  const labels = useLabLabels()
  const viewport = useViewport()
  const [hidden, setHidden] = useState(false)
  const dismissed = useRef(false)

  const isTouch = viewport?.isTouch ?? false
  // 桌面常驻；触屏只在首访显示
  const ephemeral = isTouch
  const [seen] = useState(() => hasSeenExplorerHint())

  useEffect(() => {
    if (!ephemeral || seen) return

    const dismiss = () => {
      if (dismissed.current) return
      dismissed.current = true
      setHidden(true)
      markExplorerHintSeen()
    }

    const timer = window.setTimeout(dismiss, EXPLORER_HINT_MS)
    // 任何交互都立刻收起：它是提示，不是拦路。用 `once` 而不是自己管移除，
    // 少一处泄漏可能。
    const opts = { once: true, passive: true } as const
    window.addEventListener('pointerdown', dismiss, opts)
    window.addEventListener('touchstart', dismiss, opts)
    window.addEventListener('wheel', dismiss, opts)
    window.addEventListener('keydown', dismiss, { once: true })

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('touchstart', dismiss)
      window.removeEventListener('wheel', dismiss)
      window.removeEventListener('keydown', dismiss)
    }
  }, [ephemeral, seen])

  // 触屏且已看过 → 根本不渲染（不是渲染后隐藏：那会让首帧闪一下）
  if (ephemeral && seen) return null

  const reduced = prefersReducedMotion()

  return (
    <div
      data-explorer-bar=""
      style={{
        background: 'rgba(255,255,255,0.92)',
        border: '2px solid #1a1a1a',
        borderRadius: '12px',
        boxShadow: '3px 3px 0 #1a1a1a',
        padding: isTouch ? '8px 16px' : '10px 28px',
        maxWidth: 'min(92vw, 640px)',
        textAlign: 'center',
        // 淡出而不是 display:none —— 后者会让同槽位的 flex 兄弟跳一下位置。
        // reduced-motion 下不做过渡，但**功能不变**（照样会消失）：
        // 减少动效不等于取消行为。
        opacity: hidden ? 0 : 1,
        transition: reduced ? 'none' : 'opacity 400ms ease-out',
        pointerEvents: 'none',
      }}
    >
      <span style={{
        fontFamily: 'var(--font-sketch-bold)',
        fontSize: '13px',
        letterSpacing: '0.08em',
        color: '#1a1a1a',
        userSelect: 'none',
      }}>
        {labels.entry.explorerBar}
        <span style={{ margin: '0 8px', opacity: 0.4 }}>—</span>
        {isTouch ? labels.entry.explorerHintTouch : labels.entry.explorerHint}
      </span>
    </div>
  )
}
