#!/usr/bin/env python3
"""brb_normalize.py — normalize Publisher spellings + fill safely-derivable
blanks in the Clean Inventory sheet, preserving every other sheet.

Publisher: collapses variant spellings of the same house to a canonical form.
Blank Publisher: filled ONLY when every other row of the same Title agrees.
Blank Year / Issue #: never invented — written to cleanup_review.csv for a human.

Loads the full workbook and edits only the Publisher column, so all 19 sheets and
their formatting survive (unlike the overnight fill, which dropped sheets).

    python3 brb_normalize.py            # dry run
    python3 brb_normalize.py --apply
Then: python3 brb.py --commit "normalize publishers + blank review" --yes
"""
import argparse, glob, os, re, csv, datetime, openpyxl
from collections import defaultdict, Counter

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "attached_assets")

CANON = {
    "Boom Studios": "BOOM! Studios", "BOOM!": "BOOM! Studios",
    "Mad Cave": "Mad Cave Studios",
    "Titan": "Titan Comics",
    "Indie": "Independent",
    "DC Comics": "DC",
    "Image/Skybound": "Skybound", "Skybound/Image": "Skybound",
    "Top Cow/Image": "Image", "Image/Netflix": "Image", "Image/WildStorm": "Image",
}


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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    src = newest_xlsx()
    print(f"source: {os.path.basename(src)}")
    wb = openpyxl.load_workbook(src)
    ws = next(w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory"))
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]

    def ci(n):
        return H.index(n) + 1 if n in H else None
    cP, cT, cI, cY = ci("Publisher"), ci("Title"), ci("Issue #"), ci("Year")
    if not cP:
        raise SystemExit("no Publisher column")

    # title -> publishers seen (for blank-publisher inference)
    title_pubs = defaultdict(Counter)
    for r in range(2, ws.max_row + 1):
        t = str(ws.cell(r, cT).value or "").strip()
        p = str(ws.cell(r, cP).value or "").strip()
        if t and p:
            title_pubs[t][p] += 1

    norm, filled, review = [], [], []
    for r in range(2, ws.max_row + 1):
        t = str(ws.cell(r, cT).value or "").strip()
        if not t:
            continue
        p = str(ws.cell(r, cP).value or "").strip()
        iss = str(ws.cell(r, cI).value or "").strip()
        yr = str(ws.cell(r, cY).value or "").strip()
        # publisher normalization
        if p in CANON and CANON[p] != p:
            norm.append((t, iss, p, CANON[p]))
            if args.apply:
                ws.cell(r, cP, CANON[p])
        elif not p:
            # fill only if the title's other rows unanimously agree
            cand = title_pubs.get(t, Counter())
            uniq = [k for k in cand if CANON.get(k, k)]
            canon_set = {CANON.get(k, k) for k in cand}
            if len(canon_set) == 1 and cand:
                val = next(iter(canon_set))
                filled.append((t, iss, val))
                if args.apply:
                    ws.cell(r, cP, val)
            else:
                review.append(("blank-publisher", t, iss, yr, str(sorted(canon_set))))
        # blanks that must not be invented
        if not iss:
            review.append(("blank-issue", t, iss, yr, p))
        if not yr:
            review.append(("blank-year", t, iss, yr, p))

    print(f"\nPUBLISHER normalized: {len(norm)}")
    for t, i, a, b in norm[:60]:
        print(f"  {a!r:22} -> {b!r:18}  ({t} #{i})")
    if len(norm) > 60:
        print(f"  … and {len(norm)-60} more")
    print(f"\nBLANK PUBLISHER filled from same-title consensus: {len(filled)}")
    for t, i, v in filled:
        print(f"  {t} #{i} -> {v}")
    print(f"\nFLAGGED for review (not touched): {len(review)}  -> cleanup_review.csv")

    with open(os.path.join(ROOT, "cleanup_review.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["kind", "Title", "Issue", "Year", "note"])
        for row in review:
            w.writerow(row)

    if not args.apply:
        print("\nDRY RUN — re-run with --apply.")
        return
    ts = datetime.datetime.now().strftime("%d%m_%H%M")
    out = os.path.join(ASSETS, f"comics_inventory_{ts}.xlsx")
    wb.save(out)
    print(f"\nWROTE {os.path.basename(out)}  (all sheets preserved)")
    print('Next: python3 brb.py --commit "normalize publishers" --yes')


if __name__ == "__main__":
    main()
