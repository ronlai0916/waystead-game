# F0 — Kick-off review (28 Oct 2026)

Read: PLAN.md, CLAUDE.md, README.md, docker-compose.yml, nginx/default.conf, site/ (index.html, css/app.css, js/*, sw.js, data/curriculum.json). Nothing changed outside wordbright-design/.

## (a) What the word game reuses from Spellbright

| What | Path | How to reuse |
|---|---|---|
| Brand tokens, light/dark colours, fonts, radii | site/css/app.css (lines 1-80+) | Copy the :root and [data-theme="dark"] blocks; add board/tile tokens |
| Fonts | site/assets/fonts/sora-latin-var.woff2, manrope-latin-var.woff2 | Copy into the new folder (each game is its own path) |
| No-flash theme start | site/js/theme-boot.js | Copy; key decision Q2 |
| Top bar, waymark logo, back button, theme button, footer | site/index.html | Copy markup; product name from one BRAND constant |
| localStorage helpers (read/write with try/catch) | site/js/store.js | Copy pattern; new key prefix `wg.` |
| esc(), toast(), shuffle() | site/js/ui.js | Copy |
| Hash router + back logic | site/js/app.js | Copy pattern |
| Offline cache (shell on install, media in background, skipWaiting) | site/sw.js | Copy pattern; cache name prefix `wordbright-` |
| Manifest, icons | site/manifest.webmanifest, site/assets/icons/ | New icons later (F4) |
| 11+ papers panel, "For parents" page | site/js/views.js (lines ~83-86, ~526) | Copy text style; link to learning.waystead.co.uk |
| Star words + meanings | site/data/curriculum.json | 213 words; meaning at word.meaning.definition, example at word.meaning.example |

Notes on curriculum.json: 213 words, longest is "pronunciation" (13 letters); one word has a capital ("February") and must be lower-cased for the word list. Words longer than 9 letters can never be played on the Junior board.

**There is no BRAND constant in Spellbright today** (the name is written in index.html and views.js). The new game should have one from day one.

## (b) Risks

| # | Risk | Impact | Proposal |
|---|---|---|---|
| R1 | Deploy is not "git pull only". docker-compose.yml mounts only ./site at /spellbright, and nginx has blocks only for /spellbright/ and /hangman/. | A new game needs a new volume line + nginx location → `docker compose up -d --force-recreate` on the server once (a few seconds' blip for Spellbright). | New top-level folder `wordbright/` (beside `site/`), mounted at /usr/share/nginx/html/wordbright. After the first deploy, later releases are git pull only again. |
| R2 | Folder name fixed in compose + nginx. | Renaming after launch means another server change. | Choose the name (F1) before C1, so the folder gets its final name. |
| R3 | Same web address as Spellbright (game.waystead.co.uk), so localStorage and caches are shared. | Key clashes; one game's service worker could delete the other's cache. | Keys `wg.*`; cache prefix `<slug>-` (Spellbright only deletes `spellbright-*`, checked). |
| R4 | CSP is strict: no inline script/style, no WebAssembly. | Rules out WASM move-finders and inline styles. | Plain JS move-finder in a Web Worker (worker-src 'self' is allowed). Styles via classes / el.style. |
| R5 | CLAUDE.md says "no build step, no npm runtime deps". | Word graph must be built by a tool run by hand, not at deploy. | tools/build-wordgraph.py (like build-assets-manifest.py) writes a data file that is committed. Caddy already gzips. Tests with `node --test` (built into Node, no npm) — needs Node on the Mac (Q3). |
| R6 | 20x20 on a phone: 390 px wide → about 18 px per square. Too small to tap. | Zoom, pan and mini-map are the biggest single piece of UI work (C2). | Q1. |
| R7 | Word-graph size and bot speed on the Large board. | Page weight, slow phones. | DAWG (smaller than GADDAG) for the 60k list; check size in C1; 5 s cap on Large. |
| R8 | CLAUDE.md and README.md describe only Spellbright. | Claude Code would follow Spellbright-only rules. | C1 adds a "Word game" section to both. |
| R9 | Bare host `game.waystead.co.uk/` goes to /spellbright/. | The new game is not reachable from the bare address. | Fine for now; a small games home page later (Q4). |

## (c) Questions for Ron

| # | Question | Options | Proposed |
|---|---|---|---|
| Q1 | Large 20x20 on a phone | A: playable with zoom/pan/mini-map. B: shown but locked on phones ("needs a tablet or computer"), zoom only on tablets if needed. | B for first release (less work, better play). |
| Q2 | Theme (light/dark) | Share Spellbright's choice (`sb.theme`) or keep separate | Share — one choice for the whole site. |
| Q3 | Is Node installed on the Mac? | Run `node --version` | Needed only for tests. |
| Q4 | Games home page at game.waystead.co.uk/ | Now / later | Later (after launch). |

## Answers (Ron, 28 Oct)
| Q | Answer |
|---|---|
| Q1 | Phones: Junior + Standard; Large locked on phones |
| Q2 | Share theme with Spellbright |
| Q3 | Not known yet — Ron to run `node --version` |
| Q4 | Yes, games home page now, called Waystead Game, own colour tone |
