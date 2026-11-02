#!/usr/bin/env python3
"""
Build Wordbright's word meanings: wordbright/site/data/meanings/<ab>.json, one
small file per first two letters, fetched by the game only when a word needs it.

For every word in wordbright-design/wordlist/words_xlarge.txt:
  - its lemma ("running" -> "run"), by WordNet's own rules (exception lists,
    then ending rules, then a doubled final consonant: "running" -> "runn" -> "run"),
    choosing the reading that is most common in WordNet's tagged texts;
  - the first sense that passes the child-safety filter: its part of speech,
    its meaning and an example if WordNet has one;
  - for a word WordNet 3.1 has no safe meaning for (G6b): the same again from
    Open English WordNet (OEWN 2025, CC BY 4.0), with the same filters;
  - its British pronunciation (IPA) from Britfone, if Britfone has the word.
Then Star words: their meanings are ours (star_words.json, applied in the game),
so here they only get IPA where Spellbright has none.

Child-safety filter. A sense is dropped when:
  - WordNet marks it as obscene, vulgar, an ethnic slur, disparaging, profane
    or slang (usage domain), or puts it under sex or drugs (topic domain);
  - its meaning or example contains a blocked word: our blocklist
    (wordlist/excluded_full.txt, OWN_BLOCK and ROOTS in wordlist/tools/build_lists.py)
    or MEANING_BLOCK below (sexual, drug and insult words that are fine to play
    but not fine in a definition);
  - it says it is offensive, derogatory, an insult, slang for a body part, etc.
If every sense is dropped the word gets no meaning (it may still get IPA).

WordNet's meanings use American spelling; words that have a British spelling in
our own list are changed ("color" -> "colour", "realize" -> "realise").

Sources (downloaded into --sources the first time; the files are not kept in git):
  WordNet 3.1, Princeton University  https://wordnetcode.princeton.edu/wn3.1.dict.tar.gz
    Licence: WordNet licence (free for any use; the notice must go with every copy):
    wordbright/LICENSE-WORDNET.txt and the For parents page.
  Britfone 3.0.1, Jose Llarena  https://github.com/JoseLlarena/Britfone (commit 1062be14)
    Licence: MIT: wordbright/LICENSE-BRITFONE.txt.
  Open English WordNet 2025 edition (lexical items only, no proper nouns), the
    Open English Wordnet team  https://en-word.net/ (WNDB files, index.sense fixed)
    Licence: CC BY 4.0, built on WordNet (the WordNet licence too):
    wordbright/LICENSE-OEWN.txt and the For parents page.

Run it by hand after the word list changes:

    python3 tools/build-meanings.py
    python3 tools/build-meanings.py --sources ~/somewhere   # where the downloads live

Shard format: {"word": entry, ...}; entry fields, each only when known:
  p  part of speech (noun, verb, adjective, adverb)
  m  meaning
  e  example
  l  lemma, when it is not the word itself ("running": l "run")
  i  British IPA, e.g. "/ˈrʌnɪŋ/"
  d  (G9) the base word, when the meaning was made from it ("frothier": d "frothy",
     "eke": d "eke out")
Each shard also has "~": a stamp of its contents, listed again in index.json
({"v": 2, "shards": {"ab": stamp, ...}}), so a shard and the index can be matched.
Words with nothing known are left out.
"""
import argparse
import gzip
import hashlib
import importlib.util
import json
import re
import sys
import tarfile
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORDLIST = ROOT / "wordbright-design" / "wordlist"
OUT = ROOT / "wordbright" / "site" / "data" / "meanings"
SPLIT_AT = 100_000  # bytes
CURRICULUM = ROOT / "site" / "data" / "curriculum.json"  # Spellbright (read only)

WORDNET_URL = "https://wordnetcode.princeton.edu/wn3.1.dict.tar.gz"
WORDNET_SHA256 = "3f7d8be8ef6ecc7167d39b10d66954ec734280b5bdcd57f7d9eafe429d11c22a"
BRITFONE_URL = "https://raw.githubusercontent.com/JoseLlarena/Britfone/1062be14adc96c358f2087ac5449d72130c7a6f4/britfone.main.3.0.1.csv"
BRITFONE_SHA256 = "59f197e98520856d1cc88e380beb54e4314d8712efc4d588b6778819c502d920"
OEWN_URL = "https://github.com/globalwordnet/english-wordnet/releases/download/2025-edition/english-wordnet-2025-index.sense-fixed.zip"
OEWN_SHA256 = "38b16326159f51853626b7d24a44c453fa88ab33f06fce5ec8fc5996d1c2be93"
OEWN_LICENSE_URL = "https://raw.githubusercontent.com/globalwordnet/english-wordnet/main/LICENSE.md"
BRITFONE_LICENSE_URL = "https://raw.githubusercontent.com/JoseLlarena/Britfone/1062be14adc96c358f2087ac5449d72130c7a6f4/LICENSE.txt"

POS = {"n": "noun", "v": "verb", "a": "adjective", "s": "adjective", "r": "adverb"}
POS_FILES = {"n": "noun", "v": "verb", "a": "adj", "r": "adv"}
SS_TYPE = {"n": 1, "v": 2, "a": 3, "r": 4, "s": 5}

# WordNet's detachment rules (morphy).
RULES = {
    "n": [("s", ""), ("ses", "s"), ("xes", "x"), ("zes", "z"), ("ches", "ch"), ("shes", "sh"), ("men", "man"), ("ies", "y")],
    "v": [("s", ""), ("ies", "y"), ("es", "e"), ("es", ""), ("ed", "e"), ("ed", ""), ("ing", "e"), ("ing", "")],
    "a": [("er", ""), ("est", ""), ("er", "e"), ("est", "e")],
    "r": [],
}

# Usage and topic domains whose senses are never shown (matched by name, so the
# same list works for any WordNet 3.x).
# Words whose every sense WordNet marks like this are not played at all (--prune-lists).
OFFENSIVE_USAGE = {"obscenity", "vulgarism", "ethnic_slur", "disparagement", "profanity", "dirty_word", "smut",
                   "swearword", "curse"}
PRUNED = WORDLIST / "wordnet_block.txt"  # read by wordlist/tools/build_lists.py too

# G9b: "slang" is not unsafe in itself ("batty", "baloney", and "corpse", whose
# group of synonyms includes the slang "stiff"); a sexual or crude slang sense
# is still caught by its wording, its topic, or the marks below.
BAD_USAGE = {"obscenity", "vulgarism", "ethnic_slur", "disparagement", "profanity",
             "dirty_word", "smut", "swearword", "curse"}
BAD_TOPIC = {"sex", "sexual_activity", "sexual_practice", "sexual_intercourse", "drug_of_abuse", "illegal_drug",
             "drug_abuse", "narcotic", "pornography", "prostitution", "erotica"}

# Fine to play, not fine in a definition shown to a child.
MEANING_BLOCK = set("""
sex sexes sexual sexually sexuality intercourse copulate copulation copulating coitus coital
genital genitals genitalia penis penises vagina vaginal vulva clitoris scrotum testicle testicles testes
erection erotic erotica erotically orgasm masturbate masturbation lust lustful lewd lewdness obscene obscenity
pornographic pornography prostitute prostitutes prostitution brothel whorehouse pimp seduce seduction
fornicate fornication adultery adulterous incest rape raped rapist sodomy buttocks anus anal arse
narcotic narcotics hallucinogen hallucinogenic opiate opiates cocaine heroin marijuana cannabis hashish
methamphetamine amphetamine amphetamines lsd ecstasy intoxicant stoned addict addicts
offensive derogatory disparaging disparagingly contemptuous contemptuously insulting insult vulgar vulgarly
slur slang obscenely profane profanity swearword
suicide torture despicable contemptible expletive expletives pejorative pejoratively
homosexual homosexuals homosexuality orgy orgies orgiastic putz goddamn goddamned
""".split())

# Blocked game words that are a people's name in a meaning (G7b).
NAMES_IN_MEANINGS = {"jew", "jews", "mongol", "mongols", "hun", "huns", "welsh"}

