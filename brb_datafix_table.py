#!/usr/bin/env python3
"""brb_datafix_table.py — export the Data Fix worklist as a spreadsheet.

Builds one row per book that (a) appears on the Data Fix page (has a data problem)
AND (b) has a cover, then lists everything we hold for it — credits, date, box,
the cover image URL + source, and any Fandom link you supplied for it (joined from
the data-fix exports in ~/Downloads + processed_exports/). Opens in Excel/Numbers.

Problems mirror the app exactly: no-date, date-conflict (pub-date year vs Year >1),
no-volume, no-year, likely-variant (Box CC1), not-in-gcd (from gcd_notfound.json).

    python3 brb_datafix_table.py            # -> ~/Downloads/datafix_covers_table.csv
    python3 brb_datafix_table.py --out foo.csv --all   # --all = include no-cover rows too
"""
import argparse, csv, glob, json, os, re, sys, urllib.parse
import openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "attached_assets")
DOWNLOADS = os.path.expanduser("~/Downloads")
PROCESSED = os.path.join(ROOT, "processed_exports")
COVERS = os.path.join(ROOT, "covers.json")
GCD_NF = os.path.join(ROOT, "artifacts/comics-inventory/public/gcd_notfound.json")


def _fn_key(f):
    m = re.search(r"_(\d{2})(\d{2})_(\d{2})(\d{2})", os.path.basename(f))
    if m:
        dd, mm, hh, mi = (int(x) for x in m.groups())
        return (1, mm, dd, hh, mi, os.path.getmtime(f))
    return (0, 0, 0, 0, 0, os.path.getmtime(f))


def newest_xlsx():
    c = [f for f in glob.glob(os.path.join(ASSETS, "comics_inventory_*.xlsx"))
         if " copy" not in f and not os.path.basename(f).startswith("~$")]
    if not c:
        sys.exit("no attached_assets/comics_inventory_*.xlsx found")
    return max(c, key=_fn_key)


def norm_title(t):
    t = str(t or "").lower().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def norm_issue(i):
    s = str(i or "").replace("#", "").strip()
    return re.sub(r"^0+(\d)", r"\1", s)


def comp(t):
    return re.sub(r"[^a-z0-9]+", "", re.sub(r"^the\s+", "", str(t or "").lower()))


def ni(i):
    return re.sub(r"\.0$", "", str(i or "").replace("#", "").strip())


def load_covers():
    cov = json.load(open(COVERS))
    exact = {k: v for k, v in cov.items() if isinstance(v, dict) and v.get("url")}
    groups = {}
    for k, v in exact.items():
        p = k.split("|||")
        if len(p) >= 2:
            groups.setdefault(f"{norm_title(p[0])}|||{norm_issue(p[1])}", set()).add(v["url"])
    norm_idx = {nk: next(iter(u)) for nk, u in groups.items() if len(u) == 1}
    return cov, exact, norm_idx


def cover_for(cov, exact, norm_idx, title, issue, vol):
    iss = str(issue)
    for k in (f"{title}|||{iss}|||{vol}", f"{title}|||{iss}", f"{title}|||#{iss.lstrip('#')}"):
        if k in exact:
            return exact[k].get("url"), exact[k].get("source", "")
    nk = f"{norm_title(title)}|||{norm_issue(iss)}"
    if nk in norm_idx:
        return norm_idx[nk], "normalized-match"
    return None, ""


def load_links():
    idx = {}
    for d in (DOWNLOADS, PROCESSED):
        for f in glob.glob(os.path.join(d, "*.json")):
            if "data-fix" not in os.path.basename(f).lower():
                continue
            try:
                recs = json.load(open(f))
            except Exception:  # noqa: BLE001
                continue
            for rec in (recs if isinstance(recs, list) else []):
                if isinstance(rec, dict):
                    url = rec.get("value") or rec.get("url") or ""
                    if "/wiki/" in url and rec.get("title"):
                        idx[f"{comp(rec['title'])}|{ni(rec.get('issue'))}"] = url
    return idx


def problems(pub_date, year, vol, box, nf):
    out = []
    pdY = re.match(r"(\d{4})", str(pub_date or ""))
    y = str(year or "").strip()
    if not str(pub_date or "").strip():
        out.append("no-date")
    elif pdY and re.fullmatch(r"\d{4}", y) and abs(int(pdY.group(1)) - int(y)) > 1:
        out.append("date-conflict")
    if not str(vol or "").strip():
        out.append("no-volume")
    if not re.fullmatch(r"\d{4}", y):
        out.append("no-year")
    if str(box or "").strip() == "CC1":
        out.append("likely-variant")
    if nf:
        out.append("not-in-gcd")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(DOWNLOADS, "datafix_covers_table.csv"))
    ap.add_argument("--all", action="store_true", help="include flagged books with NO cover too")
    args = ap.parse_args()

    cov, exact, norm_idx = load_covers()
    links = load_links()
    nf = set(json.load(open(GCD_NF))) if os.path.exists(GCD_NF) else set()

    src = newest_xlsx()
    wb = openpyxl.load_workbook(src)
    ws = next(w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory"))
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]
    def ci(n): return H.index(n) + 1 if n in H else None
    col = {k: ci(v) for k, v in {
        "title": "Title", "issue": "Issue #", "vol": "Volume", "year": "Year",
        "pub": "Publisher", "box": "Box #", "pd": "Publication Date",
        "w": "Writer(s)", "a": "Artist(s)", "ca": "Cover Artist",
        "cond": "Condition", "nm": "Est. Raw Value (NM) $"}.items()}

    def g(r, k):
        c = col[k]
        return str(ws.cell(r, c).value or "").strip() if c else ""

    rows = []
    for r in range(2, ws.max_row + 1):
        title = g(r, "title")
        if not title:
            continue
        issue, vol, box = g(r, "issue"), g(r, "vol") or "1", g(r, "box")
        cid = f"{title}|||{issue}|||{box}"   # matches the app's comicId(c) + gcd_notfound.json
        probs = problems(g(r, "pd"), g(r, "year"), vol, box, cid in nf)
        if not probs:
            continue
        url, source = cover_for(cov, exact, norm_idx, title, issue, vol)
        if not url and not args.all:
            continue
        rows.append({
            "Title": title, "Issue": issue, "Volume": vol, "Year": g(r, "year"),
            "Publisher": g(r, "pub"), "Box": box, "Pub Date": g(r, "pd"),
            "Problems": ", ".join(probs),
            "Writer": g(r, "w"), "Artist": g(r, "a"), "Cover Artist": g(r, "ca"),
            "Condition": g(r, "cond"), "Value NM": g(r, "nm"),
            "Has Cover": "yes" if url else "no", "Cover Source": source,
            "Cover URL": url or "",
            "Fandom Link": links.get(f"{comp(title)}|{ni(issue)}", ""),
        })

    rows.sort(key=lambda x: (x["Title"].lower(), float(re.sub(r"[^0-9.]", "", x["Issue"]) or 0)))
    cols = ["Title", "Issue", "Volume", "Year", "Publisher", "Box", "Pub Date", "Problems",
            "Writer", "Artist", "Cover Artist", "Condition", "Value NM",
            "Has Cover", "Cover Source", "Cover URL", "Fandom Link"]
    with open(args.out, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader(); w.writerows(rows)

    withlink = sum(1 for x in rows if x["Fandom Link"])
    print(f"Source: {os.path.basename(src)}")
    print(f"Flagged books{'' if args.all else ' with a cover'}: {len(rows)}")
    print(f"  of those, a Fandom link is on file: {withlink}")
    print(f"WROTE {args.out}")


if __name__ == "__main__":
    main()
