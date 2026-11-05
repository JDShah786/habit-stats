// The backup file (SPEC "Settings"): every table, wrapped with the app name, a format version
// and the export time. Import is all or nothing: checkBackup checks everything first.
// Pure functions.

import { MAX_MINUTES_PER_DAY } from '../engine/scoring'
import { MAX_POINTS, STATS, type Stat } from '../engine/stats'
import { CATEGORIES, HABITS, slugOf, type Category } from '../library/library'
import type { ActiveHabitRow, AwardRow, CustomHabitRow, SessionRow } from './db'
import { MAX_NAME, validWeights } from './store'

// The format id inside every backup file. It stays 'habit-stats' (the app's first name) so
// backups made before the rename to Meta Log still import.
export const BACKUP_APP = 'habit-stats'
export const BACKUP_VERSION = 1

export interface BackupData {
  customHabits: CustomHabitRow[]
  activeHabits: ActiveHabitRow[]
  sessions: SessionRow[]
  awards: AwardRow[]
}

export interface Backup {
  app: typeof BACKUP_APP
  version: typeof BACKUP_VERSION
  exportedAt: string // ISO time
  data: BackupData
}

export const makeBackup = (data: BackupData, exportedAt: string): Backup => ({ app: BACKUP_APP, version: BACKUP_VERSION, exportedAt, data })

// `day` is the phone's 'YYYY-MM-DD'.
export const backupFileName = (day: string) => `meta-log-backup-${day}.json`

// What the confirm step shows.
export const backupSummary = (backup: Backup) => ({
  exportedAt: backup.exportedAt,
  onList: backup.data.activeHabits.length,
  sessions: backup.data.sessions.length,
})

export type BackupCheck = { ok: true; backup: Backup } | { ok: false; error: string }

const NOT_OURS = 'This is not a Meta Log backup.'
const TABLES = ['customHabits', 'activeHabits', 'sessions', 'awards'] as const

