#!/usr/bin/env python3
"""brb_apply_fandom_pages.py — make a dropped Fandom link true source of truth.

For every 'fandom' resolution in a Data Fix export, this OPENS the linked Fandom
page (not just the URL) and pulls the real publication date + cover, then fills
them for that issue AND its owned run-mates (same title, same volume from the
URL), year-gated so a wrong-era page is never used. Free (Fandom API, no usage $).

Fills:
  - Publication Date column (blank rows only, unless --overwrite)
  - covers.json volume-aware key  Title|||Issue|||Vol
  - Writer(s)/Artist(s)/Cover Artist from the infobox, via the same safe
    fill/union/conflict merge as brb_credits_gcd (never downgrades a name).
    Best free credit source for the not-in-GCD books GCD couldn't reach.

Runs on the Mac. Writes a NEW dated xlsx (never edits in place) + covers.json.
Dry-run by default.

    python3 brb_apply_fandom_pages.py --flags ~/Downloads/data-fixes-merged.json
    python3 brb_apply_fandom_pages.py --flags ~/Downloads/data-fixes-merged.json --apply
Then: python3 brb.py --commit "apply Fandom page data" --yes
"""
import argparse, datetime, glob, json, os, re, sys, time, urllib.parse, urllib.request

from brb_credits_gcd import decide, nk, PLACEHOLDERS  # same safe fill/union/conflict merge

ROOT = os.path.dirname(os.path.abspath(__file__))
COVERS = os.path.join(ROOT, "covers.json")
PUBLIC = os.path.join(ROOT, "artifacts/comics-inventory/public/covers.json")
UA = "BlackReadBrown-Comics/1.0"
DELAY = 1.5   # gentle pacing — 0.4s hammered Fandom and triggered throttling
MONTHS = {m.lower(): i for i, m in enumerate(
    ["", "January", "February", "March", "April", "May", "June", "July",
     "August", "September", "October", "November", "December"])}


def ni(v):
    # issue "0" (AvX #0 etc.) reads from xlsx as int 0. `str(v or "")` turns that
    # into "" — a falsy-zero trap that made #0 look blank and get skipped, so the
    # Fandom date/cover fill never ran for it. Coalesce only None, never 0.
    s = ("" if v is None else str(v)).strip().lstrip("#")
    try:
        f = float(s); return str(int(f)) if f == int(f) else s
    except ValueError:
        return s


def nv(v):
    try:
        return str(int(float(str(v).strip())))
    except (ValueError, TypeError):
        return "1"


def yr(v):
    n = [int(t) for t in re.findall(r"\d{4}", str(v or "")) if 1900 < int(t) < 2100]
    return n[0] if n else None


# Marvel/DC Fandom infobox credit fields. The Marvel Database template uses
# numbered fields (Writer1_1, Penciler1_1, CoverArtist1); some pages use plain
# Writers=/Pencilers=/CoverArtists=. Match both.
CRED_PATS = {
    "writer": r"\|\s*Writers?\d*_?\d*\s*=\s*([^\n|]+)",
    # Marvel/DC: Penciler1_1 / Artist1. Franchise wikis (Power Rangers ComicInfo): pencils= / penciller=
    "artist": r"\|\s*(?:Pencil(?:l?ers?|s)|Artists?)\d*_?\d*\s*=\s*([^\n|]+)",
    # Marvel Database credits the COVER via Image1_Artist1/2 (the artists of the
    # primary cover image), not a CoverArtist field. Match both, but only
    # Image1_* (Image2_* is the variant/textless cover).
    "cover":  r"\|\s*(?:Cover\s?_?Artists?\d*|Image1_Artists?\d*)\s*=\s*([^\n|]+)",
}


def clean_credit(raw):
    """One infobox value -> list of creator names. Unwraps [[Link|Text]] (keeps
    the link target), drops {{templates}} and wiki markup, splits on ; / ,."""
    raw = re.sub(r"\{\{[^}]*\}\}", " ", raw or "")
    raw = re.sub(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]", r"\1", raw)  # [[A|B]] -> A
    raw = raw.replace("[[", " ").replace("]]", " ").replace("'''", " ")
    out = []
    for p in re.split(r"\s*(?:;|/|,| and )\s*", raw):
        p = p.strip()
        if p and nk(p) not in PLACEHOLDERS:
            out.append(p)
    return out


