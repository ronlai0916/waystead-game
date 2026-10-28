# CLAUDE.md — Waystead Games (Spellbright)

## What this is
Spellbright by Waystead: a static spelling game at game.waystead.co.uk/spellbright/. A wrong letter makes a flower lose a petal (no hangman imagery: it's for children).

## Hard constraints
- Static only: HTML5, plain CSS (custom properties), vanilla ES modules. No framework, no build step, no npm runtime deps.
- No backend, no accounts, no analytics, no third-party requests. Progress stays in localStorage (`sb.*` keys).
- Content Security Policy is strict (`nginx/default.conf`): no inline `<script>`, no inline `style=""` attributes, no external hosts. Set styles from JS via `el.style` or classes.
- All paths are relative (the site is served under `/spellbright/`; the old `/hangman/` redirects).
- British English in all copy.
- No secrets in this repo, ever. Audio generation uses the gcloud login token, not an API key.

## Brand (Waystead)
- Ink `#1B1A20`, Paper `#FAF8F3`, Plum `#6B3FA0` (Waystead Game accent, 28 Oct 2026), Amber `#F2A31D` (the waypoint dot only).
- Teal `#0F8B7E` belongs to Waystead Learning: use it only on the Learning panel, never as a game accent.
- Sora (headings, wordmark 600/700), Manrope (body). Self-hosted woff2, same files as waystead-parent.
- The "Waystead" wordmark is never recoloured. Logo = the waymark (two chevrons as a W, amber dot).

## Rules that bit before
- The keyboard is three `.keyboard-row` containers (10/9/7 keys) with `flex-wrap: nowrap`. Check in a 390px viewport that P stays on row 1.
- Every word's `chunks` must join to the word exactly (checked at load).
- Bump `VERSION` in `site/sw.js` on every release.

## Workflow
Build and STOP before commit. Ron reviews, commits and pushes, then pulls on the server.

## Wordbright (in progress, beside Spellbright)
A word-tile board game, to be served at /wordbright/. Design files and decisions: `wordbright-design/` (PLAN.md, board/rules.md).
- `wordbright/site/js/engine/` is pure: no DOM, no fetch, no `Date`/`Math.random`. Game state is plain JSON and every action returns a new state, so the same code can check moves on a server later. Randomness comes only from the seed in the bag.
- Board size and start squares come from the board file; never hard-code 9, 13 or 20.
- `wordbright/site/data/` is generated: rebuild with `python3 tools/build-wordgraph.py`, never edit by hand. The licence files in `wordbright/` travel with it.
- Never use other games' names or terms (see PLAN.md section 2); `wordbright/tests/names.test.js` checks.
- Tests: `node --test wordbright/tests/` (no npm packages).
