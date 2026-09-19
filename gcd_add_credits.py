#!/usr/bin/env python3
"""
gcd_add_credits.py — incremental follow-on to gcd_build_local_db.py.

The base extraction found that GCD's legacy free-text credit fields
(gcd_story.script / .pencils) are empty for modern entries — the real,
maintained creator credits live in the normalized gcd_story_credit table
(→ gcd_creator_name_detail for the name, → gcd_credit_type for the role).

This adds those three tables to the EXISTING gcd_local.sqlite, filtered to
the story_ids the base run already matched — so it does NOT re-scan the
3.78GB dump for series/issue/story again, only for the credit rows that
attach to stories we already care about.

Usage:  python3 gcd_add_credits.py /path/to/2026-07-15.sql
"""
import os, sqlite3, sys
from gcd_build_local_db import scan_table, OUT_DB as DB

# credit_type_id → role (from gcd_credit_type, verified from the dump):
#   1 script | 2 pencils | 3 inks | 4 colors | 5 letters | 6 editing
#   7 pencils and inks | 8 pencils, inks and colors | 9 painting
#   10 script,pencils,inks | 11 +colors | 12 +letters | 13 +colors,letters
#   14 pencils,inks,letters
WRITER_TYPES = {1, 10, 11, 12, 13}
ARTIST_TYPES = {2, 7, 8, 9, 10, 11, 12, 13, 14}


def main():
    if len(sys.argv) < 2:
        print("usage: python3 gcd_add_credits.py /path/to/dump.sql"); sys.exit(1)
    dump = sys.argv[1]
    if not os.path.exists(DB):
        print(f"ERROR: {DB} not found — run gcd_build_local_db.py first."); sys.exit(1)

    conn = sqlite3.connect(DB)
    story_ids = {r[0] for r in conn.execute("SELECT id FROM gcd_story")}
    print(f"Matched stories to attach credits to: {len(story_ids):,}", file=sys.stderr)
    if not story_ids:
        print("No stories in DB — nothing to do."); sys.exit(1)

    conn.executescript("""
        DROP TABLE IF EXISTS gcd_credit_type;
        DROP TABLE IF EXISTS gcd_creator_name_detail;
        DROP TABLE IF EXISTS gcd_story_credit;
        CREATE TABLE gcd_credit_type (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE gcd_creator_name_detail (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE gcd_story_credit (
            id INTEGER PRIMARY KEY, story_id INTEGER, creator_id INTEGER,
            credit_type_id INTEGER, credit_name TEXT
        );
        CREATE INDEX idx_credit_story ON gcd_story_credit(story_id);
    """)

    # ── gcd_credit_type (tiny — keep all) ────────────────────────────────────
    n = 0
    for d in scan_table(dump, "gcd_credit_type", lambda d: True):
        conn.execute("INSERT OR IGNORE INTO gcd_credit_type (id,name) VALUES (?,?)", (d["id"], d["name"]))
        n += 1
    conn.commit()
    print(f"gcd_credit_type: {n} rows", file=sys.stderr)

    # ── gcd_creator_name_detail (id → name; keep all, 167k rows) ─────────────
    n = 0
    for d in scan_table(dump, "gcd_creator_name_detail", lambda d: True, progress_label="creators"):
        conn.execute("INSERT OR IGNORE INTO gcd_creator_name_detail (id,name) VALUES (?,?)", (d["id"], d["name"]))
        n += 1
        if n % 5000 == 0:
            conn.commit()
    conn.commit()
    print(f"gcd_creator_name_detail: {n} rows", file=sys.stderr)

    # ── gcd_story_credit filtered to our matched stories ─────────────────────
    def credit_filter(d):
        try:
            return int(d["story_id"]) in story_ids and d["deleted"] in ("0", 0, None)
        except (TypeError, ValueError):
            return False

    n = 0
    for d in scan_table(dump, "gcd_story_credit", credit_filter, progress_label="credits"):
        conn.execute(
            "INSERT OR IGNORE INTO gcd_story_credit (id,story_id,creator_id,credit_type_id,credit_name) VALUES (?,?,?,?,?)",
            (d["id"], d["story_id"], d["creator_id"], d["credit_type_id"], d["credit_name"]),
        )
        n += 1
        if n % 2000 == 0:
            conn.commit()
    conn.commit()
    print(f"gcd_story_credit: {n} rows matched to our stories", file=sys.stderr)

    conn.close()
    print(f"\nDone. Credit tables added to {DB}", file=sys.stderr)


if __name__ == "__main__":
    main()
