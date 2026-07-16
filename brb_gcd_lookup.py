#!/usr/bin/env python3
"""
brb_gcd_lookup.py — query the local GCD subset (gcd_local.sqlite) for a
Title+Issue(+Year+Publisher), for use as:
  1. A writer/artist source for the ~637 genuine Comic Vine gaps.
  2. A volume-numbering tiebreaker, per the original brief.

The extraction (gcd_build_local_db.py) matches on series NAME ONLY and is
deliberately over-inclusive — e.g. "Batman" matched 144 GCD series, most of
them foreign-language reprint editions GCD catalogs as separate series with
the identical name. Disambiguation happens HERE, at lookup time, by scoring
candidate series against the row's own Publisher + Year — same two-step
principle as the covers.ts Comic Vine fix (resolve the right series first,
then the issue inside it), not a blind first-match.

Usage:
    python3 brb_gcd_lookup.py "Wildcats: Version 3.0" 13 --year 2003 --publisher DC
    python3 brb_gcd_lookup.py --self-test   # run against known inventory rows
"""
import argparse, os, re, sqlite3, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(ROOT, "gcd_local.sqlite")


def normalize_title(t):
    return re.sub(r"[^a-z0-9]+", " ", str(t or "").lower()).strip()


def parse_year_range(y):
    nums = [int(n) for n in re.findall(r"\d{4}", str(y or ""))]
    nums = [n for n in nums if 1900 < n < 2100]
    return (min(nums), max(nums)) if nums else None


def norm_issue(v):
    s = str(v).strip().lstrip("#")
    try:
        f = float(s)
        return str(int(f)) if f == int(f) else s
    except ValueError:
        return s


def find_series(conn, title, year=None, publisher=None):
    """Return the best-matching gcd_series row for a title, scored by
    exact-name match + year proximity + publisher-name corroboration."""
    tnorm = normalize_title(title)
    rows = conn.execute(
        "SELECT s.id, s.name, s.year_began, s.year_ended, s.publisher_id, p.name as pub_name "
        "FROM gcd_series s LEFT JOIN gcd_publisher p ON p.id = s.publisher_id "
        "WHERE s.matched_title = ?", (title,)
    ).fetchall()
    if not rows:
        return None

    yr = parse_year_range(year)
    best, best_score = None, -1e9
    for r in rows:
        sid, name, yb, ye, pub_id, pub_name = r
        score = 0
        if normalize_title(name) == tnorm:
            score += 10
        if yr and yb:
            span_end = ye or yb
            if yb <= yr[1] and span_end >= yr[0]:
                score += 20  # year ranges overlap
            else:
                score -= min(15, abs(yb - yr[0]))
        if publisher and pub_name:
            pl, pn = publisher.lower(), pub_name.lower()
            if pl in pn or pn in pl:
                score += 15
            else:
                score -= 5  # publisher name present but doesn't match — real signal, not neutral
        if score > best_score:
            best_score = score
            best = {"id": sid, "name": name, "year_began": yb, "year_ended": ye,
                    "publisher": pub_name, "score": score}
    return best


COMIC_STORY_TYPE_ID = 19  # 'comic story' in gcd_story_type — excludes letters
                          # pages(12), covers(6), ads(2/16), etc.
# credit_type_id sets (from gcd_credit_type): script-bearing = writer,
# pencils/painting-bearing = artist. Combo types (10-13) carry both.
WRITER_TYPES = {1, 10, 11, 12, 13}
ARTIST_TYPES = {2, 7, 8, 9, 10, 11, 12, 13, 14}


def _clean_name(v):
    v = (v or "").strip()
    if not v or v.lower().startswith("?") or v.lower() == "unknown":
        return None
    return v


def find_credits(conn, series_id, issue):
    """Given a resolved series, find the issue and its writer/artist from the
    normalized gcd_story_credit table (GCD's legacy free-text script/pencils
    fields are empty for modern entries — the real credits live here), joined
    to gcd_creator_name_detail for the name. Restricted to 'comic story'
    stories (type_id=19) so letters-page / cover / ad credits don't leak in."""
    inum = norm_issue(issue)
    issue_row = conn.execute(
        "SELECT id, number, key_date, publication_date FROM gcd_issue WHERE series_id = ?", (series_id,)
    ).fetchall()
    match = None
    for iid, number, key_date, pub_date in issue_row:
        if norm_issue(number) == inum:
            match = (iid, number, key_date, pub_date)
            break
    if not match:
        return None
    iid, number, key_date, pub_date = match

    story_ids = [r[0] for r in conn.execute(
        "SELECT id FROM gcd_story WHERE issue_id = ? AND type_id = ? ORDER BY sequence_number",
        (iid, COMIC_STORY_TYPE_ID))]
    writer = artist = None
    if story_ids:
        qs = ",".join("?" * len(story_ids))
        rows = conn.execute(
            f"SELECT c.credit_type_id, COALESCE(NULLIF(cn.name,''), c.credit_name), c.story_id "
            f"FROM gcd_story_credit c LEFT JOIN gcd_creator_name_detail cn ON cn.id = c.creator_id "
            f"WHERE c.story_id IN ({qs}) ORDER BY c.story_id, c.id", story_ids).fetchall()
        for ctype, name, sid in rows:
            nm = _clean_name(name)
            if not nm:
                continue
            if writer is None and ctype in WRITER_TYPES:
                writer = nm
            if artist is None and ctype in ARTIST_TYPES:
                artist = nm
            if writer and artist:
                break
    return {"issue_id": iid, "number": number, "key_date": key_date, "publication_date": pub_date,
            "writer": writer, "artist": artist, "comic_story_count": len(story_ids)}


def lookup(title, issue, year=None, publisher=None):
    conn = sqlite3.connect(DB)
    series = find_series(conn, title, year, publisher)
    if not series:
        return {"found": False, "reason": "no matching series in local GCD subset"}
    credits = find_credits(conn, series["id"], issue)
    if not credits:
        return {"found": False, "reason": f"series resolved ({series['name']}, {series['year_began']}) but issue #{issue} not found", "series": series}
    return {"found": True, "series": series, "issue": credits}


def self_test():
    """Sanity check against real, known inventory rows spanning the ambiguous
    titles this whole session has been fighting (Captain America, Flash,
    Wildcats, Black Panther)."""
    cases = [
        ("Wildcats: Version 3.0", "13", "2003", "Image"),
        ("Black Panther", "17", "1999", "Marvel"),
        ("Captain America", "1", "2018", "Marvel"),
        ("The Flash", "1", "2016", "DC"),
        ("X-Treme X-Men", "1", "2001", "Marvel"),
    ]
    for title, issue, year, pub in cases:
        r = lookup(title, issue, year, pub)
        print(f"\n{title} #{issue} ({year}, {pub}):")
        if not r["found"]:
            print(f"  NOT FOUND — {r['reason']}")
            continue
        s, i = r["series"], r["issue"]
        print(f"  series: {s['name']} ({s['year_began']}-{s['year_ended'] or '?'}) pub={s['publisher']} score={s['score']}")
        print(f"  issue #{i['number']}  writer={i['writer']!r}  artist={i['artist']!r}  ({i['comic_story_count']} comic stories)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("title", nargs="?")
    ap.add_argument("issue", nargs="?")
    ap.add_argument("--year", default=None)
    ap.add_argument("--publisher", default=None)
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()

    if args.self_test:
        self_test()
        return
    if not args.title or not args.issue:
        ap.error("title and issue required unless --self-test")

    r = lookup(args.title, args.issue, args.year, args.publisher)
    import json
    print(json.dumps(r, indent=2))


if __name__ == "__main__":
    main()
