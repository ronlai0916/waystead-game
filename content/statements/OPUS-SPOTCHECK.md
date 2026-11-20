# Opus spot check of the Spellbright sentence bank

Bank **2026-11-18.1** (`site/data/statements.json`: 600 words, 1798 statements). Checked on 19 November 2026 by Claude Opus as the independent human-style spot-checker, standing in for Ron. Rules checked against `content/statements/PROMPT.md` (writer rules 1-11 and the "never write about" list) and `site/js/statement-rules.js`. For each statement the other words of the same chapter (from `site/data/curriculum.json`) were tried in the gap.

Each statement was judged on five tests: natural, correct British English; safe and suitable for the year; ONE obvious answer among the chapter words; right difficulty for the year; does not give the answer away (the word itself, the dictionary meaning or example, or a rhyme).

Verdicts: **OK** = ship as is. **FIX** = replace with a better sentence for the same word. **REMOVE** = the sentence should not be in the game in any form.

## Summary

| Part | Checked | OK | FIX | REMOVE | Flagged |
|---|---|---|---|---|---|
| 1. Ron's 30 spot-check samples | 30 | 29 | 1 | 0 | 3.3% |
| 2. Mr and Mrs (all 6 statements) | 6 | 0 | 3 | 3 | 100% |
| 2. Other "talks about the word" statements (whole-bank scan: 61 hits read; the 2 Mr/Mrs hits and prejudice are counted in other rows) | 58 | 57 | 1 | 0 | 1.7% |
| 3. 60 further random statements, seed 20261119 | 60 | 59 | 1 | 0 | 1.7% |
| Random samples only (parts 1 + 3) | 90 | 88 | 2 | 0 | **2.2%** |
| Found in passing (outside the samples) | 2 | 0 | 2 | 0 | - |

Known flagged statements across everything read: **11** (3 REMOVE, 8 FIX) out of about 160 read, plus 2 bank-level gaps (missing and short words, below).

## Overall verdict

**Not fit to ship exactly as it stands, but close: fit to ship once the 11 items below are replaced.**

- The random flag rate is **2 in 90 (2.2%)**, right on the 2% target. With only 90 samples this cannot be told apart from 2% (the true rate could be anywhere from about 0.3% to 8%), so it is a pass on the evidence, not a margin. Both random flags are wording problems (stilted English), not safety problems. I found **no safety problems at all**: no violence, fear, adult themes, brands, real people or religion/politics as opinion in anything I read.
- The blocker is **Mr and Mrs**. All 6 of their statements talk about the word ("Mrs has three little letters in a row", "so write Mr") instead of using it. This is a design gap, not a writer slip: rule 4 bans all names, and Mr/Mrs cannot be used naturally without one. Every board for chapter y2-ch10 can show these, so a child would meet them often. Fix the rule (below) and rewrite them before shipping.
- The "X means ..." definition frame got through twice (prejudice, kindness). It restates the meaning instead of using the word. Worth adding a machine check: reject a statement that starts with the target word followed by "means".
- One-answer quality is good. In every statement I read the target was the clear best fit; the few where another chapter word is grammatical (home/there, remarkably/reasonably, brought/bought, noisily/quickly) are ruled out by the rest of the sentence.

### Bank-level gaps (not sentence quality, but worth knowing before ship)

- **8 curriculum words have no statements**: Saturday, beautiful, camel, should, forward, forwards, government, horrible. Check the game copes (leaves them out of Mix and match boards) rather than showing an empty gap.
- **2 words have only 2 statements instead of 3**: says, terrible. Both of those are also flagged below.

## Suggested rule change for Mr and Mrs

Add a narrow exception to rule 4: for the words **Mr** and **Mrs** only, the sentence must use the title with one surname from a fixed list of plain common words (for example Hill, Wood, Brown, Lane), and must include **his** or **her** so that Mr and Mrs (same chapter, y2-ch10) cannot both fit. The machine check would then allow those surnames after Mr/Mrs only. The alternative is to leave Mr and Mrs out of Mix and match altogether.

## The REMOVE and FIX list, with suggested replacements

Replacements were checked by hand against the length band for the year, the chapter's other words (none used, none fits the gap), and the safety list. Run them through `statements-check` before adding them.

