# Progress

Build order from SPEC.md. Tick a step when it's built, reviewed by Hamid, and re-reviewed by Claude.

- [x] 1. Scoring engine (rules 1–8 + corrections) + tests — PR #1, merged 2026-10-27
- [x] 2. Habit library file + validation tests — PR #4, merged 2026-10-27
- [x] 3. Storage layer (Dexie) — PR #6, merged 2026-10-27
- [ ] 4. Screens: Today → Library → Stats → My habits
- [ ] 5. Rank-up and graduation animations
- [ ] 6. Settings export/import
- [ ] 7. PWA install + offline (deploy already runs from main, see decisions log)

## Notes for later steps

- Step 4: custom habit weights default to equal (SPEC). Decide how 3 stats split 100 (e.g. 34/33/33), and whether custom weights must be multiples of 10.
- Step 4: custom habit names with no Latin letters or digits get no id and are rejected. Revisit if needed.
- Step 4/5: Lottie player library not chosen yet. Needs Hamid's approval before any Lottie code. Claude's recommendation: lottie-web light build (MIT, ~47 KB gzipped, bundles in so it works offline; skips "expressions", so check each file). Decide when a mockup needs a specific animation.
- Library goal (Hamid): ship the most common habits in the world, so custom habits are rarely needed. Grow habits.json over time.

## Decisions log

Only decisions Hamid approved go here. Once its step is reviewed, Hamid gives a final yes on the exact SPEC.md wording. Then copy it in and mark it "→ in SPEC".

