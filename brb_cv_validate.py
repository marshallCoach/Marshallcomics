#!/usr/bin/env python3
"""
brb_cv_validate.py -- keep only the Comic Vine arcs that pass a YEAR check, and route
event/era names (Reign of X, Acts of Vengeance...) to the Event column instead.
READ-ONLY on the xlsx. Uses cv_cache.json + cv_arcs.csv; needs COMIC_VINE_API_KEY.

Why: a spot check found ~1 in 4 Comic Vine arcs came from a DIFFERENT run with the same
issue number (Avengers #55 2022 tagged Kang Dynasty, a 2001 story). For each book we look
up the cover date of the exact Comic Vine issue it was matched to; if that year is more
than 1 away from the sheet's Year, the arc is rejected. ~15 requests (100 ids each).

Outputs  cv_arcs_validated.csv   (same columns as cv_arcs.csv; apply with --fill-only)
         cv_rejects.csv          (every dropped book and why)

    python3 brb_cv_validate.py
"""
import collections, csv, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
import brb_cv_arcs as C                                   # noqa: E402  (cv(), cache, ni, fnum)
from brb_apply_arcs import clean_arc, norm               # noqa: E402
from brb_arc_extract import INITIATIVES                   # noqa: E402

EXTRA_EVENTS = {"dawn of x", "reign of x", "trials of x", "destiny of x", "fall of x", "the heroic age", "heroic age",
                "dark reign", "brightest day", "rebirth", "marvel now", "all new all different", "fresh start",
                "infinity wars", "acts of vengeance", "house of m", "secret invasion", "siege", "fear itself",
                "original sin", "civil war", "civil war ii", "secret wars", "king in black", "war of the realms",
                "inferno", "x of swords", "judgment day", "absolute power", "dark crisis", "infinite frontier",
                "dawn of dc", "new 52", "the new 52", "convergence", "forever evil", "event leviathan", "year of the villain"}


def main():
    if not C.KEY:
        sys.exit("COMIC_VINE_API_KEY is not set - source ~/.zshrc")
    if not os.path.exists("cv_arcs.csv"):
        sys.exit("cv_arcs.csv not found")
    c = C.load_cache()
    c.setdefault("dates", {})
    rows = list(csv.DictReader(open("cv_arcs.csv", newline="", encoding="utf-8")))
    cols = list(rows[0].keys()) if rows else []

    events = {norm(x) for x in INITIATIVES} | EXTRA_EVENTS
    if os.path.exists("arc_extracted.csv"):                # every event name Fandom used
        for r in csv.DictReader(open("arc_extracted.csv", newline="", encoding="utf-8")):
            e = (r.get("Crossover Event (Fandom)") or "").strip()
            if e:
                events.add(norm(e))

    # which Comic Vine issue was each book matched to?
    iid = {}
    for r in rows:
        y = int(r["year"]) if r["year"].isdigit() else 0
        ek = f"{r['title']}|{r['sheet_volume'] or '1'}|{y // 6}"
        v = c["vol"].get(ek)
        if not v:
            continue
        hit = next((i for i in c["vissues"].get(str(v["id"]), []) if i["n"] == C.ni(r["issue"])), None)
        if hit:
            iid[id(r)] = str(hit["id"])
    need = sorted({x for x in iid.values() if x not in c["dates"]})
    C.log(f"{len(rows)} Comic Vine arcs; {len(iid)} matched to a CV issue; fetching {len(need)} cover dates "
          f"({(len(need) + 99) // 100} requests)")
    try:
        for k in range(0, len(need), 100):
            batch = need[k:k + 100]
            js = C.cv("issues/", filter="id:" + "|".join(batch), limit=100, field_list="id,cover_date,store_date")
            got = {str(x["id"]): (x.get("cover_date") or x.get("store_date") or "") for x in js.get("results") or []}
            for b in batch:
                c["dates"][b] = got.get(b, "")
            C.save_cache(c)
    except C.Outage as e:
        C.save_cache(c)
        sys.exit(f"OUTAGE: {e} - rerun to resume (dates already fetched are cached)")

    keep, rej, st = [], [], collections.Counter()
    for r in rows:
        name = clean_arc(r["Story Arc"])
        sheet_y = int(r["year"]) if r["year"].isdigit() else None
        d = c["dates"].get(iid.get(id(r), ""), "")
        cv_y = int(d[:4]) if re.match(r"\d{4}", d or "") else None
        if cv_y is None or sheet_y is None:
            st["no date - dropped"] += 1; rej.append([r["title"], r["sheet_volume"], r["issue"], r["year"], name, "", "no cover date to check"]); continue
        if abs(cv_y - sheet_y) > 1:
            st["wrong run - dropped"] += 1; rej.append([r["title"], r["sheet_volume"], r["issue"], r["year"], name, cv_y, "Comic Vine issue is from a different year/run"]); continue
        out = dict(r)
        out["Story Arc"] = name
        if norm(name) in events:                           # an event/era, not a story arc
            out.update({"Story Arc": "", "Arc Part": "", "Arc Length": "", "Finale Issue #": "", "Crossover Event (Fandom)": name})
            st["moved to Event"] += 1
        else:
            st["kept as arc"] += 1
        keep.append(out)

    with open("cv_arcs_validated.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(keep)
    with open("cv_rejects.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(["title", "volume", "issue", "sheet_year", "cv_arc", "cv_issue_year", "reason"]); w.writerows(rej)
    C.log("RESULT  " + "   ".join(f"{k}: {v}" for k, v in st.items()))
    C.log("wrote cv_arcs_validated.csv + cv_rejects.csv  (nothing written to the xlsx)")


if __name__ == "__main__":
    main()
