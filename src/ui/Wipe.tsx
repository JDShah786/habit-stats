// Diagonal lime wipe between the menu and the sections. The screen swaps while it's covered.

import { animate, stagger } from 'motion/react'
import { useEffect, useEffectEvent, useRef } from 'react'

const EASE = [0.7, 0, 0.3, 1] as const
// Covering starts fast, so the bars show on the very next frames after the tap's bubble pop.
const COVER_EASE = [0.3, 0.5, 0.3, 1] as const
// The bars start just off-screen (95%: the closest that stays hidden at 360–430 px with the
// tilt), not far away, so no time is spent moving out of sight.

interface Props {
  direction: 1 | -1
  onCovered: () => void
  onDone: () => void
}

export function Wipe({ direction, onCovered, onDone }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const from = direction > 0 ? '-95%' : '95%'
  const to = direction > 0 ? '130%' : '-130%'

  // Effect events: always the latest callbacks, without restarting the wipe when they change.
  const covered = useEffectEvent(onCovered)
  const done = useEffectEvent(onDone)

  useEffect(() => {
    const bars = [...ref.current!.children]
    let live = true // false once unmounted (or on React's dev-mode remount)
    void (async () => {
      await animate(bars, { x: [from, '0%'] }, { duration: 0.26, ease: COVER_EASE, delay: stagger(0.05) })
      if (!live) return
      covered()
      await animate(bars, { x: ['0%', to] }, { duration: 0.3, ease: EASE, delay: stagger(0.05) })
      if (live) done()
    })()
    return () => {
      live = false
    }
  }, [from, to])

  return (
    <div ref={ref} className="wipe" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <i key={i} style={{ transform: `translateX(${from})` }} />
      ))}
    </div>
  )
}
