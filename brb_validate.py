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
BOX_CAPACITY_DEFAULT    = 240
BOX_CAPACITY_EXCEPTIONS = {15: 150, 23: 155, 40: 80, 44: 200, 72: 80, 85: 155}

# Non-numeric Box # values that are deliberate status strings, not errors.
# These track active CGC/pressing submissions and must never be treated as invalid.
BOX_STATUS_ALLOWLIST = {
    "AT CGC",
    "AT MAGIC PRESSING → CGC",
    "AT CGC — Roy Thomas SS",
    "UNKNOWN — needs physical reassignment",
}

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
    section(f"CHECK 5 — Box capacity (default {BOX_CAPACITY_DEFAULT}; exceptions: "
            + ", ".join(f"{k}={v}" for k, v in sorted(BOX_CAPACITY_EXCEPTIONS.items())) + ")")
    # Normalize all box numbers to int before grouping — prevents "7" and "7.0" splitting
    numeric_mask = pd.to_numeric(df["Box #"], errors="coerce").notna()
    box_int = pd.to_numeric(df.loc[numeric_mask, "Box #"], errors="coerce").astype(int)
    counts = box_int.value_counts()
    violations = []
    for box_num, count in counts.items():
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
    # Key matches Mac validator Rule 2: Title + Issue # + Year + Box #  (no Volume)
    section("CHECK 6 — Same-box duplicates (Title + Issue # + Year + Box #)")
    physical = df[~df["Box #"].apply(lambda v: str(v).strip() in BOX_STATUS_ALLOWLIST)].copy()
    excluded = len(df) - len(physical)
    if excluded:
        info(f"{excluded} status-box rows (UNKNOWN/CGC) excluded from duplicate check")

    t   = physical["Title"].str.lower().fillna("")
    iss = physical["Issue #"].astype(str).str.strip()
    yr  = physical["Year"].astype(str).str.strip()
    box = physical["Box #"].astype(str).str.strip()
    k2  = t + "|" + iss + "|" + yr + "|" + box

    dupes = physical[k2.duplicated(keep=False)]
    if len(dupes):
        groups_k2 = k2[k2.duplicated(keep=False)]
        n_groups_k2 = groups_k2.nunique()
        excess_k2 = len(dupes) - n_groups_k2  # net rows to purge, not total rows in groups
        fail(f"{n_groups_k2} same-box duplicate groups / {excess_k2} excess rows "
             f"(Title+Issue#+Year+Box#) — {len(dupes)} total rows across all groups")
        sample = dupes.assign(_k=k2[k2.duplicated(keep=False)]).groupby("_k").size().reset_index(name="count")
        for _, row in sample.head(10).iterrows():
            parts = row["_k"].split("|")
            info(f"  '{parts[0]}' #{parts[1]} {parts[2]} Box#{parts[3]} — {row['count']}x")
        if len(sample) > 10:
            info(f"  ... and {len(sample)-10} more groups")
        return False
    ok("No same-box duplicate Title+Issue#+Year+Box# combinations")
    return True


