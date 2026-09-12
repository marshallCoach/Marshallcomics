#!/usr/bin/env python3
"""brb_apply_volume_check.py — bulk-apply GCD's volume resolution.

Runs the SAME single-series resolution as brb_gcd_volume_check.py, and for every
row whose declared Volume disagrees with the GCD-derived volume, writes GCD's
number in. These are the rows the check resolved to exactly ONE GCD series by
year + publisher — i.e. GCD's authoritative call, not a guess. Every change is
logged to a review CSV (old → new) so you can audit or revert.

Honors volume_review_exclude.txt if present (one title per line, case-insensitive)
so a human-reviewed title is never overwritten. Dry-run by default.

    python3 brb_apply_volume_check.py                 # preview + review CSV
    python3 brb_apply_volume_check.py --apply
Then: python3 brb.py --commit "bulk-apply GCD volumes" --yes
      zsh brb_weekly.sh      # re-pull credits/eBay/date with the corrected volumes
"""
import argparse, csv, datetime, glob, os, sqlite3, sys
from collections import defaultdict
from brb_gcd_volume_check import parse_year_range, pub_match, tight

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "attached_assets")
DB = os.path.join(ROOT, "gcd_local.sqlite")


def latest_xlsx():
    m = [f for f in glob.glob(os.path.join(ASSETS, "comics_inventory_*.xlsx"))
         if not os.path.basename(f).startswith("~$") and " copy" not in f]
    if not m:
        sys.exit("no attached_assets/comics_inventory_*.xlsx found")
    return max(m, key=os.path.getmtime)


def load_exclusions():
    p = os.path.join(ROOT, "volume_review_exclude.txt")
    if not os.path.exists(p):
        return set()
    return {ln.strip().lower() for ln in open(p) if ln.strip() and not ln.startswith("#")}


def build_numbering(conn):
    gcd_by_key = defaultdict(dict)
    for sid, mt, name, yb, ye, pub in conn.execute(
        "SELECT s.id, s.matched_title, s.name, s.year_began, s.year_ended, p.name "
        "FROM gcd_series s LEFT JOIN gcd_publisher p ON p.id = s.publisher_id"):
        gcd_by_key[tight(mt)][sid] = {"id": sid, "name": name, "yb": yb, "ye": ye, "pub": pub}
    try:
        aliases = dict(conn.execute("SELECT alias, matched_title FROM gcd_title_alias"))
    except sqlite3.OperationalError:
        aliases = {}

    def series_for(title):
        pool = dict(gcd_by_key.get(tight(title), {}))
        al = aliases.get(title)
        if al:
            pool.update(gcd_by_key.get(tight(al), {}))
        return list(pool.values())
    return series_for


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    if not os.path.exists(DB):
        sys.exit(f"GCD database not found: {DB}")

    import openpyxl
    xlsx = latest_xlsx()
    conn = sqlite3.connect(DB)
    series_for = build_numbering(conn)
    excl = load_exclusions()

    wb = openpyxl.load_workbook(xlsx)
    ws = next(w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory"))
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]
    ti, ii, yi, vi, pi, bi = (H.index(c) + 1 for c in ("Title", "Issue #", "Year", "Volume", "Publisher", "Box #"))

    numbering_cache, changes, skipped_excl = {}, [], 0
    for r in range(2, ws.max_row + 1):
        title = str(ws.cell(r, ti).value or "").strip()
        if not title:
            continue
        declared = ws.cell(r, vi).value
        if declared is None or str(declared).strip() in ("", "nan"):
            continue
        try:
            declared_n = int(float(declared))
        except (ValueError, TypeError):
            continue
        if title.lower() in excl:
            skipped_excl += 1
            continue

        pub = str(ws.cell(r, pi).value or "").strip()
        ck = (title, pub)
        if ck not in numbering_cache:
            cands = [s for s in series_for(title) if pub_match(pub, s["pub"]) and s["yb"]]
            by_year = {}
            for s in sorted(cands, key=lambda s: (s["yb"], s["id"])):
                by_year.setdefault(s["yb"], s)
            numbering_cache[ck] = sorted(by_year.values(), key=lambda s: s["yb"])
        ordered = numbering_cache[ck]
        if not ordered:
            continue
        yr = parse_year_range(ws.cell(r, yi).value)
        if not yr:
            continue
        hits = [i for i, s in enumerate(ordered) if s["yb"] <= yr[1] and (s["ye"] or 2100) >= yr[0]]
        if len(hits) != 1:
            continue
        derived_n = hits[0] + 1
        if derived_n == declared_n:
            continue
        s = ordered[hits[0]]
        changes.append({"row": r, "Title": title, "Issue": str(ws.cell(r, ii).value),
                        "Box": str(ws.cell(r, bi).value), "Year": str(ws.cell(r, yi).value),
                        "Old_Volume": declared_n, "New_Volume": derived_n,
                        "GCD_Series": f"{s['name']} ({s['yb']}-{s['ye'] or '?'})"})
        if args.apply:
            ws.cell(r, vi, derived_n)

    # review CSV always
    csvp = os.path.join(ROOT, "volume_bulk_apply_review.csv")
    if changes:
        with open(csvp, "w", newline="") as f:
            wr = csv.DictWriter(f, fieldnames=["Title", "Issue", "Box", "Year", "Old_Volume", "New_Volume", "GCD_Series"])
            wr.writeheader()
            for c in changes:
                wr.writerow({k: c[k] for k in wr.fieldnames})

    print(f"Inventory: {os.path.basename(xlsx)}")
    print(f"Volume changes: {len(changes):,}" + (f"   (skipped {skipped_excl} excluded)" if skipped_excl else ""))
    for c in changes[:15]:
        print(f"  {c['Title']} #{c['Issue']} ({c['Year']}): Vol {c['Old_Volume']} -> {c['New_Volume']}   [{c['GCD_Series']}]")
    if len(changes) > 15:
        print(f"  … and {len(changes) - 15:,} more")
    if changes:
        print(f"\nReview CSV: {os.path.basename(csvp)}")

    if not args.apply:
        print("\nDRY RUN — nothing written. Re-run with --apply to write a new xlsx.")
        return
    out = os.path.join(ASSETS, f"comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    print(f"\nWROTE: {os.path.basename(out)}  ({len(changes):,} volumes set)")
    print("Next: python3 brb.py --commit \"bulk-apply GCD volumes\" --yes")
    print("Then: zsh brb_weekly.sh   # re-pull credits/eBay/date with corrected volumes")


if __name__ == "__main__":
    main()
