'use client'

import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { PUBLICATION_CARD_MOTION } from './publicationConstants'
import { resolveBrowseCameraPose } from './publicationOpenPose'
import type { PublicationClotheslineHandle } from './PublicationClothesline'

/**
 * After corridor fly-in completes (entered=true), ease the camera onto the
 * clothesline axis so hanging cards are viewport-centered. Settles once per
 * room visit; killed and reset when leaving the room.
 */
export function usePublicationBrowseCamera(options: {
  entered: boolean
  clotheslineRef: RefObject<PublicationClotheslineHandle | null>
}): void {
  const { camera } = useThree()
  const settledRef = useRef(false)
  const tweenRef = useRef<gsap.core.Tween | null>(null)
  const clotheslineRef = options.clotheslineRef

  useEffect(() => {
    if (!options.entered) {
      settledRef.current = false
      tweenRef.current?.kill()
      tweenRef.current = null
      return
    }
    if (settledRef.current) return

    let cancelled = false
    let attempts = 0
    const maxAttempts = 120

    const trySettle = (): void => {
      if (cancelled || settledRef.current) return
      attempts += 1
      const root = clotheslineRef.current?.getClotheslineRoot() ?? null
      if (!root) {
        if (attempts < maxAttempts) requestAnimationFrame(trySettle)
        return
      }

      settledRef.current = true
      const pose = resolveBrowseCameraPose(root, camera)
      const fromPos = camera.position.clone()
      const fromQuat = camera.quaternion.clone()
      const proxy = { t: 0 }
      const frame = PUBLICATION_CARD_MOTION.cameraFrame

      console.log('[pub-debug] browse camera settle', {
        from: fromPos.toArray().map(n => n.toFixed(3)),
        to: pose.position.toArray().map(n => n.toFixed(3)),
      })

      tweenRef.current = gsap.to(proxy, {
        t: 1,
        duration: frame.browseDuration,
        ease: frame.browseEase,
        onUpdate: () => {
          camera.position.lerpVectors(fromPos, pose.position, proxy.t)
          camera.quaternion.slerpQuaternions(fromQuat, pose.quaternion, proxy.t)
        },
      })
    }

    requestAnimationFrame(trySettle)

    return () => {
      cancelled = true
      tweenRef.current?.kill()
      tweenRef.current = null
    }
  }, [camera, clotheslineRef, options.entered])
}
