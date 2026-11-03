// What the Today screen and the menu card show, worked out from data. Pure functions.

import { progressOf, rankOf, STATS, type Rank, type Stat, type StatPoints } from '../engine/stats'
import type { HabitKind } from '../storage/db'

export interface NearestRank {
  stat: Stat
  toRank: Rank
  pointsLeft: number
}

// The stat closest to its next rank: fewest points left, skipping maxed stats. A tie goes to
// the stat first in SPEC order. 'graduated' once every stat is maxed.
export function nearestRank(points: StatPoints): NearestRank | 'graduated' {
  let best: NearestRank | null = null
  for (const stat of STATS) {
    const progress = progressOf(points[stat])
    if (!progress) continue
    const pointsLeft = progress.needed - progress.earned
    if (!best || pointsLeft < best.pointsLeft) best = { stat, toRank: (rankOf(points[stat]) + 1) as Rank, pointsLeft }
  }
  return best ?? 'graduated'
}

// Today order: daily habits first, then anytime, each sorted by name.
export function listOrder<T extends { habitId: string; kind: HabitKind }>(active: T[], nameOf: (habitId: string) => string): T[] {
  const rank = (kind: HabitKind) => (kind === 'daily' ? 0 : 1)
  return [...active].sort((a, b) => rank(a.kind) - rank(b.kind) || nameOf(a.habitId).localeCompare(nameOf(b.habitId)))
}

export const statName = (stat: Stat) => stat[0].toUpperCase() + stat.slice(1)
