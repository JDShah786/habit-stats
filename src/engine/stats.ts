// Stats, ranks and titles (SPEC.md "Stats, ranks and titles").
// Rank and title are always calculated from points, never stored.

export type Stat = 'charm' | 'courage' | 'intelligence' | 'proficiency'
export const STATS: Stat[] = ['charm', 'courage', 'intelligence', 'proficiency']
export type StatPoints = Record<Stat, number>
export type Rank = 1 | 2 | 3 | 4 | 5

export const MAX_POINTS = 1000

// Points needed for ranks 1..5.
const THRESHOLDS = [0, 60, 200, 500, MAX_POINTS]

const TITLES: Record<Stat, string[]> = {
  charm: ['Plain', 'Pleasant', 'Likable', 'Magnetic', 'Radiant'],
  courage: ['Timid', 'Steady', 'Bold', 'Fearless', 'Unshakable'],
  intelligence: ['Average', 'Sharp', 'Scholar', 'Brilliant', 'Genius'],
  proficiency: ['Clumsy', 'Handy', 'Skilled', 'Expert', 'Master'],
}

export type RankEvent =
  | {
      type: 'rankUp' | 'rankDown'
      stat: Stat
      fromRank: Rank
      toRank: Rank
      fromTitle: string
      toTitle: string
    }
  // Graduation is for the whole app: all four stats at MAX_POINTS.
  | { type: 'graduated' | 'ungraduated' }

export function rankOf(points: number): Rank {
  return THRESHOLDS.filter((t) => points >= t).length as Rank
}

export function titleOf(stat: Stat, rank: Rank): string {
  return TITLES[stat][rank - 1]
}

// Progress toward the next rank, for the Stats screen bar. null at Rank 5.
export function progressOf(points: number): { earned: number; needed: number } | null {
  const rank = rankOf(points)
  if (rank === 5) return null
  const start = THRESHOLDS[rank - 1]
  return { earned: points - start, needed: THRESHOLDS[rank] - start }
}

const isGraduated = (totals: StatPoints) => STATS.every((stat) => totals[stat] >= MAX_POINTS)

// Rank changes between two sets of totals, in STATS order, then any graduation change.
export function rankEvents(before: StatPoints, after: StatPoints): RankEvent[] {
  const events: RankEvent[] = []
  for (const stat of STATS) {
    const fromRank = rankOf(before[stat])
    const toRank = rankOf(after[stat])
    if (fromRank === toRank) continue
    events.push({
      type: toRank > fromRank ? 'rankUp' : 'rankDown',
      stat,
      fromRank,
      toRank,
      fromTitle: titleOf(stat, fromRank),
      toTitle: titleOf(stat, toRank),
    })
  }
  if (!isGraduated(before) && isGraduated(after)) events.push({ type: 'graduated' })
  if (isGraduated(before) && !isGraduated(after)) events.push({ type: 'ungraduated' })
  return events
}
