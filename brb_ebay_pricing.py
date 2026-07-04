#!/usr/bin/env python3
"""
brb_ebay_pricing.py — Pull eBay sold pricing for comics with NM Value > $10.
Run from: ~/marshallcomics/

Uses eBay Browse API (Production) to search completed/sold listings.
Rate limit: 5,000 calls/day on free tier — script stays well within this.

Usage:
    export EBAY_APP_ID=RobertMa-marshall-PRD-d0ac9b6db-45992c91
    python3 brb_ebay_pricing.py
    python3 brb_ebay_pricing.py --min-value 20     # only books with NM > $20
    python3 brb_ebay_pricing.py --limit 50         # cap at 50 books (test run)
    python3 brb_ebay_pricing.py --dry-run          # show queue, fetch nothing

Output: ebay_pricing_results.json + summary printed to terminal
"""

import sys, os, json, re, time, glob as _glob, argparse
from datetime import datetime
import pandas as pd
import requests

REPO_ROOT    = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR   = os.path.join(REPO_ROOT, "attached_assets")
RESULTS_PATH = os.path.join(REPO_ROOT, "ebay_pricing_results.json")

EBAY_APP_ID  = os.environ.get("EBAY_APP_ID", "")
EBAY_API_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search"
DELAY        = 1.2   # seconds between requests — well within rate limits


def _resolve_xlsx():
    matches = _glob.glob(os.path.join(ASSETS_DIR, "comics_inventory_*VALIDATED*.xlsx"))
    if not matches:
        matches = _glob.glob(os.path.join(ASSETS_DIR, "comics_inventory_*.xlsx"))
    return max(matches, key=os.path.getmtime) if matches else ""


def _load(path):
    xl = pd.ExcelFile(path)
    for name in xl.sheet_names:
        df = xl.parse(name)
        if "Title" in df.columns and "Issue #" in df.columns:
            return df, name
    return xl.parse(0), xl.sheet_names[0]


