#!/usr/bin/env python3
"""
brb_ebay_pricing.py — Pull eBay sold pricing for comics with NM Value > $10.
Run from: ~/marshallcomics/

Uses eBay Browse API (Production) to search completed/sold listings.
Rate limit: 5,000 calls/day on free tier — script stays well within this.

Usage:
    python3 brb_ebay_pricing.py                        # standard run (NM > $10)
    python3 brb_ebay_pricing.py --min-value 20         # only NM > $20
    python3 brb_ebay_pricing.py --limit 50             # cap at 50 (test run)
    python3 brb_ebay_pricing.py --dry-run              # show queue, fetch nothing
    python3 brb_ebay_pricing.py --modern-pass          # Task 3: Modern era priority queue
    python3 brb_ebay_pricing.py --reprocess            # Task 2: re-pull & trim existing results
    python3 brb_ebay_pricing.py --modern-pass --limit 200  # first batch of 200

Output: ebay_pricing_results.json + summary printed to terminal

Era normalization: "Modern Age" and "Modern" are treated identically.
Outlier trimming: drops any price >3x the median; flags if >30% trimmed
  or if fewer than 3 comps remain (LOW confidence).
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
    # Newest comics_inventory_*.xlsx by mtime (matches gen_data.mjs) — reads the
    # one current file regardless of whether its name contains 'VALIDATED'.
    matches = [f for f in _glob.glob(os.path.join(ASSETS_DIR, "comics_inventory_*.xlsx"))
               if not os.path.basename(f).startswith("~$")]
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
    try:
        issue_str = str(int(float(str(issue)))) if issue and str(issue).strip() not in ("", "nan", "None") else ""
    except (ValueError, TypeError):
        issue_str = ""
    def _ascii(s):
        return str(s).encode("ascii", "ignore").decode("ascii").strip()

    query = f"{_ascii(title)} #{issue_str} comic"
    if year and str(year).strip() not in ("", "nan", "None"):
        query += f" {_ascii(str(year)[:4])}"
    # Negative keywords — added 2407 after the median-contamination bug (Roberto
    # caught Fantastic Four x Gargoyles #1 priced at $222 vs a ~$6 real value).
    # A loose title match pulls in a SECOND book's listings; the wrong comps were
    # overwhelmingly graded slabs (CGC/CBCS/PGX), multi-book lots, and reprint
    # sets — all far pricier than the single raw issue we're actually pricing.
    # Excluding them keeps the comp set on the target book. Raw prices only; the
    # inventory values raw copies, and CGC-bound books are handled separately.
    # NOTE: eBay Browse API does NOT support "-keyword" exclusion syntax in q —
    # it treats the tokens as literal text and matches nothing, so every search
    # returned NO RESULTS. Contamination is handled after the fetch by
    # brb_ebay_rescore.py (cluster split on the NM prior) instead.

    token_safe = token.encode("ascii", "ignore").decode("ascii") if token else ""
    if token_safe != token:
        return [], "token_has_non_ascii — check EBAY_APP_ID in ~/.zshrc"
    headers = {"Authorization": f"Bearer {token_safe}", "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"}

    params = {
        "q":           query,
        "filter":      "buyingOptions:{FIXED_PRICE},conditions:{USED|LIKE_NEW|VERY_GOOD|GOOD},"
                       "soldItems:true",
        "sort":        "endingSoonest",
        "limit":       10,
        "fieldgroups": "MATCHING_ITEMS",
    }
    # Ensure all param values are ASCII-safe (macOS Python 3.9 uses latin-1 for URL encoding)
    params = {k: _ascii(v) if isinstance(v, str) else v for k, v in params.items()}

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

    return prices, None


def compute_stats(prices):
    """
    Compute stats with outlier trimming.
    Drops any price > 3x the median of the full set.
    Returns dict with median, avg, low, high, count, trimmed_count, low_confidence, skewed.
    """
    if not prices:
        return None

    sorted_p = sorted(prices)
    n = len(sorted_p)
    raw_median = sorted_p[n // 2] if n % 2 else (sorted_p[n//2-1] + sorted_p[n//2]) / 2

    trimmed = [p for p in sorted_p if p <= 3 * raw_median]
    trimmed_count = n - len(trimmed)
    trim_pct = trimmed_count / n if n else 0

    if not trimmed:
        trimmed = sorted_p  # all outliers — keep original set

    tn = len(trimmed)
    median = round(trimmed[tn // 2] if tn % 2 else (trimmed[tn//2-1] + trimmed[tn//2]) / 2, 2)
    mean   = round(sum(trimmed) / tn, 2)
    low    = round(min(trimmed), 2)
    high   = round(max(trimmed), 2)

    low_confidence = tn < 3
    flagged_trim   = trim_pct > 0.30
    skewed         = abs(mean - median) / max(median, 0.01) > 0.40

    return {
        "median":         median,
        "avg_price":      mean,
        "low":            low,
        "high":           high,
        "count":          tn,
        "trimmed_count":  trimmed_count,
        "low_confidence": low_confidence,
        "flagged_trim":   flagged_trim,
        "skewed":         skewed,
    }


def is_blank(v):
    return pd.isna(v) or str(v).strip() in ("", "nan", "None")


def parse_value(row, *cols):
    """Extract first numeric value from a list of column names."""
    for col in cols:
        if col in row.index and not is_blank(row[col]):
            try:
                return float(str(row[col]).replace("$", "").replace(",", "").strip())
            except ValueError:
                pass
    return 0.0

def nm_value(row):
    return parse_value(row, "Est. Raw Value (NM) $", "NM Value", "Value NM", "NM_Value")

def vf_value(row):
    return parse_value(row, "Est. Raw Value (VF) $", "VF Value", "Value VF")

# Condition string → multiplier of NM price
CONDITION_MULTIPLIERS = {
    "fine":        0.75,
    "good/fine":   0.65,
    "good":        0.50,
    "fair":        0.30,
    "poor/fair":   0.25,
    "poor":        0.15,
    "bad":         0.10,
    "reader":      0.15,
    "unbagged":    0.50,
}

# Conditions that mean "pressed/ready — treat as NM"
PRESSED_SIGNALS = [
    "needs pressing",
    "press first",
    "needs press",
    "⚠️ needs pre",
    "⚠️ press fir",
]

# Conditions that mean "at CGC — skip raw pricing"
CGC_SIGNALS = [
    "at cgc",
    "at magic pressing",
]

def is_cgc_bound(row):
    cond = str(row.get("Condition", "") or "").lower()
    box  = str(row.get("Box #", "") or "").lower()
    return any(s in cond or s in box for s in CGC_SIGNALS)

def is_pressed(row):
    cond = str(row.get("Condition", "") or "").lower()
    return any(s in cond for s in PRESSED_SIGNALS)

def condition_adjusted_value(row):
    """Return realistic sale value based on condition."""
    nm  = nm_value(row)
    vf  = vf_value(row)
    if not nm and not vf:
        return 0.0

    # CGC-bound books skipped at queue level — return 0 here
    if is_cgc_bound(row):
        return 0.0

    # Pressed books are now ready — treat as NM
    if is_pressed(row):
        return nm if nm else (vf / 0.75 if vf else 0)

    cond = str(row.get("Condition", "") or "").lower().strip()

    # Use VF value directly if condition is VF-ish
    if vf and any(x in cond for x in ["fine", "vf", "very fine"]):
        return vf

    # Find best multiplier match
    multiplier = None
    for key, mult in CONDITION_MULTIPLIERS.items():
        if key in cond:
            multiplier = mult
            break

    if multiplier is None:
        multiplier = 0.50  # blank condition — assume mid-grade

    base = nm if nm else (vf / 0.75 if vf else 0)
    return round(base * multiplier, 2)


def main():
    parser = argparse.ArgumentParser(description="eBay sold pricing for high-value comics")
    parser.add_argument("--min-value", type=float, default=10.0, help="Minimum NM Value to include (default: 10)")
    parser.add_argument("--max-value", type=float, default=0, help="Max NM Value to include (0=no cap). Use --min-value 0 --max-value 10 for the cheap-books sweep")
    parser.add_argument("--limit",     type=int,   default=0,    help="Max comics to price (0=all)")
    parser.add_argument("--dry-run",     action="store_true", help="Show queue only, fetch nothing")
    parser.add_argument("--file",        default=None,        help="xlsx file override")
    parser.add_argument("--reprocess",   action="store_true", help="Re-pull & trim existing results")
    parser.add_argument("--modern-pass", action="store_true", help="Priority queue: Modern/Modern Age era only, unpriced rows")
    parser.add_argument("--min-year", type=int, default=0, help="Only queue books whose Year >= this (targeted recent-era de-risk pass)")
    parser.add_argument("--key-tier",    action="store_true", help="Tier 2: also queue Key Issue?=YES rows never eBay-fetched, regardless of value")
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

    # Era normalization: treat "Modern Age" as "Modern"
    if "Era" in df.columns:
        df["Era"] = df["Era"].apply(lambda v: "Modern" if str(v).strip().lower() == "modern age" else v)

    # Get OAuth token
    if not args.dry_run:
        print("Getting eBay OAuth token...")
        token = _get_oauth_token()
        if not token:
            token = EBAY_APP_ID
            print("  (using App ID as token — set EBAY_CERT_ID for full OAuth)")
    else:
        token = None

    # Load existing results early — needed for --reprocess and --modern-pass skip logic
    results = json.load(open(RESULTS_PATH)) if os.path.exists(RESULTS_PATH) else {}

    # ── --reprocess: re-pull & apply outlier trimming to all existing priced results ──────────
    if args.reprocess:
        keys_to_reprocess = [
            k for k, v in results.items()
            if v and v.get("prices") and v.get("avg") is not None
        ]
        if args.limit:
            keys_to_reprocess = keys_to_reprocess[:args.limit]
        print(f"\n--reprocess: {len(keys_to_reprocess)} existing priced results to re-pull and trim")

        needs_trim = 0; low_conf = 0; fetched_r = 0; errors_r = 0
        for i, key in enumerate(keys_to_reprocess):
            rec = results[key]
            prices, err = search_sold(rec["title"], rec["issue"], rec.get("year",""), rec.get("publisher",""), token)
            if err == "auth_error":
                print("\nAuth error — check EBAY_APP_ID and EBAY_CERT_ID")
                break
            if prices:
                stats = compute_stats(prices)
                if stats:
                    if stats["flagged_trim"]:
                        needs_trim += 1
                    if stats["low_confidence"]:
                        low_conf += 1
                    results[key].update({
                        "prices":        prices,
                        "median":        stats["median"],
                        "avg":           stats["avg_price"],
                        "avg_price":     stats["avg_price"],
                        "low":           stats["low"],
                        "high":          stats["high"],
                        "count":         stats["count"],
                        "trimmed_count": stats["trimmed_count"],
                        "low_confidence":stats["low_confidence"],
                        "flagged_trim":  stats["flagged_trim"],
                        "skewed":        stats["skewed"],
                        "fetched_at":    datetime.now().isoformat(),
                        "error":         None,
                    })
                    fetched_r += 1
                    flag = " ⚠TRIM" if stats["flagged_trim"] else (" LOW-CONF" if stats["low_confidence"] else "")
                    print(f"  [{i+1}/{len(keys_to_reprocess)}] {rec['title']} #{rec['issue']}  "
                          f"median=${stats['median']}  avg=${stats['avg_price']}  ({stats['count']} comps, {stats['trimmed_count']} trimmed){flag}")
            else:
                errors_r += 1
                print(f"  [{i+1}/{len(keys_to_reprocess)}] {rec['title']} #{rec['issue']}  NO RESULTS ({err})")
            if (fetched_r + errors_r) % 10 == 0:
                with open(RESULTS_PATH, "w") as f:
                    json.dump(results, f, indent=2)
            time.sleep(DELAY)

        with open(RESULTS_PATH, "w") as f:
            json.dump(results, f, indent=2)
        print(f"\n--reprocess done. Re-fetched: {fetched_r}  Errors: {errors_r}")
        print(f"  Flagged (>30% trimmed): {needs_trim}  Low confidence (<3 comps): {low_conf}")
        sys.exit(0)

    # Build queue: rows with NM Value > min_value, deduplicated by Title+Issue.
    #
    # De-dup picks the BEST row per Title+Issue, not the first one encountered.
    # The old code added the key to `seen` before the value/tier filters ran, so
    # if a low-value Key='NO' copy happened to sit earlier in the sheet it
    # claimed the slot and the Key='YES' copy of the same book was silently
    # dropped — that alone hid 27 key issues from --key-tier. Prefer a key
    # issue, then the highest NM value.
    def _dedup_rank(row):
        is_k = str(row.get("Key Issue?", "")).strip().upper() == "YES"
        return (0 if is_k else 1, -(nm_value(row) or 0))

    best_rows = {}
    for _, row in df.iterrows():
        title = str(row.get("Title", "")).strip()
        if not title:
            continue
        key = f'{title}|||{row.get("Issue #", "")}'
        cur = best_rows.get(key)
        if cur is None or _dedup_rank(row) < _dedup_rank(cur):
            best_rows[key] = row

    queue     = []
    cgc_queue = []
    for key, row in best_rows.items():
        nm    = nm_value(row)
        vf    = vf_value(row)
        title = str(row.get("Title", "")).strip()
        issue = row.get("Issue #", "")

        era = str(row.get("Era", "")).strip()

        # --min-year: targeted recent-era de-risk pass. A book old enough to have
        # spiked would already carry NM >= $10 and be priced; the Absolute-Batman
        # blind spot is RECENT books that jumped unexpectedly. Skip anything older.
        if args.min_year:
            ym = re.findall(r"\d{4}", str(row.get("Year", "")))
            yv = next((int(y) for y in ym if 1900 < int(y) < 2100), 0)
            if yv < args.min_year:
                continue

        # Column names are "Key Issue?" / "Signed?" — not "Key" / "Signed".
        # The old code read the wrong names, so is_key/is_signed were always
        # False (silently breaking --modern-pass's key/signed priority).
        is_key    = str(row.get("Key Issue?", "")).strip().upper() == "YES"
        is_signed = str(row.get("Signed?", "")).strip().upper() == "YES"
        ebay_fetched = str(row.get("eBay Fetched", "")).strip()
        never_fetched = ebay_fetched in ("", "nan", "None")

        comic = {
            "title":     title,
            "issue":     issue,
            "year":      row.get("Year", ""),
            "publisher": row.get("Publisher", ""),
            "nm_value":  nm,
            "vf_value":  vf,
            "condition": str(row.get("Condition", "")).strip(),
            "box":       str(row.get("Box #", "")),
            "writer":    row.get("Writer(s)", ""),
            "era":       era,
            "is_key":    is_key,
            "is_signed": is_signed,
        }

        if is_cgc_bound(row):
            if nm >= args.min_value:
                comic["adj_value"] = nm
                cgc_queue.append(comic)
            continue

        adj = condition_adjusted_value(row)
        # Tier 2 (--key-tier): a Key Issue that has never been eBay-fetched gets
        # queued regardless of its Est. Raw Value. The value field is often a
        # flat import bucket ($5/$6/$8), so gating keys on it hides genuinely
        # significant books (e.g. the Absolute line) from ever being priced.
        tier2 = args.key_tier and is_key and never_fetched
        if adj < args.min_value and not tier2:
            continue
        # --max-value: cap for the cheap-books sweep (e.g. --min-value 0
        # --max-value 10 prices only the <=$10 books, to catch any secretly
        # worth more). The recent-fetch skip below makes it resumable overnight.
        if args.max_value and adj > args.max_value and not tier2:
            continue
        comic["adj_value"] = adj
        comic["tier2"] = tier2
        queue.append(comic)

    # ── --modern-pass: filter to Modern era only, unpriced, priority sort ────────────────────
    if args.modern_pass:
        queue = [c for c in queue if c.get("era", "").lower() == "modern"]
        queue = [c for c in queue if not results.get(f"{c['title']}|||{c['issue']}", {}).get("avg")]
        # Priority: Key=YES first, then Signed=YES, then NM > $15, else by adj_value
        def modern_sort(c):
            return (
                0 if c["is_key"] else (1 if c["is_signed"] else (2 if c["nm_value"] > 15 else 3)),
                -c["adj_value"],
            )
        queue.sort(key=modern_sort)
        print(f"--modern-pass: {len(queue)} unpriced Modern-era comics in priority queue")
        key_count   = sum(1 for c in queue if c["is_key"])
        sign_count  = sum(1 for c in queue if not c["is_key"] and c["is_signed"])
        other_count = len(queue) - key_count - sign_count
        print(f"  Keys: {key_count}  Signed: {sign_count}  Other: {other_count}")
    else:
        # Cheap-books sweep (--max-value): drop books already priced so --limit
        # advances to UNPRICED ones each run (resumable). Without this the sorted
        # first-1000 are the already-fetched books, all skipped, and the sweep
        # never reaches the tail — "Fetched: 0  Skipped (recent): 1000" forever.
        if args.max_value:
            # Skip anything already ATTEMPTED (has fetched_at) — priced, suppressed,
            # or no-results alike — so the sweep only fetches never-tried books.
            queue = [c for c in queue
                     if not (results.get(f"{c['title']}|||{c['issue']}") or {}).get("fetched_at")]
        queue.sort(key=lambda x: x["adj_value"], reverse=True)

    cgc_queue.sort(key=lambda x: x["nm_value"], reverse=True)
    if args.limit:
        queue = queue[:args.limit]

    tier2_count = sum(1 for c in queue if c.get("tier2"))
    print(f"Queue: {len(queue)} raw/pressed titles with adj value ≥ ${args.min_value:.0f}"
          + (f"  (incl. {tier2_count} Tier-2 key issues under threshold)" if tier2_count else ""))
    print(f"       {len(cgc_queue)} CGC-bound titles (flagged separately, not priced as raw)")

    if args.dry_run:
        print(f"\nTop 20 raw/pressed — sorted by adjusted sale value:")
        print(f"  {'Title':<38} {'Iss':>5}  {'NM':>6}  {'Adj':>6}  {'Cond':<14}  Box")
        print(f"  {'─'*38} {'─'*5}  {'─'*6}  {'─'*6}  {'─'*14}  {'─'*5}")
        for c in queue[:20]:
            nm   = f"${c['nm_value']:.0f}" if c['nm_value'] else "—"
            adj  = f"${c['adj_value']:.0f}"
            cond = (c.get("condition") or "ungraded")[:14]
            print(f"  {c['title']:<38} #{str(c['issue']):>4}  {nm:>6}  {adj:>6}  {cond:<14}  {c['box']}")

        if cgc_queue:
            print(f"\nCGC-bound — pending grade (not priced as raw):")
            print(f"  {'Title':<38} {'Iss':>5}  {'NM':>6}  {'Cond':<20}  Box")
            print(f"  {'─'*38} {'─'*5}  {'─'*6}  {'─'*20}  {'─'*10}")
            for c in cgc_queue:
                nm   = f"${c['nm_value']:.0f}" if c['nm_value'] else "—"
                cond = (c.get("condition") or "")[:20]
                print(f"  {c['title']:<38} #{str(c['issue']):>4}  {nm:>6}  {cond:<20}  {c['box']}")
        sys.exit(0)

    # Fetch
    fetched = skipped = errors = 0
    for i, comic in enumerate(queue):
        key = f"{comic['title']}|||{comic['issue']}"

        # Skip if already priced recently (within 7 days) — unless --modern-pass already filtered
        existing = results.get(key, {})
        if not args.modern_pass and existing.get("fetched_at"):
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
            stats = compute_stats(prices)
            results[key] = {
                "title":         comic["title"],
                "issue":         str(comic["issue"]),
                "nm_value":      comic["nm_value"],
                "vf_value":      comic.get("vf_value", 0),
                "condition":     comic.get("condition", ""),
                "box":           str(comic["box"]),
                "writer":        str(comic["writer"]),
                "prices":        prices,
                "median":        stats["median"],
                "avg":           stats["avg_price"],
                "avg_price":     stats["avg_price"],
                "low":           stats["low"],
                "high":          stats["high"],
                "count":         stats["count"],
                "trimmed_count": stats["trimmed_count"],
                "low_confidence":stats["low_confidence"],
                "flagged_trim":  stats["flagged_trim"],
                "skewed":        stats["skewed"],
                "fetched_at":    datetime.now().isoformat(),
                "error":         None,
            }
            fetched += 1
            flag = " ⚠TRIM" if stats["flagged_trim"] else (" LOW-CONF" if stats["low_confidence"] else "")
            print(f"  [{i+1}/{len(queue)}] {comic['title']} #{comic['issue']}  "
                  f"median=${stats['median']}  avg=${stats['avg_price']}  "
                  f"range=${stats['low']}-${stats['high']}  ({stats['count']} comps, {stats['trimmed_count']} trimmed){flag}")
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

    # Print top 20 by median sold price (more reliable than mean with outliers)
    priced = [v for v in results.values() if v.get("median") or v.get("avg")]
    priced.sort(key=lambda x: x.get("median") or x.get("avg", 0), reverse=True)
    if priced:
        skewed_count = sum(1 for v in priced if v.get("skewed"))
        if skewed_count:
            print(f"  ⚠  {skewed_count} results flagged as outlier-skewed (mean/median diverge >40%) — trust median column")
        print(f"\nTop 20 by median sold price:")
        print(f"  {'Title':<38} {'Iss':>5}  {'NM':>5}  {'Cond':<6}  {'Median':>7}  {'Mean':>7}  {'Range':>12}  {'⚠':>2}  Box")
        print(f"  {'─'*38} {'─'*5}  {'─'*5}  {'─'*6}  {'─'*7}  {'─'*7}  {'─'*12}  {'─'*2}  {'─'*5}")
        for c in priced[:20]:
            rng    = f"${c['low']:.0f}–${c['high']:.0f}"
            nm     = f"${c['nm_value']:.0f}" if c['nm_value'] else "—"
            cond   = (c.get("condition") or "")[:6]
            median = f"${c.get('median', c.get('avg', 0)):.2f}"
            mean   = f"${c.get('avg', 0):.2f}"
            flag   = "⚠" if c.get("skewed") else ""
            print(f"  {c['title']:<38} #{str(c['issue']):>4}  "
                  f"{nm:>5}  {cond:<6}  {median:>7}  {mean:>7}  {rng:>12}  {flag:>2}  {c['box']}")


if __name__ == "__main__":
    main()
