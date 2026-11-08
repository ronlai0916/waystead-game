#!/usr/bin/env python3
"""
Simple placeholder stickers for Composition's "My own story", drawn as SVG,
for while the Grok art can't be made (see compose-design/assets-raw/ASSETS.md).
They go to compose/site/assets/stickers/ (bg-<id>.svg, char-<id>-a.svg,
char-<id>-b.svg, obj-<id>.svg). No text in any of them.

When tools/compose-stickers.py has made the real art, its WebP files are used
instead: `python3 tools/compose-stickers.py data` writes data/stickers.json
from whichever files are there.

    python3 tools/compose-sticker-placeholders.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONF = ROOT / "tools" / "compose-stickers.json"
OUT = ROOT / "compose" / "site" / "assets" / "stickers"
INK = "#3A2E25"
LINE = f'stroke="{INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"'


def svg(w, h, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{body}</svg>\n'


# ---- backgrounds (400 x 300) -------------------------------------------------------
def tree(x, y, s=1, leaf="#6DB55A"):
    return (f'<rect x="{x - 8 * s}" y="{y - 10 * s}" width="{16 * s}" height="{50 * s}" rx="4" fill="#8A5A3B" {LINE}/>'
            f'<circle cx="{x}" cy="{y - 30 * s}" r="{34 * s}" fill="{leaf}" {LINE}/>')


def room(wall, floor):
    return f'<rect width="400" height="300" fill="{wall}"/><rect y="210" width="400" height="90" fill="{floor}"/><path d="M0 210H400" {LINE}/>'


BGS = {
    "park": '<rect width="400" height="300" fill="#BFE6F7"/><circle cx="340" cy="55" r="26" fill="#FFD95E"/><rect y="190" width="400" height="110" fill="#8ED06C"/>'
            + tree(70, 170) + tree(330, 175, 0.8) + '<path d="M150 300 C190 240 230 230 260 190" fill="none" stroke="#E9D9A8" stroke-width="26" stroke-linecap="round"/>'
            + '<ellipse cx="300" cy="215" rx="45" ry="10" fill="#7CC4E8" ' + LINE + '/>',
    "kitchen": room("#FCE7C8", "#D8B48A") + '<rect x="40" y="60" width="90" height="70" rx="6" fill="#BFE6F7" ' + LINE + '/><path d="M85 60V130M40 95H130" ' + LINE + '/>'
               + '<rect x="230" y="70" width="140" height="60" rx="6" fill="#F4F0E6" ' + LINE + '/><rect x="140" y="190" width="160" height="16" rx="5" fill="#B07A4F" ' + LINE + '/>'
               + '<path d="M160 206V250M280 206V250" ' + LINE + '/><circle cx="220" cy="180" r="12" fill="#F28C5B" ' + LINE + '/>',
    "classroom": room("#E7EEF8", "#C9A97E") + '<rect x="110" y="40" width="180" height="100" rx="6" fill="#FFFFFF" ' + LINE + '/>'
                 + '<rect x="30" y="60" width="40" height="40" fill="#FFC93C" ' + LINE + '/><rect x="330" y="70" width="40" height="40" fill="#F28C5B" ' + LINE + '/>'
                 + '<rect x="60" y="195" width="110" height="14" rx="4" fill="#7CC4E8" ' + LINE + '/><rect x="230" y="195" width="110" height="14" rx="4" fill="#93CF6E" ' + LINE + '/>',
    "beach": '<rect width="400" height="300" fill="#BFE6F7"/><circle cx="70" cy="60" r="28" fill="#FFD95E"/><rect y="150" width="400" height="60" fill="#5DADE2"/>'
             + '<path d="M0 150 Q25 140 50 150 T100 150 T150 150 T200 150 T250 150 T300 150 T350 150 T400 150" fill="none" stroke="#FFFFFF" stroke-width="5"/>'
             + '<rect y="200" width="400" height="100" fill="#F3DFA2"/><path d="M0 200H400" ' + LINE + '/>'
             + '<rect x="290" y="150" width="34" height="50" fill="#F28C5B" ' + LINE + '/><rect x="330" y="150" width="34" height="50" fill="#7CC4E8" ' + LINE + '/>',
    "forest-path": '<rect width="400" height="300" fill="#D7EFC9"/><rect y="200" width="400" height="100" fill="#7DBB5B"/>' + tree(50, 150, 1.1, "#4E9A48") + tree(140, 130, 0.9, "#5FAE4E")
                   + tree(280, 135, 1, "#4E9A48") + tree(360, 150, 1.1, "#5FAE4E") + '<path d="M170 300 C200 250 210 230 205 200" fill="none" stroke="#D9C08C" stroke-width="40" stroke-linecap="round"/>'
                   + '<circle cx="110" cy="250" r="6" fill="#7A6FD8"/><circle cx="300" cy="260" r="6" fill="#7A6FD8"/>',
    "market": '<rect width="400" height="300" fill="#BFE6F7"/><rect y="210" width="400" height="90" fill="#CFC6B8"/><path d="M0 210H400" ' + LINE + '/>'
              + ''.join(f'<rect x="{x}" y="120" width="110" height="90" fill="#F4F0E6" {LINE}/><path d="M{x - 5} 120 L{x + 55} 85 L{x + 115} 120Z" fill="{c}" {LINE}/>'
                        f'<circle cx="{x + 30}" cy="170" r="10" fill="#E2483D" {LINE}/><circle cx="{x + 55}" cy="170" r="10" fill="#93CF6E" {LINE}/><circle cx="{x + 80}" cy="170" r="10" fill="#FFC93C" {LINE}/>'
                        for x, c in ((20, "#F28C5B"), (145, "#7CC4E8"), (270, "#C2346E")))
              + '<path d="M0 40 Q100 70 200 40 T400 40" fill="none" ' + LINE + '/>',
    "snowy-garden": '<rect width="400" height="300" fill="#DCEBF7"/><rect y="180" width="400" height="120" fill="#FFFFFF"/><path d="M0 180 Q100 165 200 180 T400 180" fill="none" ' + LINE + '/>'
                    + ''.join(f'<rect x="{x}" y="140" width="14" height="50" fill="#B07A4F" {LINE}/>' for x in range(20, 400, 46))
                    + '<rect x="290" y="95" width="80" height="70" fill="#9C6B47" ' + LINE + '/><path d="M282 98 L330 68 L378 98Z" fill="#FFFFFF" ' + LINE + '/>'
                    + ''.join(f'<circle cx="{x}" cy="{y}" r="4" fill="#FFFFFF" stroke="{INK}" stroke-width="1.5"/>' for x, y in ((40, 40), (120, 80), (200, 30), (260, 60), (350, 40), (80, 120))),
    "bedroom": room("#E9E1F5", "#C9A97E") + '<rect x="40" y="150" width="170" height="60" rx="10" fill="#7CC4E8" ' + LINE + '/><rect x="40" y="130" width="50" height="30" rx="8" fill="#FFFFFF" ' + LINE + '/>'
               + '<rect x="260" y="50" width="90" height="80" rx="6" fill="#BFE6F7" ' + LINE + '/><path d="M305 50V130" ' + LINE + '/>'
               + '<rect x="260" y="160" width="100" height="50" rx="6" fill="#F28C5B" ' + LINE + '/><ellipse cx="200" cy="255" rx="90" ry="18" fill="#FFC93C" ' + LINE + '/>',
}


# ---- people and pets (240 x 320) ----------------------------------------------------
PEOPLE = {
    # skin, hair, top, legs, shoes, hair style, size
    "amara": ("#8D5524", "#1B1A20", "#FFC93C", "#3B5BDB", "#E2483D", "puff", 0.85),
    "finn": ("#F6D2B8", "#D9682B", "#4E9A48", "#2F5DA8", "#FFFFFF", "short", 0.85),
    "mei": ("#E8C39E", "#1B1A20", "#E2483D", "#E2483D", "#FFC93C", "bob", 0.88),
    "arjun": ("#A86B3C", "#1B1A20", "#3B7DD8", "#8A8A8A", "#F28C5B", "short", 0.8),
    "ruby": ("#F6D2B8", "#F2CF63", "#F29CC0", "#3B5BDB", "#FFFFFF", "pony", 0.85),
    "kofi": ("#5A3A22", "#1B1A20", "#F28C5B", "#24345E", "#4E9A48", "short", 0.9),
    "grandad": ("#F1C9A5", "#FFFFFF", "#9C6B47", "#6B5A45", "#3A2E25", "cap", 1.0),
    "mum": ("#C68B59", "#24345E", "#E0A82E", "#3A3A48", "#3A2E25", "scarf", 1.0),
    "dad": ("#5A3A22", "#1B1A20", "#C93A3A", "#3B5BDB", "#FFFFFF", "beard", 1.0),
    "nana": ("#EBC9A2", "#B9B9B9", "#B79CE0", "#4E9A48", "#6B5A45", "curly", 0.95),
}
EYES = '<circle cx="{l}" cy="{y}" r="5" fill="#1B1A20"/><circle cx="{r}" cy="{y}" r="5" fill="#1B1A20"/>'


def person(id_, pose):
    skin, hair, top, legs, shoes, style, size = PEOPLE[id_]
    s = size
    cx = 120
    head_y = 320 - 300 * s + 40 * s
    hr = 38 * s
    body_top = head_y + hr - 4
    body_h = 110 * s
    leg_top = body_top + body_h - 6
    leg_h = 320 - 12 - leg_top
    b = []
    if id_ == "ruby":  # in a wheelchair: seated, big wheel
        b.append(f'<circle cx="{cx - 10}" cy="250" r="58" fill="#B79CE0" {LINE}/><circle cx="{cx - 10}" cy="250" r="14" fill="#FFFFFF" {LINE}/>')
        b.append(f'<circle cx="{cx + 70}" cy="292" r="16" fill="#B79CE0" {LINE}/>')
        b.append(f'<rect x="{cx - 40}" y="{body_top}" width="80" height="{body_h * 0.85}" rx="26" fill="{top}" {LINE}/>')
        b.append(f'<rect x="{cx - 20}" y="{body_top + body_h * 0.7}" width="80" height="28" rx="12" fill="{legs}" {LINE}/>')
        b.append(f'<rect x="{cx + 40}" y="{body_top + body_h * 0.7}" width="24" height="70" rx="10" fill="{legs}" {LINE}/>')
    else:
        for dx in (-22, 22):
            b.append(f'<rect x="{cx + dx - 14}" y="{leg_top}" width="28" height="{leg_h}" rx="12" fill="{legs}" {LINE}/>')
            b.append(f'<ellipse cx="{cx + dx + (6 if dx > 0 else -6)}" cy="{320 - 14}" rx="22" ry="11" fill="{shoes}" {LINE}/>')
        b.append(f'<rect x="{cx - 44}" y="{body_top}" width="88" height="{body_h}" rx="30" fill="{top}" {LINE}/>')
    # arms: pose a down (or waving), pose b up
    ay = body_top + 18
    if pose == "a":
        b.append(f'<path d="M{cx - 40} {ay} Q{cx - 70} {ay + 40} {cx - 62} {ay + 80}" fill="none" stroke="{top}" stroke-width="22" stroke-linecap="round"/>'
                 f'<path d="M{cx - 40} {ay} Q{cx - 70} {ay + 40} {cx - 62} {ay + 80}" fill="none" stroke="{INK}" stroke-width="3" stroke-linecap="round" opacity=".5"/>'
                 f'<circle cx="{cx - 62}" cy="{ay + 84}" r="11" fill="{skin}" {LINE}/>')
        b.append(f'<path d="M{cx + 40} {ay} Q{cx + 80} {ay - 20} {cx + 82} {ay - 62}" fill="none" stroke="{top}" stroke-width="22" stroke-linecap="round"/>'
                 f'<circle cx="{cx + 82}" cy="{ay - 66}" r="11" fill="{skin}" {LINE}/>')
    else:
        for sgn in (-1, 1):
            b.append(f'<path d="M{cx + 40 * sgn} {ay} Q{cx + 78 * sgn} {ay - 30} {cx + 74 * sgn} {ay - 74}" fill="none" stroke="{top}" stroke-width="22" stroke-linecap="round"/>'
                     f'<circle cx="{cx + 74 * sgn}" cy="{ay - 78}" r="11" fill="{skin}" {LINE}/>')
    # head and hair
    if style == "puff":
        b.append(f'<circle cx="{cx}" cy="{head_y - hr * 0.5}" r="{hr * 1.35}" fill="{hair}" {LINE}/>')
    if style == "scarf":
        b.append(f'<circle cx="{cx}" cy="{head_y}" r="{hr * 1.3}" fill="{hair}" {LINE}/>')
    if style == "curly":
        for dx, dy in ((-30, -20), (0, -36), (30, -20), (-36, 6), (36, 6)):
            b.append(f'<circle cx="{cx + dx * s}" cy="{head_y + dy * s}" r="{17 * s}" fill="{hair}" {LINE}/>')
    if style == "pony":
        b.append(f'<ellipse cx="{cx + hr}" cy="{head_y - 4}" rx="{14 * s}" ry="{32 * s}" fill="{hair}" {LINE}/>')
    b.append(f'<circle cx="{cx}" cy="{head_y}" r="{hr}" fill="{skin}" {LINE}/>')
    if style in ("short", "beard", "pony"):
        b.append(f'<path d="M{cx - hr} {head_y - 4} A{hr} {hr} 0 0 1 {cx + hr} {head_y - 4} Q{cx} {head_y - hr * 0.9} {cx - hr} {head_y - 4}Z" fill="{hair}" {LINE}/>')
    if style == "bob":
        b.append(f'<path d="M{cx - hr - 4} {head_y + hr * 0.5} V{head_y - 6} A{hr + 4} {hr + 4} 0 0 1 {cx + hr + 4} {head_y - 6} V{head_y + hr * 0.5} H{cx + hr * 0.55} V{head_y - hr * 0.35} H{cx - hr * 0.55} V{head_y + hr * 0.5}Z" fill="{hair}" {LINE}/>')
    if style == "cap":
        b.append(f'<path d="M{cx - hr} {head_y - 8} Q{cx} {head_y - hr * 1.5} {cx + hr} {head_y - 8} L{cx + hr + 16} {head_y - 4}Z" fill="#6B5A45" {LINE}/>')
        b.append(f'<path d="M{cx - hr * 0.7} {head_y + hr * 0.45} Q{cx} {head_y + hr * 1.35} {cx + hr * 0.7} {head_y + hr * 0.45}" fill="{hair}" {LINE}/>')
    if style == "beard":
        b.append(f'<path d="M{cx - hr * 0.8} {head_y + hr * 0.3} Q{cx} {head_y + hr * 1.3} {cx + hr * 0.8} {head_y + hr * 0.3}" fill="{hair}" {LINE}/>')
    if style == "scarf":
        b.append(f'<path d="M{cx - hr * 0.95} {head_y + 2} A{hr * 0.95} {hr * 0.95} 0 0 1 {cx + hr * 0.95} {head_y + 2}" fill="none" stroke="{hair}" stroke-width="8"/>')
    ey = head_y - 2
    b.append(EYES.format(l=cx - 13 * s, r=cx + 13 * s, y=ey))
    if style == "short" and id_ == "finn":
        b.append(f'<circle cx="{cx - 13 * s}" cy="{ey}" r="{10 * s}" fill="none" stroke="{INK}" stroke-width="3"/><circle cx="{cx + 13 * s}" cy="{ey}" r="{10 * s}" fill="none" stroke="{INK}" stroke-width="3"/>')
    if style == "curly":
        b.append(f'<circle cx="{cx - 13 * s}" cy="{ey}" r="{10 * s}" fill="none" stroke="{INK}" stroke-width="3"/><circle cx="{cx + 13 * s}" cy="{ey}" r="{10 * s}" fill="none" stroke="{INK}" stroke-width="3"/>')
    mouth = f'M{cx - 12 * s} {head_y + 14 * s} Q{cx} {head_y + (26 if pose == "b" else 22) * s} {cx + 12 * s} {head_y + 14 * s}'
    b.append(f'<path d="{mouth}" fill="{"#FFFFFF" if pose == "b" else "none"}" stroke="{INK}" stroke-width="3.5" stroke-linecap="round"/>')
    b.append(f'<circle cx="{cx - 24 * s}" cy="{head_y + 10 * s}" r="{6 * s}" fill="#F29CC0" opacity=".6"/><circle cx="{cx + 24 * s}" cy="{head_y + 10 * s}" r="{6 * s}" fill="#F29CC0" opacity=".6"/>')
    return svg(240, 320, "".join(b))


def pet(kind, pose):
    if kind == "dog":
        fur, patch = "#B07A4F", "#FFFFFF"
    else:
        fur, patch = "#F28C2B", "#FFFFFF"
    b = []
    tail_up = pose == "a"
    if pose == "a":  # sitting
        b.append(f'<path d="M190 250 Q235 {200 if tail_up else 260} 215 170" fill="none" stroke="{fur}" stroke-width="16" stroke-linecap="round"/>')
        b.append(f'<ellipse cx="140" cy="235" rx="62" ry="70" fill="{fur}" {LINE}/><ellipse cx="140" cy="250" rx="30" ry="40" fill="{patch}" {LINE}/>')
        b.append(f'<ellipse cx="110" cy="305" rx="22" ry="11" fill="{fur}" {LINE}/><ellipse cx="170" cy="305" rx="22" ry="11" fill="{fur}" {LINE}/>')
        hx, hy = 140, 135
    else:  # leaping
        b.append(f'<path d="M210 190 Q240 150 230 120" fill="none" stroke="{fur}" stroke-width="16" stroke-linecap="round"/>')
        b.append(f'<ellipse cx="140" cy="205" rx="85" ry="45" fill="{fur}" {LINE}/>')
        for x, y in ((80, 250), (110, 255), (175, 250), (205, 240)):
            b.append(f'<rect x="{x - 10}" y="{y - 30}" width="20" height="50" rx="10" fill="{fur}" {LINE}/>')
        hx, hy = 70, 150
    if kind == "dog":
        b.append(f'<circle cx="{hx}" cy="{hy}" r="48" fill="{fur}" {LINE}/><ellipse cx="{hx - 44}" cy="{hy + 6}" rx="16" ry="32" fill="#7A5236" {LINE}/><ellipse cx="{hx + 44}" cy="{hy + 6}" rx="16" ry="32" fill="#7A5236" {LINE}/>')
        b.append(f'<ellipse cx="{hx}" cy="{hy + 20}" rx="24" ry="18" fill="{patch}" {LINE}/><ellipse cx="{hx}" cy="{hy + 10}" rx="9" ry="7" fill="#1B1A20"/>')
        b.append(f'<path d="M{hx - 26} {hy + 46} Q{hx} {hy + 58} {hx + 26} {hy + 46}" fill="none" stroke="#C93A3A" stroke-width="8"/>')
    else:
        b.append(f'<path d="M{hx - 40} {hy - 20} L{hx - 34} {hy - 62} L{hx - 8} {hy - 40}Z" fill="{fur}" {LINE}/><path d="M{hx + 40} {hy - 20} L{hx + 34} {hy - 62} L{hx + 8} {hy - 40}Z" fill="{fur}" {LINE}/>')
        b.append(f'<circle cx="{hx}" cy="{hy}" r="46" fill="{fur}" {LINE}/><ellipse cx="{hx}" cy="{hy + 22}" rx="20" ry="14" fill="{patch}" {LINE}/>')
        b.append(f'<path d="M{hx - 6} {hy + 12} L{hx + 6} {hy + 12} L{hx} {hy + 19}Z" fill="#F29CC0"/>')
        for sgn in (-1, 1):
            b.append(f'<path d="M{hx + 20 * sgn} {hy + 20} L{hx + 52 * sgn} {hy + 14}M{hx + 20 * sgn} {hy + 26} L{hx + 52 * sgn} {hy + 30}" stroke="{INK}" stroke-width="2.5"/>')
    eye = "#2E7D32" if kind == "cat" else "#1B1A20"
    b.append(f'<circle cx="{hx - 16}" cy="{hy - 8}" r="6" fill="{eye}"/><circle cx="{hx + 16}" cy="{hy - 8}" r="6" fill="{eye}"/>')
    return svg(240, 320, "".join(b))


# ---- objects (200 x 200) -----------------------------------------------------------
OBJ = {
    "kite": f'<path d="M100 20 L160 85 L100 150 L40 85Z" fill="#E2483D" {LINE}/><path d="M100 20V150M40 85H160" {LINE}/><path d="M100 150 Q120 170 95 185 T110 198" fill="none" {LINE}/>'
            f'<path d="M108 168 l10 -6 l2 10z M96 186 l-10 -4 l2 10z" fill="#FFC93C" {LINE}/>',
    "ball": f'<circle cx="100" cy="100" r="80" fill="#FFFFFF" {LINE}/><path d="M100 20 Q60 100 100 180" fill="#3B7DD8" {LINE}/><path d="M100 20 Q140 100 100 180" fill="#E2483D" {LINE}/><path d="M20 100 Q100 80 180 100" fill="none" {LINE}/>',
    "cake": f'<rect x="35" y="90" width="130" height="80" rx="12" fill="#F7E1C3" {LINE}/><path d="M35 105 Q60 125 82 105 T130 105 T165 105 V95 Q165 90 160 90 H40 Q35 90 35 95Z" fill="#F29CC0" {LINE}/>'
            + ''.join(f'<rect x="{x}" y="50" width="10" height="40" rx="3" fill="#7CC4E8" {LINE}/><path d="M{x + 5} 32 Q{x + 14} 44 {x + 5} 48 Q{x - 4} 44 {x + 5} 32Z" fill="#FFC93C"/>' for x in (65, 95, 125)),
    "map": f'<path d="M20 40 L75 25 L125 40 L180 25 V160 L125 175 L75 160 L20 175Z" fill="#F3DFA2" {LINE}/><path d="M75 25V160M125 40V175" fill="none" {LINE}/>'
           f'<path d="M40 140 Q70 120 90 130 T150 70" fill="none" stroke="#C93A3A" stroke-width="5" stroke-dasharray="4 10" stroke-linecap="round"/><path d="M140 55 l18 18 M158 55 l-18 18" stroke="#C93A3A" stroke-width="6" stroke-linecap="round"/>'
           f'<path d="M40 70 l14 -22 l14 22z" fill="#93CF6E" {LINE}/>',
    "torch": f'<path d="M110 70 L190 30 V170 L110 130Z" fill="#FFF4C2" opacity=".9"/><rect x="20" y="80" width="70" height="40" rx="10" fill="#FFC93C" {LINE}/><path d="M90 70 L115 60 V140 L90 130Z" fill="#9BA3AE" {LINE}/>',
    "umbrella": f'<path d="M20 100 A80 80 0 0 1 180 100 Q160 85 140 100 Q120 85 100 100 Q80 85 60 100 Q40 85 20 100Z" fill="#3B7DD8" {LINE}/><path d="M100 22 Q80 60 60 100 M100 22 Q120 60 140 100" fill="none" stroke="#FFFFFF" stroke-width="6"/>'
                f'<path d="M100 100 V170 Q100 188 82 188 Q68 188 68 174" fill="none" {LINE}/>',
    "teddy": f'<circle cx="62" cy="40" r="20" fill="#A8743E" {LINE}/><circle cx="138" cy="40" r="20" fill="#A8743E" {LINE}/><ellipse cx="100" cy="140" rx="56" ry="52" fill="#A8743E" {LINE}/><circle cx="100" cy="72" r="45" fill="#A8743E" {LINE}/>'
             f'<ellipse cx="100" cy="88" rx="20" ry="15" fill="#E2C49A" {LINE}/><circle cx="100" cy="82" r="6" fill="#1B1A20"/><circle cx="84" cy="62" r="5" fill="#1B1A20"/><circle cx="116" cy="62" r="5" fill="#1B1A20"/>'
             f'<path d="M78 112 L100 122 L122 112 L122 132 L100 122 L78 132Z" fill="#3B7DD8" {LINE}/>',
    "bike": f'<circle cx="50" cy="135" r="38" fill="none" {LINE}/><circle cx="150" cy="135" r="38" fill="none" {LINE}/><path d="M50 135 L85 80 L140 80 L150 135 M85 80 L100 135 L140 80 M100 135 L50 135" fill="none" stroke="#2E9A4A" stroke-width="8" stroke-linejoin="round"/>'
            f'<path d="M78 72 H98 M140 80 L150 60 H166" {LINE}/><rect x="146" y="40" width="40" height="22" rx="4" fill="#E9D9A8" {LINE}/>',
    "boat": f'<path d="M15 110 H185 L160 160 H40Z" fill="#3B7DD8" {LINE}/><path d="M28 125 H172" stroke="#FFFFFF" stroke-width="8"/><path d="M60 105 L20 70 M140 105 L180 70" {LINE}/><path d="M0 172 Q25 160 50 172 T100 172 T150 172 T200 172" fill="none" stroke="#7CC4E8" stroke-width="6"/>',
    "key": f'<circle cx="55" cy="100" r="38" fill="#F2C94C" {LINE}/><circle cx="55" cy="100" r="14" fill="#FFFFFF" {LINE}/><rect x="90" y="90" width="95" height="20" rx="5" fill="#F2C94C" {LINE}/>'
           f'<rect x="150" y="108" width="14" height="28" rx="3" fill="#F2C94C" {LINE}/><rect x="170" y="108" width="12" height="20" rx="3" fill="#F2C94C" {LINE}/>',
    "box": f'<rect x="30" y="75" width="140" height="105" rx="8" fill="#8E5BC8" {LINE}/><rect x="22" y="55" width="156" height="30" rx="6" fill="#8E5BC8" {LINE}/><path d="M100 55V180" stroke="#FFC93C" stroke-width="16"/>'
           f'<path d="M100 55 Q60 10 70 50 Q80 60 100 55 Q120 60 130 50 Q140 10 100 55Z" fill="#FFC93C" {LINE}/>',
    "book": f'<path d="M100 50 Q60 30 15 45 V165 Q60 150 100 170Z" fill="#7CC4E8" {LINE}/><path d="M100 50 Q140 30 185 45 V165 Q140 150 100 170Z" fill="#F28C5B" {LINE}/>'
            f'<path d="M30 70 Q60 62 88 72 M30 95 Q60 87 88 97 M112 72 Q140 62 170 70 M112 97 Q140 87 170 95" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"/>',
    "basket": f'<path d="M50 90 Q100 0 150 90" fill="none" stroke="#B07A4F" stroke-width="12" stroke-linecap="round"/><path d="M25 85 H175 L155 175 H45Z" fill="#D9A55B" {LINE}/>'
              f'<path d="M40 115 H160 M48 145 H152" stroke="#B07A4F" stroke-width="5"/><path d="M60 85 Q80 60 100 85 Q120 62 140 85" fill="#E2483D" {LINE}/>',
    "bucket": f'<path d="M45 70 H155 L140 180 H60Z" fill="#E2483D" {LINE}/><path d="M45 70 Q100 20 155 70" fill="none" {LINE}/><rect x="120" y="10" width="14" height="90" rx="5" fill="#FFC93C" {LINE}/>'
              f'<path d="M108 95 H146 L140 130 Q127 140 114 130Z" fill="#FFC93C" {LINE}/>',
    "balloon": f'<ellipse cx="100" cy="75" rx="58" ry="66" fill="#F28C2B" {LINE}/><path d="M92 140 L108 140 L100 150Z" fill="#F28C2B" {LINE}/><path d="M100 150 Q80 165 100 178 T100 198" fill="none" {LINE}/>'
               f'<ellipse cx="78" cy="50" rx="10" ry="18" fill="#FFFFFF" opacity=".55"/>',
    "snowman": f'<circle cx="100" cy="140" r="52" fill="#FFFFFF" {LINE}/><circle cx="100" cy="62" r="36" fill="#FFFFFF" {LINE}/><path d="M92 66 L130 72 L92 76Z" fill="#F28C2B" {LINE}/>'
               f'<circle cx="88" cy="54" r="4" fill="#1B1A20"/><circle cx="110" cy="54" r="4" fill="#1B1A20"/><path d="M66 94 Q100 108 134 94 L134 104 Q100 118 66 104Z" fill="#C93A3A" {LINE}/>'
               f'<path d="M50 125 L15 100 M150 125 L185 100" stroke="#8A5A3B" stroke-width="6" stroke-linecap="round"/><circle cx="100" cy="130" r="5" fill="#1B1A20"/><circle cx="100" cy="152" r="5" fill="#1B1A20"/>',
}


def main():
    conf = json.loads(CONF.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    n = 0
    for b in conf["backgrounds"]:
        (OUT / f"bg-{b['id']}.svg").write_text(svg(400, 300, BGS[b["id"]]))
        n += 1
    for c in conf["characters"]:
        for pose in ("a", "b"):
            body = pet(c["kind"], pose) if c.get("kind") else person(c["id"], pose)
            (OUT / f"char-{c['id']}-{pose}.svg").write_text(body)
            n += 1
    for o in conf["objects"]:
        (OUT / f"obj-{o['id']}.svg").write_text(svg(200, 200, OBJ[o["id"]]))
        n += 1
    print(f"{n} placeholder stickers in {OUT.relative_to(ROOT)}/")


if __name__ == "__main__":
    main()
