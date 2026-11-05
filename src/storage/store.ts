// Storage actions the screens call. Every change re-scores today in one transaction,
// so a rejected change (bad minutes, 1440 limit, not today) saves nothing.

import { scoreDay, type Weights } from '../engine/scoring'
import { rankEvents, STATS, type RankEvent, type Stat, type StatPoints } from '../engine/stats'
import { HABITS, slugOf, type Habit } from '../library/library'
import type { BackupData } from './backup'
import type { ActiveHabitRow, AwardRow, HabitDB, HabitKind, SessionRow } from './db'

export interface Store {
  logSession(habitId: string, minutes: number): Promise<RankEvent[]>
  editSession(id: number, minutes: number): Promise<RankEvent[]>
  deleteSession(id: number): Promise<RankEvent[]>
  sessionsToday(): Promise<SessionRow[]>
  totals(): Promise<StatPoints>
  addToList(habitId: string, kind: HabitKind): Promise<void>
  // Switches daily/anytime; keeps addedOn.
  setKind(habitId: string, kind: HabitKind): Promise<void>
  // Returns the removed row (for Undo), or undefined if it wasn't on the list.
  removeFromList(habitId: string): Promise<ActiveHabitRow | undefined>
  // Puts a removed row back exactly as it was (Undo).
  restoreToList(row: ActiveHabitRow): Promise<void>
  activeHabits(): Promise<ActiveHabitRow[]>
  // Presets plus custom habits.
  habits(): Promise<Habit[]>
  // Returns the new id: 'custom-' + a slug of the name.
  saveCustomHabit(habit: Omit<Habit, 'id'>): Promise<string>
  // Backup (step 6): every row of every table.
  allData(): Promise<BackupData>
  // Swaps every table for `data` in one transaction: all of it, or (on any failure) none.
  replaceAll(data: BackupData): Promise<void>
  // ISO time of the last completed backup, or null.
  lastBackup(): Promise<string | null>
  setLastBackup(at: string): Promise<void>
  // The one-time "add to Home Screen" hint (step 7): dismissed once, gone for good.
  installHintDismissed(): Promise<boolean>
  dismissInstallHint(): Promise<void>
}

export const MAX_NAME = 40

// Same rule as the presets: each weight a multiple of 10 from 10 to 100, known stats, sum 100.
export const validWeights = (weights: Weights) => {
  const entries = Object.entries(weights)
  return (
    entries.every(([stat, w]) => STATS.includes(stat as Stat) && Number.isInteger(w / 10) && w >= 10 && w <= 100) &&
    entries.reduce((sum, [, w]) => sum + w, 0) === 100
  )
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

    setKind: async (habitId, kind) => {
      // update() returns how many rows changed: 0 means it isn't on the list.
      if (!(await db.activeHabits.update(habitId, { kind }))) throw new Error(`${habitId} is not on your list`)
    },

    // Hides the habit from the list only. Its sessions and points stay.
    removeFromList: (habitId) =>
      db.transaction('rw', db.activeHabits, async () => {
        const row = await db.activeHabits.get(habitId)
        if (row) await db.activeHabits.delete(habitId)
        return row
      }),

    restoreToList: async (row) => {
      await db.activeHabits.put(row)
    },

    activeHabits: () => db.activeHabits.toArray(),

    habits: async () => [...HABITS, ...(await db.customHabits.toArray())],

    saveCustomHabit: async ({ name, category, weights }) => {
      const trimmed = name.trim()
      const slug = slugOf(trimmed)
      if (trimmed.length > MAX_NAME) throw new Error(`name must be ${MAX_NAME} characters or fewer`)
      if (!slug) throw new Error('name needs at least one letter or digit')
      const preset = HABITS.find((h) => slugOf(h.name) === slug)
      if (preset) throw new Error(`a habit named "${preset.name}" already exists`)
      if (!validWeights(weights)) throw new Error('weights must be multiples of 10, from 10 to 100, summing to 100')
      const id = `custom-${slug}`
      if (await db.customHabits.get(id)) throw new Error(`a custom habit named "${trimmed}" already exists`)
      await db.customHabits.add({ id, name: trimmed, category, weights, custom: true })
      return id
    },

    allData: async () => ({
      customHabits: await db.customHabits.toArray(),
      activeHabits: await db.activeHabits.toArray(),
      sessions: await db.sessions.toArray(),
      awards: await db.awards.toArray(),
    }),

    // Clear and refill in one transaction: anything thrown rolls all of it back.
    replaceAll: (data) =>
      db.transaction('rw', [db.customHabits, db.activeHabits, db.sessions, db.awards], async () => {
        await Promise.all([db.customHabits.clear(), db.activeHabits.clear(), db.sessions.clear(), db.awards.clear()])
        await db.customHabits.bulkAdd(data.customHabits)
        await db.activeHabits.bulkAdd(data.activeHabits)
        await db.sessions.bulkAdd(data.sessions)
        await db.awards.bulkAdd(data.awards)
      }),

    lastBackup: async () => (await db.settings.get('lastBackup'))?.value ?? null,

    setLastBackup: async (at) => {
      await db.settings.put({ key: 'lastBackup', value: at })
    },

    installHintDismissed: async () => (await db.settings.get('installHintDismissed'))?.value === 'yes',

    dismissInstallHint: async () => {
      await db.settings.put({ key: 'installHintDismissed', value: 'yes' })
    },
  }
}
