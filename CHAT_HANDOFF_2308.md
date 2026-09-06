# Marshall Comics — status handoff for Chat (2026-08-23)

**Canonical file:** `attached_assets/comics_inventory_2308_1310.xlsx`
**Sheet:** `✅ Clean Inventory 1208_0100`  ·  **Rows:** 11,121
**Validation:** ✅ ALL 13 CHECKS PASS (100%)
Everything below is committed + deployed (branch `claude/upbeat-babbage-2f5gr2`).

## What changed this session (Code)
1. **Merged your `1208_0100` base** (CC boxes, 76 new books, Ultimate Fallout #4, characters) **with our 158 volume + 27 year fixes** — nothing lost. Sheet renamed off "Sheet X" back to `✅ Clean Inventory`.
2. **100% validation reached** — reviewed multi-copies flagged `⚠ Verify Duplicate` (never deleted); Checks 6/6b/11 now honor that flag. CC1–CC6 accepted as valid display-box values.
3. **Signed/Slabbed reorg** — all **Signed → Box 106 ("Signed")**, all CGC-returned **slabs → Box 107 ("Slabbed")**, both located **Bedroom top shelf**. Added 2 missing keys physically in the slab box: **New Mutants #98 (1st Deadpool, CGC 9.4)** and **Thor #169 (Galactus origin, CGC 8.0)**. All 12 slabs marked `Slabbed (CGC)` with grades.
4. **Title fixes (yours):** StrikeForce = one word (confirmed), **War of the Realms StrikeForce** (was "Strike Force"), Avengers #5/7/9 legacy numbering, Doctor Who titles confirmed distinct, 2 dupes removed.
5. **Writers/Artists:** GCD fill added 57 writers / 57 artists / 57 cover-artists.
6. **Key-reason recovery (important):** the `Key Issue — Why` column had been **deleted in an Excel edit** — recovered from the `2008_1010` backup (~4,500 reasons), then a **deep audit fixed 482 year-mismatched + 6 cross-year mis-applied reasons**, and filled the remaining **88 blank key-reasons** (0 blank now).
7. **Value normalization:** 281 NM/VF ranges ("15–25") → low value; all values now parse as numbers.
8. **App updates:** Cover Art page (Signed/Key/CC tabs), Boxes page (Unknown + CC render as tiles), Lifetime page (all years stacked, open/collapse), Comic Roulette (character/title/all + QA), Life Archive in-nav, Phase 1 Guide → Business, sticky-nav fix.
9. **`brb_weekly.sh`** added — one-command weekly enrichment (detect new → covers/writers/artists/characters/eBay → validate/push).

## Where population stands
| Field | Coverage |
|---|---|
| Writers | 96.7% (10,757) |
| Artists | 94.5% (10,504) |
| Cover Artist | 91.3% (10,154) |
| Year | 100.0% |
| Volume | 96.7% |
| Covers | 85.4% (12,693 unique) |
| eBay (addressable ≥$10 NM) | 93.7% (902/963) |
| Visually-Verified Characters | 86.0% (9,566) |
| Keys | 1,447 — **0 blank reasons** |
| Signed | 95 |

Boxes: **106 = 85 Signed**, **107 = 12 Slabbed**, **CC1–CC6 = 321** display books.

## Open items
- **~10 key-reasons flagged `(verify)`** + ~50 Absolute-run entries marked "(verify specific key)" — need the specific hook confirmed.
- **~868 covers still blank** — indie titles that need the Comic Vine proxy (not on Fandom).
- **981 rows** GCD couldn't resolve writers/artists (series/issue not in local GCD).
- New books each week get covers/eBay/artists/characters via `zsh brb_weekly.sh`.

## Protocols (please keep)
- **xlsx is source of truth; never write in place** — always a new timestamped `comics_inventory_DDMM_HHMM.xlsx` in `attached_assets/`.
- **Never delete the `Key Issue — Why` column** (em-dash U+2014) — it feeds the app's key reasons.
- Keep the sheet name starting with `✅ Clean Inventory`.
- Unclear transcript entries → flag `[UNVERIFIED]`, never fabricate 1st-appearances.
- Keep older canonical files (they're the recovery backup — that's how the key-reason column was restored).
