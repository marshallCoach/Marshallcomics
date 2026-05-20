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
- `artifacts/comics-inventory/src/data/data3.ts` — AUTO-GENERATED from xlsx (4,861 comics, 37 boxes)
- `artifacts/comics-inventory/src/pages/` — all page components
- `artifacts/comics-inventory/src/index.css` — all styles (light/editorial theme)
- `artifacts/comics-inventory/src/App.tsx` — nav + routing

## Collection Stats (May 20, 2026)

- 4,861 comics total
- 37 boxes catalogued (target: 65)
- 657 key issues
- 129 signed books

## Product

Two-section nav: **Inventory** (Home, Every Book, Runs, Sales, Box Keys, Stats) and **Business** (Calendar, Shows, Timeline, Box View, CGC, Signings, Action Plan).

**Inventory pages:**
- **Home** — Quick Search widget, box progress (37/65), priority timeline, flagship assets, boxes grid, next actions
- **Every Book** — 4,861 comics searchable with character family pills, cover thumbnails, list/card view
- **Runs** — Titles with 75%+ run completion, missing issues clickable to Comic Vine search
- **Sales** — Sales inventory view
- **Box Keys** — Key issues organized by box
- **Stats** — Charts and analytics (Recharts)

**Business pages:**
- **Calendar** — Events with date sort toggle (ascending/descending), list/card view
- **Shows** — Whatnot show planner (12 themes)
- **Timeline** — Visual chronological timeline of box catalogue sessions
- **Box View** — Graphical box selector → visual box with per-comic lines + run drill-down
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

BoxSummary fields: `Num`, `Label`, `DateAdded`, `Comics`, `Publisher`, `YearRange`, `Keys`, `Signed`, `Dups`, `FirstBook`, `FirstIss`, `LastBook`, `LastIss`, `Description`

## Data regeneration

Run `node gen_data.mjs` from project root to regenerate `data3.ts` from the latest xlsx in `attached_assets/`. Update the filename in `gen_data.mjs` first.

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

## Pointers

- See the `pnpm-workspace` skill for workspace structure
- Data generation: `node gen_data.mjs` at project root
