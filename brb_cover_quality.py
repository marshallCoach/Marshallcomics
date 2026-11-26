#!/usr/bin/env python3
"""brb_cover_quality.py -- find covers that are stored but WRONG, so the pipeline treats
them as missing and replaces them (Nov 26).

Two kinds:
  placeholder - the image is a "blank" / "no image" stand-in (Comic Vine's blank.png)
  shared      - ONE image file is stored for two or more DIFFERENT issues (e.g. a
                single Captain America image on 23 Bronze Age issues). At most one of
                them can be right.
Only shares inside ONE title count; spelling twins ("Totally Awesome Hulk" / "The Totally
Awesome Hulk", "#2" / "2") are the same title and issue, not a share.

Used by brb_autolink (books with a bad cover get a Fandom link), brb_extrapolate_covers
and brb_apply_fandom_pages (a bad cover is replaced by a year-verified Fandom cover).
Nothing is ever cleared without a verified replacement.

    python3 brb_cover_quality.py        # report: counts + biggest groups (read-only)
"""
import json, os, re
from collections import defaultdict

ROOT = os.path.dirname(os.path.abspath(__file__))
PLACEHOLDER = re.compile(r"(?:^|[/_-])(?:blank|no[-_]?image|noimage|placeholder|image[-_]not[-_]available|default[-_]cover)\.(?:png|jpe?g|gif|webp)", re.I)


def _url(v):
    return (v.get("url") if isinstance(v, dict) else v) or ""


def _title(key):
    t = key.split("|||")[0].strip().lower()
    t = re.sub(r"\s*\([^)]*\)\s*$", "", t)           # "(Ellis)", "(The New 52)" disambiguators
    t = re.sub(r"^the\s+", "", t)
    return re.sub(r"[^a-z0-9]+", "", t.replace("&", " and "))


def _num(key):
    """Leading issue number: '421 (Legacy #714 variant)' -> '421', '#02' -> '2'."""
    p = key.split("|||")
    m = re.match(r"\s*#?0*(\d+(?:\.\d+)?)", p[1] if len(p) > 1 else "")
    return m.group(1) if m else (p[1].strip().lower() if len(p) > 1 else "")


def _book(key):
    return _title(key), _num(key)


def bad_cover_keys(cov):
    """{key: 'placeholder' | 'shared'} for every covers.json key whose image is wrong."""
    bad, by_url = {}, defaultdict(set)
    for k, v in cov.items():
        u = _url(v)
        if not u:
            continue
        if PLACEHOLDER.search(u):
            bad[k] = "placeholder"
        else:
            by_url[u].add(k)
    # Only a share INSIDE one title counts (CA #137 and #138 on one image). The same image
    # under two titles is usually the same book filed twice (Thor / The Mighty Thor #17,
    # Avengers / "100th Anniversary Special - Avengers") - not provably wrong, left alone.
    for u, keys in by_url.items():
        per_title = defaultdict(set)
        for k in keys:
            per_title[_title(k)].add(_num(k))
        for k in keys:
            if len(per_title[_title(k)]) > 1:
                bad[k] = "shared"
    return bad


def main():
    path = os.path.join(ROOT, "covers.json")
    cov = json.load(open(path))
    bad = bad_cover_keys(cov)
    books = {_book(k) for k in bad}
    kinds = defaultdict(int)
    for v in bad.values():
        kinds[v] += 1
    print(f"covers.json keys: {len(cov):,}   bad: {len(bad):,} keys on {len(books):,} books   "
          + "   ".join(f"{k}: {n}" for k, n in sorted(kinds.items())))
    # books in the inventory that SHOW a bad cover (vol key first, then title+issue fallbacks)
    d3 = os.path.join(ROOT, "artifacts/comics-inventory/src/data/data3.ts")
    if os.path.exists(d3):
        body = open(d3).read().split("  comics: [", 1)[-1].split("\n  boxes: [", 1)[0]
        shown = set()
        for ob in re.split(r"\n  \{", body):
            g = lambda f: (re.search(rf"\b{f}: `((?:[^`\\]|\\.)*)`", ob) or [None, ""])[1]
            t, i, v = g("Title"), str(g("Issue")).lstrip("#"), (g("Volume") or "1")
            if not t:
                continue
            k = next((k for k in (f"{t}|||{i}|||{v}", f"{t}|||{i}", f"{t}|||#{i}") if _url(cov.get(k))), None)
            if k in bad:
                shown.add((t, i, v))
        print(f"inventory books showing a bad cover: {len(shown):,}")
    groups = defaultdict(set)
    for k in bad:
        groups[_url(cov[k])].add(k.split("|||")[0] + " #" + k.split("|||")[1].lstrip("#"))
    for u, ks in sorted(groups.items(), key=lambda x: -len(x[1]))[:10]:
        print(f"  {len(ks):3} share one image: {', '.join(sorted(ks)[:4])}{' ...' if len(ks) > 4 else ''}")


if __name__ == "__main__":
    main()