# Phrases that mark a sense as unsuitable even without a blocked word.
# G9b: words that may appear in a definition shown to a child although they
# are blocked as game words or listed above: they are innocent there ("horny
# plates", "retards the ball", "offensive players", "(slang) crazy", "an
# alkaloid narcotic drug", "between the stomach and the anus"). An insult is
# still caught by MEANING_PHRASES ("offensive term for") and by "despicable"
# and "contemptible", which WordNet uses for insults ("bum": "a person who is
# deemed to be despicable or contemptible").
TEXT_OK = {"offensive", "slang", "horny", "retards", "narcotic",
           "narcotics", "opium", "opiate", "opiates", "anus", "anal", "rectum", "rectal", "buttocks",
           "torture", "tortured", "nudity"}
# "sex" only as biology: "of either sex", "both sexes" (the token check sees the rest).
SAFE_SEX = re.compile(r"\b(?:either|both|each|one|opposite|same|other|male|female|the two) sex(?:es)?\b|\bsexes\b"
                      r"|\bregardless of (?:\w+ )?sex\b|\b(?:age|and|or) sex\b|\bsex (?:and|or) age\b")

MEANING_PHRASES = re.compile(r"\b(offensive (term|name|word)|term of (abuse|contempt)|used as a term|ethnic slur|"
                             r"informal term for (a|the) (penis|breast|buttocks)|street name for|make love|making love|made love|lovemaking)\b")

# Our own meanings for little words WordNet has no (or no fitting) sense for.
# They win over WordNet. Part of speech, meaning, example.
OWN_MEANINGS = {
    "a": ("determiner", "One; any one (used before a word that starts with a consonant sound).", "I saw a fox."),
    "an": ("determiner", "One; any one (used before a word that starts with a vowel sound).", "She ate an apple."),
    "the": ("determiner", "Used before a noun to mean one particular thing or person.", "Shut the door, please."),
    "and": ("conjunction", "Joins words or parts of a sentence together.", "Fish and chips."),
    "but": ("conjunction", "Used to add something that is different or surprising.", "It was cold but sunny."),
    "or": ("conjunction", "Used to show a choice between things.", "Tea or juice?"),
    "if": ("conjunction", "On condition that; in case.", "If it rains, we will stay in."),
    "as": ("conjunction", "In the same way; while; because.", "She sang as she worked."),
    "so": ("adverb", "Very; or, for that reason.", "I was tired, so I went to bed."),
    "at": ("preposition", "Shows where or when something is.", "Meet me at the gate at three."),
    "by": ("preposition", "Next to; or, done or made by someone.", "A poem by a girl in my class."),
    "for": ("preposition", "Meant to be given to or used by; because of.", "This present is for you."),
    "from": ("preposition", "Shows where something starts or comes from.", "A letter from Gran."),
    "in": ("preposition", "Inside; within.", "The cat is in the box."),
    "into": ("preposition", "To the inside of.", "She jumped into the pool."),
    "of": ("preposition", "Belonging to; made from; part of.", "A cup of tea."),
    "on": ("preposition", "Touching the top of; or, working (switched on).", "The book is on the table."),
    "to": ("preposition", "Towards a place; also used before a verb.", "We walked to school."),
    "up": ("adverb", "Towards a higher place.", "The balloon went up."),
    "with": ("preposition", "Together with; using.", "I went with my brother."),
    "i": ("pronoun", "The person speaking or writing.", ""),
    "me": ("pronoun", "The person speaking or writing (after a verb or preposition).", "Give it to me."),
    "my": ("determiner", "Belonging to me.", "This is my bike."),
    "we": ("pronoun", "The person speaking and others.", "We won the match."),
    "us": ("pronoun", "The person speaking and others (after a verb or preposition).", "Come with us."),
    "our": ("determiner", "Belonging to us.", "Our house is near the park."),
    "you": ("pronoun", "The person or people being spoken to.", "Are you ready?"),
    "your": ("determiner", "Belonging to you.", "Is this your coat?"),
    "he": ("pronoun", "A boy, man or male animal already mentioned.", "He is my cousin."),
    "him": ("pronoun", "A boy, man or male animal (after a verb or preposition).", "I gave him a pen."),
    "his": ("determiner", "Belonging to him.", "His dog is called Max."),
    "she": ("pronoun", "A girl, woman or female animal already mentioned.", "She plays the drums."),
    "her": ("pronoun", "A girl, woman or female animal; or, belonging to her.", "Her bag is red."),
    "it": ("pronoun", "A thing or animal already mentioned.", "Where is the ball? It is under the bed."),
    "its": ("determiner", "Belonging to it.", "The bird built its nest."),
    "they": ("pronoun", "The people or things already mentioned.", "They are coming to tea."),
    "them": ("pronoun", "The people or things (after a verb or preposition).", "I saw them at the shops."),
    "their": ("determiner", "Belonging to them.", "Their garden is full of flowers."),
    "this": ("determiner", "The one here or nearest.", "This cake is delicious."),
    "that": ("determiner", "The one there, further away.", "That tree is very old."),
    "these": ("determiner", "The ones here or nearest.", "These shoes are new."),
    "those": ("determiner", "The ones there, further away.", "Those birds are swallows."),
    "what": ("pronoun", "Used to ask about a thing.", "What is your name?"),
    "who": ("pronoun", "Used to ask about a person.", "Who is at the door?"),
    "which": ("pronoun", "Used to ask about one of a group.", "Which colour do you like?"),
    "ah": ("exclamation", "A sound showing surprise, pleasure or understanding.", "Ah, now I see!"),
    "aw": ("exclamation", "A sound showing sympathy or that something is sweet.", "Aw, look at the puppy."),
    "oh": ("exclamation", "A sound showing surprise or another feeling.", "Oh, what a lovely surprise!"),
    "ow": ("exclamation", "A sound you make when something hurts.", "Ow, I stubbed my toe!"),
    "ha": ("exclamation", "A sound of laughing, or of triumph.", "Ha! I knew it."),
    "ta": ("exclamation", "Thank you (informal, British).", "Ta for the lift."),
    "no": ("exclamation", "A word used to say something is not so, or to refuse.", "No, thank you."),
    "not": ("adverb", "Used to make a word or sentence mean the opposite.", "It is not raining."),
    "can": ("verb", "To be able to; to be allowed to.", "Can you swim?"),
    "will": ("verb", "Used to talk about the future.", "I will see you tomorrow."),
    # Forms of "be" (WordNet's sense is grammar talk).
    "be": ("verb", "To exist, or to say what someone or something is like.", "I want to be a vet."),
    "am": ("verb", "A form of \u201cbe\u201d used with \u201cI\u201d.", "I am nine years old."),
    "is": ("verb", "A form of \u201cbe\u201d used with he, she or it.", "The sky is blue."),
    "are": ("verb", "A form of \u201cbe\u201d used with you, we or they.", "We are friends."),
    "was": ("verb", "The past of \u201cbe\u201d with I, he, she or it.", "It was sunny yesterday."),
    "were": ("verb", "The past of \u201cbe\u201d with you, we or they.", "They were late."),
    "been": ("verb", "A form of \u201cbe\u201d used after have, has or had.", "I have been to the beach."),
    "being": ("noun", "A living thing; or, the present form of \u201cbe\u201d.", "A human being."),
    # WordNet's first sense is specialist, odd or not for children (W1a review).
    "queen": ("noun", "A woman who rules a country, or the wife of a king.", "The queen waved from her carriage."),
    "king": ("noun", "A man who rules a country.", "The king wore a golden crown."),
    "bat": ("noun", "A flying animal that comes out at night; also a stick for hitting a ball.", "A bat hung upside down in the barn."),
    "bank": ("noun", "A place that keeps money safe; also the land beside a river.", "We sat on the river bank."),
    "bark": ("noun", "The sharp sound a dog makes; also the hard outside of a tree trunk.", "The dog gave a loud bark."),
    "fair": ("adjective", "Treating everyone in the same, right way; also light in colour.", "It is fair to take turns."),
    "light": ("noun", "What lets us see things, from the sun or a lamp.", "Turn on the light, please."),
    "match": ("noun", "A game between two teams or players; also a small stick that makes a flame.", "We won the football match."),
    "ring": ("noun", "A round band worn on a finger; also the sound a bell makes.", "She wore a silver ring."),
    "saw": ("verb", "The past of \u201csee\u201d; also a tool with a toothed blade for cutting wood.", "I saw a rainbow."),
    "wave": ("noun", "A moving ridge of water on the sea; also moving your hand to say hello.", "A big wave crashed on the beach."),
    "well": ("adverb", "In a good way; also a deep hole for getting water from the ground.", "You played well today."),
    "make": ("verb", "To build, create or cause something.", "Let's make a cake."),
    "do": ("verb", "To carry out an action or a task.", "Did you do your homework?"),
    "act": ("verb", "To do something; also to play a part in a play or film.", "She wants to act in the school play."),
    "mother": ("noun", "A female parent; a mum.", "My mother reads to me at night."),
    "father": ("noun", "A male parent; a dad.", "His father is a farmer."),
    "kid": ("noun", "A child; also a young goat.", "The kids played in the park."),
    "bed": ("noun", "A piece of furniture to sleep on; also a patch of ground for plants.", "Time for bed!"),
    "plant": ("noun", "A living thing that grows in the ground, such as a tree, flower or grass.", "Water the plants every day."),
    "list": ("noun", "Things written one under another.", "Make a shopping list."),
    "state": ("noun", "The condition something is in; also a country or a part of one.", "His room was in a messy state."),
    "form": ("noun", "A shape or type of something; also a paper to fill in, or a class at school.", "Ice is a form of water."),
    "thing": ("noun", "An object, or anything you can think about.", "What is that thing?"),
    "deal": ("verb", "To give out cards; to sort something out.", "Deal seven tiles to each player."),
    "break": ("verb", "To make something come apart in pieces; also a short rest.", "Be careful not to break the glass."),
    "amount": ("noun", "How much there is of something.", "A small amount of sugar."),
    "now": ("adverb", "At this time.", "Come here now, please."),
    "fig": ("noun", "A soft sweet fruit full of tiny seeds.", "Figs grow in warm countries."),
    "table": ("noun", "A piece of furniture with a flat top and legs.", "Lay the table for tea."),
    "board": ("noun", "A flat piece of wood or other material; also a group of people who run something.", "Put the pieces on the board."),
    "party": ("noun", "A gathering to have fun and celebrate.", "Are you coming to my birthday party?"),
    "stem": ("noun", "The main stalk of a plant that holds up the leaves and flowers.", "A rose has a thorny stem."),
    "title": ("noun", "The name of a book, film or song.", "What is the title of your story?"),
    "award": ("noun", "A prize given for doing something well.", "She won an award for her painting."),
    "labour": ("noun", "Hard work.", "Building the wall took a lot of labour."),
    "stock": ("noun", "A supply of things kept ready; also the liquid used to make soup.", "The shop has new stock."),
    "arc": ("noun", "A curved line, like part of a circle.", "The ball flew in a high arc."),
    "active": ("adjective", "Busy doing things; moving about a lot.", "Swimming keeps you active."),
    "bear": ("noun", "A large, heavy wild animal with thick fur.", "A brown bear caught a fish."),
    "heart": ("noun", "The part inside your chest that pumps blood; also your feelings.", "Your heart beats faster when you run."),
    "water": ("noun", "The clear liquid that falls as rain and fills rivers and seas.", "Drink plenty of water."),
    "model": ("noun", "A small copy of something; also someone who shows clothes.", "He built a model of a ship."),
    "file": ("noun", "A folder for keeping papers; also a tool for smoothing things.", "Keep your work in a file."),
    "lay": ("verb", "To put something down carefully; also what a hen does with eggs.", "Lay the baby in the cot."),
    "right": ("adjective", "Correct; also the side opposite the left.", "That answer is right."),
    "pretty": ("adjective", "Nice to look at.", "What a pretty garden."),
    "above": ("preposition", "Higher than.", "The kite flew above the trees."),
    "ace": ("noun", "A playing card with one symbol; also someone who is very good at something.", "She is an ace at maths."),
    "aloft": ("adverb", "Up in the air.", "The eagle soared aloft."),
    "arrow": ("noun", "A thin pointed stick shot from a bow; also a sign that points the way.", "Follow the arrows to the exit."),
    "aisle": ("noun", "A path between rows of seats or shelves.", "Walk down the aisle to your seat."),
    "camp": ("noun", "A place where people stay in tents or huts.", "We stayed at a camp by the lake."),
    "court": ("noun", "A place where a judge decides cases; also an area for playing games like tennis.", "They played on the tennis court."),
    "mass": ("noun", "A large amount or lump of something.", "A mass of clouds covered the sun."),
    "basic": ("adjective", "Simple; the most important part to start with.", "Learn the basic rules first."),
}

