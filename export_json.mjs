import { writeFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

import { readdirSync, statSync } from 'fs';
const xlsxFiles = readdirSync('attached_assets')
  .filter(f => f.includes('comics_inventory') && f.endsWith('.xlsx'))
  .map(f => ({ f, mtime: statSync(`attached_assets/${f}`).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);
if (!xlsxFiles.length) { console.error('No comics_inventory*.xlsx found in attached_assets/'); process.exit(1); }
const XLSX_FILE = `attached_assets/${xlsxFiles[0].f}`;
console.log(`Using: ${XLSX_FILE}`);
const wb = XLSX.readFile(XLSX_FILE);

// ── COMICS ────────────────────────────────────────────────────────────────────
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
  entry:    col('#'),
};

function s(row, idx) {
  return String(row[idx] ?? '').trim().replace(/^\[REMOVED\]\s*/i, '');
}

// Derive earliest Date_Added per box
const boxDateMap = {};
for (let r = 1; r < allRows.length; r++) {
  const row = allRows[r];
  const box  = String(row[C.box]  ?? '').trim();
  const date = String(row[C.date] ?? '').trim();
  if (!box || !date) continue;
  const clean = date.replace(/\s*\(.*?\)\s*/g, '').trim();
  if (!clean) continue;
  if (!boxDateMap[box] || clean < boxDateMap[box]) boxDateMap[box] = clean;
}

const comics = [];
for (let r = 1; r < allRows.length; r++) {
  const row = allRows[r];
  const title = String(row[C.title] ?? '').trim();
  if (!title) continue;
  comics.push({
    Title:        s(row, C.title),
    Issue:        s(row, C.issue),
    Publisher:    s(row, C.pub),
    Year:         s(row, C.year),
    Arc:          s(row, C.arc),
    Key:          s(row, C.key),
    Key_Reason:   s(row, C.keyWhy),
    First_App:    s(row, C.first),
    Writer:       s(row, C.writer),
    Artist:       s(row, C.artist),
    Signed:       s(row, C.signed),
    Signed_By:    s(row, C.signedBy),
    Personal:     s(row, C.personal),
    Condition:    s(row, C.cond),
    CGC_Worth:    s(row, C.cgc),
    Value_NM:     s(row, C.nm),
    Value_VF:     s(row, C.vf),
    Category:     s(row, C.wc),
    Era:          s(row, C.era),
    Universe:     s(row, C.uni),
    Seller_Notes: s(row, C.seller),
    Story_Pitch:  s(row, C.pitch),
    Content:      s(row, C.content),
    Platform:     s(row, C.platform),
    Sales_Data:   s(row, C.sales),
    Terrificon:   s(row, C.terrif),
    Cover_Artist: s(row, C.coverA),
    Date_Added:   s(row, C.date),
    Imprint:      s(row, C.imprint),
    Box:          s(row, C.box),
    Crossover:    s(row, C.crossover),
    Start_Bid:    s(row, C.bid),
    Volume:       s(row, C.volume),
    Entry:        s(row, C.entry),
  });
}

// ── BOX SUMMARY ───────────────────────────────────────────────────────────────
const bsSheet = wb.Sheets['Box Summary'];
const bsRows  = XLSX.utils.sheet_to_json(bsSheet, { header: 1, defval: '' });
const boxes = [];
const coveredBoxNums = new Set();
for (let r = 2; r < bsRows.length; r++) {
  const row = bsRows[r];
  const num = String(row[0] ?? '').trim();
  if (!num.startsWith('BOX')) continue;
  const boxNum = num.replace(/^BOX\s*/i, '').replace(/^0+/, '') || '0';
  coveredBoxNums.add(boxNum);
  boxes.push({
    Num:       num,
    Comics:    Number(row[1]) || 0,
    Keys:      Number(row[2]) || 0,
    Signed:    Number(row[3]) || 0,
    YearRange: String(row[4] ?? '').trim(),
    Label:     String(row[5] ?? '').trim(),
    FirstBook: String(row[6] ?? '').trim(),
    LastBook:  String(row[7] ?? '').trim(),
    Location:  String(row[8] ?? '').trim(),
    Notes:     String(row[9] ?? '').trim(),
    DateAdded: boxDateMap[boxNum] || '',
  });
}

// Derive summaries for boxes not in Box Summary sheet
const boxComicsMap = {};
for (let r = 1; r < allRows.length; r++) {
  const row = allRows[r];
  const title = String(row[C.title] ?? '').trim();
  if (!title) continue;
  const boxRaw = String(row[C.box] ?? '').trim();
  if (!boxRaw) continue;
  const boxNum = boxRaw.replace(/^0+/, '') || boxRaw;
  if (coveredBoxNums.has(boxNum)) continue;
  if (!boxComicsMap[boxNum]) boxComicsMap[boxNum] = [];
  boxComicsMap[boxNum].push(row);
}
for (const boxNum of Object.keys(boxComicsMap).sort((a, b) => Number(a) - Number(b))) {
  const rows = boxComicsMap[boxNum];
  const padded = boxNum.padStart(2, '0');
  const keyCount  = rows.filter(r => String(r[C.key]    ?? '').toUpperCase() === 'YES').length;
  const signCount = rows.filter(r => String(r[C.signed] ?? '').toUpperCase() === 'YES').length;
  const years = rows.map(r => Number(s(r, C.year))).filter(y => y > 1900);
  const yearRange = years.length ? `${Math.min(...years)}-${Math.max(...years)}` : '';
  const firstRow = rows[0], lastRow = rows[rows.length - 1];
  boxes.push({
    Num:       `BOX ${padded}`,
    Comics:    rows.length,
    Keys:      keyCount,
    Signed:    signCount,
    YearRange: yearRange,
    Label:     '',
    FirstBook: `${s(firstRow, C.title)} ${s(firstRow, C.issue)}`.trim(),
    LastBook:  `${s(lastRow,  C.title)} ${s(lastRow,  C.issue)}`.trim(),
    Location:  '',
    Notes:     '',
    DateAdded: boxDateMap[boxNum] || '',
  });
}

const out = {
  generated: new Date().toISOString().slice(0, 10),
  source:    xlsxFiles[0].f,
  totals:    { comics: comics.length, boxes: boxes.length },
  comics,
  boxes,
};

writeFileSync('inventory_export.json', JSON.stringify(out, null, 2), 'utf8');
console.log(`Written inventory_export.json — ${comics.length} comics, ${boxes.length} boxes`);
