// AUTO-GENERATED quest data — source: comics_inventory_FINAL_2509_1904.xlsx (11247 rows) · generated 2026-09-26
// Regenerate with: node gen_quest_data.mjs
window.QUEST_DATA = {
 "source": "comics_inventory_FINAL_2509_1904.xlsx",
 "generated": "2026-09-26",
 "totalRows": 11247,
 "dupe": {
  "groups": 143,
  "rows": 301,
  "excess": 158
 },
 "clone": {
  "groups": 127,
  "rows": 264,
  "excess": 137
 },
 "overCap": [],
 "boxes": [],
 "guide": [
  {
   "code": "0",
   "title": "Set Up Camp",
   "est": "5 min · once",
   "accent": "slate",
   "blurb": "Get the workspace and the right file in place before touching anything.",
   "sittings": [
    {
     "id": "s0",
     "title": "Camp setup",
     "est": "5 min",
     "steps": [
      {
       "id": "0.1",
       "text": "Print the guide (or keep this page open) where the comics live."
      },
      {
       "id": "0.2",
       "text": "Start a new Claude chat in the Comics Project."
      },
      {
       "id": "0.3",
       "text": "Paste the Session Start Block from the session doc."
      },
      {
       "id": "0.4",
       "text": "Attach the session doc (.md) and the inventory file (.xlsx)."
      },
      {
       "id": "0.5",
       "text": "Confirm the chat reads back 11,247 rows. If not — STOP, wrong file."
      }
     ]
    }
   ]
  },
  {
   "code": "A",
   "title": "The Clones",
   "est": "identical twin rows — safest wins first",
   "accent": "green",
   "blurb": "Rows that are exact copies of another row: same book, same box, logged twice. Live count: 127 clone groups / 137 excess rows. Highest confidence, lowest effort, biggest visible progress.",
   "sittings": [
    {
     "id": "A1",
     "title": "Sitting A1 — the audited boxes",
     "est": "~45 min",
     "steps": [
      {
       "id": "A1.1",
       "text": "Ask the chat for clone groups in Boxes 3, 7, 10, 43, 85 only."
      },
      {
       "id": "A1.2",
       "text": "Go to each box and count ONLY those clone titles (30 seconds each)."
      },
      {
       "id": "A1.3",
       "text": "Tell the chat each count: \"found 1 copy\" or \"found 2 copies.\""
      },
      {
       "id": "A1.4",
       "text": "Found 1 copy = approve the purge. Found 2 = it stays, both are real."
      },
      {
       "id": "A1.5",
       "text": "Chat runs dry-run first, then purge, then validator. Watch it confirm row count."
      },
      {
       "id": "A1.6",
       "text": "Done? Take the win. Duplicate count just dropped for real."
      }
     ]
    },
    {
     "id": "A2",
     "title": "Sitting A2 — next ~25 clone groups",
     "est": "~45 min",
     "steps": [
      {
       "id": "A2.1",
       "text": "Ask for the next 25 groups, sorted by box."
      },
      {
       "id": "A2.2",
       "text": "Same loop: go to box → count the title → report → approve or keep."
      },
      {
       "id": "A2.3",
       "text": "Validator after the batch. Row count must match prediction. Mismatch = STOP."
      }
     ]
    },
    {
     "id": "A3",
     "title": "Sitting A3 — final clone groups",
     "est": "~45 min",
     "steps": [
      {
       "id": "A3.1",
       "text": "Ask for all remaining groups."
      },
      {
       "id": "A3.2",
       "text": "Same loop. Last one. Clone problem = gone."
      },
      {
       "id": "A3.3",
       "text": "Log milestone: \"Phase A complete\" in the Integrity Log."
      }
     ]
    }
   ]
  },
  {
   "code": "B",
   "title": "The Sandwich Rows",
   "est": "books filed under the wrong box number",
   "accent": "gold",
   "blurb": "Rows where one book’s box number looks wrong because both its neighbors agree and it doesn’t — a known import glitch. ~72 rows per last audit (reconfirm live). Some are the glitch, some are real single placements. Never bulk-fix.",
   "sittings": [
    {
     "id": "B1",
     "title": "Sitting B1 — the named-bug rows",
     "est": "~40 min",
     "steps": [
      {
       "id": "B1.1",
       "text": "Ask the chat for sandwich rows matching KNOWN bug signatures (6↔87, 47↔88, 12↔86)."
      },
      {
       "id": "B1.2",
       "text": "Approve corrections for those — the bug pattern is already proven."
      },
      {
       "id": "B1.3",
       "text": "Validator + row count. Rows move boxes; total must NOT change."
      }
     ]
    },
    {
     "id": "B2",
     "title": "Sitting B2 — the unproven rows",
     "est": "~60 min",
     "steps": [
      {
       "id": "B2.1",
       "text": "Ask for the remaining sandwich rows, ~25 at a time."
      },
      {
       "id": "B2.2",
       "text": "For each: physically check which box the book is ACTUALLY in."
      },
      {
       "id": "B2.3",
       "text": "Report what you saw. Chat fixes only what you confirmed."
      },
      {
       "id": "B2.4",
       "text": "Ask the chat to cross-check fixes against the pre-import file (ALL_BOXES_2)."
      },
      {
       "id": "B2.5",
       "text": "Validator. Milestone log: \"Phase B complete.\""
      }
     ]
    }
   ]
  },
  {
   "code": "C",
   "title": "The Lost Books",
   "est": "real books, no known home",
   "accent": "purple",
   "blurb": "Books that exist but the data doesn’t know which box they’re in. ~247 per last audit (reconfirm live). Not duplicates — a treasure hunt. One title cluster per sitting.",
   "sittings": [
    {
     "id": "C1",
     "title": "Sitting C1 — the likely spot first",
     "est": "~30 min",
     "steps": [
      {
       "id": "C1.1",
       "text": "Print the hunt list (chat gives it grouped: DC / Image / Marvel / Skybound)."
      },
      {
       "id": "C1.2",
       "text": "Open Boxes 101, 102, 103 (Bedroom mid shelf — the NEW boxes)."
      },
      {
       "id": "C1.3",
       "text": "Tick off every hunt-list book you find in them."
      },
      {
       "id": "C1.4",
       "text": "Tell the chat: \"found these in 101/102/103\" — it assigns real box numbers."
      },
      {
       "id": "C1.5",
       "text": "Validator. UNKNOWN count drops. Log the new number."
      }
     ]
    },
    {
     "id": "C2",
     "title": "Sittings C2–C7 — one cluster at a time",
     "est": "~30 min each",
     "steps": [
      {
       "id": "C2",
       "text": "Hunt cluster: The Magic Order (18 books)."
      },
      {
       "id": "C3",
       "text": "Hunt cluster: Absolute titles — Wonder Woman, Flash, Green Lantern (41 books)."
      },
      {
       "id": "C4",
       "text": "Hunt cluster: G.I. Joe + Transformers + Void Rivals (39 books)."
      },
      {
       "id": "C5",
       "text": "Hunt everything left, smallest clusters last."
      },
      {
       "id": "C6",
       "text": "Can’t find a book anywhere? Leave it UNKNOWN + note \"hunted [date].\" Never force it."
      },
      {
       "id": "C7",
       "text": "Special: Avengers #0 (2017) — compare in hand against Box 50 (2012) and Box 24 (2015) copies."
      }
     ]
    }
   ]
  },
  {
   "code": "D",
   "title": "Small Cleanups",
   "est": "the last two fingerprints",
   "accent": "slate",
   "blurb": "Low urgency. Do these when a sitting has 15 spare minutes.",
   "sittings": [
    {
     "id": "D",
     "title": "Cleanups",
     "est": "15 min each",
     "steps": [
      {
       "id": "D1",
       "text": "161 rows missing Date Added: ask the chat to backfill from row-# neighbors where provable, flag the rest."
      },
      {
       "id": "D2",
       "text": "~120 May-24 rows missing Writer: confirm the overnight fill run covered them; queue the leftovers."
      }
     ]
    }
   ]
  },
  {
   "code": "E",
   "title": "The Final Gate",
   "est": "declare victory properly",
   "accent": "red",
   "blurb": "When every fingerprint is resolved, close it out cleanly so the win is permanent.",
   "sittings": [
    {
     "id": "E",
     "title": "Final gate",
     "est": "one session",
     "steps": [
      {
       "id": "E1",
       "text": "Run the full validator one last time."
      },
      {
       "id": "E2",
       "text": "Every check passes OR every failure has a written accepted-reason."
      },
      {
       "id": "E3",
       "text": "Save as a new VALIDATED file with today’s timestamp."
      },
      {
       "id": "E4",
       "text": "Add the Integrity Log entry: \"Data confidence achieved — all fingerprints resolved.\""
      },
      {
       "id": "E5",
       "text": "Rebase BOTH sessions (Chat + Code) on the new file."
      },
      {
       "id": "E6",
       "text": "Go list the eBay Phase 1 books. The data is no longer the excuse."
      }
     ]
    }
   ]
  }
 ],
 "tripwires": [
  "Row count moved by a number nobody predicted → STOP, ask for a diff.",
  "Duplicate count went UP after a purge → STOP.",
  "A box total jumped ±10 that wasn’t part of the batch → STOP.",
  "A check that passed before now fails → STOP.",
  "Two runs disagree on the same file → demand the row-level diff, never a theory."
 ]
};
