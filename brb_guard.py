#!/usr/bin/env python3
"""brb_guard.py — safety limits for every step that writes the inventory or covers.

A step that would change MORE than its limit stops BEFORE saving anything and exits 3
(brb_all then stops too), so a bug or a stale backlog can never mass-edit the data.
If the change really is intended: read the list the step printed, then re-run with
    BRB_FORCE=1 python3 <script> --apply          (one step)
    BRB_FORCE=1 python3 brb_all.py                (whole pipeline)
"""
import os, sys

# step -> {what: limit}. Sized from normal weekly runs, with headroom.
LIMITS = {
    "flagged_covers": {"covers cleared": 100},
    "data_fixes":     {"Volumes changed": 120, "Years changed": 25},
    "fandom_pages":   {"Years overwritten": 25, "credits replaced (CONFLICT)": 60, "bad covers replaced": 500},
    "title_aliases":  {"rows renamed": 150},
    "year_from_pubdate": {"Years changed": 60},
    "review_edits":   {"rows deleted": 10, "fields changed": 300},
    "fandom_fill_wide": {"cells filled": 200},
    "writer_fixes":   {"writer cells changed": 100},
    "reclaim_restore": {"rows added": 50},
    "row_fixes":      {"cells changed": 50, "rows moved to Duplicates": 20},
    "image_pages":    {"cells filled": 150, "covers added": 60},
    "gcd_credits":    {"cells cleaned (company/duplicate names)": 60, "names added (UNION)": 120},
}


def check(step, counts):
    """counts: {what: n}. Exit 3 (nothing saved) if any count exceeds its limit."""
    over = [(w, n, LIMITS.get(step, {}).get(w)) for w, n in counts.items()
            if LIMITS.get(step, {}).get(w) is not None and n > LIMITS[step][w]]
    if not over:
        return
    forced = os.environ.get("BRB_FORCE") == "1" or "--force" in sys.argv
    for w, n, lim in over:
        print(f"\n{'⚠️  FORCED' if forced else '⛔ SAFETY LIMIT'}: {step} would make {n} {w} (limit {lim}).")
    if forced:
        print("   BRB_FORCE=1 set - continuing.")
        return
    print("   Nothing has been saved. Check the list above - if it is right, re-run with")
    print(f"   BRB_FORCE=1 python3 {os.path.basename(sys.argv[0])} --apply   (or BRB_FORCE=1 python3 brb_all.py)")
    sys.exit(3)
