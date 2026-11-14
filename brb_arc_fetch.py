#!/usr/bin/env python3
"""
brb_arc_fetch.py  --  BRB Comics arc-data fetcher (READ-ONLY; never touches the inventory xlsx)

Reads   arc_targets.csv   (one row per unique Marvel/DC issue, built from the inventory)
Asks    marvel.fandom.com / dc.fandom.com  (open MediaWiki API, no key, no AI credits)
Writes  arc_raw.jsonl.gz  (story titles, solicit text, synopsis, event/arc fields per issue)
        arc_misses.csv    (issues the wiki could not match -> fixed in round 2)

Usage (run from the repo folder on the Mac):
  python3 brb_arc_fetch.py --limit 40     # GATE 1: prove it works on the 40 biggest series
  python3 brb_arc_fetch.py                # full run (resumes from cache if interrupted)

Safety (v2):
  * A sheet "series" often spans several real wiki volumes (Birds of Prey 1999 + 2023,
    Fantastic Four Vol 3 #1-70 vs legacy #500+ filed as Vol 1). Each series is split into
    ERAS (a 3+ year gap or an issue-number restart) and each era is resolved on its own.
  * Every fetched issue page's Year is checked against the sheet year (+/-1). A mismatch
    is written to arc_misses.csv as "year mismatch" -- never emitted as arc data. Wrong
    data is worse than missing data.

Standard library only.
"""
import argparse, csv, gzip, json, os, re, sys, time, urllib.parse, urllib.request

API = {"Marvel": "https://marvel.fandom.com/api.php", "DC": "https://dc.fandom.com/api.php"}
UA = "BRB-Comics-inventory-research/1.0 (personal collection cataloguing)"
MAX_VOL = 12          # volumes probed per title variant
PAUSE = 0.6           # seconds between requests (polite)
YEAR_TOL = 1          # sheet year vs wiki page year
CACHE = "arc_cache.json"
KEEP = re.compile(r"(?i)story ?title|synopsis|solicit|event|arc|storyline|^month$|^year$|previous|next")
CAP = {"synopsis": 900, "solicit": 1800}
YEAR_RE = re.compile(r"(?m)^\|\s*Year\s*=\s*\[*(\d{4})")


def api_get(wiki, titles):
    """Fetch wikitext for up to 50 page titles. Returns {requested_title: {page, text}}."""
    data = urllib.parse.urlencode({
        "action": "query", "prop": "revisions", "rvprop": "content", "rvslots": "main",
        "redirects": "1", "format": "json", "formatversion": "2", "titles": "|".join(titles),
    }).encode()
    for attempt in range(5):
        try:
            req = urllib.request.Request(API[wiki], data=data, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=45) as r:
                js = json.loads(r.read().decode("utf-8"))
            break
        except Exception as e:                      # network / 429 / 5xx -> back off
            wait = 5 * (attempt + 1)
            print(f"   retry in {wait}s ({e})", file=sys.stderr)
            time.sleep(wait)
    else:
        return None
    q = js.get("query", {})
    alias = {}                                      # final title -> requested title
    for step in ("normalized", "redirects"):
        for m in q.get(step, []):
            alias[m["to"]] = alias.get(m["from"], m["from"])
    out = {}
    for p in q.get("pages", []):
        if p.get("missing") or "revisions" not in p:
            continue
        text = p["revisions"][0].get("slots", {}).get("main", {}).get("content", "")
        out[alias.get(p["title"], p["title"])] = {"page": p["title"], "text": text}
    time.sleep(PAUSE)
    return out


def fields(text):
    """Pull the template parameters we care about out of the wikitext."""
    out = {}
    for m in re.finditer(r"(?ms)^\|\s*([A-Za-z0-9 _]+?)\s*=[ \t]*(.*?)(?=^\||^\}\}|\Z)", text):
        k, v = m.group(1).strip(), m.group(2).strip()
        if not v or not KEEP.search(k):
            continue
        cap = next((n for key, n in CAP.items() if key in k.lower()), 400)
        out[k] = v[:cap]
    return out


def page_year(text_or_fields):
    if isinstance(text_or_fields, dict):
        y = str(text_or_fields.get("Year", ""))
        m = re.search(r"(\d{4})", y)
    else:
        m = YEAR_RE.search(text_or_fields)
    return int(m.group(1)) if m else None


def variants(title):
    t = re.split(r"\s+[—–]\s+", title.strip())[0]   # drop " — note" suffixes
    return [t, t[4:] if t.lower().startswith("the ") else "The " + t]


def issue_str(x):
    f = float(x)
    return str(int(f)) if f == int(f) else str(f)


