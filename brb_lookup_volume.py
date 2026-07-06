#!/usr/bin/env python3
"""
brb_lookup_volume.py — Look up comic volumes from Comic Vine, DC Fandom, and Marvel
Fandom, then cross-reference against the inventory file to flag year/volume mismatches.

READ ONLY — never writes to xlsx.

Sources used per publisher:
  DC Comics  → Comic Vine + dc.fandom.com/wiki/<Title>_Vol_<N>
  Marvel     → Comic Vine + marvel.fandom.com/wiki/<Title>_Vol_<N>
  Other      → Comic Vine only

Usage:
    export COMIC_VINE_API_KEY=3f6b5e45fb88852114819ab09ebc817f46e4ae72

    # Look up all volumes (CV + fandom):
    python3 brb_lookup_volume.py "The Flash"
    python3 brb_lookup_volume.py "Storm" --publisher Marvel

    # Cross-reference inventory rows against all sources:
    python3 brb_lookup_volume.py "The Ultimates" --check-inventory
    python3 brb_lookup_volume.py "The Flash" --publisher DC --check-inventory

    # List all titles with bad/range years in inventory:
    python3 brb_lookup_volume.py --check-all-years

    # Skip cache and hit APIs fresh:
    python3 brb_lookup_volume.py "Green Lantern" --no-cache
"""

import sys, os, json, re, time, argparse, glob as _glob
import requests
import pandas as pd

REPO_ROOT  = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(REPO_ROOT, "attached_assets")
CACHE_PATH = os.path.join(REPO_ROOT, "volume_lookup_cache.json")

API_KEY   = os.environ.get("COMIC_VINE_API_KEY", "")
CV_BASE   = "https://comicvine.gamespot.com/api"
CV_DELAY  = 20.0   # Comic Vine free tier: 200 req/hr

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

DC_PUBLISHERS     = {"dc comics", "dc", "vertigo", "wildstorm", "black label"}
MARVEL_PUBLISHERS = {"marvel", "marvel comics", "marvel worldwide"}


# ── Cache ─────────────────────────────────────────────────────────────────────

def _load_cache():
    if os.path.exists(CACHE_PATH):
        try:
            return json.load(open(CACHE_PATH))
        except Exception:
            return {}
    return {}


def _save_cache(cache):
    with open(CACHE_PATH, "w") as f:
        json.dump(cache, f, indent=2)


# ── xlsx helpers ──────────────────────────────────────────────────────────────

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


def is_blank(v):
    return pd.isna(v) or str(v).strip() in ("", "nan", "None")


# ── Fandom wiki scraper ───────────────────────────────────────────────────────

def _fandom_url(publisher, title, vol_num):
    """Build a fandom wiki URL for a given title + volume number."""
    slug = title.replace(" ", "_")
    vol_str = f"_Vol_{vol_num}" if vol_num else ""
    if publisher in DC_PUBLISHERS:
        return f"https://dc.fandom.com/wiki/{slug}{vol_str}"
    elif publisher in MARVEL_PUBLISHERS:
        return f"https://marvel.fandom.com/wiki/{slug}{vol_str}"
    return None


def _parse_fandom_infobox(html):
    """
    Extract year, issue count, and volume number from a fandom wiki infobox.
    Returns dict with keys: start_year, end_year, issue_count, volume_number, status.
    All values may be None if not found.
    """
    result = {
        "start_year":    None,
        "end_year":      None,
        "issue_count":   None,
        "volume_number": None,
        "status":        None,
    }

    # Strip tags for easier regex matching
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)

    # Issue count — "X issues" or "Issues: X"
    m = re.search(r"(\d+)\s+issues?", text, re.I)
    if m:
        result["issue_count"] = int(m.group(1))

    # Publication dates — look for 4-digit years in infobox area
    years = re.findall(r"\b(19\d{2}|20\d{2})\b", text)
    if years:
        result["start_year"] = int(years[0])
        if len(years) > 1:
            result["end_year"] = int(years[-1])

    # Status
    if re.search(r"\bfinished\b|\bcompleted\b|\bdiscontinued\b", text, re.I):
        result["status"] = "finished"
    elif re.search(r"\bongoing\b|\bcontinuing\b", text, re.I):
        result["status"] = "ongoing"

    # Volume number from page title / h1
    m = re.search(r"Vol(?:ume)?\.?\s*(\d+)", text, re.I)
    if m:
        result["volume_number"] = int(m.group(1))

    return result


