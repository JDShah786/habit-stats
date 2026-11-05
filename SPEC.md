# Habit Stats App — Spec v1

Oct 27, 2026 · Hamid Shah
Originally drafted in: https://claude.ai/artifact/BfwNeF2ticBYJUzXVYq6pU (history only — this file is now the source of truth)

## Overview

A free iPhone habit tracker that turns time spent on habits into Persona-style social stats. You log timed habits; each habit feeds one or more of four stats (Charm, Courage, Intelligence, Proficiency); stats rank up from 1 to 5 over roughly 6–12 months. At Rank 5 (1000 points) a stat is maxed and stops counting. When all four stats are maxed you "graduate": the app congratulates you, because by then the habits are part of you.

- **Cost:** $0 to build, host and use
- **Device:** iPhone, installed from Safari to the Home Screen (PWA)
- **Data:** stays on the phone, no account, no server
- **Built from:** a Windows laptop

## Stack

Every piece is free and runs on Windows. The rule behind each pick: popular, well documented, and transferable to a real job or to an App Store version later.

| Layer | Tool | What it does | Why this one |
| --- | --- | --- | --- |
| Language | TypeScript 7 | JavaScript with types | Catches bugs before running, like Kotlin/Java types you already know |
| Lint | oxlint | Flags common mistakes in code | Vite's default, fast, near-zero config |
| UI | React | Builds screens from components | Most used UI library; same skills port to React Native/Expo |
| Build tool | Vite | Runs a dev server, bundles the app | Fast, simple config, standard for new React apps |
| Installable app | vite-plugin-pwa | Adds the manifest + service worker | Makes it installable on iPhone and work offline |
| Storage | IndexedDB via Dexie.js | Database inside the browser on the phone | Sturdier and bigger than localStorage; Dexie makes it easy to query |
| Animation | Motion (Framer Motion) | Every animation that reacts to touch: taps, screen changes, sheets, the points chart, rank-ups and graduation | Simple API for Persona-style screen effects. A Lottie player may be added later for a few pre-drawn set pieces (not chosen yet) |
| Fonts | Montserrat via @fontsource/montserrat | Heavy italic headings, self-hosted | Free (OFL), works offline; body text uses the iPhone system font |
| Tests | Vitest + React Testing Library + user-event + jsdom + fake-indexeddb | Runs our tests-first suite | Built for Vite; tests logic and screens; jsdom and fake-indexeddb (dev-only) run screen and storage tests in Node and CI |
| Code home | GitHub | Stores code + history | Free, needed for hosting |
| Hosting | GitHub Pages | Serves the app at a public URL | Free, HTTPS (required for PWAs) |
| CI + auto-deploy | GitHub Actions | Runs lint, tests and a type-checked build on every PR; deploys main to GitHub Pages; gives every PR its own preview link with its own database, so previews never touch real data | Free; a failing check blocks a bad merge or deploy |

## Architecture

The app is layers that each do one job. The key design choice: all scoring rules sit in one engine that knows nothing about screens or storage, so it can be tested alone and reused if we ever port to Expo.

```
ON THE iPHONE (PWA)                         BUILD AND DEPLOY (free)
+--------------------------------+          +------------------------+
| Screens (React)                |          | Your laptop            |
| Today, Stats, Library, My habits|         | VS Code + Vite         |
+---------------^----------------+          +-----------+------------+
                | logs in, stats out                    | git push
+---------------v----------------+          +-----------v------------+
| Scoring engine (TypeScript)    |          | GitHub                 |
| Pure functions, rules 1-8      |          +-----------+------------+
| No screen, no database         |                      |
+-------+----------------+-------+          +-----------v------------+
        |                |                  | GitHub Actions         |
+-------v-------+ +------v---------+        | runs all tests         |
| Habit library | | Storage (Dexie)|        +-----------+------------+
| habits.json   | | IndexedDB:     |                    | only if all pass
| read-only     | | sessions,      |        +-----------v------------+
| 100+ presets  | | awards, lists  |        | GitHub Pages (HTTPS)   |
+---------------+ +----------------+        +-----------+------------+
+--------------------------------+                      |
| Service worker: offline cache  |<---------------------+ installs/updates
+--------------------------------+
```

Read left: you log minutes on a screen → the engine applies the rules, reading presets and saving awards → the screen shows new stats. Read right: code goes laptop → GitHub → tests → hosting → your phone.

## Stats, ranks and titles

Four stats, five ranks each. Rank thresholds are total points; gaps grow each rank so early progress is fast and Rank 5 takes 6–12 months.

