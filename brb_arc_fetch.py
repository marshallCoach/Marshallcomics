#!/usr/bin/env python3
"""
brb_arc_fetch.py  --  BRB Comics arc-data fetcher (READ-ONLY; never touches the inventory xlsx)

Reads   arc_targets.csv   (one row per unique Marvel/DC issue, built from the inventory)
Asks    marvel.fandom.com / dc.fandom.com  (open MediaWiki API, no key, no AI credits)
Writes  arc_raw.jsonl.gz  (story titles, solicit text, synopsis, event/arc fields per issue)
        arc_misses.csv    (issues still unmatched after round 2)
        arc_summary.json  (hit counts -- the overnight script reads this for its gate)

Usage (run from the repo folder on the Mac):
  python3 brb_arc_fetch.py --limit 40     # gate: the 40 biggest series
  python3 brb_arc_fetch.py                # full run + round 2 (resumes from cache)
  ./brb_arc_overnight.sh                  # gate -> full run -> round 2, unattended

Safety:
  * ERAS: a sheet series often spans several real wiki volumes (Birds of Prey 1999 +
    2023; FF Vol 3 vs legacy #500+ filed as Vol 1). Each era is resolved on its own.
  * YEAR CHECK: every page's Year must be within +/-1 of the sheet year, else it is a
    miss ("year mismatch") -- never emitted as arc data. Wrong data is worse than none.
  * NETWORK SAFE: a failed request is NEVER cached as "not found". Long outages pause
    and retry; after ~30 min down the run stops cleanly and resumes next time.
  * CRASH SAFE: cache saved atomically (temp file + rename) and on Ctrl-C / kill.
  * ONE AT A TIME: a lock file stops two runs fighting over the cache.
  * ROUND 2: every miss gets an individual probe with wider title variants
    ("&"/"and", "The", subtitle dropped, "(YYYY)" dropped) across volumes.

Standard library only.
"""
import argparse, csv, gzip, json, os, re, signal, sys, time, urllib.error, urllib.parse, urllib.request

API = {"Marvel": "https://marvel.fandom.com/api.php", "DC": "https://dc.fandom.com/api.php"}
UA = "BRB-Comics-inventory-research/1.0 (personal collection cataloguing)"
MAX_VOL = 12
PAUSE = 0.6                 # seconds between requests (polite)
YEAR_TOL = 1
OUTAGE_LIMIT = 30 * 60      # stop cleanly after this long without a successful request
CACHE = "arc_cache.json"
LOCK = "arc_fetch.lock"
KEEP = re.compile(r"(?i)story ?title|synopsis|solicit|event|arc|storyline|^month$|^year$|previous|next")
CAP = {"synopsis": 900, "solicit": 1800}
YEAR_RE = re.compile(r"(?m)^\|\s*Year\s*=\s*\[*(\d{4})")


class Outage(Exception):
    """Network down for longer than OUTAGE_LIMIT -- stop cleanly, resume later."""


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


# ---------------------------------------------------------------- cache (atomic) ------------
def load_cache():
    for path in (CACHE, CACHE + ".bak"):
        if os.path.exists(path):
            try:
                c = json.load(open(path))
                if c.get("v") == 3:
                    return c
                if c.get("v") == 2:                  # same era keys + issue records: upgrade
                    c["v"], c["probe"] = 3, {}
                    log(f"upgraded {path} from v2 - keeping its {len(c.get('issues', {}))} fetched issues")
                    return c
            except Exception:
                log(f"cache {path} unreadable - trying backup")
    return {"v": 3, "resolved": {}, "issues": {}, "probe": {}}


def save_cache(cache):
    tmp = CACHE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(cache, f)
        f.flush()
        os.fsync(f.fileno())
    if os.path.exists(CACHE):
        os.replace(CACHE, CACHE + ".bak")      # keep the previous good copy
    os.replace(tmp, CACHE)


# ---------------------------------------------------------------- network --------------------
_last_ok = [time.time()]


def api_get(wiki, titles):
    """Fetch wikitext for up to 50 titles -> {requested_title: {page, text}}.
    Never returns a 'not found' on network failure: it waits and retries, and raises
    Outage after OUTAGE_LIMIT without success (caller saves the cache and stops)."""
    data = urllib.parse.urlencode({
        "action": "query", "prop": "revisions", "rvprop": "content", "rvslots": "main",
        "redirects": "1", "format": "json", "formatversion": "2", "titles": "|".join(titles),
    }).encode()
    attempt = 0
    while True:
        try:
            req = urllib.request.Request(API[wiki], data=data, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=45) as r:
                js = json.loads(r.read().decode("utf-8"))
            _last_ok[0] = time.time()
            break
        except urllib.error.HTTPError as e:
            wait = int(e.headers.get("Retry-After") or 0) if e.code == 429 else 0
            wait = max(wait, min(300, 10 * 2 ** attempt))
            err = f"HTTP {e.code}"
        except Exception as e:                       # DNS, timeout, Wi-Fi drop, sleep...
            wait, err = min(300, 10 * 2 ** attempt), type(e).__name__
        if time.time() - _last_ok[0] > OUTAGE_LIMIT:
            raise Outage(f"no successful request for {OUTAGE_LIMIT // 60} min ({err})")
        log(f"   network: {err} - retry in {wait}s")
        time.sleep(wait)
        attempt = min(attempt + 1, 6)
    q = js.get("query", {})
    alias = {}
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


