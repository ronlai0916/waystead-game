#!/usr/bin/env python3
"""
Make Composition's sticker library for "My own story" (C2-2) with xAI Grok
Imagine, in the same picture style as the story pictures (tools/compose-art.py).
Prompts live in tools/compose-stickers.json.

  backgrounds  bg-<id>.png        generated, 4:3, empty scene
  characters   char-<id>-a.png    generated on plain white
               char-<id>-b.png    made FROM pose a, so the face stays the same
  objects      obj-<id>.png       generated on plain white

Raw files go to compose-design/assets-raw/sticker-*.png (git-ignored). Web
versions go to compose/site/assets/stickers/: backgrounds as WebP at 1200 and
600 px wide; characters and objects cut out (the white round them made
transparent, from the edges in, so white eyes and teeth stay) and cropped,
as WebP with alpha at 512 px on the long side.

The key is read from the macOS Keychain (waystead-game/XAI_API_KEY) inside this
script, when it is needed. It is never printed, logged or written anywhere.

    python3 tools/compose-stickers.py plan          what would be made, and the cost
    python3 tools/compose-stickers.py make          make what's missing
    python3 tools/compose-stickers.py redo obj-kite char-finn-b
    python3 tools/compose-stickers.py web           (re)build the web versions
    python3 tools/compose-stickers.py data          write compose/site/data/stickers.json

data/stickers.json lists every sticker with its file: the WebP once it has been
made, else the placeholder SVG (tools/compose-sticker-placeholders.py). make,
redo and web write it too.

Every call counts towards CALL_CAP and USD_CAP, retries and failures included,
across runs (compose-design/assets-raw/sticker-calls.json). At a cap it stops.
"""
import argparse
import base64
import json
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
CONF = ROOT / "tools" / "compose-stickers.json"
RAW = ROOT / "compose-design" / "assets-raw"
WEB = ROOT / "compose" / "site" / "assets" / "stickers"
LOG = RAW / "ASSETS.md"
LEDGER = RAW / "sticker-calls.json"
DATA = ROOT / "compose" / "site" / "data" / "stickers.json"
API = "https://api.x.ai/v1/images"
GEN_MODEL, GEN_PRICE = "grok-imagine-image", 0.02
EDIT_MODEL, EDIT_PRICE = "grok-imagine-image-2.0", 0.04
CALL_CAP, USD_CAP = 80, 5.00
HEAD = """

## Sticker library (Composition 2, "My own story")

Made by tools/compose-stickers.py from tools/compose-stickers.json. Same xAI terms as above.

| File | Prompt | Date | Model | Cost (USD) | Notes |
|---|---|---|---|---|---|
"""


def keychain_key():
    r = subprocess.run(["security", "find-generic-password", "-s", "waystead-game/XAI_API_KEY", "-w"], capture_output=True, text=True)
    if r.returncode != 0 or not r.stdout.strip():
        sys.exit("The Keychain item waystead-game/XAI_API_KEY could not be read.")
    return r.stdout.strip()


def ledger():
    return json.loads(LEDGER.read_text()) if LEDGER.exists() else {"calls": 0, "usd": 0.0}


def spend(state, usd):
    state["calls"] += 1
    state["usd"] = round(state["usd"] + usd, 2)
    LEDGER.write_text(json.dumps(state) + "\n")


