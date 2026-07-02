#!/usr/bin/env python3
"""
brb_validate.py — Read-only inventory health check.
Location: ~/marshallcomics/brb_validate.py
Run from:  ~/marshallcomics/

THIS SCRIPT MAKES ZERO WRITES. It reads one xlsx file and prints a report.

Usage (all run from ~/marshallcomics/):

    # Auto-detect latest *VALIDATED*.xlsx in attached_assets/:
    python3 brb_validate.py

    # Filename only — auto-resolved to attached_assets/:
    python3 brb_validate.py comics_inventory_0207_0130_VALIDATED.xlsx

    # Explicit relative or absolute path:
    python3 brb_validate.py attached_assets/comics_inventory_0207_0130_VALIDATED.xlsx

Optional: compare row count against a previous file (same resolution rules):
    python3 brb_validate.py --prev comics_inventory_0107_2230_VALIDATED.xlsx
"""

import sys
import os
import glob as _glob
import pandas as pd
import argparse

# ── Paths ─────────────────────────────────────────────────────────────────────
REPO_ROOT  = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(REPO_ROOT, "attached_assets")


def _resolve(raw: str) -> str:
    """Resolve a file argument: try raw path, then attached_assets/<basename>."""
    if os.path.exists(raw):
        return os.path.abspath(raw)
    candidate = os.path.join(ASSETS_DIR, os.path.basename(raw))
    if os.path.exists(candidate):
        return candidate
    return raw  # will fail with a clear message below


def _latest_validated() -> str:
    """Return the most-recently-modified *VALIDATED*.xlsx in attached_assets/."""
    pattern = os.path.join(ASSETS_DIR, "comics_inventory_*VALIDATED*.xlsx")
    matches = _glob.glob(pattern)
    if not matches:
        matches = _glob.glob(os.path.join(ASSETS_DIR, "comics_inventory_*.xlsx"))
    if not matches:
        return ""
    return max(matches, key=os.path.getmtime)


# ── Box capacity table ────────────────────────────────────────────────────────
BOX_CAPACITY_DEFAULT    = 175
BOX_CAPACITY_EXCEPTIONS = {15: 150, 23: 155, 40: 80, 44: 200, 72: 80}

REQUIRED_COLUMNS = ["Title", "Issue #", "Box #", "Publisher", "Year", "Writer(s)"]

# ── Helpers ───────────────────────────────────────────────────────────────────
def is_blank(v):
    return pd.isna(v) or str(v).strip() in ("", "nan", "None")

def section(title):
    print(f"\n{'─' * 60}")
    print(f"  {title}")
    print('─' * 60)

def ok(msg):    print(f"  ✓  {msg}")
def fail(msg):  print(f"  ✗  {msg}")
def warn(msg):  print(f"  ⚠  {msg}")
def info(msg):  print(f"     {msg}")

# ── Checks ────────────────────────────────────────────────────────────────────

def check_required_columns(df):
    section("CHECK 1 — Required columns present")
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        for c in missing:
            fail(f"Missing column: '{c}'")
        return False
    ok(f"All {len(REQUIRED_COLUMNS)} required columns present")
    return True


def check_row_count(df, prev_df=None):
    section("CHECK 2 — Row count")
    n = len(df)
    ok(f"Total rows: {n:,}")
    if prev_df is not None:
        prev_n = len(prev_df)
        delta = n - prev_n
        if delta < 0:
            fail(f"Row count DROPPED vs previous file: {prev_n:,} → {n:,} ({delta})")
            return False
        elif delta == 0:
            ok(f"Row count unchanged vs previous file ({prev_n:,})")
        else:
            ok(f"Row count grew vs previous file: {prev_n:,} → {n:,} (+{delta})")
    return True


def check_blank_titles(df):
    section("CHECK 3 — Blank Title fields")
    blank = df[df["Title"].apply(is_blank)]
    if len(blank):
        fail(f"{len(blank)} rows have a blank Title")
        for _, row in blank.head(10).iterrows():
            info(f"  Row index {row.name} — Box #{row.get('Box #','?')} Issue #{row.get('Issue #','?')}")
        if len(blank) > 10:
            info(f"  ... and {len(blank)-10} more")
        return False
    ok("No blank Title fields")
    return True


