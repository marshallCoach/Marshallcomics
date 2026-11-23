#!/usr/bin/env python3
"""
brb_reclaim_restore.py -- put back the books earlier regenerations silently dropped.

reclaim_restore_rows.json holds each dropped book's FULL last-known row (credits, value,
condition, notes...), taken from the data3 snapshot just before the commit that lost it
(775 "Tier 1" books: title + issue in NO volume of today's data; Robert confirmed Nov 19
he still owns them). Nothing is trusted blindly - on the Mac, against the real workbook:

  * already back?   title + issue in the inventory in ANY volume, or on ANY other tab
                    (catalogs, Duplicates, Sold...) -> skipped and listed, never doubled
  * no issue #      -> skipped and listed (can't be checked or deduped safely)
  * Year range      '2021–2022' -> 2021 (step 7 later corrects it from the on-sale date)
  * Box             the old box is kept only if it still exists today AND stays within its
                    capacity; otherwise 'UNKNOWN — needs physical reassignment'.
                    --keep-boxes keeps every old box number regardless.
  * several copies  of one book in the restore set get the '⚠ Verify Duplicate' flag
  * '#'             new entry numbers after the current highest
  * Data Integrity Log: removal entries are printed first, and one entry is appended on apply

Report-only by default; writes reclaim_restore_report.csv (every book, what happens to it).
    python3 brb_reclaim_restore.py
    BRB_FORCE=1 python3 brb_reclaim_restore.py --apply      (guard: 50 rows without FORCE)
A second run adds 0 rows (everything is found already back).
"""
import argparse, collections, csv, datetime, difflib, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
UNKNOWN = "UNKNOWN — needs physical reassignment"
LOG_TAB = "📝 Data Integrity Log"
CAP_DEFAULT, CAP = 300, {15: 210, 23: 170, 40: 80, 44: 200, 72: 130, 85: 190}   # = brb_validate.py


def nt(t):
    t = str(t or "").lower().replace("&", " and ")
    t = re.sub(r"\(.*?\)", " ", t)
    t = re.sub(r"^the\s+", "", t)
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def ni(i):
    s = re.sub(r"\[.*?\]|\(.*?\)", " ", str(i if i is not None else "")).lower()
    if "#" in s:
        s = s.split("#")[-1]
    s = re.sub(r"\bof\s+\d+", "", s)
    m = re.search(r"\d+(?:\.\d+)?", s)
    return (re.sub(r"\.0$", "", m.group(0)).lstrip("0") or "0") if m else re.sub(r"[^a-z0-9]+", " ", s).strip()


def year4(y):
    m = re.search(r"(19|20)\d{2}", str(y or ""))
    return int(m.group(0)) if m else y


