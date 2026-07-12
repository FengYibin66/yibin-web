'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import type { PaperMaterialHandle } from '../gallery/PaperMaterial'
import { PUBLICATION_CARD_MOTION } from './publicationConstants'

interface PublicationCardSnapshot {
  position: THREE.Vector3
  rotation: THREE.Euler
  scale: THREE.Vector3
  bend: number
  windStrength: number
  uProgress: number
}

interface ActiveAction {
  timeline: gsap.core.Timeline | null
  resolve: () => void
  settled: boolean
}

export interface PublicationCardMotionApi {
  paperRef: RefObject<THREE.Group | null>
  materialRef: RefObject<PaperMaterialHandle | null>
  open: (target: THREE.Vector3) => Promise<void>
  close: () => Promise<void>
  cancel: () => void
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

function toParentSpace(paper: THREE.Group, worldTarget: THREE.Vector3): THREE.Vector3 {
  const localTarget = worldTarget.clone()
  if (!paper.parent) {
    return localTarget
  }
  paper.parent.updateWorldMatrix(true, false)
  return paper.parent.worldToLocal(localTarget)
}

function addOpenSteps(
  timeline: gsap.core.Timeline,
  paper: THREE.Group,
  material: PaperMaterialHandle,
  snapshot: PublicationCardSnapshot,
  target: THREE.Vector3,
): void {
  const motion = PUBLICATION_CARD_MOTION.open
  timeline
    .to(paper.position, {
      y: snapshot.position.y - motion.detachY,
      duration: motion.detachDuration,
      ease: motion.detachEase,
    })
    .to(paper.rotation, {
      x: motion.detachRotationX,
      z: motion.detachRotationZ,
      duration: motion.detachDuration,
      ease: motion.detachEase,
    }, '<')
    .to(material, {
      bend: motion.detachBend,
      windStrength: motion.windStrength,
      uProgress: motion.progress,
      duration: motion.detachDuration,
      ease: motion.detachEase,
    }, '<')
    .to(paper.position, {
      y: snapshot.position.y + motion.liftY,
      duration: motion.liftDuration,
      ease: motion.liftEase,
    })
    .to(paper.rotation, {
      x: Math.PI * motion.flipRatio,
      duration: motion.liftDuration,
      ease: motion.liftEase,
    }, '<')
    .to(material, {
      bend: motion.liftBend,
      duration: motion.liftDuration,
      ease: motion.liftEase,
    }, '<')
    .to(paper.position, {
      x: target.x,
      y: target.y,
      z: target.z,
      duration: motion.centerDuration,
      ease: motion.centerEase,
    })
    .to(paper.rotation, {
      x: motion.centerRotationX,
      y: motion.centerRotationY,
      z: motion.centerRotationZ,
      duration: motion.centerDuration,
      ease: motion.centerEase,
    }, '<')
    .to(paper.scale, {
      x: motion.scale,
      y: motion.scale,
      z: motion.scale,
      duration: motion.settleDuration,
      ease: motion.settleEase,
    })
    .to(material, {
      bend: motion.settleBend,
      duration: motion.settleDuration,
      ease: motion.settleEase,
    }, '<')
}

function addCloseSteps(
  timeline: gsap.core.Timeline,
  paper: THREE.Group,
  material: PaperMaterialHandle,
  snapshot: PublicationCardSnapshot,
): void {
  const open = PUBLICATION_CARD_MOTION.open
  const close = PUBLICATION_CARD_MOTION.close
  timeline
    .to(paper.scale, {
      x: snapshot.scale.x,
      y: snapshot.scale.y,
      z: snapshot.scale.z,
      duration: close.zoomDuration,
      ease: close.zoomEase,
    })
    .to(material, {
      bend: open.liftBend,
      duration: close.zoomDuration,
      ease: close.zoomEase,
    }, '<')
    .to(paper.position, {
      x: snapshot.position.x,
      y: snapshot.position.y + open.liftY,
      z: snapshot.position.z,
      duration: close.centerDuration,
      ease: close.centerEase,
    })
    .to(paper.rotation, {
      x: Math.PI * open.flipRatio,
      y: open.centerRotationY,
      z: open.centerRotationZ,
      duration: close.centerDuration,
      ease: close.centerEase,
    }, '<')
    .to(material, {
      bend: open.liftBend,
      duration: close.centerDuration,
      ease: close.centerEase,
    }, '<')
    .to(paper.position, {
      y: snapshot.position.y - open.detachY,
      duration: close.lowerDuration,
      ease: close.lowerEase,
    })
    .to(paper.rotation, {
      x: open.detachRotationX,
      z: open.detachRotationZ,
      duration: close.lowerDuration,
      ease: close.lowerEase,
    }, '<')
    .to(material, {
      bend: open.detachBend,
      duration: close.lowerDuration,
      ease: close.lowerEase,
    }, '<')
    .to(paper.position, {
      x: snapshot.position.x,
      y: snapshot.position.y,
      z: snapshot.position.z,
      duration: close.attachDuration,
      ease: close.attachEase,
    })
    .to(paper.rotation, {
      x: snapshot.rotation.x,
      y: snapshot.rotation.y,
      z: snapshot.rotation.z,
      duration: close.attachDuration,
      ease: close.attachEase,
    }, '<')
    .to(material, {
      bend: snapshot.bend,
      windStrength: snapshot.windStrength,
      uProgress: snapshot.uProgress,
      duration: close.attachDuration,
      ease: close.attachEase,
    }, '<')
}

export function usePublicationCardMotion(): PublicationCardMotionApi {
  const paperRef = useRef<THREE.Group>(null)
  const materialRef = useRef<PaperMaterialHandle>(null)
  const snapshotRef = useRef<PublicationCardSnapshot | null>(null)
  const activeActionRef = useRef<ActiveAction | null>(null)

  const settleAction = useCallback((action: ActiveAction): boolean => {
    if (action.settled) {
      return false
    }
    action.settled = true
    if (activeActionRef.current === action) {
      activeActionRef.current = null
    }
    action.resolve()
    return true
  }, [])

  const cancel = useCallback((): void => {
    const action = activeActionRef.current
    if (!action) {
      return
    }
    activeActionRef.current = null
    action.timeline?.kill()
    settleAction(action)
  }, [settleAction])

  const open = useCallback((worldTarget: THREE.Vector3): Promise<void> => {
    cancel()
    const paper = paperRef.current
    const material = materialRef.current
    if (!paper || !material) {
      return Promise.resolve()
    }

    const snapshot = captureSnapshot(paper, material)
    const target = toParentSpace(paper, worldTarget)
    snapshotRef.current = snapshot
    return new Promise(resolve => {
      const action: ActiveAction = { timeline: null, resolve, settled: false }
      activeActionRef.current = action
      action.timeline = gsap.timeline({
        onComplete: () => settleAction(action),
        onInterrupt: () => settleAction(action),
      })
      addOpenSteps(action.timeline, paper, material, snapshot, target)
    })
  }, [cancel, settleAction])

  const close = useCallback((): Promise<void> => {
    cancel()
    const paper = paperRef.current
    const material = materialRef.current
    const snapshot = snapshotRef.current
    if (!paper || !material || !snapshot) {
      return Promise.resolve()
    }

    return new Promise(resolve => {
      const action: ActiveAction = { timeline: null, resolve, settled: false }
      activeActionRef.current = action
      action.timeline = gsap.timeline({
        onComplete: () => {
          if (settleAction(action)) {
            snapshotRef.current = null
          }
        },
        onInterrupt: () => settleAction(action),
      })
      addCloseSteps(action.timeline, paper, material, snapshot)
    })
  }, [cancel, settleAction])

  useEffect(() => cancel, [cancel])

  return useMemo(
    () => ({ paperRef, materialRef, open, close, cancel }),
    [cancel, close, open],
  )
}
