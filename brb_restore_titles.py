#!/usr/bin/env python3
"""brb_restore_titles.py — restore corrupted titles from clean git history.

After the 77-rename accident, the backup workbook has all recent work but wrong
titles. The renames only touched Title (and the title text inside Key Issue — Why
/ Seller Notes); every other field is intact. The CORRECT titles for those exact
rows live in a clean commit's data3.ts, keyed by the stable Entry id (xlsx column
'#'). This matches each row by Entry and puts the clean Title / Key Why / Seller
Notes back — merges and collisions included, because Entry is unique per row.

    python3 brb_restore_titles.py                     # restore into a new workbook
    python3 brb_restore_titles.py --src backups/comics_inventory_latest.xlsx \
                                  --from c485f45
Then: python3 brb.py --commit "restore titles from clean history" --yes
"""
import argparse, datetime, os, re, subprocess, sys
import openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "attached_assets")
DATA3 = "artifacts/comics-inventory/src/data/data3.ts"


def clean_titles(commit):
    """{Entry -> (Title, Key_Reason, Seller_Notes)} from a clean data3.ts in git."""
    try:
        src = subprocess.check_output(["git", "show", f"{commit}:{DATA3}"], cwd=ROOT).decode("utf-8", "replace")
    except subprocess.CalledProcessError:
        sys.exit(f"could not read {DATA3} at commit {commit}")
    # Pair fields positionally: each record runs from its Title: to the next Title:,
    # so the Entry/Key_Reason/Seller_Notes found in that span belong to that record.
    # (A block regex mis-pairs because field order/newlines vary.)
    tpos = [(mm.start(), mm.group(1)) for mm in re.finditer(r"Title:\s*`([^`]*)`", src)]
    bounds = [tpos[i][0] for i in range(len(tpos))] + [len(src)]
    def find(name, lo, hi):
        mm = re.search(name + r":\s*`([^`]*)`", src[lo:hi])
        return mm.group(1) if mm else ""
    out = {}
    for i, (pos, title) in enumerate(tpos):
        hi = bounds[i + 1]
        entry = find("Entry", pos, hi)
        if entry:
            out[entry] = (title, find("Key_Reason", pos, hi), find("Seller_Notes", pos, hi))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=os.path.join(ROOT, "backups/comics_inventory_latest.xlsx"))
    ap.add_argument("--from", dest="commit", default="c485f45", help="clean commit to pull titles from")
    ap.add_argument("--apply", action="store_true", help="write the restored workbook (default: dry run)")
    args = ap.parse_args()

    if not os.path.exists(args.src):
        sys.exit(f"source workbook not found: {args.src}")
    titles = clean_titles(args.commit)
    print(f"Clean titles loaded: {len(titles)} rows (by Entry) from {args.commit}")

    wb = openpyxl.load_workbook(args.src)
    ws = next((w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory")), None)
    if ws is None:
        sys.exit("no '✅ Clean Inventory' tab in the source workbook")
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]
    def ci(n): return H.index(n) + 1 if n in H else None
    cEntry, cT = ci("#"), ci("Title")
    cKR, cSN = ci("Key Issue — Why"), ci("Seller Notes / Variants / Caveats")
    if not cEntry or not cT:
        sys.exit(f"source workbook missing '#' or 'Title' column (have: {H[:8]}…)")

    changed, nomatch, title_fixed = 0, 0, 0
    examples = []
    for r in range(2, ws.max_row + 1):
        e = str(ws.cell(r, cEntry).value or "").strip()
        if not e or e not in titles:
            if str(ws.cell(r, cT).value or "").strip():
                nomatch += 1
            continue
        ct, ckr, csn = titles[e]
        cur = str(ws.cell(r, cT).value or "")
        if cur != ct:
            if len(examples) < 20:
                examples.append((cur, ct))
            title_fixed += 1
            if args.apply:
                ws.cell(r, cT, ct)
                if cKR and ckr:
                    ws.cell(r, cKR, ckr)
                if cSN and csn:
                    ws.cell(r, cSN, csn)
            changed += 1

    print(f"\nTitles that differ from clean (would be restored): {title_fixed}")
    print(f"Rows with no Entry match (left untouched): {nomatch}")
    print("\nSample restorations:")
    for cur, ct in examples:
        print(f"  {cur!r}  ->  {ct!r}")

    if not args.apply:
        print("\nDry run — re-run with --apply to write the restored workbook.")
        return
    out = os.path.join(ASSETS, f"comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    print(f"\nWROTE {os.path.basename(out)}  ({title_fixed} titles restored)")
    print("Next: python3 brb.py --commit \"restore titles from clean history\" --yes")


if __name__ == "__main__":
    main()
