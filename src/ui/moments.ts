// Which rank events get a full-screen moment, and in what order. Pure function.
// Rank-downs and un-graduating stay silent (SPEC "Corrections").

import { STATS, type RankEvent, type Stat } from '../engine/stats'

// The engine's rank change ({ type: 'rankUp' | 'rankDown', stat, ... }), narrowed to rank-ups.
export type RankUp = Extract<RankEvent, { stat: Stat }> & { type: 'rankUp' }
export type Moment = RankUp | { type: 'graduated' }

const isRankUp = (e: RankEvent): e is RankUp => e.type === 'rankUp'

// Rank-ups in stat order, then graduation last: one screen each.
export function moments(events: RankEvent[]): Moment[] {
  const ups = events.filter(isRankUp).sort((a, b) => STATS.indexOf(a.stat) - STATS.indexOf(b.stat))
  return events.some((e) => e.type === 'graduated') ? [...ups, { type: 'graduated' }] : ups
}
