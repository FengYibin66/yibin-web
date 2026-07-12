import {
  createRef,
  forwardRef,
  useImperativeHandle,
  type MutableRefObject,
} from 'react'
import { fireEvent, render } from '@testing-library/react'
import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  bindFaceToPaperSurface,
  getPaperSurfaceTransform,
  PublicationCard,
} from '@/components/rooms/publications/PublicationCard'
import type {
  PublicationCardHandle,
} from '@/components/rooms/publications/PublicationCard'
import type { PaperMaterialHandle } from '@/components/rooms/gallery/PaperMaterial'
import type { PublicationRoomItem } from '@/components/rooms/publications/publicationTypes'

const testState = vi.hoisted(() => ({
  frameCallback: undefined as
    | ((state: { clock: { getElapsedTime: () => number } }) => void)
    | undefined,
  material: {
    bend: 0,
    windStrength: 0,
    uProgress: 0,
    material: null,
  } as PaperMaterialHandle,
  motion: {
    paperRef: { current: null },
    materialRef: { current: null },
    open: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
    cancel: vi.fn(),
  },
}))

vi.mock('@react-three/fiber', () => ({
  useFrame: (
    callback: (state: { clock: { getElapsedTime: () => number } }) => void,
  ) => {
    testState.frameCallback = callback
  },
}))

vi.mock('@react-three/drei', () => ({
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useTexture: () => new THREE.Texture(),
}))

vi.mock('@/components/rooms/gallery/PaperMaterial', () => ({
  default: forwardRef<PaperMaterialHandle>(function MockPaperMaterial(_, ref) {
    useImperativeHandle(ref, () => testState.material)
    return <meshBasicMaterial />
  }),
}))

vi.mock('@/components/rooms/publications/usePublicationCardMotion', () => ({
  usePublicationCardMotion: () => testState.motion,
}))

const PUBLICATION: PublicationRoomItem = {
  id: 'paper-2026',
  title: 'Designing Tangible Research Rooms',
  venue: 'CHI',
  year: 2026,
  authors: 'Yibin Feng, Ada Lovelace',
  abstract: 'A study of tangible interfaces for research communication.',
  doi: 'https://doi.org/10.1145/example',
  keywords: ['tangible interaction', 'research communication'],
  featured: true,
}

const BASE_PROPS = {
  publication: PUBLICATION,
  index: 0,
  displayPosition: new THREE.Vector3(1, 2, 3),
  isSelected: false,
  isLocked: false,
  canHover: true,
  didDragRef: { current: false } as MutableRefObject<boolean>,
  onSelect: vi.fn(),
}

function renderCard(overrides: Partial<typeof BASE_PROPS> = {}) {
  return render(<PublicationCard {...BASE_PROPS} {...overrides} />)
}

beforeEach(() => {
  vi.restoreAllMocks()
  testState.material.bend = 0
  testState.material.windStrength = 0
  testState.material.uProgress = 0
  testState.motion.open.mockClear()
  testState.motion.close.mockClear()
  testState.motion.cancel.mockClear()
  BASE_PROPS.onSelect.mockReset()
  BASE_PROPS.didDragRef.current = false
  document.body.style.cursor = 'auto'
  vi.spyOn(window, 'open').mockImplementation(() => null)
})

