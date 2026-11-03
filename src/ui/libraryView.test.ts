import { describe, expect, it } from 'vitest'
import type { Habit } from '../library/library'
import { filterLibrary, statsByWeight } from './libraryView'

const habit = (id: string, name: string, category: Habit['category']): Habit => ({ id, name, category, weights: { intelligence: 100 } })

const HABITS: Habit[] = [
  habit('running', 'Running', 'fitness'),
  habit('boxing', 'Boxing', 'fitness'),
  habit('math', 'Math practice', 'study'),
  habit('guitar', 'Guitar practice', 'art'),
  habit('chess', 'Chess', 'study'),
]

const names = (list: Habit[]) => list.map((h) => h.name)

describe('stats by weight', () => {
  it('lists the stats a habit feeds, biggest weight first', () => {
    expect(statsByWeight({ courage: 50, proficiency: 30, charm: 20 })).toEqual(['courage', 'proficiency', 'charm'])
    expect(statsByWeight({ proficiency: 60, courage: 40 })).toEqual(['proficiency', 'courage'])
  })

  it('breaks a tie in SPEC order', () => {
    expect(statsByWeight({ proficiency: 50, courage: 50 })).toEqual(['courage', 'proficiency'])
  })
})

describe('filter library', () => {
  it('with no search, shows the category sorted by name', () => {
    expect(names(filterLibrary(HABITS, 'fitness', ''))).toEqual(['Boxing', 'Running'])
  })

  it('a search matches names in every category, ignoring case and spaces at the ends, sorted by name', () => {
    expect(names(filterLibrary(HABITS, 'fitness', '  PRACTICE '))).toEqual(['Guitar practice', 'Math practice'])
  })

  it('a search of only spaces counts as no search', () => {
    expect(names(filterLibrary(HABITS, 'study', '   '))).toEqual(['Chess', 'Math practice'])
  })

  it('a search with no match is empty', () => {
    expect(filterLibrary(HABITS, 'fitness', 'zzz')).toEqual([])
  })
})
