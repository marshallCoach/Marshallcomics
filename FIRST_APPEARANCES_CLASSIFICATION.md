# BRB Comics — First Appearances & Key Notes Classification Spec

Companion to [`KEY_CLASSIFICATION.md`](KEY_CLASSIFICATION.md). Defines how the
`1st Appearances` and `Key Issue — Why` fields are researched and written.

Source: `comics_inventory_0207_0130_VALIDATED.xlsx` — 277 rows with 1st
Appearances, 1,363 total keys.

> First-appearance data was **NOT auto-generated from a database.** It came from
> a layered research method. Any tool must follow the same order.

---

## Research order (authoritative)

1. **Comic Vine API — PRIMARY.** Character pages carry structured first-appearance
   data: `https://comicvine.gamespot.com/character/[slug]/` → issue title, number,
   year. Most reliable; use first.
2. **Marvel Fandom** — `https://marvel.fandom.com/wiki/[Character_Name]`; infobox /
   History lists "First Appearance". Cross-reference against Comic Vine.
3. **DC Fandom** — `https://dc.fandom.com/wiki/[Character_Name]`; same structure.
   Also check the main DC site.
4. **Manual cross-reference.** When sources disagree — cameo vs. full is the common
   dispute — flag **NEEDS VERIFY** rather than guessing:
   - **1st cameo** = appears but unnamed, out of costume, or fleeting
   - **1st full appearance** = primary form, named, with agency
   - **1st named appearance** = named but not physically present

   Always record *which type* in the field.

## Per-issue research procedure

```
1. IDENTIFY characters in the issue  (Comic Vine issue page -> character credits)
2. FOR EACH character, check if this issue is their first appearance
   (Comic Vine character page -> "First Appearance" field)
3. CLASSIFY the type: cameo / full / named-only / concept introduction
4. CROSS-REFERENCE Marvel or DC Fandom
     agree    -> Certain
     disagree -> NEEDS VERIFY, note the discrepancy
5. CHECK for retroactive / proto appearances — note but do not overstate
6. WRITE the field: "[Type] [Character]" e.g. "1st full Carnage (Cletus Kasady)"
   multiple -> semicolons;  uncertain -> prefix "Verify — possible 1st [X]"
```

## The `1st Appearances` field — what belongs in it

It is **not** only for literal first appearances. It captures **any significant
character/concept moment in the issue** — effectively "what happens here that
matters". Plain English, short phrases, semicolon-separated.

1. **True first appearances** — `1st full Damian Wayne` · `1st cameo Miles Morales (partial)` ·
   `1st Carnage (Cletus Kasady bonded with Venom symbiote)` · `1st Puck; 1st Marrina; 1st Vindicator (Heather Hudson)`
2. **First solo series moments** — `1st solo Falcon series` · `1st solo Storm ongoing series`
3. **Major character moments (events, not appearances)** — `Cap lifts Mjolnir (brief lift)` ·
   `Death of Superman begins` · `Damian Wayne death — Requiem issue` · `1st black costume Spider-Man (symbiote origin)`
4. **Creative/historical notes** — `Jim Lee final major UXM story arc before X-Men #1` ·
   `Travis Charest art — rare; artist left comics shortly after`
5. **Signature/authentication notes** — `Stan Lee signature; Dynamic Forces COA` ·
   `Triple signature: Liefeld, Larsen, McLeod` · `Kyle Baker WITNESSED remark — original artwork added in person`
6. **Spec/adaptation notes** — `1st Isaiah Bradley; basis for Falcon & Winter Soldier` ·
   `Basis for 2026 DC film; King's best DC work`

**Leave BLANK when:** the key is for run significance only · the key reason is
purely a signed copy with no additional event · the issue continues an arc with
no milestone of its own.

## `Key Issue — Why` — the seven observed patterns

| # | Pattern | Keys | Shape |
|---|---|---|---|
| 1 | **Run significance** (most common) | 183 | `[Writer]'s [adjective] [title] run — [why it matters]` |
| 2 | **MCU/DCU adaptation** | 131 | `[standard key reason]; [adaptation note]` — only when the issue **also** has independent key status |
| 3 | **Variant/cover significance** | 90 | covers with genuine collector demand — not every variant |
| 4 | **Anniversary/milestone** | 145 | `Detective Comics #1000 — landmark 80-year anniversary; 96 pages` |
| 5 | **Crossover/event** | 69 | `Rare intercompany DC crossover one-shot; low print run` |
| 6 | **Signature keys** | 42 | who signed · context (private/witnessed/COA/personalized) · any independent key reason |
| 7 | **Death/major event** | 38 | `Death of the Family begins — Joker returns with cut-off face` |

> **Never** flag a book as key *solely* because its character appeared in a movie.

## Calibration cases

- **Cameo vs. full** — New Mutants **#87** = 1st cameo Deadpool; **#98** = 1st *full*
  Deadpool. Both keys; #98 is worth more and is "the" key.
- **Team firsts** — New Warriors #1 (1990) = `1st full New Warriors team`. NOT 1st
  Night Thrasher / Firestar (both appeared earlier). The *team* is the first.
- **Concept introductions** — Immortal Hulk #1: concept introduced, not a character
  first. Legitimate, but lower tier than a true character first.
- **Relaunch as "first"** — Miles Morales' true 1st is Ultimate Fallout #4. Ultimate
  Comics Spider-Man #1 is `1st solo Miles ongoing`. Different kind of first; both keys.
- **Multiple significances in one issue** — note them all, semicolon-separated.

## Confidence levels

- **Certain** — Comic Vine + Fandom agree and the issue description confirms prominence.
- **Likely** — one source confirms, the other is silent/ambiguous; plausible on timeline.
- **Guessing** — neither explicitly lists it. **ALWAYS flag NEEDS VERIFY.** Never apply silently.

## What NOT to do

1. Don't use "1st appearance" loosely — an unnamed background walk-on is not a first appearance.
2. **Never copy first-appearance data from eBay listings** — sellers routinely misattribute to inflate price. Always trace to Comic Vine or the publisher wiki.
3. Don't claim a first for a character who merely *looks like* another. Protos, homages, easter eggs are not firsts.
4. Don't populate the field for every key — blank is correct for run/anniversary/signature keys with no character moment.
5. Don't confuse **first appearance** with **first cover**. The in-story appearance is what matters.

## Output format

```
Title: [Title] #[Issue] ([Year])
1st Appearances: [value or BLANK]
  If populated: [Type] [Character/Concept] — [one sentence context]
  If blank: "No first appearance — key for [run/signature/anniversary/other]"
Key Issue — Why: [explanation using the pattern shapes above]
Confidence: [Certain/Likely/Guessing]
Sources checked:
  - Comic Vine: [URL or "not found"]
  - Marvel/DC Fandom: [URL or "not found"]
  - Conflict: [yes/no — describe]
Needs human review: [yes/no — specific question]
```

---

## Implementation note (Code)

The earlier plan to mine issue-page `{{1st}}` wikitext markers is **secondary** to
this spec. The prescribed path is character-first:

1. Comic Vine **issue** page → character credits (who appears)
2. Comic Vine **character** page → `First Appearance` field
3. Match against the row's Title + Issue + Year
4. Cross-reference Fandom → Certain / Likely / NEEDS VERIFY

This is a per-character lookup, so it is a long job and rate-limited by Comic
Vine — an overnight run, not interactive. Nothing may be written to
`1st Appearances` or `Key Issue?` without human approval
(`KEY_CLASSIFICATION.md` rules 2 and 3).
