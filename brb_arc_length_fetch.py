#!/usr/bin/env python3
"""
brb_arc_length_fetch.py -- find the LENGTH (and finale) of arcs we know but can't size,
by reading the Fandom pages of the NEIGHBOURING issues (including ones you don't own).
READ-ONLY on the xlsx. Writes arc_lengths.csv for:
    python3 brb_apply_arcs.py --csv arc_lengths.csv --fill-only      (dry run, then --apply)
which only fills BLANK Arc Part / Arc Length / Finale cells on rows with the same arc name.

How: for every arc (title + volume + arc name) with no Arc Length whose books have a
Fandom source link, walk forward from the last owned issue (and backward from the first,
unless a "Part N" already pins the start) one issue at a time. A neighbour belongs to the
arc only if its page NAMES the same arc (StoryArc field or "<Arc>, Part N" story title)
or carries the next expected "Part N". The walk stops at the first issue that doesn't.
Length = end - start + 1 (2..24), and every owned book must sit inside that range.

50 pages per request, 0.6 s apart -> a few minutes. Cached (arc_len_cache.json),
resumable, never caches a network failure, exits 75 on an outage.

    python3 brb_arc_length_fetch.py [--limit N]
"""
import argparse, collections, csv, json, os, re, sys, urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
import brb_arc_fetch as F                                         # noqa: E402  api_get, fields, Outage
from brb_arc_extract import clean, parse_title, DISAMBIG          # noqa: E402
from brb_apply_arcs import newest_xlsx, norm, ni, yr, INV, NEW_COLS   # noqa: E402

CACHE = "arc_len_cache.json"
WIKIS = {"marvel.fandom.com": "Marvel", "dc.fandom.com": "DC"}
MAX_WALK, MAX_LEN = 15, 24
OUT_COLS = ["title", "sheet_volume", "issue", "year"] + NEW_COLS


def load_cache():
    for p in (CACHE, CACHE + ".bak"):
        if os.path.exists(p):
            try:
                return json.load(open(p))
            except Exception:  # noqa: BLE001
                pass
    return {}


def save_cache(c):
    tmp = CACHE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(c, f); f.flush(); os.fsync(f.fileno())
    if os.path.exists(CACHE):
        os.replace(CACHE, CACHE + ".bak")
    os.replace(tmp, CACHE)


def page_arc(text):
    """(stated arc name, (base, part, length) from the story title) for one issue page."""
    f = F.fields(text or "")
    stated = next((clean(f[k]) for k in sorted(f) if re.match(r"(?i)(storyarc|storyline)\d*$", k) and clean(f[k])), "")
    stated = DISAMBIG.sub("", re.sub(r"(?i)[\s,:;(–—-]*\b(part|chapter)\s+\w+\)?$", "", stated)).strip()
    return stated, parse_title(clean(f.get("StoryTitle1", "")))


