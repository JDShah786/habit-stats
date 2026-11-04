import { describe, expect, it } from 'vitest'
import { rankEvents, type RankEvent, type StatPoints } from '../engine/stats'
import { moments } from './moments'

const points = (p: Partial<StatPoints>): StatPoints => ({ charm: 0, courage: 0, intelligence: 0, proficiency: 0, ...p })

describe('which rank events get a full-screen moment', () => {
  it('shows rank-ups, and stays silent on rank-downs', () => {
    const up = rankEvents(points({ courage: 58 }), points({ courage: 61 }))
    const down = rankEvents(points({ courage: 61 }), points({ courage: 58 }))
    expect(moments(up)).toEqual(up)
    expect(moments(down)).toEqual([])
  })

  it('shows graduation, and stays silent on un-graduating', () => {
    const all = points({ charm: 1000, courage: 1000, intelligence: 1000, proficiency: 1000 })
    const graduating = rankEvents({ ...all, proficiency: 999 }, all)
    const ungraduating = rankEvents(all, { ...all, proficiency: 999 })
    expect(moments(graduating)).toEqual([...graduating.filter((e) => e.type === 'rankUp'), { type: 'graduated' }])
    expect(moments(ungraduating)).toEqual([])
  })

  it('puts rank-ups in stat order and graduation last, whatever order they arrive in', () => {
    const all = points({ charm: 1000, courage: 1000, intelligence: 1000, proficiency: 1000 })
    const events = rankEvents({ ...all, charm: 999, proficiency: 999 }, all)
    const shuffled: RankEvent[] = [events[2], events[1], events[0]]
    expect(moments(shuffled).map((m) => (m.type === 'graduated' ? 'graduated' : m.stat))).toEqual(['charm', 'proficiency', 'graduated'])
  })

  it('is empty when nothing ranked up', () => {
    expect(moments([])).toEqual([])
  })
})
