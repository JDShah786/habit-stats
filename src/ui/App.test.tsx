// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Stat } from '../engine/stats'
import { openDb, type HabitDB } from '../storage/db'
import { createStore, type Store } from '../storage/store'
import { App } from './App'

let dbCount = 0
let db: HabitDB
let store: Store

// jsdom has no matchMedia. Tests run with Reduce Motion on, so screens change at once;
// the shell tests turn it off to cover the animated wipe.
let reduceMotion = true

beforeEach(() => {
  db = openDb(`ui-${dbCount++}`)
  store = createStore(db, () => '2026-10-27')
  reduceMotion = true
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes('reduce') && reduceMotion,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList
})

afterEach(async () => {
  cleanup()
  await db.delete()
})

// Tuesday 27 Oct 2026, 7:30 pm local time: matches the store's day.
const NOW = new Date(2026, 9, 27, 19, 30)

const renderOnMenu = () => {
  const user = userEvent.setup()
  render(<App store={store} now={() => NOW} />)
  return user
}

const menu = () => screen.findByRole('navigation', { name: 'Menu' })
const strip = () => screen.getByRole('navigation', { name: 'Sections' })

// The app opens on the command menu; most tests start on Today, one tap away.
const renderApp = async () => {
  const user = renderOnMenu()
  await user.click(within(await menu()).getByRole('button', { name: 'Today' }))
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
  it('opens on the command menu with the four sections, Today marked', async () => {
    renderOnMenu()
    const words = within(await menu()).getAllByRole('button')
    expect(words.map((b) => b.textContent)).toEqual(['Today', 'Library', 'Stats', 'My habits'])
    expect(words[0].getAttribute('aria-current')).toBe('true')
    expect(screen.queryByRole('navigation', { name: 'Sections' })).toBeNull()
    expect(screen.queryByRole('heading', { level: 1, name: 'Today' })).toBeNull()
  })

  it("shows today's date, weekday and time of day", async () => {
    renderOnMenu()
    await menu()
    const date = document.querySelector('time')!
    expect(date.dateTime).toBe('2026-10-27')
    expect(date.textContent).toMatch(/10\/27.*TUE.*EVENING/)
  })

  it('tapping a menu word opens that section', async () => {
    const user = renderOnMenu()
    await user.click(within(await menu()).getByRole('button', { name: 'Library' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Library' })).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Menu' })).toBeNull()
    expect(within(strip()).getByRole('button', { name: 'Library' }).getAttribute('aria-current')).toBe('page')
  })

  it('the section strip switches sections, and only the current one can be reached', async () => {
    const user = await renderApp()
    await user.click(within(strip()).getByRole('button', { name: 'Stats' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Stats' })).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 1, name: 'Today' })).toBeNull()
    expect(within(strip()).getByRole('button', { name: 'Stats' }).getAttribute('aria-current')).toBe('page')
    expect(within(strip()).getByRole('button', { name: 'Today' }).getAttribute('aria-current')).toBeNull()
  })

  it('MENU goes back to the command menu, with the last section marked', async () => {
    const user = await renderApp()
    await user.click(within(strip()).getByRole('button', { name: 'Stats' }))
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    const words = within(await menu())
    expect(words.getByRole('button', { name: 'Stats' }).getAttribute('aria-current')).toBe('true')
    expect(words.getByRole('button', { name: 'Today' }).getAttribute('aria-current')).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Sections' })).toBeNull()
  })

  it('with Reduce Motion off, the wipe still lands on the section and back', async () => {
    reduceMotion = false
    const user = renderOnMenu()
    await user.click(within(await menu()).getByRole('button', { name: 'Stats' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Stats' }, { timeout: 2000 })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    expect(await screen.findByRole('navigation', { name: 'Menu' }, { timeout: 2000 })).toBeTruthy()
  })

  it('ignores a second menu tap while the wipe is running', async () => {
    reduceMotion = false
    const user = renderOnMenu()
    const words = within(await menu())
    await user.click(words.getByRole('button', { name: 'Stats' }))
    await user.click(words.getByRole('button', { name: 'Library' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Stats' }, { timeout: 2000 })).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 1, name: 'Library' })).toBeNull()
  })
})

describe('Today', () => {
  it('shows an empty state that links to the Library', async () => {
    const user = await renderApp()
    expect(await screen.findByText(/no habits on your list yet/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Go to Library' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Library' })).toBeTruthy()
  })

  it('lists daily and anytime habits with the minutes logged today', async () => {
    await store.addToList('boxing', 'daily')
    await store.addToList('flashcards', 'anytime')
    await store.logSession('boxing', 25)
    await renderApp()
    const daily = await screen.findByRole('region', { name: 'Daily' })
    const anytime = screen.getByRole('region', { name: 'Anytime' })
    expect(within(daily).getByRole('button', { name: /^Boxing/ }).textContent).toContain('25 min')
    expect(within(anytime).getByRole('button', { name: /^Flashcards/ }).textContent).toContain('0 min')
  })

  it('lights up any habit with time today, but only daily habits are done', async () => {
    await store.addToList('boxing', 'daily')
    await store.addToList('running', 'daily')
    await store.addToList('flashcards', 'anytime')
    await store.logSession('boxing', 1)
    await store.logSession('flashcards', 5)
    await renderApp()
    const boxing = await row('Boxing')
    const flashcards = await row('Flashcards')
    const running = await row('Running')
    expect(boxing.classList.contains('lit')).toBe(true)
    expect(boxing.textContent).toMatch(/done/)
    expect(flashcards.classList.contains('lit')).toBe(true)
    expect(flashcards.textContent).not.toMatch(/done/)
    expect(running.classList.contains('lit')).toBe(false)
  })

  it('shows the stat closest to its next rank, even with an empty list, without the points needed', async () => {
    await renderApp()
    const next = await screen.findByRole('region', { name: 'Next rank' })
    expect(next.textContent).toMatch(/charm.*next: rank 2/i)
    expect(next.textContent).not.toMatch(/60|to rank/i)
  })

  it('updates the next-rank bar after a log', async () => {
    await seed('courage', 58)
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
    expect((await screen.findByRole('region', { name: 'Next rank' })).textContent).toMatch(/courage.*next: rank 2/i)
    // +3 Courage (61, Rank 2: far from Rank 3), +2 Charm (2): Charm is now closest.
    await logInSheet(user, await openSheet(user, 'Boxing'), '25')
    await waitFor(() => expect(screen.getByRole('region', { name: 'Next rank' }).textContent).toMatch(/charm.*next: rank 2/i))
  })

  it('floats the points each stat gained after a log', async () => {
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
    await logInSheet(user, await openSheet(user, 'Boxing'), '25')
    expect(await screen.findByText('+3 Courage')).toBeTruthy()
    expect(screen.getByText('+2 Charm')).toBeTruthy()
  })

  it('floats no points for edits or deletes', async () => {
    await store.addToList('boxing', 'daily')
    await store.logSession('boxing', 25)
    const user = await renderApp()
    const sheet = await openSheet(user, 'Boxing')
    await user.click(within(sheet).getByRole('button', { name: 'Delete' }))
    await within(sheet).findByText(/no sessions yet today/i)
    expect(screen.queryByText(/^\+\d+ /)).toBeNull()
  })

  it('ticks a daily habit once it has any session today', async () => {
    await store.addToList('boxing', 'daily')
    await store.addToList('running', 'daily')
    await store.logSession('boxing', 1)
    await renderApp()
    expect((await row('Boxing')).textContent).toMatch(/done/)
    expect((await row('Running')).textContent).not.toMatch(/done/)
  })
})

describe('log sheet', () => {
  it('logs minutes, then shows them in the sheet, the row and the points', async () => {
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
    const sheet = await openSheet(user, 'Boxing')
    await logInSheet(user, sheet, '25')
    expect(await within(sheet).findByText('25 min')).toBeTruthy()
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))
    expect((await row('Boxing')).textContent).toContain('25 min')
    expect(await store.totals()).toMatchObject({ courage: 3, charm: 2 })
  })

  it("shows the habit's stat weights", async () => {
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
    const sheet = await openSheet(user, 'Boxing')
    expect(within(sheet).getByText('Courage 70')).toBeTruthy()
    expect(within(sheet).getByText('Charm 30')).toBeTruthy()
  })

  it('CUSTOM clears the minutes box and puts the cursor in it', async () => {
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
    const sheet = await openSheet(user, 'Boxing')
    const box = within(sheet).getByLabelText('Minutes') as HTMLInputElement
    await user.click(within(sheet).getByRole('button', { name: '30' }))
    await user.click(within(sheet).getByRole('button', { name: 'Custom' }))
    expect(box.value).toBe('')
    expect(document.activeElement).toBe(box)
  })

  it('closes when tapping outside the sheet', async () => {
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
    await openSheet(user, 'Boxing')
    await user.click(document.querySelector('.sheet-backdrop')!)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('quick buttons set the minutes', async () => {
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
    const sheet = await openSheet(user, 'Boxing')
    await user.click(within(sheet).getByRole('button', { name: '30' }))
    expect((within(sheet).getByLabelText('Minutes') as HTMLInputElement).value).toBe('30')
  })

  it('blocks empty, zero and fractional minutes', async () => {
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
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
    const user = await renderApp()
    const sheet = await openSheet(user, 'Boxing')
    await logInSheet(user, sheet, '441')
    expect((await within(sheet).findByRole('alert')).textContent).toMatch(/1440/)
  })

  it("lists only this habit's sessions today, and edits one", async () => {
    await store.addToList('boxing', 'daily')
    await store.logSession('boxing', 25)
    await store.logSession('boxing', 20)
    await store.logSession('flashcards', 10)
    const user = await renderApp()
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
    const user = await renderApp()
    const sheet = await openSheet(user, 'Boxing')
    await user.click(within(sheet).getByRole('button', { name: 'Delete' }))
    expect(await within(sheet).findByText(/no sessions yet today/i)).toBeTruthy()
    expect(await store.totals()).toMatchObject({ courage: 0, charm: 0 })
  })

  it('closes with the Close button', async () => {
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
    const sheet = await openSheet(user, 'Boxing')
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe("menu: today's list card", () => {
  const card = () => screen.findByRole('button', { name: /today's list/i })

  it('lists the first 3 habits in Today order, with "+N more"', async () => {
    for (const id of ['guitar', 'flashcards', 'chess']) await store.addToList(id, 'anytime')
    for (const id of ['running', 'boxing']) await store.addToList(id, 'daily')
    await store.logSession('boxing', 25)
    renderOnMenu()
    await waitFor(async () => expect((await card()).textContent).toMatch(/Boxing.*25.*Running.*Chess.*\+2 more/))
    expect((await card()).textContent).not.toMatch(/Flashcards|Guitar/)
  })

  it('counts daily habits done, and hides the count with no daily habits', async () => {
    await store.addToList('boxing', 'daily')
    await store.addToList('running', 'daily')
    await store.logSession('boxing', 5)
    renderOnMenu()
    expect(await screen.findByText(/1 of 2 daily done/i)).toBeTruthy()
    cleanup()
    await store.removeFromList('boxing')
    await store.removeFromList('running')
    await store.addToList('flashcards', 'anytime')
    renderOnMenu()
    await waitFor(async () => expect((await card()).textContent).toMatch(/Flashcards/))
    expect(screen.queryByText(/daily done/i)).toBeNull()
  })

  it('says the list is empty, and opens Today when tapped', async () => {
    const user = renderOnMenu()
    await waitFor(async () => expect((await card()).textContent).toMatch(/nothing on your list yet/i))
    await user.click(await card())
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeTruthy()
  })

  it('shows minutes logged in Today after going back to the menu', async () => {
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
    const sheet = await openSheet(user, 'Boxing')
    await logInSheet(user, sheet, '25')
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    await waitFor(async () => expect((await card()).textContent).toMatch(/Boxing.*25/))
  })
})

describe('Library', () => {
  const renderLibrary = async () => {
    const user = renderOnMenu()
    await user.click(within(await menu()).getByRole('button', { name: 'Library' }))
    await screen.findByRole('list', { name: 'Habits' })
    return user
  }
  const chips = () => within(screen.getByRole('group', { name: 'Categories' }))
  const chip = (name: string) => chips().getByRole('button', { name })
  const pressed = () =>
    chips()
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
      .map((b) => b.textContent)
  const libRows = () => within(screen.getByRole('list', { name: 'Habits' })).queryAllByRole('listitem')
  const libNames = () => libRows().map((li) => li.querySelector('.name')!.textContent)
  const libRow = (name: string) => libRows().find((li) => li.querySelector('.name')!.textContent === name)!
  const search = () => screen.getByRole('searchbox', { name: 'Search habits' })
  const choiceOpen = () => screen.queryByRole('button', { name: 'Daily' }) !== null

  it('opens on Fitness, with its presets sorted by name', async () => {
    await renderLibrary()
    expect(pressed()).toEqual(['Fitness'])
    expect(libNames()).toHaveLength(17)
    expect(libNames().slice(0, 3)).toEqual(['Basketball', 'Boxing', 'Calisthenics'])
  })

  it("shows each habit's stats, biggest weight first, without numbers", async () => {
    await renderLibrary()
    expect(libRow('Boxing').textContent).toMatch(/Courage · Charm/)
    expect(libRow('Yoga').textContent).toMatch(/Proficiency · Courage/)
    expect(libRow('Boxing').textContent).not.toMatch(/\d/)
  })

  it('a category chip shows that category', async () => {
    const user = await renderLibrary()
    await user.click(chip('Study'))
    expect(pressed()).toEqual(['Study'])
    expect(libNames()).toContain('Math practice')
    expect(libNames()).not.toContain('Boxing')
  })

  it('search matches names in every category and turns the chip off; clearing brings it back', async () => {
    const user = await renderLibrary()
    await user.click(chip('Study'))
    await user.type(search(), 'PRACTICE')
    expect(pressed()).toEqual([])
    expect(libNames()).toEqual(expect.arrayContaining(['Guitar practice', 'Math practice', 'Conversation practice']))
    expect(libNames()).not.toContain('Chess')
    await user.clear(search())
    expect(pressed()).toEqual(['Study'])
    expect(libNames()).toContain('Chess')
  })

  it('says so when a search matches nothing', async () => {
    const user = await renderLibrary()
    await user.type(search(), 'zzz')
    expect(screen.getByText('No habit matches "zzz".')).toBeTruthy()
  })

  it('adds a habit as daily or anytime from its row', async () => {
    const user = await renderLibrary()
    await user.click(within(libRow('Boxing')).getByRole('button', { name: 'Add Boxing' }))
    await user.click(within(libRow('Boxing')).getByRole('button', { name: 'Daily' }))
    await waitFor(() => expect(libRow('Boxing').textContent).toMatch(/On list · Daily/))
    expect(within(libRow('Boxing')).queryAllByRole('button')).toEqual([])
    await user.click(within(libRow('Running')).getByRole('button', { name: 'Add Running' }))
    await user.click(within(libRow('Running')).getByRole('button', { name: 'Anytime' }))
    await waitFor(() => expect(libRow('Running').textContent).toMatch(/On list · Anytime/))
    expect(await store.activeHabits()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ habitId: 'boxing', kind: 'daily' }),
        expect.objectContaining({ habitId: 'running', kind: 'anytime' }),
      ]),
    )
  })

  it('opens the daily/anytime choice on one row at a time', async () => {
    const user = await renderLibrary()
    await user.click(within(libRow('Boxing')).getByRole('button', { name: 'Add Boxing' }))
    await user.click(within(libRow('Running')).getByRole('button', { name: 'Add Running' }))
    expect(within(libRow('Boxing')).getByRole('button', { name: 'Add Boxing' })).toBeTruthy()
    expect(within(libRow('Running')).getByRole('button', { name: 'Daily' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Daily' })).toHaveLength(1)
  })

  it('closes the choice on a chip change, a search, or leaving the Library', async () => {
    const user = await renderLibrary()
    await user.click(within(libRow('Boxing')).getByRole('button', { name: 'Add Boxing' }))
    await user.click(chip('Study'))
    await user.click(chip('Fitness'))
    expect(choiceOpen()).toBe(false)

    await user.click(within(libRow('Boxing')).getByRole('button', { name: 'Add Boxing' }))
    await user.type(search(), 'box')
    expect(choiceOpen()).toBe(false)

    await user.click(within(libRow('Boxing')).getByRole('button', { name: 'Add Boxing' }))
    await user.click(within(strip()).getByRole('button', { name: 'Today' }))
    await user.click(within(strip()).getByRole('button', { name: 'Library' }))
    expect(choiceOpen()).toBe(false)
  })

  it('shows a habit already on your list as a tag, with no buttons', async () => {
    await store.addToList('flashcards', 'anytime')
    const user = await renderLibrary()
    await user.click(chip('Study'))
    await waitFor(() => expect(libRow('Flashcards').textContent).toMatch(/On list · Anytime/))
    expect(within(libRow('Flashcards')).queryAllByRole('button')).toEqual([])
  })

  it('does not show custom habits', async () => {
    await store.saveCustomHabit({ name: 'Juggling', category: 'fitness', weights: { proficiency: 100 } })
    const user = await renderLibrary()
    expect(libNames()).not.toContain('Juggling')
    await user.type(search(), 'jugg')
    expect(screen.getByText('No habit matches "jugg".')).toBeTruthy()
  })

  it('a habit added in the Library shows on Today', async () => {
    const user = await renderLibrary()
    await user.click(within(libRow('Boxing')).getByRole('button', { name: 'Add Boxing' }))
    await user.click(within(libRow('Boxing')).getByRole('button', { name: 'Daily' }))
    await user.click(within(strip()).getByRole('button', { name: 'Today' }))
    const daily = await screen.findByRole('region', { name: 'Daily' })
    expect(within(daily).getByRole('button', { name: /^Boxing/ })).toBeTruthy()
  })

  it('remembers the last chip while the app is open', async () => {
    const user = await renderLibrary()
    await user.click(chip('Reading'))
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    await user.click(within(await menu()).getByRole('button', { name: 'Library' }))
    await screen.findByRole('list', { name: 'Habits' })
    expect(pressed()).toEqual(['Reading'])
  })
})

describe('Stats', () => {
  const renderStats = async () => {
    const user = renderOnMenu()
    await user.click(within(await menu()).getByRole('button', { name: 'Stats' }))
    await screen.findByRole('list', { name: 'Stats' })
    return user
  }
  const cards = () => within(screen.getByRole('list', { name: 'Stats' })).getAllByRole('listitem')
  const card = (name: string) => cards().find((c) => c.querySelector('h2')!.textContent === name)!

  it('shows the four stats in SPEC order with rank, title and total points', async () => {
    await seed('courage', 130)
    await renderStats()
    expect(cards().map((c) => c.querySelector('h2')!.textContent)).toEqual(['Charm', 'Courage', 'Intelligence', 'Proficiency'])
    expect(card('Courage').textContent).toMatch(/Rank 2/)
    expect(card('Courage').textContent).toMatch(/Steady/)
    expect(card('Courage').textContent).toMatch(/130 pts/)
    expect(card('Charm').textContent).toMatch(/Rank 1.*Plain.*0 pts/)
  })

  it('never shows the points needed or the next title', async () => {
    await seed('courage', 130)
    await renderStats()
    const text = card('Courage').textContent!
    expect(text).not.toMatch(/200|70|to rank|next/i)
    expect(text).not.toMatch(/Bold/)
    expect(text.match(/\d+/g)).toEqual(['2', '130']) // the rank and the total, nothing else
  })

  it('fills one pip per rank', async () => {
    await seed('courage', 130)
    await renderStats()
    expect(card('Courage').querySelectorAll('.pip.on')).toHaveLength(2)
    expect(card('Courage').querySelectorAll('.pip')).toHaveLength(5)
  })

  it('shows Max at 1000', async () => {
    await seed('charm', 1000)
    await renderStats()
    expect(card('Charm').textContent).toMatch(/Max/)
    expect(card('Charm').textContent).not.toMatch(/Rank/)
    expect(card('Charm').textContent).toMatch(/Radiant.*1000 pts/)
    expect(card('Charm').querySelectorAll('.pip.on')).toHaveLength(5)
  })

  it('shows Graduated only when all four stats are maxed', async () => {
    for (const stat of ['charm', 'courage', 'intelligence'] as const) await seed(stat, 1000)
    await seed('proficiency', 999)
    await renderStats()
    const statsPane = () => within(screen.getByRole('region', { name: 'Stats' }))
    expect(statsPane().queryByText('Graduated')).toBeNull()
    cleanup()
    // The last point, on another day so it doesn't clash with the 999 row.
    await db.awards.add({ habitId: 'boxing', date: '2026-10-25', stat: 'proficiency', points: 1 })
    await renderStats()
    expect(statsPane().getByText('Graduated')).toBeTruthy()
  })

  it('updates after a log and after a delete in Today', async () => {
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
    const sheet = await openSheet(user, 'Boxing')
    await logInSheet(user, sheet, '25') // +3 Courage, +2 Charm
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))
    await user.click(within(strip()).getByRole('button', { name: 'Stats' }))
    await waitFor(() => expect(card('Courage').textContent).toMatch(/3 pts/))
    expect(card('Charm').textContent).toMatch(/2 pts/)

    await user.click(within(strip()).getByRole('button', { name: 'Today' }))
    const again = await openSheet(user, 'Boxing')
    await user.click(within(again).getByRole('button', { name: 'Delete' }))
    await within(again).findByText(/no sessions yet today/i)
    await user.click(within(again).getByRole('button', { name: 'Close' }))
    await user.click(within(strip()).getByRole('button', { name: 'Stats' }))
    await waitFor(() => expect(card('Courage').textContent).toMatch(/0 pts/))
  })
})

describe('My habits', () => {
  const renderMine = async () => {
    const user = renderOnMenu()
    await user.click(within(await menu()).getByRole('button', { name: 'My habits' }))
    await screen.findByRole('button', { name: /add custom habit/i })
    return user
  }
  const listRows = (name: string) => {
    const list = screen.queryByRole('list', { name })
    return list ? within(list).getAllByRole('listitem') : []
  }
  const namesIn = (name: string) => listRows(name).map((li) => li.querySelector('.name')!.textContent)
  const rowIn = (list: string, name: string) => listRows(list).find((li) => li.querySelector('.name')!.textContent === name)!
  const meditation = { name: 'Meditation', category: 'study' as const, weights: { intelligence: 100 } }

  it('lists your habits in Today order, with their kind and a Custom tag on custom habits', async () => {
    await store.addToList('running', 'daily')
    await store.addToList('chess', 'anytime')
    await store.addToList('boxing', 'daily')
    await store.addToList(await store.saveCustomHabit(meditation), 'anytime')
    await renderMine()
    await waitFor(() => expect(namesIn('Your list')).toEqual(['Boxing', 'Running', 'Chess', 'Meditation']))
    expect(rowIn('Your list', 'Boxing').textContent).toMatch(/Daily/)
    expect(rowIn('Your list', 'Boxing').textContent).not.toMatch(/Custom/)
    expect(rowIn('Your list', 'Meditation').textContent).toMatch(/Anytime/)
    expect(rowIn('Your list', 'Meditation').textContent).toMatch(/Custom/)
    expect(namesIn('Your custom habits')).toEqual([])
  })

  it('tapping the kind tag switches daily/anytime, and Today follows', async () => {
    await db.activeHabits.put({ habitId: 'boxing', addedOn: '2026-10-20', kind: 'daily' })
    const user = await renderMine()
    await waitFor(() => expect(namesIn('Your list')).toEqual(['Boxing']))
    await user.click(within(rowIn('Your list', 'Boxing')).getByRole('button', { name: /^Daily/ }))
    await waitFor(() => expect(within(rowIn('Your list', 'Boxing')).getByRole('button', { name: /^Anytime/ })).toBeTruthy())
    expect(await store.activeHabits()).toEqual([{ habitId: 'boxing', addedOn: '2026-10-20', kind: 'anytime' }])
    await user.click(within(strip()).getByRole('button', { name: 'Today' }))
    const anytime = await screen.findByRole('region', { name: 'Anytime' })
    expect(within(anytime).getByRole('button', { name: /^Boxing/ })).toBeTruthy()
  })

  it('removes a habit with a toast, keeping its history; Undo puts it back exactly', async () => {
    await db.activeHabits.put({ habitId: 'boxing', addedOn: '2026-10-20', kind: 'daily' })
    await store.logSession('boxing', 25)
    const user = await renderMine()
    await waitFor(() => expect(namesIn('Your list')).toEqual(['Boxing']))
    await user.click(within(rowIn('Your list', 'Boxing')).getByRole('button', { name: 'Remove' }))
    const toast = await screen.findByRole('status')
    expect(toast.textContent).toMatch(/Removed\. Its history stays\./)
    await waitFor(() => expect(namesIn('Your list')).toEqual([]))
    expect(await store.activeHabits()).toEqual([])
    expect(await store.totals()).toMatchObject({ courage: 3, charm: 2 })

    await user.click(within(toast).getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(namesIn('Your list')).toEqual(['Boxing']))
    expect(await store.activeHabits()).toEqual([{ habitId: 'boxing', addedOn: '2026-10-20', kind: 'daily' }])
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('the toast goes after 5 seconds', { timeout: 10_000 }, async () => {
    await store.addToList('boxing', 'daily')
    const user = await renderMine()
    await waitFor(() => expect(namesIn('Your list')).toEqual(['Boxing']))
    await user.click(within(rowIn('Your list', 'Boxing')).getByRole('button', { name: 'Remove' }))
    expect(await screen.findByRole('status')).toBeTruthy()
    await new Promise((done) => setTimeout(done, 4500))
    expect(screen.queryByRole('status')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull(), { timeout: 2000 })
  })

  it('a second remove replaces the toast; Undo brings back only the latest', async () => {
    await store.addToList('boxing', 'daily')
    await store.addToList('running', 'daily')
    const user = await renderMine()
    await waitFor(() => expect(namesIn('Your list')).toEqual(['Boxing', 'Running']))
    await user.click(within(rowIn('Your list', 'Boxing')).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(namesIn('Your list')).toEqual(['Running']))
    await user.click(within(rowIn('Your list', 'Running')).getByRole('button', { name: 'Remove' }))
    expect(screen.getAllByRole('status')).toHaveLength(1)
    await user.click(within(screen.getByRole('status')).getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(namesIn('Your list')).toEqual(['Running']))
  })

  it('leaving My habits closes the toast', async () => {
    await store.addToList('boxing', 'daily')
    const user = await renderMine()
    await waitFor(() => expect(namesIn('Your list')).toEqual(['Boxing']))
    await user.click(within(rowIn('Your list', 'Boxing')).getByRole('button', { name: 'Remove' }))
    expect(await screen.findByRole('status')).toBeTruthy()
    await user.click(within(strip()).getByRole('button', { name: 'Stats' }))
    // hidden: true also looks in the panes swiped away from (they're aria-hidden).
    expect(screen.queryByRole('status', { hidden: true })).toBeNull()
  })

  it('lists custom habits that are not on your list, and adds one back', async () => {
    await store.saveCustomHabit(meditation)
    const user = await renderMine()
    await waitFor(() => expect(namesIn('Your custom habits')).toEqual(['Meditation']))
    await user.click(within(rowIn('Your custom habits', 'Meditation')).getByRole('button', { name: 'Add Meditation' }))
    await user.click(within(rowIn('Your custom habits', 'Meditation')).getByRole('button', { name: 'Anytime' }))
    await waitFor(() => expect(namesIn('Your list')).toEqual(['Meditation']))
    expect(screen.queryByRole('list', { name: 'Your custom habits' })).toBeNull()
  })

  it('says the list is empty and links to the Library', async () => {
    const user = await renderMine()
    expect(await screen.findByText(/your list is empty/i)).toBeTruthy()
    await user.click(within(screen.getByRole('region', { name: 'My habits' })).getByRole('button', { name: 'Go to Library' }))
    expect(await screen.findByRole('list', { name: 'Habits' })).toBeTruthy()
  })

  describe('new custom habit sheet', () => {
    const openForm = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByRole('button', { name: /add custom habit/i }))
      return screen.findByRole('dialog', { name: 'New custom habit' })
    }
    const pressedIn = (sheet: HTMLElement, group: string) =>
      within(within(sheet).getByRole('group', { name: group }))
        .getAllByRole('button')
        .filter((b) => b.getAttribute('aria-pressed') === 'true')
        .map((b) => b.textContent)
    const weight = (sheet: HTMLElement, stat: string) => within(sheet).getByLabelText(`${stat} weight`).textContent
    const save = (sheet: HTMLElement) => within(sheet).getByRole('button', { name: 'Save' }) as HTMLButtonElement

    it("a category pre-selects its default stats, split evenly", async () => {
      const user = await renderMine()
      const sheet = await openForm(user)
      expect(pressedIn(sheet, 'Category')).toEqual([])
      await user.click(within(within(sheet).getByRole('group', { name: 'Category' })).getByRole('button', { name: 'Fitness' }))
      expect(pressedIn(sheet, 'Stats')).toEqual(['Courage', 'Proficiency'])
      expect(weight(sheet, 'Courage')).toBe('50')
      expect(weight(sheet, 'Proficiency')).toBe('50')
      expect(within(sheet).getByText(/Total 100 \/ 100/)).toBeTruthy()
    })

    it('turning stats on or off resets the split; the first stat gets the extra 10', async () => {
      const user = await renderMine()
      const sheet = await openForm(user)
      const stats = within(within(sheet).getByRole('group', { name: 'Stats' }))
      await user.click(within(within(sheet).getByRole('group', { name: 'Category' })).getByRole('button', { name: 'Study' }))
      expect(weight(sheet, 'Intelligence')).toBe('100')
      await user.click(stats.getByRole('button', { name: 'Charm' }))
      expect([weight(sheet, 'Intelligence'), weight(sheet, 'Charm')]).toEqual(['50', '50'])
      await user.click(stats.getByRole('button', { name: 'Courage' }))
      expect([weight(sheet, 'Intelligence'), weight(sheet, 'Charm'), weight(sheet, 'Courage')]).toEqual(['40', '30', '30'])
      await user.click(stats.getByRole('button', { name: 'Intelligence' }))
      expect([weight(sheet, 'Charm'), weight(sheet, 'Courage')]).toEqual(['50', '50'])
      expect(within(sheet).queryByLabelText('Intelligence weight')).toBeNull()
    })

    it('steppers move by 10, stay between 10 and 100, and Save waits for a total of 100', async () => {
      const user = await renderMine()
      const sheet = await openForm(user)
      await user.type(within(sheet).getByLabelText('Name'), 'Juggling')
      await user.click(within(within(sheet).getByRole('group', { name: 'Category' })).getByRole('button', { name: 'Art' }))
      expect(save(sheet).disabled).toBe(false)
      await user.click(within(sheet).getByRole('button', { name: 'More Proficiency' }))
      expect(weight(sheet, 'Proficiency')).toBe('60')
      expect(within(sheet).getByText(/Total 110 \/ 100/)).toBeTruthy()
      expect(save(sheet).disabled).toBe(true)
      await user.click(within(sheet).getByRole('button', { name: 'Less Charm' }))
      expect(save(sheet).disabled).toBe(false)
      for (let i = 0; i < 3; i++) await user.click(within(sheet).getByRole('button', { name: 'Less Charm' }))
      expect(weight(sheet, 'Charm')).toBe('10')
      expect((within(sheet).getByRole('button', { name: 'Less Charm' }) as HTMLButtonElement).disabled).toBe(true)
      await user.click(within(within(sheet).getByRole('group', { name: 'Category' })).getByRole('button', { name: 'Reading' }))
      expect(weight(sheet, 'Intelligence')).toBe('100')
      expect((within(sheet).getByRole('button', { name: 'More Intelligence' }) as HTMLButtonElement).disabled).toBe(true)
    })

    it.each([
      ['boxing', /already exists/],
      ['!!!', /letter A–Z or a digit/],
      ['x'.repeat(41), /40/],
    ])('shows why the name "%s" is not allowed, and keeps Save off', async (name, reason) => {
      const user = await renderMine()
      const sheet = await openForm(user)
      await user.click(within(within(sheet).getByRole('group', { name: 'Category' })).getByRole('button', { name: 'Art' }))
      await user.type(within(sheet).getByLabelText('Name'), name)
      expect(within(sheet).getByText(reason)).toBeTruthy()
      expect(save(sheet).disabled).toBe(true)
    })

    it('Save needs a name and a category', async () => {
      const user = await renderMine()
      const sheet = await openForm(user)
      expect(save(sheet).disabled).toBe(true)
      await user.type(within(sheet).getByLabelText('Name'), 'Juggling')
      expect(save(sheet).disabled).toBe(true)
    })

    it('Save creates the habit and puts it on your list with the chosen kind (Daily by default)', async () => {
      const user = await renderMine()
      const sheet = await openForm(user)
      expect(pressedIn(sheet, 'Show as')).toEqual(['Daily'])
      await user.type(within(sheet).getByLabelText('Name'), 'Juggling')
      await user.click(within(within(sheet).getByRole('group', { name: 'Category' })).getByRole('button', { name: 'Art' }))
      await user.click(within(within(sheet).getByRole('group', { name: 'Show as' })).getByRole('button', { name: 'Anytime' }))
      await user.click(save(sheet))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      await waitFor(() => expect(namesIn('Your list')).toEqual(['Juggling']))
      expect(rowIn('Your list', 'Juggling').textContent).toMatch(/Anytime.*Custom|Custom.*Anytime/)
      expect((await store.habits()).find((h) => h.id === 'custom-juggling')).toMatchObject({
        name: 'Juggling',
        category: 'art',
        weights: { proficiency: 50, charm: 50 },
      })
      await user.click(within(strip()).getByRole('button', { name: 'Today' }))
      const anytime = await screen.findByRole('region', { name: 'Anytime' })
      expect(within(anytime).getByRole('button', { name: /^Juggling/ })).toBeTruthy()
    })

    it('closes with ✕ without saving', async () => {
      const user = await renderMine()
      const sheet = await openForm(user)
      await user.type(within(sheet).getByLabelText('Name'), 'Juggling')
      await user.click(within(sheet).getByRole('button', { name: 'Close' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(await db.customHabits.count()).toBe(0)
    })

    it('closes when tapping outside the sheet, without saving', async () => {
      const user = await renderMine()
      const sheet = await openForm(user)
      await user.type(within(sheet).getByLabelText('Name'), 'Juggling')
      await user.click(document.querySelector('.sheet-backdrop')!)
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(await db.customHabits.count()).toBe(0)
    })
  })
})

describe('rank banner (placeholder until step 5)', () => {
  it('shows a rank-up, and dismisses on tap', async () => {
    await seed('courage', 58)
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
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
    const user = await renderApp()
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
    const user = await renderApp()
    await logInSheet(user, await openSheet(user, 'Calligraphy'), '10')
    expect((await screen.findByRole('status')).textContent).toMatch(/graduated/i)
  })

  it('stays silent on a rank-down', async () => {
    await seed('courage', 58)
    await store.addToList('boxing', 'daily')
    await store.logSession('boxing', 25) // Courage 61
    const user = await renderApp()
    const sheet = await openSheet(user, 'Boxing')
    await user.click(within(sheet).getByRole('button', { name: 'Delete' }))
    await within(sheet).findByText(/no sessions yet today/i)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
