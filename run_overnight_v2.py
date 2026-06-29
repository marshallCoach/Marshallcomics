#!/usr/bin/env python3
"""
BRB Overnight Writer+Artist Fill — Comic Vine edition (no Anthropic API)

Uses Comic Vine's free /issues/ endpoint to look up writer and artist credits.
Rate limit: 200 requests/hour → 18s delay keeps it safely within limits.
Set COMIC_VINE_API_KEY in your environment before running.

Usage:
    export COMIC_VINE_API_KEY=your_key_here
    nohup python3 run_overnight_v2.py > overnight_log.txt 2>&1 &
    tail -f overnight_log.txt
"""

import pandas as pd
import requests
import json, os, re, time
from datetime import datetime

# ── CONFIG ────────────────────────────────────────────────────────────────────
INVENTORY_PATH   = "comics_inventory_2006_2015.xlsx"
SHEET_NAME       = "✅ Clean Inventory 2006_2015"
LOG_PATH         = "issues.json"
REVIEW_PATH      = "needs_review.json"
CHECKPOINT_EVERY = 25
SKIP_TITLES      = ["The Flash"]   # flagged for separate volume audit
MAX_YEAR_GAP     = 15
DELAY_SECONDS    = 18              # Comic Vine free tier: 200 req/hr = 1 per 18s

API_KEY = os.environ.get("COMIC_VINE_API_KEY", "")
CV_BASE = "https://comicvine.gamespot.com/api"
HEADERS = {"User-Agent": "BRB-Marshall-Comics/1.0"}

# ── LOGGING ───────────────────────────────────────────────────────────────────
def load_json(p):
    return json.load(open(p)) if os.path.exists(p) else []

def save_json(p, d):
    json.dump(d, open(p, "w"), indent=2)

def log_issue(cat, title, detail):
    log = load_json(LOG_PATH)
    log.append({"ts": datetime.now().isoformat(), "category": cat, "title": title, "detail": detail})
    save_json(LOG_PATH, log)

def log_review(title, vol, reason):
    rv = load_json(REVIEW_PATH)
    rv.append({"ts": datetime.now().isoformat(), "title": title, "volume": vol, "reason": reason})
    save_json(REVIEW_PATH, rv)

def is_blank(v):
    return pd.isna(v) or str(v).strip() in ("", "nan", "None")

# ── YEAR-GAP COLLISION CHECK ──────────────────────────────────────────────────
def has_year_collision(df, title, volume):
    rows   = df[(df["Title"] == title) & (df["Volume"] == volume)]
    filled = rows[~rows["Writer(s)"].apply(is_blank)]
    blank  = rows[rows["Writer(s)"].apply(is_blank)]
    if len(filled) == 0 or len(blank) == 0:
        return False, None
    fy = pd.to_numeric(filled["Year"], errors="coerce").dropna()
    by = pd.to_numeric(blank["Year"],  errors="coerce").dropna()
    if len(fy) == 0 or len(by) == 0:
        return False, None
    gap = abs(fy.mean() - by.mean())
    if gap > MAX_YEAR_GAP:
        return True, f"Filled avg year {fy.mean():.0f}, blank avg {by.mean():.0f} (gap {gap:.0f}y)"
    return False, None

