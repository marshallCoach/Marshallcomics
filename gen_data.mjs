import { writeFileSync, readdirSync, statSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');

// Auto-detect the newest comics_inventory*.xlsx in attached_assets/ (supports X_ prefix)
const xlsxFiles = readdirSync('attached_assets')
  .filter(f => f.includes('comics_inventory') && f.endsWith('.xlsx'))
  .map(f => ({ f, mtime: statSync(`attached_assets/${f}`).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);
if (!xlsxFiles.length) { console.error('No comics_inventory*.xlsx found in attached_assets/'); process.exit(1); }
const XLSX_FILE = `attached_assets/${xlsxFiles[0].f}`;
console.log(`Using: ${XLSX_FILE}`);

function cellValueToString(v, defval = '') {
  if (v === null || v === undefined) return defval;
  if (typeof v === 'object') {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return String(v.result);
    if (v.error !== undefined) return defval;
    return String(v);
  }
  return String(v);
}

function worksheetToArrays(worksheet, defval = '') {
  const rows = [];
  let maxCol = 0;
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const vals = row.values; // 1-indexed, index 0 is null
    const arr = [];
    for (let c = 1; c < vals.length; c++) {
      arr.push(cellValueToString(vals[c], defval));
    }
    maxCol = Math.max(maxCol, arr.length);
    rows.push(arr);
  });
  for (const row of rows) {
    while (row.length < maxCol) row.push(defval);
  }
  return rows;
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(XLSX_FILE);

// ── COMICS ───────────────────────────────────────────────────────────────────
const comicsSheet = wb.getWorksheet('Comics Inventory');
const allRows = worksheetToArrays(comicsSheet, '');
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

function s(row, idx) { return String(row[idx] ?? '').trim().replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${'); }
function st(row, idx) { return s(row, idx).replace(/^\[REMOVED\]\s*/i, ''); }

// Derive earliest Date_Added per box from comics data
const boxDateMap = {};
for (let r = 1; r < allRows.length; r++) {
  const row = allRows[r];
  const box  = String(row[C.box]  ?? '').trim();
  const date = String(row[C.date] ?? '').trim();
  if (!box || !date) continue;
  // Strip parenthetical import notes e.g. "(ALL_BOXES import)"
  const clean = date.replace(/\s*\(.*?\)\s*/g, '').trim();
  if (!clean) continue;
  if (!boxDateMap[box] || clean < boxDateMap[box]) boxDateMap[box] = clean;
}

const comics = [];
for (let r = 1; r < allRows.length; r++) {
  const row = allRows[r];
  const title = String(row[C.title] ?? '').trim();
  if (!title) continue;
  comics.push(`  {
    Title: \`${st(row,C.title)}\`, Issue: \`${s(row,C.issue)}\`, Publisher: \`${s(row,C.pub)}\`,
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
    Volume: \`${s(row,C.volume)}\`, Entry: \`${s(row,C.entry)}\`,
  }`);
}

// ── BOX SUMMARY ──────────────────────────────────────────────────────────────
// New structure (row 1 = headers, row 2+ = data):
// col0=Box(Num)  col1=Comics  col2=Keys  col3=Sgnd  col4=Years
// col5=Label/Contents  col6=FirstBook  col7=LastBook  col8=Location  col9=Notes
const bsSheet = wb.getWorksheet('Box Summary');
const bsRows  = worksheetToArrays(bsSheet, '');
const boxes = [];
const coveredBoxNums = new Set();
for (let r = 2; r < bsRows.length; r++) {
  const row = bsRows[r];
  const num = String(row[0] ?? '').trim();
  if (!num.startsWith('BOX')) continue;
  // Normalise box number for lookup: "BOX 01" → "1"
  const boxNum = num.replace(/^BOX\s*/i, '').replace(/^0+/, '') || '0';
  coveredBoxNums.add(boxNum);
  const dateAdded = boxDateMap[boxNum] || '';
  boxes.push(`  {
    Num: \`${num}\`, Comics: ${Number(row[1])||0}, Keys: ${Number(row[2])||0},
    Signed: ${Number(row[3])||0}, YearRange: \`${s(row,4)}\`,
    Label: \`${s(row,5)}\`, FirstBook: \`${s(row,6)}\`, LastBook: \`${s(row,7)}\`,
    Location: \`${s(row,8)}\`, Notes: \`${s(row,9)}\`, DateAdded: \`${dateAdded}\`,
  }`);
}

// Derive summaries from comics data for any boxes not in the Box Summary sheet
// (e.g. newly catalogued boxes not yet added to the summary tab)
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
// Sort derived boxes numerically and append them
const derivedBoxNums = Object.keys(boxComicsMap).sort((a, b) => Number(a) - Number(b));
for (const boxNum of derivedBoxNums) {
  const rows = boxComicsMap[boxNum];
  const padded = boxNum.padStart(2, '0');
  const num = `BOX ${padded}`;
  const keyCount  = rows.filter(r => String(r[C.key] ?? '').toUpperCase() === 'YES').length;
  const signCount = rows.filter(r => String(r[C.signed] ?? '').toUpperCase() === 'YES').length;
  const years = rows.map(r => Number(s(r, C.year))).filter(y => y > 1900);
  const yearRange = years.length ? `${Math.min(...years)}-${Math.max(...years)}` : '';
  const firstRow = rows[0];
  const lastRow  = rows[rows.length - 1];
  const firstBook = `${s(firstRow, C.title)} ${s(firstRow, C.issue)}`.trim();
  const lastBook  = `${s(lastRow,  C.title)} ${s(lastRow,  C.issue)}`.trim();
  const dateAdded = boxDateMap[boxNum] || '';
  boxes.push(`  {
    Num: \`${num}\`, Comics: ${rows.length}, Keys: ${keyCount},
    Signed: ${signCount}, YearRange: \`${yearRange}\`,
    Label: \`\`, FirstBook: \`${firstBook.replace(/`/g,'\\`')}\`, LastBook: \`${lastBook.replace(/`/g,'\\`')}\`,
    Location: \`\`, Notes: \`\`, DateAdded: \`${dateAdded}\`,
  }`);
  console.log(`  Derived BOX ${padded}: ${rows.length} comics, ${keyCount} keys`);
}

