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

    # Build composite keys matching the Mac validator exactly:
    # R2: title+issue+year+box  (same-box exact dupes)
    # R3: title+issue+year across different boxes, missing verify flag
    t   = physical["Title"].str.lower().fillna("")
    iss = physical["Issue #"].astype(str).str.strip()
    yr  = physical["Year"].astype(str).str.strip()
    box = physical["Box #"].astype(str).str.strip()

    k2 = t + "|" + iss + "|" + yr + "|" + box
    k3 = t + "|" + iss + "|" + yr

    # Rule 2: same-box exact duplicates (extra copies only, like validator)
    same_box_mask = k2.duplicated(keep=False)
    same_box_dupes = physical[same_box_mask].copy()
    same_box_dupes["_key"] = k2[same_box_mask]
    same_box_dupes = same_box_dupes.sort_values("_key")

    # Rule 3: cross-box dupes missing verify flag
    vd = df.get("⚠ Verify Duplicate")
    dup_k3 = k3[k3.duplicated(keep=False)]
    cross_candidates = physical[k3.isin(dup_k3)].copy()
    cross_candidates["_k3"] = k3[k3.isin(dup_k3)]

    missing_flag_rows = []
    for k, g in cross_candidates.groupby("_k3"):
        if g["Box #"].astype(str).str.strip().nunique() > 1:
            if vd is not None:
                unflagged = vd.loc[g.index].astype(str).str.strip().isin(["", "nan", "None"])
                if unflagged.any():
                    missing_flag_rows.append(g[unflagged])
            else:
                missing_flag_rows.append(g)

    missing_flag = pd.concat(missing_flag_rows).sort_values(["Title", "Issue #"]) if missing_flag_rows else pd.DataFrame(columns=physical.columns)

    # export
    out1 = os.path.join(REPO_ROOT, "dupes_same_box.csv")
    out2 = os.path.join(REPO_ROOT, "dupes_cross_box.csv")

    cols = [c for c in ["Title", "Issue #", "Year", "Box #", "Volume", "Publisher", "Writer(s)", "Condition", "Grade"] if c in df.columns]
    same_box_dupes[cols].to_csv(out1, index=True)
    missing_flag[[c for c in cols if c in missing_flag.columns]].to_csv(out2, index=True)

    print(f"\nSame-box dupes  ({len(same_box_dupes)} rows): {out1}")
    print(f"Cross-box dupes ({len(missing_flag)} rows): {out2}")
    print("\nReview these files, then delete or flag rows in the xlsx on your Mac.")

if __name__ == "__main__":
    main()
