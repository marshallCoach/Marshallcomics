#!/usr/bin/env python3
"""brb_apply_data_fixes.py — apply the resolutions you made on the Data Fix page.

Reads a data-fixes export (the JSON the Data Fix page's Export button downloads)
and writes the concrete changes back into the canonical xlsx:

  kind "fandom"   — parse the canonical volume out of a Fandom URL
                    (…/wiki/Title_Vol_N_ISS) → set Volume. The URL is also
                    logged to data_fix_links_review.csv for later enrichment.
  kind "solution" — vol:N / vol1 → set Volume; trust-gcd → set Year from the
                    Publication Date. Acknowledgement-only picks (trust-year,
                    cv, no-entry, research, accept-blank) change no data — the
                    page already hides them locally.

Matches rows by Title + Issue # + Box (the same identity the app uses). Never
guesses — a fix with no derivable value is skipped and reported. Dry-run by
default; --apply writes a NEW dated xlsx.

    python3 brb_apply_data_fixes.py
    python3 brb_apply_data_fixes.py --flags ~/Downloads/data-fixes-2026-09-13.json --apply
Then: python3 brb.py --commit "apply data-fix resolutions" --yes
"""
import argparse, csv, datetime, glob, json, os, re, sys
from collections import Counter

ROOT = os.path.dirname(os.path.abspath(__file__))
VOL_RE = re.compile(r"/wiki/.+?_Vol_(\d+)_", re.I)


def newest(dirs, pat):
    c = []
    for d in dirs:
        c += glob.glob(os.path.join(os.path.expanduser(d), pat))
    return max(c, key=os.path.getmtime) if c else None


def newest_xlsx():
    cands = [f for f in glob.glob(os.path.join(ROOT, "attached_assets/comics_inventory_*.xlsx"))
             if " copy" not in f and not os.path.basename(f).startswith("~$")]
    if not cands:
        sys.exit("no attached_assets/comics_inventory_*.xlsx found")
    return max(cands, key=os.path.getmtime)


def norm_issue(v):
    s = str(v or "").strip().lstrip("#")
    try:
        f = float(s); return str(int(f)) if f == int(f) else s
    except ValueError:
        return s


def key(title, issue, box):
    return (str(title or "").strip().lower(), norm_issue(issue), str(box or "").strip())


def vol_from_url(url):
    m = VOL_RE.search(url or "")
    return m.group(1) if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--flags", help="path to a data-fixes-*.json export")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    path = args.flags or newest([".", "~/Downloads", ROOT], "data-fixes-*.json")
    if not path or not os.path.exists(path):
        sys.exit("no data-fixes export found — pass --flags <path> (export it from the Data Fix page)")
    recs = json.load(open(path))
    print(f"FIXES:  {os.path.basename(path)}  ({len(recs)} resolutions)")

    import openpyxl
    src = newest_xlsx()
    wb = openpyxl.load_workbook(src)
    ws = next(w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory"))
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]

    def ci(n):
        return H.index(n) + 1 if n in H else None
    cT, cI, cB, cVol, cYear, cPD = (ci("Title"), ci("Issue #"), ci("Box #"),
                                    ci("Volume"), ci("Year"), ci("Publication Date"))

    # index sheet rows by identity
    rowmap = {}
    for r in range(2, ws.max_row + 1):
        rowmap.setdefault(key(ws.cell(r, cT).value, ws.cell(r, cI).value, ws.cell(r, cB).value), r)

    stats, changes, links, skipped = Counter(), [], [], []
    for rec in recs:
        k = key(rec.get("title"), rec.get("issue"), rec.get("box"))
        r = rowmap.get(k)
        if not r:
            stats["row_not_found"] += 1
            continue
        kind, val = rec.get("kind"), str(rec.get("value", ""))
        new_vol = new_year = None
        if kind == "fandom":
            links.append([rec.get("title"), rec.get("issue"), rec.get("box"), val])
            new_vol = vol_from_url(val)
            if not new_vol:
                stats["fandom_no_vol_in_url"] += 1
        elif kind == "solution":
            if val == "vol1":
                new_vol = "1"
            elif val.startswith("vol:"):
                new_vol = val.split(":", 1)[1].strip()
            elif val == "trust-gcd" and cPD:
                pd = str(ws.cell(r, cPD).value or "")
                m = re.match(r"(\d{4})", pd)
                if m:
                    new_year = m.group(1)
        if new_vol and cVol and str(ws.cell(r, cVol).value or "").strip() != new_vol:
            changes.append((r, rec.get("title"), "Volume", str(ws.cell(r, cVol).value or ""), new_vol))
            stats["volume_set"] += 1
            if args.apply:
                ws.cell(r, cVol, new_vol)
        elif new_year and cYear and str(ws.cell(r, cYear).value or "").strip() != new_year:
            changes.append((r, rec.get("title"), "Year", str(ws.cell(r, cYear).value or ""), new_year))
            stats["year_set"] += 1
            if args.apply:
                ws.cell(r, cYear, new_year)
        else:
            stats["acknowledged_no_change"] += 1
            skipped.append((rec.get("title"), rec.get("issue"), kind, val))

    print(f"SOURCE: {os.path.basename(src)}\n")
    print("WOULD CHANGE:" if not args.apply else "CHANGED:")
    for r, t, field, old, new in changes[:60]:
        print(f"  row {r}  {t}: {field} {old!r} -> {new!r}")
    if len(changes) > 60:
        print(f"  … and {len(changes) - 60} more")
    print("\nSUMMARY")
    for k2 in ("volume_set", "year_set", "acknowledged_no_change", "fandom_no_vol_in_url", "row_not_found"):
        if stats[k2]:
            print(f"  {k2:22s} {stats[k2]}")

    if links:
        csvp = os.path.join(ROOT, "data_fix_links_review.csv")
        with open(csvp, "w", newline="") as f:
            w = csv.writer(f); w.writerow(["Title", "Issue", "Box", "FandomURL"]); w.writerows(links)
        print(f"\nLOGGED {len(links)} Fandom link(s) -> {os.path.basename(csvp)}")

    if not args.apply:
        print("\nDRY RUN — nothing written. Re-run with --apply to write a new xlsx.")
        return
    out = os.path.join(ROOT, f"attached_assets/comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    print(f"\nWROTE: {os.path.basename(out)}")
    print("Next: python3 brb.py --commit \"apply data-fix resolutions\" --yes")


if __name__ == "__main__":
    main()
