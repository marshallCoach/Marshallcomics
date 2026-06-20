#!/usr/bin/env python3
"""
BRB Overnight Writer-Fill Script
Continues Phase 1 writer-fill task autonomously via Claude Code / Anthropic API.
Built with the same safety guardrails used in the manual session.
"""

import pandas as pd
import json
import os
import time
import re
from datetime import datetime
from anthropic import Anthropic

# ── CONFIG ────────────────────────────────────────────────────────────────────
INVENTORY_PATH = "comics_inventory_1906_0615.xlsx"
SHEET_NAME = "✅ Clean Inventory 1906_0615"
QUEUE_PATH = "final_run_queue.pkl"  # pre-built list of Title+Volume runs, value-ranked
LOG_PATH = "issues.json"
REVIEW_PATH = "needs_review.json"
CHECKPOINT_EVERY = 25  # save xlsx checkpoint every N titles processed
SKIP_TITLES = ["The Flash"]  # known structural issues, handled separately
MAX_YEAR_SPAN = 15  # if existing same-title data has a year gap > this, treat as different run

client = Anthropic()  # picks up ANTHROPIC_API_KEY from env

# ── LOGGING ───────────────────────────────────────────────────────────────────
def load_json(path):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return []

def save_json(path, data):
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

def log_issue(category, title, detail):
    log = load_json(LOG_PATH)
    log.append({
        'timestamp': datetime.now().isoformat(),
        'category': category,
        'title': title,
        'detail': detail
    })
    save_json(LOG_PATH, log)

def log_needs_review(title, volume, reason, raw_search_result=None):
    review = load_json(REVIEW_PATH)
    review.append({
        'timestamp': datetime.now().isoformat(),
        'title': title,
        'volume': volume,
        'reason': reason,
        'search_result_snippet': (raw_search_result or '')[:500]
    })
    save_json(REVIEW_PATH, review)

# ── BLANK CHECK ───────────────────────────────────────────────────────────────
def is_blank(val):
    return pd.isna(val) or str(val).strip() == '' or str(val).strip().lower() == 'nan'

