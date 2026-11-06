# Insult sweep, 5 Nov 2026

Mild insults that carry no "offensive" tag in WordNet or Wiktionary ("twonk: a stupid person"). Overnight 4 Nov, Ron approved sweep.

## How they were found

`MEANING_INSULT` in tools/build-meanings.py treats these as unsafe senses: a stupid, foolish, idiotic, contemptible, despicable, dim-witted, unintelligent or thick-skulled person; "a fool", "an idiot" and the like; "term of abuse"; "as an insult". Each word then falls back to its next safe sense. A word left with none has only the insult, and is blocked. Every fallback was read by eye, and a few that were still insults, or nearly, were blocked by name (below).

Applied in `INSULT_SWEEP` (tools/build_lists.py), with the starter and steady ones in `RON_APPROVED_STARTER_STEADY`. No Star word was touched. Tiles, boards and Star words are byte-identical.

## Blocked (51 words)

| Word | Smallest list | Its only meaning |
|---|---|---|
| blockhead | starter | A stupid person; these words are used to express a low opinion of some |
| blockheads | starter | A stupid person; these words are used to express a low opinion of some |
| bonehead | steady | A stupid person; these words are used to express a low opinion of some |
| boneheads | steady | A stupid person; these words are used to express a low opinion of some |
| dimwit | steady | A stupid incompetent person. |
| dimwits | steady | A stupid incompetent person. |
| doofus | large | A stupid incompetent person. |
| doofuses | large | A stupid incompetent person. |
| dufus | xlarge | Another spelling of doofus. doofus: a stupid incompetent person. |
| dummkopf | xlarge | A stupid person. |
| dummkopfs | xlarge | More than one dummkopf. dummkopf: a stupid person. |
| dunce | starter | A stupid person; these words are used to express a low opinion of some |
| dunces | starter | A stupid person; these words are used to express a low opinion of some |
| dunderhead | full | A stupid person; these words are used to express a low opinion of some |
| dunderheads | full | A stupid person; these words are used to express a low opinion of some |
| featherhead | large | A foolish person. |
| featherheads | large | More than one featherhead. featherhead: a foolish person. |
| gabies | large | More than one gaby. gaby: a stupid, foolish person. |
| gaby | large | A stupid, foolish person. |
| juggins | large | A fool. |
| jugginses | large | More than one juggins. juggins: a fool. |
| jughead | large | A fool. |
| jugheads | large | More than one jughead. jughead: a fool. |
| knucklehead | steady | A stupid person; these words are used to express a low opinion of some |
| knuckleheads | steady | A stupid person; these words are used to express a low opinion of some |
| lummox | steady | An awkward stupid person. |
| lummoxes | steady | An awkward stupid person. |
| lunkhead | full | A stupid person; these words are used to express a low opinion of some |
| lunkheads | full | A stupid person; these words are used to express a low opinion of some |
| mampara | large | A fool. |
| mompara | large | A fool. |
| muddlehead | large | A stupid person. |
| muddleheads | large | More than one muddlehead. muddlehead: a stupid person. |
| muttonhead | large | A stupid person; these words are used to express a low opinion of some |
| muttonheads | large | A stupid person; these words are used to express a low opinion of some |
| nincompoop | starter | A stupid foolish person. |
| nincompooperies | xlarge | More than one nincompoopery. nincompoopery: the beliefs and behaviours |
| nincompoopery | xlarge | The beliefs and behaviours of a nincompoop. |
| nincompoops | starter | A stupid foolish person. |
| ninnies | starter | A stupid foolish person. |
| ninny | starter | A stupid foolish person. |
| ninnyhammer | large | A foolish person. |
| ninnyhammers | large | More than one ninnyhammer. ninnyhammer: a foolish person. |
| nitwit | starter | A stupid incompetent person. |
| nitwits | starter | A stupid incompetent person. |
| oaf | starter | An awkward stupid person. |
| oafs | starter | An awkward stupid person. |
| softhead | xlarge | A fool. |
| softheads | xlarge | More than one softhead. softhead: a fool. |
| woodenhead | large | A stupid person. |
| woodenheads | large | More than one woodenhead. woodenhead: a stupid person. |

Blocked by name although a sense remained, because that sense was still an insult or nobody would mean it: blockhead (a circus act), bonehead ("thick-skulled, stupid").

**Kept by Ron:** twerp was on the 2 Nov list of words Ron kept, so it stays playable, with a gentle hand-written meaning in place of "can be bullied".

## Kept, with a non-insult sense (55 words)

