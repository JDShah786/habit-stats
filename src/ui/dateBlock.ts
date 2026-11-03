// Text for the tilted date block: MM/DD, weekday and a time-of-day word, all from local time.

import { localDay } from '../engine/scoring'

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export const partOfDay = (hour: number) =>
  hour < 5 ? 'LATE NIGHT' : hour < 12 ? 'MORNING' : hour < 17 ? 'AFTERNOON' : hour < 21 ? 'EVENING' : 'NIGHT'

export function dateParts(date: Date) {
  const iso = localDay(date)
  return { iso, mmdd: `${iso.slice(5, 7)}/${iso.slice(8)}`, weekday: WEEKDAYS[date.getDay()], part: partOfDay(date.getHours()) }
}
