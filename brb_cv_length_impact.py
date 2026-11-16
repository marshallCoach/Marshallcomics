#!/usr/bin/env python3
"""
brb_cv_length_impact.py -- READ-ONLY report: what would Comic Vine's arc LENGTHS add?

For every arc in the newest xlsx that still has no Arc Length, look for a Comic Vine
length on any of its books (cv_arcs.csv), excluding books Comic Vine matched to the
wrong run (cv_rejects.csv) and event names. Lengths are grouped by how safe they are:

  SAFE      Comic Vine names the same arc (spelling aside)
  REVIEW    names differ, but Comic Vine's part numbers line up with Fandom's
            for every book we own in that arc (same story, different name)
  SKIP      names differ and parts don't line up - different story

Then: how many arcs gain a length, how many books, and how many become COMPLETE
(or "1-2 issues away") once the length is known.

    python3 brb_cv_length_impact.py        -> cv_length_impact.csv  (nothing written to the xlsx)
"""
import collections, csv, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
from brb_apply_arcs import newest_xlsx, norm, ni, yr, clean_arc, same_arc, INV   # noqa: E402


def num(v):
    try:
        return float(str(v).strip().lstrip("#"))
    except ValueError:
        return None


def main():
    import openpyxl
    if not os.path.exists("cv_arcs.csv"):
        sys.exit("cv_arcs.csv not found")
    bad = set()
    if os.path.exists("cv_rejects.csv"):
        for r in csv.DictReader(open("cv_rejects.csv", newline="", encoding="utf-8")):
            bad.add((norm(r["title"]), ni(r["issue"]), ni(r["volume"]) or "1"))
    cv = {}
    for r in csv.DictReader(open("cv_arcs.csv", newline="", encoding="utf-8")):
        k = (norm(r["title"]), ni(r["issue"]), ni(r["sheet_volume"]) or "1")
        if k in bad or not (r.get("Arc Length") or "").strip():
            continue
        cv[k] = {"name": clean_arc(r["Story Arc"]), "part": num(r["Arc Part"]), "len": int(float(r["Arc Length"])),
                 "fin": r.get("Finale Issue #", ""), "year": yr(r["year"])}

    src = newest_xlsx()
    ws = [w for w in openpyxl.load_workbook(src, read_only=True).worksheets if w.title.startswith(INV)][-1]
    it = ws.iter_rows(values_only=True)
    H = [str(h).strip() if h is not None else "" for h in next(it)]
    g = lambda n: H.index(n) if n in H else None
    cT, cI, cV, cY, cA, cP, cL = g("Title"), g("Issue #"), g("Volume"), g("Year"), g("Story Arc"), g("Arc Part"), g("Arc Length")
    groups, owned = collections.defaultdict(list), collections.defaultdict(set)
    for r in it:
        t = str(r[cT] or "").strip()
        if not t:
            continue
        vol = ni(r[cV]) or "1"
        owned[(t, vol)].add(num(r[cI]))
        a = str(r[cA] or "").strip()
        if a:
            groups[(t, vol, a)].append({"issue": ni(r[cI]), "part": num(r[cP]), "len": str(r[cL] or "").strip(), "year": yr(r[cY])})

    rows, st = [], collections.Counter()
    for (t, vol, a), books in groups.items():
        if any(b["len"] for b in books):
            continue                                       # already has a length
        st["arcs without length"] += 1
        hits = [(b, cv[(norm(t), b["issue"], vol)]) for b in books if (norm(t), b["issue"], vol) in cv]
        if not hits:
            continue
        b0, c0 = hits[0]
        if same_arc(a, c0["name"]):
            tier = "SAFE"
        elif all(b["part"] and c["part"] and b["part"] == c["part"] for b, c in hits) and len(hits) >= 2:
            tier = "REVIEW"
        else:
            tier = "SKIP"
        L = c0["len"]
        st[f"{tier} arcs"] += 1
        st[f"{tier} books"] += len(books)
        # completeness once the length is known (needs a part number on one owned book)
        anchor = next(((b, c) for b, c in hits if c["part"] and num(b["issue"]) is not None), None)
        status = "unknown"
        if anchor and tier != "SKIP":
            start = int(num(anchor[0]["issue"]) - (anchor[1]["part"] - 1))
            need = [i for i in range(start, start + L) if float(i) not in owned[(t, vol)]]
            status = "COMPLETE" if not need else (f"need #{', #'.join(map(str, need))}" if len(need) <= 2 else f"{len(need)} missing")
            if not need:
                st[f"{tier} -> complete"] += 1
            elif len(need) <= 2:
                st[f"{tier} -> 1-2 away"] += 1
        rows.append([tier, t, vol, a, c0["name"], L, len(books), status])

    rows.sort(key=lambda r: (["SAFE", "REVIEW", "SKIP"].index(r[0]), r[7] != "COMPLETE", r[1]))
    with open("cv_length_impact.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["tier", "title", "volume", "arc (yours)", "arc (Comic Vine)", "cv_length", "books_owned", "after"])
        w.writerows(rows)
    print(f"SOURCE: {os.path.basename(src)}")
    print(f"arcs without a length: {st['arcs without length']}")
    for tier in ("SAFE", "REVIEW", "SKIP"):
        print(f"  {tier:6} {st[f'{tier} arcs']:4} arcs  {st[f'{tier} books']:5} books"
              + (f"   -> {st[f'{tier} -> complete']} become COMPLETE, {st[f'{tier} -> 1-2 away']} become 1-2 issues away" if tier != "SKIP" else "   (different story - not used)"))
    print("wrote cv_length_impact.csv - nothing written to the xlsx")


if __name__ == "__main__":
    main()
