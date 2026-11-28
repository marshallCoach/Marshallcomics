#!/usr/bin/env python3
"""
tools/unknown_location_guess.py -- READ-ONLY: guess a physical box for every book whose
Box # is "UNKNOWN - needs physical reassignment" (Nov 28).

Evidence, strongest first:
  HISTORY-ROW   the same row ('#' entry) sat in a real box in an earlier deployed snapshot
  HISTORY-BOOK  the same book (title + issue + volume) sat in a real box earlier, and no copy
                of it is in that box today (so the history isn't about a different copy)
  SIBLINGS      other issues of the same series + volume are in one box today, and this
                issue number falls inside that box's run of the series

Tiers:  HIGH   history (row or book) - and siblings, if any, agree
               or siblings only: >=5 siblings, >=90% in one box, issue inside the run
        MEDIUM siblings only: >=3 siblings, >=70% in one box (inside or next to the run),
               or history and siblings disagree (history named first)
        LOW    1-2 siblings, or a weaker majority
        NONE   no evidence
Snapshots: every day's last deployed data3.ts in git history (needs a full clone).
Writes unknown_location_guesses.csv (repo root) + the Boxes -> "Unknown -> Box" page data
(artifacts/comics-inventory/src/data/unknownGuesses.json). Never touches the xlsx.
"retired" = the guessed box has no books in today's sheet (e.g. 81/84/77/76, emptied
in June) - look for a physical box still carrying that label.
    python3 tools/unknown_location_guess.py
"""
import collections, csv, datetime, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA3 = "artifacts/comics-inventory/src/data/data3.ts"
UNKNOWN = "UNKNOWN — needs physical reassignment"
STATUS = {"AT CGC", "AT MAGIC PRESSING → CGC", "AT CGC — Roy Thomas SS", "AT CGC — Terrificon 2026", UNKNOWN}


def git(*a):
    return subprocess.run(["git", *a], cwd=ROOT, capture_output=True, text=True).stdout


def records(text):
    i, j = text.find("  comics: ["), text.find("  boxes: [")
    if i < 0:
        return []
    body = text[i:j if j > i else None]
    return [dict(re.findall(r"(\w+): `([^`]*)`", r)) for r in re.split(r"\n  \{", body)[1:]]


tnorm = lambda t: re.sub(r"[^a-z0-9]+", "", (t or "").lower().replace("&", "and"))
def inorm(v):
    m = re.match(r"\s*#?\s*(-?\d+(?:\.\d+)?)", str(v or ""))
    return m.group(1).lstrip("0") or "0" if m else str(v or "").strip().lower()
def inum(v):
    m = re.match(r"\s*#?\s*(-?\d+(?:\.\d+)?)", str(v or ""))
    return float(m.group(1)) if m else None
vnorm = lambda v: str(v or "1").strip() or "1"
real = lambda b: bool(b) and b not in STATUS and not b.startswith("DUPLICATE")
bkey = lambda d: (tnorm(d.get("Title")), inorm(d.get("Issue")), vnorm(d.get("Volume")))
skey = lambda d: (tnorm(d.get("Title")), vnorm(d.get("Volume")))


