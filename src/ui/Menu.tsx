// Command-menu home: big stacked italic words, one per section. The last section is marked.
// A card below previews today's list and opens Today.

import { motion } from 'motion/react'
import type { MouseEvent } from 'react'
import type { Store } from '../storage/store'
import { GhostWord } from './Decor'
import { burst, SECTIONS, SNAP, SOFT, tapPoint } from './motionKit'
import { minutesOn, useTodayData } from './todayData'
import { listOrder } from './todayView'

interface Props {
  store: Store
  current: number
  reduced: boolean
  onChoose: (index: number) => void
}

export function Menu({ store, current, reduced, onChoose }: Props) {
  const choose = (index: number, e: MouseEvent<HTMLButtonElement>) => {
    if (!reduced) burst(tapPoint(e), 12, 90)
    onChoose(index)
  }

  return (
    <div className="menu-view">
      <GhostWord word="HABITS" />
      <p className="tagline">What will you do today?</p>
      <nav className="menu" aria-label="Menu">
        {SECTIONS.map((name, i) => {
          const selected = i === current
          return (
            <motion.button
              key={name}
              className={selected ? 'sel' : undefined}
              aria-current={selected ? 'true' : undefined}
              initial={{ x: 160, opacity: 0 }}
              // The selected word jolts as the highlight lands on it.
              animate={{ x: 0, opacity: 1, rotate: selected ? [-8, 0] : 0, scale: selected ? [1.15, 1] : 1 }}
              transition={{ ...SNAP, delay: i * 0.05 }}
              whileTap={{ scale: 0.93 }}
              onClick={(e) => choose(i, e)}
            >
              {name}
            </motion.button>
          )
        })}
      </nav>
      <motion.button
        className="card"
        initial={{ y: 90, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...SOFT, delay: 0.1 }}
        whileTap={{ scale: 0.96 }}
        onClick={(e) => choose(0, e)}
      >
        <TodayCard store={store} />
      </motion.button>
    </div>
  )
}

const CARD_ROWS = 3

function TodayCard({ store }: { store: Store }) {
  const [data] = useTodayData(store)
  const title = <span className="card-title">Today's list</span>
  if (!data) return title

  const nameOf = (habitId: string) => data.habits.get(habitId)?.name ?? habitId
  const list = listOrder(data.active, nameOf)
  const daily = list.filter((a) => a.kind === 'daily')
  const dailyDone = daily.filter((a) => minutesOn(data, a.habitId) > 0).length

  return (
    <>
      {title}
      {list.length === 0 && <span className="card-row">Nothing on your list yet.</span>}
      {list.slice(0, CARD_ROWS).map(({ habitId }) => {
        const minutes = minutesOn(data, habitId)
        return (
          <span key={habitId} className="card-row">
            <i className={minutes > 0 ? 'on' : undefined} aria-hidden="true" />
            <span className="nm">{nameOf(habitId)}</span>
            <em>{minutes}m</em>
          </span>
        )
      })}
      {list.length > CARD_ROWS && <span className="card-more">+{list.length - CARD_ROWS} more</span>}
      {daily.length > 0 && (
        <span className="card-count">
          {dailyDone} of {daily.length} daily done
        </span>
      )}
    </>
  )
}
