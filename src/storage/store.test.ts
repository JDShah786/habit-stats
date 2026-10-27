import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Stat, StatPoints } from '../engine/stats'
import { openDb, type HabitDB } from './db'
import { createStore, type Store } from './store'

const YESTERDAY = '2026-10-26'
const TODAY = '2026-10-27'

let dbCount = 0
let db: HabitDB
let day: string
let store: Store

beforeEach(() => {
  db = openDb(`test-${dbCount++}`)
  day = TODAY
  store = createStore(db, () => day)
})

afterEach(() => db.delete())

const totals = (p: Partial<StatPoints> = {}): StatPoints => ({
  charm: 0,
  courage: 0,
  intelligence: 0,
  proficiency: 0,
  ...p,
})

// Points earned on an earlier day, written straight to the awards table.
const seed = (stat: Stat, points: number, habitId = 'boxing', date = YESTERDAY) =>
  db.awards.add({ habitId, date, stat, points })

const minutesToday = async () => (await store.sessionsToday()).map((s) => s.minutes)

describe('logSession', () => {
  it("saves the session under today's date and pays its points", async () => {
    expect(await store.logSession('boxing', 25)).toEqual([])
    expect(await store.sessionsToday()).toEqual([expect.objectContaining({ habitId: 'boxing', date: TODAY, minutes: 25 })])
    expect(await store.totals()).toEqual(totals({ courage: 3, charm: 2 }))
  })

  it('pays only the difference across sessions (rule 5)', async () => {
    await store.logSession('boxing', 25)
    await store.logSession('boxing', 20)
    expect(await store.totals()).toEqual(totals({ courage: 5, charm: 2 }))
  })

  it('returns a rank-up when a threshold is crossed', async () => {
    await seed('courage', 58)
    expect(await store.logSession('boxing', 25)).toEqual([
      { type: 'rankUp', stat: 'courage', fromRank: 1, toRank: 2, fromTitle: 'Timid', toTitle: 'Steady' },
    ])
  })

  it.each([0, 2.5])('rejects %s minutes and saves nothing', async (minutes) => {
    await expect(store.logSession('boxing', minutes)).rejects.toThrow(/whole number/)
    expect(await store.sessionsToday()).toEqual([])
    expect(await store.totals()).toEqual(totals())
  })

  it('rejects a session that takes the day over 1440 minutes and saves nothing', async () => {
    await store.logSession('math-practice', 1000)
    await expect(store.logSession('boxing', 441)).rejects.toThrow(/1440/)
    expect(await minutesToday()).toEqual([1000])
    expect(await store.totals()).toEqual(totals({ intelligence: 102 }))
  })

  it('rejects an unknown habit and saves nothing', async () => {
    await expect(store.logSession('nope', 10)).rejects.toThrow(/unknown habit/)
    expect(await store.sessionsToday()).toEqual([])
  })
})

describe('editSession', () => {
  it('recomputes today: 25 + 20 edited to 25 + 5', async () => {
    await store.logSession('boxing', 25)
    await store.logSession('boxing', 20)
    const [, second] = await store.sessionsToday()
    await store.editSession(second.id!, 5)
    expect(await minutesToday()).toEqual([25, 5])
    expect(await store.totals()).toEqual(totals({ courage: 4, charm: 2 }))
  })

  it('keeps the session in its logged place', async () => {
    // Pronunciation practice (Charm 50 / Intelligence 50) logged first fills Charm 999 → 1000; boxing then redirects to Courage.
    await seed('charm', 999)
    await store.logSession('pronunciation-practice', 25)
    await store.logSession('boxing', 25)
    const [first] = await store.sessionsToday()
    await store.editSession(first.id!, 26)
    expect(await store.totals()).toEqual(totals({ charm: 1000, intelligence: 3, courage: 4 }))
  })

  it("rejects editing yesterday's session and changes nothing", async () => {
    day = YESTERDAY
    await store.logSession('boxing', 25)
    const [old] = await store.sessionsToday()
    day = TODAY
    await expect(store.editSession(old.id!, 50)).rejects.toThrow(/only today/)
    expect((await db.sessions.get(old.id!))?.minutes).toBe(25)
    expect(await store.totals()).toEqual(totals({ courage: 3, charm: 2 }))
  })

  it('rejects invalid minutes and changes nothing', async () => {
    await store.logSession('boxing', 25)
    const [s] = await store.sessionsToday()
    await expect(store.editSession(s.id!, 0)).rejects.toThrow(/whole number/)
    expect(await minutesToday()).toEqual([25])
    expect(await store.totals()).toEqual(totals({ courage: 3, charm: 2 }))
  })

  it('rejects an unknown session id', async () => {
    await expect(store.editSession(999, 10)).rejects.toThrow(/no session/)
  })
})