# Other games' names and terms never appear in Wordbright's files (PLAN.md section 2,
# wordbright/tests/names.test.js): words containing them get no entry at all.
# Built from pieces, as in the test.
BANNED_TERMS = re.compile("|".join(a + b for a, b in [("scr", "abble"), ("bin", "go"), ("words with", " friends"),
                                                         ("triple", " word"), ("double", " letter")]), re.I)

# Britfone (modern RP) -> the symbols Spellbright already shows.
PHONE_MAP = {"ɹ": "r", "ɐ": "ʌ", "ɛə": "eə", "ɛ": "e", "g": "ɡ"}
VOWEL_START = set("aeiouæɑɒɔəɜɪʊʌɐɛ")
ONSETS = {"pl", "pr", "bl", "br", "tr", "dr", "kl", "kr", "kw", "ɡl", "ɡr", "fl", "fr", "θr", "ʃr", "sp", "st", "sk",
          "sm", "sn", "sl", "sw", "tw", "dw", "pj", "bj", "tj", "dj", "kj", "ɡj", "mj", "nj", "fj", "vj", "hj", "lj",
          "spr", "str", "skr", "spl", "skw", "spj", "stj", "skj"}

US_TO_UK = [  # (US ending, British ending), tried in order
    ("ization", "isation"), ("izations", "isations"), ("izing", "ising"), ("ized", "ised"), ("izes", "ises"),
    ("ize", "ise"), ("yzing", "ysing"), ("yzed", "ysed"), ("yze", "yse"),
    ("ors", "ours"), ("or", "our"), ("ored", "oured"), ("oring", "ouring"), ("orful", "ourful"),
    ("ers", "res"), ("er", "re"), ("eled", "elled"), ("eling", "elling"), ("eler", "eller"),
    ("og", "ogue"), ("ogs", "ogues"), ("olen", "ollen"), ("orless", "ourless"), ("orful", "ourful"), ("ense", "ence"), ("se", "ce"),
]


def fetch(url, path, sha):
    if not path.exists():
        print("downloading", url)
        path.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(url) as r:
            path.write_bytes(r.read())
    got = hashlib.sha256(path.read_bytes()).hexdigest()
    if got != sha:
        sys.exit(f"{path.name}: sha256 {got}, expected {sha}")


