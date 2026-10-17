#!/usr/bin/env python3
"""brb_gen_fandom_links.py — collect every Fandom link supplied so far into a small
JSON the app can read, so pages (Missing Covers, Data Fix) can show which books
already have a link on file. Scans the data-fix exports in ~/Downloads and the
consumed copies in processed_exports/.

Writes artifacts/comics-inventory/public/fandom_links.json, keyed
"title.lower()|||issue" (issue without a leading #). Regenerated every deploy.
"""
import glob, json, os, re

ROOT = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS = os.path.expanduser("~/Downloads")
PROCESSED = os.path.join(ROOT, "processed_exports")
OUT = os.path.join(ROOT, "artifacts/comics-inventory/public/fandom_links.json")


def key(title, issue):
    return f"{str(title or '').strip().lower()}|||{re.sub(r'^#', '', str(issue or '').strip())}"


def main():
    links = {}
    files = 0
    for d in (DOWNLOADS, PROCESSED):
        for f in glob.glob(os.path.join(d, "*.json")):
            if "data-fix" not in os.path.basename(f).lower():
                continue
            try:
                recs = json.load(open(f))
            except Exception:  # noqa: BLE001
                continue
            files += 1
            for rec in (recs if isinstance(recs, list) else []):
                if not isinstance(rec, dict):
                    continue
                url = rec.get("value") or rec.get("url") or ""
                title = rec.get("title")
                if "/wiki/" in url and title:
                    links[key(title, rec.get("issue"))] = url
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(dict(sorted(links.items())), open(OUT, "w"), indent=0)
    print(f"fandom_links.json: {len(links)} link(s) from {files} export file(s)")


if __name__ == "__main__":
    main()
