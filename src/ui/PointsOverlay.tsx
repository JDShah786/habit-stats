// Points chart after LOG (step 5b; prototype in design/mockups/motion.html). A dim, a cross,
// and a diamond radar of the four stats on top. One bead per point flies from the caption into
// its stat, one at a time; each landing ticks the tally and grows the shape a step, and the
// bead that crosses a rank swells its node. Closes on its own; a tap (after 0.4 s) or Escape
// skips it. With Reduce Motion it shows the final state and fades.

import { animate } from 'motion/react'
import { memo, useEffect, useEffectEvent, useRef } from 'react'
import { createPortal } from 'react-dom'
import { rankOf, STATS, type Stat, type StatPoints } from '../engine/stats'
import { burst, centerOf, SNAP } from './motionKit'
import { beadGap, beadValues, gains, level } from './pointsChart'
import { statName } from './todayView'

interface Props {
  // e.g. "Boxing · 25 min": the habit and the minutes just logged.
  caption: string
  before: StatPoints
  after: StatPoints
  reduced: boolean
  onDone: () => void
}

// The chart's geometry, in a 300 x 300 viewBox.
const C = 150
const R = 104
const AXES: Record<Stat, [number, number]> = { charm: [0, -1], courage: [1, 0], intelligence: [0, 1], proficiency: [-1, 0] }
const at = (stat: Stat, v: number): [number, number] => [C + AXES[stat][0] * R * (v / 5), C + AXES[stat][1] * R * (v / 5)]
const shapePoints = (levels: Record<Stat, number>) => STATS.map((s) => at(s, levels[s]).join(',')).join(' ')
const levelsOf = (points: StatPoints) => Object.fromEntries(STATS.map((s) => [s, level(points[s])])) as Record<Stat, number>
const nodeRadius = (rank: number) => 9 + rank * 2.6
const rankText = (points: number) => (rankOf(points) === 5 ? 'MAX' : String(rankOf(points)))
// The cross behind it all: arms 44 wide, each ending just past a stat node.
const ARM = 22
const REACH = R + 24
const CROSS = [[-ARM, -REACH], [ARM, -REACH], [ARM, -ARM], [REACH, -ARM], [REACH, ARM], [ARM, ARM], [ARM, REACH], [-ARM, REACH], [-ARM, ARM], [-REACH, ARM], [-REACH, -ARM], [-ARM, -ARM]]
  .map(([x, y]) => `${C + x},${C + y}`)
  .join(' ')

const HOLD_MS = 900 // after the last bead lands
const CALM_HOLD_MS = 1400 // Reduce Motion: how long the final state shows
const SKIP_AFTER_MS = 400
const wait = (ms: number) => new Promise((done) => setTimeout(done, ms))

