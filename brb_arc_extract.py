#!/usr/bin/env python3
"""
brb_arc_extract.py -- turn arc_raw.jsonl.gz (Fandom page fields) into arc columns.
READ-ONLY: never touches the inventory xlsx. Writes arc_extracted.csv.

Rows are keyed by CONTENT (title + sheet volume + issue + year), never by the
`rid` in arc_targets.csv: those were row positions in an older sheet and no
longer line up (8558 "The Flash #112" is now Suicide Squad #28). brb_apply_arcs.py
matches the same content keys against the current inventory.

Tiers (Arc Confidence):
  Stated   - Fandom names the arc (StoryArc / Storyline field) or the story title
             says "Part N" / "Part N of M".
  Grouped  - consecutive owned issues of the same series share a story title.
  Inferred - only the solicit text supports it ("This new 6-issue story arc",
             "concludes", "penultimate chapter").
Part / length / finale are derived from explicit part numbers and issue offsets,
or from solicit wording (then the row is never better than Inferred for length).

    python3 brb_arc_extract.py [--raw arc_raw.jsonl.gz] [--out arc_extracted.csv]
"""
import argparse, collections, csv, gzip, json, re

WIKI = {"Marvel": "https://marvel.fandom.com/wiki/", "DC": "https://dc.fandom.com/wiki/"}
NUMW = {w: i + 1 for i, w in enumerate("one two three four five six seven eight nine ten eleven twelve "
                                         "thirteen fourteen fifteen sixteen".split())}
