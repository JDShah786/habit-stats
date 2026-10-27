// App shell: the current screen, the rank banner, and the bottom tab bar.

import { useState } from 'react'
import type { RankEvent } from '../engine/stats'
import type { Store } from '../storage/store'
import { RankBanner } from './RankBanner'
import { Today } from './Today'

const SCREENS = ['Today', 'Library', 'Stats', 'My habits'] as const
type Screen = (typeof SCREENS)[number]

export function App({ store }: { store: Store }) {
  const [screen, setScreen] = useState<Screen>('Today')
  const [events, setEvents] = useState<RankEvent[]>([])

  return (
    <div className="app">
      <main className="screen">
        {screen === 'Today' ? (
          <Today store={store} onEvents={setEvents} onGoToLibrary={() => setScreen('Library')} />
        ) : (
          <ComingSoon title={screen} />
        )}
      </main>

      <RankBanner events={events} onDismiss={() => setEvents([])} />

      <nav className="tabs" aria-label="Screens">
        {SCREENS.map((name) => (
          <button key={name} aria-current={screen === name ? 'page' : undefined} onClick={() => setScreen(name)}>
            {name}
          </button>
        ))}
      </nav>
    </div>
  )
}

// Stand-in until each screen's own PR lands.
function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <h1>{title}</h1>
      <p className="muted">Coming soon.</p>
    </>
  )
}
