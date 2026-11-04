// App shell: command-menu home, the four swipeable sections, the wipe between them, and the
// rank-up and graduation moments. Opens on the menu.

import { MotionConfig } from 'motion/react'
import { useReducer, useRef, useState } from 'react'
import type { RankEvent } from '../engine/stats'
import type { Category } from '../library/library'
import type { Store } from '../storage/store'
import { Bubbles, DateBlock } from './Decor'
import { Library } from './Library'
import { Menu } from './Menu'
import { moments, type Moment } from './moments'
import { MyHabits } from './MyHabits'
import { PointsOverlay } from './PointsOverlay'
import { gains, type Logged } from './pointsChart'
import { RankMoment } from './RankMoment'
import { usePrefersReducedMotion } from './reducedMotion'
import { Sections } from './Sections'
import { Stats } from './Stats'
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
  const [category, setCategory] = useState<Category>('fitness') // Library's last chip, while the app is open
  // Bumped when a section changes your data (adding, logging, editing, deleting), so the
  // others reload it. All four sections stay loaded for swiping.
  const [dataVersion, dataChanged] = useReducer((n: number) => n + 1, 0)
  // Rank-up and graduation moments waiting to play; the first one is on screen.
  const [queue, setQueue] = useState<{ id: number; moment: Moment }[]>([])
  const nextMomentId = useRef(0)
  const play = (events: RankEvent[]) => {
    const items = moments(events).map((moment) => ({ id: nextMomentId.current++, moment }))
    if (items.length) setQueue((q) => [...q, ...items])
  }
  // An edit's or delete's moments wait a beat (0.95 s; 0.4 s with Reduce Motion), then play
  // one at a time.
  const announce = (events: RankEvent[]) => {
    if (moments(events).length) setTimeout(() => play(events), reduced ? 400 : 950)
  }
  // A LOG that earned points shows the points chart first; its moments play once it closes.
  const [chart, setChart] = useState<(Logged & { id: number }) | null>(null)
  const nextChartId = useRef(0)
  const logged = (log: Logged) => {
    if (gains(log.before, log.after).length === 0) announce(log.events)
    else setChart({ ...log, id: nextChartId.current++ })
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
          <Menu store={store} current={index} reduced={reduced} onChoose={choose} />
        ) : (
          <Sections
            index={index}
            reduced={reduced}
            onIndex={setIndex}
            onMenu={toMenu}
            renderSection={(i) => {
              if (i === 0) return <Today store={store} dataVersion={dataVersion} onDataChange={dataChanged} onEvents={announce} onLogged={logged} onGoToLibrary={() => setIndex(1)} />
              if (i === 1)
                return (
                  <Library
                    store={store}
                    active={index === 1}
                    category={category}
                    onCategory={setCategory}
                    dataVersion={dataVersion}
                    onDataChange={dataChanged}
                  />
                )
              if (i === 2) return <Stats store={store} active={index === 2} dataVersion={dataVersion} />
              return (
                <MyHabits
                  store={store}
                  active={index === 3}
                  dataVersion={dataVersion}
                  onDataChange={dataChanged}
                  onGoToLibrary={() => setIndex(1)}
                />
              )
            }}
          />
        )}
        {chart && (
          <PointsOverlay
            key={chart.id}
            caption={chart.caption}
            before={chart.before}
            after={chart.after}
            reduced={reduced}
            onDone={() => {
              setChart(null)
              play(chart.events)
            }}
          />
        )}
        {queue[0] && (
          <RankMoment key={queue[0].id} moment={queue[0].moment} reduced={reduced} onDone={() => setQueue((q) => q.slice(1))} />
        )}
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
