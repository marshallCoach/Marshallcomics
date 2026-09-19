# Source-of-truth update — visually verified cover characters

**New canonical file:** `attached_assets/comics_inventory_1108_1740.xlsx`
(supersedes `comics_inventory_1108_1200.xlsx`; gen_data auto-selects the newest.)

## What changed (minimal, additive only)
1. **Main inventory sheet renamed `✅ Clean Inventory …` → `Sheet X`.** Same 11,047 rows, same 45 original columns — untouched.
2. **New column on Sheet X: `Visually Verified Characters`** (column 46). Populated for **9,422** books.
3. **New tab: `Cover Characters`** — 10,112 rows: `Title, Issue, Volume, Publisher, Cover Artist, Visually Verified Characters, Confidence, Cover URL`.

## How the character data was produced
- Each book's **actual cover image** was analysed by Claude vision (Haiku 4.5) — not guessed from the title. 10,112 live covers, **97.6% identified**, 239 Unknown, 0 dead-link errors.
- Results were joined back to the inventory on **Title + Issue + Volume**, using the **Cover URL as a unique key** to recover the exact Volume and avoid same-issue/different-era mismatches.
- `Confidence`: 🟢 = character(s) identified from art, 🔴 = Unknown / non-comic cover.

## Data-integrity guarantees (validated)
- **Row count identical:** 11,048 (header + 11,047) in and out.
- **Original 45 columns byte-identical:** 0 cell differences vs the prior file (verified value-by-value).
- **All 18 original sheets preserved**; only the one column + one tab were added.
- Formula cells in `Est. Raw Value (VF) $` were **flattened to their computed values** so nothing nulls out on read.

## Known limitations (by design, to avoid contamination)
- Characters are filled on Sheet X **only where the cover URL maps to exactly one Volume** (~8,525 unambiguous). Volume-collision covers (same Title+Issue across eras sharing Vol 1 — e.g. modern Batgirl/Birds of Prey/Aquaman reprints) are **left blank on Sheet X** but still appear in the `Cover Characters` tab. Applying `volume_collision_fix.xlsx` will let these resolve cleanly.
- **`Cover Artist` comes from the existing inventory**, not the vision model (vision can't reliably identify an artist from art alone).
- Team/multi-character covers list all identified figures; a handful of modern/indie covers remain Unknown.

## Reingested
`node gen_data.mjs` ran against Sheet X → **11,047 comics, 76 boxes** written to the app data. gen_data now recognises the `Sheet X` name.
