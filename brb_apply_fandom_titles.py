#!/usr/bin/env python3
"""brb_apply_fandom_titles.py — propose & apply Fandom-canonical title fixes.

Titles are the key covers/data hang off, so renames are review-gated through a
widget on the site:

  PROPOSE (default):
    Reads the 'fandom' resolutions in a Data Fix export, pulls each URL's
    canonical title, and where your sheet title differs writes the proposals to
        artifacts/comics-inventory/public/title_rename_proposals.json
    Commit that, then approve/reject each on the site's "Title Fixes" widget and
    Export your approvals.

  APPLY (--approved <approved.json> --apply):
    Applies ONLY the renames you approved, across every owned issue of each
    title, and re-points that book's covers.json keys so nothing orphans.
    Writes a NEW dated xlsx + covers.json.

    python3 brb_apply_fandom_titles.py --flags ~/Downloads/data-fixes-merged.json
    python3 brb.py --commit "title rename proposals" --yes          # publish for the widget
    # …approve on the site, Export…
    python3 brb_apply_fandom_titles.py --approved ~/Downloads/title-renames-approved.json --apply
    python3 brb.py --commit "Fandom title corrections" --yes
"""
import argparse, datetime, glob, json, os, re, sys, urllib.parse
from collections import defaultdict

ROOT = os.path.dirname(os.path.abspath(__file__))
COVERS = os.path.join(ROOT, "covers.json")
PUBLIC = os.path.join(ROOT, "artifacts/comics-inventory/public/covers.json")
PROPOSALS = os.path.join(ROOT, "artifacts/comics-inventory/public/title_rename_proposals.json")


def ni(v):
    s = str(v or "").strip().lstrip("#")
    try:
        f = float(s); return str(int(f)) if f == int(f) else s
    except ValueError:
        return s


def nv(v):
    try:
        return str(int(float(str(v).strip())))
    except (ValueError, TypeError):
        return "1"


def canon_from_url(u):
    m = re.match(r"https?://[^/]+/wiki/(.+)", u or "")
    if not m:
        return None
    path = urllib.parse.unquote(m.group(1))
    vm = re.search(r"^(.*?)_Vol_\d+_", path)
    return vm.group(1).replace("_", " ").strip() if vm else None


def newest_xlsx():
    m = [f for f in glob.glob(os.path.join(ROOT, "attached_assets/comics_inventory_*.xlsx"))
         if " copy" not in f and not os.path.basename(f).startswith("~$")]
    if not m:
        sys.exit("no attached_assets/comics_inventory_*.xlsx found")
    return max(m, key=os.path.getmtime)


def open_sheet():
    import openpyxl
    src = newest_xlsx()
    wb = openpyxl.load_workbook(src)
    ws = next(w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory"))
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]
    idx = {n: (H.index(n) + 1) for n in ("Title", "Issue #", "Volume", "Year") if n in H}
    return wb, ws, idx, src


def rows_by_title(ws, cT):
    m = defaultdict(list)
    for r in range(2, ws.max_row + 1):
        t = str(ws.cell(r, cT).value or "").strip()
        if t:
            m[t].append(r)
    return m


def propose(flags):
    path = flags or max(glob.glob(os.path.expanduser("~/Downloads/data-fixes*.json")) +
                        glob.glob("data-fixes*.json"), key=os.path.getmtime, default=None)
    if not path or not os.path.exists(path):
        sys.exit("no data-fixes export found — pass --flags <path>")
    recs = [r for r in json.load(open(path)) if r.get("kind") == "fandom"]

    renames, conflicts = {}, defaultdict(set)
    for r in recs:
        old = (r.get("title") or "").strip()
        canon = canon_from_url(r.get("value"))
        if not old or not canon or canon == old:
            continue
        if old in renames and renames[old] != canon:
            conflicts[old].add(canon); conflicts[old].add(renames[old]); continue
        renames[old] = canon

    _, ws, idx, src = open_sheet()
    rf = rows_by_title(ws, idx["Title"])
    props = []
    for old, new in sorted(renames.items()):
        rows = rf.get(old, [])
        if not rows:
            continue
        issues = sorted({ni(ws.cell(r, idx["Issue #"]).value) for r in rows},
                        key=lambda s: (len(s), s))
        props.append({"old": old, "new": new, "count": len(rows), "issues": issues[:12]})

    os.makedirs(os.path.dirname(PROPOSALS), exist_ok=True)
    json.dump(props, open(PROPOSALS, "w"), indent=0)
    print(f"Proposed title renames: {len(props)}   (from {os.path.basename(path)})")
    for p in props[:30]:
        print(f"  '{p['old']}'  ->  '{p['new']}'   ({p['count']} issues)")
    if len(props) > 30:
        print(f"  … and {len(props) - 30} more")
    if conflicts:
        print(f"\n⚠ {len(conflicts)} conflicting canonical(s) skipped — resolve by hand: {list(conflicts)[:5]}")
    print(f"\nWROTE: {os.path.relpath(PROPOSALS, ROOT)}")
    print("Next: python3 brb.py --commit \"title rename proposals\" --yes")
    print("Then approve on the site's Title Fixes widget, Export, and run --approved.")


def apply(approved_path):
    if not approved_path or not os.path.exists(approved_path):
        sys.exit("no approvals file — pass --approved <title-renames-approved.json>")
    data = json.load(open(approved_path))
    # accept [{old,new}] or {old:new}
    renames = {d["old"]: d["new"] for d in data} if isinstance(data, list) else dict(data)
    if not renames:
        sys.exit("no approved renames in that file")

    wb, ws, idx, src = open_sheet()
    rf = rows_by_title(ws, idx["Title"])
    cov = json.load(open(COVERS))
    retitled = recov = 0
    for old, new in renames.items():
        for r in rf.get(old, []):
            issue, vol = ni(ws.cell(r, idx["Issue #"]).value), nv(ws.cell(r, idx["Volume"]).value)
            ws.cell(r, idx["Title"], new); retitled += 1
            for suffix in (f"|||{issue}|||{vol}", f"|||#{issue}", f"|||{issue}"):
                ok, nk = old + suffix, new + suffix
                if ok in cov:
                    cov[nk] = cov.pop(ok); recov += 1

    out = os.path.join(ROOT, f"attached_assets/comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    json.dump(cov, open(COVERS, "w"))
    if os.path.exists(PUBLIC):
        json.dump(cov, open(PUBLIC, "w"))
    print(f"Approved renames applied: {len(renames)}")
    print(f"WROTE: {os.path.basename(out)}  — {retitled} rows retitled, {recov} cover keys re-pointed")
    print("Next: python3 brb.py --commit \"Fandom title corrections\" --yes")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--flags", help="data-fixes export (propose mode)")
    ap.add_argument("--approved", help="approved renames json (apply mode)")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    if args.approved:
        if not args.apply:
            sys.exit("--approved needs --apply (it writes the sheet)")
        apply(args.approved)
    else:
        propose(args.flags)


if __name__ == "__main__":
    main()
