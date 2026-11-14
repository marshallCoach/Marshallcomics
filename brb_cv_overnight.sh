#!/bin/bash
# brb_cv_overnight.sh -- unattended Comic Vine arc fill (READ-ONLY; never touches the xlsx).
#
#   checks the API key + disk -> gate (30 books) -> stop if the hit rate looks broken
#   full run (every row still missing a Story Arc), auto-resume after outages (6 tries)
#   keeps the Mac awake (caffeinate) and posts a notification when finished
#   Comic Vine allows ~200 requests/hour per resource, so this can take more than
#   one night -- just start it again; the cache resumes where it stopped.
#
# Start it (two separate commands):
#   nohup ./brb_cv_overnight.sh > cv_overnight.log 2>&1 &
#   echo $!
# Watch it:   tail -f cv_overnight.log
# Stop it:    kill <pid>     (cache is saved; rerun later to resume)

cd "$(dirname "$0")" || exit 1
GATE_MIN_PCT=10
notify() { osascript -e "display notification \"$1\" with title \"BRB Comic Vine\"" >/dev/null 2>&1; echo "== $1"; }
stamp() { date "+%Y-%m-%d %H:%M:%S"; }

echo "== $(stamp) Comic Vine arc fill starting (pid $$)"
[ -n "$COMIC_VINE_API_KEY" ] || { notify "COMIC_VINE_API_KEY not set - add to ~/.zshrc"; exit 1; }
FREE_MB=$(df -m . | awk 'NR==2 {print $4}')
[ "${FREE_MB:-0}" -lt 500 ] && { notify "under 500 MB free disk - stopped"; exit 1; }

echo "== $(stamp) GATE: 30 books"
caffeinate -i -s python3 brb_cv_arcs.py --limit 30
rc=$?
if [ $rc -ne 0 ]; then notify "gate failed (exit $rc) - see cv_overnight.log"; exit $rc; fi
PCT=$(python3 -c "import json;print(int(json.load(open('cv_summary.json'))['pct']))")
echo "== $(stamp) gate hit rate: ${PCT}%"
cp cv_summary.json cv_summary_gate.json
if [ "$PCT" -lt "$GATE_MIN_PCT" ]; then
  notify "gate only ${PCT}% - stopped before the full run. Paste the log to Claude."; exit 2
fi

for try in 1 2 3 4 5 6; do
  echo "== $(stamp) FULL RUN (attempt $try)"
  caffeinate -i -s python3 brb_cv_arcs.py
  rc=$?
  [ $rc -eq 0 ] && break
  if [ $rc -eq 75 ]; then
    echo "== $(stamp) outage / rate limit - waiting 15 min then resuming"; sleep 900
  else
    notify "full run stopped (exit $rc) - see cv_overnight.log"; exit $rc
  fi
done
[ $rc -ne 0 ] && { notify "gave up after repeated outages - rerun to resume"; exit $rc; }
PCT=$(python3 -c "import json;d=json.load(open('cv_summary.json'));print(f\"{d['found']}/{d['books']} ({d['pct']}%)\")")
notify "done: arcs for $PCT books -> cv_arcs.csv"
echo "== $(stamp) finished"