// ── CATALOG SHEETS ───────────────────────────────────────────────────────────
// Build a lookup map from the main inventory so catalog entries can be
// enriched with Year, Volume, Cover_Artist, etc. when missing from the sheet.
// Using exact Title+Issue from inventory ensures cover image cache keys match.

const mainLookupExact = new Map(); // title_lc|||issue_lc → inv obj
const mainLookupNorm  = new Map(); // title_lc|||issue_without_hash_lc → inv obj

for (let r = 1; r < allRows.length; r++) {
  const row = allRows[r];
  const title = String(row[C.title] ?? '').trim();
  if (!title) continue;
  const issue = String(row[C.issue] ?? '').trim();
  const inv = {
    Title:       title,
    Issue:       issue,
    Publisher:   String(row[C.pub]     ?? '').trim(),
    Year:        String(row[C.year]    ?? '').trim(),
    Volume:      String(row[C.volume]  ?? '').trim(),
    Cover_Artist: String(row[C.coverA] ?? '').trim(),
    Key:         String(row[C.key]     ?? '').trim(),
    Key_Reason:  String(row[C.keyWhy]  ?? '').trim(),
    Signed:      String(row[C.signed]  ?? '').trim(),
    Signed_By:   String(row[C.signedBy] ?? '').trim(),
    Era:         String(row[C.era]     ?? '').trim(),
    Writer:      String(row[C.writer]  ?? '').trim(),
    Value_NM:    String(row[C.nm]      ?? '').trim(),
    Start_Bid:   String(row[C.bid]     ?? '').trim(),
    Box:         String(row[C.box]     ?? '').trim(),
  };
  const tl = title.toLowerCase();
  const il = issue.toLowerCase();
  const keyExact = `${tl}|||${il}`;
  const keyNorm  = `${tl}|||${il.replace(/^#/, '')}`;
  if (!mainLookupExact.has(keyExact)) mainLookupExact.set(keyExact, inv);
  if (!mainLookupNorm.has(keyNorm))   mainLookupNorm.set(keyNorm, inv);
}

