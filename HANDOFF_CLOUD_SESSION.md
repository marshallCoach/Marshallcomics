# Marshall Comics — Cloud Session Handoff

_Updated 2026-09-02 10:56 · branch `claude/upbeat-babbage-2f5gr2`. Current canonical: **`comics_inventory_0209_1056.xlsx`** (11,176 rows, 100% validation)._

### Latest updates (2026-09-02, after the first handoff was written)
- **More user-sourced title corrections applied** (each backed by a Fandom/eBay/Google-Books ref the user supplied): `GODS`→`G.O.D.S.`; `Fantastic Four: Empyre #0`→`Empyre: Fantastic Four` and `#1/#2`→`Empyre`; `Doom Patrol and Suicide Squad`→`…Special`; `Generations: The Best`→`Generations: Wolverine & All-New Wolverine`; `Nova: Annihilation Conquest`→`Nova` (Vol 4); `Star Trek: La'an — Law of War`→`Star Trek: Lore War`; `The Vision and Scarlet Witch`→`Vision and the Scarlet Witch` (Vol 3); `What If? Magic`→`What If? Magik`; `New Warriors: Giant-Size Spectacular` (mis-dated 1994)→`New Warriors` Vol 2, **year corrected to 1999** (per CGC label). Applied via `brb_apply_sourced_titles.py`, `brb_fix_gods_empyre.py`. Notes cleared on each; the cross-box copies these created (Doom Patrol Special ×2, Empyre #1/#2 in box 19 + box 75) were flagged `⚠ Verify Duplicate`, not deleted.
- `Alien vs. Captain America` (singular) confirmed correct; `Aliens vs. Avengers` flags integrated/cleared.
- **Cover fill was stopped mid-run** (it was slow & low-yield — correctly rejecting ambiguous CV matches for titles like "Die"/"Black"). `covers.json` holds whatever partial fills landed. **To resume:** `python3 brb_cv_covers.py` (non-M/DC empties via proxy) then `python3 brb_cover_yeargate.py` (M/DC empties) then `python3 brb_refetch_incorrect.py` (the 3 flagged incorrect covers), then regen — see `/tmp/covers_bg.log` for where it stopped (~[61/154]).

### Still open / needs the user
- **eBay link `ebay.com/p/10056914342`** resolved to New Warriors v2 #1 (done). Any future eBay refs: WebFetch times out on eBay — ask the user for a screenshot.
- Unverified titles with no authoritative source yet: `AW: Origins`, `Bloodhunt: Dracula`, `Fantastic 4 in 12 Time` (×4), `King-Size Cable`, `Legend Has It...`. Keep the `check title` flag; don't guess.
- Confirm whether the Empyre #1/#2 (box 75) and Doom Patrol Special (box 72) really are second physical copies or should be deduped — currently flagged reviewed.

Paste this whole file into the new cloud session's first message. It carries the
project state, the non-negotiable rules, the hard-won gotchas, and the open
worklist — so you continue with zero loss of context, savvy, or attitude.

---

## 0. Who you are here
You are Claude Code maintaining Robert's (blackreadbrown) ~11,000-book comic
collection: a React/TS single-page app in `artifacts/comics-inventory/` over a
Python/Node data pipeline sourced from ONE canonical `.xlsx`. Ship real fixes,
verify them, tell the truth about what passed and what didn't. Be terse, decisive,
and protective of the data. The xlsx is the user's physical inventory — a wrong
auto-edit misrepresents a real shelf, so investigate before mutating and never
fabricate a title, key, or first-appearance.

## 1. Resume basics
- **Repo:** `/Users/robertmarshall/Marshallcomics` (git). **Branch:** `claude/upbeat-babbage-2f5gr2` (the validator-authoritative branch — don't cross-merge other branches without being told).
- **Canonical inventory:** exactly ONE `attached_assets/comics_inventory_DDMM_HHMM.xlsx`. As of this handoff: **`comics_inventory_0209_1029.xlsx`** (11,176 rows). Older canonicals live in the repo ROOT as backups (they once enabled column recovery — keep them).
- **App:** `artifacts/comics-inventory/`; GitHub Pages auto-deploys on push; base path `/Marshallcomics/`. Dev server: `.claude/launch.json` name `comics-inventory` (vite :5173). There's a `PasswordGate`; to preview locally set `sessionStorage.mc_auth="1"` and reload (don't type the password).
- **Pipeline:** xlsx → `node gen_data.mjs` → `artifacts/comics-inventory/src/data/data3.ts` + `public/covers.json` + `public/quest-data.js`; `python3 build_comic_roulette.py` → `public/comic_roulette.json`. Validate with `python3 brb_validate.py` (13 checks; hard-stops only on STRUCTURAL failures). `python3 brb.py --yes` reingests; add `--commit "msg"` to push.
- **After any xlsx change:** validate → `gen_data.mjs` → `build_comic_roulette.py` → commit the regenerated `data3.ts` / `public/*` (the xlsx itself is git-ignored, so it is NOT committed — only its derived outputs are).

## 2. Non-negotiable rules (these override defaults)
1. **xlsx is the source of truth; never write it in place.** Every data script reads the newest canonical and writes a NEW timestamped `comics_inventory_DDMM_HHMM.xlsx`, then you `mv` older ones to the repo root as backups so `attached_assets/` holds exactly ONE.
2. **Never handle credentials.** `COMIC_VINE_API_KEY`, `EBAY_APP_ID/EBAY_CERT_ID`, `ANTHROPIC_API_KEY` are the user's. You MAY call the already-running local Comic Vine proxy on `:5001` (it holds the key) — endpoint `http://localhost:5001/api/covers/search?title=&issue=&volume=&refresh=1` (refresh=1 forces a live lookup past cached misses; read `match.volume_name`; the proxy writes covers.json itself). You may NOT start credentialed servers or run eBay/vision credentialed steps — hand those to the user.
3. **Never delete the "Key Issue — Why" column** (em-dash U+2014) — it feeds the app's key reasons. Its accidental deletion once blanked every key reason; watch `gen_data` for a "Missing column" warning.
4. **Sheet name starts with `✅ Clean Inventory`.** All scripts select it via `w.title.startswith("✅ Clean Inventory")`.
5. **git pull --rebase before push.** Commits end with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.
6. **Flag uncertain data `(verify)` / `[UNVERIFIED]`; never fabricate.** A fabrication incident is logged in the Data Integrity Log tab.
7. **Always check Volume.** Title+Issue+Year is NOT a unique book — include Volume in every dup/pricing/cover comparison.
8. **Verify before stating.** Run the query, show the output, then conclude. The older/smaller file is never assumed current.
9. **Validation to 100%:** duplicate-participating rows are marked `⚠ Verify Duplicate` (any non-blank value = "human reviewed"); CC display boxes match `CC\d+` and are accepted in Check 9; `DUPLICATE — see row N` box pointers accepted. New comics/merges re-introduce unflagged dupes — re-run the flagging each time.

## 3. Hard-won gotchas (do not relearn these the hard way)
- **openpyxl `ws.cell(r,c,None)` is a GETTER, not a clear.** It silently no-ops. To clear a cell use `ws.cell(r,c).value = None`. (This bug silently skipped ~140 note-clears this session before it was caught.)
- **Flatten formulas before editing.** openpyxl drops cached formula values on save, which nulls the VF-value formula column. Standard pattern: read once with `data_only=True` to get `cached` values, load the workbook again (formulas), replace any `cell.value.startswith("=")` with the cached value, THEN edit. See `brb_apply_volume_fix.py` as the reference implementation, and always run a "contamination check" (only intended columns differ).
- **Finder `… copy.xlsx` files are a trap.** ~35 pipeline scripts pick the newest `comics_inventory_*.xlsx` by mtime and only skip `~$` Excel lock files — a Finder ` copy.xlsx` (newer mtime) would silently become canonical. The user delivers edits this way. When you see one, diff it against the current canonical, then PROMOTE it to a proper DDMM_HHMM name (don't just skip it). `build_comic_roulette.py` also skips ` copy`.
- **The user annotates an "Issue Note" column** with a to-do list: `check title`, `incorrect cover`, `check dupe`, plus in-place Title corrections and rich variant/provenance notes ("Peach Momoko cover", "PULLED COVER — display copy"). Most cover notes are DESCRIPTIVE metadata, not fix requests — only `incorrect cover` means "the image is wrong."
- **GitHub Pages needs code+data committed together.** e.g. `ComicRoulette.tsx` expecting a new `comic_roulette.json` shape will break the live app if the JSON isn't in the same push.
- **The in-app browser denies `localhost` until `preview_start` attaches** — start the dev server via the browser tool, not Bash. `git push` often prints a benign "your index contains uncommitted changes" from the pre-push rebase; the push still lands (check `HEAD == @{u}`).

## 4. Data status (2026-09-02)
- Canonical **`comics_inventory_0209_1029.xlsx`**, **11,176 rows, 100% validation (all 13 checks).**
- Fill rates: Writers 96.2% · Artists 94.0% · Cover Artist 90.9% · Volume 96.2% · Year 100% · Cover Images 85.8% (12,793/14,909 unique title/issue) · eBay addressable 93.6% (901/963 books with NM ≥ $10) · eBay json 996/1,008.
- A background cover-fill was running at handoff time (`/tmp/covers_bg.log`): non-Marvel/DC empties via CV proxy → Marvel/DC empties via Fandom yeargate → refetch of the 3 `incorrect cover` DC books → regen. ~144 books had no cover match before it ran. **Check that log, then commit the regenerated `covers.json` + `data3.ts` + `comic_roulette.json` if it finished cleanly.**

## 5. What was done this session
**App (all live):**
- Unified the cover-flag system into one `src/lib/coverFlags.ts` (single store `brbFlaggedCovers_v1`, tolerant reader that migrates the old array-vs-object split, one writer that emits a live event). Cover modal, Cover Art catalog, and Cover Review all use it; added a live **🚩 flagged counter** in the top header (`components/FlaggedCount.tsx`) — increments the instant any cover is flagged anywhere. Deferred the change-event to a microtask so a write inside a React setState updater can't setState a subscriber mid-render.
- Removed the cover modal's OLD per-cover "Note to Claude / Copy for Claude" export — it now only flags the cover (the field-update note flow still lives in `ComicDrawer`).
- Comic Roulette: fixed "wrong covers after the first" (a character was tagged on hundreds of ensemble covers) by recording each cover's cast size `n` in `build_comic_roulette.py` and preferring small-cast/solo covers. Fixed "jumps back to home at the bottom" — a spin unmounted the result panel, collapsing the page and slamming scroll to top; the panel now stays mounted (dimmed) while spinning.

**Data:**
- Discovered the user's ` copy.xlsx` held 190 review edits; promoted it, then actioned the flags across several validated canonicals ending at `0209_1029`: 25 title corrections applied (Blood Hunt spellings, `&` forms, `Stargate Universe`, `Iron Age: Alpha`, `The Terrifics`, `Icon & Rocket: Season One`, `G.I. Joe: A Real American Hero` dropping "— MIA", Darkseid War reformat, etc.); removed 2 confirmed true-duplicate rows (Aliens vs. Avengers #1 2024; Fantastic Four: Empyre #0 2020); cleared ~140 GCD-verified + 1 CV-verified `check title` notes. Reports: `FLAGS_ACTION_LOG.md`, `CV_VERIFY_LOG.md`.
- Verification tooling: `gcd_local.sqlite` (6,289 pre-matched series — offline title check); the CV proxy for live lookups. New scripts this session: `brb_action_flags.py`, `brb_apply_renames.py`, `brb_renames_and_dupes.py`, `brb_clear_verified_notes.py`, `brb_cv_verify_flags.py`, `brb_apply_formatting.py`, `brb_refetch_incorrect.py`.

## 6. Open items / next steps
1. **Covers (in flight):** confirm `/tmp/covers_bg.log` ended with `COVERS_BG_DONE`, then commit the regenerated covers. Any empties CV/Fandom couldn't fill are genuinely obscure — leave blank, don't fabricate.
2. **~31 CV rename proposals** (`CV_VERIFY_LOG.md`) — mostly noise (wrong CV matches like `Chadwick Boseman: Rest in Power`→`Rest`, `GODS`→`Gods of Kennar`). Only apply ones that are genuine reformattings of the SAME book; the user's shorthand titles (`Fantastic 4 in 12 Time`) need his eyes.
3. **~30 titles GCD+CV can't verify** — obscure minis/facsimiles/personal shorthand. Keep the `check title` flag; don't guess.
4. **Variant covers:** 150+ "Issue Note" rows describe specific variants the user physically owns (artist named). covers.json shows the MAIN cover for these. Matching the exact variant is a real project (parse note → CV variant search or the vision pipeline `brb_vision_*`), NOT a quick auto-fetch — scope it explicitly before touching, and never overwrite a good cover with a guessed variant.
5. **Duplicates:** ~95 same-box duplicate groups remain, mostly genuine distinct copies (marked reviewed) — not safe to bulk-purge. Only remove on the user's explicit "true dupe" confirmation, keeping the lower-numbered twin.
6. **Weekly flow:** the user adds new comics weekly; `brb_weekly.sh` chains detect→covers→artists/characters→eBay→validate→commit (credentialed steps run only if the keys/proxy are present, which the user provides).

## 7. Upcoming physical deadlines
Terrificon was ~2026-08-07/09 (past). NYCC 2026-10-08/11 (Absolute Batman, Jim Lee signature pack, Miller/Wolverine #8 sequencing). Highest-value assets to protect in any box move: Uncanny X-Men #141/142 (Days of Future Past), Ultimate Fallout #4 (foil — "highest-value discovery of the project"), Action Comics #521 (1st Vixen, CGC 8.5).

## 8. Attitude
Terse and concrete. Show the command output, then the conclusion — never "should be fixed." When the data is ambiguous (a rename that drops detail, a maybe-dupe), surface it as a crisp decision for the user instead of guessing — but when there's a sensible default, take it and say so. Protect the inventory like it's a real shelf, because it is.
