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


def find_key(covers, title, issue):
    """Find the covers.json key for a title+issue, tolerating float formatting."""
    # Try exact, then float-formatted issue
    candidates = [
        f"{title}|||{issue}",
        f"{title}|||{float(issue)}",
        f"{title}|||{int(float(issue))}.0",
    ]
    for c in candidates:
        if c in covers:
            return c
    # Fuzzy: case-insensitive title match
    title_lower = title.lower()
    issue_str   = str(issue)
    for k in covers:
        parts = k.split("|||")
        if len(parts) == 2 and parts[0].lower() == title_lower:
            stored_issue = parts[1]
            try:
                if abs(float(stored_issue) - float(issue_str)) < 0.01:
                    return k
            except ValueError:
                if stored_issue == issue_str:
                    return k
    return None


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
        key = find_key(covers, title, issue)
        if key is None:
            missing.append(f"  NOT FOUND: '{title}' #{issue}")
            continue
        old = covers[key]
        covers[key] = None
        old_url = (old or {}).get("url", "no url") if old else "already null"
        nulled.append(f"  Nulled: {key}")
        print(f"  ✓  '{title}' #{issue}  →  null  (was: {str(old_url)[:60]})")

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
