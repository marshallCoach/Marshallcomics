#!/bin/zsh
# Unattended cover pipeline: Fandom year-gate -> Comic Vine (flagged books) ->
# reingest -> audit -> build cover_links doc -> commit+deploy. Steps run STRICTLY
# sequentially because the Fandom resolver and the CV proxy both write covers.json
# (concurrent writes were the original stale-cover bug). Logs to cover_pipeline.log
# in the repo (survives session restarts). Detached via nohup so it finishes even
# if the Claude session ends.
set -e
cd /Users/robertmarshall/Marshallcomics
LOG=cover_pipeline.log
FLAGS=_flags_0806.json
say(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

: > "$LOG"
say "PIPELINE START"

# 0. no stray resolver, stable copy of the flag file
pkill -f "python.*brb_cover_yeargate" 2>/dev/null || true
sleep 2
cp /Users/robertmarshall/Downloads/flagged-covers-2026-08-06.json "$FLAGS"

# 1. Fandom year-gate (Marvel/DC) — run to completion
say "STEP 1/6 Fandom year-gate resolver"
python3 brb_cover_yeargate.py >>"$LOG" 2>&1
say "  fandom done"

# 2. Comic Vine for the exact flagged books still blank (proxy on :5001 holds key).
#    Skip cleanly if the proxy isn't up — the key is user-supplied, can't start it
#    here. The indie books (Die/Star Trek/Wildcats/Firefly) then stay honest-blank
#    until the user runs the one-liner below with the proxy up.
say "STEP 2/6 Comic Vine pass (flagged books, via local proxy)"
if curl -s -o /dev/null --max-time 8 "http://localhost:5001/api/covers/search?title=probe&issue=1"; then
  python3 brb_cv_covers.py --flags "$FLAGS" --delay 25 >>"$LOG" 2>&1 || say "  cv step nonzero — continuing"
  say "  cv done"
else
  say "  SKIPPED — proxy :5001 down. Run later: python3 brb_cv_covers.py --flags $FLAGS --delay 25"
fi

# 3. reingest
say "STEP 3/6 gen_data.mjs"
node gen_data.mjs >>"$LOG" 2>&1
say "  gen_data done"

# 4. audit (report only)
say "STEP 4/6 wrong-era audit"
python3 brb_cover_audit.py >>"$LOG" 2>&1 || true
say "  audit done"

# 5. build the browsable cover-links document
say "STEP 5/6 build cover_links document"
python3 brb_cover_links.py >>"$LOG" 2>&1
DOC=$(ls -t cover_links_*.xlsx 2>/dev/null | head -1)
say "  document: $DOC"

# 6. commit + deploy (cover files only — leave unrelated working changes alone)
say "STEP 6/6 commit + push (GitHub Pages auto-deploys)"
git add covers.json artifacts/comics-inventory/public/covers.json \
        artifacts/comics-inventory/src/data/data3.ts \
        brb_cover_links.py brb_cv_covers.py orchestrate_covers.sh 2>>"$LOG" || true
if git diff --cached --quiet; then
  say "  nothing staged to commit"
else
  git commit -m "Covers: re-resolve flagged wrong/blank covers (Fandom year-gate + Comic Vine); add cover-links doc

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>" >>"$LOG" 2>&1
  git pull --rebase origin claude/upbeat-babbage-2f5gr2 >>"$LOG" 2>&1 || say "  rebase had issues — check log"
  git push origin claude/upbeat-babbage-2f5gr2 >>"$LOG" 2>&1 && say "  pushed — Pages will redeploy" || say "  PUSH FAILED — check log"
fi

say "PIPELINE COMPLETE — document: $DOC"