| Rank | Points needed | Charm | Courage | Intelligence | Proficiency |
| --- | --- | --- | --- | --- | --- |
| 1 | 0 | Plain | Timid | Average | Clumsy |
| 2 | 60 | Pleasant | Steady | Sharp | Handy |
| 3 | 200 | Likable | Bold | Scholar | Skilled |
| 4 | 500 | Magnetic | Fearless | Brilliant | Expert |
| 5 (max) | 1000 | Radiant | Unshakable | Genius | Master |

Pace check: ~3 pts/day into a stat reaches 1000 in ~11 months; ~5.5 pts/day in ~6 months.

## Scoring rules

Each rule below becomes one or more tests before any code is written.

1. **Timed only.** Every habit takes time. A session is logged as whole minutes (1 or more), typed in; anything else is rejected. A day's sessions across all habits can't add up to more than 1440 minutes (24 hours). A timer may come later.
2. **A day** runs midnight to midnight, phone's local time.
3. **Daily points per habit** = 2 base points (once, on the first session that day) + 1 point per full 10 minutes of that day's total time for the habit. Sessions add up: 5 min + 5 min = 10 min = +1. No cap.
4. **Split by weight.** Each habit has integer weights per stat that sum to 100 (e.g. Courage 70, Charm 30). Each stat's share = daily points × weight, **rounded up** to a whole number. No fractions are ever stored.
5. **Recalculate, then pay the difference.** After each session, the app recomputes that habit's shares for the day and awards only what's new. Split sessions score the same as one long one, and rounding up happens once per day, not once per session.
6. **Redirect from maxed stats.** If a stat the habit feeds is already at 1000, its weight moves to the habit's other un-maxed stats, in proportion to their weights. If all its stats are maxed, the habit earns nothing but can still be logged.
7. **Max = 1000, then stop.** A stat never goes above 1000. Points past 1000 redirect to the habit's other un-maxed stats in proportion to their weights, each part rounded up; if none are left, they are dropped. Redirected points count as paid for rule 5. A stat at 1000 shows as Max and stops counting. When all four stats reach 1000, the graduation animation plays.
8. **Rank-ups** trigger the rank-up animation the moment a threshold (60 / 200 / 500 / 1000) is crossed. If one session ever crosses two thresholds, one animation shows old → new.

**Corrections and timing:**

- **Edit or delete** a session to fix mistakes. The app replays today's remaining sessions, in logged order, from the morning's totals, so the day ends exactly as if the deleted time was never logged. Ranks and Graduated status can go back down, since deleted time doesn't count. A rank going down updates silently, with no animation.
- **Today only:** sessions can only be logged, edited or deleted for today. "Today" is checked at the moment of each action, so after midnight yesterday's sessions are locked.

**Worked example — boxing, Courage 70 / Charm 30:**

| Session | Day total | Daily points | Courage (ceil 70%) | Charm (ceil 30%) | Awarded now |
| --- | --- | --- | --- | --- | --- |
| 25 min | 25 min | 2 + 2 = 4 | ceil(2.8) = 3 | ceil(1.2) = 2 | +3 Courage, +2 Charm |
| 20 min | 45 min | 2 + 4 = 6 | ceil(4.2) = 5 | ceil(1.8) = 2 | +2 Courage, +0 Charm |

Above, Courage ends the day at 5 and Charm at 2. **Same sessions, Charm maxed** (Courage takes 100%):

| When Charm maxed | After 25 min | After 45 min | Courage total today |
| --- | --- | --- | --- |
| Before the day started | 4 → +4 Courage | 6 → +2 Courage | 6 |
| During session 1 (its +2 Charm hit 1000) | +3 Courage, +2 Charm | 6 → +3 Courage | 6 |

Rule 5 at work: each session pays only the difference between the new day total and what was already paid.

## Data model

Two kinds of data: the **library** ships inside the app as a read-only file; **your data** lives in IndexedDB on the phone.

| Table | Where | Fields | Purpose |
| --- | --- | --- | --- |
| Habit (preset) | `habits.json` in the app | id, name, category, weights {stat: %} | The 100+ library; editing it needs no code change |
| Habit (custom) | IndexedDB | same as preset + `custom: true`; id is `custom-` + a slug of the name | Habits you add. Name: 1–40 characters with a letter A–Z or a digit, unique among all habits (ignoring case, or giving the same slug). Weights follow the preset rule. Can't be edited once saved, and never deleted, so history always has their weights. |
| ActiveHabit | IndexedDB | habitId, addedOn, kind (daily or anytime) | Which habits are on your list, and how they show. Re-adding sets addedOn to the latest add. Removing only hides the habit; its history stays. Switching daily/anytime keeps addedOn. Undo after a remove puts the row back exactly. |
| Session | IndexedDB | id (auto-numbered = logged order), habitId, date (YYYY-MM-DD, phone-local), minutes | Every time block you log — the raw truth |
| Award | IndexedDB | habitId, date, stat, points | What each habit has paid each stat that day (rule 5 diffs against this) |
| Setting | IndexedDB | key, value | Small app settings, e.g. when the last backup was made |

