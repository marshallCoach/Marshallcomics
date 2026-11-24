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


def flagged_books():
    """(title lower, issue) of every cover you flagged incorrect in Cover Review, any export ever.
    Their link must NOT be re-sent for the cover: it may be the very link that gave the wrong art."""
    out = set()
    for d in (os.path.expanduser("~/Downloads"), ROOT, os.path.join(ROOT, "processed_exports")):
        for p in glob.glob(os.path.join(d, "flagged-covers-*.json")):
            try:
                data = json.load(open(p))
            except Exception:  # noqa: BLE001
                continue
            for e in (data if isinstance(data, list) else list(data.values()) if isinstance(data, dict) else []):
                if isinstance(e, dict) and (e.get("kind") or "incorrect") == "incorrect":
                    out.add((str(e.get("Title", "")).strip().lower(), ni(e.get("Issue"))))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    links = collections.defaultdict(list)              # (title, issue, box) -> records, oldest first
    any_box = collections.defaultdict(list)            # (title, issue) -> records from ANY box (not guesses)
    for p in sorted(glob.glob(os.path.join(ROOT, "processed_exports", "*data-fixes*.json")), key=os.path.getmtime):
        try:
            recs = json.load(open(p))
        except Exception:  # noqa: BLE001
            continue
        for r in recs if isinstance(recs, list) else []:
            if isinstance(r, dict) and r.get("kind") == "fandom" and str(r.get("value", "")).startswith("http"):
                links[(str(r.get("title", "")).strip(), ni(r.get("issue")), str(r.get("box", "")).strip())].append(r)
                if "extrapolated-auto" not in os.path.basename(p) and not r.get("auto"):
                    any_box[(str(r.get("title", "")).strip(), ni(r.get("issue")))].append(r)
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
    flagged = flagged_books()
    cY = g("Year")
    yr4 = lambda v: str(v or "").strip()[:4]
    rows = list(it)
    eras = collections.defaultdict(set)                # (title, issue, box) -> years in the sheet
    eras_any = collections.defaultdict(set)            # (title, issue) -> years in the sheet, all boxes
    for r in rows:
        t = str(r[cT] or "").strip()
        if t:
            y = yr4(r[cY]) if cY is not None else ""
            eras[(t, ni(r[cI]), str(r[cB] or "").strip() if cB is not None else "")].add(y)
            eras_any[(t, ni(r[cI]))].add(y)
    out, st, why = [], collections.Counter(), collections.Counter()
    for r in rows:
        t = str(r[cT] or "").strip()
        key = (t, ni(r[cI]), str(r[cB] or "").strip() if cB is not None else "")
        if not t:
            continue
        ry = yr4(r[cY]) if cY is not None else ""
        if key in links:
            # Same issue # in one box from several eras (FF #3 2013 + 2018, box 4): use only a
            # link pinned to THIS copy's year; an unpinned one can't say which copy it meant (Nov 24).
            pinned = [x for x in links[key] if x.get("year") and yr4(x.get("year")) == ry]
            loose = [x for x in links[key] if not x.get("year")] if len(eras[key]) <= 1 else []
            rec = (pinned or loose or [None])[-1]
            if not rec:
                st["skipped - other era's link"] += 1
                continue
        else:
            # Another copy of the same book (other box) has a link you or the pipeline already
            # vouched for (Nov 24). Reuse it when it is pinned to this year, or when every copy
            # of this title + issue in the sheet is from one year. Never sibling-built guesses.
            ak = (t, key[1])
            pinned = [x for x in any_box.get(ak, []) if x.get("year") and yr4(x.get("year")) == ry]
            loose = [x for x in any_box.get(ak, []) if not x.get("year")] if len(eras_any[ak]) <= 1 else []
            src_rec = (pinned or loose or [None])[-1]
            if not src_rec:
                continue
            rec = {**src_rec, "box": key[2], "id": f"{t}|||{key[1]}|||{key[2]}"}
            st["matched from another copy"] += 1
        st["books with an archived link"] += 1
        gaps = [n for n, c in gaps_cols.items() if c is not None and not str(r[c] or "").strip()]
        vol = ni(r[cV]) if cV is not None else "1"
        ck = [f"{t}|||{key[1]}|||{vol or '1'}", f"{t}|||#{key[1]}|||{vol or '1'}", f"{t}|||#{key[1]}", f"{t}|||{key[1]}"]
        if not any(cov.get(k) for k in ck) or "file=" in rec["value"] and not cov.get(ck[0]):
            if (t.lower(), key[1]) in flagged:
                st["cover flagged wrong - not re-sent for the cover"] += 1
            else:
                gaps.append("cover")
        if not gaps:
            continue
        sk = f"{t}|||{key[1]}|||{key[2]}|||{rec['value']}"
        if state.get(sk) == PARSER_VERSION:
            st["already re-sent for this parser version"] += 1; continue
        st["to re-send"] += 1
        for x in gaps:
            why[x] += 1
        out.append((sk, {**rec, "problem": rec.get("problem") or "relink", "year": ry, "vol": vol,
                         "at": datetime.datetime.now().isoformat(timespec="seconds")}, gaps))
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
