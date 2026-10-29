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

Run it by hand after the word list changes:

    python3 tools/build-meanings.py
    python3 tools/build-meanings.py --sources ~/somewhere   # where the downloads live

Shard format: {"word": entry, ...}; entry fields, each only when known:
  p  part of speech (noun, verb, adjective, adverb)
  m  meaning
  e  example
  l  lemma, when it is not the word itself ("running": l "run")
  i  British IPA, e.g. "/ˈrʌnɪŋ/"
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

BAD_USAGE = {"obscenity", "vulgarism", "ethnic_slur", "disparagement", "profanity", "slang", "slang_expression",
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

# Phrases that mark a sense as unsuitable even without a blocked word.
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
                if line.startswith(" "):
                    continue
                t = line.split()
                n_ptr = int(t[3])
                n_syn = int(t[2])
                self.index[(t[0], p)] = t[6 + n_ptr:6 + n_ptr + n_syn]
            for line in open(d / f"data.{f}", encoding="utf-8"):
                if not line.startswith(" "):
                    self.data[(line[:8], p)] = line
            for line in open(d / f"{f}.exc", encoding="utf-8"):
                t = line.split()
                self.exc.setdefault((t[0], p), []).extend(t[1:])
        for line in open(d / "index.sense", encoding="utf-8"):
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


def load_blocklist():
    spec = importlib.util.spec_from_file_location("build_lists", WORDLIST / "tools" / "build_lists.py")
    bl = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bl)
    words = set(MEANING_BLOCK) | set(bl.OWN_BLOCK)
    for line in open(WORDLIST / "excluded_full.txt", encoding="utf-8"):
        w, _, why = line.rstrip("\n").partition("\t")
        if not why.startswith("2-letter"):
            words.add(w)
    words -= set(bl.ALLOW_BACK)
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


