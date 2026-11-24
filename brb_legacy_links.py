#!/usr/bin/env python3
"""
brb_legacy_links.py -- put every issue of a long-running series on its RIGHT Fandom page,
using the series' "Legacy Numbers" page (e.g. marvel.fandom.com/wiki/Avengers_Vol_1/Legacy_Numbers).

Why: a series like Avengers has 10 volumes and two numbering systems. Your rows say
"Avengers #672 v8", but Fandom files #672-690 under Vol 7, and Vol 8 starts at #691. The
legacy page lists all 811 legacy numbers with the real page each one lives on.

For every row of the title, in order:
  1. legacy issue (above the first volume's last issue) -> the page the legacy list names.
     Same issue number there = a VOLUME fix. Different number (Vol 3 #65 was printed as #480)
     = an ISSUE RENUMBER, listed for Robert to decide; never written by this script.
  2. otherwise: try Vol 1..12 for that issue and keep the volume whose page year is
     within 1 of the row's Year (closest wins; on a tie, the recorded volume, else skipped).
  3. the recorded page already right, or nothing fits -> left alone.

Output (--write): data-fixes-legacy-<title>-YYYYMMDD.json - normal Fandom links that brb_all
step 2 applies like links you paste on Data Fix (volume from the link, then date, credits,
cover from the page). Guarded by the data_fixes limit (120 volumes) like any export.
    python3 brb_legacy_links.py --title Avengers            # report
    python3 brb_legacy_links.py --title Avengers --write    # write the export
"""
import argparse, collections, datetime, html, json, os, re, sys, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
UA = "Mozilla/5.0 (BRB comics inventory)"


def ni(v):
    s = str(v if v is not None else "").strip().lstrip("#")
    try:
        f = float(s)
        return str(int(f)) if f == int(f) else s
    except ValueError:
        return s


