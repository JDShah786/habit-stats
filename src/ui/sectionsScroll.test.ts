// The four sections are one native horizontal scroll that snaps page by page (the iPhone's own
// swipe). These helpers turn the scroll position into "where are we": a fractional position for
// the strip cursor and background word while moving, and the section the scroll has settled on.

import { describe, expect, it } from 'vitest'
import { scrollPosition, settledSection } from './sectionsScroll'

const W = 390 // one section's width

describe('scrollPosition (for the cursor and background word, while moving)', () => {
  it('is the section index at a page boundary', () => {
    expect(scrollPosition(0, W)).toBe(0)
    expect(scrollPosition(2 * W, W)).toBe(2)
  })

  it('is fractional between sections', () => {
    expect(scrollPosition(1.5 * W, W)).toBe(1.5)
  })

  it('stays within Today and My habits during the iPhone bounce at either end', () => {
    expect(scrollPosition(-40, W)).toBe(0)
    expect(scrollPosition(3 * W + 40, W)).toBe(3)
  })

  it('is 0 before the sections have a width', () => {
    expect(scrollPosition(100, 0)).toBe(0)
  })
})

describe('settledSection (which section the swipe stopped on)', () => {
  it('is the section once the scroll rests on its page', () => {
    expect(settledSection(0, W)).toBe(0)
    expect(settledSection(W, W)).toBe(1)
    expect(settledSection(3 * W, W)).toBe(3)
  })

  it('allows sub-pixel rounding (phones report fractional scroll positions)', () => {
    expect(settledSection(2 * W + 0.6, W)).toBe(2)
    expect(settledSection(2 * W - 0.6, W)).toBe(2)
  })

  it('is null mid-swipe', () => {
    expect(settledSection(1.5 * W, W)).toBeNull()
    expect(settledSection(W + 10, W)).toBeNull()
  })

  it('is null during the bounce past either end', () => {
    expect(settledSection(-30, W)).toBeNull()
    expect(settledSection(3 * W + 30, W)).toBeNull()
  })

  it('is null before the sections have a width', () => {
    expect(settledSection(0, 0)).toBeNull()
  })
})
