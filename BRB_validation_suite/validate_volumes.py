#!/usr/bin/env python3
"""
BRB Volume Validation Script — Layer 2
Cross-checks Marvel volume assignments against:
  - https://www.howtolovecomics.com/2023/09/13/marvel-legacy-numbering/
  - marvel.fandom.com series pages
  - Checks for the 82 contiguity violations already logged

Outputs:
  - volume_validation_results.json
  - volume_corrections.csv  (suggested Volume field fixes)
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
RESULTS_PATH = "volume_validation_results.json"
LEGACY_URL   = "https://www.howtolovecomics.com/2023/09/13/marvel-legacy-numbering/"
DELAY        = 1.5

client = Anthropic()

def validate_volume(title, volume, year_hint, issue_sample):
    url = f"https://marvel.fandom.com/wiki/{re.sub(chr(32),'_',title)}_Vol_{int(float(volume))}"
    
    prompt = f"""Validate the Volume number for this Marvel comic series:

Title: "{title}"
Our Volume: {volume}
Approx years: {year_hint}
Sample issues: {issue_sample}
Check: {url}

Respond ONLY with JSON:
{{
  "volume_correct": true or false,
  "correct_volume": {volume} or the right number,
  "confidence": "high" or "low",
  "year_range_on_page": "e.g. 2019-2021 or null",
  "notes": "brief explanation"
}}"""

    resp = client.messages.create(
        model="claude-sonnet-4-6", max_tokens=300,
        tools=[{"type": "web_search_20250305", "name": "web_search"}],
        messages=[{"role": "user", "content": prompt}]
    )
    text = "\n".join(b.text for b in resp.content if b.type == "text")
    m = re.search(r'\{[\s\S]*?\}', text)
    if not m:
        return {"volume_correct": None, "confidence": "low", "notes": "No JSON"}
    try:
        return json.loads(m.group())
    except:
        return {"volume_correct": None, "confidence": "low", "notes": "Parse error"}

def main():
    print(f"[{datetime.now()}] BRB Volume Validation starting...")
    df = pd.read_excel(INVENTORY, sheet_name=SHEET)
    df['Year_num'] = pd.to_numeric(df['Year'], errors='coerce')
    df['Vol_num']  = pd.to_numeric(df['Volume'], errors='coerce')

    # Only Marvel titles with multiple volumes (highest risk)
    marvel = df[df['Publisher'].isin(['Marvel','Marvel Comics'])].copy()
    
    # Find contiguity violations (from earlier session — these are the priority)
    contiguity_issues = []
    for title, g in marvel.groupby('Title'):
        vols = g['Vol_num'].dropna().unique()
        if len(vols) < 2: continue
        vol_ranges = []
        for v in sorted(vols):
            sub = g[g['Vol_num']==v]
            years = sub['Year_num'].dropna()
            if len(years): vol_ranges.append((v, years.min(), years.max()))
        for i in range(len(vol_ranges)-1):
            v1,min1,max1 = vol_ranges[i]
            v2,min2,max2 = vol_ranges[i+1]
            if max1 > min2:
                contiguity_issues.append({'Title':title,'Vol_A':v1,'Vol_B':v2,
                    'gap':max1-min2, 'year_A':f"{min1:.0f}-{max1:.0f}",
                    'year_B':f"{min2:.0f}-{max2:.0f}"})

    print(f"Contiguity violations to check: {len(contiguity_issues)}")
    
    results = json.load(open(RESULTS_PATH)) if os.path.exists(RESULTS_PATH) else {}
    processed = 0
    corrections = []

    for issue in contiguity_issues:
        key = f"{issue['Title']}|{issue['Vol_A']}|{issue['Vol_B']}"
        if key in results: continue

        print(f"  [{processed+1}] {issue['Title']} Vol {issue['Vol_A']} ({issue['year_A']}) vs Vol {issue['Vol_B']} ({issue['year_B']})")

        try:
            r = validate_volume(issue['Title'], issue['Vol_B'],
                               issue['year_B'], issue['year_B'])
            r.update(issue)
            results[key] = r
            if not r.get('volume_correct') and r.get('confidence') == 'high':
                corrections.append({
                    'Title': issue['Title'],
                    'Current_Vol': issue['Vol_B'],
                    'Suggested_Vol': r.get('correct_volume'),
                    'Year_Range': issue['year_B'],
                    'Notes': r.get('notes','')
                })
        except Exception as e:
            results[key] = {"error": str(e), **issue}

        processed += 1
        if processed % 25 == 0:
            with open(RESULTS_PATH,'w') as f: json.dump(results, f, indent=2, cls=SafeEncoder)
        time.sleep(DELAY)

    with open(RESULTS_PATH,'w') as f: json.dump(results, f, indent=2, cls=SafeEncoder)
    pd.DataFrame(corrections).to_csv('volume_corrections.csv', index=False)
    print(f"\n[DONE] {processed} contiguity violations checked. {len(corrections)} suggested corrections.")

if __name__ == "__main__":
    main()
