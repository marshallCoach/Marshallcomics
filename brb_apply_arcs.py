#!/usr/bin/env python3
"""
brb_apply_arcs.py -- write the arc columns into a NEW dated inventory workbook.

Reads   arc_extracted.csv (from brb_arc_extract.py) + newest attached_assets xlsx
Writes  a NEW comics_inventory_DDMM_HHMM.xlsx (the source file is never modified)
        arc_apply_report.csv (every extracted book that didn't match a row, and why)

Only these 7 columns are written (created at the far right if missing):
  Story Arc | Arc Part | Arc Length | Finale Issue # | Crossover Event (Fandom) |
  Arc Confidence | Arc Source
Every other column -- including "Arc / Story" and "Key Issue — Why" -- is verified
cell-for-cell identical before saving; any difference aborts without writing.

Rows are matched by CONTENT (title + issue + volume, year within +/-1), never by the
old rid numbers. Duplicate copies of the same book all get the same arc values.
Dry run by default.

    python3 brb_apply_arcs.py            # dry run: counts + samples, nothing written
    python3 brb_apply_arcs.py --apply    # write the new workbook
    python3 brb_apply_arcs.py --csv cv_arcs.csv --fill-only [--apply]
        # Comic Vine pass: only rows whose Story Arc is still blank, only blank cells --
        # Fandom arcs and events are never overwritten
Then:  python3 brb.py --commit "arc columns" --yes
"""
import argparse, collections, csv, datetime, glob, os, re, sys
import openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "attached_assets")
INV = "✅ Clean Inventory"
NEW_COLS = ["Story Arc", "Arc Part", "Arc Length", "Finale Issue #",
            "Crossover Event (Fandom)", "Arc Confidence", "Arc Source"]


def _fn_key(f):
    m = re.search(r"_(\d{2})(\d{2})_(\d{2})(\d{2})", os.path.basename(f))
    if m:
        dd, mm, hh, mi = (int(x) for x in m.groups())
        return (1, mm, dd, hh, mi, os.path.getmtime(f))
    return (0, 0, 0, 0, 0, os.path.getmtime(f))


def newest_xlsx():
    m = [f for f in glob.glob(os.path.join(ASSETS, "comics_inventory_*.xlsx"))
         if " copy" not in f and not os.path.basename(f).startswith("~$")]
    if not m:
        sys.exit("no attached_assets/comics_inventory_*.xlsx found")
    return max(m, key=_fn_key)


def norm(t):
    return re.sub(r"[^a-z0-9]+", " ", str(t or "").lower().replace("&", " and ")).strip()


def ni(v):
    s = str(v if v is not None else "").strip().lstrip("#")
    try:
        f = float(s)
        return str(int(f)) if f == int(f) else s
    except ValueError:
        return s