def main():
    if git("rev-parse", "--is-shallow-repository").strip() == "true":
        sys.exit("shallow clone - run: git fetch --unshallow origin")
    cur = records(open(os.path.join(ROOT, DATA3), encoding="utf-8").read())
    unk = [d for d in cur if d.get("Box") == UNKNOWN]
    now_in = collections.defaultdict(set)          # book -> boxes holding a copy today
    for d in cur:
        if real(d.get("Box", "")):
            now_in[bkey(d)].add(d["Box"])

    # one snapshot per day (the day's last deploy), oldest first
    days = {}
    for line in git("log", "--all", "--format=%H %cs", "--", DATA3).splitlines():
        h, day = line.split()
        days.setdefault(day, h)                   # log is newest-first -> first seen = day's last
    snaps = sorted(days.items())
    row_hist = collections.defaultdict(list)      # entry -> [(day, box)]
    book_hist = collections.defaultdict(list)     # book  -> [(day, box)]
    want_e = {d.get("Entry") for d in unk if d.get("Entry")}
    want_b = {bkey(d) for d in unk}
    size = collections.defaultdict(dict)          # box -> {day: rows}
    last_rows = {}                                # box -> (day, [book keys]) at its last non-empty snapshot
    for day, h in snaps:
        per = collections.defaultdict(list)
        for d in records(git("show", f"{h}:{DATA3}")):
            b = d.get("Box", "")
            per[b].append(bkey(d))
            if not real(b):
                continue
            if d.get("Entry") in want_e:
                row_hist[d["Entry"]].append((day, b))
            if bkey(d) in want_b:
                book_hist[bkey(d)].append((day, b))

        for b, ks in per.items():
            size[b][day] = len(ks)
            if real(b):
                last_rows[b] = (day, ks)

    # today's siblings by series, numbered boxes only (CC boxes are cover pulls, not runs)
    sib = collections.defaultdict(list)           # series -> [(issue#, box)]
    for d in cur:
        b = d.get("Box", "")
        if b.isdigit() and inum(d.get("Issue")) is not None:
            sib[skey(d)].append((inum(d["Issue"]), b))

    boxes_now = {d.get("Box", "") for d in cur if real(d.get("Box", ""))}
    out, tiers = [], collections.Counter()
    for d in unk:
        ev, hbox = [], None
        rh = row_hist.get(d.get("Entry"), [])
        if rh:
            hbox = rh[-1][1]
            ev.append(f"HISTORY-ROW box {hbox} (last seen {rh[-1][0]}, {len(rh)} snapshot(s))")
        else:
            bh = [(dy, b) for dy, b in book_hist.get(bkey(d), []) if b not in now_in.get(bkey(d), set())]
            if bh:
                hbox = collections.Counter(b for _, b in bh).most_common(1)[0][0]
                ev.append(f"HISTORY-BOOK box {hbox} (last seen {bh[-1][0]})")
        sbox, share, n, inside = None, 0.0, 0, False
        s = sib.get(skey(d), [])
        if s:
            c = collections.Counter(b for _, b in s)
            sbox, k = c.most_common(1)[0]
            n, share = len(s), k / len(s)
            run = [i for i, b in s if b == sbox]
            x = inum(d.get("Issue"))
            inside = x is not None and min(run) <= x <= max(run)
            near = x is not None and (min(run) - 3) <= x <= (max(run) + 3)
            ev.append(f"SIBLINGS {k}/{n} in box {sbox}, run #{min(run):g}-#{max(run):g}" + (" (inside)" if inside else " (next to)" if near else " (outside)"))
        if hbox and (not sbox or sbox == hbox or hbox.startswith("CC")):
            tier, guess = "HIGH", hbox
        elif hbox and sbox:
            tier, guess = "MEDIUM", hbox
        elif sbox and n >= 5 and share >= 0.9 and inside:
            tier, guess = "HIGH", sbox
        elif sbox and n >= 3 and share >= 0.7 and (inside or near):
            tier, guess = "MEDIUM", sbox
        elif sbox:
            tier, guess = "LOW", sbox
        else:
            tier, guess = "NONE", ""
        tiers[tier] += 1
        out.append({"tier": tier, "guess_box": guess, "box_exists": "yes" if guess in boxes_now else ("" if not guess else "no"), "title": d.get("Title"), "issue": d.get("Issue"),
                    "volume": d.get("Volume"), "year": d.get("Year"), "entry": d.get("Entry", ""),
                    "key": d.get("Key", ""), "signed": d.get("Signed", ""), "evidence": " | ".join(ev)})
    order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2, "NONE": 3}
    out.sort(key=lambda r: (order[r["tier"]], r["guess_box"].zfill(6), r["title"], inum(r["issue"]) or 0))
    path = os.path.join(ROOT, "unknown_location_guesses.csv")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys()))
        w.writeheader(); w.writerows(out)
    print(f"UNKNOWN books: {len(unk)}   snapshots read: {len(snaps)} ({snaps[0][0]} .. {snaps[-1][0]})")
    for t in ("HIGH", "MEDIUM", "LOW", "NONE"):
        print(f"  {t:6} {tiers[t]:4}")
    by = collections.Counter(r["guess_box"] for r in out if r["tier"] in ("HIGH", "MEDIUM"))
    print("HIGH+MEDIUM by box:", ", ".join(f"{b}:{n}" for b, n in by.most_common(15)))
    # ── Dissolved boxes: last contents vs where those books are today ──
    where_now = collections.defaultdict(list)     # book -> [boxes today, incl. UNKNOWN]
    for d in cur:
        where_now[bkey(d)].append(d.get("Box", ""))
    title_of = {}
    for d in cur:
        title_of.setdefault(bkey(d), f"{d.get('Title')} #{d.get('Issue')}")
    dissolved = []
    for b, (day, ks) in last_rows.items():
        if b in boxes_now or not real(b):
            continue
        peak = max(size[b].values())
        unknown = other = gone = 0
        dest = collections.Counter()
        left = collections.Counter(ks)
        for k, n in left.items():
            now = list(where_now.get(k, []))
            for _ in range(n):
                if UNKNOWN in now:
                    unknown += 1; now.remove(UNKNOWN)
                elif any(real(x) for x in now):
                    x = next(x for x in now if real(x)); other += 1; dest[x] += 1; now.remove(x)
                else:
                    gone += 1
        guessed = sum(1 for r in out if r["guess_box"] == b and r["tier"] in ("HIGH", "MEDIUM"))
        dissolved.append({"box": b, "last_seen": day, "books_then": len(ks), "peak": peak,
                          "now_unknown": unknown, "now_other_box": other, "not_in_sheet": gone,
                          "guessed_back": guessed, "top_destinations": dest.most_common(6)})
    dissolved.sort(key=lambda x: -x["books_then"])
    # ── Boxes that jumped: a +15 or bigger day-over-day rise ──
    jumps = []
    for b, by_day in size.items():
        if not real(b):
            continue
        prev = 0
        for day, _ in snaps:
            n = by_day.get(day, 0)
            if n - prev >= 15 and prev > 0 or (prev == 0 and n >= 40 and day > snaps[0][0]):
                jumps.append({"box": b, "day": day, "before": prev, "after": n, "change": n - prev})
            prev = n
    jumps.sort(key=lambda x: (x["day"], -x["change"]))
    unk_size = [{"day": d, "n": size[UNKNOWN].get(d, 0)} for d, _ in snaps]
    print("DISSOLVED boxes (last contents -> today):")
    for x in dissolved[:12]:
        print(f"  box {x['box']:>4}  {x['books_then']:4} books on {x['last_seen']}  -> UNKNOWN {x['now_unknown']:4}  other boxes {x['now_other_box']:4}"
              f"  not in sheet {x['not_in_sheet']:3}   {x['top_destinations'][:3]}")
    print(f"BOX JUMPS (+15 in a day): {len(jumps)}")
    for j in jumps:
        print(f"  {j['day']}  box {j['box']:>4}  {j['before']:4} -> {j['after']:4}  (+{j['change']})")
    page = os.path.join(ROOT, "artifacts/comics-inventory/src/data/unknownGuesses.json")
    json.dump({"generated": datetime.date.today().isoformat(), "snapshots": len(snaps),
               "from": snaps[0][0], "to": snaps[-1][0], "rows": out,
               "dissolved": dissolved, "jumps": jumps, "unknown_size": unk_size}, open(page, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print(f"wrote {os.path.basename(path)} + {os.path.relpath(page, ROOT)}")


if __name__ == "__main__":
    main()
