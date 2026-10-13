#!/usr/bin/env python3
"""brb_move_roy_thomas.py — one-off: move the Avengers Annual #2 Roy Thomas SS
slab from its "AT CGC — Roy Thomas SS" placeholder box to CC10.

Confirmed by Robert (Oct 2026). Non-destructive: writes a new dated xlsx; then
deploy with brb.py as usual. Run on the Mac:

    python3 brb_move_roy_thomas.py
    python3 brb.py --commit "move Roy Thomas SS to CC10" --yes
"""
import glob, os, re, datetime, openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(ROOT, "attached_assets")
FROM = "AT CGC — Roy Thomas SS"   # em-dash, matches the sheet
TO = "CC10"


def _key(f):
    m = re.search(r"_(\d{2})(\d{2})_(\d{2})(\d{2})", os.path.basename(f))
    if m:
        dd, mm, hh, mi = (int(x) for x in m.groups())
        return (1, mm, dd, hh, mi, os.path.getmtime(f))
    return (0, 0, 0, 0, 0, os.path.getmtime(f))


def main():
    cands = [f for f in glob.glob(os.path.join(A, "comics_inventory_*.xlsx"))
             if " copy" not in f and not os.path.basename(f).startswith("~$")]
    if not cands:
        raise SystemExit("no attached_assets/comics_inventory_*.xlsx found")
    src = max(cands, key=_key)
    wb = openpyxl.load_workbook(src)
    ws = [w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory")][-1]
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]
    cB, cT, cI = H.index("Box #") + 1, H.index("Title") + 1, H.index("Issue #") + 1

    n = 0
    for r in range(2, ws.max_row + 1):
        if str(ws.cell(r, cB).value or "").strip() == FROM:
            print(f"row {r}: {ws.cell(r, cT).value} #{ws.cell(r, cI).value}  {FROM} -> {TO}")
            ws.cell(r, cB, TO)
            n += 1
    print(f"updated {n} row(s)")
    if not n:
        print("Nothing matched — already moved, or the box label differs.")
        return
    out = os.path.join(A, f"comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    print("SAVED:", os.path.basename(out))
    print('Next: python3 brb.py --commit "move Roy Thomas SS to CC10" --yes')


if __name__ == "__main__":
    main()
