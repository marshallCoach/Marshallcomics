#!/usr/bin/env python3
"""
brb_apply_series_map.py -- turn your Data Fix "Series match" decisions into
series_map.json (lookup only: your titles stay as they are) and, where you chose
"Map + rename", a title alias (applied by brb_apply_title_aliases.py, which also
copies the covers across to the new title).

Decisions (problem "series-match" in data-fixes*.json):
  map:<Fandom series page>        e.g. map:IVX Vol 1
  maprename:<Fandom series page>  map it AND rename your title to the page's title
  link:<pasted Fandom URL>        series or issue page; the series is read off the URL
  skip-series                     not on Fandom - stop asking

    python3 brb_apply_series_map.py            # dry run
    python3 brb_apply_series_map.py --apply    # writes series_map.json (+ title_aliases.json)
Then re-run the arc fetch for the newly mapped series (cached pages cost nothing):
    python3 brb_arc_fetch.py && python3 brb_arc_extract.py
    python3 brb_apply_arcs.py --fill-only          (dry run, then --apply)
"""
import argparse, glob, json, os, re, shutil, urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
MAP = os.path.join(ROOT, "series_map.json")
PUB = os.path.join(ROOT, "artifacts/comics-inventory/public/series_map.json")
HELD_PUB = os.path.join(ROOT, "artifacts/comics-inventory/public/series_held.json")
FIT_MIN = 0.75   # share of YOUR title's words that must appear in the Fandom series name

_STOP = {"the", "vol", "of", "a", "an", "comic", "comics", "special", "tpb"}


def _words(s):
    s = str(s or "").lower().replace("&", " and ").replace("giant-size", "giant").replace("giant size", "giant")
    return set(re.findall(r"[a-z0-9]+", re.sub(r"[.']", "", s))) - _STOP


def title_fit(title, fandom):
    """0..1 - how much of your title the Fandom series name actually contains.
    A year match alone proves nothing for a one-shot: Nov 17 'Map all green'
    sent 'Low Slain' to Crime Syndicate and 'What If? Magic' to Strange Academy:
    Finals because those happened to have a #1 the same year."""
    base = re.sub(r"\s+Vol \d+$", "", str(fandom or ""))
    squash = lambda x: re.sub(r"[^a-z0-9]", "", re.sub(r"^the\s+", "", x.lower()))
    if squash(title) and squash(title) == squash(base):
        return 1.0
    a, b = _words(title), _words(base)
    return len(a & b) / len(a) if a and b else 0.0
ALIASES = os.path.join(ROOT, "title_aliases.json")


def norm_key(t):                                   # same as brb_apply_title_aliases.norm_key
    return re.sub(r"[^a-z0-9]+", " ", str(t or "").lower()).strip()


def base_from_url(u):
    p = urllib.parse.unquote(urllib.parse.urlparse(u).path.split("/wiki/", 1)[-1]).replace("_", " ")
    m = re.match(r"^(.+? Vol \d+)(?: \d+(?:\.\d+)?)?$", p)
    return m.group(1) if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    smap = json.load(open(MAP)) if os.path.exists(MAP) else {}
    aliases = json.load(open(ALIASES)) if os.path.exists(ALIASES) else {}
    paths = set()
    for d in (os.path.expanduser("~/Downloads"), ROOT):
        paths |= set(glob.glob(os.path.join(d, "data-fixes*.json")))
    dec = {}
    for p in sorted(paths, key=os.path.getmtime):
        try:
            recs = json.load(open(p))
        except Exception:  # noqa: BLE001
            continue
        for r in recs if isinstance(recs, list) else []:
            if isinstance(r, dict) and r.get("problem") == "series-match":
                dec[f"{r.get('title', '')}|||{r.get('vol') or r.get('issue') or '1'}"] = r
    changes, held_new = [], {}
    for key, r in dec.items():
        title = key.split("|||")[0]
        v = str(r.get("value", ""))
        if v == "skip-series":
            new = {"fandom": None, "skip": True}
        elif v.startswith("map:") or v.startswith("map!:") or v.startswith("maprename:"):
            # map: = bulk/unreviewed (title-fit gated); map!: / maprename: = you picked it on its own
            new = {"fandom": v.split(":", 1)[1].strip()}
            if not v.startswith("map:"):
                new["confirmed"] = True
        elif v.startswith("link:"):
            b = base_from_url(v[5:])
            if not b:
                print(f"  SKIP {key}: can't read a series from {v[5:]}"); continue
            new = {"fandom": b, "confirmed": True}
        else:
            continue
        new["wiki"] = r.get("wiki", "")
        if new.get("fandom") and not new.get("confirmed") and title_fit(title, new["fandom"]) < FIT_MIN:
            held_new[key] = new; continue
        if smap.get(key) != new:
            changes.append((key, smap.get(key), new))
            smap[key] = new
        if v.startswith("maprename:"):
            canon = re.sub(r"\s+Vol \d+$", "", new["fandom"])
            if canon != title:
                aliases[norm_key(title)] = {"canonical": canon, "source": "series-match"}
                smap[f"{canon}|||{key.split('|||')[1]}"] = new          # the renamed title maps too
                print(f"  rename: {title!r} -> {canon!r}")
    # Also re-check what is already on file: an unconfirmed mapping whose name doesn't fit
    # your title comes OUT of series_map (so arc fetch / autolink never use it) and waits
    # on Data Fix for a one-by-one call.
    held = dict(held_new)
    for key, m in list(smap.items()):
        if m.get("fandom") and not m.get("confirmed") and title_fit(key.split("|||")[0], m["fandom"]) < FIT_MIN:
            held[key] = m; del smap[key]
    print(f"decisions: {len(dec)}   map changes: {len(changes)}   held for review (name doesn't fit): {len(held)}")
    for k, m in sorted(held.items())[:80]:
        print(f"  HELD {k.replace('|||', ' v')}  ->  {m['fandom']}   (fit {title_fit(k.split('|||')[0], m['fandom']):.2f})")
    for k, old, new in changes[:40]:
        print(f"  {k.replace('|||', ' v')}: -> {new.get('fandom') or 'not on Fandom'}")
    if not a.apply:
        print("DRY RUN - nothing written. Re-run with --apply."); return
    json.dump(dict(sorted(smap.items())), open(MAP, "w"), indent=1, ensure_ascii=False)
    os.makedirs(os.path.dirname(PUB), exist_ok=True)
    shutil.copyfile(MAP, PUB)
    json.dump([{"key": k, "title": k.split("|||")[0], "vol": k.split("|||")[1], "fandom": m["fandom"],
                "wiki": m.get("wiki", ""), "fit": round(title_fit(k.split("|||")[0], m["fandom"]), 2)}
               for k, m in sorted(held.items())], open(HELD_PUB, "w"), indent=1, ensure_ascii=False)
    json.dump(dict(sorted(aliases.items())), open(ALIASES, "w"), indent=0, ensure_ascii=False)
    print(f"WROTE series_map.json ({len(smap)} series) + title_aliases.json")


if __name__ == "__main__":
    main()
