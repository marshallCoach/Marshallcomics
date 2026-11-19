#!/usr/bin/env python3
"""
brb_fix_writers.py -- apply a reviewed list of Writer(s) corrections, cell by cell.

Each fix names the book (title, volume, issue, year, box), the writer the sheet holds NOW
(old) and the corrected writer (new). A cell is changed only if it still holds exactly the
old value, so a second run changes nothing and a cell you edited since is left alone.
A cell that holds only names from the reviewed old value (any order - e.g. GCD's UNION step
re-added a removed name, Nov 19) is corrected too: a reviewed fix outranks GCD. The same
files are LOCKS for brb_credits_gcd.py, which never edits a locked Writer(s) cell.
Every other cell is verified unchanged. Writes a NEW dated workbook. Dry run by default:
    python3 brb_fix_writers.py writer_fixes_bendis.json
    python3 brb_fix_writers.py writer_fixes_bendis.json --apply
"""
import argparse, datetime, glob, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
from brb_apply_arcs import newest_xlsx, ni, INV   # noqa: E402


def names(cell):
    """'A & B, C' -> {'a', 'b', 'c'} (order and spacing don't matter)."""
    return {re.sub(r"\s+", " ", x).strip().lower() for x in re.split(r"\s*(?:&|;|,(?!\s*(?:jr|sr)\b))\s*", str(cell or ""), flags=re.I) if x.strip()}


def key(title, issue, box, vol, year):
    return (str(title or "").strip(), ni(issue), str(box or "").strip(), ni(vol) or "1", str(year or "").strip()[:4])


def locks(root=None):
    """Reviewed Writer(s) fixes from every writer_fixes_*.json: {book key: reviewed writer}."""
    out = {}
    for p in sorted(glob.glob(os.path.join(root or ROOT, "writer_fixes_*.json"))):
        for f in json.load(open(p)):
            out[key(f["title"], f["issue"], f["box"], f["volume"], f["year"])] = f["new"].strip()
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("fixes")
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    fixes = json.load(open(a.fixes))
    import openpyxl
    src = newest_xlsx()
    wb = openpyxl.load_workbook(src)
    ws = [w for w in wb.worksheets if w.title.startswith(INV)][-1]
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]
    ci = lambda n: (H.index(n) + 1 if n in H else None)
    cT, cI, cV, cY, cB, cW = ci("Title"), ci("Issue #"), ci("Volume"), ci("Year"), ci("Box #") or ci("Box"), ci("Writer(s)")
    rows = {}
    for r in range(2, ws.max_row + 1):
        k = key(ws.cell(r, cT).value, ws.cell(r, cI).value, ws.cell(r, cB).value, ws.cell(r, cV).value, ws.cell(r, cY).value)
        rows.setdefault(k, []).append(r)
    _mr, _mc = ws.max_row, ws.max_column
    before = [list(x) for x in ws.iter_rows(min_row=1, max_row=_mr, max_col=_mc, values_only=True)]
    plan, skipped = [], []
    for f in fixes:
        k = key(f["title"], f["issue"], f["box"], f["volume"], f["year"])
        hit = rows.get(k, [])
        if not hit:
            skipped.append((f, "row not found")); continue
        done = False
        for r in hit:
            cur = str(ws.cell(r, cW).value or "").strip()
            if cur == f["new"].strip():
                done = True; break
            if cur == str(f["old"] or "").strip() or (names(cur) and names(cur) <= names(f["old"])):
                plan.append((r, cur, f["new"])); done = True; break
        if not done:
            skipped.append((f, f"writer is now {str(ws.cell(hit[0], cW).value)!r} (not the reviewed value) - left alone"))
    print(f"SOURCE: {os.path.basename(src)}   fixes: {len(fixes)}   cells to change: {len(plan)}   skipped: {len(skipped)}")
    for r, old, new in plan[:80]:
        print(f"  row {r} {ws.cell(r, cT).value} v{ni(ws.cell(r, cV).value)} #{ni(ws.cell(r, cI).value)}: {old!r} -> {new!r}")
    for f, why in skipped:
        print(f"  SKIP {f['title']} #{f['issue']} (box {f['box']}): {why}")
    if not a.apply:
        print("DRY RUN - nothing written. Re-run with --apply."); return
    if not plan:
        print("nothing to write"); return
    from brb_guard import check
    check("writer_fixes", {"writer cells changed": len(plan)})
    for r, _, new in plan:
        ws.cell(r, cW).value = new
    diffs = sum(1 for r in range(1, len(before) + 1) for c in range(1, _mc + 1)
                if c != cW and ws.cell(r, c).value != before[r - 1][c - 1])
    if diffs:
        sys.exit(f"ABORTED: {diffs} other cell(s) changed - nothing written")
    out = os.path.join(ROOT, "attached_assets", f"comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    print(f"verified: only Writer(s) changed.  WROTE: {os.path.basename(out)}")


if __name__ == "__main__":
    main()
