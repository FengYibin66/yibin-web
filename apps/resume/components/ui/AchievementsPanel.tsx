'use client'

import { useAchievements } from '@/context/AchievementsContext'
import { useLabLabels } from '@/hooks/useLabLabels'
import { COLLECTABLE_ACHIEVEMENT_IDS, HINT_ONLY_ACHIEVEMENTS } from '@/lib/lab/domain/ids'

interface AchievementsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function AchievementsPanel({ isOpen, onClose }: AchievementsPanelProps) {
  const { completed } = useAchievements()
  const labels = useLabLabels()
  // 只算可收集的：corridor_enter 是入门提示，不是成就（见 domain/ids）
  const total = COLLECTABLE_ACHIEVEMENT_IDS.length

  return (
    <div
      className={`achievements-panel${isOpen ? ' open' : ''}`}
      aria-hidden={!isOpen}
      data-testid="achievements-panel"
      data-open={isOpen}
    >
        <div className="achievements-card">
          <div className="achievements-header">
            <h3>{labels.panels.achievements}</h3>
            <button
              className="close-btn"
              onClick={onClose}
              aria-label={labels.panels.closeAchievements}
              data-testid="achievements-close"
            >
              <svg viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="achievements-list">
            {COLLECTABLE_ACHIEVEMENT_IDS.map((id) => {
              const achievement = { id, ...labels.tutorials[id] }
              const isUnlocked = completed.includes(id)
              return (
                <div key={achievement.id} className={`achievement-item${isUnlocked ? '' : ' locked'}`}>
                  <div className="achievement-icon">
                    {isUnlocked ? (
                      <svg viewBox="0 0 24 24">
                        <path d="M12 15l-3-3 1.4-1.4 1.6 1.6 4.6-4.6L18 9" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="10" fill="none" stroke="#1a1a1a" strokeWidth="2" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24">
                        <rect x="7" y="11" width="10" height="8" rx="2" fill="none" stroke="#666" strokeWidth="2" />
                        <path d="M9 11V8a3 3 0 0 1 6 0v3" fill="none" stroke="#666" strokeWidth="2" />
                      </svg>
                    )}
                  </div>
                  <div className="achievement-text">
                    <div className="achievement-title">{achievement.title}</div>
                    <div className="achievement-label">{achievement.label}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="achievements-footer">
            {labels.panels.exploredCount
              .replace('{done}', String(completed.filter(id => !HINT_ONLY_ACHIEVEMENTS.includes(id as never)).length))
              .replace('{total}', String(total))}
          </div>
        </div>
      </div>
  )
}
