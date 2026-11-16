#!/usr/bin/env python3
"""
brb_apply_arc_decisions.py -- apply your Data Fix decisions on ARC-NAME CONFLICTS
(Fandom vs Comic Vine) to a NEW dated inventory workbook. Dry run by default.

Decisions come from the Data Fix page export (data-fixes*.json, problem "arc-conflict"):
  Keep Fandom          -> no change (remembered by brb_build_resolved_flags, never re-asked)
  Use Comic Vine       -> Story Arc / Part / Length / Finale from Comic Vine,
                          Arc Confidence "Stated", Arc Source = the Comic Vine link
  pasted Fandom link   -> that page is fetched; its arc (StoryArc field or "Part N" story
                          title) replaces the old one, Arc Source = your link. Length /
                          Finale are cleared (they belonged to the old arc) unless the page
                          states "Part N of M". A page with no arc changes nothing.
Only the 7 arc columns are written; every other column is verified identical.

    python3 brb_apply_arc_decisions.py            # dry run
    python3 brb_apply_arc_decisions.py --apply
"""
import argparse, datetime, glob, json, os, re, sys, urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
from brb_apply_arcs import newest_xlsx, ni, clean_arc, NEW_COLS, INV   # noqa: E402

CONFLICTS = os.path.join(ROOT, "artifacts/comics-inventory/public/arc_conflicts.json")
WIKIS = {"marvel.fandom.com": "Marvel", "dc.fandom.com": "DC"}


def load_decisions():
    paths = set()
    for d in (os.path.expanduser("~/Downloads"), ROOT):      # unprocessed exports only (archived = done)
        paths |= set(glob.glob(os.path.join(d, "data-fixes*.json"))) | set(glob.glob(os.path.join(d, "*_data-fixes*.json")))
    dec = {}
    for p in sorted(paths, key=os.path.getmtime):           # newest decision wins
        try:
            recs = json.load(open(p))
        except Exception:  # noqa: BLE001
            continue
        for r in recs if isinstance(recs, list) else []:
            if isinstance(r, dict) and r.get("problem") == "arc-conflict":
                key = f"{str(r.get('title', '')).strip()}|||{ni(r.get('issue'))}|||{str(r.get('box', '')).strip()}"
                dec[key] = r
    return dec


def fandom_arc(url):
    """Fetch one Fandom issue page -> (arc name, part, length) or None."""
    from brb_arc_fetch import api_get, fields
    from brb_arc_extract import clean, parse_title, DISAMBIG
    u = urllib.parse.urlparse(url)
    wiki = WIKIS.get(u.netloc)
    if not wiki or "/wiki/" not in u.path:
        return None, "not a Marvel/DC Fandom page link"
    page = urllib.parse.unquote(u.path.split("/wiki/", 1)[1]).replace("_", " ")
    got = api_get(wiki, [page])
    if not got:
        return None, "page not found"
    f = fields(next(iter(got.values()))["text"])
    stated = next((clean(f[k]) for k in sorted(f) if re.match(r"(?i)(storyarc|storyline)\d*$", k) and clean(f[k])), "")
    stated = DISAMBIG.sub("", re.sub(r"(?i)[\s,:;(–—-]*\b(part|chapter)\s+\w+\)?$", "", stated)).strip()
    pt = parse_title(clean(f.get("StoryTitle1", "")))
    name = stated or (pt[0] if pt and pt[0] else "")
    if not name:
        return None, "page names no story arc"
    part = pt[1] if pt else None
    length = pt[2] if pt else None
    return (name, part, length), ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    dec = load_decisions()
    if not dec:
        print("no arc-conflict decisions in any data-fixes export - nothing to do")
        return
    conf = {c["id"]: c for c in json.load(open(CONFLICTS))} if os.path.exists(CONFLICTS) else {}

    import openpyxl
    src = newest_xlsx()
    wb = openpyxl.load_workbook(src)
    ws = [w for w in wb.worksheets if w.title.startswith(INV)][-1]
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]
    ci = lambda n: (H.index(n) + 1 if n in H else None)
    cT, cI, cB = ci("Title"), ci("Issue #"), ci("Box #") or ci("Box")
    col = {n: ci(n) for n in NEW_COLS}
    if not col["Story Arc"]:
        sys.exit("no Story Arc column yet - run brb_apply_arcs.py --apply first")
    rows = {}
    for r in range(2, ws.max_row + 1):
        t = str(ws.cell(r, cT).value or "").strip()
        if t:
            rows[f"{t}|||{ni(ws.cell(r, cI).value)}|||{str(ws.cell(r, cB).value or '').strip() if cB else ''}"] = r
    before = [[ws.cell(r, c).value for c in range(1, ws.max_column + 1)] for r in range(1, ws.max_row + 1)]

    changes, kept, skipped = [], 0, []
    for key, d in dec.items():
        r = rows.get(key)
        if not r:
            skipped.append((key, "row not found (title/issue/box changed?)")); continue
        kind, val = d.get("kind"), str(d.get("value", ""))
        if kind == "solution" and val == "keep-fandom":
            kept += 1; continue
        if kind == "solution" and val == "use-cv":
            c = conf.get(key)
            if not c:
                skipped.append((key, "Comic Vine values not in arc_conflicts.json")); continue
            cv = c["cv"]
            new = {"Story Arc": clean_arc(cv["name"]), "Arc Part": cv["part"], "Arc Length": cv["length"],
                   "Finale Issue #": cv["finale"], "Arc Confidence": "Stated", "Arc Source": cv["url"]}
        elif kind == "fandom" and val.startswith("http"):
            got, why = fandom_arc(val)
            if not got:
                skipped.append((key, f"{why}: {val}")); continue
            name, part, length = got
            new = {"Story Arc": name, "Arc Part": part or "", "Arc Length": length or "", "Finale Issue #": "",
                   "Arc Confidence": "Stated", "Arc Source": val}
        else:
            skipped.append((key, f"unknown decision {kind}:{val}")); continue
        for n, v in new.items():
            old = ws.cell(r, col[n]).value
            if str(old or "") != str(v or ""):
                changes.append((r, n, old, v))

    print(f"SOURCE: {os.path.basename(src)}")
    print(f"decisions: {len(dec)}   keep Fandom: {kept}   cells to change: {len(changes)}   skipped: {len(skipped)}")
    for r, n, old, v in changes[:40]:
        print(f"  row {r} {ws.cell(r, cT).value} #{ni(ws.cell(r, cI).value)}: {n}: {old!r} -> {v!r}")
    if len(changes) > 40:
        print(f"  ... and {len(changes) - 40} more")
    for k, why in skipped:
        print(f"  SKIP {k.replace('|||', ' / ')}: {why}")
    if not a.apply:
        print("\nDRY RUN - nothing written. Re-run with --apply.")
        return
    if not changes:
        print("nothing to write"); return
    for r, n, _, v in changes:
        ws.cell(r, col[n]).value = (v if v != "" else None)
    protected = [c for c in range(1, len(before[0]) + 1) if c not in col.values()]
    diffs = sum(1 for r in range(1, len(before) + 1) for c in protected if ws.cell(r, c).value != before[r - 1][c - 1])
    if diffs:
        sys.exit(f"ABORTED: {diffs} protected cell(s) changed - nothing written")
    print(f"verified: all {len(protected)} non-arc columns identical")
    out = os.path.join(ROOT, "attached_assets", f"comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    print(f"WROTE: {os.path.basename(out)}")


if __name__ == "__main__":
    main()
