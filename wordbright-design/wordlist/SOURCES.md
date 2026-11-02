# Word list sources (built 28 Oct 2026)

| Part | Source | Version | Licence |
|---|---|---|---|
| Words | English Speller Database (ESDB, formerly SCOWL), Kevin Atkinson — https://github.com/en-wl/wordlist | commit 1e5b7d3a (24 Jun 2026), file data/scowl-pre.txt | MIT-like; notice in LICENSE-ESDB.txt must be kept with any copy |
| Child-safe filter | "List of Dirty, Naughty, Obscene, and Otherwise Bad Words" (LDNOOBW), file `en` — https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words | commit 5faf2ba4 (13 Jul 2020) | CC BY 4.0 (LICENSE-LDNOOBW.txt) — credit needed on the "For parents" page |
| Meanings | WordNet 3.1 (Princeton University), then Open English WordNet for the words WordNet 3.1 has no safe meaning for — https://en-word.net/, the Open English Wordnet team | WordNet 3.1; OEWN 2025 edition (lexical items, WNDB files with the fixed index.sense, sha256 38b16326…) | WordNet licence; OEWN CC BY 4.0 (LICENSE-OEWN.txt) — credit on the "For parents" page |
| Meanings (gaps) | Wiktionary, by its contributors, through the kaikki.org English extract (wiktextract) — https://kaikki.org/dictionary/English/ | kaikki.org-dictionary-English-words.jsonl.gz, sha256 a7be58b6…, extracted by tools/wiktionary-extract.py | CC BY-SA 4.0 (LICENSE-WIKTIONARY.txt); the adapted meanings, data/meanings/wikt/, are shared under the same licence; credit on the "For parents" page and a link under each such meaning |
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
8. G7b review (2 Nov 2026): slurs and insults the filter missed (WordNet usage domains and glosses, plus our own sweep), 158 more words in OWN_BLOCK, plus 39 from the starter and steady lists decided by Ron on 2 Nov (RON_APPROVED_STARTER_STEADY); see review-2026-11-02.md. `tools/build-meanings.py --prune-lists` applies OWN_BLOCK and the WordNet check (now case-insensitive) to the lists without a full rebuild; new finds in the starter or steady lists are only reported.
9. G6b (2 Nov 2026): Open English WordNet 2025 as a second meaning source in tools/build-meanings.py, for words WordNet 3.1 has no safe meaning for, with the same child-safe filters (usage and topic domains, our blocklists, MEANING_BLOCK and the phrase check). It added 744 meanings (starter 9, steady 99, full 180, large 465, xlarge 744). No CC BY-SA source (such as Wiktionary) is used.
10. G9 adult-theme review (2 Nov 2026, also called G7c): sexual and adult words and harsh drug slang, in every list (347 words, `G9_ADULT` in tools/build_lists.py; the 139 in starter/steady also in RON_APPROVED_STARTER_STEADY, "G9, 2 Nov"); see review-2026-11-02-adult.md, which also lists the "Ron decides" groups (not applied) and what was kept and why. Star words are never blocked.
11. G9 meanings from a base word (tools/build-meanings.py, `derive`): a word with no meaning of its own gets one from its base word ("frothier" -> "More frothy. frothy: …"; -ier/-iest, -ily, -ly, -ness, -er/-est, -ed/-ing/-s, plurals, doubled consonants and a dropped e), only when the base is in our lists with a safe meaning of its own, and the whole sentence passes the same child-safe check. Such entries carry "d" (the base word).
12. G9c (2 Nov 2026): Wiktionary fills the meanings WordNet 3.1, OEWN, the base-word and phrase steps leave empty (tools/build-meanings.py, from the extract tools/wiktionary-extract.py writes). The first sense that is a real definition, not marked offensive, vulgar, a slur, derogatory, sexual or obsolete, and passing every child-safe filter, as one sentence of at most 140 characters; or, for "plural of", "form of", "alternative spelling of", the base word's (or phrase's) meaning in the derived style. Kept apart in data/meanings/wikt/ with "src": "wikt" and a "Wiktionary" credit link, CC BY-SA 4.0.

## Letter values
value = round(1 + log2(share of "e" / share of the letter)), clamped to 1–8.
Share = how often the letter appears in the 2–7-letter words of words_full.txt (what is actually played on the board).
