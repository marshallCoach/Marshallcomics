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
_volume_cache = {}   # title → volume_id (int) or None

def cv_find_volume_id(title, year_hint):
    """
    Step 1: query /volumes/ to find the best-matching volume ID for a series title.
    Returns (volume_id, None) or (None, error_string).
    Costs 1 API call; result cached in _volume_cache.
    """
    if title in _volume_cache:
        return _volume_cache[title], None

    params = {
        "api_key":    API_KEY,
        "format":     "json",
        "filter":     f"name:{title}",
        "field_list": "id,name,start_year,count_of_issues",
        "limit":      10,
    }
    try:
        resp = requests.get(f"{CV_BASE}/volumes/", params=params, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return None, f"HTTP error: {e}"

    if data.get("status_code") != 1:
        return None, f"CV error: {data.get('error','unknown')}"

    results = data.get("results", [])
    if not results:
        _volume_cache[title] = None
        return None, "No volumes found"

    # Best match: exact name first, then closest start_year to year_hint
    title_lower = title.lower()
    exact = [r for r in results if r.get("name", "").lower() == title_lower]
    pool  = exact if exact else results

    best = pool[0]
    if year_hint and year_hint != "?":
        try:
            yh = int(year_hint)
            def year_dist(r):
                sy = r.get("start_year")
                return abs(int(sy) - yh) if sy and str(sy).isdigit() else 9999
            best = min(pool, key=year_dist)
        except (ValueError, TypeError):
            pass

    vid = best.get("id")
    _volume_cache[title] = vid
    print(f"  [VOL] '{title}' → volume id {vid} ('{best.get('name')}' {best.get('start_year')})")
    return vid, None


def cv_fetch_volume_issues(volume_id):
    """
    Step 2: fetch ALL issues for a known volume_id from /issues/?filter=volume:{id}.
    Returns list of issue dicts (each has issue_number + person_credits), or (None, err).
    May need multiple pages if count > 100.
    """
    all_issues = []
    offset = 0
    limit  = 100
    while True:
        params = {
            "api_key":    API_KEY,
            "format":     "json",
            "filter":     f"volume:{volume_id}",
            "field_list": "issue_number,person_credits,cover_date",
            "limit":      limit,
            "offset":     offset,
        }
        try:
            resp = requests.get(f"{CV_BASE}/issues/", params=params, headers=HEADERS, timeout=30)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            return None, f"HTTP error: {e}"

        if data.get("status_code") != 1:
            return None, f"CV error: {data.get('error','unknown')}"

        batch = data.get("results", [])
        all_issues.extend(batch)
        total = data.get("number_of_total_results", 0)
        offset += limit
        if offset >= total or not batch:
            break
        time.sleep(DELAY_SECONDS)   # respect rate limit for pagination

    return all_issues, None


def extract_credits(issue):
    """Pull writer / artist / cover_artist from a CV issue dict."""
    credits = issue.get("person_credits") or []
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
    return writer, artist, cover_artist


def cv_get_all_credits_for_title(title, year_hint):
    """
    Two-step lookup: volume search → issue list.
    Returns (credits_by_issue_num, api_calls_used, error) where
    credits_by_issue_num = {"1": {"writer":..., "artist":..., "cover_artist":...}, ...}
    """
    # Step 1 — volume lookup (1 API call)
    volume_id, err = cv_find_volume_id(title, year_hint)
    if volume_id is None:
        return {}, 1, err or "Volume not found"
    time.sleep(DELAY_SECONDS)

    # Step 2 — fetch all issues (1+ API calls)
    issues, err = cv_fetch_volume_issues(volume_id)
    calls = 1 + (1 if issues is not None else 1)
    if issues is None:
        return {}, calls, err

    by_num = {}
    for iss in issues:
        num_raw = str(iss.get("issue_number", "")).strip()
        try:
            num_key = str(int(float(num_raw)))
        except (ValueError, TypeError):
            num_key = re.sub(r"[^0-9]", "", num_raw) or num_raw
        w, a, ca = extract_credits(iss)
        by_num[num_key] = {"writer": w, "artist": a, "cover_artist": ca}

    return by_num, calls, None

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

        # Two-step: volume lookup → bulk issue fetch (far fewer API calls)
        credits_by_num, calls_used, fetch_err = cv_get_all_credits_for_title(title, year_hint)
        api_calls += calls_used

        if fetch_err and not credits_by_num:
            print(f"  [ERROR] {fetch_err}")
            log_issue("SKIPPED_LOW_CONFIDENCE", title, f"CV lookup failed: {fetch_err}")
            log_review(title, volume, f"CV lookup failed: {fetch_err}")
            processed += 1
            continue

        writers_found       = {}
        artists_found       = {}
        cover_artists_found = {}
        not_found           = []

        for issue_num in issues:
            try:
                issue_key = str(int(float(str(issue_num))))
            except (ValueError, TypeError):
                issue_key = re.sub(r"[^0-9]", "", str(issue_num)) or str(issue_num)

            result = credits_by_num.get(issue_key)
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
                print(f"  [NOT FOUND] #{issue_num} — not in CV volume")

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
