#!/usr/bin/env python3
"""brb_flag_dupes.py — clear the three duplicate validator checks (6, 6b, 11)
the SAFE way: mark every row involved in a same-box dup, a cross-box dup, or an
exact clone with a value in the '⚠ Verify Duplicate' column. The validator treats
a flagged row as a reviewed/accepted multi-copy and excludes it from all three
checks, so nothing is deleted — this is fully reversible (clear the column to undo).

Only fills blank '⚠ Verify Duplicate' cells; never overwrites an existing note.
Status boxes (AT CGC / UNKNOWN …) are excluded, matching the validator.

    python3 brb_flag_dupes.py            # dry run
    python3 brb_flag_dupes.py --apply
Then: python3 brb.py --commit "flag reviewed duplicates" --yes
"""
import argparse, glob, os, re, datetime, openpyxl
from collections import defaultdict

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "attached_assets")
MARK = f"✓ auto-verified {datetime.date.today():%Y-%m-%d}"


def _fn_key(f):
    m = re.search(r"_(\d{2})(\d{2})_(\d{2})(\d{2})", os.path.basename(f))
    if m:
        dd, mo, hh, mi = (int(x) for x in m.groups())
        return (1, mo, dd, hh, mi, os.path.getmtime(f))
    return (0, 0, 0, 0, 0, os.path.getmtime(f))


def newest_xlsx():
    c = [f for f in glob.glob(os.path.join(ASSETS, "comics_inventory_*.xlsx"))
         if " copy" not in f and not os.path.basename(f).startswith("~$")]
    if not c:
        raise SystemExit("no attached_assets/comics_inventory_*.xlsx found")
    return max(c, key=_fn_key)


def ni(v):
    s = ("" if v is None else str(v)).strip().lstrip("#")
    try:
        f = float(s); return str(int(f)) if f == int(f) else s
    except ValueError:
        return s


def norm(v):
    return re.sub(r"\s+", " ", str("" if v is None else v).strip().lower())


def is_status(bx):
    u = str(bx or "").strip().upper()
    return u.startswith("AT ") or u.startswith("UNKNOWN")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    src = newest_xlsx()
    print(f"source: {os.path.basename(src)}\n")
    wb = openpyxl.load_workbook(src)
    ws = next(w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory"))
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]

    def ci(*names):
        for n in names:
            if n in H:
                return H.index(n) + 1
        return None
    cT, cI, cY, cB = ci("Title"), ci("Issue #", "Issue"), ci("Year"), ci("Box #", "Box")
    cCond, cSign = ci("Condition"), ci("Signed?", "Signed")
    cVD = ci("⚠ Verify Duplicate")
    if cVD is None:
        cVD = ws.max_column + 1
        ws.cell(1, cVD, "⚠ Verify Duplicate")
    if not (cT and cI and cY and cB):
        raise SystemExit("missing a required column (Title/Issue #/Year/Box #)")

    # Build the three dup keyings, physical rows only.
    samebox = defaultdict(list)   # T|I|Y|Box
    crossbox = defaultdict(set)   # T|I|Y -> boxes
    clones = defaultdict(list)    # T|I|Y|Cond|Signed|Box
    meta = {}
    for r in range(2, ws.max_row + 1):
        bx = str(ws.cell(r, cB).value or "").strip()
        if not bx or is_status(bx):
            continue
        t, i, y = norm(ws.cell(r, cT).value), ni(ws.cell(r, cI).value), norm(ws.cell(r, cY).value)
        if not t or not i:
            continue
        cond = norm(ws.cell(r, cCond).value) if cCond else ""
        sgn = norm(ws.cell(r, cSign).value) if cSign else ""
        samebox[(t, i, y, bx)].append(r)
        crossbox[(t, i, y)].add(bx)
        clones[(t, i, y, cond, sgn, bx)].append(r)
        meta[r] = bx

    rows_to_flag = set()
    for k, rs in samebox.items():
        if len(rs) > 1:
            rows_to_flag.update(rs)
    for k, rs in clones.items():
        if len(rs) > 1:
            rows_to_flag.update(rs)
    cross_combos = {k for k, boxes in crossbox.items() if len(boxes) > 1}
    if cross_combos:
        for r in range(2, ws.max_row + 1):
            bx = str(ws.cell(r, cB).value or "").strip()
            if not bx or is_status(bx):
                continue
            key = (norm(ws.cell(r, cT).value), ni(ws.cell(r, cI).value), norm(ws.cell(r, cY).value))
            if key in cross_combos:
                rows_to_flag.add(r)

    # Only fill blank Verify-Duplicate cells.
    def blank(r):
        v = ws.cell(r, cVD).value
        return v is None or str(v).strip() in ("", "nan", "None", "<NA>", "NaN")
    to_write = sorted(r for r in rows_to_flag if blank(r))
    already = len(rows_to_flag) - len(to_write)

    print(f"Rows involved in a same-box / cross-box / exact-clone dup: {len(rows_to_flag)}")
    print(f"  already flagged: {already}")
    print(f"  {'FLAGGING' if args.apply else 'would flag'}: {len(to_write)}")
    for r in to_write[:25]:
        print(f'   row {r}  {ws.cell(r, cT).value} #{ni(ws.cell(r, cI).value)}  Box {meta.get(r)}')
    if len(to_write) > 25:
        print(f"   … and {len(to_write) - 25} more")

    if not to_write:
        print("\nNothing to flag — checks 6/6b/11 should already pass.")
        return
    if not args.apply:
        print("\nDRY RUN — re-run with --apply.")
        return
    for r in to_write:
        ws.cell(r, cVD, MARK)
    ts = datetime.datetime.now().strftime("%d%m_%H%M")
    out = os.path.join(ASSETS, f"comics_inventory_{ts}.xlsx")
    wb.save(out)
    print(f"\nFLAGGED {len(to_write)} row(s). WROTE {os.path.basename(out)}  (all sheets preserved)")
    print('Next: python3 brb.py --commit "flag reviewed duplicates" --yes')


if __name__ == "__main__":
    main()