| # | Word | Year | Current sentence | Verdict | Problem | Suggested replacement |
|---|---|---|---|---|---|---|
| 1 | Mrs | 2 | Mrs has three little letters in a row. | REMOVE | Talks about the word's letters, does not use it; "in a row" makes no sense. | Mrs Hill read us her favourite story. (needs the rule change) |
| 2 | Mrs | 2 | Does the married woman at the gate use Mrs? | REMOVE | Talks about the word; odd focus on whether a woman is married. | Mrs Wood watered her roses in the garden. (needs the rule change) |
| 3 | Mr | 2 | The bus driver is a man, so write Mr. | REMOVE | Talks about the word; reads like an instruction; "bus driver is a man" leans on a job stereotype. | We said hello to Mr Hill and his dog. (needs the rule change) |
| 4 | Mrs | 2 | The wedding card for my aunt says Mrs on it. | FIX | Mentions the word on a card rather than using it as a title. | Mrs Brown and her baby waved from the bus. (needs the rule change) |
| 5 | Mr | 2 | Is Mr the right title for my uncle? | FIX | Asks about the word instead of using it. | Mr Wood put on his coat and hat. (needs the rule change) |
| 6 | Mr | 2 | Does the kind man's badge say Mr? | FIX | Mentions the word on a badge; odd sentence. | Mr Lane fixed the gate with his new tools. (needs the rule change) |
| 7 | prejudice | 6 | Prejudice means judging a new neighbour unfairly without meeting them. | FIX | Definition frame; restates the dictionary meaning ("an unfair feeling against someone before you know them"). In Ron's 30 samples. | Our class talked about how prejudice can stop us making new friends. |
| 8 | kindness | 2 | Kindness means helping a friend pick up dropped crayons. | FIX | Definition frame ("X means ..."), talks about the word. | Your kindness when I dropped my crayons made me smile. |
| 9 | frequency | 6 | Birthdays have a frequency of just once a year! | FIX | Unnatural English; a forced use of the word. Random sample. | We made a chart of the frequency of rainy days in May. |
| 10 | terrible | 6 | Little ones often go through the terrible twos and shout a lot. | FIX | An adult idiom about toddlers' tantrums; not a sense a child uses. Also only 2 statements for this word. Found in passing. Note that horrible (same chapter) fits almost any "terrible" gap, so the replacement uses a set phrase. | I am terrible at catching, but I am good at kicking! |
| 11 | says | 1 | Right now my brother says hello to the cat. | FIX | Starts the same way as the word's other statement ("Right now, the little parrot says hello!"), against rule 6; only 2 statements for this word. Found in passing. | My teacher says we can paint today. (and add a third) |

Optional, not counted: "In our country, we say autumn, not fall." (country, Year 3) is fine as a gap but asks a child to know the American word "fall". Keep or swap at your choice.

## Part 1: the 30 samples in spotcheck.html

All 30 are in the bank exactly as shown in the HTML.

