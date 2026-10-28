# Waystead word-tile game — PLAN (27 Oct 2026, rev 3)

A tile-and-board word game for 11+ practice, with computer players. Lives beside Spellbright in the `waystead-game` repo (public, static, no secrets) at `https://game.waystead.co.uk/wordbright/`.

**Name:** Wordbright by Waystead (decided 28 Oct, Ron). Folder/slug `wordbright`. UKIPO check (classes 9, 28, 41) still to do before launch.

Rev 3 (27 Oct): boards 9×9 / 13×13 / 20×20 decided; G3–G5 accepted as proposed.

---

## 1. Who does what

| Tool | Job | Output |
|---|---|---|
| Claude (Ron's chat) | Architect and reviewer. Writes the briefs, reviews every report before commit. | Decisions, reviews |
| Claude desktop + folder (F-prompts) | Research and content: name check, word list, letter values, board layout, asset prompt list, page text | Files in `wordbright-design/` |
| Grok — grok.com Imagine (Safari) | Pictures and short videos from the F4 prompt list | PNG / MP4 in `wordbright-design/assets-raw/` |
| Claude Code | Builds the game in `waystead-game`, slice by slice, STOPs before commit | Code + tests + report |
| Ron | Picks, commits, pushes, `git pull` on the server, play-test | — |

---

## 2. Keep clear of Scrabble IP (design rules, not legal advice)

| Area | Do NOT use | Use instead |
|---|---|---|
| Name and words | "Scrabble", "Words With Friends", "Bananagrams", "Lexulous", "triple word score", "double letter score", "bingo" | Own name; own square names (Spark, Glow, Shine, Star); "Full-rack bonus" |
| Board | 15×15 with Scrabble's bonus-square pattern; 21×21 | 9×9, 13×13 and 20×20, own patterns, own start symbol |
| Tiles | Scrabble's letter values and tile counts; cream wooden-tile look | Values and counts computed from OUR word list; Waystead colours, rounded tiles |
| Word list | Collins Scrabble Words, NWL/TWL, any tournament list | Open list with a permissive licence (SCOWL en-GB, 12dicts) — licence file kept in the repo |
| Art | Anything like a known game box, board or character | Original Grok art, prompts and dates logged in `ASSETS.md` |

---

## 3. The game (first release)

### Boards
| Board | Size | Squares | Tiles (proposed) | Start | Game length (2 players) | Best on |
|---|---|---|---|---|---|---|
| Junior | 9×9 | 81 | ~50 + 1 blank | Centre square | ~15 min | Phone, iPad |
| Standard | 13×13 | 169 | ~90 + 2 blanks | Centre square | ~30 min | iPad, Mac |
| Large | 20×20 | 400 | ~170 + 4 blanks | Centre 2×2 block — first word covers at least one of the 4 squares | ~60–90 min | Mac, iPad landscape |

Phones (screen narrower than 600 px): Junior and Standard only. Standard on a 390 px phone gives about 27 px squares, so it uses tap-to-place with a big preview of the chosen square. Large 20x20 is for tablets and computers: on a phone it is shown but locked ("Needs a tablet or computer"). Decided 28 Oct (Ron). Game saves after every move.

### Rules and features (decided)
| Item | Decision |
|---|---|
| Players | 1 child + 1–3 computer players; or 2–4 children pass-and-play |
| Rack | 7 tiles on all boards; swap allowed (lose turn); pass allowed |
| Word check | Own British list, child-safe filtered; invalid word cannot be placed, with a kind hint |
| 11+ layer | Star words = KS2 statutory spelling list (Spellbright's `curriculum.json`): +5 bonus each, meaning shown after the play, "Practise in Spellbright" link at game end |
| End-of-game | Scores, best word, Star words used, new words met |
| Computer players | 3 original characters: Starter / Steady / Sharp (+ hidden Expert) |
| Data | No login; saved game and stats in the browser; works offline |
| Price | Free first release |
| Look | Waystead brand, light/dark/system theme, British English |

### Computer players (SUPERSEDED by Rev 4: Easy / Normal / Hard / Crazy)
Move finder in a Web Worker on a compact word graph (DAWG/GADDAG) built at build time.

| Level | Knows | Picks | Time cap |
|---|---|---|---|
| Starter | Common words (ESDB size 35, ~38k forms) | A middling move (~40th percentile) | 1–2 s pause |
| Steady | ESDB size 50 (~61k forms) | Random from top 5 | 1–2 s |
| Sharp | Full list (size 60, ~77k forms) | Best score, slight keep-good-letters bias | ≤3 s (≤5 s on Large) |
| Expert (hidden) | Whole list | Best score + rack-leave | ≤3 s (≤5 s on Large) |

---

## 4. Order of work
F0 kick-off → F1 names → F2 word list and tiles → F3 boards and rules → F4 asset list → Grok assets → C1 engine → C2 UI → C3 computer players → C4 learning layer and finish → deploy → play-test.

## 5. Decisions
| # | Question | Decision |
|---|---|---|
| G1 | Name | Wordbright (Ron, 28 Oct); UKIPO check before launch |
| G2 | Boards | 9×9 Junior, 13×13 Standard, 20×20 Large (Ron, 27 Oct) |
| G3 | Players | Child + 1–3 bots; pass-and-play 2–4 (accepted 27 Oct) |
| G4 | Star-word bonus | +5 per Star word, meaning shown (accepted 27 Oct) |
| G5 | Free or paid | Free first release (accepted 27 Oct) |
| G6 | Phones | Junior + Standard; Large locked on phones (Ron, 28 Oct) |
| G7 | Theme | Shared with Spellbright (`sb.theme`) (Ron, 28 Oct) |
| G8 | Games home page | Yes, at game.waystead.co.uk/ — "Waystead Game", Plum #6B3FA0 accent, in this release (Ron, 28 Oct) |

## F2 done (28 Oct)
Word lists, child-safe filter, Star words, letter values and three tile bags in wordlist/ (see SOURCES.md). Credit LDNOOBW (CC BY 4.0) and keep the ESDB notice on the For parents page.

## Rev 4 (28 Oct, Ron) — levels, word levels, accounts, online play

### Computer strength (replaces Starter / Steady / Sharp / Expert)
| Strength | How it picks | Time cap |
|---|---|---|
| Easy | A weak move (about 30th percentile), sometimes swaps | 1–2 s pause |
| Normal | Random from its top 10 moves | 1–2 s |
| Hard | Best score | ≤3 s (≤5 s on Large) |
| Crazy | Best score + keeps good letters for next turn | ≤3 s (≤5 s on Large) |

### Word level (separate choice: Year 1 … Year 13, Degree, Master, Doctor)
Each choice maps to a word band. No reliable data separates neighbouring years, so they share a band.
| Choice | Band | Computer knows (ESDB size) | Player may play | Star words |
|---|---|---|---|---|
| Year 1–2 | A | 35, up to 6 letters | Full (60) | Y1–2 common exception words (to add from English Appendix 1, OGL) |
| Year 3–4 | B | 35 | Full (60) | Y3–4 list |
| Year 5–6 | C | 50 | Full (60) | Y5–6 list |
| Year 7–9 | D | 50 | Full (60) | all KS1–2 lists |
| Year 10–11 | E | 60 | Full (60) | all KS1–2 lists |
| Year 12–13 | F | 60 | 70 | all KS1–2 lists |
| Degree | G | 70 | 70 | — |
| Master | H | 70 | 80 | — |
| Doctor | I | 80 | 80 | — |
Needs: F2 re-run to make size-70 and size-80 lists with the same child-safe filter.

### Release plan
| Release | Contents | Server |
|---|---|---|
| R1 Wordbright offline | Everything above; no login; vs computer or pass-and-play | Static (as Spellbright) |
| R2 Waystead Account | One login for all of waystead.co.uk (Learning, Games, later others); parent-owned accounts for children | New auth service — separate design (D-SSO) |
| R3 Online play | Play friends/family online with an invite code; server checks every move with the same engine; no free-text chat; cap on players online at once with a "busy, try later" queue | New game service (WebSocket) beside nginx |
R1 engine must be pure and JSON-based so R3 can run it on the server unchanged.

### Decided 28 Oct (Ron): all as suggested
- R1 offline first, then R2 Waystead Account, then R3 online play.
- Online play: invite code only (no matching with strangers); preset messages only, no free chat.
- Starting cap: 100 players online / 50 games, "busy, please try later" queue; raise after load test.
- Computer strength: Easy / Normal / Hard / Crazy. Word level: Year 1 … Year 13, Degree, Master, Doctor (bands A–I).
- Boards (F3) accepted as drawn.

## F2b done (28 Oct)
| Band | Word list file | Words |
|---|---|---|
| A, B (Year 1–4) | words_starter.txt (A: only words up to 6 letters) | 38,502 |
| C, D (Year 5–9) | words_steady.txt | 60,674 |
| E (Year 10–11), player list for A–E | words_full.txt | 76,536 |
| F, G (Year 12 – Degree) | words_large.txt | 123,777 |
| H, I (Master, Doctor) | words_xlarge.txt | 177,396 |
Star words: 316 (Y1 43, Y2 61, Y3–4 109, Y5–6 104) in star_words.json, each with "years".
## F4 done (28 Oct)
16 character pictures, home-page picture, 5 videos in assets-raw/ (xAI spend about $1.90). Made with tools/wordbright-art.py; prompts in tools/wordbright-art.json; log in assets-raw/ASSETS.md.

## C1 review decisions (28 Oct)
- Star words depend on the level (Rev 4); rules.md updated.
- Game end: three full rounds with no score; passes AND swaps count (stops endless swapping).
- Final scores never below 0 (children).
- "busy" is in Year 2 and Year 3–4: one entry, years as a list.
- Computer only plays words it knows; its list is always inside the player's list (checked for every level).
- One word graph for all levels: words_xlarge tagged with the smallest list each word belongs to (decide/implement in C3).
- Compression of .dawg files: fix in the server slice (nginx gzip for /wordbright/data, or Caddy encode match).
- Saved game holds the bag in draw order; for online play the server never sends the bag.
