#!/usr/bin/env python3
"""
brb_apply_title_review.py — turn a reviewed title sheet into a merge CSV.

Reads a review xlsx and emits title_merge_<tag>.csv (variant,canonical) for the
rows you accepted, lightly cleaning the target title (trailing years, #N, Vol X,
odd dashes). Handles both review formats:
  - cv_title_guesses.xlsx : columns "Current Title","CV proposed title",
                            "Accept? (y/n)"  -> accepts rows marked y/Y
  - manual_title_review.xlsx : columns "Current Title","CORRECT TITLE (fill)"
                            -> accepts any row where the fill cell is non-empty

Then feed the CSV to brb_merge_titles.py (dry-run first, then --apply). Nothing
is changed by this script itself.

Usage:
    python3 brb_apply_title_review.py cv_title_guesses.xlsx --out title_merge_cv.csv
    python3 brb_apply_title_review.py manual_title_review.xlsx --out title_merge_manual.csv
"""
import argparse, re, csv
import openpyxl


def clean(s):
    s = str(s).replace("\xa0", " ").replace("⏤", "-").replace("—", "-").replace("…", "...").strip()
    s = re.sub(r"\bVol(?:ume)?\s+\d+(\s+\d+)?\b", "", s, flags=re.I)
    s = re.sub(r"\(\d{4}[^)]*\)", "", s)
    s = re.sub(r"#\s*\d+.*$", "", s)
    s = re.sub(r":\s*\d{4}\s*$", "", s)
    s = re.sub(r"\bVs\.\b", "vs.", s)
    s = re.sub(r"\(\s*\)", "", s)
    s = re.sub(r"\s{2,}", " ", s).strip(" -")
    return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("xlsx")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    wb = openpyxl.load_workbook(args.xlsx, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    H = list(rows[0])
    ci = {h: i for i, h in enumerate(H)}
    cur = ci.get("Current Title")
    cvcol = ci.get("CV proposed title")
    accept = ci.get("Accept? (y/n)")
    fillcol = ci.get("CORRECT TITLE (fill)")

    out = []
    for r in rows[1:]:
        if cur is None or r[cur] is None:
            continue
        current = str(r[cur]).strip()
        if cvcol is not None and accept is not None:            # CV format
            if str(r[accept]).strip().lower() != "y":
                continue
            target = clean(r[cvcol])
        elif fillcol is not None:                                # manual format
            if r[fillcol] in (None, ""):
                continue
            target = clean(r[fillcol])
        else:
            raise SystemExit("Unrecognized review format (need Accept or CORRECT TITLE column)")
        if target and target.lower() != current.lower():
            out.append((current, target))

    with open(args.out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["variant", "canonical"])
        w.writerows(out)
    print(f"accepted renames: {len(out)}  ->  {args.out}")
    for a, b in out[:12]:
        print(f"   {a[:38]:<39} -> {b!r}")
    if len(out) > 12:
        print(f"   ... and {len(out) - 12} more")
    print(f"\nnext:  python3 brb_merge_titles.py --map {args.out}            # dry-run")
    print(f"       python3 brb_merge_titles.py --map {args.out} --apply --out attached_assets/_tmp.xlsx")


if __name__ == "__main__":
    main()
