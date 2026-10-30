# Waystead Game — Spellbright, Wordbright and the home page

**https://game.waystead.co.uk/** is the Waystead Game home page (`hub/site/`).
**Spellbright by Waystead** is a spelling game for the UK Year 3–6 statutory
word list (213 words, English Appendix 1), at
**https://game.waystead.co.uk/spellbright/**. **Wordbright** (below) will be at
`/wordbright/`.

Static site: HTML + CSS + vanilla JS modules. No framework, no build step, no
backend, no database, no secrets. Progress is kept in the browser
(localStorage) on the child's device.

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
├── site/data/        # built: words_all.dawg (every list, tagged), board_*.json, tiles.json, star_words.json
├── site/data/meanings/  # built by tools/build-meanings.py (WordNet + Britfone): meanings and IPA, one shard per first 2–3 letters, fetched on demand
├── LICENSE-WORDNET.txt, LICENSE-BRITFONE.txt  # licences for the meanings data
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
node tools/wordbright-bots.mjs            # full run, about 2 minutes
node tools/wordbright-bots.mjs --games 20 # quick
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