def infobox_names(wt, pat):
    """All creator names for a role (dedup, order-preserving)."""
    out, seen = [], set()
    for m in re.findall(pat, wt, re.I):           # Memory Alpha uses lower-case "writer ="
        for nm in clean_credit(m):
            if nk(nm) not in seen:
                seen.add(nk(nm)); out.append(nm)
    return out


def parse_url(u):
    """(api_base, canonical_title, vol, url_issue) from a .../wiki/Title_Vol_N_ISS
    URL. url_issue is the issue named in the link ('' if the URL has none); it is
    authoritative for the seed row and handles legacy numbering (a book filed as
    #498 whose page is Vol 3 #83)."""
    m = re.match(r"https?://([^/]+)/wiki/(.+)", u or "")
    if not m:
        return None
    base = f"https://{m.group(1)}/api.php"
    path = urllib.parse.unquote(re.split(r"[?#]", m.group(2))[0])      # drop ?file=... / #anchors
    vm = re.search(r"^(.*?)_Vol_(\d+)(?:_(.+))?$", path)  # trailing issue optional
    if not vm:
        # Memory Alpha (and other franchise wikis): "<Series>,_Issue_N" -> vol marker ISSUE
        # Franchise wikis: "<Series>,_Issue_N" (Memory Alpha), "<Series>_Issue_N" (Power
        # Rangers), optionally "..._(2026)". The marker remembers comma + year so run-mates
        # (other issues of the same series) are built exactly the same way.
        im = re.search(r"^(.*?)(,?)_Issue_([^_/?#]+)(?:_\((\d{4})\))?$", path)
        if im:
            mark = f"ISSUE:{'c' if im.group(2) else ''}:{im.group(4) or ''}"
            return base, im.group(1).replace("_", " ").strip(), mark, ni(im.group(3))
        return None
    return base, vm.group(1).replace("_", " ").strip(), vm.group(2), (ni(vm.group(3)) if vm.group(3) else "")


_PAGE_CACHE = {}


def fetch_page(base, title, vol, issue):
    """Cached wrapper: a page (found or missing) is requested at most once per run."""
    k = (base, title, str(vol), str(issue))
    if k not in _PAGE_CACHE:
        _PAGE_CACHE[k] = _fetch_page(base, title, vol, issue)
    return _PAGE_CACHE[k]


