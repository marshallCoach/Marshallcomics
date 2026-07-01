#!/usr/bin/env python3
"""
brb_validate.py — Read-only inventory health check.
Location: ~/marshallcomics/brb_validate.py

THIS SCRIPT MAKES ZERO WRITES. It reads one xlsx file and prints a report.

Usage:
    python3 brb_validate.py <path-to-xlsx>
    python3 brb_validate.py attached_assets/comics_inventory_2906_1500.xlsx

Optional: compare row count against a previous file:
    python3 brb_validate.py current.xlsx --prev previous.xlsx
"""

import sys
import os
import pandas as pd
import argparse

# ── Box capacity table ────────────────────────────────────────────────────────
BOX_CAPACITY_DEFAULT = 175
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
    section("CHECK 6 — Duplicate rows (same Title + Issue # + Box #)")
    dupes = df[df.duplicated(subset=["Title", "Issue #", "Box #"], keep=False)]
    if len(dupes):
        fail(f"{len(dupes)} rows are duplicates by Title+Issue#+Box#")
        sample = dupes.groupby(["Title", "Issue #", "Box #"]).size().reset_index(name="count")
        for _, row in sample.head(10).iterrows():
            info(f"  '{row['Title']}' #{row['Issue #']} Box#{row['Box #']} — {row['count']}x")
        if len(sample) > 10:
            info(f"  ... and {len(sample)-10} more groups")
        return False
    ok("No duplicate Title+Issue#+Box# combinations")
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


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="BRB inventory read-only health check")
    parser.add_argument("xlsx", help="Path to inventory xlsx file")
    parser.add_argument("--prev", help="Optional: path to previous xlsx for row-count comparison", default=None)
    args = parser.parse_args()

    if not os.path.exists(args.xlsx):
        print(f"ERROR: File not found: {args.xlsx}")
        sys.exit(1)

    print(f"\n{'=' * 60}")
    print(f"  BRB INVENTORY VALIDATOR — READ ONLY")
    print(f"  File : {args.xlsx}")
    if args.prev:
        print(f"  Prev : {args.prev}")
    print(f"{'=' * 60}")

    df = pd.read_excel(args.xlsx, sheet_name=0)
    prev_df = pd.read_excel(args.prev, sheet_name=0) if args.prev else None

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