| # | Word | Year | Sentence | Verdict | Reason |
|---|---|---|---|---|---|
| 1 | noisily | 3 | Why is the washing machine rattling so noisily today? | OK | "quickly" is a weak alternative, but "rattling" points clearly to noisily. |
| 2 | so | 1 | It was raining, so we stayed in. | OK | Natural, safe, one clear answer, right level. |
| 3 | because | 2 | The grass is wet because it rained last night. | OK | Natural, safe, one clear answer, right level. |
| 4 | child | 2 | The teacher asked a child to give out the pencils. | OK | Natural, safe, one clear answer, right level. |
| 5 | responsible | 6 | My dad let me be responsible for walking the dog to the park. | OK | Natural, safe, one clear answer, right level. |
| 6 | mind | 2 | A good idea came into my mind. | OK | Natural, safe, one clear answer, right level. |
| 7 | visible | 6 | The tiny star was only visible through the telescope. | OK | Natural, safe, one clear answer, right level. |
| 8 | appreciate | 5 | We say thank you because we appreciate the cake you baked. | OK | Natural, safe, one clear answer, right level. |
| 9 | sure | 2 | Dad felt sure the shop was open on Sunday. | OK | Natural, safe, one clear answer, right level. |
| 10 | prejudice | 6 | Prejudice means judging a new neighbour unfairly without meeting them. | FIX | A definition frame ("Prejudice means ...") that talks about the word instead of using it; restates the dictionary meaning. |
| 11 | basically | 3 | The two paintings are basically the same, but one has more blue. | OK | Natural, safe, one clear answer, right level. |
| 12 | mind | 2 | I changed my mind and chose the red kite. | OK | Natural, safe, one clear answer, right level. |
| 13 | immediate | 6 | The immediate task was to put the wet washing inside before the rain. | OK | Slightly formal for a child but correct; no other chapter word fits. |
| 14 | appear | 3 | Watch the rabbit appear from the magician's hat! | OK | Natural, safe, one clear answer, right level. |
| 15 | class | 2 | Which class are you in this year? | OK | Natural, safe, one clear answer, right level. |
| 16 | bridge | 2 | We stood on the bridge and watched the river. | OK | Natural, safe, one clear answer, right level. |
| 17 | wheel | 1 | The toy car lost a wheel. | OK | Natural, safe, one clear answer, right level. |
| 18 | house | 1 | I drew a house with four windows. | OK | Natural, safe, one clear answer, right level. |
| 19 | kitten | 1 | The kitten chased the ball of wool. | OK | Natural, safe, one clear answer, right level. |
| 20 | familiar | 6 | Everything in my gran's house feels warm and familiar. | OK | Natural, safe, one clear answer, right level. |
| 21 | consider | 4 | Please consider which colour to paint the shed. | OK | "describe which colour" does not work; consider is the only fit. |
| 22 | sufficient | 5 | Do we have sufficient chairs for everyone at the party? | OK | Natural, safe, one clear answer, right level. |
| 23 | height | 4 | Wow, look at the height of that tall tree! | OK | Natural, safe, one clear answer, right level. |
| 24 | soil | 1 | The worm wriggled through the wet soil. | OK | Natural, safe, one clear answer, right level. |
| 25 | disappear | 4 | The footprints on the beach disappear when the tide comes in. | OK | Natural, safe, one clear answer, right level. |
| 26 | column | 6 | A thick stone column held up the roof of the museum. | OK | Natural, safe, one clear answer, right level. |
| 27 | ambitious | 5 | It was an ambitious plan to build a huge tree house in one day. | OK | Natural, safe, one clear answer, right level. |
| 28 | peculiar | 4 | That cloud has a peculiar shape, like a giant teapot. | OK | Natural, safe, one clear answer, right level. |
| 29 | frequency | 6 | The bus runs with a frequency of one every ten minutes. | OK | Stilted ("runs with a frequency of") but correct for Year 6; borderline. |
| 30 | lotion | 2 | Dry hands feel soft after some hand lotion. | OK | "hand potion" does not fit; slightly loose grammar but natural enough. |
## Part 2: Mr, Mrs and other statements that talk about the word

**Method.** A script scanned all 1798 statements for words that signal talk about words or spelling (letter, spell, word, means, meaning, rhyme, sounds like, capital, short for, stands for, write/written, pronounce, syllable, vowel, alphabet, dictionary, silent, plural, opposite, another word) and for frames such as "say/write/use/called/the word + target" and "target + is a/means/has". That gave 61 hits plus the 6 Mr/Mrs statements; I read every one.

**Mr and Mrs (chapter y2-ch10: door floor poor Mr Mrs parents Christmas small walk always).** All six fail; see the REMOVE/FIX list.

| Word | Year | Sentence | Verdict | Reason |
|---|---|---|---|---|
| Mr | 2 | Is Mr the right title for my uncle? | FIX | Asks about the word instead of using it. |
| Mr | 2 | The bus driver is a man, so write Mr. | REMOVE | Talks about writing the word; job stereotype; odd. |
| Mr | 2 | Does the kind man's badge say Mr? | FIX | Mentions the word on a badge; odd. |
| Mrs | 2 | Does the married woman at the gate use Mrs? | REMOVE | Talks about the word; focus on marital status. |
| Mrs | 2 | The wedding card for my aunt says Mrs on it. | FIX | Mentions the word rather than using it. |
| Mrs | 2 | Mrs has three little letters in a row. | REMOVE | Pure talk about the letters; makes no sense. |

**Other hits.** Two more failed: "Prejudice means ..." (counted in Part 1) and "Kindness means ...". The rest use the word properly in a sentence that happens to be about school, letters or reading. They are OK:

- Fine uses of the word in its ordinary sense: correspond (writing letters), dictionary (all 3), misspell (all 3), pronunciation (all 3, though two say "this word" with nothing to point to; acceptable in a spelling game), rhyme (all 3, "Moon and spoon make a perfect rhyme!" is a fair example, not a rhyme clue for the target), opposite (all 3), sentence, signature, symbol, reference, revision, rewrite, grammar, secretary, silent, describe, chorus, category, invitation, programme, sincerely, deceit (2), conscious, awkward, average, autumn, by, elegant, excellent, experiment, fantastically, foreign, important, improve, pencil (2), potion, put, thorough, urgent.
- "When the teacher says my name, I say here!" (here) and "The sign on the door says pull, not push." (pull) mention the word, but that is how the words are really used; OK.
- woman (Year 3): all three are near-definitions ("A girl grows into a woman ..."). Natural and child-friendly, and women in the same chapter does not fit any of them. OK, but a writer could vary them.

