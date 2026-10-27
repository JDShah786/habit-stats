import { describe, it, expect } from 'vitest'
import { CATEGORIES, HABITS, validateLibrary, type Habit } from './library'

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'boxing',
  name: 'Boxing',
  category: 'fitness',
  weights: { courage: 70, charm: 30 },
  ...over,
})

// Bad data that the Habit type wouldn't allow, as it could arrive from JSON.
const raw = (over: Record<string, unknown>) => habit(over as Partial<Habit>)

const expectOneError = (habits: Habit[], pattern: RegExp) => {
  const errors = validateLibrary(habits)
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatch(pattern)
}

describe('validateLibrary', () => {
  it('accepts a valid list', () => {
    expect(validateLibrary([habit(), habit({ id: 'running', name: 'Running' })])).toEqual([])
  })

  describe('ids', () => {
    it('rejects a duplicate id, naming it', () => {
      expectOneError([habit(), habit({ name: 'Boxing 2' })], /boxing.*duplicate id/)
    })

    it.each(['Boxing', 'boxing gym', 'boxing_gym', '-boxing', 'boxing-', 'boxing--gym', ''])(
      'rejects "%s" (not a lowercase slug)',
      (id) => {
        expectOneError([habit({ id })], /id/)
      },
    )

    it('accepts slugs with digits and single hyphens', () => {
      expect(validateLibrary([habit({ id: 'hiit-20s' })])).toEqual([])
    })
  })

  describe('names', () => {
    it('rejects a duplicate name', () => {
      expectOneError([habit(), habit({ id: 'boxing-2' })], /duplicate name/)
    })

    it.each(['', '   '])('rejects a blank name "%s"', (name) => {
      expectOneError([habit({ name })], /name/)
    })
  })

  it('rejects an unknown category', () => {
    expectOneError([raw({ category: 'cooking' })], /boxing.*category/)
  })

  describe('weights', () => {
    it('rejects weights that do not sum to 100', () => {
      expectOneError([habit({ weights: { courage: 60, charm: 30 } })], /boxing.*sum to 100/)
    })

    it('rejects a habit with no weights', () => {
      expectOneError([habit({ weights: {} })], /sum to 100/)
    })

    it.each([
      [{ courage: 75, charm: 25 }],
      [{ courage: 100, charm: 0 }],
      [{ courage: 110, charm: -10 }],
      [{ courage: 70.5, charm: 29.5 }],
    ])('rejects %o (each weight must be 10, 20 … 100)', (weights) => {
      expectOneError([habit({ weights })], /multiple of 10/)
    })

    it('rejects an unknown stat', () => {
      expectOneError([raw({ weights: { courage: 70, luck: 30 } })], /unknown stat.*luck/)
    })
  })

  it('reports every problem, not just the first', () => {
    expect(validateLibrary([raw({ id: 'Bad Id', category: 'cooking' })])).toHaveLength(2)
  })
})

describe('the shipped library (habits.json)', () => {
  it('has no problems', () => {
    expect(validateLibrary(HABITS)).toEqual([])
  })

  it('has at least 100 habits', () => {
    expect(HABITS.length).toBeGreaterThanOrEqual(100)
  })

  it('uses every category', () => {
    for (const category of CATEGORIES) {
      expect(HABITS.some((h) => h.category === category), category).toBe(true)
    }
  })
})
