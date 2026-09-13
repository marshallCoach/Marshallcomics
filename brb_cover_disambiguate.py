#!/usr/bin/env python3
"""brb_cover_disambiguate.py — stop ambiguous titles showing the wrong cover.

covers.json holds two key shapes: volume-aware "Title|||Issue|||Vol" (correct
per series) and legacy "Title|||#Issue" / "Title|||Issue" (no volume). When a
title+issue exists in your collection across MORE THAN ONE volume (e.g. three
different "Titans #28": 1976, 2018, 2025), the legacy key is a coin-flip — the
app falls back to it and can paint the wrong series' cover.

This removes the legacy (non-volume) cover keys ONLY for those ambiguous
title+issue combos, so the app shows the correct volume-aware cover or a clean
placeholder — never a wrong one. Non-ambiguous titles are untouched. Run
brb_cover_yeargate.py afterward to fill any now-missing volume-aware covers.

    python3 brb_cover_disambiguate.py            # preview
    python3 brb_cover_disambiguate.py --apply
Then: python3 brb_cover_yeargate.py
      python3 brb.py --commit "disambiguate covers by volume" --yes
"""
import argparse, glob, json, os, sys
from collections import defaultdict

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
    try:
        return str(int(float(str(v).strip())))
    except (ValueError, TypeError):
        return "1"


def newest_xlsx():
    m = [f for f in glob.glob(os.path.join(ROOT, "attached_assets/comics_inventory_*.xlsx"))
         if " copy" not in f and not os.path.basename(f).startswith("~$")]
    if not m:
        sys.exit("no attached_assets/comics_inventory_*.xlsx found")
    return max(m, key=os.path.getmtime)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    import openpyxl
    x = newest_xlsx()
    ws = next(w for w in openpyxl.load_workbook(x, read_only=True, data_only=True).worksheets
              if w.title.startswith("✅ Clean Inventory"))
    rows = list(ws.iter_rows(values_only=True))
    H = list(rows[0]); C = {n: H.index(n) for n in H if n}

    def g(r, n):
        i = C.get(n); return r[i] if i is not None else None

    # (title, issue) -> set of volumes owned
    combos = defaultdict(set)
    for r in rows[1:]:
        t = str(g(r, "Title") or "").strip()
        if not t:
            continue
        combos[(t, ni(g(r, "Issue #")))].add(nv(g(r, "Volume")))

    ambiguous = {k for k, vols in combos.items() if len(vols) > 1}
    print(f"Inventory: {os.path.basename(x)}")
    print(f"Ambiguous title+issue combos (span >1 volume): {len(ambiguous):,}")

    cov = json.load(open(COVERS))
    to_remove = []
    for (t, iss) in ambiguous:
        for k in (f"{t}|||{iss}", f"{t}|||#{iss}"):
            if k in cov:
                to_remove.append(k)

    print(f"Legacy (non-volume) cover keys to remove: {len(to_remove):,}")
    for k in sorted(to_remove)[:25]:
        print(f"  - {k}")
    if len(to_remove) > 25:
        print(f"  … and {len(to_remove) - 25:,} more")

    # how many of the ambiguous rows already have a volume-aware cover
    have_vol = sum(1 for (t, iss) in ambiguous for v in combos[(t, iss)]
                   if f"{t}|||{iss}|||{v}" in cov and cov[f"{t}|||{iss}|||{v}"].get("url"))
    total_vol_slots = sum(len(combos[k]) for k in ambiguous)
    print(f"\nVolume-aware covers already present for ambiguous rows: {have_vol:,}/{total_vol_slots:,}")
    print("(the rest will fill when you run brb_cover_yeargate.py)")

    if not args.apply:
        print("\nDRY RUN — nothing written. Re-run with --apply to remove the ambiguous legacy keys.")
        return
    for k in to_remove:
        cov.pop(k, None)
    json.dump(cov, open(COVERS, "w"))
    if os.path.exists(PUBLIC):
        json.dump(cov, open(PUBLIC, "w"))
    print(f"\nRemoved {len(to_remove):,} ambiguous legacy keys from covers.json.")
    print("Next: python3 brb_cover_yeargate.py   then   python3 brb.py --commit \"disambiguate covers by volume\" --yes")


if __name__ == "__main__":
    main()
