#!/usr/bin/env python3
"""
brb_series_match.py -- propose the Fandom series page for every series our arc fetch
couldn't find (arc_misses.csv: "series/era not matched" and "issue page missing").
READ-ONLY on the xlsx. Writes artifacts/comics-inventory/public/series_match.json,
which the Data Fix page shows as "Series match" for you to approve.

For each unmatched series (wiki + your title + your volume):
  1. search the wiki for pages named "<Something> Vol N" (full-text search, so
     "Inhumans vs. X-Men" finds "IVX Vol 1");
  2. VERIFY each candidate by fetching up to 2 of your issues as "<candidate> <issue>"
     and checking the page exists and its year is within 1 of your sheet's year;
  3. rank: verified issues, then name similarity, then volume number match.
Nothing is renamed here - you choose Map (lookup only) or Map + rename on Data Fix.

    python3 brb_series_match.py
"""
import collections, csv, json, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
import brb_arc_fetch as F                                    # noqa: E402  API, UA, api_get, page_year
from brb_apply_arcs import norm, ni                          # noqa: E402

OUT = os.path.join(ROOT, "artifacts/comics-inventory/public/series_match.json")
MAP = os.path.join(ROOT, "series_map.json")
SERIES_RE = re.compile(r"^(.+? Vol \d+)(?: \d+(?:\.\d+)?)?$")
WIKI_URL = {"Marvel": "https://marvel.fandom.com/wiki/", "DC": "https://dc.fandom.com/wiki/"}


def search(wiki, q):
    data = urllib.parse.urlencode({"action": "query", "list": "search", "srsearch": q, "srnamespace": "0",
                                   "srlimit": "40", "format": "json", "formatversion": "2"}).encode()
    for attempt in range(6):
        try:
            req = urllib.request.Request(F.API[wiki], data=data, headers={"User-Agent": F.UA})
            with urllib.request.urlopen(req, timeout=45) as r:
                js = json.loads(r.read().decode("utf-8"))
            time.sleep(F.PAUSE)
            return [x["title"] for x in js.get("query", {}).get("search", [])]
        except Exception as e:  # noqa: BLE001
            print(f"   search retry ({type(e).__name__})", flush=True)
            time.sleep(min(120, 5 * 2 ** attempt))
    raise F.Outage("search kept failing")


def words(s):
    return set(norm(re.sub(r"\bVol \d+\b", "", s)).split()) - {"the", "and", "of", "a"}


def main():
    if not os.path.exists("arc_misses.csv"):
        sys.exit("arc_misses.csv not found (written by brb_arc_fetch.py)")
    mapped = json.load(open(MAP)) if os.path.exists(MAP) else {}
    groups = collections.defaultdict(list)
    for r in csv.DictReader(open("arc_misses.csv", newline="", encoding="utf-8")):
        if not (r["reason"].startswith("series") or r["reason"].startswith("issue page missing")):
            continue
        key = f"{r['title']}|||{ni(r['sheet_volume']) or '1'}"
        if key in mapped:
            continue
        groups[(r["wiki"], key)].append(r)
    print(f"{len(groups)} unmatched series ({sum(len(v) for v in groups.values())} books)")

    results = []
    for n, ((wiki, key), rows) in enumerate(sorted(groups.items(), key=lambda kv: -len(kv[1])), 1):
        title, vol = key.split("|||")
        cands = []
        for q in (title, re.sub(r"[:\-–—].*$", "", title).strip()):
            for t in search(wiki, q):
                m = SERIES_RE.match(t)
                if m and m.group(1) not in cands:
                    cands.append(m.group(1))
        cands = cands[:12]
        probes = sorted(rows, key=lambda r: float(r["issue"]) if re.fullmatch(r"[\d.]+", r["issue"]) else 1e9)
        probes = [probes[0]] + ([probes[-1]] if len(probes) > 1 else [])
        pages = [f"{c} {ni(p['issue'])}" for c in cands for p in probes][:50]
        got = F.api_get(wiki, pages) if pages else {}
        scored = []
        for c in cands:
            ver, yrs = 0, []
            for p in probes:
                pg = got.get(f"{c} {ni(p['issue'])}")
                if pg:
                    py, sy = F.page_year(pg["text"]), int(float(p["year"] or 0))
                    if py and sy and abs(py - sy) <= 1:
                        ver += 1; yrs.append(py)
            w1, w2 = words(title), words(c)
            sim = len(w1 & w2) / max(1, len(w1 | w2))
            volm = 1 if c.endswith(f" Vol {vol}") else 0
            scored.append({"base": c, "url": WIKI_URL[wiki] + urllib.parse.quote(c.replace(" ", "_")),
                           "verified": ver, "of": len(probes), "years": sorted(set(yrs)), "sim": round(sim, 2), "volmatch": volm})
        scored.sort(key=lambda x: (-x["verified"], -x["sim"], -x["volmatch"]))
        best = scored[0] if scored and scored[0]["verified"] else None
        conf = ("high" if best and best["verified"] == best["of"] else "medium" if best else "none")
        ys = sorted({int(float(r["year"])) for r in rows if r["year"]})
        results.append({"key": key, "wiki": wiki, "title": title, "vol": vol, "count": len(rows),
                        "years": [ys[0], ys[-1]] if ys else [], "issues": sorted({ni(r["issue"]) for r in rows},
                        key=lambda x: float(x) if re.fullmatch(r"[\d.]+", x) else 1e9)[:12],
                        "reason": rows[0]["reason"].split(" (")[0], "best": best, "conf": conf, "cands": scored[:5]})
        if n % 20 == 0:
            print(f"  {n}/{len(groups)}  high {sum(r['conf'] == 'high' for r in results)}  "
                  f"medium {sum(r['conf'] == 'medium' for r in results)}", flush=True)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(results, open(OUT, "w"), indent=0, ensure_ascii=False)
    c = collections.Counter(r["conf"] for r in results)
    print(f"DONE  {len(results)} series: high {c['high']}  medium {c['medium']}  no verified match {c['none']}")
    print("-> Data Fix page: 'Series match' (deploy with brb.py)")


if __name__ == "__main__":
    main()
