#!/usr/bin/env python3
"""F2: build Wordbright word lists, child-safe filter, star words, letter values and tile bags.

Usage: build_lists.py esdb_gb.tsv ldnoobw_en curriculum.json ks1_words.json out_dir
"""
import json
import math
import os
import random
import re
import sys
from collections import Counter

SIZE_STARTER, SIZE_STEADY, SIZE_FULL, SIZE_LARGE, SIZE_XL = 35, 50, 60, 70, 80
MIN_LEN, MAX_LEN = 2, 20

# Ordinary words that the open blocklist marks but are fine (or needed) in a children's word game.
ALLOW_BACK = {
    'escort', 'domination', 'butt', 'snatch', 'suck', 'sucks', 'scat', 'fingering',
    'snowballing', 'shrimping', 'undressing', 'skeet', 'bondage', 'eunuch', 'intercourse',
    'hardcore', 'grope', 'swinger',
    # real words caught only because they look like a blocked word
    'cocky', 'cockier', 'cockiest', 'cockily', 'cockiness', 'cocked', 'cocking', 'booby', 'bonkers',
    'heroine', 'heroines', 'crapes', 'japed', 'japes', 'japing', 'rapier', 'rapiers', 'shaggy', 'shaggier',
    'shaggiest', 'pimply', 'titter', 'titters', 'tittered', 'tittering', 'twinkly', 'vibratory', 'mishit',
    'mishits', 'mishitting', 'monger', 'mongers', 'spiced', 'spices', 'spicier', 'spiciest', 'spicily',
    'spiciness', 'spicing', 'spicy', 'dicker', 'dickers',
}

# Our own additions (drugs, swear words, insults and slurs not in the open list).
OWN_BLOCK = {
    'cocaine', 'heroin', 'marijuana', 'cannabis', 'opium', 'methadone', 'spliff', 'reefer',
    'bugger', 'buggery', 'arse', 'arses', 'piss', 'pissed', 'crap', 'crappy',
    'retard', 'retarded', 'spaz', 'mong', 'cretin', 'moron', 'imbecile',
    'paki', 'chink', 'gook', 'gypo', 'gyppo', 'pikey', 'tranny', 'dyke', 'homo', 'wog', 'yid', 'jap',
    'queer', 'condom', 'pimp', 'prostitute', 'prostitution', 'brothel', 'bonk', 'shag', 'shagged',
    'bitchy', 'slag', 'slags', 'hussy', 'harlot', 'strumpet', 'trollop',
}

# Seen when reviewing the Large (70) and Very large (80) lists.
OWN_BLOCK |= set('''bitchen bitchin bitcheries bitchery outbitch outbitched outbitches outbitching superbitch superbitches
sonofabitch bollox bolloxed bolloxes bolloxing bonkbuster bonkbusters butthead buttheads chav chavs coonass coonasses
crapola crackhouse crackhouses cockup cockups crumbum crumbums faggier faggiest faggy golliwogg golliwoggs gollywog gollywogs
jism jisms lesbo lesbos lezzes lezzie lezzies lezzy minger mingers moronism moronisms moronities moronity nazi nazis
negrophile negrophiles negrophilism negrophilisms negrophobe negrophobes negrophobia negrophobias pimpmobile pimpmobiles
superpimp superpimps pissant pissants pisspot pisspots pooftah pooftahs scrote skank skanked skanker skankers skanking skanks
skanky spazz spazzes spaza spazas twattle twattled twattles twattling sext sexts sexploitation sexploitations toker tokers
whorishly whorishness whorishnesses wencher wenchers tittie retardate retardates cretinoid bawdyhouse bawdyhouses ganjah ganjahs
methedrine methedrines methaqualone methaqualones opiumism opiumisms'''.split())

# Swearing that slipped through (W1a review).
OWN_BLOCK |= {'goddamn', 'goddamns', 'goddamned', 'goddamning', 'goddammit'}

# Slurs and insults found in the G7b review (2 Nov 2026): see wordlist/review-2026-11-02.md.
OWN_BLOCK |= set('''abo abos assed berk berks bint bints boche boches bogtrotter bogtrotters bohunk bohunks boong boongs bulldike
chola cholas cholo cholos crip crips darky dink dinks fagoter fagoters fagoting gimp gimped gimping gimps
ginzoes gipper gippers gippo gippos git gits golliwog golliwogs gringa gringas gypper gyppers gypster
gypsters gypsyish harlotry headcase headcases hun hunnish huns jerries jerry jew jewed jewfish jewfishes
jewing jews kaffir kaffirs kraut krauts ladyboy lez limey limeys lowlife lowlifes lubra lubras mammies mammy
marrano marranos mick mickey mickeys micks minge minging mongol mongols moonie nancies nancy nancys negress
negresses nellie nellies nelly nutcase nutcases nutter nutters octoroon octoroons papism papisms papist
papistries papistry pecker peckers peckerwood peckerwoods pillock pillocks plonker plonkers pom pommie
pommies pommy poms poofter poofters poperies popery pouf poufed pouffed pouffy poufs putz putzed putzes
putzing quadroon quadroons rednecked sambo sambos sawney sawneys schizo schizos sheeny shylock shylocks
sissyish sissyness slanty slapper slappers slitty tarty trannie trannies welcher welchers welsher welshers
woggish'''.split())

