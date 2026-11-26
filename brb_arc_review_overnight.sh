#!/bin/bash
# brb_arc_review_overnight.sh — full arc re-review, READ-ONLY on the xlsx (Nov 26).
#   1. fresh target list from the CURRENT inventory (every Marvel/DC book)
#   2. fresh online fetch: the old cache is set aside (kept as a backup) so every page is
#      asked again; auto-resumes after a network outage (6 tries, 10 min apart)
#   3. extract arcs  4. report: FILL (blanks) / SAME / DIFFERENT (verify) / NO DATA
# Nothing is written to the inventory. In the morning, paste the summary to Claude; the
# FILL rows are applied with one reviewed command (blank cells only).
#
#   cd ~/marshallcomics && nohup ./brb_arc_review_overnight.sh > arc_review.log 2>&1 &
#   echo $!
# Watch: tail -f arc_review.log      Stop: kill <pid>  (cache saved; rerun resumes)

cd "$(dirname "$0")" || exit 1
notify() { osascript -e "display notification \"$1\" with title \"BRB arc review\"" >/dev/null 2>&1; echo "== $1"; }
stamp() { date "+%Y-%m-%d %H:%M:%S"; }
echo "== $(stamp) arc re-review starting (pid $$)"

python3 brb_arc_review.py --targets || { notify "could not build targets"; exit 1; }

# fresh online data: set the old cache aside once (a rerun after a stop resumes the new one)
if [ ! -f arc_review.started ]; then
  for f in arc_cache.json arc_cache.json.bak; do [ -f "$f" ] && mv "$f" "${f%.json*}_pre_review_$(date +%Y%m%d).${f#*.}"; done
  touch arc_review.started
fi

for try in 1 2 3 4 5 6; do
  echo "== $(stamp) FETCH (attempt $try)"
  caffeinate -i -s python3 brb_arc_fetch.py --targets arc_targets_full.csv
  rc=$?
  [ $rc -eq 0 ] && break
  if [ $rc -eq 75 ]; then echo "== $(stamp) network outage - waiting 10 min"; sleep 600
  else notify "fetch stopped (exit $rc) - see arc_review.log"; exit $rc; fi
done
[ $rc -ne 0 ] && { notify "gave up after repeated outages - rerun to resume"; exit $rc; }

python3 brb_arc_extract.py --out arc_extracted_full.csv || { notify "extract failed"; exit 1; }
python3 brb_arc_review.py --report || { notify "report failed"; exit 1; }
rm -f arc_review.started
notify "arc review done - paste the ARC REVIEW summary from arc_review.log to Claude"
echo "== $(stamp) finished"