# ── CLAUDE SEARCH+VERIFY CALL ────────────────────────────────────────────────
def research_creative_team(title, volume, issue_min, issue_max, year_hint):
    """
    Asks Claude (with web search) to research the writer(s) for this run.
    Returns a structured result: either a single confident writer name,
    or a breakdown of multiple writers across issue ranges (handoff case),
    or 'UNCERTAIN' if the search doesn't yield confident results.
    """
    prompt = f"""Research the comic book series "{title}" (Volume {volume}, approx. year {year_hint}),
specifically issues #{issue_min} through #{issue_max}.

I need to know who the WRITER(S) were for this issue range. Many comics have a single
stable writer for a whole run, but some have writer handoffs mid-run (e.g. one writer
for issues 1-12, a different writer takes over after).

Use web search to verify. Then respond ONLY in this exact JSON format, nothing else:

{{
  "confidence": "high" | "low",
  "single_writer": "Name" or null,
  "handoffs": [{{"issue_start": N, "issue_end": N, "writer": "Name"}}] or null,
  "notes": "any caveats, e.g. if this looks like an anthology book or co-writers"
}}

If you cannot find confident information, set confidence to "low" and explain why in notes.
If the writer is stable across the whole range, use single_writer and leave handoffs null.
If there's a handoff, use handoffs and leave single_writer null.
"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        tools=[{"type": "web_search_20250305", "name": "web_search"}],
        messages=[{"role": "user", "content": prompt}]
    )

    # Extract text from response (last text block, after any tool use)
    text_parts = [b.text for b in response.content if b.type == "text"]
    full_text = "\n".join(text_parts)

    # Try to parse JSON out of the response
    json_match = re.search(r'\{[\s\S]*\}', full_text)
    if not json_match:
        return {"confidence": "low", "single_writer": None, "handoffs": None,
                "notes": "Could not parse response", "raw": full_text}
    try:
        result = json.loads(json_match.group())
        result['raw'] = full_text
        return result
    except json.JSONDecodeError:
        return {"confidence": "low", "single_writer": None, "handoffs": None,
                "notes": "JSON parse error", "raw": full_text}

# ── COLLISION CHECK (same guardrail as manual session) ───────────────────────
def check_year_collision(df, title, volume):
    """
    Checks if this Title+Volume already has Writer/Artist data filled
    under a DIFFERENT year range than the blank rows we're about to fill.
    If year gap > MAX_YEAR_SPAN, this signals a hidden multi-run collision
    (like the Young Justice Bendis/David case) — skip and flag instead of guessing.
    """
    title_rows = df[(df['Title'] == title) & (df['Volume'] == volume)]
    filled = title_rows[~title_rows['Writer(s)'].apply(is_blank)]
    blank = title_rows[title_rows['Writer(s)'].apply(is_blank)]

    if len(filled) == 0 or len(blank) == 0:
        return False, None  # no collision possible

    filled_years = pd.to_numeric(filled['Year'], errors='coerce').dropna()
    blank_years = pd.to_numeric(blank['Year'], errors='coerce').dropna()

    if len(filled_years) == 0 or len(blank_years) == 0:
        return False, None

    gap = abs(filled_years.mean() - blank_years.mean())
    if gap > MAX_YEAR_SPAN:
        return True, f"Existing filled rows avg year {filled_years.mean():.0f}, blank rows avg year {blank_years.mean():.0f} — gap {gap:.0f}yrs"
    return False, None

# ── MAIN LOOP ─────────────────────────────────────────────────────────────────
def main():
    print(f"[{datetime.now()}] Starting overnight run...")

    df = pd.read_excel(INVENTORY_PATH, sheet_name=SHEET_NAME)
    queue = pd.read_pickle(QUEUE_PATH)
    queue = queue[~queue['Title'].isin(SKIP_TITLES)].sort_values('val', ascending=False)

    processed_titles = set(e['title'] for e in load_json(LOG_PATH)
                            if e['category'] in ('FILLED', 'FILLED_PARTIAL', 'SKIPPED_LOW_CONFIDENCE', 'SKIPPED_COLLISION'))

    titles_processed_this_run = 0

    for _, run in queue.iterrows():
        title, volume = run['Title'], run['Volume']
        key = f"{title}|{volume}"
        if key in processed_titles:
            continue

        mask = (df['Title'] == title) & (df['Volume'] == volume) & (df['Writer(s)'].apply(is_blank))
        if mask.sum() == 0:
            continue

        issue_min = df.loc[mask, 'Issue #'].min()
        issue_max = df.loc[mask, 'Issue #'].max()
        year_hint = df.loc[mask, 'Year'].mode().iloc[0] if len(df.loc[mask, 'Year'].mode()) else '?'

        # Guardrail 1: year collision check
        has_collision, collision_detail = check_year_collision(df, title, volume)
        if has_collision:
            log_issue('SKIPPED_COLLISION', title, collision_detail)
            log_needs_review(title, volume, f"Year collision detected: {collision_detail}")
            print(f"[SKIP-COLLISION] {title} Vol {volume}")
            continue

        print(f"[RESEARCHING] {title} Vol {volume} (#{issue_min}-{issue_max}, ~{year_hint})")

        try:
            result = research_creative_team(title, volume, issue_min, issue_max, year_hint)
        except Exception as e:
            log_issue('ERROR', title, f"API error: {str(e)}")
            print(f"[ERROR] {title}: {e}")
            time.sleep(5)
            continue

        if result.get('confidence') != 'high':
            log_issue('SKIPPED_LOW_CONFIDENCE', title, result.get('notes', 'No notes'))
            log_needs_review(title, volume, result.get('notes', ''), result.get('raw'))
            print(f"[SKIP-LOW-CONF] {title} Vol {volume}: {result.get('notes','')[:100]}")
            continue

        # Guardrail 2: apply single writer OR handoff split, never guess across ambiguity
        if result.get('single_writer'):
            df.loc[mask, 'Writer(s)'] = result['single_writer']
            n = mask.sum()
            log_issue('FILLED', title, f"{n} rows (Vol {volume}). Writer: {result['single_writer']}. {result.get('notes','')}")
            print(f"[FILLED] {title} Vol {volume}: {result['single_writer']} ({n} rows)")

        elif result.get('handoffs'):
            total_filled = 0
            for h in result['handoffs']:
                hmask = mask & (df['Issue #'] >= h['issue_start']) & (df['Issue #'] <= h['issue_end'])
                df.loc[hmask, 'Writer(s)'] = h['writer']
                total_filled += hmask.sum()
            log_issue('FILLED', title,
                      f"{total_filled} rows (Vol {volume}), multi-writer handoff: " +
                      "; ".join(f"#{h['issue_start']}-{h['issue_end']}: {h['writer']}" for h in result['handoffs']))
            print(f"[FILLED-HANDOFF] {title} Vol {volume}: {len(result['handoffs'])} writers, {total_filled} rows")

        else:
            log_issue('SKIPPED_LOW_CONFIDENCE', title, "High confidence but no writer data returned — unexpected response shape")
            log_needs_review(title, volume, "Malformed high-confidence response", result.get('raw'))
            continue

        titles_processed_this_run += 1

        # Checkpoint every N titles
        if titles_processed_this_run % CHECKPOINT_EVERY == 0:
            ts = datetime.now().strftime('%d%m_%H%M')
            checkpoint_path = f"comics_inventory_{ts}.xlsx"
            df.to_excel(checkpoint_path, sheet_name=f"✅ Clean Inventory {ts}", index=False)
            print(f"[CHECKPOINT] Saved {checkpoint_path} after {titles_processed_this_run} titles")

        time.sleep(1)  # gentle rate limiting

    # Final save
    ts = datetime.now().strftime('%d%m_%H%M')
    final_path = f"comics_inventory_FINAL_{ts}.xlsx"
    df.to_excel(final_path, sheet_name=f"✅ Clean Inventory {ts}", index=False)
    print(f"[{datetime.now()}] DONE. Processed {titles_processed_this_run} titles this run.")
    print(f"Final file: {final_path}")
    print(f"Review needed list: {REVIEW_PATH}")

if __name__ == "__main__":
    main()
