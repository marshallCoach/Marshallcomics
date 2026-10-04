#!/usr/bin/env python3
"""brb_remove_dupe_rows.py — delete surplus copies of specific rows, keeping one.

For when intake added more physical copies than you actually own (e.g. a main +
a regular variant both landed in the same box, but you only have one). For each
--row "Title|Issue|Box" it finds the matching rows (title case-insensitive,
issue normalized, box exact) and deletes all but the first, so one copy remains.

Dry-run by default; --apply writes a NEW dated xlsx (never edits in place) and
preserves every sheet.

    python3 brb_remove_dupe_rows.py --row "Zatanna|6|101" --row "Ultimate Impact: Reborn|5|102"
    python3 brb_remove_dupe_rows.py --row "Zatanna|6|101" --row "Ultimate Impact: Reborn|5|102" --apply
Then: python3 brb.py --commit "remove duplicate intake rows" --yes
"""
import argparse, glob, os, re, datetime, openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "attached_assets")


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


def norm_issue(v):
    # Coalesce only None, never 0 — an int 0 issue (#0) must stay "0".
    s = ("" if v is None else str(v)).strip().lstrip("#")
    try:
        f = float(s); return str(int(f)) if f == int(f) else s
    except ValueError:
        return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--row", action="append", default=[], metavar="Title|Issue|Box",
                    help='a row to de-duplicate, e.g. "Zatanna|6|101". Repeatable.')
    ap.add_argument("--keep", type=int, default=1, help="how many copies to keep (default 1)")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    if not args.row:
        raise SystemExit('pass at least one --row "Title|Issue|Box"')

    targets = []
    for r in args.row:
        parts = r.split("|")
        if len(parts) != 3:
            raise SystemExit(f'bad --row {r!r}: expected "Title|Issue|Box"')
        targets.append((parts[0].strip().lower(), norm_issue(parts[1]), parts[2].strip()))

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
    cT, cI, cB = ci("Title"), ci("Issue #", "Issue"), ci("Box #", "Box")
    if not (cT and cI and cB):
        raise SystemExit("missing Title / Issue / Box column")

    # Collect matching row indices per target, in sheet order.
    matches = {t: [] for t in targets}
    for row in range(2, ws.max_row + 1):
        key = (str(ws.cell(row, cT).value or "").strip().lower(),
               norm_issue(ws.cell(row, cI).value),
               str(ws.cell(row, cB).value or "").strip())
        if key in matches:
            matches[key].append(row)

    to_delete = []
    for t in targets:
        found = matches[t]
        title, iss, box = t
        print(f"{title!r} #{iss} Box {box}: found {len(found)} row(s), keep {args.keep}")
        if len(found) <= args.keep:
            print("   nothing to remove")
            continue
        drop = found[args.keep:]        # keep the first `keep`, drop the rest
        to_delete.extend(drop)
        for r in drop:
            print(f"   {'DELETE' if args.apply else 'would delete'} row {r}")

    if not to_delete:
        print("\nNothing to do.")
        return
    if not args.apply:
        print(f"\nDRY RUN — would delete {len(to_delete)} row(s). Re-run with --apply.")
        return

    for r in sorted(to_delete, reverse=True):   # bottom-up so indices stay valid
        ws.delete_rows(r, 1)
    ts = datetime.datetime.now().strftime("%d%m_%H%M")
    out = os.path.join(ASSETS, f"comics_inventory_{ts}.xlsx")
    wb.save(out)
    print(f"\nDELETED {len(to_delete)} row(s). WROTE {os.path.basename(out)}  (all sheets preserved)")
    print('Next: python3 brb.py --commit "remove duplicate intake rows" --yes')


if __name__ == "__main__":
    main()
