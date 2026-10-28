# Word list sources (built 28 Oct 2026)

| Part | Source | Version | Licence |
|---|---|---|---|
| Words | English Speller Database (ESDB, formerly SCOWL), Kevin Atkinson — https://github.com/en-wl/wordlist | commit 1e5b7d3a (24 Jun 2026), file data/scowl-pre.txt | MIT-like; notice in LICENSE-ESDB.txt must be kept with any copy |
| Child-safe filter | "List of Dirty, Naughty, Obscene, and Otherwise Bad Words" (LDNOOBW), file `en` — https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words | commit 5faf2ba4 (13 Jul 2020) | CC BY 4.0 (LICENSE-LDNOOBW.txt) — credit needed on the "For parents" page |
| Star words | Spellbright site/data/curriculum.json and English Appendix 1 Year 1–2 lists (DfE 2013) | Spellbright v4 | Open Government Licence v3.0 |

Not used: Collins Scrabble Words, NWL/TWL, ENABLE as a game list, or any tournament list.

## How the lists are made (tools/parse_esdb.py, tools/build_lists.py)
1. British spelling only: ESDB lines with no spelling code, or spelling B / _ at variant level 0 or "." (so "colour", "realise", "centre", "travelled"; not "color", "realize").
2. Dropped: proper nouns, abbreviations, prefixes, suffixes, contractions, multi-word entries, archaic / uncommon / infrequent forms, special categories, anything not a–z, words shorter than 2 or longer than 20 letters.
3. Sizes (ESDB commonness): Starter ≤ 35, Steady ≤ 50, Full ≤ 60 (the vetted spell-checker size), Large ≤ 70, Very large ≤ 80 (rare words; a few US spellings slip in at this size).
4. Child-safe filter: LDNOOBW single words (minus a short allow-back list of ordinary words such as "escort", "suck", "bondage"), our own list (drugs, swear words, insults, slurs), word forms of these (plurals, -ed, -ing, …) and a few strong roots.
5. Two-letter words: only a short, child-friendly list of 36.
6. Star words: 316 — Year 1 (43) and Year 2 (61) common exception words (tools/ks1_words.json, meanings written for Wordbright; a, I, Mr, Mrs, Christmas left out because they cannot be played), plus Spellbright's 213 Year 3–6 words. All are added to every list (including "february").
7. Large and Very large lists were reviewed by pattern search; extra unsuitable words found there are in OWN_BLOCK in tools/build_lists.py.

## Letter values
value = round(1 + log2(share of "e" / share of the letter)), clamped to 1–8.
Share = how often the letter appears in the 2–7-letter words of words_full.txt (what is actually played on the board).