# Ron's decisions on the G7b "Ron decides" list (2 Nov 2026): blocked, and
# removed from the starter and steady lists too (see review-2026-11-02.md).
RON_APPROVED_STARTER_STEADY = set('''cocksucker cocksuckers redskin redskins squaw squaws mulatto mulattoes gringo gringos
welsh welshed welshes welshing fags fagged fagging butch butches queerness sissy sissies hussies floozy floozies
bimbo hos fanny fannies sodding psycho psychos gimpy midget midgets redneck rednecks gypsy gypsies'''.split())
OWN_BLOCK |= RON_APPROVED_STARTER_STEADY

# G9 adult-theme review (2 Nov 2026): sexual and adult words, and harsh drug
# slang, in every list; see wordlist/review-2026-11-02-adult.md. Star words
# are never blocked.
G9_ADULT = set('''adulterer adulterers adulteress adulteresses adulteries adulterine adulterous adulterously adultery algolagnia
algolagnias anaphrodisia anaphrodisiac anaphrodisias antisex antisexual antisexualities antisexuality
aphrodisia aphrodisiac aphrodisiacal aphrodisiacs bagnio bagnios bawd bawdier bawdies bawdiest bawdily
bawdiness bawdries bawdry bawds bawdy bennies bordello bordellos carnality carnally catamite catamites
cathouse cathouses cocotte cocottes coital coition coitions coitus concubinage concubinary concubine
concubines concupiscence copulate copulated copulates copulating copulation copulatory courtesan courtesans
crackhead crackheads crotchless cuckold cuckolded cuckolding cuckoldry cuckolds cums cybersex demimondaine
demimondaines demimonde desexualisation desexualisations desexualise desexualised desexualises desexualising
dopehead dopeheads druggie druggier druggies druggiest ecdysiast ecdysiasts eff effed effing effs erogenous
erotica erotical erotically eroticisation eroticise eroticised eroticises eroticising eroticism eroticist
eroticists erotization erotizations erotize erotized erotizes erotizing erotogenic erotomania erotomaniac
erotomaniacs erotomanias extramarital fetishise fetishised fetishises fetishising fetishism fetishist
fetishistic fetishistically fetishists foreplay fornicate fornicated fornicates fornicating fornication
fornicator fornicators frotteur frotteurs ganja gigolo gigolos hashish heroinism heroinisms hornier horniest
horniness horninesses hypersexual hypersexualities hypersexuality incestuous incestuously incestuousness
junkie junkies junky kief kiefs kinkier kinkiest lapdance lapdancer lapdancers lapdances lapdancing lascivious
lasciviously lasciviousness lech lecher lecherous lecherously lecherousness lechers lechery leches letch
letches lewd lewder lewdest lewdly lewdness libidinal libidinally libidinous libidinously libidinousness
libidinousnesses libido libidos licentious licentiously licentiousness lothario lotharios lustful lustfully
lustfulness lustfulnesses magdalen magdalens meth methamphetamine molest molestation molested molester
molesters molesting molests necrophile necrophiles necrophilia necrophiliac necrophiliacs necrophilic
necrophilism necrophilisms necrophilist nymphet nymphets nymphomaniac nymphomaniacal nymphomaniacs onanism
onanisms onanist onanists orgastic orgastically orgiast orgiastic orgiastically orgiasts orgies outercourse
oversexed paederasty paramour paramours paraphilia paraphilias pederast pederasts pederasty phalli phallic
phallically phallicism phallicisms phallicist phallicists phallism phallisms phallist phallists phallocentric
phallocentrism phallus philander philandered philanderer philanderers philandering philanders pothead potheads
priapic prostitutor prostitutors prurience pruriencies pruriency prurient psychosexual psychosexualities
psychosexuality psychosexually pussies randier randiest raper rapers raunch raunches raunchier raunchiest
raunchily raunchiness raunchy ravisher ravishers sadomasochism sadomasochist sadomasochistic sadomasochists
salacious salaciously salaciousness salacity satyriasis scag scags sexier sexiest sexily sexiness sexological
sexologist sexologists sexology sexpot sexpots sexualisation sexualisations sexualise sexualised sexualises
sexualising shroom smuttily smuttiness sociosexual streetwalker streetwalkers striptease stripteased
stripteaser stripteasers stripteases supersexualities supersexuality toke tokes undersexed unsexy voyeurism
voyeuristic voyeuristically womanise womanised womaniser womanisers womanises womanising zoophilism
zoophilisms'''.split())
OWN_BLOCK |= G9_ADULT
# G9, 2 Nov: those of them in the starter and steady lists, removed there too
# by tools/build-meanings.py --prune-lists.
RON_APPROVED_STARTER_STEADY |= set('''adulterer adulterers adulteress adulteresses adulteries adulterous adultery aphrodisiac aphrodisiacs bawdier
bawdiest bawdily bawdiness bawdy bordello bordellos carnally coital coitus concubine concubines copulate
copulated copulates copulating copulation courtesan courtesans cuckold cuckolded cuckolding cuckolds cybersex
erogenous erotica erotically eroticism extramarital fetishism fetishist fetishistic fetishists foreplay
fornicate fornicated fornicates fornicating fornication gigolo gigolos hashish hornier horniest incestuous
junkie junkies kinkier kinkiest lascivious lasciviously lasciviousness lecher lecherous lecherously lechers
lechery lewd lewder lewdest lewdly lewdness libidinous libido libidos licentious licentiously licentiousness
lustful lustfully molest molestation molested molester molesters molesting molests necrophilia nymphomaniac
nymphomaniacs orgiastic orgies oversexed paramour paramours pederast pederasts pederasty phalli phallic
phallus philander philandered philanderer philanderers philandering philanders prurience prurient pussies
randier randiest raunchier raunchiest raunchiness raunchy salacious salaciously salaciousness sexier sexiest
sexily sexiness sexpot sexpots streetwalker streetwalkers striptease stripteased stripteases toke tokes
voyeurism voyeuristic womanise womanised womaniser womanisers womanises womanising'''.split())
OWN_BLOCK |= RON_APPROVED_STARTER_STEADY

