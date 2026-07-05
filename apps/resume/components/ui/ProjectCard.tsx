'use client'

import { useRef, useEffect } from 'react'
import type { ProjectItem } from '../../lib/content/types'

interface ProjectCardProps {
  item: ProjectItem
}

export function ProjectCard({ item }: ProjectCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    const handleMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const rx = ((e.clientY - cy) / (rect.height / 2)) * -6
      const ry = ((e.clientX - cx) / (rect.width / 2)) * 6
      card.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg)`
    }

    const handleLeave = () => {
      card.style.transform = 'none'
    }

    card.addEventListener('mousemove', handleMove)
    card.addEventListener('mouseleave', handleLeave)

    return () => {
      card.removeEventListener('mousemove', handleMove)
      card.removeEventListener('mouseleave', handleLeave)
    }
  }, [])

  const isLive = item.status === 'live'

  const cardContent = (
    <div
      ref={cardRef}
      className="rounded-xl p-5 border cursor-pointer h-full"
      style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--bg-border)',
        transition: 'transform 0.1s ease, border-color 0.2s',
      }}
    >
      {/* Gradient top bar */}
      <div className="h-px bg-gradient-to-r from-[#00d4ff] to-[#6366f1] mb-4 -mx-5 -mt-5 rounded-t-xl" />

      {/* Header row: name + status badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3
          className="font-display font-bold text-lg leading-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {item.name}
        </h3>
        <span
          className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium"
          style={
            isLive
              ? { color: '#00d4ff', borderColor: '#00d4ff55', background: '#00d4ff11' }
              : { color: '#6366f1', borderColor: '#6366f155', background: '#6366f111' }
          }
        >
          {isLive ? 'Live' : 'In Dev'}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
        {item.description}
      </p>

      {/* Tech tags */}
      <div className="flex flex-wrap gap-1.5">
        {item.tech.map((t) => (
          <span
            key={t}
            className="text-xs px-2 py-0.5 rounded border"
            style={{
              color: 'var(--text-secondary)',
              borderColor: 'var(--bg-border)',
              background: 'var(--bg-base, #08101e)',
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  )

  if (item.url) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full no-underline"
      >
        {cardContent}
      </a>
    )
  }

  return cardContent
}
