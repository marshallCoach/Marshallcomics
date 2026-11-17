#!/usr/bin/env python3
"""
brb_cv_rollback.py -- undo the Comic Vine arc fill (only where Comic Vine supplied the
arc NAME). Rows go back to exactly what the Fandom pass gave them (arc_extracted.csv),
or blank if Fandom had nothing. Writes a NEW dated workbook; dry run by default.

Untouched: Fandom arcs (incl. the Part/Length/Finale Comic Vine added where both sources
named the SAME arc), the Crossover Event column, and every non-arc column (verified).

    python3 brb_cv_rollback.py            # dry run
    python3 brb_cv_rollback.py --apply
Then re-add the arcs that pass the year check:
    python3 brb_cv_validate.py
    python3 brb_apply_arcs.py --csv cv_arcs_validated.csv --fill-only   (dry run, then --apply)
"""
import argparse, collections, csv, datetime, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
from brb_apply_arcs import newest_xlsx, norm, ni, yr, clean_arc, same_arc, NEW_COLS, INV   # noqa: E402

RESET = ["Story Arc", "Arc Part", "Arc Length", "Finale Issue #", "Arc Confidence", "Arc Source"]   # not the Event column


def load(path):
    out = collections.defaultdict(list)
    if os.path.exists(path):
        for r in csv.DictReader(open(path, newline="", encoding="utf-8")):
            out[(norm(r["title"]), ni(r["issue"]), ni(r["sheet_volume"]) or "1")].append(r)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    if not os.path.exists("cv_arcs.csv"):
        sys.exit("cv_arcs.csv not found")
    cvr, fan = load("cv_arcs.csv"), load("arc_extracted.csv")
    if not fan:
        print("WARNING: arc_extracted.csv not found - rolled-back rows will be blanked, not restored")

    import openpyxl
    src = newest_xlsx()
    wb = openpyxl.load_workbook(src)
    ws = [w for w in wb.worksheets if w.title.startswith(INV)][-1]
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]
    ci = lambda n: (H.index(n) + 1 if n in H else None)
    cT, cI, cV, cY = ci("Title"), ci("Issue #"), ci("Volume"), ci("Year")
    col = {n: ci(n) for n in NEW_COLS}
    if not col["Story Arc"]:
        sys.exit("no Story Arc column")
    # ONE pass. (ws.max_column inside the loop recounted every cell per row = hours on 11k rows.)
    _mr, _mc = ws.max_row, ws.max_column
    before = [list(row) for row in ws.iter_rows(min_row=1, max_row=_mr, max_col=_mc, values_only=True)]

    changes, st = [], collections.Counter()
    for r in range(2, ws.max_row + 1):
        cur = str(ws.cell(r, col["Story Arc"]).value or "").strip()
        if not cur:
            continue
        key = (norm(ws.cell(r, cT).value), ni(ws.cell(r, cI).value), ni(ws.cell(r, cV).value if cV else "1") or "1")
        y = yr(ws.cell(r, cY).value)
        near = lambda l: [x for x in l if y and yr(x["year"]) and abs(yr(x["year"]) - y) <= 1]
        cv = near(cvr.get(key, []))
        if not cv or norm(clean_arc(cv[0]["Story Arc"])) != norm(cur):
            continue                                       # arc name did not come from Comic Vine
        f = near(fan.get(key, []))
        fandom_arc = (f[0]["Story Arc"] or "").strip() if f else ""
        if fandom_arc and same_arc(fandom_arc, cur):
            st["kept (Fandom named the same arc)"] += 1
            continue
        restore = {n: (f[0].get(n) or "") if f else "" for n in RESET}
        for n in RESET:
            old = ws.cell(r, col[n]).value
            if str(old or "") != str(restore[n] or ""):
                changes.append((r, n, old, restore[n]))
        st["rolled back"] += 1

    print(f"SOURCE: {os.path.basename(src)}")
    print("  ".join(f"{k}: {v}" for k, v in st.items()) + f"   cells to change: {len(changes)}")
    for r, n, old, v in changes[:24]:
        print(f"  row {r} {ws.cell(r, cT).value} #{ni(ws.cell(r, cI).value)}: {n}: {old!r} -> {v!r}")
    if len(changes) > 24:
        print(f"  ... and {len(changes) - 24} more")
    if not a.apply:
        print("\nDRY RUN - nothing written. Re-run with --apply.")
        return
    if not changes:
        print("nothing to write"); return
    for r, n, _, v in changes:
        ws.cell(r, col[n]).value = (v if v != "" else None)
    protected = [c for c in range(1, len(before[0]) + 1) if c not in [col[n] for n in RESET]]
    diffs = sum(1 for r in range(1, len(before) + 1) for c in protected if ws.cell(r, c).value != before[r - 1][c - 1])
    if diffs:
        sys.exit(f"ABORTED: {diffs} protected cell(s) changed - nothing written")
    print(f"verified: all {len(protected)} other columns identical (incl. Crossover Event)")
    out = os.path.join(ROOT, "attached_assets", f"comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    print(f"WROTE: {os.path.basename(out)}")
    print("Next: python3 brb_cv_validate.py")


if __name__ == "__main__":
    main()
