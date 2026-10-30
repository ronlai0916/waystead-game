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
- Ink `#1B1A20`, Paper `#FAF8F3`, Amber `#F2A31D` (the waypoint dot only).
- Waystead Game home page accent: Terracotta `#B4532A` (dark `#E8875E`). Game colours: Spellbright Plum `#6B3FA0`, Wordbright Indigo; Learning panel Teal.
- Teal `#0F8B7E` belongs to Waystead Learning: use it only on the Learning panel, never as a game accent.
- Sora is the wordmark font only. Spellbright's other fonts come with its three styles (below); Manrope is no longer used.
- The "Waystead" wordmark is never recoloured. Logo = the waymark (two chevrons as a W, amber dot).

## Rules that bit before
- The keyboard is three `.keyboard-row` containers (10/9/7 keys) with `flex-wrap: nowrap`. Check in a 390px viewport that P stays on row 1.
- Every word's `chunks` must join to the word exactly (checked at load).
- Bump `VERSION` in `site/sw.js` on every Spellbright release, and in `wordbright/site/sw.js` on every Wordbright release. Each worker deletes only its own caches (`spellbright-*`, `wordbright-*`).
- The home page (`hub/site/`, served at `/`) keeps every file under `/home-assets/` so it never clashes with a game path. Its name is only in `BRAND` (`hub/site/home-assets/js/config.js`); `WORDBRIGHT_LIVE` there turns the Wordbright card into a link at launch (README "Launch checklist").

## Spellbright looks (S-W2, 30 Oct 2026)
- Three styles, the same family as Wordbright: `site/css/styles/garden.css` (Sunny garden, Day default), `paint.css` (Paint box, Day), `night.css` (Night sky, always at Night). `site/js/theme-boot.js` sets `<html data-style>` from `sb.theme` (shared with Wordbright) and `sb.dayStyle` (Spellbright's own; Wordbright's is `wb.dayStyle`).
- The Day style picker is on the home page and the For parents page (`site/js/daystyle.js`).
- Colours are tokens in each style's first block; `tests/contrast.test.js` reads them, so a new text/background pair goes in its list. Spellbright's own colour is `--sb` (Plum by day, light Plum at night): spelling-part rails, product label, progress bars. Buttons follow each style (leaf, cobalt, gold).
- Fonts: garden Fredoka + Andika, paint Baloo 2 + Nunito, night Lexend + Atkinson Hyperlegible; Andika for IPA in every style. Never preload a font, and keep fonts out of the service-worker shell. Licences: `site/assets/fonts/licences/`.
- Celebrations (`site/js/celebrate.js`): a word spelled and a chapter test passed. None with reduced motion (a still ring instead).
- Tests: `node --test tests/*.test.js` (no npm packages).

## Workflow
Build and STOP before commit. Ron reviews, commits and pushes, then pulls on the server.

## Wordbright (in progress, beside Spellbright)
A word-tile board game, to be served at /wordbright/. Design files and decisions: `wordbright-design/` (PLAN.md, board/rules.md).
- `wordbright/site/js/engine/` is pure: no DOM, no fetch, no `Date`/`Math.random`. Game state is plain JSON and every action returns a new state, so the same code can check moves on a server later. Randomness comes only from the seed in the bag.
- Board size and start squares come from the board file; never hard-code 9, 13 or 20.
- `wordbright/site/data/` is generated: rebuild with `python3 tools/build-wordgraph.py`, never edit by hand. The licence files in `wordbright/` travel with it.
- Never use other games' names or terms (see PLAN.md section 2); `wordbright/tests/names.test.js` checks.
- The product name is only in `BRAND` (`wordbright/site/js/brand.js`); the HTML `<title>` is the one static copy, for link previews.
- localStorage: theme is `sb.theme` (shared with Spellbright); everything else starts with `wb.`.
- Squares: never show codes like DL/TW/2L/3W; use the names (Spark, Glow, Shine, Star) and our icons.
- The game loads one word graph, `words_all.dawg`: each word tagged with its tier (smallest list: 0 starter … 4 xlarge). Check words with `isWord(word, graph, maxTier, maxLength)`; a level's list is `listTier(list)`. Children play the whole list (xlarge) at every level; computer and hint lists go by level.
- Words a grown-up allowed (`wb.allowed`) reach the engine as `env.allowed` and count for children only, never for computers or hints.
- Computer players and hints: `site/js/engine/movegen.js` (pure move finder; the caller passes `now` for the time cap) and `site/js/ai/` (also pure, apart from `worker.js` and `client.js`). Their choices use a seed from the game state, never `Math.random`, so a position always gives the same move.
- Character pictures are built: `python3 tools/wordbright-characters.py` (from `wordbright-design/assets-raw/`).
- Bot-vs-bot check: `node tools/wordbright-bots.mjs` (`--games 20` for a quick run). Crashes and illegal moves must be 0.
- Looks: three styles in `wordbright/site/css/styles/` (garden, paint = Day; night = Night), chosen by `data-style` on `<html>` (set by `js/theme-boot.js` from `sb.theme` and `wb.dayStyle`). Colours are tokens in each style's first block; `wordbright/tests/contrast.test.js` reads them, so a new text/background pair goes in its list. Never preload a font, and keep fonts out of the service-worker shell: each style's fonts load only when used.
- Tests: `node --test wordbright/tests/` (no npm packages).