def _fetch_page(base, title, vol, issue):
    """Return (image_filename, date_str 'YYYY-MM-00', page_year, credits) or None.
    credits = {'writer':[...], 'artist':[...], 'cover':[...]} from the infobox."""
    if not str(issue).strip():   # never request "Title Vol N " (blank issue) — it
        return None              # resolves to a junk page and stalls the fetch
    if str(vol).startswith("ISSUE"):
        _, comma, year = (str(vol) + "::").split(":")[:3]
        page = f"{title}{',' if comma else ''} Issue {issue}" + (f" ({year})" if year else "")
    else:
        page = f"{title} Vol {vol} {issue}"
    u = base + "?" + urllib.parse.urlencode({
        "action": "parse", "page": page,
        "prop": "wikitext", "format": "json", "formatversion": 2, "redirects": 1})
    try:
        d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=8))
        time.sleep(DELAY)
    except Exception:
        time.sleep(DELAY); return None
    wt = d.get("parse", {}).get("wikitext", "")
    if not wt:
        return None
    fn = cover_file(wt)
    date_str, py, mon = None, None, 0
    # 1) a single CoverDate / ReleaseDate / Cover Date parameter (with or w/o space).
    #    Memory Alpha: "published =" is the real-world date; its bare "date =" can be an
    #    in-universe year, so franchise (ISSUE-style) pages never read a bare Date.
    dm = (re.search(r"\|\s*(?:published|publication\s*date)\s*=\s*([^\n|]+)", wt, re.I)
          or re.search(r"\|\s*(?:Cover\s*Date|Release\s*Date" + ("" if str(vol).startswith("ISSUE") else "|Date") + r")\s*=\s*([^\n|]+)", wt, re.I))
    if dm:
        raw = dm.group(1)
        py = yr(raw)
        mon = next((MONTHS[w.lower()] for w in re.findall(r"[A-Za-z]+", raw) if w.lower() in MONTHS), 0)
    # 2) separate | Month = / | Year = fields — the DC/Marvel Database comic infobox
    #    uses these, so CoverDate-only parsing missed every such page (e.g. most DC).
    if not py:
        ym = re.search(r"\|\s*Year\s*=\s*([^\n|]+)", wt, re.I)
        if ym:
            py = yr(ym.group(1))
        mm = re.search(r"\|\s*Month\s*=\s*([^\n|]+)", wt, re.I)
        if mm and not mon:
            raw = mm.group(1)
            mon = next((MONTHS[w.lower()] for w in re.findall(r"[A-Za-z]+", raw) if w.lower() in MONTHS), 0)
            if not mon:
                nm = re.search(r"\b(\d{1,2})\b", raw)
                if nm and 1 <= int(nm.group(1)) <= 12:
                    mon = int(nm.group(1))
    if py:
        date_str = f"{py}-{mon:02d}-00"
    if not py and not str(vol).startswith("ISSUE"):
        py = yr(wt[:400])
    credits = {role: infobox_names(wt, pat) for role, pat in CRED_PATS.items()}
    if not fn:                                   # no image in the wikitext layout we know:
        fn = page_image(base, page)              # ask the wiki for the page's lead image
    return (fn, date_str, py, credits)


def fetch_best(base, title, cand_vols, issue, target_year, memo):
    """Find the right wiki page for (title, issue) by YEAR, not by a volume number.
    The inventory's Volume column is unreliable and a dropped link can name the
    wrong volume (one series name — e.g. 'Mighty Thor' — spans Vol 1/2/3 on the
    wiki). So probe candidate volumes and return (vol, result) for the page whose
    year is within 2y of target_year; otherwise the first page that exists. Memoized
    per (title, era) so a run probes each era only once."""
    k = (title.lower(), target_year or 0)
    order = ([memo[k]] + [v for v in cand_vols if v != memo[k]]) if k in memo else list(cand_vols)
    fallback = None
    for v in order:
        res = fetch_page(base, title, v, issue)
        if not res:
            continue
        py = res[2]
        if target_year and py and abs(py - target_year) <= 2:
            memo[k] = v
            return v, res
        if fallback is None:
            fallback = (v, res)
    return fallback


IMG_EXT = r"\.(?:jpe?g|png|webp|gif)"


def cover_file(wt):
    """Cover image filename from ANY wiki's infobox. Marvel/DC use "| Image1 = x.jpg";
    franchise wikis use "| image = ...", "| cover = ...", "[[File:x.jpg|250px]]" or a
    <gallery>. First match in that order; case-insensitive; .jpg/.png/.webp/.gif."""
    for pat in (r"\|\s*(?:Image1?|image|cover(?:\s*image)?|cover1|img)\s*=\s*(?:\[\[)?(?:File:|Image:)?([^\n|\]=]+?" + IMG_EXT + r")",
                r"\[\[\s*(?:File|Image):([^\n|\]]+?" + IMG_EXT + r")",
                r"<gallery[^>]*>\s*(?:File:|Image:)?([^\n|]+?" + IMG_EXT + r")"):
        m = re.search(pat, wt or "", re.I)
        if m:
            return m.group(1).strip()
    return None


def page_image(base, page):
    """Fallback: the wiki's own lead image for the page (PageImages API) -> 'url:<full url>'."""
    try:
        u = base + "?" + urllib.parse.urlencode({"action": "query", "titles": page, "prop": "pageimages",
                                                 "piprop": "original", "redirects": 1, "format": "json", "formatversion": 2})
        d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=8))
        time.sleep(DELAY)
        for p in d.get("query", {}).get("pages", []):
            src = (p.get("original") or {}).get("source")
            if src:
                return "url:" + src.split("/revision/")[0]
    except Exception:  # noqa: BLE001
        pass
    return None


