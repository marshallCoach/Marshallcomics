#!/usr/bin/env python3
"""brb_arc_new.py -- story arcs for books added since the bulk arc fetch (Nov 26).

The arc columns came from a one-time bulk run (arc_targets.csv -> brb_arc_fetch ->
brb_arc_extract -> brb_apply_arcs). Nothing added later - every weekly intake - was
ever a target, so new books never got an arc. This step closes that gap each run:

  1. finds Marvel/DC rows with a blank Story Arc that are NOT in arc_targets.csv
  2. appends them to arc_targets.csv (content keyed: title + volume + issue + year)
  3. runs brb_arc_fetch.py (cache-resumed: only the new pages are requested; same
     +/-1 year check, wrong data is never emitted) and brb_arc_extract.py
  4. hands ONLY the new books' rows to brb_apply_arcs.py --fill-only (blank cells only)

    python3 brb_arc_new.py            # report: what would be filled
    python3 brb_arc_new.py --apply    # write (blank Story Arc cells only)
"""
import argparse, csv, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
from brb_apply_arcs import newest_xlsx, INV  # noqa: E402

TARGETS = os.path.join(ROOT, "arc_targets.csv")          # the bulk list (git-tracked: never edited here)
NEW_TARGETS = os.path.join(ROOT, "arc_targets_new.csv")  # books added since (untracked, grows each week)
NEW_CSV = os.path.join(ROOT, "arc_new_extracted.csv")
FIELDS = ["rid", "wiki", "series_key", "title", "sheet_volume", "issue", "year"]


def ni(v):
    s = re.sub(r"\.0$", "", str(v if v is not None else "").lstrip("#").strip())
    return re.sub(r"^0+(\d)", r"\1", s)


def wiki_of(pub):
    p = str(pub or "").lower()
    return "Marvel" if "marvel" in p else "DC" if (p == "dc" or p.startswith("dc ") or "dc comics" in p) else None


def ckey(title, vol, issue, year):
    return (str(title).strip().lower(), ni(vol) or "1", ni(issue), str(year or "").strip()[:4])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    import openpyxl
    src = newest_xlsx()
    ws = [w for w in openpyxl.load_workbook(src, read_only=True).worksheets if w.title.startswith(INV)][-1]
    it = ws.iter_rows(values_only=True)
    H = [str(h).strip() if h is not None else "" for h in next(it)]
    g = lambda n: H.index(n) if n in H else None
    cT, cI, cY, cV, cP, cA = g("Title"), g("Issue #"), g("Year"), g("Volume"), g("Publisher"), g("Story Arc")
    have = set()
    old_new = list(csv.DictReader(open(NEW_TARGETS, newline="", encoding="utf-8"))) if os.path.exists(NEW_TARGETS) else []
    bulk = list(csv.DictReader(open(TARGETS, newline="", encoding="utf-8"))) if os.path.exists(TARGETS) else []
    for r in bulk + old_new:
        have.add(ckey(r["title"], r["sheet_volume"], r["issue"], r["year"]))
    new, blank = [], set()
    for n, r in enumerate(it, 2):
        t, wk, iss = str(r[cT] or "").strip(), wiki_of(r[cP] if cP is not None else ""), ni(r[cI])
        if not t or not wk or not re.fullmatch(r"\d+(?:\.\d+)?", iss):
            continue
        if cA is not None and str(r[cA] or "").strip():
            continue                                   # already has an arc
        k = ckey(t, r[cV] if cV is not None else "", iss, r[cY])
        blank.add(k)
        if k in have:
            continue                                   # was a bulk target (fetched or a known miss)
        have.add(k)
        new.append({"rid": n, "wiki": wk, "series_key": f"{wk}|{t}|{k[1]}", "title": t,
                    "sheet_volume": k[1], "issue": iss, "year": k[3]})
    print(f"SOURCE: {os.path.basename(src)}   new Marvel/DC books without an arc: {len(new)}"
          f"   (+ earlier new books still waiting: {sum(1 for r in old_new if ckey(r['title'], r['sheet_volume'], r['issue'], r['year']) in blank)})")
    for x in new[:12]:
        print(f"  {x['title']} #{x['issue']} ({x['year']})")
    # every post-bulk book still without an arc is re-asked each run (Fandom pages for new
    # issues appear weeks later); the fetch cache makes repeats free.
    pending = new + [r for r in old_new if ckey(r["title"], r["sheet_volume"], r["issue"], r["year"]) in blank]
    if not pending:
        print("nothing new to fetch.")
        return
    with open(NEW_TARGETS, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows({k: x[k] for k in FIELDS} for x in pending)
    new = pending
    py = sys.executable
    if subprocess.call([py, os.path.join(ROOT, "brb_arc_fetch.py"), "--no-round2", "--targets", NEW_TARGETS], cwd=ROOT):
        sys.exit("brb_arc_fetch failed")
    if subprocess.call([py, os.path.join(ROOT, "brb_arc_extract.py")], cwd=ROOT):
        sys.exit("brb_arc_extract failed")
    want = {ckey(x["title"], x["sheet_volume"], x["issue"], x["year"]) for x in new}
    src_csv = os.path.join(ROOT, "arc_extracted.csv")
    got = [r for r in csv.DictReader(open(src_csv, newline="", encoding="utf-8"))
           if ckey(r["title"], r["sheet_volume"], r["issue"], r["year"]) in want] if os.path.exists(src_csv) else []
    if not got:
        print(f"arcs found for 0 of {len(new)} new books (not on Fandom yet, or no arc named).")
        return
    with open(NEW_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(got[0].keys()))
        w.writeheader()
        w.writerows(got)
    print(f"arcs found for {len(got)} of {len(new)} new books -> {os.path.basename(NEW_CSV)}")
    sys.exit(subprocess.call([py, os.path.join(ROOT, "brb_apply_arcs.py"), "--csv", NEW_CSV, "--fill-only"]
                             + (["--apply"] if a.apply else []), cwd=ROOT))


if __name__ == "__main__":
    main()