def fandom_lookup(publisher, title, vol_num, use_cache=True):
    """
    Fetch a fandom wiki page for title+volume and extract infobox data.
    Returns dict or None if not found / not applicable.
    """
    pub_lower = (publisher or "").lower().strip()
    if pub_lower not in DC_PUBLISHERS and pub_lower not in MARVEL_PUBLISHERS:
        return None

    url = _fandom_url(pub_lower, title, vol_num)
    if not url:
        return None

    cache = _load_cache()
    cache_key = f"fandom|||{url}"
    if use_cache and cache_key in cache:
        return cache[cache_key]

    try:
        resp = requests.get(url, headers=HEADERS, timeout=15, allow_redirects=True)
        if resp.status_code == 404:
            cache[cache_key] = None
            _save_cache(cache)
            return None
        resp.raise_for_status()
    except Exception as e:
        print(f"  Fandom fetch error ({url}): {e}")
        return None

    data = _parse_fandom_infobox(resp.text)
    data["url"] = url
    data["source"] = "dc_fandom" if pub_lower in DC_PUBLISHERS else "marvel_fandom"

    cache[cache_key] = data
    _save_cache(cache)
    return data


def fandom_search_all_volumes(publisher, title, max_vol=10, use_cache=True):
    """
    Try vol 1..max_vol on the fandom wiki and collect all that return data.
    Returns list of dicts with volume_number + infobox fields.
    """
    pub_lower = (publisher or "").lower().strip()
    if pub_lower not in DC_PUBLISHERS and pub_lower not in MARVEL_PUBLISHERS:
        return []

    results = []
    # Also try the unversioned page (some series only have one volume)
    for vol in [None] + list(range(1, max_vol + 1)):
        data = fandom_lookup(publisher, title, vol, use_cache=use_cache)
        if data and data.get("start_year"):
            if vol is not None:
                data["volume_number"] = data.get("volume_number") or vol
            # Deduplicate by start_year
            if not any(r.get("start_year") == data.get("start_year") for r in results):
                results.append(data)

    return results


# ── Comic Vine ────────────────────────────────────────────────────────────────

def cv_search_volumes(title, publisher=None, use_cache=True):
    """
    Search Comic Vine for all volumes matching a title.
    Returns (list of dicts, from_cache bool).
    """
    cache = _load_cache()
    cache_key = f"cv_search|||{title}|||{publisher or ''}"

    if use_cache and cache_key in cache:
        return cache[cache_key], True

    if not API_KEY:
        print("WARNING: COMIC_VINE_API_KEY not set — skipping CV lookup.")
        return [], False

    params = {
        "api_key":    API_KEY,
        "format":     "json",
        "resources":  "volume",
        "query":      title,
        "field_list": "id,name,start_year,count_of_issues,publisher,volume_number",
        "limit":      20,
    }

    try:
        resp = requests.get(f"{CV_BASE}/search/", params=params,
                            timeout=15, headers=HEADERS)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"  CV search error: {e}")
        return [], False

    # Sort CV results by start_year to assign sequential volume numbers
    raw = []
    for item in data.get("results", []):
        name = item.get("name", "")
        if title.lower() not in name.lower():
            continue
        pub = ""
        if item.get("publisher"):
            pub = item["publisher"].get("name", "")
        if publisher and publisher.lower() not in pub.lower():
            continue
        raw.append({
            "cv_id":         item.get("id"),
            "name":          name,
            "start_year":    item.get("start_year"),
            "issue_count":   item.get("count_of_issues"),
            "publisher":     pub,
            "volume_number": item.get("volume_number"),
            "source":        "comic_vine",
        })

    # If CV didn't return volume_number, infer it from chronological order
    raw.sort(key=lambda x: x.get("start_year") or "0")
    for i, r in enumerate(raw):
        if not r.get("volume_number"):
            r["volume_number"] = i + 1

    results = raw

    cache[cache_key] = results
    _save_cache(cache)
    return results, False


# ── Merge CV + fandom ─────────────────────────────────────────────────────────

