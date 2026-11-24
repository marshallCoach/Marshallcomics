#!/bin/sh
# One-shot overnight run (Nov 24): Jr. fix -> legacy volume batches 3-6 -> autolink.
# Each batch gets its own brb_all so one batch never trips the 120-volume safety limit for
# the others. Stops at the first failed brb_all (Basso sound) - nothing after it runs.
# brb_all step 1c (relink) now also reuses a link from another copy of the same book,
# so books on Data Fix with missing data / cover are re-checked against known links every run.
#   sh brb_overnight_1124.sh
cd "$(dirname "$0")" || exit 1
git pull || exit 1

ok()   { afplay /System/Library/Sounds/Glass.aiff 2>/dev/null; }
fail() { echo "=== STOPPED at: $1 - paste the last 40 lines ==="; afplay /System/Library/Sounds/Basso.aiff 2>/dev/null; exit 1; }
leg()  { python3 brb_legacy_links.py --write "$@" || echo "=== legacy skipped: $* ==="; }
run()  { echo "=== brb_all: $1 ==="; python3 brb_all.py || fail "$1"; }

# 0. restore 'Jr.' on 3 cover credits (prints SKIP if you already applied it)
python3 brb_fix_rows.py jr_fix_1124.json --apply

# Batch 3
leg --title "Uncanny X-Men";                                  run "Uncanny X-Men"
leg --title "Captain America";                                run "Captain America"
# Batch 4
leg --title "X-Force"
leg --title "Guardians of the Galaxy";                        run "X-Force + GotG"
leg --title "Thunderbolts"
leg --title "The Amazing Spider-Man" --fandom "Amazing Spider-Man"
leg --title "Amazing Spider-Man";                             run "Thunderbolts + Amazing Spider-Man"
# Batch 5
leg --title "Cable"
leg --title "Elektra";                                        run "Cable + Elektra"
leg --title "Spider-Man"
leg --title "Nova";                                           run "Spider-Man + Nova"
# Batch 6
leg --title "Ultimate Spider-Man"
leg --title "Iron Man"
leg --title "Invincible Iron Man";                            run "Ultimate Spider-Man + Iron Man"

# Last: find Fandom pages for every Marvel/DC book still missing data or a cover
python3 brb_autolink.py --write;                              run "autolink"

echo "=== ALL DONE ==="
ok
