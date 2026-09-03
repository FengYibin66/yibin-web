import { createElement, type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SceneProvider, useScene } from '@/context/SceneContext'

/**
 * 房间生命周期**经由 `SceneContext` 的**行为（ADR 20260903211338 接线之后）。
 *
 * ## 与 `roomMachineFlow.test.ts` 的分工
 *
 * 那个文件测状态图本身（纯，不碰 React）。这个文件测**接线**：context 暴露的
 * 那几个动作函数是不是真的驱动了机器，以及传送/退场那些跨机器的耦合。
 *
 * 这个区分不是洁癖——PR 前的状态正是「机器测试全绿而运行时零引用」
 * （`labMachines.test.ts` 守着一份死代码）。只测机器测不出接没接上。
 *
 * ## 取代了什么
 *
 * `__tests__/roomLoadMachine.test.ts` 的 `SceneContext room loading` 一段。
 * 那个文件另一半测手写 reducer 的合法转移矩阵，已由状态图的全路径覆盖取代。
 */

function SceneWrapper({ children }: { children: ReactNode }) {
  return createElement(SceneProvider, null, children)
}

const IDLE = { phase: 'idle', roomId: null, segmentIndex: null, attempt: 0, error: null }

/** 把房间开到 entered —— 注意没有 `markRoomOpening` 了，`ready` 直接等门开完 */
function enterPublications(result: { current: ReturnType<typeof useScene> }) {
  act(() => { result.current.beginRoomLoad('publications') })
  act(() => { result.current.markRoomAligned() })
  act(() => { result.current.markRoomReady() })
  act(() => { result.current.markRoomEntered() })
  act(() => { result.current.enterRoom('publications') })
}

describe('context 动作驱动状态图', () => {
  it('走完一次进房 —— 相位序列由机器给出，不再有 opening', () => {
    const { result } = renderHook(() => useScene(), { wrapper: SceneWrapper })

    expect(result.current.roomLoadState).toEqual(IDLE)
    expect(result.current.isRoomLoading).toBe(false)

    act(() => {
      expect(result.current.beginRoomLoad('publications', 0), '第一次点门该被接受').toBe(true)
      expect(result.current.beginRoomLoad('publications', 1), '连点第二下该被拒绝').toBe(false)
    })
    expect(result.current.roomLoadState.phase).toBe('aligning')
    expect(result.current.isRoomLoading).toBe(true)

    act(() => { result.current.markRoomAligned() })
    expect(result.current.roomLoadState.phase, '对齐之后该挂载房间').toBe('mounting')
    expect(result.current.isRoomLoading).toBe(true)

    act(() => { result.current.markRoomReady() })
    expect(result.current.roomLoadState.phase).toBe('ready')
    expect(result.current.isRoomLoading, 'ready 不该再显示加载卡').toBe(false)

    act(() => { result.current.markRoomEntered() })
    expect(result.current.roomLoadState.phase).toBe('entered')

    act(() => { result.current.requestExit() })
    expect(result.current.roomLoadState.phase).toBe('exiting')
    expect(result.current.exitRequested).toBe(true)

    act(() => { result.current.resetRoomLoad() })
    expect(result.current.roomLoadState).toEqual(IDLE)
  })

  it('失败与重试经由 context —— attempt 累加、房间保留', () => {
    const { result } = renderHook(() => useScene(), { wrapper: SceneWrapper })

    act(() => { result.current.beginRoomLoad('publications') })
    act(() => { result.current.markRoomAligned() })
    act(() => { result.current.failRoomLoad('Texture preload failed') })

    expect(result.current.roomLoadState).toMatchObject({
      phase: 'failed',
      error: 'Texture preload failed',
    })
    expect(result.current.isRoomLoading).toBe(false)

    act(() => { result.current.retryRoomLoad() })
    expect(result.current.roomLoadState).toMatchObject({
      phase: 'loading',
      roomId: 'publications',
      attempt: 2,
      error: null,
    })

    act(() => { result.current.failRoomLoad('room-load-timeout') })
    act(() => { result.current.resetRoomLoad() })
    expect(result.current.roomLoadState).toEqual(IDLE)
  })

  it('进房之后的运行时错误也有出口 —— 审计 A8 的接线侧', () => {
    /*
      机器有 `entered --RUNTIME_ERROR--> failed` 这条边（`roomMachineFlow` 测了），
      但**接不上就等于没有**：旧的 `handleRoomError` 有一句
      `if (phase !== 'loading') return`，于是进房后报错被直接丢掉。

      这条断言守的正是那个 `return`：`failRoomLoad` 必须按当前相位选事件。
    */
    const { result } = renderHook(() => useScene(), { wrapper: SceneWrapper })
    enterPublications(result)
    expect(result.current.roomLoadState.phase).toBe('entered')

    act(() => { result.current.failRoomLoad('shader compile failed') })
    expect(result.current.roomLoadState).toMatchObject({
      phase: 'failed',
      error: 'shader compile failed',
    })
  })
})

describe('传送与房间相位的耦合', () => {
  it.each(['aligning', 'mounting'] as const)(
    '加载中（%s）不许传送',
    (blockedPhase) => {
      const { result } = renderHook(() => useScene(), { wrapper: SceneWrapper })
      const teleportFromIdle = result.current.teleportTo

      act(() => { result.current.beginRoomLoad('publications') })
      if (blockedPhase === 'mounting') act(() => { result.current.markRoomAligned() })

      act(() => { teleportFromIdle('projects') })

      expect(result.current.roomLoadState.phase).toBe(blockedPhase)
      expect(result.current.currentRoom).toBeNull()
      expect(result.current.teleportTarget).toBeNull()
      expect(result.current.isTeleporting).toBe(false)
      expect(result.current.teleportPhase).toBeNull()
      expect(result.current.pendingDoorClick).toBeNull()
      expect(result.current.isFastTeleport).toBe(false)
    },
  )

  it.each(['idle', 'entered'] as const)('%s 允许传送', (allowedPhase) => {
    const { result } = renderHook(() => useScene(), { wrapper: SceneWrapper })

    if (allowedPhase === 'entered') enterPublications(result)

    act(() => { result.current.teleportTo('projects') })

    expect(result.current.currentRoom).toBe(
      allowedPhase === 'entered' ? 'publications' : null,
    )
    expect(result.current.teleportTarget).toBe('projects')
    expect(result.current.isTeleporting).toBe(true)
    expect(result.current.teleportPhase).toBe('closing')
    expect(result.current.isFastTeleport).toBe(true)
  })

  it('传送开始后过期的退房回调不再生效', () => {
    /*
      `requestExit` 是在渲染时闭包捕获的。传送把房间无动画收走之后，
      上一帧捕获的那个 `requestExit` 若还能触发退场动画，就会在传送纸盖着的时候
      放一段退房飞行。
    */
    const { result } = renderHook(() => useScene(), { wrapper: SceneWrapper })
    enterPublications(result)
    const requestExitBeforeTeleport = result.current.requestExit

    act(() => { result.current.teleportTo('projects') })
    act(() => { requestExitBeforeTeleport() })

    expect(result.current.isTeleporting).toBe(true)
    expect(result.current.teleportPhase).toBe('closing')
    expect(result.current.roomLoadState.phase, '过期回调把房间推进了退场').toBe('entered')
    expect(result.current.exitRequested).toBe(false)
    expect(result.current.currentRoom).toBe('publications')

    act(() => { result.current.startTeleportTransition() })
    act(() => { result.current.resetRoomLoadForTeleport() })
    expect(result.current.roomLoadState).toEqual(IDLE)
  })
})