| Date | Step | Decision | Why | In SPEC? |
| --- | --- | --- | --- | --- |
| 2026-10-27 | 1 | Edit/delete replays today: start from this morning's totals and replay today's remaining sessions in order. | Only today is editable, so morning totals are fixed; the result is always the same as if the deleted time never happened. | → in SPEC |
| 2026-10-27 | 1 | Overflow split across several stats rounds each part up. | Same rounding as rule 4; one rule everywhere. | → in SPEC |
| 2026-10-27 | 1 | Rank going down after a delete updates silently (no animation). The engine still reports it. | Keeps step 5 small; still tested. | → in SPEC |
| 2026-10-27 | 1 | Invalid minutes (0, negative, fractions) make the engine throw; the UI also blocks them. | Bad input fails loudly instead of hiding bugs. | → in SPEC |
| 2026-10-27 | 1 | A session is rejected if today's minutes across all habits would go over 1440. | A day has 24 hours; makes multi-rank jumps near-impossible. | → in SPEC |
| 2026-10-27 | 1 | If a stat ever jumps 2+ ranks at once, one rank-up event old → new. | Safe fallback; one screen. | → in SPEC |
| 2026-10-27 | 1 | Graduation is when ALL four stats are at 1000 (one big screen). A single stat at 1000 just ranks up to 5, stops counting, and shows "Max". Dropping any stat below 1000 after that un-graduates. | Hamid's call; replaces per-stat graduation. SPEC to update: Overview, rule 7, Graduation moment, StatTotal.graduated. | → in SPEC |
| 2026-10-27 | 0 | Keep oxlint and TypeScript 7 from the Vite template. | Free, current defaults; add to SPEC stack table. | → in SPEC |
| 2026-10-27 | 0 | CI (lint, tests, type-checked build) runs on every PR now, before step 7. Deploy stays in step 7. | Every PR shows pass/fail; Hamid doesn't have to take validation on trust. | → in SPEC |
| 2026-10-27 | 2 | Preset weights are multiples of 10, from 10 to 100. A stat a habit doesn't feed is left out, not set to 0. | Easy to read and compare across 100+ habits. | → in SPEC |
| 2026-10-27 | 2 | Habit ids are readable lowercase slugs (e.g. "boxing", "hiit-20s") and never change once released. | Sessions store the id; slugs stay readable in exports and tests. | → in SPEC |
| 2026-10-27 | 2 | Habits are reviewed as a per-category table in the PR description. | ~100 entries are easier to review as a table than as JSON. | Process only, not SPEC |
| 2026-10-27 | 3 | No StatTotal table: totals are the sum of Award rows. This morning's totals = awards dated before today. | Totals can never drift from awards; summing ~7,000 rows/year is instant. | → in SPEC |
| 2026-10-27 | 3 | fake-indexeddb (dev-only) runs storage tests in Node and CI. | Storage rules get automated tests; never shipped to the phone. | → in SPEC |
| 2026-10-27 | 3 | "Today" is checked at the moment of each action. After midnight, yesterday's sessions are locked; no grace period. | Matches the today-only rule exactly. | → in SPEC |
| 2026-10-27 | 3 | "Remove" only hides a habit from the list. Its sessions, points and (for custom habits) definition stay. A habit's history is never wiped. | Earned time stays earned; replays always know every habit's weights. | → in SPEC |
| 2026-10-27 | 3 | Re-adding a habit sets addedOn to the latest add. | Hamid's call. | → in SPEC |
| 2026-10-27 | 3 | Custom habit ids are 'custom-' + a slug of the name. Presets may never start with 'custom-'. Two custom habits can't share a name. | The library will keep growing; no future preset can clash with a custom id. | → in SPEC |
| 2026-10-27 | 4 | Look: bold, Persona-inspired (dark, one red accent, angled panels), all original shapes. Headings use Anton (self-hosted via @fontsource/anton, OFL); body uses the iPhone system font. | Hamid's call; the font works offline. | Superseded by the design rows below |
| 2026-10-27 | 4 | Navigation: bottom tab bar (Today, Stats, Library, My habits). Settings will be a gear on My habits. | Standard iPhone pattern; no router library. | Superseded by the command-menu row below |
| 2026-10-27 | 4 | Screen tests use jsdom + React Testing Library + user-event (dev-only). | Screens tested in CI like everything else. | No |
| 2026-10-27 | 4 | One PR per screen: 4a Today + app shell, 4b Library, 4c Stats, 4d My habits. | Smaller reviews. | No |
| 2026-10-27 | 4 | Logging: tap a habit to open a sheet with a minutes box, quick buttons (5/10/15/30/60), and today's sessions with edit/delete. | Hamid's call. | No |
| 2026-10-27 | 4 | A daily habit is ticked by any session today. No targets. | Matches no streaks / no missed marker. | No |
| 2026-10-27 | 4 | Until step 5, rank-ups and graduation show as a plain banner (tap to dismiss). Rank-downs stay silent. | Events visible right away; step 5 replaces it. | No |
| 2026-10-27 | 4 | Build order changes to Today → Library → Stats → My habits. | The app is usable on the phone (add habits, log) one PR sooner. | No |
| 2026-10-27 | 0 | Remote checking: main deploys to GitHub Pages; every PR gets its own preview link with its own database (VITE_DB_NAME), so previews never touch real data. Claude screenshots previews and sends them to Hamid. Deploy moves forward from step 7; PWA install/offline stays in step 7. | Hamid can review by phone from anywhere. | No |
| 2026-10-27 | 4 | Palette "Neon Lime": background #050807, depth #0D1F12, accent #39FF7A, highlight #C6FF3D, text #FFFFFF. Replaces the red accent. | Hamid felt the first build didn't match the Persona aesthetic; picked from the palette mockups. | No |
| 2026-10-27 | 4 | Mood: the "water and bubbles" feel of Persona 3 Reload, but green. Rounded shape language: pills, glossy bubbles, wave lines. All shapes original. | Hamid's call. Inspired only; no Persona/Atlus assets (none are licensed for app use). | No |
| 2026-10-27 | 4 | Headings: Montserrat heavy italic, self-hosted via Fontsource (OFL). Replaces Anton. Body stays the iPhone system font. No -webkit-text-stroke on Montserrat; use solid shadows instead. | Fits the rounded look; works offline. Stroke shows inner-contour artifacts on the variable font. | No |
| 2026-10-27 | 4 | Animation: Motion plus Lottie (free LottieFiles animations; check each file's license). Which Lottie player to use is still open (see notes). | Motion for screen effects; Lottie for ready-made bubble/splash animations. | No |
| 2026-11-03 | 4 | Lots of animation, Persona-style: taps, screen changes, sheets and rank-ups all animate. Motion drives everything that reacts to touch. Lottie is only for a few pre-drawn set pieces (e.g. a rank-up burst). All motion is original. | Hamid wants the app to feel alive like the Persona menus. Lottie can't react to touch; Motion can. | No |
| 2026-11-03 | 4 | Swiping left/right moves between Today, Library, Stats and My habits, alongside the command menu. Built with Motion's drag gestures; no extra library. | Hamid's call. | No |
| 2026-11-03 | 4 | Tap and screen-change animations are built with each screen. Step 5 stays rank-up and graduation. | They're part of the look, so each screen ships complete. | No |
| 2026-11-03 | 4 | Respect the iPhone "Reduce Motion" setting: quick fades instead of big motion. | Cheap to do; some people get motion sick. | No |
| 2026-11-03 | 4 | Next mockups are animated HTML prototypes, tappable on the phone (menu → Today, tap effect, swipe, log sheet, rank-up). Hamid approves the feel before any real code. | Motion is hard to judge from still images. | Process only, not SPEC |
| 2026-11-03 | 4 | Motion prototype (design/mockups/motion.html) approved as the target feel: menu tap → diagonal wipe, swipe with a sliding section strip, log sheet, points float up, rank-up sequence. | Hamid tried it on the phone: "everything looks good". | No |
| 2026-11-03 | 4 | Sections show a small tilted strip under the date (TODAY / LIBRARY / STATS / MY HABITS); tap a name or swipe. Swiping stops at Today and My habits (no wrap-around). | Shows where you are and hints that swiping works. | No |
| 2026-11-03 | 4 | Rank-up plays in about 1.8 s and can be tapped away after 0.7 s. Its content sits in the middle of the screen. | Hamid's review of the prototype. | No |
| 2026-11-03 | 4 | The faint background word on each screen drifts slowly sideways in a loop, so the whole word reads over time. It stays still with Reduce Motion. | Hamid's call. | No |
| 2026-11-03 | 4 | Tilt each item on its own (CSS rotate), never a whole list. All content stays inside the screen at 360, 390 and 430 px widths. | A tilted tall list drifts off-screen and into the items above it (found in the prototype). | No |
| 2026-11-03 | 4 | Restyle in two PRs: 3a shell (fonts, colours, command menu, wipe, section strip, swipe, MENU, Reduce Motion), 3b Today + log sheet (tilted pills, new sheet, nearest-rank bar, floating points, menu "Today's list" card). Full rank-up animation stays in step 5; the banner gets the new colours. | Smaller reviews; matches the approved prototype. | No |
| 2026-11-03 | 4 | The app opens on the command menu every time. MENU returns to it with the last section marked. | Matches the prototype. | No |
| 2026-11-03 | 4 | Swipe uses Motion's built-in drag. Tests cover tap navigation; swiping is checked on the PR preview. A second menu tap during the wipe is ignored. | Less code; jsdom can't simulate swipe physics. | No |
| 2026-11-03 | 4 | Screen tests run with Reduce Motion on (screens switch at once); two tests turn it off to cover the wipe. The date block reads an injected clock (`now`) so tests are fixed in time. | Fast, deterministic tests that still cover the animated path. | Process only, not SPEC |
| 2026-11-03 | 4 | Packages: add motion (SPEC stack) pinned to a release at least two weeks old (14.4.0); swap @fontsource/anton for @fontsource/montserrat (700, 800, 800 italic, 900 italic). | Avoid brand-new releases; load only the weights we use. | No |
| 2026-10-27 | 4 | Layout: Persona-style composition. Big tilted date block, tilted staggered panels, inverted lime highlights (black text) with hard offset shadows, faint giant background words. | Hamid's call; see design/mockups/layouts.html. | No |
| 2026-10-27 | 4 | Navigation: a command-menu home screen (big stacked italic words: TODAY / LIBRARY / STATS / MY HABITS) replaces the bottom tab bar. Tapping TODAY opens the tilted staggered Today list. Settings stays a gear on My habits; still no router library. | Persona-style menu feel; Hamid chose to use both layout concepts. | No |
| 2026-11-03 | 4 | Mockups live in design/mockups/ (tracked) and are the reference for restyling. | Reviewable in PRs; survives between sessions. | Process only, not SPEC |
| 2026-11-03 | 4 | Today: any habit with time today lights up lime. Only daily habits are "done" (tick, and the menu's daily count). Anytime habits have no tick. | Shows what you've worked on today without turning anytime habits into a checklist. | No |
| 2026-11-03 | 4 | Points float up ("+3 Courage") only after Log, in the sheet beside the minutes. Edits and deletes stay silent. The sheet stays open after Log. | Celebrates new time; corrections are quiet, like rank-downs. | No |
| 2026-11-03 | 4 | Next-rank bar under the Today list: the stat with the fewest points left to its next rank, skipping maxed stats; ties go to SPEC order (Charm, Courage, Intelligence, Proficiency). Shows "Graduated" when all are maxed, and shows even with an empty list. | One clear "almost there" goal on the main screen. | No |
| 2026-11-03 | 4 | Log sheet: habit name, stat weight chips (e.g. "Courage 70"), a big minutes number, quick bubbles 5/10/15/30/60 plus CUSTOM (clears the box and opens the keypad), today's sessions with inline edit/delete, and LOG. "Total today" is dropped (the pill shows it). Closes with ✕, a tap outside, or dragging the top down. | Hamid asked for a custom time after 60; the rest follows the approved prototype. | No |
| 2026-11-03 | 4 | Menu "Today's list" card: the first 3 habits in Today order (daily, then anytime, each by name) with minutes, "+N more", and "N OF M DAILY DONE" (hidden with no daily habits). Empty list says "Nothing on your list yet". Tapping it opens Today. | Quick glance from the home screen; matches the prototype. | No |
| 2026-11-03 | 4 | Library: a search box, then six category chips (Fitness, Study, Languages, Content, Reading, Art). Opens on Fitness and remembers the last chip while the app is open (not saved). Rows are sorted A–Z by name. | Hamid's call; A–Z is easier to scan than the file order. | No |
| 2026-11-03 | 4 | Library search matches habit names in every category, ignoring case and spaces at the ends. The chip turns off while searching and comes back when the box is cleared. No match shows: No habit matches "…". | Finds a habit even if it's filed under an unexpected category. | No |
| 2026-11-03 | 4 | Library rows show the name and the stats it feeds, biggest weight first, without numbers (e.g. "COURAGE · CHARM"). Exact weights show in the log sheet. | Hamid's call; cleaner rows. | No |
| 2026-11-03 | 4 | Adding: tap + and DAILY / ANYTIME appear in that row, one row at a time. A chip change, a search or leaving the Library closes it. A habit already on your list shows "ON LIST · DAILY/ANYTIME" with no buttons; removing and switching kind live in My habits. | The Library only adds; one place to change your list. | No |
| 2026-11-03 | 4 | The Library shows presets only. Custom habits live in My habits. | The Library is the shipped list. | No |
| 2026-11-03 | 4 | Like the games, the app never shows how many points the next rank takes. Stats cards show the stat, RANK N (or MAX), title, 5 pips, a bar through the current rank and the total ("130 PTS"). No threshold, points left or next title. | Hamid's call: "similar to the games". | No |
| 2026-11-03 | 4 | Today's next-rank bar drops its number: "COURAGE · NEXT: RANK 2" plus the bar. It still picks the stat with the fewest points left. Replaces the "N TO RANK N" wording from 3b. | Same rule as Stats. | No |
| 2026-11-03 | 4 | Stats shows a GRADUATED pill above the cards when all four stats are at 1000; it goes away if a delete un-graduates you. No points-today tag. The Stats look will be restyled later. | Hamid's call; keep Stats simple for now. | No |
| 2026-11-03 | 4 | Stats replays its card and bar animation each time you arrive on it, and refreshes after any log, edit, delete or Library add. | Matches the prototype; the sections stay loaded side by side, so they reload on a shared data-version counter. | No |