def call(key, path, body):
    """One attempt, no hidden retries: every attempt has to be counted."""
    req = urllib.request.Request(API + path, data=json.dumps(body).encode(), method="POST", headers={
        "Authorization": "Bearer " + key, "Content-Type": "application/json", "User-Agent": "waystead-game/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        msg = e.read().decode(errors="replace")[:200]
        if e.code in (401, 403):
            raise PermissionError(f"HTTP {e.code}: {msg}")
        raise RuntimeError(f"HTTP {e.code}: {msg}")
    except urllib.error.URLError as e:
        raise RuntimeError(str(e.reason))


def to_png(resp, dest):
    d = resp["data"][0] if "data" in resp else resp
    if d.get("b64_json"):
        raw = base64.b64decode(d["b64_json"])
    elif d.get("url"):
        with urllib.request.urlopen(urllib.request.Request(d["url"], headers={"User-Agent": "waystead-game/1.0"}), timeout=300) as r:
            raw = r.read()
    else:
        raise RuntimeError("no image in the answer")
    tmp = dest.with_suffix(".tmp")
    tmp.write_bytes(raw)
    subprocess.run(["sips", "-s", "format", "png", str(tmp), "--out", str(dest)], check=True, capture_output=True)
    tmp.unlink()


def data_uri(path):
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def log(name, prompt, model, usd, note=""):
    text = LOG.read_text() if LOG.exists() else ""
    with LOG.open("a") as f:
        if "## Sticker library" not in text:
            f.write(HEAD)
        f.write(f"| {name} | {prompt.replace('|', '/')} | {date.today().isoformat()} | {model} | {usd:.2f} | {note} |\n")


def cutout(path):
    """White round the figure -> transparent, flooding in from the edges only."""
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    mask = Image.new("L", (w, h), 0)
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if min(r, g, b) > 228 and max(r, g, b) - min(r, g, b) < 22:
                mp[x, y] = 255
    draw = ImageDraw.Draw(mask)
    step = 3
    edge = [(x, 0) for x in range(0, w, step)] + [(x, h - 1) for x in range(0, w, step)] + \
           [(0, y) for y in range(0, h, step)] + [(w - 1, y) for y in range(0, h, step)]
    for p in edge:
        if mask.getpixel(p) == 255:
            ImageDraw.floodfill(mask, p, 128)
    alpha = mask.point(lambda v: 0 if v == 128 else 255)
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1))
    out = im.convert("RGBA")
    out.putalpha(alpha)
    box = alpha.point(lambda v: 255 if v > 24 else 0).getbbox()
    if box:
        pad = 8
        box = (max(0, box[0] - pad), max(0, box[1] - pad), min(w, box[2] + pad), min(h, box[3] + pad))
        out = out.crop(box)
    return out


def web(path):
    WEB.mkdir(parents=True, exist_ok=True)
    stem = path.stem.removeprefix("sticker-")
    if stem.startswith("bg-"):
        for width in (1200, 600):
            out = WEB / f"{stem}-{width}.webp"
            subprocess.run(["cwebp", "-quiet", "-q", "80", "-resize", str(width), "0", str(path), "-o", str(out)], check=True)
        return
    im = cutout(path)
    scale = 512 / max(im.size)
    if scale < 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    im.save(WEB / f"{stem}-512.webp", "WEBP", quality=82, method=6)


def write_data(conf):
    """The sticker list the game reads: WebP where made, else the placeholder SVG."""
    def pick(stem, sizes):
        made = all((WEB / f"{stem}-{w}.webp").exists() for w in sizes)
        return {str(w): f"assets/stickers/{stem}-{w}.webp" for w in sizes} if made else {str(w): f"assets/stickers/{stem}.svg" for w in sizes}
    out = {
        "_meta": {"note": "Written by tools/compose-stickers.py data: never edit by hand. Names are what the game says aloud. Placed stickers are saved as data (id, x, y, size), never as pictures."},
        "backgrounds": [{"id": b["id"], "name": b["name"], "src": pick(f"bg-{b['id']}", (600, 1200))} for b in conf["backgrounds"]],
        "characters": [{"id": c["id"], "name": c["name"], **({"kind": c["kind"]} if c.get("kind") else {}),
                        "poses": {p: pick(f"char-{c['id']}-{p}", (512,))["512"] for p in ("a", "b")}} for c in conf["characters"]],
        "objects": [{"id": o["id"], "name": o["name"], "src": pick(f"obj-{o['id']}", (512,))["512"]} for o in conf["objects"]],
    }
    DATA.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    made = sum(1 for p in WEB.glob("*.webp")) if WEB.exists() else 0
    print(f"data/stickers.json written ({made} WebP files, the rest placeholders).")


