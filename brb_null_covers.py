#!/usr/bin/env python3
"""
brb_null_covers.py — Null out incorrect cover entries so --retry-nulls can re-fetch them.
Run from: ~/marshallcomics/

Usage:
    python3 brb_null_covers.py "Batman and Robin" 4.9
    python3 brb_null_covers.py "U.S. Agent" 1 "Batwoman" 4 "Uncanny X-Men" 406

    Pass title+issue pairs in sequence. Quotes required for titles with spaces.
    After running, execute: node fetchCovers.mjs --retry-nulls
"""

import sys, os, json

REPO_ROOT   = os.path.dirname(os.path.abspath(__file__))
COVERS_PATH = os.path.join(REPO_ROOT, "covers.json")


def find_keys(covers, title, issue):
    """Find ALL covers.json keys for a title+issue, tolerating float formatting
    and the Title|||Issue|||Volume key format (multiple physical copies of the
    same title+issue in different volumes/runs share the same Title+Issue but
    get distinct keys - a plain 2-part lookup silently misses all of them).
    Returns a list since a title+issue can legitimately match several volumes;
    caller is responsible for nulling all of them when that happens."""
    title_lower = title.lower()
    issue_str   = str(issue)

    def issue_matches(stored_issue):
        try:
            return abs(float(stored_issue) - float(issue_str)) < 0.01
        except ValueError:
            return stored_issue == issue_str

    # Exact 2-part candidates first (fast path, preserves prior behavior)
    candidates = [
        f"{title}|||{issue}",
        f"{title}|||{float(issue)}" if issue_str.replace(".", "", 1).isdigit() else None,
        f"{title}|||{int(float(issue))}.0" if issue_str.replace(".", "", 1).isdigit() else None,
    ]
    exact = [c for c in candidates if c and c in covers]
    if exact:
        return exact

    # Fuzzy scan: case-insensitive title match, both 2-part (Title|||Issue) and
    # 3-part (Title|||Issue|||Volume) keys. Collect every match - do not stop
    # at the first one, since multiple volumes of the same title+issue can
    # coexist and all need to be nulled if the caller can't disambiguate.
    matches = []
    for k in covers:
        parts = k.split("|||")
        if len(parts) not in (2, 3):
            continue
        if parts[0].lower() != title_lower:
            continue
        if issue_matches(parts[1]):
            matches.append(k)
    return matches


def main():
    args = sys.argv[1:]
    if not args or len(args) % 2 != 0:
        print("Usage: python3 brb_null_covers.py \"Title\" issue# [\"Title2\" issue2# ...]")
        print("  e.g: python3 brb_null_covers.py \"U.S. Agent\" 1 \"Batwoman\" 4")
        sys.exit(1)

    if not os.path.exists(COVERS_PATH):
        print(f"ERROR: covers.json not found at {COVERS_PATH}")
        sys.exit(1)

    with open(COVERS_PATH) as f:
        covers = json.load(f)

    pairs = [(args[i], args[i+1]) for i in range(0, len(args), 2)]

    nulled  = []
    missing = []

    for title, issue in pairs:
        keys = find_keys(covers, title, issue)
        if not keys:
            missing.append(f"  NOT FOUND: '{title}' #{issue}")
            continue
        if len(keys) > 1:
            print(f"  ⚠  '{title}' #{issue}  matches {len(keys)} volumes - "
                  f"nulling all of them (can't disambiguate from title+issue alone)")
        for key in keys:
            old = covers[key]
            covers[key] = None
            old_url = (old or {}).get("url", "no url") if old else "already null"
            nulled.append(f"  Nulled: {key}")
            print(f"  ✓  {key}  →  null  (was: {str(old_url)[:60]})")

    if missing:
        print()
        for m in missing:
            print(f"  ✗  {m}")

    if nulled:
        with open(COVERS_PATH, "w") as f:
            json.dump(covers, f, indent=2)
        print(f"\n{len(nulled)} cover(s) nulled in covers.json")
        print("Run next:  node fetchCovers.mjs --retry-nulls")
    else:
        print("\nNothing changed.")


if __name__ == "__main__":
    main()
