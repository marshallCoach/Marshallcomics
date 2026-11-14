#!/usr/bin/env python3
"""
brb_cv_arcs.py -- fill story arcs from the Comic Vine API for books Fandom couldn't.
READ-ONLY on the inventory: reads the newest xlsx, writes cv_arcs.csv (same format
as arc_extracted.csv) which brb_apply_arcs.py --csv cv_arcs.csv --fill-only applies.

Targets: every inventory row whose "Story Arc" is blank, or that has an arc but no
Arc Length (all publishers -- indie books Fandom can't reach are included). Needs COMIC_VINE_API_KEY in the
environment (never printed or logged).

Comic Vine rate-limits each resource (~200 requests/hour). This script:
  * paces each resource separately and backs off on HTTP 420 / status 107;
  * resolves each series to a CV volume once (title + start year + publisher);
  * pulls a volume's issue list in pages of 100; if Comic Vine includes
    story_arc_credits in that list, no per-issue calls are needed at all;
  * otherwise asks per issue, but when an arc is found it fetches the arc's
    issue list once and fills every owned issue in it (skipping their calls);
  * caches everything (atomic save) and resumes; lock file; clean stop on outage.

Part / length are set only when every issue of the arc is in the same volume
(a crossover's "part 12 of 60" across many series is not useful).

    python3 brb_cv_arcs.py --limit 30     # gate
    python3 brb_cv_arcs.py                # full run (resumable, can span nights)
"""
import argparse, collections, csv, glob, json, os, re, signal, sys, time
import urllib.error, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "attached_assets")
API = "https://comicvine.gamespot.com/api/"
UA = "BRB-Comics-inventory-research/1.0 (personal collection cataloguing)"
CACHE, LOCK = "cv_cache.json", "cv_arcs.lock"
PER_RESOURCE_GAP = 18.5     # 200/hour per resource
GLOBAL_GAP = 1.1
OUTAGE_LIMIT = 30 * 60
OUT_COLS = ["title", "sheet_volume", "issue", "year", "Story Arc", "Arc Part", "Arc Length",
            "Finale Issue #", "Crossover Event (Fandom)", "Arc Confidence", "Arc Source"]


class Outage(Exception):
    pass


def log(m):
    print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)


def norm(t):
    t = re.sub(r"^the\s+", "", str(t or "").lower().replace("&", " and "))
    return re.sub(r"[^a-z0-9]+", " ", re.sub(r"\(.*?\)", "", t)).strip()


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


# ---------------------------------------------------------------- cache ----------------
def load_cache():
    for p in (CACHE, CACHE + ".bak"):
        if os.path.exists(p):
            try:
                return json.load(open(p))
            except Exception:
                log(f"{p} unreadable - trying backup")
    return {"vol": {}, "vissues": {}, "issue": {}, "arc": {}, "listmode": None}


def save_cache(c):
    tmp = CACHE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(c, f); f.flush(); os.fsync(f.fileno())
    if os.path.exists(CACHE):
        os.replace(CACHE, CACHE + ".bak")
    os.replace(tmp, CACHE)


# ---------------------------------------------------------------- network --------------
_next = collections.defaultdict(float)
_last_ok = [time.time()]
KEY = os.environ.get("COMIC_VINE_API_KEY", "")


def cv(path, **params):
    """GET a Comic Vine resource with per-resource pacing. Never returns 'not found'
    for a network failure: waits/retries, raises Outage after OUTAGE_LIMIT."""
    resource = path.strip("/").split("/")[0]
    params.update(api_key=KEY, format="json")
    url = API + path + "?" + urllib.parse.urlencode(params)
    attempt = 0
    while True:
        wait = max(_next[resource], _next["*"]) - time.time()
        if wait > 0:
            time.sleep(wait)
        _next[resource] = time.time() + PER_RESOURCE_GAP
        _next["*"] = time.time() + GLOBAL_GAP
        err = None
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=45) as r:
                js = json.loads(r.read().decode("utf-8"))
            if js.get("status_code") == 107:            # rate limit exceeded
                err, backoff = "rate limit (107)", 900
            elif js.get("status_code") == 100:
                sys.exit("Comic Vine says the API key is invalid - check COMIC_VINE_API_KEY")
            else:
                _last_ok[0] = time.time()
                return js
        except urllib.error.HTTPError as e:
            err = f"HTTP {e.code}"
            backoff = 900 if e.code in (420, 429) else min(300, 10 * 2 ** attempt)
            if e.code == 404:
                _last_ok[0] = time.time()
                return {"results": None}
        except Exception as e:
            err, backoff = type(e).__name__, min(300, 10 * 2 ** attempt)
        if time.time() - _last_ok[0] > OUTAGE_LIMIT + (900 if "rate" in str(err) or "42" in str(err) else 0):
            raise Outage(f"no successful request for a long time ({err})")
        log(f"   comic vine: {err} - waiting {backoff}s")
        time.sleep(backoff)
        attempt = min(attempt + 1, 6)


