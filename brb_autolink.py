#!/usr/bin/env python3
"""
brb_autolink.py -- find the Fandom page for every Marvel/DC book still missing data
(Volume, Publication Date, Writer, Artist or Cover Artist) and write the links as an
automatic Data Fix export, exactly as if you had pasted each one yourself.
READ-ONLY on the xlsx. brb_all then applies them through the normal safe pipeline:
  brb_apply_data_fixes   -> Volume from the link (the page is year-verified)
  brb_apply_fandom_pages -> date / credits fill blanks only; cover added for the
                            book's (title, issue, volume) key if that key has none

Page lookup, cheapest first:
  1. series_map.json (your Series match decisions)
  2. the arc fetch cache (arc_cache.json: ~9,000 pages already fetched + year-checked)
  3. a live probe: "<Title> Vol 1..12 <issue>" (and "The ..." spelling), year within 1,
     the series' last good volume tried first. 50 pages per request.
A page is used only when exactly one volume matches the year (ambiguous -> skipped).

    python3 brb_autolink.py              # dry run: counts + sample
    python3 brb_autolink.py --write      # writes data-fixes-autolink-YYYYMMDD.json
Then:  python3 brb_all.py
"""
import argparse, collections, datetime, json, os, re, sys, urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
import brb_arc_fetch as F                                        # noqa: E402
from brb_apply_arcs import newest_xlsx, ni, yr, INV               # noqa: E402

WIKI = {"Marvel": "https://marvel.fandom.com/wiki/", "DC": "https://dc.fandom.com/wiki/"}
NEED = ["Volume", "Publication Date", "Writer(s)", "Artist(s)", "Cover Artist"]


def low(t):
    return re.sub(r"\s+", " ", str(t or "").strip().lower())


