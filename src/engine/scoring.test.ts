import { describe, it, expect } from 'vitest'
import { dailyPoints, localDay, scoreDay, type Session, type Weights } from './scoring'
import type { StatPoints } from './stats'

const morning = (p: Partial<StatPoints> = {}): StatPoints => ({
  charm: 0,
  courage: 0,
  intelligence: 0,
  proficiency: 0,
  ...p,
})

const weights: Record<string, Weights> = {
  boxing: { courage: 70, charm: 30 }, // the SPEC worked example
  study: { intelligence: 100 },
  languages: { charm: 50, intelligence: 50 },
  speech: { charm: 50, courage: 25, intelligence: 25 },
  debate: { charm: 20, courage: 50, intelligence: 30 },
}

let nextId = 0
const s = (habitId: string, minutes: number): Session => ({ id: `s${nextId++}`, habitId, minutes })

describe('rule 1: timed only, whole minutes ≥ 1', () => {
  it.each([0, -5, 2.5])('rejects %s minutes', (minutes) => {
    expect(() => scoreDay(morning(), [s('study', minutes)], weights)).toThrow(/whole number/)
  })

  it('accepts exactly 1440 minutes in a day', () => {
    expect(() => scoreDay(morning(), [s('study', 1440)], weights)).not.toThrow()
  })

  it('rejects a day over 1440 minutes, counted across all habits', () => {
    expect(() => scoreDay(morning(), [s('study', 1000), s('boxing', 441)], weights)).toThrow(/1440/)
  })

  it('rejects a session for an unknown habit', () => {
    expect(() => scoreDay(morning(), [s('nope', 10)], weights)).toThrow(/unknown habit/)
  })
})

describe('rule 2: a day is midnight to midnight, local time', () => {
  it('23:59 and 00:00 are different days', () => {
    expect(localDay(new Date(2026, 9, 27, 23, 59))).toBe('2026-10-27')
    expect(localDay(new Date(2026, 9, 28, 0, 0))).toBe('2026-10-28')
  })
})

describe('rule 3: daily points = 2 base + 1 per full 10 minutes', () => {
  it.each([
    [1, 2],
    [9, 2],
    [10, 3],
    [25, 4],
    [45, 6],
    [600, 62], // no cap
  ])('%i min → %i points', (minutes, points) => {
    expect(dailyPoints(minutes)).toBe(points)
  })

  it('adds up sessions of the same habit: 5 + 5 min = 3 points', () => {
    const { awards } = scoreDay(morning(), [s('study', 5), s('study', 5)], weights)
    expect(awards).toEqual({ study: { intelligence: 3 } })
  })
})

describe('rule 4: split by weight, rounded up', () => {
  it('boxing 25 min → Courage ceil(2.8)=3, Charm ceil(1.2)=2', () => {
    const { awards } = scoreDay(morning(), [s('boxing', 25)], weights)
    expect(awards).toEqual({ boxing: { courage: 3, charm: 2 } })
  })

  it('a single-stat habit gets all the points', () => {
    const { awards } = scoreDay(morning(), [s('study', 25)], weights)
    expect(awards).toEqual({ study: { intelligence: 4 } })
  })

  it('an even split needs no rounding', () => {
    const { awards } = scoreDay(morning(), [s('languages', 25)], weights)
    expect(awards).toEqual({ languages: { charm: 2, intelligence: 2 } })
  })
})

describe('rule 5: recalculate, then pay the difference', () => {
  it('SPEC example: 25 min then 20 min → +3/+2, then +2/+0', () => {
    const first = scoreDay(morning(), [s('boxing', 25)], weights)
    expect(first.totals).toEqual(morning({ courage: 3, charm: 2 }))

    const second = scoreDay(morning(), [s('boxing', 25), s('boxing', 20)], weights)
    expect(second.totals).toEqual(morning({ courage: 5, charm: 2 }))
  })

  it('split sessions score the same as one long one', () => {
    const split = scoreDay(morning(), [s('boxing', 25), s('boxing', 20)], weights)
    const long = scoreDay(morning(), [s('boxing', 45)], weights)
    expect(split.awards).toEqual(long.awards)
  })
})

