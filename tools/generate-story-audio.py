#!/usr/bin/env python3
"""
Make the Waystead voice's recordings of Story day: one MP3 per sentence, for the
stories already reviewed (site/data/stories.json), named <chapter>-<sentence>.mp3.
The account's voice server speaks single words only, so sentences are made here.
Without these the device's voice reads the story.

Same set-up as generate-audio.py: your gcloud login, no API key.

    GCP_PROJECT=your-project-id python3 tools/generate-story-audio.py
    python3 tools/generate-story-audio.py --dry     just count what's missing

Files that exist are skipped; remake a story with --redo <chapter> after changing
it. Ends by rebuilding site/data/assets.json.
"""
import argparse
import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "site" / "assets" / "audio" / "stories"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--redo", default="")
    a = ap.parse_args()
    stories = [s for s in json.loads((ROOT / "site/data/stories.json").read_text())["stories"] if s["reviewed"]]
    todo = [(f'{s["chapter"]}-{i}', t) for s in stories for i, t in enumerate(s["sentences"])
            if s["chapter"] == a.redo or not (OUT / f'{s["chapter"]}-{i}.mp3').exists()]
    print(f"{len(stories)} reviewed stories, {len(todo)} sentences to make")
    if a.dry or not todo:
        return
    project = os.environ.get("GCP_PROJECT") or sys.exit("Set GCP_PROJECT to your Google Cloud project's ID.")
    spec = importlib.util.spec_from_file_location("audio", ROOT / "tools" / "generate-audio.py")
    audio = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(audio)
    tok = audio.token()
    OUT.mkdir(parents=True, exist_ok=True)
    for key, text in todo:
        audio.synthesize(tok, project, {"text": text}, OUT / f"{key}.mp3")
    subprocess.run([sys.executable, str(ROOT / "tools" / "build-assets-manifest.py")], check=True)


if __name__ == "__main__":
    main()
