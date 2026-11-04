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

Each word group has a guided week (Study mode): Hello words, Fix it in, Game day, Story day, Practice day, Test day, Mend and keep, one job a day. The days up to the test are shared out evenly, so a short week puts several jobs on a day. A missed job waits; from the test date the test comes first. In Fix it in, the practice grid and Mend, a mistake or a peek brings the same word straight back and resets its count; a word is done for the session after 3 clean spellings in a row. "Skip for now" sends a word to the end of today's list, marked "Come back to this", and the job stays open until it's done. A word's dots show today's count, and stay at 3 once it has finished a session before the test; "Ready for the test" means every test word has. In the spelling games a mistake brings the word back until it's clean, with the same skip, but they earn no dots. Meaning match doesn't test spelling, so it can earn a star and counts as played, and no first go. Game mode has Missing letters, Unjumble, Meaning match and Quick-fire with the same words. While a test is due, no page shows its words (`site/js/test-guard.js`): those pages show the Test today card, and word lists leave them out. My room, the home page for a child, shows today's job.

**Stories.** `site/data/stories.json` has one original story per chapter. To release some: read them at `#/grownups/stories`, tick Approve, run the command the page shows (`node tools/approve-stories.mjs <chapters>`), bump `VERSION` in `site/sw.js` and deploy. Then, for the Waystead voice, `GCP_PROJECT=… python3 tools/generate-story-audio.py`; until then the device's voice reads them.

**Grown-ups** (`#/grownups`, an adult signed in as themselves) has the story review now. Plan a week and the dashboard wait for three routes on the Waystead account, then set `CHILD_DATA_API` to true in `site/js/grownups-data.js`:

| Route | Answers |
|---|---|
| `GET /api/children` | `{children: [{id, nickname, year, avatar}]}` |
| `GET /api/children/:id/game/:game` | as `GET /api/game/:game`, for that child |
| `PUT /api/children/:id/game/:game/:key` | as `PUT /api/game/:game/:key`, 409 included |

All three: an adult's session with `playingAs` null only (403 otherwise), 404 for a child who isn't theirs, the usual CORS, Origin and rate-limit rules. `shared/tests/fake-account.js` has them.

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
