// The installed iPhone app must fill the whole screen. With the see-through ("black-translucent")
// status bar, iOS reports a window shorter than the screen by about the status bar's height, so
// anything pinned to the bottom stops early. fitGap() measures that shortfall; fitToScreen()
// hands it to CSS as --fit-gap so full-screen layers can stretch down to the real bottom.

import { describe, expect, it, vi } from 'vitest'
import { fitGap, fitToScreen } from './fit'

// An iPhone 15 Pro Max: 430 x 932 points. Status bar about 59.
const iphone = { standalone: true, innerWidth: 430, innerHeight: 873, screenWidth: 430, screenHeight: 932 }

describe('fitGap', () => {
  it('is the shortfall when the Home Screen app is shorter than the screen by a status bar', () => {
    expect(fitGap(iphone)).toBe(59)
  })

  it('is 0 in a Safari tab (not installed)', () => {
    expect(fitGap({ ...iphone, standalone: false })).toBe(0)
  })

  it('is 0 when the window already fills the screen (iOS fixed the bug, or no bug)', () => {
    expect(fitGap({ ...iphone, innerHeight: 932 })).toBe(0)
  })

  it('is 0 when the window is narrower than the screen (iPad split view, or landscape)', () => {
    expect(fitGap({ ...iphone, innerWidth: 320 })).toBe(0)
  })

  it('is 0 when the shortfall is bigger than any status bar (not this bug)', () => {
    expect(fitGap({ ...iphone, innerHeight: 600 })).toBe(0)
  })

  it('is never negative', () => {
    expect(fitGap({ ...iphone, innerHeight: 1000 })).toBe(0)
  })
})

function fakeWindow(over: Partial<typeof iphone> = {}) {
  const v = { ...iphone, ...over }
  const listeners: Record<string, () => void> = {}
  const win = {
    navigator: { standalone: v.standalone },
    innerWidth: v.innerWidth,
    innerHeight: v.innerHeight,
    screen: { width: v.screenWidth, height: v.screenHeight },
    addEventListener: vi.fn((type: string, fn: () => void) => (listeners[type] = fn)),
  }
  return { win, fire: (type: string) => listeners[type]?.() }
}

describe('fitToScreen', () => {
  it('sets --fit-gap on the page root for the installed iPhone app', () => {
    const root = document.createElement('html')
    fitToScreen(fakeWindow().win, root)
    expect(root.style.getPropertyValue('--fit-gap')).toBe('59px')
  })

  it('leaves --fit-gap unset in a Safari tab', () => {
    const root = document.createElement('html')
    fitToScreen(fakeWindow({ standalone: false }).win, root)
    expect(root.style.getPropertyValue('--fit-gap')).toBe('')
  })

  it('measures again when the window changes size, and clears it once the window fills the screen', () => {
    const root = document.createElement('html')
    const { win, fire } = fakeWindow()
    fitToScreen(win, root)
    expect(root.style.getPropertyValue('--fit-gap')).toBe('59px')
    win.innerHeight = 932
    fire('resize')
    expect(root.style.getPropertyValue('--fit-gap')).toBe('')
  })
})
