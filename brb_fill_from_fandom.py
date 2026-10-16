#!/usr/bin/env python3
"""brb_fill_from_fandom.py — ONE command.

For every comic that already has a Fandom cover but is still missing a
Writer(s) / Artist(s) / Cover Artist / Publication Date, open its Fandom page,
pull those fields, fill the blanks (safe merge — never overwrites existing
data), write a new dated workbook, then run brb.py to regenerate + deploy.

No dry run, no two-step. Reuses the exact scraper + credit merge from
brb_apply_fandom_pages, so nothing new to trust. Runs on the Mac (Fandom egress).

    python3 brb_fill_from_fandom.py
"""
import argparse, csv, datetime, json, os, subprocess, sys
import openpyxl

# Reuse the proven scraper + safe fill/union/conflict merge — single source of truth.
from brb_apply_fandom_pages import fetch_page, ni, nv, newest_xlsx, ROOT, COVERS
from brb_credits_gcd import decide

CRED_LABELS = {"writer": "Writer(s)", "artist": "Artist(s)", "cover": "Cover Artist"}


def api_base(publisher):
    """Publisher -> Fandom API. Only Marvel/DC have mapped wikis; anything else is
    reported as skipped rather than guessed."""
    p = (publisher or "").lower()
    if "marvel" in p:
        return "https://marvel.fandom.com/api.php"
    if "dc" in p and "dark" not in p:   # avoid matching "Dark Horse"
        return "https://dc.fandom.com/api.php"
    if "valiant" in p:
        return "https://valiant.fandom.com/api.php"
    return None


def is_fandom_cover(entry):
    if not isinstance(entry, dict):
        return bool(entry)
    src = (entry.get("source") or "").lower()
    url = entry.get("url") or ""
    return bool(url) and (src.startswith("fandom") or "wikia.nocookie" in url)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-deploy", action="store_true",
                    help="fill + write the xlsx but skip the brb.py run (for brb_all)")
    args = ap.parse_args()
    src = newest_xlsx()
    print(f"Source: {os.path.basename(src)}", flush=True)
    wb = openpyxl.load_workbook(src)
    ws = [w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory")][-1]
    print(f"Tab: {ws.title}", flush=True)

    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]
    ci = lambda n: (H.index(n) + 1 if n in H else None)
    cT, cI, cV, cPub = ci("Title"), ci("Issue #"), ci("Volume"), ci("Publisher")
    cPD = ci("Publication Date")
    if cPD is None:
        cPD = ws.max_column + 1
        ws.cell(1, cPD, "Publication Date")
    CRED = {role: ci(lbl) for role, lbl in CRED_LABELS.items()}

    cov = json.load(open(COVERS))

    def has_fandom(title, issue, vol):
        e = cov.get(f"{title}|||{issue}|||{vol}") or cov.get(f"{title}|||{issue}")
        return is_fandom_cover(e)

    # Target rows: have a Fandom cover AND still missing at least one fillable field.
    targets = []
    for r in range(2, ws.max_row + 1):
        T = str(ws.cell(r, cT).value or "").strip()
        I = ni(ws.cell(r, cI).value)
        if not T or not I:
            continue
        V = nv(ws.cell(r, cV).value)
        if not has_fandom(T, I, V):
            continue
        miss_date = not str(ws.cell(r, cPD).value or "").strip()
        miss_cred = any(col and not str(ws.cell(r, col).value or "").strip() for col in CRED.values())
        if miss_date or miss_cred:
            targets.append(r)

    print(f"Fandom-covered rows missing field(s): {len(targets)}\n", flush=True)
    filled = {"writer": 0, "artist": 0, "cover": 0, "date": 0}
    errors, changes = [], []

    for n, r in enumerate(targets, 1):
        T = str(ws.cell(r, cT).value or "").strip()
        I = ni(ws.cell(r, cI).value)
        V = nv(ws.cell(r, cV).value)
        if n % 10 == 1 or n == len(targets):
            print(f"  [{n}/{len(targets)}] {T} #{I} …", flush=True)
        try:
            base = api_base(ws.cell(r, cPub).value)
            if not base:
                errors.append((T, I, f"no mapped wiki for publisher '{ws.cell(r, cPub).value or ''}'"))
                continue
            res = fetch_page(base, T, V, I)
            if not res:
                errors.append((T, I, f"page not found ({T} Vol {V} {I})"))
                continue
            _fn, date_str, _py, credits = res
            if date_str and not str(ws.cell(r, cPD).value or "").strip():
                ws.cell(r, cPD, date_str)
                filled["date"] += 1
                changes.append([T, I, "date", "", date_str])
            for role, col in CRED.items():
                if not col:
                    continue
                action, newv = decide(ws.cell(r, col).value, credits.get(role, []))
                if not action:
                    continue
                old = str(ws.cell(r, col).value or "")
                ws.cell(r, col, newv)
                filled[role] += 1
                changes.append([T, I, role, old, newv])
        except Exception as e:  # one bad page never kills the run
            errors.append((T, I, f"error: {e}"))

    out = os.path.join(ROOT, f"attached_assets/comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    if changes:
        cp = os.path.join(ROOT, "fandom_fill_changes.csv")
        with open(cp, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["Title", "Issue", "Field", "Old", "New"])
            w.writerows(changes)
        print(f"\nChange log: {os.path.basename(cp)} ({len(changes)} rows)")

    print(f"\nFilled — writer {filled['writer']}  artist {filled['artist']}  "
          f"cover {filled['cover']}  date {filled['date']}")
    print(f"Unresolved: {len(errors)}")
    for t, i, why in errors[:40]:
        print(f"   MISS {t} #{i}: {why}")
    if len(errors) > 40:
        print(f"   …and {len(errors) - 40} more")
    print(f"\nWROTE: {os.path.basename(out)}")

    if args.no_deploy:
        return
    # The one-command part: regenerate + deploy, automatically.
    print("\n=== running brb.py ===", flush=True)
    rc = subprocess.call([sys.executable, os.path.join(ROOT, "brb.py"),
                          "--commit", "fill creators + dates from Fandom pages", "--yes"])
    sys.exit(rc)


if __name__ == "__main__":
    main()
