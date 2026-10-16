#!/usr/bin/env python3
"""brb_credits_cv.py — Comic Vine fallback for Writer / Artist / Cover Artist.

Fills ONLY the credit cells GCD and Fandom couldn't reach — mostly Titan, IDW,
Image, Dark Horse and other non-Marvel/DC books that have no Fandom wiki. Comic
Vine covers those publishers well. Free API (needs COMIC_VINE_API_KEY; NO Claude
usage credits).

Same two-step match as the date fallback: resolve the volume by name + year +
publisher, then read that issue's person_credits:
  writer  -> Writer(s)
  penciler / artist (not cover) -> Artist(s)
  cover   -> Cover Artist
Fill-only by default (never overwrites an existing credit); unmatched rows stay
blank — never guessed. Writes a NEW dated xlsx; never edits the source.

    python3 brb_credits_cv.py            # fill remaining blank credits
    python3 brb_credits_cv.py --limit 50 # test on the first 50
Then: python3 brb.py --commit "credits — Comic Vine fallback" --yes
"""
import argparse, datetime, glob, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request
from collections import Counter

ROOT = os.path.dirname(os.path.abspath(__file__))
API_KEY = os.environ.get("COMIC_VINE_API_KEY", "").strip()
CV = "https://comicvine.gamespot.com/api"
UA = "BlackReadBrown-Comics/1.0"
CRED_COLS = {"writer": "Writer(s)", "artist": "Artist(s)", "cover": "Cover Artist"}


def _fn_key(f):
    m = re.search(r"_(\d{2})(\d{2})_(\d{2})(\d{2})", os.path.basename(f))
    if m:
        dd, mm, hh, mi = (int(x) for x in m.groups())
        return (1, mm, dd, hh, mi, os.path.getmtime(f))
    return (0, 0, 0, 0, 0, os.path.getmtime(f))


def newest_xlsx():
    cands = [f for f in glob.glob(os.path.join(ROOT, "attached_assets/comics_inventory_*.xlsx"))
             if " copy" not in f and not os.path.basename(f).startswith("~$")]
    if not cands:
        sys.exit("no attached_assets/comics_inventory_*.xlsx found")
    return max(cands, key=_fn_key)


def norm(t):
    return re.sub(r"[^a-z0-9]+", " ", str(t or "").lower()).strip()


def year_of(y):
    nums = [int(n) for n in re.findall(r"\d{4}", str(y or "")) if 1900 < int(n) < 2100]
    return nums[0] if nums else None


def is_blank(v):
    return v is None or str(v).strip() in ("", "nan", "None")


def cv_get(path, params, tries=6):
    params = {**params, "api_key": API_KEY, "format": "json"}
    url = f"{CV}/{path}/?{urllib.parse.urlencode(params)}"
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.load(r)
            if data.get("status_code") == 107:   # rate limited (JSON-level)
                time.sleep(30 * (i + 1))
                continue
            if data.get("status_code") == 100:
                sys.exit("Comic Vine says the API key is invalid — check COMIC_VINE_API_KEY")
            return data
        except urllib.error.HTTPError as e:
            # 420/429 = Comic Vine throttling at the HTTP layer (NOT a JSON body).
            # These need a long, linear cool-down — exponential-3s backs off too
            # little and just burns the retry budget, which is why the old run
            # "gave up" on every book. Wait 45s, 90s, 135s… and keep trying.
            if e.code in (420, 429):
                if i == tries - 1:
                    print(f"    ! still throttled (HTTP {e.code}) after {tries} tries — skipping")
                    return None
                time.sleep(45 * (i + 1))
                continue
            if i == tries - 1:
                print(f"    ! giving up on request: {e}")
                return None
            time.sleep(2 ** i * 3)
        except Exception as e:  # noqa: BLE001 — network hiccup: back off and retry
            if i == tries - 1:
                print(f"    ! giving up on request: {e}")
                return None
            time.sleep(2 ** i * 3)
    return None


def resolve_volume(cache, title, year, publisher):
    ck = (norm(title), year)
    if ck in cache:
        return cache[ck]
    data = cv_get("search", {"resources": "volume", "query": title,
                             "field_list": "id,name,start_year,publisher", "limit": "20"})
    best, best_score = None, -1e9
    for v in (data or {}).get("results", []) or []:
        score = 0
        if norm(v.get("name")) == norm(title):
            score += 10
        sy = v.get("start_year")
        try:
            sy = int(sy)
        except (TypeError, ValueError):
            sy = None
        if year and sy:
            score += 8 if abs(sy - year) <= 1 else (4 if abs(sy - year) <= 3 else -min(10, abs(sy - year)))
        pub = (v.get("publisher") or {}).get("name", "") if isinstance(v.get("publisher"), dict) else ""
        if publisher and pub:
            pl, pn = publisher.lower(), pub.lower()
            score += 5 if (pl in pn or pn in pl) else -3
        if score > best_score:
            best_score, best = score, v.get("id")
    cache[ck] = best
    time.sleep(1.0)
    return best


