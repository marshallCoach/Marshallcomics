#!/usr/bin/env python3
"""brb_cover_linkcheck.py — validate every cover link actually resolves (free).

The free way to "check all covers": HEAD each cover URL in covers.json and flag
any that no longer load (dead CDN links, moved images). Reports them to
cover_deadlinks.csv. With --clear it removes the dead entries from covers.json
so the cover pipeline re-fetches them next run. No usage $.

    python3 brb_cover_linkcheck.py            # check + report only
    python3 brb_cover_linkcheck.py --clear    # also prune dead entries
Then re-fetch the pruned ones:
    python3 brb_cover_yeargate.py
    python3 brb.py --commit "cover link check + re-fetch" --yes
"""
import argparse, csv, json, os, sys, time, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
COVERS = os.path.join(ROOT, "covers.json")
PUBLIC = os.path.join(ROOT, "artifacts/comics-inventory/public/covers.json")
UA = "BlackReadBrown-Comics/1.0"


def alive(url):
    if not url:
        return True   # nothing to check
    for method in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(url, method=method, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=20) as r:
                return 200 <= r.status < 400
        except urllib.error.HTTPError as e:
            if e.code == 405 and method == "HEAD":
                continue          # some CDNs reject HEAD — retry as GET
            return False
        except Exception:
            return False
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--clear", action="store_true", help="prune dead entries from covers.json")
    ap.add_argument("--start", type=int, default=0, help="resume from this index (for a paused run)")
    ap.add_argument("--delay", type=float, default=0.1)
    args = ap.parse_args()

    cov = json.load(open(COVERS))
    keys = list(cov.keys())
    dead = []
    print(f"covers.json entries: {len(keys):,}  — checking from index {args.start}")
    for i, k in enumerate(keys):
        if i < args.start:
            continue
        entry = cov[k]
        url = entry.get("url") if isinstance(entry, dict) else entry
        if not alive(url):
            dead.append((k, url))
        if (i + 1) % 200 == 0:
            print(f"  …{i + 1}/{len(keys)} checked · {len(dead)} dead")
        time.sleep(args.delay)

    csvp = os.path.join(ROOT, "cover_deadlinks.csv")
    with open(csvp, "w", newline="") as f:
        w = csv.writer(f); w.writerow(["Key", "DeadURL"]); w.writerows(dead)
    print(f"\nDEAD cover links: {len(dead):,} / {len(keys):,}")
    print(f"Report: {os.path.basename(csvp)}")

    if args.clear and dead:
        for k, _ in dead:
            cov.pop(k, None)
        json.dump(cov, open(COVERS, "w"))
        if os.path.exists(PUBLIC):
            json.dump(cov, open(PUBLIC, "w"))
        print(f"CLEARED {len(dead):,} dead entries from covers.json — re-fetch with brb_cover_yeargate.py")
    elif dead:
        print("(report only — re-run with --clear to prune them for re-fetch)")


if __name__ == "__main__":
    main()
