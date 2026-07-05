#!/usr/bin/env python3
"""
brb_lookup_volume.py — Look up Comic Vine volumes for a title and cross-reference
against the inventory file to flag year/volume mismatches.

READ ONLY — never writes to xlsx.

Usage:
    export COMIC_VINE_API_KEY=3f6b5e45fb88852114819ab09ebc817f46e4ae72

    # Look up all volumes for a title:
    python3 brb_lookup_volume.py "The Ultimates"
    python3 brb_lookup_volume.py "Captain Marvel" --publisher Marvel

    # Cross-reference inventory rows for a title against CV volumes:
    python3 brb_lookup_volume.py "The Ultimates" --check-inventory

    # Check all titles in inventory that have non-numeric or suspicious years:
    python3 brb_lookup_volume.py --check-all-years

    # Check a specific volume number assignment:
    python3 brb_lookup_volume.py "The Ultimates" --volume 3
"""

import sys, os, json, time, argparse, glob as _glob
import requests
import pandas as pd

REPO_ROOT  = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(REPO_ROOT, "attached_assets")
CACHE_PATH = os.path.join(REPO_ROOT, "volume_lookup_cache.json")

API_KEY    = os.environ.get("COMIC_VINE_API_KEY", "")
CV_BASE    = "https://comicvine.gamespot.com/api"
DELAY      = 20.0   # Comic Vine free tier: 200 req/hr


def _resolve_xlsx():
    matches = _glob.glob(os.path.join(ASSETS_DIR, "comics_inventory_*VALIDATED*.xlsx"))
    if not matches:
        matches = _glob.glob(os.path.join(ASSETS_DIR, "comics_inventory_*.xlsx"))
    return max(matches, key=os.path.getmtime) if matches else ""


def _load_df(path):
    xl = pd.ExcelFile(path)
    for name in xl.sheet_names:
        df = xl.parse(name)
        if "Title" in df.columns and "Issue #" in df.columns:
            return df, name
    return xl.parse(0), xl.sheet_names[0]


def _load_cache():
    if os.path.exists(CACHE_PATH):
        return json.load(open(CACHE_PATH))
    return {}


def _save_cache(cache):
    with open(CACHE_PATH, "w") as f:
        json.dump(cache, f, indent=2)


def cv_search_volumes(title, publisher=None, use_cache=True):
    """
    Search Comic Vine for all volumes matching a title.
    Returns list of dicts: {id, name, start_year, issue_count, publisher, cv_volume_num}.
    """
    cache = _load_cache()
    cache_key = f"search|||{title}|||{publisher or ''}"

    if use_cache and cache_key in cache:
        return cache[cache_key], True  # (results, from_cache)

    if not API_KEY:
        print("ERROR: Set COMIC_VINE_API_KEY environment variable.")
        sys.exit(1)

    params = {
        "api_key":    API_KEY,
        "format":     "json",
        "resources":  "volume",
        "query":      title,
        "field_list": "id,name,start_year,count_of_issues,publisher,volume_number",
        "limit":      20,
    }

    try:
        resp = requests.get(f"{CV_BASE}/search/", params=params, timeout=15,
                            headers={"User-Agent": "BRB-Comics/1.0"})
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"  CV search error: {e}")
        return [], False

    results = []
    for item in data.get("results", []):
        name = item.get("name", "")
        if title.lower() not in name.lower():
            continue
        pub = ""
        if item.get("publisher"):
            pub = item["publisher"].get("name", "")
        if publisher and publisher.lower() not in pub.lower():
            continue
        results.append({
            "cv_id":        item.get("id"),
            "name":         name,
            "start_year":   item.get("start_year"),
            "issue_count":  item.get("count_of_issues"),
            "publisher":    pub,
            "volume_number": item.get("volume_number"),
        })

    cache[cache_key] = results
    _save_cache(cache)
    return results, False


def is_blank(v):
    return pd.isna(v) or str(v).strip() in ("", "nan", "None")


def check_title_against_cv(title, df_rows, volumes):
    """
    Cross-reference inventory rows for a title against CV volumes.
    Returns list of mismatch dicts.
    """
    mismatches = []

    for _, row in df_rows.iterrows():
        inv_year = str(row.get("Year", "")).strip()
        inv_vol  = row.get("Volume", "")
        issue    = row.get("Issue #", "")
        box      = row.get("Box #", "")

        if is_blank(inv_year) or not inv_year.isdigit():
            mismatches.append({
                "issue": issue, "box": box,
                "inv_year": inv_year, "inv_vol": inv_vol,
                "problem": "non-numeric year in inventory",
                "cv_match": None,
            })
            continue

        year_int = int(inv_year)

        # Try to match CV volume by year proximity
        best = None
        best_delta = 999
        for v in volumes:
            try:
                cv_year = int(v["start_year"])
            except (TypeError, ValueError):
                continue
            delta = abs(cv_year - year_int)
            if delta < best_delta:
                best_delta = delta
                best = v

        if best is None:
            mismatches.append({
                "issue": issue, "box": box,
                "inv_year": inv_year, "inv_vol": inv_vol,
                "problem": "no CV volumes found to compare",
                "cv_match": None,
            })
        elif best_delta > 3:
            mismatches.append({
                "issue": issue, "box": box,
                "inv_year": inv_year, "inv_vol": inv_vol,
                "problem": f"year {inv_year} doesn't match any CV volume (closest: {best['name']} {best['start_year']})",
                "cv_match": best,
            })

    return mismatches


