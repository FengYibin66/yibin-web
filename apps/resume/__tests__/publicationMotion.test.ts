import { describe, expect, it } from 'vitest'

import {
  INITIAL_PUBLICATION_MOTION_STATE,
  canBrowse,
  publicationMotionReducer,
  type CardMotionPhase,
  type PublicationMotionEvent,
  type PublicationMotionState,
} from '@/components/rooms/publications/publicationMotionMachine'

const CARD_MOTION_PHASES: CardMotionPhase[] = [
  'hanging',
  'centering',
  'detaching',
  'flipping',
  'open',
  'returning',
]

const PUBLICATION_MOTION_EVENTS: PublicationMotionEvent[] = [
  { type: 'CLICK', id: 'publication-b' },
  { type: 'CENTERED' },
  { type: 'DETACHED' },
  { type: 'FLIPPED' },
  { type: 'RETURNED' },
]

const LEGAL_EVENT_TYPES: Record<
  CardMotionPhase,
  readonly PublicationMotionEvent['type'][]
> = {
  hanging: ['CLICK'],
  centering: ['CENTERED'],
  detaching: ['DETACHED'],
  flipping: ['FLIPPED'],
  open: ['CLICK'],
  returning: ['RETURNED'],
}

function createStateForPhase(phase: CardMotionPhase): PublicationMotionState {
  if (phase === 'hanging') {
    return INITIAL_PUBLICATION_MOTION_STATE
  }

  return {
    phase,
    selectedId: 'publication-a',
    pendingId: phase === 'returning' ? 'publication-b' : null,
  }
}

const INVALID_TRANSITIONS = CARD_MOTION_PHASES.flatMap(phase =>
  PUBLICATION_MOTION_EVENTS.filter(
    event => !LEGAL_EVENT_TYPES[phase].includes(event.type),
  ).map(event => [phase, event] as const),
)

describe('publicationMotionReducer', () => {
  it('starts from the exact hanging state', () => {
    expect(INITIAL_PUBLICATION_MOTION_STATE).toEqual({
      phase: 'hanging',
      selectedId: null,
      pendingId: null,
    })
  })

  it('moves through the complete card opening chain', () => {
    const centering = publicationMotionReducer(
      INITIAL_PUBLICATION_MOTION_STATE,
      { type: 'CLICK', id: 'publication-a' },
    )
    expect(centering).toEqual({
      phase: 'centering',
      selectedId: 'publication-a',
      pendingId: null,
    })

    const detaching = publicationMotionReducer(centering, {
      type: 'CENTERED',
    })
    expect(detaching).toEqual({ ...centering, phase: 'detaching' })

    const flipping = publicationMotionReducer(detaching, {
      type: 'DETACHED',
    })
    expect(flipping).toEqual({ ...detaching, phase: 'flipping' })

    const open = publicationMotionReducer(flipping, { type: 'FLIPPED' })
    expect(open).toEqual({ ...flipping, phase: 'open' })
  })

  it('returns the open card when the same card is clicked', () => {
    const open: PublicationMotionState = {
      phase: 'open',
      selectedId: 'publication-a',
      pendingId: null,
    }

    expect(
      publicationMotionReducer(open, {
        type: 'CLICK',
        id: 'publication-a',
      }),
    ).toEqual({
      phase: 'returning',
      selectedId: 'publication-a',
      pendingId: null,
    })
  })

  it('queues another card while returning the open card', () => {
    const open: PublicationMotionState = {
      phase: 'open',
      selectedId: 'publication-a',
      pendingId: null,
    }

    expect(
      publicationMotionReducer(open, {
        type: 'CLICK',
        id: 'publication-b',
      }),
    ).toEqual({
      phase: 'returning',
      selectedId: 'publication-a',
      pendingId: 'publication-b',
    })
  })

  it('centers the queued card after the current card returns', () => {
    const returning: PublicationMotionState = {
      phase: 'returning',
      selectedId: 'publication-a',
      pendingId: 'publication-b',
    }

    expect(publicationMotionReducer(returning, { type: 'RETURNED' })).toEqual({
      phase: 'centering',
      selectedId: 'publication-b',
      pendingId: null,
    })
  })

  it('settles to hanging when a card returns without a queued card', () => {
    const returning: PublicationMotionState = {
      phase: 'returning',
      selectedId: 'publication-a',
      pendingId: null,
    }

    expect(
      publicationMotionReducer(returning, { type: 'RETURNED' }),
    ).toEqual(INITIAL_PUBLICATION_MOTION_STATE)
  })

  it.each(CARD_MOTION_PHASES)(
    'cancels safely and idempotently from %s',
    phase => {
      const cancelled = publicationMotionReducer(createStateForPhase(phase), {
        type: 'CANCEL',
      })

      expect(cancelled).toEqual(INITIAL_PUBLICATION_MOTION_STATE)
      expect(
        publicationMotionReducer(cancelled, { type: 'CANCEL' }),
      ).toEqual(INITIAL_PUBLICATION_MOTION_STATE)
    },
  )

  it.each(CARD_MOTION_PHASES)(
    'fails fast for an empty publication id from %s',
    phase => {
      expect(() =>
        publicationMotionReducer(createStateForPhase(phase), {
          type: 'CLICK',
          id: '',
        }),
      ).toThrow(/publication id.*empty/i)
    },
  )

  it.each(INVALID_TRANSITIONS)(
    'rejects an invalid transition from %s via $type',
    (phase, event) => {
      expect(() =>
        publicationMotionReducer(createStateForPhase(phase), event),
      ).toThrow(
        new RegExp(
          `invalid publication motion transition.*${phase}.*${event.type}`,
          'i',
        ),
      )
    },
  )
})

describe('canBrowse', () => {
  it('allows browsing only while hanging without a selection', () => {
    expect(canBrowse(INITIAL_PUBLICATION_MOTION_STATE)).toBe(true)

    for (const phase of CARD_MOTION_PHASES.filter(
      candidate => candidate !== 'hanging',
    )) {
      expect(canBrowse(createStateForPhase(phase))).toBe(false)
    }

    expect(
      canBrowse({
        phase: 'hanging',
        selectedId: 'publication-a',
        pendingId: null,
      }),
    ).toBe(false)
  })
})
