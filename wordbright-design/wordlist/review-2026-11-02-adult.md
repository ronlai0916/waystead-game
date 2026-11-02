# Adult-theme word review (G9 / G7c), 2 Nov 2026

Not slurs this time (see review-2026-11-02.md): words unsuitable for children. Every list, starter to xlarge.

## How the candidates were found

- WordNet 3.1 (and Open English WordNet where WordNet has nothing): every word whose senses sit in the sex, sexual activity, pornography, prostitution or erotica domains, the drug-of-abuse domains, or the obscenity/vulgarism usage domains, or whose definitions are about sexual acts, desire, sexual anatomy, prostitution, fetishes, harsh drugs or gory violence.
- Our own sweep of the word lists for the same themes by word shape (sexual acts, body parts, fetishes, adultery, pornography, prostitution, drug slang, gory violence), so words neither wordnet knows are caught too, with all their forms.
- Known examples from the G6b report: lecherously, cuckold.

Rules: clearly sexual or adult → **Blocked**, even in starter/steady (never a Star word: none were hit). Neutral medical or biology words → **Kept**. Unsure → **Ron decides**, with a recommendation; Ron decided on 2 Nov (marked "Ron, 2 Nov").

Applied: 347 words in OWN_BLOCK (`G9_ADULT` in tools/build_lists.py); the 139 in starter/steady are also in RON_APPROVED_STARTER_STEADY ("G9, 2 Nov") so `--prune-lists` removes them there. Ron, 2 Nov: 72 more from his decisions (`G9_RON_BLOCK`, also in G9_ADULT; 21 of them in starter/steady, dated "G9, Ron 2 Nov").

By the smallest list each word was in: starter 27, steady 112, full 57, large 95, xlarge 56.

## Blocked (419 words: 347, then 72 by Ron, 2 Nov)

