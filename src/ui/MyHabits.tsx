// My habits screen (SPEC "Screens"): your list (switch daily/anytime, remove with Undo), your
// custom habits that are off the list (add one back), and a sheet to make a new custom habit.

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Weights } from '../engine/scoring'
import { STATS, type Stat } from '../engine/stats'
import { CATEGORIES, type Category, type Habit } from '../library/library'
import type { ActiveHabitRow, HabitKind } from '../storage/db'
import type { Store } from '../storage/store'
import { categoryStats, defaultWeights, nameError, weightsTotal } from './customHabit'
import { CATEGORY_LABELS, KIND_LABELS, statsByWeight } from './libraryView'
import { BOUNCY, burst, SNAP, tapPoint } from './motionKit'
import { usePrefersReducedMotion } from './reducedMotion'
import { Sheet } from './Sheet'
import { listOrder, statName } from './todayView'

interface Props {
  store: Store
  // True while My habits is the section on screen.
  active: boolean
  // Changes whenever your data changes; reloads the lists.
  dataVersion: number
  onDataChange: () => void
  onGoToLibrary: () => void
}

interface Loaded {
  habits: Habit[]
  active: ActiveHabitRow[]
}

// The last removed row, for Undo. Only the latest remove can be undone.
interface Removed {
  id: number
  row: ActiveHabitRow
}

const UNDO_MS = 5000
const other = (kind: HabitKind): HabitKind => (kind === 'daily' ? 'anytime' : 'daily')
// 'custom-' is reserved for custom habit ids (SPEC "Habit library").
const isCustom = (habitId: string) => habitId.startsWith('custom-')

