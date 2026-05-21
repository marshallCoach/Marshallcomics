# MARSHALL COMICS — REPLIT BUILD PROMPT
## The Holy Grail: Interactive Box View + Full Collection Hub

**Give Replit this exact prompt, then paste the JSON data from `marshall_comics_data.json`**

---

## THE PROMPT

```
Build me an interactive comics collection hub called "Marshall Comics" for robertmarshall.com.

The app has a dark theme with gold accents (#C8960C gold, #1F3864 navy, #C00000 red, white text). 
Header: "MARSHALL COMICS" logo left, stats bar showing total comics / boxes / keys / signed (live updating).

The data is in the attached JSON array. Each object is one physical longbox with these fields:
- box: number, label: string, subtitle: string, color: hex, session: string, alert: string
- total: comic count, keys: key issue count, signed: signed book count, dups: duplicate count
- year_start / year_end: era span, dominant_pub: Marvel/DC/Mixed
- top_keys: array of {title, issue, raw, why, signed, cgc}
- signed_books: array of {title, issue, by}
- top_writers: {name: count}
- top_crossovers: {event: count}
- first_comic / last_comic: {title, issue}
- comics_sample: full array of every comic in the box

---

## SECTION 1: INVENTORY TAB (default view)

### The Box Grid
Display all 43 boxes as a responsive grid (4 columns desktop, 2 mobile).
Each box is a card with:
- Large box number (BOX 01) in the box's colour
- Label and subtitle
- Mini stats: [comics] [keys] [signed]
- Year range badge
- If alert field is set: pulse a warning border (red for 🚨, gold for ⭐)
- Session badge in corner (Original / May 17 / May 18 [AB] / May 19 / May 20)

On click: expand to a FULL BOX DETAIL PANEL (slide in from right or modal):

### Box Detail Panel
- Hero header with box colour, number, label, alert banner if set
- Stats row: Total comics | Keys | Signed | Duplicates | Era span
- SPINE VISUALISER: render every comic in comics_sample as a thin vertical spine bar (like the screenshot). 
  - Colour each spine by publisher (Marvel=red, DC=blue, Image=green, other=grey)
  - Taller gold top cap = key issue
  - Green left edge = signed book  
  - Click a spine: show tooltip with title, issue, key_why, raw_nm, signed_by
  - Hover effect: spine brightens, shows book title above it
  - "BY RUN" toggle: group spines by title (each run gets a colour block)
  - "BOX ORDER" button: sort back to physical order
- Top Keys list (show all keys, not just top 8)
- Signed Books list with signer names
- Top Writers bar chart (mini horizontal bars)
- Crossover events badges

---

## SECTION 2: BUSINESS TAB

Sub-tabs: CALENDAR | SHOWS | TIMELINE | CGC | SIGNINGS | ACTION PLAN

### CALENDAR
Display the 31 Whatnot shows + Terrificon + NYCC as a calendar grid (June-December 2026).
Colour code: Whatnot=navy, Terrificon=gold, NYCC=purple, Juneteenth=red.
Each event clickable: show theme, anchor book, revenue target.

### SHOWS (Whatnot Show Planner)
List all 31 shows as cards with: theme, anchor book, supporting books, revenue target.
Progress tracker: how many shows completed (0/31 to start).
Revenue tracker: shows a running total vs $14,000 base case target.
Each show has a "Mark Complete" button + revenue input field.

### TIMELINE (Collection Value)  
Horizontal timeline showing the collection journey:
- Raw value today: $28K-52K
- Post-CGC 18 months: $60K-90K  
- Stan Lee authenticated: +$800-1,500
- Wolverine #8 Terrificon: +$500-700
- Batman #656 CGC: +$350-500
- Roy Thomas SS (5 books): +$820-1,630
Interactive: hover each milestone to see the logic.

### CGC PRIORITY QUEUE
20-row table: book | box | label type | press cost | CGC cost | expected return | ROI multiplier | status.
Sort by ROI. Status dropdown: Not Started / Pressed / Submitted / Returned.
Colour code by label: Yellow SS=gold, Green Qualified=green, Blue Universal=blue.
Key numbers at top: Total invested | Total expected return | Net projected gain.

### SIGNINGS (CGC Private Signings tracker)
Cards for each open signing with countdown timer to deadline:
- 🚨 Jorge Jiménez — Batman #125 — EXPIRED (June 5)
- 🚨 Geoff Johns + Fabok — June 26
- ⭐ Roy Thomas — July 10 — SUBMITTED
- ⭐ Mike Mayhew — July 10
- 👀 Watching: Pepe Larraz, Snyder+Dragotta, Bagley, Skottie Young
Terrificon section: guest list table (47 creators) with "Bring book?" toggle + book name input.

### ACTION PLAN
Kanban board with columns: THIS WEEK | NEXT 2 WEEKS | BEFORE TERRIFICON | ONGOING
Pre-populated with all tasks. Drag and drop. Each card has: task, book, deadline, priority.

---

## SECTION 3: BOX VIEW (as shown in screenshot — make it richer)

The main Box View you already have is great. Enhance it:

1. **Filter bar above the grid**: filter by session | publisher | has keys | has signed | has alert
2. **Sort controls**: by box number | by key count | by comic count | by session date
3. **Search box**: type a title and matching boxes highlight with a pulse animation
4. **"KEY HUNT MODE" button**: when activated, the spine visualiser shows ONLY key issues across ALL boxes simultaneously (one long shelf view). Each key spine shows the box number on hover.
5. **Collection Stats sidebar** (collapsible):
   - Pie chart: Marvel vs DC vs Indie split
   - Bar chart: comics per session (how many added each day)
   - Top 10 writers by issue count
   - Complete runs badge wall (scrollable list of 🎉 COMPLETE labels)
6. **Box comparison mode**: select 2 boxes, see side-by-side stats
7. **"Terrificon Targets" quick view**: one click shows all ⭐ flagged books across all boxes

---

## VISUAL DETAILS

- Spine visualiser: minimum 2px wide, max 6px, height proportional to raw_nm value (capped at 150px)
- Keys get a gold shimmer animation on hover
- Signed books get a green pulse on hover  
- Alert boxes (🚨 UNBAGGED) get a red breathing border animation
- When you hover a spine and it's BOTH key AND signed: show a dual gold+green gradient
- Dark background (#0D0D0D), box cards have a subtle grain texture
- Transitions: 200ms ease for most, 400ms for panel slides
- The collection count in the header should count UP with a number animation on first load

---

## DATA NOTES

- 43 boxes, 5,804 comics, 824 keys, 131 signed books
- Box 02 is the most important: contains all 131 signed books
- Box 08 has an urgent alert: ALL UNBAGGED before Terrificon Aug 7
- Boxes 17-29 are marked [AB] (ALL_BOXES import) — treat as one set
- Box 42 contains a newly discovered signed book: ASM #27 signed by Dan Slott
- Exiles #1-55 is now COMPLETE (found the missing #23 in Box 42 extras!)
- Supergirl: WoT #2-8 found in Box 43 — combines with signed #1 in Box 02 for COMPLETE run

---

The tone is: serious collector meets proud archivist meets Whatnot content creator. 
This isn't just inventory software. It's a collection showcase.
Make it look like it belongs on a high-end comics dealer's website.
```

