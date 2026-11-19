#!/usr/bin/env python3
"""
brb_relink.py -- re-send ARCHIVED Data Fix links for books that still have gaps.

A pasted link is applied once, then its export is archived (processed_exports/). If the
parser couldn't read something at the time (e.g. the Power Rangers wiki's "pencils=" field,
fixed Nov 19) or a cover was later cleared, the book stays incomplete and the link is never
looked at again. This step finds those books - blank Writer / Artist / Cover Artist /
Publication Date, or no cover for their (title, issue, volume) - and writes their original
links (incl. ?file= cover picks) to a fresh data-fixes export that the normal pipeline
applies. Each link is re-sent once per PARSER_VERSION, so nothing loops run after run;
bump PARSER_VERSION whenever a page parser learns something new.

    python3 brb_relink.py            # report what it WOULD re-send
    python3 brb_relink.py --write    # write data-fixes-relink-YYYYMMDD.json (brb_all step 2 applies it)
"""
import argparse, collections, datetime, glob, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(ROOT, "relink_state.json")
PARSER_VERSION = "2026-11-19 pencils+releasedate"


def ni(v):
    s = str(v if v is not None else "").strip().lstrip("#")
    try:
        f = float(s)
        return str(int(f)) if f == int(f) else s
    except ValueError:
        return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    links = {}                                         # (title, issue, box) -> record, newest wins
    for p in sorted(glob.glob(os.path.join(ROOT, "processed_exports", "*data-fixes*.json")), key=os.path.getmtime):
        try:
            recs = json.load(open(p))
        except Exception:  # noqa: BLE001
            continue
        for r in recs if isinstance(recs, list) else []:
            if isinstance(r, dict) and r.get("kind") == "fandom" and str(r.get("value", "")).startswith("http"):
                links[(str(r.get("title", "")).strip(), ni(r.get("issue")), str(r.get("box", "")).strip())] = r
    import openpyxl
    sys.path.insert(0, ROOT)
    from brb_apply_arcs import newest_xlsx, INV
    src = newest_xlsx()
    ws = [w for w in openpyxl.load_workbook(src, read_only=True).worksheets if w.title.startswith(INV)][-1]
    it = ws.iter_rows(values_only=True)
    H = [str(h).strip() if h is not None else "" for h in next(it)]
    g = lambda n: H.index(n) if n in H else None
    cT, cI, cV, cB = g("Title"), g("Issue #"), g("Volume"), g("Box #") if g("Box #") is not None else g("Box")
    gaps_cols = {n: g(n) for n in ("Writer(s)", "Artist(s)", "Cover Artist", "Publication Date")}
    cov = json.load(open(os.path.join(ROOT, "covers.json"))) if os.path.exists(os.path.join(ROOT, "covers.json")) else {}
    state = json.load(open(STATE)) if os.path.exists(STATE) else {}
    out, st, why = [], collections.Counter(), collections.Counter()
    for r in it:
        t = str(r[cT] or "").strip()
        key = (t, ni(r[cI]), str(r[cB] or "").strip() if cB is not None else "")
        rec = links.get(key)
        if not t or not rec:
            continue
        st["books with an archived link"] += 1
        gaps = [n for n, c in gaps_cols.items() if c is not None and not str(r[c] or "").strip()]
        vol = ni(r[cV]) if cV is not None else "1"
        ck = [f"{t}|||{key[1]}|||{vol or '1'}", f"{t}|||#{key[1]}|||{vol or '1'}", f"{t}|||#{key[1]}", f"{t}|||{key[1]}"]
        if not any(cov.get(k) for k in ck) or "file=" in rec["value"] and not cov.get(ck[0]):
            gaps.append("cover")
        if not gaps:
            continue
        sk = f"{t}|||{key[1]}|||{key[2]}|||{rec['value']}"
        if state.get(sk) == PARSER_VERSION:
            st["already re-sent for this parser version"] += 1; continue
        st["to re-send"] += 1
        for x in gaps:
            why[x] += 1
        out.append((sk, {**rec, "problem": rec.get("problem") or "relink", "at": datetime.datetime.now().isoformat(timespec="seconds")}, gaps))
    print(f"SOURCE: {os.path.basename(src)}   archived links: {len(links)}   " + "  ".join(f"{k}: {v}" for k, v in st.items()))
    if why:
        print("gaps they would fill: " + ", ".join(f"{k} {v}" for k, v in why.most_common()))
    for _, rec, gaps in out[:25]:
        print(f"  {rec.get('title')} #{rec.get('issue')} (box {rec.get('box')}): {', '.join(gaps)}  <- {rec['value'][:90]}")
    if not a.write:
        print("REPORT ONLY - nothing written. Re-run with --write.")
        return
    if not out:
        print("nothing to re-send"); return
    path = os.path.join(ROOT, f"data-fixes-relink-{datetime.date.today():%Y%m%d}.json")
    json.dump([rec for _, rec, _ in out], open(path, "w"), indent=1, ensure_ascii=False)
    for sk, _, _ in out:
        state[sk] = PARSER_VERSION
    json.dump(state, open(STATE, "w"), indent=0)
    print(f"WROTE {os.path.basename(path)} ({len(out)} links) - applied by the next data-fix step")


if __name__ == "__main__":
    main()
