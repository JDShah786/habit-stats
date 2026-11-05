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

  // Bubbles are decorative <i class="pop"> elements added to <body>. Clear any left from
  // the menu-word tap first, so only MENU's own bubbles count.
  const clearBubbles = () => document.querySelectorAll('.pop').forEach((b) => b.remove())

  it('MENU pops bubbles when tapped', async () => {
    reduceMotion = false
    const user = renderOnMenu()
    await user.click(within(await menu()).getByRole('button', { name: 'Stats' }))
    await screen.findByRole('heading', { level: 1, name: 'Stats' }, { timeout: 2000 })
    clearBubbles()
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    expect(document.querySelectorAll('.pop').length).toBeGreaterThan(0)
  })

  it('MENU pops no bubbles with Reduce Motion on', async () => {
    const user = await renderApp()
    clearBubbles()
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    expect(document.querySelectorAll('.pop')).toHaveLength(0)
  })
})

describe('install hint (step 7)', () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
  const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))
  const hint = () => screen.queryByRole('complementary', { name: 'Install Meta Log' })
  // jsdom says it's a desktop browser; these tests pretend to be an iPhone where needed.
  const beIPhone = () => Object.defineProperty(navigator, 'userAgent', { configurable: true, value: IPHONE })
  afterEach(() => {
    delete (navigator as { userAgent?: string }).userAgent // back to jsdom's own
  })
  // The installed app reports display-mode: standalone.
  const beInstalled = () => {
    const ordinary = window.matchMedia
    window.matchMedia = (query: string) => ({ ...ordinary(query), matches: query === '(display-mode: standalone)' || ordinary(query).matches })
  }

  it("on an iPhone in Safari, the menu shows how to add Meta Log to the Home Screen, and the backup tip", async () => {
    beIPhone()
    renderOnMenu()
    const card = await screen.findByRole('complementary', { name: 'Install Meta Log' })
    expect(card.textContent).toMatch(/tap Share, then Add to Home Screen/i)
    expect(card.textContent).toMatch(/export a backup here first/i)
  })

  it('does not show once installed', async () => {
    beIPhone()
    beInstalled()
    renderOnMenu()
    await menu()
    await sleep(300)
    expect(hint()).toBeNull()
  })

  it('does not show on the laptop', async () => {
    renderOnMenu()
    await menu()
    await sleep(300)
    expect(hint()).toBeNull()
  })

  it('✕ hides it for good, even after the app reopens', async () => {
    beIPhone()
    const user = renderOnMenu()
    const card = await screen.findByRole('complementary', { name: 'Install Meta Log' })
    await user.click(within(card).getByRole('button', { name: 'Dismiss install hint' }))
    expect(hint()).toBeNull()
    expect(await store.installHintDismissed()).toBe(true)
    cleanup()
    renderOnMenu()
    await menu()
    await sleep(300)
    expect(hint()).toBeNull()
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

describe('Settings: backup', () => {
  type User = ReturnType<typeof userEvent.setup>
  const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))
  const openSettings = async () => {
    const user = renderOnMenu()
    await user.click(within(await menu()).getByRole('button', { name: 'My habits' }))
    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    return { user, sheet: await screen.findByRole('dialog', { name: 'Settings' }) }
  }
  // A backup made on 20 Oct: Juggling (custom) on the list, one session, its awards.
  const backup = (changes: Record<string, unknown> = {}) => ({
    app: 'habit-stats',
    version: 1,
    exportedAt: '2026-10-20T12:00:00.000Z',
    data: {
      customHabits: [{ id: 'custom-juggling', name: 'Juggling', category: 'art', weights: { proficiency: 50, charm: 50 }, custom: true }],
      activeHabits: [
        { habitId: 'custom-juggling', addedOn: '2026-10-02', kind: 'anytime' },
        { habitId: 'chess', addedOn: '2026-10-03', kind: 'daily' },
      ],
      sessions: [
        { id: 1, habitId: 'custom-juggling', date: '2026-10-19', minutes: 30 },
        { id: 2, habitId: 'chess', date: '2026-10-20', minutes: 10 },
      ],
      awards: [
        { habitId: 'custom-juggling', date: '2026-10-19', stat: 'proficiency', points: 3 },
        { habitId: 'custom-juggling', date: '2026-10-19', stat: 'charm', points: 3 },
        { habitId: 'chess', date: '2026-10-20', stat: 'intelligence', points: 3 },
        { habitId: 'chess', date: '2026-10-20', stat: 'courage', points: 1 },
      ],
    },
    ...changes,
  })
  const file = (contents: unknown, name = 'habit-stats-backup-2026-10-20.json') =>
    new File([typeof contents === 'string' ? contents : JSON.stringify(contents)], name, { type: 'application/json' })
  const importFile = (user: User, sheet: HTMLElement, f: File) => user.upload(within(sheet).getByLabelText('Import backup'), f)

  // jsdom has no share sheet and no object URLs; each test sets up what it needs.
  const setShare = (share?: (data: ShareData) => Promise<void>) => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: share ? () => true : undefined })
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
  }
  afterEach(() => setShare(undefined))

  it('SETTINGS on My habits opens the sheet: no backup yet, Export and Import', async () => {
    const { sheet } = await openSettings()
    expect(within(sheet).getByText(/no backup yet/i)).toBeTruthy()
    expect(within(sheet).getByRole('button', { name: 'Export backup' })).toBeTruthy()
    expect(within(sheet).getByLabelText('Import backup')).toBeTruthy()
  })

  it("Export hands the file to the share sheet, named after today, and records today's backup", async () => {
    await store.addToList('boxing', 'daily')
    await store.logSession('boxing', 25)
    const shared: File[] = []
    setShare(async (data) => void shared.push(...(data.files ?? [])))
    const { user, sheet } = await openSettings()
    await user.click(within(sheet).getByRole('button', { name: 'Export backup' }))
    await waitFor(() => expect(within(sheet).getByText(/last backup: 27 oct 2026/i)).toBeTruthy())
    expect(shared).toHaveLength(1)
    expect(shared[0].name).toBe('meta-log-backup-2026-10-27.json')
    const saved = JSON.parse(await shared[0].text())
    expect(saved).toMatchObject({ app: 'habit-stats', version: 1, exportedAt: NOW.toISOString() })
    expect(saved.data.sessions).toEqual([expect.objectContaining({ habitId: 'boxing', minutes: 25 })])
    expect(saved.data.activeHabits).toEqual([expect.objectContaining({ habitId: 'boxing', kind: 'daily' })])
  })

  it('cancelling the share sheet does not count as a backup', async () => {
    setShare(() => Promise.reject(new DOMException('cancelled', 'AbortError')))
    const { user, sheet } = await openSettings()
    await user.click(within(sheet).getByRole('button', { name: 'Export backup' }))
    await sleep(200)
    expect(within(sheet).getByText(/no backup yet/i)).toBeTruthy()
    expect(within(sheet).queryByRole('alert')).toBeNull()
  })

  it('without a share sheet (e.g. the laptop), Export downloads the file', async () => {
    setShare(undefined)
    const downloads: string[] = []
    URL.createObjectURL = () => 'blob:backup'
    URL.revokeObjectURL = () => {}
    const click = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      downloads.push(this.download)
    }
    try {
      const { user, sheet } = await openSettings()
      await user.click(within(sheet).getByRole('button', { name: 'Export backup' }))
      await waitFor(() => expect(within(sheet).getByText(/last backup: 27 oct 2026/i)).toBeTruthy())
      expect(downloads).toEqual(['meta-log-backup-2026-10-27.json'])
    } finally {
      HTMLAnchorElement.prototype.click = click
    }
  })

  it('Import checks the file, then asks before replacing, showing what is in it', async () => {
    await store.addToList('boxing', 'daily')
    const { user, sheet } = await openSettings()
    await importFile(user, sheet, file(backup()))
    expect(await within(sheet).findByText('Backup from 20 Oct 2026 · 2 habits on your list · 2 sessions')).toBeTruthy()
    expect(within(sheet).getByText(/this replaces all data on this phone/i)).toBeTruthy()
    // Nothing has changed yet.
    expect(await store.activeHabits()).toEqual([expect.objectContaining({ habitId: 'boxing' })])
  })

  it('REPLACE swaps in the backup: every table, the sections reload, and no rank-ups play', async () => {
    await store.addToList('boxing', 'daily')
    await store.logSession('boxing', 25)
    const { user, sheet } = await openSettings()
    await importFile(user, sheet, file(backup()))
    await user.click(await within(sheet).findByRole('button', { name: 'Replace' }))
    expect(await within(sheet).findByText('Backup restored.')).toBeTruthy()
    expect(within(sheet).getByText(/last backup: 20 oct 2026/i)).toBeTruthy()
    const all = await store.allData()
    expect(all.activeHabits.map((a) => a.habitId).sort()).toEqual(['chess', 'custom-juggling'])
    expect(all.sessions.map((s) => s.id)).toEqual([1, 2])
    expect(all.customHabits.map((h) => h.id)).toEqual(['custom-juggling'])
    expect(await store.totals()).toEqual({ charm: 3, courage: 1, intelligence: 3, proficiency: 3 })
    // My habits shows the restored list.
    await waitFor(() => {
      const list = within(screen.getByRole('list', { name: 'Your list' }))
      expect(list.getAllByRole('listitem').map((li) => li.querySelector('.name')!.textContent)).toEqual(['Chess', 'Juggling'])
    })
    await sleep(700)
    expect(screen.queryByRole('dialog', { name: 'Rank up' })).toBeNull()
  })

  it('Cancel at the confirm step leaves everything as it was', async () => {
    await store.addToList('boxing', 'daily')
    const { user, sheet } = await openSettings()
    await importFile(user, sheet, file(backup()))
    await user.click(await within(sheet).findByRole('button', { name: 'Cancel' }))
    expect(within(sheet).queryByRole('button', { name: 'Replace' })).toBeNull()
    expect(await store.activeHabits()).toEqual([expect.objectContaining({ habitId: 'boxing' })])
    expect(within(sheet).getByText(/no backup yet/i)).toBeTruthy()
  })

  it.each([
    ['a file that is not a backup', 'hello', /not a Meta Log backup/],
    ['a backup from a newer app', backup({ version: 2 }), /newer version/],
    ['a backup with a bad session', backup({ data: { ...backup().data, sessions: [{ id: 1, habitId: 'chess', date: '2026-10-20', minutes: 0 }] } }), /minutes/],
  ])('rejects %s: says why, offers no Replace, and changes nothing', async (_, contents, why) => {
    await store.addToList('boxing', 'daily')
    const { user, sheet } = await openSettings()
    await importFile(user, sheet, file(contents))
    expect((await within(sheet).findByRole('alert')).textContent).toMatch(why)
    expect(within(sheet).queryByRole('button', { name: 'Replace' })).toBeNull()
    expect(await store.activeHabits()).toEqual([expect.objectContaining({ habitId: 'boxing' })])
  })
})

