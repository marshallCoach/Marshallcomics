#!/usr/bin/env python3
"""
brb_export_dupes.py — Export duplicate rows to CSV for review.
Usage: python3 brb_export_dupes.py [inventory.xlsx]
Outputs: dupes_same_box.csv and dupes_cross_box.csv
"""
import sys, os, glob
import pandas as pd

REPO_ROOT  = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(REPO_ROOT, "attached_assets")

BOX_STATUS_ALLOWLIST = {
    "AT CGC",
    "AT MAGIC PRESSING → CGC",
    "AT CGC — Roy Thomas SS",
    "UNKNOWN — needs physical reassignment",
}

KEY = ["Title", "Issue #", "Volume"]

def resolve(path):
    if path and os.path.exists(path):
        return os.path.abspath(path)
    if path:
        c = os.path.join(ASSETS_DIR, os.path.basename(path))
        if os.path.exists(c):
            return c
    matches = glob.glob(os.path.join(ASSETS_DIR, "comics_inventory_*VALIDATED*.xlsx"))
    if not matches:
        matches = glob.glob(os.path.join(ASSETS_DIR, "comics_inventory_*.xlsx"))
    return max(matches, key=os.path.getmtime) if matches else None

def load(path):
    xl = pd.ExcelFile(path)
    for name in xl.sheet_names:
        df = xl.parse(name)
        if "Title" in df.columns and "Issue #" in df.columns:
            return df, name
    return xl.parse(xl.sheet_names[0]), xl.sheet_names[0]

def main():
    raw = sys.argv[1] if len(sys.argv) > 1 else None
    path = resolve(raw)
    if not path or not os.path.exists(path):
        print("ERROR: no inventory file found")
        sys.exit(1)

    df, sheet = load(path)
    print(f"Loaded '{sheet}' — {len(df):,} rows from {os.path.basename(path)}")

    # exclude status-box rows
    physical = df[~df["Box #"].apply(lambda v: str(v).strip() in BOX_STATUS_ALLOWLIST)].copy()

    available_key = [c for c in KEY if c in df.columns]
    same_box_key  = available_key + ["Box #"]

    # Rule 2: same-box exact duplicates
    same_box_dupes = physical[physical.duplicated(subset=same_box_key, keep=False)].copy()
    same_box_dupes = same_box_dupes.sort_values(same_box_key)

    # Rule 3: cross-box dupes missing verify flag
    has_flag_col = "⚠ Verify Duplicate" in df.columns
    cross_box_dupes = physical[physical.duplicated(subset=available_key, keep=False)].copy()
    # remove rows that are already same-box dupes (those are Rule 2)
    cross_box_only = cross_box_dupes[~cross_box_dupes.duplicated(subset=same_box_key, keep=False)].copy()
    if has_flag_col:
        missing_flag = cross_box_only[
            cross_box_only["⚠ Verify Duplicate"].apply(
                lambda v: pd.isna(v) or str(v).strip() == ""
            )
        ].copy()
    else:
        missing_flag = cross_box_only.copy()
    missing_flag = missing_flag.sort_values(available_key)

    # export
    out1 = os.path.join(REPO_ROOT, "dupes_same_box.csv")
    out2 = os.path.join(REPO_ROOT, "dupes_cross_box.csv")

    cols = same_box_key + [c for c in ["Publisher", "Year", "Writer(s)", "Condition", "Grade"] if c in df.columns]
    same_box_dupes[cols].to_csv(out1, index=True)
    missing_flag[[c for c in cols if c in missing_flag.columns]].to_csv(out2, index=True)

    print(f"\nSame-box dupes  ({len(same_box_dupes)} rows): {out1}")
    print(f"Cross-box dupes ({len(missing_flag)} rows): {out2}")
    print("\nReview these files, then delete or flag rows in the xlsx on your Mac.")

if __name__ == "__main__":
    main()
