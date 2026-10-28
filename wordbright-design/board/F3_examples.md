# F3 — Worked examples and game length (scores computed by code from board_*.json and tiles.json)

## Example 1 — Standard 13x13, first move: BUILD (a Star word)
Across, row 7 (counting from 1), from the Glow square to the start square.

| Tile | Square | Points |
|---|---|---|
| B (3) | Glow (3L) | 9 |
| U (3) | — | 3 |
| I (2) | — | 2 |
| L (2) | — | 2 |
| D (2) | start ● | 2 |
| | Word total | 18 |
| | Star word bonus | +5 |
| | **Score** | **23** |

## Example 2 — Standard, next move: SPINE (down, through the I of BUILD)
S and E are new tiles on two Shine squares; I is already on the board.

| Tile | Square | Points |
|---|---|---|
| S (1) | Shine (2W) | 1 |
| P (3) | — | 3 |
| I (2) | already there | 2 |
| N (2) | — | 2 |
| E (1) | Shine (2W) | 1 |
| | Letters | 9 |
| | Two Shines: × 2 × 2 | × 4 |
| | **Score** | **36** |

## Example 3 — Large 20x20, first move: LIBRARY (7 tiles, a Star word)
Across, row 10, from Glow to past Glow, covering two start squares.

| Tile | Square | Points |
|---|---|---|
| L (2) | Glow (3L) | 6 |
| I (2) | — | 2 |
| B (3) | start ● | 3 |
| R (2) | start ● | 2 |
| A (2) | — | 2 |
| R (2) | Glow (3L) | 6 |
| Y (4) | — | 4 |
| | Word total | 25 |
| | Full-rack bonus | +30 |
| | Star word bonus | +5 |
| | **Score** | **60** |

## Game length (estimate)
Assumes about 3.2 tiles placed per turn, 75 s per child's turn, 4 s per computer turn.

| Board | Turns | Child + 1 computer | Child + 3 computers | 2 children | 4 children |
|---|---|---|---|---|---|
| Junior 9x9 | ~16 | ~10 min | ~6 min | ~20 min | ~20 min |
| Standard 13x13 | ~29 | ~19 min | ~10 min | ~36 min | ~36 min |
| Large 20x20 | ~54 | ~36 min | ~20 min | ~68 min | ~68 min |

Large with 2–4 children is a long game, so save-after-every-move matters.
