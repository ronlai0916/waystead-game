# SB4 content batches (drafts for Ron to sign off)

One JSON file per batch, in this folder: `y1-a`, `y1-b`, `y2-a`, `y2-b`, `y3-new`, `y4-new`, `y5-new`, `y6-new`.
Check with `node tools/build-chapters.mjs`; sheets for Ron with `--review`; build a signed-off year into
`site/data/curriculum.json` with `--approve y1` (whole year only; the only thing that writes that file).

```
{ "status": "draft — Ron to sign off", "year": 1, "batch": "y1-a",
  "chapters": [ {
    "id": "y1-ch01", "year": 1, "title": "Chapter 1 — Double letters", "focus": "ff, ll, ss, zz, ck",
    "re": "(ff|ll|ss|zz|ck)", "description": "one sentence for a grown-up", "noMatch": true, "signedOff": false,
    "words": [ { "word": "off", "ipa": "/ɒf/",
                 "meaning": { "partOfSpeech": "adverb", "definition": "…", "example": "…" },
                 "chunks": ["off"], "tricky": "ff", "set": "pattern" } ] } ] }
```

- Ids: `y1-ch01`..`y2-ch10`; new chapters `y3-n01`..`y3-n05` (and y4, y5, y6). `a` batches hold chapters 1-5, `b` 6-10.
- Words per chapter: Year 1 8-10, everything else 10.
- `set`: `cew` (statutory, from `../appendix1-y1y2.json`, Years 1-2 only) or `pattern` (ours; must match the chapter's `re`, case-insensitive).
- `noMatch` is optional; `tricky` is optional (1-3 letters in the word); leave `image` out (Ron's later run), except a word already in `curriculum.json`, which copies that entry exactly.
- A word stored with a capital: `I`, `Mr`, `Mrs`, the seven days, `Christmas` only. `a` and `I` have one chunk and no `tricky`.
- Definition at most 14 words, example at most 12 and containing the word exactly once. No apostrophe, hyphen or space in a word. No homophones among pattern words.
- Wordbright's list cannot check `a`, `I`, `Mr`, `Mrs`, the days or `Christmas`: the tool says so and does not fail them.
