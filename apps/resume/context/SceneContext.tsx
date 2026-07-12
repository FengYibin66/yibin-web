'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'

import {
  tryAdvanceDoorEntryFlow,
  type DoorEntryFlowResult,
  type DoorEntrySignal,
} from '@/lib/lab/doorEntryFlow'
import {
  INITIAL_ROOM_LOAD_STATE,
  roomLoadReducer,
  type RoomLoadEvent,
  type RoomLoadState,
} from '@/lib/lab/roomLoadMachine'

export type RoomId = 'about' | 'projects' | 'publications' | 'gallery' | 'contact'
export type TeleportPhase = 'closing' | 'teleporting' | 'opening' | null

type RoomLoadAction =
  | { type: 'SIGNAL'; signal: DoorEntrySignal }
  | { type: 'EVENT'; event: RoomLoadEvent }

function sceneRoomLoadReducer(
  state: RoomLoadState,
  action: RoomLoadAction,
): RoomLoadState {
  if (action.type === 'SIGNAL') {
    return tryAdvanceDoorEntryFlow(state, action.signal)?.state ?? state
  }
  return roomLoadReducer(state, action.event)
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

  roomLoadState: RoomLoadState
  isRoomLoading: boolean
  dispatchDoorEntry: (signal: DoorEntrySignal) => DoorEntryFlowResult | null
  beginRoomLoad: (roomId: RoomId, segmentIndex?: number) => boolean
  markRoomAligned: () => void
  markRoomReady: () => void
  markRoomOpening: () => void
  markRoomEntered: () => void
  timeoutRoomLoad: (message: string) => void
  failRoomLoad: (message: string) => void
  retryRoomLoad: () => void
  resetRoomLoad: () => void
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

  const [teleportTarget, setTeleportTarget] = useState<RoomId | null>(null)
  const [isTeleporting, setIsTeleporting] = useState(false)
  const [teleportPhase, setTeleportPhase] = useState<TeleportPhase>(null)
  const [pendingDoorClick, setPendingDoorClick] = useState<RoomId | null>(null)
  const [isFastTeleport, setIsFastTeleport] = useState(false)
  const [roomLoadState, dispatchRoomLoad] = useReducer(
    sceneRoomLoadReducer,
    INITIAL_ROOM_LOAD_STATE,
  )
  const roomLoadStateRef = useRef(roomLoadState)
  const isTeleportingRef = useRef(isTeleporting)
  roomLoadStateRef.current = roomLoadState
  isTeleportingRef.current = isTeleporting

  const isRoomLoading =
    roomLoadState.phase === 'aligning' || roomLoadState.phase === 'loading'

  const dispatchDoorEntry = useCallback((signal: DoorEntrySignal): DoorEntryFlowResult | null => {
    const preview = tryAdvanceDoorEntryFlow(roomLoadStateRef.current, signal)
    if (!preview) return null
    roomLoadStateRef.current = preview.state
    dispatchRoomLoad({ type: 'SIGNAL', signal })
    return preview
  }, [])

  const applyRoomLoadEvent = useCallback((event: RoomLoadEvent) => {
    const nextState = roomLoadReducer(roomLoadStateRef.current, event)
    roomLoadStateRef.current = nextState
    dispatchRoomLoad({ type: 'EVENT', event })
  }, [])

  const beginRoomLoad = useCallback((roomId: RoomId, segmentIndex = 0): boolean => {
    return dispatchDoorEntry({ type: 'CLICK', roomId, segmentIndex }) !== null
  }, [dispatchDoorEntry])

  const markRoomAligned = useCallback(() => {
    dispatchDoorEntry({ type: 'CAMERA_ALIGNED' })
  }, [dispatchDoorEntry])

  const markRoomReady = useCallback(() => {
    dispatchDoorEntry({ type: 'ROOM_READY' })
  }, [dispatchDoorEntry])

  const markRoomOpening = useCallback(() => {
    dispatchDoorEntry({ type: 'READY_OBSERVED' })
  }, [dispatchDoorEntry])

  const markRoomEntered = useCallback(() => {
    dispatchDoorEntry({ type: 'ENTRY_COMPLETED' })
  }, [dispatchDoorEntry])

  const timeoutRoomLoad = useCallback((message: string) => {
    dispatchDoorEntry({ type: 'TIMEOUT', message })
  }, [dispatchDoorEntry])

  const failRoomLoad = useCallback((message: string) => {
    dispatchDoorEntry({ type: 'ROOM_ERROR', message })
  }, [dispatchDoorEntry])

  const retryRoomLoad = useCallback(() => {
    dispatchDoorEntry({ type: 'RETRY' })
  }, [dispatchDoorEntry])

  const resetRoomLoad = useCallback(() => {
    applyRoomLoadEvent({ type: 'RESET' })
  }, [applyRoomLoadEvent])

  const resetRoomLoadForTeleport = useCallback(() => {
    if (roomLoadStateRef.current.phase !== 'entered' || !isTeleportingRef.current) return
    applyRoomLoadEvent({ type: 'TELEPORT_RESET' })
  }, [applyRoomLoadEvent])

  const enterRoom = useCallback((roomId: RoomId) => {
    setCurrentRoom(roomId)
    setExitRequested(false)
    isTeleportingRef.current = false
    setIsTeleporting(false)
    setPendingDoorClick(null)
  }, [])

  const exitRoom = useCallback(() => {
    setCurrentRoom(null)
    setExitRequested(false)
  }, [])

  const requestExit = useCallback(() => {
    if (roomLoadStateRef.current.phase !== 'entered' || isTeleportingRef.current) return
    dispatchDoorEntry({ type: 'EXIT' })
    setExitRequested(true)
  }, [dispatchDoorEntry])

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

    isTeleportingRef.current = true
    setTeleportTarget(roomId)
    setIsTeleporting(true)
    setIsFastTeleport(true)
    setTeleportPhase('closing')
  }, [isTeleporting, currentRoom])

  const startTeleportTransition = useCallback(() => {
    setTeleportPhase('teleporting')
  }, [])

  const openTeleportTransition = useCallback(() => {
    setTeleportPhase('opening')
  }, [])

  const completeTeleport = useCallback(() => {
    setPendingDoorClick(teleportTarget)
    setTeleportTarget(null)
  }, [teleportTarget])

  const signalRoomReady = useCallback(() => {
    if (isFastTeleport) {
      setTeleportPhase('opening')
      setIsFastTeleport(false)
    }
  }, [isFastTeleport])

  const finishPaperOpen = useCallback(() => {
    setTeleportPhase(null)
  }, [])

  const cancelTeleport = useCallback(() => {
    setTeleportTarget(null)
    isTeleportingRef.current = false
    setIsTeleporting(false)
    setTeleportPhase(null)
    setPendingDoorClick(null)
    setIsFastTeleport(false)
  }, [])

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
    dispatchDoorEntry,
    beginRoomLoad,
    markRoomAligned,
    markRoomReady,
    markRoomOpening,
    markRoomEntered,
    timeoutRoomLoad,
    failRoomLoad,
    retryRoomLoad,
    resetRoomLoad,
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
    dispatchDoorEntry,
    beginRoomLoad,
    markRoomAligned,
    markRoomReady,
    markRoomOpening,
    markRoomEntered,
    timeoutRoomLoad,
    failRoomLoad,
    retryRoomLoad,
    resetRoomLoad,
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
  ])

  return (
    <SceneContext.Provider value={value}>
      {children}
    </SceneContext.Provider>
  )
}

export default SceneContext
