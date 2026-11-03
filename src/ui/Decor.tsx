// Background pieces shared by every screen: bubbles, the tilted date block, the drifting word.

import { motion } from 'motion/react'
import { useEffect, useLayoutEffect, useReducer, useRef, type Ref } from 'react'
import { dateParts } from './dateBlock'
import { SOFT } from './motionKit'

const BUBBLES = [
  { size: 170, right: -50, top: -30 },
  { size: 50, right: 150, top: 120 },
  { size: 110, left: -40, bottom: 200 },
  { size: 24, left: 130, bottom: 320 },
  { size: 36, right: 40, bottom: 120 },
]

export function Bubbles() {
  return (
    <div className="decor" aria-hidden="true">
      <div className="stripe" />
      {BUBBLES.map(({ size, ...at }, i) => (
        <div key={i} className="bub" style={{ width: size, height: size, ...at }} />
      ))}
    </div>
  )
}

export function DateBlock({ now }: { now: () => Date }) {
  // Re-read the clock every minute so the time-of-day word and date stay current.
  const [, tick] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  const { iso, mmdd, weekday, part } = dateParts(now())
  return (
    <time className="date" dateTime={iso}>
      <span className="num">
        {mmdd.slice(0, 2)}
        <small>/</small>
        {mmdd.slice(3)}
      </span>
      <span className="day">{weekday}</span>
      <span className="part">{part}</span>
    </time>
  )
}

// Speed of the drift in px per second, the same whatever the word's length.
const DRIFT_SPEED = 22

// The faint giant word drifts left in a seamless loop (4 copies, shifted by 2), so the whole
// word reads over time. `parallaxRef` lets the swipe track nudge it while dragging.
export function GhostWord({ word, parallaxRef }: { word: string; parallaxRef?: Ref<HTMLDivElement> }) {
  const marquee = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = marquee.current
    if (!el) return
    const measure = () => {
      const loop = el.offsetWidth / 2
      el.style.setProperty('--dur', `${loop ? loop / DRIFT_SPEED : word.length * 9}s`)
    }
    measure()
    void document.fonts?.ready.then(measure) // re-measure once Montserrat has loaded
  }, [word])

  return (
    <div className="ghost" aria-hidden="true">
      <div ref={parallaxRef}>
        <motion.div key={word} className="ghost-word" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={SOFT}>
          <span ref={marquee} className="marquee">
            {`${word}  `.repeat(4)}
          </span>
        </motion.div>
      </div>
    </div>
  )
}
