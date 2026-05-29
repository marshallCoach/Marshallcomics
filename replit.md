# Marshall Comics — BlackReadBrown Inventory Hub

Private React + Vite comic book inventory app for Roberto Marshall (BlackReadBrown). Password: `BlackReadBrown!`. Light/white editorial theme, Bebas Neue typography throughout.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/comics-inventory run dev` — run the inventory app (port auto via workflow)
- Required env: none (all data is hardcoded from xlsx)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite, custom CSS only (no Tailwind), Recharts 2.15
- Data: Static TypeScript from xlsx (`data3.ts` — DO NOT EDIT manually)
- Build: Vite

## Where things live

- `artifacts/comics-inventory/src/` — main app
- `artifacts/comics-inventory/src/data/data3.ts` — AUTO-GENERATED from xlsx (12,612 comics, 84 boxes) — source: X_comics_inventory_1780092473293.xlsx
- `artifacts/comics-inventory/src/pages/` — all page components
- `artifacts/comics-inventory/src/index.css` — all styles (light/editorial theme)
- `artifacts/comics-inventory/src/App.tsx` — nav + routing

## Collection Stats (May 29, 2026)

- 12,612 comics total
- 84 boxes catalogued — COMPLETE
- 1,357 titles cleaned (May 28): year-appended `Batman (2016)` → `Batman`, person-appended `X-Force (Kyle/Yost)` → `X-Force` w/ writers updated, arc-appended cleaned; Saga of the Original Human Torch #3 restored to Box 1
- Zero paren-contaminated titles remaining as of this data load

## Product

Two-section nav: **Inventory** (Home, Every Book, Runs, Sales, Box Keys, Stats, Data View) and **Business** (Calendar, Shows, Timeline, Box View, CGC, Signings, Action Plan).

**Inventory pages:**
- **Home** — Quick Search widget, box progress (41/65), priority timeline, flagship assets, boxes grid, next actions
- **Every Book** — 5,411 comics searchable with character family pills, cover thumbnails, list/card view
- **Runs** — Titles with 75%+ run completion, missing issues clickable to Comic Vine search
- **Sales** — Sales inventory view
- **Box Keys** — Key issues organized by box
- **Stats** — Charts and analytics (Recharts)
- **Data View** — Column population statistics across all 31 fields, most-to-least populated with bar visualization

**Business pages:**
- **Calendar** — Events with date sort toggle (ascending/descending), list/card view
- **Shows** — Whatnot show planner (12 themes)
- **Timeline** — Visual chronological timeline of box catalogue sessions
- **Box View** — Box grid → vertical spine visualization (grouped/colored by title, sorted/unsorted toggle, click title for detail panel)
- **CGC** — CGC strategy and signing priority
- **Signings** — Private signings tracker
- **Action Plan** — Prioritized action items with status tracking

## Architecture decisions

- Data is generated from xlsx via a Node.js script (`gen_data.mjs`) and stored as static TypeScript. No database.
- Calendar, CGC Strategy, Show Planner, and Private Signings data is hardcoded directly in each page (not from xlsx).
- `NavParams` type in App.tsx controls navigation between pages with pre-filled filters.
- All CSS is in `index.css` — no Tailwind, no CSS Modules.
- Cover images are placeholder divs with publisher-specific colors + links to Comic Vine search.

## Comic interface field names (data3.ts)

Key fields: `Title`, `Issue`, `Publisher`, `Year`, `Arc`, `Key`, `Key_Reason`, `First_App`, `Writer`, `Artist`, `Signed`, `Signed_By`, `Personal`, `Condition`, `CGC_Worth`, `Value_NM`, `Value_VF`, `Category`, `Era`, `Universe`, `Seller_Notes`, `Story_Pitch`, `Content`, `Platform`, `Sales_Data`, `Terrificon`, `Cover_Artist`, `Date_Added`, `Imprint`, `Box`, `Start_Bid`

BoxSummary fields: `Num`, `Comics`, `Keys`, `Signed`, `YearRange`, `Label`, `FirstBook`, `LastBook`, `Location`, `Notes`, `DateAdded`

## Data regeneration

Run `node gen_data.mjs` from project root to regenerate `data3.ts`. The script **auto-detects** the newest `comics_inventory*.xlsx` in `attached_assets/` — no filename update needed. Just drop the new xlsx in `attached_assets/` and run the command.

Box Summary parsing starts at row index 2 (BOX 01). `DateAdded` on each box is derived from the earliest `Date_Added` value among its comics.

## User preferences

- Light/white theme (not dark)
- Bebas Neue typography for all headings, labels, badges
- Crimson Pro (serif) for body text
- Red (#c8102e) as the primary accent color
- Warmth and personality in copy — this is Roberto's collection, personal and meaningful
- Mobile responsive design
- No emojis in file names or documentation

## Gotchas

- `clear-btn` CSS class exists in old pages (OriginalCollection, BoxKeys) — keep it in index.css
- Sticky nav positions: `main-nav` at `top: 56px`, `tab-nav` at `top: 94px` (mobile: 90px / 130px)
- Field names in data3.ts changed vs old versions: `Key_Reason` (not `Key_Why`), `Story_Pitch` (not `Whatnot_Pitch`), `Category` (not `Whatnot_Category`), `Personal` (not `Personalization`), `Seller_Notes` (not `Notes`)
- BoxKeys.tsx uses `k.` prefix for comic variables (not `c.`), so sed replacements need to account for both
- Key/Signed values in xlsx (12+) are "YES"/"NO" — app code normalizes with `.toUpperCase() === "YES"`
- gen_data.mjs box loop must start at row index 2 (not 3) to include BOX 01

## Pointers

- See the `pnpm-workspace` skill for workspace structure
- Data generation: `node gen_data.mjs` at project root
