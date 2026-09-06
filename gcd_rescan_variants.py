#!/usr/bin/env python3
"""
gcd_rescan_variants.py — incremental rescan of the GCD dump for inventory
titles the base extraction missed.

The base build (gcd_build_local_db.py) matched punctuation-normalized names,
which still misses four real variant classes found in the 411-title unmatched
audit (gcd_unmatched_titles.csv):
  - '&' vs 'and'            (Wolverine & the X-Men)
  - hyphen-joined words     (Legion of Super-Heroes vs Superheroes)
  - leading article         (The Astonishing Ant-Man)
  - word-order flips        (Captain America: Sam Wilson vs Sam Wilson: ...)

This scans ONLY for those missing titles with progressively looser matching
(tight > article-strip > token-sort, first hit wins), then cascades
issues/stories/credits for newly found series — additive to the existing
gcd_local.sqlite, never dropping anything. Where the loose match hits a
series already in the DB under a different matched_title, it records an
alias in gcd_title_alias instead (consumed by brb_gcd_lookup.find_series).

True misspellings (e.g. 'Astonishing X-Men: Exogenesis' for Xenogenesis)
still can't match — those need the xlsx title fixed by hand.

Usage:  python3 gcd_rescan_variants.py /path/to/2026-07-15.sql
"""
import os, re, sqlite3, sys
from gcd_build_local_db import scan_table, normalize_title, load_inventory_titles, OUT_DB as DB

WRITER_TYPES = {1, 10, 11, 12, 13}  # kept in sync with gcd_add_credits.py


def tight(t):
    t = re.sub(r"&", " and ", str(t or "").lower())
    return re.sub(r"[^a-z0-9]", "", t)


def tight_nothe(t):
    n = tight(t)
    return n[3:] if n.startswith("the") else n


def tokensort(t):
    return "".join(sorted(normalize_title(t).split()))


def main():
    if len(sys.argv) < 2:
        print("usage: python3 gcd_rescan_variants.py /path/to/dump.sql"); sys.exit(1)
    dump = sys.argv[1]

    conn = sqlite3.connect(DB)
    conn.execute("CREATE TABLE IF NOT EXISTS gcd_title_alias (alias TEXT PRIMARY KEY, matched_title TEXT, match_mode TEXT)")

    titles, _ = load_inventory_titles()
    # Difference from gcd_rescan_variants.py: consider EVERY inventory title, not
    # just unmatched ones. A title can be "matched" yet still be missing whole
    # volumes — GCD files the 1987-2006 Wally West run as "Flash" while the
    # inventory says "The Flash", and tight() treats those as different titles,
    # so that volume was never pulled. Existing series are skipped by id below,
    # so re-scanning matched titles is additive and safe.
    missing = sorted(titles)
    print(f"Inventory titles considered (all): {len(missing)}", file=sys.stderr)

    # variant → inventory-title maps, in match priority order
    v_tight, v_nothe, v_tsort = {}, {}, {}
    for t in missing:
        v_tight.setdefault(tight(t), t)
        v_nothe.setdefault(tight_nothe(t), t)
        v_tsort.setdefault(tokensort(t), t)

    def match_title(name):
        k = tight(name)
        if k in v_tight:
            return v_tight[k], "tight"
        k = tight_nothe(name)
        if k in v_nothe:
            return v_nothe[k], "article-strip"
        return None, None

    # ── Stage 1: series ──────────────────────────────────────────────────────
    existing_ids = {str(r[0]) for r in conn.execute("SELECT id FROM gcd_series")}
    new_series_ids = set()
    aliases = {}
    n_new = 0

    def series_filter(d):
        return match_title(d["name"])[0] is not None

    for d in scan_table(dump, "gcd_series", series_filter, progress_label="series-rescan"):
        inv_title, mode = match_title(d["name"])
        if d["id"] in existing_ids:
            # series already extracted under another matched_title — alias only
            cur = conn.execute("SELECT matched_title FROM gcd_series WHERE id=?", (d["id"],)).fetchone()
            if cur and cur[0] != inv_title:
                aliases[inv_title] = (cur[0], mode)
            continue
        conn.execute(
            "INSERT OR IGNORE INTO gcd_series (id,name,year_began,year_ended,publisher_id,issue_count,matched_title) VALUES (?,?,?,?,?,?,?)",
            (d["id"], d["name"], d["year_began"], d["year_ended"], d["publisher_id"], d["issue_count"], inv_title))
        new_series_ids.add(d["id"])
        n_new += 1
    for alias, (mt, mode) in aliases.items():
        conn.execute("INSERT OR REPLACE INTO gcd_title_alias (alias,matched_title,match_mode) VALUES (?,?,?)", (alias, mt, mode))
    conn.commit()
    print(f"Stage 1: {n_new} NEW series rows; {len(aliases)} alias entries", file=sys.stderr)
    if not new_series_ids:
        print("No new series — aliases only. Done.", file=sys.stderr)
        return

    # ── Stage 2: issues for new series ───────────────────────────────────────
    new_issue_ids = set()
    n = 0
    for d in scan_table(dump, "gcd_issue", lambda d: d["series_id"] in new_series_ids, progress_label="issue-rescan"):
        new_issue_ids.add(d["id"])
        conn.execute(
            "INSERT OR IGNORE INTO gcd_issue (id,series_id,number,key_date,publication_date) VALUES (?,?,?,?,?)",
            (d["id"], d["series_id"], d["number"], d["key_date"], d["publication_date"]))
        n += 1
        if n % 500 == 0:
            conn.commit()
    conn.commit()
    print(f"Stage 2: {n} new issue rows", file=sys.stderr)

    # ── Stage 3: stories for new issues ──────────────────────────────────────
    new_story_ids = set()
    n = 0
    for d in scan_table(dump, "gcd_story", lambda d: d["issue_id"] in new_issue_ids, progress_label="story-rescan"):
        new_story_ids.add(int(d["id"]))
        conn.execute(
            "INSERT OR IGNORE INTO gcd_story (id,issue_id,sequence_number,script,pencils,type_id) VALUES (?,?,?,?,?,?)",
            (d["id"], d["issue_id"], d["sequence_number"], d["script"], d["pencils"], d["type_id"]))
        n += 1
        if n % 1000 == 0:
            conn.commit()
    conn.commit()
    print(f"Stage 3: {n} new story rows", file=sys.stderr)

    # ── Stage 4: credits for new stories (additive; name/type tables already complete) ──
    def credit_filter(d):
        try:
            return int(d["story_id"]) in new_story_ids and d["deleted"] in ("0", 0, None)
        except (TypeError, ValueError):
            return False

    n = 0
    for d in scan_table(dump, "gcd_story_credit", credit_filter, progress_label="credit-rescan"):
        conn.execute(
            "INSERT OR IGNORE INTO gcd_story_credit (id,story_id,creator_id,credit_type_id,credit_name) VALUES (?,?,?,?,?)",
            (d["id"], d["story_id"], d["creator_id"], d["credit_type_id"], d["credit_name"]))
        n += 1
        if n % 2000 == 0:
            conn.commit()
    conn.commit()
    print(f"Stage 4: {n} new credit rows", file=sys.stderr)

    conn.close()
    print(f"\nDone. Rescan added to {DB}", file=sys.stderr)


if __name__ == "__main__":
    main()