def merge_sources(cv_volumes, fandom_volumes):
    """
    Merge CV and fandom results into a unified list, flagging agreements/conflicts.
    Keyed by start_year; fandom data enriches CV entries where years match.
    """
    merged = []

    # Index fandom by start_year
    fandom_by_year = {}
    for fv in fandom_volumes:
        yr = fv.get("start_year")
        if yr:
            fandom_by_year[int(yr)] = fv

    used_fandom = set()

    for cv in cv_volumes:
        entry = dict(cv)
        entry["fandom"] = None
        entry["year_agrees"] = None

        try:
            cv_year = int(cv.get("start_year") or 0)
        except (TypeError, ValueError):
            cv_year = 0

        # Find matching fandom entry within 2 years
        best_fv = None
        best_delta = 999
        for yr, fv in fandom_by_year.items():
            delta = abs(yr - cv_year)
            if delta <= 2 and delta < best_delta:
                best_delta = delta
                best_fv = fv

        if best_fv:
            fy = best_fv.get("start_year")
            entry["fandom"] = best_fv
            entry["year_agrees"] = (cv_year == fy)
            used_fandom.add(fy)

        merged.append(entry)

    # Fandom-only entries (no CV match)
    for yr, fv in fandom_by_year.items():
        if yr not in used_fandom:
            merged.append({
                "cv_id":         None,
                "name":          fv.get("url", "").split("/")[-1].replace("_", " "),
                "start_year":    str(yr),
                "issue_count":   fv.get("issue_count"),
                "publisher":     "",
                "volume_number": fv.get("volume_number"),
                "source":        "fandom_only",
                "fandom":        fv,
                "year_agrees":   None,
            })

    merged.sort(key=lambda x: x.get("start_year") or "0")
    return merged


# ── Display ───────────────────────────────────────────────────────────────────

def print_merged(title, merged):
    print(f"\nVolumes for '{title}':\n")
    if not merged:
        print("  No results from any source.")
        return

    print(f"  {'Start':>5}  {'Vol#':>4}  {'Issues':>6}  {'Publisher':<18}  {'CV':>8}  Fandom  Agreement")
    print(f"  {'─'*5}  {'─'*4}  {'─'*6}  {'─'*18}  {'─'*8}  {'─'*6}  {'─'*12}")

    for e in merged:
        cv_id   = str(e.get("cv_id") or "—")
        vol_num = str(e.get("volume_number") or "?")
        yr      = str(e.get("start_year") or "?")
        count   = str(e.get("issue_count") or "?")
        pub     = (e.get("publisher") or "")[:18]
        fandom  = e.get("fandom")

        if fandom:
            fandom_yr  = str(fandom.get("start_year") or "?")
            fandom_str = fandom_yr
            agree = "✓ agree" if e.get("year_agrees") else f"⚠ fandom={fandom_yr}"
        else:
            fandom_str = "—"
            agree = "no fandom" if e.get("source") != "fandom_only" else "fandom only"

        print(f"  {yr:>5}  {vol_num:>4}  {count:>6}  {pub:<18}  {cv_id:>8}  {fandom_str:>6}  {agree}")


# ── Inventory cross-reference ─────────────────────────────────────────────────

def check_title_against_all(title, df_rows, merged):
    """
    Cross-reference inventory rows against merged CV+fandom volume list.
    Returns list of mismatch dicts.
    """
    mismatches = []

    # Build lookup: start_year (int) → merged entry
    year_map = {}
    for e in merged:
        try:
            yr = int(e.get("start_year") or 0)
            if yr:
                year_map[yr] = e
        except (TypeError, ValueError):
            pass

    for _, row in df_rows.iterrows():
        inv_year = str(row.get("Year", "")).strip()
        inv_vol  = row.get("Volume", "")
        issue    = row.get("Issue #", "")
        box      = row.get("Box #", "")

        if is_blank(inv_year) or not inv_year.strip().isdigit():
            mismatches.append({
                "issue": issue, "box": box,
                "inv_year": inv_year, "inv_vol": inv_vol,
                "problem": "non-numeric year in inventory",
                "match": None,
            })
            continue

        year_int = int(inv_year)

        # Find closest merged entry
        best = None
        best_delta = 999
        for yr, entry in year_map.items():
            delta = abs(yr - year_int)
            if delta < best_delta:
                best_delta = delta
                best = entry

        if best is None:
            mismatches.append({
                "issue": issue, "box": box,
                "inv_year": inv_year, "inv_vol": inv_vol,
                "problem": "no volume data found in any source",
                "match": None,
            })
        elif best_delta > 3:
            sources = []
            if best.get("cv_id"):
                sources.append(f"CV:{best['start_year']}")
            if best.get("fandom"):
                sources.append(f"Fandom:{best['fandom'].get('start_year')}")
            mismatches.append({
                "issue": issue, "box": box,
                "inv_year": inv_year, "inv_vol": inv_vol,
                "problem": (f"year {inv_year} doesn't match any known volume "
                            f"(closest: {best.get('start_year')} [{', '.join(sources)}])"),
                "match": best,
            })

    return mismatches