def legacy_map(wiki_host, title):
    """{legacy issue: page name} from <Title>_Vol_1/Legacy_Numbers (rendered gallery)."""
    q = urllib.parse.urlencode({"action": "parse", "page": f"{title.replace(' ', '_')}_Vol_1/Legacy_Numbers",
                                "prop": "text", "format": "json"})
    req = urllib.request.Request(f"https://{wiki_host}/api.php?{q}", headers={"User-Agent": UA})
    js = json.loads(urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace"))
    return parse_legacy(js.get("parse", {}).get("text", {}).get("*", ""), title)


def parse_legacy(page, title):
    out = {}
    for it in page.split('class="wikia-gallery-item"')[1:]:
        cap = re.search(r'lightbox-caption[^>]*>(.*?)</div>', it, re.S)
        if not cap:
            continue
        n = re.search(r'</span>\s*#([\d.]+)', cap.group(1))
        pg = re.search(r'href="/wiki/([^"]+)"', cap.group(1))
        if n:
            out[n.group(1)] = html.unescape(urllib.parse.unquote(pg.group(1))).replace("_", " ") if pg \
                else f"{title} Vol 1 {n.group(1)}"
    return out


def plan(rows, title, L, year_of):
    """rows: [(row, issue, vol, year, box)] -> [(row, kind, target_page, why)]. year_of(page) -> int|None."""
    first_vol = [int(ni(k)) for k, p in L.items() if ni(k).isdigit() and p == f"{title} Vol 1 {k}"]
    v1_max = max(first_vol) if first_vol else 0
    out = []
    for r, i, v, y, box in rows:
        cur = f"{title} Vol {v or '1'} {i}"
        # 1. Does this issue number exist in some volume with the row's year (within 1)? Then the
        #    printed number is a regular issue - at most the VOLUME is wrong (Nov 24: Black Panther
        #    #23 (2000) stored as Vol 1 is Vol 3 #23, not legacy #23 = Vol 3 #8).
        fits = []
        for k in range(1, 13):
            p = f"{title} Vol {k} {i}"
            py = year_of(p)
            if py and y and abs(py - y) <= 1:
                fits.append((abs(py - y), p))
        if fits:
            best = min(d for d, _ in fits)
            top = [p for d, p in fits if d == best]
            tgt = cur if cur in top else (top[0] if len(top) == 1 else None)
            if tgt and tgt != cur:
                out.append((r, "volume", tgt, f"{tgt} is dated {year_of(tgt)}; your row says {y}"))
            continue
        # 2. No volume has this number in that era: a legacy number (Avengers #480 = Vol 3 #65).
        if i.isdigit() and int(i) > v1_max and i in L:
            tgt = L[i]
            ti = tgt.rsplit(" ", 1)[-1]
            if tgt != cur:
                out.append((r, "volume" if ti == i else "renumber", tgt, f"legacy #{i} is {tgt}"))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", required=True)
    ap.add_argument("--wiki", default="marvel.fandom.com")
    ap.add_argument("--fandom", help="Fandom's name for the series when yours differs (\"The Amazing Spider-Man\" -> \"Amazing Spider-Man\")")
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    import openpyxl
    import brb_arc_fetch as F
    from brb_apply_arcs import newest_xlsx, INV
    fname = a.fandom or a.title
    L = legacy_map(a.wiki, fname)
    print(f"{a.title}: {len(L)} legacy numbers on Fandom")
    src = newest_xlsx()
    ws = [w for w in openpyxl.load_workbook(src, read_only=True).worksheets if w.title.startswith(INV)][-1]
    it = ws.iter_rows(values_only=True)
    H = [str(h).strip() if h is not None else "" for h in next(it)]
    g = lambda n: H.index(n) if n in H else None
    cT, cI, cV, cY, cB = g("Title"), g("Issue #"), g("Volume"), g("Year"), g("Box #") if g("Box #") is not None else g("Box")
    rows = []
    for r in it:
        if str(r[cT] or "").strip() == a.title:
            y = str(r[cY] or "").strip()[:4]
            rows.append((r, ni(r[cI]), ni(r[cV]) if cV is not None else "", int(y) if y.isdigit() else None, str(r[cB] or "").strip()))
    wiki = "Marvel" if "marvel" in a.wiki else "DC"
    need = sorted({f"{fname} Vol {k} {i}" for _, i, _, _, _ in rows for k in range(1, 13)})
    years = {}
    for k in range(0, len(need), 50):
        got = F.api_get(wiki, need[k:k + 50])
        for p in need[k:k + 50]:
            years[p] = F.page_year(got[p]["text"]) if got.get(p) else None
    P = plan(rows, fname, L, years.get)
    kinds = collections.Counter(k for _, k, _, _ in P)
    print(f"SOURCE: {os.path.basename(src)}   {a.title} rows: {len(rows)}   volume fixes: {kinds['volume']}   "
          f"issue renumbers (need your yes): {kinds['renumber']}   left alone: {len(rows) - len(P)}")
    for r, k, tgt, why in P:
        print(f"  {'VOL ' if k == 'volume' else 'RENUMBER'} #{ni(r[cI])} v{ni(r[cV]) or '?'} {r[cY]} box {str(r[cB])[:12]} -> {tgt}   ({why})")
    if not a.write:
        print("REPORT ONLY - nothing written. Re-run with --write.")
        return
    at = datetime.datetime.now().isoformat(timespec="seconds")
    recs = [{"id": f"legacy|||{a.title}|||{ni(r[cI])}|||{r[cB]}", "title": a.title, "issue": ni(r[cI]), "box": str(r[cB] or "").strip(),
             "problem": "legacy-volume", "kind": "fandom", "at": at,
             # Pin the exact copy: a box often holds the same issue # from several eras
             # (FF #3 2013 and 2018 both in box 4). Nov 24: without these, step 2 put
             # every era's fix on the first copy.
             "year": str(r[cY] or "").strip()[:4], "vol": ni(r[cV]),
             "value": f"https://{a.wiki}/wiki/" + urllib.parse.quote(tgt.replace(" ", "_"), safe=":/,()")}
            for r, k, tgt, _ in P if k == "volume"]
    if not recs:
        print("nothing to write"); return
    out = os.path.join(ROOT, f"data-fixes-legacy-{re.sub(r'[^a-z0-9]+', '-', a.title.lower())}-{datetime.date.today():%Y%m%d}.json")
    json.dump(recs, open(out, "w"), indent=1)
    print(f"WROTE {os.path.basename(out)} ({len(recs)} links) - brb_all step 2 applies them")


if __name__ == "__main__":
    main()