---

## HOW TO USE

1. Create a new Replit project (React + Vite recommended)
2. Paste the prompt above into your AI assistant in Replit
3. When asked for data, paste the contents of `marshall_comics_data.json`
4. The JSON contains the full collection — every book, every box, all metadata

## DATA STRUCTURE (quick reference)

```json
[
  {
    "box": 1,
    "label": "DC Mix",
    "subtitle": "Batman / Nightwing / Doom Patrol",
    "color": "#1F3864",
    "session": "Original",
    "alert": "",
    "total": 15,
    "keys": 4,
    "signed": 0,
    "year_start": "2001",
    "year_end": "2023",
    "dominant_pub": "DC",
    "top_keys": [
      {"title": "Batman", "issue": "#655", "raw": "$15", "why": "1st Damian Wayne cameo", "signed": false, "cgc": true}
    ],
    "signed_books": [],
    "top_writers": {"Tom King": 8, "Scott Snyder": 5},
    "comics_sample": [
      {"title": "Batman", "issue": "#655", "key": true, "signed": false, "pub": "DC"}
    ]
  }
]
```

## KEY FEATURES TO HIGHLIGHT TO REPLIT

- The **spine visualiser** is the centrepiece — make it performant with 200+ spines
- The **Terrificon countdown** (Aug 7-9 2026) should be live: days/hours/minutes
- The **CGC ROI calculator** is high value — make it interactive
- The **"Exiles COMPLETE" celebration** — maybe a confetti animation when you click Box 39
- **Box 02** should have a special treatment — gold border, special badge, prominent in the grid

---
*Generated May 20, 2026 | marshallcoach.com | 5,804 comics | 43 boxes | 824 keys | 131 signed*