Totals are not stored: a stat's total is the sum of its Award rows, and this morning's totals are the awards dated before today. Rank, title, Max and Graduated are calculated from totals.

Why totals and ranks aren't stored: a value you can calculate can never disagree with what it's calculated from.

## Habit library

Target: 100+ timed presets across 6 categories, ~17 each. Claude drafts each habit's weights; Hamid approves.

| Category | Default stats |
| --- | --- |
| Fitness | Courage + Proficiency |
| Study | Intelligence |
| Languages | Intelligence + Charm |
| Content creation | Charm + Proficiency |
| Reading | Intelligence |
| Art | Proficiency + Charm |

A habit can override its category default. Library tests: every habit has a unique id, a unique name, a known category, and weights that are multiples of 10 from 10 to 100, summing to 100. A stat a habit doesn't feed is left out, not set to 0. Ids are readable lowercase slugs (e.g. `boxing`, `hiit-20s`) and never change once released, because sessions store them. Preset ids never start with `custom-`, which is reserved for custom habits.

## Screens

The app opens on a command menu: the words TODAY / LIBRARY / STATS / MY HABITS and a "Today's list" card. Tapping a word wipes diagonally into that section. Inside, a tilted strip under the date names all four sections: tap a name or swipe left/right (stops at Today and My habits). MENU returns to the menu with the last section marked.

| Screen | What it shows | Actions |
| --- | --- | --- |
| Menu | The four section words. "Today's list" card: the first 3 habits in Today order with minutes, "+N more", and "N OF M DAILY DONE" (hidden with no daily habits). An empty list says "Nothing on your list yet". | Tap a word, or the card for Today |
| Today | Daily habits, then anytime, each A–Z, with minutes logged today. A habit with time today lights up; only daily habits get a tick. Below: the stat closest to its next rank ("COURAGE · NEXT: RANK 2" plus a bar; fewest points left, skipping maxed stats, ties in stat order). "Graduated" when all four are maxed. | Tap a habit to open the log sheet |
| Log sheet | Habit name, weight chips ("Courage 70"), a big minutes number, quick bubbles 5/10/15/30/60 and CUSTOM, today's sessions with edit/delete, and LOG. After LOG the points chart plays over the sheet, which stays open. Edits and deletes show no chart. | Log, edit or delete today's sessions; close with ✕, a tap outside or a drag down |
| Stats | 4 cards: stat, RANK N or MAX, title, 5 pips, a bar through the current rank, and total points. A GRADUATED pill when all four are at 1000. Like the games, it never shows how many points the next rank takes. | View only |
| Library | Search, then six category chips (opens on Fitness; remembers the last chip while the app is open). Presets only, A–Z, with their stats biggest weight first. Search matches names in every category. | + then DAILY/ANYTIME to add. A habit already on your list shows "ON LIST · DAILY/ANYTIME" |
| My habits | YOUR LIST in Today order with stats, a DAILY/ANYTIME tag and a CUSTOM tag. YOUR CUSTOM HABITS: custom habits off your list (hidden when none). An empty list links to the Library. | Tap the tag to switch kind; remove (a toast offers UNDO for 5 s, latest remove only); add a custom habit back; + ADD CUSTOM HABIT |

**New custom habit sheet:**

- **Name:** required, 40 characters at most, needs a letter A–Z or a digit, and can't match any preset or custom name.
- **Category:** required; picking one pre-selects its default stats.
- **Stats and weights:** stat chips, then each weight with −/+ in steps of 10, from 10 to 100, and "Total N / 100". Turning a stat on or off resets to an even split: 100 / 50-50 / 40-30-30 / 30-30-20-20 (the first stat picked gets the spare 10).
- **Show as:** DAILY (default) or ANYTIME.
- **Save:** off until the total is 100. Creates the habit and adds it to your list.

- **Points chart:** after a LOG that earned points.
  - **Look:** a dark dim, a black cross with lime edges, and a diamond radar of the four stats on top. Rings are ranks 1–5, and each corner sits at its rank plus progress, never point thresholds. Nodes at the cross's arm ends grow with rank (MAX when maxed). The caption shows the habit and the minutes just logged.
  - **Beads:** one bead per point flies from the caption into its stat, one at a time, stat by stat. The more points, the faster they stream (110 ms ÷ log2 of the bead count; at most 40 beads a stat). Each landing ticks a "+N" tally and grows the shape. The bead that crosses a rank swells its node.
  - **Closing:** about 0.9 s after the last bead. A tap (after 0.4 s) or Escape skips it.
  - **Not shown** for edits, deletes, or a log that earns nothing.