| Theme | Words | Reason |
|---|---|---|
| adultery | adulterer, adulterers, adulteress, adulteresses, adulteries, adulterine, adulterous, adulterously, adultery, extramarital | Clearly sexual or adult |
| bawdy / lewd / lecherous | bawd, bawdier, bawdies, bawdiest, bawdily, bawdiness, bawdries, bawdry, bawds, bawdy, lech, lecher, lecherous, lecherously, lecherousness, lechers, lechery, leches, letch, letches, lewd, lewder, lewdest, lewdly, lewdness | Clearly sexual or adult |
| lustful / lascivious / licentious / salacious / prurient | carnality, carnally, concupiscence, lascivious, lasciviously, lasciviousness, libidinal, libidinally, libidinous, libidinously, libidinousness, libidinousnesses, libido, libidos, licentious, licentiously, licentiousness, lustful, lustfully, lustfulness, lustfulnesses, prurience, pruriencies, pruriency, prurient, salacious, salaciously, salaciousness, salacity | Clearly sexual or adult |
| fornication | fornicate, fornicated, fornicates, fornicating, fornication, fornicator, fornicators | Clearly sexual or adult |
| cuckold | cuckold, cuckolded, cuckolding, cuckoldry, cuckolds | Clearly sexual or adult |
| orgy | orgastic, orgastically, orgiast, orgiastic, orgiastically, orgiasts, orgies | Clearly sexual or adult |
| molestation / sexual assault | molest, molestation, molested, molester, molesters, molesting, molests, raper, rapers, ravisher, ravishers | Clearly sexual or adult |
| incest, paedophilia | catamite, catamites, incestuous, incestuously, incestuousness, nymphet, nymphets, paederasty, pederast, pederasts, pederasty | Clearly sexual or adult |
| necrophilia, other paraphilias | algolagnia, algolagnias, frotteur, frotteurs, necrophile, necrophiles, necrophilia, necrophiliac, necrophiliacs, necrophilic, necrophilism, necrophilisms, necrophilist, onanism, onanisms, onanist, onanists, paraphilia, paraphilias, satyriasis, voyeurism, voyeuristic, voyeuristically, zoophilism, zoophilisms | Clearly sexual or adult |
| erotic / erotica | erogenous, erotica, erotical, erotically, eroticisation, eroticise, eroticised, eroticises, eroticising, eroticism, eroticist, eroticists, erotization, erotizations, erotize, erotized, erotizes, erotizing, erotogenic, erotomania, erotomaniac, erotomaniacs, erotomanias | Clearly sexual or adult |
| aphrodisiac | anaphrodisia, anaphrodisiac, anaphrodisias, aphrodisia, aphrodisiac, aphrodisiacal, aphrodisiacs | Clearly sexual or adult |
| nymphomania | hypersexual, hypersexualities, hypersexuality, nymphomaniac, nymphomaniacal, nymphomaniacs, oversexed, supersexualities, supersexuality, undersexed | Clearly sexual or adult |
| sexy / sexual words | antisex, antisexual, antisexualities, antisexuality, coital, coition, coitions, coitus, copulate, copulated, copulates, copulating, copulation, copulatory, cybersex, desexualisation, desexualisations, desexualise, desexualised, desexualises, desexualising, foreplay, outercourse, psychosexual, psychosexualities, psychosexuality, psychosexually, sexier, sexiest, sexily, sexiness, sexological, sexologist, sexologists, sexology, sexpot, sexpots, sexualisation, sexualisations, sexualise, sexualised, sexualises, sexualising, sociosexual, unsexy | Clearly sexual or adult |
| prostitution | bagnio, bagnios, bordello, bordellos, cathouse, cathouses, cocotte, cocottes, concubinage, concubinary, concubine, concubines, courtesan, courtesans, demimondaine, demimondaines, demimonde, ecdysiast, ecdysiasts, gigolo, gigolos, magdalen, magdalens, paramour, paramours, prostitutor, prostitutors, streetwalker, streetwalkers | Clearly sexual or adult |
| striptease / lap dancing | crotchless, lapdance, lapdancer, lapdancers, lapdances, lapdancing, striptease, stripteased, stripteaser, stripteasers, stripteases | Clearly sexual or adult |
| womanising | lothario, lotharios, philander, philandered, philanderer, philanderers, philandering, philanders, womanise, womanised, womaniser, womanisers, womanises, womanising | Clearly sexual or adult |
| fetishism, sadomasochism | fetishise, fetishised, fetishises, fetishising, fetishism, fetishist, fetishistic, fetishistically, fetishists, sadomasochism, sadomasochist, sadomasochistic, sadomasochists | Clearly sexual or adult |
| phallic | phalli, phallic, phallically, phallicism, phallicisms, phallicist, phallicists, phallism, phallisms, phallist, phallists, phallocentric, phallocentrism, phallus, priapic | Clearly sexual or adult |
| raunchy / randy / smutty / horny | hornier, horniest, horniness, horninesses, kinkier, kinkiest, randier, randiest, raunch, raunches, raunchier, raunchiest, raunchily, raunchiness, raunchy, smuttily, smuttiness | Clearly sexual or adult |
| slang for sex or genitals | cums, eff, effed, effing, effs, pussies | Clearly sexual or adult |
| drugs: users and street names | bennies, crackhead, crackheads, dopehead, dopeheads, druggie, druggier, druggies, druggiest, ganja, hashish, heroinism, heroinisms, junkie, junkies, junky, kief, kiefs, meth, methamphetamine, pothead, potheads, scag, scags, shroom, toke, tokes | Harsh drug slang and drug users; medical drug names are kept |

