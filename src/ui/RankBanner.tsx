// Placeholder for the step 5 animations: rank-ups and graduation as a plain banner.
// Rank-downs and un-graduation stay silent (SPEC "Corrections").

import { titleOf, type RankEvent } from '../engine/stats'

const message = (event: RankEvent) => {
  if (event.type === 'graduated') return 'Graduated! All four stats maxed'
  if (event.type === 'rankUp') return `${event.stat} rank up — ${titleOf(event.stat, event.toRank)}`
  return null
}

export function RankBanner({ events, onDismiss }: { events: RankEvent[]; onDismiss: () => void }) {
  const messages = events.map(message).filter((m) => m !== null)
  if (messages.length === 0) return null

  return (
    <div role="status" className="banner">
      {messages.map((m) => (
        <p key={m}>{m}</p>
      ))}
      <button onClick={onDismiss}>Dismiss</button>
    </div>
  )
}
