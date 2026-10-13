#!/usr/bin/env python3
"""brb_sell_dupes.py — compute the "duplicates you can safely sell" list from the
generated data3.ts and write it to
artifacts/comics-inventory/src/data/ebaySellDupes.json.

A sellable duplicate = the SAME book (Title + Issue # + Year, case-insensitive,
the CLAUDE.md Rule-3 cross-box key) held as 2+ copies across your real storage
boxes. You keep one; the extras are free money on eBay.

Exclusions, per CLAUDE.md:
  * CC boxes (CC1, CC2, …) — deliberate cover pulls, NEVER duplicates.
  * Status boxes (AT CGC …, UNKNOWN — needs physical reassignment) — not shelved.

Ranked by the highest NM value in the group (list the money first). Self-
maintaining: re-run it after each brb.py so the page always reflects live data.

    python3 brb_sell_dupes.py
"""
import re, json, os, datetime
from collections import defaultdict

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA3 = os.path.join(ROOT, "artifacts/comics-inventory/src/data/data3.ts")
OUT = os.path.join(ROOT, "artifacts/comics-inventory/src/data/ebaySellDupes.json")


def fld(o, n):
    m = re.search(r"\b" + n + r":\s*`((?:[^`\\]|\\.)*)`", o)
    return m.group(1) if m else ""


def excluded(box):
    b = box.upper().strip()
    return b.startswith("CC") or b.startswith("AT ") or "UNKNOWN" in b


def nmval(s):
    m = re.search(r"[\d.]+", s or "")
    return float(m.group()) if m else 0.0


def main():
    txt = open(DATA3, encoding="utf-8").read()
    start = txt.index("comics: [")
    m = re.search(r"\n  boxes:", txt[start:])
    objs = re.split(r"\n  \{", txt[start:start + m.start()])[1:]

    groups = defaultdict(list)
    for o in objs:
        box = fld(o, "Box")
        title = fld(o, "Title").strip()
        if not title or excluded(box):
            continue
        key = (title.lower(), fld(o, "Issue").strip(), fld(o, "Year").strip())
        groups[key].append({
            "title": title, "issue": fld(o, "Issue").strip(), "year": fld(o, "Year").strip(),
            "volume": fld(o, "Volume").strip() or "1", "publisher": fld(o, "Publisher").strip(),
            "writer": fld(o, "Writer").strip(), "box": box, "cond": fld(o, "Condition").strip(),
            "nm": nmval(fld(o, "Value_NM")),
        })

    out = []
    for (_t, _i, _y), copies in groups.items():
        if len(copies) < 2:
            continue
        boxes = sorted({c["box"] for c in copies}, key=lambda b: (len(b), b))
        best = max(copies, key=lambda c: c["nm"])
        out.append({
            "title": best["title"], "issue": best["issue"], "year": best["year"],
            "volume": best["volume"], "publisher": best["publisher"], "writer": best["writer"],
            "copies": len(copies), "sellable": len(copies) - 1,
            "boxes": boxes, "nm": round(best["nm"], 2),
            "sameBox": len(boxes) == 1,
        })
    out.sort(key=lambda d: (-d["nm"], d["title"].lower(), d["issue"]))

    snap = {
        "source": (re.search(r"Source:\s*(\S+)", txt) or [None, "data3.ts"])[1],
        "generatedAt": datetime.date.today().isoformat(),
        "groupCount": len(out),
        "sellableCount": sum(d["sellable"] for d in out),
        "estValue": round(sum(d["nm"] * d["sellable"] for d in out), 2),
        "rows": out,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(snap, f, ensure_ascii=False, indent=1)
    print(f"WROTE {os.path.relpath(OUT, ROOT)} — {len(out)} dup groups, "
          f"{snap['sellableCount']} sellable copies, ~${snap['estValue']:.0f} at NM")


if __name__ == "__main__":
    main()
