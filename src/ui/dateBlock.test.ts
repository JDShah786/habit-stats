import { describe, expect, it } from 'vitest'
import { dateParts, partOfDay } from './dateBlock'

describe('date block', () => {
  it('formats the date as MM/DD with the weekday, from local time', () => {
    expect(dateParts(new Date(2026, 9, 27, 19, 30))).toEqual({ iso: '2026-10-27', mmdd: '10/27', weekday: 'TUE', part: 'EVENING' })
  })

  it('pads single-digit months and days', () => {
    expect(dateParts(new Date(2027, 0, 5, 9, 0))).toMatchObject({ iso: '2027-01-05', mmdd: '01/05', weekday: 'TUE' })
  })

  it('names every weekday', () => {
    const days = Array.from({ length: 7 }, (_, i) => dateParts(new Date(2026, 10, 1 + i)).weekday) // 1 Nov 2026 is a Sunday
    expect(days).toEqual(['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'])
  })

  it.each([
    [0, 'LATE NIGHT'],
    [4, 'LATE NIGHT'],
    [5, 'MORNING'],
    [11, 'MORNING'],
    [12, 'AFTERNOON'],
    [16, 'AFTERNOON'],
    [17, 'EVENING'],
    [20, 'EVENING'],
    [21, 'NIGHT'],
    [23, 'NIGHT'],
  ])('hour %i is %s', (hour, part) => {
    expect(partOfDay(hour)).toBe(part)
  })
})
