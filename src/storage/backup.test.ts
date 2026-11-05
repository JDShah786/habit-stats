import { describe, expect, it } from 'vitest'
import { backupFileName, backupSummary, checkBackup, makeBackup, type Backup } from './backup'

// A small, valid backup: one preset and one custom habit on the list, two sessions, their awards.
const valid = (): Backup => ({
  app: 'habit-stats',
  version: 1,
  exportedAt: '2026-10-20T12:00:00.000Z',
  data: {
    customHabits: [{ id: 'custom-juggling', name: 'Juggling', category: 'art', weights: { proficiency: 50, charm: 50 }, custom: true }],
    activeHabits: [
      { habitId: 'boxing', addedOn: '2026-10-01', kind: 'daily' },
      { habitId: 'custom-juggling', addedOn: '2026-10-02', kind: 'anytime' },
    ],
    sessions: [
      { id: 1, habitId: 'boxing', date: '2026-10-19', minutes: 25 },
      { id: 2, habitId: 'custom-juggling', date: '2026-10-20', minutes: 30 },
    ],
    awards: [
      { habitId: 'boxing', date: '2026-10-19', stat: 'courage', points: 3 },
      { habitId: 'boxing', date: '2026-10-19', stat: 'charm', points: 2 },
      { habitId: 'custom-juggling', date: '2026-10-20', stat: 'proficiency', points: 3 },
      { habitId: 'custom-juggling', date: '2026-10-20', stat: 'charm', points: 3 },
    ],
  },
})

// The check's answer for a valid backup changed by `edit`. The edits break the types on
// purpose (a file can hold anything), hence `any`.
const checkEdited = (edit: (b: any) => void) => {
  const b = valid()
  edit(b)
  return checkBackup(JSON.stringify(b))
}
const reason = (result: ReturnType<typeof checkBackup>) => (result.ok ? 'accepted' : result.error)

describe('making a backup', () => {
  it('wraps the data with the app name, format version and export time', () => {
    const { data, exportedAt } = valid()
    expect(makeBackup(data, exportedAt)).toEqual(valid())
  })

  it("names the file after the phone's day", () => {
    expect(backupFileName('2026-11-04')).toBe('habit-stats-backup-2026-11-04.json')
  })

  it('summarises a backup for the confirm step', () => {
    expect(backupSummary(valid())).toEqual({ exportedAt: '2026-10-20T12:00:00.000Z', onList: 2, sessions: 2 })
  })
})

