# BRB Comics — Key Issue Classification Spec

Authored by Roberto Marshall. This is the **authoritative** definition of what
counts as a key issue in this inventory. Any tool or session that touches the
`Key Issue?` / `Key Issue — Why` columns must follow it.

Origin: `comics_inventory_0207_0130_VALIDATED.xlsx` — 1,363 confirmed keys of
11,126 rows. Built over multiple sessions; **human-verified**, not auto-derived.

> **Do NOT auto-classify without showing reasoning per book.** Being issue #1
> does not make a key. Being expensive does not make a key. Classification is
> about **SIGNIFICANCE, not price**.

---

## Tier 1 — ALWAYS KEY (flag YES, no debate)

1. **1st appearance of a character** — first time a named character appears in
   print. Flag the ISSUE, not the series. If the 1st appearance is #129, flag
   #129, not #1. _(ASM #361 1st full Carnage; Batman #656 1st full Damian
   Wayne; New Warriors #1 1st full team)_
2. **1st solo ongoing series for an established character** — previously in
   team books/supporting cast, now their own title. _(Black Lightning #1 1977,
   Falcon #1 1983, Storm #1, Alpha Flight #1)_
3. **Death or resurrection of a major character** — significant history
   required, not a throwaway. The issue where it occurs, not tie-ins.
4. **Creator signatures** — ANY book signed by its writer or artist is a key
   regardless of issue significance. The signature makes it unique. Independent
   of all other key status.
5. **CGC-graded copies** — a CGC submission number ⇒ key.
6. **Celebrity/actor signatures tied to adaptations** — e.g. Hayley Atwell on
   Captain Carter / Agent Carter. Adaptation link + signature = key.

## Tier 2 — LIKELY KEY (flag YES with note; verify if uncertain)

7. **Landmark anniversary issues** — #100/#200/#500/#1000 of a long run; 75th
   anniversary specials, 30th anniversary editions. Must have meaningful
   content, not a milestone number with filler. _(Flash #39 = 700th Flash
   issue; Fantastic Four #35 = 60th anniversary; Thunderbolts #150)_
8. **First issue of a critically acclaimed / culturally significant run** — not
   every #1. Must be (a) widely recognized as important, (b) by a writer with
   sustained critical acclaim, or (c) a representation milestone. _(Vision #1
   Tom King; Truth: Red White & Black #1; Mockingbird #1 Cain)_
9. **MCU/DCU speculation value** — character being adapted or rumored. MUST
   also have an inherent key quality. Never flag on speculation alone.
10. **Intercompany crossovers** — DC × Marvel, DC × Image, etc. _(WildC.A.T.s
    #3 Claremont/Lee)_
11. **1st issue of a continuity-reshaping event** — only where the outcome
    permanently changed the line. _(Secret Wars #1, Hickman)_
12. **Rare signed/remarked copies** — any WITNESSED remark = key. _(Kyle Baker
    remarked Truth: Red White & Black)_

## Tier 3 — CONTEXT-DEPENDENT (judgment; note reasoning)

13. **Later issues in a key run** — key ONLY IF (a) a specific landmark moment
    in that run, or (b) signed. _(Wolverine #66-72 Old Man Logan)_
14. **Multi-signature issues** — 2+ creators carries a premium beyond issue
    significance. Note all signers and count. _(New Mutants #96 TRIPLE-SIGNED:
    Liefeld, Larsen, McLeod)_
15. **Representation-first books** — first solo series / first major solo issue
    for an underrepresented character. Tier 2 #8 standard applies. _(Black
    Panther #1 Coates/Stelfreeze)_
16. **Low print run + high-grade scarcity** — must be verifiable, not assumed.
    _(Transformers #1 1984 — huge print run, scarce in NM)_

## NOT a key — disqualifiers

- **Being issue #1 alone.** Ask: *if this series had started at #47, would
  anyone care about this issue?* If no, not a key.
- **Being expensive on eBay.** Price follows keys; keys don't follow price.
- **Part of a popular run with no specific moment.** If you can't name why THIS
  issue matters, it's not a key.
- **Tie-in issues** that don't contain the main story beat.
- **FCBD issues** — promotional, no secondary significance unless they contain
  a genuine 1st appearance (then Tier 1 applies).

## Output format (per book)

```
Title: [Title] #[Issue]
Key Issue?: YES / NO
Key Issue — Why: [1-3 sentences using the tier framework]
  If YES: name the TIER + the specific qualifying fact
  If NO: one sentence on what's missing
Confidence: Certain / Likely / Guessing
```

## Critical rules — NON-NEGOTIABLE

1. Never flag a key because it "feels like" one. Every YES traces to a Tier 1-3
   criterion.
2. **Never change an existing key flag without showing** the row, current value,
   proposed value, and exact reason. **Do not batch-change key flags.**
3. `Guessing` ⇒ **NEEDS HUMAN REVIEW**. Never silently apply an uncertain call.
4. **Signed books are ALWAYS keys.** No exceptions, at any value.
5. `Key Issue — Why` must be specific to the ISSUE, not the series. "Great run"
   is not a reason.

## Volume disambiguation

Many titles span multiple volumes with the same name (Captain America has 9+).
Always confirm **which VOLUME**, **which WRITER**, and the **YEAR** before
applying a reason. A reason valid for Volume 1 does **not** carry to Volume 7.

---

## Tooling

- `brb_key_report.py` — standing report: keys ordered by value, threshold
  `--min` (default $8). Read-only; safe to re-run as the data tightens.
- Re-classification itself stays human-reviewed per rule 2 above; the report
  surfaces candidates, it does not change flags.
