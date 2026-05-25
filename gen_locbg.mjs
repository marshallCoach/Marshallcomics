// Generates a League of Comic Book Geeks import CSV from the comics inventory xlsx.
// Usage: node gen_locbg.mjs
// Output: locbg_export.csv

import { writeFileSync, readdirSync, statSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

// Auto-detect newest xlsx
const xlsxFiles = readdirSync('attached_assets')
  .filter(f => f.startsWith('comics_inventory') && f.endsWith('.xlsx'))
  .map(f => ({ f, mtime: statSync(`attached_assets/${f}`).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

if (!xlsxFiles.length) {
  console.error('No comics_inventory*.xlsx found in attached_assets/');
  process.exit(1);
}
const XLSX_FILE = `attached_assets/${xlsxFiles[0].f}`;
console.log(`Reading: ${XLSX_FILE}`);

const wb = XLSX.readFile(XLSX_FILE);
const sheet = wb.Sheets['Comics Inventory'];
const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
const headers = allRows[0];

function col(name) {
  const i = headers.findIndex(h => String(h).trim() === name);
  if (i === -1) console.warn('  ⚠ Missing column:', name);
  return i;
}

const C = {
  title:  col('Title'),
  issue:  col('Issue #'),
  pub:    col('Publisher'),
  year:   col('Year'),
};

// Expand short publisher names to full names used by LOCBG
function expandPublisher(raw) {
  const p = (raw || '').trim();
  const u = p.toUpperCase();
  if (u === 'MARVEL' || u === 'MARVEL COMICS') return 'Marvel Comics';
  if (u === 'DC' || u === 'DC COMICS')         return 'DC Comics';
  if (u === 'IMAGE')                            return 'Image Comics';
  if (u === 'DARK HORSE')                       return 'Dark Horse Comics';
  if (u === 'IDW')                              return 'IDW Publishing';
  if (u === 'BOOM' || u.includes('BOOM STUD'))  return 'BOOM! Studios';
  if (u === 'VALIANT')                          return 'Valiant Comics';
  if (u === 'DYNAMITE' || u.includes('DYNAM'))  return 'Dynamite Entertainment';
  if (u === 'FANTAGRAPHICS')                    return 'Fantagraphics Books';
  if (u === 'ARCHIE')                           return 'Archie Comics';
  if (u === 'AFTERSHOCK')                       return 'AfterShock Comics';
  if (u === 'AWA' || u === 'AWA STUDIOS')       return 'AWA Studios';
  return p; // keep as-is for anything else
}

// CSV escape
function esc(v) {
  const s = String(v ?? '').trim();
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// Build rows — skip the header row (index 0) and any blank rows
const dataRows = allRows.slice(1).filter(r => r[C.title] && String(r[C.title]).trim());

let skipped = 0;
const csvRows = [];

for (const r of dataRows) {
  const title  = String(r[C.title] || '').trim();
  const issue  = String(r[C.issue] || '').trim();
  const pub    = expandPublisher(String(r[C.pub] || '').trim());
  const year   = String(r[C.year] || '').trim();

  if (!title) { skipped++; continue; }

  // Full Title: "Batman #5" — issue already has the # prefix in the xlsx
  const fullTitle = issue ? `${title} ${issue}` : title;

  // Release date: we only have year; use Jan 1 as placeholder
  // LOCBG uses this to fuzzy-match against their database
  const releaseDate = year.match(/^\d{4}$/) ? `${year}-01-01` : '';

  csvRows.push([
    esc(pub),
    esc(title),
    esc(fullTitle),
    esc(releaseDate),
    '1', // In Collection
    '0', // In Wish List
    '0', // Marked Read
  ].join(','));
}

const header = 'Publisher Name,Series Name,Full Title,Release Date,In Collection,In Wish List,Marked Read';
const csv = [header, ...csvRows].join('\n');

const outPath = 'locbg_export.csv';
writeFileSync(outPath, csv, 'utf8');

console.log(`\n✓ Exported ${csvRows.length.toLocaleString()} comics → ${outPath}`);
if (skipped > 0) console.log(`  (${skipped} rows skipped — no title)`);
console.log('\nColumn note: Release Date uses YYYY-01-01 (year only — no exact release dates in source data).');
console.log('LOCBG will fuzzy-match on title + issue number; most books will resolve correctly.');
