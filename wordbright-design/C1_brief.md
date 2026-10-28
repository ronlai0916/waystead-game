# C1 — Wordbright engine (brief for Claude Code)

Paste everything inside the box into Claude Code, started in ~/Projects/waystead-game.

```
C1 — Wordbright engine. Build and STOP before commit (Ron reviews, commits and pushes).

Read first: CLAUDE.md, README.md, wordbright-design/PLAN.md (all revisions), wordbright-design/board/ (board_*.json, rules.md, F3_examples.md), wordbright-design/wordlist/ (SOURCES.md, tiles.json, star_words.json, words_*.txt). Spellbright (site/) is the style model: static, vanilla ES modules, no framework, no npm runtime deps, strict CSP (no inline script/style, no WebAssembly).

Layout (new, beside Spellbright; do not change site/ or nginx/ or docker-compose.yml in this slice):
- wordbright/site/            served later at /wordbright/  (this slice: only data/ and js/engine/)
- wordbright/tests/           node --test (Node 26, no npm packages)
- tools/build-wordgraph.py    run by hand, like tools/build-assets-manifest.py

1. tools/build-wordgraph.py
   - Reads wordbright-design/wordlist/words_{starter,steady,full,large,xlarge}.txt and writes one compact DAWG file per list to wordbright/site/data/ (binary or compact JSON; your choice, with a small JS reader in js/engine/). Report raw and gzip size of each.
   - Copies board_junior/standard/large.json, tiles.json and star_words.json into wordbright/site/data/.
   - Copies LICENSE-ESDB.txt and LICENSE-LDNOOBW.txt into wordbright/ (licences travel with the data).

2. wordbright/site/js/engine/ — pure functions, game state is plain JSON (so the same code can run on a server later for online play):
   - board.js: load a board JSON; size from the file (never hard-code 9, 13, 15 or 20); start squares are a SET (1 square, or the 2x2 block on Large).
   - bag.js: tile bag per board from tiles.json; seeded shuffle (state stores the seed and position, so games replay exactly).
   - words.js: DAWG reader; isWord(word, list).
   - rules.js: move validation — tiles in one line, no gaps, joins existing tiles, first move covers a start square, every word formed (main + cross words) is in the player's list.
   - score.js: Spark L2, Glow L3, Shine W2, Star W3 (only on newly placed tiles; word multipliers multiply), blanks score 0, +5 per Star word formed (main or cross word), +30 full-rack bonus (all 7 tiles).
   - game.js: players (2–4), racks of 7, turns, play / swap (bag needs at least 7 tiles) / pass, end when bag empty and one rack empty, or everyone passes 3 rounds in a row; end penalty = minus own rack points. Exactly as wordbright-design/board/rules.md.
   - levels.js: the word-level table in PLAN.md Rev 4 (Year 1 … Doctor → bands A–I → which list the player may play, which list the computer knows; band A computer words up to 6 letters; which Star-word years count). Computer strength (Easy/Normal/Hard/Crazy) is C3, not now.

3. Tests (wordbright/tests/, node --test), for each of the three boards:
   - The three worked examples in F3_examples.md score exactly 23, 36 and 60.
   - At least 20 hand-made legal and illegal moves (gaps, not joined, not in line, off board, first move missing the start; Large: touching only one of the four start squares is legal, touching none is illegal; a cross word that is not a word is illegal).
   - Blanks; swap with fewer than 7 tiles in the bag refused; end of game and penalties; a seeded game replays identically.
   - isWord: "colour" yes, "color" no (full list); a Star word in every list; a removed word (from excluded_full.txt) in no list.
   - Banned-names test: grep wordbright/ for Scrabble, Words With Friends, "triple word", "double letter", bingo (case-insensitive) — must find none.

4. Add a short "Wordbright" section to CLAUDE.md and README.md (layout, how to rebuild the word graphs, how to run tests). British English.

Report: file list, word-graph sizes (raw and gzip), test results per board, anything in the plan you think is wrong or unclear. Do not touch site/, nginx/ or docker-compose.yml. Do not commit. STOP.
```