class WordNet:
    def __init__(self, d):
        self.index = {}  # (lemma, pos) -> [offsets in sense order]
        self.data = {}  # (offset, pos) -> raw line
        self.exc = {}  # (form, pos) -> [lemmas]
        self.counts = {}  # (lemma, ss_type, offset) -> tag count
        for p, f in POS_FILES.items():
            for line in open(d / f"index.{f}", encoding="utf-8"):
                if line.startswith(" ") or not line.strip():
                    continue
                t = line.split()
                n_ptr = int(t[3])
                n_syn = int(t[2])
                self.index[(t[0], p)] = t[6 + n_ptr:6 + n_ptr + n_syn]
            for line in open(d / f"data.{f}", encoding="utf-8"):
                if not line.startswith(" ") and line.strip():  # OEWN ends with a blank line
                    self.data[(line[:8], p)] = line
            for line in open(d / f"{f}.exc", encoding="utf-8"):
                t = line.split()
                if not t:
                    continue
                self.exc.setdefault((t[0], p), []).extend(t[1:])
        for line in open(d / "index.sense", encoding="utf-8"):
            if not line.strip():
                continue
            key, off, _num, cnt = line.split()
            lemma, rest = key.split("%")
            self.counts[(lemma, int(rest[0]), off)] = int(cnt)
        self.names = {}  # first word of each synset -> offsets (for domain names)
        for (off, p), line in self.data.items():
            self.names.setdefault(line.split()[4].lower(), set()).add((off, p))

    def offsets_named(self, names):
        return {k for n in names for k in self.names.get(n, ())}

    def lemmas(self, word, p):
        """WordNet base forms of `word` as part of speech p (morphy, plus doubled consonants)."""
        out = []
        if (word, p) in self.index:
            out.append(word)
        for b in self.exc.get((word, p), []):
            if (b, p) in self.index and b not in out:
                out.append(b)
        for end, rep in RULES[p]:
            if word.endswith(end) and len(word) > len(end):
                b = word[: -len(end)] + rep
                cands = [b]
                if rep == "" and len(b) > 2 and b[-1] == b[-2] and b[-1] not in "aeiouslz":
                    cands.append(b[:-1])  # running -> runn -> run, bigger -> bigg -> big
                for c in cands:
                    # A base of 3+ letters only: "bed" is not a form of "be".
                    if len(c) >= 3 and (c, p) in self.index and c not in out:
                        out.append(c)
        return out

    def spellings(self, lemma):
        """The lemma and its American spellings: WordNet's counts are mostly under "color", "center"."""
        out = [lemma]
        for us, uk in US_TO_UK:
            if lemma.endswith(uk):
                out.append(lemma[: -len(uk)] + us)
        return out

    def count(self, lemma, p, off):
        st = SS_TYPE[p]
        return max(self.counts.get((f, st, off), 0) or self.counts.get((f, 5, off), 0) for f in self.spellings(lemma))

    def weight(self, lemma, p):
        """How often this reading is met: tag counts over all its senses (plus a little per sense)."""
        offs = self.index[(lemma, p)]
        return sum(self.count(lemma, p, o) for o in offs) + len(offs) * 0.01

    def senses(self, lemma, p):
        """Offsets, most common sense first. Where WordNet has no counts to go by,
        senses with fewer names in them come first (the animal before "Democratic Party")."""
        offs = self.index[(lemma, p)]
        def key(k):
            off = offs[k]
            gloss = split_gloss(self.data[(off, p)].partition(" | ")[2])[0]
            named = len(re.findall(r"\s[A-Z][a-z]", gloss))
            return (-self.count(lemma, p, off), named, k)
        return [offs[k] for k in sorted(range(len(offs)), key=key)]

    def synset(self, off, p):
        line = self.data[(off, p)]
        head, _, gloss = line.partition(" | ")
        t = head.split()
        ss_type = t[2]
        w_cnt = int(t[3], 16)
        k = 4 + 2 * w_cnt
        n_ptr = int(t[k])
        ptrs = [(t[k + 1 + 4 * i], t[k + 2 + 4 * i], t[k + 3 + 4 * i]) for i in range(n_ptr)]
        members = [re.sub(r"\(.*\)$", "", t[4 + 2 * i]) for i in range(w_cnt)]  # "IT", "Maine", "run"
        return ss_type, ptrs, gloss.strip(), members


def load_build_lists():
    spec = importlib.util.spec_from_file_location("build_lists", WORDLIST / "tools" / "build_lists.py")
    bl = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bl)
    return bl


def load_blocklist():
    bl = load_build_lists()
    words = set(MEANING_BLOCK) | set(bl.OWN_BLOCK)
    for line in open(WORDLIST / "excluded_full.txt", encoding="utf-8"):
        w, _, why = line.rstrip("\n").partition("\t")
        if not why.startswith("2-letter"):
            words.add(w)
    words -= set(bl.ALLOW_BACK)
    # Blocked as lower-case game words, but in a meaning they are the names of
    # peoples ("a skullcap worn by Jews", "the Mongols"), so meanings may use them.
    words -= NAMES_IN_MEANINGS
    return words, tuple(bl.ROOTS)


def split_gloss(gloss):
    """'meaning; "example one"; "example two"' -> (meaning, [examples])."""
    examples = re.findall(r'"([^"]+)"', gloss)
    # Each example goes, with the author after it if it is a quotation ("…"- Herman Melville).
    meaning = re.sub(r';?\s*"[^"]*"(?:\s*-\s*[^;"]*)?', "", gloss).strip().rstrip(";:,").strip()
    meaning = re.sub(r"^\([a-z ]+\)\s*", "", meaning)  # "(astronomy) a celestial body…"
    meaning = re.sub(r"\s*-\s+(?:the\s+)?[A-Z][\w.' ]*$", "", meaning)  # a quotation's author left behind: "… - B. Russell"
    meaning = re.sub(r"\bwild ass(es)?\b", lambda m: "wild donkey" + ("s" if m.group(1) else ""), meaning)
    return meaning, [e.replace("`", "'").replace("--", " - ").strip() for e in examples]


def tidy(text, british):
    """American spellings to British where our list has the British one; capital and full stop."""
    def fix(m):
        w = m.group(0)
        low = w.lower()
        if low in british:
            return w
        for us, uk in US_TO_UK:
            if low.endswith(us):
                cand = low[: -len(us)] + uk
                if cand in british:
                    return cand if w.islower() else cand.capitalize()
        return w
    text = re.sub(r"[A-Za-z]+", fix, text.strip())
    text = re.sub(r"\s+", " ", text)
    if not text:
        return text
    text = text[0].upper() + text[1:]
    return text if text[-1] in ".!?" else text + "."


def britfone(path):
    """Word -> IPA (first pronunciation), in Spellbright's symbols and slashes."""
    out = {}
    for line in open(path, encoding="utf-8"):
        word, _, phones = line.strip().partition(", ")
        m = re.fullmatch(r"([A-Z']+)(\(1\))?", word)
        if not m or not phones:
            continue
        w = m.group(1).lower()
        if not w.isalpha() or w in out:
            continue
        out[w] = ipa(phones.split())
    return out


def ipa(phones):
    ph = [PHONE_MAP.get(p.lstrip("ˈˌ"), p.lstrip("ˈˌ")) for p in phones]
    marks = [p[0] if p[0] in "ˈˌ" else "" for p in phones]
    # Britfone puts the stress mark on the vowel; IPA puts it before the syllable,
    # so move it back over the consonants that can start a syllable together.
    out = [""] * len(ph)
    for i, m in enumerate(marks):
        if not m:
            continue
        j = i
        while j > 0 and ph[j - 1][0] not in VOWEL_START:
            cluster = "".join(ph[j - 1:i])
            if (i - j == 0 and ph[j - 1] != "ŋ") or cluster in ONSETS:
                j -= 1
            else:
                break
        out[j] = m + out[j]
    s = "".join(o + p for o, p in zip(out, ph))
    # One syllable needs no stress mark (Spellbright writes /bɪld/).
    if _syllables(ph) == 1:
        s = s.replace("ˈ", "").replace("ˌ", "")
    return "/" + s + "/"


VOICELESS = ("p", "t", "k", "f", "θ")
SIBILANT = ("s", "z", "ʃ", "ʒ", "tʃ", "dʒ")


def inflected_ipa(w, pron):
    """IPA for a regular -s, -es, -ed, -ing, -er or -est form of a word Britfone has."""
    def body(b):
        return pron[b].strip("/")
    tries = []
    for suf in ("s", "es", "ed", "d", "ing", "er", "est", "r", "st"):
        if w.endswith(suf) and len(w) - len(suf) >= 2:
            stem = w[: -len(suf)]
            bases = [stem]
            if suf in ("ing", "ed", "er", "est"):
                bases.append(stem + "e")  # making -> make
                if len(stem) > 2 and stem[-1] == stem[-2]:
                    bases.append(stem[:-1])  # running -> run
            if suf in ("es", "ed", "er", "est") and stem.endswith("i"):
                bases.append(stem[:-1] + "y")  # cities -> city, tried -> try
            tries += [(b, suf) for b in bases]
    for b, suf in tries:
        if b not in pron or (suf in ("d", "r", "st") and not b.endswith("e")):
            continue
        ipa_b = body(b)
        last = ipa_b.rstrip("ː")
        if suf in ("s", "es"):
            end = "ɪz" if last.endswith(SIBILANT) else "s" if last.endswith(VOICELESS) else "z"
            if suf == "es" and not (b.endswith(("s", "x", "z", "ch", "sh", "o")) or b.endswith("y")):
                continue
        elif suf in ("ed", "d"):
            end = "ɪd" if last.endswith(("t", "d")) else "t" if last.endswith(VOICELESS + ("s", "ʃ", "tʃ")) else "d"
        elif suf == "ing":
            end = "ɪŋ"
        elif suf in ("er", "r"):
            end = "ə" if not ipa_b.endswith("ə") else "rə"
        else:
            end = "ɪst"
        return "/" + ipa_b + end + "/"
    return None


