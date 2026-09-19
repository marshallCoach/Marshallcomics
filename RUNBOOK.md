# BRB — Marshall Comics · Runbook

Routine commands + FAQ. Claude references this; Robert prefers commands
**line-by-line** in chat unless it's a big code block.

Branch: `claude/upbeat-babbage-2f5gr2` · everything runs from `~/Marshallcomics`.

---

## Routine commands

### Reingest + commit + push (after any xlsx / data change)
```
python3 brb.py --commit "what changed" --yes
```

### Measure missing covers
```
python3 mci_missing_covers.py
```

### Validate the inventory
```
python3 brb_validate.py
```

### Count covers that have a URL
```
python3 -c "import json;c=json.load(open('covers.json'));print(sum(1 for e in c.values() if (e.get('url') if isinstance(e,dict) else e)))"
```

### The cover extrapolation loop (repeat until leads ≈ 0)
```
python3 brb_extrapolate_covers.py
python3 brb_apply_fandom_pages.py --flags fandom-extrapolated-$(date +%F).json --apply
python3 brb.py --commit "apply extrapolated covers" --yes
python3 mci_missing_covers.py
```

### Apply a Data-Fix / Fandom-links export
```
python3 brb_apply_fandom_pages.py --flags <file>.json --apply
```

### Apply a flagged-covers export (DIFFERENT pipeline — never mix with data-fixes)
```
python3 brb_fix_flagged_covers.py --flags <flagged-covers-file>.json --apply
```

### Git sync when a push is rejected / you're behind origin
```
git stash
git pull --rebase origin claude/upbeat-babbage-2f5gr2
git stash drop
cp artifacts/comics-inventory/public/covers.json covers.json
git push -u origin claude/upbeat-babbage-2f5gr2
```

### Stop a stuck fetcher
```
pkill -f brb_fandom_covers.py
pkill -f brb_cv_covers.py
pgrep -fl "brb_.*covers" || echo "all stopped"
```

---

## FAQ

**What does `W/A/C=2/1/3` mean in the apply output?**
Counts pulled from the Fandom infobox: **W**riters / **A**rtists / **C**over-artists.
`cover=yes` = a cover was written; `date=YYYY-MM-00` = publication date set.

**Why are there more covers than comics?**
covers.json counts **keys**, not comics. Each book is stored under up to 3 key
forms (3-part `Title|Issue|Volume`, 2-part `Title|Issue`, `Title|#Issue`) as the
app's lookup fallback, plus one cover per volume/era, plus ~900 stale covers for
books no longer owned. Not 1:1 with the collection.

**Is this a duplicate or a volume issue?**
Usually **volume** — the same title+issue under two volume numbers (e.g. Black
Panther Vol 6 vs Vol 7). Always check the volume before calling it a dupe.

**Does "confirm before credits" mean comic creator credits?**
No. It means **AI usage / compute spend**. Comic creator credits
(Writer/Artist/Cover Artist) are ordinary data work — fill them freely.

**Why did the cover apply hang?**
A blank-issue row built a junk URL (`Title Vol N `) and stalled the fetch. The
apply now skips blank-issue rows.

**Why does ComicVine reject everything on the indie tail?**
The title-guard is correctly rejecting wrong-title matches on common words
("Die" → German books, "Black" → Deadpool). CV can't resolve that tail — those
are manual via the Missing Covers page.

**Why did the Fandom fetcher return 0 fills / all `no-page`?**
The `Title Vol N Issue` page-name guess is wrong whenever the collection's
volume disagrees with Fandom's. Use the search fallback, or extrapolate from a
series already confirmed (`brb_extrapolate_covers.py`).

**Why does root `covers.json` always show as modified?**
`brb.py` commits `public/covers.json`, not root. Root is the working master the
scripts append to. It's normal noise — restore it after a reset with
`cp artifacts/comics-inventory/public/covers.json covers.json`.

**Why do the missing-cover counts differ (e.g. 419 vs 514)?**
Different dedup keys — `mci` counts title+issue; a volume-strict count is higher.
Use `mci`'s number as the app-facing figure.
