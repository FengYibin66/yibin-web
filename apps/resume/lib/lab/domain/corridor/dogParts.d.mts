export type DogSidePart = 'body' | 'head' | 'leg-front' | 'leg-back' | 'tail'

export interface DogPartDecl {
  readonly pivot: readonly [number, number]
}

export const DOG_SIDE_PARTS: Readonly<Record<DogSidePart, DogPartDecl>>
export const DOG_SIT_PART: DogPartDecl
export const DOG_SIDE_FOOT_V: number
export const DOG_SIT_FOOT_V: number
export const DOG_PART_FILES: Readonly<Record<DogSidePart | 'sit', string>>