describe('rule 6: redirect from maxed stats', () => {
  it('SPEC example: Charm maxed before the day → Courage takes 100%', () => {
    const first = scoreDay(morning({ charm: 1000 }), [s('boxing', 25)], weights)
    expect(first.awards).toEqual({ boxing: { courage: 4 } })

    const second = scoreDay(morning({ charm: 1000 }), [s('boxing', 25), s('boxing', 20)], weights)
    expect(second.awards).toEqual({ boxing: { courage: 6 } })
  })

  it('SPEC example: Charm maxed during session 1 → session 2 pays Courage +3, Charm keeps its 2', () => {
    const first = scoreDay(morning({ charm: 998 }), [s('boxing', 25)], weights)
    expect(first.awards).toEqual({ boxing: { courage: 3, charm: 2 } })
    expect(first.totals.charm).toBe(1000)

    const second = scoreDay(morning({ charm: 998 }), [s('boxing', 25), s('boxing', 20)], weights)
    expect(second.awards).toEqual({ boxing: { courage: 6, charm: 2 } })
  })

  it('redirects in proportion to the remaining weights', () => {
    // debate 20/50/30 with Charm maxed → Courage 50/80, Intelligence 30/80 of 6 points.
    const { awards } = scoreDay(morning({ charm: 1000 }), [s('debate', 45)], weights)
    expect(awards).toEqual({ debate: { courage: 4, intelligence: 3 } }) // ceil(3.75), ceil(2.25)
  })

  it('earns nothing when all its stats are maxed, but the session is still accepted', () => {
    const start = morning({ charm: 1000, courage: 1000 })
    const result = scoreDay(start, [s('boxing', 25)], weights)
    expect(result.awards).toEqual({})
    expect(result.totals).toEqual(start)
  })
})

describe('rule 7: max 1000, overflow redirects', () => {
  it('Charm at 999 takes 1; the extra point goes to Courage', () => {
    const { awards, totals } = scoreDay(morning({ charm: 999 }), [s('boxing', 25)], weights)
    expect(awards).toEqual({ boxing: { charm: 1, courage: 4 } })
    expect(totals.charm).toBe(1000)
  })

  it('overflow counts as paid: a later session only pays the difference', () => {
    // Session 1: Courage 3 + 1 overflow = 4. Session 2: 6 pts, Charm maxed → Courage target 6, paid 4 → +2.
    const { awards } = scoreDay(morning({ charm: 999 }), [s('boxing', 25), s('boxing', 20)], weights)
    expect(awards).toEqual({ boxing: { charm: 1, courage: 6 } })
  })

  it('overflow split across several stats rounds each part up', () => {
    // speech 100 min = 12 pts → Charm 6, Courage 3, Intelligence 3.
    // Charm takes 3 (997 → 1000); 3 overflow split 25:25 → ceil(1.5) = 2 each.
    const { awards } = scoreDay(morning({ charm: 997 }), [s('speech', 100)], weights)
    expect(awards).toEqual({ speech: { charm: 3, courage: 5, intelligence: 5 } })
  })

  it('overflow keeps moving when the next stat also maxes', () => {
    // Charm takes 3 of 6, Courage takes 1 of 3 → 5 overflow, all to Intelligence.
    const { awards, totals } = scoreDay(morning({ charm: 997, courage: 999 }), [s('speech', 100)], weights)
    expect(awards).toEqual({ speech: { charm: 3, courage: 1, intelligence: 8 } })
    expect(totals).toEqual(morning({ charm: 1000, courage: 1000, intelligence: 8 }))
  })

  it('overflow is dropped when every other stat is maxed', () => {
    const { awards, totals } = scoreDay(morning({ charm: 999, courage: 1000 }), [s('boxing', 25)], weights)
    expect(awards).toEqual({ boxing: { charm: 1 } })
    expect(totals).toEqual(morning({ charm: 1000, courage: 1000 }))
  })

  it('never goes above 1000, however long the day', () => {
    const { totals } = scoreDay(morning({ intelligence: 990 }), [s('study', 1440)], weights)
    expect(totals.intelligence).toBe(1000)
  })

  it('earlier sessions of other habits fill a stat first (logged order)', () => {
    const { awards } = scoreDay(morning({ charm: 999 }), [s('languages', 25), s('boxing', 25)], weights)
    expect(awards).toEqual({
      languages: { charm: 1, intelligence: 3 },
      boxing: { courage: 4 },
    })
  })
})

describe('corrections: edit or delete replays today', () => {
  it('deleting a session gives the same day as if it was never logged', () => {
    // Charm 998: sessions 25 + 20 → Courage 6, Charm 2. Delete the 20.
    const { awards, totals } = scoreDay(morning({ charm: 998 }), [s('boxing', 25)], weights)
    expect(awards).toEqual({ boxing: { courage: 3, charm: 2 } })
    expect(totals).toEqual(morning({ charm: 1000, courage: 3 }))
  })

  it('editing minutes recomputes the day: 25 + 5 min = 30 min = 5 pts', () => {
    const { awards } = scoreDay(morning(), [s('boxing', 25), s('boxing', 5)], weights)
    expect(awards).toEqual({ boxing: { courage: 4, charm: 2 } }) // ceil(3.5), ceil(1.5)
  })

  it('deleting every session of a habit takes all its points back', () => {
    const { awards, totals } = scoreDay(morning({ courage: 40 }), [], weights)
    expect(awards).toEqual({})
    expect(totals).toEqual(morning({ courage: 40 }))
  })
})
