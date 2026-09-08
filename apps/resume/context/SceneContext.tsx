'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { useMachine } from '@xstate/react'

import { onLabLoaded } from '@/lib/lab/app/labLoaded'
import { useCorridorStore } from '@/lib/lab/app/stores/corridorStore'
import {
  corridorMachine,
  corridorModeOf,
  teleportSubstate,
  type CorridorEvent,
  type CorridorMode,
} from '@/lib/lab/domain/machines/corridor.machine'
import {
  roomMachine,
  type RoomEvent,
} from '@/lib/lab/domain/machines/room.machine'

export type RoomId = 'about' | 'projects' | 'publications' | 'gallery' | 'contact'
export type TeleportPhase = 'closing' | 'teleporting' | 'opening' | null

/**
 * 房间生命周期的相位，对外的形状。
 *
 * 与状态机的状态名一一对应，只是把它摊平成一个字符串——大量消费方
 * （`DoorSection` / `LabTutorial` / `NavigationUI` / `RoomInterior` / …）
 * 读的是 `roomLoadState.phase`，保持这个形状让接线不必同时改二十几处比较。
 *
 * 与旧 reducer 的两处差异：
 *
 * - 多了 `mounting`（房间子树已挂载、纹理还没开始加载）。旧实现把它和 `loading`
 *   混在一起，于是"房间挂了没有"这件事只能靠 `showRoom` 那个组件局部 state 判断
 * - 少了 `opening`（门板正在开）。机器用 `ready` 表达"纹理就位、等门开完"
 *   ——**没有任何消费方区分过 `opening` 与 `ready`**（组件里那几处 `'opening'`
 *   是传送纸动画的另一台机器），所以合并它不影响任何行为
 */
export type RoomLoadPhase =
  | 'idle'
  | 'aligning'
  | 'mounting'
  | 'loading'
  | 'ready'
  | 'entered'
  | 'failed'
  | 'exiting'

export interface RoomLoadState {
  phase: RoomLoadPhase
  roomId: RoomId | null
  segmentIndex: number | null
  attempt: number
  error: string | null
}

export interface SceneState {
  currentRoom: RoomId | null
  hasEntered: boolean
  exitRequested: boolean
  isInRoom: boolean

  teleportTarget: RoomId | null
  isTeleporting: boolean
  teleportPhase: TeleportPhase
  pendingDoorClick: RoomId | null
  isFastTeleport: boolean
  /** 走廊模式，由 corridor.machine 快照派生（ADR 20260908204302） */
  mode: CorridorMode
  /** 资源加载完成（LabLoader 的稳定完成）：走廊状态机 loading → corridor */
  markLoaded: () => void
  /** 招聘官路线：开始（在传送 / 房间里会被状态机拒绝，返回 false） */
  startTour: () => boolean
  /** 结束路线：走完 = TOUR_END；用户输入 / ESC / 点门 = INPUT */
  endTour: (reason: 'done' | 'input') => void

  roomLoadState: RoomLoadState
  isRoomLoading: boolean
  /**
   * 给房间状态图发一个事件，返回**它有没有造成转移**。
   *
   * 取代旧的 `dispatchDoorEntry(signal)?.commands.includes('X')`：那套用
   * 「命令清单」间接表达"这次信号合法吗"，而调用方真正要问的就是这一句。
   */
  tryRoom: (event: RoomEvent) => boolean
  beginRoomLoad: (roomId: RoomId, segmentIndex?: number) => boolean
  markRoomAligned: () => void
  markRoomReady: () => void
  markRoomEntered: () => void
  failRoomLoad: (message: string) => void
  retryRoomLoad: () => void
  resetRoomLoad: () => void
  finishRoomExit: () => void
  resetRoomLoadForTeleport: () => void

  enterRoom: (roomId: RoomId) => void
  exitRoom: () => void
  requestExit: () => void
  clearExitRequest: () => void
  markEntered: () => void

  teleportTo: (roomId: RoomId) => void
  startTeleportTransition: () => void
  openTeleportTransition: () => void
  completeTeleport: () => void
  signalRoomReady: () => void
  finishPaperOpen: () => void
  cancelTeleport: () => void
}