# G9, Ron 2 Nov: Ron's decisions on the G9 "Ron decides" list (groups 1, 2, 5,
# 7, 13, 14, 18, 20 in review-2026-11-02-adult.md): blocked too.
G9_RON_BLOCK = set('''blackamoor blackamoors clitoral clitorectomies clitorectomy clitoric clitoridectomies clitoridectomy colpitis
colpitises colposcope colposcopes douche douches episiotomies episiotomy fetish fetishes genital genitalia
genitalic genitally orchidectomies orchidectomy orchiectomies orchiectomy paleface palefaces scrota scrotal
scrotum seducement seducements seducer seducers seducible seductress seductresses succuba succubas succubi
succubus suicidal suicidally suicide suicided suicides suiciding suicidologies suicidology testicle testicles
testicular vaginae vaginal vaginally vaginate vaginated vaginectomies vaginectomy vaginismus vaginismuses
vaginitis vulvae vulval vulvar vulvate vulviform vulvitis vulvitises vulvovaginitides vulvovaginitis'''.split())
G9_ADULT |= G9_RON_BLOCK
OWN_BLOCK |= G9_RON_BLOCK
# G9, Ron 2 Nov: those of them in the starter and steady lists.
RON_APPROVED_STARTER_STEADY |= set('''clitoral douche douches fetish fetishes genital genitalia paleface palefaces scrota scrotum seducer seducers
suicidal suicide suicides testicle testicles vaginae vaginal vulvae'''.split())
OWN_BLOCK |= RON_APPROVED_STARTER_STEADY

# The insult sweep (review-2026-11-05-insults.md): words whose only sense is a mild insult
# ("a stupid person"), which no usage tag marks. Overnight 4 Nov, Ron approved sweep.
INSULT_SWEEP = set('''blockhead blockheads bonehead boneheads dimwit dimwits doofus doofuses dufus dummkopf dummkopfs dunce dunces dunderhead dunderheads featherhead featherheads gabies gaby juggins jugginses jughead jugheads knucklehead knuckleheads lummox lummoxes lunkhead lunkheads mampara mompara muddlehead muddleheads muttonhead muttonheads nincompoop nincompooperies nincompoopery nincompoops ninnies ninny ninnyhammer ninnyhammers nitwit nitwits oaf oafs softhead softheads woodenhead woodenheads'''.split())
OWN_BLOCK |= INSULT_SWEEP
# Those in the starter and steady lists, overnight 4 Nov, Ron approved sweep.
RON_APPROVED_STARTER_STEADY |= set('''blockhead blockheads bonehead boneheads dimwit dimwits dunce dunces knucklehead knuckleheads lummox lummoxes nincompoop nincompoops ninnies ninny nitwit nitwits oaf oafs'''.split())
OWN_BLOCK |= RON_APPROVED_STARTER_STEADY

