// Loading today's list, sessions and totals. Shared by the Today screen and the menu card.

import { useCallback, useEffect, useState } from 'react'
import type { StatPoints } from '../engine/stats'
import type { Habit } from '../library/library'
import type { ActiveHabitRow, SessionRow } from '../storage/db'
import type { Store } from '../storage/store'

export interface TodayData {
  habits: Map<string, Habit>
  active: ActiveHabitRow[]
  sessions: SessionRow[]
  totals: StatPoints
}

// Loads on open, and again whenever `dataVersion` changes.
export function useTodayData(store: Store, dataVersion = 0) {
  const [data, setData] = useState<TodayData | null>(null)

  const load = useCallback(async (): Promise<TodayData> => {
    const [habits, active, sessions, totals] = await Promise.all([
      store.habits(),
      store.activeHabits(),
      store.sessionsToday(),
      store.totals(),
    ])
    return { habits: new Map(habits.map((h) => [h.id, h])), active, sessions, totals }
  }, [store])

  const reload = useCallback(async () => setData(await load()), [load])

  // Load on open and when the list changes; ignore a result that arrives after closing.
  useEffect(() => {
    let showing = true
    void load().then((d) => showing && setData(d))
    return () => {
      showing = false
    }
  }, [load, dataVersion])

  return [data, reload] as const
}

export const minutesOn = (data: TodayData, habitId: string) =>
  data.sessions.filter((s) => s.habitId === habitId).reduce((total, s) => total + s.minutes, 0)
