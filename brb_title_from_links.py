#!/usr/bin/env python3
"""brb_title_from_links.py — fix corrupted TITLES using the Fandom links you
already supplied.

A data-fix link encodes the real title in its URL (…/wiki/Lois_Lane_Vol_1_2 →
"Lois Lane"). When that canonical title disagrees with the sheet's title, the
sheet title is corrupted (e.g. voice-to-text "Low Slain" → "Lois Lane") and the
link already tells us the correct name. The Fandom-APPLY tool never renames —
it only fills credits/date/cover for the title you have — so these never self-heal.

This reads EVERY data-fix export you've fed the pipeline (~/Downloads/data-fixes*.json
plus the consumed copies in processed_exports/), compares each link's canonical
title to the sheet title, and where they truly differ (not just "The"/punctuation)
renames the inventory row — and scrubs the old title out of Key Issue — Why and
Seller Notes. Writes a NEW dated xlsx; never edits the source.

    python3 brb_title_from_links.py            # DRY RUN — counts + lists every rename
    python3 brb_title_from_links.py --apply     # apply, write a new workbook
Then: python3 brb.py --commit "rename corrupted titles from links" --yes
"""
import argparse, datetime, glob, json, os, re, sys, urllib.parse
import openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "attached_assets")
DOWNLOADS = os.path.expanduser("~/Downloads")
PROCESSED = os.path.join(ROOT, "processed_exports")


def _fn_key(f):
    m = re.search(r"_(\d{2})(\d{2})_(\d{2})(\d{2})", os.path.basename(f))
    if m:
        dd, mm, hh, mi = (int(x) for x in m.groups())
        return (1, mm, dd, hh, mi, os.path.getmtime(f))
    return (0, 0, 0, 0, 0, os.path.getmtime(f))


def newest_xlsx():
    cands = [f for f in glob.glob(os.path.join(ASSETS, "comics_inventory_*.xlsx"))
             if " copy" not in f and not os.path.basename(f).startswith("~$")]
    if not cands:
        sys.exit("no attached_assets/comics_inventory_*.xlsx found")
    return max(cands, key=_fn_key)


def ni(i):
    return re.sub(r"\.0$", "", str(i or "").replace("#", "").strip())


def normt(t):
    """Compare titles ignoring case, a leading 'The', and all punctuation, so
    'Amazing Spider-Man' == 'The Amazing Spider-Man' (NOT a rename) but
    'Low Slain' != 'Lois Lane' (a real rename)."""
    s = re.sub(r"^the\s+", "", str(t or "").lower())
    return re.sub(r"[^a-z0-9]+", "", s)


def canonical_from_url(u):
    """Real title named in a Fandom wiki URL, or None."""
    m = re.match(r"https?://[^/]+/wiki/(.+)", u or "")
    if not m:
        return None
    path = urllib.parse.unquote(m.group(1))
    vm = re.match(r"^(.*?)_Vol_\d+(?:_.+)?$", path)
    name = (vm.group(1) if vm else path)
    return name.replace("_", " ").strip() or None


def link_files():
    seen, out = set(), []
    for d in (DOWNLOADS, PROCESSED):
        for f in glob.glob(os.path.join(d, "*.json")):
            b = os.path.basename(f).lower()
            if "data-fix" in b and f not in seen:
                seen.add(f); out.append(f)
    return out


def collect_renames():
    """{normt(sheet_title): (sheet_title, canonical_title)} for every link whose
    URL title truly differs from its sheet title. Last link wins on conflict."""
    ren = {}
    files = link_files()
    for f in files:
        try:
            recs = json.load(open(f))
        except Exception as e:  # noqa: BLE001
            print(f"  (skip {os.path.basename(f)}: {e})"); continue
        for rec in (recs if isinstance(recs, list) else []):
            if not isinstance(rec, dict):
                continue
            url = rec.get("value") or rec.get("url") or ""
            sheet = (rec.get("title") or "").strip()
            canon = canonical_from_url(url)
            if not sheet or not canon:
                continue
            if normt(sheet) != normt(canon):
                ren[normt(sheet)] = (sheet, canon)
    return ren, files


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--no-text", action="store_true", help="don't scrub old title from Key/Notes")
    args = ap.parse_args()

    ren, files = collect_renames()
    print(f"Scanned {len(files)} link file(s): " + ", ".join(os.path.basename(f) for f in files) or "(none)")
    if not ren:
        print("\nNo title corruptions found in the supplied links. Nothing to do.")
        return

    src = newest_xlsx()
    wb = openpyxl.load_workbook(src)
    ws = next(w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory"))
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]
    def ci(n): return H.index(n) + 1 if n in H else None
    cT = ci("Title")
    cKR = ci("Key Issue — Why")
    cSN = ci("Seller Notes / Variants / Caveats")
    if not cT:
        sys.exit("no Title column found")

    # Count + apply, row by row.
    hits = {}          # normt -> [rows]
    for r in range(2, ws.max_row + 1):
        tv = ws.cell(r, cT).value
        k = normt(tv)
        if k in ren:
            hits.setdefault(k, []).append(r)

    total_rows = sum(len(v) for v in hits.values())
    print(f"\n{'APPLYING' if args.apply else 'WOULD RENAME'} — {len(hits)} corrupted title(s), {total_rows} row(s):\n")
    for k, (sheet, canon) in sorted(ren.items()):
        rows = hits.get(k, [])
        flag = "" if rows else "   (no matching inventory row)"
        print(f"  {sheet!r:32s} -> {canon!r:28s}  x{len(rows)}{flag}")
        if not args.apply:
            continue
        for r in rows:
            ws.cell(r, cT, canon)
            if not args.no_text:
                for c in (cKR, cSN):
                    if c and ws.cell(r, c).value:
                        ws.cell(r, c, re.sub(re.escape(sheet), canon, str(ws.cell(r, c).value), flags=re.I))

    if not args.apply:
        print("\nDry run — re-run with --apply to write the fixes.")
        return
    out = os.path.join(ASSETS, f"comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    print(f"\nWROTE {os.path.basename(out)}  ({total_rows} row(s) renamed)")
    print("Next: python3 brb.py --commit \"rename corrupted titles from links\" --yes")


if __name__ == "__main__":
    main()
