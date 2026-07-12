'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
} from 'react'

import {
  INITIAL_ROOM_LOAD_STATE,
  roomLoadReducer,
  type RoomLoadState,
} from '@/lib/lab/roomLoadMachine'

export type RoomId = 'about' | 'projects' | 'publications' | 'gallery' | 'contact'
export type TeleportPhase = 'closing' | 'teleporting' | 'opening' | null

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
  beginRoomLoad: (roomId: RoomId) => void
  markRoomAligned: () => void
  markRoomReady: () => void
  markRoomOpening: () => void
  markRoomEntered: () => void
  failRoomLoad: (message: string) => void
  retryRoomLoad: () => void
  resetRoomLoad: () => void

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
    roomLoadReducer,
    INITIAL_ROOM_LOAD_STATE,
  )

  const isRoomLoading =
    roomLoadState.phase === 'aligning' || roomLoadState.phase === 'loading'

  const beginRoomLoad = useCallback((roomId: RoomId) => {
    dispatchRoomLoad({ type: 'BEGIN', roomId })
  }, [])

  const markRoomAligned = useCallback(() => {
    dispatchRoomLoad({ type: 'ALIGNED' })
  }, [])

  const markRoomReady = useCallback(() => {
    dispatchRoomLoad({ type: 'READY' })
  }, [])

  const markRoomOpening = useCallback(() => {
    dispatchRoomLoad({ type: 'OPENING' })
  }, [])

  const markRoomEntered = useCallback(() => {
    dispatchRoomLoad({ type: 'OPENED' })
  }, [])

  const failRoomLoad = useCallback((message: string) => {
    dispatchRoomLoad({ type: 'FAIL', message })
  }, [])

  const retryRoomLoad = useCallback(() => {
    dispatchRoomLoad({ type: 'RETRY' })
  }, [])

  const resetRoomLoad = useCallback(() => {
    dispatchRoomLoad({ type: 'RESET' })
  }, [])

  const enterRoom = useCallback((roomId: RoomId) => {
    setCurrentRoom(roomId)
    setExitRequested(false)
    setIsTeleporting(false)
    setPendingDoorClick(null)
  }, [])

  const exitRoom = useCallback(() => {
    setCurrentRoom(null)
    setExitRequested(false)
  }, [])

  const requestExit = useCallback(() => {
    if (roomLoadState.phase !== 'entered') return
    dispatchRoomLoad({ type: 'EXIT' })
    setExitRequested(true)
  }, [roomLoadState.phase])

  const clearExitRequest = useCallback(() => {
    setExitRequested(false)
  }, [])

  const markEntered = useCallback(() => {
    setHasEntered(true)
  }, [])

  const teleportTo = useCallback((roomId: RoomId) => {
    if (isTeleporting || roomId === currentRoom) return

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
    beginRoomLoad,
    markRoomAligned,
    markRoomReady,
    markRoomOpening,
    markRoomEntered,
    failRoomLoad,
    retryRoomLoad,
    resetRoomLoad,
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
    beginRoomLoad,
    markRoomAligned,
    markRoomReady,
    markRoomOpening,
    markRoomEntered,
    failRoomLoad,
    retryRoomLoad,
    resetRoomLoad,
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
