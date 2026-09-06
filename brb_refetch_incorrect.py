#!/usr/bin/env python3
"""Refetch the 3 explicitly-flagged 'incorrect cover' books from Comic Vine
(clear the stale covers.json entry, then search with refresh=1 so the proxy
writes the correct year-gated cover). DC titles, which the bulk fillers skip."""
import json, urllib.parse, urllib.request, time, os

PROXY = "http://localhost:5001/api/covers/search"
SET = "http://localhost:5001/api/covers/set"
BOOKS = [  # (title, issue, volume)
    ("Blue Beetle: Rebirth", "1", "1"),
    ("Dawn of DC: Cyborg", "1", "1"),
    ("DC Universe: Last Will and Testament", "1", "1"),
]

for t, iss, vol in BOOKS:
    # clear stale entry
    body = json.dumps({"title": t, "issue": iss, "volume": vol, "url": None, "large": None}).encode()
    try:
        urllib.request.urlopen(urllib.request.Request(SET, data=body, headers={"Content-Type": "application/json"}), timeout=20).read()
    except Exception as e:
        print(f"  set-null failed {t}: {e}")
    q = urllib.parse.urlencode({"title": t, "issue": iss, "volume": vol, "refresh": "1"})
    try:
        with urllib.request.urlopen(f"{PROXY}?{q}", timeout=40) as r:
            d = json.load(r)
        m = d.get("match") or {}
        print(f"  {t} #{iss}: cover={bool(d.get('cover_url'))} cv='{m.get('volume_name')}'")
    except Exception as e:
        print(f"  search failed {t}: {e}")
    time.sleep(0.5)
print("done refetch-incorrect")
