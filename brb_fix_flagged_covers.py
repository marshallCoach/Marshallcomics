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


def key_matches(k, title, issue):
    """Does covers.json key `k` hold this book's cover? Matches BOTH the legacy
    2-part shape (Title|||#Issue / Title|||Issue) AND the volume-aware 3-part
    shape (Title|||Issue|||Vol, any volume) — the migration moved covers to the
    3-part keys, so a 2-part-only check silently clears nothing."""
    t = str(title or "").strip()
    i = norm_issue(issue)
    raw = str(issue or "").strip().lstrip("#")
    exact = {f"{t}|||#{i}", f"{t}|||{i}", f"{t}|||#{raw}", f"{t}|||{raw}"}
    if k in exact:
        return True
    # volume-aware: Title|||Issue|||<anything>  (delimiter stops "1" matching "10")
    return any(k.startswith(p) for p in
               (f"{t}|||{i}|||", f"{t}|||#{i}|||", f"{t}|||{raw}|||", f"{t}|||#{raw}|||"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--flags", help="path to a flagged-covers-*.json export")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--quiet", action="store_true", help="no exports is not an error (brb_all)")
    args = ap.parse_args()

    # Every un-applied export, not just the newest (several exports used to strand the
    # older ones). Applied exports move to processed_exports/ so they never re-clear.
    if args.flags:
        paths = [args.flags]
    else:
        paths = set()
        for d in (".", "~/Downloads", ROOT):
            paths |= set(glob.glob(os.path.join(os.path.expanduser(d), "flagged-covers-*.json")))
        paths = sorted(paths, key=os.path.getmtime)
        if args.quiet:
            # Automatic mode (brb_all): only exports made AFTER the last automatic run.
            # The first run just sets the marker — an old backlog (already applied by hand,
            # covers re-fetched since) must never be re-applied wholesale.
            marker = os.path.join(ROOT, "processed_exports", ".flagged_covers_since")
            since = os.path.getmtime(marker) if os.path.exists(marker) else None
            os.makedirs(os.path.dirname(marker), exist_ok=True)
            if since is None:
                open(marker, "w").write("start"); print(f"flagged covers: marker set - {len(paths)} older export(s) ignored (apply by hand with --flags)"); return
            paths = [p for p in paths if os.path.getmtime(p) > since]
            if args.apply:
                os.utime(marker, None)
    if not paths:
        if args.quiet:
            print("No flagged-covers exports - nothing to clear."); return
        sys.exit("no flagged-covers export found — pass --flags <path> (export from Cover → Cover Review)")
    entries, seen = [], set()
    for path in paths:
        data = json.load(open(path))
        for e in (data if isinstance(data, list) else list(data.values())):
            k = (str(e.get("Title", "")).strip().lower(), norm_issue(e.get("Issue")), (e.get("kind") or "incorrect"))
            if k not in seen:
                seen.add(k); entries.append(e)
    incorrect = [e for e in entries if (e.get("kind") or "incorrect") == "incorrect"]
    print(f"FLAGS:  {len(paths)} export(s): {', '.join(os.path.basename(p) for p in paths)}  "
          f"({len(entries)} total, {len(incorrect)} flagged incorrect)")
    if not incorrect:
        print("No 'incorrect' covers to clear — nothing to do.")
        return

    cov = json.load(open(COVERS))
    all_keys = list(cov.keys())
    removed, notfound = [], []
    for e in incorrect:
        hit = [k for k in all_keys if key_matches(k, e.get("Title"), e.get("Issue"))]
        # A cover you supplied yourself since flagging (pasted image / Fandom page) is kept.
        kept = [k for k in hit if isinstance(cov.get(k), dict) and cov[k].get("source") in ("manual-link", "fandom-page")]
        if kept:
            print(f"  keep {e.get('Title')} #{norm_issue(e.get('Issue'))}: you've since supplied this cover ({len(kept)} key)")
        hit = [k for k in hit if k not in kept]
        if hit:
            for k in hit:
                removed.append((k, e.get("Title"), e.get("Issue")))
                if args.apply:
                    cov.pop(k, None)
        elif not kept:
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
    from brb_guard import check
    check("flagged_covers", {"covers cleared": len(removed)})
    json.dump(cov, open(COVERS, "w"))
    if os.path.exists(PUBLIC):
        json.dump(cov, open(PUBLIC, "w"))
    if not args.flags:                               # consumed: never re-clear on a later run
        import datetime
        dest = os.path.join(ROOT, "processed_exports"); os.makedirs(dest, exist_ok=True)
        for p in paths:
            try:
                os.replace(p, os.path.join(dest, f"{datetime.datetime.now():%Y%m%d_%H%M%S}_{os.path.basename(p)}"))
            except OSError:
                pass
    print(f"\nWROTE covers.json (+ public copy) — {len(removed)} entries cleared.")
    print("Re-fetch:  python3 -u brb_cover_yeargate.py   (then brb_cv_covers.py if proxy up)")
    print("Publish:   python3 brb.py --commit \"re-fetch flagged covers\" --yes")


if __name__ == "__main__":
    main()
