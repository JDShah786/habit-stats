// Placeholder for the step 5 animations: rank-ups and graduation as a plain banner.

import type { RankEvent } from '../engine/stats'
import { announcement } from './announce'

export function RankBanner({ events, onDismiss }: { events: RankEvent[]; onDismiss: () => void }) {
  const messages = events.map(announcement).filter((m) => m !== null)
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