# ---------------------------------------------------------------- parsing --------------------
def fields(text):
    out = {}
    for m in re.finditer(r"(?ms)^\|\s*([A-Za-z0-9 _]+?)\s*=[ \t]*(.*?)(?=^\||^\}\}|\Z)", text):
        k, v = m.group(1).strip(), m.group(2).strip()
        if not v or not KEEP.search(k):
            continue
        cap = next((n for key, n in CAP.items() if key in k.lower()), 400)
        out[k] = v[:cap]
    return out


def page_year(text):
    m = YEAR_RE.search(text or "")
    return int(m.group(1)) if m else None


def issue_str(x):
    f = float(x)
    return str(int(f)) if f == int(f) else str(f)


def variants(title):
    t = re.split(r"\s+[—–]\s+", title.strip())[0]
    return [t, t[4:] if t.lower().startswith("the ") else "The " + t]


def variants_wide(title):
    """Round-2 title spellings, most likely first (max 4 -> 4 x 12 vols = 48 <= 50)."""
    t = re.split(r"\s+[—–]\s+", title.strip())[0]
    t = re.sub(r"\s*\(\d{4}\)\s*$", "", t).strip()
    out = []
    def add(x):
        x = re.sub(r"\s+", " ", x).strip()
        if x and x not in out:
            out.append(x)
    add(t)
    add(t[4:] if t.lower().startswith("the ") else "The " + t)
    add(t.replace(" & ", " and ") if " & " in t else t.replace(" and ", " & "))
    add(re.sub(r"\s*/\s*", "/", t))
    if ":" in t:
        add(t.split(":")[0])
    add(t.replace(":", ""))
    return out[:4]


def eras(rows):
    """New era at a 3+ year gap, an issue restart (drop > 10) or a numbering jump (> 40)."""
    rs = sorted(rows, key=lambda r: (int(float(r["year"] or 0)), float(r["issue"])))
    out, cur = [], []
    for r in rs:
        if cur:
            py, pi = int(float(cur[-1]["year"] or 0)), float(cur[-1]["issue"])
            y, i = int(float(r["year"] or 0)), float(r["issue"])
            if y - py > 2 or pi - i > 10 or i - pi > 40:
                out.append(cur); cur = []
        cur.append(r)
    if cur:
        out.append(cur)
    return out


def pick(got, cands):
    """Best (page_key) among candidates: closest year, then sheet volume."""
    best = None
    for c, row in cands:
        if c not in got:
            continue
        py, sy = page_year(got[c]["text"]), int(float(row["year"] or 0))
        diff = abs(py - sy) if (py and sy) else 9
        same_vol = 0 if f" Vol {row['sheet_volume']} " in c else 1
        if best is None or (diff, same_vol) < best[0]:
            best = ((diff, same_vol), c)
    return best[1] if best and best[0][0] <= YEAR_TOL else None


