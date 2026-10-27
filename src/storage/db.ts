// IndexedDB tables (SPEC.md "Data model"). Totals are not stored: they are the sum of awards.

import Dexie, { type EntityTable, type Table } from 'dexie'
import type { Stat } from '../engine/stats'
import type { Habit } from '../library/library'

export interface SessionRow {
  id?: number // auto-numbered, so id order is logged order
  habitId: string
  date: string // 'YYYY-MM-DD', phone-local
  minutes: number
}

export interface AwardRow {
  habitId: string
  date: string
  stat: Stat
  points: number
}

export type HabitKind = 'daily' | 'anytime'

export interface ActiveHabitRow {
  habitId: string
  addedOn: string
  kind: HabitKind
}

export interface CustomHabitRow extends Habit {
  custom: true
}

export type HabitDB = Dexie & {
  sessions: EntityTable<SessionRow, 'id'>
  awards: Table<AwardRow, [string, string, Stat]>
  activeHabits: EntityTable<ActiveHabitRow, 'habitId'>
  customHabits: EntityTable<CustomHabitRow, 'id'>
}

export function openDb(name = 'habit-stats'): HabitDB {
  const db = new Dexie(name) as HabitDB
  db.version(1).stores({
    sessions: '++id, date',
    awards: '[habitId+date+stat], date',
    activeHabits: 'habitId',
    customHabits: 'id',
  })
  return db
}
