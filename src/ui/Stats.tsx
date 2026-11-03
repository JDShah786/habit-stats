// Stats screen (SPEC "Screens"): the four stats with rank, title and a bar through the current
// rank. View only. Shows Graduated once all four are maxed.

import { motion } from 'motion/react'
import { useEffect, useState, type CSSProperties } from 'react'
import { STATS, type StatPoints } from '../engine/stats'
import type { Store } from '../storage/store'
import { SNAP } from './motionKit'
import { statCard } from './statsView'
import { nearestRank, statName } from './todayView'

interface Props {
  store: Store
  // True while Stats is the section on screen.
  active: boolean
  // Changes whenever your data changes; reloads the totals.
  dataVersion: number
}

const RANKS = [1, 2, 3, 4, 5]
const BAR_SPRING = { type: 'spring', stiffness: 110, damping: 18 } as const

export function Stats({ store, active, dataVersion }: Props) {
  const [totals, setTotals] = useState<StatPoints | null>(null)

  // Counts arrivals on Stats, so the cards and bars replay each time (adjusted during render).
  const [arrival, setArrival] = useState(0)
  const [wasActive, setWasActive] = useState(active)
  if (active !== wasActive) {
    setWasActive(active)
    if (active) setArrival((n) => n + 1)
  }

  useEffect(() => {
    let showing = true
    void store.totals().then((t) => showing && setTotals(t))
    return () => {
      showing = false
    }
  }, [store, dataVersion])

  if (!totals) return <h1>Stats</h1>

  return (
    <>
      <h1>Stats</h1>
      {nearestRank(totals) === 'graduated' && <p className="grad">Graduated</p>}
      <ul className="stats" aria-label="Stats">
        {STATS.map((stat, j) => {
          const { rank, title, max, fill } = statCard(stat, totals[stat])
          const delay = 0.15 + j * 0.07
          return (
            <motion.li
              key={`${stat}-${arrival}`}
              className="stat"
              style={{ '--off': `${[0, 16, 6, 22][j]}px` } as CSSProperties}
              initial={{ x: 70, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ ...SNAP, delay: j * 0.05 }}
            >
              <div className="top">
                <h2>{statName(stat)}</h2>
                <span className={max ? 'rk max' : 'rk'}>{max ? 'Max' : `Rank ${rank}`}</span>
              </div>
              <div className="ttl-row">
                <span className="ttl">{title}</span>
                <span className="pips" aria-hidden="true">
                  {RANKS.map((k) => (
                    <i key={k} className={k <= rank ? 'pip on' : 'pip'} />
                  ))}
                </span>
              </div>
              <div className="bar" aria-hidden="true">
                <motion.i className="fill" initial={{ scaleX: 0 }} animate={{ scaleX: fill }} transition={{ ...BAR_SPRING, delay }} />
              </div>
              <div className="pts">
                <b>{totals[stat]}</b> pts
              </div>
            </motion.li>
          )
        })}
      </ul>
    </>
  )
}
