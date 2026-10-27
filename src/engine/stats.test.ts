import { describe, it, expect } from 'vitest'
import { rankOf, titleOf, progressOf, rankEvents, type StatPoints, type Rank, type Stat } from './stats'

const totals = (p: Partial<StatPoints> = {}): StatPoints => ({
  charm: 0,
  courage: 0,
  intelligence: 0,
  proficiency: 0,
  ...p,
})

describe('rankOf: thresholds 60 / 200 / 500 / 1000', () => {
  it.each([
    [0, 1],
    [59, 1],
    [60, 2],
    [199, 2],
    [200, 3],
    [499, 3],
    [500, 4],
    [999, 4],
    [1000, 5],
  ])('%i points is rank %i', (points, rank) => {
    expect(rankOf(points)).toBe(rank)
  })
})

describe('titleOf: every stat has five titles', () => {
  const table: Record<Stat, string[]> = {
    charm: ['Plain', 'Pleasant', 'Likable', 'Magnetic', 'Radiant'],
    courage: ['Timid', 'Steady', 'Bold', 'Fearless', 'Unshakable'],
    intelligence: ['Average', 'Sharp', 'Scholar', 'Brilliant', 'Genius'],
    proficiency: ['Clumsy', 'Handy', 'Skilled', 'Expert', 'Master'],
  }
  for (const [stat, titles] of Object.entries(table) as [Stat, string[]][]) {
    titles.forEach((title, i) => {
      it(`${stat} rank ${i + 1} is ${title}`, () => {
        expect(titleOf(stat, (i + 1) as Rank)).toBe(title)
      })
    })
  }
})

describe('progressOf: bar toward the next rank', () => {
  it('starts empty at 0', () => {
    expect(progressOf(0)).toEqual({ earned: 0, needed: 60 })
  })
  it('measures from the current rank, not from 0', () => {
    // Rank 2 spans 60..200, so 130 is 70 of 140.
    expect(progressOf(130)).toEqual({ earned: 70, needed: 140 })
  })
  it('resets at a threshold', () => {
    expect(progressOf(500)).toEqual({ earned: 0, needed: 500 })
  })
  it('is null once graduated', () => {
    expect(progressOf(1000)).toBeNull()
  })
})

describe('rankEvents (rule 8)', () => {
  it('reports nothing when no threshold is crossed', () => {
    expect(rankEvents(totals({ courage: 10 }), totals({ courage: 59 }))).toEqual([])
  })

  it('reports a rank-up with old and new titles when 60 is crossed', () => {
    expect(rankEvents(totals({ courage: 55 }), totals({ courage: 65 }))).toEqual([
      { type: 'rankUp', stat: 'courage', fromRank: 1, toRank: 2, fromTitle: 'Timid', toTitle: 'Steady' },
    ])
  })

  it('reports a rank-up when landing exactly on a threshold', () => {
    expect(rankEvents(totals({ charm: 199 }), totals({ charm: 200 }))).toEqual([
      { type: 'rankUp', stat: 'charm', fromRank: 2, toRank: 3, fromTitle: 'Pleasant', toTitle: 'Likable' },
    ])
  })

  it('reports one event old → new when two thresholds are crossed at once', () => {
    expect(rankEvents(totals({ courage: 55 }), totals({ courage: 205 }))).toEqual([
      { type: 'rankUp', stat: 'courage', fromRank: 1, toRank: 3, fromTitle: 'Timid', toTitle: 'Bold' },
    ])
  })

  it('reports only a rank-up when one stat reaches 1000 (no graduation yet)', () => {
    expect(rankEvents(totals({ intelligence: 990 }), totals({ intelligence: 1000 }))).toEqual([
      { type: 'rankUp', stat: 'intelligence', fromRank: 4, toRank: 5, fromTitle: 'Brilliant', toTitle: 'Genius' },
    ])
  })

  it('reports rank-up then graduation when the last stat reaches 1000', () => {
    const before = totals({ charm: 1000, courage: 1000, intelligence: 990, proficiency: 1000 })
    const after = totals({ charm: 1000, courage: 1000, intelligence: 1000, proficiency: 1000 })
    expect(rankEvents(before, after)).toEqual([
      { type: 'rankUp', stat: 'intelligence', fromRank: 4, toRank: 5, fromTitle: 'Brilliant', toTitle: 'Genius' },
      { type: 'graduated' },
    ])
  })

  it('reports a rank-down when a delete drops below a threshold', () => {
    expect(rankEvents(totals({ courage: 205 }), totals({ courage: 195 }))).toEqual([
      { type: 'rankDown', stat: 'courage', fromRank: 3, toRank: 2, fromTitle: 'Bold', toTitle: 'Steady' },
    ])
  })

  it('reports only a rank-down when one maxed stat drops below 1000', () => {
    expect(rankEvents(totals({ charm: 1000 }), totals({ charm: 998 }))).toEqual([
      { type: 'rankDown', stat: 'charm', fromRank: 5, toRank: 4, fromTitle: 'Radiant', toTitle: 'Magnetic' },
    ])
  })

  it('reports rank-down then un-graduation when a delete breaks all-four-maxed', () => {
    const before = totals({ charm: 1000, courage: 1000, intelligence: 1000, proficiency: 1000 })
    const after = totals({ charm: 998, courage: 1000, intelligence: 1000, proficiency: 1000 })
    expect(rankEvents(before, after)).toEqual([
      { type: 'rankDown', stat: 'charm', fromRank: 5, toRank: 4, fromTitle: 'Radiant', toTitle: 'Magnetic' },
      { type: 'ungraduated' },
    ])
  })

  it('lists several stats in charm, courage, intelligence, proficiency order', () => {
    const events = rankEvents(
      totals({ proficiency: 59, charm: 59 }),
      totals({ proficiency: 60, charm: 60 }),
    )
    expect(events).toEqual([
      { type: 'rankUp', stat: 'charm', fromRank: 1, toRank: 2, fromTitle: 'Plain', toTitle: 'Pleasant' },
      { type: 'rankUp', stat: 'proficiency', fromRank: 1, toRank: 2, fromTitle: 'Clumsy', toTitle: 'Handy' },
    ])
  })
})
