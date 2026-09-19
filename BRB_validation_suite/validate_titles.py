#!/usr/bin/env python3
"""
BRB Title Validation Script — Layer 1
Validates 1,473 unique Title+Publisher combinations against:
  - DC: dc.fandom.com (URL construction)
  - Marvel: marvel.fandom.com (URL construction)  
  - Other: comicvine search via Claude web search

Outputs:
  - title_validation_results.json  (all results)
  - title_validation_PASS.csv      (confirmed valid)
  - title_validation_FAIL.csv      (not found / wrong)
  - title_validation_REVIEW.csv    (ambiguous / near-match)
"""

import pandas as pd, json, os, re, time
import numpy as np
from datetime import datetime
from anthropic import Anthropic

class SafeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (np.integer,)): return int(obj)
        if isinstance(obj, (np.floating,)): return float(obj)
        if isinstance(obj, (np.ndarray,)): return obj.tolist()
        if pd.isna(obj): return None
        return super().default(obj)

INVENTORY     = "comics_inventory_2506_1200.xlsx"
SHEET         = "✅ Clean Inventory 2506_1200"
RESULTS_PATH  = "title_validation_results.json"
CHECKPOINT    = 50   # save every N titles
DELAY         = 1.5  # seconds between API calls

client = Anthropic()

# ── URL BUILDERS ─────────────────────────────────────────────────────────────
def dc_series_url(title, volume):
    t = re.sub(r'\s+', '_', str(title).strip())
    t = re.sub(r"['''\"()]", '', t)
    v = str(int(float(volume))) if volume else '1'
    return f"https://dc.fandom.com/wiki/{t}_Vol_{v}"

def marvel_series_url(title, volume):
    t = re.sub(r'\s+', '_', str(title).strip())
    t = re.sub(r"['''\"()]", '', t)
    v = str(int(float(volume))) if volume else '1'
    return f"https://marvel.fandom.com/wiki/{t}_Vol_{v}"

def comicvine_search_url(title):
    q = re.sub(r'\s+', '+', str(title).strip().lower())
    return f"https://comicvine.gamespot.com/search/?q={q}&type=volume"

# ── VALIDATION VIA CLAUDE ────────────────────────────────────────────────────
DC_PUBS     = {'DC','DC Comics','DC/Vertigo','Vertigo','Wildstorm','DC Rebirth','DC All In'}
MARVEL_PUBS = {'Marvel','Marvel Comics'}

def validate_title(title, publisher, volume, year_hint):
    """
    Ask Claude to validate a comic title against its canonical source.
    Returns: {valid: bool, canonical_title: str, confidence: high/low, 
              url_checked: str, notes: str}
    """
    pub = str(publisher).strip()
    
    if pub in DC_PUBS:
        url = dc_series_url(title, volume)
        source = "dc.fandom.com"
    elif pub in MARVEL_PUBS:
        url = marvel_series_url(title, volume)
        source = "marvel.fandom.com"
    else:
        url = comicvine_search_url(title)
        source = "comicvine.gamespot.com"

    prompt = f"""Check if this comic book series exists with this exact title:

Title: "{title}"
Publisher: {publisher}
Volume: {volume}
Approx year: {year_hint}
Check URL: {url}

Fetch the URL and respond ONLY with this JSON:
{{
  "valid": true or false,
  "canonical_title": "The exact title as the source shows it, or null if not found",
  "title_matches": true or false,
  "confidence": "high" or "low",
  "url_checked": "{url}",
  "redirect_url": "If the page redirected, what URL did it land on, else null",
  "notes": "Brief note — e.g. title differs by colon, volume wrong, page not found"
}}

If the page 404s or redirects to a different series, set valid=false.
If the title on the page differs from our title (even slightly), note the canonical form."""

    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=400,
        tools=[{"type": "web_search_20250305", "name": "web_search"}],
        messages=[{"role": "user", "content": prompt}]
    )
    text = "\n".join(b.text for b in resp.content if b.type == "text")
    m = re.search(r'\{[\s\S]*?\}', text)
    if not m:
        return {"valid": None, "confidence": "low", "url_checked": url,
                "canonical_title": None, "notes": "No JSON returned", "raw": text}
    try:
        r = json.loads(m.group())
        r.setdefault("url_checked", url)
        return r
    except:
        return {"valid": None, "confidence": "low", "url_checked": url,
                "canonical_title": None, "notes": "JSON parse error", "raw": text}

# ── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    print(f"[{datetime.now()}] BRB Title Validation v1 starting...")

    df = pd.read_excel(INVENTORY, sheet_name=SHEET)
    
    # Build unique title list
    unique = df.groupby(['Title','Publisher']).agg(
        volume=('Volume', lambda x: x.mode().iloc[0] if len(x) else 1),
        year_min=('Year', lambda x: pd.to_numeric(x, errors='coerce').min()),
        issues=('Issue #', 'count'),
    ).reset_index()

    # Load existing results to resume
    results = json.load(open(RESULTS_PATH)) if os.path.exists(RESULTS_PATH) else {}
    done_keys = set(results.keys())
    
    # Priority order: single-issue titles first (highest risk), then by publisher
    unique['_prio'] = unique['issues'].map(lambda x: 0 if x <= 2 else 1)
    unique = unique.sort_values(['_prio','Publisher']).reset_index(drop=True)

    processed = 0
    for _, row in unique.iterrows():
        key = f"{row['Title']}|{row['Publisher']}"
        if key in done_keys:
            continue

        print(f"[{processed+1}/{len(unique)}] {row['Title']} ({row['Publisher']}) Vol {row['volume']}")

        try:
            result = validate_title(
                row['Title'], row['Publisher'],
                row['volume'], row['year_min']
            )
            result['title']     = row['Title']
            result['publisher'] = row['Publisher']
            result['issues']    = int(row['issues'])
            results[key]        = result
        except Exception as e:
            results[key] = {"valid": None, "confidence": "low", "error": str(e),
                           "title": row['Title'], "publisher": row['Publisher']}
            print(f"  ERROR: {e}")

        processed += 1

        if processed % CHECKPOINT == 0:
            with open(RESULTS_PATH, 'w') as f:
                json.dump(results, f, indent=2, cls=SafeEncoder)
            print(f"  [CHECKPOINT] {processed} titles validated")
        
        time.sleep(DELAY)

    # Final save
    with open(RESULTS_PATH, 'w') as f:
        json.dump(results, f, indent=2, cls=SafeEncoder)

    # Build output CSVs
    all_results = list(results.values())
    df_results = pd.DataFrame(all_results)

    passed  = df_results[(df_results['valid']==True)  & (df_results['title_matches']==True)]
    failed  = df_results[(df_results['valid']==False) | (df_results['title_matches']==False)]
    review  = df_results[df_results['confidence']=='low']

    passed.to_csv('title_validation_PASS.csv', index=False)
    failed.to_csv('title_validation_FAIL.csv', index=False)
    review.to_csv('title_validation_REVIEW.csv', index=False)

    print(f"\n[DONE] {processed} titles validated")
    print(f"  PASS:   {len(passed)}")
    print(f"  FAIL:   {len(failed)} — titles to fix")
    print(f"  REVIEW: {len(review)} — low confidence, manual check")
    print(f"  See title_validation_FAIL.csv for action list")

if __name__ == "__main__":
    main()
