#!/usr/bin/env python3
"""brb_rename_title.py — rename every row of one Title to another, preserving
all sheets. Handy for transcription slips (Red Hawk -> Red Hulk) and the
punctuation/case title splits the validator flags.

    python3 brb_rename_title.py "Red Hawk" "Red Hulk"          # dry run
    python3 brb_rename_title.py "Red Hawk" "Red Hulk" --apply
Then: python3 brb.py --commit "rename Red Hawk -> Red Hulk" --yes

Matches the whole Title, case-insensitively. Loads the full workbook and edits
only the Title column, so every other sheet and its formatting survive.
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
         if not os.path.basename(f).startswith("~$")]
    if not c:
        raise SystemExit("no attached_assets/comics_inventory_*.xlsx found")
    return max(c, key=_fn_key)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("old")
    ap.add_argument("new")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    src = newest_xlsx()
    print(f"source: {os.path.basename(src)}")
    wb = openpyxl.load_workbook(src)
    ws = next(w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory"))
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]
    cT = H.index("Title") + 1 if "Title" in H else None
    cI = H.index("Issue #") + 1 if "Issue #" in H else None
    if not cT:
        raise SystemExit("no Title column")

    old_l = args.old.strip().lower()
    changed = []
    for r in range(2, ws.max_row + 1):
        t = str(ws.cell(r, cT).value or "").strip()
        if t.lower() == old_l:
            iss = str(ws.cell(r, cI).value or "").strip() if cI else ""
            changed.append((r, iss))
            if args.apply:
                ws.cell(r, cT, args.new)

    print(f"\n{'RENAMED' if args.apply else 'WOULD RENAME'} {len(changed)} row(s): "
          f"{args.old!r} -> {args.new!r}")
    for r, iss in changed:
        print(f"   row {r}  #{iss}")
    if not changed:
        print("  (no exact-title matches — nothing to do)")
        return
    if not args.apply:
        print("\nDRY RUN — re-run with --apply.")
        return
    ts = datetime.datetime.now().strftime("%d%m_%H%M")
    out = os.path.join(ASSETS, f"comics_inventory_{ts}.xlsx")
    wb.save(out)
    print(f"\nWROTE {os.path.basename(out)}  (all sheets preserved)")
    print(f'Next: python3 brb.py --commit "rename {args.old} -> {args.new}" --yes')


if __name__ == "__main__":
    main()
