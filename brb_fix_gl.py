#!/usr/bin/env python3
"""brb_fix_gl.py — one-off: collapse the duplicate Green Lantern: Fractured
Spectrum #1 rows (Box 54) down to a single copy and correct its year.

The restore added the book via weekly intake more than once, and intake stamps
Pub_Date = today, so step 7 then pushed Year to 2026. This keeps ONE row, sets
Year = 2024 (confirmed by Robert), and clears the bogus 2026 Pub_Date so it is
no longer treated as a new release. The extra identical rows (no Entry id, so a
normal targeted delete can't single them out) are removed here.

    python3 brb_fix_gl.py            # dry run — show what it would do
    python3 brb_fix_gl.py --apply    # write a new dated xlsx
Then: python3 brb.py --commit "dedupe GL: Fractured Spectrum, year 2024" --yes
"""
import argparse, datetime, glob, os, re, sys
import openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "attached_assets")
TITLE = "green lantern: fractured spectrum"
ISSUE = "1"
BOX = "54"
YEAR = "2024"


def _fn_key(f):
    m = re.search(r"_(\d{2})(\d{2})_(\d{2})(\d{2})", os.path.basename(f))
    if m:
        dd, mm, hh, mi = (int(x) for x in m.groups())
        return (1, mm, dd, hh, mi, os.path.getmtime(f))
    return (0, 0, 0, 0, 0, os.path.getmtime(f))


def newest_xlsx():
    m = [f for f in glob.glob(os.path.join(ASSETS, "comics_inventory_*.xlsx"))
         if " copy" not in f and not os.path.basename(f).startswith("~$")]
    if not m:
        sys.exit("no attached_assets/comics_inventory_*.xlsx found")
    return max(m, key=_fn_key)


def ni(v):
    s = ("" if v is None else str(v)).strip().lstrip("#")
    try:
        f = float(s); return str(int(f)) if f == int(f) else s
    except ValueError:
        return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    src = newest_xlsx()
    wb = openpyxl.load_workbook(src)
    ws = [w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory")][-1]
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]

    def ci(n):
        return H.index(n) + 1 if n in H else None
    cT, cI, cB, cY = ci("Title"), ci("Issue #"), ci("Box #"), ci("Year")
    cPD = ci("Publication Date")

    matches = []
    for r in range(2, ws.max_row + 1):
        t = str(ws.cell(r, cT).value or "").strip().lower()
        if t == TITLE and ni(ws.cell(r, cI).value) == ISSUE and str(ws.cell(r, cB).value or "").strip() == BOX:
            matches.append(r)

    print(f"SOURCE: {os.path.basename(src)}")
    print(f"Found {len(matches)} '{TITLE}' #{ISSUE} row(s) in Box {BOX}: rows {matches}")
    if not matches:
        sys.exit("none found — nothing to do")

    keep = matches[0]
    drop = matches[1:]
    print(f"  KEEP row {keep}: set Year -> {YEAR}, clear Pub_Date "
          f"(was Year={ws.cell(keep, cY).value!r}, Pub_Date={ws.cell(keep, cPD).value!r})")
    for r in drop:
        print(f"  DELETE row {r} (duplicate)")

    if not args.apply:
        print("\nDRY RUN — nothing written. Re-run with --apply.")
        return

    ws.cell(keep, cY, YEAR)
    if cPD:
        ws.cell(keep, cPD, "")
    for r in sorted(drop, reverse=True):
        ws.delete_rows(r, 1)

    out = os.path.join(ASSETS, f"comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    print(f"\nWROTE: {os.path.basename(out)}  (kept 1, deleted {len(drop)}, Year={YEAR})")
    print("Next: python3 brb.py --commit \"dedupe GL: Fractured Spectrum, year 2024\" --yes")


if __name__ == "__main__":
    main()
