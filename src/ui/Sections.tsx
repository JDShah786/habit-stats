// The four sections side by side in one native horizontal scroll that snaps page by page: the
// iPhone's own swipe, run by the phone's graphics engine rather than our JavaScript, so it stays
// smooth while the app is busy. Tap the strip to move too. Only the current section can be
// reached; the others sit beside it, hidden and inert. The section switches once a swipe settles.

import { motion } from 'motion/react'
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { GhostWord } from './Decor'
import { burst, SECTIONS, tapPoint } from './motionKit'
import { scrollPosition, settledSection } from './sectionsScroll'

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
  const placedAtWidth = useRef<number | null>(null)
  // While a tap's smooth scroll is on its way, pages it passes must not switch the section.
  const heading = useRef<number | null>(null)
  const indexRef = useRef(index)
  useLayoutEffect(() => {
    indexRef.current = index
  }, [index])

  useLayoutEffect(() => {
    const measure = () => setWidth(viewport.current!.clientWidth)
    measure()
    addEventListener('resize', measure)
    return () => removeEventListener('resize', measure)
  }, [])

  // Where each strip button sits. Measured once (and again on resize or when the font loads), never
  // during a swipe, so moving the cursor never makes the phone re-lay the page.
  const slots = useRef<{ left: number; width: number }[]>([])
  const litAt = useRef(-1)
  const measureSlots = useCallback(() => {
    slots.current = [...strip.current!.querySelectorAll('button')].map((b) => ({ left: b.offsetLeft, width: b.offsetWidth }))
    litAt.current = -1 // sizes may have changed: set the cursor width again on the next follow
  }, [])

  // The strip's lime cursor and the background word follow the scroll, even mid-swipe. Only cheap
  // writes: a transform for position; the width and lit class change only at the midpoint.
  const follow = useCallback(
    (at: number) => {
      if (slots.current.length === 0) measureSlots()
      const s = slots.current
      const i0 = Math.floor(at)
      const i1 = Math.min(i0 + 1, LAST)
      const f = at - i0
      const mix = (a: number, b: number) => a + (b - a) * f
      const lit = Math.round(at)
      const w = s[lit].width
      const centre = mix(s[i0].left + s[i0].width / 2, s[i1].left + s[i1].width / 2)
      cursor.current!.style.transform = `translateX(${centre - w / 2}px)`
      if (lit !== litAt.current) {
        litAt.current = lit
        cursor.current!.style.width = `${w}px`
        strip.current!.querySelectorAll('button').forEach((b, i) => b.classList.toggle('lit', i === lit))
      }
      if (parallax.current) parallax.current.style.transform = `translateX(${(at - indexRef.current) * -80}px)`
    },
    [measureSlots],
  )

  // Re-measure the strip when the width changes and once Montserrat has loaded.
  useLayoutEffect(() => {
    measureSlots()
    follow(width ? scrollPosition(viewport.current!.scrollLeft, width, LAST) : index)
    void document.fonts?.ready.then(() => {
      if (!strip.current || !viewport.current) return
      measureSlots()
      follow(width ? scrollPosition(viewport.current.scrollLeft, width, LAST) : indexRef.current)
    })
  }, [width, index, measureSlots, follow])

  // Bring the scroll to the current section: jump on first show, after a resize or with Reduce
  // Motion; scroll smoothly otherwise (a tap on the strip). After a swipe it's already there.
  useLayoutEffect(() => {
    const el = viewport.current!
    const target = index * width
    if (Math.abs(el.scrollLeft - target) <= 1) {
      heading.current = null
      follow(index)
      placedAtWidth.current = width
      return
    }
    if (reduced || placedAtWidth.current !== width || typeof el.scrollTo !== 'function') {
      el.scrollLeft = target
      heading.current = null
      follow(index)
      placedAtWidth.current = width
      return
    }
    heading.current = index
    el.scrollTo({ left: target, behavior: 'smooth' })
  }, [index, width, reduced, follow])

  const onScroll = () => {
    const el = viewport.current!
    follow(scrollPosition(el.scrollLeft, width, LAST))
    const settled = settledSection(el.scrollLeft, width, LAST)
    if (settled === null) return
    if (heading.current !== null) {
      if (settled === heading.current) heading.current = null
      return
    }
    if (settled !== indexRef.current) onIndex(settled)
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
      <div
        className={reduced ? 'viewport no-swipe' : 'viewport'}
        ref={viewport}
        onScroll={onScroll}
        // A finger on the sections takes over from a tap's smooth scroll.
        onTouchStart={() => (heading.current = null)}
        onWheel={() => (heading.current = null)}
      >
        <div className="track">
          {SECTIONS.map((name, i) => (
            <section key={name} className="pane" aria-label={name} aria-hidden={i !== index} inert={i !== index}>
              {renderSection(i)}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