describe('getPaperSurfaceTransform', () => {
  it('matches the paper shader bend and wind displacement', () => {
    const transform = getPaperSurfaceTransform(0.5, 0.4, 0.08, 1.25)
    const flutterStrength = (0.02 + 0.08) * (1 + Math.abs(0.4 * 3))
    const phase = 1.25 * 2 + 0.5 * 2

    expect(transform.z).toBeCloseTo(
      0.5 ** 2 * 0.4 + Math.sin(phase) * flutterStrength,
    )
    expect(transform.rotationX).toBeCloseTo(
      Math.atan(2 * 0.5 * 0.4 + Math.cos(phase) * 2 * flutterStrength),
    )
  })

  it('binds front and back anchors in their correct local coordinates', () => {
    const frontFace = new THREE.Group()
    const frontContent = new THREE.Group()
    const frontAnchor = new THREE.Group()
    frontAnchor.position.set(0, 0.5, 0.01)
    frontFace.add(frontContent)
    frontContent.add(frontAnchor)

    const backFace = new THREE.Group()
    const backContent = new THREE.Group()
    const backAnchor = new THREE.Group()
    backContent.rotation.x = Math.PI
    backAnchor.position.set(0, 0.5, 0.01)
    backFace.add(backContent)
    backContent.add(backAnchor)

    bindFaceToPaperSurface(frontFace, 'front', 0.4, 0.08, 1.25)
    bindFaceToPaperSurface(backFace, 'back', 0.4, 0.08, 1.25)

    const frontTransform = getPaperSurfaceTransform(0.5, 0.4, 0.08, 1.25)
    const backTransform = getPaperSurfaceTransform(-0.5, 0.4, 0.08, 1.25)
    expect(frontAnchor.position.z).toBeCloseTo(0.01 + frontTransform.z)
    expect(frontAnchor.rotation.x).toBeCloseTo(frontTransform.rotationX)
    expect(backAnchor.position.z).toBeCloseTo(0.01 - backTransform.z)
    expect(backAnchor.rotation.x).toBeCloseTo(backTransform.rotationX)
  })
})

