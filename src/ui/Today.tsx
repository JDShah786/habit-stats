// Today screen (SPEC "Screens"): daily checklist + anytime habits, the stat closest to its next
// rank, and a sheet to log, edit or delete today's sessions.

import { motion } from 'motion/react'
import { useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { progressOf, type RankEvent, type StatPoints } from '../engine/stats'
import type { Habit } from '../library/library'
import type { HabitKind, SessionRow } from '../storage/db'
import type { Store } from '../storage/store'
import { burst, SNAP, SOFT, tapPoint } from './motionKit'
import { usePrefersReducedMotion } from './reducedMotion'
import { Sheet } from './Sheet'
import { minutesOn, useTodayData } from './todayData'
import { statsByWeight } from './libraryView'
import type { Logged } from './pointsChart'
import { nearestRank, statName } from './todayView'

interface Props {
  store: Store
  // Changes whenever your data changes (e.g. the Library adds a habit); reloads the list.
  dataVersion: number
  // Tells the app a log, edit or delete changed your data.
  onDataChange: () => void
  // Rank events from an edit or delete.
  onEvents: (events: RankEvent[]) => void
  // A LOG: the app shows the points chart, then any rank events.
  onLogged: (log: Logged) => void
  onGoToLibrary: () => void
}

const SECTIONS: [HabitKind, string][] = [
  ['daily', 'Daily'],
  ['anytime', 'Anytime'],
]

export function Today({ store, dataVersion, onDataChange, onEvents, onLogged, onGoToLibrary }: Props) {
  const reduced = usePrefersReducedMotion()
  const [data, reload] = useTodayData(store, dataVersion)
  const [openId, setOpenId] = useState<string | null>(null)

  if (!data) return <h1>Today</h1>

  const nameOf = (habitId: string) => data.habits.get(habitId)?.name ?? habitId
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
              {rows.map(({ habitId }, i) => {
                const minutes = minutesOn(data, habitId)
                const lit = minutes > 0
                const done = kind === 'daily' && lit
                return (
                  <motion.li
                    key={habitId}
                    // Staggered offsets give the list its zig-zag edge.
                    style={{ '--off': `${[0, 14, 6, 20][i % 4]}px` } as CSSProperties}
                    initial={{ x: 60, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ ...SNAP, delay: i * 0.04 }}
                  >
                    <motion.button
                      className={lit ? 'habit-row lit' : 'habit-row'}
                      whileTap={{ scale: 0.96 }}
                      onClick={(e) => {
                        if (!reduced) burst(tapPoint(e), 8, 50)
                        setOpenId(habitId)
                      }}
                    >
                      <motion.span className="fill" aria-hidden="true" initial={false} animate={{ scaleX: lit ? 1 : 0 }} transition={SOFT} />
                      <span className="name">{nameOf(habitId)}</span>
                      <span className="minutes">
                        {minutes}
                        <small> min</small>
                      </span>
                      {kind === 'daily' && (
                        <span className={done ? 'chk on' : 'chk'}>{done && <span className="sr-only">done</span>}</span>
                      )}
                    </motion.button>
                  </motion.li>
                )
              })}
            </ul>
          </section>
        )
      })}

      <NextRank totals={data.totals} />

      {open && (
        <LogSheet
          habit={open}
          sessions={data.sessions.filter((s) => s.habitId === open.id)}
          store={store}
          reduced={reduced}
          onEvents={onEvents}
          onLogged={onLogged}
          onChange={async () => {
            await reload()
            onDataChange()
          }}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  )
}

function NextRank({ totals }: { totals: StatPoints }) {
  const next = nearestRank(totals)
  if (next === 'graduated') {
    return (
      <section className="near" aria-label="Next rank">
        <b>Graduated</b>
      </section>
    )
  }
  const { earned, needed } = progressOf(totals[next.stat])!
  return (
    <section className="near" aria-label="Next rank">
      <div className="top">
        <b>{statName(next.stat)}</b>
        {/* Like the games: which rank is next, never how many points it takes. */}
        <span className="up">Next: Rank {next.toRank}</span>
      </div>
      <div className="bar" aria-hidden="true">
        <motion.i className="fill" initial={{ scaleX: 0 }} animate={{ scaleX: earned / needed }} transition={SOFT} />
      </div>
    </section>
  )
}

