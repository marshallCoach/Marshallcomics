#!/usr/bin/env python3
"""brb_move_slabs.py — move the 19 CGC-slabbed books into box CC10 and stamp their
grade. MOVES existing rows (never adds) by matching Title + Issue #. When a title
has several copies, it picks the best slab candidate (already at CGC / in a CC or
status box / marked CGC / highest value) so a raw reading copy is left alone.

Sets Box # -> CC10 and Condition -> "CGC <grade>". For Yellow (Signature Series)
labels it also sets Signed? -> YES (without inventing a signer). Non-destructive:
writes a new dated xlsx. Prints every move + warns on no-match / ambiguous match.

    python3 brb_move_slabs.py            # dry run (shows what it would do)
    python3 brb_move_slabs.py --apply
    python3 brb.py --commit move-slabs-to-CC10 --yes
"""
import argparse, glob, os, re, datetime, openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(ROOT, "attached_assets")

# (title, issue, grade, yellow?)  — yellow = Signature Series (signed)
SLABS = [
    ("Amazing Spider-Man", "361", "9.4", True),
    ("Avengers Annual", "2", "5.5", True),
    ("Avengers", "60", "6.5", True),
    ("Avengers", "62", "6.0", True),          # slab label reads 6.0 (sheet had 6.2 — corrected)
    ("Avengers", "87", "4.0", True),          # Origin of Black Panther, Roy Thomas SS (was mislabeled #887)
    ("Transformers", "1", "5.5", False),
    ("Absolute Batman", "1", "9.8", False),
    ("New Mutants", "98", "9.4", False),
    ("Action Comics", "521", "8.5", False),
    ("Thor", "169", "8.0", False),
    ("Incredible Hulk", "393", "9.2", False),
    ("Black Panther: The Man Without Fear", "513", "9.4", True),
    ("Supergirl: Woman of Tomorrow", "1", "9.4", True),
    ("Truth: Red, White & Black", "1", "9.6", True),
    ("Savage Dragon", "1", "9.6", True),
    ("Black Lightning", "1", "7.5", True),
    ("Exiles", "3", "8.0", True),
    ("Vision", "1", "8.0", True),
    ("WildC.A.T.s", "11", "9.2", True),
]


def norm_t(t):
    s = re.sub(r"^the\s+", "", str(t).lower())   # "The Amazing Spider-Man" == "Amazing Spider-Man"
    return re.sub(r"[^a-z0-9]+", "", s)


def norm_i(i):
    return re.sub(r"\.0$", "", str(i or "").replace("#", "").strip())


def _key(f):
    m = re.search(r"_(\d{2})(\d{2})_(\d{2})(\d{2})", os.path.basename(f))
    if m:
        dd, mm, hh, mi = (int(x) for x in m.groups())
        return (1, mm, dd, hh, mi, os.path.getmtime(f))
    return (0, 0, 0, 0, 0, os.path.getmtime(f))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    cands = [f for f in glob.glob(os.path.join(A, "comics_inventory_*.xlsx"))
             if " copy" not in f and not os.path.basename(f).startswith("~$")]
    if not cands:
        raise SystemExit("no attached_assets/comics_inventory_*.xlsx found")
    src = max(cands, key=_key)
    wb = openpyxl.load_workbook(src)
    ws = [w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory")][-1]
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]

    def ci(n):
        return H.index(n) + 1 if n in H else None
    cT, cI, cB, cC, cS, cV = (ci("Title"), ci("Issue #"), ci("Box #"),
                              ci("Condition"), ci("Signed?"), ci("Value_NM"))

    # index rows by (norm title, norm issue)
    from collections import defaultdict
    idx = defaultdict(list)
    for r in range(2, ws.max_row + 1):
        t = ws.cell(r, cT).value
        if t:
            idx[(norm_t(t), norm_i(ws.cell(r, cI).value))].append(r)

    def score(r):
        box = str(ws.cell(r, cB).value or "")
        cond = str(ws.cell(r, cC).value or "")
        s = 0
        if "cgc" in cond.lower():
            s += 4                       # explicitly graded = the slab copy
        elif re.search(r"\b\d\.\d\b", cond):
            s += 1                       # a bare numeric grade
        if not re.match(r"^\s*\d+\s*$", box.replace("BOX", "")):
            s += 2                       # non-numeric box = status/CC slab home
        if cV:
            m = re.search(r"[\d.]+", str(ws.cell(r, cV).value or ""))
            if m:
                s += min(float(m.group()), 400) / 100.0
        return s

    moved = 0
    for title, issue, grade, yellow in SLABS:
        rows = idx.get((norm_t(title), norm_i(issue)), [])
        if not rows:
            print(f"  !! NO MATCH: {title} #{issue} — not in sheet, skipped")
            continue
        r = max(rows, key=score)
        if len(rows) > 1:
            print(f"  ~ {title} #{issue}: {len(rows)} copies — moving the slab candidate (row {r})")
        print(f"  row {r}  {title} #{issue}: Box {ws.cell(r, cB).value!r} -> CC10, Condition -> CGC {grade}"
              + (", Signed? -> YES" if yellow else ""))
        if args.apply:
            ws.cell(r, cB, "CC10")
            ws.cell(r, cC, f"CGC {grade}")
            if yellow:
                ws.cell(r, cS, "YES")
        moved += 1

    print(f"\n{'MOVED' if args.apply else 'WOULD MOVE'} {moved} slab(s) to CC10")
    if not args.apply:
        print("Dry run — re-run with --apply.")
        return
    out = os.path.join(A, f"comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    print("SAVED:", os.path.basename(out))
    print("Next: python3 brb.py --commit move-slabs-to-CC10 --yes")


if __name__ == "__main__":
    main()
