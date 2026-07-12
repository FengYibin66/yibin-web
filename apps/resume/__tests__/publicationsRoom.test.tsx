import {
  StrictMode,
  forwardRef,
  useEffect,
  useImperativeHandle,
  type Ref,
} from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublicationCardHandle } from '@/components/rooms/publications/PublicationCard'
import type { PublicationClotheslineHandle } from '@/components/rooms/publications/PublicationClothesline'
import type { PublicationMotionState } from '@/components/rooms/publications/publicationMotionMachine'
import type { PublicationRoomItem } from '@/components/rooms/publications/publicationTypes'

const PUBLICATIONS: readonly PublicationRoomItem[] = [
  {
    id: 'paper-a',
    title: 'Paper A',
    venue: 'CHI',
    year: 2025,
    authors: 'Yibin Feng',
    abstract: 'A',
    doi: 'https://doi.org/10.1145/a',
    keywords: [],
    featured: true,
  },
  {
    id: 'paper-b',
    title: 'Paper B',
    venue: 'CSCW',
    year: 2026,
    authors: 'Yibin Feng',
    abstract: 'B',
    doi: 'https://doi.org/10.1145/b',
    keywords: [],
    featured: false,
  },
]

interface Deferred {
  promise: Promise<void>
  resolve: () => void
}

function createDeferred(): Deferred {
  let resolve = () => {}
  const promise = new Promise<void>(settle => {
    resolve = settle
  })
  return { promise, resolve }
}

interface ClotheslineProps {
  publications: readonly PublicationRoomItem[]
  motion: PublicationMotionState
  isInteractionLocked: boolean
  onSelect: (id: string) => void
  onCardReady: (id: string, handle: PublicationCardHandle | null) => void
}

const mocks = vi.hoisted(() => ({
  scene: {
    isTeleporting: false,
    teleportPhase: null as 'closing' | 'teleporting' | 'opening' | null,
    currentRoom: null as 'publications' | null,
  },
  paint: {
    isRevealing: false,
    paint: { opacity: 1, onBeforeCompile: vi.fn() },
    reveal: vi.fn(() => Promise.resolve()),
    complete: vi.fn(),
    reset: vi.fn(),
    cancel: vi.fn(),
    setRoomOrigin: vi.fn(),
  },
  carousel: {
    currentScroll: { current: 0 },
    centerItem: vi.fn(() => Promise.resolve()),
  },
  carouselOptions: [] as Array<Record<string, unknown>>,
  clotheslineProps: [] as ClotheslineProps[],
  sceneryProps: [] as Array<Record<string, unknown>>,
  cardHandles: new Map<string, PublicationCardHandle>(),
  hidePopup: vi.fn(),
  unlockAchievement: vi.fn(),
  useRoomTutorial: vi.fn(),
}))

vi.mock('@/context/SceneContext', () => ({
  useScene: () => mocks.scene,
}))

vi.mock('@/context/AchievementsContext', () => ({
  useAchievements: () => ({
    hidePopup: mocks.hidePopup,
    unlockAchievement: mocks.unlockAchievement,
  }),
}))

vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => ({ locale: 'en' }),
}))

vi.mock('@/hooks/useRoomTutorial', () => ({
  useRoomTutorial: mocks.useRoomTutorial,
}))

vi.mock('@/lib/content/publications', () => ({
  getPublicationRoomItems: () => PUBLICATIONS,
}))

vi.mock('@/components/rooms/publications/usePaintMaterial', () => ({
  usePaintMaterial: () => mocks.paint,
}))

vi.mock('@/components/rooms/publications/usePublicationCarousel', () => ({
  usePublicationCarousel: (options: Record<string, unknown>) => {
    mocks.carouselOptions.push(options)
    return mocks.carousel
  },
}))

vi.mock('@/components/rooms/publications/usePublicationBrowseCamera', () => ({
  usePublicationBrowseCamera: () => undefined,
}))

vi.mock('@/components/rooms/publications/PublicationsScenery', () => ({
  PublicationsScenery: (
    props: Record<string, unknown> & { children?: React.ReactNode },
  ) => {
    mocks.sceneryProps.push(props)
    return <group name="mock-publications-scenery">{props.children}</group>
  },
}))