# ── COMIC VINE LOOKUP ─────────────────────────────────────────────────────────
def cv_search_issue(title, issue_num, year_hint):
    """
    Search Comic Vine for a single issue.
    Returns dict with writer, artist (penciler), cover_artist — or None if not found.
    """
    if not API_KEY:
        raise RuntimeError("COMIC_VINE_API_KEY not set in environment")

    # Normalise issue number
    try:
        issue_str = str(int(float(str(issue_num))))
    except (ValueError, TypeError):
        issue_str = re.sub(r"[^0-9]", "", str(issue_num)) or "1"

    params = {
        "api_key":    API_KEY,
        "format":     "json",
        "filter":     f"name:{title}",
        "field_list": "name,issue_number,volume,cover_date,person_credits",
        "limit":      20,
    }

    try:
        resp = requests.get(f"{CV_BASE}/issues/", params=params, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return None, f"HTTP error: {e}"

    if data.get("status_code") != 1:
        return None, f"CV error: {data.get('error','unknown')}"

    results = data.get("results", [])
    if not results:
        return None, "No results"

    # Pick the best match: prefer exact issue number + year alignment
    best = None
    for r in results:
        vol_name = (r.get("volume") or {}).get("name", "").lower()
        r_issue  = str(r.get("issue_number", "")).strip()
        if r_issue != issue_str:
            continue
        # Prefer result whose volume name matches title
        if title.lower() in vol_name:
            best = r
            break
        if best is None:
            best = r

    if best is None:
        # fallback: first result with matching issue number
        for r in results:
            if str(r.get("issue_number", "")).strip() == issue_str:
                best = r
                break

    if best is None:
        return None, f"No issue #{issue_str} in results"

    # Extract person credits by role
    credits = best.get("person_credits") or []
    writer, artist, cover_artist = None, None, None
    for p in credits:
        roles = (p.get("role") or "").lower()
        name  = (p.get("name") or "").strip()
        if not name:
            continue
        if "writer" in roles and not writer:
            writer = name
        if ("penciler" in roles or "penciller" in roles) and not artist:
            artist = name
        if "cover" in roles and not cover_artist:
            cover_artist = name

    return {"writer": writer, "artist": artist, "cover_artist": cover_artist}, None

# ── BUILD QUEUE FROM EXCEL ────────────────────────────────────────────────────
def build_queue(df):
    blank_mask = df["Writer(s)"].apply(is_blank)
    blank_df   = df[blank_mask].copy()
    blank_df["Volume"] = pd.to_numeric(blank_df.get("Volume", 1), errors="coerce").fillna(1)
    counts = (
        blank_df.groupby(["Title", "Volume"])
        .size()
        .reset_index(name="val")
        .sort_values("val", ascending=False)
    )
    return counts

# ── MAIN ──────────────────────────────────────────────────────────────────────
def main():
    if not API_KEY:
        print("ERROR: Set COMIC_VINE_API_KEY environment variable before running.")
        print("  export COMIC_VINE_API_KEY=your_key_here")
        return

    print(f"[{datetime.now()}] BRB Overnight Writer+Artist Fill (Comic Vine) starting...")

    df = pd.read_excel(INVENTORY_PATH, sheet_name=SHEET_NAME)

    if "Volume" not in df.columns:
        df["Volume"] = 1
    df["Volume"] = pd.to_numeric(df["Volume"], errors="coerce").fillna(1)

    queue = build_queue(df)
    queue = queue[~queue["Title"].isin(SKIP_TITLES)]
    print(f"Queue: {len(queue)} Title+Volume runs with blank writers.")
    print(f"Delay: {DELAY_SECONDS}s between requests (~{3600//DELAY_SECONDS} req/hr, within free tier)")

    done_keys = {
        f"{e['title']}|{e.get('detail','')[:30]}"
        for e in load_json(LOG_PATH)
        if e["category"] in ("FILLED", "FILLED_PARTIAL", "SKIPPED_LOW_CONFIDENCE", "SKIPPED_COLLISION")
    }

    processed = 0
    api_calls  = 0

    for _, run in queue.iterrows():
        title, volume = run["Title"], run["Volume"]
        key = f"{title}|{volume}"
        if key in done_keys:
            continue

        mask = (
            (df["Title"] == title) &
            (df["Volume"] == volume) &
            df["Writer(s)"].apply(is_blank)
        )
        if mask.sum() == 0:
            continue

        # Collision check
        collision, cdesc = has_year_collision(df, title, volume)
        if collision:
            log_issue("SKIPPED_COLLISION", title, cdesc)
            log_review(title, volume, f"Year gap: {cdesc}")
            print(f"[SKIP-COLLISION] {title} Vol {volume}")
            continue

        year_hint = df.loc[mask, "Year"].mode()
        year_hint = str(year_hint.iloc[0])[:4] if len(year_hint) else "?"
        issues    = df.loc[mask, "Issue #"].dropna().sort_values().unique()
        n_rows    = int(mask.sum())

        print(f"[CV] {title} Vol {volume} — {len(issues)} issues (~{year_hint}) [{n_rows} blank rows]")

        writers_found      = {}
        artists_found      = {}
        cover_artists_found = {}
        not_found          = []

        for issue_num in issues:
            result, err = cv_search_issue(title, issue_num, year_hint)
            api_calls += 1

            if result:
                if result["writer"]:
                    writers_found[issue_num] = result["writer"]
                if result["artist"]:
                    artists_found[issue_num] = result["artist"]
                if result["cover_artist"]:
                    cover_artists_found[issue_num] = result["cover_artist"]
                if not result["writer"]:
                    not_found.append(issue_num)
                    print(f"  [NO WRITER] #{issue_num} — credits found but no writer role")
            else:
                not_found.append(issue_num)
                print(f"  [NOT FOUND] #{issue_num} — {err}")

            time.sleep(DELAY_SECONDS)

        # Apply fills
        filled_count = 0
        for issue_num, writer in writers_found.items():
            row_mask = mask & (df["Issue #"] == issue_num)
            df.loc[row_mask, "Writer(s)"] = writer
            filled_count += int(row_mask.sum())

        for issue_num, artist in artists_found.items():
            row_mask = mask & (df["Issue #"] == issue_num)
            if "Artist(s)" in df.columns:
                df.loc[row_mask & df["Artist(s)"].apply(is_blank), "Artist(s)"] = artist

        for issue_num, ca in cover_artists_found.items():
            row_mask = mask & (df["Issue #"] == issue_num)
            if "Cover_Artist" in df.columns:
                df.loc[row_mask & df["Cover_Artist"].apply(is_blank), "Cover_Artist"] = ca

        if not_found:
            log_review(title, volume, f"{len(not_found)} issues not found on CV: {sorted(not_found)[:10]}")

        if filled_count > 0:
            log_issue("FILLED", title,
                f"{filled_count}/{n_rows} rows filled via Comic Vine. "
                f"Artists: {len(artists_found)}. Not found: {len(not_found)}.")
            print(f"  → Filled {filled_count} rows | artists: {len(artists_found)} | missed: {len(not_found)}")
        else:
            log_issue("SKIPPED_LOW_CONFIDENCE", title, f"No writer credits found on Comic Vine for any issue.")
            print(f"  → No writers found — logged to needs_review.json")

        processed += 1

        if processed % CHECKPOINT_EVERY == 0:
            ts  = datetime.now().strftime("%d%m_%H%M")
            out = f"comics_inventory_{ts}.xlsx"
            df.to_excel(out, sheet_name=f"✅ Clean Inventory {ts}", index=False)
            print(f"[CHECKPOINT] Saved {out} after {processed} titles ({api_calls} API calls)")

    ts    = datetime.now().strftime("%d%m_%H%M")
    final = f"comics_inventory_FINAL_{ts}.xlsx"
    df.to_excel(final, sheet_name=f"✅ Clean Inventory {ts}", index=False)
    print(f"\n[DONE] {processed} titles | {api_calls} Comic Vine calls | Output: {final}")
    print(f"Review needed: {REVIEW_PATH}")

if __name__ == "__main__":
    main()
