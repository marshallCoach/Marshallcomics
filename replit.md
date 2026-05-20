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
- `artifacts/comics-inventory/src/data/data3.ts` — AUTO-GENERATED from xlsx (4,649 comics, 35 boxes)
- `artifacts/comics-inventory/src/pages/` — all page components
- `artifacts/comics-inventory/src/index.css` — all styles (light/editorial theme)
- `artifacts/comics-inventory/src/App.tsx` — nav + routing

## Collection Stats (May 20, 2026)

- 4,649 comics total
- 35 boxes catalogued (target: 65)
- 636 key issues
- 129 signed books

## Product

Two-section nav: **Inventory** (Home, Every Book, Sales Inventory, Box Keys, Stats) and **Business** (Calendar, Shows, CGC Strategy, Signings, Action Plan).

**Home page features:**
- Quick Search widget → navigates directly to Every Book with pre-filled filters
- Box progress bar (35 of 65 = 54%)
- Priority timeline countdown (Terrificon, deadlines)
- Flagship asset cards (10 high-value books)
- Books per box grid
- Next 3 actions

**Every Book features:**
- Search across all 4,649 comics (title, writer, artist, signer, character, arc, key reason, etc.)
- Character family quick-filter pills (13 families with emoji logos)
- Cover thumbnail placeholders linking to Comic Vine search
- List view (sortable table) + Card view
- Pre-fill from home page search

**Character family detection:** Batman Family 🦇, Superman Family 🦸, Spider-Man 🕷️, X-Men/Mutants ⚡, Avengers 🛡️, Black Panther 🐾, and 7 more.

## Architecture decisions

- Data is generated from xlsx via a Node.js script and stored as static TypeScript. No database.
- Calendar, CGC Strategy, Show Planner, and Private Signings data is hardcoded directly in each page (not from xlsx, as those sheets are unstructured).
- `NavParams` type in App.tsx controls navigation between pages with pre-filled filters (box, query, publisher, keysOnly, signed).
- All CSS is in `index.css` — no Tailwind, no CSS Modules. Class names are short (`.qs-section`, `.ev-card`, etc.).
- Cover images are placeholder divs with publisher-specific colors + links to Comic Vine search.

## User preferences

- Light/white theme (not dark)
- Bebas Neue typography for all headings, labels, badges
- Crimson Pro (serif) for body text
- Red (#c8102e) as the primary accent color
- Warmth and personality in copy — this is Roberto's collection, personal and meaningful
- Mobile responsive design
- No emojis in file names or documentation

## Gotchas

- Regenerate `data3.ts` from xlsx using the Node.js script in project root (needs `xlsx` package at workspace root)
- The xlsx "Box Summary" sheet rows start at index 3 (rows 0-2 are header/title rows)
- Calendar, ShowPlanner, CGCStrategy, PrivateSignings: data is hardcoded in those files (not from DATA3)
- `clear-btn` CSS class exists in old pages (OriginalCollection, BoxKeys) — keep it in index.css or those will lose style
- Sticky nav positions: `main-nav` at `top: 56px`, `tab-nav` at `top: 94px` (mobile: 90px / 130px)

## Pointers

- See the `pnpm-workspace` skill for workspace structure
- Data generation script: Node.js inline eval with `xlsx` package
