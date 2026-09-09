'use client'

import { useAudio } from '@/context/AudioContext'
import { useLabLabels } from '@/hooks/useLabLabels'

/**
 * 入口页右上角的静音开关。原先是 `ExplorerBar` 文本里的 `[ON]/[OFF]`——
 * 提示里唯一可交互的元素，所以提示要能淡出，必须先把它挪出来。
 *
 * 视觉上与同槽位的 `LocaleToggle` 对齐：它们现在是同一个 flex 容器里的兄弟。
 */
export function EntryAudioToggle() {
  const { isMuted, toggleMute } = useAudio()
  const labels = useLabLabels()

  return (
    <button
      type="button"
      onClick={toggleMute}
      // 44×44：Apple HIG 的触摸下限。图标本身仍是 18px，视觉重量不变——
      // 变大的是命中区，而且用 min-width/height 而非伪元素，
      // 这样 `:focus-visible` 的焦点环跟着变大（伪元素扩大命中区做不到这一点）。
      className="inline-flex items-center justify-center rounded-full border transition-all duration-200
        hover:border-[#00d4ff] hover:text-[#00d4ff] hover:shadow-[0_0_12px_#00d4ff33]"
      style={{
        minWidth: 44,
        minHeight: 44,
        background: 'var(--bg-surface)',
        borderColor: 'var(--bg-border)',
        color: 'var(--text-secondary)',
      }}
      aria-label={isMuted ? labels.panels.unmute : labels.panels.mute}
      aria-pressed={isMuted}
      data-testid="entry-audio-toggle"
    >
      {/* 扬声器；静音时叠一条斜线。18px 里再多细节就成一团灰点 */}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 9.5h3l4.5-3.5v12L7 14.5H4z" fill="currentColor" stroke="none" />
        {isMuted ? (
          <path d="M16 9.5l4.5 5m0-5l-4.5 5" />
        ) : (
          <>
            <path d="M16.2 8.6a5 5 0 0 1 0 6.8" />
            <path d="M18.9 6.3a8.5 8.5 0 0 1 0 11.4" />
          </>
        )}
      </svg>
    </button>
  )
}
