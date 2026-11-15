#!/usr/bin/env python3
"""
brb_data_suspects.py -- list inventory rows whose Year / Volume / Title / Issue look
wrong, using what the arc fetches learned. READ-ONLY: nothing is written to the xlsx.

Evidence used (whatever exists in this folder):
  arc_misses.csv   Fandom fetch misses  (year mismatch, issue page missing, series unknown)
  cv_cache.json    Comic Vine fetch     (series not found, issue # not in the series)
  the newest attached_assets xlsx       (a whole run sharing one Year, issue # in the
                                          title, the same book under two titles/volumes)

Confidence: High = two sources agree or the error is visible in the row itself;
            Medium = one database disagrees; Low = pattern only, worth a glance.
CC / status boxes are never reported as duplicates.

    python3 brb_data_suspects.py          -> data_suspects.csv  (fix on Edit Comic, by #)
"""
import collections, csv, glob, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "attached_assets")
STATUS = ("AT CGC", "AT MAGIC", "UNKNOWN")


def ni(v):
    s = str(v if v is not None else "").strip().lstrip("#")
    try:
        f = float(s)
        return str(int(f)) if f == int(f) else s
    except ValueError:
        return s


def yr(v):
    m = re.search(r"(\d{4})", str(v or ""))
    return int(m.group(1)) if m else None


def fnum(v):
    try:
        return float(str(v).strip().lstrip("#"))
    except ValueError:
        return None


def loose(t):
    """Title fingerprint that ignores punctuation, 'the', '&/and', 'x'/'vs' and word order."""
    t = str(t or "").lower().replace("&", " and ")
    words = [w for w in re.split(r"[^a-z0-9]+", t) if w and w not in ("the", "and", "x", "vs", "a", "of")]
    return " ".join(sorted(words))


def _fn_key(f):
    m = re.search(r"_(\d{2})(\d{2})_(\d{2})(\d{2})", os.path.basename(f))
    if m:
        dd, mm, hh, mi = (int(x) for x in m.groups())
        return (1, mm, dd, hh, mi, os.path.getmtime(f))
    return (0, 0, 0, 0, 0, os.path.getmtime(f))


