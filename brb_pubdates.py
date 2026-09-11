#!/usr/bin/env python3
"""brb_pubdates.py — build a published-week timeline of the modern collection.

For every Marvel / DC / Image book in the canonical xlsx, look up the issue's
real ON-SALE date (gcd_issue.key_date) in the local GCD subset, keep only those
whose on-sale date falls in the last N years (default 3), and emit a derived
JSON the site reads at runtime:

    artifacts/comics-inventory/public/pub_dates.json
    { "Title|||issue|||volume": {"date":"YYYY-MM-DD","year":Y,"month":M,"week":"YYYY-Www"} }

This is the honest, non-fabricated basis for "which books came out each week."
The site labels it as PUBLISHED week — the user's explicit assumption is that a
modern book was bought the week it dropped; that assumption is only applied to
books whose on-sale date is inside the window, which is exactly why old
back-issues (a 1975 book bought in 2026) fall out on their own.

Runs on the Mac (that is where gcd_local.sqlite lives). Reads the xlsx, never
writes it. After running:
    python3 brb.py --commit "publication timeline data" --yes
regenerates data and pushes, OR just commit pub_dates.json directly.
"""
import argparse, datetime, glob, json, os, sqlite3, sys
from collections import Counter

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
from brb_gcd_lookup import find_series, norm_issue  # proven series matcher

DB = os.path.join(ROOT, "gcd_local.sqlite")
OUT = os.path.join(ROOT, "artifacts/comics-inventory/public/pub_dates.json")

# Publisher field -> which of the three lines it belongs to. Substring, lower.
PUB_MATCH = ("marvel", "dc", "image", "skybound")  # Skybound is an Image imprint


def newest_xlsx():
    cands = [f for f in glob.glob(os.path.join(ROOT, "attached_assets/comics_inventory_*.xlsx"))
             if " copy" not in f and not os.path.basename(f).startswith("~$")]
    if not cands:
        sys.exit("no attached_assets/comics_inventory_*.xlsx found")
    return max(cands, key=os.path.getmtime)


def load_rows(path):
    import openpyxl
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = next(w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory"))
    rows = ws.iter_rows(values_only=True)
    H = [str(h).strip() if h is not None else "" for h in next(rows)]
    idx = {name: H.index(name) for name in
           ("Title", "Issue #", "Publisher", "Year", "Volume") if name in H}
    if "Title" not in idx:
        sys.exit("could not find a Title column on the Clean Inventory sheet")
    for r in rows:
        def g(n):
            v = r[idx[n]] if n in idx and idx[n] < len(r) else None
            return str(v).strip() if v is not None else ""
        if g("Title"):
            yield g("Title"), g("Issue #"), g("Publisher"), g("Year"), g("Volume")


def gcd_key_date(conn, title, issue, year, publisher):
    """Resolve series (scored by year+publisher) then find the issue's key_date."""
    series = find_series(conn, title, year, publisher)
    if not series:
        return None
    inum = norm_issue(issue)
    for number, key_date in conn.execute(
            "SELECT number, key_date FROM gcd_issue WHERE series_id = ?", (series["id"],)):
        if norm_issue(number) == inum:
            return key_date or None
    return None


def parse_date(s):
    """GCD key_date is normally YYYY-MM-DD (may have 00 for unknown day/month)."""
    m = str(s or "")
    for fmt in ("%Y-%m-%d",):
        try:
            return datetime.datetime.strptime(m.replace("-00", "-01"), fmt).date()
        except ValueError:
            pass
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", type=int, default=3, help="window in years (default 3)")
    ap.add_argument("--all-publishers", action="store_true",
                    help="don't restrict to Marvel/DC/Image")
    args = ap.parse_args()

    if not os.path.exists(DB):
        sys.exit(f"GCD database not found: {DB}\nBuild it first: python3 gcd_build_local_db.py")

    src = newest_xlsx()
    cutoff = datetime.date.today() - datetime.timedelta(days=365 * args.years + 1)
    conn = sqlite3.connect(DB)

    out, stats = {}, Counter()
    for title, issue, publisher, year, volume in load_rows(src):
        stats["rows"] += 1
        if not args.all_publishers:
            if not any(p in publisher.lower() for p in PUB_MATCH):
                stats["skip_publisher"] += 1
                continue
        stats["in_scope"] += 1
        kd = gcd_key_date(conn, title, issue, year, publisher)
        if not kd:
            stats["no_gcd_date"] += 1
            continue
        d = parse_date(kd)
        if not d:
            stats["unparseable_date"] += 1
            continue
        if d < cutoff:
            stats["older_than_window"] += 1
            continue
        iso = d.isocalendar()
        key = f"{title}|||{norm_issue(issue)}|||{volume or '1'}"
        out[key] = {"date": d.isoformat(), "year": d.year, "month": d.month,
                    "week": f"{iso[0]}-W{iso[1]:02d}"}
        stats["placed"] += 1

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w"), indent=0, sort_keys=True)

    print(f"SOURCE:  {os.path.basename(src)}")
    print(f"WINDOW:  on-sale on/after {cutoff.isoformat()} (last {args.years} years)")
    print(f"OUTPUT:  {os.path.relpath(OUT, ROOT)}  ({stats['placed']} books placed)")
    print("\nCOVERAGE")
    for k in ("rows", "skip_publisher", "in_scope", "no_gcd_date",
              "unparseable_date", "older_than_window", "placed"):
        print(f"  {k:20s} {stats[k]}")
    if stats["in_scope"]:
        pct = 100 * stats["placed"] / stats["in_scope"]
        print(f"\n  placed / in-scope = {pct:.0f}%")
    # quick sanity: books per year in the window
    yr = Counter(v["year"] for v in out.values())
    print("\nPLACED BY YEAR:", dict(sorted(yr.items())))


if __name__ == "__main__":
    main()
