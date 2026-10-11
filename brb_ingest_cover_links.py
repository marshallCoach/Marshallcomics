#!/usr/bin/env python3
"""brb_ingest_cover_links.py — merge an exported cover-links file (CSV or JSON)
into covers.json (+ public), so exported Fandom/image links become live covers.

Flexible columns (case-insensitive): Title, Issue, Volume (optional, default 1),
and one of URL / Image URL / Image / Cover URL. Only fills a cover key that is
missing or empty — never overwrites an existing/owned cover. Nothing fabricated:
it only writes the URLs present in your file.

    python3 brb_ingest_cover_links.py <file.csv|file.json>            # merge + write
    python3 brb_ingest_cover_links.py <file> --dry-run               # preview only
    python3 brb_ingest_cover_links.py <file> --force                 # overwrite existing
"""
import argparse, csv, json, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
COVERS = os.path.join(ROOT, "covers.json")
PUBLIC = os.path.join(ROOT, "artifacts/comics-inventory/public/covers.json")

def ni(v):
    s = str(v or "").strip().lstrip("#")
    try:
        f = float(s); return str(int(f)) if f == int(f) else s
    except ValueError:
        return s

def nv(v):
    s = str(v or "").strip()
    return s if s else "1"

def pick(d, *names):
    low = {k.lower().strip(): k for k in d}
    for n in names:
        if n in low:
            return d[low[n]]
    return ""

def rows_from(path):
    if path.lower().endswith(".json"):
        data = json.load(open(path))
        if isinstance(data, dict):
            data = list(data.values())
        return data
    with open(path, newline="") as f:
        return list(csv.DictReader(f))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    if not os.path.exists(a.file):
        sys.exit(f"file not found: {a.file}")
    covers = json.load(open(COVERS))
    added = skipped = nourl = 0
    for r in rows_from(a.file):
        title = str(pick(r, "title", "series", "comic") or "").strip()
        iss = ni(pick(r, "issue", "issue #", "number", "#"))
        vol = nv(pick(r, "volume", "vol"))
        url = str(pick(r, "url", "image url", "image", "cover url", "cover") or "").strip()
        if not title or not iss or not url.startswith("http"):
            nourl += 1
            continue
        key = f"{title}|||{iss}|||{vol}"
        have = covers.get(key) and covers[key].get("url")
        if have and not a.force:
            skipped += 1
            continue
        covers[key] = {"url": url, "volume_name": title, "source": "ingest:cover-links"}
        added += 1
        print(f"  + {title} #{iss} v{vol}", flush=True)
    print(f"\nadded={added} skipped(existing)={skipped} no-url/blank={nourl}")
    if a.dry_run:
        print("DRY RUN — nothing written.")
        return
    for p in (COVERS, PUBLIC):
        json.dump(covers, open(p, "w"), ensure_ascii=False, indent=2)
    print("wrote covers.json and public copy")

if __name__ == "__main__":
    main()
