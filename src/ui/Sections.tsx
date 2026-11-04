// The four sections side by side on one track. Swipe, or tap the strip, to move between them.
// Only the current section can be reached; the others sit beside it, hidden and inert.

import { animate, motion, useMotionValue, useMotionValueEvent, type PanInfo } from 'motion/react'
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { GhostWord } from './Decor'
import { burst, SECTIONS, tapPoint } from './motionKit'

const TRACK_SPRING = { type: 'spring', stiffness: 380, damping: 38 } as const
const LAST = SECTIONS.length - 1

interface Props {
  index: number
  reduced: boolean
  onIndex: (index: number) => void
  onMenu: () => void
  renderSection: (index: number) => ReactNode
}

export function Sections({ index, reduced, onIndex, onMenu, renderSection }: Props) {
  const viewport = useRef<HTMLDivElement>(null)
  const strip = useRef<HTMLDivElement>(null)
  const cursor = useRef<HTMLSpanElement>(null)
  const parallax = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const x = useMotionValue(0)
  const releaseVelocity = useRef(0)
  const dragged = useRef(false)
  const placedAtWidth = useRef<number | null>(null)

  useLayoutEffect(() => {
    const measure = () => setWidth(viewport.current!.clientWidth)
    measure()
    addEventListener('resize', measure)
    return () => removeEventListener('resize', measure)
  }, [])

  // The strip's lime cursor and the background word follow the track, even mid-drag.
  const follow = useCallback(
    (value: number) => {
      const buttons = [...strip.current!.querySelectorAll('button')]
      const at = width ? Math.min(LAST, Math.max(0, -value / width)) : index
      const i0 = Math.floor(at)
      const i1 = Math.min(i0 + 1, LAST)
      const f = at - i0
      const mix = (a: number, b: number) => a + (b - a) * f
      cursor.current!.style.left = `${mix(buttons[i0].offsetLeft, buttons[i1].offsetLeft)}px`
      cursor.current!.style.width = `${mix(buttons[i0].offsetWidth, buttons[i1].offsetWidth)}px`
      buttons.forEach((b, i) => b.classList.toggle('lit', i === Math.round(at)))
      if (parallax.current && width) parallax.current.style.transform = `translateX(${(-value / width - index) * -80}px)`
    },
    [width, index],
  )
  useMotionValueEvent(x, 'change', follow)

  // Move the track to the current section: jump on first show, after a resize or with
  // Reduce Motion; spring otherwise.
  useLayoutEffect(() => {
    const target = -index * width
    if (reduced || placedAtWidth.current !== width) {
      x.set(target)
      follow(target)
      placedAtWidth.current = width
      return
    }
    const run = animate(x, target, { ...TRACK_SPRING, velocity: releaseVelocity.current })
    releaseVelocity.current = 0
    return () => run.stop()
  }, [index, width, reduced, x, follow])

  const onDragEnd = (_: unknown, { offset, velocity }: PanInfo) => {
    let next = index
    if (offset.x < -width * 0.2 || velocity.x < -500) next++
    else if (offset.x > width * 0.2 || velocity.x > 500) next--
    next = Math.min(LAST, Math.max(0, next))
    releaseVelocity.current = velocity.x
    if (next !== index) onIndex(next)
    else void animate(x, -index * width, { ...TRACK_SPRING, velocity: velocity.x })
    setTimeout(() => (dragged.current = false))
  }

  return (
    <div className="sections-view">
      <GhostWord word={SECTIONS[index].toUpperCase()} parallaxRef={parallax} />
      <motion.button
        className="menu-btn"
        whileTap={{ scale: 0.93 }}
        onClick={(e) => {
          if (!reduced) burst(tapPoint(e), 8, 50)
          onMenu()
        }}
      >
        Menu
      </motion.button>
      <nav className="strip" aria-label="Sections" ref={strip}>
        <span className="cursor" ref={cursor} aria-hidden="true" />
        {SECTIONS.map((name, i) => (
          <button key={name} aria-current={i === index ? 'page' : undefined} onClick={() => onIndex(i)}>
            {name}
          </button>
        ))}
      </nav>
      <div className="viewport" ref={viewport}>
        <motion.div
          className="track"
          style={{ x }}
          drag={reduced ? false : 'x'}
          dragDirectionLock
          dragConstraints={{ left: -LAST * width, right: 0 }}
          dragElastic={0.35}
          dragMomentum={false}
          onDragStart={() => (dragged.current = true)}
          onDragEnd={onDragEnd}
          // A swipe that ends over a habit must not also open it.
          onClickCapture={(e) => {
            if (dragged.current) {
              e.stopPropagation()
              e.preventDefault()
            }
          }}
        >
          {SECTIONS.map((name, i) => (
            <section key={name} className="pane" aria-label={name} aria-hidden={i !== index} inert={i !== index}>
              {renderSection(i)}
            </section>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