def yr(v):
    m = re.search(r"(\d{4})", str(v or ""))
    return int(m.group(1)) if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default="arc_extracted.csv")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--fill-only", action="store_true",
                    help="only rows with a blank Story Arc, only blank cells (never overwrite)")
    a = ap.parse_args()
    if not os.path.exists(a.csv):
        sys.exit(f"{a.csv} not found - run brb_arc_extract.py first")
    ext = list(csv.DictReader(open(a.csv, newline="", encoding="utf-8")))

    src = newest_xlsx()
    wb = openpyxl.load_workbook(src)
    ws = [w for w in wb.worksheets if w.title.startswith(INV)][-1]
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]
    ci = lambda n: (H.index(n) + 1 if n in H else None)
    cT, cI, cV, cY = ci("Title"), ci("Issue #"), ci("Volume"), ci("Year")
    for n, c in (("Title", cT), ("Issue #", cI), ("Year", cY)):
        if not c:
            sys.exit(f"required column '{n}' missing")
    orig_max_col = ws.max_column
    cArc = ci("Story Arc")

    # snapshot every existing cell (to prove nothing else changes)
    before = [[ws.cell(r, c).value for c in range(1, orig_max_col + 1)] for r in range(1, ws.max_row + 1)]

    # index inventory rows by (title, issue, volume)
    idx = collections.defaultdict(list)
    for r in range(2, ws.max_row + 1):
        t = ws.cell(r, cT).value
        if not str(t or "").strip():
            continue
        vol = str(ws.cell(r, cV).value or "1").strip() if cV else "1"
        idx[(norm(t), ni(ws.cell(r, cI).value), ni(vol) or "1")].append(r)

    plan = {}                                         # row -> values
    report, st = [], collections.Counter()
    for e in ext:
        key = (norm(e["title"]), ni(e["issue"]), ni(e["sheet_volume"]) or "1")
        rows = idx.get(key, [])
        ey = yr(e["year"])
        exact = [r for r in rows if yr(ws.cell(r, cY).value) == ey]
        near = [r for r in rows if ey and yr(ws.cell(r, cY).value) and abs(yr(ws.cell(r, cY).value) - ey) <= 1]
        hit = exact or near
        if not hit:
            st["unmatched"] += 1
            report.append([e["title"], e["sheet_volume"], e["issue"], e["year"],
                           "no row with this title/issue/volume" if not rows else "year differs by more than 1"])
            continue
        if not exact and len({yr(ws.cell(r, cY).value) for r in near}) > 1:
            st["ambiguous"] += 1
            report.append([e["title"], e["sheet_volume"], e["issue"], e["year"], "ambiguous year match - skipped"])
            continue
        vals = [e.get(c, "") for c in NEW_COLS]
        if a.fill_only and cArc:
            kept = [r for r in hit if not str(ws.cell(r, cArc).value or "").strip()]
            if not kept:
                st["already had an arc"] += 1
                continue
            hit = kept
        for r in hit:
            plan[r] = vals
        st["books matched"] += 1
        st["rows written"] += len(hit)

    print(f"SOURCE: {os.path.basename(src)}  ({ws.max_row - 1} rows)")
    print(f"extracted books: {len(ext)}  matched: {st['books matched']}  -> inventory rows: {st['rows written']}"
          f"  (copies included)  unmatched: {st['unmatched']}  ambiguous: {st['ambiguous']}")
    if a.fill_only:
        print(f"FILL-ONLY: skipped {st['already had an arc']} books that already have a Story Arc; blank cells only")
    withname = sum(1 for v in plan.values() if v[0])
    withev = sum(1 for v in plan.values() if v[4])
    print(f"rows getting a Story Arc: {withname}   a Crossover Event: {withev}")
    print("sample:")
    for r in list(plan)[:8]:
        v = plan[r]
        print(f"  row {r}: {ws.cell(r, cT).value} #{ni(ws.cell(r, cI).value)} -> "
              f"{v[0] or '-'} | part {v[1] or '-'}/{v[2] or '-'} | {v[5] or '-'} | ev {v[4] or '-'}")

    with open(os.path.join(ROOT, "arc_apply_report.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["title", "sheet_volume", "issue", "year", "reason"])
        w.writerows(report)
    print("unmatched list -> arc_apply_report.csv")

    if not a.apply:
        print("\nDRY RUN - nothing written. Re-run with --apply.")
        return

    # columns: reuse if present, else append at the far right
    col = {}
    for name in NEW_COLS:
        col[name] = ci(name) or None
    nxt = ws.max_column + 1
    for name in NEW_COLS:
        if not col[name]:
            ws.cell(1, nxt, name)
            col[name] = nxt
            nxt += 1
    for r, vals in plan.items():
        for name, v in zip(NEW_COLS, vals):
            if a.fill_only and str(ws.cell(r, col[name]).value or "").strip():
                continue                               # never overwrite existing data
            if v == "" and a.fill_only:
                continue
            ws.cell(r, col[name], v if v != "" else None)

    # verify every pre-existing column is untouched (arc columns excluded if they pre-existed)
    protected = [c for c in range(1, orig_max_col + 1) if c not in col.values()]
    diffs = 0
    for r in range(1, len(before) + 1):
        for c in protected:
            if ws.cell(r, c).value != before[r - 1][c - 1]:
                diffs += 1
    if diffs:
        sys.exit(f"ABORTED: {diffs} protected cell(s) changed - nothing written")
    print(f"verified: all {len(protected)} original columns identical (incl. Arc / Story, Key Issue — Why)")

    out = os.path.join(ASSETS, f"comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    print(f"WROTE: {os.path.basename(out)}  ({len(plan)} rows given arc columns)")
    print('Next: python3 brb.py --commit "arc columns" --yes')


if __name__ == "__main__":
    main()
