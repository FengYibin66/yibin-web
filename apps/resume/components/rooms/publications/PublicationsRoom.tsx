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
  const entryStartedRef = useRef(false)
  const carouselLocked = (
    !canBrowse(motion)
    || paint.isRevealing
    || isExiting
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
      entryStartedRef.current = false
      paint.reset()
      return
    }
    if (isExiting || entryStartedRef.current) return

    entryStartedRef.current = true
    if (isTeleporting || teleportPhase !== null) {
      paint.complete()
    } else {
      void paint.reveal()
    }
    return () => {
      entryStartedRef.current = false
      paint.cancel()
    }
  }, [
    isExiting,
    isTeleporting,
    paint.complete,
    paint.reset,
    paint.reveal,
    showRoom,
    teleportPhase,
  ])

  useEffect(() => {
    if (showRoom && !isExiting && !isTeleporting) return

    sequenceRef.current += 1
    paint.cancel()
    cardHandlesRef.current.forEach(handle => handle.cancel())
    hidePopup()
    sendMotion({ type: 'CANCEL' })
  }, [
    hidePopup,
    isExiting,
    isTeleporting,
    paint.cancel,
    sendMotion,
    showRoom,
  ])

  if (!showRoom) return null

  return (
    <group ref={paint.setRoomOrigin}>
      <PublicationsScenery
        paint={paint.paint}
        ambienceEnabled={!isExiting && !isTeleporting}
      >
        <PublicationClothesline
          publications={publications}
          carousel={carousel}
          motion={motion}
          isInteractionLocked={paint.isRevealing || isExiting}
          onSelect={handleSelect}
          onCardReady={handleCardReady}
        />
      </PublicationsScenery>
    </group>
  )
}
