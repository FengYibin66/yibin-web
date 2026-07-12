'use client'

import { useRef, useEffect } from 'react'
import type { ProjectItem, ProjectStatus } from '../../lib/content/types'

interface ProjectCardProps {
  item: ProjectItem
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  live: 'Live',
  dev: 'In Dev',
  internal: 'Internal',
  archive: 'Archive',
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

    const handleEnter = () => {
      card.style.boxShadow = [
        'inset 0 1px 0 rgba(255,255,255,0.08)',
        '0 8px 32px rgba(0,0,0,0.45)',
        '0 1px 2px rgba(0,0,0,0.6)',
        '0 0 0 1px rgba(0,212,255,0.15)',
        '0 0 20px rgba(0,212,255,0.08)',
      ].join(', ')
    }

    const handleLeave = () => {
      card.style.transform = 'none'
      card.style.boxShadow = ''
    }

    card.addEventListener('mousemove', handleMove)
    card.addEventListener('mouseenter', handleEnter)
    card.addEventListener('mouseleave', handleLeave)

    return () => {
      card.removeEventListener('mousemove', handleMove)
      card.removeEventListener('mouseenter', handleEnter)
      card.removeEventListener('mouseleave', handleLeave)
    }
  }, [])

  const status = item.status

  const badgeStyle =
    status === 'live'
      ? { color: 'var(--accent-primary)', borderColor: '#00d4ff55', background: '#00d4ff11' }
      : status === 'dev'
        ? { color: 'var(--accent-secondary)', borderColor: '#6366f155', background: '#6366f111' }
        : status === 'archive'
          ? { color: 'var(--text-secondary)', borderColor: 'var(--bg-border)', background: 'transparent' }
          : { color: '#fbbf24', borderColor: '#fbbf2455', background: '#fbbf2411' }

  const cardContent = (
    <div
      ref={cardRef}
      className="glass-card rounded-xl p-5 cursor-pointer h-full"
      style={{
        transition: 'transform 0.1s ease, background 0.2s ease, border-top-color 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      <div className="h-px bg-gradient-to-r from-[#00d4ff] to-[#6366f1] mb-4 -mx-5 -mt-5 rounded-t-xl" />

      <div className="flex items-start justify-between gap-2 mb-2">
        <h3
          className="font-display font-bold text-lg leading-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {item.name}
        </h3>
        {status ? (
          <span
            className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium"
            style={badgeStyle}
          >
            {STATUS_LABEL[status]}
          </span>
        ) : null}
      </div>

      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
        {item.description}
      </p>

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
