#!/usr/bin/env zsh
# Weekly new-comic intake — one command.
#
#   zsh brb_intake.sh intake_2026-09-22.csv
#
# Does everything: syncs the branch, appends the week's rows to the xlsx
# (Date_Added marker + Pub_Date=today baked in, so Recent Purchases AND Release
# Timeline pick them up), then runs the full pipeline (validate → data3 → quest →
# fill-rates) and commits + pushes the generated files.
#
# Preview first without writing anything:
#   zsh brb_intake.sh intake_2026-09-22.csv --dry
set -e

CSV="${1:?usage: zsh brb_intake.sh <intake_YYYY-MM-DD.csv> [--dry]}"
cd "${0:A:h}"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

if [[ "${2:-}" == "--dry" ]]; then
  echo "== DRY RUN — no writes =="
  python3 brb_add_intake.py --csv "$CSV"
  exit 0
fi

echo "== 1/3 sync branch =="
git pull --rebase --autostash origin "$BRANCH"

echo "== 2/3 append intake =="
python3 brb_add_intake.py --csv "$CSV" --apply

echo "== 3/3 pipeline + commit + push =="
python3 brb.py --commit "Weekly intake $(date +%F)" --yes

echo "== done — Recent Purchases + Release Timeline will show the new books after deploy =="