- **Rank-up moment:** full screen.
  - **Shows:** RANK UP! (MAX RANK! at Rank 5), the stat, old → new rank, and the old title struck through → new title. Like the games, no threshold or next title. A max rank-up adds "MAXED · STOPS COUNTING".
  - **Timing:** about 1.8 s; can be tapped away after 0.7 s. Content sits in the middle of the screen.
  - **When:** after a log, once the points chart closes; after an edit, about 1 s later. The log sheet stays open under it. Several rank-ups from one change play one screen each, in stat order.
  - Original look inspired by Persona; no Persona art, fonts or sounds.
- **Graduation moment:** when all four stats reach 1000.
  - **Shows:** GRADUATED! lands first and biggest, with impact frames (at most 2 bright flashes) and a burst of sparks. Then the four stats at MAX with their titles, GOOD JOB!, and "These habits are part of you now."
  - **Timing:** about 2.4 s; can be tapped away after 1 s. It plays after any rank-ups from the same change.
  - The app then shows as Graduated. A single stat at 1000 gets the normal rank-up to Rank 5 and shows Max.
- **Keyboard and screen readers:** rank-up and graduation are named dialogs. TAP TO CONTINUE is a real button, locked until the moment can be tapped away. Escape or a tap anywhere also closes them. The points chart is announced as "Points earned" with each stat's gain.
- **Settings:** a bottom sheet opened from a SETTINGS button on My habits. It shows "Last backup: <date>" (or "No backup yet").
  - **Export:** saves a JSON file, `habit-stats-backup-YYYY-MM-DD.json`, holding every table plus the app name, a format version and the export time. It opens the iPhone share sheet, or downloads where there's none. Only a completed export counts as a backup.
  - **Import:** replaces all data, all or nothing.
    - The file is checked first against this spec's rules: format and version, sessions, awards, your list and custom habits. Any problem imports nothing and says why.
    - Stored points aren't re-checked by replaying sessions, since preset weights may change between versions.
    - A confirm step shows "Backup from <date> · N habits on your list · N sessions" and "This replaces all data on this phone." Nothing changes until REPLACE, which swaps everything in one transaction.
    - No rank-up or graduation animations play.

## Look and motion

- **Mood:** original, inspired by Persona 3 Reload's "water and bubbles" feel, in green. No Persona/Atlus art, fonts or sounds.
- **Palette (Neon Lime):** background #050807, depth #0D1F12, accent #39FF7A, highlight #C6FF3D, text #FFFFFF.
- **Shapes:** rounded pills, glossy bubbles, wave lines, a big tilted date block, tilted staggered panels, inverted lime highlights with hard offset shadows, and a faint giant background word that drifts slowly sideways.
- **Type:** headings in Montserrat heavy italic; body in the iPhone system font.
- **Tilt:** each item tilts on its own, never a whole list. All content fits at 360, 390 and 430 px widths.
- **Motion:** taps, screen changes, sheets, the points chart and rank-ups all animate. Button taps pop glossy bubbles, drawn above every overlay.
- **Reduce Motion:** respects the iPhone setting. Screens change at once, there are no bubbles, and the background word stays still. The points chart shows its final state, and rank-up and graduation fade in, with no beads, impact frames, sparks or shake.
- **Smooth on phones:** no full-screen blur or SVG filters in animations, and the background loops pause while an overlay covers them.

## Workflow

1. **Plan** — together: requirements locked by grilling, written into this spec.
2. **Build** — Claude, tests first: write tests from the spec, show they fail, then write code until they pass. Each step explained.
3. **Review** — each step is a pull request that CI checks. Hamid reviews first, then Claude re-reviews against the spec and merges.
4. **Deploy** — push to GitHub; Actions runs every test and only publishes to GitHub Pages if all pass.

Build order:

1. Scoring engine (pure logic, rules 1–8 + corrections) + its tests
2. Habit library file + its validation tests
3. Storage layer (Dexie)
4. Screens: Today → Library → Stats → My habits
5. Rank-up and graduation animations
6. Settings export/import
7. PWA install + offline, then first deploy

## Out of scope for v1

Accounts, cloud sync, App Store, reminders/notifications, streaks, history/calendar view, start/stop timer, stat decay, logging past days, marking missed daily habits (skipping is your choice).

## Decisions

- **Audience:** just Hamid for v1; friends next, maybe public later. Sharing = sending the link; each person's data stays on their own phone.
- **Overflow at max:** redirected to the habit's other stats; dropped if those are maxed too.
- **Graduation:** all four stats at 1000, not one stat at a time.
- **Mistakes:** today's sessions can be edited or deleted; ranks and Graduated can go back down.
- **Back-dating:** no, today only.
- **Removing a habit:** hides it from your list; its sessions and points are never wiped.
- **Daily vs anytime:** no missed marker.
- **Backup:** export/import in v1; import replaces everything, all or nothing.
