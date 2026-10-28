#!/usr/bin/env python3
"""
Make the British-voice MP3s: one per word (213) and one per letter (26).

Voice: Google Cloud Text-to-Speech, en-GB-Studio-C (British female), chosen
by ear against Cambridge Dictionary's UK audio on 28 Oct 2026.
Each word is spoken from its British IPA in curriculum.json (checked against
Cambridge Dictionary's UK pronunciations, 28 Oct 2026) through an SSML
<phoneme> tag, so the voice never guesses a pronunciation from the spelling.
If the voice refuses the tag for a word, that word is made from plain text
and listed at the end, so you can listen to it.
No API key: it borrows a short-lived token from your gcloud login
(`gcloud auth print-access-token`), so nothing secret is written to disk.

Needs: gcloud installed and logged in, a Google Cloud project with the
Text-to-Speech API enabled, and GCP_PROJECT set to that project's ID.

    GCP_PROJECT=your-project-id python3 tools/generate-audio.py

Options:
    --only a,b,c     (re)make just these words, into tools/audio-samples/
                     so you can listen before changing the site
    --redo           remake every file (all words and letters), e.g. after a voice change

Safe to re-run: files that already exist are skipped. Ends by rebuilding
site/data/assets.json so the app starts using the new files.
"""
import argparse
import base64
import html
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
VOICE = {"languageCode": "en-GB", "name": "en-GB-Studio-C"}
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


def synthesize(tok, project, payload_input, dest, quiet=False):
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
        if not quiet:
            print(f"  FAILED {dest.name}: HTTP {e.code} {msg}")
        return False
    dest.write_bytes(base64.b64decode(data["audioContent"]))
    return True


def make(tok, project, ssml_input, plain, dest, plain_used):
    """SSML first; if this voice refuses it, the plain word (noted for a listen)."""
    if synthesize(tok, project, ssml_input, dest, quiet=True):
        return True
    if synthesize(tok, project, {"text": plain}, dest):
        plain_used.append(plain)
        return True
    return False


def word_ssml(word, ipa):
    # Google's IPA wants the bare symbols: no slashes, no syllable dots.
    ph = ipa.strip().strip("/").replace(".", "")
    return {"ssml": '<speak><phoneme alphabet="ipa" ph="' + html.escape(ph, quote=True) + '">'
                    + html.escape(word) + "</phoneme></speak>"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--redo", action="store_true")
    args = ap.parse_args()
    project = os.environ.get("GCP_PROJECT")
    if not project:
        sys.exit("Set GCP_PROJECT to your Google Cloud project ID first.")
    curriculum = json.loads((SITE / "data" / "curriculum.json").read_text())
    ipa = {w["word"]: w["ipa"] for b in ("year_3_4", "year_5_6")
           for ch in curriculum[b]["chapters"] for w in ch["words"]}
    words = sorted(ipa)
    only = [w.strip() for w in args.only.split(",") if w.strip()]
    if only:
        unknown = [w for w in only if w not in ipa]
        if unknown:
            sys.exit("Not in the word list: " + ", ".join(unknown))
        out = ROOT / "tools" / "audio-samples"
        out.mkdir(exist_ok=True)
        tok = token()
        plain_used = []
        for w in only:
            dest = out / f"{w.lower()}.mp3"
            if make(tok, project, word_ssml(w, ipa[w]), w, dest, plain_used):
                print(f"  {dest.relative_to(ROOT)}   {ipa[w]}" + ("   (plain text)" if w in plain_used else ""))
        print(f"\nListen with:  afplay tools/audio-samples/{only[0].lower()}.mp3")
        return
    WORDS_DIR.mkdir(parents=True, exist_ok=True)
    LETTERS_DIR.mkdir(parents=True, exist_ok=True)

    tok = token()
    made = skipped = failed = 0
    jobs = [(word_ssml(w, ipa[w]), w, WORDS_DIR / f"{w.lower()}.mp3") for w in words]
    jobs += [({"ssml": f'<speak><say-as interpret-as="characters">{L}</say-as></speak>'}, L,
              LETTERS_DIR / f"{L}.mp3") for L in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"]
    plain_used = []

    for i, (inp, plain, dest) in enumerate(jobs, 1):
        if dest.exists() and dest.stat().st_size > 500 and not args.redo:
            skipped += 1
            continue
        if make(tok, project, inp, plain, dest, plain_used):
            made += 1
            print(f"  [{i}/{len(jobs)}] {dest.name}")
        else:
            failed += 1
        time.sleep(0.05)

    print(f"\nDone: {made} made, {skipped} already there, {failed} failed. Voice: {VOICE['name']}.")
    if plain_used:
        print(f"Made from plain text (the voice refused the phonetic hint), worth a listen: {', '.join(plain_used)}")
    else:
        print("Every word was made from its Cambridge-checked phonetic spelling.")
    subprocess.run([sys.executable, str(ROOT / "tools" / "build-assets-manifest.py")], check=False)
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