| Sexual anatomy (correct names) (Ron, 2 Nov) | clitoral, clitoric, genital, genitalia, genitalic, genitally, scrota, scrotal, scrotum, testicle, testicles, testicular, vaginae, vaginal, vaginally, vaginate, vaginated, vulvae, vulval, vulvar, vulvate, vulviform | Ron, 2 Nov: blocked (was "Ron decides" #1; recommended Block) |
| Medical words naming sexual anatomy (Ron, 2 Nov) | clitorectomies, clitorectomy, clitoridectomies, clitoridectomy, colpitis, colpitises, colposcope, colposcopes, episiotomies, episiotomy, orchidectomies, orchidectomy, orchiectomies, orchiectomy, vaginectomies, vaginectomy, vaginismus, vaginismuses, vaginitis, vulvitis, vulvitises, vulvovaginitides, vulvovaginitis | Ron, 2 Nov: blocked (was "Ron decides" #2; recommended Block) |
| Seducer, seductress (Ron, 2 Nov) | seducement, seducements, seducer, seducers, seducible, seductress, seductresses | Ron, 2 Nov: blocked (was "Ron decides" #5; recommended Block) |
| Fetish (Ron, 2 Nov) | fetish, fetishes | Ron, 2 Nov: blocked (was "Ron decides" #7; recommended Block) |
| Douche (Ron, 2 Nov) | douche, douches | Ron, 2 Nov: blocked (was "Ron decides" #13; recommended Block) |
| Succubus (Ron, 2 Nov) | succuba, succubas, succubi, succubus | Ron, 2 Nov: blocked (was "Ron decides" #14; recommended Block) |
| Suicide (Ron, 2 Nov) | suicidal, suicidally, suicide, suicided, suicides, suiciding, suicidologies, suicidology | Ron, 2 Nov: blocked (was "Ron decides" #18; recommended Keep) |
| Dated racial terms (not adult; G7b follow-up) (Ron, 2 Nov) | blackamoor, blackamoors, paleface, palefaces | Ron, 2 Nov: blocked (was "Ron decides" #20; recommended Block) |

## Ron decides — decided by Ron, 2 Nov (8 groups blocked, 12 kept; nothing left open)

| # | Group | Words | Recommendation | Why | Ron, 2 Nov |
|---|---|---|---|---|---|
| 1 | Sexual anatomy (correct names) | clitoral, clitoric, genital, genitalia, genitalic, genitally, scrota, scrotal, scrotum, testicle, testicles, testicular, vaginae, vaginal, vaginally, vaginate, vaginated, vulvae, vulval, vulvar, vulvate, vulviform | **Block** | "penis", "vagina", "vulva" and "clitoris" are already blocked upstream (LDNOOBW); these forms are what slipped past. Blocking keeps it consistent. Keep if you want correct anatomical names playable (they are taught in primary RSE). | **Blocked** |
| 2 | Medical words naming sexual anatomy | clitorectomies, clitorectomy, clitoridectomies, clitoridectomy, colpitis, colpitises, colposcope, colposcopes, episiotomies, episiotomy, orchidectomies, orchidectomy, orchiectomies, orchiectomy, vaginectomies, vaginectomy, vaginismus, vaginismuses, vaginitis, vulvitis, vulvitises, vulvovaginitides, vulvovaginitis | **Block** | Large/xlarge medical jargon; every meaning shown names sexual anatomy. Nothing a child would miss. | **Blocked** |
| 3 | Contraception | contraception, contraceptive, contraceptives, spermatocidal, spermatocide, spermatocides, spermicidal, spermicide, spermicides | **Keep** | Health words, not sexual content; but "condom" is already blocked, so you may prefer Block for consistency. | **Kept** |
| 4 | Seduce, seductive | seduce, seduced, seduces, seducing, seduction, seductions, seductive, seductively, seductiveness | **Keep** | Common figurative use ("seduced by the smell of baking"); block only the person nouns (below). | **Kept** |
| 5 | Seducer, seductress | seducement, seducements, seducer, seducers, seducible, seductress, seductresses | **Block** | Person words whose main meaning is sexual. | **Blocked** |
| 6 | Lust, lusty | lust, lustier, lustiest, lustily, lusts, lusty | **Keep** | Figurative use is common ("lust for power", wanderlust); "lustful" and friends are blocked. | **Kept** |
| 7 | Fetish | fetish, fetishes | **Block** | WordNet's first meaning is sexual; the religious-object sense is rare for children. | **Blocked** |
| 8 | Masochism, sadism | masochism, masochist, masochistic, masochists, sadist, sadistic, sadistically, sadists | **Keep** | Usually means cruelty or "glutton for punishment"; sadomasochism is blocked. | **Kept** |
| 9 | Transvestite | transvestite, transvestites, transvestitism | **Keep** | About clothing and identity, not sexual content; WordNet's wording is dated. | **Kept** |
| 10 | Nudist, naturist | naturist, naturists, nudism, nudist, nudists | **Keep** | A non-sexual lifestyle word. | **Kept** |
| 11 | Stripper | stripper, strippers | **Keep** | Paint and wallpaper stripper are common; meaning shown should be the tool. | **Kept** |
| 12 | Snog | snog, snogged, snogging, snogs | **Keep** | Mild British word for kissing. | **Kept** |
| 13 | Douche | douche, douches | **Block** | Intimate-hygiene word and a slang insult; nothing lost. | **Blocked** |
| 14 | Succubus | succuba, succubas, succubi, succubus | **Block** | Defined as a demon having sex with sleepers; incubus (also "a burden") kept. | **Blocked** |
| 15 | Frottage | frottage, frottages | **Keep** | An art technique (rubbings) taught in primary art; the sexual sense is hidden from meanings by the filter. | **Kept** |
| 16 | Amour | amour, amours | **Keep** | Mild ("a love affair"). | **Kept** |
| 17 | Gory violence | disembowel, disembowelled, disembowelling, disembowelment, disembowels, dismember, dismembered, dismemberer, dismemberers, dismembering, dismemberment, dismembers, eviscerate, eviscerated, eviscerates, eviscerating, evisceration, eviscerator, eviscerators, flay, flayed, flayer, flayers, flaying, flays, mutilate, mutilated, mutilates, mutilating, mutilation, mutilations, mutilative, mutilator, mutilators | **Keep** | Gory but ordinary English (history, nature writing); not adult themes. Block if you want the game gentler. | **Kept** |
| 18 | Suicide | suicidal, suicidally, suicide, suicided, suicides, suiciding, suicidologies, suicidology | **Keep** | Serious but not adult content; blocking could look like hiding a topic. Your call for a children's game. | **Blocked** |
| 19 | Slang about drink | blotto, skinful, sozzled, squiffier, squiffiest, squiffy, tiddly | **Keep** | Mild British humour words. | **Kept** |
| 20 | Dated racial terms (not adult; G7b follow-up) | blackamoor, blackamoors, paleface, palefaces | **Block** | Old-fashioned racial labels the G7b sweep missed; noted here so they are not lost. | **Blocked** |

## Kept (with reasons)

| Kind | Words | Reason |
|---|---|---|
| Medical or biology | bowel, testosterone, haemorrhoid, puberty, pregnant, sperm, spermatozoa, spermatid, spermatocyte, spermatogenesis, oestrogen, androgen, gamete, procreation, meiosis, urethra, cloaca, perineum, labia, labium, castration, geld, circumcise, hermaphrodite, intersex, priapism, groin, buttock(s), crotch, pubic, pubescent, oestrus, musth, rut/rutting | Neutral medical or biology words (the rule's own examples: bowel, testosterone, haemorrhoid, puberty, pregnant) |
| Identity words, not sexual content | gay, homosexual(ity), heterosexual(ity), bisexual(ity), transsexual, transgender words, pansexual, ambisexual, metrosexual, asexual, unisex, sexism, sexist, sexes, sexed/sexing (sexing chicks) | Words for who people are; blocking them would say they are shameful |
| Ordinary meaning first | adulterate/adulteration/adulterant (contaminate), consummate/consummation (complete), erection (building), screwed/screwing, scarfing (eat quickly), mistress (schoolmistress), tart (pastry), vamp, flirt, hunk, stud, knockout, stunner, sultry, luscious, voluptuous, dishy, chaste, chastity, frigid, swear/curse/oath/expletive, poop, puss (cat), booby/boobies (bird), titter, tittle, sextant, sextet, sexton, sextuplet, sexagenarian, necromancer, necrosis, necropolis, crucifix, cruciform, impala, pimple, pedometer, minx, coquette, temptress, enchantress, burlesque, peeler, procurer, meretricious, hustler, wanton, flasher, exhibitionist, streaker, starkers, bra, knickers, lingerie, thong, cleavage, sensual, sensuous, liaison, cohabitation, debauchery, bacchanalia, meths (methylated spirits), dope, stoned, tripper, binger, locoweed, smut (plant fungus), smutch | The everyday meaning comes first; the sexual sense, if any, is hidden from meanings by the definition filter |
| History, religion, myth | behead, decapitate, crucify/crucifixion, massacre, slaughter, torture, lynch, garrotte, corpse, cannibal, flagellant/flagellation, harem, seraglio, incubus, satyr, kama, cyprian (of Cyprus), maidenhead (also a town) | Taught in school (the Tudors, Easter, myths); violent but not adult themes |
| Medicine and drugs as medicine | opiate, narcotic(s), morphine, morphia, laudanum, fentanyl, amphetamine, overdose, coca, psilocybin, tetrahydrocannabinol, naloxone, epidural, acyclovir | Medicine and chemistry; only street names and drug users are blocked |

| Contraception (Ron, 2 Nov) | contraception, contraceptive, contraceptives, spermatocidal, spermatocide, spermatocides, spermicidal, spermicide, spermicides | Ron, 2 Nov: kept (was "Ron decides" #3). Health words, not sexual content; but "condom" is already blocked, so you may prefer Block for consistency. |
| Seduce, seductive (Ron, 2 Nov) | seduce, seduced, seduces, seducing, seduction, seductions, seductive, seductively, seductiveness | Ron, 2 Nov: kept (was "Ron decides" #4). Common figurative use ("seduced by the smell of baking"); block only the person nouns (below). |
| Lust, lusty (Ron, 2 Nov) | lust, lustier, lustiest, lustily, lusts, lusty | Ron, 2 Nov: kept (was "Ron decides" #6). Figurative use is common ("lust for power", wanderlust); "lustful" and friends are blocked. |
| Masochism, sadism (Ron, 2 Nov) | masochism, masochist, masochistic, masochists, sadist, sadistic, sadistically, sadists | Ron, 2 Nov: kept (was "Ron decides" #8). Usually means cruelty or "glutton for punishment"; sadomasochism is blocked. |
| Transvestite (Ron, 2 Nov) | transvestite, transvestites, transvestitism | Ron, 2 Nov: kept (was "Ron decides" #9). About clothing and identity, not sexual content; WordNet's wording is dated. |
| Nudist, naturist (Ron, 2 Nov) | naturist, naturists, nudism, nudist, nudists | Ron, 2 Nov: kept (was "Ron decides" #10). A non-sexual lifestyle word. |
| Stripper (Ron, 2 Nov) | stripper, strippers | Ron, 2 Nov: kept (was "Ron decides" #11). Paint and wallpaper stripper are common; meaning shown should be the tool. |
| Snog (Ron, 2 Nov) | snog, snogged, snogging, snogs | Ron, 2 Nov: kept (was "Ron decides" #12). Mild British word for kissing. |
| Frottage (Ron, 2 Nov) | frottage, frottages | Ron, 2 Nov: kept (was "Ron decides" #15). An art technique (rubbings) taught in primary art; the sexual sense is hidden from meanings by the filter. |
| Amour (Ron, 2 Nov) | amour, amours | Ron, 2 Nov: kept (was "Ron decides" #16). Mild ("a love affair"). |
| Gory violence (Ron, 2 Nov) | disembowel, disembowelled, disembowelling, disembowelment, disembowels, dismember, dismembered, dismemberer, dismemberers, dismembering, dismemberment, dismembers, eviscerate, eviscerated, eviscerates, eviscerating, evisceration, eviscerator, eviscerators, flay, flayed, flayer, flayers, flaying, flays, mutilate, mutilated, mutilates, mutilating, mutilation, mutilations, mutilative, mutilator, mutilators | Ron, 2 Nov: kept (was "Ron decides" #17). Gory but ordinary English (history, nature writing); not adult themes. Block if you want the game gentler. |
| Slang about drink (Ron, 2 Nov) | blotto, skinful, sozzled, squiffier, squiffiest, squiffy, tiddly | Ron, 2 Nov: kept (was "Ron decides" #19). Mild British humour words. |
WordNet's vulgar-usage senses that are harmless British slang (codswallop, stroppy, pong, sozzled …) are kept.

## Side effects

- Blocked words are also in the definition filter, so 28 kept words lost a meaning whose wording used one of them (after Ron, 2 Nov): algolagnic, anaclisis, cathect, cathected, cathecting, cathects, cathexes, cathexis, fetichism, fetichisms, hareem, hareems, harem, harems, kamikaze, kamikazes, lingam, lingams, monogynous, ovotestes, ovotestis, pruriently, seraglio, seraglios, serail, serails, wittol, wittols. They show the "rare word" line.
- "burlesque" now shows its second meaning (the first mentions striptease).
- Tiles, boards and Star words are byte-identical; words_all.dawg and the meanings are rebuilt.
