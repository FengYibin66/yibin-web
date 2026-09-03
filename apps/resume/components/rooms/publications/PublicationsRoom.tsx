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

import { pushEscapeConsumer } from '@/lib/lab/app/escapeStack'
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
  useRoomTutorial(PUBLICATION_TUTORIAL_ID, 'publications')
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
    if (index < 0) return

    await carousel.centerItem(index)
    // Scroll refs update immediately; slot meshes only update in useFrame.
    // Sync now so open-pose worldToLocal uses the centered parent matrix.
    clotheslineRef.current?.syncSlotsToScroll()
    if (sequence !== sequenceRef.current) {
      return
    }

    const phase = motionRef.current.phase
    if (phase === 'hanging') {
      sendMotion({ type: 'CLICK', id })
    } else if (
      phase !== 'centering'
      || motionRef.current.selectedId !== id
    ) {
      return
    }
    sendMotion({ type: 'CENTERED' })
    sendMotion({ type: 'DETACHED' })
    // Freeze parent at the synced slot before resolving the camera pose.
    clotheslineRef.current?.syncSlotsToScroll()
    const handle = cardHandlesRef.current.get(id)
    if (!handle) {
      return
    }
    await handle.open()
    if (sequence !== sequenceRef.current) {
      return
    }
    sendMotion({ type: 'FLIPPED' })
  }, [carousel, publications, sendMotion])

  const handleSelect = useCallback(async (id: string): Promise<void> => {
    const current = motionRef.current
    if (current.phase !== 'hanging' && current.phase !== 'open') {
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

  /*
    打开单篇时认领 ESC（ADR 20260903211244）。

    `escapeStack` 的文档注释里一直写着「Publications 房间的『打开单篇』是同一类
    冲突，可以直接复用」——但这一处从未接上，于是打开单篇后按 ESC 会**直接退出
    整个房间**，而在 Projects 房间里同一个键是「先收回停靠」。同一个键在相邻两间
    房里语义不同，且不是有意设计的。

    只在 `open` 相位认领：`centering` / `hanging` 这些过渡相位里按 ESC 该照常退房，
    否则动画期间这个键会变成没反应。
  */
  const isPublicationOpen = motion.phase === 'open'
  useEffect(() => {
    if (!isPublicationOpen) return
    return pushEscapeConsumer(() => sendMotion({ type: 'CANCEL' }))
  }, [isPublicationOpen, sendMotion])

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