describe('checking a backup file: all or nothing', () => {
  it('accepts a valid backup and hands it back unchanged', () => {
    expect(checkBackup(JSON.stringify(valid()))).toEqual({ ok: true, backup: valid() })
  })

  it('accepts an empty backup', () => {
    const empty = makeBackup({ customHabits: [], activeHabits: [], sessions: [], awards: [] }, '2026-10-20T12:00:00.000Z')
    expect(checkBackup(JSON.stringify(empty)).ok).toBe(true)
  })

  it.each([
    ['text that is not JSON', 'hello'],
    ['JSON from something else', JSON.stringify({ name: 'photos', items: [] })],
    ['an empty object', '{}'],
    ['a list', '[]'],
    ['an unknown format version', JSON.stringify({ ...valid(), version: 0 })],
    ['a version that is not a number', JSON.stringify({ ...valid(), version: '1' })],
    ['a bad export time', JSON.stringify({ ...valid(), exportedAt: 'yesterday' })],
    ['a missing table', JSON.stringify({ ...valid(), data: { ...valid().data, sessions: undefined } })],
    ['a table that is not a list', JSON.stringify({ ...valid(), data: { ...valid().data, awards: {} } })],
  ])('rejects %s as not a Habit Stats backup', (_, text) => {
    expect(reason(checkBackup(text))).toMatch(/not a Habit Stats backup/)
  })

  it('rejects a backup from a newer version of the app', () => {
    expect(reason(checkEdited((b) => (b.version = 2)))).toMatch(/newer version/)
  })

  describe('sessions', () => {
    it('must be for a known habit (a preset or a custom habit in the file)', () => {
      expect(reason(checkEdited((b) => (b.data.sessions[0].habitId = 'skydiving')))).toMatch(/unknown habit/)
    })

    it.each([[0], [-5], [2.5], ['25']])('must have whole minutes, 1 or more (not %j)', (minutes) => {
      expect(reason(checkEdited((b) => (b.data.sessions[0].minutes = minutes)))).toMatch(/minutes/)
    })

    it.each([['2026-13-01'], ['2026-02-30'], ['2026-1-5'], ['today']])('must have a real YYYY-MM-DD date (not %s)', (date) => {
      expect(reason(checkEdited((b) => (b.data.sessions[0].date = date)))).toMatch(/date/)
    })

    it('must have unique whole-number ids', () => {
      expect(reason(checkEdited((b) => (b.data.sessions[1].id = 1)))).toMatch(/session id/)
      expect(reason(checkEdited((b) => (b.data.sessions[1].id = 1.5)))).toMatch(/session id/)
    })

    it('must not put more than 1440 minutes in one day', () => {
      const result = checkEdited((b) => {
        b.data.sessions[0].minutes = 800
        b.data.sessions[1] = { id: 2, habitId: 'boxing', date: '2026-10-19', minutes: 700 }
      })
      expect(reason(result)).toMatch(/1440/)
    })
  })

  describe('awards', () => {
    it('must be for a known stat', () => {
      expect(reason(checkEdited((b) => (b.data.awards[0].stat = 'luck')))).toMatch(/stat/)
    })

    it.each([[0], [-1], [1.5]])('must be whole points, 1 or more (not %j)', (points) => {
      expect(reason(checkEdited((b) => (b.data.awards[0].points = points)))).toMatch(/points/)
    })

    it('must be for a known habit', () => {
      expect(reason(checkEdited((b) => (b.data.awards[0].habitId = 'skydiving')))).toMatch(/unknown habit/)
    })

    it('must have a real date', () => {
      expect(reason(checkEdited((b) => (b.data.awards[0].date = '2026-10-32')))).toMatch(/date/)
    })

    it('must not take any stat over 1000 in total', () => {
      const result = checkEdited((b) => {
        b.data.awards[0].points = 600
        b.data.awards.push({ habitId: 'boxing', date: '2026-10-18', stat: 'courage', points: 401 })
      })
      expect(reason(result)).toMatch(/1000/)
    })
  })

  describe('your list', () => {
    it('must name known habits', () => {
      expect(reason(checkEdited((b) => (b.data.activeHabits[0].habitId = 'skydiving')))).toMatch(/unknown habit/)
    })

    it('must say daily or anytime', () => {
      expect(reason(checkEdited((b) => (b.data.activeHabits[0].kind = 'weekly')))).toMatch(/kind/)
    })

    it('must have a real date added', () => {
      expect(reason(checkEdited((b) => (b.data.activeHabits[0].addedOn = 'soon')))).toMatch(/date/)
    })

    it('must not list a habit twice', () => {
      expect(reason(checkEdited((b) => (b.data.activeHabits[1].habitId = 'boxing')))).toMatch(/twice/)
    })
  })

  describe('custom habits', () => {
    it.each([
      ['blank', '   '],
      ['over 40 characters', 'J'.repeat(41)],
      ['without a letter A–Z or a digit', '!!!'],
      ['the same as a preset', 'Boxing'],
    ])('must follow the name rules (not %s)', (_, name) => {
      expect(reason(checkEdited((b) => (b.data.customHabits[0].name = name)))).toMatch(/name/)
    })

    it('must not share a name', () => {
      const result = checkEdited((b) => b.data.customHabits.push({ ...b.data.customHabits[0] }))
      expect(reason(result)).toMatch(/name/)
    })

    it("must have the id 'custom-' + a slug of its name", () => {
      expect(reason(checkEdited((b) => (b.data.customHabits[0].id = 'custom-other')))).toMatch(/id/)
    })

    it.each([
      ['not multiples of 10', { proficiency: 55, charm: 45 }],
      ['not summing to 100', { proficiency: 50, charm: 40 }],
      ['an unknown stat', { proficiency: 50, luck: 50 }],
    ])('must follow the weight rules (not %s)', (_, weights) => {
      expect(reason(checkEdited((b) => (b.data.customHabits[0].weights = weights)))).toMatch(/weights/)
    })

    it('must have a known category', () => {
      expect(reason(checkEdited((b) => (b.data.customHabits[0].category = 'cooking')))).toMatch(/category/)
    })
  })
})
