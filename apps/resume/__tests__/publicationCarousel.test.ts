import { describe, expect, it } from 'vitest'
import {
  applyCarouselDelta,
  getNearestCarouselTarget,
  wrapDisplayOffset,
} from '@/components/rooms/publications/publicationCarouselMath'
import {
  PUBLICATION_CAROUSEL_ITEM_GAP,
  PUBLICATION_CAROUSEL_WHEEL_SENSITIVITY,
} from '@/components/rooms/publications/publicationConstants'

describe('publication carousel math', () => {
  describe('wrapDisplayOffset', () => {
    it.each([
      [7, 12, -5],
      [19, 12, -5],
      [-7, 12, 5],
      [-19, 12, 5],
    ])('wraps offset %s within width %s to %s', (rawOffset, totalWidth, expected) => {
      expect(wrapDisplayOffset(rawOffset, totalWidth)).toBe(expected)
    })

    it('chooses the negative half-period for exact ties', () => {
      expect(wrapDisplayOffset(5, 10)).toBe(-5)
      expect(wrapDisplayOffset(-5, 10)).toBe(-5)
    })

    it('avoids overflow while wrapping maximum finite values', () => {
      expect(wrapDisplayOffset(Number.MAX_VALUE, Number.MAX_VALUE)).toBe(0)
    })

    it('preserves zero when half of the smallest period underflows', () => {
      expect(wrapDisplayOffset(0, Number.MIN_VALUE)).toBe(0)
    })

    it('preserves a negative subnormal remainder with a huge period', () => {
      expect(
        wrapDisplayOffset(-Number.MIN_VALUE, Number.MAX_VALUE),
      ).toBe(-Number.MIN_VALUE)
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
      [4.5, 0],
      [Number.NaN, 0],
      [4, 1.5],
      [4, Number.POSITIVE_INFINITY],
    ])(
      'rejects non-integer itemCount %s or targetIndex %s',
      (itemCount, targetIndex) => {
        expect(() =>
          getNearestCarouselTarget(
            0,
            targetIndex,
            PUBLICATION_CAROUSEL_ITEM_GAP,
            itemCount,
          ),
        ).toThrow(RangeError)
      },
    )

    it.each([5, -3, 9, -7])(
      'normalizes out-of-range target index %s before scaling',
      targetIndex => {
        expect(
          getNearestCarouselTarget(
            0,
            targetIndex,
            PUBLICATION_CAROUSEL_ITEM_GAP,
            4,
          ),
        ).toBe(PUBLICATION_CAROUSEL_ITEM_GAP)
      },
    )

    it('normalizes an extreme target index before multiplying itemGap', () => {
      const normalizedIndex = Number.MAX_VALUE % 3
      const totalWidth = 6
      const normalizedTarget = normalizedIndex * 2

      expect(getNearestCarouselTarget(0, Number.MAX_VALUE, 2, 3)).toBe(
        wrapDisplayOffset(normalizedTarget, totalWidth),
      )
    })

    it.each([
      [100.5, 0, 100],
      [-100.5, 0, -100],
      [107.5, 1, 102.5],
      [-107.5, -1, -112.5],
    ])(
      'finds the nearest target across multiple current cycles',
      (current, targetIndex, expected) => {
        expect(
          getNearestCarouselTarget(
            current,
            targetIndex,
            PUBLICATION_CAROUSEL_ITEM_GAP,
            4,
          ),
        ).toBe(expected)
      },
    )

    it('chooses the negative direction for an exact half-period tie', () => {
      expect(getNearestCarouselTarget(0, 2, 2.5, 4)).toBe(-5)
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

    it.each([
      [37.5, 5],
      [-42.5, -3],
      [109.5, 9],
      [-109.5, -7],
    ])(
      'returns a cycle-equivalent target within half a period',
      (current, targetIndex) => {
        const itemGap = PUBLICATION_CAROUSEL_ITEM_GAP
        const itemCount = 4
        const totalWidth = itemGap * itemCount
        const normalizedIndex =
          ((targetIndex % itemCount) + itemCount) % itemCount
        const normalizedTarget = normalizedIndex * itemGap
        const nearestTarget = getNearestCarouselTarget(
          current,
          targetIndex,
          itemGap,
          itemCount,
        )

        expect(Math.abs(nearestTarget - current)).toBeLessThanOrEqual(
          totalWidth / 2,
        )
        expect(
          wrapDisplayOffset(nearestTarget - normalizedTarget, totalWidth),
        ).toBeCloseTo(0)
      },
    )

    it('fails fast when the nearest representable target overflows', () => {
      expect(() =>
        getNearestCarouselTarget(
          Number.MAX_VALUE,
          0,
          Number.MAX_VALUE * 0.6,
          1,
        ),
      ).toThrow(RangeError)
    })

    it('fails fast when a finite nearest delta is swallowed by addition', () => {
      expect(() =>
        getNearestCarouselTarget(Number.MAX_VALUE, 0, 2, 3),
      ).toThrow(RangeError)
    })

    it('accepts representable movement from a normal fractional current', () => {
      expect(getNearestCarouselTarget(0.35, 0, 0.1, 4)).toBeCloseTo(0.4)
    })
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
      [Number.MAX_VALUE, Number.MAX_VALUE, 2],
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
