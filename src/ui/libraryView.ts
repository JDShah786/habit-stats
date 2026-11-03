// What the Library screen shows, worked out from the preset list. Pure functions.

import type { Weights } from '../engine/scoring'
import { STATS, type Stat } from '../engine/stats'
import type { Category, Habit } from '../library/library'

export const CATEGORY_LABELS: Record<Category, string> = {
  fitness: 'Fitness',
  study: 'Study',
  languages: 'Languages',
  'content-creation': 'Content',
  reading: 'Reading',
  art: 'Art',
}

// The stats a habit feeds, biggest weight first; equal weights in SPEC order (sort is stable).
export const statsByWeight = (weights: Weights): Stat[] =>
  STATS.filter((stat) => weights[stat]).sort((a, b) => weights[b]! - weights[a]!)

// A search matches names in every category; with no search, show the category. Sorted by name.
export function filterLibrary(habits: Habit[], category: Category, query: string): Habit[] {
  const q = query.trim().toLowerCase()
  return habits
    .filter((h) => (q ? h.name.toLowerCase().includes(q) : h.category === category))
    .sort((a, b) => a.name.localeCompare(b.name))
}
