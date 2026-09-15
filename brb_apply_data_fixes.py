#!/usr/bin/env python3
"""brb_apply_data_fixes.py — apply the resolutions you made on the Data Fix page.

Reads a data-fixes export (the JSON the Data Fix page's Export button downloads)
and writes the concrete changes back into the canonical xlsx:

  kind "fandom"   — the Fandom URL is treated as SOURCE OF TRUTH for that title's
                    run. Its canonical volume (…/wiki/Title_Vol_N_ISS → N) is
                    applied to EVERY owned issue in the same GCD-defined series
                    window (same title + publisher + the run's year range) — so
                    all related volumes match. The URL is logged for reference.
  kind "solution" — vol:N / vol1 → set Volume (that row); trust-gcd → set Year
                    from the Publication Date (that row). Acknowledgement-only
                    picks change no data.

Matches rows by Title + Issue # + Box. Uses the local GCD subset only to define
each run's year window (never to override the Fandom volume). Dry-run default.

    python3 brb_apply_data_fixes.py
    python3 brb_apply_data_fixes.py --flags ~/Downloads/data-fixes-2026-09-13.json --apply
Then: python3 brb.py --commit "apply data-fix resolutions" --yes
"""
import argparse, csv, datetime, glob, json, os, re, sqlite3, sys
from collections import defaultdict, Counter
from brb_gcd_volume_check import parse_year_range, pub_match, tight

ROOT = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(ROOT, "gcd_local.sqlite")
VOL_RE = re.compile(r"/wiki/.+?_Vol_(\d+)(?:_|$)", re.I)  # trailing issue optional


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


def build_series_lookup():
    """title-tight-key -> list of series {yb, ye, pub}. None if no GCD db."""
    if not os.path.exists(DB):
        return None, None
    conn = sqlite3.connect(DB)
    by_key = defaultdict(list)
    for name, yb, ye, pub in conn.execute(
        "SELECT s.matched_title, s.year_began, s.year_ended, p.name "
        "FROM gcd_series s LEFT JOIN gcd_publisher p ON p.id = s.publisher_id"):
        if yb:
            by_key[tight(name)].append({"yb": yb, "ye": ye, "pub": pub})
    try:
        aliases = dict(conn.execute("SELECT alias, matched_title FROM gcd_title_alias"))
    except sqlite3.OperationalError:
        aliases = {}
    return by_key, aliases


def run_window(by_key, aliases, title, pub, year):
    """The (yb, ye) of the single GCD series whose window contains the row's
    year — i.e. the boundaries of that run. None if not uniquely resolvable."""
    if by_key is None:
        return None
    yr = parse_year_range(year)
    if not yr:
        return None
    pool = list(by_key.get(tight(title), []))
    al = aliases.get(title)
    if al:
        pool += by_key.get(tight(al), [])
    hits = [s for s in pool if pub_match(pub, s["pub"]) and s["yb"] <= yr[1] and (s["ye"] or 2100) >= yr[0]]
    if len(hits) != 1:
        return None
    return (hits[0]["yb"], hits[0]["ye"] or 2100)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--flags", help="path to a data-fixes-*.json export")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    path = args.flags or newest([".", "~/Downloads", ROOT], "data-fixes-*.json")
    if not path or not os.path.exists(path):
        sys.exit("no data-fixes export found — pass --flags <path> (export from the Data Fix page)")
    recs = json.load(open(path))
    print(f"FIXES:  {os.path.basename(path)}  ({len(recs)} resolutions)")

    import openpyxl
    src = newest_xlsx()
    wb = openpyxl.load_workbook(src)
    ws = next(w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory"))
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]

    def ci(n):
        return H.index(n) + 1 if n in H else None
    cT, cI, cB, cVol, cYear, cP, cPD = (ci("Title"), ci("Issue #"), ci("Box #"),
                                        ci("Volume"), ci("Year"), ci("Publisher"), ci("Publication Date"))

    # index rows by identity, and by tight-title for run propagation
    rowmap, by_title = {}, defaultdict(list)
    for r in range(2, ws.max_row + 1):
        t = ws.cell(r, cT).value
        if not str(t or "").strip():
            continue
        rowmap.setdefault(key(t, ws.cell(r, cI).value, ws.cell(r, cB).value), r)
        by_title[tight(t)].append(r)

    by_key, aliases = build_series_lookup()
    if by_key is None:
        print("  (no gcd_local.sqlite — Fandom links will fix only their own row, not the run)")

    pending = {}      # row -> ("Volume"|"Year", new_value)
    links, stats = [], Counter()

    def set_cell(r, field, new):
        col = cVol if field == "Volume" else cYear
        if col and str(ws.cell(r, col).value or "").strip() != str(new):
            pending[r] = (field, str(new))

    for rec in recs:
        r = rowmap.get(key(rec.get("title"), rec.get("issue"), rec.get("box")))
        if not r:
            stats["row_not_found"] += 1
            continue
        kind, val = rec.get("kind"), str(rec.get("value", ""))
        if kind == "fandom":
            links.append([rec.get("title"), rec.get("issue"), rec.get("box"), val])
            m = VOL_RE.search(val)
            if not m:
                stats["fandom_no_vol_in_url"] += 1
                continue
            V = m.group(1)
            title, pub, year = ws.cell(r, cT).value, ws.cell(r, cP).value, ws.cell(r, cYear).value
            win = run_window(by_key, aliases, str(title or ""), str(pub or ""), year)
            if win:
                lo, hi = win
                n = 0
                for rr in by_title.get(tight(str(title or "")), []):
                    ryr = parse_year_range(ws.cell(rr, cYear).value)
                    if ryr and lo <= ryr[0] and ryr[1] <= hi:
                        set_cell(rr, "Volume", V); n += 1
                stats["fandom_run_rows"] += n
                stats["fandom_runs"] += 1
            else:
                set_cell(r, "Volume", V)
                stats["fandom_single"] += 1
        elif kind == "solution":
            if val == "vol1":
                set_cell(r, "Volume", "1"); stats["volume_set"] += 1
            elif val.startswith("vol:"):
                set_cell(r, "Volume", val.split(":", 1)[1].strip()); stats["volume_set"] += 1
            elif val == "trust-gcd" and cPD:
                mm = re.match(r"(\d{4})", str(ws.cell(r, cPD).value or ""))
                if mm:
                    set_cell(r, "Year", mm.group(1)); stats["year_set"] += 1
            else:
                stats["acknowledged_no_change"] += 1

    print(f"SOURCE: {os.path.basename(src)}\n")
    print(("WOULD CHANGE " if not args.apply else "CHANGED ") + f"{len(pending)} row(s):")
    shown = 0
    for r in sorted(pending):
        field, new = pending[r]
        print(f"  row {r}  {ws.cell(r, cT).value} #{norm_issue(ws.cell(r, cI).value)}: {field} -> {new}")
        shown += 1
        if shown >= 50:
            print(f"  … and {len(pending) - 50} more"); break

    if args.apply:
        for r, (field, new) in pending.items():
            ws.cell(r, cVol if field == "Volume" else cYear, new)

    print("\nSUMMARY")
    for k2 in ("fandom_runs", "fandom_run_rows", "fandom_single", "volume_set", "year_set",
               "acknowledged_no_change", "fandom_no_vol_in_url", "row_not_found"):
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
    print(f"\nWROTE: {os.path.basename(out)}  ({len(pending)} rows changed)")
    print("Next: python3 brb.py --commit \"apply data-fix resolutions\" --yes")


if __name__ == "__main__":
    main()
