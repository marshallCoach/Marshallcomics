#!/usr/bin/env python3
"""brb_credits_gcd.py — overnight credits fill+correct from the local GCD.

Free, offline, no AI vision. For every inventory row it resolves the GCD
series+issue (reusing the same matcher as brb_gcd_lookup / the volume check)
and pulls three credits:

    Writer(s)    <- GCD script credit  (comic-story sequences)
    Artist(s)    <- GCD pencils credit (comic-story sequences)
    Cover Artist <- GCD penciller on the COVER sequence (type_id=6)

Write mode (confirmed: fill blanks + AUTO-CORRECT):
  * Empty cell  -> filled when GCD has a value.
  * Non-empty cell that DISAGREES with GCD -> overwritten with GCD's value.
  * GCD returns nothing for a role -> the existing cell is left untouched
    (we never blank a hand-entered credit just because GCD is silent).

Every fill and every overwrite is logged to a review CSV (old -> new, with the
resolved GCD series) so nothing is silent. Read-only against the xlsx until the
end; writes a NEW dated xlsx (the canonical file is never edited in place).

Usage:
    python3 brb_credits_gcd.py --dry-run            # preview counts + CSV, no xlsx
    python3 brb_credits_gcd.py --limit 300          # small live sample
    python3 brb_credits_gcd.py                       # full run, writes new xlsx
Then:
    python3 brb.py --commit "GCD credits fill+correct" --yes
"""
import argparse, csv, datetime, glob, os, re, sqlite3, sys

from brb_gcd_lookup import find_series, find_credits, norm_issue

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "attached_assets")
DB = os.path.join(ROOT, "gcd_local.sqlite")

# Sheet headers (exact) — must match gen_data.mjs col() names.
H_TITLE, H_ISSUE, H_YEAR, H_PUB, H_BOX = "Title", "Issue #", "Year", "Publisher", "Box #"
ROLES = {  # inventory column -> key in find_credits() result
    "Writer(s)": "writer",
    "Artist(s)": "artist",
    "Cover Artist": "cover_artist",
}


def latest_xlsx():
    m = [f for f in glob.glob(os.path.join(ASSETS, "comics_inventory_*.xlsx"))
         if " copy" not in f and not os.path.basename(f).startswith("~$")]
    if not m:
        sys.exit("no attached_assets/comics_inventory_*.xlsx found")
    return max(m, key=os.path.getmtime)


def norm_name(v):
    """Loose compare so 'humberto  ramos' == 'Humberto Ramos' isn't a false
    change. Drops case, punctuation, collapses whitespace."""
    return re.sub(r"[^a-z0-9]+", " ", str(v or "").lower()).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="preview + CSV, don't write xlsx")
    ap.add_argument("--limit", type=int, default=None, help="only process first N rows (testing)")
    ap.add_argument("--csv", default=os.path.join(ROOT, "credits_gcd_changes.csv"))
    args = ap.parse_args()

    src = latest_xlsx()
    print(f"Inventory: {os.path.basename(src)}")
    conn = sqlite3.connect(DB)

    import openpyxl
    wb = openpyxl.load_workbook(src)
    ws = next(w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory"))
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]

    def cidx(name):
        if name not in H:
            sys.exit(f"column '{name}' not found in sheet")
        return H.index(name) + 1  # openpyxl is 1-based

    cT, cI, cY, cP = cidx(H_TITLE), cidx(H_ISSUE), cidx(H_YEAR), cidx(H_PUB)
    role_cols = {col: cidx(col) for col in ROLES}

    # cache resolved series per (title, publisher, year-bucket) — find_series is
    # the repeated cost; credits are still looked up per issue.
    series_cache = {}

    def resolve_series(title, year, pub):
        key = (title, pub, str(year))
        if key not in series_cache:
            series_cache[key] = find_series(conn, title, year, pub)
        return series_cache[key]

    filled = {c: 0 for c in ROLES}
    corrected = {c: 0 for c in ROLES}
    rows_touched = no_series = no_issue = 0
    changes = []

    last = ws.max_row if not args.limit else min(ws.max_row, 1 + args.limit)
    for r in range(2, last + 1):
        title = str(ws.cell(r, cT).value or "").strip()
        if not title:
            continue
        issue = ws.cell(r, cI).value
        year = ws.cell(r, cY).value
        pub = str(ws.cell(r, cP).value or "").strip()

        series = resolve_series(title, year, pub)
        if not series:
            no_series += 1
            continue
        cr = find_credits(conn, series["id"], issue)
        if not cr:
            no_issue += 1
            continue

        row_changed = False
        for col, role in ROLES.items():
            new = cr.get(role)
            if not new:
                continue  # GCD silent -> never blank an existing value
            cell = ws.cell(r, role_cols[col])
            old = str(cell.value or "").strip()
            if not old:
                cell.value = new
                filled[col] += 1
                changes.append((title, norm_issue(issue), str(year), pub, series["name"], col, "FILL", "", new))
                row_changed = True
            elif norm_name(old) != norm_name(new):
                cell.value = new
                corrected[col] += 1
                changes.append((title, norm_issue(issue), str(year), pub, series["name"], col, "CORRECT", old, new))
                row_changed = True
        if row_changed:
            rows_touched += 1

    # review CSV
    with open(args.csv, "w", newline="") as f:
        wr = csv.writer(f)
        wr.writerow(["Title", "Issue", "Year", "Publisher", "GCD_Series", "Field", "Action", "Old", "New"])
        wr.writerows(changes)

    print(f"\n{'='*60}")
    print("  GCD CREDITS — fill blanks + auto-correct")
    print(f"{'='*60}")
    for col in ROLES:
        print(f"  {col:<14}  filled {filled[col]:>5}   corrected {corrected[col]:>5}")
    print(f"  {'-'*40}")
    print(f"  Rows touched:            {rows_touched:,}")
    print(f"  No GCD series match:     {no_series:,}")
    print(f"  Series ok, issue absent: {no_issue:,}")
    print(f"  Change log:              {os.path.relpath(args.csv, ROOT)} ({len(changes)} rows)")

    if args.dry_run:
        print("\n  DRY RUN — no xlsx written. Re-run without --dry-run to apply.")
        return
    if not changes:
        print("\n  Nothing to change — no xlsx written.")
        return

    out = os.path.join(ASSETS, f"comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    print(f"\n  WROTE: {os.path.basename(out)}")
    print("  Next: python3 brb.py --commit \"GCD credits fill+correct\" --yes")


if __name__ == "__main__":
    main()