def jobs(conf):
    """Every sticker as (name, kind, prompt pieces)."""
    out = []
    for b in conf["backgrounds"]:
        out.append((f"bg-{b['id']}", "gen", f"{conf['style']} {conf['background']} {b['scene']}", "4:3", None))
    for c in conf["characters"]:
        out.append((f"char-{c['id']}-a", "gen", f"{conf['style']} {conf['cutout']} {c['who']} Pose: {c['a']}.", "3:4", None))
        out.append((f"char-{c['id']}-b", "edit", f"{conf['style']} {conf['keep']} {c['who']} New pose: {c['b']}.", None, f"char-{c['id']}-a"))
    for o in conf["objects"]:
        out.append((f"obj-{o['id']}", "gen", f"{conf['style']} {conf['cutout']} {o['what']}", "1:1", None))
    return out


def make_one(key, job, state, note=""):
    name, kind, prompt, aspect, source = job
    dest = RAW / f"sticker-{name}.png"
    if kind == "gen":
        model, price, path = GEN_MODEL, GEN_PRICE, "/generations"
        body = {"model": model, "prompt": prompt, "n": 1, "aspect_ratio": aspect, "response_format": "b64_json"}
    else:
        src = RAW / f"sticker-{source}.png"
        if not src.exists():
            print(f"  skip {dest.name}: {src.name} is missing")
            return False
        model, price, path = EDIT_MODEL, EDIT_PRICE, "/edits"
        body = {"model": model, "prompt": prompt, "image": {"url": data_uri(src), "type": "image_url"}, "response_format": "b64_json"}
    if state["calls"] >= CALL_CAP or state["usd"] + price > USD_CAP:
        sys.exit(f"Stopped at the cap ({state['calls']} calls, ${state['usd']:.2f}).")
    try:
        resp = call(key, path, body)
    except PermissionError as ex:
        spend(state, 0)
        sys.exit(f"The key was refused ({ex}). Stopping after call {state['calls']}.")
    except RuntimeError as ex:
        spend(state, 0)
        print(f"  FAILED {dest.name}: {ex}  (call {state['calls']} of {CALL_CAP})")
        return False
    spend(state, price)
    to_png(resp, dest)
    web(dest)
    log(dest.name, prompt, model, price, note)
    print(f"  made {dest.name}  (call {state['calls']} of {CALL_CAP}, ${state['usd']:.2f})", flush=True)
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("step", choices=["plan", "make", "redo", "web", "data"])
    ap.add_argument("names", nargs="*")
    a = ap.parse_args()
    conf = json.loads(CONF.read_text())
    all_jobs = jobs(conf)
    by_name = {j[0]: j for j in all_jobs}
    RAW.mkdir(parents=True, exist_ok=True)
    state = ledger()
    missing = [j for j in all_jobs if not (RAW / f"sticker-{j[0]}.png").exists()]
    if a.step == "plan":
        cost = sum(GEN_PRICE if j[1] == "gen" else EDIT_PRICE for j in missing)
        print(f"{len(all_jobs)} stickers. To make: {len(missing)}, about ${cost:.2f}. Used so far: {state['calls']} of {CALL_CAP} calls, ${state['usd']:.2f} of ${USD_CAP:.2f}.")
        return
    if a.step == "data":
        write_data(conf)
        return
    if a.step == "web":
        for p in sorted(RAW.glob("sticker-*.png")):
            web(p)
        print("Web versions rebuilt.")
        write_data(conf)
        return
    key = keychain_key()
    if a.step == "make":
        # pose a before pose b: the list is already in that order
        for j in missing:
            make_one(key, j, state)
    else:
        unknown = [n for n in a.names if n not in by_name]
        if unknown:
            sys.exit("Unknown sticker: " + ", ".join(unknown))
        for n in a.names:
            make_one(key, by_name[n], state, "remade")
    write_data(conf)
    print(f"Done. {state['calls']} of {CALL_CAP} calls, ${state['usd']:.2f} in all.")


if __name__ == "__main__":
    main()
