#!/usr/bin/env python3
"""brb_dedupe_2026.py — remove accidental duplicate rows created when last week's
intake re-added books that were already in the sheet. Collapses every 2026
same-box group (Title + Issue # + Box #, Year 2026) to a single row, keeping the
first (richest) occurrence.

Intended exception: Doom Patrol #2 in Box 101 is a real bought-twice dupe, so it
keeps TWO rows. Pre-2026 groups (old accepted dups) are left untouched.

Non-destructive: writes a new dated xlsx.

    python3 brb_dedupe_2026.py            # dry run
    python3 brb_dedupe_2026.py --apply
    python3 brb.py --commit dedupe-2026-intake --yes
"""
import argparse, glob, os, re, datetime, openpyxl
from collections import defaultdict

ROOT = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(ROOT, "attached_assets")
KEEP_TWO = {("doom patrol", "2", "101")}   # the one intended dupe


def nt(t):
    return re.sub(r"[^a-z0-9]+", "", str(t or "").lower())


def ni(i):
    return re.sub(r"\.0$", "", str(i or "").replace("#", "").strip())


def _key(f):
    m = re.search(r"_(\d{2})(\d{2})_(\d{2})(\d{2})", os.path.basename(f))
    if m:
        dd, mm, hh, mi = (int(x) for x in m.groups())
        return (1, mm, dd, hh, mi, os.path.getmtime(f))
    return (0, 0, 0, 0, 0, os.path.getmtime(f))


def richness(ws, r, cols):
    return sum(1 for c in cols if c and str(ws.cell(r, c).value or "").strip())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    cands = [f for f in glob.glob(os.path.join(A, "comics_inventory_*.xlsx"))
             if " copy" not in f and not os.path.basename(f).startswith("~$")]
    src = max(cands, key=_key)
    wb = openpyxl.load_workbook(src)
    ws = [w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory")][-1]
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]

    def ci(n):
        return H.index(n) + 1 if n in H else None
    cT, cI, cY, cB = ci("Title"), ci("Issue #"), ci("Year"), ci("Box #")
    rich_cols = [ci(x) for x in ("Writer(s)", "Artist(s)", "Cover Artist", "Condition", "Value_NM", "Publication Date")]

    groups = defaultdict(list)
    for r in range(2, ws.max_row + 1):
        t = ws.cell(r, cT).value
        if not t:
            continue
        if ni(ws.cell(r, cY).value) != "2026":
            continue
        k = (nt(t), ni(ws.cell(r, cI).value), str(ws.cell(r, cB).value or "").strip())
        groups[k].append(r)

    to_delete = []
    for k, rows in groups.items():
        keep = 2 if k in KEEP_TWO else 1
        if len(rows) <= keep:
            continue
        # keep the richest rows; delete the rest
        ranked = sorted(rows, key=lambda r: (-richness(ws, r, rich_cols), r))
        drop = ranked[keep:]
        for r in drop:
            to_delete.append(r)
            print(f"  drop row {r}: {ws.cell(r, cT).value} #{ws.cell(r, cI).value} Box {ws.cell(r, cB).value} (dup)")

    print(f"\n{'DELETING' if args.apply else 'WOULD DELETE'} {len(to_delete)} accidental 2026 dup row(s)"
          f"  (Doom Patrol #2 kept as a pair)")
    if not args.apply:
        print("Dry run — re-run with --apply.")
        return
    for r in sorted(to_delete, reverse=True):
        ws.delete_rows(r, 1)
    out = os.path.join(A, f"comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    print("SAVED:", os.path.basename(out))
    print("Next: python3 brb.py --commit dedupe-2026-intake --yes")


if __name__ == "__main__":
    main()
