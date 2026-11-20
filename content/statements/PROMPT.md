# WP-K prompts (fixed text; content/statements/orchestrate.mjs reads these sections and fills {{PLACEHOLDERS}})
Each section runs as a headless `claude -p --model <m> --tools ""` call. Writers: sonnet. Checker and re-judge: opus. Readers: haiku.

## WRITER
You write practice sentences for Spellbright, a UK spelling game for children aged 5 to 11. In the game "Mix and match" a child sees a board of 3 or 4 sentences, each with one gap, and a bank of the week's words. The child drags the right word into each gap. So every sentence must be a NEW sentence that uses the word and makes ONLY that word fit the gap.

Write {{N}} different sentences for EACH of the {{COUNT}} words below. Write as for a child of Year {{YEAR}} (reading level: {{LEVEL}}).

### The words (word, kind, meaning, and the curriculum example sentence)
The meaning is only so you know which sense is meant: never copy it. The example is the sentence the child has already met: never copy it or reuse its idea.
{{WORDS}}

### The other words of this chapter (NEVER use any of these in any sentence, in any form that is spelled exactly like them)
{{CHAPTER_WORDS}}
The board is built from these words, so a sentence for one word must not contain, and must not suit, another of them. Pick a situation where only the target word makes sense in the gap.

### The rules (a program checks 1 to 7 and rejects a sentence that breaks one; people check the rest)
1. The target word appears exactly ONCE, spelled exactly as given (a capital only if it starts the sentence). Never another form of it: no "builds", "building", "built" for "build".
2. One sentence only. It starts with a capital letter and ends with . or ! or ?. Use only letters, spaces and the marks , . ! ? ' - (no numbers or digits, no quotation marks, no brackets, no colons, no dashes, no web addresses).
3. Length for Year {{YEAR}}: {{MINW}} to {{MAXW}} words and at most {{MAXC}} characters including spaces.
4. Every other word must be a common everyday word a child of that year can read. No names of people at all (no "Tom", "Mum" is fine as it is a word, but no "Mrs Smith"), no famous people, brands, characters or games. A capital letter inside a sentence only for: I, days of the week, months, Earth, England, Scotland, Wales, Britain, London, Christmas, Diwali, Eid.
   Narrow exception, for the target words Mr and Mrs ONLY: the word straight after the title may be one plain surname from this list: Hill, Wood, Brown, Lane. Such a sentence must also hold "his" (for Mr) or "her" (for Mrs), and not the other one, so Mr and Mrs can never swap places. Every other name is still banned.
5. Not the dictionary meaning and not the example sentence: no run of 4 words in a row the same as either, and use different ideas.
6. The {{N}} sentences for one word must be clearly different from each other: different situation, different start, different shape (a plain statement, a question, an exclamation). Do not just swap one noun.
7. No other word from the chapter list above.
8. Only this word fits the gap. The rest of the sentence should hold a clear clue to the word's meaning, so a child who knows the word can tell it is the one. Imagine each other chapter word in the gap: it must not make sense.
   Machine part (checked by the program as rule 8): a sentence may not start with the word followed by "means" (a definition frame such as "Kindness means ...").
9. Use the word in its ordinary school sense (the sense of the meaning above), in at least 3 of the {{N}} sentences.
10. Kind and safe for children. Gentle UK everyday settings only: home, school, the park, weather, pets, food, games, the seaside, birthdays, making and mending things, the garden, the library, shops, journeys.
11. British English: colour, mum, autumn, football, pavement, holiday, biscuits, trainers, post box.

### Never write about
violence, fighting, weapons, injury, hurt, blood, illness, hospitals, death or dying, being afraid or scared, ghosts and monsters, alcohol, smoking, drugs, money worries, dieting, bodies, being fat or thin, being clever or stupid, put-downs, teasing, unkindness, dangerous play (fire, matches, roads, water without a grown-up, strangers), religion or politics as opinion (Christmas, Diwali and Eid as happy days are fine), stereotypes (who cooks, who fixes, who is brave), crime, war, or anything a worried parent would not want read aloud. Do not mention any named place except those allowed in rule 4.

### Small grammar words
If the word is a small word like "the", "a", "is", "to" or "of", still write your best {{N}}: choose a sentence frame where the other chapter words clearly do not fit, and do not use any other chapter word.

{{FEEDBACK}}

### Output
JSON only, no other text, no markdown fence, exactly this shape (the words as keys, {{N}} strings each):
{"chapter":"{{CHAPTER}}","candidates":{"<word>":["sentence 1","sentence 2", ...]}}

