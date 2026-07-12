'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import type { PaperMaterialHandle } from '../gallery/PaperMaterial'
import { PUBLICATION_CARD_MOTION } from './publicationConstants'
import {
  resolvePresentLocalTarget,
  resolveReadingCameraPose,
} from './publicationOpenPose'

interface PublicationCardSnapshot {
  position: THREE.Vector3
  rotation: THREE.Euler
  scale: THREE.Vector3
  bend: number
  windStrength: number
  uProgress: number
}

interface HangCameraSnapshot {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
}

interface ActiveAction {
  timeline: gsap.core.Timeline | null
  resolve: () => void
  settled: boolean
}

export interface PublicationCardMotionApi {
  paperRef: RefObject<THREE.Group | null>
  materialRef: RefObject<PaperMaterialHandle | null>
  open: () => Promise<void>
  close: () => Promise<void>
  cancel: (restoreSnapshot?: boolean) => void
}

function captureSnapshot(
  paper: THREE.Group,
  material: PaperMaterialHandle,
): PublicationCardSnapshot {
  return {
    position: paper.position.clone(),
    rotation: paper.rotation.clone(),
    scale: paper.scale.clone(),
    bend: material.bend,
    windStrength: material.windStrength,
    uProgress: material.uProgress,
  }
}

function restoreCardSnapshot(
  paper: THREE.Group,
  material: PaperMaterialHandle,
  snapshot: PublicationCardSnapshot,
): void {
  paper.position.copy(snapshot.position)
  paper.rotation.copy(snapshot.rotation)
  paper.scale.copy(snapshot.scale)
  material.bend = snapshot.bend
  material.windStrength = snapshot.windStrength
  material.uProgress = snapshot.uProgress
}

function addCameraPoseTween(
  timeline: gsap.core.Timeline,
  camera: THREE.Object3D,
  from: HangCameraSnapshot,
  to: HangCameraSnapshot,
  atPosition: number | string = 0,
): void {
  const frame = PUBLICATION_CARD_MOTION.cameraFrame
  const proxy = { t: 0 }
  timeline.to(proxy, {
    t: 1,
    duration: frame.duration,
    ease: frame.ease,
    onUpdate: () => {
      camera.position.lerpVectors(from.position, to.position, proxy.t)
      camera.quaternion.slerpQuaternions(from.quaternion, to.quaternion, proxy.t)
    },
  }, atPosition)
}

/**
 * Open sequence ported from portfolio-itom GalleryRoom ProjectCard.openCard.
 * Present target is clothesline-local; camera moves onto the paper facing axis
 * so rot.x=π reads face-on (corridor entry alone leaves the camera off-axis).
 */
function addOpenSteps(
  timeline: gsap.core.Timeline,
  paper: THREE.Group,
  material: PaperMaterialHandle,
  camera: THREE.Object3D,
  hangCamera: HangCameraSnapshot,
): void {
  const open = PUBLICATION_CARD_MOTION.open
  const hangY = open.hangY
  const present = resolvePresentLocalTarget(paper)
  const reading = resolveReadingCameraPose(paper, camera)

  console.log('[pub-debug] present target (itom clothesline-local)', {
    presentLocal: present.toArray().map(n => n.toFixed(3)),
    readingPos: reading.position.toArray().map(n => n.toFixed(3)),
    slot: paper.parent?.parent?.position.toArray().map(n => n.toFixed(3)),
    anchor: open.presentAnchor,
  })

  addCameraPoseTween(timeline, camera, hangCamera, {
    position: reading.position,
    quaternion: reading.quaternion,
  }, 0)

  // A — detach
  timeline
    .to(paper.position, {
      y: hangY - open.detachY,
      duration: open.detachDuration,
      ease: open.detachEase,
    })
    .to(paper.rotation, {
      x: open.detachRotX,
      z: open.detachRotZ,
      duration: open.detachDuration,
      ease: open.detachEase,
    }, '<')
    .to(material, {
      bend: open.detachBend,
      windStrength: open.windStrength,
      uProgress: open.progress,
      duration: open.detachDuration,
      ease: open.detachEase,
    }, '<')

  // B — mid flip (itom: y = hangY + 1.5 = 0.4)
  timeline
    .to(paper.position, {
      y: hangY + 1.5,
      x: present.x * open.midAnchorMix,
      z: present.z * open.midAnchorMix,
      duration: open.midDuration,
      ease: open.midPosEase,
    })
    .to(paper.rotation, {
      x: open.midRotX,
      y: open.midRotY,
      z: open.midRotZ,
      duration: open.midDuration,
      ease: open.midRotEase,
    }, '<')
    .to(material, {
      bend: open.midBend,
      duration: open.midDuration,
      ease: open.midRotEase,
    }, '<')

  // C — present at clothesline anchor
  timeline
    .to(paper.position, {
      x: present.x,
      y: present.y,
      z: present.z,
      duration: open.presentDuration,
      ease: open.presentEase,
    })
    .to(paper.rotation, {
      x: Math.PI,
      y: 0,
      z: 0,
      duration: open.presentDuration,
      ease: open.presentEase,
    }, '<')
    .to(material, {
      bend: open.presentBend,
      duration: open.presentBendDuration,
      ease: open.presentBendEase,
    }, '<')
    .to(paper.scale, {
      x: open.scale,
      y: open.scale,
      z: open.scale,
      duration: open.scaleDuration,
      ease: open.scaleEase,
    }, '-=0.4')
}

