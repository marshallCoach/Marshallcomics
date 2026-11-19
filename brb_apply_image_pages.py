#!/usr/bin/env python3
"""
brb_apply_image_pages.py -- fill a book's blanks from its Image Comics release page.

Paste the page on the book in Data Fix (the same link box as a Fandom page), e.g.
    https://imagecomics.com/comics/releases/g-i-joe-13
The page gives: Published date, Writer, Artists, Cover A artist, the cover image.
Fills BLANK cells only (Writer(s), Artist(s), Cover Artist, Publication Date, Year) and adds
the cover for the book's (title, issue, volume) key only when that key has no cover yet.
Nothing is ever overwritten, so a second run changes 0 cells.

Reads every data-fixes export (Downloads, repo, and processed_exports/ - brb_all archives
exports after the Fandom step, and links must not be lost). Pages are cached in
image_page_cache/. Dry run by default:
    python3 brb_apply_image_pages.py            # report what it WOULD fill
    python3 brb_apply_image_pages.py --apply
"""
import argparse, collections, datetime, glob, html, json, os, re, subprocess, sys, time, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ROOT, "image_page_cache")
UA = "Mozilla/5.0 (BRB comics inventory)"
LINK = re.compile(r"^https?://(?:www\.)?imagecomics\.com/comics/releases/[^/?#\s]+", re.I)
MONTHS = {m: i for i, m in enumerate(["january", "february", "march", "april", "may", "june", "july", "august",
                                       "september", "october", "november", "december"], 1)}


def ni(v):
    s = str(v if v is not None else "").strip().lstrip("#")
    try:
        f = float(s)
        return str(int(f)) if f == int(f) else s
    except ValueError:
        return s


def parse_release(page):
    """Image release page HTML -> {title, published 'YYYY-MM-DD', year, writer[], artists[],
    cover_artist[], cover_url, cover_large, price}."""
    txt = lambda s: html.unescape(re.sub(r"<[^>]+>", " ", s or "")).strip()
    out = {}
    m = re.search(r"<h1>(.*?)</h1>", page, re.S)
    out["title"] = re.sub(r"\s+", " ", txt(m.group(1))) if m else ""
    m = re.search(r"Published:\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})", page)
    if m and m.group(1).lower() in MONTHS:
        out["published"] = f"{m.group(3)}-{MONTHS[m.group(1).lower()]:02d}-{int(m.group(2)):02d}"
        out["year"] = m.group(3)
    m = re.search(r"Cover price:\s*(?:<b>)?\s*(\$[\d.]+)", page)
    out["price"] = m.group(1) if m else ""
    roles = collections.OrderedDict()
    for role, body in re.findall(r'<div\s+class="role"><h2>(.*?)</h2>(.*?)</div>', page, re.S):
        names = [re.sub(r"\s+", " ", txt(n)) for n in re.findall(r"<a[^>]*>(.*?)</a>", body, re.S)]
        roles[txt(role).lower()] = [n for n in names if n]
    out["writer"] = roles.get("writer") or roles.get("writers") or []
    out["artists"] = roles.get("artist") or roles.get("artists") or []
    cov = next((v for k, v in roles.items() if k in ("cover a", "cover", "cover artist", "cover artists")), [])
    out["cover_artist"] = cov
    m = re.search(r'<a[^>]*href="([^"]+)"[^>]*id="entry-cover-image"[^>]*>\s*<img[^>]*src="([^"]+)"', page, re.S) or \
        re.search(r'<a[^>]*id="entry-cover-image"[^>]*href="([^"]+)"[^>]*>\s*<img[^>]*src="([^"]+)"', page, re.S)
    if m:
        out["cover_large"], out["cover_url"] = m.group(1), m.group(2)
    return out


def fetch(url):
    os.makedirs(CACHE, exist_ok=True)
    f = os.path.join(CACHE, re.sub(r"[^A-Za-z0-9]+", "_", url.split("/releases/")[-1]) + ".html")
    if os.path.exists(f):
        return open(f, encoding="utf-8").read()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        page = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        # macOS Command Line Tools Python ships an old SSL library that imagecomics.com
        # refuses (TLSV1_ALERT_PROTOCOL_VERSION, Nov 19). The system curl negotiates fine.
        if "SSL" not in str(e) and "TLS" not in str(e) and "CERTIFICATE" not in str(e).upper():
            raise
        r = subprocess.run(["curl", "-sSL", "--max-time", "25", "-A", UA, url], capture_output=True)
        if r.returncode != 0 or not r.stdout:
            raise RuntimeError(f"urllib SSL error and curl failed too: {r.stderr.decode(errors='replace')[:120]}")
        page = r.stdout.decode("utf-8", "replace")
    open(f, "w", encoding="utf-8").write(page)
    time.sleep(0.5)
    return page


