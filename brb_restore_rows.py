#!/usr/bin/env python3
"""
brb_restore_rows.py -- put back inventory rows that were deleted by mistake (Nov 27).

Copies whole rows, by their stable '#' entry number, from an OLDER workbook in
attached_assets/ into a NEW dated copy of the newest one. Nothing else changes.

    python3 brb_restore_rows.py --from comics_inventory_2611_2342.xlsx --entry 6897           # dry run
    python3 brb_restore_rows.py --from comics_inventory_2611_2342.xlsx --entry 6897 --apply

Safety:
  * the two workbooks must have the same column headers (else nothing is written)
  * an entry already in the newest workbook is skipped, so a second run adds 0 rows
  * a book with the same Title + Issue + Volume + Box already present is skipped too
  * every existing cell is verified unchanged; one Data Integrity Log entry is added
  * guard: 20 rows without BRB_FORCE=1
"""
import argparse, datetime, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
from brb_apply_arcs import newest_xlsx, ni, INV   # noqa: E402
LOG_TAB = "📝 Data Integrity Log"


def s(v):
    return str(v if v is not None else "").strip()


def inv_tab(wb):
    tabs = [w for w in wb.worksheets if w.title.startswith(INV)]
    if not tabs:
        sys.exit("no inventory tab found")
    return tabs[-1]


def main():
    from brb_runlock import wait_for_turn
    wait_for_turn()
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="src", required=True, help="older workbook (name in attached_assets/ or a path)")
    ap.add_argument("--entry", action="append", required=True, help="'#' entry number to restore (repeatable)")
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    import openpyxl

    old_p = a.src if os.path.exists(a.src) else os.path.join(ROOT, "attached_assets", a.src)
    if not os.path.exists(old_p):
        sys.exit(f"not found: {a.src}")
    new_p = newest_xlsx()
    if os.path.abspath(old_p) == os.path.abspath(new_p):
        sys.exit("--from is the newest workbook - pick the one from BEFORE the deletion")
    ows = inv_tab(openpyxl.load_workbook(old_p, read_only=True))
    wb = openpyxl.load_workbook(new_p)
    ws = inv_tab(wb)
    H = [s(c.value) for c in ws[1]]
    OH = [s(v) for v in next(ows.iter_rows(min_row=1, max_row=1, values_only=True))]
    if OH[:len(H)] != H or any(OH[len(H):]):
        sys.exit("ABORTED: the two workbooks have different columns - nothing written")
    ci = lambda n: H.index(n) if n in H else None
    cE, cT, cI, cV = ci("#"), ci("Title"), ci("Issue #"), ci("Volume")
    cB = ci("Box #") if ci("Box #") is not None else ci("Box")
    if cE is None:
        sys.exit("no '#' column - can't identify rows safely")

    maxc = len(H)
    keep = [list(v) for v in ws.iter_rows(min_row=2, max_col=maxc, values_only=True)]
    have_e = {s(r[cE]) for r in keep}
    bkey = lambda r: (s(r[cT]).lower(), ni(r[cI]), ni(r[cV]) if cV is not None else "", s(r[cB]))
    have_k = {bkey(r) for r in keep}
    want = [s(e) for e in a.entry]
    found = {}
    for r in ows.iter_rows(min_row=2, max_col=maxc, values_only=True):
        if s(r[cE]) in want:
            found[s(r[cE])] = list(r)

    add, skipped = [], []
    for e in want:
        r = found.get(e)
        if r is None:
            skipped.append((e, f"entry #{e} is not in {os.path.basename(old_p)}"))
        elif e in have_e:
            skipped.append((e, "already in the inventory"))
        elif bkey(r) in have_k:
            skipped.append((e, "same Title + Issue + Volume + Box already in the inventory"))
        else:
            add.append(r)
    print(f"SOURCE: {os.path.basename(new_p)}   restore from: {os.path.basename(old_p)}   "
          f"rows to restore: {len(add)}   skipped: {len(skipped)}")
    for r in add:
        print(f"  RESTORE  #{s(r[cE])} {s(r[cT])} #{ni(r[cI])} (Vol {ni(r[cV]) if cV is not None else '?'}, Box {s(r[cB])})")
    for e, why in skipped:
        print(f"  SKIP     #{e}: {why}")
    if not a.apply or not add:
        print("DRY RUN - nothing written." if not a.apply else "nothing to restore")
        return

    from brb_guard import check
    check("restore_rows", {"rows restored": len(add)})
    n_before = ws.max_row
    for r in add:
        ws.append(r)
    if ws.max_row != n_before + len(add):
        sys.exit("ABORTED: row count check failed - nothing written")
    for i, now in enumerate(ws.iter_rows(min_row=2, max_row=n_before, max_col=maxc, values_only=True)):
        if list(now) != keep[i]:
            sys.exit(f"ABORTED: row {i + 2} changed unexpectedly - nothing written")
    stamp = datetime.datetime.now().strftime("%d%m_%H%M")
    if LOG_TAB in wb.sheetnames:
        wb[LOG_TAB].append([stamp, "Rows restored",
                            f"{len(add)} row(s) put back from {os.path.basename(old_p)} (entries "
                            f"{', '.join('#' + s(r[cE]) for r in add)}) - deleted by mistake. Confirmed by Robert."])
    out = os.path.join(ROOT, "attached_assets", f"comics_inventory_{stamp}.xlsx")
    if os.path.abspath(out) == os.path.abspath(new_p):
        sys.exit("ABORTED: would overwrite the newest workbook - wait a minute and rerun")
    wb.save(out)
    print(f"verified: existing rows unchanged.  WROTE: {os.path.basename(out)}  ({n_before - 1} -> {ws.max_row - 1} rows)")


if __name__ == "__main__":
    main()
