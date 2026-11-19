#!/usr/bin/env python3
"""
brb_dw_wiki.py -- Doctor Who (Titan) story arcs from the TARDIS wiki series pages.

Each series page (e.g. https://tardis.fandom.com/wiki/Doctor_Who:_The_Tenth_Doctor) has a
story table per year: # | Title | Writer | Featuring | Printed in | Released, where
"Printed in" names the issues, e.g. "10D 1-3", "10DY2 6 - 8, 10", "11DY3 9, 11".
  10D / 11D / 12D        = The Tenth / Eleventh / Twelfth Doctor - Year One
  10DY2 / 11DY3 / ...    = ... Year Two / Year Three
Every issue a story is printed in gets: Story Arc = the story title, Arc Part = its place in
that story, Arc Length, Finale Issue #. Backup-strip tables are ignored (main stories only).

READ-ONLY on the xlsx. Writes dw_arcs.csv in the brb_apply_arcs format, so the existing
safe writer applies it (blank cells only, every other column verified unchanged):
    python3 brb_dw_wiki.py                                   # fetch + report + dw_arcs.csv
    python3 brb_apply_arcs.py --csv dw_arcs.csv --fill-only  # dry run
    python3 brb_apply_arcs.py --csv dw_arcs.csv --fill-only --apply
Raw pages are cached in dw_wiki_cache/ (delete a file to refetch it).
"""
import argparse, collections, csv, html, json, os, re, sys, time, urllib.parse, urllib.request
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ROOT, "dw_wiki_cache")
OUT = os.path.join(ROOT, "dw_arcs.csv")
UA = "BRB-comics-inventory/1.0 (personal collection catalogue)"
PAGES = [  # (wiki host, page) - the series pages that hold the story tables
    ("tardis.fandom.com", "Doctor Who: The Tenth Doctor"),
    ("tardis.fandom.com", "Doctor Who: The Eleventh Doctor"),
    ("tardis.fandom.com", "Doctor Who: The Twelfth Doctor"),
]
DOC = {"9": "Ninth", "10": "Tenth", "11": "Eleventh", "12": "Twelfth", "13": "Thirteenth"}
YEAR = {"": "One", "1": "One", "2": "Two", "3": "Three", "4": "Four"}
NEW_COLS = ["Story Arc", "Arc Part", "Arc Length", "Finale Issue #",
            "Crossover Event (Fandom)", "Arc Confidence", "Arc Source"]


def norm(t):  # same as brb_apply_arcs.norm (dash style and punctuation ignored)
    return re.sub(r"[^a-z0-9]+", " ", str(t or "").lower().replace("&", " and ")).strip()


def ni(v):
    s = str(v if v is not None else "").strip().lstrip("#")
    try:
        f = float(s)
        return str(int(f)) if f == int(f) else s
    except ValueError:
        return s