# Words whose every WordNet sense is offensive, found by tools/build-meanings.py --prune-lists.
_WN_BLOCK = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'wordnet_block.txt')
if os.path.exists(_WN_BLOCK):
    OWN_BLOCK |= {l.strip() for l in open(_WN_BLOCK, encoding='utf-8') if l.strip() and not l.startswith('#')}

# Strong roots: any word containing these is removed.
ROOTS = ('fuck', 'shit', 'cunt', 'nigg', 'slut', 'whore', 'faggot', 'dildo',
         'porn', 'paedo', 'pedophil', 'bollock', 'arsehole', 'motherf', 'masturb',
         'orgasm', 'ejacul', 'blowjob', 'cunnil', 'fellat', 'sodom', 'bestial')

TWO_OK = set('ad ah am an as at aw be by do go ha he hi if in is it ma me my no of oh on or ow ox pa pi so ta to up us we'.split())

SUFFIXES = ('s', 'es', 'ed', 'd', 'ing', 'er', 'ers', 'y', 'ier', 'iest', 'ily', 'ly', 'ish', 'iness')


def derived_forms(b):
    out = {b + s for s in SUFFIXES}
    if len(b) >= 3 and b[-1] not in 'aeiouwxy':
        out |= {b + b[-1] + s for s in ('ed', 'ing', 'er', 'ers', 'y', 'ier', 'iest')}
    if b.endswith('e'):
        out |= {b[:-1] + s for s in ('ing', 'y', 'ier', 'iest')}
    return out