def wiki_of(pub):
    p = str(pub or "").lower()
    return "Marvel" if "marvel" in p else "DC" if (p == "dc" or p.startswith("dc ") or "dc comics" in p) else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    import openpyxl
    src = newest_xlsx()
    ws = [w for w in openpyxl.load_workbook(src, read_only=True).worksheets if w.title.startswith(INV)][-1]
    it = ws.iter_rows(values_only=True)
    H = [str(h).strip() if h is not None else "" for h in next(it)]
    g = lambda n: H.index(n) if n in H else None
    cT, cI, cY, cV, cP, cB = g("Title"), g("Issue #"), g("Year"), g("Volume"), g("Publisher"), g("Box #") or g("Box")
    need_cols = {n: g(n) for n in NEED}
    # Covers count as missing data too: no cover at all, or only a title+issue cover that a
    # different-era copy of the same number also uses (e.g. a 2024 #18 showing the 2019 #18).
    cov = json.load(open("covers.json")) if os.path.exists("covers.json") else {}
    # a placeholder / shared-image cover is a wrong cover: level 0, so the book gets a link (Nov 26)
    from brb_cover_quality import bad_cover_keys
    BAD = bad_cover_keys(cov)
    def cover_level(t, i, v):
        for k in (f"{t}|||{i}|||{v}", f"{t}|||#{i}|||{v}"):
            if cov.get(k):
                return 0 if k in BAD else 3
        for k in (f"{t}|||#{i}", f"{t}|||{i}"):
            if cov.get(k):
                return 0 if k in BAD else 2
        return 0
    rows = []
    for r in it:
        t = str(r[cT] or "").strip()
        wk = wiki_of(r[cP]) if cP is not None else None
        iss = ni(r[cI])
        if not t or not wk or not iss:
            continue
        missing = [n for n, c in need_cols.items() if c is not None and not str(r[c] or "").strip()]
        vol0 = ni(r[cV]) if cV is not None else ""
        lvl = cover_level(t, iss, vol0)
        if lvl == 0:
            missing.append("Cover")
        rows.append({"title": t, "issue": iss, "year": yr(r[cY]), "vol": vol0, "cover_lvl": lvl,
                     "box": str(r[cB] or "").strip() if cB is not None else "", "wiki": wk, "missing": missing})
    # wrong-era cover: same title + issue owned from eras > 2 years apart, and this copy only
    # has the shared title+issue cover (no volume-specific one)
    eras = collections.defaultdict(set)
    for r in rows:
        if r["year"]:
            eras[(r["title"], r["issue"])].add(r["year"])
    for r in rows:
        ys = eras[(r["title"], r["issue"])]
        if r["cover_lvl"] == 2 and ys and max(ys) - min(ys) > 2:
            r["missing"].append("Cover (shared with another era)")
    rows = [r for r in rows if r["missing"]]
    if a.limit:
        rows = rows[: a.limit]
    print(f"SOURCE: {os.path.basename(src)}   Marvel/DC rows missing data: {len(rows)}")
    st = collections.Counter(m for r in rows for m in r["missing"])
    print("  missing: " + ", ".join(f"{k} {v}" for k, v in st.most_common()))

    # 1. series map, 2. arc cache index: (wiki?, low(title), issue) -> [(page, year)]
    smap = json.load(open("series_map.json")) if os.path.exists("series_map.json") else {}
    cache = F.load_cache()
    idx = collections.defaultdict(list)
    recs_c = [(p, r) for p, r in cache.get("issues", {}).items() if r]
    recs_c += [(r["page"], r) for r in cache.get("probe", {}).values() if r and r.get("page")]   # round-2 finds
    for page, rec in recs_c:
        m = re.match(r"^(.*) Vol (\d+) (\S+)$", rec.get("page") or page)
        if m:
            idx[(low(m.group(1)), ni(m.group(3)))].append((rec.get("page") or page, rec.get("year")))
    found, how = {}, collections.Counter()
    probe = []
    for r in rows:
        k = id(r)
        m = smap.get(f"{r['title']}|||{r['vol'] or '1'}")
        from brb_apply_series_map import is_collection
        if m and m.get("fandom") and not (is_collection(m["fandom"]) and not m.get("confirmed")):
            found[k] = f"{m['fandom']} {r['issue']}"; how["series map"] += 1; continue
        hits = []
        for t in {low(r["title"]), low(re.sub(r"^the\s+", "", r["title"], flags=re.I)), low("The " + r["title"])}:
            hits += [p for p, y in idx.get((t, r["issue"]), []) if y and r["year"] and abs(y - r["year"]) <= F.YEAR_TOL]
        hits = sorted(set(hits))
        if len(hits) == 1:
            found[k] = hits[0]; how["arc cache"] += 1
        elif len(hits) > 1:
            how["ambiguous (cache) - skipped"] += 1
        else:
            probe.append(r)

    # 3. live probe for the rest (new intakes, books outside the arc fetch)
    memo = {}
    print(f"probing {len(probe)} books on Fandom (about {len(probe)} requests)...", flush=True)
    try:
        for n, r in enumerate(probe, 1):
            ts = F.variants(r["title"])
            vols = list(range(1, F.MAX_VOL + 1))
            mk = (r["wiki"], low(r["title"]))
            if mk in memo:
                vols = [memo[mk]] + [v for v in vols if v != memo[mk]]
            cands = [f"{t} Vol {v} {r['issue']}" for v in vols for t in ts][:50]
            got = F.api_get(r["wiki"], cands)
            ok = [c for c in cands if c in got and F.page_year(got[c]["text"]) and r["year"]
                  and abs(F.page_year(got[c]["text"]) - r["year"]) <= F.YEAR_TOL]
            pages = sorted({got[c]["page"] for c in ok})
            if len(pages) == 1:
                found[id(r)] = pages[0]; how["live probe"] += 1
                vm = re.search(r" Vol (\d+) ", pages[0])
                if vm:
                    memo[mk] = int(vm.group(1))
            elif len(pages) > 1:
                how["ambiguous (probe) - skipped"] += 1
            else:
                how["not found on Fandom"] += 1
            if n % 25 == 0:
                print(f"  {n}/{len(probe)}  found so far {len(found)}", flush=True)
    except F.Outage as e:
        print(f"OUTAGE: {e} - writing what was found so far")

    recs, vol_fix = [], 0
    now = datetime.datetime.now().isoformat(timespec="seconds")
    for r in rows:
        p = found.get(id(r))
        if not p:
            continue
        url = WIKI[r["wiki"]] + urllib.parse.quote(p.replace(" ", "_"), safe=":/'!(),&")
        vm = re.search(r" Vol (\d+) ", p)
        if vm and r["vol"] and vm.group(1) != r["vol"]:
            vol_fix += 1
        recs.append({"id": f"{r['title']}|||{r['issue']}|||{r['box']}", "title": r["title"], "issue": r["issue"],
                     "box": r["box"], "problem": "autolink", "kind": "fandom", "value": url, "at": now,
                     # pin the copy: a box can hold this issue # from several eras (Nov 24)
                     "year": str(r["year"] or ""), "vol": r["vol"]})
    print("\nRESULT  " + "   ".join(f"{k}: {v}" for k, v in how.items()))
    print(f"links: {len(recs)} of {len(rows)} books   (Volume will change on {vol_fix} - the page's year proves the run)")
    for x in recs[:10]:
        print(f"  {x['title']} #{x['issue']} -> {x['value']}")
    if not a.write:
        print("\nDRY RUN - nothing written. Re-run with --write, then: python3 brb_all.py")
        return
    out = os.path.join(ROOT, f"data-fixes-autolink-{datetime.date.today():%Y%m%d}.json")
    json.dump(recs, open(out, "w"), indent=1, ensure_ascii=False)
    print(f"WROTE {os.path.basename(out)}  -> next: python3 brb_all.py")


if __name__ == "__main__":
    main()
