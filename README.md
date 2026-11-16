# Waystead Game — Spellbright, Wordbright and the home page

**https://game.waystead.co.uk/** is the Waystead Game home page (`hub/site/`).
**Spellbright by Waystead** is a spelling game for the UK Year 3–6 statutory
word list (213 words, English Appendix 1), at
**https://game.waystead.co.uk/spellbright/**. **Wordbright** (below) will be at
`/wordbright/`.

Static site: HTML + CSS + vanilla JS modules. No framework, no build step, no
backend, no database, no secrets. Progress is kept in the browser
(localStorage) on the child's device, and, for a player signed in with a
Waystead account, in that account too (below).

```
waystead-game/
├── site/                      # served at /spellbright/
│   ├── index.html
│   ├── css/app.css            # shared structure; looks in css/styles/ (garden, paint, night)
│   ├── js/                    # app.js (router), views.js, play.js, …
│   ├── data/curriculum.json   # 213 words: meaning, IPA, chunks, image name
│   ├── data/assets.json       # which pictures/MP3s exist (built by a tool)
│   ├── assets/fonts/          # Sora + Manrope (same files as waystead-parent)
│   ├── assets/audio/          # words/*.mp3, letters/*.mp3 (British voice)
│   ├── assets/images/         # <word>.jpg pictures (optional)
│   └── sw.js                  # offline cache — bump VERSION every deploy
├── hub/site/                  # served at /: the Waystead Game home page
│   ├── index.html
│   └── home-assets/           # its own path, so it never clashes with a game:
│                              #   css, js (config.js: BRAND, WORDBRIGHT_LIVE), fonts, icons, img, video
├── wordbright/                # served at /wordbright/ (see below)
├── nginx/default.conf         # headers + CSP, / = home page, /hangman/ → /spellbright/
├── docker-compose.yml         # waystead-game-web on the `web` network
└── tools/
    ├── generate-audio.py      # Google Cloud TTS, en-GB-Neural2-A, via gcloud login
    ├── generate-images.py     # xAI grok-imagine-image, key from Keychain
    ├── image-prompts.json
    ├── build-assets-manifest.py
    ├── build-media.py         # home-page hero and loop, Wordbright win videos (Pillow + ffmpeg)
    └── …                      # Wordbright tools (below)
```

## Waystead Game home page

`hub/site/` is plain HTML, CSS and one small script: the two game cards, the
Waystead Learning panel, and privacy and credits. The name is only in `BRAND`
(`hub/site/home-assets/js/config.js`; the `<title>` is the one static copy).
`WORDBRIGHT_LIVE` there is `false` until launch: the Wordbright card says
"Coming soon" and is not a link. The welcome loop plays muted, and never with
reduced motion.

The look is the games' own: the same top-bar menu (Day · Sunny garden,
Day · Paint box, Night, Match device) and the same keys, `sb.theme` and
`sb.dayStyle`, so a choice on the home page shows in both games and back.
`home-assets/js/theme-boot.js` sets `data-theme` and `data-style` before the
first paint; the three styles are in `home-assets/css/styles/` with their OFL
fonts (`home-assets/fonts/`, licences beside them), loaded only for the style in
use. Terracotta stays the home page accent (light Terracotta at Night); the
game cards keep Plum and Indigo, the Learning panel its darker Teal.
Tests: `node --test hub/tests/` (contrast in all three styles, theme-boot, menu).

Remake the hero pictures and videos from `wordbright-design/assets-raw/`
(needs `brew install ffmpeg`):

```bash
python3 tools/build-media.py
```

Try it locally: `python3 -m http.server 8000 --directory hub/site`.

## Run it locally

```bash
python3 -m http.server 8000 --directory site
```

Open http://localhost:8000. (The service worker only registers over HTTPS, so
local testing never gets stuck on an old cache.)

## How a chapter works

Study → Quick game (6 wrong guesses; the picture sharpens with each miss) →
Practice (10 wrong guesses; picture blurred until the end) → Test (hear the
word, type it; every word right opens the next chapter). Missed test words go
into "Tricky words". "Pick words" plays any chosen list.

## My words

A weekly list, beside the chapters, at `#/words` (signed in). A group has a name, a test date (7 days on by default) and up to 10 words, picked from a chapter, Tricky words or a year list, or typed. The first visit makes one from the current chapter.

