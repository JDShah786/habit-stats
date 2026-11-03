import { describe, expect, it } from 'vitest'
import { statCard } from './statsView'

describe('stat card', () => {
  it('starts at Rank 1 with an empty bar', () => {
    expect(statCard('courage', 0)).toEqual({ rank: 1, title: 'Timid', max: false, fill: 0 })
  })

  it('fills the bar through the current rank only', () => {
    // Rank 2 runs 60–200: 130 is halfway.
    expect(statCard('courage', 130)).toEqual({ rank: 2, title: 'Steady', max: false, fill: 0.5 })
    // Exactly on a threshold: the new rank, empty bar.
    expect(statCard('intelligence', 500)).toEqual({ rank: 4, title: 'Brilliant', max: false, fill: 0 })
  })

  it('is Max with a full bar at 1000', () => {
    expect(statCard('charm', 1000)).toEqual({ rank: 5, title: 'Radiant', max: true, fill: 1 })
  })
})
