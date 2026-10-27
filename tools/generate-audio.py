#!/usr/bin/env python3
"""
Make the British-voice MP3s: one per word (213) and one per letter (26).

Voice: Google Cloud Text-to-Speech, en-GB-Neural2-A (British female).
No API key: it borrows a short-lived token from your gcloud login
(`gcloud auth print-access-token`), so nothing secret is written to disk.

Needs: gcloud installed and logged in, a Google Cloud project with the
Text-to-Speech API enabled, and GCP_PROJECT set to that project's ID.

    GCP_PROJECT=your-project-id python3 tools/generate-audio.py

Safe to re-run: files that already exist are skipped. Ends by rebuilding
site/data/assets.json so the app starts using the new files.
"""
import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
WORDS_DIR = SITE / "assets" / "audio" / "words"
LETTERS_DIR = SITE / "assets" / "audio" / "letters"
ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize"
VOICE = {"languageCode": "en-GB", "name": "en-GB-Neural2-A"}
AUDIO = {"audioEncoding": "MP3", "speakingRate": 0.9, "sampleRateHertz": 24000}


def token():
    try:
        out = subprocess.run(["gcloud", "auth", "print-access-token"],
                             check=True, capture_output=True, text=True)
    except FileNotFoundError:
        sys.exit("gcloud is not installed. Run: brew install --cask google-cloud-sdk")
    except subprocess.CalledProcessError:
        sys.exit("gcloud is not logged in. Run: gcloud auth login")
    return out.stdout.strip()


def synthesize(tok, project, payload_input, dest):
    body = json.dumps({"input": payload_input, "voice": VOICE, "audioConfig": AUDIO}).encode()
    req = urllib.request.Request(ENDPOINT, data=body, method="POST", headers={
        "Authorization": "Bearer " + tok,
        "x-goog-user-project": project,
        "Content-Type": "application/json; charset=utf-8",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        msg = e.read().decode(errors="replace")[:300]
        print(f"  FAILED {dest.name}: HTTP {e.code} {msg}")
        return False
    dest.write_bytes(base64.b64decode(data["audioContent"]))
    return True


def main():
    project = os.environ.get("GCP_PROJECT")
    if not project:
        sys.exit("Set GCP_PROJECT to your Google Cloud project ID first.")
    curriculum = json.loads((SITE / "data" / "curriculum.json").read_text())
    words = sorted({w["word"] for b in ("year_3_4", "year_5_6")
                    for ch in curriculum[b]["chapters"] for w in ch["words"]})
    WORDS_DIR.mkdir(parents=True, exist_ok=True)
    LETTERS_DIR.mkdir(parents=True, exist_ok=True)

    tok = token()
    made = skipped = failed = 0
    jobs = [({"text": w}, WORDS_DIR / f"{w.lower()}.mp3") for w in words]
    jobs += [({"ssml": f'<speak><say-as interpret-as="characters">{L}</say-as></speak>'},
              LETTERS_DIR / f"{L}.mp3") for L in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"]

    for i, (inp, dest) in enumerate(jobs, 1):
        if dest.exists() and dest.stat().st_size > 500:
            skipped += 1
            continue
        if synthesize(tok, project, inp, dest):
            made += 1
            print(f"  [{i}/{len(jobs)}] {dest.name}")
        else:
            failed += 1
        time.sleep(0.05)

    print(f"\nDone: {made} made, {skipped} already there, {failed} failed.")
    subprocess.run([sys.executable, str(ROOT / "tools" / "build-assets-manifest.py")], check=False)
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
