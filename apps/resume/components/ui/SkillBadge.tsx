'use client'

import { useRef } from 'react'

interface SkillBadgeProps {
  skill: string
}

const SHUFFLE_CHARS = 'ABCDEFabcdef!@#$%^&*0123456789<>'
const SHUFFLE_INTERVAL_MS = 40
const ITERATIONS_PER_CHAR = 3

export function SkillBadge({ skill }: SkillBadgeProps) {
  const spanRef = useRef<HTMLSpanElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleMouseEnter = () => {
    // Clear any running shuffle
    if (intervalRef.current) clearInterval(intervalRef.current)

    let iteration = 0
    const totalSteps = skill.length * ITERATIONS_PER_CHAR

    intervalRef.current = setInterval(() => {
      const el = spanRef.current
      if (!el) return

      const revealedCount = Math.floor(iteration / ITERATIONS_PER_CHAR)
      el.textContent = skill
        .split('')
        .map((char, i) => {
          if (i < revealedCount) return char
          if (char === ' ') return ' '
          return SHUFFLE_CHARS[Math.floor(Math.random() * SHUFFLE_CHARS.length)]
        })
        .join('')

      if (iteration >= totalSteps) {
        clearInterval(intervalRef.current!)
        el.textContent = skill  // ensure final text is correct
      }
      iteration++
    }, SHUFFLE_INTERVAL_MS)
  }

  const handleMouseLeave = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    const el = spanRef.current
    if (el) el.textContent = skill
  }

  return (
    <span
      ref={spanRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="inline-block px-3 py-1 rounded-full text-sm border cursor-default transition-all duration-200
        hover:border-[#00d4ff55] hover:text-[#00d4ff] hover:shadow-[0_0_12px_#00d4ff33] font-mono select-none"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--bg-border)', color: 'var(--text-secondary)' }}
    >
      {skill}
    </span>
  )
}
