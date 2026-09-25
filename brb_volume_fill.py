#!/usr/bin/env python3
"""brb_volume_fill.py — fill a blank Volume, clearing the Data Fix "no-volume".

For every row with an empty Volume, set it from the most reliable local source:
  1. the volume its cover is keyed under in covers.json (Title|||Issue|||Vol),
     when exactly one such volume exists — the cover already proved that volume;
  2. else the single distinct Volume the rest of that title already uses
     (single-volume titles like Absolute Batman → Vol 1).
Rows where neither is unambiguous are left blank and logged to
volume_fill_review.csv. Non-destructive: writes a new timestamped xlsx.

    python3 brb_volume_fill.py            # dry run
    python3 brb_volume_fill.py --apply
Then: python3 brb.py --commit "fill blank volumes" --yes
"""
import argparse, glob, json, os, csv, datetime, openpyxl
import re
from collections import defaultdict

ROOT = os.path.dirname(os.path.abspath(__file__))


def _fn_key(f):
    # Prefer the DDMM_HHMM timestamp encoded in the filename over mtime: a
    # git checkout can refresh a stale file's mtime and make it wrongly "newest".
    m = re.search(r"_(\d{2})(\d{2})_(\d{2})(\d{2})", os.path.basename(f))
    if m:
        dd, mm, hh, mi = (int(x) for x in m.groups())
        return (1, mm, dd, hh, mi, os.path.getmtime(f))
    return (0, 0, 0, 0, 0, os.path.getmtime(f))


def newest_xlsx():
    c = [f for f in glob.glob(os.path.join(ROOT, "attached_assets/comics_inventory_*.xlsx"))
         if " copy" not in f and not os.path.basename(f).startswith("~$")]
    if not c:
        raise SystemExit("no attached_assets/comics_inventory_*.xlsx found")
    return max(c, key=_fn_key)


def ni(v):
    s = str(v or "").strip().lstrip("#")
    try:
        f = float(s); return str(int(f)) if f == int(f) else s
    except ValueError:
        return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    # cover-keyed volumes: (title, issnorm) -> set of volumes that have a cover
    cov = json.load(open(os.path.join(ROOT, "covers.json")))
    covvol = defaultdict(set)
    for k, e in cov.items():
        u = (e.get("url") if isinstance(e, dict) else e)
        if not u:
            continue
        p = k.split("|||")
        if len(p) == 3:
            covvol[(p[0], ni(p[1]))].add(p[2].strip())

    src = newest_xlsx()
    wb = openpyxl.load_workbook(src)
    ws = next(w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory"))
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]

    def ci(n):
        return H.index(n) + 1 if n in H else None
    cT, cI, cVol = ci("Title"), ci("Issue #"), ci("Volume")
    if not cVol:
        raise SystemExit("no Volume column found")

    # title -> set of non-blank volumes already in the inventory
    title_vols = defaultdict(set)
    for r in range(2, ws.max_row + 1):
        t = str(ws.cell(r, cT).value or "").strip()
        v = str(ws.cell(r, cVol).value or "").strip()
        if t and v:
            title_vols[t].add(v)

    changes, review = [], []
    for r in range(2, ws.max_row + 1):
        t = str(ws.cell(r, cT).value or "").strip()
        if not t or str(ws.cell(r, cVol).value or "").strip():
            continue
        iss = ni(ws.cell(r, cI).value)
        src_tag = None
        cv = covvol.get((t, iss), set())
        if len(cv) == 1:
            v = next(iter(cv)); src_tag = "cover"
        elif len(title_vols.get(t, set())) == 1:
            v = next(iter(title_vols[t])); src_tag = "single-vol title"
        else:
            review.append((r, t, iss, sorted(cv) or sorted(title_vols.get(t, set()))))
            continue
        changes.append((r, t, iss, v, src_tag))
        if args.apply:
            ws.cell(r, cVol, v)

    print(("WOULD FILL " if not args.apply else "FILLED ") + f"{len(changes)} blank Volume(s)")
    for r, t, i, v, tag in changes[:25]:
        print(f"  row {r}  {t} #{i}: Vol {v}  ({tag})")
    if len(changes) > 25:
        print(f"  … and {len(changes) - 25} more")
    print(f"AMBIGUOUS (left blank, logged): {len(review)}")

    with open(os.path.join(ROOT, "volume_fill_review.csv"), "w", newline="") as f:
        w = csv.writer(f); w.writerow(["row", "Title", "Issue", "candidate_volumes"])
        for r, t, i, cands in review:
            w.writerow([r, t, i, "|".join(cands)])

    if not args.apply:
        print("\nDRY RUN — re-run with --apply.  Ambiguous: volume_fill_review.csv")
        return
    if not changes:
        print("\nNothing to fill.")
        return
    ts = datetime.datetime.now().strftime("%d%m_%H%M")
    out = os.path.join(ROOT, f"attached_assets/comics_inventory_{ts}.xlsx")
    wb.save(out)
    print(f"\nWROTE {os.path.basename(out)}  ({len(changes)} rows)  · ambiguous: volume_fill_review.csv")
    print("Next: python3 brb.py --commit \"fill blank volumes\" --yes")


if __name__ == "__main__":
    main()
