// @vitest-environment jsdom
// Step 8: five themes, picked in Settings. The theme is a data-theme attribute on the page root;
// app.css holds one block per theme. These tests cover the list and applying a theme.

import { describe, expect, it } from 'vitest'
import { applyTheme, bootTheme, DEFAULT_THEME, isThemeId, THEMES } from './themes'

describe('the theme list', () => {
  it('offers exactly five themes, in order: Redux, Royal, Reload, Revival, Revamp', () => {
    expect(THEMES.map((t) => t.name)).toEqual(['Redux', 'Royal', 'Reload', 'Revival', 'Revamp'])
  })

  it('defaults to Redux', () => {
    expect(DEFAULT_THEME).toBe('redux')
    expect(THEMES.find((t) => t.id === DEFAULT_THEME)?.name).toBe('Redux')
  })

  it("accepts each theme's id and rejects anything else", () => {
    for (const t of THEMES) expect(isThemeId(t.id)).toBe(true)
    for (const bad of ['neon', 'Royal', '', 'red', undefined, null, 3]) expect(isThemeId(bad)).toBe(false)
  })
})

describe('applying a theme', () => {
  it('sets data-theme on the page root', () => {
    const root = document.createElement('html')
    applyTheme('royal', root)
    expect(root.dataset.theme).toBe('royal')
    applyTheme('revamp', root)
    expect(root.dataset.theme).toBe('revamp')
  })

  it('on start, uses the saved theme before the app shows', async () => {
    const root = document.createElement('html')
    const theme = await bootTheme({ theme: async () => 'reload' }, root)
    expect(theme).toBe('reload')
    expect(root.dataset.theme).toBe('reload')
  })

  it('on start, falls back to Redux if reading the saved theme fails', async () => {
    const root = document.createElement('html')
    const theme = await bootTheme({ theme: () => Promise.reject(new Error('storage blocked')) }, root)
    expect(theme).toBe('redux')
    expect(root.dataset.theme).toBe('redux')
  })
})