def cmd_check_inventory(title, publisher, df, merged, fix=False, out_path=None):
    mask = df["Title"].str.strip().str.lower() == title.lower()
    rows = df[mask]

    if rows.empty:
        print(f"\nNo rows found in inventory for '{title}'.")
        return df

    print(f"\nInventory rows for '{title}': {len(rows)}")
    print(f"  {'Issue':>6}  {'Box':>5}  {'Inv Year':>8}  {'Vol':>4}  Status")
    print(f"  {'─'*6}  {'─'*5}  {'─'*8}  {'─'*4}  {'─'*44}")

    mismatches = check_title_against_all(title, rows, merged)
    mismatch_keys = {(str(m["issue"]), str(m["box"])) for m in mismatches}

    for _, row in rows.iterrows():
        issue = row.get("Issue #", "")
        box   = row.get("Box #", "")
        year  = str(row.get("Year", "")).strip()
        vol   = str(row.get("Volume", "")).strip()
        key   = (str(issue), str(box))
        flag  = "⚠  MISMATCH" if key in mismatch_keys else "✓"
        print(f"  #{str(issue):>5}  {str(box):>5}  {year:>8}  {vol:>4}  {flag}")

    if not mismatches:
        print("\n  All rows match known volumes within 3-year tolerance. ✓")
        return df

    print(f"\nMismatches ({len(mismatches)}):")
    fixable = []
    for m in mismatches:
        print(f"  Issue #{m['issue']} Box {m['box']}: {m['problem']}")
        if m["match"]:
            e = m["match"]
            fdom = e.get("fandom")
            correct_year = e.get("start_year")
            correct_vol  = e.get("volume_number")
            print(f"    → CV:     {e.get('name','')} start={correct_year} "
                  f"issues={e.get('issue_count')} vol={correct_vol}")
            if fdom:
                print(f"    → Fandom: start={fdom.get('start_year')} "
                      f"issues={fdom.get('issue_count')} {fdom.get('url','')}")
            # Only fixable if CV and fandom agree (or fandom absent) and year is clear
            fdom_year = fdom.get("start_year") if fdom else None
            sources_agree = (fdom_year is None) or (str(fdom_year) == str(correct_year))
            if correct_year and sources_agree:
                fixable.append({
                    "issue": m["issue"], "box": m["box"],
                    "old_year": m["inv_year"], "new_year": str(correct_year),
                    "old_vol":  m["inv_vol"],  "new_vol":  correct_vol,
                })

    if not fix:
        if fixable:
            print(f"\n{len(fixable)} rows have a clear correction available.")
            print(f"  Re-run with --fix to apply. Always review first.")
        return df

    # ── FIX MODE ─────────────────────────────────────────────────────────────
    if not fixable:
        print("\n  No rows with unambiguous corrections — nothing written.")
        return df

    print(f"\n── FIX MODE ── {len(fixable)} rows to correct:")
    for fx in fixable:
        print(f"  Issue #{fx['issue']} Box {fx['box']}:  "
              f"Year {fx['old_year']} → {fx['new_year']}  |  "
              f"Vol {fx['old_vol']} → {fx['new_vol']}")

    answer = input(f"\nApply {len(fixable)} corrections? [y/N] ").strip().lower()
    if answer != "y":
        print("  Aborted — no changes written.")
        return df

    # Apply corrections to df
    fixed = 0
    for fx in fixable:
        row_mask = (
            (df["Title"].str.strip().str.lower() == title.lower()) &
            (df["Issue #"].astype(str) == str(fx["issue"])) &
            (df["Box #"].astype(str) == str(fx["box"]))
        )
        if row_mask.any():
            df.loc[row_mask, "Year"] = fx["new_year"]
            if fx["new_vol"] and "Volume" in df.columns:
                df.loc[row_mask, "Volume"] = fx["new_vol"]
            fixed += int(row_mask.sum())

    if not out_path:
        print("  ERROR: no output path — pass --file to write back.")
        return df

    # Write back — preserve all other sheets
    xl = pd.ExcelFile(out_path)
    sheet_name = None
    for name in xl.sheet_names:
        tmp = xl.parse(name)
        if "Title" in tmp.columns and "Issue #" in tmp.columns:
            sheet_name = name
            break
    if not sheet_name:
        print("  ERROR: could not identify inventory sheet.")
        return df

    with pd.ExcelWriter(out_path, engine="openpyxl", mode="a",
                        if_sheet_exists="replace") as writer:
        df.to_excel(writer, sheet_name=sheet_name, index=False)

    print(f"\n  ✓ Fixed {fixed} rows — written back to {os.path.basename(out_path)}")
    print(f"  Run brb_validate.py to confirm no regressions.")
    return df


