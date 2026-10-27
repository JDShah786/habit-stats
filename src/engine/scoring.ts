// Scoring engine: rules 1–8 + corrections (SPEC.md "Scoring rules").
// Pure functions only. No React, no Dexie, no clock: callers pass everything in.

import { MAX_POINTS, STATS, type Stat, type StatPoints } from './stats'

// Integer weights per stat, summing to 100.
export type Weights = Partial<Record<Stat, number>>

export interface Session {
  id: string
  habitId: string
  minutes: number
}

// Points each habit paid each stat today. Only non-zero entries are listed.
export type DayAwards = Record<string, Partial<Record<Stat, number>>>

export const MAX_MINUTES_PER_DAY = 1440

// Rule 3: 2 base points + 1 per full 10 minutes. No cap.
export function dailyPoints(minutes: number): number {
  return 2 + Math.floor(minutes / 10)
}

// Rule 2: the phone-local calendar day of a moment, as 'YYYY-MM-DD'.
export function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Rules 4 + 6: split points over the habit's stats that aren't maxed, by weight, rounded up.
// A maxed stat's weight moves to the others in proportion. Empty if every stat is maxed.
function split(points: number, weights: Weights, totals: StatPoints): [Stat, number][] {
  const open = STATS.filter((stat) => (weights[stat] ?? 0) > 0 && totals[stat] < MAX_POINTS)
  const openWeight = open.reduce((sum, stat) => sum + weights[stat]!, 0)
  return open.map((stat) => [stat, Math.ceil((points * weights[stat]!) / openWeight)])
}

// Replays today's sessions, in logged order, on top of this morning's totals.
export function scoreDay(
  morning: StatPoints,
  sessions: Session[],
  weights: Record<string, Weights>,
): { awards: DayAwards; totals: StatPoints } {
  const totals = { ...morning }
  const awards: DayAwards = {}
  const habitMinutes: Record<string, number> = {}
  let dayMinutes = 0

  for (const { habitId, minutes } of sessions) {
    if (!Number.isInteger(minutes) || minutes < 1) {
      throw new Error(`minutes must be a whole number ≥ 1, got ${minutes}`)
    }
    const habitWeights = weights[habitId]
    if (!habitWeights) throw new Error(`unknown habit: ${habitId}`)
    dayMinutes += minutes
    if (dayMinutes > MAX_MINUTES_PER_DAY) {
      throw new Error(`a day can't have more than ${MAX_MINUTES_PER_DAY} minutes`)
    }

    habitMinutes[habitId] = (habitMinutes[habitId] ?? 0) + minutes
    const paid = (awards[habitId] ??= {})

    // Rule 7: a stat takes what fits under 1000; the rest is returned as overflow.
    const pay = (stat: Stat, points: number) => {
      const given = Math.min(points, MAX_POINTS - totals[stat])
      if (given > 0) {
        totals[stat] += given
        paid[stat] = (paid[stat] ?? 0) + given
      }
      return points - given
    }

    // Rule 5: pay only the difference between today's target and what's already paid.
    // A replay never takes points back; deleted time simply isn't replayed.
    let overflow = 0
    for (const [stat, target] of split(dailyPoints(habitMinutes[habitId]), habitWeights, totals)) {
      overflow += pay(stat, Math.max(0, target - (paid[stat] ?? 0)))
    }

    // Rule 7: overflow moves to the habit's other un-maxed stats; dropped when none are left.
    // Each pass either absorbs it all or maxes a stat, so the loop ends.
    while (overflow > 0) {
      const shares = split(overflow, habitWeights, totals)
      if (shares.length === 0) break
      overflow = 0
      for (const [stat, share] of shares) overflow += pay(stat, share)
    }
  }

  for (const habitId of Object.keys(awards)) {
    if (Object.keys(awards[habitId]).length === 0) delete awards[habitId]
  }
  return { awards, totals }
}