def same_title(a, b):
    return a == b or difflib.SequenceMatcher(None, a, b).ratio() >= 0.85


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--keep-boxes", action="store_true", help="keep every old box number, even retired/over-full boxes")
    ap.add_argument("--rows", default=os.path.join(ROOT, "reclaim_restore_rows.json"))
    a = ap.parse_args()
    recs = json.load(open(a.rows))
    import openpyxl
    from brb_apply_arcs import newest_xlsx, INV
    src = newest_xlsx()
    wb = openpyxl.load_workbook(src)
    ws = [w for w in wb.worksheets if w.title.startswith(INV)][-1]
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]
    ci = {h: i for i, h in enumerate(H)}
    cT, cI, cB = ci["Title"], ci["Issue #"], ci.get("Box #", ci.get("Box"))

    # what exists today: inventory (any volume) + every other tab with Title / Issue columns
    have = collections.defaultdict(list)                   # issue -> [(title, where)]
    box_n = collections.Counter()
    max_entry, box_is_int = 0, None
    for r in ws.iter_rows(min_row=2, values_only=True):
        if box_is_int is None and str(r[cB] or "").strip().isdigit():
            box_is_int = not isinstance(r[cB], str)          # write boxes the way the sheet stores them
        if r[cT]:
            have[ni(r[cI])].append((nt(r[cT]), "inventory"))
            box_n[str(r[cB] or "").strip()] += 1
            if "#" in ci and str(r[ci["#"]] or "").strip().isdigit():
                max_entry = max(max_entry, int(str(r[ci["#"]]).strip()))
    for w in wb.worksheets:
        if w is ws or w.title == LOG_TAB:
            continue
        for hr in range(1, min(6, w.max_row) + 1):
            hdr = [str(c.value or "").strip().lower() for c in w[hr]]
            t = next((k for k, h in enumerate(hdr) if h == "title"), None)
            i = next((k for k, h in enumerate(hdr) if h.startswith("issue")), None)
            if t is not None and i is not None:
                for r in w.iter_rows(min_row=hr + 1, values_only=True):
                    if len(r) > max(t, i) and r[t]:
                        have[ni(r[i])].append((nt(r[t]), w.title))
                break

    if LOG_TAB in wb.sheetnames:
        hits = [r for r in wb[LOG_TAB].iter_rows(min_row=1, values_only=True)
                if re.search(r"remov|delet|purg|moved|drop|dedup", " ".join(str(x or "") for x in r), re.I)
                and not str(r[1] if len(r) > 1 else "").startswith("Reclaim")]     # our own restore entry isn't a removal
        print(f"DATA INTEGRITY LOG: {len(hits)} removal/move entr{'y' if len(hits) == 1 else 'ies'} on file (read these - a deliberate removal is not data loss):")
        for r in hits[-12:]:
            print("   · " + " | ".join(str(x) for x in r if x not in (None, ""))[:160])

    plan, report, st = [], [], collections.Counter()
    for rec in recs:
        row = dict(rec["row"])
        t, i = nt(row.get("Title")), ni(row.get("Issue #"))
        old_box = str(row.get("Box #", "")).strip()
        if not str(row.get("Issue #", "")).strip():
            st["skipped: no issue #"] += 1
            report.append([row.get("Title"), "", row.get("Volume", ""), row.get("Year", ""), old_box, "", "SKIP - no issue number"]); continue
        where = sorted({w for x, w in have.get(i, []) if same_title(t, x)})
        if where:
            st["skipped: already in your data"] += 1
            report.append([row.get("Title"), row.get("Issue #"), row.get("Volume", ""), row.get("Year", ""), old_box, "",
                           "SKIP - already on: " + ", ".join(where)]); continue
        row["Year"] = year4(row.get("Year"))
        # Nov 23: old app snapshots stored issues as "#4"; written raw, the app showed "##4"
        row["Issue #"] = re.sub(r"^#+\s*", "", str(row.get("Issue #", "")).strip())
        plan.append((rec, row, old_box))

    # boxes: keep the old box only if it exists today and stays within capacity
    want = collections.Counter(b for _, _, b in plan)
    for rec, row, old in plan:
        cap = CAP.get(int(old), CAP_DEFAULT) if old.isdigit() else None
        exists = box_n.get(old, 0) > 0 or old == UNKNOWN or re.fullmatch(r"CC\d+", old)
        fits = cap is None or box_n.get(old, 0) + want[old] <= cap
        if a.keep_boxes or (exists and fits):
            row["Box #"] = int(old) if old.isdigit() and box_is_int is not False else old
            why = "old box"
        else:
            row["Box #"] = UNKNOWN
            why = "box retired" if not exists else f"box {old} would hold {box_n.get(old, 0) + want[old]} (cap {cap})"
        st[f"box: {why if why == 'old box' or why == 'box retired' else 'over capacity'}"] += 1
        rec["_why"] = why
    copies = collections.Counter((nt(r.get("Title")), ni(r.get("Issue #")), str(r.get("Volume") or "1")) for _, r, _ in plan)
    for rec, row, old in plan:
        if copies[(nt(row.get("Title")), ni(row.get("Issue #")), str(row.get("Volume") or "1"))] > 1 and "⚠ Verify Duplicate" in ci:
            row["⚠ Verify Duplicate"] = "Reclaimed copy - verify"
            st["flagged ⚠ Verify Duplicate (several copies)"] += 1
        report.append([row.get("Title"), row.get("Issue #"), row.get("Volume", ""), row["Year"], old, row["Box #"],
                       f"RESTORE ({rec['_why']}) - dropped {rec.get('dropped')} by {rec.get('commit')}"])

    print(f"\nSOURCE: {os.path.basename(src)}   books in list: {len(recs)}   to restore: {len(plan)}")
    for k, v in sorted(st.items()):
        print(f"   {k}: {v}")
    print("   to restore by box: " + ", ".join(f"{b} {n}" for b, n in collections.Counter(str(r['Box #']) for _, r, _ in plan).most_common(12)))
    rp = os.path.join(ROOT, "reclaim_restore_report.csv")
    with open(rp, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Title", "Issue #", "Volume", "Year", "Old box", "Restored to", "What happens"])
        w.writerows(report)
    print(f"   every book listed in {os.path.basename(rp)}")
    if not a.apply:
        print("REPORT ONLY - nothing written. Re-run with --apply.")
        return
    if not plan:
        print("nothing to restore"); return
    from brb_guard import check
    check("reclaim_restore", {"rows added": len(plan)})
    _mr = ws.max_row
    for k, (rec, row, _) in enumerate(plan, 1):
        if "#" in ci:
            row["#"] = max_entry + k
        ws.append([row.get(h, None) for h in H])
    if ws.max_row != _mr + len(plan):
        sys.exit("ABORTED: row count check failed - nothing written")
    stamp = datetime.datetime.now().strftime("%d%m_%H%M")
    if LOG_TAB in wb.sheetnames:
        wb[LOG_TAB].append([stamp, "Reclaim: dropped rows restored",
                            f"{len(plan)} books restored from their last-known rows (reclaim_restore_rows.json). They were "
                            f"dropped by earlier data regenerations, not by decision; Robert confirmed ownership Nov 19 2026. "
                            f"{st['box: box retired'] + st['box: over capacity']} placed in UNKNOWN for physical reassignment."])
    out = os.path.join(ROOT, "attached_assets", f"comics_inventory_{stamp}.xlsx")
    wb.save(out)
    print(f"WROTE: {os.path.basename(out)}  (+{len(plan)} rows, {_mr - 1} -> {ws.max_row - 1})")


if __name__ == "__main__":
    main()