## Part 3: 60 more random statements

**Method.** Seed **20261119** with Python's `random.Random`. For each year 1 to 6, pooled every statement whose word belongs to that year (excluding the 30 spot-check sentences and Mr/Mrs) and drew 10 without replacement with `rng.sample`, in year order 1, 2, 3, 4, 5, 6. Words were sorted alphabetically before pooling, so the draw is reproducible.

| # | Word | Year | Sentence | Verdict | Reason |
|---|---|---|---|---|---|
| 1 | trunk | 1 | I hid behind the trunk of a big tree. | OK | Natural, safe, one clear answer, right level. |
| 2 | Wednesday | 1 | Wednesday is halfway through the school week. | OK | Close to a definition, but natural and only Wednesday fits. |
| 3 | home | 1 | It is late, so let's walk home. | OK | "walk there/here" are grammatical but "It is late" makes home the clear answer. |
| 4 | bank | 1 | Dad asked the lady at the bank for coins. | OK | Natural, safe, one clear answer, right level. |
| 5 | kiss | 1 | Please give baby one gentle kiss. | OK | Natural, safe, one clear answer, right level. |
| 6 | there | 1 | The moon is far, so we cannot walk there. | OK | Natural, safe, one clear answer, right level. |
| 7 | puff | 1 | Our train let out one puff of steam. | OK | Natural, safe, one clear answer, right level. |
| 8 | by | 1 | Who is the book written by? | OK | Natural, safe, one clear answer, right level. |
| 9 | love | 1 | Dogs love their owners and wag their tails. | OK | Natural, safe, one clear answer, right level. |
| 10 | buzz | 1 | Can you hear that bee buzz? | OK | Natural, safe, one clear answer, right level. |
| 11 | every | 2 | Every child in the class got a sticker. | OK | Natural, safe, one clear answer, right level. |
| 12 | hour | 2 | Our reading time lasts a whole hour. | OK | Natural, safe, one clear answer, right level. |
| 13 | animal | 2 | A hedgehog is a small animal in our garden. | OK | Natural, safe, one clear answer, right level. |
| 14 | told | 2 | Who told you the shop was shut? | OK | Natural, safe, one clear answer, right level. |
| 15 | who | 2 | Who left the muddy trainers by the door? | OK | Natural, safe, one clear answer, right level. |
| 16 | mind | 2 | Close your eyes and let your mind rest. | OK | Natural, safe, one clear answer, right level. |
| 17 | kind | 2 | Thank you for being so kind to me. | OK | Natural, safe, one clear answer, right level. |
| 18 | fence | 2 | The dog cannot get out past the garden fence. | OK | Natural, safe, one clear answer, right level. |
| 19 | baking | 2 | Baking a cake needs flour, eggs and sugar. | OK | Natural, safe, one clear answer, right level. |
| 20 | after | 2 | Tuesday comes straight after Monday each week. | OK | Natural, safe, one clear answer, right level. |
| 21 | group | 3 | A group of ducks swam across the pond. | OK | Natural, safe, one clear answer, right level. |
| 22 | grammar | 3 | Learning grammar helps me to put words in the right order! | OK | Natural, safe, one clear answer, right level. |
| 23 | special | 3 | Only a special key, not the usual ones, opens this box. | OK | Clunky ("not the usual ones") but "regular" is excluded by it; special is the only fit. |
| 24 | caught | 3 | The puppy jumped up and caught the stick in its mouth. | OK | Natural, safe, one clear answer, right level. |
| 25 | earth | 3 | The worms wriggled through the damp earth in the garden. | OK | Natural, safe, one clear answer, right level. |
| 26 | library | 3 | Shh, you must whisper when you are in the library! | OK | Natural, safe, one clear answer, right level. |
| 27 | often | 3 | My cat often sleeps on the warm windowsill. | OK | Natural, safe, one clear answer, right level. |
| 28 | actual | 3 | Is this the actual shell you found at the seaside? | OK | Natural, safe, one clear answer, right level. |
| 29 | build | 3 | Can we build a tall tower from these wooden blocks? | OK | Natural, safe, one clear answer, right level. |
| 30 | dislike | 3 | Do you dislike loud noises like the vacuum cleaner? | OK | Natural, safe, one clear answer, right level. |
| 31 | surprise | 4 | Do not tell her, because the trip is a surprise! | OK | Natural, safe, one clear answer, right level. |
| 32 | irresponsible | 4 | Leaving the tap running all day is irresponsible. | OK | "illogical" is a weak alternative; irresponsible is clearly best. |
| 33 | February | 4 | Hooray, half term is in February, so we can sleep in! | OK | Natural, safe, one clear answer, right level. |
| 34 | favourite | 4 | The shop has my favourite flavour of ice cream! | OK | Natural, safe, one clear answer, right level. |
| 35 | tongue | 4 | Which animal has a long tongue for catching flies? | OK | Natural, safe, one clear answer, right level. |
| 36 | impolite | 4 | I forgot to say please, which was impolite of me. | OK | Natural, safe, one clear answer, right level. |
| 37 | conclusion | 4 | At the conclusion of the film, everyone clapped. | OK | Natural, safe, one clear answer, right level. |
| 38 | position | 4 | She moved the lamp to a better position by the window. | OK | Natural, safe, one clear answer, right level. |
| 39 | possession | 4 | Her kite is a treasured possession that she keeps in a box. | OK | Natural, safe, one clear answer, right level. |
| 40 | future | 4 | Tomorrow and next week are both part of the future. | OK | Definition-like but a natural sentence; no other chapter word fits. |
| 41 | symbol | 5 | What does this symbol on the washing label mean? | OK | Natural, safe, one clear answer, right level. |
| 42 | interrupt | 5 | Please wait your turn and do not interrupt your friend's story. | OK | Natural, safe, one clear answer, right level. |
| 43 | apparent | 5 | The crack in the old mug was apparent as soon as I lifted it. | OK | Natural, safe, one clear answer, right level. |
| 44 | existence | 5 | Our teacher showed us a photo that proved the badger's existence. | OK | Natural, safe, one clear answer, right level. |
| 45 | nutritious | 5 | Is a school lunch with salad and fish nutritious enough to keep you healthy? | OK | Natural, safe, one clear answer, right level. |
| 46 | aggressive | 5 | My cat can look aggressive when she hisses and puffs up her fur. | OK | Natural, safe, one clear answer, right level. |
| 47 | bruise | 5 | The peach had a soft bruise where it fell from the basket. | OK | Natural, safe, one clear answer, right level. |
| 48 | comfortable | 5 | I put a cushion behind my back to feel more comfortable. | OK | Natural, safe, one clear answer, right level. |
| 49 | remarkably | 5 | After the party, the kitchen was remarkably spotless, with not one crumb left. | OK | "reasonably spotless" is grammatical but "not one crumb left" points to remarkably. |
| 50 | embarrass | 5 | Getting a loud round of applause may embarrass a shy child. | OK | Natural, safe, one clear answer, right level. |
| 51 | receiver | 6 | Gran held the receiver to her ear to hear the voice. | OK | Natural, safe, one clear answer, right level. |
| 52 | receive | 6 | What present would you like to receive on your birthday? | OK | Natural, safe, one clear answer, right level. |
| 53 | brought | 6 | My gran came by train and brought her knitting with her. | OK | "bought" fits grammatically, but "came by train ... with her" makes brought the answer; a fair spelling trap. |
| 54 | silent | 6 | Why is the classroom so silent today? | OK | Natural, safe, one clear answer, right level. |
| 55 | whistle | 6 | I got a shiny silver whistle in my party bag. | OK | Natural, safe, one clear answer, right level. |
| 56 | immediate | 6 | Her immediate thought on seeing the cake was to taste it right away. | OK | Natural, safe, one clear answer, right level. |
| 57 | column | 6 | The ants walked in a long column across the path. | OK | Natural, safe, one clear answer, right level. |
| 58 | frequency | 6 | Birthdays have a frequency of just once a year! | FIX | Unnatural English: nobody says birthdays "have a frequency of" once a year; reads as a forced use. |
| 59 | disastrous | 6 | Our picnic was disastrous because the rain ruined every single sandwich. | OK | Natural, safe, one clear answer, right level. |
| 60 | silent | 6 | Please stay silent while the others finish the test. | OK | Natural, safe, one clear answer, right level. |

## Notes on the method

- "Another chapter word fits" was tested by trying every other word of the same chapter in the gap, allowing the small grammar changes a child would not notice, as the CHECKER prompt asks.
- I did not change `statements.json` or any other file; this report is the only output.
- Things a reader cannot see from the sentences alone, such as how the game builds a board from 3 or 4 words, were not tested. If a board never puts two near-synonyms together (terrible/horrible, noisily/quickly), some borderline cases matter even less.