const SceneContext = createContext<SceneState | null>(null)

export function useScene(): SceneState {
  const context = useContext(SceneContext)
  if (!context) {
    throw new Error('useScene must be used within a SceneProvider')
  }
  return context
}

export function SceneProvider({ children }: { children: React.ReactNode }) {
  const [currentRoom, setCurrentRoom] = useState<RoomId | null>(null)
  const [hasEntered, setHasEntered] = useState(false)
  const [exitRequested, setExitRequested] = useState(false)

  /*
    走廊模式与传送相位由 `corridor.machine` **派生**（ADR 20260908204302）。

    这里原先是五个布尔（teleportTarget / isTeleporting / teleportPhase /
    pendingDoorClick / isFastTeleport）加一个 useRef 镜像，互斥靠每个写入点手工
    判断。ADR 20260903140616 说要把它们迁到状态机而一直没做（20260903211338 登记为
    债务）；招聘官路线是第四种模式，互斥关系正是状态机的活——这次一起接。

    对外的字段与动作名**一个不变**：消费方（DoorSection / TeleportRoom /
    PaperTransition / NavigationUI）和既有测试都不用改；变的只是这些值从哪来。
  */
  const [corridorSnapshot, sendCorridor, corridorActor] = useMachine(corridorMachine)
  const tryCorridor = useCallback((event: CorridorEvent): boolean => {
    if (!corridorActor.getSnapshot().can(event)) return false
    sendCorridor(event)
    return true
  }, [corridorActor, sendCorridor])

  const corridorValue = corridorSnapshot.value
  const teleportSub = teleportSubstate(corridorValue)
  /* `aborted` 不算传送中：纸在打开，玩家已经在走廊里，导航该恢复（审计 B1） */
  const isTeleporting = teleportSub !== null && teleportSub !== 'aborted'
  const teleportPhase: TeleportPhase =
    teleportSub === 'paperClosing' ? 'closing'
    : teleportSub === 'relocating' || teleportSub === 'enteringFast' ? 'teleporting'
    : teleportSub === 'paperOpening' ? 'opening'
    : null
  /* 相机放好（CAMERA_PLACED）之前是"目标"，之后变成"待自动点击的门" */
  const teleportTarget =
    teleportSub === 'paperClosing' || teleportSub === 'relocating'
      ? corridorSnapshot.context.teleportTarget
      : null
  const pendingDoorClick = teleportSub === 'enteringFast' ? corridorSnapshot.context.teleportTarget : null
  const isFastTeleport = isTeleporting && corridorSnapshot.context.fastTeleport && teleportSub !== 'paperOpening'
  const mode = corridorModeOf(corridorValue)

  /* 世界状态的 `mode` 与状态机同源（ADR 20260908172231：同一个量只有一个来源） */
  useEffect(() => {
    useCorridorStore.getState().setMode(mode)
    document.documentElement.dataset.labMode = mode
  }, [mode])
  /*
    房间生命周期由**状态图**驱动（ADR 20260903140616 / 20260903211338）。

    取代的是 `roomLoadMachine.ts` + `doorEntryFlow.ts` +
    `useDoorEntryOrchestrator` 三件套。那套实现本身写得不差，缺的是：

    - 8 秒加载超时是手写 `setTimeout` 加三个互相看护的 ref
      （`loadTimeoutRef` / `openingAttemptRef` / `ownedEntryRef`），
      `useDoorEntryOrchestrator` 有 5 个 effect 专门维护它们的一致性。
      机器里那是 `loading` 状态的一行 `after`
    - `entered` 之后的运行时错误**没有出口**（审计 A8）：`handleRoomError` 只在
      loading 阶段派发，于是房间静默消失而相位仍是 `entered`
    - 「从失败退出后再也传送不了」——`ownedEntryRef` 靠观察 `failed → idle` 这次
      转移来复位，中间插进一次别的渲染就永久卡住。所有权改为从机器 context
      派生之后这个失效模式不存在了（E2E `test.fail` 抓的就是这条）
  */
  const [roomSnapshot, sendRoom, roomActor] = useMachine(roomMachine)

  const roomLoadState = useMemo<RoomLoadState>(() => ({
    phase: roomSnapshot.value as RoomLoadPhase,
    roomId: roomSnapshot.context.roomId,
    segmentIndex: roomSnapshot.context.segmentIndex,
    attempt: roomSnapshot.context.attempt,
    error: roomSnapshot.context.error,
  }), [roomSnapshot])

  const roomLoadStateRef = useRef(roomLoadState)
  const isTeleportingRef = useRef(isTeleporting)
  roomLoadStateRef.current = roomLoadState
  isTeleportingRef.current = isTeleporting

  const isRoomLoading =
    roomLoadState.phase === 'aligning'
    || roomLoadState.phase === 'mounting'
    || roomLoadState.phase === 'loading'

  /**
   * 发一个事件，返回**它有没有造成转移**。
   *
   * 取代旧的 `dispatchDoorEntry(signal)?.commands.includes('X')` 惯用法：
   * 那套用「命令清单」间接表达"这次信号合法吗"，而调用方真正要问的就是这一句。
   * `can()` 是 XState 直接提供的答案，也不会像旧实现那样把「非法转移」与
   * 「守卫拒绝」混成同一个 `null`。
   *
   * **问 actor 而不是问渲染快照。** `useMachine` 返回的 `roomSnapshot` 是渲染
   * 时刻的值，同一个 tick 里连发两个事件时第二次读到的还是旧的——连点两下门
   * 会两次都被判为合法（第一版就漏在这，`sceneRoomLoading.test.ts` 的
   * 「连点第二下该被拒绝」抓到）。`roomActor.getSnapshot()` 永远是当下的状态，
   * 与 React 的渲染时机无关。
   */
  const tryRoom = useCallback((event: RoomEvent): boolean => {
    if (!roomActor.getSnapshot().can(event)) return false
    sendRoom(event)
    return true
  }, [roomActor, sendRoom])

  const beginRoomLoad = useCallback((roomId: RoomId, segmentIndex = 0): boolean => {
    const began = tryRoom({ type: 'BEGIN', roomId, segmentIndex })
    // 走廊机：corridor / touring → entering；传送中的自动点门不在这两态，被 can 拒绝即可
    if (began) tryCorridor({ type: 'DOOR_CLICK', roomId, segmentIndex })
    return began
  }, [tryRoom, tryCorridor])

  const markRoomAligned = useCallback(() => {
    tryRoom({ type: 'CAMERA_ALIGNED' })
  }, [tryRoom])

  const markRoomReady = useCallback(() => {
    tryRoom({ type: 'READY' })
  }, [tryRoom])

  /*
    `markRoomOpening` 没有了。

    旧 reducer 有一个 `opening` 状态（门板正在开），而机器用 `ready` 表达
    「纹理就位、等门开完」——**没有任何消费方区分过这两个**（组件里那几处
    `'opening'` 是传送纸动画的另一台机器）。少一个只在两个 effect 之间传递的
    中间状态，就少一处可以不一致的地方。
  */

  const markRoomEntered = useCallback(() => {
    tryRoom({ type: 'DOOR_OPENED' })
  }, [tryRoom])

  /*
    `timeoutRoomLoad` 没有了：8 秒超时是 `loading` 状态的 `after`，机器自己管。

    旧实现是 `useDoorEntryOrchestrator` 里的一个 `setTimeout` 加
    `loadTimeoutRef`，还要另外两个 ref 看着它别在错误的时刻触发。
  */

  /**
   * 房间报错。
   *
   * **按当前相位选事件**，这是审计 A8 的修法：`entered` 之后的运行时错误原先
   * 没有任何出口（`handleRoomError` 只在 loading 阶段派发），于是
   * `RoomErrorBoundary` 渲染 null、房间消失，而相位仍是 `entered`——没有提示、
   * 没有重试、只能刷新。
   */
  const failRoomLoad = useCallback((message: string) => {
    const phase = roomLoadStateRef.current.phase
    tryRoom(
      phase === 'entered'
        ? { type: 'RUNTIME_ERROR', message }
        : { type: 'LOAD_ERROR', message },
    )
  }, [tryRoom])

  const retryRoomLoad = useCallback(() => {
    tryRoom({ type: 'RETRY' })
  }, [tryRoom])

  /**
   * 把传送状态全部清零。
   *
   * 定义位置刻意在 `resetRoomLoad` 之前——后者要调用它。原先它定义在文件末尾
   * 且**零调用方**，这正是审计 B1 的根因：传送中房间加载失败时没有任何地方
   * 重置 `isTeleporting` / `teleportPhase`。
   */
  /*
    取消传送 = 把走廊机送到 `aborted`（纸在 `teleportPhase === null` 分支里打开，
    PAPER_OPENED 后回 corridor）。哪条边取决于卡在哪一步：门已自动点击（enteringFast）
    是 ROOM_FAILED，纸还没合上 / 相机还没放好是 TELEPORT_ABORT。
  */
  const cancelTeleport = useCallback(() => {
    if (!tryCorridor({ type: 'ROOM_FAILED' })) tryCorridor({ type: 'TELEPORT_ABORT' })
    isTeleportingRef.current = false
  }, [tryCorridor])

  const resetRoomLoad = useCallback(() => {
    tryRoom({ type: 'RESET' })
    // 传送中失败时必须一起取消传送（审计 B1）：否则合上的纸（z-index 9998）
    // 永久遮住屏幕、错误卡在纸下面看不见、导航全禁用，用户只能刷新。
    if (isTeleportingRef.current) cancelTeleport()
    // 普通点门失败 / 进房后运行时错误：走廊机 entering / inRoom → corridor
    else tryCorridor({ type: 'ROOM_FAILED' })
  }, [tryRoom, cancelTeleport, tryCorridor])

  /**
   * 退房动画播完了。
   *
   * 与 `resetRoomLoad` 分开，是因为这两件事在机器里本来就是两条边：
   * `exiting --EXIT_DONE--> idle`（退场收尾）与 `* --RESET--> idle`（放弃）。
   * 旧 reducer 只有后者，于是"退完了"和"算了不进了"共用一个动作——
   * 状态图里那条 `EXIT_DONE` 边**没有任何发送方**，是图上有边、运行时不可达
   * （`__tests__/machineEventWiring.test.ts` 那条门禁抓到的）。
   *
   * `EXIT_DONE` 在非 `exiting` 相位会被 `tryRoom` 拒绝——那时退回 `RESET`，
   * 因为调用点真正要的是"把房间状态收干净"，而它可能从 `entered`（退场被打断）
   * 之类的相位进来。
   */
  const finishRoomExit = useCallback(() => {
    if (!tryRoom({ type: 'EXIT_DONE' })) tryRoom({ type: 'RESET' })
    if (isTeleportingRef.current) cancelTeleport()
    tryCorridor({ type: 'ROOM_EXITED' })
  }, [tryRoom, cancelTeleport, tryCorridor])

  const resetRoomLoadForTeleport = useCallback(() => {
    if (roomLoadStateRef.current.phase !== 'entered' || !isTeleportingRef.current) return
    tryRoom({ type: 'TELEPORT_RESET' })
  }, [tryRoom])

  const enterRoom = useCallback((roomId: RoomId) => {
    setCurrentRoom(roomId)
    setExitRequested(false)
    // 普通点门：entering → inRoom；传送：enteringFast → paperOpening（等纸开完 commit）
    tryCorridor({ type: 'ROOM_ENTERED', roomId })
  }, [tryCorridor])

  const exitRoom = useCallback(() => {
    setCurrentRoom(null)
    setExitRequested(false)
    tryCorridor({ type: 'ROOM_EXITED' })
  }, [tryCorridor])

  const requestExit = useCallback(() => {
    if (roomLoadStateRef.current.phase !== 'entered' || isTeleportingRef.current) return
    tryRoom({ type: 'EXIT' })
    tryCorridor({ type: 'EXIT' })
    setExitRequested(true)
  }, [tryRoom, tryCorridor])

  const clearExitRequest = useCallback(() => {
    setExitRequested(false)
  }, [])

  const markEntered = useCallback(() => {
    setHasEntered(true)
  }, [])

  const teleportTo = useCallback((roomId: RoomId) => {
    const roomPhase = roomLoadStateRef.current.phase
    if (roomPhase !== 'idle' && roomPhase !== 'entered') return
    if (isTeleporting || roomId === currentRoom) return

    // 状态机拒绝的情况（还在 loading、正在路线中之外的态）就是不该传送的情况
    if (tryCorridor({ type: 'TELEPORT', roomId })) isTeleportingRef.current = true
  }, [isTeleporting, currentRoom, tryCorridor])

  const startTeleportTransition = useCallback(() => {
    tryCorridor({ type: 'PAPER_CLOSED' })
  }, [tryCorridor])

  const currentTeleportRoom = useCallback((): RoomId | null => {
    return corridorActor.getSnapshot().context.teleportTarget ?? roomLoadStateRef.current.roomId
  }, [corridorActor])

  /* 非 fast 路径（TeleportRoom 保留的分支）：相机放好后直接开纸 */
  const openTeleportTransition = useCallback(() => {
    tryCorridor({ type: 'CAMERA_PLACED' })
    const roomId = currentTeleportRoom()
    if (roomId) tryCorridor({ type: 'ROOM_ENTERED', roomId })
  }, [tryCorridor, currentTeleportRoom])

  const completeTeleport = useCallback(() => {
    tryCorridor({ type: 'CAMERA_PLACED' })
  }, [tryCorridor])

  const signalRoomReady = useCallback(() => {
    const roomId = currentTeleportRoom()
    if (roomId) tryCorridor({ type: 'ROOM_ENTERED', roomId })
  }, [tryCorridor, currentTeleportRoom])

  const finishPaperOpen = useCallback(() => {
    tryCorridor({ type: 'PAPER_OPENED' })
  }, [tryCorridor])

  const markLoaded = useCallback(() => {
    tryCorridor({ type: 'LOADED' })
  }, [tryCorridor])

  /* LabLoader 稳定完成 → LOADED（LabLoader 是兄弟组件，经模块级信号；已完成则立刻回调） */
  useEffect(() => onLabLoaded(markLoaded), [markLoaded])

  const startTour = useCallback((): boolean => tryCorridor({ type: 'TOUR_START' }), [tryCorridor])

  const endTour = useCallback((reason: 'done' | 'input') => {
    tryCorridor({ type: reason === 'done' ? 'TOUR_END' : 'INPUT' })
  }, [tryCorridor])

  const value = useMemo<SceneState>(() => ({
    currentRoom,
    hasEntered,
    exitRequested,
    isInRoom: currentRoom !== null,
    teleportTarget,
    isTeleporting,
    teleportPhase,
    pendingDoorClick,
    isFastTeleport,
    roomLoadState,
    isRoomLoading,
    tryRoom,
    beginRoomLoad,
    markRoomAligned,
    markRoomReady,
    markRoomEntered,
    failRoomLoad,
    retryRoomLoad,
    resetRoomLoad,
    finishRoomExit,
    resetRoomLoadForTeleport,
    enterRoom,
    exitRoom,
    requestExit,
    clearExitRequest,
    markEntered,
    teleportTo,
    startTeleportTransition,
    openTeleportTransition,
    completeTeleport,
    signalRoomReady,
    finishPaperOpen,
    cancelTeleport,
    mode,
    markLoaded,
    startTour,
    endTour,
  }), [
    currentRoom,
    hasEntered,
    exitRequested,
    teleportTarget,
    isTeleporting,
    teleportPhase,
    pendingDoorClick,
    isFastTeleport,
    roomLoadState,
    isRoomLoading,
    tryRoom,
    beginRoomLoad,
    markRoomAligned,
    markRoomReady,
    markRoomEntered,
    failRoomLoad,
    retryRoomLoad,
    resetRoomLoad,
    finishRoomExit,
    resetRoomLoadForTeleport,
    enterRoom,
    exitRoom,
    requestExit,
    clearExitRequest,
    markEntered,
    teleportTo,
    startTeleportTransition,
    openTeleportTransition,
    completeTeleport,
    signalRoomReady,
    finishPaperOpen,
    cancelTeleport,
    mode,
    markLoaded,
    startTour,
    endTour,
  ])

  return (
    <SceneContext.Provider value={value}>
      {children}
    </SceneContext.Provider>
  )
}

export default SceneContext
