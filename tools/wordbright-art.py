#!/usr/bin/env python3
"""
Make the Wordbright / Waystead Game pictures and videos with xAI Grok Imagine.
Prompts live in tools/wordbright-art.json. Files go to wordbright-design/assets-raw/.

The key is read from XAI_API_KEY only. Pass it from the macOS Keychain for one command:

    XAI_API_KEY="$(security find-generic-password -s waystead-game/XAI_API_KEY -w)" \\
      python3 tools/wordbright-art.py portraits

Steps (each one stops; nothing is overwritten unless you ask):
    plan                  show what would be made and the cost (no key needed)
    portraits             4 choices for each character portrait and each hero picture
                          -> assets-raw/options/<file>-1.png ... -4.png
    pick ID N             keep choice N, e.g.  pick pip-portrait 3
    moods                 2 choices of each mood, made FROM the picked portrait (same face)
    videos                the short videos, made from the picked hero pictures

Options:
    --only a,b            only these item ids
    --max-usd X           stop before spending more than X dollars in this run (default 3)
    --redo                make choices again even if they exist
"""
import argparse
import base64
import json
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONF = ROOT / "tools" / "wordbright-art.json"
RAW = ROOT / "wordbright-design" / "assets-raw"
OPT = RAW / "options"
LOG = RAW / "ASSETS.md"
API = "https://api.x.ai/v1"
GEN_MODEL, GEN_PRICE = "grok-imagine-image", 0.02
EDIT_MODEL, EDIT_PRICE = "grok-imagine-image-2.0", 0.04
VIDEO_MODEL, VIDEO_PRICE_SEC, VIDEO_IMG = "grok-imagine-video-1.5-lite", 0.02, 0.01


def load():
    c = json.loads(CONF.read_text())
    return c["style"], {i["id"]: i for i in c["items"]}


def post(key, path, body):
    return request(key, "POST", path, json.dumps(body).encode())


def request(key, method, path, data=None):
    req = urllib.request.Request(API + path, data=data, method=method, headers={
        "Authorization": "Bearer " + key, "Content-Type": "application/json", "User-Agent": "waystead-game/1.0"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:300]
            if e.code in (401, 403):
                sys.exit(f"The key was refused (HTTP {e.code}). Stopping. {msg}")
            if e.code == 404:
                sys.exit(f"No access to this model or endpoint (HTTP 404). Stopping. {msg}")
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


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "waystead-game/1.0"}), timeout=300) as r:
        return r.read()


def image_bytes(resp):
    d = resp["data"][0] if "data" in resp else resp
    if d.get("b64_json"):
        return base64.b64decode(d["b64_json"])
    if d.get("url"):
        return fetch(d["url"])
    raise RuntimeError("no image in the answer: " + json.dumps(resp)[:200])


def save_png(raw, dest):
    tmp = dest.with_suffix(".tmp")
    tmp.write_bytes(raw)
    subprocess.run(["sips", "-s", "format", "png", str(tmp), "--out", str(dest)], check=True, capture_output=True)
    tmp.unlink()


def data_uri(path):
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def log(item, prompt, tool):
    row = f"| {item['file']} | {prompt.replace('|', '/')} | {date.today().isoformat()} | {tool} | Ron (via tools/wordbright-art.py) | |\n"
    with LOG.open("a") as f:
        f.write(row)


def opt_path(item, n):
    stem = Path(item["file"]).stem
    return OPT / f"{stem}-{n}.png"


