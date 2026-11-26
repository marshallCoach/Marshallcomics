#!/usr/bin/env python3
"""brb_arc_review.py -- full arc re-review: blanks first, then verify what's there (Nov 26).
READ-ONLY on the xlsx. Driven by brb_arc_review_overnight.sh:

  --targets  build arc_targets_full.csv from the CURRENT inventory (every Marvel/DC book
             with a numeric issue, content-keyed) - the bulk arc_targets.csv is a stale
             one-time list that misses ~1,450 books
  --report   compare the fresh Fandom arcs (arc_extracted_full.csv) with the sheet:
               FILL      sheet Story Arc blank, Fandom names one       -> fill (blank cells only)
               SAME      both agree (case / punctuation ignored)
               DIFFERENT sheet and Fandom (Stated) disagree           -> review, never auto-changed
               NO DATA   Fandom has no arc for the book
             writes arc_review_report.csv + arc_review_fill.csv (the FILL rows, ready for
             brb_apply_arcs.py --fill-only) and prints the counts.
"""
import argparse, collections, csv, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
from brb_apply_arcs import newest_xlsx, INV  # noqa: E402

TARGETS = os.path.join(ROOT, "arc_targets_full.csv")
EXTRACT = os.path.join(ROOT, "arc_extracted_full.csv")
REPORT = os.path.join(ROOT, "arc_review_report.csv")
FILL = os.path.join(ROOT, "arc_review_fill.csv")
FIELDS = ["rid", "wiki", "series_key", "title", "sheet_volume", "issue", "year"]


def ni(v):
    s = re.sub(r"\.0$", "", str(v if v is not None else "").lstrip("#").strip())
    return re.sub(r"^0+(\d)", r"\1", s)


def wiki_of(pub):
    p = str(pub or "").lower()
    return "Marvel" if "marvel" in p else "DC" if (p == "dc" or p.startswith("dc ") or "dc comics" in p) else None


def ckey(t, v, i, y):
    return (str(t).strip().lower(), ni(v) or "1", ni(i), str(y or "").strip()[:4])


def norm(a):
    return re.sub(r"[^a-z0-9]+", "", re.sub(r"^the\s+", "", str(a or "").lower()))


def sheet_rows():
    import openpyxl
    ws = [w for w in openpyxl.load_workbook(newest_xlsx(), read_only=True).worksheets if w.title.startswith(INV)][-1]
    it = ws.iter_rows(values_only=True)
    H = [str(h).strip() if h is not None else "" for h in next(it)]
    g = lambda n: H.index(n) if n in H else None
    cT, cI, cY, cV, cP, cA, cB = g("Title"), g("Issue #"), g("Year"), g("Volume"), g("Publisher"), g("Story Arc"), g("Box #")
    for n, r in enumerate(it, 2):
        t = str(r[cT] or "").strip()
        if t:
            yield n, t, r[cI], r[cY], (r[cV] if cV is not None else ""), (r[cP] if cP is not None else ""), \
                str(r[cA] or "").strip() if cA is not None else "", str(r[cB] or "").strip() if cB is not None else ""


def build_targets():
    seen, out = set(), []
    for n, t, i, y, v, p, _a, _b in sheet_rows():
        wk, iss = wiki_of(p), ni(i)
        if not wk or not re.fullmatch(r"\d+(?:\.\d+)?", iss):
            continue
        k = ckey(t, v, iss, y)
        if k in seen:
            continue
        seen.add(k)
        out.append({"rid": n, "wiki": wk, "series_key": f"{wk}|{t}|{k[1]}", "title": t,
                    "sheet_volume": k[1], "issue": iss, "year": k[3]})
    with open(TARGETS, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(out)
    print(f"arc_targets_full.csv: {len(out)} Marvel/DC books (current inventory)")


def report():
    ext = {}
    for r in csv.DictReader(open(EXTRACT, newline="", encoding="utf-8")):
        ext[ckey(r["title"], r["sheet_volume"], r["issue"], r["year"])] = r
    cnt, rows, fill = collections.Counter(), [], {}
    for n, t, i, y, v, p, arc, box in sheet_rows():
        if not wiki_of(p):
            continue
        k = ckey(t, v, i, y)
        e = ext.get(k)
        fa = (e or {}).get("Story Arc", "").strip()
        conf = (e or {}).get("Arc Confidence", "")
        if not fa:
            st = "NO DATA"
        elif not arc:
            st = "FILL"; fill[k] = e
        elif norm(arc) == norm(fa) or norm(fa) in norm(arc) or norm(arc) in norm(fa):
            st = "SAME"
        elif conf == "Stated":
            st = "DIFFERENT"
        else:
            st = "SAME (weak Fandom match - kept yours)"
        cnt[st] += 1
        if st in ("FILL", "DIFFERENT"):
            rows.append({"row": n, "status": st, "title": t, "issue": ni(i), "year": str(y or "")[:4], "box": box,
                         "sheet_arc": arc, "fandom_arc": fa, "confidence": conf,
                         "source": (e or {}).get("Arc Source", "")})
    with open(REPORT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["row", "status", "title", "issue", "year", "box", "sheet_arc",
                                          "fandom_arc", "confidence", "source"])
        w.writeheader()
        w.writerows(rows)
    if fill:
        with open(FILL, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(next(iter(fill.values())).keys()))
            w.writeheader()
            w.writerows(fill.values())
    print("ARC REVIEW (Marvel/DC books in the sheet):")
    for k in ("FILL", "SAME", "SAME (weak Fandom match - kept yours)", "DIFFERENT", "NO DATA"):
        print(f"  {k:40} {cnt[k]:6,}")
    print(f"wrote {os.path.basename(REPORT)} ({len(rows)} rows to look at) + {os.path.basename(FILL)} ({len(fill)} books)")
    for r in [x for x in rows if x["status"] == "DIFFERENT"][:8]:
        print(f"  DIFFERENT  {r['title']} #{r['issue']} ({r['year']}): yours '{r['sheet_arc']}'  vs Fandom '{r['fandom_arc']}'")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--targets", action="store_true")
    ap.add_argument("--report", action="store_true")
    a = ap.parse_args()
    if a.targets:
        build_targets()
    if a.report:
        report()
