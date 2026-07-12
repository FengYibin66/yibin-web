import { act, render } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const tutorialMocks = vi.hoisted(() => ({
  phase: 'aligning',
  showTutorial: vi.fn(),
}))

vi.mock('@/context/SceneContext', () => ({
  useScene: () => ({
    roomLoadState: { phase: tutorialMocks.phase },
  }),
}))

vi.mock('@/context/AchievementsContext', () => ({
  useAchievements: () => ({
    showTutorial: tutorialMocks.showTutorial,
  }),
}))

import { useRoomTutorial } from '@/hooks/useRoomTutorial'

function TutorialHarness({ tutorialId }: { tutorialId: string }) {
  useRoomTutorial(tutorialId)
  return null
}

describe('useRoomTutorial', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    tutorialMocks.phase = 'aligning'
    tutorialMocks.showTutorial.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not trigger outside the entered phase', () => {
    render(<TutorialHarness tutorialId="about_scroll" />)

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(tutorialMocks.showTutorial).not.toHaveBeenCalled()
  })

  it('triggers once after the entered delay', () => {
    tutorialMocks.phase = 'entered'
    const { rerender } = render(<TutorialHarness tutorialId="projects_inspect" />)

    act(() => {
      vi.advanceTimersByTime(1999)
    })
    expect(tutorialMocks.showTutorial).not.toHaveBeenCalled()

    rerender(<TutorialHarness tutorialId="projects_inspect" />)
    act(() => {
      vi.advanceTimersByTime(1)
      vi.advanceTimersByTime(5000)
    })

    expect(tutorialMocks.showTutorial).toHaveBeenCalledTimes(1)
    expect(tutorialMocks.showTutorial).toHaveBeenCalledWith('projects_inspect')
  })

  it('cancels the pending tutorial when leaving entered', () => {
    tutorialMocks.phase = 'entered'
    const { rerender } = render(<TutorialHarness tutorialId="publications_read" />)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    tutorialMocks.phase = 'opening'
    rerender(<TutorialHarness tutorialId="publications_read" />)
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(tutorialMocks.showTutorial).not.toHaveBeenCalled()
  })

  it('cancels the pending tutorial when unmounted', () => {
    tutorialMocks.phase = 'entered'
    const { unmount } = render(<TutorialHarness tutorialId="contact_found" />)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    unmount()
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(tutorialMocks.showTutorial).not.toHaveBeenCalled()
  })
})
