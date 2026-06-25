#!/usr/bin/env python3
"""
BRB Overnight Writer+Artist Fill Script — v2
Uses DC Fandom Wiki URL construction for DC titles (no search needed, no guessing).
Falls back to Claude web search for Marvel and other publishers.

DC URL pattern: https://dc.fandom.com/wiki/{Title_Vol_N}_{Issue}
Uses Claude API with web_search tool for all fetching.
"""

import pandas as pd
import json, os, re, time
from datetime import datetime
from anthropic import Anthropic

# ── CONFIG ────────────────────────────────────────────────────────────────────
INVENTORY_PATH    = "comics_inventory_2006_2015.xlsx"
SHEET_NAME        = "✅ Clean Inventory 2006_2015"
LOG_PATH          = "issues.json"
REVIEW_PATH       = "needs_review.json"
CHECKPOINT_EVERY  = 25
SKIP_TITLES       = ["The Flash"]           # flagged for separate volume audit
DC_PUBLISHERS     = ["DC", "DC Comics", "Vertigo", "DC/Vertigo", "DC Rebirth"]
MAX_YEAR_GAP      = 15
MIN_DELAY         = 1.5                     # seconds between API calls

client = Anthropic()

# ── LOGGING ───────────────────────────────────────────────────────────────────
def load_json(p):
    return json.load(open(p)) if os.path.exists(p) else []

def save_json(p, d):
    json.dump(d, open(p,'w'), indent=2)

def log_issue(cat, title, detail):
    log = load_json(LOG_PATH)
    log.append({"ts": datetime.now().isoformat(), "category": cat, "title": title, "detail": detail})
    save_json(LOG_PATH, log)

def log_review(title, vol, reason, snippet=""):
    rv = load_json(REVIEW_PATH)
    rv.append({"ts": datetime.now().isoformat(), "title": title, "volume": vol,
               "reason": reason, "snippet": snippet[:400]})
    save_json(REVIEW_PATH, rv)

def is_blank(v):
    return pd.isna(v) or str(v).strip() in ('', 'nan', 'None')

# ── DC FANDOM URL BUILDER ─────────────────────────────────────────────────────
def dc_fandom_url(title, volume, issue):
    """Construct dc.fandom.com URL directly from inventory fields."""
    t = str(title).strip()
    t = re.sub(r'\s+', '_', t)
    t = re.sub(r"['''\"()]", '', t)   # remove quotes, parens
    v = str(int(float(volume))) if volume else '1'
    i_raw = str(issue).strip()
    try:
        i = str(int(float(i_raw)))
    except:
        i = re.sub(r'[^0-9.]', '', i_raw) or '1'
    return f"https://dc.fandom.com/wiki/{t}_Vol_{v}_{i}"

# ── EXTRACT FROM DC FANDOM PAGE (via Claude web fetch) ───────────────────────
def fetch_dc_fandom_via_claude(title, volume, issue):
    """
    Ask Claude to fetch and parse a DC Fandom wiki page.
    Returns dict: {found, writer, penciler, cover_artist, year, url}
    """
    url = dc_fandom_url(title, volume, issue)
    prompt = f"""Fetch this DC Fandom wiki page and extract the comic book credits:
{url}

From the page, find and return ONLY this JSON (nothing else):
{{
  "found": true or false,
  "writer": "Name or null",
  "penciler": "Name or null",
  "cover_artist": "Name or null",
  "year": "YYYY or null",
  "issue_confirmed": "issue number as shown on page or null"
}}

Look for the Writers, Pencilers, and Cover Artists sections on the page.
If the page doesn't exist or doesn't have this information, set found to false."""

    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=500,
        tools=[{"type": "web_search_20250305", "name": "web_search"}],
        messages=[{"role": "user", "content": prompt}]
    )
    text = "\n".join(b.text for b in resp.content if b.type == "text")
    m = re.search(r'\{[\s\S]*?\}', text)
    if not m:
        return {"found": False, "url": url, "raw": text}
    try:
        r = json.loads(m.group())
        r["url"] = url
        return r
    except:
        return {"found": False, "url": url, "raw": text}

