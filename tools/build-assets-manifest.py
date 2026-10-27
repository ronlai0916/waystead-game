#!/usr/bin/env python3
"""
Write site/data/assets.json: the pictures and audio files that actually exist.

The app reads this list so it only asks for files that are there (no 404s);
anything missing falls back to a placeholder picture or the device voice.
Run it after adding pictures or audio:

    python3 tools/build-assets-manifest.py
"""
import json
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / "site"


def names(folder, suffix):
    d = SITE / folder
    if not d.is_dir():
        return []
    return sorted(p.name for p in d.iterdir() if p.suffix.lower() == suffix and p.stat().st_size > 0)


def main():
    curriculum = json.loads((SITE / "data" / "curriculum.json").read_text())
    wanted_images = set()
    wanted_words = set()
    for block in ("year_3_4", "year_5_6"):
        for ch in curriculum[block]["chapters"]:
            for w in ch["words"]:
                wanted_images.add(w["image"])
                wanted_words.add(w["word"].lower())

    images = [f for f in names("assets/images", ".jpg") if f in wanted_images]
    words = [f[:-4] for f in names("assets/audio/words", ".mp3") if f[:-4] in wanted_words]
    letters = [f[:-4] for f in names("assets/audio/letters", ".mp3") if len(f) == 5]

    out = {"images": images, "audioWords": words, "audioLetters": letters}
    (SITE / "data" / "assets.json").write_text(json.dumps(out, indent=1) + "\n")
    print(f"assets.json: {len(images)} of {len(wanted_images)} pictures, "
          f"{len(words)} of {len(wanted_words)} word audio, {len(letters)} of 26 letter audio")


if __name__ == "__main__":
    main()