export const PointsOverlay = memo(function PointsOverlay({ caption, before, after, reduced, onDone }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const closing = useRef(false)
  const skippable = useRef(false)
  const earned = gains(before, after)
  // The first render shows where the stats start; with Reduce Motion, where they end.
  const shown = reduced ? after : before
  const startLevels = levelsOf(shown)

  const close = async () => {
    if (closing.current) return
    closing.current = true
    await animate(root.current!, { opacity: 0 }, { duration: 0.22 })
    onDone()
  }
  const skip = () => {
    if (skippable.current) void close()
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'Escape') skip()
  })
  const finish = useEffectEvent(() => void close())

  useEffect(() => {
    const el = root.current!
    const one = (selector: string) => el.querySelector(selector)!
    let live = true
    const timers = [window.setTimeout(() => (skippable.current = true), SKIP_AFTER_MS)]
    const listener = (e: KeyboardEvent) => onKey(e)
    document.addEventListener('keydown', listener)

    if (reduced) {
      void animate(el, { opacity: [0, 1] }, { duration: 0.2 })
      timers.push(window.setTimeout(() => finish(), 200 + CALM_HOLD_MS))
    } else void play()

    async function play() {
      // 1. In: the dim, the cross snaps open, the diamond spins up over it, the caption rises.
      void animate(one('.pc-dim'), { opacity: [0, 1] }, { duration: 0.2 })
      void animate(one('.pc-cross'), { scale: [0, 1], rotate: [-45, 0] }, { type: 'spring', stiffness: 340, damping: 20, delay: 0.04 })
      void animate(one('.pc-chart'), { scale: [0.5, 1], rotate: [-60, 0], opacity: [0, 1] }, { type: 'spring', stiffness: 300, damping: 22, delay: 0.1 })
      void animate(one('.pc-tag'), { y: [30, 0], opacity: [0, 1] }, { ...SNAP, delay: 0.2 })
      await wait(480)
      if (!live) return

      // 2. One bead per point, stat by stat, straight from the caption into the node.
      const from = centerOf(one('.pc-tag'))
      const grow = levelsOf(before)
      const rankNow = Object.fromEntries(STATS.map((s) => [s, rankOf(before[s])])) as Record<Stat, number>
      const flights: Promise<void>[] = []
      let launch = 0
      for (const [stat, total] of gains(before, after)) {
        const values = beadValues(total)
        let landed = 0
        for (const value of values) {
          flights.push(flyBead(stat, launch, () => land(stat, (landed += value))))
          launch += beadGap(values.length)
        }
        launch += 140 // a beat between stats
      }
      await Promise.all(flights)
      if (!live) return
      // 5. Hold a beat, then close.
      await wait(HOLD_MS)
      if (live) finish()

      async function flyBead(stat: Stat, delay: number, onLand: () => void) {
        await wait(delay)
        if (!live) return
        const [tx, ty] = centerOf(one(`[data-stat="${stat}"] circle`))
        const bead = document.createElement('i')
        bead.className = 'pc-bead'
        bead.setAttribute('aria-hidden', 'true')
        bead.style.left = `${tx}px`
        bead.style.top = `${ty}px`
        document.body.append(bead)
        await animate(bead, { x: [from[0] - tx, 0], y: [from[1] - ty, 0], scale: [1.3, 0.7] }, { duration: 0.42, ease: [0.5, 0, 0.2, 1] })
        bead.remove()
        if (live) onLand()
      }

      // 3. A bead lands: the tally ticks up, the node pulses, the shape grows a step.
      function land(stat: Stat, landed: number) {
        const points = before[stat] + landed
        const node = one(`[data-stat="${stat}"]`)
        const circle = node.querySelector('circle')!
        const tally = one(`.pc-tally[data-stat="${stat}"]`)
        tally.textContent = `+${landed}`
        void animate(tally, { scale: [1.5, 1] }, { duration: 0.22 })
        void animate(node, { scale: [1, 1.2, 1] }, { duration: 0.22 })
        burst(centerOf(circle), 4, 26)
        void animate(grow[stat], level(points), {
          duration: 0.2,
          onUpdate: (v) => {
            grow[stat] = v
            const p = shapePoints(grow)
            one('.pc-shape').setAttribute('points', p)
            one('.pc-glow').setAttribute('points', p)
          },
        })
        // 4. The bead that crosses a rank: the node swells to its new size with a ring burst.
        const rank = rankOf(points)
        if (rank > rankNow[stat]) {
          const startR = nodeRadius(rankNow[stat])
          rankNow[stat] = rank
          node.querySelector('.pc-rank')!.textContent = rankText(points)
          node.classList.toggle('max', rank === 5)
          void animate(startR, nodeRadius(rank), { type: 'spring', stiffness: 320, damping: 12, onUpdate: (r) => circle.setAttribute('r', String(r)) })
          const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
          ring.setAttribute('class', 'pc-ring')
          ring.setAttribute('cx', circle.getAttribute('cx')!)
          ring.setAttribute('cy', circle.getAttribute('cy')!)
          one('.pc-chart').append(ring)
          void animate(0, 1, {
            duration: 0.6,
            ease: 'easeOut',
            onUpdate: (p) => {
              ring.setAttribute('r', String(startR + p * 40))
              ring.style.opacity = String(1 - p)
            },
          }).then(() => ring.remove())
          burst(centerOf(circle), 22, 110)
        }
      }
    }

    return () => {
      live = false
      timers.forEach(clearTimeout)
      document.removeEventListener('keydown', listener)
      document.querySelectorAll('.pc-bead').forEach((bead) => bead.remove())
    }
    // Plays once per chart: each chart gets its own key, and its props never change.
  }, [reduced, before, after])

  return createPortal(
    <div ref={root} className="pc" role="status" aria-label="Points earned" onClick={skip}>
      <div className="pc-dim" />
      <div className="pc-stage">
        <svg className="pc-chart" viewBox="0 0 300 300" aria-hidden="true">
          <g className="pc-cross">
            <polygon className="pc-cross-shadow" points={CROSS} transform="translate(7 7)" />
            <polygon className="pc-cross-arms" points={CROSS} />
          </g>
          {[1, 2, 3, 4, 5].map((k) => (
            <polygon key={k} className={k === 5 ? 'pc-ringline top' : 'pc-ringline'} points={STATS.map((s) => at(s, k).join(',')).join(' ')} />
          ))}
          {STATS.map((s) => {
            const [x, y] = at(s, 5)
            return <line key={s} className="pc-axis" x1={C} y1={C} x2={x} y2={y} />
          })}
          <polygon className="pc-glow" points={shapePoints(startLevels)} />
          <polygon className="pc-shape" points={shapePoints(startLevels)} />
          {STATS.map((s) => {
            const [x, y] = at(s, 5)
            const side = AXES[s][0] !== 0
            const off = nodeRadius(5) + 16
            const total = after[s] - before[s]
            return (
              <g key={s}>
                <g data-stat={s} className={rankOf(shown[s]) === 5 ? 'pc-node max' : 'pc-node'}>
                  <circle cx={x} cy={y} r={nodeRadius(rankOf(shown[s]))} />
                  <text className="pc-rank" x={x} y={y}>
                    {rankText(shown[s])}
                  </text>
                </g>
                {/* Labels outside the diamond: above Charm and the side nodes, below Intelligence. */}
                <text className="pc-label" x={x} y={s === 'intelligence' ? y + nodeRadius(5) + 14 : y - nodeRadius(5) - 8}>
                  {statName(s).toUpperCase()}
                </text>
                {/* The running "+N": right of the top and bottom nodes, under the side nodes. */}
                <text className="pc-tally" data-stat={s} x={side ? x : x + off} y={side ? y + off : y}>
                  {reduced && total > 0 ? `+${total}` : ''}
                </text>
              </g>
            )
          })}
        </svg>
        <span className="pc-tag">{caption}</span>
      </div>
      <p className="sr-only">
        {earned.map(([stat, n]) => (
          <span key={stat}>{`+${n} ${statName(stat)}`}</span>
        ))}
      </p>
    </div>,
    document.body,
  )
})
