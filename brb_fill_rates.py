#!/usr/bin/env python3
"""
brb_fill_rates.py — Count filled Writers, Artists, and Cover Images.
Run from: ~/marshallcomics/

Usage:
    python3 brb_fill_rates.py
    python3 brb_fill_rates.py comics_inventory_0107_2230_VALIDATED.xlsx
    python3 brb_fill_rates.py --prev comics_inventory_0107_2230_VALIDATED.xlsx  # compare two files
"""

import sys, os, glob as _glob, argparse
import pandas as pd

REPO_ROOT  = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(REPO_ROOT, "attached_assets")

COVERS_JSON      = os.path.join(REPO_ROOT, "covers.json")
EBAY_JSON        = os.path.join(REPO_ROOT, "ebay_pricing_results.json")

# Column names to check — covers.json is the source for cover images
WRITER_COL       = "Writer(s)"
ARTIST_COL       = "Artist(s)"
COVER_ARTIST_COL = "Cover_Artist"
YEAR_COL         = "Year"
VOLUME_COL       = "Volume"

# eBay xlsx columns (written by brb_ebay_pricing.py merge step)
EBAY_AVG_COL     = "eBay Avg Sold $"


def _resolve(raw):
    if os.path.exists(raw): return os.path.abspath(raw)
    c = os.path.join(ASSETS_DIR, os.path.basename(raw))
    return c if os.path.exists(c) else raw


def _latest_validated():
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
    return xl.parse(xl.sheet_names[0]), xl.sheet_names[0]


def is_blank(v):
    return pd.isna(v) or str(v).strip() in ("", "nan", "None")


def fill_rate(df, col):
    if col not in df.columns:
        return None, None, None
    total  = len(df)
    filled = int((~df[col].apply(is_blank)).sum())
    pct    = 100 * filled / total if total else 0
    return filled, total, pct


def bar(pct, width=30):
    filled = int(round(pct / 100 * width))
    return "█" * filled + "░" * (width - filled)


def covers_from_json():
    """Count non-null entries in covers.json."""
    if not os.path.exists(COVERS_JSON):
        return None, None
    import json
    with open(COVERS_JSON) as f:
        data = json.load(f)
    total  = len(data)
    filled = sum(1 for v in data.values() if v and v.get("url"))
    return filled, total


def ebay_from_json():
    """Count priced entries in ebay_pricing_results.json."""
    if not os.path.exists(EBAY_JSON):
        return None, None
    import json
    with open(EBAY_JSON) as f:
        data = json.load(f)
    total  = len(data)
    filled = sum(1 for v in data.values() if v and v.get("avg_price") is not None)
    return filled, total


def fill_rate_year(df):
    """Year is filled if non-blank. Range years (e.g. 2005-2008) count as filled."""
    if YEAR_COL not in df.columns:
        return None, None, None
    total  = len(df)
    filled = int((~df[YEAR_COL].apply(is_blank)).sum())
    pct    = 100 * filled / total if total else 0
    return filled, total, pct


def fill_rate_volume(df):
    """Volume is filled if non-blank (1 = explicitly set, which counts)."""
    if VOLUME_COL not in df.columns:
        return None, None, None
    total  = len(df)
    filled = int((~df[VOLUME_COL].apply(is_blank)).sum())
    pct    = 100 * filled / total if total else 0
    return filled, total, pct


def fill_rate_ebay(df):
    """eBay Avg Sold $ is filled if non-blank."""
    if EBAY_AVG_COL not in df.columns:
        return None, None, None
    total  = len(df)
    filled = int((~df[EBAY_AVG_COL].apply(is_blank)).sum())
    pct    = 100 * filled / total if total else 0
    return filled, total, pct


