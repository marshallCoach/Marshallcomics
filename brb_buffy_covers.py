#!/usr/bin/env python3
"""brb_buffy_covers.py — fetch real Buffy Season Eight cover URLs from the Buffy
Fandom wiki, using the EXACT cover file names (no guessing), and merge into
covers.json (+ public). Also writes buffy_s8_links.csv (issue, image URL, file
page URL). Free, no API key. Run on the Mac — the cloud session's egress blocks
fandom.com.

    python3 brb_buffy_covers.py            # fetch + write
    python3 brb_buffy_covers.py --dry-run  # preview only
"""
import argparse, csv, json, os, re, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
COVERS = os.path.join(ROOT, "covers.json")
PUBLIC = os.path.join(ROOT, "artifacts/comics-inventory/public/covers.json")
API = "https://buffy.fandom.com/api.php"
WIKI = "https://buffy.fandom.com/wiki/"
UA = "BRB-Buffy/1.0"
DELAY = 1.0
TITLE = "Buffy the Vampire Slayer: Season Eight"   # must match the inventory Title
EXTS = [".jpg", ".png", ".jpeg", ".webp", ".gif"]

# issue -> Fandom cover file basename (from Robert's Season Eight data).
COVERS_BY_ISSUE = {
    1: "BuffyS8-01", 2: "BuffyS8-02", 3: "BuffyS8-03", 4: "BuffyS8-04", 5: "BuffyS8-05",
    6: "BuffyS8-06", 7: "BuffyS8-07", 8: "BuffyS8-08", 9: "BuffyS8-09", 10: "BuffyS8-10",
    11: "BuffyS8-11", 12: "BuffyS8-12", 13: "BuffyS8-13", 14: "BuffyS8-14", 15: "BuffyS8-15",
    16: "BuffyS8-16", 17: "BuffyS8-17", 18: "BuffyS8-18", 19: "BuffyS8-19", 20: "BuffyS8-20",
    21: "Buffy21a", 22: "Buffy22v1", 23: "BuffyS8-23a", 24: "BuffyS8x24", 25: "Buffy25a",
    26: "Buffy26a", 27: "Buffy27a", 28: "Buffy28a", 29: "Buffy29a", 30: "Buffy30a",
    31: "Buffy31a", 32: "Buffy32a", 33: "Buffy33a", 34: "Btvs34", 35: "BuffySeason8 35",
    36: "B8-36-00a", 37: "B8-37-00a", 38: "38.1", 39: "Buffy2 39 fc fnl", 40: "Buffy40a",
}

def imageinfo(filetitle):
    try:
        u = API + "?" + urllib.parse.urlencode({"action": "query", "titles": "File:" + filetitle,
            "prop": "imageinfo", "iiprop": "url", "format": "json", "formatversion": 2})
        d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=12))
        time.sleep(DELAY)
        for p in d.get("query", {}).get("pages", []):
            if "imageinfo" in p and not p.get("missing"):
                return p["imageinfo"][0]["url"].split("/revision/")[0]
    except Exception:
        time.sleep(DELAY)
    return None

def resolve(base):
    for ext in EXTS:
        url = imageinfo(base + ext)
        if url:
            return url, base + ext
    return None, None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    covers = json.load(open(COVERS))
    links, added, skipped, missed = [], 0, 0, []
    for iss in sorted(COVERS_BY_ISSUE):
        base = COVERS_BY_ISSUE[iss]
        key = f"{TITLE}|||{iss}|||1"
        if covers.get(key) and covers[key].get("url"):
            skipped += 1
            print(f"  skip (have): #{iss}", flush=True)
            continue
        url, fname = resolve(base)
        page = WIKI + urllib.parse.quote(fname.replace(" ", "_")) if fname else ""
        if url:
            covers[key] = {"url": url, "volume_name": TITLE, "source": "fandom:buffy", "note": "Season Eight cover"}
            links.append((iss, url, "File:" + fname, page))
            added += 1
            print(f"  OK   #{iss:<2} {fname} -> {url[:58]}", flush=True)
        else:
            missed.append(iss)
            print(f"  MISS #{iss:<2} {base} (tried {','.join(EXTS)})", flush=True)
    print(f"\nadded={added} skipped={skipped} missed={missed}")
    if a.dry_run:
        print("DRY RUN — nothing written.")
        return
    for p in (COVERS, PUBLIC):
        json.dump(covers, open(p, "w"), ensure_ascii=False, indent=2)
    with open(os.path.join(ROOT, "buffy_s8_links.csv"), "w", newline="") as f:
        w = csv.writer(f); w.writerow(["Issue", "Image URL", "Fandom file", "Fandom file page"])
        for row in links:
            w.writerow(row)
    print(f"wrote covers.json, public copy, and buffy_s8_links.csv")

if __name__ == "__main__":
    main()
