#!/usr/bin/env python3
"""brb_flag_dups.py — queue unflagged duplicate rows for review.

Mirrors the validator's CHECK 6 (same-box, Rule 2) and CHECK 6b (cross-box,
Rule 3) exactly, then stamps the '⚠ Verify Duplicate' column with 'REVIEW' on
any row in a duplicate group that is NOT already flagged. CC boxes and status
boxes are excluded (a CC copy is an intentional cover pull, never a dup).

This only ADDS the review marker to currently-blank flags — it never changes a
row you have already reviewed/accepted. Run on the Mac where the live xlsx is;
dry-run by default.

    python3 brb_flag_dups.py            # show what would be flagged
    python3 brb_flag_dups.py --apply    # stamp 'REVIEW' -> new dated xlsx
    python3 brb.py --commit flag-dups-for-review --yes   (or let brb_all deploy)
"""
import argparse, glob, os, re, datetime, openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "attached_assets")
INV = "✅ Clean Inventory"
REVIEW_MARK = "REVIEW"

BOX_STATUS_ALLOWLIST = {
    "AT CGC", "AT MAGIC PRESSING → CGC", "AT CGC — Roy Thomas SS",
    "AT CGC — Terrificon 2026", "UNKNOWN — needs physical reassignment",
}


def excluded(box):
    s = str(box).strip()
    return s in BOX_STATUS_ALLOWLIST or bool(re.fullmatch(r"CC\d+", s))


def blank(v):
    return v is None or str(v).strip() in ("", "nan", "None")


def norm(v):
    return re.sub(r"\.0$", "", str(v if v is not None else "").strip())


def _fn_key(f):
    m = re.search(r"_(\d{2})(\d{2})_(\d{2})(\d{2})", os.path.basename(f))
    if m:
        dd, mm, hh, mi = (int(x) for x in m.groups())
        return (1, mm, dd, hh, mi, os.path.getmtime(f))
    return (0, 0, 0, 0, 0, os.path.getmtime(f))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    m = [f for f in glob.glob(os.path.join(ASSETS, "comics_inventory_*.xlsx"))
         if " copy" not in f and not os.path.basename(f).startswith("~$")]
    if not m:
        raise SystemExit("no attached_assets/comics_inventory_*.xlsx found")
    src = max(m, key=_fn_key)
    wb = openpyxl.load_workbook(src)
    ws = [w for w in wb.worksheets if w.title.startswith(INV)][-1]
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]

    def ci(n):
        return H.index(n) + 1 if n in H else None
    cT, cI, cY, cB, cV = (ci(x) for x in ("Title", "Issue #", "Year", "Box #", "⚠ Verify Duplicate"))
    if not cV:
        raise SystemExit("no '⚠ Verify Duplicate' column in the sheet")

    # Collect physical (non-excluded) rows with their key = title|issue|year.
    rows = []
    for r in range(2, ws.max_row + 1):
        box = ws.cell(r, cB).value
        if excluded(box):
            continue
        key = f'{str(ws.cell(r, cT).value or "").strip().lower()}|{norm(ws.cell(r, cI).value)}|{norm(ws.cell(r, cY).value)}'
        rows.append((r, key, norm(box), ws.cell(r, cV).value))

    from collections import defaultdict
    by_key = defaultdict(list)
    for r, key, box, vd in rows:
        by_key[key].append((r, box, vd))

    to_flag = []  # (row, title_issue_label, kind)
    for key, group in by_key.items():
        boxes = [b for _, b, _ in group]
        counts = defaultdict(int)
        for _, b, _ in group:
            counts[b] += 1
        cross = len(set(boxes)) > 1
        for r, b, vd in group:
            same = counts[b] > 1
            if (cross or same) and blank(vd):
                kind = "cross-box" if cross else "same-box"
                label = f'{ws.cell(r, cT).value} #{ws.cell(r, cI).value} ({ws.cell(r, cY).value}) Box {b}'
                to_flag.append((r, label, kind))

    to_flag.sort(key=lambda x: x[0])
    for r, label, kind in to_flag:
        print(f"  [{kind}] row {r}: {label}")
        if args.apply:
            ws.cell(r, cV, REVIEW_MARK)

    nk = len({(ws.cell(r, cT).value, ws.cell(r, cI).value, ws.cell(r, cY).value) for r, _, _ in to_flag})
    print(f"\n{'FLAGGED' if args.apply else 'WOULD FLAG'} {len(to_flag)} row(s) across {nk} book(s) as '{REVIEW_MARK}'.")
    if not args.apply:
        print("Dry run — re-run with --apply.")
        return
    if not to_flag:
        print("Nothing to flag — no new workbook written.")
        return
    out = os.path.join(ASSETS, f"comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    print("SAVED:", os.path.basename(out))
    print("Next: python3 brb.py --commit flag-dups-for-review --yes   (or let brb_all deploy)")


if __name__ == "__main__":
    main()