function findInInventory(title, issue) {
  const tl = title.toLowerCase().trim();
  const il = issue.toLowerCase().trim();
  return mainLookupExact.get(`${tl}|||${il}`)
      ?? mainLookupNorm.get(`${tl}|||${il.replace(/^#/, '')}`)
      ?? null;
}

// Escape for TypeScript template literals
function esc(str) {
  return String(str ?? '').trim()
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

function catComicTS(c) {
  return `  {
    Title: \`${esc(c.Title)}\`, Issue: \`${esc(c.Issue)}\`, Publisher: \`${esc(c.Publisher)}\`,
    Year: \`${esc(c.Year)}\`, Volume: \`${esc(c.Volume)}\`, Cover_Artist: \`${esc(c.Cover_Artist)}\`,
    Key: \`${esc(c.Key)}\`, Key_Reason: \`${esc(c.Key_Reason)}\`,
    Signed: \`${esc(c.Signed)}\`, Signed_By: \`${esc(c.Signed_By)}\`,
    Era: \`${esc(c.Era)}\`, Writer: \`${esc(c.Writer)}\`,
    Value_NM: \`${esc(c.Value_NM)}\`, Start_Bid: \`${esc(c.Start_Bid)}\`, Box: \`${esc(c.Box)}\`,
    Notes: \`${esc(c.Notes)}\`, SortPile: \`${esc(c.SortPile)}\`,
    CoverNotes: \`${esc(c.CoverNotes)}\`, Flag: \`${esc(c.Flag)}\`,
  }`;
}

// Parse one catalog sheet, enriching missing fields from main inventory.
// Deduplicates within the sheet by Title+Issue (case-insensitive).
function parseCatalogSheet(sheetName) {
  const ws = wb.getWorksheet(sheetName);
  if (!ws) { console.warn(`  [warn] Sheet not found: ${sheetName}`); return []; }
  const rows = worksheetToArrays(ws);
  const headerIdx = rows.findIndex(r => r.some(c => String(c).trim() === 'Title'));
  if (headerIdx < 0) { console.warn(`  [warn] No header row in: ${sheetName}`); return []; }

  const hdrs = rows[headerIdx].map(h => String(h).trim());
  const fc   = name => hdrs.findIndex(h => h === name);

  const iTitle     = fc('Title');
  const iIssue     = fc('Issue');
  const iPub       = fc('Publisher');
  const iYear      = fc('Year');
  const iCoverA    = fc('Cover Artist');
  const iSigned    = fc('Signed?');
  const iSignedBy  = fc('Signed By');
  const iKey       = fc('Key?');
  const iNotes     = fc('Notes');
  const iPile      = fc('Sort Pile') >= 0 ? fc('Sort Pile') : fc('Pile');
  const iCoverNote = fc('Cover Notes');
  const iFlag      = fc('⭐ Flag');

  const result = [];
  const seen = new Set();

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const title = String(row[iTitle] ?? '').trim();
    if (!title || title.toLowerCase() === 'title') continue;
    const issue = String(row[iIssue] ?? '').trim();

    // Within-sheet dedup by title+issue
    const dedupKey = `${title.toLowerCase()}|||${issue.toLowerCase()}`;
    if (seen.has(dedupKey)) {
      console.log(`  [dedup removed] ${sheetName}: "${title}" ${issue}`);
      continue;
    }
    seen.add(dedupKey);

    const catPub       = iPub      >= 0 ? String(row[iPub]      ?? '').trim() : '';
    const catYear      = iYear     >= 0 ? String(row[iYear]     ?? '').trim() : '';
    const catCoverA    = iCoverA   >= 0 ? String(row[iCoverA]   ?? '').trim() : '';
    const catSigned    = iSigned   >= 0 ? String(row[iSigned]   ?? '').trim() : '';
    const catSignedBy  = iSignedBy >= 0 ? String(row[iSignedBy] ?? '').trim() : '';
    const catKey       = iKey      >= 0 ? String(row[iKey]      ?? '').trim() : '';
    const catNotes     = iNotes    >= 0 ? String(row[iNotes]    ?? '').trim() : '';
    const catPile      = iPile     >= 0 ? String(row[iPile]     ?? '').trim() : '';
    const catCoverNote = iCoverNote >= 0 ? String(row[iCoverNote] ?? '').trim() : '';
    const catFlag      = iFlag     >= 0 ? String(row[iFlag]     ?? '').trim() : '';

    // Look up in main inventory — only fills fields that are blank in the catalog
    const inv = findInInventory(title, issue);

    result.push({
      // Prefer exact Title/Issue from inventory so cover image cache keys align
      Title:        inv ? inv.Title        : title,
      Issue:        inv ? inv.Issue        : issue,
      Publisher:    catPub     || (inv ? inv.Publisher    : ''),
      Year:         catYear    || (inv ? inv.Year         : ''),
      Volume:       inv ? inv.Volume       : '',
      Cover_Artist: catCoverA  || (inv ? inv.Cover_Artist : ''),
      Key:          catKey     || (inv ? inv.Key          : ''),
      Key_Reason:   inv ? inv.Key_Reason   : '',
      Signed:       catSigned  || (inv ? inv.Signed       : ''),
      Signed_By:    catSignedBy || (inv ? inv.Signed_By   : ''),
      Era:          inv ? inv.Era          : '',
      Writer:       inv ? inv.Writer       : '',
      Value_NM:     inv ? inv.Value_NM     : '',
      Start_Bid:    inv ? inv.Start_Bid    : '',
      Box:          inv ? inv.Box          : '',
      Notes:        catNotes,
      SortPile:     catPile,
      CoverNotes:   catCoverNote,
      Flag:         catFlag,
    });
  }

  console.log(`  ${sheetName}: ${result.length} comics`);
  return result;
}

