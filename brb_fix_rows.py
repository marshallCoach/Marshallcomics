#!/usr/bin/env python3
"""
brb_fix_rows.py -- apply a REVIEWED list of row fixes: change named cells, or move a
duplicate row to the 'Duplicates' tab. Nothing is ever deleted outright.

Each fix names ONE row exactly (title, issue, box, year, volume - all must match, and only
one row may match) and either
    {"set": {"Issue #": "83"}, "old": {"Issue #": "498"}}   - change cells still holding `old`
    {"move_to_duplicates": "why"}                           - move the row to the Duplicates tab
    {"move_to_duplicates": "why", "rows": 2}                - two IDENTICAL rows (same key): move both
    {"where": {"Arc / Story": "x"}, ...}                     - pick one of several rows sharing the key
A row that no longer matches (already fixed, or edited since) is skipped, so a second run
changes nothing. Every other cell is verified unchanged; one Data Integrity Log entry is added.
    python3 brb_fix_rows.py avengers_vol3_dupes.json            # dry run
    python3 brb_fix_rows.py avengers_vol3_dupes.json --apply
"""
import argparse, datetime, json, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
from brb_apply_arcs import newest_xlsx, ni, INV   # noqa: E402
LOG_TAB = "📝 Data Integrity Log"


def s(v):
    return str(v if v is not None else "").strip()


def main():
    from brb_runlock import wait_for_turn
    wait_for_turn()          # never write the xlsx while a run is going
    ap = argparse.ArgumentParser()
    ap.add_argument("fixes")
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    fixes = json.load(open(a.fixes))
    import openpyxl
    src = newest_xlsx()
    wb = openpyxl.load_workbook(src)
    ws = [w for w in wb.worksheets if w.title.startswith(INV)][-1]
    H = [s(c.value) for c in ws[1]]
    ci = lambda n: H.index(n) + 1 if n in H else None
    cT, cI, cB, cY, cV = ci("Title"), ci("Issue #"), ci("Box #") or ci("Box"), ci("Year"), ci("Volume")
    rowkey = lambda r: (s(ws.cell(r, cT).value), ni(ws.cell(r, cI).value), s(ws.cell(r, cB).value),
                        s(ws.cell(r, cY).value)[:4], ni(ws.cell(r, cV).value) if cV else "")
    index = {}
    for r in range(2, ws.max_row + 1):
        index.setdefault(rowkey(r), []).append(r)
    sets, moves, skipped = [], [], []
    for f in fixes:
        k = (s(f["title"]), ni(f["issue"]), s(f["box"]), s(f["year"])[:4], ni(f.get("volume", "")))
        hit = index.get(k, [])
        # "where": {"Arc / Story": "..."} narrows rows that share the key (Nov 23: two Gargoyles #1 copies)
        if f.get("where"):
            hit = [r for r in hit if all(s(ws.cell(r, ci(c)).value) == s(v) for c, v in f["where"].items() if ci(c))]
        want = int(f.get("rows", 1))      # "rows": 2 = two identical rows (same key) - move both
        if "move_to_duplicates" in f and want > 1 and len(hit) == want:
            moves.extend((r, f) for r in hit); continue
        if len(hit) != 1:
            skipped.append((f, "no matching row (already done?)" if not hit else f"{len(hit)} rows match - ambiguous, left alone")); continue
        r = hit[0]
        if "move_to_duplicates" in f:
            moves.append((r, f))
        else:
            if any(s(ws.cell(r, ci(col)).value) != s(old) for col, old in f["old"].items()):
                skipped.append((f, "cell no longer holds the reviewed old value - left alone")); continue
            sets.append((r, f))
    print(f"SOURCE: {os.path.basename(src)}   fixes: {len(fixes)}   cell changes: {len(sets)}   "
          f"rows to Duplicates tab: {len(moves)}   skipped: {len(skipped)}")
    for r, f in sets:
        print(f"  SET  row {r} {f['title']} #{f['issue']} ({f['box'][:12]}): " + ", ".join(f"{c} {f['old'][c]!r} -> {v!r}" for c, v in f["set"].items()))
    for r, f in moves:
        print(f"  MOVE row {r} {f['title']} #{f['issue']} {f['year']} ({f['box'][:12]}) -> Duplicates tab: {f['move_to_duplicates']}")
    for f, why in skipped:
        print(f"  SKIP {f['title']} #{f['issue']}: {why}")
    if not a.apply:
        print("DRY RUN - nothing written. Re-run with --apply."); return
    if not sets and not moves:
        print("nothing to write"); return
    from brb_guard import check
    check("row_fixes", {"cells changed": sum(len(f["set"]) for _, f in sets), "rows moved to Duplicates": len(moves)})
    n_before = ws.max_row
    # Snapshot in ONE pass. Nov 23: `ws[r]` per row re-measures max_column over every
    # cell each call - on 11,900 rows that hung the Mac before saving (nothing written).
    maxc = ws.max_column
    keep = {r: list(v) for r, v in enumerate(ws.iter_rows(min_row=2, max_col=maxc, values_only=True), 2)}
    for r, f in sets:
        for col, v in f["set"].items():
            ws.cell(r, ci(col)).value = int(v) if str(v).isdigit() and isinstance(ws.cell(r, ci(col)).value, int) else v
    dws = wb["Duplicates"] if "Duplicates" in wb.sheetnames else wb.create_sheet("Duplicates")
    for r, f in moves:
        dws.append([ws.cell(r, cB).value, ws.cell(r, cT).value, f"#{ni(ws.cell(r, cI).value)} [DUPLICATE]",
                    ws.cell(r, cY).value, ws.cell(r, ci("Est. Raw Value (NM) $")).value if ci("Est. Raw Value (NM) $") else "",
                    "", f["move_to_duplicates"]])
    for r, _ in sorted(moves, key=lambda x: -x[0]):
        ws.delete_rows(r)
    # verify: exactly the moved rows are gone; every surviving cell is unchanged except the set ones
    gone = {r for r, _ in moves}
    setcells = {(r, ci(c)) for r, f in sets for c in f["set"]}
    survivors = [r for r in sorted(keep) if r not in gone]
    if ws.max_row != n_before - len(moves):
        sys.exit("ABORTED: row count check failed - nothing written")
    after = ws.iter_rows(min_row=2, max_row=ws.max_row, max_col=maxc, values_only=True)
    for (new_r, old_r), now in zip(enumerate(survivors, 2), after):
        for c, (v, nv) in enumerate(zip(keep[old_r], now), 1):
            if (old_r, c) not in setcells and nv != v:
                sys.exit(f"ABORTED: row {old_r} col {c} changed unexpectedly - nothing written")
    stamp = datetime.datetime.now().strftime("%d%m_%H%M")
    if LOG_TAB in wb.sheetnames:
        wb[LOG_TAB].append([stamp, "Row fixes (reviewed list)",
                            f"{os.path.basename(a.fixes)}: {len(sets)} row(s) corrected, {len(moves)} duplicate row(s) moved to "
                            f"the Duplicates tab (not deleted). Confirmed by Robert."])
    out = os.path.join(ROOT, "attached_assets", f"comics_inventory_{stamp}.xlsx")
    wb.save(out)
    print(f"verified: only the listed cells changed, {len(moves)} row(s) moved.  WROTE: {os.path.basename(out)}  ({n_before - 1} -> {ws.max_row - 1} rows)")


if __name__ == "__main__":
    main()