// A found problem: checking stops at the first one.
class Problem extends Error {}
const fail = (message: string): never => {
  throw new Problem(message)
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isWhole = (v: unknown, min: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min
// A real calendar day written YYYY-MM-DD (so 2026-02-30 fails).
const isDay = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

// Every rule a backup must follow. Nothing is imported unless all of them pass.
export function checkBackup(text: string): BackupCheck {
  let file: unknown
  try {
    file = JSON.parse(text)
  } catch {
    return { ok: false, error: NOT_OURS }
  }
  if (!isObject(file) || file.app !== BACKUP_APP || typeof file.version !== 'number') return { ok: false, error: NOT_OURS }
  if (file.version > BACKUP_VERSION) {
    return { ok: false, error: 'This backup was made by a newer version of the app. Update the app, then try again.' }
  }
  if (file.version !== BACKUP_VERSION || typeof file.exportedAt !== 'string' || Number.isNaN(Date.parse(file.exportedAt))) {
    return { ok: false, error: NOT_OURS }
  }
  const data = file.data
  if (!isObject(data) || !TABLES.every((table) => Array.isArray(data[table]))) return { ok: false, error: NOT_OURS }

  try {
    checkRows(data as unknown as Record<(typeof TABLES)[number], unknown[]>)
  } catch (e) {
    if (e instanceof Problem) return { ok: false, error: e.message }
    throw e
  }
  return { ok: true, backup: file as unknown as Backup }
}

function checkRows({ customHabits, activeHabits, sessions, awards }: Record<(typeof TABLES)[number], unknown[]>) {
  // Custom habits: the same rules as saving one in the app.
  const presetSlugs = new Set(HABITS.map((h) => slugOf(h.name)))
  const customSlugs = new Set<string>()
  for (const habit of customHabits) {
    if (!isObject(habit) || typeof habit.name !== 'string' || !habit.name.trim()) fail('A custom habit has no name.')
    const { name, id, category, weights } = habit as Record<string, unknown> & { name: string }
    const trimmed = name.trim()
    if (trimmed.length > MAX_NAME) fail(`The custom habit name "${trimmed.slice(0, 20)}…" is over ${MAX_NAME} characters.`)
    const slug = slugOf(trimmed)
    if (!slug) fail(`The custom habit name "${trimmed}" needs a letter A–Z or a digit.`)
    if (presetSlugs.has(slug)) fail(`The custom habit name "${trimmed}" matches a preset.`)
    if (customSlugs.has(slug)) fail(`Two custom habits share the name "${trimmed}".`)
    customSlugs.add(slug)
    if (id !== `custom-${slug}`) fail(`The custom habit "${trimmed}" has the wrong id.`)
    if (!CATEGORIES.includes(category as Category)) fail(`The custom habit "${trimmed}" has an unknown category.`)
    if (!isObject(weights) || !Object.values(weights).every((w) => typeof w === 'number') || !validWeights(weights as Record<string, number>)) {
      fail(`The custom habit "${trimmed}" has invalid weights.`)
    }
  }
  const known = new Set([...HABITS.map((h) => h.id), ...[...customSlugs].map((slug) => `custom-${slug}`)])
  const habitOf = (row: Record<string, unknown>, what: string) => {
    if (typeof row.habitId !== 'string' || !known.has(row.habitId)) fail(`${what} is for an unknown habit "${String(row.habitId)}".`)
  }

  // Your list.
  const listed = new Set<string>()
  for (const row of activeHabits) {
    if (!isObject(row)) fail('Your list has a broken entry.')
    const entry = row as Record<string, unknown>
    if (typeof entry.habitId !== 'string' || !known.has(entry.habitId)) fail(`Your list has an unknown habit "${String(entry.habitId)}".`)
    if (listed.has(entry.habitId as string)) fail(`Your list has "${String(entry.habitId)}" twice.`)
    listed.add(entry.habitId as string)
    if (entry.kind !== 'daily' && entry.kind !== 'anytime') fail(`"${String(entry.habitId)}" on your list has an unknown kind "${String(entry.kind)}".`)
    if (!isDay(entry.addedOn)) fail(`"${String(entry.habitId)}" on your list has a bad date added.`)
  }

  // Sessions.
  const ids = new Set<number>()
  const minutesByDay = new Map<string, number>()
  for (const row of sessions) {
    if (!isObject(row)) fail('A session is broken.')
    const session = row as Record<string, unknown>
    if (!isWhole(session.id, 1) || ids.has(session.id)) fail('A session id is missing or used twice.')
    ids.add(session.id as number)
    habitOf(session, 'A session')
    if (!isDay(session.date)) fail(`A session has a bad date "${String(session.date)}".`)
    if (!isWhole(session.minutes, 1)) fail(`A session has bad minutes (${JSON.stringify(session.minutes)}).`)
    const day = session.date as string
    const total = (minutesByDay.get(day) ?? 0) + (session.minutes as number)
    if (total > MAX_MINUTES_PER_DAY) fail(`${day} has more than ${MAX_MINUTES_PER_DAY} minutes.`)
    minutesByDay.set(day, total)
  }

  // Awards.
  const totals = new Map<Stat, number>()
  const keys = new Set<string>()
  for (const row of awards) {
    if (!isObject(row)) fail('An award is broken.')
    const award = row as Record<string, unknown>
    habitOf(award, 'An award')
    if (!isDay(award.date)) fail(`An award has a bad date "${String(award.date)}".`)
    if (!STATS.includes(award.stat as Stat)) fail(`An award is for an unknown stat "${String(award.stat)}".`)
    if (!isWhole(award.points, 1)) fail(`An award has bad points (${JSON.stringify(award.points)}).`)
    const key = `${String(award.habitId)}|${String(award.date)}|${String(award.stat)}`
    if (keys.has(key)) fail('Two awards share a habit, day and stat.')
    keys.add(key)
    const stat = award.stat as Stat
    const total = (totals.get(stat) ?? 0) + (award.points as number)
    if (total > MAX_POINTS) fail(`${stat[0].toUpperCase()}${stat.slice(1)} goes over ${MAX_POINTS} points.`)
    totals.set(stat, total)
  }
}
