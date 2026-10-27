// Storage actions the screens call. Every change re-scores today in one transaction,
// so a rejected change (bad minutes, 1440 limit, not today) saves nothing.

import { scoreDay, type Weights } from '../engine/scoring'
import { rankEvents, STATS, type RankEvent, type Stat, type StatPoints } from '../engine/stats'
import { HABITS, type Habit } from '../library/library'
import type { ActiveHabitRow, AwardRow, HabitDB, HabitKind, SessionRow } from './db'

export interface Store {
  logSession(habitId: string, minutes: number): Promise<RankEvent[]>
  editSession(id: number, minutes: number): Promise<RankEvent[]>
  deleteSession(id: number): Promise<RankEvent[]>
  sessionsToday(): Promise<SessionRow[]>
  totals(): Promise<StatPoints>
  addToList(habitId: string, kind: HabitKind): Promise<void>
  removeFromList(habitId: string): Promise<void>
  activeHabits(): Promise<ActiveHabitRow[]>
  // Presets plus custom habits.
  habits(): Promise<Habit[]>
  // Returns the new id: 'custom-' + a slug of the name.
  saveCustomHabit(habit: Omit<Habit, 'id'>): Promise<string>
}

function sumAwards(rows: AwardRow[]): StatPoints {
  const totals = Object.fromEntries(STATS.map((stat) => [stat, 0])) as StatPoints
  for (const row of rows) totals[row.stat] += row.points
  return totals
}

// `today` returns the phone-local day ('YYYY-MM-DD') at the moment it's called.
export function createStore(db: HabitDB, today: () => string): Store {
  // Presets plus custom habits. Custom habits are never deleted, so history always has weights.
  const allWeights = async (): Promise<Record<string, Weights>> => {
    const custom = await db.customHabits.toArray()
    return Object.fromEntries([...HABITS, ...custom].map((h) => [h.id, h.weights]))
  }

  const isKnownHabit = async (habitId: string) =>
    HABITS.some((h) => h.id === habitId) || (await db.customHabits.get(habitId)) !== undefined

  const sessionsOn = (day: string) => db.sessions.where('date').equals(day).sortBy('id')

  const findTodaySession = async (id: number, day: string) => {
    const session = await db.sessions.get(id)
    if (!session) throw new Error(`no session with id ${id}`)
    if (session.date !== day) throw new Error('sessions can be changed only today')
    return session
  }

  // Applies a change to today's sessions, then replays today on top of this morning's totals.
  // Anything thrown, here or by the engine, rolls the whole transaction back.
  const changeToday = (change: (day: string) => Promise<unknown>) =>
    db.transaction('rw', [db.sessions, db.awards, db.customHabits], async () => {
      const day = today()
      await change(day)

      const awards = await db.awards.toArray()
      const morning = sumAwards(awards.filter((a) => a.date < day))
      const before = sumAwards(awards.filter((a) => a.date <= day))

      const sessions = (await sessionsOn(day)).map((s) => ({ id: String(s.id), habitId: s.habitId, minutes: s.minutes }))
      const result = scoreDay(morning, sessions, await allWeights())

      await db.awards.where('date').equals(day).delete()
      await db.awards.bulkAdd(
        Object.entries(result.awards).flatMap(([habitId, paid]) =>
          (Object.entries(paid) as [Stat, number][]).map(([stat, points]) => ({ habitId, date: day, stat, points })),
        ),
      )
      return rankEvents(before, result.totals)
    })

  return {
    logSession: (habitId, minutes) => changeToday((day) => db.sessions.add({ habitId, date: day, minutes })),

    editSession: (id, minutes) =>
      changeToday(async (day) => {
        await findTodaySession(id, day)
        await db.sessions.update(id, { minutes })
      }),

    deleteSession: (id) =>
      changeToday(async (day) => {
        await findTodaySession(id, day)
        await db.sessions.delete(id)
      }),

    sessionsToday: () => sessionsOn(today()),

    totals: async () => sumAwards(await db.awards.toArray()),

    addToList: async (habitId, kind) => {
      if (!(await isKnownHabit(habitId))) throw new Error(`unknown habit: ${habitId}`)
      await db.activeHabits.put({ habitId, addedOn: today(), kind })
    },

    // Hides the habit from the list only. Its sessions and points stay.
    removeFromList: async (habitId) => {
      await db.activeHabits.delete(habitId)
    },

    activeHabits: () => db.activeHabits.toArray(),

    habits: async () => [...HABITS, ...(await db.customHabits.toArray())],

    saveCustomHabit: async ({ name, category, weights }) => {
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      if (!slug) throw new Error('name needs at least one letter or digit')
      const id = `custom-${slug}`
      if (await db.customHabits.get(id)) throw new Error(`a custom habit named "${name.trim()}" already exists`)
      await db.customHabits.add({ id, name: name.trim(), category, weights, custom: true })
      return id
    },
  }
}
