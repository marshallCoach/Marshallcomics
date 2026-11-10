# Gemini prompt — weekly intake CSV from a transcription

Paste everything between the lines into Gemini, then paste your transcription at the end.

---

You convert my spoken/written transcription of this week's comic pickup into ONE CSV file that my inventory script imports. Accuracy beats completeness: **never guess — leave a field blank if it isn't in the transcription or printed on the cover.**

**Output:** only the CSV inside a single code block, then (outside the block) a short "CHECK" list of anything uncertain. File name: `intake_YYYY-MM-DD.csv` (today's date).

**Header — exactly this, in this order:**
```
title,issue,year,volume,publisher,box,era,writer,artist,cover_artist,cover_price,condition,imprint,seller_notes
```

**Rules, field by field**
- **One row per physical copy.** Two copies of the same book = two rows.
- **title** — series name as on the cover. No issue number, no "Vol.", no variant wording. Annuals/specials go in the title (`Batman Annual`, `X-Men Giant-Size`).
- **issue** — the number only, no `#`. (`1`, `25`, `0`, `1.MU` as printed.)
- **year** — the cover year, 4 digits. New releases this week = this year. **Back issues = their original cover year** (e.g. a 1993 book bought today is `1993`).
- **volume** — only if stated or certain; otherwise blank.
- **publisher** — `Marvel`, `DC`, `Image`, `BOOM! Studios`, `IDW`, `Dark Horse`, `Titan Comics`, etc.
- **box** — new regular books: DC → `101`, Marvel → `102`, everything else → `103`.
  Bought for the cover (cover-buy): Marvel → `CC1`, DC → `CC5`, other → `103`.
  If you can't tell whether it's a cover-buy, use the regular box and add `CHECK: cover-buy?` to seller_notes.
- **era** — `Modern` 1992+, `Copper` 1985–1991, `Bronze` 1970–1984, `Silver` 1956–1969, `Golden` before 1956.
- **writer / artist / cover_artist** — only if said or printed. Multiple names joined with ` & `.
- **cover_price** — as printed, no `$` (e.g. `4.99`).
- **condition** — blank unless I state it (e.g. `NM (9.4)`).
- **imprint** — only when it applies: `Black Label`, `Absolute`, `Ultimate`, `Skybound`, etc.
- **seller_notes** — variant details (`Cover A`, `Cover B Artist Name variant`, `1:25 ratio`), colorist (`Colorist: Name`), anything else worth keeping, and any `CHECK: …` flags.

**CSV formatting**
- Wrap any field containing a comma or a double quote in double quotes; double any internal quotes (`"He said ""hi"""`).
- No blank lines, no trailing commentary inside the code block.

**Then:** list each `CHECK` item in one line so I can fix it before importing.

TRANSCRIPTION:
[paste here]

---

## On the Mac
1. Save Gemini's CSV as `~/Downloads/intake_YYYY-MM-DD.csv`
2. `python3 brb_all.py` — step 1 imports it.