def cmd_check_all_years(df):
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
        pub   = rows["Publisher"].dropna().iloc[0] if "Publisher" in rows.columns and not rows["Publisher"].dropna().empty else "?"
        print(f"  {i:>3}. {t:<40}  [{pub:<10}]  years: {', '.join(str(y) for y in years[:5])}")

    print(f"\nTo cross-reference any title against CV + fandom:")
    print(f"  python3 brb_lookup_volume.py \"TITLE\" --publisher DC --check-inventory")
    print(f"  python3 brb_lookup_volume.py \"TITLE\" --publisher Marvel --check-inventory")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Volume lookup: Comic Vine + DC/Marvel Fandom wikis"
    )
    parser.add_argument("title",              nargs="?",             help="Comic title to look up")
    parser.add_argument("--publisher",        default=None,          help="Publisher filter (DC, Marvel, etc.)")
    parser.add_argument("--volume",           type=int, default=None, help="Show details for a specific volume number")
    parser.add_argument("--check-inventory",  action="store_true",   help="Cross-reference inventory rows")
    parser.add_argument("--check-all-years",  action="store_true",   help="List all titles with bad years in inventory")
    parser.add_argument("--fix",              action="store_true",   help="Apply year/volume corrections (requires --check-inventory; prompts before writing)")
    parser.add_argument("--no-cache",         action="store_true",   help="Bypass cache, hit APIs fresh")
    parser.add_argument("--file",             default=None,          help="xlsx path override")
    args = parser.parse_args()

    use_cache = not args.no_cache

    # ── check-all-years mode (no API calls) ───────────────────────────────────
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

    title     = args.title
    publisher = (args.publisher or "").strip()
    pub_lower = publisher.lower()

    # ── Comic Vine lookup ─────────────────────────────────────────────────────
    print(f"Searching Comic Vine for '{title}'...")
    cv_volumes, cv_cached = cv_search_volumes(title, publisher or None, use_cache=use_cache)
    if not cv_cached and API_KEY:
        print(f"  (waiting {CV_DELAY:.0f}s for CV rate limit)")
        time.sleep(CV_DELAY)

    # ── Fandom lookup ─────────────────────────────────────────────────────────
    fandom_volumes = []
    if pub_lower in DC_PUBLISHERS or pub_lower in MARVEL_PUBLISHERS:
        wiki = "dc.fandom.com" if pub_lower in DC_PUBLISHERS else "marvel.fandom.com"
        print(f"Searching {wiki} for '{title}'...")
        fandom_volumes = fandom_search_all_volumes(publisher, title,
                                                   max_vol=8, use_cache=use_cache)
        if fandom_volumes:
            print(f"  Found {len(fandom_volumes)} fandom volume(s)")
        else:
            print(f"  No fandom results found")
    else:
        if publisher:
            print(f"  Fandom: publisher '{publisher}' not DC or Marvel — skipping wiki lookup")
        else:
            print(f"  Fandom: no --publisher given — skipping wiki lookup (use --publisher DC or --publisher Marvel)")

    # ── Merge and display ─────────────────────────────────────────────────────
    merged = merge_sources(cv_volumes, fandom_volumes)
    print_merged(title, merged)

    if args.volume:
        matches = [e for e in merged
                   if str(e.get("volume_number")) == str(args.volume)]
        if matches:
            print(f"\nVolume {args.volume} detail:")
            for e in matches:
                fdom = e.get("fandom")
                print(f"  CV:     start={e.get('start_year')} issues={e.get('issue_count')} "
                      f"id={e.get('cv_id')}")
                if fdom:
                    print(f"  Fandom: start={fdom.get('start_year')} issues={fdom.get('issue_count')} "
                          f"status={fdom.get('status')} → {fdom.get('url')}")
        else:
            print(f"\nNo volume {args.volume} found in merged results for '{title}'.")

    if args.check_inventory:
        path = args.file or _resolve_xlsx()
        if not path:
            print(f"ERROR: No xlsx found in {ASSETS_DIR}")
            sys.exit(1)
        if args.fix and not path:
            print("ERROR: --fix requires --file to know where to write.")
            sys.exit(1)
        df, sheet = _load_df(path)
        print(f"\nLoaded '{sheet}' — {len(df):,} rows")
        cmd_check_inventory(title, publisher, df, merged,
                            fix=args.fix, out_path=path if args.fix else None)


if __name__ == "__main__":
    main()