def check_blank_box_numbers(df):
    section("CHECK 4 — Blank Box # fields")
    blank = df[df["Box #"].apply(is_blank)]
    if len(blank):
        fail(f"{len(blank)} rows have a blank Box #")
        for _, row in blank.head(10).iterrows():
            info(f"  '{row.get('Title','?')}' #{row.get('Issue #','?')}")
        if len(blank) > 10:
            info(f"  ... and {len(blank)-10} more")
        return False
    ok("No blank Box # fields")
    return True


def check_box_capacity(df):
    section("CHECK 5 — Box capacity (default 175; exceptions: 15=150, 23=155, 40=80, 44=200, 72=80)")
    counts = df.groupby("Box #").size()
    violations = []
    for box, count in counts.items():
        try:
            box_num = int(float(str(box)))
        except (ValueError, TypeError):
            continue
        cap = BOX_CAPACITY_EXCEPTIONS.get(box_num, BOX_CAPACITY_DEFAULT)
        if count > cap:
            violations.append((box_num, count, cap, count - cap))
    if violations:
        fail(f"{len(violations)} boxes over capacity:")
        for box_num, count, cap, over in sorted(violations):
            info(f"  Box {box_num:>3}: {count} comics  (cap {cap}, overage +{over})")
        return False
    ok(f"All {len(counts)} boxes within capacity")
    return True


def check_duplicate_rows(df):
    section("CHECK 6 — Duplicate rows (same Title + Issue # + Box # + Volume)")
    key = ["Title", "Issue #", "Box #", "Volume"]
    available = [c for c in key if c in df.columns]
    dupes = df[df.duplicated(subset=available, keep=False)]
    if len(dupes):
        fail(f"{len(dupes)} rows are duplicates by {' + '.join(available)}")
        sample = dupes.groupby(available).size().reset_index(name="count")
        for _, row in sample.head(10).iterrows():
            info(f"  '{row['Title']}' #{row['Issue #']} Box#{row['Box #']} Vol{row.get('Volume','?')} — {row['count']}x")
        if len(sample) > 10:
            info(f"  ... and {len(sample)-10} more groups")
        return False
    ok(f"No duplicate {' + '.join(available)} combinations")
    return True


def check_year_format(df):
    section("CHECK 7 — Year field (should be numeric, 1930–2030)")
    non_numeric = df[pd.to_numeric(df["Year"], errors="coerce").isna() & ~df["Year"].apply(is_blank)]
    out_of_range = df[
        pd.to_numeric(df["Year"], errors="coerce").notna() &
        (~pd.to_numeric(df["Year"], errors="coerce").between(1930, 2030))
    ]
    passed = True
    if len(non_numeric):
        warn(f"{len(non_numeric)} rows have non-numeric Year values")
        for _, row in non_numeric.head(5).iterrows():
            info(f"  '{row.get('Title','?')}' — Year='{row.get('Year','?')}'")
        passed = False
    if len(out_of_range):
        warn(f"{len(out_of_range)} rows have Year outside 1930–2030")
        for _, row in out_of_range.head(5).iterrows():
            info(f"  '{row.get('Title','?')}' — Year='{row.get('Year','?')}'")
        passed = False
    if passed:
        ok("All Year values are numeric and in range")
    return passed


def check_writer_fill_rate(df):
    section("CHECK 8 — Writer(s) fill rate")
    total = len(df)
    filled = df[~df["Writer(s)"].apply(is_blank)]
    pct = 100 * len(filled) / total if total else 0
    msg = f"{len(filled):,} / {total:,} rows have Writer(s) filled ({pct:.1f}%)"
    if pct >= 80:
        ok(msg)
    elif pct >= 50:
        warn(msg)
    else:
        fail(msg)
    return pct >= 50


