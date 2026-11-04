import { describe, expect, it } from 'vitest'
import { categoryStats, defaultWeights, nameError, weightsTotal } from './customHabit'

describe('category stats', () => {
  it.each([
    ['fitness', ['courage', 'proficiency']],
    ['study', ['intelligence']],
    ['languages', ['intelligence', 'charm']],
    ['content-creation', ['charm', 'proficiency']],
    ['reading', ['intelligence']],
    ['art', ['proficiency', 'charm']],
  ] as const)('%s defaults to %j (SPEC "Habit library")', (category, stats) => {
    expect(categoryStats(category)).toEqual(stats)
  })
})

describe('default weights', () => {
  it('splits 100 in steps of 10; the first stat picked gets any extra', () => {
    expect(defaultWeights([])).toEqual({})
    expect(defaultWeights(['courage'])).toEqual({ courage: 100 })
    expect(defaultWeights(['courage', 'charm'])).toEqual({ courage: 50, charm: 50 })
    expect(defaultWeights(['proficiency', 'charm', 'courage'])).toEqual({ proficiency: 40, charm: 30, courage: 30 })
    expect(defaultWeights(['intelligence', 'charm', 'courage', 'proficiency'])).toEqual({
      intelligence: 30,
      charm: 30,
      courage: 20,
      proficiency: 20,
    })
  })
})

describe('weights total', () => {
  it('adds up the weights', () => {
    expect(weightsTotal({})).toBe(0)
    expect(weightsTotal({ courage: 60, charm: 50 })).toBe(110)
  })
})

describe('name check', () => {
  const taken = ['Boxing', 'Morning Walk']

  it('accepts a new name', () => {
    expect(nameError('Juggling', taken)).toBeNull()
    expect(nameError('a'.repeat(40), taken)).toBeNull()
  })

  it('asks for a name when blank', () => {
    expect(nameError('   ', taken)).toMatch(/name/i)
  })

  it('needs a letter A–Z or a digit', () => {
    expect(nameError('!!!', taken)).toMatch(/letter A–Z or a digit/)
    expect(nameError('ヨガ', taken)).toMatch(/letter A–Z or a digit/)
  })

  it('allows at most 40 characters, ignoring spaces at the ends', () => {
    expect(nameError('a'.repeat(41), taken)).toMatch(/40/)
    expect(nameError(`  ${'a'.repeat(40)}  `, taken)).toBeNull()
  })

  it('rejects a name already used, ignoring case and punctuation that gives the same id', () => {
    expect(nameError(' boxing ', taken)).toMatch(/already exists/)
    expect(nameError('morning-walk', taken)).toMatch(/already exists/)
  })
})