def prune_lists(wn):
    """Remove from every word list each word whose senses (its own, or its lemma's)
    are all marked obscene, vulgar, a slur, disparaging or profane. Star words stay.
    The words go into wordlist/wordnet_block.txt (build_lists.py blocks them on a
    rebuild) and excluded_full.txt."""
    bad = wn.offsets_named(OFFENSIVE_USAGE)
    xl = [w.strip() for w in open(WORDLIST / "words_xlarge.txt", encoding="utf-8") if w.strip()]
    stars = {e["word"] for e in json.load(open(WORDLIST / "star_words.json", encoding="utf-8"))}
    found = []
    for w in xl:
        marks = [any(sym == ";u" and (o, q) in bad for sym, o, q in wn.synset(off, p)[1])
                 for p in POS_FILES for l in wn.lemmas(w, p) for off in wn.index[(l, p)] if l in wn.synset(off, p)[3]]
        if marks and all(marks) and w not in stars:
            found.append(w)
    old = {l.strip() for l in PRUNED.read_text().splitlines() if l.strip() and not l.startswith("#")} if PRUNED.exists() else set()
    gone = sorted(old | set(found))
    PRUNED.write_text("# Every WordNet sense is offensive (tools/build-meanings.py --prune-lists).\n" + "\n".join(gone) + "\n")
    drop = set(gone)
    for n in ("starter", "steady", "full", "large", "xlarge"):
        f = WORDLIST / f"words_{n}.txt"
        words = [w.strip() for w in open(f, encoding="utf-8") if w.strip()]
        kept = [w for w in words if w not in drop]
        f.write_text("\n".join(kept) + "\n")
        print(f"words_{n}: removed {len(words) - len(kept)}")
    ex = WORDLIST / "excluded_full.txt"
    rows = dict(l.rstrip("\n").split("\t", 1) for l in open(ex, encoding="utf-8") if "\t" in l)
    for w in gone:
        rows.setdefault(w, "every WordNet sense offensive")
    ex.write_text("".join(f"{w}\t{rows[w]}\n" for w in sorted(rows)))
    print(f"{len(gone)} words whose every WordNet sense is offensive: " + " ".join(gone))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[1])
    ap.add_argument("--sources", type=Path, default=Path.home() / ".cache" / "wordbright-meanings")
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

    write_licences(args.sources, wn_dir)
    wn = WordNet(wn_dir)
    if args.prune_lists:
        prune_lists(wn)
    blocked, roots = load_blocklist()
    bad_usage = wn.offsets_named(BAD_USAGE)
    bad_topic = wn.offsets_named(BAD_TOPIC)
    pron = britfone(bf)

    lists = {n: [w.strip() for w in open(WORDLIST / f"words_{n}.txt", encoding="utf-8") if w.strip()]
             for n in ("starter", "steady", "full", "xlarge")}
    words = lists["xlarge"]
    british = set(words)

    def unsafe(text):
        low = text.lower()
        if MEANING_PHRASES.search(low):
            return True
        for tok in re.findall(r"[a-z]+", low):
            if tok in blocked or any(r in tok for r in roots):
                return True
        return False

    unsafe_seen = set()  # words with a sense the child-safety filter dropped

    def first_safe_sense(lemma, p, w):
        for off in wn.senses(lemma, p):
            ss_type, ptrs, gloss, members = wn.synset(off, p)
            # WordNet's index is lower case, so "it" also finds IT and "us" the US:
            # a sense counts only if the word is written in lower case there.
            if lemma not in members:
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

    out = {}
    dropped = 0
    for w in words:
        entry = {}
        cands = [(wn.weight(l, p) * (1.2 if l == w else 1), l, p) for p in POS_FILES for l in wn.lemmas(w, p)]
        cands.sort(key=lambda c: -c[0])
        for _, lemma, p in cands:
            s = first_safe_sense(lemma, p, w)
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
        if w in unsafe_seen and "m" not in entry:
            dropped += 1
        if w in OWN_MEANINGS:
            pos, meaning, example = OWN_MEANINGS[w]
            entry = {"p": pos, "m": meaning}
            if example:
                entry["e"] = example
        sound = pron.get(w) or inflected_ipa(w, pron)
        if sound:
            entry["i"] = sound
        if entry and not BANNED_TERMS.search(w + " " + " ".join(entry.values())):
            out[w] = entry

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
        for f in OUT.glob("*.json"):
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
    sizes = {}
    for k, d in sorted(shards.items()):
        text = dump(d)
        (OUT / f"{k}.json").write_text(text, encoding="utf-8")
        sizes[k] = len(text.encode())
    (OUT / "index.json").write_text(json.dumps(sorted(shards)), encoding="utf-8")
    # The notices go with every copy of the data, including the one on the web.
    (OUT / "LICENSE.txt").write_text("\n\n".join((ROOT / "wordbright" / f).read_text(encoding="utf-8")
                                              for f in ("LICENSE-WORDNET.txt", "LICENSE-BRITFONE.txt")), encoding="utf-8")

    # Report.
    total = sum(sizes.values())
    big = sorted(sizes.items(), key=lambda kv: -kv[1])[:5]
    gz = sum(len(gzip.compress((OUT / f"{k}.json").read_bytes())) for k in sizes)
    print(f"gzipped {gz / 1e6:.1f} MB; index.json {len(json.dumps(sorted(shards)))} bytes")
    print(f"{len(out):,} words with something; {len(shards)} shards, {total / 1e6:.1f} MB "
          f"(median {sorted(sizes.values())[len(sizes) // 2] / 1e3:.1f} kB; largest "
          + ", ".join(f"{k} {v / 1e3:.0f} kB" for k, v in big) + ")")
    print(f"{dropped:,} words had WordNet senses but every one was dropped by the child-safety filter")
    for n, lst in lists.items():
        m = sum(1 for w in lst if "m" in out.get(w, {}))
        i = sum(1 for w in lst if "i" in out.get(w, {}))
        print(f"words_{n}: {len(lst):,} words, meaning {m / len(lst):.1%}, IPA {i / len(lst):.1%}")


if __name__ == "__main__":
    main()
