import { describe, expect, it } from 'vitest'
import type { StatPoints } from '../engine/stats'
import { beadGap, beadValues, gains, level } from './pointsChart'

const points = (p: Partial<StatPoints>): StatPoints => ({ charm: 0, courage: 0, intelligence: 0, proficiency: 0, ...p })

describe("a stat's spot on its axis: rank plus progress through that rank", () => {
  it('runs from 1 at 0 points to 5 at max', () => {
    expect(level(0)).toBe(1)
    expect(level(30)).toBe(1.5) // halfway from 0 to 60
    expect(level(60)).toBe(2)
    expect(level(130)).toBe(2.5) // halfway from 60 to 200
    expect(level(500)).toBe(4)
    expect(level(999)).toBeLessThan(5)
    expect(level(1000)).toBe(5)
  })
})

describe('the points each stat gained', () => {
  it('lists gaining stats in stat order with their points, skipping the rest', () => {
    expect(gains(points({ charm: 10, courage: 57 }), points({ charm: 12, courage: 60 }))).toEqual([
      ['charm', 2],
      ['courage', 3],
    ])
    expect(gains(points({}), points({}))).toEqual([])
  })
})

describe('one bead per point', () => {
  it('is one bead worth 1 point for each point', () => {
    expect(beadValues(0)).toEqual([])
    expect(beadValues(3)).toEqual([1, 1, 1])
    expect(beadValues(40)).toEqual(Array(40).fill(1))
  })

  it('caps at 40 beads for extreme logs, spreading the points over them in whole numbers', () => {
    const beads = beadValues(146) // a full 24-hour log
    expect(beads).toHaveLength(40)
    expect(beads.reduce((a, b) => a + b, 0)).toBe(146)
    expect(beads.every((b) => b === 3 || b === 4)).toBe(true)
  })
})

describe('the gap between beads', () => {
  it('is 110 ms for one or two beads, and shrinks with log2 of the count', () => {
    expect(beadGap(1)).toBe(110)
    expect(beadGap(2)).toBe(110)
    expect(beadGap(8)).toBeCloseTo(110 / 3)
    expect(beadGap(32)).toBe(22)
  })

  it('keeps big gains quick: 32 beads stream in well under a second', () => {
    expect(32 * beadGap(32)).toBeLessThan(1000)
  })
})