def _syllables(ph):
    return sum(1 for p in ph if p[0] in VOWEL_START)


def write_licences(sources, wn_dir):
    """The licences travel with the data: wordbright/LICENSE-WORDNET.txt, LICENSE-BRITFONE.txt."""
    lines = []
    for line in open(wn_dir / "data.noun", encoding="utf-8"):
        if not line.startswith("  "):
            break
        lines.append(re.sub(r"^\s+\d+ ?", "", line).rstrip())
    (ROOT / "wordbright" / "LICENSE-WORDNET.txt").write_text(
        "Word meanings in wordbright/site/data/meanings/ are made from WordNet 3.1\n"
        "(https://wordnet.princeton.edu/), changed for Wordbright (senses chosen and\n"
        "filtered, British spelling). Its licence:\n\n" + "\n".join(lines).strip() + "\n", encoding="utf-8")
    lic = sources / "britfone-LICENSE.txt"
    if not lic.exists():
        with urllib.request.urlopen(BRITFONE_LICENSE_URL) as r:
            lic.write_bytes(r.read())
    (ROOT / "wordbright" / "LICENSE-BRITFONE.txt").write_text(
        "British pronunciations (IPA) in wordbright/site/data/meanings/ are made from\n"
        "Britfone 3.0.1 (https://github.com/JoseLlarena/Britfone), changed for Wordbright\n"
        "(symbols as in Spellbright, stress marks moved, regular word endings added). Its licence:\n\n"
        + lic.read_text(encoding="utf-8").strip() + "\n", encoding="utf-8")
    lic = sources / "oewn-LICENSE.md"
    if not lic.exists():
        with urllib.request.urlopen(OEWN_LICENSE_URL) as r:
            lic.write_bytes(r.read())
    (ROOT / "wordbright" / "LICENSE-OEWN.txt").write_text(
        "Word meanings in wordbright/site/data/meanings/ that WordNet 3.1 does not have are made\n"
        "from Open English WordNet, 2025 edition (https://en-word.net/), by the Open English\n"
        "Wordnet team, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/),\n"
        "changed for Wordbright (senses chosen and filtered, British spelling). It is based on\n"
        "Princeton WordNet (see LICENSE-WORDNET.txt). Its licence:\n\n"
        + lic.read_text(encoding="utf-8").strip() + "\n", encoding="utf-8")


def prune_lists(wn):
    """Remove from every word list each word whose senses (its own, or its lemma's)
    are all marked obscene, vulgar, a slur, disparaging or profane, and every word
    in our own blocklist (OWN_BLOCK). Star words stay.
    The words go into wordlist/wordnet_block.txt (build_lists.py blocks them on a
    rebuild) and excluded_full.txt."""
    bad = wn.offsets_named(OFFENSIVE_USAGE)
    xl = [w.strip() for w in open(WORDLIST / "words_xlarge.txt", encoding="utf-8") if w.strip()]
    steady = {w.strip() for w in open(WORDLIST / "words_steady.txt", encoding="utf-8") if w.strip()}  # holds starter
    stars = {e["word"] for e in json.load(open(WORDLIST / "star_words.json", encoding="utf-8"))}
    old = {l.strip() for l in PRUNED.read_text().splitlines() if l.strip() and not l.startswith("#")} if PRUNED.exists() else set()
    found = []
    review = []
    for w in xl:
        # Case does not matter here: WordNet writes most slurs with a capital
        # ("Kraut", "Boche"), so a lower-case-only match missed them (G7b).
        marks = [any(sym == ";u" and (o, q) in bad for sym, o, q in wn.synset(off, p)[1])
                 for p in POS_FILES for l in wn.lemmas(w, p) for off in wn.index[(l, p)]
                 if l in (m.lower() for m in wn.synset(off, p)[3])]
        if marks and all(marks) and w not in stars:
            # A new word from the two smallest lists is reported for a person
            # to decide (review-2026-11-02.md), never removed on its own.
            (review if w in steady and w not in old else found).append(w)
    gone = sorted(old | set(found))
    PRUNED.write_text("# Every WordNet sense is offensive (tools/build-meanings.py --prune-lists).\n" + "\n".join(gone) + "\n")
    # Our own blocklist (OWN_BLOCK in build_lists.py) applies too, so new
    # entries take effect without a full rebuild from the ESDB sources.
    # In the starter and steady lists only words a person approved for removal
    # (RON_APPROVED_STARTER_STEADY) go; any other match there is only reported.
    bl = load_build_lists()
    own = bl.OWN_BLOCK - stars
    approved = getattr(bl, "RON_APPROVED_STARTER_STEADY", set()) - stars
    review = sorted((set(review) | ((own - approved) & steady)) - approved)
    drop = set(gone) | own
    for n in ("starter", "steady", "full", "large", "xlarge"):
        f = WORDLIST / f"words_{n}.txt"
        words = [w.strip() for w in open(f, encoding="utf-8") if w.strip()]
        kept = [w for w in words if w not in drop or (w in steady and w not in approved and w not in old)]
        f.write_text("\n".join(kept) + "\n")
        print(f"words_{n}: removed {len(words) - len(kept)}")
    ex = WORDLIST / "excluded_full.txt"
    rows = dict(l.rstrip("\n").split("\t", 1) for l in open(ex, encoding="utf-8") if "\t" in l)
    for w in gone:
        rows.setdefault(w, "every WordNet sense offensive")
    known = set(xl)
    for w in own & known:
        rows.setdefault(w, "own list")
    ex.write_text("".join(f"{w}\t{rows[w]}\n" for w in sorted(rows)))
    print(f"{len(gone)} words whose every WordNet sense is offensive: " + " ".join(gone))
    if review:
        print(f"{len(review)} from the starter/steady lists, kept for a person to decide: " + " ".join(review))


# ---- G9c: Wiktionary for the words WordNet and OEWN leave without a meaning --------
# From tools/wiktionary-extract.py (the kaikki.org English extract). CC BY-SA 4.0:
# every meaning made here is kept apart, in data/meanings/wikt/, marked src "wikt".
WIKT_SENSES = Path.home() / ".cache" / "wordbright-meanings" / "wiktionary-senses.json.gz"
WIKTIONARY_NOTICE = """Word meanings in wordbright/site/data/meanings/wikt/ (marked "src": "wikt",
shown with a "Wiktionary" credit) are adapted from Wiktionary, the free dictionary
(https://en.wiktionary.org/), by its contributors, through the kaikki.org English
extract made with wiktextract (https://kaikki.org/, Tatu Ylonen).

Wiktionary's text is licensed under the Creative Commons Attribution-ShareAlike
4.0 International licence (CC BY-SA 4.0): https://creativecommons.org/licenses/by-sa/4.0/
Each word's page, with its history and authors, is at
https://en.wiktionary.org/wiki/<word>.

Changes made for Wordbright: one sense chosen per word and shortened to one
sentence; senses marked offensive, vulgar, a slur, derogatory, sexual or
obsolete left out, and every meaning passed through our child-safe filters;
British spelling; forms of a word ("plural of …") written as "More than one …"
with the base word's meaning. These adapted meanings (data/meanings/wikt/) are
shared under the same licence, CC BY-SA 4.0. The other meanings (WordNet, Open
English WordNet, our own) are under their own licences (LICENSE.txt).
"""
BAD_WIKT_TAGS = {"offensive", "vulgar", "slur", "ethnic", "derogatory", "pejorative", "obsolete", "sexual", "misspelling",
                 "humorous-misspelling", "error-misspelling"}
BAD_WIKT_TOPICS = re.compile(r"\b(sex|sexual|sexuality|human sexuality|bdsm|pornography|prostitution|paraphilias?|"
                             r"fetishism|erotic|ethnic slurs|insults|vulgarities|offensive terms|derogatory terms|"
                             r"recreational drugs|swear words|genitalia)\b", re.I)
