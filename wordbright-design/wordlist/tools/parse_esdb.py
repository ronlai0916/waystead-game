#!/usr/bin/env python3
"""Read ESDB/SCOWL scowl-pre.txt (data only) and write a British word -> smallest size map.

British = lines with no spelling code, or with spelling B or _ at variant level 0 or '.'.
Keeps only lower-case a-z words; drops abbreviations, prefixes, suffixes, contractions,
non-words, multi-word parts, proper nouns, archaic/uncommon/infrequent forms, US/CA/AU-only
lines and lines in special categories.
Usage: parse_esdb.py scowl-pre.txt out.tsv
"""
import re
import sys

SPEC_TOKEN = re.compile(r'^[ABZCD_][.=?v~V\-@x]?$')
CURLY = re.compile(r'^\{\d+\}$')
WORD = re.compile(r'^[a-z]+$')
BAD_POS = {'abbr', 'pre', 'suf', 'wp', 'we', 'x', 's'}
BAD_ANN = set('-@~!')
OK_LEVEL = {'', '.'}


def spec_ok(tokens):
    """tokens like ['B', 'C', 'D'] or ['A'] or ['_V']; True if British level 0/1."""
    for t in tokens:
        if CURLY.match(t):
            continue
        sp, lv = t[0], t[1:]
        if sp in 'B_' and lv in OK_LEVEL:
            return True
    return False


def is_spec(part):
    toks = part.split()
    return bool(toks) and all(SPEC_TOKEN.match(t) or CURLY.match(t) for t in toks)


def split_top(s, sep=', '):
    """Split on sep outside parentheses."""
    out, depth, cur = [], 0, ''
    i = 0
    while i < len(s):
        c = s[i]
        if c == '(':
            depth += 1
        elif c == ')':
            depth -= 1
        if depth == 0 and s.startswith(sep, i):
            out.append(cur)
            cur = ''
            i += len(sep)
            continue
        cur += c
        i += 1
    if cur:
        out.append(cur)
    return out


def clean_word(w):
    w = w.strip().replace('†', '')
    if not w or w == '-':
        return None
    if w[-1] in BAD_ANN:
        return None
    w = w.rstrip('*')
    return w if WORD.match(w) else None


def main(src, dst):
    best = {}
    with open(src, encoding='utf-8') as f:
        for raw in f:
            line = raw.split('#', 1)[0].rstrip('\n').rstrip()
            if not line:
                continue
            parts = split_top(line, ': ')
            info = parts[0].split()
            sizes = [int(t) for t in info if t.isdigit()]
            if not sizes:
                continue
            size = min(sizes)
            others = [t for t in info if not t.isdigit() and not t.startswith('[')]
            region = [t for t in others if t in ('US', 'GB', 'CA', 'AU')]
            category = [t for t in others if t not in ('US', 'GB', 'CA', 'AU')]
            if category:
                continue
            if region and 'GB' not in region:
                continue
            rest = parts[1:]
            if not rest:
                continue
            if rest[0] == '+':
                continue
            if is_spec(rest[0]):
                if not spec_ok(rest[0].split()):
                    continue
                rest = rest[1:]
            if not rest:
                continue
            lemma_info = rest[0]
            m = re.match(r'^([-@!]?)([^<{(]+?)(?: <([^>]*)>)?(?: [{(].*)?$', lemma_info)
            if not m:
                continue
            gann, lemma, pos = m.group(1), m.group(2), (m.group(3) or '')
            if gann:
                continue
            p, _, pclass = pos.partition('/')
            if p in BAD_POS:
                continue
            if any(k in pclass for k in ('upper', 'name', 'person', 'place')):
                continue
            words = [clean_word(lemma)]
            for entry_part in rest[1:]:
                for e in split_top(entry_part):
                    e = e.strip()
                    if e.startswith('(') and e.endswith(')'):
                        for alt in e[1:-1].split('|'):
                            if ': ' in alt:
                                spec, w = alt.split(': ', 1)
                                if not spec_ok(spec.split()):
                                    continue
                            else:
                                w = alt
                            words.append(clean_word(w))
                    else:
                        words.append(clean_word(e))
            for w in words:
                if w and len(w) >= 2:
                    if w not in best or size < best[w]:
                        best[w] = size
    with open(dst, 'w', encoding='utf-8') as f:
        for w in sorted(best):
            f.write(f'{w}\t{best[w]}\n')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
