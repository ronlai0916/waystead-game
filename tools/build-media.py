#!/usr/bin/env python3
"""
Make the web copies of the pictures and videos in wordbright-design/assets-raw/
(the originals stay there). Needs Pillow and ffmpeg (brew install ffmpeg).

    python3 tools/build-media.py

Waystead Game home page (hub/site/home-assets/):
  img/hero-1280.webp, img/hero-800.webp   from wg-hero.png (1280 px is its full size)
  video/welcome.webm, video/welcome.mp4   from wg-welcome.mp4 (no sound)
Wordbright (wordbright/site/assets/videos/):
  <name>-win.webm, <name>-win.mp4         from wb-<name>-win.mp4, 320 px, no sound
  (the poster is assets/characters/<name>-happy-256.webp, made by
  tools/wordbright-characters.py)
"""
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "wordbright-design" / "assets-raw"
HUB = ROOT / "hub" / "site" / "home-assets"
WB_VIDEOS = ROOT / "wordbright" / "site" / "assets" / "videos"
CHARACTERS = ("pip", "ottie", "bramble", "fizz")


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


def video(src, dest_stem, scale, crf_webm, crf_mp4):
    """WebM (VP9) and MP4 (H.264) copies, no sound, small and web-ready."""
    vf = f"scale={scale}:-2:flags=lanczos,fps=24"
    ffmpeg("-i", str(src), "-an", "-vf", vf, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", str(crf_webm),
           "-row-mt", "1", "-deadline", "good", "-pix_fmt", "yuv420p", f"{dest_stem}.webm")
    ffmpeg("-i", str(src), "-an", "-vf", vf, "-c:v", "libx264", "-crf", str(crf_mp4), "-preset", "slow",
           "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart", f"{dest_stem}.mp4")


def kb(path):
    return f"{path.stat().st_size / 1024:,.0f} KB"


def main():
    (HUB / "img").mkdir(parents=True, exist_ok=True)
    (HUB / "video").mkdir(parents=True, exist_ok=True)
    WB_VIDEOS.mkdir(parents=True, exist_ok=True)

    with Image.open(RAW / "wg-hero.png") as im:
        im = im.convert("RGB")
        for width in (1280, 800):
            dest = HUB / "img" / f"hero-{width}.webp"
            im.resize((width, round(im.height * width / im.width)), Image.LANCZOS).save(dest, "WEBP", quality=80, method=6)
            print(f"{dest.relative_to(ROOT)}  {kb(dest)}")

    stem = HUB / "video" / "welcome"
    video(RAW / "wg-welcome.mp4", stem, 736, 40, 30)
    for ext in ("webm", "mp4"):
        print(f"{stem.relative_to(ROOT)}.{ext}  {kb(Path(f'{stem}.{ext}'))}")

    for name in CHARACTERS:
        stem = WB_VIDEOS / f"{name}-win"
        video(RAW / f"wb-{name}-win.mp4", stem, 320, 38, 28)
        for ext in ("webm", "mp4"):
            print(f"{stem.relative_to(ROOT)}.{ext}  {kb(Path(f'{stem}.{ext}'))}")


if __name__ == "__main__":
    main()
