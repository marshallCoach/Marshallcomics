#!/usr/bin/env python3
"""
BRB Pricing Validation Script — Layer 3
Cross-checks estimated values against:
  - eBay sold listings
  - League of Comic Geeks (leagueofcomicgeeks.com)
  - Key Collector Comics (keycollectorcomics.com/series/)

Priority: KEY issues only, then high-value ($50+), then mid-tier ($10-50)
Skips: $0-8 filler stock (price precision doesn't matter at this level)

Outputs:
  - pricing_validation_results.json
  - pricing_corrections.csv  (suggested Est. Raw Value updates)
  - pricing_unchanged.csv    (confirmed current values correct)
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

INVENTORY    = "comics_inventory_2506_1200.xlsx"
SHEET        = "✅ Clean Inventory 2506_1200"
RESULTS_PATH = "pricing_validation_results.json"
DELAY        = 2.0   # slightly more delay — eBay/LCG rate limit more aggressively

client = Anthropic()

def validate_price(title, issue, year, current_price, is_key, publisher):
    """Ask Claude to check current raw value across multiple sources."""
    
    # Build targeted search queries for each source
    prompt = f"""Check the current raw (ungraded) market value for this comic:

Title: "{title}" #{issue} ({year})
Publisher: {publisher}
Our current estimate: ${current_price} NM raw
Key issue: {is_key}

Search these sources in order and return real sold data:
1. eBay sold listings: search "site:ebay.com {title} {issue} raw sold"
2. League of Comic Geeks: https://leagueofcomicgeeks.com/comic/search?q={title.replace(' ','+')}+{issue}
3. Key Collector Comics if it's a key: https://www.keycollectorcomics.com/series/

Respond ONLY with JSON:
{{
  "current_estimate_accurate": true or false or "unknown",
  "suggested_value": {current_price} or a different number or null,
  "confidence": "high" or "low",
  "ebay_low": null or number,
  "ebay_high": null or number,
  "lcg_value": null or number,
  "key_collector_grade": null or "hot/warm/cold",
  "notes": "brief explanation of sources found and why value changed or didn't"
}}

Only suggest a value change if you found real recent sold data (within 6 months).
If no data found, set confidence to "low" and current_estimate_accurate to "unknown"."""

    resp = client.messages.create(
        model="claude-sonnet-4-6", max_tokens=500,
        tools=[{"type": "web_search_20250305", "name": "web_search"}],
        messages=[{"role": "user", "content": prompt}]
    )
    text = "\n".join(b.text for b in resp.content if b.type == "text")
    m = re.search(r'\{[\s\S]*?\}', text)
    if not m:
        return {"current_estimate_accurate": "unknown", "confidence": "low",
                "suggested_value": None, "notes": "No JSON returned"}
    try:
        return json.loads(m.group())
    except:
        return {"current_estimate_accurate": "unknown", "confidence": "low",
                "suggested_value": None, "notes": "Parse error"}

def main():
    print(f"[{datetime.now()}] BRB Pricing Validation starting...")

    df = pd.read_excel(INVENTORY, sheet_name=SHEET)
    df['_val'] = pd.to_numeric(df['Est. Raw Value (NM) $'], errors='coerce').fillna(0)
    df['_key'] = df['Key Issue?'].astype(str).str.upper().str.strip() == 'YES'

    # Priority queue:
    # 1. Keys with value $50+          (highest ROI on getting this right)
    # 2. Keys $10-50                   (mid priority)
    # 3. Non-keys $50+                 (catch undervalued books)
    # 4. Skip everything under $10     (not worth the API cost)
    priority = df[df['_val'] >= 10].copy()
    priority['_prio'] = 3
    priority.loc[priority['_key'] & (priority['_val'] >= 50),  '_prio'] = 1
    priority.loc[priority['_key'] & (priority['_val'] < 50),   '_prio'] = 2
    priority = priority.sort_values(['_prio','_val'], ascending=[True,False])

    print(f"Books to price-check: {len(priority)} (value ≥$10)")
    print(f"  Priority 1 (keys $50+): {(priority['_prio']==1).sum()}")
    print(f"  Priority 2 (keys $10-50): {(priority['_prio']==2).sum()}")
    print(f"  Priority 3 (non-keys $10+): {(priority['_prio']==3).sum()}")

    results = json.load(open(RESULTS_PATH)) if os.path.exists(RESULTS_PATH) else {}
    corrections = []
    processed = 0

    for _, row in priority.iterrows():
        key = f"{row['#']}"
        if key in results: continue

        print(f"  [{processed+1}] {row['Title']} #{row['Issue #']} — current ${row['_val']}")

        try:
            r = validate_price(
                row['Title'], row['Issue #'], row['Year'],
                row['_val'], row['_key'], row['Publisher']
            )
            r['#'] = row['#']
            r['title'] = row['Title']
            r['issue'] = row['Issue #']
            r['current_value'] = row['_val']
            results[key] = r

            # Flag meaningful price changes (>25% difference)
            if (r.get('suggested_value') and r.get('confidence') == 'high'
                    and abs(r['suggested_value'] - row['_val']) / max(row['_val'],1) > 0.25):
                corrections.append({
                    '#': row['#'], 'Title': row['Title'], 'Issue': row['Issue #'],
                    'Current': row['_val'], 'Suggested': r['suggested_value'],
                    'Change': f"{(r['suggested_value']-row['_val'])/row['_val']*100:+.0f}%",
                    'eBay_range': f"${r.get('ebay_low','?')}-${r.get('ebay_high','?')}",
                    'LCG': r.get('lcg_value','?'),
                    'Notes': r.get('notes','')[:100]
                })
        except Exception as e:
            results[key] = {"error": str(e), "#": row['#']}
            print(f"  ERROR: {e}")

        processed += 1
        if processed % 25 == 0:
            with open(RESULTS_PATH,'w') as f: json.dump(results, f, indent=2, cls=SafeEncoder)
            pd.DataFrame(corrections).to_csv('pricing_corrections.csv', index=False)
            print(f"  [CHECKPOINT] {processed} books checked")
        time.sleep(DELAY)

    with open(RESULTS_PATH,'w') as f: json.dump(results, f, indent=2, cls=SafeEncoder)
    pd.DataFrame(corrections).to_csv('pricing_corrections.csv', index=False)
    
    unchanged = [r for r in results.values() 
                 if r.get('current_estimate_accurate') == True and r.get('confidence') == 'high']
    pd.DataFrame(unchanged).to_csv('pricing_unchanged.csv', index=False)

    print(f"\n[DONE] {processed} books price-checked")
    print(f"  Corrections suggested: {len(corrections)}")
    print(f"  Confirmed unchanged: {len(unchanged)}")

if __name__ == "__main__":
    main()
