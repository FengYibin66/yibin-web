'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react'
import { useAchievements } from '@/context/AchievementsContext'
import { useScene } from '@/context/SceneContext'
import { useLocale } from '@/hooks/useLocale'
import { useRoomTutorial } from '@/hooks/useRoomTutorial'
import { getPublicationRoomItems } from '@/lib/content/publications'
import type { PublicationCardHandle } from './PublicationCard'
import {
  PublicationClothesline,
  type PublicationClotheslineHandle,
} from './PublicationClothesline'
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
import { usePublicationBrowseCamera } from './usePublicationBrowseCamera'
import { usePublicationCarousel } from './usePublicationCarousel'

const PUBLICATION_TUTORIAL_ID = 'publications_read'
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
  const { isTeleporting, teleportPhase, currentRoom } = useScene()
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
  const clotheslineRef = useRef<PublicationClotheslineHandle>(null)
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
  usePublicationBrowseCamera({
    entered: (
      showRoom
      && !isExiting
      && !teleportActive
      && currentRoom === 'publications'
    ),
    clotheslineRef,
  })

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
    console.log('[pub-debug] openPublication start', {
      id,
      index,
      sequence,
      phase: motionRef.current.phase,
      hasHandle: cardHandlesRef.current.has(id),
      scroll: carousel.currentScroll.current,
    })
    if (index < 0) return

    await carousel.centerItem(index)
    // Scroll refs update immediately; slot meshes only update in useFrame.
    // Sync now so open-pose worldToLocal uses the centered parent matrix.
    clotheslineRef.current?.syncSlotsToScroll()
    console.log('[pub-debug] centerItem done', {
      id,
      sequence,
      sequenceNow: sequenceRef.current,
      phase: motionRef.current.phase,
      scroll: carousel.currentScroll.current,
    })
    if (sequence !== sequenceRef.current) {
      console.warn('[pub-debug] aborted after center: sequence mismatch')
      return
    }

    const phase = motionRef.current.phase
    if (phase === 'hanging') {
      sendMotion({ type: 'CLICK', id })
      console.log('[pub-debug] motion CLICK', motionRef.current)
    } else if (
      phase !== 'centering'
      || motionRef.current.selectedId !== id
    ) {
      console.warn('[pub-debug] aborted after center: unexpected phase', {
        phase,
        selectedId: motionRef.current.selectedId,
        id,
      })
      return
    }
    sendMotion({ type: 'CENTERED' })
    sendMotion({ type: 'DETACHED' })
    // Freeze parent at the synced slot before resolving the camera pose.
    clotheslineRef.current?.syncSlotsToScroll()
    const handle = cardHandlesRef.current.get(id)
    console.log('[pub-debug] before open()', {
      hasHandle: !!handle,
      handleKeys: [...cardHandlesRef.current.keys()],
      phase: motionRef.current.phase,
    })
    if (!handle) {
      console.error('[pub-debug] NO CARD HANDLE — open skipped')
      return
    }
    await handle.open()
    console.log('[pub-debug] open() resolved', {
      sequence,
      sequenceNow: sequenceRef.current,
      phase: motionRef.current.phase,
    })
    if (sequence !== sequenceRef.current) {
      console.warn('[pub-debug] aborted after open: sequence mismatch')
      return
    }
    sendMotion({ type: 'FLIPPED' })
    console.log('[pub-debug] motion FLIPPED →', motionRef.current)
  }, [carousel, publications, sendMotion])

  const handleSelect = useCallback(async (id: string): Promise<void> => {
    const current = motionRef.current
    console.log('[pub-debug] handleSelect', { id, phase: current.phase, selectedId: current.selectedId })
    if (current.phase !== 'hanging' && current.phase !== 'open') {
      console.warn('[pub-debug] handleSelect ignored: bad phase', current.phase)
      return
    }

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

    console.warn('[pub-debug] ROOM CANCEL effect', {
      showRoom,
      isExiting,
      teleportActive,
      phase: motionRef.current.phase,
    })
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
          ref={clotheslineRef}
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