- **Practise**, each day until the day before the test: one row per word, one column per day. The word is spoken and hidden, and spelled letter by letter, each checked at once. After a mistake or a peek it must be spelled once more, clean, to count for today.
- **Test**, on the date: one go each, no peeking, results at the end.
- **Fix-ups**, from the day after: the words that slipped, until spelled clean at a first go.
- **Remembered**: clean and unaided at the first go of a day, on 3 different days at least 7 days apart from first to last; a right test answer counts as one. Words not yet remembered come back, up to 3 at a time, in new groups and in the flower game.

## Study mode, Game mode and Grown-ups

Each word group has a guided week (Study mode): Hello words, Fix it in, Game day, Story day, Practice day, Test day, Mend and keep, one job a day, about 15–20 minutes a day. Each word is spelled 3 times in a row before it counts. The days up to the test are shared out evenly, so a short week puts several jobs on a day. A missed job waits; from the test date the test comes first. In Fix it in, the practice grid and Mend, a mistake or a peek brings the same word straight back and resets its count; a word is done for the session after 3 clean spellings in a row. "Skip for now" sends a word to the end of today's list, marked "Come back to this", and the job stays open until it's done. A word's dots show today's count, and stay at 3 once it has finished a session before the test; "Ready for the test" means every test word has. In the spelling games a mistake brings the word back until it's clean, with the same skip, but they earn no dots. Meaning match doesn't test spelling, so it can earn a star and counts as played, and no first go. Game mode has Missing letters, Unjumble, Meaning match and Quick-fire with the same words. While a test is due, no page shows its words (`site/js/test-guard.js`): those pages show the Test today card, and word lists leave them out. My room, the home page for a child, shows today's job.

**Stories.** `site/data/stories.json` has one original story per chapter. To release some: read them at `#/grownups/stories`, tick Approve, run the command the page shows (`node tools/approve-stories.mjs <chapters>`), bump `VERSION` in `site/sw.js` and deploy. Then, for the Waystead voice, `GCP_PROJECT=… python3 tools/generate-story-audio.py`; until then the device's voice reads them.

**Grown-ups** (`#/grownups`, an adult signed in as themselves) has Plan a week, a dashboard for each child and the story review, through the account's `/api/children` routes (`site/js/grownups-data.js`; `CHILD_DATA_API` turns Plan and Dashboard off again). An adult playing as a child gets a card to switch back. Nothing about a child is kept on the adult's device.

| Route | Answers |
|---|---|
| `GET /api/children` | `{children: [{id, nickname, year, avatar}]}` |
| `GET /api/children/:id/game/:game` | as `GET /api/game/:game`, for that child |
| `PUT /api/children/:id/game/:game/:key` | as `PUT /api/game/:game/:key`, 409 included |

All three: 401 signed out; 403 `adult-session-required` for a child's session or an adult playing as a child; 404 `no-such-child` for anyone who isn't theirs. `shared/tests/fake-account.js` follows them.

## Composition

Picture composition practice at `/compose/` (`compose/site/`, a static site like Wordbright, with the shared account, voice and top bar). Twelve tasks in `compose/site/data/tasks.json`: four pictures, a background, hint words, a planner, success criteria and a model answer for grown-ups. A child goes through Look, Plan, Write, Check, then hands it in for the automatic checks and, with a parent's consent, AI feedback; one go at making it better; Final. Year 3 has a box per picture.