describe('deleteSession', () => {
  it('replays the day as if the session was never logged', async () => {
    await seed('charm', 998)
    await store.logSession('boxing', 25)
    await store.logSession('boxing', 20)
    const [, second] = await store.sessionsToday()
    await store.deleteSession(second.id!)
    expect(await minutesToday()).toEqual([25])
    expect(await store.totals()).toEqual(totals({ charm: 1000, courage: 3 }))
  })

  it('returns a rank-down when a delete drops below a threshold', async () => {
    await seed('courage', 58)
    await store.logSession('boxing', 25) // Courage 58 → 61
    const [s] = await store.sessionsToday()
    expect(await store.deleteSession(s.id!)).toEqual([
      { type: 'rankDown', stat: 'courage', fromRank: 2, toRank: 1, fromTitle: 'Steady', toTitle: 'Timid' },
    ])
    expect(await store.totals()).toEqual(totals({ courage: 58 }))
  })

  it("rejects deleting yesterday's session and changes nothing", async () => {
    day = YESTERDAY
    await store.logSession('boxing', 25)
    const [old] = await store.sessionsToday()
    day = TODAY
    await expect(store.deleteSession(old.id!)).rejects.toThrow(/only today/)
    expect(await db.sessions.get(old.id!)).toBeDefined()
  })

  it('rejects an unknown session id', async () => {
    await expect(store.deleteSession(999)).rejects.toThrow(/no session/)
  })
})

describe('totals across days', () => {
  it('adds up awards from every day', async () => {
    await seed('courage', 10)
    await seed('charm', 5, 'singing', '2026-10-01')
    await store.logSession('math-practice', 25)
    expect(await store.totals()).toEqual(totals({ courage: 10, charm: 5, intelligence: 4 }))
  })

  it('after midnight, a new day starts on top of the old totals', async () => {
    day = YESTERDAY
    await store.logSession('boxing', 25) // Courage 3, Charm 2
    day = TODAY
    await store.logSession('boxing', 25) // a new day: base points again
    expect(await minutesToday()).toEqual([25])
    expect(await store.totals()).toEqual(totals({ courage: 6, charm: 4 }))
  })
})

describe('active habit list', () => {
  it('adds a habit with its kind and today as addedOn', async () => {
    await store.addToList('boxing', 'daily')
    expect(await store.activeHabits()).toEqual([{ habitId: 'boxing', addedOn: TODAY, kind: 'daily' }])
  })

  it('re-adding records the latest add: new kind and new addedOn', async () => {
    day = YESTERDAY
    await store.addToList('boxing', 'daily')
    day = TODAY
    await store.addToList('boxing', 'anytime')
    expect(await store.activeHabits()).toEqual([{ habitId: 'boxing', addedOn: TODAY, kind: 'anytime' }])
  })

  it('rejects an unknown habit', async () => {
    await expect(store.addToList('nope', 'daily')).rejects.toThrow(/unknown habit/)
  })

  it('removing a habit keeps its sessions and points', async () => {
    await store.addToList('boxing', 'daily')
    await store.logSession('boxing', 25)
    await store.removeFromList('boxing')
    expect(await store.activeHabits()).toEqual([])
    expect(await minutesToday()).toEqual([25])
    expect(await store.totals()).toEqual(totals({ courage: 3, charm: 2 }))
  })
})

describe('habits', () => {
  it('lists presets and custom habits together', async () => {
    const id = await store.saveCustomHabit({ name: 'Meditation', category: 'study', weights: { intelligence: 100 } })
    const habits = await store.habits()
    expect(habits.find((h) => h.id === 'boxing')?.name).toBe('Boxing')
    expect(habits.find((h) => h.id === id)?.name).toBe('Meditation')
  })
})

describe('custom habits', () => {
  const meditation = {
    name: 'Meditation',
    category: 'study' as const,
    weights: { courage: 50, intelligence: 50 },
  }

  it('gets a custom- id, scores with its own weights, and can join the list', async () => {
    const id = await store.saveCustomHabit(meditation)
    expect(id).toBe('custom-meditation')
    await store.addToList(id, 'anytime')
    await store.logSession(id, 25)
    expect(await store.totals()).toEqual(totals({ courage: 2, intelligence: 2 }))
  })

  it('makes the id from the name as a slug', async () => {
    expect(await store.saveCustomHabit({ ...meditation, name: '  Morning Walk!  ' })).toBe('custom-morning-walk')
  })

  it('rejects a second custom habit with the same name', async () => {
    await store.saveCustomHabit(meditation)
    await expect(store.saveCustomHabit(meditation)).rejects.toThrow(/already/)
  })

  it('rejects a name with no letters or digits', async () => {
    await expect(store.saveCustomHabit({ ...meditation, name: '!!!' })).rejects.toThrow(/name/)
  })

  it('removing it from the list keeps its definition, so today still re-scores', async () => {
    const id = await store.saveCustomHabit(meditation)
    await store.addToList(id, 'anytime')
    await store.logSession(id, 25)
    await store.removeFromList(id)
    await store.logSession('math-practice', 25) // replays today, including the meditation session
    expect(await store.totals()).toEqual(totals({ courage: 2, intelligence: 6 }))
  })
})
