#!/usr/bin/env python3
"""brb_set_intake_dates.py — fix Date Added so Recent Purchases / Release Timeline
separate the two weekly intakes. Both batches were stamped the same day; this
sets each book's Date Added to the week its CSV represents.

    intake_2026-10-07.csv  ->  "October 07, 2026 (new-comics intake)"
    intake_2026-10-14.csv  ->  "October 14, 2026 (new-comics intake)"

Only rows whose Date Added still reads as an intake stamp are touched, matched by
Title + Issue # + Box #. Non-destructive: writes a new dated xlsx.

    python3 brb_set_intake_dates.py            # dry run
    python3 brb_set_intake_dates.py --apply
    python3 brb.py --commit split-intake-weeks --yes
"""
import argparse, glob, os, re, csv, datetime, openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(ROOT, "attached_assets")
WEEKS = [
    ("intake_2026-10-07.csv", datetime.date(2026, 10, 7)),
    ("intake_2026-10-14.csv", datetime.date(2026, 10, 14)),
]


def nt(t):
    s = re.sub(r"^the\s+", "", str(t or "").lower())
    return re.sub(r"[^a-z0-9]+", "", s)


def ni(i):
    return re.sub(r"\.0$", "", str(i or "").replace("#", "").strip())


def _key(f):
    m = re.search(r"_(\d{2})(\d{2})_(\d{2})(\d{2})", os.path.basename(f))
    if m:
        dd, mm, hh, mi = (int(x) for x in m.groups())
        return (1, mm, dd, hh, mi, os.path.getmtime(f))
    return (0, 0, 0, 0, 0, os.path.getmtime(f))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    # (title, issue, box) -> stamp, latest CSV wins ties
    want = {}
    for fn, d in WEEKS:
        p = os.path.join(ROOT, fn)
        if not os.path.exists(p):
            print(f"  (skip {fn} — not found)")
            continue
        stamp = d.strftime("%B %d, %Y") + " (new-comics intake)"
        for row in csv.DictReader(open(p)):
            want[(nt(row["title"]), ni(row["issue"]), str(row["box"]).strip())] = stamp

    src = max([f for f in glob.glob(os.path.join(A, "comics_inventory_*.xlsx"))
               if " copy" not in f and not os.path.basename(f).startswith("~$")], key=_key)
    wb = openpyxl.load_workbook(src)
    ws = [w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory")][-1]
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]

    def ci(n):
        return H.index(n) + 1 if n in H else None
    cT, cI, cB, cD = ci("Title"), ci("Issue #"), ci("Box #"), ci("Date Added")

    n = 0
    for r in range(2, ws.max_row + 1):
        da = str(ws.cell(r, cD).value or "")
        if "intake" not in da.lower():
            continue
        k = (nt(ws.cell(r, cT).value), ni(ws.cell(r, cI).value), str(ws.cell(r, cB).value or "").strip())
        new = want.get(k)
        if new and new != da:
            print(f"  row {r}: {ws.cell(r, cT).value} #{ws.cell(r, cI).value} -> {new}")
            if args.apply:
                ws.cell(r, cD, new)
            n += 1

    print(f"\n{'SET' if args.apply else 'WOULD SET'} {n} Date Added value(s)")
    if not args.apply:
        print("Dry run — re-run with --apply.")
        return
    out = os.path.join(A, f"comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    print("SAVED:", os.path.basename(out))
    print("Next: python3 brb.py --commit split-intake-weeks --yes")


if __name__ == "__main__":
    main()
