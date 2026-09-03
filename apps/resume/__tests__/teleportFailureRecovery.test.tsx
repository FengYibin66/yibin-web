import { act, render } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it } from 'vitest'

import { ROOM_LOAD_TIMEOUT_CODE } from '@/components/lab/useDoorEntryOrchestrator'
import { SceneProvider, useScene, type SceneState } from '@/context/SceneContext'

/**
 * 传送失败后必须能回到走廊（审计 B1）。
 *
 * 复现过的故障：用地图传送到某房间，若该房间加载超时/失败——
 *
 * - 合上的纸（`PaperTransition`，z-index 9998）**永久遮住屏幕**
 * - 错误卡（`RoomLoadingIndicator.overlay`，z-index 30）在纸**下面**看不见
 * - `NavigationUI` 的地图与返回按钮因 `isTeleporting` 为 true 全部禁用
 * - 结果：用户只能刷新页面
 *
 * 根因是 `cancelTeleport` **零调用方**——失败路径上没有任何地方重置
 * `isTeleporting` / `teleportPhase`。这台状态机只写了成功路径。
 *
 * 房间侧已经接上状态图（ADR 20260903211338），`failed --RESET--> idle` 是显式边；
 * 而**取消传送仍在 React 里**——`resetRoomLoad` 顺手调 `cancelTeleport`。
 * 走廊那台 `corridorMachine` 的 `teleporting.aborted` 出口还没接线，
 * 所以这几条断言仍是"当下的行为契约"而非"机器保证的性质"。
 */

function harness() {
  const scene = { current: null as SceneState | null }
  function Probe() {
    const value = useScene()
    const ref = useRef(scene)
    ref.current.current = value
    return null
  }
  render(<SceneProvider><Probe /></SceneProvider>)
  return scene as { current: SceneState }
}

/** 把状态机推到「传送中 + 房间加载失败」——B1 的现场 */
function driveToFailedTeleport(scene: { current: SceneState }) {
  act(() => { scene.current.teleportTo('projects') })
  act(() => { scene.current.startTeleportTransition() })
  act(() => { scene.current.completeTeleport() })
  // 门被 pendingDoorClick 自动点击后走的正常流程
  act(() => { scene.current.beginRoomLoad('projects', 0) })
  act(() => { scene.current.markRoomAligned() })
  // 超时本身现在是 `loading` 状态的 `after`；这里直接送等价的失败事件，
  // 免得为了等 8 秒去动假定时器（超时那条边在 roomMachineFlow 里测）
  act(() => { scene.current.failRoomLoad(ROOM_LOAD_TIMEOUT_CODE) })
}

describe('传送中房间加载失败', () => {
  it('前置：能推到 failed 且此时仍处于传送中 —— 否则本测试测的不是 B1 的现场', () => {
    const scene = harness()
    driveToFailedTeleport(scene)

    expect(scene.current.roomLoadState.phase).toBe('failed')
    expect(scene.current.isTeleporting).toBe(true)
  })

  it('resetRoomLoad 同时取消传送 —— 纸打开、导航恢复', () => {
    const scene = harness()
    driveToFailedTeleport(scene)

    act(() => { scene.current.resetRoomLoad() })

    expect(scene.current.roomLoadState.phase).toBe('idle')
    expect(scene.current.isTeleporting, '仍为 true → 地图与返回按钮继续禁用').toBe(false)
    expect(scene.current.teleportPhase, '非 null → 纸永久遮住屏幕').toBeNull()
    expect(scene.current.teleportTarget).toBeNull()
    expect(scene.current.pendingDoorClick, '残留 → 回到走廊后会自动再点一次门').toBeNull()
  })

  it('非传送场景下 resetRoomLoad 不误伤 —— 普通点门失败照常回走廊', () => {
    const scene = harness()
    act(() => { scene.current.beginRoomLoad('about', 0) })
    act(() => { scene.current.markRoomAligned() })
    act(() => { scene.current.failRoomLoad('boom') })
    expect(scene.current.roomLoadState.phase).toBe('failed')
    expect(scene.current.isTeleporting).toBe(false)

    act(() => { scene.current.resetRoomLoad() })
    expect(scene.current.roomLoadState.phase).toBe('idle')
    expect(scene.current.isTeleporting).toBe(false)
  })

  it('取消后可以再次传送 —— 状态没被卡住', () => {
    const scene = harness()
    driveToFailedTeleport(scene)
    act(() => { scene.current.resetRoomLoad() })

    act(() => { scene.current.teleportTo('contact') })
    expect(scene.current.isTeleporting).toBe(true)
    expect(scene.current.teleportTarget).toBe('contact')
  })
})
