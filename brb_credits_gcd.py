#!/usr/bin/env python3
"""brb_credits_gcd.py — overnight credits fill+correct from the local GCD.

Free, offline, no AI vision. For every inventory row it resolves the GCD
series+issue (reusing brb_gcd_lookup.find_series) and pulls the FULL set of
creators per role:

    Writer(s)    <- every script credit on the comic-story sequences
    Artist(s)    <- every pencils/painting credit on the comic-story sequences
    Cover Artist <- every pencils/painting credit on the COVER sequence (type 6)

Why full sets: GCD's find_credits() returns only the first credit per role, so a
book like "52 #1" (Johns & Morrison & Rucka & Waid) would look like just "Geoff
Johns" and auto-correct would DOWNGRADE a correct 4-name cell to 1. Collecting
the whole set fixes that at the source.

Write mode (fill blanks + auto-correct, made safe so it never loses a name):
  * empty cell                       -> FILL with GCD's set
  * existing == GCD set              -> no change
  * existing is a SUPERSET of GCD    -> KEEP existing (never downgrade)
  * existing overlaps GCD, each adds -> UNION (add missing co-creators)
  * zero overlap (genuinely wrong)   -> overwrite with GCD, logged as CONFLICT
  * GCD silent for a role            -> leave the cell untouched

Every change is logged to a review CSV (Action = FILL / UNION / CONFLICT, old ->
new, resolved series). Read-only against the xlsx until the end; writes a NEW
dated xlsx (the canonical file is never edited in place).

Usage:
    python3 brb_credits_gcd.py --dry-run            # preview counts + CSV, no xlsx
    python3 brb_credits_gcd.py --limit 300          # small live sample
    python3 brb_credits_gcd.py                       # full run, writes new xlsx
    python3 brb_credits_gcd.py --no-conflicts        # skip zero-overlap overwrites
Then:
    python3 brb.py --commit "GCD credits fill+correct" --yes
"""
import argparse, csv, datetime, glob, os, re, sqlite3, sys

from brb_gcd_lookup import (
    find_series, norm_issue, _clean_name,
    COMIC_STORY_TYPE_ID, COVER_STORY_TYPE_ID, WRITER_TYPES, ARTIST_TYPES,
)

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "attached_assets")
DB = os.path.join(ROOT, "gcd_local.sqlite")

H_TITLE, H_ISSUE, H_YEAR, H_PUB = "Title", "Issue #", "Year", "Publisher"
ROLES = ("Writer(s)", "Artist(s)", "Cover Artist")  # -> writer / artist / cover_artist


def latest_xlsx():
    m = [f for f in glob.glob(os.path.join(ASSETS, "comics_inventory_*.xlsx"))
         if " copy" not in f and not os.path.basename(f).startswith("~$")]
    if not m:
        sys.exit("no attached_assets/comics_inventory_*.xlsx found")
    return max(m, key=os.path.getmtime)


def resolve_src(src):
    """--src may be a full path or a bare basename in attached_assets."""
    if not src:
        return latest_xlsx()
    if os.path.exists(src):
        return src
    cand = os.path.join(ASSETS, src)
    if os.path.exists(cand):
        return cand
    sys.exit(f"--src not found: {src}")


def nk(v):
    """Normalized key for one creator name — case/punctuation-insensitive."""
    return re.sub(r"[^a-z0-9]+", " ", str(v or "").lower()).strip()


PLACEHOLDERS = {"various", "unknown", "uncredited", "n a", "none", "tbd", ""}


def split_names(cell):
    """Existing cell -> ordered list of real creator names. Drops role
    annotations like '(layouts)' and junk placeholders like 'Various' so
    overlap detection compares NAMES, not formatting — keeps a real name from
    being flagged CONFLICT just because it carried a '(layouts)' tag."""
    s = re.sub(r"\([^)]*\)", " ", str(cell or ""))          # strip (role) notes
    parts = re.split(r"\s*(?:&|,|/|\band\b)\s*", s.strip())
    out = []
    for p in parts:
        p = p.strip()
        if p and nk(p) not in PLACEHOLDERS:
            out.append(p)
    return out


def _names(conn, story_ids, want_types):
    """Ordered, de-duplicated creator names of the wanted credit types across
    the given stories (GCD sequence order, then credit id)."""
    out, seen = [], set()
    if not story_ids:
        return out
    qs = ",".join("?" * len(story_ids))
    for ctype, name in conn.execute(
        f"SELECT c.credit_type_id, COALESCE(NULLIF(cn.name,''), c.credit_name) "
        f"FROM gcd_story_credit c "
        f"LEFT JOIN gcd_creator_name_detail cn ON cn.id = c.creator_id "
        f"WHERE c.story_id IN ({qs}) ORDER BY c.story_id, c.id", story_ids):
        if ctype not in want_types:
            continue
        nm = _clean_name(name)
        if nm and nk(nm) not in seen:
            seen.add(nk(nm)); out.append(nm)
    return out


def credit_sets(conn, series_id, issue):
    """Return {'writer':[...], 'artist':[...], 'cover_artist':[...]} full lists,
    or None if the issue isn't in that series."""
    inum = norm_issue(issue)
    iid = None
    for rid, number in conn.execute(
            "SELECT id, number FROM gcd_issue WHERE series_id = ?", (series_id,)):
        if norm_issue(number) == inum:
            iid = rid
            break
    if iid is None:
        return None
    comic = [r[0] for r in conn.execute(
        "SELECT id FROM gcd_story WHERE issue_id=? AND type_id=? ORDER BY sequence_number",
        (iid, COMIC_STORY_TYPE_ID))]
    cover = [r[0] for r in conn.execute(
        "SELECT id FROM gcd_story WHERE issue_id=? AND type_id=? ORDER BY sequence_number",
        (iid, COVER_STORY_TYPE_ID))]
    return {
        "writer": _names(conn, comic, WRITER_TYPES),
        "artist": _names(conn, comic, ARTIST_TYPES),
        "cover_artist": _names(conn, cover, ARTIST_TYPES),
    }