def report(df, sheet, filename, label=""):
    total = len(df)
    heading = f"  {label}" if label else ""
    print(f"\n{'=' * 62}")
    print(f"  FILL RATES — {os.path.basename(filename)}{heading}")
    print(f"  Sheet : {sheet}   Rows : {total:,}")
    print(f"{'=' * 62}")

    def print_row(name, filled, tot, pct, note=""):
        if pct is None:
            print(f"      {name:<14}  {note}")
        else:
            flag = "✓" if pct >= 80 else ("⚠" if pct >= 50 else "✗")
            print(f"  {flag}  {name:<14}  {filled:>6,} / {tot:,}  ({pct:5.1f}%)  {bar(pct, 24)}")

    print(f"\n  ── CREATOR CREDITS ──────────────────────────────────")
    for col, name in [
        (WRITER_COL,       "Writers"),
        (ARTIST_COL,       "Artists"),
        (COVER_ARTIST_COL, "Cover Artist"),
    ]:
        filled, tot, pct = fill_rate(df, col)
        if filled is None:
            print_row(name, None, None, None, "(column not present)")
        else:
            print_row(name, filled, tot, pct)

    print(f"\n  ── CATALOGUE FIELDS ─────────────────────────────────")
    for fn, name in [
        (fill_rate_year,   "Year"),
        (fill_rate_volume, "Volume"),
    ]:
        filled, tot, pct = fn(df)
        if filled is None:
            print_row(name, None, None, None, "(column not present)")
        else:
            print_row(name, filled, tot, pct)

    print(f"\n  ── MEDIA ────────────────────────────────────────────")
    # Cover images from covers.json
    cov_filled, cov_total = covers_from_json()
    if cov_total is not None:
        cov_pct = 100 * cov_filled / cov_total if cov_total else 0
        flag = "✓" if cov_pct >= 80 else ("⚠" if cov_pct >= 50 else "✗")
        print(f"  {flag}  {'Cover Images':<14}  {cov_filled:>6,} / {cov_total:,}  ({cov_pct:5.1f}%)  {bar(cov_pct, 24)}")
        print(f"       (source: covers.json — unique title/issue combos)")
    else:
        print(f"        Cover Images    (covers.json not found — run fetchCovers.mjs first)")

    print(f"\n  ── EBAY PRICING ─────────────────────────────────────")
    # eBay data in xlsx
    ebay_filled, ebay_tot, ebay_pct = fill_rate_ebay(df)
    if ebay_filled is None:
        print(f"        eBay (xlsx)     ('{EBAY_AVG_COL}' column not present)")
    else:
        flag = "✓" if ebay_pct >= 50 else ("⚠" if ebay_pct >= 20 else "✗")
        print(f"  {flag}  {'eBay (xlsx)':<14}  {ebay_filled:>6,} / {ebay_tot:,}  ({ebay_pct:5.1f}%)  {bar(ebay_pct, 24)}")

    # eBay data in JSON cache
    json_filled, json_total = ebay_from_json()
    if json_total is not None:
        json_pct = 100 * json_filled / json_total if json_total else 0
        flag = "✓" if json_pct >= 80 else ("⚠" if json_pct >= 50 else "✗")
        print(f"  {flag}  {'eBay (json)':<14}  {json_filled:>6,} / {json_total:,}  ({json_pct:5.1f}%)  {bar(json_pct, 24)}")
        print(f"       (source: ebay_pricing_results.json)")
    else:
        print(f"        eBay (json)     (ebay_pricing_results.json not found — run brb_ebay_pricing.py first)")

    print(f"\n{'=' * 62}\n")


def main():
    parser = argparse.ArgumentParser(description="Fill rate report for writers, artists, cover images")
    parser.add_argument("xlsx",   nargs="?", default=None)
    parser.add_argument("--prev", default=None, help="Previous file to compare against")
    args = parser.parse_args()

    path = _resolve(args.xlsx) if args.xlsx else _latest_validated()
    if not path or not os.path.exists(path):
        print(f"ERROR: No xlsx found in {ASSETS_DIR}")
        sys.exit(1)

    df, sheet = _load(path)
    report(df, sheet, path)

    if args.prev:
        prev_path = _resolve(args.prev)
        if not os.path.exists(prev_path):
            print(f"ERROR: Previous file not found: {prev_path}")
            sys.exit(1)
        prev_df, prev_sheet = _load(prev_path)
        report(prev_df, prev_sheet, prev_path, label="(previous)")

        # Delta summary
        print(f"{'─' * 62}")
        print(f"  DELTA  ({os.path.basename(prev_path)} → {os.path.basename(path)})")
        print(f"{'─' * 62}")

        def delta_row(name, f1, p1, f2, p2):
            if f1 is None or f2 is None:
                return
            delta = f2 - f1
            sign  = "+" if delta >= 0 else ""
            print(f"  {name:<16}  {sign}{delta:,}  ({p1:.1f}% → {p2:.1f}%)")

        for col, name in [
            (WRITER_COL,       "Writers"),
            (ARTIST_COL,       "Artists"),
            (COVER_ARTIST_COL, "Cover Artist"),
        ]:
            f1, t1, p1 = fill_rate(prev_df, col)
            f2, t2, p2 = fill_rate(df,      col)
            delta_row(name, f1, p1, f2, p2)

        for fn, name in [
            (fill_rate_year,   "Year"),
            (fill_rate_volume, "Volume"),
            (fill_rate_ebay,   "eBay (xlsx)"),
        ]:
            f1, t1, p1 = fn(prev_df)
            f2, t2, p2 = fn(df)
            delta_row(name, f1, p1, f2, p2)

        print(f"{'─' * 62}\n")


if __name__ == "__main__":
    main()
