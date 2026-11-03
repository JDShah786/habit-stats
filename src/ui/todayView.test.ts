import { describe, expect, it } from 'vitest'
import type { StatPoints } from '../engine/stats'
import { listOrder, nearestRank } from './todayView'

const points = (p: Partial<StatPoints>): StatPoints => ({ charm: 0, courage: 0, intelligence: 0, proficiency: 0, ...p })

describe('nearest rank', () => {
  it('picks the stat with the fewest points left to its next rank', () => {
    expect(nearestRank(points({ courage: 58, intelligence: 495 }))).toEqual({ stat: 'courage', toRank: 2, pointsLeft: 2 })
  })

  it('compares across ranks by points left, not by rank', () => {
    expect(nearestRank(points({ charm: 30, intelligence: 495 }))).toEqual({ stat: 'intelligence', toRank: 4, pointsLeft: 5 })
  })

  it('breaks a tie in SPEC order: Charm, Courage, Intelligence, Proficiency', () => {
    expect(nearestRank(points({}))).toEqual({ stat: 'charm', toRank: 2, pointsLeft: 60 })
    expect(nearestRank(points({ courage: 58, proficiency: 58 }))).toMatchObject({ stat: 'courage' })
  })

  it('skips maxed stats', () => {
    expect(nearestRank(points({ charm: 1000, courage: 999 }))).toEqual({ stat: 'courage', toRank: 5, pointsLeft: 1 })
  })

  it('is "graduated" once all four stats are maxed', () => {
    expect(nearestRank(points({ charm: 1000, courage: 1000, intelligence: 1000, proficiency: 1000 }))).toBe('graduated')
  })
})

describe('list order', () => {
  it('puts daily habits first, then anytime, each sorted by name', () => {
    const active = [
      { habitId: 'guitar', kind: 'anytime' },
      { habitId: 'running', kind: 'daily' },
      { habitId: 'chess', kind: 'anytime' },
      { habitId: 'boxing', kind: 'daily' },
    ] as const
    const names: Record<string, string> = { guitar: 'Guitar practice', running: 'Running', chess: 'Chess', boxing: 'Boxing' }
    expect(listOrder([...active], (id) => names[id]).map((a) => a.habitId)).toEqual(['boxing', 'running', 'chess', 'guitar'])
  })
})