ROMAN = {"i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8, "ix": 9, "x": 10, "xi": 11, "xii": 12}
OUT_COLS = ["title", "sheet_volume", "issue", "year", "Story Arc", "Arc Part", "Arc Length",
            "Finale Issue #", "Crossover Event (Fandom)", "Arc Confidence", "Arc Source"]


def clean(v):
    """Strip wiki markup -> plain text."""
    s = str(v or "")
    s = re.sub(r"<ref[^>]*>.*?</ref>|<ref[^>]*/>", "", s, flags=re.S)
    s = re.sub(r"\{\{c\|[^|}]*\|([^}]*)\}\}", r"\1", s)            # {{c|Page|Text}} -> Text
    s = re.sub(r"\{\{[^{}]*\}\}", "", s)                            # other templates
    s = re.sub(r"\[\[[^\]|]*\|([^\]]*)\]\]", r"\1", s)              # [[a|b]] -> b
    s = re.sub(r"\[\[([^\]]*)\]\]", r"\1", s)                       # [[a]] -> a
    s = re.sub(r"<br\s*/?>", " ", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("'''", "").replace("''", "").replace("&nbsp;", " ").replace("&amp;", "&")
    return re.sub(r"\s+", " ", s).strip(" .;,-–—")


def tonum(w):
    w = (w or "").strip().lower().rstrip(".")
    if w.isdigit():
        return int(w)
    return NUMW.get(w) or ROMAN.get(w)


PART_RE = re.compile(
    r"^(?P<base>.*?)[\s,:;(–—-]*\b(?:part|chapter|pt\.?|book|act|episode)\s+(?P<p>\d+|[a-z]+)"
    r"(?:\s*(?:of|/)\s*(?P<n>\d+|[a-z]+))?\)?\s*(?:[:–—-]\s*(?P<sub>.*))?$", re.I)


def parse_title(t):
    """'The Fast Life Part 1 of 4: Garrick' -> ('The Fast Life', 1, 4)."""
    m = PART_RE.match(t or "")
    if not m:
        return None
    p, n = tonum(m.group("p")), tonum(m.group("n") or "")
    if not p or p > 30:
        return None
    base = m.group("base").strip(" ,:;(–—-")
    return base, p, (n if n and n >= p and n <= 30 else None)


SOL_LEN = re.compile(r"(?i)\b(?:new\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[- ](?:issue|part|chapter)\b")
SOL_FIN = re.compile(r"(?i)\b(conclu(?:des|sion|ding)|finale|final (?:chapter|part|issue of the arc)|the end of the|epic end)\b")
SOL_PEN = re.compile(r"(?i)\bpenultimate\b")
SOL_BEGIN = re.compile(r"(?i)\b(new (?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[- ](?:issue|part)(?: story)? ?(?:arc|storyline)\b|new (?:\d+[- ](?:issue|part) )?(?:story ?arc|storyline|arc) (?:begins|starts)|begins here|start of a (?:brand[- ]new )?(?:story ?arc|storyline)|jumping[- ]on point|part one\b|chapter one\b)")
QUOTED = re.compile(r'"([A-Z][A-Za-z0-9\'’ :&-]{2,40})"')


DISAMBIG = re.compile(r"(?i)\s*\((?:[^()]*\b)?(?:story ?arc|storyline|arc|event|comic|crossover|earth-\d+)\)\s*$")
# Generic chapter labels that are not arc names on their own.
GENERIC = re.compile(r"(?i)^(untitled|\[?untitled\]?|no title|prologue|epilogue|interlude|chapter \w+|part \w+|"
                     r"book \w+|act \w+|the end|finale|conclusion|introduction|intro|origin|preview|recap|"
                     r"back-?up|story|title|n/a|none|tba|tbd|\?+)$")


# Publishing initiatives / line-wide relaunches that Fandom files under "Event" —
# they are eras, not crossovers, so they stay OUT of the Crossover Event column.
INITIATIVES = {
    "all in", "dc all in", "marvel now", "all new marvel now", "all new all different marvel", "marvel legacy",
    "fresh start", "marvel fresh start", "dc rebirth", "rebirth", "dawn of dc", "the new 52", "new 52", "dc you",
    "infinite frontier", "dawn of x", "reign of x", "destiny of x", "from the ashes", "heroic age",
    "marvel next big thing", "dc universe rebirth", "one bad day", "dc next level", "next level", "the new age of dc heroes",
    "new age of dc heroes", "marvel knights 20th", "timeless", "marvel 2099",
}


def good_name(s):
    s = (s or "").strip(" !?.,:;-–—\"'")
    return s if s and len(s) >= 3 and not GENERIC.match(s) else ""


def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower().replace("&", " and ")).strip()


def issue_num(x):
    try:
        f = float(x)
        return int(f) if f == int(f) else f
    except ValueError:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default="arc_raw.jsonl.gz")
    ap.add_argument("--out", default="arc_extracted.csv")
    a = ap.parse_args()
    R = [json.loads(l) for l in gzip.open(a.raw, "rt", encoding="utf-8")]

    # ---- per-issue signals -------------------------------------------------------------
    for r in R:
        f = r["f"]
        r["n"] = issue_num(r["issue"])
        r["src"] = WIKI.get(r["wiki"], "") + r["page"].replace(" ", "_")
        stated = next((clean(f[k]) for k in sorted(f) if re.match(r"(?i)(storyarc|storyline)\d*$", k) and clean(f[k])), "")
        stated = re.sub(r"(?i)[\s,:;(–—-]*\b(part|chapter)\s+\w+\)?$", "", stated).strip()
        stated = DISAMBIG.sub("", stated).strip()
        t1 = clean(f.get("StoryTitle1", ""))
        pt = parse_title(t1)
        sol = clean(f.get("Solicit", ""))
        evs = []
        for k in sorted(f):
            if re.match(r"(?i)event(name)?\d*$", k):
                for e in re.split(r"\s*(?:<br>|;|\n)\s*", clean(f[k])):
                    e = DISAMBIG.sub("", e).strip()
                    if norm(e).replace(" marvel now", "marvel now") in INITIATIVES or norm(e) in INITIATIVES:
                        continue
                    if e and e not in evs and len(e) < 60:
                        evs.append(e)
        r.update(stated=stated, t1=t1, pt=pt, sol=sol, events=evs)
        r["name"], r["conf"], r["part"], r["len"] = None, None, None, None
        stated = good_name(stated)
        if pt:
            pt = (good_name(pt[0]),) + tuple(pt[1:])
        # an "arc" that is just the series title (e.g. "Batgirl") says nothing
        sname = norm(re.sub(r"\s*\(\d{4}\)$", "", r["title"]))
        if norm(stated) == sname:
            stated = ""
        if pt and norm(pt[0]) == sname:
            pt = ("",) + tuple(pt[1:])
        if stated:
            r["name"], r["conf"] = stated, "Stated"
        if pt and pt[0]:
            if not r["name"]:
                r["name"], r["conf"] = pt[0], "Stated"
            if norm(pt[0]) == norm(r["name"]) or not stated:
                r["part"], r["len"] = pt[1], pt[2]
        elif pt and not pt[0] and r["name"]:          # "Part Two" with the arc named elsewhere
            r["part"], r["len"] = pt[1], pt[2]

    # ---- series groups: same wiki page series (e.g. "Ultimate X-Men Vol 1") ---------------
    series = collections.defaultdict(list)
    for r in R:
        series[(r["wiki"], r["page"].rsplit(" ", 1)[0])].append(r)

    for key, rows in series.items():
        rows.sort(key=lambda r: (r["n"] if r["n"] is not None else 1e9))
        ints = [r for r in rows if isinstance(r["n"], int)]

        # Grouped tier: consecutive owned issues sharing a story-title base (2+ issues,
        # within a 12-issue window) and no stated name -> one arc.
        i = 0
        while i < len(ints):
            r = ints[i]
            base = norm(r["pt"][0] if r["pt"] and r["pt"][0] else r["t1"])
            j = i + 1
            while (j < len(ints) and base and not ints[j]["name"] and not r["name"]
                   and norm(ints[j]["pt"][0] if ints[j]["pt"] and ints[j]["pt"][0] else ints[j]["t1"]) == base
                   and ints[j]["n"] - r["n"] <= 12):
                j += 1
            series_t = norm(re.sub(r"\s*\(\d{4}\)$", "", r["title"]))
            if j - i >= 2 and base and len(base) >= 3 and base != series_t and good_name(r["t1"] if not (r["pt"] and r["pt"][0]) else r["pt"][0]):
                label = r["pt"][0] if r["pt"] and r["pt"][0] else r["t1"]
                for x in ints[i:j]:
                    x["name"], x["conf"] = label, "Grouped"
            i = max(j, i + 1)

        # Inferred tier: solicit opens "a new N-issue arc" with a quoted title.
        for idx, r in enumerate(ints):
            m = SOL_LEN.search(r["sol"])
            if not m or r["name"] or not SOL_BEGIN.search(r["sol"] + " begins"):
                continue
            L = tonum(m.group(1))
            q = [x for x in QUOTED.findall(r["sol"]) if len(x.split()) <= 6]
            if not L or L > 24 or not q:
                continue
            name = q[-1].strip().title() if q[-1].isupper() else q[-1].strip()
            for x in ints[idx:]:
                if x["n"] - r["n"] >= L:
                    break
                if x["name"] and norm(x["name"]) != norm(name):
                    break
                x["name"], x["conf"] = name, x["conf"] or "Inferred"
                x["part"], x["len"] = x["n"] - r["n"] + 1, L

        # Parts / length / finale per arc (consecutive members with the same name).
        groups, cur = [], []
        for r in ints:
            if cur and (not r["name"] or norm(r["name"]) != norm(cur[-1]["name"]) or r["n"] - cur[-1]["n"] > 24):
                groups.append(cur); cur = []
            if r["name"]:
                cur.append(r)
        if cur:
            groups.append(cur)
        for g in groups:
            exp = [(x["n"], x["part"]) for x in g if x["part"]]
            start = collections.Counter(n - p + 1 for n, p in exp).most_common(1)[0][0] if exp else None
            if start is None:                      # solicit marks where the arc begins
                b = next((x for x in g if SOL_BEGIN.search(x["sol"])), None)
                if b is not None:
                    start = b["n"]
                    b["part"] = 1
            L = max([x["len"] for x in g if x["len"]] or [0]) or None
            if not L:
                for x in g:
                    m = SOL_LEN.search(x["sol"])
                    if m and tonum(m.group(1)) and tonum(m.group(1)) <= 24:
                        L = tonum(m.group(1)); break
            fin = None
            for x in g:
                if SOL_FIN.search(x["sol"]) and not SOL_PEN.search(x["sol"]):
                    fin = x["n"]
            if start is not None:
                for x in g:
                    p = x["n"] - start + 1
                    if 1 <= p <= (L or 30):
                        x["part"] = x["part"] or p
                if not L and fin is not None and fin >= start:
                    L = fin - start + 1
            disp = collections.Counter(x["name"].strip(" !?.") for x in g).most_common()
            best = max(disp, key=lambda kv: (kv[1], sum(ch.isupper() for ch in kv[0])))[0]
            for x in g:
                x["name"] = best
                x["len"] = L
                x["fin"] = (start + L - 1) if (start is not None and L) else fin

    # ---- write ------------------------------------------------------------------------
    st = collections.Counter()
    with open(a.out, "w", newline="", encoding="utf-8") as fo:
        w = csv.writer(fo)
        w.writerow(OUT_COLS)
        for r in R:
            ev = " / ".join(r["events"][:3])
            if not r["name"] and not ev:
                st["no arc data"] += 1
                continue
            iss = r["issue"][:-2] if r["issue"].endswith(".0") else r["issue"]
            w.writerow([r["title"], r["sheet_volume"], iss, r["year"],
                        r["name"] or "", r["part"] or "", r["len"] or "",
                        r.get("fin") or "", ev, r["conf"] if r["name"] else "", r["src"]])
            if r["name"]:
                st["arc: " + r["conf"]] += 1
                st["with part #"] += bool(r["part"])
                st["with length"] += bool(r["len"])
            if ev:
                st["crossover event"] += 1
    print(f"issues in: {len(R)}")
    for k in ("arc: Stated", "arc: Grouped", "arc: Inferred", "with part #", "with length", "crossover event", "no arc data"):
        print(f"  {k:18s} {st[k]:6d}  ({100 * st[k] / max(len(R), 1):.0f}%)")
    print(f"wrote {a.out}")


if __name__ == "__main__":
    main()
