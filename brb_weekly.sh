#!/bin/zsh
# ── BRB weekly enrichment ─────────────────────────────────────────────────────
# ONE command:  zsh brb_weekly.sh
# Detects comics added since last run, then fills covers, writers/artists,
# characters, and eBay prices for whatever is missing — free passes always run,
# credentialed passes run only if their keys/proxy are available — then
# validates, reingests, and pushes. Safe to run every week.
setopt interactive_comments 2>/dev/null
cd /Users/robertmarshall/Marshallcomics
source ~/.zshrc 2>/dev/null || true          # load EBAY / COMIC_VINE / ANTHROPIC keys if set
LOG="weekly_$(date +%Y%m%d_%H%M).log"
step(){ print -P "\n%F{cyan}════ $* ════%f" | tee -a "$LOG"; }
run(){ eval "$@" 2>&1 | tee -a "$LOG"; }

step "0 · Detect new comics since last run"
python3 - <<'PY' 2>&1 | tee -a "$LOG"
import openpyxl, glob, os, json
f=max(glob.glob("attached_assets/comics_inventory_*.xlsx"), key=os.path.getmtime)
ws=next(w for w in openpyxl.load_workbook(f,read_only=True,data_only=True).worksheets if w.title.startswith("✅ Clean Inventory"))
rows=list(ws.iter_rows(values_only=True)); H=[str(h).strip() for h in rows[0]]; C={h:i for i,h in enumerate(H)}
def s(r,n):
    v=r[C[n]] if n in C else None; return str(v).strip() if v is not None else ""
keys=set((s(r,"Title"), s(r,"Issue #").replace(".0",""), s(r,"Box #")) for r in rows[1:] if s(r,"Title"))
snap=".brb_weekly_snapshot.json"
old=set(map(tuple, json.load(open(snap)))) if os.path.exists(snap) else set()
new=keys-old
print(f"Canonical: {os.path.basename(f)}  |  NEW comics this run: {len(new)}")
for k in sorted(new)[:40]: print(f"   + {k[0]} #{k[1]}  → Box {k[2]}")
if len(new)>40: print(f"   … and {len(new)-40} more")
json.dump([list(k) for k in keys], open(snap,"w"))
PY

step "1 · Covers — Fandom year-gate (free)"
run "python3 brb_cover_yeargate.py | tail -1"

step "2 · Covers — Comic Vine (if proxy up on :5001)"
if curl -s -o /dev/null --max-time 5 "http://localhost:5001/api/covers/search?title=probe&issue=1"; then
  run "python3 brb_cv_covers.py | tail -2"
else
  echo "  SKIPPED — Comic Vine proxy not running (start: cd artifacts/api-server && COMIC_VINE_API_KEY=… npm start)" | tee -a "$LOG"
fi

step "3 · Writers & Artists — GCD (free, local)"
run "python3 brb_gcd_fill.py --apply | grep -iE 'filled|Written'"

step "4 · Characters + Cover Artists — vision (needs ANTHROPIC_API_KEY)"
if [ -n "$ANTHROPIC_API_KEY" ]; then
  run "python3 brb_cover_links.py    | tail -1"
  run "python3 brb_vision_preflight.py | tail -1"
  run "python3 brb_vision_characters.py | tail -1"
  run "python3 brb_vision_enrich.py   | tail -1"
  run "python3 brb_combine_characters.py | tail -2"
else
  echo "  SKIPPED — set ANTHROPIC_API_KEY to enrich characters/cover-artists" | tee -a "$LOG"
fi

step "5 · eBay pricing (needs EBAY_APP_ID)"
if [ -n "$EBAY_APP_ID" ]; then
  run "python3 brb_ebay_pricing.py | tail -2"
  run "python3 brb_price_gate.py --apply | tail -2"
else
  echo "  SKIPPED — set EBAY_APP_ID/EBAY_CERT_ID to refresh eBay prices" | tee -a "$LOG"
fi

step "6 · Validate → reingest → push"
run "python3 brb.py --commit \"weekly enrichment $(date +%Y-%m-%d)\" --yes | grep -iE 'RESULT|ALL 13|Written: 1|git push|->'"

print -P "\n%F{green}✔ Weekly enrichment complete — log: $LOG%f" | tee -a "$LOG"
