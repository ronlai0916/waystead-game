#!/usr/bin/env python3
"""
Make Composition's picture stories with xAI Grok Imagine. Prompts live in
tools/compose-art.json. Raw files go to compose-design/assets-raw/, web versions
(WebP, 1200 px and 600 px wide) to compose/site/assets/stories/.

Picture 1 of a story is generated; pictures 2-4 are made FROM picture 1, so the
same characters stay in all four (as Wordbright's moods are).

The key is read from the macOS Keychain (waystead-game/XAI_API_KEY) inside this
script, when it is needed. It is never printed, logged or written anywhere.

    python3 tools/compose-art.py plan             what would be made, and the cost
    python3 tools/compose-art.py make             make what's missing
    python3 tools/compose-art.py make --only a,b  only these stories
    python3 tools/compose-art.py redo a-3 b-2     make these pictures again
    python3 tools/compose-art.py redo a-1 --from 2   change picture 1, keeping the faces
    python3 tools/compose-art.py web              (re)build the WebP versions

Every call counts towards CALL_CAP, retries and failures included, across runs
(compose-design/assets-raw/calls.json). At the cap it stops.
"""
import argparse
import base64
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONF = ROOT / "tools" / "compose-art.json"
RAW = ROOT / "compose-design" / "assets-raw"
WEB = ROOT / "compose" / "site" / "assets" / "stories"
LOG = RAW / "ASSETS.md"
LEDGER = RAW / "calls.json"
API = "https://api.x.ai/v1/images"
GEN_MODEL, GEN_PRICE = "grok-imagine-image", 0.02
EDIT_MODEL, EDIT_PRICE = "grok-imagine-image-2.0", 0.04
CALL_CAP = 60
HEAD = """# Asset log: Composition picture stories

xAI terms for commercial use: see wordbright-design/assets-raw/ASSETS.md (customer owns Output; do not present it as human-made: credited on For parents).

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
            sys.exit(f"The key was refused (HTTP {e.code}). Stopping.")
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
    if not LOG.exists():
        LOG.write_text(HEAD)
    with LOG.open("a") as f:
        f.write(f"| {name} | {prompt.replace('|', '/')} | {date.today().isoformat()} | {model} | {usd:.2f} | {note} |\n")


def web(path):
    WEB.mkdir(parents=True, exist_ok=True)
    for width in (1200, 600):
        out = WEB / f"{path.stem}-{width}.webp"
        subprocess.run(["cwebp", "-quiet", "-q", "80", "-resize", str(width), "0", str(path), "-o", str(out)], check=True)


def make_one(key, conf, s, n, state, note="", source=1):
    dest = RAW / f"{s['id']}-{n}.png"
    scene = s["pictures"][n - 1]
    if n == 1 and source == 1:
        model, price, path = GEN_MODEL, GEN_PRICE, "/generations"
        prompt = f"{conf['style']} {s['cast']} {scene}"
        body = {"model": model, "prompt": prompt, "n": 1, "aspect_ratio": "4:3", "response_format": "b64_json"}
    else:
        src = RAW / f"{s['id']}-{source}.png"
        if not src.exists():
            print(f"  skip {dest.name}: picture 1 is missing")
            return False
        model, price, path = EDIT_MODEL, EDIT_PRICE, "/edits"
        prompt = f"{conf['style']} {conf['keep']} {s['cast']} {scene}"
        body = {"model": model, "prompt": prompt, "image": {"url": data_uri(src), "type": "image_url"}, "response_format": "b64_json"}
    if state["calls"] >= CALL_CAP:
        sys.exit(f"Stopped at the cap of {CALL_CAP} calls (${state['usd']:.2f}).")
    try:
        resp = call(key, path, body)
    except RuntimeError as ex:
        spend(state, 0)
        print(f"  FAILED {dest.name}: {ex}  (call {state['calls']} of {CALL_CAP})")
        return False
    spend(state, price)
    to_png(resp, dest)
    web(dest)
    log(dest.name, prompt, model, price, note)
    print(f"  made {dest.name}  (call {state['calls']} of {CALL_CAP}, ${state['usd']:.2f})")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("step", choices=["plan", "make", "redo", "web"])
    ap.add_argument("names", nargs="*")
    ap.add_argument("--only", default="")
    ap.add_argument("--from", dest="source", type=int, default=1, help="redo: make from this picture of the story (to change picture 1 without changing the faces)")
    a = ap.parse_args()
    conf = json.loads(CONF.read_text())
    stories = {s["id"]: s for s in conf["stories"]}
    only = {x for x in a.only.split(",") if x}
    if only - set(stories):
        sys.exit("Unknown story: " + ", ".join(sorted(only - set(stories))))
    chosen = [s for s in conf["stories"] if not only or s["id"] in only]
    RAW.mkdir(parents=True, exist_ok=True)
    state = ledger()
    missing = [(s, n) for s in chosen for n in range(1, 5) if not (RAW / f"{s['id']}-{n}.png").exists()]
    if a.step == "plan":
        cost = sum(GEN_PRICE if n == 1 else EDIT_PRICE for _, n in missing)
        print(f"{len(stories)} stories. To make: {len(missing)} pictures, about ${cost:.2f}. Used so far: {state['calls']} of {CALL_CAP} calls, ${state['usd']:.2f}.")
        return
    if a.step == "web":
        for p in sorted(RAW.glob("*-[1-4].png")):
            web(p)
        print("WebP versions rebuilt.")
        return
    key = keychain_key()
    if a.step == "make":
        for s, n in missing:
            make_one(key, conf, s, n, state)
    else:
        for name in a.names:
            sid, n = name.rsplit("-", 1)
            make_one(key, conf, stories[sid], int(n), state, "remade", a.source)
    print(f"Done. {state['calls']} of {CALL_CAP} calls, ${state['usd']:.2f} in all.")


if __name__ == "__main__":
    main()
