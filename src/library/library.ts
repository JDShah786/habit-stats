// Habit library (SPEC.md "Habit library"): read-only presets shipped in habits.json.

import type { Weights } from '../engine/scoring'
import { STATS, type Stat } from '../engine/stats'
import habitsJson from './habits.json'

export type Category = 'fitness' | 'study' | 'languages' | 'content-creation' | 'reading' | 'art'
export const CATEGORIES: Category[] = ['fitness', 'study', 'languages', 'content-creation', 'reading', 'art']

export interface Habit {
  id: string // readable slug, e.g. "boxing"; saved in sessions, so it never changes
  name: string
  category: Category
  weights: Weights
}

export const HABITS = habitsJson as Habit[]

// Lowercase letters and digits, joined by single hyphens.
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

// Every problem in a preset list. Empty when the list is valid.
export function validateLibrary(habits: readonly Habit[]): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  const names = new Set<string>()

  for (const { id, name, category, weights } of habits) {
    const problem = (message: string) => errors.push(`habit "${id}": ${message}`)

    if (!SLUG.test(id)) problem('id must be a lowercase slug like "hiit-20s"')
    if (id.startsWith('custom-')) problem('id must not start with "custom-" (reserved for custom habits)')
    if (ids.has(id)) problem('duplicate id')
    ids.add(id)

    if (!name.trim()) problem('name is blank')
    else if (names.has(name)) problem(`duplicate name "${name}"`)
    names.add(name)

    if (!CATEGORIES.includes(category)) problem(`unknown category "${category}"`)

    const entries = Object.entries(weights)
    for (const [stat] of entries) {
      if (!STATS.includes(stat as Stat)) problem(`unknown stat "${stat}"`)
    }
    // One message per habit, however many weights are off.
    if (entries.some(([, w]) => !Number.isInteger(w / 10) || w < 10 || w > 100)) {
      problem('each weight must be a multiple of 10, from 10 to 100')
    }
    const sum = entries.reduce((total, [, w]) => total + w, 0)
    if (sum !== 100) problem(`weights must sum to 100, got ${sum}`)
  }
  return errors
}
