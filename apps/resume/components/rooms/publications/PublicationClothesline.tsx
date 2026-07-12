'use client'

import { useCallback, useMemo, useRef } from 'react'
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

export interface PublicationClotheslineProps {
  publications: readonly PublicationRoomItem[]
  carousel: PublicationCarouselApi
  motion: PublicationMotionState
  isInteractionLocked: boolean
  onSelect: (id: string) => void
  onCardReady: (id: string, handle: PublicationCardHandle | null) => void
}

function updateCardPosition(
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

export function PublicationClothesline({
  publications,
  carousel,
  motion,
  isInteractionLocked,
  onSelect,
  onCardReady,
}: PublicationClotheslineProps) {
  const groupRefs = useRef<Array<THREE.Group | null>>([])
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3([...PUBLICATION_ROPE_POINTS]),
    [],
  )
  const isTransitioning = motion.phase !== 'hanging' && motion.phase !== 'open'
  const cardsLocked = isInteractionLocked || isTransitioning
  const canHover = !isInteractionLocked && motion.phase === 'hanging'

  useFrame(() => {
    groupRefs.current.forEach((group, index) => {
      if (!group) return
      updateCardPosition(
        group,
        index,
        carousel.currentScroll.current,
        publications.length,
        curve,
      )
    })
  })

  const setGroupRef = useCallback((index: number, group: THREE.Group | null) => {
    groupRefs.current[index] = group
    if (group) {
      updateCardPosition(
        group,
        index,
        carousel.currentScroll.current,
        publications.length,
        curve,
      )
    }
  }, [carousel.currentScroll, curve, publications.length])

  return publications.map((publication, index) => (
    <group
      key={publication.id}
      ref={group => setGroupRef(index, group)}
      name={`publication-clothesline-item-${publication.id}`}
    >
      <PublicationCard
        ref={handle => onCardReady(publication.id, handle)}
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
  ))
}