def print_volumes(title, volumes, from_cache):
    src = "(cached)" if from_cache else "(live)"
    print(f"\nComic Vine volumes for '{title}' {src}:\n")
    if not volumes:
        print("  No matching volumes found.")
        return

    print(f"  {'CV ID':>8}  {'Name':<32}  {'Start':>5}  {'Issues':>6}  {'Publisher':<20}  Vol#")
    print(f"  {'─'*8}  {'─'*32}  {'─'*5}  {'─'*6}  {'─'*20}  {'─'*4}")
    for v in sorted(volumes, key=lambda x: x.get("start_year") or "0"):
        vol_num = v.get("volume_number") or "?"
        print(f"  {str(v['cv_id']):>8}  {v['name']:<32}  "
              f"{str(v['start_year'] or '?'):>5}  "
              f"{str(v['issue_count'] or '?'):>6}  "
              f"{v['publisher']:<20}  {vol_num}")


def cmd_check_inventory(title, df, volumes, publisher=None):
    """Cross-reference all inventory rows for this title against CV."""
    mask = df["Title"].str.strip().str.lower() == title.lower()
    rows = df[mask]

    if rows.empty:
        print(f"\nNo rows found in inventory for '{title}'.")
        return

    print(f"\nInventory rows for '{title}': {len(rows)}")
    print(f"  {'Issue':>6}  {'Box':>5}  {'Inv Year':>8}  {'Vol':>4}  Status")
    print(f"  {'─'*6}  {'─'*5}  {'─'*8}  {'─'*4}  {'─'*40}")

    mismatches = check_title_against_cv(title, rows, volumes)
    mismatch_keys = {(str(m["issue"]), str(m["box"])) for m in mismatches}

    for _, row in rows.iterrows():
        issue = row.get("Issue #", "")
        box   = row.get("Box #", "")
        year  = str(row.get("Year", "")).strip()
        vol   = str(row.get("Volume", "")).strip()
        key   = (str(issue), str(box))
        flag  = "⚠  MISMATCH" if key in mismatch_keys else "✓"
        print(f"  #{str(issue):>5}  {str(box):>5}  {year:>8}  {vol:>4}  {flag}")

    if mismatches:
        print(f"\nMismatches ({len(mismatches)}):")
        for m in mismatches:
            print(f"  Issue #{m['issue']} Box {m['box']}: {m['problem']}")
            if m["cv_match"]:
                v = m["cv_match"]
                print(f"    → Closest CV volume: '{v['name']}' {v['start_year']} "
                      f"({v['issue_count']} issues, {v['publisher']})")
    else:
        print("\n  All rows match CV volumes within 3-year tolerance. ✓")


def cmd_check_all_years(df):
    """Find all titles with non-numeric or suspicious years and report."""
    non_numeric = df[
        pd.to_numeric(df["Year"], errors="coerce").isna() &
        ~df["Year"].apply(is_blank)
    ]["Title"].unique()

    out_of_range = df[
        pd.to_numeric(df["Year"], errors="coerce").notna() &
        ~pd.to_numeric(df["Year"], errors="coerce").between(1930, 2030)
    ]["Title"].unique()

    all_flagged = sorted(set(list(non_numeric) + list(out_of_range)))

    if not all_flagged:
        print("No titles with year problems found. ✓")
        return

    print(f"\n{len(all_flagged)} titles with year issues:\n")
    for i, t in enumerate(all_flagged, 1):
        rows = df[df["Title"] == t]
        years = rows["Year"].dropna().unique()
        print(f"  {i:>3}. {t:<40}  years in file: {', '.join(str(y) for y in years[:5])}")

    print(f"\nTo look up any of these against Comic Vine:")
    print(f"  python3 brb_lookup_volume.py \"TITLE\" --check-inventory")


def main():
    parser = argparse.ArgumentParser(description="Comic Vine volume lookup and year/volume cross-reference")
    parser.add_argument("title",           nargs="?",            help="Comic title to look up")
    parser.add_argument("--publisher",     default=None,         help="Filter by publisher")
    parser.add_argument("--volume",        type=int, default=None, help="Check a specific volume number")
    parser.add_argument("--check-inventory", action="store_true", help="Cross-reference inventory rows against CV")
    parser.add_argument("--check-all-years", action="store_true", help="List all titles with bad years in inventory")
    parser.add_argument("--no-cache",      action="store_true",  help="Bypass cache, always hit CV API")
    parser.add_argument("--file",          default=None,         help="xlsx override")
    args = parser.parse_args()

    if args.check_all_years:
        path = args.file or _resolve_xlsx()
        if not path:
            print(f"ERROR: No xlsx found in {ASSETS_DIR}")
            sys.exit(1)
        df, sheet = _load_df(path)
        print(f"Loaded '{sheet}' — {len(df):,} rows")
        cmd_check_all_years(df)
        return

    if not args.title:
        parser.print_help()
        sys.exit(0)

    # Fetch volumes from CV
    volumes, from_cache = cv_search_volumes(args.title, args.publisher, use_cache=not args.no_cache)
    if not from_cache:
        time.sleep(DELAY)

    print_volumes(args.title, volumes, from_cache)

    if args.volume:
        matches = [v for v in volumes if str(v.get("volume_number")) == str(args.volume)]
        if matches:
            print(f"\nVolume {args.volume} match:")
            for v in matches:
                print(f"  {v['name']} — started {v['start_year']}, {v['issue_count']} issues ({v['publisher']})")
        else:
            print(f"\nNo CV volume with volume_number={args.volume} found for '{args.title}'.")

    if args.check_inventory:
        path = args.file or _resolve_xlsx()
        if not path:
            print(f"ERROR: No xlsx found in {ASSETS_DIR}")
            sys.exit(1)
        df, sheet = _load_df(path)
        print(f"\nLoaded '{sheet}' — {len(df):,} rows")
        cmd_check_inventory(args.title, df, volumes, args.publisher)


if __name__ == "__main__":
    main()
