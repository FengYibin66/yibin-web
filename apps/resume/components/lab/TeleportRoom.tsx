'use client'

import { memo, useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useScene } from '@/context/SceneContext'
import type { RoomId } from '@/context/SceneContext'

// Each room's door Z coordinate (matches DOORS_LOOP1 in LabScene)
const ROOM_DOOR_Z: Record<RoomId, number> = {
  about:        -8,
  projects:     -20,
  publications: -32,
  gallery:      -44,
  contact:      -56,
}

/**
 * TeleportRoom — pure-logic R3F component (no render output).
 *
 * Listens to SceneContext for the 'teleporting' phase, instantly moves
 * the camera to 8 units in front of the target door, then calls
 * completeTeleport() so DoorSection picks up the pendingDoorClick.
 *
 * Must be rendered inside <Canvas>.
 */
const TeleportRoom = memo(function TeleportRoom() {
  const {
    teleportTarget,
    teleportPhase,
    completeTeleport,
    isFastTeleport,
    isTeleporting,
    openTeleportTransition,
  } = useScene()
  const { camera } = useThree()
  const hasPositioned = useRef(false)

  useEffect(() => {
    if (teleportPhase === 'teleporting' && teleportTarget && !hasPositioned.current) {
      const doorZ = ROOM_DOOR_Z[teleportTarget]

      if (doorZ !== undefined) {
        // Instantly move camera to 8 units before the door
        camera.position.set(0, 0.2, doorZ + 8)
        camera.rotation.set(0, 0, 0)
        camera.updateMatrixWorld()
        hasPositioned.current = true

        // Small delay to let the frame update before triggering the door click
        setTimeout(() => {
          if (isFastTeleport) {
            // Fast teleport: paper stays closed, go straight to door click
            completeTeleport()
          } else {
            // Normal teleport: open paper animation first
            openTeleportTransition()
          }
        }, 50)
      }
    }

    // Reset flag when teleportation finishes
    if (!isTeleporting) {
      hasPositioned.current = false
    }
  }, [teleportPhase, teleportTarget, isTeleporting, isFastTeleport, camera, completeTeleport, openTeleportTransition])

  return null
})

TeleportRoom.displayName = 'TeleportRoom'

export { TeleportRoom }