def belongs(text, arc, expected_part):
    """'yes' = same arc; 'no' = names a DIFFERENT story (or the page doesn't exist: series
    ended); 'silent' = the page names no story at all -> NOT proof the arc ended."""
    if text is None:
        return "no"
    stated, pt = page_arc(text)
    a = norm(arc)
    if stated and norm(stated) == a:
        return "yes"
    if pt and pt[0] and norm(pt[0]) == a:
        return "yes"
    if pt and not pt[0] and expected_part and pt[1] == expected_part:   # bare "Part Five" in sequence
        return "yes"
    f = F.fields(text or "")
    title1 = clean(f.get("StoryTitle1", ""))
    return "no" if (stated or title1) else "silent"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    import openpyxl
    src = newest_xlsx()
    ws = [w for w in openpyxl.load_workbook(src, read_only=True).worksheets if w.title.startswith(INV)][-1]
    it = ws.iter_rows(values_only=True)
    H = [str(h).strip() if h is not None else "" for h in next(it)]
    g = lambda n: H.index(n) if n in H else None
    c = {n: g(n) for n in ("Title", "Issue #", "Volume", "Year", "Story Arc", "Arc Part", "Arc Length", "Arc Source")}
    groups = collections.defaultdict(list)
    for r in it:
        arc = str(r[c["Story Arc"]] or "").strip()
        if not arc:
            continue
        t = str(r[c["Title"]] or "").strip()
        groups[(t, ni(r[c["Volume"]]) or "1", arc)].append(
            {"issue": ni(r[c["Issue #"]]), "year": yr(r[c["Year"]]), "part": r[c["Arc Part"]],
             "len": str(r[c["Arc Length"]] or "").strip(), "src": str(r[c["Arc Source"]] or "")})

    work = []
    st = collections.Counter()
    for (t, vol, arc), books in groups.items():
        if any(b["len"] for b in books):
            continue
        st["arcs without length"] += 1
        anchor = next((b for b in books if "fandom.com/wiki/" in b["src"]), None)
        nums = sorted(int(float(b["issue"])) for b in books if re.fullmatch(r"\d+", b["issue"] or ""))
        if not anchor or not nums:
            st["no Fandom page / non-numeric issues - skipped"] += 1
            continue
        u = urllib.parse.urlparse(anchor["src"])
        page = urllib.parse.unquote(u.path.split("/wiki/", 1)[1]).replace("_", " ")
        m = re.match(r"^(.*\bVol \d+) (\d+)$", page)
        wiki = WIKIS.get(u.netloc)
        if not m or not wiki:
            st["source link not an issue page - skipped"] += 1
            continue
        base = m.group(1)
        start = None
        for b in books:                                    # a stated Part pins the start
            try:
                p = int(float(b["part"]))
            except (TypeError, ValueError):
                continue
            if re.fullmatch(r"\d+", b["issue"] or ""):
                start = int(b["issue"]) - (p - 1)
                break
        work.append({"key": (t, vol, arc), "books": books, "wiki": wiki, "base": base, "arc": arc,
                     "lo": nums[0], "hi": nums[-1], "start": start, "end": None,
                     "fwd": nums[-1] + 1, "back": nums[0] - 1 if start is None else None, "steps": 0,
                     "end_ok": False, "start_ok": start is not None})
    if a.limit:
        work = work[: a.limit]
    print(f"SOURCE: {os.path.basename(src)}   arcs without a length: {st['arcs without length']}   walkable: {len(work)}")

    cache = load_cache()
    lock = "arc_len_fetch.lock"
    if os.path.exists(lock):
        sys.exit("another length fetch is running (remove arc_len_fetch.lock if not)")
    open(lock, "w").write(str(os.getpid()))
    code = 0
    try:
        rnd = 0
        while True:
            want = collections.defaultdict(set)
            for w in work:
                if w["fwd"] is not None:
                    want[w["wiki"]].add(f"{w['base']} {w['fwd']}")
                if w["back"] is not None and w["back"] >= 0:
                    want[w["wiki"]].add(f"{w['base']} {w['back']}")
            todo = {wk: [p for p in ps if f"{wk}|{p}" not in cache] for wk, ps in want.items()}
            if not any(want.values()):
                break
            rnd += 1
            n_req = sum((len(v) + 49) // 50 for v in todo.values())
            print(f"round {rnd}: {sum(len(v) for v in want.values())} neighbour pages ({n_req} requests)", flush=True)
            for wk, ps in todo.items():
                for k in range(0, len(ps), 50):
                    batch = ps[k:k + 50]
                    got = F.api_get(wk, batch)              # raises Outage; never returns 'missing' on failure
                    for p in batch:
                        cache[f"{wk}|{p}"] = got[p]["text"] if p in got else None
                    save_cache(cache)
            for w in work:
                w["steps"] += 1
                if w["fwd"] is not None:
                    exp = (w["fwd"] - w["start"] + 1) if w["start"] is not None else None
                    v = belongs(cache.get(f"{w['wiki']}|{w['base']} {w['fwd']}"), w["arc"], exp)
                    if v == "yes" and w["steps"] <= MAX_WALK:
                        w["fwd"] += 1
                    else:
                        w["end"], w["fwd"], w["end_ok"] = w["fwd"] - 1, None, v == "no"
                if w["back"] is not None:
                    v = belongs(cache.get(f"{w['wiki']}|{w['base']} {w['back']}"), w["arc"], None) if w["back"] >= 0 else "no"
                    if v == "yes" and w["steps"] <= MAX_WALK:
                        w["back"] -= 1
                    else:
                        w["start"], w["back"], w["start_ok"] = w["back"] + 1, None, v == "no"
    except F.Outage as e:
        print(f"OUTAGE: {e} - cache saved, rerun to resume"); code = 75
    except KeyboardInterrupt:
        print("stopped - cache saved, rerun to resume"); code = 130
    finally:
        save_cache(cache)
        if os.path.exists(lock):
            os.remove(lock)
    if code:
        sys.exit(code)

    out = []
    for w in work:
        s, e = w["start"], w["end"]
        if s is None or e is None:
            continue
        if not (w["start_ok"] and w["end_ok"]):            # a silent neighbour page proves nothing
            st["boundary unconfirmed (silent page) - skipped"] += 1
            continue
        L = e - s + 1
        owned_ok = all(s <= int(float(b["issue"])) <= e for b in w["books"] if re.fullmatch(r"\d+", b["issue"] or ""))
        if not (2 <= L <= MAX_LEN) or not owned_ok:
            st["implausible length - skipped"] += 1
            continue
        st["arcs sized"] += 1
        t, vol, arc = w["key"]
        owned = {int(b["issue"]) for b in w["books"] if re.fullmatch(r"\d+", b["issue"] or "")}
        if all(i in owned for i in range(s, e + 1)):
            st["now COMPLETE"] += 1
        elif sum(i not in owned for i in range(s, e + 1)) <= 2:
            st["now 1-2 issues away"] += 1
        for b in w["books"]:
            if not re.fullmatch(r"\d+", b["issue"] or ""):
                continue
            out.append({"title": t, "sheet_volume": vol, "issue": b["issue"], "year": b["year"] or "",
                        "Story Arc": arc, "Arc Part": int(b["issue"]) - s + 1, "Arc Length": L, "Finale Issue #": e,
                        "Crossover Event (Fandom)": "", "Arc Confidence": "", "Arc Source": ""})
    with open("arc_lengths.csv", "w", newline="", encoding="utf-8") as f:
        wr = csv.DictWriter(f, fieldnames=OUT_COLS); wr.writeheader(); wr.writerows(out)
    for k, v in st.items():
        print(f"  {k}: {v}")
    print(f"wrote arc_lengths.csv ({len(out)} books) - nothing written to the xlsx")
    print("Apply:  python3 brb_apply_arcs.py --csv arc_lengths.csv --fill-only   (dry run, then --apply)")


if __name__ == "__main__":
    main()
