#!/usr/bin/env python3
"""brb_year_from_pubdate.py — fix the Year column from the authoritative on-sale
date (Publication Date), clearing the Data Fix "date-conflict".

For every row whose Year disagrees with its Pub_Date year by 2–5 years, set Year
to the Pub_Date year — the on-sale date is the canonical source and a 2–5y gap
is a data-entry slip. Gaps > 5 years are likely a wrong-edition cover date
(e.g. a modern reprint that pulled the original's date), so they are NOT touched
— they go to year_conflict_review.csv for a human look. Non-destructive: writes
a new timestamped xlsx.

    python3 brb_year_from_pubdate.py            # dry run
    python3 brb_year_from_pubdate.py --apply
Then: python3 brb.py --commit "fix years from on-sale date" --yes
"""
import argparse, glob, os, re, csv, datetime, openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
CAP = 5  # auto-fix gaps of 2..CAP years; larger gaps go to review


def newest_xlsx():
    c = [f for f in glob.glob(os.path.join(ROOT, "attached_assets/comics_inventory_*.xlsx"))
         if " copy" not in f and not os.path.basename(f).startswith("~$")]
    if not c:
        raise SystemExit("no attached_assets/comics_inventory_*.xlsx found")
    return max(c, key=os.path.getmtime)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    src = newest_xlsx()
    wb = openpyxl.load_workbook(src)
    ws = next(w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory"))
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]

    def ci(n):
        return H.index(n) + 1 if n in H else None
    cT, cI, cYear, cPD = ci("Title"), ci("Issue #"), ci("Year"), ci("Publication Date")
    if not (cYear and cPD):
        raise SystemExit("missing Year or Publication Date column")

    changes, review = [], []
    for r in range(2, ws.max_row + 1):
        t = str(ws.cell(r, cT).value or "").strip()
        if not t:
            continue
        yr = str(ws.cell(r, cYear).value or "").strip()
        pd = str(ws.cell(r, cPD).value or "").strip()
        mp = re.match(r"(\d{4})", pd)
        if not (mp and re.match(r"^\d{4}$", yr)):
            continue
        pdY, Y = int(mp.group(1)), int(yr)
        gap = abs(pdY - Y)
        if gap <= 1:
            continue
        iss = str(ws.cell(r, cI).value or "").strip()
        if gap > CAP:
            review.append((r, t, iss, yr, pdY, gap))
            continue
        changes.append((r, t, iss, yr, pdY))
        if args.apply:
            ws.cell(r, cYear, str(pdY))

    print(("WOULD FIX " if not args.apply else "FIXED ") +
          f"{len(changes)} Year value(s) from on-sale date  (gaps 2–{CAP}y)")
    for r, t, i, old, new in changes[:25]:
        print(f"  row {r}  {t} #{i}: {old} -> {new}")
    if len(changes) > 25:
        print(f"  … and {len(changes) - 25} more")
    print(f"HELD FOR REVIEW (gap > {CAP}y, likely wrong-edition date): {len(review)}")

    with open(os.path.join(ROOT, "year_conflict_review.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["row", "Title", "Issue", "Year", "PubDate_Year", "gap"])
        for row in review:
            w.writerow(row)

    if not args.apply:
        print("\nDRY RUN — re-run with --apply.  Review list: year_conflict_review.csv")
        return
    if not changes:
        print("\nNothing to fix.")
        return
    ts = datetime.datetime.now().strftime("%d%m_%H%M")
    out = os.path.join(ROOT, f"attached_assets/comics_inventory_{ts}.xlsx")
    wb.save(out)
    print(f"\nWROTE {os.path.basename(out)}  ({len(changes)} rows)  · review: year_conflict_review.csv")
    print("Next: python3 brb.py --commit \"fix years from on-sale date\" --yes")


if __name__ == "__main__":
    main()