// ── CC BOXES (derived numeric boxes ≥ 82 — not present in Box Summary) ──────
// Boxes 82+ are not in the Box Summary sheet; they appear only as derived boxes.
// "Unlabeled" in this context means not catalogued in the summary yet.
const ccBoxNums = new Set(
  derivedBoxNums.filter(n => {
    const num = parseInt(n, 10);
    return !isNaN(num) && num >= 82;
  })
);
console.log(`CC Box numbers: ${[...ccBoxNums].join(', ')}`);

// catalogExcludeKey normalises a title+issue pair the same way the catalog
// sheets do, so CC Boxes can skip comics already in the 3 catalog tabs.
function catalogExcludeKey(title, issue) {
  return `${title.toLowerCase()}|||${String(issue).replace(/^#/, '').toLowerCase()}`;
}

function getCCBoxComics(excludeKeys) {
  const result = [];
  for (let r = 1; r < allRows.length; r++) {
    const row = allRows[r];
    const title = String(row[C.title] ?? '').trim();
    if (!title) continue;
    const boxRaw = String(row[C.box] ?? '').trim();
    const boxNorm = boxRaw.replace(/^0+/, '') || boxRaw;
    if (!ccBoxNums.has(boxNorm) && !ccBoxNums.has(boxRaw)) continue;
    const issue = String(row[C.issue] ?? '').trim();
    if (excludeKeys.has(catalogExcludeKey(title, issue))) continue;
    result.push({
      Title:        title,
      Issue:        issue,
      Publisher:    String(row[C.pub]     ?? '').trim(),
      Year:         String(row[C.year]    ?? '').trim(),
      Volume:       String(row[C.volume]  ?? '').trim(),
      Cover_Artist: String(row[C.coverA]  ?? '').trim(),
      Key:          String(row[C.key]     ?? '').trim(),
      Key_Reason:   String(row[C.keyWhy]  ?? '').trim(),
      Signed:       String(row[C.signed]  ?? '').trim(),
      Signed_By:    String(row[C.signedBy] ?? '').trim(),
      Era:          String(row[C.era]     ?? '').trim(),
      Writer:       String(row[C.writer]  ?? '').trim(),
      Value_NM:     String(row[C.nm]      ?? '').trim(),
      Start_Bid:    String(row[C.bid]     ?? '').trim(),
      Box:          boxRaw,
      Notes:        '',
      SortPile:     '',
      CoverNotes:   '',
      Flag:         '',
    });
  }
  console.log(`  CC Boxes: ${result.length} comics`);
  return result;
}