const QUICK_MINUTES = [5, 10, 15, 30, 60]

// Whole minutes, 1 or more (rule 1). Storage rejects anything else too.
const isValidMinutes = (value: string) => /^\d+$/.test(value) && Number(value) >= 1

interface SheetProps {
  habit: Habit
  sessions: SessionRow[]
  store: Store
  reduced: boolean
  onEvents: (events: RankEvent[]) => void
  onLogged: (log: Logged) => void
  onChange: () => Promise<void>
  onClose: () => void
}

function LogSheet({ habit, sessions, store, reduced, onEvents, onLogged, onChange, onClose }: SheetProps) {
  const box = useRef<HTMLInputElement>(null)
  const [minutes, setMinutes] = useState('')
  const [editing, setEditing] = useState<{ id: number; minutes: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Runs a storage action; shows its reason if storage rejects it. Hands back its rank events
  // (null if it was rejected).
  const run = async (action: () => Promise<RankEvent[]>, onSuccess: () => void) => {
    setError(null)
    try {
      const events = await action()
      onSuccess()
      await onChange()
      return events
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return null
    }
  }
  // Edits and deletes: rank events only, no points chart.
  const change = async (action: () => Promise<RankEvent[]>, onSuccess: () => void) => {
    const events = await run(action, onSuccess)
    if (events) onEvents(events)
  }

  // Logging hands the app the points earned (for the chart) and the rank events (after it).
  const log = async (e: MouseEvent<HTMLButtonElement>) => {
    if (!reduced) burst(tapPoint(e), 14, 90)
    const logged = Number(minutes)
    const before = await store.totals()
    const events = await run(() => store.logSession(habit.id, logged), () => setMinutes(''))
    if (!events) return
    onLogged({ caption: `${habit.name} · ${logged} min`, before, after: await store.totals(), events })
  }

  const custom = () => {
    setMinutes('')
    box.current?.focus()
  }

  return (
    <Sheet
      title={habit.name}
      reduced={reduced}
      onClose={onClose}
      head={
        <div className="weights">
          {statsByWeight(habit.weights).map((stat) => (
            <span key={stat}>
              {statName(stat)} {habit.weights[stat]}
            </span>
          ))}
        </div>
      }
    >
      {() => (
        <>
          <div className="minutes-input">
            <input
              ref={box}
              className="mins"
              aria-label="Minutes"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              style={{ width: `${Math.max(minutes.length, 1) + 0.3}ch` }}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
            <span className="unit" aria-hidden="true">
              min
            </span>
          </div>
          <div className="quick">
            {QUICK_MINUTES.map((n) => (
              <motion.button
                key={n}
                className={minutes === String(n) ? 'on' : undefined}
                whileTap={{ scale: 0.88 }}
                onClick={() => setMinutes(String(n))}
              >
                {n}
              </motion.button>
            ))}
            <motion.button className="custom" whileTap={{ scale: 0.88 }} onClick={custom}>
              Custom
            </motion.button>
          </div>

          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}

          <div className="sess">
            <h3>Today's sessions</h3>
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
                        onClick={() => change(() => store.editSession(edit.id, Number(edit.minutes)), () => setEditing(null))}
                      >
                        Save
                      </button>
                      <button onClick={() => setEditing(null)}>Cancel</button>
                    </li>
                  ) : (
                    <li key={s.id}>
                      <span>{s.minutes} min</span>
                      <button onClick={() => setEditing({ id: s.id!, minutes: String(s.minutes) })}>Edit</button>
                      <button onClick={() => change(() => store.deleteSession(s.id!), () => {})}>Delete</button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <motion.button className="primary log" disabled={!isValidMinutes(minutes)} whileTap={{ scale: 0.95 }} onClick={log}>
            Log
          </motion.button>
        </>
      )}
    </Sheet>
  )
}
