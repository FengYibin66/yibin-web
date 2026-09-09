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
 * 入口页底部的「点一扇门进入」提示。
 *
 * ## 三处改动的来由（2026-09-09）
 *
 * **1. 不再自己 `position: fixed`。** 它原先是 `fixed; bottom:16; left:50%;
 * translateX(-50%); z:100`，而 `app/page.tsx` 的域名水印是**逐字相同的坐标**、
 * z=30——桌面上水印 100% 被这条白底盖住，从本组件上线那天起没人见过。
 * 现在两者都由 `EdgeItem` 放进声明好的槽位（ADR 20260909182319）。
 *
 * **2. 手机上首访显示、数秒后淡出。** 它 100% 盖住 Classic 面板的「打开简历」
 * 主按钮（实测重叠 100%，`elementFromPoint` 在按钮中心命中的是本组件）。
 * 漏斗第一步就断。桌面屏幕高、不遮挡，按用户要求保持常驻。
 *
 * **3. 音频开关搬走了。** 原先 `[ON]/[OFF]` 是本条文本里唯一可交互的元素
 * （约 30×16px），提示一淡出就把它一起带走。所以先有 `EntryAudioToggle`
 * （右上角、44×44、有可访问名），本条才能安全消失。
 *
 * `data-explorer-bar` 必须保留：`scripts/media/entry-firstframe.mjs` 截手机端
 * 静态首帧时靠它把这条藏掉（它不属于"那扇门"）。靠内联样式匹配太脆——
 * 改一下样式截图脚本就静默失效、把这条字烤进占位图，而那张图桌面开发时看不到。
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