# ── MARVEL/OTHER: SEARCH VIA CLAUDE ──────────────────────────────────────────
def research_via_search(title, volume, issue_min, issue_max, year_hint, publisher):
    """Fallback for non-DC: Claude web search for creator credits."""
    prompt = f"""Research the writer(s) for {publisher} comic "{title}" Volume {volume},
issues #{issue_min}–#{issue_max} (approx year {year_hint}).

Return ONLY this JSON:
{{
  "confidence": "high" or "low",
  "single_writer": "Name or null",
  "handoffs": [{{"issue_start": N, "issue_end": N, "writer": "Name"}}] or null,
  "notes": "brief explanation"
}}"""

    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=600,
        tools=[{"type": "web_search_20250305", "name": "web_search"}],
        messages=[{"role": "user", "content": prompt}]
    )
    text = "\n".join(b.text for b in resp.content if b.type == "text")
    m = re.search(r'\{[\s\S]*?\}', text)
    if not m:
        return {"confidence": "low", "notes": "No JSON in response", "raw": text}
    try:
        r = json.loads(m.group()); r["raw"] = text; return r
    except:
        return {"confidence": "low", "notes": "JSON parse error", "raw": text}

# ── YEAR-GAP COLLISION CHECK ─────────────────────────────────────────────────
def has_year_collision(df, title, volume):
    rows = df[(df['Title']==title) & (df['Volume']==volume)]
    filled = rows[~rows['Writer(s)'].apply(is_blank)]
    blank  = rows[rows['Writer(s)'].apply(is_blank)]
    if len(filled)==0 or len(blank)==0: return False, None
    fy = pd.to_numeric(filled['Year'], errors='coerce').dropna()
    by = pd.to_numeric(blank['Year'],  errors='coerce').dropna()
    if len(fy)==0 or len(by)==0: return False, None
    gap = abs(fy.mean() - by.mean())
    if gap > MAX_YEAR_GAP:
        return True, f"Filled rows avg year {fy.mean():.0f}, blank avg {by.mean():.0f} (gap {gap:.0f}y)"
    return False, None

# ── BUILD QUEUE FROM EXCEL (replaces pickle) ──────────────────────────────────
def build_queue(df):
    """
    Build a prioritised queue of (Title, Volume) runs that still have blank Writer(s).
    Sorted by number of blank rows descending (most impactful first).
    """
    blank_mask = df['Writer(s)'].apply(is_blank)
    blank_df   = df[blank_mask].copy()
    blank_df['Volume'] = pd.to_numeric(blank_df.get('Volume', 1), errors='coerce').fillna(1)

    counts = (blank_df
              .groupby(['Title', 'Volume'])
              .size()
              .reset_index(name='val')
              .sort_values('val', ascending=False))
    return counts