def check_cross_box_duplicates(df):
    # Matches Mac validator Rule 3: same Title+Issue#+Year across different boxes,
    # not flagged with '⚠ Verify Duplicate'
    section("CHECK 6b — Cross-box duplicates missing '⚠ Verify Duplicate' flag")
    physical = df[~df["Box #"].apply(lambda v: str(v).strip() in BOX_STATUS_ALLOWLIST)].copy()

    t   = physical["Title"].str.lower().fillna("")
    iss = physical["Issue #"].astype(str).str.strip()
    yr  = physical["Year"].astype(str).str.strip()
    box = physical["Box #"].astype(str).str.strip()
    k3  = t + "|" + iss + "|" + yr

    dup_k3 = k3[k3.duplicated(keep=False)]
    cross_candidates = physical[k3.isin(dup_k3)].copy()
    cross_candidates["_k3"] = k3[k3.isin(dup_k3)]

    vd = df.get("⚠ Verify Duplicate")
    missing_rows = []
    for k, g in cross_candidates.groupby("_k3"):
        if g["Box #"].astype(str).str.strip().nunique() > 1:
            if vd is not None:
                unflagged = vd.loc[g.index].astype(str).str.strip().isin(["", "nan", "None"])
                if unflagged.any():
                    missing_rows.append(g[unflagged])
            else:
                missing_rows.append(g)

    if missing_rows:
        import pandas as _pd
        bad = _pd.concat(missing_rows)
        fail(f"{len(bad)} rows appear in multiple boxes without '⚠ Verify Duplicate' flag")
        for _, row in bad.head(10).iterrows():
            info(f"  '{row.get('Title','?')}' #{row.get('Issue #','?')} {row.get('Year','?')} Box#{row.get('Box #','?')}")
        if len(bad) > 10:
            info(f"  ... and {len(bad)-10} more")
        return False
    ok("All cross-box duplicates are flagged with '⚠ Verify Duplicate'")
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
    return True  # year issues are warnings only, not failures


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
    section("CHECK 9 — Box # values are positive integers (or known status strings)")
    numeric = pd.to_numeric(df["Box #"], errors="coerce")
    is_allowed_status = df["Box #"].apply(
        lambda v: str(v).strip() in BOX_STATUS_ALLOWLIST
    )
    bad = df[
        ~is_allowed_status &
        (numeric.isna() | (numeric < 1) | (
            numeric != numeric.apply(lambda x: round(x) if pd.notna(x) else x)
        ))
    ]
    cgc_count = is_allowed_status.sum()
    if cgc_count:
        info(f"{cgc_count} rows have status Box # (AT CGC / AT MAGIC PRESSING) — excluded from check")
    if len(bad):
        fail(f"{len(bad)} rows have invalid Box # values (non-integer, < 1, or unrecognised status)")
        for _, row in bad.head(10).iterrows():
            info(f"  '{row.get('Title','?')}' — Box #='{row.get('Box #','?')}'")
        if len(bad) > 10:
            info(f"  ... and {len(bad)-10} more")
        return False
    ok("All Box # values are valid positive integers or known status strings")
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


def _norm_str(series):
    """Whitespace-trim + lowercase. Sensitive fields (Title/Signed?/Condition)
    have inconsistent casing and stray whitespace from manual entry/imports -
    without this, an exact-match key under-counts real clones (confirmed:
    naive match found 80 groups/82 excess rows vs. 81/83 normalized on the
    same file). Bake normalization in here rather than re-deriving it by hand
    each time - same failure category as the mixed-type Box # bug."""
    return series.astype(str).str.strip().str.lower().replace({"nan": ""})


def check_exact_clones(df):
    # Stricter than CHECK 6 (Rule 2): same physical copy entered twice, not
    # just "same book, same box" (which legitimately includes multiple
    # distinct copies differing by condition/signature). Adds Condition and
    # Signed? to the key so genuine multi-copy ownership doesn't get flagged.
    section("CHECK 11 — Exact clones (Title+Issue#+Year+Condition+Signed?+Box#, normalized)")
    physical = df[~df["Box #"].apply(lambda v: str(v).strip() in BOX_STATUS_ALLOWLIST)].copy()

    t    = _norm_str(physical["Title"])
    iss  = physical["Issue #"].astype(str).str.strip()
    yr   = physical["Year"].astype(str).str.strip()
    box  = physical["Box #"].astype(str).str.strip()
    cond = _norm_str(physical["Condition"]) if "Condition" in physical.columns else ""
    signed = _norm_str(physical["Signed?"]) if "Signed?" in physical.columns else ""
    k = t + "|" + iss + "|" + yr + "|" + cond + "|" + signed + "|" + box

    dupes = physical[k.duplicated(keep=False)]
    if len(dupes):
        groups = k[k.duplicated(keep=False)]
        n_groups = groups.nunique()
        excess = len(dupes) - n_groups  # net rows to purge, not total rows in groups
        fail(f"{n_groups} exact-clone groups / {excess} excess rows "
             f"(Title+Issue#+Year+Condition+Signed?+Box#, normalized) — "
             f"{len(dupes)} total rows across all groups")
        sample = dupes.assign(_k=groups).groupby("_k").size().reset_index(name="count")
        for _, row in sample.head(10).iterrows():
            parts = row["_k"].split("|")
            info(f"  '{parts[0]}' #{parts[1]} {parts[2]} cond='{parts[3]}' signed='{parts[4]}' Box#{parts[5]} — {row['count']}x")
        if len(sample) > 10:
            info(f"  ... and {len(sample)-10} more groups")
        return False
    ok("No exact-clone rows (Title+Issue#+Year+Condition+Signed?+Box#, normalized)")
    return True


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
    results.append(check_cross_box_duplicates(df))
    results.append(check_year_format(df))
    results.append(check_writer_fill_rate(df))
    results.append(check_box_number_range(df))
    results.append(check_issue_number_present(df))
    results.append(check_exact_clones(df))

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
