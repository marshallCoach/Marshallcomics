#!/usr/bin/env python3
"""brb_vision_summary.py — at-a-glance report on the vision character run.
Reads the output xlsx (default vision_workqueue_visual.xlsx); falls back to the
.partial.csv checkpoint so you can watch progress mid-run. Prints:
  * 🟢/🔴 totals + coverage %, dead/error count
  * top characters by frequency
  * titles with the worst Unknown rate (candidates for a Sonnet re-run)
and writes vision_character_counts.csv (character, count).

Usage: python3 brb_vision_summary.py [path.xlsx|path.csv]
"""
import sys, os, csv, glob, collections

CHAR_COL = "Visually Verified Characters"
CONF_COL = "Confidence"


def load(path):
    """Return list of dicts with title, chars, conf."""
    rows = []
    if path.lower().endswith(".csv") and path.endswith(".partial.csv"):
        # checkpoint form: row,chars,conf  (no title) — still useful for totals
        with open(path) as f:
            for r in csv.DictReader(f):
                rows.append({"title": "", "chars": r.get("chars", ""), "conf": r.get("conf", "")})
        return rows
    import openpyxl
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    data = list(ws.iter_rows(values_only=True)); H = list(data[0]); idx = {n: i for i, n in enumerate(H) if n}
    ti = idx.get("title", 0); ci = idx.get(CHAR_COL); fi = idx.get(CONF_COL)
    for r in data[1:]:
        rows.append({"title": str(r[ti]) if ti is not None else "",
                     "chars": str(r[ci]) if ci is not None and r[ci] else "",
                     "conf": str(r[fi]) if fi is not None and r[fi] else ""})
    return rows


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else None
    if not path:
        for c in ["vision_workqueue_visual.xlsx", "vision_workqueue_visual.xlsx.partial.csv"]:
            if os.path.exists(c):
                path = c; break
    if not path or not os.path.exists(path):
        print("no vision output found (run brb_vision_characters.py first)"); sys.exit(2)

    rows = [r for r in load(path) if r["chars"]]
    green = sum(1 for r in rows if r["conf"] == "🟢")
    red = sum(1 for r in rows if r["conf"] == "🔴")
    err = sum(1 for r in rows if r["chars"].startswith("ERROR"))
    unk = sum(1 for r in rows if r["chars"].strip().lower() == "unknown")
    tot = len(rows)
    print(f"source: {os.path.basename(path)}")
    print(f"processed: {tot}   🟢 identified: {green} ({100*green/tot:.1f}%)   🔴 unknown/fail: {red}")
    print(f"  of 🔴 -> plain Unknown: {unk}   errors (dead/timeout): {err}")

    # character frequency (split the comma lists; skip Unknown/errors)
    freq = collections.Counter()
    for r in rows:
        c = r["chars"]
        if r["conf"] != "🟢" or c.startswith("ERROR"):
            continue
        for name in [x.strip() for x in c.split(",") if x.strip()]:
            freq[name] += 1
    print(f"\ndistinct characters: {len(freq)}   total appearances: {sum(freq.values())}")
    print("top 25 characters:")
    for name, n in freq.most_common(25):
        print(f"  {n:>5}  {name}")

    with open("vision_character_counts.csv", "w", newline="") as f:
        w = csv.writer(f); w.writerow(["character", "count"])
        for name, n in freq.most_common():
            w.writerow([name, n])

    # titles with worst Unknown rate (>=4 issues), for a targeted Sonnet re-run
    by_title = collections.defaultdict(lambda: [0, 0])
    for r in rows:
        if not r["title"]:
            continue
        by_title[r["title"]][0] += 1
        if r["conf"] == "🔴":
            by_title[r["title"]][1] += 1
    worst = sorted(((t, tot_, red_) for t, (tot_, red_) in by_title.items() if tot_ >= 4 and red_),
                   key=lambda x: -(x[2] / x[1]))[:15]
    if worst:
        print("\ntitles with highest Unknown rate (>=4 issues) — candidates for Sonnet re-run:")
        for t, tot_, red_ in worst:
            print(f"  {red_}/{tot_}  {t}")
    print("\nwrote vision_character_counts.csv")


if __name__ == "__main__":
    main()
