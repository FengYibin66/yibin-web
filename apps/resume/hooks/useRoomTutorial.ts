'use client'

import { useEffect } from 'react'

import { useAchievements } from '@/context/AchievementsContext'
import { useScene } from '@/context/SceneContext'

const ROOM_TUTORIAL_DELAY_MS = 2000

export function useRoomTutorial(tutorialId: string): void {
  const { roomLoadState: { phase } } = useScene()
  const { showTutorial } = useAchievements()

  useEffect(() => {
    if (phase !== 'entered') return

    const tutorialTimer = window.setTimeout(
      () => showTutorial(tutorialId),
      ROOM_TUTORIAL_DELAY_MS,
    )

    return () => window.clearTimeout(tutorialTimer)
  }, [phase, showTutorial, tutorialId])
}
