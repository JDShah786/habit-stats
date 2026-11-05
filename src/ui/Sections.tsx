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

  // Where each strip button sits. Measured once (and again on resize or when the font loads), never
  // during a swipe: reading layout every frame forced the phone to re-lay the page 60 times a second.
  const slots = useRef<{ left: number; width: number }[]>([])
  const litAt = useRef(-1)
  const measureSlots = useCallback(() => {
    slots.current = [...strip.current!.querySelectorAll('button')].map((b) => ({ left: b.offsetLeft, width: b.offsetWidth }))
    litAt.current = -1 // sizes may have changed: set the cursor width again on the next follow
  }, [])

  // The strip's lime cursor and the background word follow the track, even mid-drag. Only cheap
  // writes here: a transform for position, and the lit class only when it changes.
  const follow = useCallback(
    (value: number) => {
      if (slots.current.length === 0) measureSlots()
      const s = slots.current
      const at = width ? Math.min(LAST, Math.max(0, -value / width)) : index
      const i0 = Math.floor(at)
      const i1 = Math.min(i0 + 1, LAST)
      const f = at - i0
      const mix = (a: number, b: number) => a + (b - a) * f
      // Centre the cursor on its sliding position; its width only changes when it passes the
      // midpoint (a short CSS transition smooths that), so a swipe causes no layout at all.
      const lit = Math.round(at)
      const w = s[lit].width
      const centre = mix(s[i0].left + s[i0].width / 2, s[i1].left + s[i1].width / 2)
      cursor.current!.style.transform = `translateX(${centre - w / 2}px)`
      if (lit !== litAt.current) {
        litAt.current = lit
        cursor.current!.style.width = `${w}px`
        strip.current!.querySelectorAll('button').forEach((b, i) => b.classList.toggle('lit', i === lit))
      }
      if (parallax.current && width) parallax.current.style.transform = `translateX(${(-value / width - index) * -80}px)`
    },
    [width, index, measureSlots],
  )
  useMotionValueEvent(x, 'change', follow)

  // Re-measure the strip when the viewport width changes and once Montserrat has loaded.
  useLayoutEffect(() => {
    measureSlots()
    follow(x.get())
    void document.fonts?.ready.then(() => {
      if (!strip.current) return
      measureSlots()
      follow(x.get())
    })
  }, [width, measureSlots, follow, x])

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