| Word | Was | Now |
|---|---|---|
| befool | Make a fool or dupe of. | Fool or hoax. |
| befooled | Make a fool or dupe of. | Fool or hoax. |
| befooling | Make a fool or dupe of. | Fool or hoax. |
| befools | Make a fool or dupe of. | Fool or hoax. |
| boobie | Another spelling of booby. booby: an ignorant or foolish per | Another spelling of booby. booby: small tropical gannet having a brigh |
| boobies | An ignorant or foolish person. | Small tropical gannet having a bright bill or bright feet or both. |
| booby | An ignorant or foolish person. | Small tropical gannet having a bright bill or bright feet or both. |
| bubblehead | A stupid person. | A submariner. |
| bubbleheads | More than one bubblehead. bubblehead: a stupid person. | More than one bubblehead. bubblehead: a submariner. |
| chucklehead | A stupid or clumsy person. | A coastal rockfish of California, Sebastes chlorostictus. |
| chuckleheads | More than one chucklehead. chucklehead: a stupid or clumsy p | More than one chucklehead. chucklehead: a coastal rockfish of Californ |
| daff | A fool. | To be foolish. |
| daffed | Past tense of daff. daff: a fool. | Past tense of daff. daff: to be foolish. |
| daffs | More than one daff. daff: a fool. | More than one daff. daff: to be foolish. |
| dope | An ignorant or foolish person. | Slang terms for inside information. |
| dopes | An ignorant or foolish person. | Slang terms for inside information. |
| dork | A dull stupid fatuous person. | To act or behave in an awkward or clumsy manner. |
| dorks | A dull stupid fatuous person. | More than one dork. dork: to act or behave in an awkward or clumsy man |
| fooled | Make a fool or dupe of. | Spend frivolously and unwisely. |
| fooling | Make a fool or dupe of. | Spend frivolously and unwisely. |
| goon | An awkward stupid person. | An aggressive and violent young criminal. |
| goons | An awkward stupid person. | An aggressive and violent young criminal. |
| gull | Make a fool or dupe of. | Fool or hoax. |
| gulled | Make a fool or dupe of. | Fool or hoax. |
| gulling | Make a fool or dupe of. | Fool or hoax. |
| gulls | Make a fool or dupe of. | Fool or hoax. |
| gump | A foolish person. | Another spelling of gumption. gumption: sound practical judgment. |
| hammerhead | A stupid person; these words are used to express a low opini | The striking part of a hammer. |
| hammerheads | A stupid person; these words are used to express a low opini | The striking part of a hammer. |
| loggerhead | A stupid person; these words are used to express a low opini | Very large carnivorous sea turtle; wide-ranging in warm open seas. |
| loggerheads | A stupid person; these words are used to express a low opini | Very large carnivorous sea turtle; wide-ranging in warm open seas. |
| lout | An awkward stupid person. | A troublemaker, often violent. |
| louts | An awkward stupid person. | More than one lout. lout: a troublemaker, often violent. |
| lubber | An awkward stupid person. | An inexperienced sailor; a sailor on the first voyage. |
| lubbers | An awkward stupid person. | An inexperienced sailor; a sailor on the first voyage. |
| meathead | An ungainly, dull, or stupid person. | A member of the Canadian Forces Military Police. |
| meatheads | More than one meathead. meathead: an ungainly, dull, or stup | More than one meathead. meathead: a member of the Canadian Forces Mili |
| mome | A dull or stupid person. | A female pope. |
| momes | More than one mome. mome: a dull or stupid person. | More than one mome. mome: a female pope. |
| noddies | More than one noddy. noddy: a silly or stupid person. | More than one noddy. noddy: in full knave noddy: the jack or knave pla |
| noddy | A silly or stupid person. | In full knave noddy: the jack or knave playing card. |
| pinhead | An ignorant or foolish person. | The head of a pin. |
| pinheads | An ignorant or foolish person. | The head of a pin. |
| poop | A stupid foolish person. | Slang terms for inside information. |
| poops | A stupid foolish person. | Slang terms for inside information. |
| schlemiel | (Yiddish) a dolt who is a habitual bungler. | A person who is clumsy or who hurts others emotionally. |
| schlemiels | (Yiddish) a dolt who is a habitual bungler. | More than one schlemiel. schlemiel: a person who is clumsy or who hurt |
| schlemihl | Another spelling of schlemiel. schlemiel: (Yiddish) a dolt w | Another spelling of schlemiel. schlemiel: a person who is clumsy or wh |
| schlep | (Yiddish) an awkward and stupid person. | A tedious or difficult journey. |
| schlepper | (Yiddish) an awkward and stupid person. | A servant who carries things. |
| schleppers | (Yiddish) an awkward and stupid person. | More than one schlepper. schlepper: a servant who carries things. |
| schleps | (Yiddish) an awkward and stupid person. | A tedious or difficult journey. |
| shlemiehl | Another spelling of schlemiel. schlemiel: (Yiddish) a dolt w | Another spelling of schlemiel. schlemiel: a person who is clumsy or wh |
| shlepper | (Yiddish) an awkward and stupid person. | Another spelling of schlepper. schlepper: a servant who carries things |
| twonk | A stupid person. | Nonsense. |

Worth a look: a few fallbacks are accurate but unusual (meathead, mome, chucklehead). They are not insults, so they stay.
