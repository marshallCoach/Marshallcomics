#!/usr/bin/env bash
# ── BRB cover-fill pass ───────────────────────────────────────────────────────
# Chains the cover resolvers over whatever rows are still missing a cover, then
# regenerates and re-counts. Safe to run repeatedly. Does NOT commit — review the
# before/after count, then run the brb.py line it prints.
#
#   Terminal A (leave running):  cd artifacts/api-server && source ~/.zshrc && pnpm run dev   # CV proxy on :5001
#   Terminal B:                  zsh brb_cover_pass.sh
#
set -u
cd "$(dirname "$0")" || exit 1
source ~/.zshrc 2>/dev/null || true
LOG="coverpass_$(date +%Y%m%d_%H%M).log"
MCI=$([ -f mci_missing_covers.py ] && echo mci_missing_covers.py || echo attached_assets/mci_missing_covers.py)

step(){ printf '\n==== %s ====\n' "$*" | tee -a "$LOG"; }
run(){ printf '$ %s\n' "$*" | tee -a "$LOG"; eval "$@" 2>&1 | tee -a "$LOG"; }

step "0 · Baseline missing-cover count"
run "python3 $MCI"

step "1 · Marvel/DC exact-volume Fandom (free)"
run "python3 brb_fandom_covers.py"

step "2 · Marvel/DC year-gate Fandom (free)"
run "python3 brb_cover_yeargate.py"

step "3 · Comic Vine proxy — non-Marvel/DC (needs :5001)"
if curl -s -o /dev/null --max-time 5 "http://localhost:5001/api/covers/search?title=probe&issue=1"; then
  run "python3 brb_cv_covers.py"
else
  echo "  SKIPPED — CV proxy not up on :5001 (start it in Terminal A). Re-run this script to include CV." | tee -a "$LOG"
fi

step "4 · Regenerate covers into the app + data3"
run "node gen_data.mjs | tail -3"

step "5 · Missing-cover count AFTER this pass"
run "python3 $MCI"

printf '\n%s\n' "Done — log: $LOG" | tee -a "$LOG"
printf '%s\n' "If the count dropped a lot, run again. When a pass barely moves it, stop — the rest are genuinely obscure; leave them blank." | tee -a "$LOG"
printf '%s\n' "To ship: python3 brb.py --commit \"Cover-fill pass\" --yes" | tee -a "$LOG"
