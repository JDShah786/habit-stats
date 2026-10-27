# Progress

Build order from SPEC.md. Tick a step when it's built, reviewed by Hamid, and re-reviewed by Claude.

- [x] 1. Scoring engine (rules 1–8 + corrections) + tests — PR #1, merged 2026-10-27
- [x] 2. Habit library file + validation tests — PR #4, merged 2026-10-27
- [x] 3. Storage layer (Dexie) — PR #6, merged 2026-10-27
- [ ] 4. Screens: Today → Library → Stats → My habits
- [ ] 5. Rank-up and graduation animations
- [ ] 6. Settings export/import
- [ ] 7. PWA install + offline, then first deploy

## Notes for later steps

- Step 4: custom habit weights default to equal (SPEC). Decide how 3 stats split 100 (e.g. 34/33/33), and whether custom weights must be multiples of 10.
- Step 4: custom habit names with no Latin letters or digits get no id and are rejected. Revisit if needed.
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
| 2026-10-27 | 4 | Look: bold, Persona-inspired (dark, one red accent, angled panels), all original shapes. Headings use Anton (self-hosted via @fontsource/anton, OFL); body uses the iPhone system font. | Hamid's call; the font works offline. | No |
| 2026-10-27 | 4 | Navigation: bottom tab bar (Today, Stats, Library, My habits). Settings will be a gear on My habits. | Standard iPhone pattern; no router library. | No |
| 2026-10-27 | 4 | Screen tests use jsdom + React Testing Library + user-event (dev-only). | Screens tested in CI like everything else. | No |
| 2026-10-27 | 4 | One PR per screen: 4a Today + app shell, 4b Stats, 4c Library, 4d My habits. | Smaller reviews. | No |
| 2026-10-27 | 4 | Logging: tap a habit to open a sheet with a minutes box, quick buttons (5/10/15/30/60), and today's sessions with edit/delete. | Hamid's call. | No |
| 2026-10-27 | 4 | A daily habit is ticked by any session today. No targets. | Matches no streaks / no missed marker. | No |
| 2026-10-27 | 4 | Until step 5, rank-ups and graduation show as a plain banner (tap to dismiss). Rank-downs stay silent. | Events visible right away; step 5 replaces it. | No |
| 2026-10-27 | 4 | Build order changes to Today → Library → Stats → My habits. | The app is usable on the phone (add habits, log) one PR sooner. | No |
| 2026-10-27 | 0 | Remote checking: main deploys to GitHub Pages; every PR gets its own preview link with its own database (VITE_DB_NAME), so previews never touch real data. Claude screenshots previews and sends them to Hamid. Deploy moves forward from step 7; PWA install/offline stays in step 7. | Hamid can review by phone from anywhere. | No |
