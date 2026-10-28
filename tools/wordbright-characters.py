#!/usr/bin/env python3
"""
Make the Wordbright computer-player pictures for the site.

Reads the kept pictures in wordbright-design/assets-raw/
(wb-<name>-<mood>.png; names pip, ottie, bramble, fizz; moods portrait,
thinking, happy, surprised) and writes WebP copies at 256 and 128 px to
wordbright/site/assets/characters/<name>-<mood>-<size>.webp. The originals
stay where they are.

    python3 tools/wordbright-characters.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "wordbright-design" / "assets-raw"
OUT = ROOT / "wordbright" / "site" / "assets" / "characters"
NAMES = ("pip", "ottie", "bramble", "fizz")
MOODS = ("portrait", "thinking", "happy", "surprised")
SIZES = (256, 128)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for name in NAMES:
        for mood in MOODS:
            src = RAW / f"wb-{name}-{mood}.png"
            with Image.open(src) as im:
                im = im.convert("RGB")
                side = min(im.size)
                left = (im.width - side) // 2
                top = (im.height - side) // 2
                im = im.crop((left, top, left + side, top + side))
                for size in SIZES:
                    dest = OUT / f"{name}-{mood}-{size}.webp"
                    im.resize((size, size), Image.LANCZOS).save(dest, "WEBP", quality=82, method=6)
                    total += dest.stat().st_size
    count = len(NAMES) * len(MOODS) * len(SIZES)
    print(f"{count} pictures, {total / 1024:,.0f} KB in {OUT.relative_to(ROOT)}/")


if __name__ == "__main__":
    main()
