// The "New custom habit" form, worked out as pure functions.

import type { Weights } from '../engine/scoring'
import type { Stat } from '../engine/stats'
import { slugOf, type Category } from '../library/library'
import { MAX_NAME } from '../storage/store'

// SPEC "Habit library": each category's default stats.
const CATEGORY_STATS: Record<Category, Stat[]> = {
  fitness: ['courage', 'proficiency'],
  study: ['intelligence'],
  languages: ['intelligence', 'charm'],
  'content-creation': ['charm', 'proficiency'],
  reading: ['intelligence'],
  art: ['proficiency', 'charm'],
}

export const categoryStats = (category: Category): Stat[] => CATEGORY_STATS[category]

// 100 split in steps of 10, in the order the stats were picked. Ten tens rarely divide evenly,
// so the first stats picked get the spare tens: 3 stats → 40/30/30, 4 → 30/30/20/20.
export function defaultWeights(stats: Stat[]): Weights {
  const each = Math.floor(10 / stats.length)
  const spare = 10 % stats.length
  return Object.fromEntries(stats.map((stat, i) => [stat, (each + (i < spare ? 1 : 0)) * 10]))
}

export const weightsTotal = (weights: Weights) => Object.values(weights).reduce((sum, w) => sum + w, 0)

// Why a name can't be used, or null if it can. `taken` is every preset and custom habit name.
export function nameError(name: string, taken: string[]): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Give it a name.'
  if (trimmed.length > MAX_NAME) return `Use ${MAX_NAME} characters or fewer.`
  const slug = slugOf(trimmed)
  if (!slug) return 'Use at least one letter A–Z or a digit.'
  if (taken.some((t) => slugOf(t) === slug)) return 'A habit with that name already exists.'
  return null
}
