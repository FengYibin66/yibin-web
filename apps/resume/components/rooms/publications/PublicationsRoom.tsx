'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react'
import * as THREE from 'three'
import { useAchievements } from '@/context/AchievementsContext'
import { useScene } from '@/context/SceneContext'
import { useLocale } from '@/hooks/useLocale'
import { useRoomTutorial } from '@/hooks/useRoomTutorial'
import { getPublicationRoomItems } from '@/lib/content/publications'
import type { PublicationCardHandle } from './PublicationCard'
import { PublicationClothesline } from './PublicationClothesline'
import { PUBLICATION_CAROUSEL_ITEM_GAP } from './publicationConstants'
import {
  canBrowse,
  INITIAL_PUBLICATION_MOTION_STATE,
  publicationMotionReducer,
  type PublicationMotionEvent,
  type PublicationMotionState,
} from './publicationMotionMachine'
import { PublicationsScenery } from './PublicationsScenery'
import { usePaintMaterial } from './usePaintMaterial'
import { usePublicationCarousel } from './usePublicationCarousel'

const PUBLICATION_TUTORIAL_ID = 'publications_read'
const CARD_OPEN_WORLD_TARGET = new THREE.Vector3(0, 1.3, -0.5)
type PaintEntryPhase = 'idle' | 'revealing' | 'complete'

export interface PublicationsRoomProps {
  showRoom: boolean
  isExiting: boolean
}

export function PublicationsRoom({
  showRoom,
  isExiting,
}: PublicationsRoomProps) {
  const { locale } = useLocale()
  const { isTeleporting, teleportPhase } = useScene()
  const { hidePopup, unlockAchievement } = useAchievements()
  const publications = useMemo(
    () => getPublicationRoomItems(locale),
    [locale],
  )
  const paint = usePaintMaterial()
  const [motion, dispatchMotion] = useReducer(
    publicationMotionReducer,
    INITIAL_PUBLICATION_MOTION_STATE,
  )
  const motionRef = useRef<PublicationMotionState>(
    INITIAL_PUBLICATION_MOTION_STATE,
  )
  const cardHandlesRef = useRef(new Map<string, PublicationCardHandle>())
  const sequenceRef = useRef(0)
  const paintEntryPhaseRef = useRef<PaintEntryPhase>('idle')
  const teleportActive = isTeleporting || teleportPhase !== null
  const needsInitialReveal = (
    showRoom
    && !isExiting
    && !teleportActive
    && paintEntryPhaseRef.current === 'idle'
  )
  const revealLocked = paint.isRevealing || needsInitialReveal
  const sceneLocked = isExiting || teleportActive
  const carouselLocked = (
    !canBrowse(motion)
    || revealLocked
    || sceneLocked
  )
  const carousel = usePublicationCarousel({
    active: showRoom,
    locked: carouselLocked,
    itemCount: publications.length,
    itemGap: PUBLICATION_CAROUSEL_ITEM_GAP,
  })
  useRoomTutorial(PUBLICATION_TUTORIAL_ID)

  const sendMotion = useCallback((
    event: PublicationMotionEvent,
  ): PublicationMotionState => {
    const next = publicationMotionReducer(motionRef.current, event)
    motionRef.current = next
    dispatchMotion(event)
    return next
  }, [])

  const handleCardReady = useCallback((
    id: string,
    handle: PublicationCardHandle | null,
  ): void => {
    if (handle) {
      cardHandlesRef.current.set(id, handle)
      return
    }
    cardHandlesRef.current.delete(id)
  }, [])

  const openPublication = useCallback(async (
    id: string,
    sequence: number,
  ): Promise<void> => {
    const index = publications.findIndex(publication => publication.id === id)
    if (index < 0) return

    await carousel.centerItem(index)
    if (sequence !== sequenceRef.current) return
    sendMotion({ type: 'CENTERED' })
    sendMotion({ type: 'DETACHED' })
    await cardHandlesRef.current.get(id)?.open(CARD_OPEN_WORLD_TARGET)
    if (sequence !== sequenceRef.current) return
    sendMotion({ type: 'FLIPPED' })
  }, [carousel, publications, sendMotion])

  const handleSelect = useCallback(async (id: string): Promise<void> => {
    const current = motionRef.current
    if (current.phase !== 'hanging' && current.phase !== 'open') return

    unlockAchievement(PUBLICATION_TUTORIAL_ID)
    const sequence = ++sequenceRef.current
    if (current.phase === 'open') {
      const previousId = current.selectedId
      sendMotion({ type: 'CLICK', id })
      if (previousId) {
        await cardHandlesRef.current.get(previousId)?.close()
      }
      if (sequence !== sequenceRef.current) return
      const next = sendMotion({ type: 'RETURNED' })
      if (next.phase === 'centering' && next.selectedId) {
        await openPublication(next.selectedId, sequence)
      }
      return
    }

    sendMotion({ type: 'CLICK', id })
    await openPublication(id, sequence)
  }, [openPublication, sendMotion, unlockAchievement])

  useEffect(() => {
    if (!showRoom) {
      paintEntryPhaseRef.current = 'idle'
      paint.reset()
      return
    }
    if (isExiting) return
    if (teleportActive) {
      if (paintEntryPhaseRef.current === 'idle') {
        paintEntryPhaseRef.current = 'complete'
        paint.complete()
      }
      return
    }
    if (paintEntryPhaseRef.current !== 'idle') return

    paintEntryPhaseRef.current = 'revealing'
    let effectActive = true
    void paint.reveal().then(() => {
      if (effectActive && paintEntryPhaseRef.current === 'revealing') {
        paintEntryPhaseRef.current = 'complete'
      }
    })
    return () => {
      effectActive = false
      if (paintEntryPhaseRef.current === 'revealing') {
        paintEntryPhaseRef.current = 'idle'
        paint.cancel()
      }
    }
  }, [
    isExiting,
    paint.complete,
    paint.reset,
    paint.reveal,
    showRoom,
    teleportActive,
  ])

  useEffect(() => {
    if (showRoom && !isExiting && !teleportActive) return

    sequenceRef.current += 1
    paint.cancel()
    cardHandlesRef.current.forEach(handle => handle.cancel(true))
    hidePopup()
    sendMotion({ type: 'CANCEL' })
  }, [
    hidePopup,
    isExiting,
    paint.cancel,
    sendMotion,
    showRoom,
    teleportActive,
  ])

  if (!showRoom) return null

  return (
    <group ref={paint.setRoomOrigin}>
      <PublicationsScenery
        paint={paint.paint}
        ambienceEnabled={!sceneLocked}
      >
        <PublicationClothesline
          publications={publications}
          carousel={carousel}
          motion={motion}
          isInteractionLocked={revealLocked || sceneLocked}
          onSelect={handleSelect}
          onCardReady={handleCardReady}
        />
      </PublicationsScenery>
    </group>
  )
}