Saved per player in the account game `compose`: `writing` (the child's), and `marks` and `settings` (a parent's, through `/api/children` only: the account refuses them on the child's own routes). AI feedback is off by default, per child, in Grown-ups.

**Tasks.** Every task starts `"reviewed": false`, visible to an adult signed in as themselves but not to children (nor an adult playing as a child). Read them at `#/grownups/tasks`, run the command the page shows (`node tools/approve-tasks.mjs <ids>`), bump `VERSION` in `compose/site/sw.js`, deploy.

**Pictures.** `python3 tools/compose-art.py plan|make|redo` (prompts in `tools/compose-art.json`; the key is read from the Keychain inside the script; at most 60 calls, counted in `compose-design/assets-raw/calls.json`). Log: `compose-design/assets-raw/ASSETS.md`.

**Tests.** `node --test compose/tests/`, and `node tools/compose-smoke.mjs <folder>`.

## Audio

`tools/generate-audio.py` makes 213 word MP3s and 26 letter MP3s with Google
Cloud Text-to-Speech (`en-GB-Neural2-A`). It uses a short-lived token from
`gcloud auth print-access-token` — no API key is created or stored. Until the
MP3s exist, the game uses the device's own English (UK) voice.

## Pictures

`tools/generate-images.py` makes the 213 pictures with xAI's cheapest image
model (`grok-imagine-image`, about $0.02 each). Prompts are in
`tools/image-prompts.json`; the shared style is in the script. The key comes
only from the environment, passed from the macOS Keychain for that one command.
Try `--limit 5` first; redo bad ones with `--only word1,word2`.

Hand-made pictures work too: put `<word>.jpg` (names as in `curriculum.json`)
in `site/assets/images/`, then run `python3 tools/build-assets-manifest.py`.
Missing pictures show a lettered tile.

## Wordbright (in progress)

A word-tile board game for 11+ practice, to be served at `/wordbright/`.
The plan, rules and boards are in `wordbright-design/`. Two to four players
on one device: children (pass-and-play) and computer players (Pip Easy, Ottie
Normal, Bramble Hard, Fizz Crazy), each with their own word level. Children
get 3 hints per game.

```
wordbright/
├── LICENSE-ESDB.txt, LICENSE-LDNOOBW.txt   # word-list licences (keep with the data)
├── site/index.html, css/app.css   # shared structure
├── site/css/styles/  # the three looks: garden (Sunny garden), paint (Paint box), night (Night sky)
├── site/assets/fonts/  # OFL fonts, licences in licences/; each style's fonts load only when it is shown
├── site/data/        # built: words_all.dawg (every list, tagged), board_*.json, tiles.json, star_words.json, leaves.json (Crazy's leave values)
├── site/data/meanings/  # built by tools/build-meanings.py (WordNet, then Open English WordNet; Britfone): meanings and IPA, one shard per first 2–3 letters, fetched on demand
├── LICENSE-WORDNET.txt, LICENSE-OEWN.txt, LICENSE-BRITFONE.txt  # licences for the meanings data
├── site/assets/characters/  # built: the four computer players, WebP 256/128 px
├── site/js/engine/   # board, bag, words, rules, score, game, levels, movegen (pure ES modules)
├── site/js/ai/       # computer players and hints (pure), worker.js + client.js (Web Worker)
├── site/js/views/    # home, setup (new game), play, end, pages (rules, for parents)
├── site/js/ui/       # board drawing, drag-and-drop, dialogs, move cards
└── tests/            # node --test
```

Try it locally:

```bash
python3 -m http.server 8000 --directory wordbright/site
```

Open http://localhost:8000. The saved game lives in `wb.game`, the last
new-game choices in `wb.setup`, and words a grown-up allowed in `wb.allowed`;
the theme is shared with Spellbright (`sb.theme`).

Looks (W2b, W2c): the look menu in the top bar offers Day · Sunny garden,
Day · Paint box, Night and Match device. It sets `sb.theme` (`light` / `dark`
/ unset, shared with Spellbright and the home page) and, by day, this device's
`sb.dayStyle` (`garden`, the default, or `paint`; shared with Spellbright); the For parents page has
the same day style picker. At night it is always Night sky. `js/theme-boot.js` sets `<html data-theme data-style>`
before the first paint and follows the device live. Fonts: Fredoka + Andika
(garden), Baloo 2 + Nunito (paint), Lexend + Atkinson Hyperlegible (night),
Andika for pronunciations, Sora for the wordmark; all SIL OFL 1.1.
`tests/contrast.test.js` checks every text colour pair in all three styles.

Rebuild the word graphs and data after changing the word lists or boards,
and the character pictures after changing them in `wordbright-design/assets-raw/`:

```bash
python3 tools/build-wordgraph.py
python3 tools/wordbright-characters.py
```

Computer players play each other (strengths, move times, illegal moves):

```bash
node tools/wordbright-bots.mjs            # full run (about 30 minutes; --boards junior to split it)
node tools/wordbright-bots.mjs --games 20 # quick
node tools/wordbright-bots.mjs --pairs hard-crazy --boards standard
```

Crazy's rack-leave table (`site/data/leaves.json`, one per board) is learned
from self-play with our own bags, boards and word lists. Rebuild it after
changing the tiles, boards or word lists (about 10 minutes, all cores):

```bash
node tools/wordbright-leaves.mjs
```

Run the tests (Node 26, no npm packages):

```bash
node --test wordbright/tests/
```

## Preview password (not in use)

Wordbright launched on 28/29 Oct 2026 and `/wordbright/` is open. The
password set-up is kept for future previews: add `auth_basic` and
`auth_basic_user_file /etc/nginx/wordbright.htpasswd;` to a location block in
`nginx/default.conf`. The password file lives only on the server and must
never be committed:

```bash
mkdir -p /home/ubuntu/waystead-secrets
printf 'NAME:%s\n' "$(openssl passwd -apr1)" > /home/ubuntu/waystead-secrets/wordbright.htpasswd
chmod 644 /home/ubuntu/waystead-secrets/wordbright.htpasswd   # nginx in the container must read it
```

`docker-compose.yml` still mounts the file: if it is missing, Docker creates
an empty folder in its place (harmless while no block uses it). To change the
password, run the `printf` line again (no restart needed).

## Waystead account (sign-in, B4b)

Progress and the look can belong to the PLAYER rather than the device. Signed
out, every game works exactly as before. The top bar of all three pages has a
player chip: "Sign in to save progress" (to account.waystead.co.uk, and back
here), or the player's picture and name with Switch player (an adult's
session: `/play`), My account and Sign out.

