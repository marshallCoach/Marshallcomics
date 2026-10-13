#!/usr/bin/env python3
"""brb_sign_roy_thomas.py — one-off: record the Roy Thomas signature on
Avengers Annual #2 (1968). The slab was at CGC as a signature series but the row
read Signed? = NO with no signer. Confirmed by Robert (Oct 2026).

Sets exactly two cells on that one row:
    Signed?   -> YES
    Signed By -> Roy Thomas

Non-destructive: writes a new dated xlsx. Then deploy with brb.py. Run on the Mac:

    python3 brb_sign_roy_thomas.py
    python3 brb.py --commit sign-avengers-annual-2-roy-thomas --yes
"""
import glob, os, re, datetime, openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(ROOT, "attached_assets")
TITLE, ISSUE, YEAR = "avengers annual", "2", "1968"


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
    cT, cI, cY = H.index("Title") + 1, H.index("Issue #") + 1, H.index("Year") + 1
    cS, cSB = H.index("Signed?") + 1, H.index("Signed By") + 1

    def norm(v):
        # Issue/Year may be stored as floats (2.0, 1968.0); drop only a trailing ".0".
        return re.sub(r"\.0$", "", str(v or "").strip())

    n = 0
    for r in range(2, ws.max_row + 1):
        t = str(ws.cell(r, cT).value or "").strip().lower()
        i = norm(ws.cell(r, cI).value)
        y = norm(ws.cell(r, cY).value)
        if t == TITLE and i == ISSUE and y == YEAR:
            print(f"row {r}: {ws.cell(r, cT).value} #{ws.cell(r, cI).value} ({ws.cell(r, cY).value}) "
                  f"Signed? {ws.cell(r, cS).value!r} -> YES, Signed By {ws.cell(r, cSB).value!r} -> Roy Thomas")
            ws.cell(r, cS, "YES")
            ws.cell(r, cSB, "Roy Thomas")
            n += 1
    print(f"updated {n} row(s)")
    if not n:
        print("Nothing matched — check the title/issue/year.")
        return
    out = os.path.join(A, f"comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    print("SAVED:", os.path.basename(out))
    print("Next: python3 brb.py --commit sign-avengers-annual-2-roy-thomas --yes")


if __name__ == "__main__":
    main()
