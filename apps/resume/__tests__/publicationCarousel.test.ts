import { afterEach, describe, expect, it } from 'vitest'
import {
  applyCarouselDelta,
  getNearestCarouselTarget,
  wrapDisplayOffset,
} from '@/components/rooms/publications/publicationCarouselMath'
import {
  PUBLICATION_CAROUSEL_ITEM_GAP,
  PUBLICATION_CAROUSEL_WHEEL_SENSITIVITY,
} from '@/components/rooms/publications/publicationConstants'

const ORIGINAL_VIEWPORT_WIDTH = window.innerWidth

describe('publication carousel math', () => {
  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: ORIGINAL_VIEWPORT_WIDTH,
    })
  })

  describe('wrapDisplayOffset', () => {
    it.each([
      [7, 12, -5],
      [19, 12, -5],
      [-7, 12, 5],
      [-19, 12, 5],
    ])('wraps offset %s within width %s to %s', (rawOffset, totalWidth, expected) => {
      expect(wrapDisplayOffset(rawOffset, totalWidth)).toBe(expected)
    })

    it.each([
      [0, 0],
      [0, -1],
      [Number.NaN, 10],
      [Number.POSITIVE_INFINITY, 10],
      [0, Number.NEGATIVE_INFINITY],
    ])('rejects invalid offsets or widths', (rawOffset, totalWidth) => {
      expect(() => wrapDisplayOffset(rawOffset, totalWidth)).toThrow(RangeError)
    })
  })

  describe('getNearestCarouselTarget', () => {
    it('crosses the last-to-first boundary by the shortest path', () => {
      expect(
        getNearestCarouselTarget(
          9.5,
          0,
          PUBLICATION_CAROUSEL_ITEM_GAP,
          4,
        ),
      ).toBe(10)
    })

    it('crosses the first-to-last boundary by the shortest path', () => {
      expect(
        getNearestCarouselTarget(
          0.5,
          3,
          PUBLICATION_CAROUSEL_ITEM_GAP,
          4,
        ),
      ).toBe(-PUBLICATION_CAROUSEL_ITEM_GAP)
    })

    it('rejects an empty carousel', () => {
      expect(() =>
        getNearestCarouselTarget(0, 0, PUBLICATION_CAROUSEL_ITEM_GAP, 0),
      ).toThrow(RangeError)
    })

    it.each([
      [Number.NaN, 0, 2.5, 4],
      [0, Number.POSITIVE_INFINITY, 2.5, 4],
      [0, 0, 0, 4],
      [0, 0, Number.NEGATIVE_INFINITY, 4],
      [0, 0, 2.5, Number.NaN],
      [0, 0, Number.MAX_VALUE, Number.MAX_VALUE],
    ])(
      'rejects invalid target parameters',
      (current, targetIndex, itemGap, itemCount) => {
        expect(() =>
          getNearestCarouselTarget(current, targetIndex, itemGap, itemCount),
        ).toThrow(RangeError)
      },
    )

    it.each([320, 768, 1440])(
      'does not depend on viewport width %s',
      viewportWidth => {
        Object.defineProperty(window, 'innerWidth', {
          configurable: true,
          value: viewportWidth,
        })

        expect(
          getNearestCarouselTarget(
            9.5,
            0,
            PUBLICATION_CAROUSEL_ITEM_GAP,
            4,
          ),
        ).toBe(10)
      },
    )
  })

  describe('applyCarouselDelta', () => {
    it('adds consecutive deltas without losing prior movement', () => {
      const firstTarget = applyCarouselDelta(
        1,
        120,
        PUBLICATION_CAROUSEL_WHEEL_SENSITIVITY,
      )
      const secondTarget = applyCarouselDelta(
        firstTarget,
        -20,
        PUBLICATION_CAROUSEL_WHEEL_SENSITIVITY,
      )

      expect(firstTarget).toBeCloseTo(1.6)
      expect(secondTarget).toBeCloseTo(1.5)
    })

    it.each([
      [Number.NaN, 1, 1],
      [0, Number.POSITIVE_INFINITY, 1],
      [0, 1, Number.NEGATIVE_INFINITY],
    ])(
      'rejects non-finite delta parameters',
      (currentTarget, delta, sensitivity) => {
        expect(() =>
          applyCarouselDelta(currentTarget, delta, sensitivity),
        ).toThrow(RangeError)
      },
    )
  })
})
