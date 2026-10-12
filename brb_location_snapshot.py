#!/usr/bin/env python3
"""brb_location_snapshot.py — regenerate the "Where is it?" (Location Check)
snapshot from the generated data3.ts, so the snapshot always carries the SAME
fields the app shows (incl. Volume) and can never drift from the deployed data.

Reads every comic whose Box # is a status placeholder (AT CGC … / UNKNOWN —
needs physical reassignment) and writes
artifacts/comics-inventory/src/data/locationSnapshot.json.

    python3 brb_location_snapshot.py

Run it after brb.py so data3.ts is fresh; then commit + deploy as usual.
"""
import re, json, os, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA3 = os.path.join(ROOT, "artifacts/comics-inventory/src/data/data3.ts")
OUT = os.path.join(ROOT, "artifacts/comics-inventory/src/data/locationSnapshot.json")


def field(obj, name):
    m = re.search(r"\b" + name + r":\s*`((?:[^`\\]|\\.)*)`", obj)
    return m.group(1) if m else ""


def main():
    txt = open(DATA3, encoding="utf-8").read()
    start = txt.index("comics: [")
    m = re.search(r"\n  boxes:", txt[start:])
    region = txt[start:start + m.start()]
    objs = re.split(r"\n  \{", region)[1:]

    rows = []
    for o in objs:
        box = field(o, "Box")
        bu = box.upper()
        if bu.startswith("AT ") or "UNKNOWN" in bu:
            rows.append({
                "title": field(o, "Title"),
                "issue": field(o, "Issue"),
                "year": field(o, "Year"),
                "volume": field(o, "Volume") or "1",
                "box": box,
                "key": field(o, "Key").upper() == "YES",
                "signed": field(o, "Signed").upper() == "YES",
            })

    # Source filename recorded in the data3.ts header, for the page footer.
    src = re.search(r"Source:\s*(\S+)", txt)
    snap = {
        "source": src.group(1) if src else "data3.ts",
        "capturedAt": datetime.date.today().isoformat(),
        "rows": rows,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(snap, f, ensure_ascii=False, indent=1)
    print(f"WROTE {os.path.relpath(OUT, ROOT)} — {len(rows)} placeholder rows")


if __name__ == "__main__":
    main()