// Parse all 4 catalog sources
console.log('Parsing catalog sheets...');
const catPulled  = parseCatalogSheet('Pulled Covers Catalog');
const catBox2    = parseCatalogSheet('Cover Box 2 Catalog');
const catBox3    = parseCatalogSheet('Cover Box 3 Catalog');

// Build exclusion set from the 3 catalog sheets so CC Boxes doesn't repeat them
const catalogExcludeKeys = new Set(
  [...catPulled, ...catBox2, ...catBox3].map(c => catalogExcludeKey(c.Title, c.Issue))
);
console.log(`  Excluding ${catalogExcludeKeys.size} catalog-sheet keys from CC Boxes`);
const catCCBoxes = getCCBoxComics(catalogExcludeKeys);

const srcName = xlsxFiles[0].f;
const ts = `// AUTO-GENERATED — DO NOT EDIT MANUALLY
// Source: ${srcName}  |  Generated: ${new Date().toISOString().slice(0,10)}

export interface Comic {
  Title: string; Issue: string; Publisher: string; Year: string; Arc: string;
  Key: string; Key_Reason: string; First_App: string; Writer: string; Artist: string;
  Signed: string; Signed_By: string; Personal: string; Condition: string;
  CGC_Worth: string; Value_NM: string; Value_VF: string; Category: string;
  Era: string; Universe: string; Seller_Notes: string; Story_Pitch: string;
  Content: string; Platform: string; Sales_Data: string; Terrificon: string;
  Cover_Artist: string; Date_Added: string; Imprint: string; Box: string;
  Crossover: string; Start_Bid: string; Volume: string; Entry: string;
}

export interface BoxSummary {
  Num: string; Comics: number; Keys: number; Signed: number; YearRange: string;
  Label: string; FirstBook: string; LastBook: string; Location: string;
  Notes: string; DateAdded: string;
}

// Comics pulled from catalog sheets (Pulled Covers, Cover Box 2/3, CC Boxes).
// These are display/sorting copies — NOT counted in the main inventory.
// Missing fields are filled from the main Comics Inventory where possible.
export interface CatalogComic {
  Title: string; Issue: string; Publisher: string; Year: string; Volume: string;
  Cover_Artist: string; Key: string; Key_Reason: string;
  Signed: string; Signed_By: string; Era: string; Writer: string;
  Value_NM: string; Start_Bid: string; Box: string;
  Notes: string; SortPile: string; CoverNotes: string; Flag: string;
}

export const DATA3: {
  comics: Comic[];
  boxes: BoxSummary[];
  catalogs: {
    pulled:  CatalogComic[];
    box2:    CatalogComic[];
    box3:    CatalogComic[];
    ccBoxes: CatalogComic[];
  };
} = {
  comics: [
${comics.join(',\n')}
  ],
  boxes: [
${boxes.join(',\n')}
  ],
  catalogs: {
    pulled: [
${catPulled.map(catComicTS).join(',\n')}
    ],
    box2: [
${catBox2.map(catComicTS).join(',\n')}
    ],
    box3: [
${catBox3.map(catComicTS).join(',\n')}
    ],
    ccBoxes: [
${catCCBoxes.map(catComicTS).join(',\n')}
    ],
  },
};
`;

writeFileSync('artifacts/comics-inventory/src/data/data3.ts', ts);
console.log(`Written: ${comics.length} comics, ${boxes.length} boxes`);
console.log(`Catalogs: pulled=${catPulled.length}, box2=${catBox2.length}, box3=${catBox3.length}, ccBoxes=${catCCBoxes.length}`);
