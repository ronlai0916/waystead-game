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
│   ├── css/app.css            # Waystead brand tokens (Ink, Paper, Teal, Amber)
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
The plan, rules and boards are in `wordbright-design/`. So far only the
engine and its data exist:

```
wordbright/
├── LICENSE-ESDB.txt, LICENSE-LDNOOBW.txt   # word-list licences (keep with the data)
├── site/data/        # built: words_*.dawg, board_*.json, tiles.json, star_words.json
├── site/js/engine/   # board, bag, words, rules, score, game, levels (pure ES modules)
└── tests/            # node --test
```

Rebuild the word graphs and data after changing the word lists or boards:

```bash
python3 tools/build-wordgraph.py
```

Run the tests (Node 26, no npm packages):

```bash
node --test wordbright/tests/
```

## Deploy (waystead-prod)

Wired like the parent site: its own Compose project, nginx on the external
`web` network, and one block in `waystead-server/infra/caddy/Caddyfile`
(`game.waystead.co.uk` → `waystead-game-web:80`).

On every release: bump `VERSION` in `site/sw.js`, commit, push, then on the
server `git pull --ff-only`. The site folder is bind-mounted, so no restart is
needed for content changes (restart only if `nginx/default.conf` changed:
`docker compose up -d --force-recreate`).