export function MyHabits({ store, active, dataVersion, onDataChange, onGoToLibrary }: Props) {
  const reduced = usePrefersReducedMotion()
  const [data, setData] = useState<Loaded | null>(null)
  const [removed, setRemoved] = useState<Removed | null>(null)
  // The custom habit row showing the DAILY / ANYTIME choice. One at a time.
  const [choosing, setChoosing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Leaving My habits closes the toast and the choice (adjusting state during render).
  const [wasActive, setWasActive] = useState(active)
  if (active !== wasActive) {
    setWasActive(active)
    if (!active) {
      setRemoved(null)
      setChoosing(null)
    }
  }

  useEffect(() => {
    let showing = true
    void Promise.all([store.habits(), store.activeHabits()]).then(([habits, active]) => showing && setData({ habits, active }))
    return () => {
      showing = false
    }
  }, [store, dataVersion])

  // The toast goes after 5 s. A new remove makes a new object, which restarts the timer.
  useEffect(() => {
    if (!removed) return
    const timer = setTimeout(() => setRemoved(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [removed])

  if (!data) return <h1>My habits</h1>

  const byId = new Map(data.habits.map((h) => [h.id, h]))
  const nameOf = (habitId: string) => byId.get(habitId)?.name ?? habitId
  const listed = listOrder(data.active, nameOf)
  const onList = new Set(data.active.map((a) => a.habitId))
  const offList = data.habits.filter((h) => isCustom(h.id) && !onList.has(h.id)).sort((a, b) => a.name.localeCompare(b.name))

  const switchKind = async ({ habitId, kind }: ActiveHabitRow) => {
    await store.setKind(habitId, other(kind))
    onDataChange()
  }

  const remove = async (habitId: string) => {
    const row = await store.removeFromList(habitId)
    if (row) setRemoved((r) => ({ id: (r?.id ?? 0) + 1, row }))
    onDataChange()
  }

  const undo = async () => {
    if (!removed) return
    setRemoved(null)
    await store.restoreToList(removed.row)
    onDataChange()
  }

  const addBack = async (habitId: string, kind: HabitKind, e: MouseEvent<HTMLButtonElement>) => {
    if (!reduced) burst(tapPoint(e), 14, 80)
    await store.addToList(habitId, kind)
    setChoosing(null)
    onDataChange()
  }

  const stats = (habitId: string) => {
    const h = byId.get(habitId)
    return h ? statsByWeight(h.weights).map(statName).join(' · ') : ''
  }

  return (
    <>
      <h1>My habits</h1>

      <motion.button className="new-habit" whileTap={{ scale: 0.95 }} onClick={() => setCreating(true)}>
        <span aria-hidden="true">+ </span>Add custom habit
      </motion.button>

      <section aria-label="Your list">
        <h2>Your list</h2>
        {listed.length === 0 ? (
          <div className="empty">
            <p>Your list is empty.</p>
            <button className="primary" onClick={onGoToLibrary}>
              Go to Library
            </button>
          </div>
        ) : (
          <ul className="lib" aria-label="Your list">
            <AnimatePresence mode="popLayout">
              {listed.map((row, i) => (
                <motion.li
                  key={row.habitId}
                  className="lib-row mine"
                  // The rows below glide up into the gap instead of jumping.
                  layout="position"
                  initial={{ x: 60, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  // Slides away on remove. With Reduce Motion there's no exit, so it goes at once.
                  exit={reduced ? undefined : { x: -360, opacity: 0, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } }}
                  transition={{ ...SNAP, delay: Math.min(i, 10) * 0.03 }}
                >
                  <div className="meta">
                    <span className="name">{nameOf(row.habitId)}</span>
                    <small>
                      {isCustom(row.habitId) && <b className="ctag">Custom</b>}
                      {stats(row.habitId)}
                    </small>
                  </div>
                  <motion.button
                    className={`kind ${row.kind}`}
                    whileTap={{ scale: 0.88 }}
                    onClick={() => void switchKind(row)}
                  >
                    {KIND_LABELS[row.kind]}
                    <span className="sr-only">, switch to {KIND_LABELS[other(row.kind)]}</span>
                  </motion.button>
                  <motion.button className="remove" aria-label="Remove" whileTap={{ scale: 0.85 }} onClick={() => void remove(row.habitId)}>
                    −
                  </motion.button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      {offList.length > 0 && (
        <section aria-label="Your custom habits">
          <h2>Your custom habits</h2>
          <ul className="lib" aria-label="Your custom habits">
            {offList.map((h) => (
              <li key={h.id} className="lib-row">
                <div className="meta">
                  <span className="name">{h.name}</span>
                  <small>{stats(h.id)}</small>
                </div>
                {choosing === h.id ? (
                  <div className="pick">
                    {(['daily', 'anytime'] as const).map((k, j) => (
                      <motion.button
                        key={k}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ ...BOUNCY, delay: j * 0.05 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => void addBack(h.id, k, e)}
                      >
                        {KIND_LABELS[k]}
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <motion.button
                    className="add"
                    aria-label={`Add ${h.name}`}
                    whileTap={{ scale: 0.85 }}
                    onClick={(e) => {
                      if (!reduced) burst(tapPoint(e), 8, 45)
                      setChoosing(h.id)
                    }}
                  >
                    +
                  </motion.button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Room to scroll the last row above the toast while it shows. */}
      {removed && <div className="toast-space" aria-hidden="true" />}

      {/* In <body>, like the sheets, so it stays put while the track moves. */}
      {removed &&
        createPortal(
          <motion.div
            key={removed.id}
            role="status"
            className="toast"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={SNAP}
          >
            <span>Removed. Its history stays.</span>
            <button onClick={() => void undo()}>Undo</button>
          </motion.div>,
          document.body,
        )}

      {creating && (
        <NewHabitSheet
          taken={data.habits.map((h) => h.name)}
          store={store}
          reduced={reduced}
          onSaved={onDataChange}
          onClose={() => setCreating(false)}
        />
      )}
    </>
  )
}

interface SheetProps {
  // Every preset and custom habit name; a new name can't match any of them.
  taken: string[]
  store: Store
  reduced: boolean
  onSaved: () => void
  onClose: () => void
}

function NewHabitSheet({ taken, store, reduced, onSaved, onClose }: SheetProps) {
  const nameId = useId()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  // Key order is the order the stats were picked: the first ones get any spare 10s.
  const [weights, setWeights] = useState<Weights>({})
  const [kind, setKind] = useState<HabitKind>('daily')
  const [error, setError] = useState<string | null>(null)

  const picked = Object.keys(weights) as Stat[]
  const total = weightsTotal(weights)
  const nameProblem = nameError(name, taken)
  const canSave = !nameProblem && category !== null && total === 100

  // A category picks its default stats; any stat change resets to an even split.
  const pickCategory = (c: Category) => {
    setCategory(c)
    setWeights(defaultWeights(categoryStats(c)))
  }
  const toggleStat = (stat: Stat) =>
    setWeights(defaultWeights(picked.includes(stat) ? picked.filter((s) => s !== stat) : [...picked, stat]))
  const step = (stat: Stat, by: number) => setWeights((w) => ({ ...w, [stat]: w[stat]! + by }))

  const save = async (close: () => void) => {
    setError(null)
    try {
      const id = await store.saveCustomHabit({ name, category: category!, weights })
      await store.addToList(id, kind)
      onSaved()
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Sheet title="New custom habit" reduced={reduced} onClose={onClose}>
      {(close) => (
        <>
          <div className="field">
            <label htmlFor={nameId}>Name</label>
            <input id={nameId} autoComplete="off" enterKeyHint="done" value={name} onChange={(e) => setName(e.target.value)} />
            {name !== '' && nameProblem && <p className="error">{nameProblem}</p>}
          </div>

          <fieldset>
            <legend>Category</legend>
            <div className="chips">
              {CATEGORIES.map((c) => (
                <button key={c} className="chip" aria-pressed={c === category} onClick={() => pickCategory(c)}>
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Stats</legend>
            <div className="chips">
              {STATS.map((s) => (
                <button key={s} className="chip" aria-pressed={picked.includes(s)} onClick={() => toggleStat(s)}>
                  {statName(s)}
                </button>
              ))}
            </div>
            {picked.length > 0 && (
              <div className="split">
                {STATS.filter((s) => picked.includes(s)).map((s) => (
                  <div key={s} className="split-row">
                    <span>{statName(s)}</span>
                    <button aria-label={`Less ${statName(s)}`} disabled={weights[s]! <= 10} onClick={() => step(s, -10)}>
                      −
                    </button>
                    <output aria-label={`${statName(s)} weight`}>{weights[s]}</output>
                    <button aria-label={`More ${statName(s)}`} disabled={weights[s]! >= 100} onClick={() => step(s, 10)}>
                      +
                    </button>
                  </div>
                ))}
                <p className={total === 100 ? 'total' : 'total off'}>{`Total ${total} / 100`}</p>
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend>Show as</legend>
            <div className="chips">
              {(['daily', 'anytime'] as const).map((k) => (
                <button key={k} className="chip" aria-pressed={k === kind} onClick={() => setKind(k)}>
                  {KIND_LABELS[k]}
                </button>
              ))}
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}

          <motion.button className="primary save" disabled={!canSave} whileTap={{ scale: 0.95 }} onClick={() => void save(close)}>
            Save
          </motion.button>
        </>
      )}
    </Sheet>
  )
}