# ---------------------------------------------------------------- targets --------------
def _fn_key(f):
    m = re.search(r"_(\d{2})(\d{2})_(\d{2})(\d{2})", os.path.basename(f))
    if m:
        dd, mm, hh, mi = (int(x) for x in m.groups())
        return (1, mm, dd, hh, mi, os.path.getmtime(f))
    return (0, 0, 0, 0, 0, os.path.getmtime(f))


def load_targets():
    import openpyxl
    files = [f for f in glob.glob(os.path.join(ASSETS, "comics_inventory_*.xlsx"))
             if " copy" not in f and not os.path.basename(f).startswith("~$")]
    src = max(files, key=_fn_key)
    wb = openpyxl.load_workbook(src, read_only=True)
    ws = [w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory")][-1]
    rows = ws.iter_rows(values_only=True)
    H = [str(h).strip() if h is not None else "" for h in next(rows)]
    gi = lambda n: H.index(n) if n in H else None
    cT, cI, cV, cY, cP, cA = gi("Title"), gi("Issue #"), gi("Volume"), gi("Year"), gi("Publisher"), gi("Story Arc")
    cL = gi("Arc Length")
    books = {}
    for r in rows:
        t = str(r[cT] or "").strip()
        has_arc = cA is not None and str(r[cA] or "").strip()
        has_len = cL is not None and str(r[cL] or "").strip()
        if not t or (has_arc and has_len):        # targets: no arc, or arc without a length
            continue
        k = (t, ni(r[cV]) if cV is not None else "1", ni(r[cI]), yr(r[cY]))
        books.setdefault(k, {"title": t, "vol": k[1] or "1", "issue": k[2], "year": k[3],
                             "pub": str(r[cP] or "") if cP is not None else ""})
    log(f"source {os.path.basename(src)}: {len(books)} unique books without a Story Arc or without an Arc Length")
    return list(books.values())


# ---------------------------------------------------------------- main -----------------
def pick_volume(results, b):
    best = None
    for v in results or []:
        if norm(v.get("name")) != norm(b["title"]):
            continue
        sy = int(v.get("start_year") or 0) if str(v.get("start_year") or "").isdigit() else 0
        if b["year"] and sy and sy > b["year"] + 1:
            continue
        pub = (v.get("publisher") or {}).get("name", "") or ""
        pub_ok = 0 if (b["pub"] and pub and norm(b["pub"]).split()[0] in norm(pub)) else 1
        span = (b["year"] - sy) if (b["year"] and sy) else 50
        score = (pub_ok, span if span >= -1 else 99, -int(v.get("count_of_issues") or 0))
        if best is None or score < best[0]:
            best = (score, v)
    return best[1] if best else None


def run(a, c):
    books = load_targets()
    if a.limit:
        books = books[: a.limit]
    eras = collections.defaultdict(list)                 # one CV volume per title+start-ish era
    for b in books:
        eras[(b["title"], b["vol"], (b["year"] or 0) // 6)].append(b)
    log(f"{len(books)} books in {len(eras)} series-eras")
    found = {}

    for n, (ek, grp) in enumerate(eras.items(), 1):
        ekey = "|".join(map(str, ek))
        # 1. resolve volume
        if ekey not in c["vol"]:
            b0 = min(grp, key=lambda x: x["year"] or 9999)
            js = cv("volumes/", filter=f"name:{b0['title']}", limit=100,
                    field_list="id,name,start_year,publisher,count_of_issues,site_detail_url")
            v = pick_volume(js.get("results"), b0)
            c["vol"][ekey] = {"id": v["id"], "name": v["name"]} if v else None
        vol = c["vol"][ekey]
        if not vol:
            continue
        vid = str(vol["id"])
        # 2. volume issue list (with arcs if Comic Vine provides them in lists)
        if vid not in c["vissues"]:
            items, off = [], 0
            while True:
                js = cv("issues/", filter=f"volume:{vid}", limit=100, offset=off,
                        field_list="id,issue_number,cover_date,story_arc_credits,site_detail_url")
                res = js.get("results") or []
                items += [{"id": x["id"], "n": ni(x.get("issue_number")), "url": x.get("site_detail_url", ""),
                           "arcs": [{"id": s["id"], "name": s["name"]} for s in (x.get("story_arc_credits") or [])]
                           if "story_arc_credits" in x else None} for x in res]
                off += len(res)
                if not res or off >= int(js.get("number_of_total_results") or 0):
                    break
            c["vissues"][vid] = items
            if c["listmode"] is None and items:
                c["listmode"] = any(i["arcs"] is not None for i in items)
                log(f"   issue lists {'INCLUDE' if c['listmode'] else 'do NOT include'} story arcs "
                    f"-> {'fast mode' if c['listmode'] else 'per-issue mode with arc expansion'}")
        byn = {i["n"]: i for i in c["vissues"][vid]}
        vol_ids = {i["id"] for i in c["vissues"][vid]}
        # 3. per issue (only if lists lack arcs), with arc expansion
        for b in grp:
            it = byn.get(b["issue"])
            if not it:
                continue
            arcs = it["arcs"]
            if arcs is None:
                iid = str(it["id"])
                if iid not in c["issue"]:
                    js = cv(f"issue/4000-{iid}/", field_list="id,story_arc_credits,site_detail_url")
                    r = js.get("results") or {}
                    c["issue"][iid] = [{"id": s["id"], "name": s["name"]} for s in (r.get("story_arc_credits") or [])]
                arcs = c["issue"][iid]
            if not arcs:
                continue
            arc = arcs[0]
            aid = str(arc["id"])
            if aid not in c["arc"]:
                js = cv(f"story_arc/4045-{aid}/", field_list="id,name,issues,site_detail_url")
                r = js.get("results") or {}
                ids = [x["id"] for x in (r.get("issues") or [])]
                c["arc"][aid] = {"name": r.get("name") or arc["name"], "ids": ids, "url": r.get("site_detail_url", "")}
                for x in ids:                            # expansion: every listed issue now knows its arc
                    c["issue"].setdefault(str(x), [{"id": arc["id"], "name": arc["name"]}])
            A = c["arc"][aid]
            same_vol = bool(A["ids"]) and all(x in vol_ids for x in A["ids"])
            part = length = finale = ""
            if same_vol:                                 # order by issue number, not CV's list order
                num = {i["id"]: i["n"] for i in c["vissues"][vid]}
                def nk(x):
                    try: return float(num[x])
                    except ValueError: return 1e9
                order = sorted(A["ids"], key=nk)
                part = order.index(it["id"]) + 1 if it["id"] in order else ""
                length, finale = len(order), num[order[-1]]
            found[(b["title"], b["vol"], b["issue"], b["year"])] = [
                A["name"], part, length, finale, "", "Stated", A["url"] or it["url"]]
        if n % 10 == 0 or n == len(eras):
            save_cache(c)
            log(f"  {n}/{len(eras)} series-eras  arcs found for {len(found)} books")
    save_cache(c)

    with open("cv_arcs.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(OUT_COLS)
        for (t, v, i, y), vals in found.items():
            w.writerow([t, v, i, y or ""] + vals)
    json.dump({"books": len(books), "found": len(found), "pct": round(100 * len(found) / max(len(books), 1), 1)},
              open("cv_summary.json", "w"))
    log(f"DONE  arcs for {len(found)}/{len(books)} books ({100 * len(found) / max(len(books), 1):.0f}%) -> cv_arcs.csv")
    log("Apply:  python3 brb_apply_arcs.py --csv cv_arcs.csv --fill-only   (dry run first)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    if not KEY:
        sys.exit("COMIC_VINE_API_KEY is not set - add it to ~/.zshrc, then: source ~/.zshrc")
    if os.path.exists(LOCK):
        try:
            os.kill(int(open(LOCK).read().strip()), 0)
            sys.exit("another Comic Vine run is active - not starting a second one")
        except (ValueError, ProcessLookupError, PermissionError):
            log("removing stale lock")
    open(LOCK, "w").write(str(os.getpid()))
    c = load_cache()
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt))
    code = 0
    try:
        run(a, c)
    except KeyboardInterrupt:
        log("stopped - cache saved, rerun to resume"); code = 130
    except Outage as e:
        log(f"OUTAGE: {e} - cache saved, rerun to resume"); code = 75
    finally:
        try:
            save_cache(c)
        finally:
            if os.path.exists(LOCK):
                os.remove(LOCK)
    sys.exit(code)


if __name__ == "__main__":
    main()
