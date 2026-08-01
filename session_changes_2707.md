# BRB SESSION CHANGE MANIFEST — Code session, 2707 (attach comics_inventory_2707_1605.xlsx)
# Baseline: 10,855 rows -> current 10,914. Zero deletions. Validator: 3 of 13 fail (6/6b/11 = physical count).
# Cross-validate each line against the sheet. eBay prices now IN the xlsx eBay cols; covers in covers.json.

- [Volume/Year] Volume corrections (audit+collision+repair), year-anchored to Fandom (269)
    verify: Spot-check: Titans #19=Vol4, Trinity #1=Vol2, Flash 2023=Vol6, Cap Brubaker=Vol5  |  lives: xlsx Volume/Year cols
- [Titles] Punctuation splits normalized (Avengers vs. X-Men etc.) (9)
    verify: No 'Avengers Vs.' / 'Star Trek Generations' leftovers  |  lives: xlsx Title col
- [Duplicates] Cross-box dup rows flagged (non-destructive) (131 new / 278 total)
    verify: ⚠ Verify Duplicate column populated  |  lives: xlsx ⚠ Verify Duplicate
- [Boxes] Box 104 (DC Absolute) created; caps raised to long-box size (86 books)
    verify: Box Summary + Box Locations tabs; validator Check 5 passes  |  lives: xlsx Box Summary/Locations
- [eBay pricing] eBay median/avg/low/high/count merged from results JSON (~9,000)
    verify: This tab's parent sheet eBay cols now populated  |  lives: xlsx eBay cols (NEW)
- [eBay pricing] Wrong-issue inflated prices suppressed -> NM fallback (yr>=2000, non-key) (440)
    verify: Suppressed rows have blank eBay median; see price_gate_review.xlsx  |  lives: xlsx eBay median blanked
- [Covers] Cover coverage via CV + Fandom resolver (99.9%)
    verify: covers.json 13,488 entries; app overlay  |  lives: covers.json (NOT xlsx)
- [Row count] Stable throughout; no deletions (10,914)
    verify: Validator Check 2; tripwire never fired  |  lives: xlsx row count
- [Validation] Failing checks reduced (4 -> 3)
    verify: brb_validate.py: 6/6b/11 remain (physical count)  |  lives: brb_validate.py