def _get_oauth_token():
    """Get eBay OAuth application token (no user login needed for Browse API)."""
    import base64
    # For Browse API search we use Client Credentials grant
    # App ID is sufficient for read-only sold search
    # eBay Browse API uses OAuth2 client_credentials
    cert_id = os.environ.get("EBAY_CERT_ID", "")
    if not cert_id:
        # Fall back to using App ID directly as bearer (works for some endpoints)
        return None

    creds = base64.b64encode(f"{EBAY_APP_ID}:{cert_id}".encode()).decode()
    resp = requests.post(
        "https://api.ebay.com/identity/v1/oauth2/token",
        headers={
            "Authorization": f"Basic {creds}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data="grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
        timeout=15,
    )
    if resp.status_code == 200:
        return resp.json().get("access_token")
    return None


def search_sold(title, issue, year, publisher, token):
    """
    Search eBay sold listings for a comic.
    Returns list of sold prices (float) or empty list.
    """
    # Build search query
    issue_str = str(int(float(str(issue)))) if issue else ""
    query = f"{title} #{issue_str} comic"
    if year and str(year).strip() not in ("", "nan", "None"):
        query += f" {str(year)[:4]}"

    headers = {"Authorization": f"Bearer {token}", "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"}

    params = {
        "q":            query,
        "filter":       "buyingOptions:{FIXED_PRICE},conditions:{USED|LIKE_NEW|VERY_GOOD|GOOD},"
                        "soldItems:true",
        "sort":         "endingSoonest",
        "limit":        10,
        "fieldgroups":  "MATCHING_ITEMS",
    }

    try:
        resp = requests.get(EBAY_API_URL, headers=headers, params=params, timeout=15)
        if resp.status_code == 401:
            return [], "auth_error"
        if resp.status_code != 200:
            return [], f"http_{resp.status_code}"
        data = resp.json()
    except Exception as e:
        return [], str(e)

    items = data.get("itemSummaries", [])
    prices = []
    for item in items:
        price_obj = item.get("price", {})
        try:
            price = float(price_obj.get("value", 0))
            if price > 0:
                prices.append(price)
        except (ValueError, TypeError):
            continue

    return prices[:5], None   # return at most 5 most recent


def is_blank(v):
    return pd.isna(v) or str(v).strip() in ("", "nan", "None")


def nm_value(row):
    """Extract numeric NM value from inventory columns."""
    for col in ["Est. Raw Value (NM) $", "NM Value", "Value NM", "NM_Value"]:
        if col in row.index and not is_blank(row[col]):
            try:
                v = str(row[col]).replace("$", "").replace(",", "").strip()
                return float(v)
            except ValueError:
                pass
    return 0.0


def main():
    parser = argparse.ArgumentParser(description="eBay sold pricing for high-value comics")
    parser.add_argument("--min-value", type=float, default=10.0, help="Minimum NM Value to include (default: 10)")
    parser.add_argument("--limit",     type=int,   default=0,    help="Max comics to price (0=all)")
    parser.add_argument("--dry-run",   action="store_true",      help="Show queue only, fetch nothing")
    parser.add_argument("--file",      default=None,             help="xlsx file override")
    args = parser.parse_args()

    if not EBAY_APP_ID:
        print("ERROR: Set EBAY_APP_ID environment variable.")
        print("  export EBAY_APP_ID=RobertMa-marshall-PRD-d0ac9b6db-45992c91")
        sys.exit(1)

    # Load inventory
    path = args.file or _resolve_xlsx()
    if not path or not os.path.exists(path):
        print(f"ERROR: No xlsx found in {ASSETS_DIR}")
        sys.exit(1)

    df, sheet = _load(path)
    print(f"Loaded '{sheet}' — {len(df):,} rows from {os.path.basename(path)}")

    # Get OAuth token
    if not args.dry_run:
        print("Getting eBay OAuth token...")
        token = _get_oauth_token()
        if not token:
            # Try using App ID directly (some Browse API endpoints accept it)
            token = EBAY_APP_ID
            print("  (using App ID as token — set EBAY_CERT_ID for full OAuth)")
    else:
        token = None

    # Build queue: rows with NM Value > min_value, deduplicated by Title+Issue
    queue = []
    seen  = set()
    for _, row in df.iterrows():
        val = nm_value(row)
        if val < args.min_value:
            continue
        title  = str(row.get("Title", "")).strip()
        issue  = row.get("Issue #", "")
        key    = f"{title}|||{issue}"
        if key in seen or not title:
            continue
        seen.add(key)
        queue.append({
            "title":     title,
            "issue":     issue,
            "year":      row.get("Year", ""),
            "publisher": row.get("Publisher", ""),
            "nm_value":  val,
            "box":       row.get("Box #", ""),
            "writer":    row.get("Writer(s)", ""),
        })

    queue.sort(key=lambda x: x["nm_value"], reverse=True)
    if args.limit:
        queue = queue[:args.limit]

    print(f"Queue: {len(queue)} unique titles with NM Value ≥ ${args.min_value:.0f}")

    if args.dry_run:
        print("\nTop 20 by NM Value:")
        for i, c in enumerate(queue[:20]):
            print(f"  {i+1:>3}. {c['title']} #{c['issue']}  NM=${c['nm_value']:.0f}  Box {c['box']}")
        sys.exit(0)

    # Load existing results
    results = json.load(open(RESULTS_PATH)) if os.path.exists(RESULTS_PATH) else {}

    # Fetch
    fetched = skipped = errors = 0
    for i, comic in enumerate(queue):
        key = f"{comic['title']}|||{comic['issue']}"

        # Skip if already priced recently (within 7 days)
        existing = results.get(key, {})
        if existing.get("fetched_at"):
            age_days = (datetime.now() - datetime.fromisoformat(existing["fetched_at"])).days
            if age_days < 7:
                skipped += 1
                continue

        prices, err = search_sold(
            comic["title"], comic["issue"], comic["year"], comic["publisher"], token
        )

        if err == "auth_error":
            print(f"\nAuth error — check EBAY_APP_ID and EBAY_CERT_ID")
            break

        if prices:
            avg   = round(sum(prices) / len(prices), 2)
            low   = round(min(prices), 2)
            high  = round(max(prices), 2)
            results[key] = {
                "title":      comic["title"],
                "issue":      str(comic["issue"]),
                "nm_value":   comic["nm_value"],
                "box":        str(comic["box"]),
                "writer":     str(comic["writer"]),
                "prices":     prices,
                "avg":        avg,
                "low":        low,
                "high":       high,
                "count":      len(prices),
                "fetched_at": datetime.now().isoformat(),
                "error":      None,
            }
            fetched += 1
            print(f"  [{i+1}/{len(queue)}] {comic['title']} #{comic['issue']}  "
                  f"avg=${avg}  range=${low}-${high}  ({len(prices)} sales)")
        else:
            results[key] = {
                **comic,
                "prices": [], "avg": None, "low": None, "high": None,
                "count": 0, "fetched_at": datetime.now().isoformat(),
                "error": err or "no_results",
            }
            errors += 1
            print(f"  [{i+1}/{len(queue)}] {comic['title']} #{comic['issue']}  NO RESULTS")

        # Save after every 10 fetches
        if (fetched + errors) % 10 == 0:
            with open(RESULTS_PATH, "w") as f:
                json.dump(results, f, indent=2)

        time.sleep(DELAY)

    # Final save
    with open(RESULTS_PATH, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nDone. Fetched: {fetched}  Skipped (recent): {skipped}  No results: {errors}")
    print(f"Results saved to: {RESULTS_PATH}")

    # Print top 20 by avg sold price
    priced = [v for v in results.values() if v.get("avg")]
    priced.sort(key=lambda x: x["avg"], reverse=True)
    if priced:
        print(f"\nTop 20 by average sold price:")
        print(f"  {'Title':<40} {'Issue':>6}  {'NM':>5}  {'Avg Sold':>9}  {'Range':>14}  Box")
        print(f"  {'─'*40} {'─'*6}  {'─'*5}  {'─'*9}  {'─'*14}  {'─'*5}")
        for c in priced[:20]:
            rng = f"${c['low']:.0f}–${c['high']:.0f}"
            print(f"  {c['title']:<40} #{str(c['issue']):>5}  "
                  f"${c['nm_value']:>4.0f}  ${c['avg']:>8.2f}  {rng:>14}  {c['box']}")


if __name__ == "__main__":
    main()