describe('points chart', () => {
  const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))
  const chart = () => screen.findByRole('status', { name: 'Points earned' })
  const chartGone = () =>
    waitFor(() => expect(screen.queryByRole('status', { name: 'Points earned' })).toBeNull(), { timeout: 4000 })
  // What a stat's node shows (its rank, or MAX) and its "+N" tally.
  const nodeRank = (el: HTMLElement, stat: string) => el.querySelector(`[data-stat="${stat}"] .pc-rank`)!.textContent
  const tally = (el: HTMLElement, stat: string) => el.querySelector(`.pc-tally[data-stat="${stat}"]`)!.textContent
  // Counts the beads that fly (decorative <i class="pc-bead"> added to <body>).
  const countBeads = () => {
    const seen = { beads: 0 }
    const watch = new MutationObserver((changes) =>
      changes.forEach((c) => c.addedNodes.forEach((n) => (n as Element).classList?.contains('pc-bead') && seen.beads++)),
    )
    watch.observe(document.body, { childList: true })
    return { seen, stop: () => watch.disconnect() }
  }

  it('comes up after LOG with the habit and the minutes just logged, and the points per stat', async () => {
    await store.addToList('boxing', 'daily')
    await store.logSession('boxing', 5) // earlier today (2 pts: Courage 2, Charm 1); the caption shows only this log
    const user = await renderApp()
    await logInSheet(user, await openSheet(user, 'Boxing'), '15') // day 20 min, 4 pts: Courage 3, Charm 2, so +1 each
    const shown = await chart()
    expect(shown.textContent).toMatch(/boxing · 15 min/i)
    expect(within(shown).getByText('+1 Courage')).toBeTruthy()
    expect(within(shown).getByText('+1 Charm')).toBeTruthy()
  })

  it("shows each stat's tally and its node's rank, ranking up when a threshold is crossed", async () => {
    await seed('courage', 58)
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
    await logInSheet(user, await openSheet(user, 'Boxing'), '25') // Courage 58 → 61, Charm 0 → 2
    const shown = await chart()
    // With Reduce Motion the chart shows its final state at once.
    expect(tally(shown, 'courage')).toBe('+3')
    expect(tally(shown, 'charm')).toBe('+2')
    expect(tally(shown, 'intelligence')).toBe('')
    expect(nodeRank(shown, 'courage')).toBe('2')
    expect(nodeRank(shown, 'charm')).toBe('1')
  })

  it('a maxed stat shows MAX', async () => {
    await seed('courage', 999)
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
    await logInSheet(user, await openSheet(user, 'Boxing'), '5')
    expect(nodeRank(await chart(), 'courage')).toBe('MAX')
  })

  it('closes on its own, back to the log sheet', async () => {
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
    await logInSheet(user, await openSheet(user, 'Boxing'), '25')
    await chart()
    await chartGone()
    expect(screen.getByRole('dialog', { name: 'Boxing' })).toBeTruthy()
  })

  it('a tap skips it', async () => {
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
    await logInSheet(user, await openSheet(user, 'Boxing'), '25')
    const shown = await chart()
    await sleep(450) // it can be skipped after 0.4 s
    await user.click(shown)
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Points earned' })).toBeNull(), { timeout: 600 })
  })

  it('a rank-up waits for the chart to close', async () => {
    await seed('courage', 58)
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
    await logInSheet(user, await openSheet(user, 'Boxing'), '25')
    await chart()
    await sleep(600)
    expect(screen.queryByRole('dialog', { name: 'Rank up' })).toBeNull()
    await chartGone()
    expect(await screen.findByRole('dialog', { name: 'Rank up' }, { timeout: 2000 })).toBeTruthy()
  })

  it('does not come up for edits or deletes', async () => {
    await store.addToList('boxing', 'daily')
    await store.logSession('boxing', 25)
    const user = await renderApp()
    const sheet = await openSheet(user, 'Boxing')
    await user.click(within(sheet).getByRole('button', { name: 'Edit' }))
    const box = within(sheet).getByLabelText('Edit minutes')
    await user.clear(box)
    await user.type(box, '40')
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    await within(sheet).findByText('40 min')
    await user.click(within(sheet).getByRole('button', { name: 'Delete' }))
    await within(sheet).findByText(/no sessions yet today/i)
    await sleep(500)
    expect(screen.queryByRole('status', { name: 'Points earned' })).toBeNull()
  })

  it('does not come up when a log earns nothing (every stat it feeds is maxed)', async () => {
    await seed('courage', 1000)
    await seed('charm', 1000)
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
    const sheet = await openSheet(user, 'Boxing')
    await logInSheet(user, sheet, '25')
    await within(sheet).findByText('25 min')
    await sleep(500)
    expect(screen.queryByRole('status', { name: 'Points earned' })).toBeNull()
  })

  it('with Reduce Motion: no beads fly', async () => {
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
    const beads = countBeads()
    await logInSheet(user, await openSheet(user, 'Boxing'), '25')
    await chart()
    await sleep(800)
    beads.stop()
    expect(beads.seen.beads).toBe(0)
  })

  it('with Reduce Motion off: one bead per point flies in, and the tallies count up to the totals', { timeout: 10_000 }, async () => {
    reduceMotion = false
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
    const beads = countBeads()
    await logInSheet(user, await openSheet(user, 'Boxing'), '25') // +2 Charm, +3 Courage
    const shown = await chart()
    expect(tally(shown, 'courage')).toBe('')
    await waitFor(() => expect(tally(shown, 'courage')).toBe('+3'), { timeout: 3000 })
    expect(tally(shown, 'charm')).toBe('+2')
    beads.stop()
    expect(beads.seen.beads).toBe(5)
  })
})

