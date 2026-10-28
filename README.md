# Waystead Games — Spellbright

**Spellbright by Waystead** is a spelling game for the UK Year 3–6 statutory
word list (213 words, English Appendix 1). It lives at
**https://game.waystead.co.uk/spellbright/**.

Static site: HTML + CSS + vanilla JS modules. No framework, no build step, no
backend, no database, no secrets. Progress is kept in the browser
(localStorage) on the child's device.

```
waystead-game/
├── site/                      # served at /spellbright/
│   ├── index.html
│   ├── css/app.css            # Waystead brand tokens (Ink, Paper, Plum, Amber)
│   ├── js/                    # app.js (router), views.js, play.js, …
│   ├── data/curriculum.json   # 213 words: meaning, IPA, chunks, image name
│   ├── data/assets.json       # which pictures/MP3s exist (built by a tool)
│   ├── assets/fonts/          # Sora + Manrope (same files as waystead-parent)
│   ├── assets/audio/          # words/*.mp3, letters/*.mp3 (British voice)
│   ├── assets/images/         # <word>.jpg pictures (optional)
│   └── sw.js                  # offline cache — bump VERSION every deploy
├── nginx/default.conf         # headers + CSP, / → /spellbright/, /hangman/ → /spellbright/
├── docker-compose.yml         # waystead-game-web on the `web` network
└── tools/
    ├── generate-audio.py      # Google Cloud TTS, en-GB-Neural2-A, via gcloud login
    ├── generate-images.py     # xAI grok-imagine-image, key from Keychain
    ├── image-prompts.json
    └── build-assets-manifest.py
```

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
├── site/index.html, css/app.css
├── site/data/        # built: words_all.dawg (every list, tagged), board_*.json, tiles.json, star_words.json
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

## Wordbright preview (password)

Until launch, `/wordbright/` asks for a password and sends
`X-Robots-Tag: noindex, nofollow`. The game's own nginx checks it (Caddy and
`waystead-server` are unchanged), using a password file that lives only on
the server and must never be committed:

```bash
mkdir -p /home/ubuntu/waystead-secrets
printf 'NAME:%s\n' "$(openssl passwd -apr1)" > /home/ubuntu/waystead-secrets/wordbright.htpasswd
chmod 644 /home/ubuntu/waystead-secrets/wordbright.htpasswd   # nginx in the container must read it
```

Make the file before `docker compose up`: if it is missing, Docker creates
an empty folder in its place and `/wordbright/` gives an error. To change the
password, run the `printf` line again (no restart needed).

At launch, delete the two `auth_basic` lines (and `X-Robots-Tag`) in the
`/wordbright/` block of `nginx/default.conf`, then
`docker compose up -d --force-recreate`.

## Deploy (waystead-prod)

Wired like the parent site: its own Compose project, nginx on the external
`web` network, and one block in `waystead-server/infra/caddy/Caddyfile`
(`game.waystead.co.uk` → `waystead-game-web:80`).

On every release: bump `VERSION` in `site/sw.js`, commit, push, then on the
server `git pull --ff-only`. The site folder is bind-mounted, so no restart is
needed for content changes (restart only if `nginx/default.conf` changed:
`docker compose up -d --force-recreate`).