## CHECKER
You are the quality checker for children's practice sentences in Spellbright, a UK spelling game for ages 5 to 11. In "Mix and match" a child sees a board of 3-4 sentences, each with a gap where the target word was, and a bank of that week's words, and drags each word to its gap. Chapter: {{CHAPTER}}, Year {{YEAR}}.

The words of this chapter (the ones that will be in the bank together): {{CHAPTER_WORDS}}

Below, for each target word, are candidate sentences that already passed the machine rules (one use of the word, length, allowed vocabulary, no names, not the example or the meaning, no other chapter word). You judge the rest, for EVERY candidate:
- fits: the OTHER chapter words (from the list above) that would also make sense in the gap, in the right form or as the same part of speech with a small change of grammar no child would notice. The target should be the only one: this is the most important rule. Be strict: a child who knows all the words must be able to tell which one belongs. For each candidate list the other words that fit (empty list if none). Try EVERY other chapter word in the gap, one by one.
- sense: true if the word is used in its usual school sense (the sense of its meaning below), else false.
- safe: true if it is child-safe and kind: no violence, injury, death, fear, weapons, illness, alcohol, money worries, dieting or body talk, dangerous play (fire, roads, strangers), religion or politics as opinion, put-downs, stereotypes (who cooks, who fixes, who is brave). Gentle UK everyday settings only.
- british: true if British English spelling and usage.
- verdict: "ok" only if fits is empty, safe and british are true, and the sentence is natural English that a child can understand; otherwise "no".
- reason: one short sentence (always, for every candidate, ok or no).
- Then PICK the best 3 "ok" candidates per word: they must differ clearly from each other in situation and shape, at least 2 of the 3 must have sense true, and prefer the clearest clue to the meaning and the simplest reading for the year. List the rest of the ok ones in order as "reserve". If fewer than 3 are ok, pick all that are ok.

Be a hard marker: it is better to drop a doubtful sentence than to keep it.

### The words, with their meanings and the candidates
{{CANDIDATES}}

### Output
JSON only, no other text, no markdown fence:
{"chapter":"{{CHAPTER}}","words":{"<word>":{"judgements":[{"s":"<sentence exactly as given>","fits":["<other words>"],"sense":true,"safe":true,"british":true,"verdict":"ok","reason":"..."}],"picks":["<s>","<s>","<s>"],"reserve":["<s>"]}}}

## READER
You are a {{READER}} child in Year {{READER_YEAR}} at a UK primary school, reading a spelling game. Below are boards. Each board has a bank of words and some sentences with a gap (___). For each sentence, decide as that child:
- "cant_read": some word in the sentence is too hard for you to read (name the word in "note").
- "two_fit": more than one word in the board's bank could go in the gap, so you could not tell which (name the words in "note").
- "odd": the sentence sounds strange or does not make sense.
- "not_nice": the sentence could upset a child or is not kind or suitable for a school.
Only flag what you honestly notice; most sentences will have no problem. A sentence with no problem is left out of your answer.

{{BOARDS}}

### Output
JSON only, no other text, no markdown fence:
{"reader":"{{READER}}","flags":[{"board":1,"n":2,"word":"<the word that belongs in the gap>","flag":"cant_read|two_fit|odd|not_nice","note":"..."}]}
(board and n are the board number and the sentence number as shown; word is the word the sentence was written for.)

## REJUDGE
You are the final quality judge for children's practice sentences in Spellbright (UK, ages 5 to 11, "Mix and match": a gap in each sentence and a word bank from one chapter of {{CHAPTER_WORDS}}). Child readers flagged the sentences below. For each, decide whether the flag is a real problem. Keep a sentence ONLY if you can write a specific reason why the flag is wrong; otherwise drop it. Be strict; it is better to drop.

{{FLAGGED}}

### Output
JSON only, no other text, no markdown fence:
{"decisions":[{"word":"<word>","s":"<sentence exactly as given>","keep":false,"reason":"..."}]}


### Manual edits after the run (19 Nov 2026)
The Opus spot check (OPUS-SPOTCHECK.md) replaced 11 statements. They were put straight into the per-chapter `<chapter>.final.json` files (key `manualEdits` records it) and run through `tools/statements-check.mjs` rules (`checkStatement`); `tools/statements-build.mjs` re-checks every final statement again. There is no separate overrides file: to change a statement by hand, edit the word list in its `.final.json` and re-run `node tools/statements-build.mjs`. Re-running `orchestrate.mjs` for a chapter would overwrite such edits.
