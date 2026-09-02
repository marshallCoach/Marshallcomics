#!/usr/bin/env python3
"""Build comic_roulette.json for the Comic Roulette spinner — TWO datasets:
  "all" — the whole collection
  "cc"  — cover-boxes only (the CC1–CC6 cool-covers display boxes)
Sourced from the canonical inventory (Box + Visually Verified Characters + Cover
Artist) joined to covers.json for the image URL, so both stay in sync with the
current data. Per-cover artist + verified characters = no wrong-artist guessing.

Output shape:
  { "all": { group: { character: [ {url,artist,title,issue} ] } },
    "cc":  { group: { character: [ ... ] } } }
"""
import openpyxl, json, glob, os, re
from collections import defaultdict

# Skip Finder duplicates (" copy.xlsx") — they are never the canonical source.
_cands = [f for f in glob.glob("attached_assets/comics_inventory_*.xlsx") if " copy" not in f]
INV = max(_cands, key=os.path.getmtime)
COVERS = "covers.json"
OUT = "artifacts/comics-inventory/public/comic_roulette.json"


def clean_artist(raw):
    if not raw:
        return None
    s = str(raw).split("|")[0].strip()
    s = re.sub(r"\s*\(.*?\)", "", s).strip()
    low = s.lower()
    if not s or any(x in low for x in ("various", "unknown", "nan", "verify")):
        return None
    return s


def group(pub):
    p = str(pub or "").strip().lower()
    if p in ("dc", "dc comics"): return "DC"
    if p == "marvel": return "Marvel"
    if p == "image": return "Image"
    return "Other"


def ni(v):
    s = str(v).strip().lstrip("#")
    try:
        f = float(s); return str(int(f)) if f == int(f) else s
    except (ValueError, TypeError):
        return s


def nv(v):
    try:
        return str(int(float(str(v).strip())))
    except (ValueError, TypeError):
        return "1"


cov = json.load(open(COVERS))
_by_ti = defaultdict(list)
for k, e in cov.items():
    if e and e.get("url"):
        parts = k.split("|||")
        if len(parts) >= 2:
            _by_ti[(parts[0], parts[1].lstrip("#"))].append((parts[2] if len(parts) > 2 else "1", e["url"]))


def cover_url(t, i, v):
    cands = _by_ti.get((t, i))
    if not cands:
        return None
    for vol, url in cands:
        if vol == v:
            return url
    return cands[0][1]


ws = next(w for w in openpyxl.load_workbook(INV, read_only=True, data_only=True).worksheets
          if w.title.startswith("✅ Clean Inventory"))
rows = list(ws.iter_rows(values_only=True)); H = list(rows[0]); C = {h: i for i, h in enumerate(H) if h}


def s(r, n):
    v = r[C[n]] if n in C and C[n] < len(r) else None
    return str(v).strip() if v is not None else ""


all_d = defaultdict(lambda: defaultdict(list))
cc_d = defaultdict(lambda: defaultdict(list))
seen_all, seen_cc = set(), set()
CC = re.compile(r"CC\d+")
for r in rows[1:]:
    t = s(r, "Title"); i = ni(r[C["Issue #"]] if "Issue #" in C else ""); v = nv(r[C["Volume"]] if "Volume" in C else "")
    chars_raw = s(r, "Visually Verified Characters")
    if not t or not chars_raw or chars_raw.lower() in ("", "nan", "unknown"):
        continue
    url = cover_url(t, i, v)
    if not url:
        continue
    g = group(s(r, "Publisher"))
    char_list = [c.strip() for c in chars_raw.split(",") if c.strip()]
    # n = cast size on this cover. A small cast means the character is a primary
    # subject (a solo/duo cover), not one face in an ensemble/event crowd — the
    # roulette uses it to avoid surfacing crossover covers for a single character.
    entry = {"url": url, "artist": clean_artist(s(r, "Cover Artist")), "title": t, "issue": i, "n": len(char_list)}
    is_cc = bool(CC.fullmatch(s(r, "Box #")))
    for ch in char_list:
        ka = (g, ch, url)
        if ka not in seen_all:
            seen_all.add(ka); all_d[g][ch].append(entry)
        if is_cc and ka not in seen_cc:
            seen_cc.add(ka); cc_d[g][ch].append(entry)

out = {
    "all": {g: {ch: cs for ch, cs in chars.items()} for g, chars in all_d.items()},
    "cc":  {g: {ch: cs for ch, cs in chars.items()} for g, chars in cc_d.items()},
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(out, open(OUT, "w"))
for name, data in (("ALL", out["all"]), ("CC boxes", out["cc"])):
    chars = sum(len(c) for c in data.values()); covers = sum(len(cs) for c in data.values() for cs in c.values())
    print(f"  {name}: characters={chars} cover-entries={covers}  groups={list(data)}")
print(f"Source: {os.path.basename(INV)} + covers.json  ->  {OUT} ({os.path.getsize(OUT)//1024} KB)")
