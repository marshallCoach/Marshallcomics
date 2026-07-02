#!/usr/bin/env python3
"""
brb_invalid_boxes.py — Export rows with invalid Box # to CSV for manual correction.
Run from: ~/marshallcomics/

Usage:
    python3 brb_invalid_boxes.py
    python3 brb_invalid_boxes.py comics_inventory_0207_0130_VALIDATED.xlsx

Output: invalid_boxes_to_fix.csv  (open in Excel, fill in 'correct_box_num', save)
"""

import sys, os, glob as _glob
import pandas as pd

REPO_ROOT  = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(REPO_ROOT, "attached_assets")
OUT_PATH   = os.path.join(REPO_ROOT, "invalid_boxes_to_fix.csv")


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
    REQUIRED = ["Title", "Issue #", "Box #"]
    for name in xl.sheet_names:
        df = xl.parse(name)
        if all(c in df.columns for c in REQUIRED):
            return df, name
    return xl.parse(xl.sheet_names[0]), xl.sheet_names[0]


def main():
    raw = sys.argv[1] if len(sys.argv) > 1 else None
    path = _resolve(raw) if raw else _latest_validated()
    if not path or not os.path.exists(path):
        print(f"ERROR: No xlsx found. Pass a filename or run from ~/marshallcomics/")
        sys.exit(1)

    df, sheet = _load(path)
    print(f"Loaded '{sheet}' — {len(df):,} rows from {os.path.basename(path)}")

    numeric = pd.to_numeric(df["Box #"], errors="coerce")
    bad_mask = numeric.isna() | (numeric < 1) | (
        numeric != numeric.apply(lambda x: round(x) if pd.notna(x) else x)
    )
    bad = df[bad_mask].copy()
    bad["correct_box_num"] = ""   # column for you to fill in

    print(f"\n{len(bad)} rows with invalid Box #:\n")

    # Summary by category
    for val, grp in bad.groupby("Box #", sort=False):
        print(f"  [{len(grp):>3}]  Box # = '{val}'")
        for _, row in grp.head(5).iterrows():
            vol = f" Vol{row['Volume']}" if "Volume" in row and pd.notna(row.get("Volume")) else ""
            print(f"          {row['Title']}{vol} #{row['Issue #']}")
        if len(grp) > 5:
            print(f"          ... and {len(grp)-5} more")

    # Export
    cols = ["Title", "Issue #", "Box #", "correct_box_num"]
    if "Volume" in bad.columns:   cols.insert(2, "Volume")
    if "Publisher" in bad.columns: cols.insert(2, "Publisher")
    if "Year" in bad.columns:     cols.insert(2, "Year")
    bad[cols].to_csv(OUT_PATH, index=True, index_label="row_index")

    print(f"\nExported to: {OUT_PATH}")
    print("Fill in 'correct_box_num' for each row, then tell Claude — we'll apply the patch.")


if __name__ == "__main__":
    main()
