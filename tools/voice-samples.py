#!/usr/bin/env python3
"""
Compare British voices before remaking the game's audio.

Makes the same few words in several Google en-GB voices (the newest Chirp 3 HD
voices, the Studio voices and the current Neural2-A) and plays them one after
another, so you can pick the one closest to Cambridge Dictionary's UK audio.
Nothing in the site changes.

    GCP_PROJECT=waystead-game-tts python3 tools/voice-samples.py
    GCP_PROJECT=waystead-game-tts python3 tools/voice-samples.py --words often,minute,interest

Files go to tools/audio-samples/voices/<voice>/<word>.mp3 (not committed).
Uses the gcloud login token, like generate-audio.py. Cost: a few pence.
"""
import argparse
import base64
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "tools" / "audio-samples" / "voices"
API = "https://texttospeech.googleapis.com/v1/"
DEFAULT_WORDS = "interest,medicine,ordinary,vehicle,February,opportunity"


def token():
    out = subprocess.run(["gcloud", "auth", "print-access-token"], capture_output=True, text=True)
    if out.returncode:
        sys.exit("gcloud is not logged in. Run: gcloud auth login")
    return out.stdout.strip()


def call(tok, project, path, body=None):
    req = urllib.request.Request(API + path, method="POST" if body else "GET",
                                 data=json.dumps(body).encode() if body else None, headers={
        "Authorization": "Bearer " + tok, "x-goog-user-project": project,
        "Content-Type": "application/json; charset=utf-8"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--words", default=DEFAULT_WORDS)
    ap.add_argument("--no-play", action="store_true")
    args = ap.parse_args()
    project = os.environ.get("GCP_PROJECT") or sys.exit("Set GCP_PROJECT first.")
    words = [w.strip() for w in args.words.split(",") if w.strip()]
    tok = token()

    voices = call(tok, project, "voices?languageCode=en-GB")["voices"]
    names = sorted(v["name"] for v in voices)
    chirp = [n for n in names if "Chirp3-HD" in n]
    # A spread of Chirp 3 HD voices (they're many), the Studio ones, and today's voice.
    pick = [n for n in chirp if any(k in n for k in ("Aoede", "Kore", "Leda", "Charon", "Puck", "Orus"))][:6]
    pick += [n for n in names if "Studio" in n]
    pick += ["en-GB-Neural2-A"]
    print("Voices:", ", ".join(pick), "\n")

    made = []
    for v in pick:
        d = OUT / v
        d.mkdir(parents=True, exist_ok=True)
        for w in words:
            dest = d / f"{w.lower()}.mp3"
            if not dest.exists():
                try:
                    data = call(tok, project, "text:synthesize", {
                        "input": {"text": w}, "voice": {"languageCode": "en-GB", "name": v},
                        "audioConfig": {"audioEncoding": "MP3"}})
                    dest.write_bytes(base64.b64decode(data["audioContent"]))
                except urllib.error.HTTPError as e:
                    print(f"  {v}: HTTP {e.code} {e.read().decode(errors='replace')[:120]}")
                    break
            made.append((w, v, dest))

    print(f"Made {len(made)} samples in tools/audio-samples/voices/\n")
    if args.no_play:
        return
    for w in words:
        print(f"== {w} ==")
        for (ww, v, dest) in made:
            if ww != w:
                continue
            short = v.replace("en-GB-", "")
            print(f"   {short}")
            subprocess.run(["afplay", str(dest)])
        print()


if __name__ == "__main__":
    main()
