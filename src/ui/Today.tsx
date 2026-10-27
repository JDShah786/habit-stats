// Today screen (SPEC "Screens"): daily checklist + anytime habits, and a sheet to log,
// edit or delete today's sessions.

import { useCallback, useEffect, useId, useState } from 'react'
import type { RankEvent } from '../engine/stats'
import type { Habit } from '../library/library'
import type { ActiveHabitRow, HabitKind, SessionRow } from '../storage/db'
import type { Store } from '../storage/store'

interface Props {
  store: Store
  onEvents: (events: RankEvent[]) => void
  onGoToLibrary: () => void
}

interface Data {
  habits: Map<string, Habit>
  active: ActiveHabitRow[]
  sessions: SessionRow[]
}

const SECTIONS: [HabitKind, string][] = [
  ['daily', 'Daily'],
  ['anytime', 'Anytime'],
]

export function Today({ store, onEvents, onGoToLibrary }: Props) {
  const [data, setData] = useState<Data | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async (): Promise<Data> => {
    const [habits, active, sessions] = await Promise.all([store.habits(), store.activeHabits(), store.sessionsToday()])
    return { habits: new Map(habits.map((h) => [h.id, h])), active, sessions }
  }, [store])

  const reload = useCallback(async () => setData(await load()), [load])

  // Load once on open; ignore the result if the screen closed first.
  useEffect(() => {
    let showing = true
    void load().then((d) => showing && setData(d))
    return () => {
      showing = false
    }
  }, [load])

  if (!data) return <h1>Today</h1>

  const nameOf = (habitId: string) => data.habits.get(habitId)?.name ?? habitId
  const sessionsOf = (habitId: string) => data.sessions.filter((s) => s.habitId === habitId)
  const minutesOf = (habitId: string) => sessionsOf(habitId).reduce((total, s) => total + s.minutes, 0)
  const open = openId ? data.habits.get(openId) : undefined

  return (
    <>
      <h1>Today</h1>

      {data.active.length === 0 && (
        <div className="empty">
          <p>No habits on your list yet.</p>
          <button className="primary" onClick={onGoToLibrary}>
            Go to Library
          </button>
        </div>
      )}

      {SECTIONS.map(([kind, title]) => {
        const rows = data.active
          .filter((a) => a.kind === kind)
          .sort((a, b) => nameOf(a.habitId).localeCompare(nameOf(b.habitId)))
        if (rows.length === 0) return null
        return (
          <section key={kind} aria-label={title}>
            <h2>{title}</h2>
            <ul className="rows">
              {rows.map(({ habitId }) => {
                const minutes = minutesOf(habitId)
                const done = kind === 'daily' && minutes > 0
                return (
                  <li key={habitId}>
                    <button className={done ? 'habit-row done' : 'habit-row'} onClick={() => setOpenId(habitId)}>
                      <span className="name">{nameOf(habitId)}</span>
                      <span className="minutes">{minutes} min</span>
                      {done && (
                        <span className="tick">
                          <span aria-hidden="true">✓</span>
                          <span className="sr-only">done</span>
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      {open && (
        <LogSheet
          habit={open}
          sessions={sessionsOf(open.id)}
          store={store}
          onEvents={onEvents}
          onChange={reload}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  )
}

const QUICK_MINUTES = [5, 10, 15, 30, 60]

// Whole minutes, 1 or more (rule 1). Storage rejects anything else too.
const isValidMinutes = (value: string) => /^\d+$/.test(value) && Number(value) >= 1

interface SheetProps {
  habit: Habit
  sessions: SessionRow[]
  store: Store
  onEvents: (events: RankEvent[]) => void
  onChange: () => Promise<void>
  onClose: () => void
}

function LogSheet({ habit, sessions, store, onEvents, onChange, onClose }: SheetProps) {
  const titleId = useId()
  const [minutes, setMinutes] = useState('')
  const [editing, setEditing] = useState<{ id: number; minutes: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Runs a storage action; shows its reason if storage rejects it.
  const run = async (action: () => Promise<RankEvent[]>, onSuccess: () => void) => {
    setError(null)
    try {
      onEvents(await action())
      onSuccess()
      await onChange()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const total = sessions.reduce((sum, s) => sum + s.minutes, 0)

  return (
    <div className="sheet-backdrop">
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="sheet-head">
          <h2 id={titleId}>{habit.name}</h2>
          <button onClick={onClose}>Close</button>
        </header>

        <p className="muted">Total today: {total} min</p>

        {sessions.length === 0 ? (
          <p className="muted">No sessions yet today.</p>
        ) : (
          <ul role="list" aria-label="Today's sessions" className="sessions">
            {sessions.map((s) => {
              const edit = editing?.id === s.id ? editing : null
              return edit ? (
                <li key={s.id}>
                  <label>
                    Edit minutes
                    <input
                      inputMode="numeric"
                      value={edit.minutes}
                      onChange={(e) => setEditing({ id: edit.id, minutes: e.target.value })}
                    />
                  </label>
                  <button
                    disabled={!isValidMinutes(edit.minutes)}
                    onClick={() => run(() => store.editSession(edit.id, Number(edit.minutes)), () => setEditing(null))}
                  >
                    Save
                  </button>
                  <button onClick={() => setEditing(null)}>Cancel</button>
                </li>
              ) : (
                <li key={s.id}>
                  <span>{s.minutes} min</span>
                  <button onClick={() => setEditing({ id: s.id!, minutes: String(s.minutes) })}>Edit</button>
                  <button onClick={() => run(() => store.deleteSession(s.id!), () => {})}>Delete</button>
                </li>
              )
            })}
          </ul>
        )}

        <label className="minutes-input">
          Minutes
          <input inputMode="numeric" pattern="[0-9]*" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </label>
        <div className="quick">
          {QUICK_MINUTES.map((n) => (
            <button key={n} onClick={() => setMinutes(String(n))}>
              {n}
            </button>
          ))}
        </div>
        <button
          className="primary"
          disabled={!isValidMinutes(minutes)}
          onClick={() => run(() => store.logSession(habit.id, Number(minutes)), () => setMinutes(''))}
        >
          Log
        </button>

        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
