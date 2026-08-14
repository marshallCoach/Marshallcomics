#!/usr/bin/env python3
"""Build comic_roulette.json for the Comic Roulette spinner from
vision_characters_enriched.xlsx (green-confidence rows only).

Implements the Replit handoff's key fix: artist and characters are attached
PER COVER URL (the actual cover artist for that issue + the visually-verified
characters on it), so the spinner can never name an artist who didn't draw the
displayed cover, and never a character not on it.

Output shape (grouped by app publisher group):
  { "DC": { "Batman": [ {url,artist,title,issue}, ... ], ... }, "Marvel": {...}, ... }
"""
import openpyxl, json, re, os
from collections import defaultdict

SRC = "vision_characters_enriched.xlsx"
OUT = "artifacts/comics-inventory/public/comic_roulette.json"


def clean_artist(raw):
    if raw is None:
        return None
    s = str(raw).strip()
    low = s.lower()
    if any(x in low for x in ("various", "unknown", "nan", "verify")):
        # still salvage a clean name if the FIRST pipe segment is a real one
        pass
    s = s.split("|")[0].strip()                     # first pipe segment
    s = re.sub(r"\s*\(.*?\)", "", s).strip()        # drop "(likely)" etc.
    low = s.lower()
    if not s or any(x in low for x in ("various", "unknown", "nan", "verify")):
        return None
    return s


def group(pub):
    p = str(pub or "").strip().lower()
    if p == "dc" or p == "dc comics":
        return "DC"
    if p == "marvel":
        return "Marvel"
    if p == "image":
        return "Image"
    return "Other"


ws = openpyxl.load_workbook(SRC, read_only=True, data_only=True).active
rows = list(ws.iter_rows(values_only=True)); H = list(rows[0]); C = {h: i for i, h in enumerate(H)}

data = defaultdict(lambda: defaultdict(list))
seen = set()
n = 0
for r in rows[1:]:
    if str(r[C["Confidence"]]) != "🟢":
        continue
    url = str(r[C["Cover URL"]] or "").strip()
    if not url or not url.startswith("http"):
        continue
    chars_raw = str(r[C["Visually Verified Characters"]] or "").strip()
    if chars_raw.lower() in ("", "nan", "unknown"):
        continue
    g = group(r[C["Publisher"]])
    artist = clean_artist(r[C["Cover Artist"]])
    title = str(r[C["Title"]] or "").strip()
    issue = str(r[C["Issue"]] or "").strip()
    entry = {"url": url, "artist": artist, "title": title, "issue": issue}
    for ch in [c.strip() for c in chars_raw.split(",") if c.strip()]:
        key = (g, ch, url)
        if key in seen:
            continue
        seen.add(key)
        data[g][ch].append(entry)
        n += 1

# prune ultra-thin characters (need >=1 cover; keep all — the spinner samples)
out = {g: {ch: covers for ch, covers in chars.items()} for g, chars in data.items()}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(out, open(OUT, "w"))
print(f"cover entries: {n}")
for g in ("DC", "Marvel", "Image", "Other"):
    chars = out.get(g, {})
    with_art = sum(1 for cs in chars.values() for c in cs if c["artist"])
    print(f"  {g:7} characters={len(chars):4}  covers={sum(len(cs) for cs in chars.values()):5}  with-artist={with_art}")
print(f"Written: {OUT} ({os.path.getsize(OUT)//1024} KB)")