vi.mock('@/components/rooms/publications/PublicationClothesline', () => ({
  PublicationClothesline: forwardRef(function MockClothesline(
    props: ClotheslineProps,
    ref: Ref<PublicationClotheslineHandle>,
  ) {
    mocks.clotheslineProps.push(props)
    useImperativeHandle(ref, () => ({
      syncSlotsToScroll: () => undefined,
      getClotheslineRoot: () => null,
    }))
    useEffect(() => {
      props.publications.forEach(publication => {
        props.onCardReady(
          publication.id,
          mocks.cardHandles.get(publication.id) ?? null,
        )
      })
      return () => {
        props.publications.forEach(publication => {
          props.onCardReady(publication.id, null)
        })
      }
    }, [props.onCardReady, props.publications])
    return (
      <group name="mock-publication-clothesline">
        {props.publications.map(publication => (
          <button
            key={publication.id}
            disabled={props.isInteractionLocked}
            onClick={() => props.onSelect(publication.id)}
          >
            {publication.id}
          </button>
        ))}
      </group>
    )
  }),
}))

import { PublicationsRoom } from '@/components/rooms/publications/PublicationsRoom'

function latestClotheslineProps(): ClotheslineProps {
  return mocks.clotheslineProps.at(-1)!
}

function renderRoom(
  props: { showRoom: boolean; isExiting: boolean } = {
    showRoom: true,
    isExiting: false,
  },
) {
  return render(<PublicationsRoom {...props} />)
}

async function settleNormalReveal(
  view: ReturnType<typeof renderRoom>,
): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
  view.rerender(<PublicationsRoom showRoom isExiting={false} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.scene.isTeleporting = false
  mocks.scene.teleportPhase = null
  mocks.scene.currentRoom = null
  mocks.paint.isRevealing = false
  mocks.carouselOptions.length = 0
  mocks.clotheslineProps.length = 0
  mocks.sceneryProps.length = 0
  mocks.cardHandles.clear()
  for (const publication of PUBLICATIONS) {
    mocks.cardHandles.set(publication.id, {
      open: vi.fn(() => Promise.resolve()),
      close: vi.fn(() => Promise.resolve()),
      cancel: vi.fn(),
    })
  }
})

describe('PublicationsRoom paint reveal', () => {
  it('locks the first normal frame before starting one reveal', async () => {
    const view = renderRoom()

    expect(mocks.paint.reveal).toHaveBeenCalledOnce()
    expect(mocks.carouselOptions.at(-1)).toMatchObject({ locked: true })
    expect(latestClotheslineProps().isInteractionLocked).toBe(true)

    await settleNormalReveal(view)

    expect(mocks.paint.reveal).toHaveBeenCalledOnce()
    expect(mocks.carouselOptions.at(-1)).toMatchObject({ locked: false })
    expect(mocks.sceneryProps.at(-1)).toMatchObject({
      paint: mocks.paint.paint,
      ambienceEnabled: true,
    })
  })

  it('keeps fast-teleport paint complete after opening finishes', () => {
    mocks.scene.isTeleporting = true
    mocks.scene.teleportPhase = 'opening'

    const view = renderRoom()

    expect(mocks.paint.complete).toHaveBeenCalledOnce()
    expect(mocks.paint.reveal).not.toHaveBeenCalled()

    mocks.scene.isTeleporting = false
    mocks.scene.teleportPhase = null
    view.rerender(<PublicationsRoom showRoom isExiting={false} />)

    expect(mocks.paint.complete).toHaveBeenCalledOnce()
    expect(mocks.paint.reveal).not.toHaveBeenCalled()
    expect(mocks.carouselOptions.at(-1)).toMatchObject({ locked: false })
    expect(latestClotheslineProps().isInteractionLocked).toBe(false)
  })

  it('restarts a reveal interrupted by StrictMode effect replay', () => {
    render(
      <StrictMode>
        <PublicationsRoom showRoom isExiting={false} />
      </StrictMode>,
    )

    expect(mocks.paint.cancel).toHaveBeenCalled()
    expect(mocks.paint.reveal).toHaveBeenCalledTimes(2)
    expect(
      mocks.paint.reveal.mock.invocationCallOrder.at(-1),
    ).toBeGreaterThan(
      mocks.paint.cancel.mock.invocationCallOrder.at(-1)!,
    )
  })
})

