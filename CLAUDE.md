# CLAUDE.md — Waystead Games (Spellbright)

## What this is
Spellbright by Waystead: a static spelling game at game.waystead.co.uk/spellbright/. A wrong letter makes a flower lose a petal (no hangman imagery: it's for children).

## Hard constraints
- Static only: HTML5, plain CSS (custom properties), vanilla ES modules. No framework, no build step, no npm runtime deps.
- No backend of our own, no analytics. The one other host is the Waystead account (B4b): `https://account.waystead.co.uk`, for sign-in and a signed-in player's progress (README "Waystead account"). Signed out, the games work exactly as before, with progress in localStorage under today's keys.
- Content Security Policy is strict: no inline `<script>`, no inline `style=""` attributes, and no external host except the account (connect-src, img-src for avatars). It is in `nginx/default.conf` AND in `<meta>` tags in `hub/site/index.html` and `wordbright/site/index.html`: change both, or the browser blocks it. Set styles from JS via `el.style` or classes.
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
- A word is always shown whole (G4b): no gap between its letters. `.chunked` marks the syllables only with the coloured segments under it. The practice grid's boxes may keep a small group spacing, because the word is hidden there.
- Top bar (G4b): `shared/topbar/nav.js` (copied to each site's `js/nav/`) measures the room and folds the links into a Menu button rather than wrapping them. Always folded under 700 px (the same number is in each site's CSS); All games joins the Menu under 600 px. Never `display: none` the nav: folded, it still has to measure.
- One-load updates (G4b): `site/js/update.js`. The old app runs for the seconds the new worker takes to install, so an unknown page under `#/words` waits ("Just a moment") until the reload, or until there turns out to be no update. Keep `watchForUpdate` first in `start()`.
- Bump `VERSION` in `site/sw.js` on every Spellbright release, and in `wordbright/site/sw.js` on every Wordbright release. Each worker deletes only its own caches (`spellbright-*`, `wordbright-*`).
- The home page (`hub/site/`, served at `/`) keeps every file under `/home-assets/` so it never clashes with a game path. Its name is only in `BRAND` (`hub/site/home-assets/js/config.js`); `WORDBRIGHT_LIVE` there turns the Wordbright card into a link at launch (README "Launch checklist").

## Spellbright looks (S-W2, 30 Oct 2026)
- Three styles, the same family as Wordbright: `site/css/styles/garden.css` (Sunny garden, Day default), `paint.css` (Paint box, Day), `night.css` (Night sky, always at Night). `site/js/theme-boot.js` sets `<html data-style>` from `sb.theme` (shared with Wordbright) and `sb.dayStyle` (shared with Wordbright).
- The look menu in the top bar (`site/js/thememenu.js`, same as Wordbright's) offers Day · Sunny garden, Day · Paint box, Night and Match device. `sb.dayStyle` is shared with Wordbright. The For parents page also has the day-style picker (`site/js/daystyle.js`); the two stay in step via the `sb:look` event.
- Colours are tokens in each style's first block; `tests/contrast.test.js` reads them, so a new text/background pair goes in its list. Spellbright's own colour is `--sb` (Plum by day, light Plum at night): spelling-part rails, product label, progress bars. Buttons follow each style (leaf, cobalt, gold).
- Fonts: garden Fredoka + Andika, paint Baloo 2 + Nunito, night Lexend + Atkinson Hyperlegible; Andika for IPA in every style. Never preload a font, and keep fonts out of the service-worker shell. Licences: `site/assets/fonts/licences/`.
- Celebrations (`site/js/celebrate.js`): a word spelled and a chapter test passed. None with reduced motion (a still ring instead).
- Tests: `node --test tests/*.test.js` (no npm packages).

## My words (G4/G5, Spellbright 2)
- A weekly word group, a daily plan, the practice grid and "remembered", at `#/words`. Rules, all pure with the date passed in: `site/js/words-doc.js` (groups, plan, remembered, returning words, merge) and `site/js/spell-run.js` (a pass at a word, the test). Pages: `site/js/words-views.js`. Signed-in only.
- Saved as the account key `words` (game spellbright), on the device as `sb.words:<id>`, apart from `progress`. Tries merge by id; groups by newest `at`; every total, star and status is counted from the tries and the fold, never stored. Folding keeps each word-day's flags, so remembered survives.
- Never put the word in a URL (`/spell/<row>`), and never show it on test day. Tricky letters show on the two study pages only: `chunked(w, '', { tricky: true })`.
- Typed words: curriculum, or Wordbright's `words_all.dawg` (built without blocked words), fetched on demand by `site/js/wordcheck.js`. A blocked word and an unknown one get the same answer.
- 29 one-syllable curriculum words are one chunk with a `tricky` field (`tests/words.test.js` lists them).

## Spellbright 2 Study, Game, Grown-ups (SB2)
- Study mode: `site/js/study-doc.js` (pure: job dates, what's open, My room) and `study-views.js`. Seven jobs: hello, fix, games, story, practice, test, mend. A job opens on its date once the ones before are done. From the test date the test comes first, so no word is on show; Game mode is closed then too.
- No word on show while its test is due (`jobFor` is 'test', on the date or any later day until it's done). `site/js/test-guard.js` decides for every route in `app.js` (the router calls it; a route not in `RULES` is blocked, and `tests/test-day.test.js` fails until it's classified). Lists use `withoutHidden`. Grown-ups pages are the exception: adults only.
- Practise 3 times (SB2c): a session is one word, one day, one flow (`p` grid, `x` Fix it in, `f` fix-ups). Its count is never stored: `ledger` counts it from the tries, so it merges with them; a mistake or peek resets it, 3 in a row sets a `ROW` day flag (kept through folding by `trim`). Jobs read `jobLeft` / `queue`; a job isn't done until every word has its 3. `W.dots`: 3 once a word has finished a session before the test, else today's count. Skips: `d.skips`, by id. Games retry until clean (`afterPass`), earn no dots. Meaning match (`s: 'm'`) earns stars and counts as played: no first go, remembered, fix-up or wrong letters. New tries stay `k: 'p'` with `s: 'x'|'g'`: never add a new `k`, an older device would drop the try.
- Games: `games-doc.js` (pure), `games-views.js`. Every pass goes through `recordPass`, so after the test a word still to fix counts as a fix-up (`kindOn`).
- My room (`room.js`) is `#/` for a child; an adult playing as themselves gets the chapters page (also `#/chapters`) with the Grown-ups card. `who.js`: the cached player has no kind, so only a fresh /api/me makes an 'adult'. The room creates nothing.
- Grown-ups: `grownups-data.js` (`CHILD_DATA_API`, on since the account's `/api/children` routes went live; every failure carries a `problem`, never an empty answer), `grownups-doc.js`, `grownups-views.js`. Every page starts with `adultOnly`; an adult playing as a child gets the switch-back card, as does a 403. A plan keeps one id per form, so a retry never makes a second. Nothing about a child is stored on the adult's device.
- Spelling patterns: `site/data/patterns.json`, our own wording and words (OGL credit in `_meta`). Each word must match its `re` and be on our lists (`tests/grownups.test.js`).
- Stories: `site/data/stories.json`. Children see a story only with `"reviewed": true`, set by `node tools/approve-stories.mjs` (then bump VERSION, deploy). The review page's switches are one device's notes and release nothing. Sentences read with the device's voice until `tools/generate-story-audio.py` has made the MP3s: the account's voice speaks single words only.
- Smoke test: `node tools/sb2-smoke.mjs <folder>` (real Chrome, fake clock, fake account on :3000, nginx's CSP).

## Composition (compose/site/)
- A static site at `/compose/`, its CSS and shell copied from Spellbright; `--sb` is the home page's Terracotta (no new colour). Copies of shared code as the other sites (`tools/sync-shared.mjs`). CSP is in nginx AND `compose/site/index.html`. Bump `VERSION` in `compose/site/sw.js` on every Composition release.
- Rules, all pure: `checks.js` (word count, hint words, slips, capitals), `writing-doc.js` (pieces, merge, trim, marks). A final is never dropped; merging never loses a child's words (`other`). Checks speak kindly: nothing is called wrong.
- `marks` and `settings` are a parent's: written only through `/api/children`. This device only ever reads them. Consent for AI feedback is `settings.aiFeedback`, off by default.
- Tasks: children see only `"reviewed": true` (`visibleTo`). `TASK_TITLES` in waystead-account `src/lib/compose-feedback.ts` must match; a test compares them.
- Comic Studio (C2): `comic-doc.js` (pure: moves, tile paths, levels, read-aloud text, stars counted never stored, merge/trim), `comic-views.js`, `own-views.js`, `comic-render.js`. Saved as the account key `comics` (apart from `writing`). Each task's `comic` tiles have their own `reviewed` (`approve-tasks.mjs --comic`), and My own story has `own.reviewed` in `data/comic.json` (`--own`); a child sees a comic only when task and comic are both approved, else the classic Look/Plan/Write pages. Typed comic words go through `safe-text.js` (our lists + the comic's names, a short unkind list; unknown and refused get the same answer); the "Write it yourself" challenge is free writing with the automatic checks. Stickers are data (`k,x,y,s,f`), never pictures; `data/stickers.json` is written by `tools/compose-stickers.py data`.
- Sentences in the Waystead voice (C2-1b): `speakLine` in `compose/site/js/speech.js` POSTs a line to the account's `/api/voice/<voiceId>/s` (`createHearLine` in `shared/voice/server.js`; small numbers sent as words, over 200 characters sentence by sentence), else the device's voice. A line holding the child's own typed words (`K.typedBits`, set per page with `useOwnWords`) or marked `{ own: true }` is never sent: it would reach Google. Every word must be on `voice-allow.txt` or `wordbright/site/data/voice-names.txt` (comic names; rebuild with `node tools/build-voice-names.mjs` after changing tasks.json, comic.json or stickers.json; `compose/tests/voice-lines.test.js` checks it and every line our data makes).
- "Real word" in the slip check means Wordbright's two smallest tiers (`COMMON_TIER`): the full list has rarities like "kyte". A task's own names are never slips.

## Waystead account (B4b)
- The client is `shared/account/` (API, player, session, sync, prefs, merge, chip, import question, boot). Each site serves a COPY (`site/js/account/`, `wordbright/site/js/account/`, `hub/site/home-assets/js/account/`): edit `shared/account/`, then `node tools/sync-shared.mjs`. `shared/tests/copies.test.js` fails on a stale copy.
- Fetch with `credentials: 'include'` only. Never store, log or read a token, email or session id; the device keeps only `wa.player` = {id, name, avatar URL}.
- Signed out: today's keys unchanged. Signed in: `<key>:<player id>` (Spellbright `sb.progress:<id>`, `sb.words:<id>`; Wordbright `wb.game:`, `wb.setup:`, `wb.stats:`). Merge rules: `site/js/progress-doc.js`, `wordbright/site/js/player-data.js`, `shared/account/merge.js`. Results merge by id and counters are counted from them, never added.
- Sign out goes through the account's `/signout`; back with `?signedout=1`, the device forgets that player (`forget.js`), keeping only unsent queued changes. A plain 401 keeps everything.
- The service workers never handle cross-origin requests or `/api/` (account answers are never cached), with one exception (G8c): the Waystead voice's MP3s (`<account>/api/voice/<voiceId>/<word>`, 200 audio only) go in the shared runtime cache `voice` (cache-first, at most 1,500, oldest out first; never in the shell).
- `REQUIRE_SIGN_IN` (G6) in `shared/account/config.js` is `true` (Ron, 2 Nov 2026). G6b: signed out, every game page shows the gate card (`shared/account/gate.js`) except Wordbright's How to play and For parents and Spellbright's About (`isOpenPath` in each `gate.js`); the home page `/` stays open. A cached player plays offline or when the account is down. Signed out elsewhere (rechecked on focus, visibility and once a minute), a 401, or back from /signout: the card at once; the game is saved and the queue kept.
- Voice (G8): `shared/voice/` (voice choice and the look menu's Voice part), copied into `site/js/voice/` and `wordbright/site/js/voice/` by `node tools/sync-shared.mjs`. `sb.voice` is shared by both games and synced as `prefs.voice`.
- Waystead voice (G8c): `shared/voice/server.js`. Signed in and online, Hear fetches `<account>/api/voice/<voiceId>/<word>` with credentials and plays the MP3 blob; no answer in 2.5 s, a 404/429/503 or a network error: the device's voice at once. `sb.voice`: '' default (Waystead female signed in, best device voice signed out), `en-GB-Studio-C` / `en-GB-Studio-B`, `@device`, or a device voice's name. CSP `media-src` has `blob:` and the account origin.
- Tests: `node --test shared/tests/` too.

## Workflow
Build and STOP before commit. Ron reviews, commits and pushes, then pulls on the server.

## Wordbright (in progress, beside Spellbright)
A word-tile board game, to be served at /wordbright/. Design files and decisions: `wordbright-design/` (PLAN.md, board/rules.md).
- `wordbright/site/js/engine/` is pure: no DOM, no fetch, no `Date`/`Math.random`. Game state is plain JSON and every action returns a new state, so the same code can check moves on a server later. Randomness comes only from the seed in the bag.
- Board size and start squares come from the board file; never hard-code 9, 13 or 20.
- `wordbright/site/data/` is generated: rebuild with `python3 tools/build-wordgraph.py`, never edit by hand. The licence files in `wordbright/` travel with it.
- Never use other games' names or terms (see PLAN.md section 2); `wordbright/tests/names.test.js` checks.
- The product name is only in `BRAND` (`wordbright/site/js/brand.js`); the HTML `<title>` is the one static copy, for link previews.
- localStorage: `sb.theme`, `sb.dayStyle` and `sb.voice` are shared with Spellbright; everything else starts with `wb.`.
- Squares: never show codes like DL/TW/2L/3W; use the names (Spark, Glow, Shine, Star) and our icons.
- The game loads one word graph, `words_all.dawg`: each word tagged with its tier (smallest list: 0 starter … 4 xlarge). Check words with `isWord(word, graph, maxTier, maxLength)`; a level's list is `listTier(list)`. Children play the whole list (xlarge) at every level; computer and hint lists go by level.
- Words a grown-up allowed (`wb.allowed`) reach the engine as `env.allowed` and count for children only, never for computers or hints.
- Computer players and hints: `site/js/engine/movegen.js` (pure move finder; the caller passes `now` for the time cap) and `site/js/ai/` (also pure, apart from `worker.js` and `client.js`). Their choices use a seed from the game state, never `Math.random`, so a position always gives the same move.
- Character pictures are built: `python3 tools/wordbright-characters.py` (from `wordbright-design/assets-raw/`).
- Bot-vs-bot check: `node tools/wordbright-bots.mjs` (`--games 20` for a quick run). Crashes and illegal moves must be 0.
- Crazy (G7): learned leave values in `wordbright/site/data/leaves.json`, built by `node tools/wordbright-leaves.mjs` (self-play, never edit by hand); reply simulation on Junior and Standard only (`SIMULATE` in `ai/computer.js`); a look-ahead with the bag empty. Target: Crazy beats Hard ≥65% (Junior, Standard), ≥60% (Large). Easy / Normal / Hard must not change.
- Looks: three styles in `wordbright/site/css/styles/` (garden, paint = Day; night = Night), chosen by `data-style` on `<html>` (set by `js/theme-boot.js` from `sb.theme` and `sb.dayStyle`, both shared with Spellbright). Colours are tokens in each style's first block; `wordbright/tests/contrast.test.js` reads them, so a new text/background pair goes in its list. Never preload a font, and keep fonts out of the service-worker shell: each style's fonts load only when used.
- Meanings (`python3 tools/build-meanings.py`): WordNet 3.1, then OEWN, then base-word and phrase steps, then Wiktionary (G9c, CC BY-SA 4.0) from the extract `tools/wiktionary-extract.py` writes to `~/.cache/wordbright-meanings/` (the kaikki.org dump is never in git). Wiktionary meanings live apart in `data/meanings/wikt/`, `src: "wikt"`, with a credit link.
- Tests: `node --test wordbright/tests/` (no npm packages).
