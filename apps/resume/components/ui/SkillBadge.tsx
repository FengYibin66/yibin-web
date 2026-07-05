'use client'

interface SkillBadgeProps {
  skill: string
}

export function SkillBadge({ skill }: SkillBadgeProps) {
  return (
    <span
      className="inline-block px-3 py-1 rounded-full text-sm border cursor-default transition-all duration-200
        hover:border-[#00d4ff55] hover:text-[#00d4ff] hover:shadow-[0_0_12px_#00d4ff33]"
      style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--bg-border)',
        color: 'var(--text-secondary)',
      }}
    >
      {skill}
    </span>
  )
}
