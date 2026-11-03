// What a Stats card shows, worked out from a stat's points. Pure function.
// No points needed and no next title: like the games, you only see the gauge.

import { MAX_POINTS, progressOf, rankOf, titleOf, type Rank, type Stat } from '../engine/stats'

export interface StatCard {
  rank: Rank
  title: string
  max: boolean
  // How far through the current rank, 0 to 1. Full at Max.
  fill: number
}

export function statCard(stat: Stat, points: number): StatCard {
  const rank = rankOf(points)
  const progress = progressOf(points)
  return {
    rank,
    title: titleOf(stat, rank),
    max: points >= MAX_POINTS,
    fill: progress ? progress.earned / progress.needed : 1,
  }
}