def main():
    import openpyxl
    files = [f for f in glob.glob(os.path.join(ASSETS, "comics_inventory_*.xlsx"))
             if " copy" not in f and not os.path.basename(f).startswith("~$")]
    if not files:
        sys.exit("no attached_assets/comics_inventory_*.xlsx")
    src = max(files, key=_fn_key)
    wb = openpyxl.load_workbook(src, read_only=True)
    ws = [w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory")][-1]
    it = ws.iter_rows(values_only=True)
    H = [str(h).strip() if h is not None else "" for h in next(it)]
    gi = lambda *names: next((H.index(n) for n in names if n in H), None)
    cE, cT, cI, cV, cY, cB = gi("#"), gi("Title"), gi("Issue #"), gi("Volume"), gi("Year"), gi("Box #", "Box")
    rows = []
    for r in it:
        t = str(r[cT] or "").strip()
        if not t:
            continue
        rows.append({"entry": r[cE] if cE is not None else "", "title": t, "issue": ni(r[cI]),
                     "vol": (ni(r[cV]) if cV is not None else "") or "1", "year": yr(r[cY]),
                     "box": str(r[cB] or "").strip() if cB is not None else ""})
    by_book = collections.defaultdict(list)
    for x in rows:
        by_book[(x["title"], x["vol"], x["issue"])].append(x)

    out = {}                                               # (entry, field) -> record

    def flag(x, field, current, suggested, evidence, conf):
        k = (str(x["entry"]), field)
        rank = {"High": 0, "Medium": 1, "Low": 2}
        old = out.get(k)
        if old:                                            # second source -> merge, upgrade
            if evidence not in old["evidence"]:
                old["evidence"] += " + " + evidence
                old["confidence"] = "High"
            if suggested and not old["suggested"]:
                old["suggested"] = suggested
            if rank[conf] < rank[old["confidence"]]:
                old["confidence"] = conf
            return
        out[k] = {"#": x["entry"], "title": x["title"], "volume": x["vol"], "issue": x["issue"], "year": x["year"] or "",
                  "box": x["box"], "field": field, "current": current, "suggested": suggested,
                  "evidence": evidence, "confidence": conf}

    # ---- Fandom misses --------------------------------------------------------
    fandom_missing, fandom_noseries = set(), set()
    if os.path.exists("arc_misses.csv"):
        for m in csv.DictReader(open("arc_misses.csv", newline="", encoding="utf-8")):
            key = (m["title"], ni(m["sheet_volume"]) or "1", ni(m["issue"]))
            hits = [x for x in by_book.get(key, []) if not m["year"] or x["year"] == yr(m["year"])] or by_book.get(key, [])
            reason = m["reason"]
            for x in hits:
                if reason.startswith("year mismatch"):
                    wy = yr(reason)
                    flag(x, "Year", x["year"], wy, f"Fandom dates this issue {wy}", "Medium")
                elif reason.startswith("issue page missing"):
                    fandom_missing.add(key)
                elif reason.startswith("series"):
                    fandom_noseries.add(x["title"])
        print(f"Fandom misses read: arc_misses.csv")
    else:
        print("arc_misses.csv not here - Fandom evidence skipped")

    # ---- Comic Vine cache -----------------------------------------------------
    cv_noseries, cv_missing = set(), {}
    if os.path.exists("cv_cache.json"):
        c = json.load(open("cv_cache.json"))
        for x in rows:
            ek = f"{x['title']}|{x['vol']}|{(x['year'] or 0) // 6}"
            if ek not in c.get("vol", {}):
                continue                                   # not reached yet
            v = c["vol"][ek]
            if not v:
                cv_noseries.add(x["title"])
                continue
            nums = [i["n"] for i in c.get("vissues", {}).get(str(v["id"]), [])]
            if nums and x["issue"] not in nums:
                fl = [f for f in (fnum(n) for n in nums) if f is not None]
                cv_missing[(x["title"], x["vol"], x["issue"])] = (min(fl) if fl else None, max(fl) if fl else None, v["name"], len(nums))
        print("Comic Vine evidence read: cv_cache.json")
    else:
        print("cv_cache.json not here - Comic Vine evidence skipped")

    for key, (lo, hi, name, n) in cv_missing.items():
        for x in by_book[key]:
            f = fnum(x["issue"])
            beyond = f is not None and hi is not None and f > hi
            ev = (f"Comic Vine's '{name}' runs #{ni(lo)}-#{ni(hi)}; #{x['issue']} is beyond it" if beyond
                  else f"#{x['issue']} not in Comic Vine's '{name}' ({n} issues)")
            both = key in fandom_missing
            flag(x, "Volume / Issue #", f"v{x['vol']} #{x['issue']}", "", ev + (" + Fandom has no page either" if both else ""),
                 "High" if both else ("Medium" if beyond else "Low"))
    for key in fandom_missing - set(cv_missing):
        pass                                               # Fandom alone: usually wiki naming, skip

    for t in sorted(fandom_noseries & cv_noseries):
        for x in [r for r in rows if r["title"] == t][:1]:
            flag(x, "Title", t, "", "neither Fandom nor Comic Vine recognise this title - check spelling/format", "Medium")

    # ---- patterns in the sheet itself ----------------------------------------
    for x in rows:
        if re.search(r"#\s*\d", x["title"]):
            flag(x, "Title", x["title"], re.sub(r"\s*#\s*\d+.*$", "", x["title"]), "issue number is inside the title", "High")

    runs = collections.defaultdict(list)
    for x in rows:
        runs[(x["title"], x["vol"])].append(x)
    for (t, v), l in runs.items():
        nums = [fnum(x["issue"]) for x in l if fnum(x["issue"]) is not None]
        years = {x["year"] for x in l if x["year"]}
        if len(years) == 1 and len({n for n in nums}) >= 8 and nums and max(nums) - min(nums) >= 12:
            y = next(iter(years))
            span = -(-int(max(nums) - min(nums) + 1) // 12)          # monthly book: ~12 issues a year
            for x in l:
                flag(x, "Year", y, "", f"all {len(l)} issues #{ni(min(nums))}-#{ni(max(nums))} share {y} "
                     f"(a run that long spans ~{span}+ years - looks like the start year copied down)", "Low")

    groups = collections.defaultdict(list)
    for x in rows:
        if x["box"].upper().startswith("CC") or x["box"].upper().startswith(STATUS):
            continue
        groups[(loose(x["title"]), x["issue"], x["year"])].append(x)
    for g in groups.values():
        names = {(x["title"], x["vol"]) for x in g}
        if len(names) > 1:
            label = " | ".join(f"{t} v{v}" for t, v in sorted(names))
            for x in g:
                flag(x, "Title / Volume", f"{x['title']} v{x['vol']}", "",
                     f"same book under {len(names)} names/volumes: {label} - duplicate row or inconsistent naming", "Medium")

    # one title's words fully inside another's, same issue + year (e.g. "Tales of Suspense"
    # vs "Tales of Suspense: Captain America & Iron Man") -> probably one book, two names
    by_iy = collections.defaultdict(list)
    for x in rows:
        if not (x["box"].upper().startswith("CC") or x["box"].upper().startswith(STATUS)):
            by_iy[(x["issue"], x["year"])].append(x)
    for g in by_iy.values():
        titles = {x["title"] for x in g}
        if len(titles) < 2 or len(titles) > 60:
            continue
        ws_ = {t: set(loose(t).split()) for t in titles}
        for a in titles:
            for b in titles:
                if a != b and len(ws_[a]) >= 2 and ws_[a] < ws_[b]:
                    for x in g:
                        if x["title"] in (a, b):
                            flag(x, "Title / Volume", f"{x['title']} v{x['vol']}", "",
                                 f"'{a}' and '{b}' share issue + year - same book under two names?", "Low")

    # ---- write ----------------------------------------------------------------
    rank = {"High": 0, "Medium": 1, "Low": 2}
    recs = sorted(out.values(), key=lambda r: (rank[r["confidence"]], r["field"], r["title"].lower(), fnum(r["issue"]) or 0))
    cols = ["confidence", "#", "title", "volume", "issue", "year", "box", "field", "current", "suggested", "evidence"]
    with open("data_suspects.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(recs)
    cnt = collections.Counter((r["confidence"], r["field"]) for r in recs)
    print(f"\nSOURCE: {os.path.basename(src)}  ({len(rows)} rows)")
    for conf in ("High", "Medium", "Low"):
        parts = [f"{fld} {n}" for (cf, fld), n in sorted(cnt.items()) if cf == conf]
        print(f"  {conf:6} {sum(n for (cf, _), n in cnt.items() if cf == conf):4}   " + ", ".join(parts))
    print(f"wrote data_suspects.csv ({len(recs)} rows) - nothing changed in the xlsx")


if __name__ == "__main__":
    main()
