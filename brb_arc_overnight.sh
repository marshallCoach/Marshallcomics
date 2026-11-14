#!/bin/bash
# brb_arc_overnight.sh — unattended arc-data fetch (READ-ONLY; never touches the xlsx).
#
#   gate (40 biggest series) -> stop if the hit rate looks broken
#   full run (all 10,027 issues) -> round 2 recovery of misses
#   auto-resumes after a network outage (up to 6 tries, 10 min apart)
#   keeps the Mac awake (caffeinate) and posts a notification when finished
#
# Start it (two separate commands):
#   nohup ./brb_arc_overnight.sh > arc_overnight.log 2>&1 &
#   echo $!
# Watch it:   tail -f arc_overnight.log
# Stop it:    kill <pid>     (cache is saved; rerun later to resume)

cd "$(dirname "$0")" || exit 1
GATE_MIN_PCT=25          # below this the gate is treated as "something is wrong"
notify() { osascript -e "display notification \"$1\" with title \"BRB arc fetch\"" >/dev/null 2>&1; echo "== $1"; }
stamp() { date "+%Y-%m-%d %H:%M:%S"; }

echo "== $(stamp) overnight arc fetch starting (pid $$)"
[ -f arc_targets.csv ] || { notify "arc_targets.csv missing - stopped"; exit 1; }
FREE_MB=$(df -m . | awk 'NR==2 {print $4}')
[ "${FREE_MB:-0}" -lt 500 ] && { notify "under 500 MB free disk - stopped"; exit 1; }

# ---- 1. gate -------------------------------------------------------------------------
echo "== $(stamp) GATE: 40 biggest series"
caffeinate -i -s python3 brb_arc_fetch.py --limit 40 --no-round2
rc=$?
if [ $rc -ne 0 ]; then notify "gate failed (exit $rc) - see arc_overnight.log"; exit $rc; fi
PCT=$(python3 -c "import json;print(int(json.load(open('arc_summary.json'))['pct']))")
echo "== $(stamp) gate hit rate: ${PCT}%"
if [ "$PCT" -lt "$GATE_MIN_PCT" ]; then
  notify "gate only ${PCT}% - stopped before the full run. Paste the log to Claude."
  cp arc_summary.json arc_summary_gate.json
  exit 2
fi
cp arc_summary.json arc_summary_gate.json

# ---- 2. full run + round 2, auto-resume on outage ---------------------------------------
for try in 1 2 3 4 5 6; do
  echo "== $(stamp) FULL RUN (attempt $try)"
  caffeinate -i -s python3 brb_arc_fetch.py
  rc=$?
  [ $rc -eq 0 ] && break
  if [ $rc -eq 75 ]; then
    echo "== $(stamp) network outage - waiting 10 min then resuming"
    sleep 600
  else
    notify "full run stopped (exit $rc) - see arc_overnight.log"; exit $rc
  fi
done
[ $rc -ne 0 ] && { notify "gave up after repeated outages - rerun to resume"; exit $rc; }

PCT=$(python3 -c "import json;d=json.load(open('arc_summary.json'));print(f\"{d['found']}/{d['issues']} ({d['pct']}%)\")")
notify "done: $PCT issues found. Upload arc_raw.jsonl.gz + arc_misses.csv to Claude."
echo "== $(stamp) finished"
