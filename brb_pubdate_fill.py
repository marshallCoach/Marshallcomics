#!/usr/bin/env python3
"""brb_pubdate_fill.py — add & populate a 'Publication Date' column for EVERY
comic, using the local GCD subset only. Free, offline, no API/usage credits.

For each row it resolves the GCD series (scored by year + publisher, same logic
as brb_gcd_lookup.py) then finds the issue and takes its real on-sale date:
  1. gcd_issue.key_date        (YYYY-MM-DD; GCD writes -00 for unknown day)
  2. gcd_issue.publication_date (free-text cover date) as a fallback
Anything GCD can't match is left BLANK — never guessed.

Writes a NEW dated xlsx (never edits the source in place). Existing values in
the column are preserved unless --overwrite is given; re-runs after a GCD
refresh only fill the gaps. After running:
    python3 brb.py --commit "populate Publication Date" --yes
regenerates data (gen_data.mjs now maps 'Publication Date' -> Pub_Date) & pushes.

Usage:
    python3 brb_pubdate_fill.py            # fill blanks only
    python3 brb_pubdate_fill.py --overwrite
"""
import argparse, datetime, glob, os, sqlite3, sys
from collections import Counter

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
from brb_gcd_lookup import find_series, norm_issue

DB = os.path.join(ROOT, "gcd_local.sqlite")
COLNAME = "Publication Date"


def newest_xlsx():
    cands = [f for f in glob.glob(os.path.join(ROOT, "attached_assets/comics_inventory_*.xlsx"))
             if " copy" not in f and not os.path.basename(f).startswith("~$")]
    if not cands:
        sys.exit("no attached_assets/comics_inventory_*.xlsx found")
    return max(cands, key=os.path.getmtime)


def gcd_date(conn, cache, title, issue, year, publisher):
    """Resolve series then issue; return (date_str, kind) or (None, reason)."""
    skey = (title, year, publisher)
    if skey in cache:
        series = cache[skey]
    else:
        series = cache[skey] = find_series(conn, title, year, publisher)
    if not series:
        return None, "no_series"
    inum = norm_issue(issue)
    for number, key_date, pub_date in conn.execute(
            "SELECT number, key_date, publication_date FROM gcd_issue WHERE series_id = ?",
            (series["id"],)):
        if norm_issue(number) == inum:
            if key_date and key_date[:4].isdigit() and key_date[:4] != "0000":
                return key_date, "key_date"
            if pub_date and pub_date.strip():
                return pub_date.strip(), "pub_date"
            return None, "issue_no_date"
    return None, "no_issue"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--overwrite", action="store_true",
                    help="replace existing Publication Date values too")
    args = ap.parse_args()
    if not os.path.exists(DB):
        sys.exit(f"GCD database not found: {DB}\nBuild it first: python3 gcd_build_local_db.py")

    import openpyxl
    src = newest_xlsx()
    wb = openpyxl.load_workbook(src)
    ws = next(w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory"))
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]

    def ci(name):
        return H.index(name) + 1 if name in H else None
    cT, cI, cP, cY = ci("Title"), ci("Issue #"), ci("Publisher"), ci("Year")
    if not cT:
        sys.exit("no Title column on the Clean Inventory sheet")

    cPD = ci(COLNAME)
    if cPD is None:
        cPD = ws.max_column + 1
        ws.cell(1, cPD, COLNAME)
        print(f"added '{COLNAME}' column at index {cPD}")

    conn = sqlite3.connect(DB)
    cache, stats = {}, Counter()
    for r in range(2, ws.max_row + 1):
        title = str(ws.cell(r, cT).value or "").strip()
        if not title:
            continue
        stats["rows"] += 1
        existing = str(ws.cell(r, cPD).value or "").strip()
        if existing and not args.overwrite:
            stats["kept_existing"] += 1
            continue
        issue = str(ws.cell(r, cI).value or "").strip() if cI else ""
        pub = str(ws.cell(r, cP).value or "").strip() if cP else ""
        year = str(ws.cell(r, cY).value or "").strip() if cY else ""
        date_str, kind = gcd_date(conn, cache, title, issue, year, pub)
        stats[kind] += 1
        if date_str:
            ws.cell(r, cPD, date_str)
            stats["filled"] += 1

    out = os.path.join(ROOT, f"attached_assets/comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    print(f"\nSOURCE: {os.path.basename(src)}")
    print(f"OUTPUT: {os.path.basename(out)}")
    print("\nCOVERAGE")
    for k in ("rows", "kept_existing", "filled", "key_date", "pub_date",
              "no_series", "no_issue", "issue_no_date"):
        if stats[k]:
            print(f"  {k:16s} {stats[k]}")
    done = stats["filled"] + stats["kept_existing"]
    if stats["rows"]:
        print(f"\n  have a date now: {done}/{stats['rows']} ({100*done/stats['rows']:.0f}%)")
    print("\nNext: python3 brb.py --commit \"populate Publication Date\" --yes")


if __name__ == "__main__":
    main()