def eras(rows):
    """Split one sheet series into eras: new era at a 3+ year gap, an issue restart
    (drop > 10) or a numbering jump (rise > 40). Each era gets its own wiki volume."""
    rs = sorted(rows, key=lambda r: (int(float(r["year"] or 0)), float(r["issue"])))
    out, cur = [], []
    for r in rs:
        if cur:
            py, pi = int(float(cur[-1]["year"] or 0)), float(cur[-1]["issue"])
            y, i = int(float(r["year"] or 0)), float(r["issue"])
            # gap, restart (drop), or big jump (legacy renumbering, e.g. #3 -> #672):
            # a spurious split only costs one request; a missed one costs data.
            if y - py > 2 or pi - i > 10 or i - pi > 40:
                out.append(cur); cur = []
        cur.append(r)
    if cur:
        out.append(cur)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--targets", default="arc_targets.csv")
    ap.add_argument("--limit", type=int, default=0, help="only the first N series (gate test)")
    a = ap.parse_args()

    rows = list(csv.DictReader(open(a.targets, newline="", encoding="utf-8")))
    series = {}
    for r in rows:
        series.setdefault(r["series_key"], []).append(r)
    keys = list(series)                              # already sorted biggest-first
    if a.limit:
        keys = keys[: a.limit]
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    if cache.get("v") != 2:                          # v1 caches resolved per series -> unsafe
        cache = {"v": 2, "resolved": {}, "issues": {}}
    units = []                                       # (era_id, wiki, rows)
    for k in keys:
        for n, era in enumerate(eras(series[k])):
            units.append((f"{k}#{n}", era[0]["wiki"], era))
    total = sum(len(series[k]) for k in keys)
    print(f"{len(keys)} series -> {len(units)} eras / {total} issues to do")
    t0 = time.time()

    # ---- STEP 1: resolve each ERA to its real wiki volume (match by year) ----------------
    for n, (eid, wiki, era) in enumerate(units, 1):
        if eid in cache["resolved"]:
            continue
        # two probes (lowest + middle issue) in ONE request: 2 variants x 12 vols x 2 = 48
        probes = [era[0]] + ([era[len(era) // 2]] if len(era) > 2 else [])
        cands = []
        for pr in probes:
            for t in variants(pr["title"]):
                for v in range(1, MAX_VOL + 1):
                    cands.append((f"{t} Vol {v} {issue_str(pr['issue'])}", pr))
        got = api_get(wiki, [c for c, _ in cands]) or {}
        best = None
        for c, pr in cands:
            if c not in got:
                continue
            py = page_year(got[c]["text"])
            sy = int(float(pr["year"] or 0))
            diff = abs(py - sy) if (py and sy) else 9
            same_vol = 0 if f" Vol {pr['sheet_volume']} " in c else 1
            if best is None or (diff, same_vol) < best[0]:
                best = ((diff, same_vol), c)
        cache["resolved"][eid] = best[1].rsplit(" ", 1)[0] if best and best[0][0] <= YEAR_TOL else None
        if n % 25 == 0 or n == len(units):
            json.dump(cache, open(CACHE, "w"))
            ok = sum(1 for e, _, _ in units[:n] if cache["resolved"].get(e))
            print(f"  resolve {n}/{len(units)}  matched {ok}  ({time.time() - t0:.0f}s)")

    # ---- STEP 2: fetch every issue page, 50 per request ----------------------------------
    todo = {"Marvel": [], "DC": []}
    for eid, wiki, era in units:
        base = cache["resolved"].get(eid)
        for r in era:
            r["_era"] = eid
            if not base:
                continue
            r["_page"] = f"{base} {issue_str(r['issue'])}"
            if r["_page"] not in cache["issues"]:
                todo[wiki].append(r["_page"])
    for wiki, pages in todo.items():
        pages = sorted(set(pages))
        for i in range(0, len(pages), 50):
            got = api_get(wiki, pages[i:i + 50]) or {}
            for p in pages[i:i + 50]:
                cache["issues"][p] = ({"page": got[p]["page"], "f": fields(got[p]["text"]),
                                       "year": page_year(got[p]["text"])}
                                      if p in got else None)
            json.dump(cache, open(CACHE, "w"))
            print(f"  {wiki} issues {min(i + 50, len(pages))}/{len(pages)}  ({time.time() - t0:.0f}s)")

    # ---- STEP 3: write results (year-verified only) ---------------------------------------
    hit, reasons = 0, {}
    with gzip.open("arc_raw.jsonl.gz", "wt", encoding="utf-8") as out, \
            open("arc_misses.csv", "w", newline="", encoding="utf-8") as miss:
        mw = csv.writer(miss)
        mw.writerow(["wiki", "title", "sheet_volume", "issue", "year", "reason", "tried_page"])
        for eid, wiki, era in units:
            base = cache["resolved"].get(eid)
            for r in era:
                rec = cache["issues"].get(r.get("_page", "")) if base else None
                why = None
                if not base:
                    why = "series/era not matched"
                elif not rec:
                    why = "issue page missing"
                else:
                    sy = int(float(r["year"] or 0))
                    py = rec.get("year")
                    if py and sy and abs(py - sy) > YEAR_TOL:
                        why = f"year mismatch (wiki {py})"
                if why:
                    reasons[why.split(" (")[0]] = reasons.get(why.split(" (")[0], 0) + 1
                    mw.writerow([r["wiki"], r["title"], r["sheet_volume"], r["issue"], r["year"],
                                 why, r.get("_page", "")])
                    continue
                hit += 1
                out.write(json.dumps({**{x: r[x] for x in
                          ("rid", "wiki", "title", "sheet_volume", "issue", "year")},
                          "page": rec["page"], "f": rec["f"]}, ensure_ascii=False) + "\n")
    print(f"\nDONE  {hit}/{total} issues found ({100 * hit / max(total, 1):.0f}%)  "
          f"in {time.time() - t0:.0f}s")
    for k, v in sorted(reasons.items(), key=lambda x: -x[1]):
        print(f"  miss: {k:24s} {v}")
    print("Upload to Claude:  arc_raw.jsonl.gz  and  arc_misses.csv")


if __name__ == "__main__":
    main()
