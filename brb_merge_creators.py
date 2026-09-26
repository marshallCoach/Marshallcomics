#!/usr/bin/env python3
"""brb_merge_creators.py — merge the overnight fill's creator columns back into
the full-sheet workbook.

run_overnight_v2.py writes ONLY the Clean Inventory sheet, so its FINAL file has
lost Box Summary, the cover catalogs and Box Locations. Reingesting it strips all
of that from the site. This copies the columns the overnight run actually changed
(Writer(s), Artist(s), Cover Artist, Volume) from the FINAL into the newest
full-sheet file (one that still has 'Box Summary'), preserving every other sheet
and its formatting.

    python3 brb_merge_creators.py           # dry run — verify the counts
    python3 brb_merge_creators.py --apply
Then: python3 brb.py --commit "restore full workbook + overnight creators" --yes
"""
import argparse, glob, os, re, datetime, openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "attached_assets")
MERGE_COLS = ["Writer(s)", "Artist(s)", "Cover Artist", "Volume"]


def _fn_key(f):
    m = re.search(r"_(\d{2})(\d{2})_(\d{2})(\d{2})", os.path.basename(f))
    if m:
        dd, mo, hh, mi = (int(x) for x in m.groups())
        return (1, mo, dd, hh, mi, os.path.getmtime(f))
    return (0, 0, 0, 0, 0, os.path.getmtime(f))


def clean_sheet(wb):
    return next(w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory"))


def has_full(f):
    try:
        return "Box Summary" in openpyxl.load_workbook(f, read_only=True).sheetnames
    except Exception:
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    files = [f for f in glob.glob(os.path.join(ASSETS, "comics_inventory_*.xlsx"))
             if not os.path.basename(f).startswith("~$")]
    creators = max(files, key=_fn_key)                 # the FINAL (newest, stripped)
    fulls = [f for f in files if f != creators and has_full(f)]
    if not fulls:
        raise SystemExit("no full-sheet base file (with a 'Box Summary' sheet) found")
    base = max(fulls, key=_fn_key)
    print(f"creators (fills)  : {os.path.basename(creators)}")
    print(f"base (full sheets): {os.path.basename(base)}")

    cwb = openpyxl.load_workbook(creators); cws = clean_sheet(cwb)
    cH = [str(c.value).strip() if c.value is not None else "" for c in cws[1]]
    bwb = openpyxl.load_workbook(base); bws = clean_sheet(bwb)
    bH = [str(c.value).strip() if c.value is not None else "" for c in bws[1]]

    if cws.max_row != bws.max_row:
        raise SystemExit(f"row count differs (creators {cws.max_row} vs base {bws.max_row}) — not index-aligned, aborting")

    def col(H, n):
        return H.index(n) + 1 if n in H else None
    cT, cI = col(cH, "Title"), col(cH, "Issue #")
    bT, bI = col(bH, "Title"), col(bH, "Issue #")
    mism = sum(1 for r in range(2, bws.max_row + 1)
               if (str(cws.cell(r, cT).value), str(cws.cell(r, cI).value))
               != (str(bws.cell(r, bT).value), str(bws.cell(r, bI).value)))
    print(f"row misalignments (Title/Issue): {mism}")
    if mism:
        raise SystemExit("files are not index-aligned — aborting (nothing written)")

    per_col = {}
    for name in MERGE_COLS:
        ci, bi = col(cH, name), col(bH, name)
        if not ci or not bi:
            print(f"  skip {name} (column missing in one file)"); continue
        n = 0
        for r in range(2, bws.max_row + 1):
            cv = cws.cell(r, ci).value
            if cv is not None and str(cv).strip() and str(cv).strip() != str(bws.cell(r, bi).value or "").strip():
                if args.apply:
                    bws.cell(r, bi, cv)
                n += 1
        per_col[name] = n
    total = sum(per_col.values())
    print(("MERGED " if args.apply else "WOULD MERGE ") + f"{total} cell(s): " +
          ", ".join(f"{k} {v}" for k, v in per_col.items()))

    if not args.apply:
        print("\nDRY RUN — re-run with --apply. (Expected ≈ Writers 150, Artists 54, Cover 435, Volume 71.)")
        return
    ts = datetime.datetime.now().strftime("%d%m_%H%M")
    out = os.path.join(ASSETS, f"comics_inventory_{ts}.xlsx")
    bwb.save(out)
    print(f"\nWROTE {os.path.basename(out)}  (full sheets + merged creators)")
    print('Next: python3 brb.py --commit "restore full workbook + overnight creators" --yes')


if __name__ == "__main__":
    main()
