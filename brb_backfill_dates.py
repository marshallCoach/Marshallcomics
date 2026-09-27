#!/usr/bin/env python3
"""brb_backfill_dates.py — harvest publication dates that a Fandom/cover fetch
already pulled but never wrote to the sheet.

When a Fandom link is submitted, the fetch stores the cover in covers.json
(durable) but the date only lands in the xlsx if a fragile regex matched and
no guard skipped the row (the #0 falsy-zero skip, the year-gate, a non-standard
infobox field). Result: thousands of books carry a correct cover AND a correct
date inside covers.json, yet still show "Missing publication date" on the Data
Fix page because the date was never copied across.

This cross-references covers.json and fills every blank Publication Date from
the date already sitting beside its cover — offline, no re-fetch.

Provenance: the date is COPIED from covers.json (the same source that supplied
the cover the user already trusts), never invented. Rows with no stored date
of at least year-month precision are left blank and listed as [NEEDS SOURCE].

    python3 brb_backfill_dates.py               # dry run (review first)
    python3 brb_backfill_dates.py --issue0-only  # limit to #0 books
    python3 brb_backfill_dates.py --apply
Then: python3 brb.py --commit "backfill publication dates from covers.json" --yes

Loads the full workbook and edits only the Publication Date column, so every
sheet and its formatting survive.
"""
import argparse, glob, os, re, json, datetime, openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "attached_assets")
COVERS = os.path.join(ROOT, "covers.json")


def _fn_key(f):
    m = re.search(r"_(\d{2})(\d{2})_(\d{2})(\d{2})", os.path.basename(f))
    if m:
        dd, mo, hh, mi = (int(x) for x in m.groups())
        return (1, mo, dd, hh, mi, os.path.getmtime(f))
    return (0, 0, 0, 0, 0, os.path.getmtime(f))


def newest_xlsx():
    c = [f for f in glob.glob(os.path.join(ASSETS, "comics_inventory_*.xlsx"))
         if not os.path.basename(f).startswith("~$")]
    if not c:
        raise SystemExit("no attached_assets/comics_inventory_*.xlsx found")
    return max(c, key=_fn_key)


def norm_issue(v):
    # Coalesce only None, never 0 — an int 0 issue (#0) must stay "0", not "".
    s = ("" if v is None else str(v)).strip().lstrip("#")
    try:
        f = float(s); return str(int(f)) if f == int(f) else s
    except ValueError:
        return s


def cover_date(cov, title, issue, vol):
    """Best publication date covers.json holds for this Title/Issue/Vol.
    Requires >= year-month (len >= 7) so a bare year is never written."""
    for k in (f"{title}|||{issue}|||{vol}", f"{title}|||{issue}"):
        e = cov.get(k)
        if isinstance(e, dict):
            d = str(e.get("date", "")).strip()
            if len(d) >= 7:
                return d
    return ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--issue0-only", action="store_true",
                    help="limit to issue #0 books")
    args = ap.parse_args()

    cov = json.load(open(COVERS))
    src = newest_xlsx()
    print(f"source:  {os.path.basename(src)}")
    print(f"covers:  {os.path.basename(COVERS)}")
    print(f"scope:   {'issue #0 only' if args.issue0_only else 'all issues'}\n")
    wb = openpyxl.load_workbook(src)
    ws = next(w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory"))
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]

    def ci(n):
        return H.index(n) + 1 if n in H else None
    cT, cI, cV, cY = ci("Title"), ci("Issue #"), ci("Volume"), ci("Year")
    cPD = ci("Publication Date")
    if cPD is None:
        cPD = ws.max_column + 1
        ws.cell(1, cPD, "Publication Date")
    if not (cT and cI):
        raise SystemExit("missing Title / Issue # column")

    filled, needs_source, year_conflict = [], 0, []
    for r in range(2, ws.max_row + 1):
        title = str(ws.cell(r, cT).value or "").strip()
        if not title:
            continue
        issue = norm_issue(ws.cell(r, cI).value)
        if args.issue0_only and issue != "0":
            continue
        if str(ws.cell(r, cPD).value or "").strip():
            continue  # already dated
        vol = str(ws.cell(r, cV).value or "").strip() if cV else ""
        d = cover_date(cov, title, issue, vol)
        if not d:
            needs_source += 1
            continue
        # Year-gate: covers.json dates are mixed-provenance and some are wrong
        # (e.g. 52 #1 stored as 2007 when it shipped 2006). Only trust a date
        # whose year agrees with the row's Year (±1); flag the rest for a human.
        yr = re.match(r"(\d{4})", str(ws.cell(r, cY).value or "").strip()) if cY else None
        yd = re.match(r"(\d{4})", d)
        if yr and yd and abs(int(yr.group(1)) - int(yd.group(1))) > 1:
            year_conflict.append((title, issue, vol, yr.group(1), d))
            continue
        filled.append((title, issue, vol, d))
        if args.apply:
            ws.cell(r, cPD, d)

    print(f"{'RESOLVED' if args.apply else 'WOULD RESOLVE'} {len(filled):,} book(s) "
          f"— date copied from covers.json.")
    for t, i, v, d in sorted(filled)[:40]:
        print(f"   {t[:38]:40} #{i:4} Vol {v:3} -> {d}")
    if len(filled) > 40:
        print(f"   … and {len(filled) - 40:,} more")
    print(f"\n[YEAR CONFLICT — not written] {len(year_conflict):,} book(s): covers.json "
          f"date disagrees with the row Year by >1yr. Review manually:")
    for t, i, v, yr, d in year_conflict[:20]:
        print(f"   {t[:34]:36} #{i:4} Vol {v:3}  Year {yr} vs covers {d}")
    if len(year_conflict) > 20:
        print(f"   … and {len(year_conflict) - 20:,} more")
    print(f"\n[NEEDS SOURCE] {needs_source:,} blank-date book(s) have no stored date "
          f"— still need a Fandom link + a Mac fandom-fill run.")

    if not args.apply:
        print("\nDRY RUN — review, then re-run with --apply.")
        return
    ts = datetime.datetime.now().strftime("%d%m_%H%M")
    out = os.path.join(ASSETS, f"comics_inventory_{ts}.xlsx")
    wb.save(out)
    print(f"\nWROTE {os.path.basename(out)}  (all sheets preserved)")
    print('Next: python3 brb.py --commit "backfill publication dates from covers.json" --yes')


if __name__ == "__main__":
    main()
