# Habit Stats App

Free iPhone habit tracker (PWA). Timed habits earn points in four Persona-style stats: Charm, Courage, Intelligence, Proficiency. Each stat ranks 1–5 and graduates at 1000. All data stays on the phone.

## Source of truth
- Read SPEC.md before any work. It defines the stack, scoring rules, data model and build order.
- If a request conflicts with SPEC.md, stop and ask. Don't guess.
- Any decision SPEC.md doesn't cover goes to Hamid first. Explain the options, recommend one, and wait for Hamid's call. Never decide alone.
- PROGRESS.md tracks what's built and logs decisions Hamid approved. Update it at the end of each step.
- Once a step is built and reviewed, show Hamid the exact SPEC.md changes for its decisions and get a final yes. Then copy them in. Edit SPEC.md directly; the spec doc link at its top is history only.
- Anything under "Out of scope for v1" stays out unless the spec changes.

## How we work
- Real-world flow: Claude writes, Hamid reviews, Claude validates and pushes.
  - Plan: Hamid and Claude agree on requirements and tests.
  - Build: Claude writes all code. Don't hand pieces to Hamid to write.
  - Review: Hamid reviews the change.
  - Validate + push: Claude re-reviews against SPEC.md, runs tests, type check and lint, then commits and pushes.
- Ask questions until requirements are clear. Never assume.
- Tests first: write tests from SPEC.md, show them failing, then write code until they pass. Never change a test just to make code pass.
- Follow the build order in SPEC.md, one step at a time.
- Teach as you go: explain each step and why, in plain language.
- Keep answers short. No filler.

## Rules that are easy to break
- The scoring engine is pure TypeScript functions. It never imports React, Dexie or anything else for screens or storage.
- Points are always whole numbers. Never store fractions.
- Rank and title are calculated from points. Never store them.
- Sessions can only be logged, edited or deleted for today.
- Ask before adding any library that isn't in the SPEC.md stack. When asking, give: what it does, why we need it, cost, size, how popular and maintained it is, and the option without it.
- The look is original and only inspired by Persona. No Persona art, fonts or sounds.

## Environment
- Built on Windows. Commands must work there.

## Commands
- `npm run dev` — dev server
- `npm test` — tests in watch mode; `npx vitest run` — run once
- `npm run build` — type-check and build
- `npm run lint` — lint (oxlint)