function addCloseSteps(
  timeline: gsap.core.Timeline,
  paper: THREE.Group,
  material: PaperMaterialHandle,
  snapshot: PublicationCardSnapshot,
  camera: THREE.Object3D,
  hangCamera: HangCameraSnapshot | null,
): void {
  const open = PUBLICATION_CARD_MOTION.open
  const close = PUBLICATION_CARD_MOTION.close
  const hangY = open.hangY

  if (hangCamera) {
    addCameraPoseTween(
      timeline,
      camera,
      {
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
      },
      hangCamera,
      0,
    )
  }

  timeline
    .to(paper.position, {
      y: hangY + 0.6,
      x: 0,
      z: close.midZ,
      duration: close.midDuration,
      ease: close.midEase,
    })
    .to(paper.rotation, {
      x: close.midRotX,
      y: 0,
      z: close.midRotZ,
      duration: close.midDuration,
      ease: close.midEase,
    }, '<')
    .to(material, {
      bend: close.midBend,
      duration: 0.3,
      ease: close.midEase,
    }, '<')
    .to(paper.scale, {
      x: snapshot.scale.x,
      y: snapshot.scale.y,
      z: snapshot.scale.z,
      duration: 0.3,
      ease: 'sine.inOut',
    }, '<')
    .to(paper.position, {
      y: hangY,
      x: 0,
      z: 0,
      duration: close.hangDuration,
      ease: close.hangEase,
    })
    .to(paper.rotation, {
      x: 0,
      y: 0,
      z: 0,
      duration: close.hangDuration,
      ease: close.hangEase,
    }, '<')
    .to(material, {
      bend: snapshot.bend,
      windStrength: snapshot.windStrength,
      uProgress: snapshot.uProgress,
      duration: 0.3,
      ease: 'power2.out',
    }, '<')
}

export function usePublicationCardMotion(): PublicationCardMotionApi {
  const { camera } = useThree()
  const paperRef = useRef<THREE.Group>(null)
  const materialRef = useRef<PaperMaterialHandle>(null)
  const snapshotRef = useRef<PublicationCardSnapshot | null>(null)
  const hangCameraRef = useRef<HangCameraSnapshot | null>(null)
  const activeActionRef = useRef<ActiveAction | null>(null)

  const settleAction = useCallback((action: ActiveAction): boolean => {
    if (action.settled) return false
    action.settled = true
    if (activeActionRef.current === action) {
      activeActionRef.current = null
    }
    action.resolve()
    return true
  }, [])

  const cancel = useCallback((restoreSnapshot = false): void => {
    const action = activeActionRef.current
    if (action) {
      activeActionRef.current = null
      action.timeline?.kill()
      settleAction(action)
    }
    const paper = paperRef.current
    const material = materialRef.current
    const snapshot = snapshotRef.current
    if (restoreSnapshot && paper && material && snapshot) {
      restoreCardSnapshot(paper, material, snapshot)
      snapshotRef.current = null
      if (hangCameraRef.current) {
        camera.position.copy(hangCameraRef.current.position)
        camera.quaternion.copy(hangCameraRef.current.quaternion)
        hangCameraRef.current = null
      }
    }
  }, [camera, settleAction])

  const open = useCallback((): Promise<void> => {
    cancel()
    const paper = paperRef.current
    const material = materialRef.current
    if (!paper || !material) return Promise.resolve()

    snapshotRef.current = captureSnapshot(paper, material)
    if (!hangCameraRef.current) {
      hangCameraRef.current = {
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
      }
    }
    const hangCamera = hangCameraRef.current
    material.bend = 0

    return new Promise(resolve => {
      const action: ActiveAction = { timeline: null, resolve, settled: false }
      activeActionRef.current = action
      action.timeline = gsap.timeline({
        onComplete: () => {
          const world = new THREE.Vector3()
          paper.getWorldPosition(world)
          console.log('[pub-debug] card.open COMPLETE', {
            localPos: paper.position.toArray().map(n => n.toFixed(3)),
            worldPos: world.toArray().map(n => n.toFixed(3)),
            camPos: camera.position.toArray().map(n => n.toFixed(3)),
            rotation: [
              paper.rotation.x.toFixed(3),
              paper.rotation.y.toFixed(3),
              paper.rotation.z.toFixed(3),
            ],
          })
          settleAction(action)
        },
        onInterrupt: () => settleAction(action),
      })
      addOpenSteps(
        action.timeline,
        paper,
        material,
        camera,
        hangCamera,
      )
    })
  }, [camera, cancel, settleAction])

  const close = useCallback((): Promise<void> => {
    cancel()
    const paper = paperRef.current
    const material = materialRef.current
    const snapshot = snapshotRef.current
    if (!paper || !material || !snapshot) return Promise.resolve()

    return new Promise(resolve => {
      const action: ActiveAction = { timeline: null, resolve, settled: false }
      activeActionRef.current = action
      action.timeline = gsap.timeline({
        onComplete: () => {
          if (settleAction(action)) {
            snapshotRef.current = null
            hangCameraRef.current = null
          }
        },
        onInterrupt: () => settleAction(action),
      })
      addCloseSteps(
        action.timeline,
        paper,
        material,
        snapshot,
        camera,
        hangCameraRef.current,
      )
    })
  }, [camera, cancel, settleAction])

  useEffect(() => () => cancel(true), [cancel])

  return useMemo(
    () => ({ paperRef, materialRef, open, close, cancel }),
    [cancel, close, open],
  )
}
