'use client'

interface StatCardProps {
  value: string
  label: string
}

export function StatCard({ value, label }: StatCardProps) {
  return (
    <div
      className="glass-card rounded-xl p-6 text-center"
    >
      <div
        className="font-display text-2xl font-bold"
        style={{ color: 'var(--accent-primary)' }}
      >
        {value}
      </div>
      <div
        className="text-sm mt-1"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </div>
    </div>
  )
}