def decide(existing, gcd_list):
    """Return (action, new_value) or (None, None) for no change.
    action in {FILL, UNION, CONFLICT}. Never loses an existing name."""
    if not gcd_list:
        return None, None                       # GCD silent -> leave alone
    ex_list = split_names(existing)
    ex_set = {nk(x) for x in ex_list}
    gcd_set = {nk(x) for x in gcd_list}
    if not ex_set:
        return "FILL", " & ".join(gcd_list)
    if gcd_set <= ex_set:
        return None, None                       # existing has everything GCD has
    if ex_set & gcd_set:                        # overlap: add GCD's extras, keep order
        add = [g for g in gcd_list if nk(g) not in ex_set]
        return "UNION", " & ".join(ex_list + add)
    return "CONFLICT", " & ".join(gcd_list)     # zero overlap -> trust GCD, but flagged


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--no-conflicts", action="store_true",
                    help="log zero-overlap cases but don't overwrite them")
    ap.add_argument("--src", default=None,
                    help="baseline xlsx (path or basename in attached_assets); default = newest")
    ap.add_argument("--csv", default=os.path.join(ROOT, "credits_gcd_changes.csv"))
    args = ap.parse_args()

    src = resolve_src(args.src)
    print(f"Inventory: {os.path.basename(src)}")
    conn = sqlite3.connect(DB)

    import openpyxl
    wb = openpyxl.load_workbook(src)
    ws = next(w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory"))
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]

    def cidx(name):
        if name not in H:
            sys.exit(f"column '{name}' not found in sheet")
        return H.index(name) + 1

    cT, cI, cY, cP = cidx(H_TITLE), cidx(H_ISSUE), cidx(H_YEAR), cidx(H_PUB)
    role_key = {"Writer(s)": "writer", "Artist(s)": "artist", "Cover Artist": "cover_artist"}
    role_cols = {col: cidx(col) for col in ROLES}

    series_cache = {}

    def resolve_series(title, year, pub):
        key = (title, pub, str(year))
        if key not in series_cache:
            series_cache[key] = find_series(conn, title, year, pub)
        return series_cache[key]

    counts = {col: {"FILL": 0, "UNION": 0, "CONFLICT": 0} for col in ROLES}
    rows_touched = no_series = no_issue = 0
    changes = []

    last = ws.max_row if not args.limit else min(ws.max_row, 1 + args.limit)
    for r in range(2, last + 1):
        title = str(ws.cell(r, cT).value or "").strip()
        if not title:
            continue
        issue = ws.cell(r, cI).value
        year = ws.cell(r, cY).value
        pub = str(ws.cell(r, cP).value or "").strip()

        series = resolve_series(title, year, pub)
        if not series:
            no_series += 1
            continue
        cs = credit_sets(conn, series["id"], issue)
        if cs is None:
            no_issue += 1
            continue

        row_changed = False
        for col in ROLES:
            action, newv = decide(ws.cell(r, role_cols[col]).value, cs[role_key[col]])
            if not action:
                continue
            if action == "CONFLICT" and args.no_conflicts:
                changes.append((title, norm_issue(issue), str(year), pub, series["name"],
                                col, "CONFLICT-SKIPPED", str(ws.cell(r, role_cols[col]).value or ""), newv))
                continue
            old = str(ws.cell(r, role_cols[col]).value or "")
            ws.cell(r, role_cols[col]).value = newv
            counts[col][action] += 1
            changes.append((title, norm_issue(issue), str(year), pub, series["name"],
                            col, action, old, newv))
            row_changed = True
        if row_changed:
            rows_touched += 1

    with open(args.csv, "w", newline="") as f:
        wr = csv.writer(f)
        wr.writerow(["Title", "Issue", "Year", "Publisher", "GCD_Series", "Field", "Action", "Old", "New"])
        wr.writerows(changes)

    print(f"\n{'='*66}")
    print("  GCD CREDITS — full-set fill + safe auto-correct")
    print(f"{'='*66}")
    print(f"  {'Field':<14} {'FILL':>6} {'UNION':>7} {'CONFLICT':>9}")
    for col in ROLES:
        c = counts[col]
        print(f"  {col:<14} {c['FILL']:>6} {c['UNION']:>7} {c['CONFLICT']:>9}")
    tot_conf = sum(counts[c]["CONFLICT"] for c in ROLES)
    print(f"  {'-'*44}")
    print(f"  Rows touched:            {rows_touched:,}")
    print(f"  No GCD series match:     {no_series:,}")
    print(f"  Series ok, issue absent: {no_issue:,}")
    print(f"  CONFLICT overwrites:     {tot_conf:,}  (Action=CONFLICT in the CSV — review these)")
    print(f"  Change log:              {os.path.relpath(args.csv, ROOT)} ({len(changes)} rows)")

    if args.dry_run:
        print("\n  DRY RUN — no xlsx written. Re-run without --dry-run to apply.")
        return
    if not any(counts[c][a] for c in ROLES for a in counts[c]):
        print("\n  Nothing to change — no xlsx written.")
        return
    out = os.path.join(ASSETS, f"comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    print(f"\n  WROTE: {os.path.basename(out)}")
    print("  Next: python3 brb.py --commit \"GCD credits fill+correct\" --yes")


if __name__ == "__main__":
    main()
