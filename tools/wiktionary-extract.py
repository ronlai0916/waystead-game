#!/usr/bin/env python3
"""
Extract English Wiktionary senses for Wordbright's words (G9c), once, from the
kaikki.org English extract (JSONL, made by wiktextract from the English
Wiktionary). tools/build-meanings.py then reads the small file this writes.

    curl -L -o <somewhere>/kaikki-en.jsonl.gz \\
      https://kaikki.org/dictionary/English/words/kaikki.org-dictionary-English-words.jsonl.gz
    python3 tools/wiktionary-extract.py <somewhere>/kaikki-en.jsonl.gz

Writes ~/.cache/wordbright-meanings/wiktionary-senses.json.gz (or --out): for
every word in wordbright-design/wordlist/words_xlarge.txt that has an English
entry, its senses in Wiktionary's order, each as
  {"p": part of speech, "g": the gloss, "t": tags, "c": topics and categories,
   "f": the word it is a form of ("plural of", "alternative spelling of" …)}
plus, under "bases", the senses of the words and phrases those senses point to
("noticeboard": "Alternative spelling of notice board"), and the source file's
sha256 and size. Neither file goes in git: the dump is
half a gigabyte, and the build only needs this extract.

Licence: Wiktionary's text is CC BY-SA 4.0 (wordbright/LICENSE-WIKTIONARY.txt).
"""
import argparse
import gzip
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORDLIST = ROOT / "wordbright-design" / "wordlist"
DEFAULT_OUT = Path.home() / ".cache" / "wordbright-meanings" / "wiktionary-senses.json.gz"
SKIP_POS = {"name", "abbrev", "prefix", "suffix", "infix", "interfix", "affix", "circumfix", "symbol", "character",
            "punct", "romanization", "phrase", "proverb", "contraction"}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[1])
    ap.add_argument("dump", type=Path, help="kaikki.org English extract, .jsonl or .jsonl.gz")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    words = {w.strip() for w in open(WORDLIST / "words_xlarge.txt", encoding="utf-8") if w.strip()}
    sha = hashlib.sha256()
    size = 0
    with open(args.dump, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            sha.update(chunk)
            size += len(chunk)
    opener = gzip.open if args.dump.suffix == ".gz" else open

    def senses_of(e):
        out = []
        for s in e.get("senses", []):
            glosses = s.get("glosses") or []
            if not glosses:
                continue
            cats = [c.get("name", "") if isinstance(c, dict) else str(c) for c in s.get("categories", [])]
            f_of = [x.get("word") for x in (s.get("form_of") or []) + (s.get("alt_of") or []) if isinstance(x, dict) and x.get("word")]
            out.append({
                "p": e.get("pos", ""),
                "g": glosses[-1],
                "t": sorted(set(s.get("tags", []))),
                # Topics and the categories that say what a sense is about (not the translation lists).
                "c": sorted({*s.get("topics", []), *(c for c in cats if not c.startswith(("Terms with", "Pages with", "English entries")))}),
                **({"f": f_of[0]} if f_of else {}),
            })
        return out

    def entries():
        # Every English entry, parsed in full: a line has nested "word" keys
        # (derived terms, synonyms) before or after its own, so no shortcut.
        with opener(args.dump, "rt", encoding="utf-8") as f:
            for n, line in enumerate(f, 1):
                if '"lang_code": "en"' not in line:
                    continue
                e = json.loads(line)
                if e.get("lang_code") == "en" and e.get("pos") not in SKIP_POS:
                    yield e
                if n % 500000 == 0:
                    print(f"{n:,} lines read", file=sys.stderr)

    out = {}
    for e in entries():
        w = e.get("word")
        if w in words:
            out.setdefault(w, []).extend(senses_of(e))
    # Second pass: the words and phrases our words are forms or spellings of.
    targets = {sn["f"] for v in out.values() for sn in v if sn.get("f")} - set(out)
    bases = {}
    for e in entries():
        w = e.get("word")
        if w in targets:
            bases.setdefault(w, []).extend(senses_of(e))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(args.out, "wt", encoding="utf-8") as f:
        json.dump({"source": {"file": args.dump.name, "sha256": sha.hexdigest(), "bytes": size}, "senses": out, "bases": bases}, f,
                  ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    print(f"{len(out):,} of our {len(words):,} words have English Wiktionary senses ({len(bases):,} bases); wrote {args.out}")


if __name__ == "__main__":
    main()
