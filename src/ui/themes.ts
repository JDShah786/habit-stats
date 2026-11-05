// Step 8: the five themes. A theme is a data-theme attribute on the page root; themes.css holds
// one block of colours and one static background per theme. Redux is the original green look.

export const THEMES = [
  { id: 'redux', name: 'Redux' },
  { id: 'royal', name: 'Royal' },
  { id: 'reload', name: 'Reload' },
  { id: 'revival', name: 'Revival' },
  { id: 'revamp', name: 'Revamp' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

export const DEFAULT_THEME: ThemeId = 'redux'

export const isThemeId = (value: unknown): value is ThemeId => THEMES.some((t) => t.id === value)

export function applyTheme(theme: ThemeId, root: HTMLElement = document.documentElement) {
  root.dataset.theme = theme
}

// On start: read the saved theme and apply it before the app shows, so there's no flash of
// the wrong colours. If storage can't be read, Redux.
export async function bootTheme(store: { theme(): Promise<ThemeId> }, root: HTMLElement = document.documentElement): Promise<ThemeId> {
  let theme: ThemeId = DEFAULT_THEME
  try {
    theme = await store.theme()
  } catch {
    // keep the default
  }
  applyTheme(theme, root)
  return theme
}
