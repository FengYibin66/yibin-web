import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

interface RoomProps {
  showRoom: boolean
  isExiting: boolean
}

interface BoundaryProps {
  attempt: number
  onLoading: () => void
  onReady: () => void
  onError: (message: string) => void
  children: ReactNode
}

const roomMocks = vi.hoisted(() => ({
  about: vi.fn(),
  projects: vi.fn(),
  publications: vi.fn(),
  contact: vi.fn(),
}))
const boundaryMock = vi.hoisted(() => vi.fn())

vi.mock('@/context/SceneContext', () => ({
  useScene: () => ({
    roomLoadState: { attempt: 3 },
  }),
}))

vi.mock('@/components/rooms/AboutRoom', () => ({
  AboutRoom: (props: RoomProps) => {
    roomMocks.about(props)
    return null
  },
}))
vi.mock('@/components/rooms/ProjectsRoom', () => ({
  ProjectsRoom: (props: RoomProps) => {
    roomMocks.projects(props)
    return null
  },
}))
vi.mock('@/components/rooms/PublicationsRoom', () => ({
  PublicationsRoom: (props: RoomProps) => {
    roomMocks.publications(props)
    return null
  },
}))
vi.mock('@/components/rooms/ContactRoom', () => ({
  ContactRoom: (props: RoomProps) => {
    roomMocks.contact(props)
    return null
  },
}))

vi.mock('@/components/lab/RoomReadyBoundary', () => ({
  RoomReadyBoundary: (props: BoundaryProps) => {
    const { children, ...boundaryProps } = props
    boundaryMock(boundaryProps)
    return children
  },
}))

import { RoomInterior } from '@/components/lab/RoomInterior'

describe('RoomInterior room props contract', () => {
  beforeEach(() => {
    Object.values(roomMocks).forEach((roomMock) => roomMock.mockReset())
    boundaryMock.mockReset()
  })

  it.each([
    ['about', roomMocks.about],
    ['projects', roomMocks.projects],
    ['publications', roomMocks.publications],
    ['contact', roomMocks.contact],
  ] as const)('passes only room state props to %s', (roomId, roomMock) => {
    const onReady = vi.fn()

    render(
      <RoomInterior
        roomId={roomId}
        showRoom
        onReady={onReady}
        isExiting={false}
      />,
    )

    expect(roomMock).toHaveBeenCalledTimes(1)
    expect(roomMock.mock.calls[0][0]).toEqual({
      showRoom: true,
      isExiting: false,
    })
    expect(roomMock.mock.calls[0][0]).not.toHaveProperty('onReady')
    expect(boundaryMock.mock.calls[0][0]).toMatchObject({ onReady })
  })
})
