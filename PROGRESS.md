# Progress

Build order from SPEC.md. Tick a step when it's built, reviewed by Hamid, and re-reviewed by Claude.

- [x] 1. Scoring engine (rules 1–8 + corrections) + tests — PR #1, merged 2026-10-27
- [ ] 2. Habit library file + validation tests
- [ ] 3. Storage layer (Dexie)
- [ ] 4. Screens: Today → Stats → Library → My habits
- [ ] 5. Rank-up and graduation animations
- [ ] 6. Settings export/import
- [ ] 7. PWA install + offline, then first deploy

## Notes for later steps

- Step 3: storage must enforce "today only" for log/edit/delete. The engine scores whatever sessions it's given.

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
| 2026-10-27 | 0 | CI (lint, tests, type-checked build) runs on every PR now, before step 7. Deploy stays in step 7. | Every PR shows pass/fail; Hamid doesn't have to take validation on trust. | No |
| 2026-10-27 | 2 | Preset weights are multiples of 10, from 10 to 100. A stat a habit doesn't feed is left out, not set to 0. | Easy to read and compare across 100+ habits. | No |
| 2026-10-27 | 2 | Habit ids are readable lowercase slugs (e.g. "boxing", "hiit-20s") and never change once released. | Sessions store the id; slugs stay readable in exports and tests. | No |
| 2026-10-27 | 2 | Habits are reviewed as a per-category table in the PR description. | ~100 entries are easier to review as a table than as JSON. | No |
