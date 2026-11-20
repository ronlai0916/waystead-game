# WP-K statement bank report

Bank `2026-11-18.1`, built 2026-11-19 by `tools/statements-build.mjs`. Rules: statements-check v1. Writers: sonnet. Checker and re-judge: opus. Child readers: haiku (Year 2 reader for Year 1-2 chapters, Year 5 reader for Year 3-6 chapters).

## Coverage (G4)

| Year | Words | With 3 | With 2 | With 1 | With 0 | Statements |
|---|---|---|---|---|---|---|
| 1 | 96 | 95 | 0 | 0 | 1 | 285 |
| 2 | 100 | 97 | 0 | 0 | 3 | 291 |
| 3 | 104 | 102 | 0 | 0 | 2 | 306 |
| 4 | 104 | 104 | 0 | 0 | 0 | 312 |
| 5 | 100 | 100 | 0 | 0 | 0 | 300 |
| 6 | 104 | 102 | 0 | 0 | 2 | 306 |
| **All** | 608 | 600 | 0 | 0 | 8 | 1800 |

Words with 3: 98.7% (target at least 98%). Words in the file: 600. Chapters built: 60 of 60.

## Machine rejects (G1), all rounds

Candidates checked: 3830. A candidate can break more than one rule.

| Rule | What | Rejects |
|---|---|---|
| 1 | word once, exact | 1 |
| 2 | one clean sentence | 17 |
| 3 | length | 41 |
| 4 | word lists, capitals, names, banned topics | 140 |
| 5 | not the meaning or example | 92 |
| 6 | differs from the others | 35 |
| 7 | no other chapter word | 1 |

Final re-check in the build (rules 1-7 and 6 on every shipped statement): 0 dropped.


## Opus check (G2) and child read (G3)

- Opus "no" verdicts: 811 (another chapter word also fits: 626; unsafe or not British: 52; other: 133).
- Child-read flags re-judged: 32 (two_fit 29, cant_read 1, odd 2); dropped 23, kept with a written reason 9.
- Shipped statements flagged and kept: 9 of 1800 (0.5%).
- Words settled in round 0: 515, after retry 1: 67, after retry 2: 26 (the round a word's final list came from).

## Words with 2 statements (0)

none

## Words sitting out of Mix and match (fewer than 2) (8)

Saturday, beautiful, camel, should, forward, forwards, government, horrible
