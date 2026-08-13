#!/usr/bin/env python3
"""brb_cv_covers.py — fill MISSING covers for non-Marvel/DC titles via the local
Comic Vine proxy (artifacts/api-server, needs COMIC_VINE_API_KEY on :5001).

The Fandom year-gate resolver (brb_cover_yeargate.py) only knows the Marvel and
DC Fandom wikis, so Image/IDW/BOOM!/Wildstorm books (Die, Star Trek, Firefly,
Wildcats: Version 3.0, ...) always come back blank there. Comic Vine covers all
publishers and the proxy already applies the SAME hard year-gate, so it's the
right source for these. The proxy holds the API key and writes covers.json
itself — Roberto runs this; Code never makes the credentialed call.

For each inventory row whose cover is currently missing and whose publisher is
NOT Marvel/DC, this calls /covers/search?...&refresh=1 (refresh so a prior null
is re-tried). Year-gated inside the proxy, so a wrong-era cover is never written.

Usage (proxy must be up on :5001 with the key):
    cd artifacts/api-server && COMIC_VINE_API_KEY=... npm start   # one terminal
    python3 brb_cv_covers.py                 # all missing non-M/DC covers
    python3 brb_cv_covers.py --limit 50      # first 50 (rate-limit friendly)
    python3 brb_cv_covers.py --titles "Die,Star Trek,Firefly,Wildcats: Version 3.0"
"""
import argparse, difflib, glob, json, os, re, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "attached_assets")
COVERS = os.path.join(ROOT, "covers.json")
PROXY = "http://localhost:5001/api/covers/search"
SET = "http://localhost:5001/api/covers/set"
SKIP_PUB = {"marvel", "dc", "dc comics"}
STOP = {"the", "a", "an", "of", "and", "or", "vs"}


def base(t):
    """Normalized title for matching: drop a trailing (YYYY), non-alnum -> space."""
    s = re.sub(r"\(\s*\d{4}\s*\)", " ", str(t or "").lower())
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def name_ok(inv, cv):
    """Guard against CV substring mis-matches (short titles: "Die" ->
    "Rough Riders: Ride or Die"). Accept only a real volume-name match:
    normalized equality, or the inventory tokens fully inside CV's name with a
    high overall similarity. Rejects "contains one shared word" false hits."""
    if not cv:
        return False
    bi, bc = base(inv), base(cv)
    if bi == bc:
        return True
    ti = {w for w in bi.split() if w not in STOP and len(w) > 1}
    tc = {w for w in bc.split() if w not in STOP and len(w) > 1}
    ratio = difflib.SequenceMatcher(None, bi, bc).ratio()
    return (ti and ti <= tc and ratio >= 0.7) or ratio >= 0.85


def latest_xlsx():
    m = [f for f in glob.glob(os.path.join(ASSETS, "comics_inventory_*.xlsx")) if not os.path.basename(f).startswith("~$")]
    return max(m, key=os.path.getmtime) if m else None


def ni(v):
    s = str(v).strip().lstrip("#")
    try:
        f = float(s); return str(int(f)) if f == int(f) else s
    except (ValueError, TypeError):
        return s


def nv(v):
    try:
        return str(int(float(str(v).strip())))
    except (ValueError, TypeError):
        return "1"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--titles", default="", help="comma-list to restrict to")
    ap.add_argument("--flags", default="", help="flagged-covers JSON: restrict to exactly these (title,issue) books")
    ap.add_argument("--delay", type=float, default=19.0, help="seconds between CV calls (200/hr)")
    args = ap.parse_args()
    only = {t.strip().lower() for t in args.titles.split(",") if t.strip()}
    # --flags scopes to the exact (title, issue) pairs the user flagged, so a
    # prolific title (Batman, Fantastic Four) doesn't drag in hundreds of
    # unrelated blank issues — only the specific flagged books are fetched.
    flag_pairs = None
    if args.flags:
        fl = json.load(open(args.flags))
        flag_pairs = {(str(f["Title"]).strip().lower(), ni(f["Issue"])) for f in fl}

    covers = json.load(open(COVERS))

    def has(t, iss, vol):
        for k in (f"{t}|||{iss}|||{vol}", f"{t}|||{iss}"):
            e = covers.get(k)
            if e and e.get("url"):
                return True
        return False

    import openpyxl
    x = latest_xlsx()
    ws = next(w for w in openpyxl.load_workbook(x, read_only=True, data_only=True).worksheets if (w.title == "Sheet X" or w.title.startswith("✅ Clean Inventory")))
    rows = list(ws.iter_rows(values_only=True)); H = list(rows[0]); C = {n: H.index(n) for n in H if n}

    def g(r, n):
        i = C.get(n); return r[i] if i is not None else None

    todo = []; seen = set()
    for r in rows[1:]:
        t = str(g(r, "Title") or "").strip(); iss = ni(g(r, "Issue #")); vol = nv(g(r, "Volume"))
        pub = str(g(r, "Publisher") or "").strip(); yr = str(g(r, "Year") or "").strip()
        if not t or not iss:
            continue
        if flag_pairs is not None and (t.lower(), iss) not in flag_pairs:
            continue
        if only:
            # An explicit --titles list overrides the publisher skip: if you name
            # a title, fetch it regardless of publisher (lets CV rescue Marvel/DC
            # books the Fandom year-gate can't resolve — legacy numbering, too-new).
            if t.lower() not in only:
                continue
        elif pub.lower() in SKIP_PUB:
            continue
        if has(t, iss, vol):
            continue
        if (t, iss, vol) in seen:
            continue
        seen.add((t, iss, vol)); todo.append((t, iss, vol, pub, yr))

    if args.limit:
        todo = todo[:args.limit]
    print(f"missing non-Marvel/DC covers to fetch via CV proxy: {len(todo)}", flush=True)

    def reject(t, iss, vol):
        """Blank a wrong CV match through the proxy (it owns covers.json) so the
        book stays an honest blank instead of showing another title's cover."""
        body = json.dumps({"title": t, "issue": iss, "volume": vol, "url": None, "large": None}).encode()
        try:
            urllib.request.urlopen(urllib.request.Request(SET, data=body, headers={"Content-Type": "application/json"}), timeout=20).read()
        except Exception:
            pass

    filled = rejected = 0
    for i, (t, iss, vol, pub, yr) in enumerate(todo, 1):
        q = urllib.parse.urlencode({"title": t, "issue": iss, "volume": vol,
                                    "publisher": pub, "year": yr, "refresh": "1"})
        try:
            with urllib.request.urlopen(f"{PROXY}?{q}", timeout=40) as resp:
                d = json.load(resp)
            m = d.get("match") or {}
            cvname = m.get("volume_name") or m.get("volume") or ""
            if d.get("cover_url") and name_ok(t, cvname):
                filled += 1
                print(f"  [{i}/{len(todo)}] {t} #{iss} -> {cvname} ({m.get('cover_date','?')})", flush=True)
            elif d.get("cover_url"):
                # CV returned a cover but for a different title — blank it.
                reject(t, iss, vol); rejected += 1
                print(f"  [{i}/{len(todo)}] {t} #{iss} REJECT wrong-title '{cvname}'", flush=True)
            if not d.get("cached"):
                time.sleep(args.delay)   # only sleep on a real CV call
        except Exception as e:
            print(f"  [{i}/{len(todo)}] {t} #{iss} ERR {e}", flush=True)
    print(f"\nFilled {filled}/{len(todo)} via Comic Vine (year-gated); rejected {rejected} wrong-title matches. Run: node gen_data.mjs", flush=True)


if __name__ == "__main__":
    main()
