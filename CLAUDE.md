# CLAUDE.md — Waystead Games (Spellbright)

## What this is
Spellbright by Waystead: a static spelling-hangman site at game.waystead.co.uk/hangman/.

## Hard constraints
- Static only: HTML5, plain CSS (custom properties), vanilla ES modules. No framework, no build step, no npm runtime deps.
- No backend, no accounts, no analytics, no third-party requests. Progress stays in localStorage (`sb.*` keys).
- Content Security Policy is strict (`nginx/default.conf`): no inline `<script>`, no inline `style=""` attributes, no external hosts. Set styles from JS via `el.style` or classes.
- All paths are relative (the site is served under `/hangman/`).
- British English in all copy.
- No secrets in this repo, ever. Audio generation uses the gcloud login token, not an API key.

## Brand (Waystead)
- Ink `#1B1A20`, Paper `#FAF8F3`, Teal `#0F8B7E` (product accent), Amber `#F2A31D` (the waypoint dot only).
- Sora (headings, wordmark 600/700), Manrope (body). Self-hosted woff2, same files as waystead-parent.
- The "Waystead" wordmark is never recoloured. Logo = the waymark (two chevrons as a W, amber dot).

## Rules that bit before
- The keyboard is three `.keyboard-row` containers (10/9/7 keys) with `flex-wrap: nowrap`. Check in a 390px viewport that P stays on row 1.
- Every word's `chunks` must join to the word exactly (checked at load).
- Bump `VERSION` in `site/sw.js` on every release.

## Workflow
Build and STOP before commit. Ron reviews, commits and pushes, then pulls on the server.
