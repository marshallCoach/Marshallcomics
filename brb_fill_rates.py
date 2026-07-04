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

COVERS_JSON = os.path.join(REPO_ROOT, "covers.json")

# Column names to check — covers.json is the source for cover images
WRITER_COL       = "Writer(s)"
ARTIST_COL       = "Artist(s)"
COVER_ARTIST_COL = "Cover_Artist"


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


def report(df, sheet, filename, label=""):
    total = len(df)
    heading = f"  {label}" if label else ""
    print(f"\n{'=' * 58}")
    print(f"  FILL RATES — {os.path.basename(filename)}{heading}")
    print(f"  Sheet : {sheet}   Rows : {total:,}")
    print(f"{'=' * 58}")

    rows = []

    for col, name in [
        (WRITER_COL,       "Writers     "),
        (ARTIST_COL,       "Artists     "),
        (COVER_ARTIST_COL, "Cover Artist"),
    ]:
        filled, tot, pct = fill_rate(df, col)
        if filled is None:
            rows.append((name, None, tot, None, "  (column not present)"))
        else:
            rows.append((name, filled, tot, pct, ""))

    for name, filled, tot, pct, note in rows:
        if pct is None:
            print(f"  {name}  {note}")
        else:
            flag = "✓" if pct >= 80 else ("⚠" if pct >= 50 else "✗")
            print(f"  {flag}  {name}  {filled:>6,} / {tot:,}  ({pct:5.1f}%)  {bar(pct)}")

    # Cover images from covers.json
    cov_filled, cov_total = covers_from_json()
    if cov_total is not None:
        cov_pct = 100 * cov_filled / cov_total if cov_total else 0
        flag = "✓" if cov_pct >= 80 else ("⚠" if cov_pct >= 50 else "✗")
        print(f"  {flag}  Cover Images  {cov_filled:>6,} / {cov_total:,}  ({cov_pct:5.1f}%)  {bar(cov_pct)}")
        print(f"       (source: covers.json)")
    else:
        print(f"     Cover Images  (covers.json not found — run fetchCovers.mjs first)")

    print(f"{'=' * 58}\n")


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
        print(f"{'─' * 58}")
        print(f"  DELTA  ({os.path.basename(prev_path)} → {os.path.basename(path)})")
        print(f"{'─' * 58}")
        for col, name in [
            (WRITER_COL,       "Writers     "),
            (ARTIST_COL,       "Artists     "),
            (COVER_ARTIST_COL, "Cover Artist"),
        ]:
            f1, t1, p1 = fill_rate(prev_df, col)
            f2, t2, p2 = fill_rate(df,      col)
            if f1 is None or f2 is None:
                continue
            delta = f2 - f1
            sign  = "+" if delta >= 0 else ""
            print(f"  {name}  {sign}{delta:,}  ({p1:.1f}% → {p2:.1f}%)")
        print(f"{'─' * 58}\n")


if __name__ == "__main__":
    main()
