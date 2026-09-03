import { render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ROOM_IDS } from '@/lib/lab/domain/ids'
import { ROOMS } from '@/lib/lab/domain/rooms'
import type { RoomViewProps } from '@/lib/lab/domain/rooms/types'

interface BoundaryProps {
  attempt: number
  onLoading: () => void
  onReady: () => void
  onError: (message: string) => void
  children: ReactNode
}

const mocks = vi.hoisted(() => ({
  /** roomId → 收到的 props */
  views: new Map<string, unknown[]>(),
  boundary: vi.fn(),
  tutorial: vi.fn(),
  scenePhase: 'entered' as string,
}))

vi.mock('@/components/lab/RoomAmbience', () => ({
  RoomAmbience: () => null,
}))

vi.mock('@/context/SceneContext', () => ({
  useScene: () => ({
    roomLoadState: { attempt: 3, phase: mocks.scenePhase },
  }),
}))

vi.mock('@/hooks/useRoomTutorial', () => ({
  useRoomTutorial: (...args: unknown[]) => mocks.tutorial(...args),
}))

/*
  把注册表换成同步的替身组件。

  真的注册表是 `React.lazy`，在 jsdom 里会拖起四个房间的完整依赖树
  （three、drei、纹理）。本文件要验的是**分发与 props 契约**，不是房间内部
  ——所以替身按 roomId 记下自己收到的 props 就够了。
*/
vi.mock('@/components/rooms/registry', () => {
  const make = (roomId: string) => (props: RoomViewProps) => {
    const seen = mocks.views.get(roomId) ?? []
    seen.push(props)
    mocks.views.set(roomId, seen)
    return null
  }
  return {
    ROOM_VIEWS: {
      about: make('about'),
      projects: make('projects'),
      publications: make('publications'),
      contact: make('contact'),
      gallery: make('gallery'),
    },
  }
})

vi.mock('@/components/lab/RoomReadyBoundary', () => ({
  RoomReadyBoundary: (props: BoundaryProps) => {
    mocks.boundary(props)
    return <>{props.children}</>
  },
}))

const { RoomInterior } = await import('@/components/lab/RoomInterior')

/**
 * `RoomInterior` 的分发与 props 契约。
 *
 * ## 契约变了
 *
 * 这个文件原先断言的是「传给房间的 props **恰好**是 `{ showRoom, isExiting }`，
 * 不含 `onReady`」——那时的分发是一个硬编码 `switch (roomId)`。
 *
 * 现在按注册表分发（ADR 20260903211338），契约是 `RoomViewProps`：一个
 * `phase` 取代那两个布尔。而「不把编排回调漏给房间」这条要守的东西没变
 * ——`onReady` / `onError` 属于 `RoomReadyBoundary`，房间不该看见它们，
 * 否则房间就能自己声明"我准备好了"，加载超时的判据也就失效了。
 */
describe('RoomInterior 的分发', () => {
  beforeEach(() => {
    mocks.views.clear()
    mocks.boundary.mockReset()
    mocks.tutorial.mockReset()
    mocks.scenePhase = 'entered'
  })

  it.each(ROOM_IDS)('按 roomId 从注册表取视图：%s', async roomId => {
    render(<RoomInterior roomId={roomId} showRoom onReady={vi.fn()} isExiting={false} />)

    await waitFor(() => {
      expect(mocks.views.get(roomId), `${roomId} 的视图没被渲染`).toHaveLength(1)
    })
    // 只渲染这一个房间，不会把别的也挂上
    for (const other of ROOM_IDS) {
      if (other === roomId) continue
      expect(mocks.views.get(other) ?? [], `${roomId} 时 ${other} 也被渲染了`).toHaveLength(0)
    }
  })

  it('传给视图的只有 phase —— 编排回调不漏给房间', async () => {
    const onReady = vi.fn()
    const onError = vi.fn()
    render(
      <RoomInterior roomId="about" showRoom onReady={onReady} onError={onError} isExiting={false} />,
    )

    await waitFor(() => expect(mocks.views.get('about')).toHaveLength(1))
    const props = mocks.views.get('about')![0] as Record<string, unknown>

    expect(Object.keys(props), 'props 不止 phase 一个').toEqual(['phase'])
    expect(props).not.toHaveProperty('onReady')
    expect(props).not.toHaveProperty('onError')
    /*
      回调归边界。房间若能拿到 `onReady`，它就能自己声明"我准备好了"，
      而那正是加载超时判据的来源——超时会变成一个房间可以绕过的东西。
    */
    expect(mocks.boundary.mock.calls[0]![0]).toMatchObject({ onReady, onError })
  })

  const PHASES: readonly [scene: string, showRoom: boolean, isExiting: boolean, expected: string][] = [
    ['entered', true, false, 'entered'],
    ['opening', true, false, 'ready'],
    ['loading', false, false, 'mounting'],
    ['entered', true, true, 'exiting'],
    ['exiting', true, false, 'exiting'],
  ]

  it.each(PHASES)(
    'scenePhase=%s showRoom=%s isExiting=%s → phase=%s',
    async (scenePhase, showRoom, isExiting, expected) => {
      mocks.scenePhase = scenePhase
      render(
        <RoomInterior roomId="contact" showRoom={showRoom} onReady={vi.fn()} isExiting={isExiting} />,
      )
      await waitFor(() => expect(mocks.views.get('contact')).toHaveLength(1))
      expect((mocks.views.get('contact')![0] as RoomViewProps).phase).toBe(expected)
    },
  )

  it('教程从注册表读，作用域按 roomId 派生', async () => {
    render(<RoomInterior roomId="projects" showRoom onReady={vi.fn()} isExiting={false} />)

    /*
      教程原先由四个房间各自硬编码（`useRoomTutorial('projects_inspect', 'projects')`），
      而 `RoomDefinition.tutorial` 零消费者——写错成别的房间的 id 不会有任何症状。
      收到这里之后只有注册表一处声明，作用域也不可能与 roomId 不一致。
    */
    expect(mocks.tutorial).toHaveBeenCalledWith(ROOMS.projects.tutorial, 'projects')
  })

  it('gallery 没有教程 —— 传 null 而不是特例分支', async () => {
    render(<RoomInterior roomId="gallery" showRoom onReady={vi.fn()} isExiting={false} />)
    expect(ROOMS.gallery.tutorial).toBeNull()
    expect(mocks.tutorial).toHaveBeenCalledWith(null, 'gallery')
  })

  it('每个房间都有注册表条目 —— 少一个的表现是那扇门后面空白', () => {
    for (const roomId of ROOM_IDS) {
      expect(ROOMS[roomId], `${roomId} 不在 ROOMS 里`).toBeDefined()
    }
  })
})