describe('PublicationCard interaction', () => {
  it('exposes the motion API through its imperative handle', () => {
    const ref = createRef<PublicationCardHandle>()
    render(<PublicationCard ref={ref} {...BASE_PROPS} />)
    const target = new THREE.Vector3(0, 1, 2)

    ref.current?.open(target)
    ref.current?.close()
    ref.current?.cancel()

    expect(testState.motion.open).toHaveBeenCalledWith(target)
    expect(testState.motion.close).toHaveBeenCalledOnce()
    expect(testState.motion.cancel).toHaveBeenCalledOnce()
  })

  it('reveals paint on desktop hover and restores it on leave', () => {
    const { container } = renderCard()
    const card = container.querySelector('group')

    fireEvent.pointerOver(card!, { pointerType: 'mouse' })
    expect(testState.material.uProgress).toBe(1)

    fireEvent.pointerOut(card!, { pointerType: 'mouse' })
    expect(testState.material.uProgress).toBe(0)
  })

  it('does not reveal paint for touch pointers', () => {
    const { container } = renderCard()
    const card = container.querySelector('group')

    fireEvent.pointerOver(card!, { pointerType: 'touch' })

    expect(testState.material.uProgress).toBe(0)
  })

  it.each([
    { isSelected: true, isLocked: false },
    { isSelected: false, isLocked: true },
  ])('does not change reveal while selected or locked', state => {
    testState.material.uProgress = 0.65
    const { container } = renderCard(state)
    const card = container.querySelector('group')
    document.body.style.cursor = 'pointer'

    fireEvent.pointerOver(card!, { pointerType: 'mouse' })
    fireEvent.pointerOut(card!, { pointerType: 'mouse' })

    expect(testState.material.uProgress).toBe(0.65)
    expect(document.body.style.cursor).toBe('auto')
  })

  it('clears stale hover progress after leaving during a locked transition', () => {
    const { container, rerender } = renderCard()
    const card = container.querySelector('group')
    fireEvent.pointerOver(card!, { pointerType: 'mouse' })
    expect(testState.material.uProgress).toBe(1)

    rerender(
      <PublicationCard
        {...BASE_PROPS}
        isSelected
        isLocked
      />,
    )
    expect(document.body.style.cursor).toBe('auto')
    fireEvent.pointerOut(card!, { pointerType: 'mouse' })
    expect(testState.material.uProgress).toBe(1)

    rerender(<PublicationCard {...BASE_PROPS} />)

    expect(testState.material.uProgress).toBe(0)
  })

  it('restores hover reveal after unlocking while still hovered', () => {
    const { container, rerender } = renderCard()
    const card = container.querySelector('group')
    fireEvent.pointerOver(card!, { pointerType: 'mouse' })

    rerender(
      <PublicationCard
        {...BASE_PROPS}
        isSelected
        isLocked
      />,
    )
    testState.material.uProgress = 0.4
    rerender(<PublicationCard {...BASE_PROPS} />)

    expect(testState.material.uProgress).toBe(1)
    expect(document.body.style.cursor).toBe('pointer')
  })

  it('clears the cursor when unmounted while hovered', () => {
    const { container, unmount } = renderCard()
    fireEvent.pointerOver(container.querySelector('group')!, {
      pointerType: 'mouse',
    })

    unmount()

    expect(document.body.style.cursor).toBe('auto')
  })

  it('keeps the cursor while another card still owns hover', () => {
    const renderCards = (showSecond: boolean, secondLocked = false) => (
      <>
        <PublicationCard key="first" {...BASE_PROPS} index={0} />
        {showSecond && (
          <PublicationCard
            key="second"
            {...BASE_PROPS}
            index={1}
            isLocked={secondLocked}
          />
        )}
      </>
    )
    const { container, rerender } = render(renderCards(true))
    const firstCard = container.querySelector(
      '[name="publication-card-0"]',
    )
    fireEvent.pointerOver(firstCard!, { pointerType: 'mouse' })

    rerender(renderCards(true, true))
    expect(document.body.style.cursor).toBe('pointer')

    rerender(renderCards(false))
    expect(document.body.style.cursor).toBe('pointer')

    fireEvent.pointerOut(firstCard!, { pointerType: 'mouse' })
    expect(document.body.style.cursor).toBe('auto')
  })

  it('lets an unlocked selected card close itself', () => {
    const onSelect = vi.fn()
    const { container } = renderCard({ isSelected: true, onSelect })

    fireEvent.click(container.querySelector('group')!)

    expect(onSelect).toHaveBeenCalledWith(PUBLICATION.id)
  })

  it('ignores outer clicks while locked', () => {
    const onSelect = vi.fn()
    const { container } = renderCard({ isLocked: true, onSelect })

    fireEvent.click(container.querySelector('group')!)

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('selects an unlocked unselected card', () => {
    const onSelect = vi.fn()
    const { container } = renderCard({ onSelect })

    fireEvent.click(container.querySelector('group')!)

    expect(onSelect).toHaveBeenCalledWith(PUBLICATION.id)
  })

  it('ignores selection immediately after a carousel drag', () => {
    const onSelect = vi.fn()
    const didDragRef: MutableRefObject<boolean> = { current: true }
    const { container } = renderCard({ didDragRef, onSelect })

    fireEvent.click(container.querySelector('group')!)

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('stops paper button clicks from selecting the card', () => {
    const onSelect = vi.fn()
    const { container } = renderCard({
      isSelected: true,
      onSelect,
    })
    const paperButtonHitArea = container.querySelector(
      '[name="publication-paper-hit-area"]',
    )
    const clickEvent = new MouseEvent('click', { bubbles: true })
    const stopPropagation = vi.spyOn(clickEvent, 'stopPropagation')

    fireEvent(paperButtonHitArea!, clickEvent)

    expect(stopPropagation).toHaveBeenCalledOnce()
    expect(window.open).toHaveBeenCalledOnce()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('disables the paper button while the selected card is locked', () => {
    const { container } = renderCard({
      isSelected: true,
      isLocked: true,
    })
    const paperButtonHitArea = container.querySelector(
      '[name="publication-paper-hit-area"]',
    )

    fireEvent.click(paperButtonHitArea!)

    expect(window.open).not.toHaveBeenCalled()
  })
})
