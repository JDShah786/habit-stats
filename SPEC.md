# Habit Stats App — Spec v1

Oct 27, 2026 · Hamid Shah
Originally drafted in: https://claude.ai/artifact/BfwNeF2ticBYJUzXVYq6pU (history only — this file is now the source of truth)

## Overview

A free iPhone habit tracker that turns time spent on habits into Persona-style social stats. You log timed habits; each habit feeds one or more of four stats (Charm, Courage, Intelligence, Proficiency); stats rank up from 1 to 5 over roughly 6–12 months. At Rank 5 a stat is "graduated": the app congratulates you and stops counting it, because by then the habit is part of you.

- **Cost:** $0 to build, host and use
- **Device:** iPhone, installed from Safari to the Home Screen (PWA)
- **Data:** stays on the phone, no account, no server
- **Built from:** a Windows laptop

## Stack

Every piece is free and runs on Windows. The rule behind each pick: popular, well documented, and transferable to a real job or to an App Store version later.

| Layer | Tool | What it does | Why this one |
| --- | --- | --- | --- |
| Language | TypeScript | JavaScript with types | Catches bugs before running, like Kotlin/Java types you already know |
| UI | React | Builds screens from components | Most used UI library; same skills port to React Native/Expo |
| Build tool | Vite | Runs a dev server, bundles the app | Fast, simple config, standard for new React apps |
| Installable app | vite-plugin-pwa | Adds the manifest + service worker | Makes it installable on iPhone and work offline |
| Storage | IndexedDB via Dexie.js | Database inside the browser on the phone | Sturdier and bigger than localStorage; Dexie makes it easy to query |
| Animation | Motion (Framer Motion) | Rank-up and graduation animations | Simple API for Persona-style screen effects |
| Tests | Vitest + React Testing Library | Runs our tests-first suite | Built for Vite; tests logic and screens |
| Code home | GitHub | Stores code + history | Free, needed for hosting |
| Hosting | GitHub Pages | Serves the app at a public URL | Free, HTTPS (required for PWAs) |
| Auto-deploy | GitHub Actions | Runs tests, then deploys on every push | Free; a failing test blocks a bad deploy |

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
| 100+ presets  | | awards, totals |        | GitHub Pages (HTTPS)   |
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

1. **Timed only.** Every habit takes time. A session is logged as whole minutes (1 or more), typed in. A timer may come later.
2. **A day** runs midnight to midnight, phone's local time.
3. **Daily points per habit** = 2 base points (once, on the first session that day) + 1 point per full 10 minutes of that day's total time for the habit. Sessions add up: 5 min + 5 min = 10 min = +1. No cap.
4. **Split by weight.** Each habit has integer weights per stat that sum to 100 (e.g. Courage 70, Charm 30). Each stat's share = daily points × weight, **rounded up** to a whole number. No fractions are ever stored.
5. **Recalculate, then pay the difference.** After each session, the app recomputes that habit's shares for the day and awards only what's new. Split sessions score the same as one long one, and rounding up happens once per day, not once per session.
6. **Redirect from maxed stats.** If a stat the habit feeds is already at 1000, its weight moves to the habit's other un-maxed stats, in proportion to their weights. If all its stats are maxed, the habit earns nothing but can still be logged.
7. **Max = 1000, then stop.** A stat never goes above 1000. Points past 1000 redirect to the habit's other un-maxed stats; if none are left, they are dropped. Hitting 1000 triggers the graduation animation; the stat stops counting.
8. **Rank-ups** trigger the rank-up animation the moment a threshold (60 / 200 / 500 / 1000) is crossed.

**Corrections and timing:**

- **Edit or delete** a session to fix mistakes. The app recomputes that habit's day and takes back or adds the difference. Ranks and Graduated status can go back down, since deleted time doesn't count.
- **Today only:** sessions can only be logged, edited or deleted for today.

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
| Habit (custom) | IndexedDB | same as preset + `custom: true` | Habits you add; weights default to equal |
| ActiveHabit | IndexedDB | habitId, addedOn, kind (daily or anytime) | Which habits are on your list, and how they show |
| Session | IndexedDB | id, habitId, date, minutes | Every time block you log — the raw truth |
| Award | IndexedDB | habitId, date, stat, points | What each habit has paid each stat that day (rule 5 diffs against this) |
| StatTotal | IndexedDB | stat, points, graduated | Running total per stat; rank and title are calculated from points, never stored |

Why ranks aren't stored: a value you can calculate from points can never disagree with points.

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

A habit can override its category default. Library tests: every habit has a unique id, a known category, and whole-number weights summing to 100.

## Screens

| Screen | What it shows | Actions |
| --- | --- | --- |
| Today | Daily checklist habits + anytime habits, minutes logged today per habit | Log, edit or delete today's sessions |
| Stats | 4 stats: rank, title, progress bar to next rank | View only |
| Library | 100+ presets by category, search | Add to your list (daily or anytime) |
| My habits | Your active + custom habits | Add custom habit, set weights, remove |

- **Rank-up moment:** full-screen, stat name, old → new rank and title, tap to dismiss. Original look inspired by Persona; no Persona art, fonts or sounds.
- **Graduation moment:** at 1000, an animated "good job" message for that stat; it then shows as Graduated.
- **Settings:** export all data to a file and import it back (free backup).

## Workflow

1. **Plan** — together: requirements locked by grilling, written into this spec.
2. **Build** — Claude, tests first: write tests from the spec, show they fail, then write code until they pass. Each step explained.
3. **Review** — Hamid first, then Claude re-reviews against the spec.
4. **Deploy** — push to GitHub; Actions runs every test and only publishes to GitHub Pages if all pass.

Build order:

1. Scoring engine (pure logic, rules 1–8 + corrections) + its tests
2. Habit library file + its validation tests
3. Storage layer (Dexie)
4. Screens: Today → Stats → Library → My habits
5. Rank-up and graduation animations
6. Settings export/import
7. PWA install + offline, then first deploy

## Out of scope for v1

Accounts, cloud sync, App Store, reminders/notifications, streaks, history/calendar view, start/stop timer, stat decay, logging past days, marking missed daily habits (skipping is your choice).

## Decisions

- **Audience:** just Hamid for v1; friends next, maybe public later. Sharing = sending the link; each person's data stays on their own phone.
- **Overflow at max:** redirected to the habit's other stats; dropped if those are maxed too.
- **Mistakes:** today's sessions can be edited or deleted; ranks and Graduated can go back down.
- **Back-dating:** no, today only.
- **Daily vs anytime:** no missed marker.
- **Backup:** export/import in v1.