describe('rank-up and graduation', () => {
  type User = ReturnType<typeof userEvent.setup>
  const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))
  // The full-screen moment. After a log it waits for the points chart to close (up to ~3 s);
  // after an edit it waits ~0.95 s (0.4 s with Reduce Motion).
  const moment = (name: 'Rank up' | 'Graduated') => screen.findByRole('dialog', { name }, { timeout: 5000 })
  const continueIn = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: /continue/i }) as HTMLButtonElement
  // Continue is disabled until the moment can be tapped away.
  const tapAway = async (user: User, dialog: HTMLElement) => {
    await waitFor(() => expect(continueIn(dialog).disabled).toBe(false), { timeout: 2000 })
    await user.click(continueIn(dialog))
  }
  const gone = (name: 'Rank up' | 'Graduated') =>
    waitFor(() => expect(screen.queryByRole('dialog', { name })).toBeNull(), { timeout: 2000 })
  // Sparks, shockwave rings and bubbles are decorative elements added to <body>.
  const clearFx = () => document.querySelectorAll('.pop, .spark, .shock').forEach((el) => el.remove())
  // Courage and Intelligence maxed; Proficiency one point short; Charm maxed unless given.
  const almostGraduated = async (charm = 1000) => {
    await seed('charm', charm)
    await seed('courage', 1000)
    await seed('intelligence', 1000)
    await seed('proficiency', 999)
  }

  it('plays after the points chart, shows the stat, old → new rank and title, and no next-rank info', async () => {
    await seed('courage', 58)
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
    const sheet = await openSheet(user, 'Boxing')
    await logInSheet(user, sheet, '25') // Courage 58 → 61: rank 1 → 2
    await screen.findByRole('status', { name: 'Points earned' })
    expect(screen.queryByRole('dialog', { name: 'Rank up' })).toBeNull()

    const up = await moment('Rank up')
    expect(up.textContent).toMatch(/rank up!/i)
    expect(up.textContent).toMatch(/courage/i)
    expect(within(up).getByText('1')).toBeTruthy()
    expect(within(up).getByText('2')).toBeTruthy()
    expect(up.textContent).toMatch(/timid/i)
    expect(up.textContent).toMatch(/steady/i)
    // Like the games: no threshold, points or next title.
    expect(up.textContent).not.toMatch(/next|bold|200|pts/i)
  })

  it('Continue taps it away, back to the log sheet', async () => {
    await seed('courage', 58)
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
    await logInSheet(user, await openSheet(user, 'Boxing'), '25')
    await tapAway(user, await moment('Rank up'))
    await gone('Rank up')
    expect(screen.getByRole('dialog', { name: 'Boxing' })).toBeTruthy()
  })

  it('a tap anywhere on it, or Escape, also taps it away', async () => {
    await seed('courage', 58)
    await seed('charm', 59)
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
    const sheet = await openSheet(user, 'Boxing')
    await logInSheet(user, sheet, '25') // Courage and Charm both rank up: two moments
    const first = await moment('Rank up')
    await waitFor(() => expect(continueIn(first).disabled).toBe(false), { timeout: 2000 })
    await user.click(first)
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Rank up' }).textContent).toMatch(/courage/i), { timeout: 2000 })
    const second = screen.getByRole('dialog', { name: 'Rank up' })
    await waitFor(() => expect(continueIn(second).disabled).toBe(false), { timeout: 2000 })
    await user.keyboard('{Escape}')
    await gone('Rank up')
  })

  it('a max rank-up says so', async () => {
    await seed('courage', 999)
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
    await logInSheet(user, await openSheet(user, 'Boxing'), '5') // Courage hits 1000: rank 4 → 5
    const up = await moment('Rank up')
    expect(up.textContent).toMatch(/max rank!/i)
    expect(up.textContent).toMatch(/fearless/i)
    expect(up.textContent).toMatch(/unshakable/i)
    expect(up.textContent).toMatch(/maxed · stops counting/i)
  })

  it('graduation shows GRADUATED!, all four stats at MAX, GOOD JOB! and the message', async () => {
    await almostGraduated()
    await store.addToList('calligraphy', 'daily')
    const user = await renderApp()
    await logInSheet(user, await openSheet(user, 'Calligraphy'), '10')
    await tapAway(user, await moment('Rank up')) // Proficiency's max rank-up comes first
    const grad = await moment('Graduated')
    expect(grad.textContent).toMatch(/graduated!/i)
    for (const title of ['Radiant', 'Unshakable', 'Genius', 'Master']) {
      expect(grad.textContent).toMatch(new RegExp(`max · ${title}`, 'i'))
    }
    expect(grad.textContent).toMatch(/good job!/i)
    expect(grad.textContent).toMatch(/these habits are part of you now\./i)
  })

  it('several events play one at a time: rank-ups in stat order, graduation last', async () => {
    await almostGraduated(999) // Charm one point short too
    await store.addToList('cooking', 'daily')
    const user = await renderApp()
    await logInSheet(user, await openSheet(user, 'Cooking'), '10') // Proficiency and Charm both reach 1000
    const first = await moment('Rank up')
    expect(first.textContent).toMatch(/charm/i)
    await tapAway(user, first)
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Rank up' }).textContent).toMatch(/proficiency/i), { timeout: 2000 })
    await tapAway(user, screen.getByRole('dialog', { name: 'Rank up' }))
    await tapAway(user, await moment('Graduated'))
    await gone('Graduated')
    expect(screen.queryByRole('dialog', { name: 'Rank up' })).toBeNull()
  })

  it('an edit that crosses a threshold plays the rank-up too', async () => {
    await seed('courage', 57)
    await store.addToList('boxing', 'daily')
    const user = await renderApp()
    const sheet = await openSheet(user, 'Boxing')
    await logInSheet(user, sheet, '5') // Courage 57 → 59: no rank-up
    await within(sheet).findByText('5 min')
    await sleep(700)
    expect(screen.queryByRole('dialog', { name: 'Rank up' })).toBeNull()
    await user.click(within(sheet).getByRole('button', { name: 'Edit' }))
    const box = within(sheet).getByLabelText('Edit minutes')
    await user.clear(box)
    await user.type(box, '25')
    await user.click(within(sheet).getByRole('button', { name: 'Save' })) // Courage → 60: rank 1 → 2
    expect((await moment('Rank up')).textContent).toMatch(/steady/i)
  })

  it('stays silent on a rank-down', async () => {
    await seed('courage', 58)
    await store.addToList('boxing', 'daily')
    await store.logSession('boxing', 25) // Courage 61
    const user = await renderApp()
    const sheet = await openSheet(user, 'Boxing')
    await user.click(within(sheet).getByRole('button', { name: 'Delete' }))
    await within(sheet).findByText(/no sessions yet today/i)
    await sleep(700)
    expect(screen.queryByRole('dialog', { name: 'Rank up' })).toBeNull()
  })

  it('with Reduce Motion: no impact sparks or shockwave', async () => {
    clearFx()
    await almostGraduated()
    await store.addToList('calligraphy', 'daily')
    const user = await renderApp()
    await logInSheet(user, await openSheet(user, 'Calligraphy'), '10')
    await tapAway(user, await moment('Rank up'))
    await moment('Graduated')
    await sleep(600)
    expect(document.querySelectorAll('.spark, .shock')).toHaveLength(0)
  })

  describe('with Reduce Motion off', () => {
    it('a rank-up can be tapped away only after 0.7 s', { timeout: 10_000 }, async () => {
      reduceMotion = false
      await seed('courage', 58)
      await store.addToList('boxing', 'daily')
      const user = await renderApp()
      await logInSheet(user, await openSheet(user, 'Boxing'), '25')
      const up = await moment('Rank up')
      expect(continueIn(up).disabled).toBe(true)
      await user.click(up)
      expect(screen.getByRole('dialog', { name: 'Rank up' })).toBeTruthy()
      await waitFor(() => expect(continueIn(up).disabled).toBe(false), { timeout: 1200 })
      await user.click(continueIn(up))
      await gone('Rank up')
    })

    it('graduation lands with sparks and a shockwave, and can be tapped away only after 1 s', { timeout: 10_000 }, async () => {
      reduceMotion = false
      clearFx()
      await almostGraduated()
      await store.addToList('calligraphy', 'daily')
      const user = await renderApp()
      await logInSheet(user, await openSheet(user, 'Calligraphy'), '10')
      await tapAway(user, await moment('Rank up'))
      const grad = await moment('Graduated')
      await waitFor(() => expect(document.querySelector('.spark')).not.toBeNull(), { timeout: 1500 })
      expect(document.querySelector('.shock')).not.toBeNull()
      // A rank-up would be ready by now; graduation waits the full second.
      await sleep(250)
      expect(continueIn(grad).disabled).toBe(true)
      await waitFor(() => expect(continueIn(grad).disabled).toBe(false), { timeout: 1500 })
      await user.click(continueIn(grad))
      await gone('Graduated')
    })
  })
})
