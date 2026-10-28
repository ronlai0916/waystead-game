#!/usr/bin/env python3
"""
Build the Wordbright word graphs and copy the game data into wordbright/site/data/.

Reads wordbright-design/wordlist/words_{starter,steady,full,large,xlarge}.txt and
writes one DAWG (directed acyclic word graph) per list as words_<list>.dawg.
Also copies the three boards and tiles.json, writes star_words.json with one
entry per word ("years" is a list, e.g. busy: ["2", "3-4"]), and puts the two
licence files in wordbright/ (the licences travel with the data).

Run it by hand after the word lists change:

    python3 tools/build-wordgraph.py

File format (read by wordbright/site/js/engine/words.js), all little-endian:
  bytes 0-3    "WBG1"
  bytes 4-7    number of edges (uint32)
  bytes 8-11   number of words (uint32)
  bytes 12-15  longest word (uint32)
  then one uint32 per edge:
    bits 0-4   letter (0 = a … 25 = z)
    bit 5      a word ends here
    bit 6      last edge of this node
    bits 7-31  index of the child node's first edge (0 = no child)
The root node's edges start at index 0. Nodes are shared wherever their
outgoing edges are the same, so common endings ("-ing", "-ness") are stored once.
"""
import gzip
import json
import shutil
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DESIGN = ROOT / "wordbright-design"
WORDLIST = DESIGN / "wordlist"
BOARD = DESIGN / "board"
OUT = ROOT / "wordbright" / "site" / "data"
LISTS = ("starter", "steady", "full", "large", "xlarge")

FINAL = 1 << 5
LAST = 1 << 6
CHILD_SHIFT = 7
MAX_CHILD = (1 << 25) - 1


def read_words(path):
    words = sorted({w.strip() for w in path.read_text().splitlines() if w.strip()})
    for w in words:
        if not w.isascii() or not w.isalpha() or not w.islower():
            sys.exit(f"{path.name}: not a lower-case a-z word: {w!r}")
    return words


def build_trie(words):
    # A node is [is_word, {letter: node}].
    root = [False, {}]
    for w in words:
        node = root
        for ch in w:
            node = node[1].setdefault(ch, [False, {}])
        node[0] = True
    return root


def minimise(root):
    """Give every distinct set of outgoing edges one id (bottom-up).

    Whether a word ends at a node is stored on the edge into it, so two nodes
    with the same outgoing edges share one block even if only one ends a word.
    """
    ids = {(): 0}       # signature -> block id; 0 = the empty block
    blocks = [()]       # block id -> signature

    def visit(node):
        sig = tuple((ch, child[0], visit(child)) for ch, child in sorted(node[1].items()))
        if sig not in ids:
            ids[sig] = len(blocks)
            blocks.append(sig)
        return ids[sig]

    sys.setrecursionlimit(10000)
    return visit(root), blocks


def encode(root_id, blocks):
    # Lay blocks out breadth-first from the root so the root starts at edge 0.
    offset = {}
    order = []
    queue = [root_id]
    pos = 0
    while queue:
        nxt = []
        for b in queue:
            if b in offset or b == 0:
                continue
            offset[b] = pos
            pos += len(blocks[b])
            order.append(b)
            nxt.extend(child for _, _, child in blocks[b])
        queue = nxt
    if pos > MAX_CHILD:
        sys.exit(f"too many edges for the format: {pos}")
    edges = []
    for b in order:
        sig = blocks[b]
        for i, (ch, final, child) in enumerate(sig):
            e = ord(ch) - 97
            if final:
                e |= FINAL
            if i == len(sig) - 1:
                e |= LAST
            e |= (offset[child] if child else 0) << CHILD_SHIFT
            edges.append(e)
    return edges


def check(edges, words):
    """Read the file back the way words.js does and check every word."""
    def is_word(w):
        i = 0
        final = False
        for k, ch in enumerate(w):
            if k and not i:
                return False
            code = ord(ch) - 97
            while True:
                e = edges[i]
                if (e & 31) == code:
                    break
                if e & LAST:
                    return False
                i += 1
            final = bool(e & FINAL)
            i = e >> CHILD_SHIFT
        return final

    def count(i):
        n = 0
        while True:
            e = edges[i]
            if e & FINAL:
                n += 1
            if e >> CHILD_SHIFT:
                n += count(e >> CHILD_SHIFT)
            if e & LAST:
                return n
            i += 1

    missing = [w for w in words if not is_word(w)]
    if missing:
        sys.exit(f"graph check failed, e.g. {missing[:5]}")
    total = count(0)
    if total != len(words):
        sys.exit(f"graph holds {total} words, list has {len(words)}")


def merge_stars(entries):
    """One entry per Star word; "years" becomes a list in school order.
    The first entry's meaning and example are kept."""
    order = ["1", "2", "3-4", "5-6"]
    merged = {}
    for e in entries:
        if e["years"] not in order:
            sys.exit(f"star_words.json: unknown years {e['years']!r} for {e['word']!r}")
        if e["word"] in merged:
            merged[e["word"]]["years"].append(e["years"])
        else:
            merged[e["word"]] = {**e, "years": [e["years"]]}
    for e in merged.values():
        e["years"] = sorted(set(e["years"]), key=order.index)
    return list(merged.values())


def kb(n):
    return f"{n / 1024:,.0f} KB"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    print(f"{'list':8} {'words':>8} {'edges':>8} {'txt':>9} {'dawg':>9} {'gzip':>9}")
    for name in LISTS:
        src = WORDLIST / f"words_{name}.txt"
        words = read_words(src)
        root_id, blocks = minimise(build_trie(words))
        edges = encode(root_id, blocks)
        check(edges, words)
        longest = max(len(w) for w in words)
        data = b"WBG1" + struct.pack("<III", len(edges), len(words), longest)
        data += struct.pack(f"<{len(edges)}I", *edges)
        dest = OUT / f"words_{name}.dawg"
        dest.write_bytes(data)
        gz = len(gzip.compress(data, 9))
        print(f"{name:8} {len(words):>8,} {len(edges):>8,} {kb(src.stat().st_size):>9} "
              f"{kb(len(data)):>9} {kb(gz):>9}")

    for f in ("board_junior.json", "board_standard.json", "board_large.json"):
        shutil.copyfile(BOARD / f, OUT / f)
    shutil.copyfile(WORDLIST / "tiles.json", OUT / "tiles.json")
    stars = merge_stars(json.loads((WORDLIST / "star_words.json").read_text()))
    (OUT / "star_words.json").write_text(json.dumps(stars, indent=1, ensure_ascii=False) + "\n")
    for f in ("LICENSE-ESDB.txt", "LICENSE-LDNOOBW.txt"):
        shutil.copyfile(WORDLIST / f, ROOT / "wordbright" / f)
    print(f"Star words: {len(stars)}")
    print(f"Copied boards, tiles and Star words to {OUT.relative_to(ROOT)}/, licences to wordbright/")


if __name__ == "__main__":
    main()
