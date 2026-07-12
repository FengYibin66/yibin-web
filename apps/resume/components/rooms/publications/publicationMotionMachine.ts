export type CardMotionPhase =
  | 'hanging'
  | 'centering'
  | 'detaching'
  | 'flipping'
  | 'open'
  | 'returning'

export interface PublicationMotionState {
  selectedId: string | null
  pendingId: string | null
  phase: CardMotionPhase
}

export type PublicationMotionEvent =
  | { type: 'CLICK'; id: string }
  | { type: 'CENTERED' }
  | { type: 'DETACHED' }
  | { type: 'FLIPPED' }
  | { type: 'RETURNED' }
  | { type: 'CANCEL' }

export const INITIAL_PUBLICATION_MOTION_STATE: PublicationMotionState = {
  selectedId: null,
  pendingId: null,
  phase: 'hanging',
}

export function canBrowse(state: PublicationMotionState): boolean {
  return state.phase === 'hanging' && state.selectedId === null
}

function invalidTransition(
  state: PublicationMotionState,
  event: PublicationMotionEvent,
): never {
  throw new Error(
    `Invalid publication motion transition from ${state.phase} via ${event.type}`,
  )
}

function transitionFromOpen(
  state: PublicationMotionState,
  event: PublicationMotionEvent,
): PublicationMotionState {
  if (event.type !== 'CLICK') {
    return invalidTransition(state, event)
  }

  return {
    phase: 'returning',
    selectedId: state.selectedId,
    pendingId: event.id === state.selectedId ? null : event.id,
  }
}

function transitionFromReturning(
  state: PublicationMotionState,
  event: PublicationMotionEvent,
): PublicationMotionState {
  if (event.type !== 'RETURNED') {
    return invalidTransition(state, event)
  }
  if (state.pendingId === null) {
    return INITIAL_PUBLICATION_MOTION_STATE
  }

  return {
    phase: 'centering',
    selectedId: state.pendingId,
    pendingId: null,
  }
}

export function publicationMotionReducer(
  state: PublicationMotionState,
  event: PublicationMotionEvent,
): PublicationMotionState {
  if (event.type === 'CLICK' && event.id.length === 0) {
    throw new RangeError('Publication id cannot be empty')
  }
  if (event.type === 'CANCEL') {
    return INITIAL_PUBLICATION_MOTION_STATE
  }
  if (state.phase === 'hanging' && event.type === 'CLICK') {
    return { phase: 'centering', selectedId: event.id, pendingId: null }
  }
  if (state.phase === 'centering' && event.type === 'CENTERED') {
    return { ...state, phase: 'detaching' }
  }
  if (state.phase === 'detaching' && event.type === 'DETACHED') {
    return { ...state, phase: 'flipping' }
  }
  if (state.phase === 'flipping' && event.type === 'FLIPPED') {
    return { ...state, phase: 'open' }
  }
  if (state.phase === 'open') {
    return transitionFromOpen(state, event)
  }
  if (state.phase === 'returning') {
    return transitionFromReturning(state, event)
  }

  return invalidTransition(state, event)
}