def img_url(base, fn):
    if str(fn).startswith("url:"):               # already a full image URL (from page_image)
        return fn[4:]
    try:
        u = base + "?" + urllib.parse.urlencode({
            "action": "query", "titles": "File:" + fn, "prop": "imageinfo",
            "iiprop": "url", "format": "json", "formatversion": 2})
        d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=8))
        time.sleep(DELAY)
        for p in d.get("query", {}).get("pages", []):
            if "imageinfo" in p:
                return p["imageinfo"][0]["url"].split("/revision/")[0]
    except Exception:
        pass
    return None


def _fn_key(f):
    # Prefer the DDMM_HHMM timestamp in the filename over mtime: a git checkout
    # can refresh a stale file's mtime and make it wrongly "newest".
    m = re.search(r"_(\d{2})(\d{2})_(\d{2})(\d{2})", os.path.basename(f))
    if m:
        dd, mm, hh, mi = (int(x) for x in m.groups())
        return (1, mm, dd, hh, mi, os.path.getmtime(f))
    return (0, 0, 0, 0, 0, os.path.getmtime(f))


def newest_xlsx():
    m = [f for f in glob.glob(os.path.join(ROOT, "attached_assets/comics_inventory_*.xlsx"))
         if " copy" not in f and not os.path.basename(f).startswith("~$")]
    if not m:
        sys.exit("no attached_assets/comics_inventory_*.xlsx found")
    return max(m, key=_fn_key)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--flags", help="path to a data-fixes export")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--overwrite", action="store_true")
    args = ap.parse_args()

    # Read EVERY data-fixes export, not just the newest. Users accumulate several
    # (one per working session), so grabbing only max(mtime) silently stranded the
    # links in older exports — a book linked two sessions ago never got applied.
    # Merge all, oldest first, de-duping identical records (same kind+title+issue+
    # box+url). --flags still scopes to one explicit file.
    if args.flags:
        paths = [args.flags] if os.path.exists(args.flags) else []
    else:
        paths = [p for p in set(glob.glob(os.path.expanduser("~/Downloads/data-fixes*.json")) +
                                glob.glob("data-fixes*.json")) if os.path.exists(p)]
        paths.sort(key=os.path.getmtime)
    if not paths:
        sys.exit("no data-fixes export found — pass --flags <path>")
    all_recs, _seen = [], set()
    for _p in paths:
        try:
            _recs_in = json.load(open(_p))
        except Exception:  # a half-written/corrupt export never kills the run
            print(f"  (skipped unreadable export: {os.path.basename(_p)})")
            continue
        for _r in (_recs_in if isinstance(_recs_in, list) else []):
            if not isinstance(_r, dict):
                continue
            _k = (_r.get("kind"), str(_r.get("title", "")).lower(),
                  str(_r.get("issue", "")), str(_r.get("box", "")), _r.get("value") or "")
            if _k in _seen:
                continue
            _src = os.path.basename(_p)
            # machine-made, not user-vouched: extrapolated / autolink files, links Data Fix built from a
            # sibling ("auto": true), and legacy-number volume links (they fix Volume, never move the Year)
            _r["_auto"] = ("extrapolated-auto" in _src) or ("autolink" in _src) or bool(_r.get("auto")) \
                or _r.get("problem") == "legacy-volume"
            _seen.add(_k); all_recs.append(_r)
    print(f"Exports merged: {len(paths)} ({', '.join(os.path.basename(p) for p in paths)})")
    recs = [r for r in all_recs if r.get("kind") == "fandom"
            and ("_Vol_" in (r.get("value") or "") or re.search(r"_Issue_|%20Issue%20", r.get("value") or ""))]
    img_recs = [r for r in all_recs if r.get("kind") == "image" and (r.get("value") or "").startswith("http")]
    print(f"FANDOM links to open: {len(recs)}   direct image links: {len(img_recs)}")

    import openpyxl
    src = newest_xlsx()
    wb = openpyxl.load_workbook(src)
    # Write to the LAST "✅ Clean Inventory" tab — the newest snapshot, the same
    # one gen_data.mjs reads (invSheets[-1]). Picking the first tab wrote fixes to
    # a stale snapshot the app never reads, which is why edits went invisible.
    _inv = [w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory")]
    ws = _inv[-1]
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]

    def ci(n):
        return H.index(n) + 1 if n in H else None
    cT, cI, cY, cV, cPD = ci("Title"), ci("Issue #"), ci("Year"), ci("Volume"), ci("Publication Date")
    cB = ci("Box #") or ci("Box")
    if cPD is None:
        cPD = ws.max_column + 1; ws.cell(1, cPD, "Publication Date")
    CRED_COLS = {"writer": ci("Writer(s)"), "artist": ci("Artist(s)"), "cover": ci("Cover Artist")}

    # index rows by lowercase title
    from collections import defaultdict
    by_title = defaultdict(list)
    for r in range(2, ws.max_row + 1):
        t = str(ws.cell(r, cT).value or "").strip()
        if t:
            by_title[t.lower()].append(r)

    cov = json.load(open(COVERS))
    vol_memo = {}      # (title, era) -> wiki volume that matched, so each era probes once
    done_rows = set()  # run-mate rows already handled this run (many links can name one title)
    # One link pasted onto several copies of the same issue from DIFFERENT eras (e.g. six
    # Moon Knight #2s, 2006-2022, all given the 2026 page) can't be the truth for all of
    # them. Such links lose "seed" status: they stay year-gated and never rewrite a Year.
    _url_years = defaultdict(set)
    for rec in recs:
        if rec.get("_auto"):
            continue
        ri, rb = ni(rec.get("issue")), str(rec.get("box") or "").strip()
        for r in by_title.get(str(rec.get("title") or "").lower(), []):
            if ni(ws.cell(r, cI).value) == ri and (not cB or str(ws.cell(r, cB).value or "").strip() == rb):
                y = yr(ws.cell(r, cY).value)
                if y:
                    _url_years[rec.get("value")].add(y)
    shared_links = {u for u, ys in _url_years.items() if max(ys) - min(ys) > 2}
    if shared_links:
        print(f"  {len(shared_links)} link(s) were pasted on copies from different eras - year-gated, Years untouched")
    dates_set = covers_set = 0
    cred_counts = {"writer": 0, "artist": 0, "cover": 0}
    cred_changes = []
    years_fixed = []
    for i, rec in enumerate(recs, 1):
        # Heartbeat + flush every 10 records so a stall is never silent and a
        # Ctrl-C never loses fetched covers (covers.json otherwise saves only at
        # the very end). The xlsx (dates/credits) still saves at the end.
        if i % 10 == 1 or i == len(recs):
            print(f"  [{i}/{len(recs)}] …", flush=True)
            if args.apply:
                json.dump(cov, open(COVERS, "w"))
        pu = parse_url(rec.get("value"))
        if not pu:
            continue
        base, canon, vol, url_issue = pu
        # "...?file=<image>" names the exact cover you want (e.g. a textless variant)
        _q = urllib.parse.parse_qs(urllib.parse.urlparse(rec.get("value") or "").query)
        forced_file = (_q.get("file") or [""])[0].replace("+", " ").strip()
        sheet_title = rec.get("title") or ""
        rec_issue = ni(rec.get("issue"))
        rec_box = str(rec.get("box") or "").strip()
        wcol = CRED_COLS.get("writer")
        for r in by_title.get(sheet_title.lower(), []):
            issue = ni(ws.cell(r, cI).value)
            if not issue:            # blank issue -> "Title Vol N " builds a junk
                continue             # page that stalls the fetch; skip these rows
            # The exact row the user linked (same issue + box) is the SEED: the
            # user has vouched for this page, so it is authoritative. Fetch by the
            # issue named in the URL (handles legacy numbering, e.g. a #498 book
            # whose page is Vol 3 #83), and — since "links are truth" — skip the
            # year-gate and correct a wrong inventory Year to the page's year.
            # Every other same-title row is a run-mate: year-gated as before, so a
            # wrong-era page can never leak across the run.
            # Only a link YOU pasted is a "seed" (trusted over the sheet's Year). Automatic
            # links (extrapolated / autolink) stay year-gated like any run-mate.
            is_seed = (issue == rec_issue and not rec.get("_auto") and rec.get("value") not in shared_links and
                       (not cB or str(ws.cell(r, cB).value or "").strip() == rec_box) and
                       # a record pinned to a year (legacy links) vouches for that copy only -
                       # another era's copy in the same box stays a year-gated run-mate (Nov 24)
                       (not rec.get("year") or str(ws.cell(r, cY).value or "").strip()[:4] == str(rec.get("year"))[:4]))
            if not is_seed:                      # same row + same wiki series: once per run
                if (r, base, canon) in done_rows:
                    continue
                done_rows.add((r, base, canon))
            # Already complete -> don't re-fetch. This is why the whole run (e.g.
            # all 66 Avengers) re-ran every pass: the fetch was unconditional.
            # Only fetch a row that's still missing a cover, a date, or a writer
            # (the seed always runs — the user resubmitted it for a reason).
            if not args.overwrite and not is_seed:
                volk = nv(ws.cell(r, cV).value)
                e = cov.get(f"{sheet_title}|||{issue}|||{volk}") or cov.get(f"{sheet_title}|||{issue}")
                has_cover = bool(e.get("url") if isinstance(e, dict) else e)
                has_date = bool(str(ws.cell(r, cPD).value or "").strip())
                has_writer = bool(wcol and str(ws.cell(r, wcol).value or "").strip())
                if has_cover and has_date and has_writer:
                    continue
            ry = yr(ws.cell(r, cY).value)
            # Probe volumes by year: the linked/sheet volume may be wrong, so find
            # the wiki page whose year matches this row (handles a series split
            # across Vol 1/2/3). The seed still prefers the issue named in the URL.
            if str(vol).startswith("ISSUE"):
                cand = [vol]
            elif is_seed:                          # a link you pasted: worth a full volume search
                cand = [vol] + [str(x) for x in range(1, 8) if str(x) != vol]
            else:                                  # run-mates: only the likely volumes (2-3 requests, not 8)
                cand = list(dict.fromkeys([vol, nv(ws.cell(r, cV).value)] +
                                          ([str(vol_memo[(canon.lower(), ry or 0)])] if (canon.lower(), ry or 0) in vol_memo else [])))
                cand = [c for c in cand if c]
            print(f"    · {sheet_title} #{issue} …", flush=True)     # always visibly alive
            got = fetch_best(base, canon, cand, (url_issue if (is_seed and url_issue) else issue), ry, vol_memo)
            if not got:
                continue
            _used_vol, res = got
            fn, date_str, py, credits = res
            if is_seed and forced_file:
                fn = forced_file
            if not is_seed and ry and py and abs(py - ry) > 2:   # year-gate: run-mates only
                continue
            if is_seed and py and (not ry or abs(py - ry) > 1):
                # user-vouched link wins: bring a wrong/blank inventory Year onto
                # the page's year so the book stops re-flagging as a conflict.
                if args.apply:
                    ws.cell(r, cY, str(py))
                years_fixed.append([sheet_title, issue, ry or "(blank)", py])
                year_moved = True
            else:
                year_moved = False
            # When your link moves the Year, the old on-sale date belonged to the wrong
            # era too - replace it, or brb_year_from_pubdate flips the Year straight back.
            if date_str and (args.overwrite or year_moved or not str(ws.cell(r, cPD).value or "").strip()):
                if args.apply:
                    ws.cell(r, cPD, date_str)
                dates_set += 1
            if fn:
                url = img_url(base, fn)
                key = f"{sheet_title}|||{issue}|||{nv(ws.cell(r, cV).value)}"
                # An existing cover from another era (stored page year >2y off this copy's
                # Year) is replaced by a year-matched page: heals covers written under a
                # wrong Volume (Nov 24 legacy batches).
                _old = cov.get(key) if isinstance(cov.get(key), dict) else {}
                _od = int(str(_old.get("date") or "0")[:4] or 0) if str(_old.get("date") or "")[:4].isdigit() else 0
                wrong_era = bool(_od and ry and py and abs(_od - ry) > 2 and abs(py - ry) <= 2)
                if url and (args.overwrite or (is_seed and forced_file) or wrong_era or key not in cov or not (cov.get(key) or {})):
                    if args.apply:
                        cov[key] = {"url": url, "large": url, "date": str(py or ""), "source": "fandom-page"}
                    covers_set += 1
            # credits — same safe fill/union/conflict merge as the GCD run
            for role, col in CRED_COLS.items():
                if not col:
                    continue
                action, newv = decide(ws.cell(r, col).value, credits.get(role, []))
                if not action:
                    continue
                # Only a link YOU pasted on this exact book may REPLACE credits (zero overlap).
                # Run-mates and sibling-built / automatic links are guesses: fill & add only.
                # (Nov 20: 88 replacements, mostly from links copied across a run, hit the guard.)
                if action == "CONFLICT" and not is_seed:
                    cred_changes.append([sheet_title, issue, role, "CONFLICT-SKIPPED (not your link)", str(ws.cell(r, col).value or ""), newv])
                    continue
                old = str(ws.cell(r, col).value or "")
                if args.apply:
                    ws.cell(r, col, newv)
                cred_counts[role] += 1
                cred_changes.append([sheet_title, issue, role, action, old, newv])
            print(f"  {sheet_title} #{issue}: date={date_str or '—'} cover={'yes' if fn else 'no'} "
                  f"W/A/C={len(credits['writer'])}/{len(credits['artist'])}/{len(credits['cover'])}")

    # Direct image links (kind="image" from the Cover modal's "Save image") —
    # set the volume-aware covers.json key straight to the pasted URL, no fetch.
    imgs_set = 0
    for rec in img_recs:
        sheet_title = rec.get("title") or ""
        url = (rec.get("value") or "").strip()
        for r in by_title.get(sheet_title.lower(), []):
            if str(rec.get("issue") or "") and ni(ws.cell(r, cI).value) != ni(rec.get("issue")):
                continue
            key = f"{sheet_title}|||{ni(ws.cell(r, cI).value)}|||{nv(ws.cell(r, cV).value)}"
            if args.overwrite or key not in cov or not (cov.get(key) or {}):
                if args.apply:
                    cov[key] = {"url": url, "large": url, "source": "manual-link"}
                imgs_set += 1
                print(f"  image: {sheet_title} #{ni(ws.cell(r, cI).value)} -> {url[:60]}")

    if cred_changes:
        import csv as _csv
        cp = os.path.join(ROOT, "credits_fandom_changes.csv")
        with open(cp, "w", newline="") as f:
            w = _csv.writer(f); w.writerow(["Title", "Issue", "Role", "Action", "Old", "New"]); w.writerows(cred_changes)
        print(f"\nCredit change log: {os.path.basename(cp)} ({len(cred_changes)} rows)")

    print(f"\nDates to set: {dates_set}   Covers to set: {covers_set}   Direct image links: {imgs_set}")
    print(f"Credits — writer {cred_counts['writer']}  artist {cred_counts['artist']}  cover {cred_counts['cover']}")
    if years_fixed:
        print(f"\nYears corrected from user-linked pages (links are truth): {len(years_fixed)}")
        for t, iss, old, new in years_fixed[:30]:
            print(f"   {t} #{iss}: {old} -> {new}")
    if not args.apply:
        print("DRY RUN — nothing written. Re-run with --apply.")
        return
    from brb_guard import check
    check("fandom_pages", {"Years overwritten": len(years_fixed),
                           "credits replaced (CONFLICT)": sum(1 for c in cred_changes if c[3] == "CONFLICT")})
    out = os.path.join(ROOT, f"attached_assets/comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    json.dump(cov, open(COVERS, "w"))
    if os.path.exists(PUBLIC):
        json.dump(cov, open(PUBLIC, "w"))
    print(f"WROTE: {os.path.basename(out)}  (+ covers.json)")
    print("Next: python3 brb.py --commit \"apply Fandom page data\" --yes")


if __name__ == "__main__":
    main()
