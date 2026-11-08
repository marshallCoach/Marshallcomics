#!/usr/bin/env python3
"""brb_fix_ultimate.py — one-off: collapse the 4 duplicate 'Ultimate Impact:
Reborn' #5 rows (Box 102) down to the single real copy.

The book was over-added: 4 rows, 2 with a real NM grade + on-sale date and 2
blank phantoms, none with an Entry id (so a targeted delete can't single them
out). Robert owns ONE. This keeps the best row — a non-blank Condition and the
earliest non-blank Pub_Date — and deletes the other three.

    python3 brb_fix_ultimate.py            # dry run
    python3 brb_fix_ultimate.py --apply    # write a new dated xlsx
Then brb_all deploys it (or: python3 brb.py --commit "dedupe Ultimate Impact #5" --yes)
"""
import argparse, datetime, glob, os, re, sys
import openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "attached_assets")
TITLE = "ultimate impact: reborn"
ISSUE = "5"
BOX = "102"


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
    return re.sub(r"\.0$", "", str(v if v is not None else "").strip().lstrip("#"))


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
    cT, cI, cB, cC, cPD = ci("Title"), ci("Issue #"), ci("Box #"), ci("Condition"), ci("Publication Date")

    matches = []
    for r in range(2, ws.max_row + 1):
        if (str(ws.cell(r, cT).value or "").strip().lower() == TITLE
                and ni(ws.cell(r, cI).value) == ISSUE
                and str(ws.cell(r, cB).value or "").strip() == BOX):
            cond = str(ws.cell(r, cC).value or "").strip() if cC else ""
            pd = str(ws.cell(r, cPD).value or "").strip() if cPD else ""
            matches.append((r, cond, pd))

    print(f"SOURCE: {os.path.basename(src)}")
    print(f"Found {len(matches)} '{TITLE}' #{ISSUE} row(s) in Box {BOX}")
    if len(matches) <= 1:
        sys.exit("1 or fewer rows — nothing to dedupe")

    # best = has Condition AND Pub_Date, earliest Pub_Date; fall back gracefully
    def score(m):
        _r, cond, pd = m
        return (bool(cond) and bool(pd), bool(cond), pd or "9999")
    ranked = sorted(matches, key=lambda m: (-(score(m)[0]), -(score(m)[1]), score(m)[2]))
    keep = ranked[0][0]
    drop = [m[0] for m in ranked[1:]]
    for r, cond, pd in matches:
        tag = "KEEP  " if r == keep else "DELETE"
        print(f"  [{tag}] row {r}: Condition={cond!r}  Pub_Date={pd!r}")

    if not args.apply:
        print("\nDRY RUN — nothing written. Re-run with --apply.")
        return
    for r in sorted(drop, reverse=True):
        ws.delete_rows(r, 1)
    out = os.path.join(ASSETS, f"comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    print(f"\nWROTE: {os.path.basename(out)}  (kept 1, deleted {len(drop)})")
    print("Next: python3 brb.py --commit \"dedupe Ultimate Impact #5\" --yes  (or let brb_all deploy)")


if __name__ == "__main__":
    main()