# ── MAIN ──────────────────────────────────────────────────────────────────────
def main():
    print(f"[{datetime.now()}] BRB Overnight Writer+Artist Fill v2 starting...")

    df = pd.read_excel(INVENTORY_PATH, sheet_name=SHEET_NAME)

    # Ensure Volume column exists
    if 'Volume' not in df.columns:
        df['Volume'] = 1
    df['Volume'] = pd.to_numeric(df['Volume'], errors='coerce').fillna(1)

    queue = build_queue(df)
    queue = queue[~queue['Title'].isin(SKIP_TITLES)]
    print(f"Queue built from Excel: {len(queue)} Title+Volume runs with blank writers.")

    done_keys = {f"{e['title']}|{e.get('detail','')[:30]}"
                 for e in load_json(LOG_PATH)
                 if e['category'] in ('FILLED','FILLED_PARTIAL','SKIPPED_LOW_CONFIDENCE','SKIPPED_COLLISION')}

    processed = 0

    for _, run in queue.iterrows():
        title, volume = run['Title'], run['Volume']
        key = f"{title}|{volume}"
        if key in done_keys:
            continue

        mask = (df['Title']==title) & (df['Volume']==volume) & df['Writer(s)'].apply(is_blank)
        if mask.sum() == 0:
            continue

        # Year-gap collision check
        collision, cdesc = has_year_collision(df, title, volume)
        if collision:
            log_issue('SKIPPED_COLLISION', title, cdesc)
            log_review(title, volume, f"Year gap collision: {cdesc}")
            print(f"[SKIP-COLLISION] {title} Vol {volume}")
            continue

        publisher = df.loc[mask, 'Publisher'].mode()
        publisher = publisher.iloc[0] if len(publisher) else 'Unknown'
        is_dc = any(p in str(publisher) for p in DC_PUBLISHERS)

        year_hint = df.loc[mask, 'Year'].mode()
        year_hint = str(year_hint.iloc[0])[:4] if len(year_hint) else '?'
        issues = df.loc[mask, 'Issue #'].dropna().sort_values()
        issue_min = issues.min() if len(issues) else 1
        issue_max = issues.max() if len(issues) else 1
        n_rows = mask.sum()

        print(f"[{'DC-FANDOM' if is_dc else 'SEARCH'}] {title} Vol {volume} "
              f"#{issue_min}-{issue_max} (~{year_hint}) [{n_rows} rows]")

        try:
            if is_dc:
                filled_count = 0
                writers_found = {}
                pencilers_found = {}

                for issue_num in issues.unique():
                    result = fetch_dc_fandom_via_claude(title, volume, issue_num)
                    time.sleep(MIN_DELAY)
                    if result.get('found') and result.get('writer'):
                        writers_found[issue_num] = result['writer']
                        if result.get('penciler'):
                            pencilers_found[issue_num] = result['penciler']
                    else:
                        print(f"  [NOT FOUND] {title} Vol {volume} #{issue_num}")

                for issue_num, writer in writers_found.items():
                    row_mask = mask & (df['Issue #'] == issue_num)
                    df.loc[row_mask, 'Writer(s)'] = writer
                    filled_count += row_mask.sum()

                for issue_num, penciler in pencilers_found.items():
                    row_mask = mask & (df['Issue #'] == issue_num)
                    df.loc[row_mask, 'Artist(s)'] = penciler

                not_found = [i for i in issues.unique() if i not in writers_found]
                if not_found:
                    log_review(title, volume,
                               f"{len(not_found)} issues not found on DC Fandom: {sorted(not_found)[:10]}")

                if filled_count > 0:
                    log_issue('FILLED', title,
                              f"{filled_count}/{n_rows} rows filled via DC Fandom URL construction. "
                              f"Artist also filled where found. {len(not_found)} issues not found.")
                else:
                    log_issue('SKIPPED_LOW_CONFIDENCE', title,
                              "DC Fandom URL construction yielded no results — pages may not exist or slug mismatch.")

            else:
                result = research_via_search(title, volume, issue_min, issue_max, year_hint, publisher)
                time.sleep(MIN_DELAY)

                if result.get('confidence') != 'high':
                    log_issue('SKIPPED_LOW_CONFIDENCE', title, result.get('notes',''))
                    log_review(title, volume, result.get('notes',''), result.get('raw',''))
                    print(f"  [LOW CONF] {result.get('notes','')[:80]}")
                    continue

                if result.get('single_writer'):
                    df.loc[mask, 'Writer(s)'] = result['single_writer']
                    log_issue('FILLED', title,
                              f"{n_rows} rows. Writer: {result['single_writer']}. {result.get('notes','')}")
                elif result.get('handoffs'):
                    total = 0
                    for h in result['handoffs']:
                        hm = mask & (df['Issue #']>=h['issue_start']) & (df['Issue #']<=h['issue_end'])
                        df.loc[hm, 'Writer(s)'] = h['writer']
                        total += hm.sum()
                    log_issue('FILLED', title,
                              f"{total} rows, {len(result['handoffs'])} writer handoffs: " +
                              "; ".join(f"#{h['issue_start']}-{h['issue_end']}: {h['writer']}"
                                       for h in result['handoffs']))

        except Exception as e:
            log_issue('ERROR', title, str(e))
            print(f"  [ERROR] {e}")
            time.sleep(5)
            continue

        processed += 1

        if processed % CHECKPOINT_EVERY == 0:
            ts = datetime.now().strftime('%d%m_%H%M')
            out = f"comics_inventory_{ts}.xlsx"
            df.to_excel(out, sheet_name=f"✅ Clean Inventory {ts}", index=False)
            print(f"[CHECKPOINT] {out} after {processed} titles")

        time.sleep(MIN_DELAY)

    ts = datetime.now().strftime('%d%m_%H%M')
    final = f"comics_inventory_FINAL_{ts}.xlsx"
    df.to_excel(final, sheet_name=f"✅ Clean Inventory {ts}", index=False)
    print(f"\n[DONE] {processed} titles processed. Output: {final}")
    print(f"Review list: {REVIEW_PATH}")

if __name__ == "__main__":
    main()
