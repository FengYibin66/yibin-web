import { forwardRef, useImperativeHandle } from 'react'
import { fireEvent, render } from '@testing-library/react'
import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getPaperSurfaceTransform,
  PublicationCard,
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
  onSelect: vi.fn(),
}

function renderCard(overrides: Partial<typeof BASE_PROPS> = {}) {
  return render(<PublicationCard {...BASE_PROPS} {...overrides} />)
}

beforeEach(() => {
  testState.material.bend = 0
  testState.material.windStrength = 0
  testState.material.uProgress = 0
  BASE_PROPS.onSelect.mockReset()
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
})

describe('PublicationCard interaction', () => {
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
  ])('ignores outer clicks while selected or locked', state => {
    const onSelect = vi.fn()
    const { container } = renderCard({ ...state, onSelect })

    fireEvent.click(container.querySelector('group')!)

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('selects an unlocked unselected card', () => {
    const onSelect = vi.fn()
    const { container } = renderCard({ onSelect })

    fireEvent.click(container.querySelector('group')!)

    expect(onSelect).toHaveBeenCalledWith(PUBLICATION.id)
  })

  it('stops paper button clicks from selecting the card', () => {
    const onSelect = vi.fn()
    const { container } = renderCard({
      isSelected: true,
      onSelect,
    })
    const meshes = container.querySelectorAll('mesh')
    const paperButtonHitArea = meshes.item(meshes.length - 1)
    const clickEvent = new MouseEvent('click', { bubbles: true })
    const stopPropagation = vi.spyOn(clickEvent, 'stopPropagation')

    fireEvent(paperButtonHitArea, clickEvent)

    expect(stopPropagation).toHaveBeenCalledOnce()
    expect(window.open).toHaveBeenCalledOnce()
    expect(onSelect).not.toHaveBeenCalled()
  })
})
