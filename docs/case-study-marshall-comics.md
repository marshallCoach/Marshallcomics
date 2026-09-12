# Case Study: Marshall Comics — AI-Powered Collection Management

**Owner:** Robert Marshall / BlackReadBrown  
**Collection Size:** 10,689 comics across 67 boxes  
**Timeline:** June 2026 (ongoing)  
**Tools Used:** Claude Code, Claude.ai, Comic Vine API, React, TypeScript, Python, Excel

---

## The Problem

Robert Marshall runs BlackReadBrown — a comic book collection, resale business, and community platform. The collection had grown to over 10,000 comics stored across 67 physical boxes, with inventory tracked in a complex Excel spreadsheet. The core challenges were:

- **No visual browsing** — the spreadsheet was unnavigable on a phone
- **Missing creator data** — thousands of issues had blank Writer and Artist fields
- **No cover images** — impossible to visually identify books without physically opening boxes
- **Disorganized for resale** — no quick way to find keys, signed books, or platform-specific listings
- **ADHD-hostile** — dense data with no hierarchy, no search, no quick wins

The goal: transform a static Excel file into a dynamic, phone-optimized inventory system — using AI tools to do the heavy lifting.

---

## The Solution: A Tile-Based AI Workflow

### Phase 1 — Inventory to Live Site

Using **Claude Code**, the Excel spreadsheet was converted into a fully functional React + TypeScript web application in a single session. The pipeline:

```
Excel (.xlsx)
  → gen_data.mjs (Node.js ingest script)
  → data3.ts (typed static data)
  → React site (Vite build)
  → GitHub Pages / local dev server
```

The site is rebuilt from Excel in under 30 seconds with one command:
```bash
pnpm -w run reingest && pnpm --filter comics-inventory build
```

**Result:** 10,689 comics searchable by title, writer, artist, box, publisher, era, platform, key status, and signed status — instantly, on any device.

---

### Phase 2 — ADHD-First Design

The interface was specifically designed for someone managing a large collection with ADHD:

- **Single search bar** searches across title, writer, artist, key reason, arc, notes, first appearance, and signer simultaneously
- **Color-coded publisher badges** (Marvel red, DC blue, Independent teal) for instant visual scanning
- **Cover image thumbnails** in every row — no need to read to identify a book
- **KEY badges** highlight valuable issues at a glance
- **Box location** shown on every row — find the physical book in seconds
- **One-tap filters** for Keys, Signed, Annuals, Era, Platform
- **Card and List views** — cards for browsing, list for data work
- **Terrificon countdown banner** — convention prep always visible
- **Mobile-first layout** — full functionality on a phone screen

---

### Phase 3 — Cover Images via AI Automation

10,000+ cover images can't be sourced manually. A Python/Node.js script was built to:

1. Read every comic from the inventory
2. Query the **Comic Vine API** for each cover image URL
3. Cache results in `covers.json`
4. Serve images directly in the React app

**Rate limit handling:** Comic Vine's free tier allows 200 requests/hour. The script uses 19-second delays and automatic 65-second backoff on rate limit errors (HTTP 420). A `--delay-start 8` flag allows the script to be queued before bed and start 8 hours later when the rate limit has reset.

**Scale:** From 0 to 2,797 cover images fetched automatically overnight — zero manual effort.

---

### Phase 4 — Creator Data Recovery via AI + API

Thousands of issues had blank Writer and Artist fields — unusable for search and resale. The original approach (using the Anthropic API to guess credits) was replaced with a zero-cost solution:

**Three-step Comic Vine lookup:**
1. `/api/volumes/?filter=name:{title}` — find the correct volume ID (cached per series)
2. `/api/issues/?filter=volume:{id}&field_list=id,issue_number` — get issue ID map
3. `/api/issue/4000-{id}/?field_list=person_credits` — fetch individual issue with full role data

**Why three steps?** Comic Vine's bulk list endpoints omit the `role` field from person_credits. Only individual issue detail endpoints return writer/penciler/cover artist roles. This was discovered through live debugging with Claude Code during an overnight run.

**Result:** 138 series filled with writer and artist data in a single overnight run — covering hundreds of previously blank rows. The script runs unattended, saves checkpoints every 25 titles, logs everything to JSON, and flags data gaps for manual review.

---

### Phase 5 — Remote Access While Away

With the collection data processing overnight, remote monitoring was needed. Using **ngrok**:

```bash
ngrok http 5173
# → https://coach-itunes-unnerve.ngrok-free.dev
```

The full site became accessible from any phone anywhere in the world — with live cover images, search, box locations, and key issue flags — while the Mac ran data scripts in the background.

---

## Key Metrics

| Metric | Before | After |
|--------|--------|-------|
| Comics searchable on phone | 0 | 10,689 |
| Cover images | 0 | 2,797+ |
| Series with writer data filled | 0 | 138+ |
| Time to find a specific comic | Minutes (manual) | Seconds (search) |
| Time to rebuild site from Excel | N/A | ~30 seconds |
| Cost of creator data lookup | ~$50+ (Anthropic API) | $0 (Comic Vine free tier) |

---

## Tools & Stack

| Tool | Role |
|------|------|
| **Claude Code** | Site architecture, data pipeline, debugging, overnight scripts |
| **Claude.ai** | Planning, troubleshooting, ADHD-friendly guidance |
| **React + TypeScript + Vite** | Frontend site |
| **Python + pandas** | Excel data processing and writer fill scripts |
| **Comic Vine API** | Cover images and creator credits (free tier) |
| **ExcelJS** | Excel ingestion in Node.js |
| **GitHub** | Version control and collaboration |
| **ngrok** | Remote access tunnel |
| **pnpm** | Monorepo package management |

---

## What Made This Work

### 1. AI as a Pair Programmer
Claude Code maintained full context across the entire codebase — knowing which Excel columns mapped to which React props, which API endpoints had which quirks, and which git commands to run in which order. It handled the technical complexity so the owner could focus on the collection.

### 2. Iterative, Overnight Automation
Rather than one big risky migration, data was improved incrementally — covers fetched in batches, writers filled series by series, each run checkpointed. If something broke, the script resumed where it left off.

### 3. Zero-Cost Data Sourcing
Replacing the Anthropic API (per-token cost) with the Comic Vine API (free, purpose-built for comics) reduced creator data costs from ~$50+ per run to $0 — making overnight automation economically viable.

### 4. ADHD-Informed UX
Every design decision was made with the actual user's cognitive style in mind — visual-first, fast search, bold hierarchy, minimal friction. The site works the way the owner thinks, not the way a database thinks.

### 5. The Owner Stayed in Control
Despite zero coding background, the owner ran overnight scripts, resolved git conflicts, diagnosed API errors, and managed a two-script overnight data pipeline — guided by plain-English Claude explanations and exact copy-paste commands.

---

## What's Next

- Complete writer/artist fill for remaining ~170 series
- Finish cover image fetch for catalog comics (Cover Box 2/3)
- Integrate updated Excel with writer fills into the live site
- Terrificon show prep (August 7–9, 2026) — CGC submission tracking, signing logistics
- Whatnot and eBay platform optimization using the seller dashboard

---

*Built with Claude Code · BlackReadBrown · June 2026*