- **Who is playing** comes from `GET /api/me`: a child (slip or device code),
  an adult playing as one of their children, or the adult themselves. The
  device keeps only `wa.player` = { id, name, avatar URL }, so the chip and the
  player's progress show at once, even offline.
- **Keys.** Signed out: `sb.progress`, `sb.tricky`, `wb.game`, `wb.setup` as
  before. Signed in: `sb.progress:<id>`, `wb.game:<id>`, `wb.setup:<id>`,
  `wb.stats:<id>` (finished games), plus `wa.sync:<id>:<game>` (versions and
  the queue) and `wa.prefs:<id>` (a look not yet sent). The look stays in
  `sb.theme` / `sb.dayStyle` (no flash on load) and follows the player
  through `/api/prefs`. `sb.unlockAll`, `wb.allowed` and `wb.pin` stay the
  device's.
- **Saving.** Each change is sent after a short pause; offline it waits and is
  sent on `online`, when the page is hidden, or on the next visit. A 409 (a
  newer copy elsewhere) is merged and sent again: test and game results merge
  by id, so none is lost or counted twice; the saved Wordbright game and the
  new-game choices go by the newest. Past 48 KB the oldest results are folded
  into totals. A 401 drops to signed out without losing anything on the device.
- **Signing out.** The chip's Sign out opens the account's `/signout` ("Sign out of
  Waystead?"), which comes back with `?signedout=1`. If `/api/me` then says
  nobody is signed in, this device forgets that player (`shared/account/forget.js`):
  `sb.progress:<id>`, `wb.game:<id>`, `wb.setup:<id>`, `wb.stats:<id>`,
  `wa.prefs:<id>`, `wa.import:<id>:*`, `wa.sync:<id>:*` and `wa.player` go, except
  a game whose queue still has unsent changes (its `wa.sync` key and the values
  it names stay, and are sent at the next sign-in). The parameter is then
  removed from the URL. An expired session (a 401) keeps everything.
- **Import.** The first time a player signs in on a device that has signed-out
  progress: "Save this device's progress to <name>?" (Yes / Not now / Never on
  this device), with their name and picture.
- **G6 / G6b.** `REQUIRE_SIGN_IN` in `shared/account/config.js` (on since 2 Nov 2026).
  Signed out, every game page shows "Sign in to play", with a Sign in button back
  to that page (`shared/account/gate.js`), except Wordbright's How to play and For
  parents and Spellbright's About; the home page `/` needs no account. A player
  cached on the device plays offline, and when the account is down (network
  error or 5xx), with progress queued. Nobody cached and no account: "You need to
  be online the first time you sign in" (or "Sign-in isn't answering"). The page
  asks `/api/me` again on focus, on becoming visible and once a minute: signed
  out in another tab or on the account site, a 401, or back from `/signout`, and
  the card shows at once; the game is already saved on the device and the queue
  keeps what is not sent. Signing in again comes back to the same page
  (Wordbright resumes its saved game).
- **Voice (G8).** "Hear" uses the device's best British voice
  (`shared/voice/voice.js`: en-GB, Premium/Enhanced/Natural, known good, never
  novelty voices; rate 0.9), or the one chosen under Voice in the look menu:
  `sb.voice`, shared by both games and saved with the look in `/api/prefs`
  (as `prefs.voice`). The best choice names its voice ("Best British voice
  (Daniel)"); the list below never repeats it. With no British voice, a tip on adding one.

The account client is `shared/account/`, the voice is `shared/voice/` and the top
bar's Menu button is `shared/topbar/`, copied
into each site by `node tools/sync-shared.mjs` (the sites are separate roots and
must work offline). Tests: `node --test shared/tests/` (a fake account API).
On localhost the games look for the account at `http://localhost:3000`.

## Scan

A signed-in grown-up photographs a printed spelling list; the Waystead account reads the words with an AI
service; the grown-up ticks, corrects and saves them as an own chapter. The game shows nothing about
scanning unless `GET /api/scan/allowance` answers `200` with `on: true`; a 404, a network error, a
non-JSON answer or `on` missing or false all mean off. The client is `site/js/scan-doc.js` (pure rules and
wording) and `site/js/scan-data.js` (the three calls; `shared/account/api.js` is JSON-only, so the photo
goes through its own `fetch`). The endpoint lives in the account repo; this is its spec, and
`shared/tests/fake-account.js` follows it.

- `GET /api/scan/allowance` -> `200 { on: boolean, left, limit: 20, hourLeft, resetsOn: 'YYYY-MM-01', hourResetsAt?: ISO 8601 time WITH an offset or Z, e.g. '2026-11-16T16:52:00Z' (optional: when the oldest scan in the hour falls out; the game shows it in the device's own clock, so a time with no zone would be read wrongly), paused: boolean, consent: { at, version } | null, consentVersion: 'v1', vendor: '<name>' }`. `on` is the account's switch: the game shows scanning only when it is exactly `true`.
- `POST /api/scan/consent`, body `{ version }` -> `200 { consent: { at, version } }`.
- `POST /api/scan/words`, `Content-Type: image/jpeg`, the raw bytes as the body (no JSON, no base64), at most 2,097,152 bytes, `credentials: 'include'` -> `200 { words: string[], left, resetsOn }`. At most 40 words, each matching `^[A-Za-z][A-Za-z'-]{0,24}$`, no repeats ignoring case, in reading order.
- Errors: `401` signed out; `403 { error: 'adult-session-required' }` (a child, or an adult playing as a child); `404` scanning not switched on; `400 { error: 'consent-version' }` (consent posted with a version that is not the server's `consentVersion`); `403 { error: 'bad-origin' }` (a POST whose `Origin` is missing or not the game's); `412 { error: 'consent-required', version }`; `413 { error: 'image-too-large' }`; `415 { error: 'bad-image' }`; `429 { error: 'hourly-limit' }` with `Retry-After` (seconds; the account must list it in `Access-Control-Expose-Headers` so the game can read it; without it, or with a value over 7,200, the game says "within the hour": it never shows a time the server did not give); `429 { error: 'monthly-limit', resetsOn }`; `503 { error: 'scan-paused' }` (kill switch or spend ceiling); `502 { error: 'read-failed' }` (vendor error, or the server's own 25 s timeout).
- Counting: a scan is used only when the vendor is called. The month is the Europe/London calendar month; the hour is a rolling 60 minutes; 20 a month and 5 an hour per adult.
- Server duties: the image is held in memory only, never stored, never logged (log only adult id, time, status and word count); the vendor key is in Vault; the model's output is parsed and filtered to the regex (anything else becomes `[]`); CORS allows the game origin with credentials, `POST` and `Content-Type`; no child name or id is sent to the vendor.
- Security: all three routes are adult-session only. Consent is refused unless `version` equals the server's `consentVersion`. CORS names the exact game origin with `Access-Control-Allow-Credentials: true`, never `*`, plus `Vary: Origin`. The POSTs check the `Origin` header and require the exact `Content-Type` (a guard against forged requests). The 2 MB limit is enforced while the body is read, not by trusting `Content-Length`. `415` is decided by the JPEG magic bytes. The vendor is set to retain nothing and not to train on the photo (to be confirmed in Ron's data-protection assessment).
- Client duties: the photo is shrunk on the device (longest side 1600 at JPEG quality 0.85, then 0.7, then 1280 at 0.7), sent once, never stored and cleared on leaving. The client never trusts the answer (`clean` keeps only words matching the pattern, drops repeats, caps at 40). `SCAN_VENDOR` and `PRIVACY_HREF` in `scan-doc.js` are empty until Ron fills them in before switching on; while empty the consent text says "an AI service".
- Words from a scan: a name (a capitalised word that is not a curriculum word) is masked as `R.....`. The days of the week (Monday to Sunday, any case) are always usable, in the typed editor and from a scan (`weekdayForm` in `site/js/wordcheck.js`), and are saved with their capital ("Wednesday"). Month names are deliberately NOT special: April, May, June and August are given names, so a capitalised month that is not a curriculum word is masked like a name.
- Screens (SB4-D, `site/js/scan-views.js`, route `#/grownups/scan`, adults only, classified in `test-guard.js`): consent (once; reopened read-only by "How scanning works"), photo (Take a photo only on a touch device, Choose a photo always), reading (Cancel, Type the words instead, a still-reading line after 15 s, a 30 s time-out), check (up to 15 words pre-ticked, a 16th tick allowed with the reason shown, edit in place, Add a word, "We left these out" with names masked as `R.....`), name and share, done (second and third chapter from the same scan, Use for this week, Scan another paper). Every limit and failure has one plain line and keeps "Type the words instead". Links to it ("Scan a paper" on the own list, "Scan a paper instead" in the editor) are drawn only after `allowance.on === true`. A 401 keeps the ticked words in `sessionStorage` key `sb.scanWords` ({ to, words }, at most 15, read once) for the sign-in return and for "Type the words instead". Back (the phone's own gesture) from the check or name step with ticked words leaves without a dialog; the page then keeps the ticked words (only words, at most 15) in `sb.scanWords` for the next visit to the scan page, which reads them once; choosing Leave in the dialog does not keep them, and any other hand-off is cleared when its page is left. A session that ends at Save chapter is the app's general sign-out redraw (`shared/account/boot.js`, `session.on` with reason `expired`, started by a 401 from the account sync after the chapter is written to the device), which replaces the page for the typed editor too; the scan page's words are kept the same way. Smoke scenes: `tools/smoke-sb4/scan.mjs`.

## Release notes

### SB4-E/F (spellbright-2026-11-16c): Years 1 to 6 chapters, hardening, scan switch-on notes

- Years 1 to 6 now have ten chapters each (Year 1: 96 words, Year 2: 100, Year 3: 105, Year 4: 104, Year 5: 100, Year 6: 104; 608 different words, 395 new). Years 1 and 2 hold the national curriculum's common exception words (labelled "from the national curriculum", never "statutory") plus our own pattern words; Years 3 to 6 keep their old chapters first and add five new ones each. More practice has six year tabs and the Menu says "Year 1 to Year 6 chapters". New words use the device's voice and a sentence card until their audio and pictures are generated (`ASSETS-for-Ron.md`).
- While a week's test is due, no study page shows an example sentence containing one of its words (the test itself still hears its sentence).
- Hardening: a bad address piece (`%` and the like) can no longer crash a page (`safeDecode` everywhere, with a test that fails on an unguarded decode); text fields and unticked boxes have a 3:1 edge in all three styles; the brand is no longer clipped at 320 px; the quiet links on the Grown-ups home are equal height.
- Scan: still dark. The account side is specified in `claude/scan-account-spec.md` and the switch-on steps in `claude/scan-switch-on-checklist.md` (project docs); this README's Scan section now lists `400 consent-version` and `403 bad-origin`.
- Known, later: Night-style radio buttons are faint (native); compose/ and wordbright/ still have unguarded decodes; More practice and story-approve checkboxes are not restyled.

### SB4-D (spellbright-2026-11-16b): scan a paper, and the teacher page

- **Scan a paper** (dark until the account answers `on: true`, so nothing changes for anyone yet): a grown-up photographs a school spelling list, the words are read, and they tick and correct them. Up to 15 words make a chapter; a longer list can become two or three chapters from the one scan. Names on the paper are masked and never saved. The photo is never kept by Waystead. A signed-out grown-up keeps their ticked words across sign-in.
- **For teachers** (Menu, "For teachers"): one list across all the children who have it, with each child's stage, practice, chapter test and quiz, the words to practise, and a per-word table. "Set this week's test" makes a week with a test date for several children at once (one week each, never two). Print the page, print for one child (nothing about the other children prints), or copy as text.
- Known: month names are never offered from a scan when they are not curriculum words, because several are given names. If the sign-in session ends just as a chapter is saved, the chapter may already be on the device, so check "Your own chapters" before saving again.
- Before scan is switched on (Ron): fill `SCAN_VENDOR` and `PRIVACY_HREF` in `scan-doc.js`; DPIA, a data processing agreement with the AI vendor, and terms of use (see requirements in the process folder); the account's scan routes (README "Scan").

### SB4-C (spellbright-2026-11-16a): grown-ups' own chapters and cards for words without a picture

- A grown-up can make their own chapters (Menu, "Your own chapters"): up to 30 chapters of up to 15 words each, typed or pasted from a school list (one word per line, comma, semicolon or tab; list numbers are dropped). Words we can't use yet are shown and left out.
- Each chapter is shared with chosen children. They find it under "From your grown-up" on More practice and learn, practise, test and quiz it like a year chapter; their stars stay with the chapter if it is edited.
- Delete has a 10-second Undo and a 30-day "Deleted chapters" list with Restore.
- "Use for this week" turns a chapter into a week: pick 10, choose the child, then Plan a week opens with the words filled in.
- A word with no picture now shows its example sentence on a card with a Hear button instead of an empty box.
- Older copies of the app on a device ignore the new `own` field until they update. A chapter shared with nobody, or deleted, cannot be rebuilt from a child's copy.
- Known: the test guard checks a chapter's own words, not the words inside its example sentences.

### SB4-B (spellbright-2026-11-15a): letter tiles and grown-up set-up

- Letter tiles: a child can be set to "Some letters" for a word. The tiles sit in a tray beside the keyboard; Back and tapping a box undo; a third miss fills the letter in.
- A "How <child> spells" card for each child (the child's name goes in): letters or keyboard, help in tests, and which tests to offer.
- Quiz after a chapter, and a big test or exam that a grown-up sets for a day. The report shows the score, the words to practise and "with letter tiles" when tiles were used.
- Honest report lines, the overview and print for grown-ups.
- **The chapter test now gives its feedback at the end**, not word by word.
- **A Year 1 or 2 child with no setting now gets letter tiles.** A Year 3 or older child with no setting keeps the keyboard.
- An older copy of the app still on a device plays on the keyboard and may not show the new setting until it updates. Any updated device puts the setting back.
- Days folded by an older app still count as remembered, as before.

## Deploy (waystead-prod)

Wired like the parent site: its own Compose project, nginx on the external
`web` network, and one block in `waystead-server/infra/caddy/Caddyfile`
(`game.waystead.co.uk` → `waystead-game-web:80`).

On every release: bump `VERSION` in `site/sw.js` (Spellbright) and/or
`wordbright/site/sw.js` (Wordbright), commit, push, then on the server
`git pull --ff-only`. The site folders are bind-mounted, so no restart is
needed for content changes (restart only if `nginx/default.conf` or
`docker-compose.yml` changed: `docker compose up -d --force-recreate`).

## Launch checklist (Wordbright)

Owner checks first (Ron):

- [x] UKIPO trade-mark search for "Wordbright" in classes 9, 28 and 41.
- [x] xAI's current terms for commercial use of Grok Imagine output; write the
      date checked and the result at the top of `wordbright-design/assets-raw/ASSETS.md`.

Then the release:

- [x] `nginx/default.conf`, `/wordbright/` block: delete the two `auth_basic`
      lines and the `X-Robots-Tag` line.
- [x] `hub/site/home-assets/js/config.js`: `WORDBRIGHT_LIVE = true`.
- [x] Bump `VERSION` in `wordbright/site/sw.js` and in `site/sw.js`.
- [ ] Commit, push; on the server: `git pull --ff-only`, then
      `docker compose up -d --force-recreate` (nginx changed).
- [ ] Test: `/` shows the Wordbright card as a link; `/wordbright/` opens with
      no password and no `X-Robots-Tag`; `/spellbright/` and `/hangman/` as before;
      play a game against a computer player; turn the network off and reload
      (the saved game comes back).
- [ ] Later: the htpasswd file on the server can be deleted, with its line in
      `docker-compose.yml`.
