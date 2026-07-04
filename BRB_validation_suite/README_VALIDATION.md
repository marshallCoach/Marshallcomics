# BRB Validation Suite — 3 Layers

## Overview

| Layer | Script | Checks | Est. API cost | Run time |
|---|---|---|---|---|
| 1 — Titles | validate_titles.py | 1,473 titles vs DC/Marvel Fandom & ComicVine | ~$3-5 | 2-3 hrs |
| 2 — Volumes | validate_volumes.py | 82 contiguity violations vs Marvel Fandom | ~$0.50 | 30 min |
| 3 — Pricing | validate_pricing.py | ~800 books $10+ vs eBay/LCG/KeyCollector | ~$5-8 | 4-6 hrs |

## Run order (do Layer 2 first — cheapest, fastest, fixes volume data before Layer 1 uses it)

```bash
cd BRB_overnight_script_v2

# Layer 2 first (30 min)
nohup python3 validate_volumes.py > volumes_log.txt 2>&1 &

# Layer 1 overnight (2-3 hrs)
nohup python3 validate_titles.py > titles_log.txt 2>&1 &

# Layer 3 separate night (4-6 hrs, most expensive)
nohup python3 validate_pricing.py > pricing_log.txt 2>&1 &
```

## What each script does

### Layer 1 — Title Validation
- DC titles: constructs dc.fandom.com URL, fetches, confirms exact title match
- Marvel titles: constructs marvel.fandom.com URL, fetches, confirms exact title match  
- Other publishers: ComicVine search
- **Priority order**: Single/low-issue-count titles first (807 titles with 1-2 issues — highest risk)
- **Output**: PASS.csv (confirmed), FAIL.csv (wrong title / not found), REVIEW.csv (ambiguous)

### Layer 2 — Volume Validation
- Checks the 82 volume contiguity violations already logged this session
- Cross-references Marvel Fandom year ranges against our Volume assignments
- **Output**: volume_corrections.csv (suggested Volume field fixes)

### Layer 3 — Pricing Validation
- Searches eBay sold listings, League of Comic Geeks, Key Collector Comics
- Only runs on books valued $10+ (skips $0-8 filler — not worth API cost)
- Only flags changes >25% from current estimate
- **Output**: pricing_corrections.csv (suggested value updates), pricing_unchanged.csv

## After each run

Bring the output CSVs back to Claude and say:
"Apply the title validation corrections" / "Apply the volume corrections" / "Apply the pricing corrections"

Claude will cross-reference against the inventory by # column and apply only high-confidence
confirmed changes, leaving low-confidence ones in a flagged review column.

## Important notes
- All scripts resume from checkpoint if interrupted (results saved every 25-50 titles)
- Scripts NEVER auto-write to the inventory — they only produce CSV suggestion files
- You review and confirm before any inventory changes are applied
