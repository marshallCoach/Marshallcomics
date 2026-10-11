#!/usr/bin/env python3
"""brb_granov_covers.py — fill covers.json for the Adi Granov checklist books
that aren't in the collection, from the FREE Marvel/DC Fandom wikis.

IMPORTANT: Fandom serves the issue's STANDARD cover. Where Granov drew the main
cover (Iron Man Vol 4 "Extremis", Iron Man 2: Public Identity, etc.) that IS his
art. For 1:25 / 1:50 / anniversary VARIANTS, the standard cover is NOT the Granov
variant — so the Granov page shows these as the issue's cover, never claimed as
Granov. Nothing is fabricated: only real Fandom file URLs are written.

Safe: writes covers.json (+ public copy), and ONLY adds keys that are missing —
never overwrites an existing/owned cover. No API key, no quota.

    python3 brb_granov_covers.py            # resolve + write
    python3 brb_granov_covers.py --dry-run  # preview, write nothing
"""
import argparse, json, os, re, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
COVERS = os.path.join(ROOT, "covers.json")
PUBLIC = os.path.join(ROOT, "artifacts/comics-inventory/public/covers.json")
WIKIS = ["https://marvel.fandom.com/api.php", "https://dc.fandom.com/api.php"]
UA = "BRB-Granov/1.0"
DELAY = 1.2

# (Title, Volume, [issues]) — Granov checklist; key is Title|||Issue|||Vol.
CHECKLIST = [
    ("Iron Man", "4", ["1", "2", "3", "4", "5", "6"]),
    ("Iron Man 2: Public Identity", "1", ["1", "2", "3"]),
    ("Iron Man", "5", ["1"]),
    ("Marvel's Iron Man 3 Prelude", "1", ["1"]),
    ("Amazing Spider-Man", "6", ["52"]),
    ("Deadpool", "6", ["13"]),
    ("Daredevil", "7", ["3"]),
    ("Moon Knight", "7", ["1"]),
    ("Uncanny X-Men", "1", ["524"]),
    ("X-Men Gold", "2", ["30"]),
    ("Thor: Son of Asgard", "1", ["1"]),
    ("She-Hulk", "1", ["1"]),
    ("Necrowar", "1", ["1"]),
    ("Marvel Comics Presents", "1", ["1"]),
    ("Miracleman", "1", ["9"]),
    ("Captain Marvel", "1", ["1"]),
    ("Invincible Iron Man", "1", ["1"]),
    ("Marvel's The Avengers: Black Widow Strikes", "1", ["2"]),
]

_cache = {}
def page(base, title, vol, issue):
    k = (base, title, vol, issue)
    if k in _cache:
        return _cache[k]
    out = None
    try:
        u = base + "?" + urllib.parse.urlencode({"action": "parse", "page": f"{title} Vol {vol} {issue}", "prop": "wikitext", "format": "json", "formatversion": 2, "redirects": 1})
        d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=12))
        time.sleep(DELAY)
        wt = d.get("parse", {}).get("wikitext", "")
        if wt:
            im = re.search(r"\|\s*Image1?\s*=\s*([^\n|]+\.(?:jpg|png|jpeg))", wt, re.I)
            if im:
                out = im.group(1).strip()
    except Exception:
        time.sleep(DELAY)
    _cache[k] = out
    return out

def imgurl(base, fn):
    try:
        u = base + "?" + urllib.parse.urlencode({"action": "query", "titles": "File:" + fn, "prop": "imageinfo", "iiprop": "url", "format": "json", "formatversion": 2})
        d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=12))
        time.sleep(DELAY)
        for p in d.get("query", {}).get("pages", []):
            if "imageinfo" in p:
                return p["imageinfo"][0]["url"].split("/revision/")[0]
    except Exception:
        pass
    return None

def resolve(title, vol, issue):
    for base in WIKIS:
        fn = page(base, title, vol, issue)
        if fn:
            url = imgurl(base, fn)
            if url:
                return url, base.split("//")[1].split(".")[0]
    return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    covers = json.load(open(COVERS))
    added, skipped, missed = 0, 0, []
    for title, vol, issues in CHECKLIST:
        for iss in issues:
            key = f"{title}|||{iss}|||{vol}"
            alt = f"{title}|||{iss}"
            if (covers.get(key) and covers[key].get("url")) or (covers.get(alt) and covers[alt].get("url")):
                skipped += 1
                print(f"  skip (already have): {title} #{iss} v{vol}", flush=True)
                continue
            r = resolve(title, vol, iss)
            if r:
                url, wiki = r
                covers[key] = {"url": url, "volume_name": title, "source": f"fandom:{wiki}", "note": "issue standard cover (Granov checklist)"}
                added += 1
                print(f"  OK   {title} #{iss} v{vol} -> {url[:60]}", flush=True)
            else:
                missed.append(f"{title} #{iss} v{vol}")
                print(f"  MISS {title} #{iss} v{vol}", flush=True)
    print(f"\nadded={added} skipped={skipped} missed={len(missed)}")
    if missed:
        print("missed:", "; ".join(missed))
    if a.dry_run:
        print("\nDRY RUN — nothing written.")
        return
    for p in (COVERS, PUBLIC):
        json.dump(covers, open(p, "w"), ensure_ascii=False, indent=2)
    print(f"\nwrote {COVERS} and {PUBLIC}")

if __name__ == "__main__":
    main()