# ---------------------------------------------------------------- main -----------------------
def run(a, cache):
    rows = list(csv.DictReader(open(a.targets, newline="", encoding="utf-8")))
    series = {}
    for r in rows:
        series.setdefault(r["series_key"], []).append(r)
    keys = list(series)
    if a.limit:
        keys = keys[: a.limit]
    units = [(f"{k}#{n}", era[0]["wiki"], era) for k in keys for n, era in enumerate(eras(series[k]))]
    total = sum(len(series[k]) for k in keys)
    log(f"{len(keys)} series -> {len(units)} eras / {total} issues")
    t0 = time.time()

    # STEP 1 -- resolve each era (two probes in one request)
    todo1 = [u for u in units if u[0] not in cache["resolved"]]
    for n, (eid, wiki, era) in enumerate(todo1, 1):
        probes = [era[0]] + ([era[len(era) // 2]] if len(era) > 2 else [])
        cands = [(f"{t} Vol {v} {issue_str(pr['issue'])}", pr)
                 for pr in probes for t in variants(pr["title"]) for v in range(1, MAX_VOL + 1)]
        got = api_get(wiki, [c for c, _ in cands][:50])
        best = pick(got, cands)
        cache["resolved"][eid] = best.rsplit(" ", 1)[0] if best else None
        if n % 25 == 0 or n == len(todo1):
            save_cache(cache)
            el = time.time() - t0
            log(f"  step1 resolve {n}/{len(todo1)}  eta {el / n * (len(todo1) - n) / 60:.0f} min")

    # STEP 2 -- fetch every issue page, 50 per request
    todo = {"Marvel": [], "DC": []}
    for eid, wiki, era in units:
        base = cache["resolved"].get(eid)
        for r in era:
            if base:
                r["_page"] = f"{base} {issue_str(r['issue'])}"
                if r["_page"] not in cache["issues"]:
                    todo[wiki].append(r["_page"])
    for wiki, pages in todo.items():
        pages = sorted(set(pages))
        for i in range(0, len(pages), 50):
            got = api_get(wiki, pages[i:i + 50])
            for p in pages[i:i + 50]:
                cache["issues"][p] = ({"page": got[p]["page"], "f": fields(got[p]["text"]),
                                       "year": page_year(got[p]["text"])} if p in got else None)
            save_cache(cache)
            log(f"  step2 {wiki} issues {min(i + 50, len(pages))}/{len(pages)}")

    era_of = {id(r): eid for eid, _, era in units for r in era}

    def status(r):
        base = cache["resolved"].get(era_of[id(r)])
        if not base:
            return None, "series/era not matched"
        rec = cache["issues"].get(r.get("_page", ""))
        if not rec:
            return None, "issue page missing"
        sy, py = int(float(r["year"] or 0)), rec.get("year")
        if py and sy and abs(py - sy) > YEAR_TOL:
            return None, f"year mismatch (wiki {py})"
        return rec, None

    # STEP 3 -- round 2: individual wide probe for every miss
    allrows = [r for _, _, era in units for r in era]
    misses = []
    for r in allrows:
        rec, why = status(r)
        if why:
            misses.append(r)
    todo3 = [r for r in misses if r["rid"] not in cache["probe"]][: a.round2_max]
    if a.round2 and todo3:
        log(f"round 2: probing {len(todo3)} missed issues individually")
        for n, r in enumerate(todo3, 1):
            cands = [(f"{t} Vol {v} {issue_str(r['issue'])}", r)
                     for t in variants_wide(r["title"]) for v in range(1, MAX_VOL + 1)][:50]
            got = api_get(r["wiki"], [c for c, _ in cands])
            best = pick(got, cands)
            cache["probe"][r["rid"]] = ({"page": got[best]["page"], "f": fields(got[best]["text"]),
                                         "year": page_year(got[best]["text"])} if best else None)
            if n % 25 == 0 or n == len(todo3):
                save_cache(cache)
                found = sum(1 for x in todo3[:n] if cache["probe"].get(x["rid"]))
                log(f"  round2 {n}/{len(todo3)}  recovered {found}")
    save_cache(cache)

    # STEP 4 -- write results (year-verified only)
    hit, r2, reasons = 0, 0, {}
    with gzip.open("arc_raw.jsonl.gz", "wt", encoding="utf-8") as out, \
            open("arc_misses.csv", "w", newline="", encoding="utf-8") as miss:
        mw = csv.writer(miss)
        mw.writerow(["wiki", "title", "sheet_volume", "issue", "year", "reason", "tried_page"])
        for r in allrows:
            rec, why = status(r)
            rnd = 1
            if why and cache["probe"].get(r["rid"]):
                rec, why, rnd = cache["probe"][r["rid"]], None, 2
            if why:
                key = why.split(" (")[0]
                reasons[key] = reasons.get(key, 0) + 1
                mw.writerow([r["wiki"], r["title"], r["sheet_volume"], r["issue"], r["year"],
                             why, r.get("_page", "")])
                continue
            hit += 1
            r2 += rnd == 2
            out.write(json.dumps({**{x: r[x] for x in ("rid", "wiki", "title", "sheet_volume", "issue", "year")},
                                  "page": rec["page"], "f": rec["f"], "round": rnd},
                                 ensure_ascii=False) + "\n")
    summ = {"series": len(keys), "issues": total, "found": hit, "found_round2": r2,
            "pct": round(100 * hit / max(total, 1), 1), "misses": reasons,
            "minutes": round((time.time() - t0) / 60, 1), "limit": a.limit}
    json.dump(summ, open("arc_summary.json", "w"), indent=1)
    log(f"DONE  {hit}/{total} issues found ({summ['pct']}%)  round 2 recovered {r2}  "
        f"in {summ['minutes']} min")
    for k, v in sorted(reasons.items(), key=lambda x: -x[1]):
        log(f"  miss: {k:24s} {v}")
    log("Upload to Claude:  arc_raw.jsonl.gz  and  arc_misses.csv")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--targets", default="arc_targets.csv")
    ap.add_argument("--limit", type=int, default=0, help="only the first N series (gate test)")
    ap.add_argument("--no-round2", dest="round2", action="store_false")
    ap.add_argument("--round2-max", type=int, default=6000)
    a = ap.parse_args()

    if os.path.exists(LOCK):
        try:
            pid = int(open(LOCK).read().strip())
            os.kill(pid, 0)
            sys.exit(f"another arc fetch is running (pid {pid}) - not starting a second one")
        except (ValueError, ProcessLookupError, PermissionError):
            log("removing stale lock")
    open(LOCK, "w").write(str(os.getpid()))
    cache = load_cache()

    def stop(sig, _frm):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, stop)
    code = 0
    try:
        run(a, cache)
    except KeyboardInterrupt:
        log("stopped - cache saved, rerun to resume")
        code = 130
    except Outage as e:
        log(f"OUTAGE: {e} - cache saved, rerun to resume")
        code = 75
    finally:
        try:
            save_cache(cache)
        finally:
            if os.path.exists(LOCK):
                os.remove(LOCK)
    sys.exit(code)


if __name__ == "__main__":
    main()
