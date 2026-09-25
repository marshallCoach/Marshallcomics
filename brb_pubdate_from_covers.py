#!/usr/bin/env python3
"""brb_pubdate_from_covers.py — backfill the Publication Date column from
covers.json.

Every cover fetch already captured the issue's on-sale date into covers.json,
but the Fandom apply wrote it there and NOT into the inventory's "Publication
Date" column. So rows show up as "Missing publication date" on the Data Fix
page even though the date is already known (e.g. Absolute Batman #6 has a cover
dated 2025-05-01 in covers.json but a blank Publication Date). This copies
those known dates in — no network, no AI.

READ-then-WRITE: writes a new timestamped xlsx, never overwrites the source.

    python3 brb_pubdate_from_covers.py            # dry run (preview)
    python3 brb_pubdate_from_covers.py --apply
Then: python3 brb.py --commit "backfill publication dates from covers" --yes
"""
import argparse, glob, json, os, datetime, openpyxl
import re

ROOT = os.path.dirname(os.path.abspath(__file__))


def _fn_key(f):
    # Prefer the DDMM_HHMM timestamp encoded in the filename over mtime: a
    # git checkout can refresh a stale file's mtime and make it wrongly "newest".
    m = re.search(r"_(\d{2})(\d{2})_(\d{2})(\d{2})", os.path.basename(f))
    if m:
        dd, mm, hh, mi = (int(x) for x in m.groups())
        return (1, mm, dd, hh, mi, os.path.getmtime(f))
    return (0, 0, 0, 0, 0, os.path.getmtime(f))


def newest_xlsx():
    c = [f for f in glob.glob(os.path.join(ROOT, "attached_assets/comics_inventory_*.xlsx"))
         if " copy" not in f and not os.path.basename(f).startswith("~$")]
    if not c:
        raise SystemExit("no attached_assets/comics_inventory_*.xlsx found")
    return max(c, key=_fn_key)


def ni(v):
    s = str(v or "").strip().lstrip("#")
    try:
        f = float(s); return str(int(f)) if f == int(f) else s
    except ValueError:
        return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    cov = json.load(open(os.path.join(ROOT, "covers.json")))
    covdate = {}
    for k, e in cov.items():
        d = (e.get("date") if isinstance(e, dict) else "")
        if not d:
            continue
        p = k.split("|||")
        if len(p) >= 2:
            covdate.setdefault((p[0], ni(p[1].lstrip("#"))), d)

    src = newest_xlsx()
    wb = openpyxl.load_workbook(src)
    ws = next(w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory"))
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]

    def ci(n):
        return H.index(n) + 1 if n in H else None
    cT, cI, cPD = ci("Title"), ci("Issue #"), ci("Publication Date")
    if not cPD:
        raise SystemExit("no 'Publication Date' column found in the Clean Inventory sheet")

    changes = []
    for r in range(2, ws.max_row + 1):
        t = ws.cell(r, cT).value
        if not str(t or "").strip():
            continue
        if str(ws.cell(r, cPD).value or "").strip():
            continue  # already has a date
        d = covdate.get((str(t).strip(), ni(ws.cell(r, cI).value)))
        if not d:
            continue
        changes.append((r, str(t).strip(), ni(ws.cell(r, cI).value), d))
        if args.apply:
            ws.cell(r, cPD, d)

    print(("WOULD SET " if not args.apply else "SET ") +
          f"{len(changes)} Publication Date value(s) from covers.json")
    for r, t, i, d in changes[:30]:
        print(f"  row {r}  {t} #{i}: {d}")
    if len(changes) > 30:
        print(f"  … and {len(changes) - 30} more")

    if not args.apply:
        print("\nDRY RUN — re-run with --apply.")
        return
    if not changes:
        print("\nNothing to backfill.")
        return
    ts = datetime.datetime.now().strftime("%d%m_%H%M")
    out = os.path.join(ROOT, f"attached_assets/comics_inventory_{ts}.xlsx")
    wb.save(out)
    print(f"\nWROTE {os.path.basename(out)}  ({len(changes)} rows)")
    print("Next: python3 brb.py --commit \"backfill publication dates from covers\" --yes")


if __name__ == "__main__":
    main()
