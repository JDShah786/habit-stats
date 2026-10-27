// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Stat } from '../engine/stats'
import { openDb, type HabitDB } from '../storage/db'
import { createStore, type Store } from '../storage/store'
import { App } from './App'

let dbCount = 0
let db: HabitDB
let store: Store

beforeEach(() => {
  db = openDb(`ui-${dbCount++}`)
  store = createStore(db, () => '2026-10-27')
})

afterEach(async () => {
  cleanup()
  await db.delete()
})

const renderApp = () => {
  const user = userEvent.setup()
  render(<App store={store} />)
  return user
}

// Points from an earlier day.
const seed = (stat: Stat, points: number) => db.awards.add({ habitId: 'boxing', date: '2026-10-26', stat, points })

const row = (name: string) => screen.findByRole('button', { name: new RegExp(`^${name}`) })

const openSheet = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(await row(name))
  return screen.findByRole('dialog', { name })
}

const logInSheet = async (user: ReturnType<typeof userEvent.setup>, sheet: HTMLElement, minutes: string) => {
  await user.type(within(sheet).getByLabelText('Minutes'), minutes)
  await user.click(within(sheet).getByRole('button', { name: 'Log' }))
}

describe('app shell', () => {
  it('opens on Today, with a tab bar for the four screens', async () => {
    renderApp()
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeTruthy()
    const tabs = within(screen.getByRole('navigation', { name: 'Screens' }))
    for (const name of ['Today', 'Stats', 'Library', 'My habits']) {
      expect(tabs.getByRole('button', { name })).toBeTruthy()
    }
  })

  it('switches screens from the tab bar', async () => {
    const user = renderApp()
    await user.click(within(await screen.findByRole('navigation', { name: 'Screens' })).getByRole('button', { name: 'Stats' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Stats' })).toBeTruthy()
  })
})

describe('Today', () => {
  it('shows an empty state that links to the Library', async () => {
    const user = renderApp()
    expect(await screen.findByText(/no habits on your list yet/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Go to Library' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Library' })).toBeTruthy()
  })

  it('lists daily and anytime habits with the minutes logged today', async () => {
    await store.addToList('boxing', 'daily')
    await store.addToList('flashcards', 'anytime')
    await store.logSession('boxing', 25)
    renderApp()
    const daily = await screen.findByRole('region', { name: 'Daily' })
    const anytime = screen.getByRole('region', { name: 'Anytime' })
    expect(within(daily).getByRole('button', { name: /^Boxing/ }).textContent).toContain('25 min')
    expect(within(anytime).getByRole('button', { name: /^Flashcards/ }).textContent).toContain('0 min')
  })

  it('ticks a daily habit once it has any session today', async () => {
    await store.addToList('boxing', 'daily')
    await store.addToList('running', 'daily')
    await store.logSession('boxing', 1)
    renderApp()
    expect((await row('Boxing')).textContent).toMatch(/done/)
    expect((await row('Running')).textContent).not.toMatch(/done/)
  })
})

describe('log sheet', () => {
  it('logs minutes, then shows them in the sheet, the row and the points', async () => {
    await store.addToList('boxing', 'daily')
    const user = renderApp()
    const sheet = await openSheet(user, 'Boxing')
    await logInSheet(user, sheet, '25')
    expect(await within(sheet).findByText('25 min')).toBeTruthy()
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))
    expect((await row('Boxing')).textContent).toContain('25 min')
    expect(await store.totals()).toMatchObject({ courage: 3, charm: 2 })
  })

  it('quick buttons set the minutes', async () => {
    await store.addToList('boxing', 'daily')
    const user = renderApp()
    const sheet = await openSheet(user, 'Boxing')
    await user.click(within(sheet).getByRole('button', { name: '30' }))
    expect((within(sheet).getByLabelText('Minutes') as HTMLInputElement).value).toBe('30')
  })

  it('blocks empty, zero and fractional minutes', async () => {
    await store.addToList('boxing', 'daily')
    const user = renderApp()
    const sheet = await openSheet(user, 'Boxing')
    const input = within(sheet).getByLabelText('Minutes')
    const log = within(sheet).getByRole('button', { name: 'Log' }) as HTMLButtonElement
    expect(log.disabled).toBe(true)
    await user.type(input, '0')
    expect(log.disabled).toBe(true)
    await user.clear(input)
    await user.type(input, '2.5')
    expect(log.disabled).toBe(true)
    await user.clear(input)
    await user.type(input, '10')
    expect(log.disabled).toBe(false)
  })

  it('shows the reason when storage rejects a log', async () => {
    await store.addToList('boxing', 'daily')
    await store.logSession('flashcards', 1000)
    const user = renderApp()
    const sheet = await openSheet(user, 'Boxing')
    await logInSheet(user, sheet, '441')
    expect((await within(sheet).findByRole('alert')).textContent).toMatch(/1440/)
  })

  it("lists only this habit's sessions today, and edits one", async () => {
    await store.addToList('boxing', 'daily')
    await store.logSession('boxing', 25)
    await store.logSession('boxing', 20)
    await store.logSession('flashcards', 10)
    const user = renderApp()
    const sheet = await openSheet(user, 'Boxing')
    const list = within(sheet).getByRole('list', { name: "Today's sessions" })
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('25 min'),
      expect.stringContaining('20 min'),
    ])

    await user.click(within(within(list).getAllByRole('listitem')[1]).getByRole('button', { name: 'Edit' }))
    const edit = within(sheet).getByLabelText('Edit minutes')
    await user.clear(edit)
    await user.type(edit, '5')
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(await within(sheet).findByText('5 min')).toBeTruthy()
    expect(await store.totals()).toMatchObject({ courage: 4, charm: 2 })
  })

  it('deletes a session', async () => {
    await store.addToList('boxing', 'daily')
    await store.logSession('boxing', 25)
    const user = renderApp()
    const sheet = await openSheet(user, 'Boxing')
    await user.click(within(sheet).getByRole('button', { name: 'Delete' }))
    expect(await within(sheet).findByText(/no sessions yet today/i)).toBeTruthy()
    expect(await store.totals()).toMatchObject({ courage: 0, charm: 0 })
  })

  it('closes with the Close button', async () => {
    await store.addToList('boxing', 'daily')
    const user = renderApp()
    const sheet = await openSheet(user, 'Boxing')
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('rank banner (placeholder until step 5)', () => {
  it('shows a rank-up, and dismisses on tap', async () => {
    await seed('courage', 58)
    await store.addToList('boxing', 'daily')
    const user = renderApp()
    await logInSheet(user, await openSheet(user, 'Boxing'), '25')
    const banner = await screen.findByRole('status')
    expect(banner.textContent).toMatch(/courage rank up/i)
    expect(banner.textContent).toMatch(/steady/i)
    await user.click(within(banner).getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('stays up after a later log with no rank-up, until dismissed', async () => {
    await seed('courage', 58)
    await store.addToList('boxing', 'daily')
    const user = renderApp()
    const sheet = await openSheet(user, 'Boxing')
    await logInSheet(user, sheet, '25')
    await screen.findByRole('status')
    await logInSheet(user, sheet, '20')
    await within(sheet).findByText('20 min')
    expect(screen.getByRole('status').textContent).toMatch(/courage rank up/i)
  })

  it('shows graduation when the last stat reaches 1000', async () => {
    await seed('charm', 1000)
    await seed('courage', 1000)
    await seed('intelligence', 1000)
    await seed('proficiency', 999)
    await store.addToList('calligraphy', 'daily')
    const user = renderApp()
    await logInSheet(user, await openSheet(user, 'Calligraphy'), '10')
    expect((await screen.findByRole('status')).textContent).toMatch(/graduated/i)
  })

  it('stays silent on a rank-down', async () => {
    await seed('courage', 58)
    await store.addToList('boxing', 'daily')
    await store.logSession('boxing', 25) // Courage 61
    const user = renderApp()
    const sheet = await openSheet(user, 'Boxing')
    await user.click(within(sheet).getByRole('button', { name: 'Delete' }))
    await within(sheet).findByText(/no sessions yet today/i)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
