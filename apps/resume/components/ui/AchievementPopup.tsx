'use client'

import { useAchievements } from '@/context/AchievementsContext'
import { useLabLabels } from '@/hooks/useLabLabels'
import { isAchievementId } from '@/lib/lab/domain/ids'

export function AchievementPopup() {
  const { activePopup } = useAchievements()
  const labels = useLabLabels()

  if (!activePopup) return null
  if (!isAchievementId(activePopup.id)) return null

  // 文案走 i18n（审计 E7）——原先读的是 Context 里那张英文表
  const data = labels.tutorials[activePopup.id]
  if (!data) return null

  // 按 kind 判样式而不是 status：淡出时 status 变成 'hiding'，
  // 但一个庆祝气泡在淡出过程中仍该是庆祝的样子
  const isCompleted = activePopup.kind === 'completed'
  const isHiding    = activePopup.status === 'hiding'

  return (
    <div
      className={`achievement-popup${isHiding ? ' hiding' : ''}`}
      data-testid="achievement-popup"
      data-popup-kind={activePopup.kind}
      data-popup-id={activePopup.id}
    >
        {/* SVG torn-edge border overlay */}
        <svg className="popup-border" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path
            d="M 0 0 L 100 0 L 100 0 L 98 10 L 100 20 L 97 35 L 100 50 L 98 65 L 100 80 L 97 90 L 100 100 L 90 97 L 80 100 L 70 96 L 60 100 L 50 97 L 40 100 L 30 96 L 20 100 L 10 97 L 0 100 L 0 100 L 2 90 L 0 80 L 3 65 L 0 50 L 2 35 L 0 20 L 3 10 L 0 0 Z"
            fill="none"
            stroke="#1a1a1a"
            strokeWidth="0.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="popup-content">
          <div className={`checkbox${isCompleted ? ' checked' : ''}`}>
            {isCompleted && (
              <svg viewBox="0 0 24 24" className="checkmark">
                <path
                  d="M5 13l4 4L19 7"
                  fill="none"
                  stroke="#1a1a1a"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
          <div className="text-content">
            <span className="popup-title">{data.title}</span>
            <span className="popup-desc">{data.label}</span>
          </div>
        </div>
      </div>
  )
}
