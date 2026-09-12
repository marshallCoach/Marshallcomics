#!/usr/bin/env python3
"""brb_erase_dupes.py — delete the books you marked '🗑 dupe to erase' in the app.

Reads a flagged-covers export (the JSON the Cover Review "export" button
downloads), keeps only entries with kind == "dupe", and deletes the matching
rows from the canonical xlsx. Match is exact on Title + Issue # + Box # — the
same identity the app uses — so nothing else is touched. Dry-run by default.

    python3 brb_erase_dupes.py                       # auto-find newest export, preview
    python3 brb_erase_dupes.py --flags ~/Downloads/flagged-covers-2026-09-13.json
    python3 brb_erase_dupes.py --apply
Then: python3 brb.py --commit "erase marked duplicates" --yes
"""
import argparse, datetime, glob, json, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))


def newest(pattern_dirs, pat):
    cands = []
    for d in pattern_dirs:
        cands += glob.glob(os.path.join(os.path.expanduser(d), pat))
    return max(cands, key=os.path.getmtime) if cands else None


def newest_xlsx():
    cands = [f for f in glob.glob(os.path.join(ROOT, "attached_assets/comics_inventory_*.xlsx"))
             if " copy" not in f and not os.path.basename(f).startswith("~$")]
    if not cands:
        sys.exit("no attached_assets/comics_inventory_*.xlsx found")
    return max(cands, key=os.path.getmtime)


def norm_issue(v):
    s = str(v or "").strip().lstrip("#")
    try:
        f = float(s); return str(int(f)) if f == int(f) else s
    except ValueError:
        return s


def key(title, issue, box):
    return (str(title or "").strip().lower(), norm_issue(issue), str(box or "").strip())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--flags", help="path to a flagged-covers-*.json export")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    flags_path = args.flags or newest([".", "~/Downloads", ROOT], "flagged-covers-*.json")
    if not flags_path or not os.path.exists(flags_path):
        sys.exit("no flagged-covers export found — pass --flags <path> (export it from Cover → Cover Review)")
    data = json.load(open(flags_path))
    entries = data if isinstance(data, list) else list(data.values())
    dupes = {key(e.get("Title"), e.get("Issue"), e.get("Box")) for e in entries if e.get("kind") == "dupe"}
    print(f"FLAGS:  {os.path.basename(flags_path)}  ({len(dupes)} marked 'dupe to erase')")
    if not dupes:
        print("Nothing marked as a dupe to erase — done.")
        return

    import openpyxl
    src = newest_xlsx()
    wb = openpyxl.load_workbook(src)
    ws = next(w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory"))
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]

    def ci(n):
        return H.index(n) + 1 if n in H else None
    cT, cI, cB = ci("Title"), ci("Issue #"), ci("Box #")

    hits = []
    for r in range(2, ws.max_row + 1):
        k = key(ws.cell(r, cT).value, ws.cell(r, cI).value, ws.cell(r, cB).value)
        if k in dupes:
            hits.append((r, ws.cell(r, cT).value, ws.cell(r, cI).value, ws.cell(r, cB).value))

    print(f"SOURCE: {os.path.basename(src)}\n\nWOULD DELETE {len(hits)} row(s):")
    for r, t, i, b in hits:
        print(f"  row {r}  {t} #{norm_issue(i)}  Box {b}")
    matched = {key(t, i, b) for _, t, i, b in hits}
    missing = dupes - matched
    if missing:
        print(f"\n⚠ {len(missing)} marked dupe(s) not found in the sheet (already gone?):")
        for t, i, b in sorted(missing):
            print(f"    {t} #{i} Box {b}")

    if not args.apply:
        print("\nDRY RUN — nothing written. Re-run with --apply to write a new xlsx.")
        return

    for r, *_ in sorted(hits, reverse=True):   # bottom-up so indices stay valid
        ws.delete_rows(r, 1)
    out = os.path.join(ROOT, f"attached_assets/comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    print(f"\nWROTE: {os.path.basename(out)}  ({len(hits)} rows deleted)")
    print("Next: python3 brb.py --commit \"erase marked duplicates\" --yes")


if __name__ == "__main__":
    main()
