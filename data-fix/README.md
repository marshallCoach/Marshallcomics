# BRB Overnight Writer-Fill Script

## What this does
Continues the Phase 1 Writer-fill task from comics_inventory_1906_0615.xlsx,
working through the remaining ~593 runs in final_run_queue.pkl.

## What this does NOT do
- Does NOT fill Artist (Phase 2, separate task — artist rotates too often per-issue)
- Does NOT touch "The Flash" (241 rows, Volume data unreliable — flagged for separate audit)
- Does NOT auto-resolve ambiguous cases (multi-writer runs, anthology books) — 
  these get logged to needs_review.json instead of guessed

## Requirements
- Claude Code CLI installed (claude.ai/code)
- Anthropic API key set as env var: ANTHROPIC_API_KEY
- Python 3.10+, pandas, openpyxl

## How to run overnight
```bash
cd /home/claude/overnight_script
nohup python3 run_overnight.py > overnight_log.txt 2>&1 &
```
This detaches from your terminal — closing the window won't stop it.
Check progress anytime: `tail -f overnight_log.txt`

## Safety guardrails built in (same as manual process tonight)
1. Before filling, checks if Title already has Writer/Artist data under a 
   DIFFERENT Year — if year gap >15yrs, SKIPS and flags for manual review 
   (this is what caught the Outsiders/Young Justice volume collisions)
2. Searches for "[Title] [Year] writer" via Claude with web search tool
3. If search reveals multiple writers across the issue range in scope, 
   does NOT apply a single name — logs the issue-range breakdown needed 
   and skips (this is what caught Marauders/Secret Avengers/She-Hulk handoffs)
4. Every fill OR skip gets logged with reasoning to session_log/issues.json
5. Saves a new timestamped checkpoint xlsx every 25 titles processed, 
   so a crash never loses more than ~25 titles of progress

## Output
- comics_inventory_[timestamp].xlsx — final result, in /mnt/user-data/outputs equivalent
- issues.json — full log, same format as tonight, ready to review in the morning
- needs_review.json — anything the script couldn't confidently resolve