def _dedup(names):
    out = []
    for n in names:
        n = (n or "").strip()
        if n and n not in out:
            out.append(n)
    return ", ".join(out)


def issue_credits(vol_id, issue):
    """Return {'writer','artist','cover'} name strings for this issue, from
    Comic Vine's person_credits. Penciler is treated as the primary artist."""
    inum = str(issue).strip().lstrip("#")
    try:
        f = float(inum); inum = str(int(f)) if f == int(f) else inum
    except ValueError:
        pass
    data = cv_get("issues", {"filter": f"volume:{vol_id},issue_number:{inum}",
                             "field_list": "person_credits"})
    time.sleep(1.0)
    results = (data or {}).get("results", []) or []
    # results is a list of issue dicts; iterate (don't index) and take the first
    # one that actually carries person_credits. Comic Vine occasionally returns a
    # bare list for an empty result, so guard the type.
    pc = None
    for r in results:
        if isinstance(r, dict) and r.get("person_credits"):
            pc = r["person_credits"]
            break
    if not pc:
        return None
    writers, pencilers, artists, covers = [], [], [], []
    for p in pc:
        if not isinstance(p, dict):
            continue
        name = p.get("name", "")
        role = (p.get("role") or "").lower()
        if "writer" in role:
            writers.append(name)
        if "cover" in role:
            covers.append(name)
        if "pencil" in role:
            pencilers.append(name)
        elif "artist" in role or "inker" in role:
            artists.append(name)
    art = pencilers or artists   # prefer penciler as the interior artist
    return {"writer": _dedup(writers), "artist": _dedup(art), "cover": _dedup(covers)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--overwrite", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()
    if not API_KEY:
        sys.exit("COMIC_VINE_API_KEY not set. Add it to ~/.zshrc and: source ~/.zshrc")

    import openpyxl
    src = newest_xlsx()
    wb = openpyxl.load_workbook(src)
    ws = next(w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory"))
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]

    def ci(n):
        return H.index(n) + 1 if n in H else None
    cT, cI, cP, cY = ci("Title"), ci("Issue #"), ci("Publisher"), ci("Year")
    cCred = {role: ci(col) for role, col in CRED_COLS.items()}
    missing_cols = [col for role, col in CRED_COLS.items() if cCred[role] is None]
    if missing_cols:
        sys.exit(f"missing credit column(s): {missing_cols}")

    cache, stats, done = {}, Counter(), 0
    for r in range(2, ws.max_row + 1):
        title = str(ws.cell(r, cT).value or "").strip()
        if not title:
            continue
        # a row needs work if ANY credit cell is blank
        blanks = [role for role in CRED_COLS if is_blank(ws.cell(r, cCred[role]).value)]
        if not blanks and not args.overwrite:
            continue
        stats["rows_with_blank"] += 1
        if args.limit and done >= args.limit:
            continue
        done += 1
        issue = str(ws.cell(r, cI).value or "").strip() if cI else ""
        pub = str(ws.cell(r, cP).value or "").strip() if cP else ""
        year = year_of(ws.cell(r, cY).value) if cY else None
        vol = resolve_volume(cache, title, year, pub)
        if not vol:
            stats["no_volume"] += 1
            continue
        cr = issue_credits(vol, issue)
        if cr is None:
            stats["no_issue"] += 1
            continue
        touched = False
        for role in CRED_COLS:
            val = cr.get(role, "")
            if not val:
                continue
            cell = ws.cell(r, cCred[role])
            if args.overwrite or is_blank(cell.value):
                if is_blank(cell.value) or str(cell.value).strip() != val:
                    cell.value = val
                    stats[f"filled_{role}"] += 1
                    touched = True
        if touched:
            stats["rows_filled"] += 1
        if done % 25 == 0:
            print(f"  …{done} processed · {stats['rows_filled']} rows filled")

    out = os.path.join(ROOT, f"attached_assets/comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    print(f"\nSOURCE: {os.path.basename(src)}")
    print(f"OUTPUT: {os.path.basename(out)}")
    print("\nCOVERAGE")
    for k in ("rows_with_blank", "rows_filled", "filled_writer", "filled_artist",
              "filled_cover", "no_volume", "no_issue"):
        if stats[k]:
            print(f"  {k:16s} {stats[k]}")
    print("\nNext: python3 brb.py --commit \"credits — Comic Vine fallback\" --yes")


if __name__ == "__main__":
    main()