def main(tsv, ldn, curr, ks1, out):
    os.makedirs(out, exist_ok=True)
    size = {}
    for line in open(tsv, encoding='utf-8'):
        w, s = line.rstrip('\n').split('\t')
        if MIN_LEN <= len(w) <= MAX_LEN:
            size[w] = int(s)

    ldn_words = {l.strip().lower() for l in open(ldn, encoding='utf-8') if re.fullmatch(r'[a-z]+', l.strip().lower())}
    block_base = (ldn_words - ALLOW_BACK) | OWN_BLOCK
    reason = {}
    for w in size:
        if size[w] > SIZE_XL:
            continue
        if w in block_base:
            reason[w] = 'open blocklist' if w in ldn_words else 'own list'
        elif any(r in w for r in ROOTS) and w not in ALLOW_BACK:
            reason[w] = 'strong root'
    for b in block_base:
        if len(b) < 4:
            continue
        for d in derived_forms(b):
            if d in size and size[d] <= SIZE_XL and d not in reason and d not in ALLOW_BACK:
                reason[d] = f'form of "{b}"'

    # Star words (KS2 statutory list) from Spellbright.
    c = json.load(open(curr, encoding='utf-8'))
    stars = []
    for key in ('year_3_4', 'year_5_6'):
        for ch in c[key]['chapters']:
            for x in ch['words']:
                stars.append({'word': x['word'].lower(), 'meaning': x['meaning']['definition'],
                              'example': x['meaning'].get('example', ''), 'years': key.replace('year_', '').replace('_', '-')})
    k1 = json.load(open(ks1, encoding='utf-8'))
    for key, yr in (('year_1', '1'), ('year_2', '2')):
        for w, m in k1[key].items():
            stars.append({'word': w, 'meaning': m, 'example': '', 'years': yr})
    star_set = {s['word'] for s in stars}
    blocked_stars = star_set & set(reason)
    for w in blocked_stars:
        del reason[w]

    for w in size:
        if len(w) == 2 and w not in TWO_OK and size[w] <= SIZE_XL:
            reason.setdefault(w, '2-letter word not in our short list')

    def tier(n):
        return sorted({w for w, s in size.items() if s <= n and w not in reason} | star_set)

    full, steady, starter = tier(SIZE_FULL), tier(SIZE_STEADY), tier(SIZE_STARTER)
    large, xlarge = tier(SIZE_LARGE), tier(SIZE_XL)
    for name, lst in (('words_full.txt', full), ('words_steady.txt', steady), ('words_starter.txt', starter),
                      ('words_large.txt', large), ('words_xlarge.txt', xlarge)):
        with open(os.path.join(out, name), 'w') as f:
            f.write('\n'.join(lst) + '\n')
    with open(os.path.join(out, 'star_words.json'), 'w', encoding='utf-8') as f:
        json.dump(stars, f, ensure_ascii=False, indent=1)
    with open(os.path.join(out, 'excluded_full.txt'), 'w') as f:
        for w in sorted(reason):
            f.write(f'{w}\t{reason[w]}\n')

    # Letter values from frequency in words_full.
    freq = Counter(ch for w in full if len(w) <= 7 for ch in w)  # short words = what is actually played
    total = sum(freq.values())
    share = {L: freq[L] / total for L in 'abcdefghijklmnopqrstuvwxyz'}
    top = max(share.values())
    raw = {L: 1 + math.log2(top / share[L]) for L in share}
    values = {L: max(1, min(8, round(v))) for L, v in raw.items()}

    scrabble = dict(zip('abcdefghijklmnopqrstuvwxyz',
                        [1, 3, 3, 2, 1, 4, 2, 4, 1, 8, 5, 1, 3, 1, 1, 3, 10, 1, 1, 1, 1, 4, 4, 8, 4, 10]))
    same = [L for L in values if values[L] == scrabble[L]]

    # Tile bags: share of each letter, vowels lifted to ~40 %, min 1 of each letter (Standard, Large).
    def bag(n_tiles, at_least_one):
        vowels = set('aeiou')
        v_share = sum(share[L] for L in vowels)
        target_v = 0.40
        adj = {L: share[L] * (target_v / v_share if L in vowels else (1 - target_v) / (1 - v_share)) for L in share}
        exact = {L: adj[L] * n_tiles for L in adj}
        counts = {L: int(exact[L]) for L in exact}
        for L in counts:
            if L in at_least_one:
                counts[L] = max(1, counts[L])
        while sum(counts.values()) < n_tiles:
            L = max(exact, key=lambda k: exact[k] - counts[k])
            counts[L] += 1
        while sum(counts.values()) > n_tiles:
            L = max((k for k in counts if counts[k] > 1), key=lambda k: counts[k] - exact[k])
            counts[L] -= 1
        return counts

    bags = {
        'junior': {'tiles': bag(50, set('abcdefghiklmnoprstuvwy')), 'blanks': 1},
        'standard': {'tiles': bag(90, set('abcdefghijklmnopqrstuvwxyz')), 'blanks': 2},
        'large': {'tiles': bag(170, set('abcdefghijklmnopqrstuvwxyz')), 'blanks': 4},
    }
    for b in bags.values():
        t = b['tiles']
        b['total'] = sum(t.values()) + b['blanks']
        b['vowel_share'] = round(sum(t[L] for L in 'aeiou') / sum(t.values()), 3)
        b['bag_points'] = sum(t[L] * values[L] for L in t)

    json.dump({'values': values, 'blank_value': 0, 'bags': bags,
               'formula': 'value = round(1 + log2(share_of_e / share_of_letter)), clamped 1..8; share = letter count / all letters in words of 2-7 letters in words_full.txt',
               'raw': {L: round(v, 2) for L, v in raw.items()}, 'share_pct': {L: round(100 * share[L], 2) for L in share},
               'same_as_other_game': same},
              open(os.path.join(out, 'tiles.json'), 'w'), indent=1)

    # Stats.
    def by_len(lst):
        c = Counter(len(w) for w in lst)
        return {k: c[k] for k in sorted(c)}
    stats = {
        'xlarge': len(xlarge), 'large': len(large), 'full': len(full), 'steady': len(steady), 'starter': len(starter), 'excluded': len(reason),
        'stars': len(star_set), 'stars_unblocked': sorted(blocked_stars),
        'stars_not_in_esdb': sorted(star_set - {w for w, s in size.items() if s <= SIZE_FULL}),
        'len_full': by_len(full),
        'two_letter_full': [w for w in full if len(w) == 2],
        'two_letter_starter': [w for w in starter if len(w) == 2],
        'same_values_as_other_game': same,
    }
    json.dump(stats, open(os.path.join(out, 'stats.json'), 'w'), indent=1)

    rng = random.Random(20261028)
    sample = rng.sample(sorted(reason), min(100, len(reason)))
    with open(os.path.join(out, 'excluded_sample.md'), 'w') as f:
        f.write('# Excluded words — random sample of 100 (seed 20261028)\n\n')
        f.write(f'Total excluded from the full list: {len(reason)}. Full list: excluded_full.txt.\n\n')
        f.write('| Word | Why |\n|---|---|\n')
        for w in sorted(sample):
            f.write(f'| {w} | {reason[w]} |\n')


if __name__ == '__main__':
    main(*sys.argv[1:6])
