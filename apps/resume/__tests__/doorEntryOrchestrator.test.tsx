import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useDoorEntryOrchestrator } from '@/components/lab/useDoorEntryOrchestrator'
import type { RoomLoadState } from '@/context/SceneContext'

/**
 * 开门动画的触发时机 —— 这个 hook 现在**只剩这一件事**（ADR 20260903211338）。
 *
 * ## 这个文件缩了多少
 *
 * 原先它测四件事：开门幂等、8 秒超时、重试后重启超时、失败→idle 的清理。
 * 后三件已经由状态图接管，测试也随之搬走：
 *
 * | 原断言 | 现在在哪 |
 * |--------|----------|
 * | 8 秒超时只对活跃者触发 | `roomMachineFlow.test.ts`（`loading` 的 `after`） |
 * | 重试后重启超时 | 同上（`failed --RETRY--> loading` 重新进入即重新计时） |
 * | 失败→idle 只清理活跃者 | `DoorSection` 的相位驱动 effect，由 E2E 覆盖 |
 *
 * 「只对活跃者触发」这类断言原本要测，是因为 15 段走廊各有一个 `DoorSection`
 * 实例、各自挂着一份 `setTimeout`——**同一个超时被 15 个组件各计一遍**，
 * 谁先响谁说话。搬到机器里之后只有一个定时器，这个问题不复存在，
 * 也就没有对应的断言可写了。
 */

const READY_STATE: RoomLoadState = {
  phase: 'ready',
  roomId: 'publications',
  segmentIndex: 0,
  attempt: 1,
  error: null,
}

interface HarnessProps {
  isEntryOwner: boolean
  state: RoomLoadState
  openDoorPanels: (fastMode: boolean, onComplete: () => void) => void
  flyIntoRoom: (fastMode: boolean) => void
}

function OrchestratorHarness(props: HarnessProps) {
  useDoorEntryOrchestrator({
    roomId: 'publications',
    roomLoadState: props.state,
    isEntryOwner: props.isEntryOwner,
    isFastTeleport: false,
    openDoorPanels: props.openDoorPanels,
    flyIntoRoom: props.flyIntoRoom,
  })
  return null
}

function createHarnessProps(isEntryOwner: boolean, state: RoomLoadState): HarnessProps {
  return {
    isEntryOwner,
    state,
    openDoorPanels: vi.fn(),
    flyIntoRoom: vi.fn(),
  }
}

describe('useDoorEntryOrchestrator', () => {
  it('只有被点的那扇门开，且重渲染不重放动画', () => {
    /*
      两件事一起测，因为它们是同一个 ref 的两面：`openedAttemptRef` 既区分
      "我是不是这次进房的门"（配合 `isEntryOwner`），又保证 `ready` 相位
      多渲染几次不会把门板动画重放一遍（重放的表现是门抖一下）。
    */
    const active = createHarnessProps(true, READY_STATE)
    const inactive = createHarnessProps(false, READY_STATE)

    const view = render(
      <>
        <OrchestratorHarness {...active} />
        <OrchestratorHarness {...inactive} />
      </>,
    )
    view.rerender(
      <>
        <OrchestratorHarness {...active} />
        <OrchestratorHarness {...inactive} />
      </>,
    )

    expect(active.openDoorPanels).toHaveBeenCalledTimes(1)
    expect(inactive.openDoorPanels, '不是这扇门却开了').not.toHaveBeenCalled()
  })

  it('重试之后重新开门 —— 幂等键是 attempt 号，不是布尔', () => {
    /*
      用布尔会让重试后的门永远开不了：第一次 `ready` 置上，重试回到 `loading`
      再到 `ready` 时它还是 true。
    */
    const props = createHarnessProps(true, READY_STATE)
    const view = render(<OrchestratorHarness {...props} />)
    expect(props.openDoorPanels).toHaveBeenCalledTimes(1)

    view.rerender(
      <OrchestratorHarness {...props} state={{ ...READY_STATE, phase: 'loading' }} />,
    )
    view.rerender(
      <OrchestratorHarness {...props} state={{ ...READY_STATE, attempt: 2 }} />,
    )

    expect(props.openDoorPanels, '重试之后门没再开').toHaveBeenCalledTimes(2)
  })

  it('回到 idle 会清掉幂等标记，下一次同 attempt 也能开门', () => {
    /*
      清理只看**当前**相位是不是 idle，不看"从哪来"。旧实现用
      `previousPhaseRef` 观察 `failed → idle` 这次转移，中间插进一次别的渲染
      就永久卡住——表现是「从加载失败退出后再也传送不了」。
    */
    const props = createHarnessProps(true, READY_STATE)
    const view = render(<OrchestratorHarness {...props} />)

    view.rerender(
      <OrchestratorHarness
        {...props}
        state={{ phase: 'idle', roomId: null, segmentIndex: null, attempt: 0, error: null }}
      />,
    )
    view.rerender(<OrchestratorHarness {...props} state={READY_STATE} />)

    expect(props.openDoorPanels).toHaveBeenCalledTimes(2)
  })

  it('门开完才飞进房 —— 回调而不是并行动画', () => {
    const props = createHarnessProps(true, READY_STATE)
    props.openDoorPanels = vi.fn((_fast, onComplete) => onComplete())

    render(<OrchestratorHarness {...props} />)

    expect(props.flyIntoRoom).toHaveBeenCalledWith(false)
  })

  it('相位没到 ready 不开门', () => {
    for (const phase of ['aligning', 'mounting', 'loading', 'failed'] as const) {
      const props = createHarnessProps(true, { ...READY_STATE, phase })
      render(<OrchestratorHarness {...props} />)
      expect(props.openDoorPanels, `${phase} 就把门开了`).not.toHaveBeenCalled()
    }
  })
})
