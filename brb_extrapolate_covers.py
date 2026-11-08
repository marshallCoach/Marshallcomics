#!/usr/bin/env python3
"""brb_extrapolate_covers.py — auto-build HIGH-CONFIDENCE cover links each run.

For every book still missing a cover whose title has a single-volume sibling in
fandom_links.json AND whose Fandom page name matches the title (the "confident"
tier), construct the page URL and write it as a data-fixes export. brb_all's
next step (brb_apply_fandom_pages) fetches each — a page that doesn't exist just
404s and self-skips, so nothing wrong is ever written.

Only confident guesses (page stem ⊇/⊆ title) are emitted. The RISKY tier
(different-named page, e.g. a Mighty Thor row pointing at a Mortal Thor page)
is deliberately left for manual review in the app's Cover guesses section.

    python3 brb_extrapolate_covers.py          # write the export, print count
Writes: data-fixes-extrapolated-auto-<date>.json (consumed by the next apply step)
"""
import datetime, glob, json, os, re, urllib.parse
import openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "attached_assets")
LINKS = os.path.join(ROOT, "artifacts/comics-inventory/public/fandom_links.json")
COVERS = os.path.join(ROOT, "covers.json")
if not os.path.exists(COVERS):
    COVERS = os.path.join(ROOT, "artifacts/comics-inventory/public/covers.json")


def _fn_key(f):
    m = re.search(r"_(\d{2})(\d{2})_(\d{2})(\d{2})", os.path.basename(f))
    if m:
        dd, mm, hh, mi = (int(x) for x in m.groups())
        return (1, mm, dd, hh, mi, os.path.getmtime(f))
    return (0, 0, 0, 0, 0, os.path.getmtime(f))


def newest_xlsx():
    m = [f for f in glob.glob(os.path.join(ASSETS, "comics_inventory_*.xlsx"))
         if " copy" not in f and not os.path.basename(f).startswith("~$")]
    return max(m, key=_fn_key) if m else None


def nt(t):
    return re.sub(r"[^a-z0-9]+", " ", str(t).lower()).strip()


def nti(t):  # normalize for cover index (mirrors the app)
    return re.sub(r"[^a-z0-9]+", " ", str(t).lower().replace("&", " and ")).strip()


def ni(v):
    return re.sub(r"^0+(\d)", r"\1", str(v if v is not None else "").lstrip("#").strip())


def main():
    if not (os.path.exists(LINKS) and os.path.exists(COVERS)):
        print("extrapolate: missing fandom_links.json or covers.json — skipping.")
        return
    links = json.load(open(LINKS))
    covers = json.load(open(COVERS))
    src = newest_xlsx()
    if not src:
        print("extrapolate: no xlsx — skipping.")
        return

    # single-volume link index: title_lower -> {base, stem, vol}
    VOL = re.compile(r"/wiki/(.+?)_Vol_(\d+)(?:_|$)")
    vols, stem = {}, {}
    for k, u in links.items():
        t = (k.split("|||")[0] or "").strip().lower()
        m = VOL.search(u or "")
        if not t or not m:
            continue
        vols.setdefault(t, set()).add(m.group(2))
        stem[t] = (u.split("/wiki/")[0], m.group(1))
    single = {t: (next(iter(v)), *stem[t]) for t, v in vols.items() if len(v) == 1}

    # cover index (normalized fallback, mirrors the app's normIndex: size==1 only)
    groups = {}
    for k, v in covers.items():
        url = v.get("url") if isinstance(v, dict) else v
        if not url:
            continue
        p = k.split("|||")
        if len(p) >= 2:
            groups.setdefault(f"{nti(p[0])}|||{ni(p[1])}", set()).add(url)
    norm_idx = {nk for nk, u in groups.items() if len(u) == 1}

    def has_cover(title, issue, vol):
        vol = str(vol or "1").strip() or "1"
        for key in (f"{title}|||{issue}|||{vol}", f"{title}|||{issue}", f"{title}|||#{issue}"):
            e = covers.get(key)
            if (e.get("url") if isinstance(e, dict) else e):
                return True
        return f"{nti(title)}|||{ni(issue)}" in norm_idx

    wb = openpyxl.load_workbook(src)
    ws = [w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory")][-1]
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]
    ci = lambda n: (H.index(n) + 1 if n in H else None)
    cT, cI, cV, cB = ci("Title"), ci("Issue #"), ci("Volume"), ci("Box #")

    now = datetime.datetime.now().isoformat()
    recs, seen = [], set()
    for r in range(2, ws.max_row + 1):
        T = str(ws.cell(r, cT).value or "").strip()
        I = ni(ws.cell(r, cI).value)
        if not T or not I:
            continue
        V = str(ws.cell(r, cV).value or "").strip()
        B = str(ws.cell(r, cB).value or "").strip()
        idx = single.get(T.lower())
        if not idx or has_cover(T, I, V):
            continue
        vol, base, pstem = idx
        it, st = nt(T), nt(pstem.replace("_", " "))
        if not (it == st or it in st or st in it):   # CONFIDENT tier only
            continue
        key = (T.lower(), I, B)
        if key in seen:
            continue
        seen.add(key)
        url = f"{base}/wiki/{pstem}_Vol_{vol}_{urllib.parse.quote(I)}"
        recs.append({"id": f"{T}|||{I}|||{B}", "title": T, "issue": I, "box": B,
                     "problem": "no-cover", "kind": "fandom", "value": url, "at": now})

    if not recs:
        print("extrapolate: no confident cover guesses to add.")
        return
    out = os.path.join(ROOT, f"data-fixes-extrapolated-auto-{datetime.date.today():%Y%m%d}.json")
    json.dump(recs, open(out, "w"), indent=1)
    print(f"extrapolate: wrote {len(recs)} confident cover link(s) -> {os.path.basename(out)}")


if __name__ == "__main__":
    main()