describe('PublicationsRoom card orchestration', () => {
  it('locks carousel and selection throughout teleport', () => {
    mocks.scene.isTeleporting = true
    mocks.scene.teleportPhase = 'teleporting'
    renderRoom()

    expect(mocks.carouselOptions.at(-1)).toMatchObject({ locked: true })
    expect(latestClotheslineProps().isInteractionLocked).toBe(true)
    fireEvent.click(document.querySelectorAll('button')[1])
    expect(mocks.carousel.centerItem).not.toHaveBeenCalled()
    expect(mocks.cardHandles.get('paper-b')?.open).not.toHaveBeenCalled()
  })

  it('centers before entering the centering motion phase on first select', async () => {
    mocks.paint.isRevealing = false
    const handleA = mocks.cardHandles.get('paper-a')!
    const phasesDuringCenter: string[] = []
    vi.mocked(mocks.carousel.centerItem).mockImplementation(async () => {
      phasesDuringCenter.push(latestClotheslineProps().motion.phase)
    })
    const view = renderRoom()
    await settleNormalReveal(view)

    fireEvent.click(document.querySelector('button')!)

    await waitFor(() => expect(mocks.carousel.centerItem).toHaveBeenCalledOnce())
    expect(phasesDuringCenter).toEqual(['hanging'])
    await waitFor(() => expect(handleA.open).toHaveBeenCalledOnce())
    await waitFor(() => expect(latestClotheslineProps().motion.phase).toBe('open'))
  })

  it('waits for A to close before centering and opening B', async () => {
    mocks.paint.isRevealing = false
    const closeA = createDeferred()
    const handleA = mocks.cardHandles.get('paper-a')!
    const handleB = mocks.cardHandles.get('paper-b')!
    vi.mocked(handleA.close).mockReturnValue(closeA.promise)
    const view = renderRoom()
    await settleNormalReveal(view)

    fireEvent.click(document.querySelector('button')!)
    await waitFor(() => expect(handleA.open).toHaveBeenCalledOnce())
    await waitFor(() => expect(latestClotheslineProps().motion.phase).toBe('open'))

    fireEvent.click(document.querySelectorAll('button')[1])
    await waitFor(() => expect(handleA.close).toHaveBeenCalledOnce())
    expect(handleB.open).not.toHaveBeenCalled()
    expect(mocks.carousel.centerItem).toHaveBeenCalledTimes(1)

    await act(async () => {
      closeA.resolve()
      await closeA.promise
    })

    await waitFor(() => expect(mocks.carousel.centerItem).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(handleB.open).toHaveBeenCalledOnce())
  })
})

describe('PublicationsRoom cancellation', () => {
  it.each([
    ['exit', { isExiting: true, isTeleporting: false }],
    ['teleport', { isExiting: false, isTeleporting: true }],
  ])('cancels paint, cards, tutorial and motion on %s', async (_, next) => {
    mocks.paint.isRevealing = false
    const handleA = mocks.cardHandles.get('paper-a')!
    const view = renderRoom()
    await settleNormalReveal(view)
    fireEvent.click(document.querySelector('button')!)
    await waitFor(() => expect(handleA.open).toHaveBeenCalledOnce())
    await waitFor(() => expect(latestClotheslineProps().motion.phase).toBe('open'))

    mocks.scene.isTeleporting = next.isTeleporting
    view.rerender(
      <PublicationsRoom showRoom isExiting={next.isExiting} />,
    )

    await waitFor(() => expect(mocks.paint.cancel).toHaveBeenCalled())
    expect(handleA.cancel).toHaveBeenCalledWith(true)
    expect(mocks.hidePopup).toHaveBeenCalled()
    expect(latestClotheslineProps().motion).toMatchObject({
      phase: 'hanging',
      selectedId: null,
      pendingId: null,
    })
    expect(mocks.carouselOptions.at(-1)).toMatchObject({ locked: true })
    expect(latestClotheslineProps().isInteractionLocked).toBe(true)
  })
})