FORM_GLOSS = re.compile(r"^(plural|alternative|obsolete|archaic|misspelling|nonstandard|eye dialect|abbreviation|"
                        r"initialism|acronym|clipping|synonym|comparative|superlative|present participle|past participle|"
                        r"simple past|third-person singular|inflection|form|spelling)\b[^.]*? (form |spelling )?of\b", re.I)
WIKT_POS = {"noun": "noun", "verb": "verb", "adj": "adjective", "adv": "adverb", "intj": "interjection",
            "prep": "preposition", "conj": "conjunction", "pron": "pronoun", "det": "determiner", "num": "numeral",
            "particle": "particle", "article": "article"}


def one_sentence(text, limit=140):
    """Wiktionary's gloss as one sentence of at most `limit` characters."""
    t = re.sub(r"\s+", " ", text).strip()
    # The first sentence end that is not an abbreviation ("P. yezoensis", "e.g.", "etc.").
    for m in re.finditer(r"[.;!?](?=\s)", t):
        before = t[: m.start() + 1]
        if m.group() == "." and re.search(r"(?:^|[\s(])(?:[A-Za-z]|e\.g|i\.e|etc|cf|sp|spp|vs|approx|esp|incl|St|Mr|Mrs|Dr|No)\.$", before):
            continue
        t = t[: m.start() + 1]
        break
    t = t.rstrip(" ;:,")
    if len(t) > limit:
        t = t[: limit - 3].rsplit(" ", 1)[0].rstrip(",;: ") + "…"
    if not t:
        return ""
    t = t[0].upper() + t[1:]
    return t if t.endswith((".", "!", "?", "…")) else t + "."


def wikt_form_template(tags, base, w):
    if "synonym" in tags:
        return f"Another word for {base}."
    if "plural" in tags:
        return f"More than one {base}."
    if "comparative" in tags:
        return f"More {base}."
    if "superlative" in tags:
        return f"Most {base}."
    if "past" in tags:
        return f"Past tense of {base}."
    if "participle" in tags and "present" in tags or "gerund" in tags:
        return f"The -ing form of {base}."
    if "third-person" in tags:
        return f"A form of {base}, as in \u201cshe {w}\u201d."
    if "alt-of" in tags or "alternative" in tags:
        return f"Another spelling of {base}."
    return f"A form of {base}."

# ---- G9: meanings from a base word -------------------------------------------------
# Each rule: (ending, how to build the base, the base's part of speech, the sentence).
def _bases(stem):
    """The stem, and the stem with a doubled final consonant undone ("chatt" -> "chat")
    or a dropped e put back ("mak" -> "make")."""
    out = [stem]
    if len(stem) > 2 and stem[-1] == stem[-2] and stem[-1] not in "aeiousz":
        out.append(stem[:-1])
    out.append(stem + "e")
    return out

DERIVE_RULES = [
    # (ending, base candidates from the stem, base part of speech, template)
    ("iest", lambda s: [s + "y"], {"adjective"}, "Most {b}."),
    ("ier", lambda s: [s + "y"], {"adjective"}, "More {b}."),
    ("ily", lambda s: [s + "y"], {"adjective"}, "In {a} {b} way."),
    ("inesses", lambda s: [s + "y"], {"adjective"}, "The quality of being {b}."),
    ("iness", lambda s: [s + "y"], {"adjective"}, "The quality of being {b}."),
    ("nesses", lambda s: [s], {"adjective"}, "The quality of being {b}."),
    ("ness", lambda s: [s], {"adjective"}, "The quality of being {b}."),
    ("ly", lambda s: [s, s + "le"], {"adjective"}, "In {a} {b} way."),
    ("est", _bases, {"adjective"}, "Most {b}."),
    ("er", _bases, {"adjective"}, "More {b}."),
    ("ied", lambda s: [s + "y"], {"verb"}, "Past tense of {b}."),
    ("ed", lambda s: _bases(s) + [s + "e"], {"verb"}, "Past tense of {b}."),
    ("ing", _bases, {"verb"}, "The -ing form of {b}."),
    ("ies", lambda s: [s + "y"], {"noun", "verb"}, None),
    ("es", lambda s: [s], {"noun", "verb"}, None),
    ("s", lambda s: [s], {"noun", "verb"}, None),
]


