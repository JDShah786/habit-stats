// Library screen (SPEC "Screens"): the presets by category, with search. Add a habit to your
// list as daily or anytime. Removing and switching kind live in My habits.

import { motion } from 'motion/react'
import { useEffect, useState, type MouseEvent } from 'react'
import { CATEGORIES, HABITS, type Category } from '../library/library'
import type { HabitKind } from '../storage/db'
import type { Store } from '../storage/store'
import { CATEGORY_LABELS, filterLibrary, statsByWeight } from './libraryView'
import { BOUNCY, burst, SNAP, tapPoint } from './motionKit'
import { usePrefersReducedMotion } from './reducedMotion'
import { statName } from './todayView'

interface Props {
  store: Store
  // True while the Library is the section on screen.
  active: boolean
  // Kept by the app, so the last chip survives a trip to the menu.
  category: Category
  onCategory: (category: Category) => void
  // Changes whenever your list changes; reloads which habits are on it.
  listVersion: number
  onListChange: () => void
}

const KIND_LABELS: Record<HabitKind, string> = { daily: 'Daily', anytime: 'Anytime' }

export function Library({ store, active, category, onCategory, listVersion, onListChange }: Props) {
  const reduced = usePrefersReducedMotion()
  const [onList, setOnList] = useState<Map<string, HabitKind> | null>(null)
  const [query, setQuery] = useState('')
  // The row showing the DAILY / ANYTIME choice. One at a time.
  const [choosing, setChoosing] = useState<string | null>(null)

  // Leaving the Library closes the choice (adjusting state during render, not in an effect).
  const [wasActive, setWasActive] = useState(active)
  if (active !== wasActive) {
    setWasActive(active)
    if (!active) setChoosing(null)
  }

  useEffect(() => {
    let showing = true
    void store.activeHabits().then((rows) => showing && setOnList(new Map(rows.map((r) => [r.habitId, r.kind]))))
    return () => {
      showing = false
    }
  }, [store, listVersion])

  if (!onList) return <h1>Library</h1>

  const searching = query.trim() !== ''
  const items = filterLibrary(HABITS, category, query)

  const add = async (habitId: string, kind: HabitKind, e: MouseEvent<HTMLButtonElement>) => {
    if (!reduced) burst(tapPoint(e), 14, 80)
    await store.addToList(habitId, kind)
    setChoosing(null)
    onListChange()
  }

  return (
    <>
      <h1>Library</h1>

      <label className="search">
        <span aria-hidden="true">Find</span>
        <input
          type="search"
          aria-label="Search habits"
          placeholder={`Search ${HABITS.length} habits`}
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setChoosing(null)
          }}
        />
      </label>

      <div className="chips" role="group" aria-label="Categories">
        {CATEGORIES.map((c) => (
          <motion.button
            key={c}
            className="chip"
            aria-pressed={!searching && c === category}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              onCategory(c)
              setQuery('')
              setChoosing(null)
            }}
          >
            {CATEGORY_LABELS[c]}
          </motion.button>
        ))}
      </div>

      {items.length === 0 && <p className="no-match">No habit matches "{query.trim()}".</p>}

      <ul className="lib" aria-label="Habits">
        {items.map((h, i) => {
          const kind = onList.get(h.id)
          return (
            <motion.li
              key={h.id}
              className={kind ? 'lib-row added' : 'lib-row'}
              initial={{ x: 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ ...SNAP, delay: Math.min(i, 10) * 0.03 }}
            >
              <div className="meta">
                <span className="name">{h.name}</span>
                <small>{statsByWeight(h.weights).map(statName).join(' · ')}</small>
              </div>
              {kind ? (
                <motion.span className="tag" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={BOUNCY}>
                  On list · {KIND_LABELS[kind]}
                </motion.span>
              ) : choosing === h.id ? (
                <div className="pick">
                  {(['daily', 'anytime'] as const).map((k, j) => (
                    <motion.button
                      key={k}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ ...BOUNCY, delay: j * 0.05 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => void add(h.id, k, e)}
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
            </motion.li>
          )
        })}
      </ul>
    </>
  )
}
