#!/usr/bin/env python3
"""
Make the word pictures with xAI's cheapest image model (grok-imagine-image,
about $0.02 each, so ~$4.30 for all 213).

The key is read from the XAI_API_KEY environment variable only. Pass it from
the macOS Keychain for this one command, so it never sits in a file:

    XAI_API_KEY="$(security find-generic-password -s waystead-game/XAI_API_KEY -w)" \\
      python3 tools/generate-images.py --limit 5

Options:
    --limit N        make at most N new pictures (try 5 first)
    --only a,b,c     (re)make just these words (overwrites them)
    --redo           overwrite pictures that already exist

Pictures go to site/assets/images/<word>.jpg as 512x512 JPEGs (resized with
macOS `sips`). Existing pictures are skipped, so it is safe to re-run.
Ends by rebuilding site/data/assets.json.
"""
import argparse
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
OUT = SITE / "assets" / "images"
PROMPTS = ROOT / "tools" / "image-prompts.json"
ENDPOINT = "https://api.x.ai/v1/images/generations"
MODEL = "grok-imagine-image"
PRICE = 0.02

STYLE = (
    "Flat children's book illustration, friendly and gentle, soft rounded shapes, "
    "simple clean composition with one clear subject in the centre, plain warm cream "
    "background, limited palette of deep teal, warm amber and soft charcoal with a few "
    "natural accent colours, suitable for a 9-year-old in the UK. "
    "No words, no letters, no numbers unless asked, no writing or signs anywhere in the "
    "picture, no logos, no watermark, nothing scary."
)


def call(key, prompt):
    body = json.dumps({
        "model": MODEL,
        "prompt": prompt,
        "n": 1,
        "aspect_ratio": "1:1",
        "response_format": "b64_json",
    }).encode()
    req = urllib.request.Request(ENDPOINT, data=body, method="POST", headers={
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
        "User-Agent": "waystead-game/1.0",
    })
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.loads(r.read())
            return base64.b64decode(data["data"][0]["b64_json"])
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:300]
            if e.code in (429, 500, 502, 503, 504) and attempt < 2:
                time.sleep(5 * (attempt + 1))
                continue
            raise RuntimeError(f"HTTP {e.code}: {msg}")
        except urllib.error.URLError as e:
            if attempt < 2:
                time.sleep(5)
                continue
            raise RuntimeError(str(e.reason))
    raise RuntimeError("no answer after 3 tries")


def save_jpeg(raw, dest):
    with tempfile.NamedTemporaryFile(suffix=".img", delete=False) as t:
        t.write(raw)
        tmp = t.name
    try:
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "78",
                        "-Z", "512", tmp, "--out", str(dest)],
                       check=True, capture_output=True)
    finally:
        os.unlink(tmp)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--only", default="")
    ap.add_argument("--redo", action="store_true")
    args = ap.parse_args()

    key = os.environ.get("XAI_API_KEY", "").strip()
    if not key:
        sys.exit("XAI_API_KEY is empty. Pass it from the Keychain (see the top of this file).")

    prompts = json.loads(PROMPTS.read_text())
    curriculum = json.loads((SITE / "data" / "curriculum.json").read_text())
    entries = [w for b in ("year_3_4", "year_5_6") for ch in curriculum[b]["chapters"] for w in ch["words"]]
    only = {w.strip() for w in args.only.split(",") if w.strip()}
    if only:
        unknown = only - {e["word"] for e in entries}
        if unknown:
            sys.exit("Not in the word list: " + ", ".join(sorted(unknown)))
        entries = [e for e in entries if e["word"] in only]

    OUT.mkdir(parents=True, exist_ok=True)
    made = skipped = failed = 0
    for e in entries:
        dest = OUT / e["image"]
        if dest.exists() and not (args.redo or only):
            skipped += 1
            continue
        if args.limit and made >= args.limit:
            break
        prompt = prompts[e["word"]].rstrip(". ") + ". " + STYLE
        try:
            save_jpeg(call(key, prompt), dest)
            made += 1
            print(f"  made {dest.name}  (${made * PRICE:.2f} so far)")
        except Exception as ex:
            failed += 1
            print(f"  FAILED {e['word']}: {ex}")
            if "HTTP 401" in str(ex) or "HTTP 403" in str(ex):
                sys.exit("The key was refused. Stopping.")

    print(f"\nDone: {made} made (about ${made * PRICE:.2f}), {skipped} already there, {failed} failed.")
    subprocess.run([sys.executable, str(ROOT / "tools" / "build-assets-manifest.py")], check=False)
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
