import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const wb = XLSX.readFile('attached_assets/comics_inventory_pm_1779644314535.xlsx');

// ── COMICS ───────────────────────────────────────────────────────────────────
const comicsSheet = wb.Sheets['Comics Inventory'];
const allRows = XLSX.utils.sheet_to_json(comicsSheet, { header: 1, defval: '' });
const headers = allRows[0];

function col(name) {
  const i = headers.findIndex(h => String(h).trim() === name);
  if (i === -1) console.warn('Missing column:', name);
  return i;
}

const C = {
  title:    col('Title'),
  issue:    col('Issue #'),
  pub:      col('Publisher'),
  year:     col('Year'),
  arc:      col('Arc / Story'),
  key:      col('Key Issue?'),
  keyWhy:   col('Key Issue — Why'),
  first:    col('1st Appearances'),
  writer:   col('Writer(s)'),
  artist:   col('Artist(s)'),
  signed:   col('Signed?'),
  signedBy: col('Signed By'),
  personal: col('Personalization'),
  cond:     col('Condition'),
  cgc:      col('CGC Worth It?'),
  nm:       col('Est. Raw Value (NM) $'),
  vf:       col('Est. Raw Value (VF) $'),
  wc:       col('Whatnot Category'),
  era:      col('Era'),
  uni:      col('Universe'),
  seller:   col('Seller Notes / Variants / Caveats'),
  pitch:    col('Whatnot Story Pitch'),
  content:  col('Content / Solicitation Notes'),
  platform: col('Platform Recommendation'),
  sales:    col('Recent Sales Data / Pricing Intel'),
  terrif:   col('Terrificon 2026 (Aug 7–9) — Relevant Creator Appearing'),
  coverA:   col('Cover Artist'),
  date:     col('Date Added'),
  imprint:  col('Imprint'),
  box:      col('Box #'),
  crossover:col('Crossover / Event'),
  bid:      col('Whatnot Starting Bid'),
  volume:   col('Volume'),
};

function s(row, idx) { return String(row[idx] ?? '').trim().replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${'); }

const comics = [];
for (let r = 1; r < allRows.length; r++) {
  const row = allRows[r];
  const title = String(row[C.title] ?? '').trim();
  if (!title) continue;
  comics.push(`  {
    Title: \`${s(row,C.title)}\`, Issue: \`${s(row,C.issue)}\`, Publisher: \`${s(row,C.pub)}\`,
    Year: \`${s(row,C.year)}\`, Arc: \`${s(row,C.arc)}\`, Key: \`${s(row,C.key)}\`,
    Key_Reason: \`${s(row,C.keyWhy)}\`, First_App: \`${s(row,C.first)}\`,
    Writer: \`${s(row,C.writer)}\`, Artist: \`${s(row,C.artist)}\`,
    Signed: \`${s(row,C.signed)}\`, Signed_By: \`${s(row,C.signedBy)}\`,
    Personal: \`${s(row,C.personal)}\`, Condition: \`${s(row,C.cond)}\`,
    CGC_Worth: \`${s(row,C.cgc)}\`, Value_NM: \`${s(row,C.nm)}\`, Value_VF: \`${s(row,C.vf)}\`,
    Category: \`${s(row,C.wc)}\`, Era: \`${s(row,C.era)}\`, Universe: \`${s(row,C.uni)}\`,
    Seller_Notes: \`${s(row,C.seller)}\`, Story_Pitch: \`${s(row,C.pitch)}\`,
    Content: \`${s(row,C.content)}\`, Platform: \`${s(row,C.platform)}\`,
    Sales_Data: \`${s(row,C.sales)}\`, Terrificon: \`${s(row,C.terrif)}\`,
    Cover_Artist: \`${s(row,C.coverA)}\`, Date_Added: \`${s(row,C.date)}\`,
    Imprint: \`${s(row,C.imprint)}\`, Box: \`${s(row,C.box)}\`,
    Crossover: \`${s(row,C.crossover)}\`, Start_Bid: \`${s(row,C.bid)}\`,
    Volume: \`${s(row,C.volume)}\`,
  }`);
}

// ── BOX SUMMARY ──────────────────────────────────────────────────────────────
// New structure (row 1 = headers, row 2+ = data):
// col0=Box(Num)  col1=Comics  col2=Keys  col3=Sgnd  col4=Years
// col5=Label/Contents  col6=FirstBook  col7=LastBook  col8=Location  col9=Notes
const bsSheet = wb.Sheets['Box Summary'];
const bsRows  = XLSX.utils.sheet_to_json(bsSheet, { header: 1, defval: '' });
const boxes = [];
for (let r = 2; r < bsRows.length; r++) {
  const row = bsRows[r];
  const num = String(row[0] ?? '').trim();
  if (!num.startsWith('BOX')) continue;
  boxes.push(`  {
    Num: \`${num}\`, Comics: ${Number(row[1])||0}, Keys: ${Number(row[2])||0},
    Signed: ${Number(row[3])||0}, YearRange: \`${s(row,4)}\`,
    Label: \`${s(row,5)}\`, FirstBook: \`${s(row,6)}\`, LastBook: \`${s(row,7)}\`,
    Location: \`${s(row,8)}\`, Notes: \`${s(row,9)}\`,
  }`);
}

const ts = `// AUTO-GENERATED — DO NOT EDIT MANUALLY
// Source: comics_inventory_pm_1779644314535.xlsx  |  Generated: ${new Date().toISOString().slice(0,10)}

export interface Comic {
  Title: string; Issue: string; Publisher: string; Year: string; Arc: string;
  Key: string; Key_Reason: string; First_App: string; Writer: string; Artist: string;
  Signed: string; Signed_By: string; Personal: string; Condition: string;
  CGC_Worth: string; Value_NM: string; Value_VF: string; Category: string;
  Era: string; Universe: string; Seller_Notes: string; Story_Pitch: string;
  Content: string; Platform: string; Sales_Data: string; Terrificon: string;
  Cover_Artist: string; Date_Added: string; Imprint: string; Box: string;
  Crossover: string; Start_Bid: string; Volume: string;
}

export interface BoxSummary {
  Num: string; Comics: number; Keys: number; Signed: number; YearRange: string;
  Label: string; FirstBook: string; LastBook: string; Location: string; Notes: string;
}

export const DATA3: { comics: Comic[]; boxes: BoxSummary[] } = {
  comics: [
${comics.join(',\n')}
  ],
  boxes: [
${boxes.join(',\n')}
  ],
};
`;

writeFileSync('artifacts/comics-inventory/src/data/data3.ts', ts);
console.log(`Written: ${comics.length} comics, ${boxes.length} boxes`);
