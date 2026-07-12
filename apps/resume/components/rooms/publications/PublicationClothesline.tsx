'use client'

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PublicationCard, type PublicationCardHandle } from './PublicationCard'
import {
  PUBLICATION_CAROUSEL_ITEM_GAP,
} from './publicationConstants'
import { wrapDisplayOffset } from './publicationCarouselMath'
import type {
  PublicationCarouselApi,
} from './usePublicationCarousel'
import type { PublicationMotionState } from './publicationMotionMachine'
import type { PublicationRoomItem } from './publicationTypes'
import { PUBLICATION_ROPE_POINTS } from './PublicationsScenery'

const CARD_ORIGIN = new THREE.Vector3()

export interface PublicationClotheslineHandle {
  /** Apply current carousel scroll to every slot immediately (before open pose). */
  syncSlotsToScroll: () => void
  /** Clothesline group that owns rope slots (for browse/read camera framing). */
  getClotheslineRoot: () => THREE.Group | null
}

export interface PublicationClotheslineProps {
  publications: readonly PublicationRoomItem[]
  carousel: PublicationCarouselApi
  motion: PublicationMotionState
  isInteractionLocked: boolean
  onSelect: (id: string) => void
  onCardReady: (id: string, handle: PublicationCardHandle | null) => void
}

export function updateClotheslineCardPosition(
  group: THREE.Group,
  index: number,
  scroll: number,
  itemCount: number,
  curve: THREE.CatmullRomCurve3,
): void {
  const totalWidth = itemCount * PUBLICATION_CAROUSEL_ITEM_GAP
  const displayOffset = wrapDisplayOffset(
    index * PUBLICATION_CAROUSEL_ITEM_GAP - scroll,
    totalWidth,
  )
  const startX = PUBLICATION_ROPE_POINTS[0].x
  const endX = PUBLICATION_ROPE_POINTS.at(-1)!.x
  const curveProgress = THREE.MathUtils.clamp(
    (displayOffset - startX) / (endX - startX),
    0,
    1,
  )
  group.position.copy(curve.getPointAt(curveProgress))
}

export const PublicationClothesline = forwardRef<
  PublicationClotheslineHandle,
  PublicationClotheslineProps
>(function PublicationClothesline({
  publications,
  carousel,
  motion,
  isInteractionLocked,
  onSelect,
  onCardReady,
}, ref) {
  const groupRefs = useRef<Array<THREE.Group | null>>([])
  const onCardReadyRef = useRef(onCardReady)
  const lastFrozenIdRef = useRef<string | null>(null)
  const handleBindersRef = useRef(
    new Map<string, (handle: PublicationCardHandle | null) => void>(),
  )
  onCardReadyRef.current = onCardReady

  const curve = useMemo(
    () => new THREE.CatmullRomCurve3([...PUBLICATION_ROPE_POINTS]),
    [],
  )
  const isTransitioning = motion.phase !== 'hanging' && motion.phase !== 'open'
  const cardsLocked = isInteractionLocked || isTransitioning
  const canHover = !isInteractionLocked && motion.phase === 'hanging'
  // Freeze only once the card has left "centering" — during centering the slot
  // must keep tracking scroll so open-pose parent matrices stay valid.
  const shouldFreezeSelected = (
    motion.phase === 'detaching'
    || motion.phase === 'flipping'
    || motion.phase === 'open'
    || motion.phase === 'returning'
  )

  const syncSlotsToScroll = useCallback(() => {
    groupRefs.current.forEach((group, index) => {
      if (!group) return
      updateClotheslineCardPosition(
        group,
        index,
        carousel.currentScroll.current,
        publications.length,
        curve,
      )
      group.updateWorldMatrix(true, true)
    })
  }, [carousel.currentScroll, curve, publications.length])

  const getClotheslineRoot = useCallback((): THREE.Group | null => {
    const slot = groupRefs.current.find(
      (group): group is THREE.Group => group != null,
    )
    const parent = slot?.parent
    return parent instanceof THREE.Group ? parent : null
  }, [])

  useImperativeHandle(
    ref,
    () => ({ syncSlotsToScroll, getClotheslineRoot }),
    [getClotheslineRoot, syncSlotsToScroll],
  )
  useFrame(() => {
    groupRefs.current.forEach((group, index) => {
      if (!group) return
      const id = publications[index]?.id
      const selected = motion.selectedId === id
      if (selected && shouldFreezeSelected) {
        if (lastFrozenIdRef.current !== id) {
          lastFrozenIdRef.current = id ?? null
          const world = new THREE.Vector3()
          group.getWorldPosition(world)
          console.log('[pub-debug] slot FREEZE', {
            id,
            phase: motion.phase,
            localSlot: `[${group.position.toArray().map(n => n.toFixed(3)).join(', ')}]`,
            worldSlot: `[${world.toArray().map(n => n.toFixed(3)).join(', ')}]`,
            scroll: carousel.currentScroll.current.toFixed(3),
          })
        }
        return
      }
      updateClotheslineCardPosition(
        group,
        index,
        carousel.currentScroll.current,
        publications.length,
        curve,
      )
    })
    if (!motion.selectedId || !shouldFreezeSelected) {
      lastFrozenIdRef.current = null
    }
  })

  const setGroupRef = useCallback((index: number, group: THREE.Group | null) => {
    groupRefs.current[index] = group
    if (group) {
      updateClotheslineCardPosition(
        group,
        index,
        carousel.currentScroll.current,
        publications.length,
        curve,
      )
    }
  }, [carousel.currentScroll, curve, publications.length])

  const getHandleBinder = useCallback((id: string) => {
    const existing = handleBindersRef.current.get(id)
    if (existing) return existing
    const binder = (handle: PublicationCardHandle | null) => {
      onCardReadyRef.current(id, handle)
    }
    handleBindersRef.current.set(id, binder)
    return binder
  }, [])

  return (
    <>
      {motion.phase === 'open' && motion.selectedId && (
        <mesh
          name="publication-dismiss-plane"
          position={[0, 0.5, 0]}
          onClick={(event) => {
            event.stopPropagation()
            onSelect(motion.selectedId!)
          }}
        >
          <planeGeometry args={[22, 14]} />
          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      )}
      {publications.map((publication, index) => (
        <group
          key={publication.id}
          ref={group => setGroupRef(index, group)}
          name={`publication-clothesline-item-${publication.id}`}
        >
          <PublicationCard
            ref={getHandleBinder(publication.id)}
            publication={publication}
            index={index}
            displayPosition={CARD_ORIGIN}
            isSelected={motion.selectedId === publication.id}
            isLocked={cardsLocked}
            canHover={canHover}
            didDragRef={carousel.didDragRef}
            onSelect={onSelect}
          />
        </group>
      ))}
    </>
  )
})
