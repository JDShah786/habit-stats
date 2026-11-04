// The points chart after LOG, worked out as pure functions.

import { progressOf, rankOf, STATS, type RankEvent, type Stat, type StatPoints } from '../engine/stats'

// What a LOG hands the app: the chart's caption and totals, and the rank events to play after.
export interface Logged {
  caption: string
  before: StatPoints
  after: StatPoints
  events: RankEvent[]
}

// A stat's spot on its axis: its rank plus progress through that rank, from 1 (0 points) to 5
// (max). The chart shows only this shape, never point thresholds.
export function level(points: number): number {
  const progress = progressOf(points)
  return progress ? rankOf(points) + progress.earned / progress.needed : 5
}

// The stats a log raised, in stat order, with how many points each got.
export const gains = (before: StatPoints, after: StatPoints): [Stat, number][] =>
  STATS.filter((stat) => after[stat] > before[stat]).map((stat) => [stat, after[stat] - before[stat]])

// One bead per point. Past 40 (only extreme logs), 40 beads share the points in whole numbers.
export const MAX_BEADS = 40
export function beadValues(total: number): number[] {
  const beads = Math.min(total, MAX_BEADS)
  return Array.from({ length: beads }, (_, i) => Math.floor(((i + 1) * total) / beads) - Math.floor((i * total) / beads))
}

// Milliseconds between beads: the more beads, the faster they stream (log2 of the count).
export const beadGap = (beads: number) => 110 / Math.max(1, Math.log2(beads))