def check_box_number_range(df):
    section("CHECK 9 — Box # values are positive integers")
    numeric = pd.to_numeric(df["Box #"], errors="coerce")
    bad = df[numeric.isna() | (numeric < 1) | (numeric != numeric.apply(lambda x: round(x) if pd.notna(x) else x))]
    if len(bad):
        fail(f"{len(bad)} rows have invalid Box # values (non-integer or < 1)")
        for _, row in bad.head(10).iterrows():
            info(f"  '{row.get('Title','?')}' — Box #='{row.get('Box #','?')}'")
        return False
    ok("All Box # values are valid positive integers")
    return True


def check_issue_number_present(df):
    section("CHECK 10 — Issue # blank rate")
    blank = df[df["Issue #"].apply(is_blank)]
    pct = 100 * len(blank) / len(df) if len(df) else 0
    msg = f"{len(blank):,} / {len(df):,} rows have blank Issue # ({pct:.1f}%)"
    if pct == 0:
        ok(msg)
    elif pct < 5:
        warn(msg)
    else:
        fail(msg)
    return pct < 5


# ── Sheet loader ─────────────────────────────────────────────────────────────

def _load_inventory_sheet(path: str) -> pd.DataFrame:
    """Load the first sheet that contains all REQUIRED_COLUMNS; fall back to sheet 0."""
    xl = pd.ExcelFile(path)
    for name in xl.sheet_names:
        df = xl.parse(name)
        if all(c in df.columns for c in REQUIRED_COLUMNS):
            if name != xl.sheet_names[0]:
                print(f"     (using sheet '{name}')")
            return df
    # No sheet has all required columns — return sheet 0 so checks report the real errors
    print(f"     WARNING: no sheet contains all required columns.")
    print(f"     Available sheets: {xl.sheet_names}")
    return xl.parse(xl.sheet_names[0])


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="BRB inventory read-only health check. Run from ~/marshallcomics/."
    )
    parser.add_argument(
        "xlsx", nargs="?", default=None,
        help="xlsx file: filename, relative path, or absolute path. "
             "Omit to auto-detect the latest *VALIDATED*.xlsx in attached_assets/."
    )
    parser.add_argument(
        "--prev", default=None,
        help="Optional: previous xlsx for row-count comparison (same resolution rules)."
    )
    args = parser.parse_args()

    # Resolve xlsx path
    if args.xlsx is None:
        xlsx_path = _latest_validated()
        if not xlsx_path:
            print(f"ERROR: No comics_inventory_*.xlsx found in {ASSETS_DIR}")
            sys.exit(1)
    else:
        xlsx_path = _resolve(args.xlsx)

    if not os.path.exists(xlsx_path):
        print(f"ERROR: File not found: {xlsx_path}")
        print(f"       Looked in: {ASSETS_DIR}")
        sys.exit(1)

    prev_path = _resolve(args.prev) if args.prev else None
    if prev_path and not os.path.exists(prev_path):
        print(f"ERROR: Previous file not found: {prev_path}")
        sys.exit(1)

    print(f"\n{'=' * 60}")
    print(f"  BRB INVENTORY VALIDATOR — READ ONLY")
    print(f"  File : {os.path.relpath(xlsx_path, REPO_ROOT)}")
    if prev_path:
        print(f"  Prev : {os.path.relpath(prev_path, REPO_ROOT)}")
    print(f"{'=' * 60}")

    df = _load_inventory_sheet(xlsx_path)
    prev_df = _load_inventory_sheet(prev_path) if prev_path else None

    results = []
    results.append(check_required_columns(df))
    results.append(check_row_count(df, prev_df))
    results.append(check_blank_titles(df))
    results.append(check_blank_box_numbers(df))
    results.append(check_box_capacity(df))
    results.append(check_duplicate_rows(df))
    results.append(check_year_format(df))
    results.append(check_writer_fill_rate(df))
    results.append(check_box_number_range(df))
    results.append(check_issue_number_present(df))

    passed = sum(results)
    total  = len(results)

    print(f"\n{'=' * 60}")
    if passed == total:
        print(f"  RESULT: ALL {total} CHECKS PASSED")
    else:
        print(f"  RESULT: {total - passed} of {total} CHECKS FAILED")
    print(f"{'=' * 60}\n")

    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