# ---------------------------------------------------------------- page -> tables
class _Tables(HTMLParser):
    """Collects every table with the heading path it sits under. Cells keep rowspan/colspan."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.heads = []            # [(level, text)]
        self.tables = []           # [{"path": [...], "rows": [[(text, rs, cs)]]}]
        self._h = None; self._htext = []
        self._depth = 0; self._row = None; self._cell = None

    def handle_starttag(self, tag, a):
        a = dict(a)
        if re.fullmatch(r"h[2-6]", tag):
            self._h = int(tag[1]); self._htext = []
        elif tag == "table":
            self._depth += 1
            if self._depth == 1:
                self.tables.append({"path": [t for _, t in self.heads], "rows": []})
        elif self._depth == 1 and tag == "tr":
            self._row = []
        elif self._depth == 1 and tag in ("td", "th") and self._row is not None:
            num = lambda k: int(re.sub(r"\D", "", a.get(k) or "1") or 1)
            self._cell = [[], num("rowspan"), num("colspan")]
        elif tag == "br" and self._cell is not None:
            self._cell[0].append(" ")

    def handle_endtag(self, tag):
        if self._h and tag == f"h{self._h}":
            text = re.sub(r"\s+", " ", "".join(self._htext)).replace("[edit]", "").strip()
            self.heads = [h for h in self.heads if h[0] < self._h] + [(self._h, text)]
            self._h = None
        elif tag == "table":
            self._depth -= 1
        elif self._depth == 1 and tag in ("td", "th") and self._cell is not None:
            txt = re.sub(r"\s+", " ", "".join(self._cell[0])).strip()
            self._row.append((txt, self._cell[1], self._cell[2])); self._cell = None
        elif self._depth == 1 and tag == "tr" and self._row is not None:
            if self._row:
                self.tables[-1]["rows"].append(self._row)
            self._row = None

    def handle_data(self, d):
        if self._h:
            self._htext.append(d)
        if self._cell is not None:
            self._cell[0].append(d)


def grid(rows):
    """Expand rowspan/colspan so every row has every column (a writer spanning 3 rows
    is copied into each)."""
    out, pending = [], {}                     # col -> [text, rows_left]
    for row in rows:
        line, col = [], 0
        def spill():
            nonlocal col
            while col in pending and pending[col][1] > 0:
                line.append(pending[col][0]); pending[col][1] -= 1; col += 1
        for text, rs, cs in row:
            spill()
            for _ in range(cs):
                line.append(text)
                if rs > 1:
                    pending[col] = [text, rs - 1]
                col += 1
        spill()
        out.append(line)
    return out


def story_tables(page_html):
    """[(year_heading, [{'title','writer','printed','released'}])] for MAIN stories only."""
    p = _Tables(); p.feed(page_html)
    found = []
    for t in p.tables:
        path = " / ".join(t["path"])
        if re.search(r"backup", path, re.I):
            continue
        g = grid(t["rows"])
        if not g:
            continue
        head = [h.lower() for h in g[0]]
        if not any("printed" in h for h in head) or not any("title" in h for h in head):
            continue
        ix = lambda k: next((i for i, h in enumerate(head) if k in h), None)
        iT, iW, iP, iR = ix("title"), ix("writer"), ix("printed"), ix("released")
        rows = []
        for line in g[1:]:
            get = lambda i: (line[i] if i is not None and i < len(line) else "").strip()
            if get(iT) and get(iP):
                rows.append({"title": get(iT), "writer": get(iW), "printed": get(iP), "released": get(iR)})
        yh = next((x for x in reversed(t["path"]) if re.search(r"year", x, re.I)), t["path"][-1] if t["path"] else "")
        found.append((yh, rows))
    return found


# ---------------------------------------------------------------- "Printed in" -> issues
CODE = re.compile(r"\b(\d{1,2})D(?:Y(\d))?\b", re.I)


def printed_issues(text):
    """'10DY2 6 - 8, 10' -> [('10','2',[6,7,8,10])]  ('10D 1-3' -> year '' = One)."""
    out = []
    parts = list(CODE.finditer(text))
    for k, m in enumerate(parts):
        seg = text[m.end(): parts[k + 1].start() if k + 1 < len(parts) else len(text)]
        nums = []
        for a, b in re.findall(r"(\d+)\s*(?:[-–—]\s*(\d+))?", seg):
            a = int(a); b = int(b) if b else a
            if b >= a and b - a < 40:
                nums += list(range(a, b + 1))
        if nums:
            out.append((m.group(1), m.group(2) or "", nums))
    return out


def series_title(doc, year):
    return f"Doctor Who: The {DOC.get(doc, doc)} Doctor Year {YEAR.get(year, year)}"


def build(stories_by_page):
    """{(norm series title, issue): {arc fields}} from every parsed page."""
    plan = {}
    for url, tables in stories_by_page:
        for _, rows in tables:
            for s in rows:
                for doc, yr, nums in printed_issues(s["printed"]):
                    st = norm(series_title(doc, yr))
                    for n, iss in enumerate(nums, 1):
                        plan.setdefault((st, str(iss)), {
                            "Story Arc": html.unescape(s["title"]).strip(" /"),
                            "Arc Part": str(n) if len(nums) > 1 else "",
                            "Arc Length": str(len(nums)) if len(nums) > 1 else "",
                            "Finale Issue #": str(nums[-1]) if len(nums) > 1 else "",
                            "Crossover Event (Fandom)": "", "Arc Confidence": "Stated", "Arc Source": url,
                            "_writer": s["writer"], "_released": s["released"]})
    return plan


# ---------------------------------------------------------------- fetch
def fetch(host, page, refresh=False):
    os.makedirs(CACHE, exist_ok=True)
    f = os.path.join(CACHE, re.sub(r"[^A-Za-z0-9]+", "_", f"{host}_{page}") + ".json")
    if os.path.exists(f) and not refresh:
        return json.load(open(f))
    q = urllib.parse.urlencode({"action": "parse", "page": page, "prop": "text", "format": "json",
                                "formatversion": "2", "redirects": "1"})
    req = urllib.request.Request(f"https://{host}/api.php?{q}", headers={"User-Agent": UA})
    js = json.loads(urllib.request.urlopen(req, timeout=20).read().decode("utf-8"))
    json.dump(js, open(f, "w"))
    time.sleep(0.5)
    return js


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="ignore the page cache")
    a = ap.parse_args()
    pages = []
    for host, page in PAGES:
        url = f"https://{host}/wiki/{urllib.parse.quote(page.replace(' ', '_'), safe=':')}"
        try:
            js = fetch(host, page, a.refresh)
        except Exception as e:  # noqa: BLE001
            print(f"  FETCH FAILED {url}: {e}"); continue
        if "error" in js:
            print(f"  NOT FOUND {url}: {js['error'].get('info')}"); continue
        tables = story_tables(js["parse"]["text"])
        n = sum(len(r) for _, r in tables)
        print(f"{page}: {len(tables)} story table(s), {n} stories  " +
              ", ".join(f"{y}: {len(r)}" for y, r in tables))
        pages.append((url, tables))
    plan = build(pages)
    print(f"issues with an arc from the wiki: {len(plan)}")

    import openpyxl
    sys.path.insert(0, ROOT)
    from brb_apply_arcs import newest_xlsx, INV
    src = newest_xlsx()
    ws = [w for w in openpyxl.load_workbook(src, read_only=True).worksheets if w.title.startswith(INV)][-1]
    it = ws.iter_rows(values_only=True)
    H = [str(h).strip() if h is not None else "" for h in next(it)]
    g = lambda n: H.index(n) if n in H else None
    cT, cI, cY, cV, cA, cW = g("Title"), g("Issue #"), g("Year"), g("Volume"), g("Story Arc"), g("Writer(s)")
    out, st, miss = [], collections.Counter(), collections.Counter()
    for r in it:
        t = str(r[cT] or "").strip()
        if not norm(t).startswith("doctor who"):
            continue
        st["Doctor Who rows"] += 1
        p = plan.get((norm(t), ni(r[cI])))
        if not p:
            miss[t] += 1; continue
        st["matched"] += 1
        have = str(r[cA] or "").strip() if cA is not None else ""
        st["arc blank (will fill)" if not have else "arc already set (left alone)"] += 1
        w = str(r[cW] or "").strip() if cW is not None else ""
        if p["_writer"] and w and norm(p["_writer"].split(",")[0]) not in norm(w):
            st["writer differs from wiki (report only)"] += 1
        out.append({"title": t, "sheet_volume": ni(r[cV]) if cV is not None else "1", "issue": ni(r[cI]),
                    "year": r[cY], **{k: p[k] for k in NEW_COLS}})
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        wr = csv.DictWriter(f, ["title", "sheet_volume", "issue", "year"] + NEW_COLS)
        wr.writeheader(); wr.writerows(out)
    print(f"SOURCE: {os.path.basename(src)}")
    print("  ".join(f"{k}: {v}" for k, v in st.items()))
    if miss:
        print("Doctor Who rows the wiki tables don't cover (title: rows):")
        for t, n in miss.most_common(15):
            print(f"  {t}: {n}")
    for x in out[:12]:
        print(f"  {x['title']} #{x['issue']}: {x['Story Arc']}" +
              (f"  (part {x['Arc Part']} of {x['Arc Length']})" if x["Arc Part"] else ""))
    print(f"WROTE {os.path.basename(OUT)} ({len(out)} rows) - nothing written to the xlsx.")
    print("Next (dry run): python3 brb_apply_arcs.py --csv dw_arcs.csv --fill-only")


if __name__ == "__main__":
    main()