def derive(w, meaning_of):
    """(base, meaning) for a word from its base word, or None. meaning_of(b)
    gives the base's entry only when it may be used (a safe meaning of its own)."""
    for end, bases, kinds, template in DERIVE_RULES:
        if not w.endswith(end) or len(w) - len(end) < 2:
            continue
        stem = w[: -len(end)]
        for b in dict.fromkeys(bases(stem)):
            if b == w or len(b) < 2:
                continue
            e = meaning_of(b)
            if not e or e.get("p") not in kinds:
                continue
            if template is None:  # -s: a plural or a verb form
                template = "More than one {b}." if e["p"] == "noun" else "A form of {b}, as in \u201cshe " + w + "\u201d."
            m = e["m"].rstrip()
            if m[:1].isupper() and not re.match(r"I\b|[A-Z]{2}", m):  # "A load" -> "a load"; not "I" or "DNA"
                m = m[0].lower() + m[1:]
            art = "an" if b[0] in "aeiou" and not b.startswith(("uni", "use", "usu", "uti", "eu", "one")) else "a"
            return b, template.format(b=b, a=art) + " " + b + ": " + m
    return None


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[1])
    ap.add_argument("--sources", type=Path, default=Path.home() / ".cache" / "wordbright-meanings")
    ap.add_argument("--wiktionary", type=Path, default=WIKT_SENSES,
                    help="G9c: the extract tools/wiktionary-extract.py wrote (default ~/.cache/wordbright-meanings/)")
    ap.add_argument("--no-wiktionary", action="store_true", help="build without the Wiktionary meanings")
    ap.add_argument("--prune-lists", action="store_true",
                    help="first remove words whose every WordNet sense is offensive from all five word lists "
                         "(then run tools/build-wordgraph.py)")
    args = ap.parse_args()

    tgz = args.sources / "wn3.1.dict.tar.gz"
    bf = args.sources / "britfone.main.3.0.1.csv"
    fetch(WORDNET_URL, tgz, WORDNET_SHA256)
    fetch(BRITFONE_URL, bf, BRITFONE_SHA256)
    wn_dir = args.sources / "dict"
    if not (wn_dir / "data.noun").exists():
        with tarfile.open(tgz) as t:
            # Plain files under dict/ only (this Python has no extraction filter).
            safe = [m for m in t.getmembers() if m.isfile() and m.name.startswith("dict/") and ".." not in m.name]
            t.extractall(args.sources, members=safe)

    oz = args.sources / "english-wordnet-2025-index.sense-fixed.zip"
    fetch(OEWN_URL, oz, OEWN_SHA256)
    oewn_dir = args.sources / "oewn2025"
    if not (oewn_dir / "data.noun").exists():
        with zipfile.ZipFile(oz) as z:
            for m in z.namelist():
                if m.startswith("oewn2025/") and ".." not in m and not m.endswith("/"):
                    (args.sources / m).parent.mkdir(parents=True, exist_ok=True)
                    (args.sources / m).write_bytes(z.read(m))

    write_licences(args.sources, wn_dir)
    wn = WordNet(wn_dir)
    oewn = WordNet(oewn_dir)
    if args.prune_lists:
        prune_lists(wn)
    blocked, roots = load_blocklist()
    # Each wordnet with its own usage and topic domains (offsets differ).
    nets = [(wn, wn.offsets_named(BAD_USAGE), wn.offsets_named(BAD_TOPIC)),
            (oewn, oewn.offsets_named(BAD_USAGE), oewn.offsets_named(BAD_TOPIC))]
    pron = britfone(bf)

    lists = {n: [w.strip() for w in open(WORDLIST / f"words_{n}.txt", encoding="utf-8") if w.strip()]
             for n in ("starter", "steady", "full", "large", "xlarge")}
    words = lists["xlarge"]
    british = set(words)

    blocked = blocked - TEXT_OK

    def unsafe(text):
        low = text.lower()
        if MEANING_PHRASES.search(low):
            return True
        low = SAFE_SEX.sub(" ", low)
        for tok in re.findall(r"[a-z]+", low):
            if tok in blocked or any(r in tok for r in roots):
                return True
        return False

    unsafe_seen = set()  # words with a sense the child-safety filter dropped

    def first_safe_sense(net, lemma, p, w, caps=False):
        wn, bad_usage, bad_topic = net
        for off in wn.senses(lemma, p):
            ss_type, ptrs, gloss, members = wn.synset(off, p)
            # WordNet's index is lower case, so "it" also finds IT and "us" the US:
            # a sense counts only if the word is written in lower case there
            # (caps, G9b: or in any case, for a word that has no other sense).
            if lemma not in members and not (caps and lemma in (m.lower() for m in members)):
                continue
            if any(sym == ";u" and (o, q) in bad_usage or sym == ";c" and (o, q) in bad_topic for sym, o, q in ptrs):
                unsafe_seen.add(w)
                continue
            meaning, examples = split_gloss(gloss)
            if not meaning or unsafe(meaning):
                unsafe_seen.add(w)
                continue
            examples = [e for e in examples if not unsafe(e)]
            return POS[ss_type], meaning, examples
        return None

    def meaning_from(net, w, caps=False):
        wn = net[0]
        entry = {}
        cands = [(wn.weight(l, p) * (1.2 if l == w else 1), l, p) for p in POS_FILES for l in wn.lemmas(w, p)]
        cands.sort(key=lambda c: -c[0])
        for _, lemma, p in cands:
            s = first_safe_sense(net, lemma, p, w, caps)
            if not s:
                continue
            pos, meaning, examples = s
            entry["p"] = pos
            entry["m"] = tidy(meaning, british)
            # Only an example that uses the word as played, or its lemma: WordNet's
            # examples are for the whole synset and often use another word.
            forms = [w, lemma] + wn.spellings(lemma)[1:]
            ex = next((e for f in forms for e in examples if re.search(r"\b" + re.escape(f) + r"\b", e, re.I)), None)
            if ex:
                entry["e"] = tidy(ex, british)
            if lemma != w:
                entry["l"] = lemma
            break
        return entry

    # G9: a word that both wordnets know only in a phrasal verb ("eke out").
    PARTICLES = ("out", "up", "off", "on", "in", "away", "down", "over", "back", "through", "along", "about", "into")

    def phrase_meaning(w):
        stems = [w]
        for end, adds in (("ied", ("y",)), ("ies", ("y",)), ("ed", ("", "e")), ("ing", ("", "e")), ("es", ("",)), ("s", ("",))):
            if w.endswith(end) and len(w) - len(end) >= 2:
                stems += [w[: -len(end)] + a for a in adds]
                if end in ("ed", "ing") and len(w) - len(end) > 2 and w[-len(end) - 1] == w[-len(end) - 2]:
                    stems.append(w[: -len(end) - 1])  # "eked" -> "eke"; "topped" -> "top"
        for stem in dict.fromkeys(stems):
            for net in nets:
                for part in PARTICLES:
                    key = stem + "_" + part
                    if (key, "v") not in net[0].index:
                        continue
                    sense = first_safe_sense(net, key, "v", w)
                    if not sense:
                        continue
                    phrase = stem + " " + part
                    meaning = tidy(sense[1], british)
                    meaning = meaning[0].lower() + meaning[1:] if meaning[:1].isupper() and not re.match(r"I\b|[A-Z]{2}", meaning) else meaning
                    text = (phrase + ": " + meaning) if stem == w else ("A form of " + stem + ", as in \u201c" + phrase + "\u201d. " + phrase + ": " + meaning)
                    if unsafe(text) or BANNED_TERMS.search(text):
                        continue
                    return {"p": "verb", "m": text, "d": phrase}
        return None

    out = {}
    dropped = 0
    from_oewn = set()
    from_phrase = set()
    from_caps = set()
    for w in words:
        entry = meaning_from(nets[0], w)
        if "m" not in entry:  # G6b: Open English WordNet for the gaps
            entry = meaning_from(nets[1], w)
            if "m" in entry:
                from_oewn.add(w)
        if "m" not in entry:  # G9b: only capitalised senses ("antarctic", "druid", "amen")
            entry = meaning_from(nets[0], w, caps=True) or meaning_from(nets[1], w, caps=True)
            if "m" in entry:
                from_caps.add(w)
        if "m" not in entry:  # G9: only a phrase has it ("eke" -> "eke out")
            ph = phrase_meaning(w)
            if ph:
                entry = ph
                from_phrase.add(w)
        if w in unsafe_seen and "m" not in entry:
            dropped += 1
        if w in OWN_MEANINGS:
            pos, meaning, example = OWN_MEANINGS[w]
            entry = {"p": pos, "m": meaning}
            if example:
                entry["e"] = example
            from_oewn.discard(w)
        sound = pron.get(w) or inflected_ipa(w, pron)
        if sound:
            entry["i"] = sound
        if entry and not BANNED_TERMS.search(w + " " + " ".join(entry.values())):
            out[w] = entry
        else:
            from_oewn.discard(w)

    # G9: a word with no meaning of its own gets one from its base word, when
    # the base has a safe meaning of its own (not derived) and is in our lists
    # (so not blocked): "frothier" -> "More frothy. frothy: full of froth."
    # Derived entries carry "d" (the base word); the panel shows them like any other.
    stars = {s["word"] for s in json.load(open(ROOT / "wordbright" / "site" / "data" / "star_words.json", encoding="utf-8"))}
    before = {n: sum(1 for w in lst if "m" not in out.get(w, {}) and w not in stars) for n, lst in lists.items()}
    derived = {}
    for w in words:
        if w in stars or "m" in out.get(w, {}):
            continue
        d = derive(w, lambda b: out.get(b) if b in british and "m" in out.get(b, {}) and "d" not in out.get(b, {}) else None)
        if d and not unsafe(d[1]) and not BANNED_TERMS.search(d[1]):  # the base word is in the sentence too
            base, meaning = d
            e = out.setdefault(w, {})
            e.update({"p": out[base].get("p", ""), "m": meaning, "d": base})
            if not e["p"]:
                del e["p"]
            derived[w] = base
    after = {n: sum(1 for w in lst if "m" not in out.get(w, {}) and w not in stars) for n, lst in lists.items()}

    # G9c: Wiktionary, for the words still without a meaning. First pass: the
    # first sense that is a real definition (not "plural of", "form of",
    # "alternative spelling of"), not marked offensive, vulgar, a slur,
    # derogatory, sexual or obsolete, and passing every child-safe filter, as
    # one short sentence. Second pass: a form of another word, in our derived
    # style, from that word's meaning (WordNet's, OEWN's or Wiktionary's).
    # Kept apart (wikt), with src "wikt", so the CC BY-SA part is clear.
    wikt = {}
    wstats = {"marked": 0, "unsafe": 0, "unsafe_words": set()}
    if not args.no_wiktionary:
        if not args.wiktionary.exists():
            sys.exit(f"{args.wiktionary}: no Wiktionary extract (run tools/wiktionary-extract.py), or pass --no-wiktionary")
        with gzip.open(args.wiktionary, "rt", encoding="utf-8") as f:
            wdata = json.load(f)
        wsenses, wbases = wdata["senses"], wdata.get("bases", {})

        def eligible(sn):
            if set(sn["t"]) & BAD_WIKT_TAGS or any(BAD_WIKT_TOPICS.search(c) for c in sn["c"]):
                wstats["marked"] += 1
                return False
            return True

        def is_form(sn):
            return bool(sn.get("f")) or bool({"form-of", "alt-of"} & set(sn["t"])) or bool(FORM_GLOSS.match(sn["g"]))

        gaps = [w for w in words if w not in stars and "m" not in out.get(w, {})]
        for w in gaps:
            for sn in wsenses.get(w, []):
                if is_form(sn) or not eligible(sn):
                    continue
                text = one_sentence(tidy(sn["g"], british))
                if not text or unsafe(text) or BANNED_TERMS.search(w + " " + text):
                    wstats["unsafe"] += 1
                    wstats["unsafe_words"].add(w)
                    continue
                wikt[w] = {"m": text, "src": "wikt", **({"p": WIKT_POS[sn["p"]]} if sn["p"] in WIKT_POS else {})}
                break
        def phrase_meaning(b):
            """A phrase our word is a spelling of ("notice board"): its first safe real definition."""
            for sn in wbases.get(b, []):
                if is_form(sn) or set(sn["t"]) & BAD_WIKT_TAGS or any(BAD_WIKT_TOPICS.search(c) for c in sn["c"]):
                    continue
                text = one_sentence(tidy(sn["g"], british))
                if text and not unsafe(text) and not BANNED_TERMS.search(b + " " + text):
                    return {"m": text, **({"p": WIKT_POS[sn["p"]]} if sn["p"] in WIKT_POS else {})}
            return None

        for w in gaps:
            if w in wikt:
                continue
            for sn in wsenses.get(w, []):
                if not is_form(sn) or not eligible(sn):
                    continue
                b = sn.get("f")
                if not b:  # "Synonym of around, about …": the first word or phrase named
                    m = re.search(r"\bof ([A-Za-z][A-Za-z' -]*?)(?=\s*(?:[,;:.(]|$))", sn["g"])
                    b = m.group(1) if m else None
                if not b:
                    continue
                b = b.strip().lower()
                if b in british:
                    be = out.get(b) if "m" in out.get(b, {}) else wikt.get(b)
                elif " " in b:  # a phrase, never a single word left out of our lists
                    be = phrase_meaning(b)
                else:
                    be = None
                if b == w or not be or "m" not in be or "d" in be:
                    continue
                m = be["m"].rstrip()
                if m[:1].isupper() and not re.match(r"I\b|[A-Z]{2}", m):
                    m = m[0].lower() + m[1:]
                tags = set(sn["t"]) | ({"synonym"} if sn["g"].lower().startswith("synonym of") else set())
                text = wikt_form_template(tags, b, w) + " " + b + ": " + m
                if unsafe(text) or BANNED_TERMS.search(w + " " + text):
                    wstats["unsafe"] += 1
                    wstats["unsafe_words"].add(w)
                    continue
                wikt[w] = {"m": text, "src": "wikt", "d": b, **({"p": be["p"]} if be.get("p") else {})}
                break
        wstats["unsafe_words"] -= set(wikt)
    after_wikt = {n: sum(1 for w in lst if "m" not in out.get(w, {}) and w not in stars and w not in wikt) for n, lst in lists.items()}

    # Spellbright's IPA for its own words (the game prefers it for Star words anyway).
    cur = json.load(open(CURRICULUM, encoding="utf-8"))
    for key in ("year_3_4", "year_5_6"):
        for ch in cur[key]["chapters"]:
            for e in ch["words"]:
                if e["word"] in out or e["word"] in british:
                    out.setdefault(e["word"], {})["i"] = e["ipa"]

    # Shards by first two letters; a shard bigger than SPLIT_AT is split again by
    # the first three letters (index.json lists every shard; the game uses the
    # longest one that starts the word).
    if OUT.exists():
        for f in list(OUT.glob("*.json")) + list((OUT / "wikt").glob("*.json")):
            f.unlink()
    OUT.mkdir(parents=True, exist_ok=True)
    dump = lambda d: json.dumps(d, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    shards = {}
    for w, e in out.items():
        shards.setdefault(w[:2], {})[w] = e
    for k in list(shards):
        if len(dump(shards[k]).encode()) > SPLIT_AT:
            for w in [w for w in shards[k] if len(w) > 2]:
                shards.setdefault(w[:3], {})[w] = shards[k].pop(w)
            if not shards[k]:
                del shards[k]
    # G9: each shard carries a stamp of its own contents ("~"), and index.json
    # lists every shard with its stamp: {"v": 2, "shards": {"ab": stamp, ...}}.
    # The game checks a shard against the index, so an old cached index never
    # pairs silently with new shards (or the reverse): it fetches both afresh.
    sizes = {}
    stamps = {}
    for k, d in sorted(shards.items()):
        stamps[k] = hashlib.sha256(dump(d).encode()).hexdigest()[:10]
        text = dump({**d, "~": stamps[k]})
        (OUT / f"{k}.json").write_text(text, encoding="utf-8")
        sizes[k] = len(text.encode())
    # G9c: Wiktionary's meanings, in their own shards (data/meanings/wikt/,
    # CC BY-SA 4.0), listed in the index under "wikt" with their stamps. The
    # game reads them only for a word whose own shard has no meaning.
    wshards = {}
    for w, e in wikt.items():
        wshards.setdefault(w[:2], {})[w] = e
    for k in list(wshards):
        if len(dump(wshards[k]).encode()) > SPLIT_AT:
            for w in [w for w in wshards[k] if len(w) > 2]:
                wshards.setdefault(w[:3], {})[w] = wshards[k].pop(w)
            if not wshards[k]:
                del wshards[k]
    wstamps = {}
    if wshards:
        (OUT / "wikt").mkdir(exist_ok=True)
    for k, d in sorted(wshards.items()):
        wstamps[k] = hashlib.sha256(dump(d).encode()).hexdigest()[:10]
        (OUT / "wikt" / f"{k}.json").write_text(dump({**d, "~": wstamps[k]}), encoding="utf-8")
    index = {"v": 2, "shards": stamps, **({"wikt": wstamps} if wstamps else {})}
    (OUT / "index.json").write_text(json.dumps(index, sort_keys=True), encoding="utf-8")
    # The notices go with every copy of the data, including the one on the web.
    (ROOT / "wordbright" / "LICENSE-WIKTIONARY.txt").write_text(WIKTIONARY_NOTICE, encoding="utf-8")
    (OUT / "LICENSE.txt").write_text("\n\n".join((ROOT / "wordbright" / f).read_text(encoding="utf-8")
                                              for f in ("LICENSE-WORDNET.txt", "LICENSE-OEWN.txt", "LICENSE-BRITFONE.txt", "LICENSE-WIKTIONARY.txt")), encoding="utf-8")
    if wshards:
        (OUT / "wikt" / "LICENSE.txt").write_text(WIKTIONARY_NOTICE, encoding="utf-8")

    # Report.
    total = sum(sizes.values())
    big = sorted(sizes.items(), key=lambda kv: -kv[1])[:5]
    gz = sum(len(gzip.compress((OUT / f"{k}.json").read_bytes())) for k in sizes)
    print(f"gzipped {gz / 1e6:.1f} MB; index.json {(OUT / 'index.json').stat().st_size} bytes; {len(from_phrase)} meanings from a phrase (eke -> eke out)")
    print(f"{len(out):,} words with something; {len(shards)} shards, {total / 1e6:.1f} MB "
          f"(median {sorted(sizes.values())[len(sizes) // 2] / 1e3:.1f} kB; largest "
          + ", ".join(f"{k} {v / 1e3:.0f} kB" for k, v in big) + ")")
    print(f"{dropped:,} words had WordNet senses but every one was dropped by the child-safety filter")
    for n, lst in lists.items():
        m = sum(1 for w in lst if "m" in out.get(w, {}))
        i = sum(1 for w in lst if "i" in out.get(w, {}))
        o = sum(1 for w in lst if w in from_oewn)
        print(f"  words_{n}: no meaning {before[n]:,} before deriving, {after[n]:,} after ({before[n] - after[n]:,} from a base word)")
        wk = sum(1 for w in lst if w in wikt)
        print(f"  words_{n}: no meaning {after[n]:,} before Wiktionary, {after_wikt[n]:,} after ({wk:,} from Wiktionary)")
        print(f"words_{n}: {len(lst):,} words, meaning {(m + wk) / len(lst):.1%} ({o:,} from OEWN, {wk:,} from Wiktionary), IPA {i / len(lst):.1%}")
    if not args.no_wiktionary:
        print(f"Wiktionary: {len(wikt):,} meanings ({sum(1 for e in wikt.values() if 'd' in e):,} from a base word); "
              f"senses skipped as marked (offensive, vulgar, slur, derogatory, sexual, obsolete, misspelling): {wstats['marked']:,}; "
              f"rejected by the child-safe filters: {wstats['unsafe']:,} senses, leaving {len(wstats['unsafe_words']):,} words without a meaning")


if __name__ == "__main__":
    main()