def cost(items, step):
    total = 0.0
    for i in items:
        if step == "portraits" and i["kind"] == "generate":
            total += i["options"] * GEN_PRICE
        elif step == "moods" and i["kind"] == "edit":
            total += i["options"] * EDIT_PRICE
        elif step == "videos" and i["kind"] == "video":
            total += i["duration"] * VIDEO_PRICE_SEC + VIDEO_IMG
    return total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("step", choices=["plan", "portraits", "pick", "moods", "videos"])
    ap.add_argument("args", nargs="*")
    ap.add_argument("--only", default="")
    ap.add_argument("--max-usd", type=float, default=3.0)
    ap.add_argument("--redo", action="store_true")
    a = ap.parse_args()

    style, items = load()
    only = {x.strip() for x in a.only.split(",") if x.strip()}
    if only - set(items):
        sys.exit("Unknown id: " + ", ".join(sorted(only - set(items))))
    chosen = [i for i in items.values() if not only or i["id"] in only]
    RAW.mkdir(parents=True, exist_ok=True)
    OPT.mkdir(parents=True, exist_ok=True)

    if a.step == "plan":
        for s in ("portraits", "moods", "videos"):
            print(f"{s:10s} about ${cost(chosen, s):.2f}")
        print(f"{'total':10s} about ${sum(cost(chosen, s) for s in ('portraits', 'moods', 'videos')):.2f}")
        for i in chosen:
            have = "kept" if (RAW / i["file"]).exists() else "-"
            print(f"  {i['id']:20s} {i['kind']:8s} {i['file']:24s} {have}")
        return

    if a.step == "pick":
        if len(a.args) != 2 or a.args[0] not in items:
            sys.exit("Use: pick ID N   e.g. pick pip-portrait 3")
        item, n = items[a.args[0]], a.args[1]
        src = opt_path(item, n)
        if not src.exists():
            sys.exit(f"No such choice: {src.name}")
        shutil.copyfile(src, RAW / item["file"])
        print(f"Kept {src.name} as {item['file']}")
        return

    import os
    key = os.environ.get("XAI_API_KEY", "").strip()
    if not key:
        sys.exit("XAI_API_KEY is empty. Pass it from the Keychain (see the top of this file).")

    spent = 0.0
    made = failed = 0
    made_ids = set()
    for i in chosen:
        if a.step == "portraits" and i["kind"] == "generate":
            prompt = style + " " + i["prompt"]
            for n in range(1, i["options"] + 1):
                dest = opt_path(i, n)
                if dest.exists() and not a.redo:
                    continue
                if spent + GEN_PRICE > a.max_usd:
                    sys.exit(f"Stopped at the money limit (${spent:.2f}).")
                try:
                    resp = post(key, "/images/generations", {"model": GEN_MODEL, "prompt": prompt, "n": 1,
                                                             "aspect_ratio": i["aspect"], "response_format": "b64_json"})
                    save_png(image_bytes(resp), dest)
                    spent += GEN_PRICE
                    made += 1
                    made_ids.add(i["id"])
                    print(f"  made {dest.name}  (${spent:.2f} so far)")
                except Exception as ex:
                    failed += 1
                    print(f"  FAILED {dest.name}: {ex}")
        elif a.step == "moods" and i["kind"] == "edit":
            src = RAW / i["source"]
            if not src.exists():
                print(f"  skip {i['id']}: pick {i['source']} first")
                continue
            prompt = style + " " + i["prompt"]
            for n in range(1, i["options"] + 1):
                dest = opt_path(i, n)
                if dest.exists() and not a.redo:
                    continue
                if spent + EDIT_PRICE > a.max_usd:
                    sys.exit(f"Stopped at the money limit (${spent:.2f}).")
                try:
                    resp = post(key, "/images/edits", {"model": EDIT_MODEL, "prompt": prompt,
                                                       "image": {"url": data_uri(src), "type": "image_url"},
                                                       "response_format": "b64_json"})
                    save_png(image_bytes(resp), dest)
                    spent += EDIT_PRICE
                    made += 1
                    made_ids.add(i["id"])
                    print(f"  made {dest.name}  (${spent:.2f} so far)")
                except Exception as ex:
                    failed += 1
                    print(f"  FAILED {dest.name}: {ex}")
        elif a.step == "videos" and i["kind"] == "video":
            src = RAW / i["source"]
            dest = RAW / i["file"]
            if not src.exists():
                print(f"  skip {i['id']}: pick {i['source']} first")
                continue
            if dest.exists() and not a.redo:
                continue
            price = i["duration"] * VIDEO_PRICE_SEC + VIDEO_IMG
            if spent + price > a.max_usd:
                sys.exit(f"Stopped at the money limit (${spent:.2f}).")
            try:
                job = post(key, "/videos/generations", {"model": VIDEO_MODEL, "prompt": i["prompt"],
                                                        "image": {"url": data_uri(src)}, "duration": i["duration"],
                                                        "resolution": "480p", "generate_audio": False})
                rid = job["request_id"]
                print(f"  {i['id']}: started, waiting…")
                for _ in range(120):
                    time.sleep(5)
                    st = request(key, "GET", f"/videos/{rid}")
                    if st.get("status") == "done":
                        dest.write_bytes(fetch(st["video"]["url"]))
                        spent += price
                        made += 1
                        log(i, i["prompt"], VIDEO_MODEL)
                        print(f"  made {dest.name}  (${spent:.2f} so far)")
                        break
                    if st.get("status") == "failed":
                        raise RuntimeError(json.dumps(st.get("error"))[:200])
                else:
                    raise RuntimeError("timed out after 10 minutes")
            except Exception as ex:
                failed += 1
                print(f"  FAILED {i['id']}: {ex}")
    for i in chosen:
        if i["id"] in made_ids:
            log(i, style + " " + i["prompt"], GEN_MODEL if i["kind"] == "generate" else EDIT_MODEL)
    print(f"\nDone: {made} made, {failed} failed, about ${spent:.2f}. Choices are in {OPT.relative_to(ROOT)}/")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
