// Which rank events get announced. Rank-downs and un-graduation stay silent (SPEC "Corrections").

import { titleOf, type RankEvent } from '../engine/stats'

export const announcement = (event: RankEvent) => {
  if (event.type === 'graduated') return 'Graduated! All four stats maxed'
  if (event.type === 'rankUp') return `${event.stat} rank up — ${titleOf(event.stat, event.toRank)}`
  return null
}

export const hasAnnouncement = (events: RankEvent[]) => events.some((e) => announcement(e) !== null)
