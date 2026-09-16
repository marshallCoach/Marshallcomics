#!/usr/bin/env python3
"""brb_fix_flagged_covers.py — clear the covers you flagged as incorrect so the
cover pipeline re-fetches them correctly.

Reads a flagged-covers export (the JSON the Cover Review "export" button
downloads), keeps only kind == "incorrect" (variants / dupes are NOT wrong
covers), and removes those entries from covers.json. Once cleared, a row is
"missing a cover" again, so brb_cover_yeargate.py / brb_cv_covers.py will
re-fetch it — now with your corrected volumes and years helping the match.

Matches covers.json keys by Title + Issue (the 2-part "Title|||#Issue" form the
file uses). Dry-run by default.

    python3 brb_fix_flagged_covers.py
    python3 brb_fix_flagged_covers.py --flags ~/Downloads/flagged-covers-2026-09-13.json --apply
Then re-fetch + publish:
    python3 -u brb_cover_yeargate.py
    (proxy up on :5001?)  python3 -u brb_cv_covers.py
    python3 brb.py --commit "re-fetch flagged covers" --yes
"""
import argparse, glob, json, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
COVERS = os.path.join(ROOT, "covers.json")
PUBLIC = os.path.join(ROOT, "artifacts/comics-inventory/public/covers.json")


def newest(dirs, pat):
    c = []
    for d in dirs:
        c += glob.glob(os.path.join(os.path.expanduser(d), pat))
    return max(c, key=os.path.getmtime) if c else None


def norm_issue(v):
    s = str(v or "").strip().lstrip("#")
    try:
        f = float(s); return str(int(f)) if f == int(f) else s
    except ValueError:
        return s


def candidate_keys(title, issue):
    """Every covers.json key shape that could hold this book's cover."""
    t = str(title or "").strip()
    i = norm_issue(issue)
    return {f"{t}|||#{i}", f"{t}|||{i}", f"{t}|||#{issue}".strip(), f"{t}|||{issue}".strip()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--flags", help="path to a flagged-covers-*.json export")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    path = args.flags or newest([".", "~/Downloads", ROOT], "flagged-covers-*.json")
    if not path or not os.path.exists(path):
        sys.exit("no flagged-covers export found — pass --flags <path> (export from Cover → Cover Review)")
    data = json.load(open(path))
    entries = data if isinstance(data, list) else list(data.values())
    incorrect = [e for e in entries if (e.get("kind") or "incorrect") == "incorrect"]
    print(f"FLAGS:  {os.path.basename(path)}  ({len(entries)} total, {len(incorrect)} flagged incorrect)")
    if not incorrect:
        print("No 'incorrect' covers to clear — nothing to do.")
        return

    cov = json.load(open(COVERS))
    removed, notfound = [], []
    for e in incorrect:
        keys = candidate_keys(e.get("Title"), e.get("Issue"))
        hit = [k for k in keys if k in cov]
        if hit:
            for k in hit:
                removed.append((k, e.get("Title"), e.get("Issue")))
                if args.apply:
                    cov.pop(k, None)
        else:
            notfound.append((e.get("Title"), e.get("Issue")))

    print(f"\nWOULD CLEAR {len(removed)} cover entr(y/ies):" if not args.apply else f"CLEARED {len(removed)}:")
    for k, t, i in removed[:40]:
        print(f"  {t} #{norm_issue(i)}   [{k}]")
    if len(removed) > 40:
        print(f"  … and {len(removed) - 40} more")
    if notfound:
        print(f"\n{len(notfound)} flagged book(s) had no cover entry to clear (already blank):")
        for t, i in notfound[:20]:
            print(f"    {t} #{norm_issue(i)}")

    if not args.apply:
        print("\nDRY RUN — nothing written. Re-run with --apply to clear them.")
        return
    json.dump(cov, open(COVERS, "w"))
    if os.path.exists(PUBLIC):
        json.dump(cov, open(PUBLIC, "w"))
    print(f"\nWROTE covers.json (+ public copy) — {len(removed)} entries cleared.")
    print("Re-fetch:  python3 -u brb_cover_yeargate.py   (then brb_cv_covers.py if proxy up)")
    print("Publish:   python3 brb.py --commit \"re-fetch flagged covers\" --yes")


if __name__ == "__main__":
    main()
