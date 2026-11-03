// App shell: command-menu home, the four swipeable sections, the wipe between them, and the
// rank banner. Opens on the menu.

import { MotionConfig } from 'motion/react'
import { useRef, useState } from 'react'
import type { RankEvent } from '../engine/stats'
import type { Store } from '../storage/store'
import { hasAnnouncement } from './announce'
import { Bubbles, DateBlock } from './Decor'
import { Menu } from './Menu'
import { SECTIONS } from './motionKit'
import { RankBanner } from './RankBanner'
import { usePrefersReducedMotion } from './reducedMotion'
import { Sections } from './Sections'
import { Today } from './Today'
import { Wipe } from './Wipe'

interface Props {
  store: Store
  // The clock for the date block; tests pass a fixed time.
  now?: () => Date
}

interface Wiping {
  id: number
  direction: 1 | -1
  swap: () => void
}

export function App({ store, now = () => new Date() }: Props) {
  const reduced = usePrefersReducedMotion()
  const [view, setView] = useState<'menu' | 'sections'>('menu')
  const [index, setIndex] = useState(0) // current section, or the last one when on the menu
  const [wipe, setWipe] = useState<Wiping | null>(null)
  // True from a menu/MENU tap until the screen has swapped: taps in between are ignored.
  const busy = useRef(false)
  const [events, setEvents] = useState<RankEvent[]>([])
  // A banner stays until dismissed; only a new announcement replaces it.
  const announce = (next: RankEvent[]) => {
    if (hasAnnouncement(next)) setEvents(next)
  }

  // Swap screens behind the wipe, or at once with Reduce Motion.
  const change = (swap: () => void, direction: 1 | -1) => {
    if (reduced) return swap()
    busy.current = true
    setWipe((w) => ({ id: (w?.id ?? 0) + 1, direction, swap }))
  }
  const choose = (i: number) => {
    if (busy.current) return
    setIndex(i)
    change(() => setView('sections'), 1)
  }
  const toMenu = () => {
    if (busy.current) return
    change(() => setView('menu'), -1)
  }

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <div className={reduced ? 'stage still' : 'stage'}>
        <Bubbles />
        <DateBlock now={now} />
        {view === 'menu' ? (
          <Menu current={index} reduced={reduced} onChoose={choose} />
        ) : (
          <Sections
            index={index}
            reduced={reduced}
            onIndex={setIndex}
            onMenu={toMenu}
            renderSection={(i) =>
              i === 0 ? <Today store={store} onEvents={announce} onGoToLibrary={() => setIndex(1)} /> : <ComingSoon title={SECTIONS[i]} />
            }
          />
        )}
        <RankBanner events={events} onDismiss={() => setEvents([])} />
        {wipe && (
          <Wipe
            key={wipe.id}
            direction={wipe.direction}
            onCovered={() => {
              wipe.swap()
              busy.current = false
            }}
            onDone={() => setWipe((w) => (w?.id === wipe.id ? null : w))}
          />
        )}
      </div>
    </MotionConfig>
  )
}

// Stand-in until each section's own PR lands.
function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <h1>{title}</h1>
      <p className="soon">Coming soon</p>
    </>
  )
}
