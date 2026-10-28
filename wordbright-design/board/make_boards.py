#!/usr/bin/env python3
"""F3: Wordbright boards. Each pattern is given for one-eighth of the board and mirrored
(fourfold rotation + reflection), so every board is symmetric.

Square codes: "." plain, "S" Spark (letter x2), "G" Glow (letter x3),
"H" Shine (word x2), "T" Star (word x3), "*" start square (plain).
Usage: make_boards.py out_dir
"""
import json
import os
import sys

KINDS = {
    'S': {'name': 'Spark', 'letter': 2, 'word': 1},
    'G': {'name': 'Glow', 'letter': 3, 'word': 1},
    'H': {'name': 'Shine', 'letter': 1, 'word': 2},
    'T': {'name': 'Star', 'letter': 1, 'word': 3},
}

# Offsets (i, j) with i >= j >= 0 from the centre. Odd boards: whole squares from the centre
# square. Even board (20x20): i, j count from the four centre squares (0 = touching the centre).
DESIGNS = {
    'junior': {
        'size': 9, 'title': 'Junior', 'cells': {
            'H': [(2, 2)],
            'T': [(3, 3)],
            'G': [(2, 0)],
            'S': [(1, 1), (4, 1)],
        }},
    'standard': {
        'size': 13, 'title': 'Standard', 'cells': {
            'T': [(5, 5)],
            'H': [(2, 2), (5, 2)],
            'G': [(4, 0), (6, 6)],
            'S': [(3, 1), (6, 4), (4, 3)],
        }},
    'large': {
        'size': 20, 'title': 'Large', 'cells': {
            'T': [(7, 3)],
            'H': [(5, 1), (9, 6), (7, 7), (3, 2)],
            'G': [(2, 0), (6, 4), (9, 9)],
            'S': [(4, 0), (8, 2), (6, 1), (9, 1), (5, 3), (8, 5), (4, 2)],
        }},
}


def orbit(i, j):
    pts = set()
    for a, b in ((i, j), (j, i)):
        for sa in (1, -1):
            for sb in (1, -1):
                pts.add((sa * a, sb * b))
    return pts


def build(d):
    n = d['size']
    grid = [['.'] * n for _ in range(n)]
    if n % 2:
        c = n // 2
        place = lambda a, b: (c + a, c + b)
        grid[c][c] = '*'
        start = [[c, c]]
    else:
        h = n // 2
        # offset k on the positive side -> index h + k; on the negative side -> h - 1 - k
        def place(a, b):
            def ix(v):
                return h + v if v >= 0 else h - 1 + (v + 1)
            return ix(a), ix(b)
        start = [[h - 1, h - 1], [h - 1, h], [h, h - 1], [h, h]]
        for r, cc in start:
            grid[r][cc] = '*'
    for code, cells in d['cells'].items():
        for i, j in cells:
            if n % 2:
                pts = orbit(i, j)
            else:
                # even: mirror with -0 handled as separate side: use signed offsets where
                # negative side k maps to -(k+1)
                pts = set()
                for a, b in ((i, j), (j, i)):
                    for sa in (1, -1):
                        for sb in (1, -1):
                            pts.add((a if sa > 0 else -(a + 1), b if sb > 0 else -(b + 1)))
            for a, b in pts:
                r, cc = place(a, b)
                if grid[r][cc] != '.':
                    raise SystemExit(f"clash at {d['title']} {r},{cc}: {grid[r][cc]} vs {code}")
                grid[r][cc] = code
    return grid, start


def counts(grid):
    from collections import Counter
    return dict(Counter(ch for row in grid for ch in row))


def svg(grid, title, cell=28):
    n = len(grid)
    pad = 24
    w = n * cell + 2 * pad
    colours = {'.': '#FFFFFF', '*': '#FFFFFF', 'S': '#D7EFEA', 'G': '#6FC2B4', 'H': '#F7DFB4', 'T': '#E9A23B'}
    labels = {'S': '2L', 'G': '3L', 'H': '2W', 'T': '3W'}
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{w + 30}" viewBox="0 0 {w} {w + 30}" font-family="Manrope, Arial, sans-serif">',
           f'<rect width="{w}" height="{w + 30}" fill="#FAF8F3"/>',
           f'<text x="{pad}" y="18" font-size="14" font-weight="700" fill="#1B1A20">{title} {n}x{n}</text>']
    for r in range(n):
        for c in range(n):
            ch = grid[r][c]
            x, y = pad + c * cell, pad + 6 + r * cell
            out.append(f'<rect x="{x}" y="{y}" width="{cell - 2}" height="{cell - 2}" rx="4" fill="{colours[ch]}" stroke="#E6E1D6"/>')
            if ch in labels:
                fill = '#1B1A20'
                out.append(f'<text x="{x + (cell - 2) / 2}" y="{y + cell / 2 + 3}" font-size="{cell * 0.32:.1f}" text-anchor="middle" font-weight="700" fill="{fill}">{labels[ch]}</text>')
            if ch == '*':
                cx, cy, rr = x + (cell - 2) / 2, y + (cell - 2) / 2, cell * 0.28
                out.append(f'<circle cx="{cx}" cy="{cy}" r="{rr}" fill="#0F8B7E"/>')
    out.append('</svg>')
    return '\n'.join(out)


def main(out):
    os.makedirs(out, exist_ok=True)
    summary = {}
    for key, d in DESIGNS.items():
        grid, start = build(d)
        n = d['size']
        assert all(grid[r][c] == grid[c][r] == grid[n - 1 - r][c] == grid[r][n - 1 - c] for r in range(n) for c in range(n)), key
        data = {'id': key, 'title': d['title'], 'size': n, 'start': start,
                'squares': KINDS, 'grid': [''.join(row) for row in grid]}
        json.dump(data, open(os.path.join(out, f'board_{key}.json'), 'w'), indent=1)
        open(os.path.join(out, f'board_{key}.svg'), 'w').write(svg(grid, d['title']))
        cnt = counts(grid)
        bonus = sum(v for k, v in cnt.items() if k in KINDS)
        summary[key] = {'size': n, 'counts': cnt, 'bonus_share_pct': round(100 * bonus / (n * n), 1)}
    json.dump(summary, open(os.path.join(out, 'board_summary.json'), 'w'), indent=1)
    print(json.dumps(summary, indent=1))


if __name__ == '__main__':
    main(sys.argv[1])