def load_links():
    """{(title, issue, box): url} from every data-fixes export, newest decision wins."""
    paths = set()
    for d in (os.path.expanduser("~/Downloads"), ROOT, os.path.join(ROOT, "processed_exports")):
        paths |= set(glob.glob(os.path.join(d, "*data-fixes*.json")))
    links = {}
    for p in sorted(paths, key=os.path.getmtime):
        try:
            recs = json.load(open(p))
        except Exception:  # noqa: BLE001
            continue
        for r in recs if isinstance(recs, list) else []:
            v = str(r.get("value", "")).strip() if isinstance(r, dict) else ""
            m = LINK.match(v)
            if m:
                links[(str(r.get("title", "")).strip(), ni(r.get("issue")), str(r.get("box", "")).strip())] = m.group(0)
    return links


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    links = load_links()
    if not links:
        print("no Image Comics release links in any data-fixes export - nothing to do")
        return
    import openpyxl
    sys.path.insert(0, ROOT)
    from brb_apply_arcs import newest_xlsx, INV
    src = newest_xlsx()
    wb = openpyxl.load_workbook(src)
    ws = [w for w in wb.worksheets if w.title.startswith(INV)][-1]
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]
    ci = lambda n: (H.index(n) + 1 if n in H else None)
    cT, cI, cV, cY, cB = ci("Title"), ci("Issue #"), ci("Volume"), ci("Year"), ci("Box #") or ci("Box")
    cols = {"Writer(s)": "writer", "Artist(s)": "artists", "Cover Artist": "cover_artist",
            "Publication Date": "published", "Year": "year"}
    rows = {}
    for r in range(2, ws.max_row + 1):
        t = str(ws.cell(r, cT).value or "").strip()
        if t:
            rows.setdefault((t, ni(ws.cell(r, cI).value), str(ws.cell(r, cB).value or "").strip() if cB else ""), r)
    cov_path = os.path.join(ROOT, "covers.json")
    cov = json.load(open(cov_path)) if os.path.exists(cov_path) else {}
    changes, new_covers, st = [], {}, collections.Counter()
    for (t, iss, box), url in links.items():
        r = rows.get((t, iss, box))
        if not r:
            st["row not found (title/issue/box changed?)"] += 1; continue
        try:
            d = parse_release(fetch(url))
        except Exception as e:  # noqa: BLE001
            st["page failed"] += 1; print(f"  FAIL {t} #{iss}: {e}"); continue
        if not d.get("title") or d["title"].startswith("404"):
            st["page not found (404)"] += 1; print(f"  404 {t} #{iss}: {url}  <- check the link on imagecomics.com"); continue
        st["pages read"] += 1
        for col, k in cols.items():
            c = ci(col)
            v = d.get(k)
            v = " & ".join(v) if isinstance(v, list) else (v or "")
            if c and v and not str(ws.cell(r, c).value or "").strip():
                changes.append((r, col, v))
        vol = ni(ws.cell(r, cV).value) if cV else "1"
        key = f"{t}|||{iss}|||{vol or '1'}"
        if d.get("cover_url") and not cov.get(key):
            new_covers[key] = {"url": d["cover_url"], "large": d.get("cover_large") or d["cover_url"],
                               "date": d.get("year", ""), "source": "image-page"}
        print(f"  {t} #{iss}: {d.get('published', '-')}  W/A/C={len(d['writer'])}/{len(d['artists'])}/{len(d['cover_artist'])}"
              f"  cover={'yes' if d.get('cover_url') else 'no'}")
    print(f"SOURCE: {os.path.basename(src)}   links: {len(links)}   " + "  ".join(f"{k}: {v}" for k, v in st.items()))
    print(f"cells to fill (blank only): {len(changes)}   covers to add: {len(new_covers)}")
    for r, col, v in changes[:20]:
        print(f"  row {r} {ws.cell(r, cT).value} #{ni(ws.cell(r, cI).value)}: {col} -> {v!r}")
    if not a.apply:
        print("DRY RUN - nothing written. Re-run with --apply.")
        return
    if not changes and not new_covers:
        print("nothing to write"); return
    from brb_guard import check
    check("image_pages", {"cells filled": len(changes), "covers added": len(new_covers)})
    for r, col, v in changes:
        ws.cell(r, ci(col)).value = v
    if changes:
        out = os.path.join(ROOT, "attached_assets", f"comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
        wb.save(out); print(f"WROTE: {os.path.basename(out)}")
    if new_covers:
        cov.update(new_covers)
        json.dump(cov, open(cov_path, "w"))                       # same format as the other cover steps
        pub = os.path.join(ROOT, "artifacts/comics-inventory/public/covers.json")
        if os.path.exists(os.path.dirname(pub)):
            json.dump(cov, open(pub, "w"))
        print(f"WROTE covers.json (+{len(new_covers)})")


if __name__ == "__main__":
    main()
