// Today screen (SPEC "Screens"): daily checklist + anytime habits, the stat closest to its next
// rank, and a sheet to log, edit or delete today's sessions.

import { motion, useDragControls, type PanInfo } from 'motion/react'
import { useId, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { progressOf, STATS, type RankEvent, type Stat, type StatPoints } from '../engine/stats'
import type { Habit } from '../library/library'
import type { HabitKind, SessionRow } from '../storage/db'
import type { Store } from '../storage/store'
import { burst, SNAP, SOFT, tapPoint } from './motionKit'
import { usePrefersReducedMotion } from './reducedMotion'
import { minutesOn, useTodayData } from './todayData'
import { statsByWeight } from './libraryView'
import { nearestRank, statName } from './todayView'

interface Props {
  store: Store
  // Changes whenever your list changes elsewhere (e.g. the Library); reloads the list.
  listVersion: number
  onEvents: (events: RankEvent[]) => void
  onGoToLibrary: () => void
}

const SECTIONS: [HabitKind, string][] = [
  ['daily', 'Daily'],
  ['anytime', 'Anytime'],
]

export function Today({ store, listVersion, onEvents, onGoToLibrary }: Props) {
  const reduced = usePrefersReducedMotion()
  const [data, reload] = useTodayData(store, listVersion)
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

      {/* Rendered into <body>: inside the moving swipe track, position: fixed would follow the track. */}
      {open &&
        createPortal(
          <LogSheet
            habit={open}
            sessions={data.sessions.filter((s) => s.habitId === open.id)}
            store={store}
            reduced={reduced}
            onEvents={onEvents}
            onChange={reload}
            onClose={() => setOpenId(null)}
          />,
          document.body,
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
        <span className="up">
          {next.pointsLeft} to Rank {next.toRank}
        </span>
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

// Pulling the sheet down this far, or flicking it this fast, closes it.
const CLOSE_DISTANCE = 90
const CLOSE_SPEED = 600

interface SheetProps {
  habit: Habit
  sessions: SessionRow[]
  store: Store
  reduced: boolean
  onEvents: (events: RankEvent[]) => void
  onChange: () => Promise<void>
  onClose: () => void
}

interface Gains {
  id: number
  points: [Stat, number][]
}

function LogSheet({ habit, sessions, store, reduced, onEvents, onChange, onClose }: SheetProps) {
  const titleId = useId()
  const box = useRef<HTMLInputElement>(null)
  const drag = useDragControls()
  const [minutes, setMinutes] = useState('')
  const [editing, setEditing] = useState<{ id: number; minutes: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [gains, setGains] = useState<Gains | null>(null)
  const [closing, setClosing] = useState(false)

  // Slide away, then close (see onAnimationComplete). With Reduce Motion, close at once.
  const close = () => (reduced ? onClose() : setClosing(true))

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > CLOSE_DISTANCE || info.velocity.y > CLOSE_SPEED) close()
  }

  // Runs a storage action; shows its reason if storage rejects it. Any earlier gains clear.
  // True if it worked.
  const run = async (action: () => Promise<RankEvent[]>, onSuccess: () => void) => {
    setError(null)
    setGains(null)
    try {
      onEvents(await action())
      onSuccess()
      await onChange()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  // Logging floats the points each stat gained. Edits and deletes stay silent.
  const log = async (e: MouseEvent<HTMLButtonElement>) => {
    if (!reduced) burst(tapPoint(e), 14, 90)
    const before = await store.totals()
    if (!(await run(() => store.logSession(habit.id, Number(minutes)), () => setMinutes('')))) return
    const after = await store.totals()
    const points = STATS.filter((s) => after[s] > before[s]).map((s): [Stat, number] => [s, after[s] - before[s]])
    if (points.length) setGains((g) => ({ id: (g?.id ?? 0) + 1, points }))
  }

  const custom = () => {
    setMinutes('')
    box.current?.focus()
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={() => close()} />
      <motion.div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ y: reduced ? 0 : '100%' }}
        animate={{ y: closing ? '110%' : 0 }}
        transition={closing ? { duration: 0.24, ease: [0.4, 0, 1, 1] } : { type: 'spring', stiffness: 420, damping: 34 }}
        onAnimationComplete={() => closing && onClose()}
        drag="y"
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.05, bottom: 1 }}
        onDragEnd={onDragEnd}
      >
        {/* Grab the top of the sheet to drag it down; the rest scrolls and types as normal. */}
        <div className="sheet-grab" onPointerDown={(e) => drag.start(e)}>
          <div className="handle" aria-hidden="true" />
          <header className="sheet-head">
            <h2 id={titleId}>{habit.name}</h2>
            <button className="close" aria-label="Close" onClick={() => close()}>
              ✕
            </button>
          </header>
          <div className="weights">
            {statsByWeight(habit.weights).map((stat) => (
              <span key={stat}>
                {statName(stat)} {habit.weights[stat]}
              </span>
            ))}
          </div>
        </div>

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
          <div className="gains" aria-live="polite">
            {gains?.points.map(([stat, n], k) => (
              <motion.span
                key={`${gains.id}-${stat}`}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: -30, opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.6, delay: k * 0.15, ease: 'easeOut' }}
              >
                +{n} {statName(stat)}
              </motion.span>
            ))}
          </div>
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
        </div>

        <motion.button className="primary log" disabled={!isValidMinutes(minutes)} whileTap={{ scale: 0.95 }} onClick={log}>
          Log
        </motion.button>
      </motion.div>
    </>
  )
}
