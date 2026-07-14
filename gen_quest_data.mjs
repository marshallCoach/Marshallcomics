/**
 * gen_quest_data.mjs — regenerate the Box Quest data file (quest-data.js) that
 * powers quest-hub.html / quest-guide.html / quest-board.html.
 *
 * Reads the newest comics_inventory*.xlsx in attached_assets/ (same source-of-
 * truth convention as gen_data.mjs / gen_quest.mjs / brb_validate.py) and
 * recomputes, per box: location + zone (from the Box Summary sheet), comic
 * count, same-box duplicate rows (Check 6 key) and exact-clone rows (Check 11
 * key). Over-capacity is computed with the validator's BOX_CAPACITY model so it
 * matches brb_validate.py Check 5 exactly — NOT the Box Summary "Cap" column.
 *
 * The step-by-step guide + tripwire copy is authored content and lives in this
 * file (GUIDE / TRIPWIRES below); the box numbers around it are regenerated.
 *
 * Usage:  node gen_quest_data.mjs
 * Output: artifacts/comics-inventory/public/quest-data.js
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');

const OUT = 'artifacts/comics-inventory/public/quest-data.js';

// ── Validator BOX_CAPACITY (must match brb_validate.py Check 5 / CLAUDE.md) ──
const DEFAULT_CAP = 240;
const CAP_EXCEPTIONS = { 15: 150, 23: 155, 40: 80, 44: 200, 72: 80, 85: 155 };
const capOf = (b) => (b in CAP_EXCEPTIONS ? CAP_EXCEPTIONS[b] : DEFAULT_CAP);

// ── BOX_STATUS_ALLOWLIST (rows excluded from physical dup checks) ────────────
const BOX_STATUS_ALLOWLIST = new Set([
  'AT CGC', 'AT MAGIC PRESSING → CGC', 'AT CGC — Roy Thomas SS',
  'UNKNOWN — needs physical reassignment',
]);

// ── Auto-detect newest xlsx ──────────────────────────────────────────────────
const xlsxFiles = readdirSync('attached_assets')
  .filter(f => f.includes('comics_inventory') && f.endsWith('.xlsx') && !f.startsWith('~$'))
  .map(f => ({ f, mtime: statSync(`attached_assets/${f}`).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);
if (!xlsxFiles.length) { console.error('No comics_inventory*.xlsx found in attached_assets/'); process.exit(1); }
const XLSX_FILE = `attached_assets/${xlsxFiles[0].f}`;
console.log(`Using: ${XLSX_FILE}`);

// ── ExcelJS helpers (same shape as gen_quest.mjs) ────────────────────────────
function cellStr(v, def = '') {
  if (v === null || v === undefined) return def;
  if (typeof v === 'object') {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return String(v.result);
    if (v.error !== undefined) return def;
    return String(v);
  }
  return String(v);
}
function sheetRows(ws, def = '') {
  const rows = [];
  let maxCol = 0;
  ws.eachRow({ includeEmpty: true }, (row) => {
    const vals = row.values, arr = [];
    for (let c = 1; c < vals.length; c++) arr.push(cellStr(vals[c], def));
    maxCol = Math.max(maxCol, arr.length);
    rows.push(arr);
  });
  for (const r of rows) while (r.length < maxCol) r.push(def);
  return rows;
}
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const normIssue = (v) => {
  const s = String(v ?? '').trim();
  const f = parseFloat(s);
  return (!isNaN(f) && f === Math.trunc(f) && /^\d+(\.0+)?$/.test(s)) ? String(Math.trunc(f)) : s;
};
const zoneOf = (loc) => (loc ? String(loc).split(/\s*—\s*/)[0].trim() || 'Unassigned' : 'Unassigned');

// ── Read workbook ────────────────────────────────────────────────────────────
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(XLSX_FILE);

const inv = wb.worksheets.find(ws => ws.name.startsWith('✅ Clean Inventory'));
if (!inv) { console.error('Inventory sheet not found. Sheets:', wb.worksheets.map(w => w.name).join(', ')); process.exit(1); }
const rows = sheetRows(inv);
const H = rows[0];
const idx = (name) => H.findIndex(h => String(h).trim() === name);
const ci = {
  title: idx('Title'), issue: idx('Issue #'), year: idx('Year'), box: idx('Box #'),
  cond: idx('Condition'), signed: idx('Signed?'),
};

// ── Box Summary → location ───────────────────────────────────────────────────
const bsSheet = wb.worksheets.find(ws => ws.name === 'Box Summary');
const boxLoc = {}, boxSummaryComics = {};
if (bsSheet) {
  const bsRows = sheetRows(bsSheet);
  const bh = bsRows[0];
  const bB = bh.findIndex(h => String(h).trim() === 'Box #');
  const bL = bh.findIndex(h => String(h).trim() === 'Location');
  const bC = bh.findIndex(h => String(h).trim() === 'Comics');
  for (let r = 1; r < bsRows.length; r++) {
    const bn = parseInt(bsRows[r][bB], 10);
    if (isNaN(bn)) continue;
    boxLoc[bn] = String(bsRows[r][bL] ?? '').trim();
    boxSummaryComics[bn] = parseInt(bsRows[r][bC], 10) || 0;
  }
  console.log(`Read ${Object.keys(boxLoc).length} box locations from Box Summary`);
} else {
  console.warn('Box Summary sheet not found — locations unavailable');
}

// ── Per-box counts + dup/clone detection ─────────────────────────────────────
const boxCount = {};
const k2 = new Map();   // Check 6:  title|issue|year|box
const k11 = new Map();  // Check 11: title|issue|year|cond|signed|box
let totalRows = 0;
for (let r = 1; r < rows.length; r++) {
  const title = String(rows[r][ci.title] ?? '').trim();
  if (!title) continue;
  totalRows++;
  const boxRaw = String(rows[r][ci.box] ?? '').trim();
  if (BOX_STATUS_ALLOWLIST.has(boxRaw)) continue;
  const box = parseInt(boxRaw, 10);
  if (!boxRaw || isNaN(box)) continue;
  boxCount[box] = (boxCount[box] || 0) + 1;
  const issue = normIssue(rows[r][ci.issue]);
  const year = String(rows[r][ci.year] ?? '').trim();
  const cond = ci.cond >= 0 ? norm(rows[r][ci.cond]) : '';
  const signed = ci.signed >= 0 ? norm(rows[r][ci.signed]) : '';
  const key2 = `${norm(title)}|${issue}|${year}|${box}`;
  const key11 = `${norm(title)}|${issue}|${year}|${cond}|${signed}|${box}`;
  (k2.get(key2) || k2.set(key2, []).get(key2)).push(box);
  (k11.get(key11) || k11.set(key11, []).get(key11)).push(box);
}

const dupePerBox = {}, clonePerBox = {};
let dupeGroups = 0, dupeRows = 0, cloneGroups = 0, cloneRows = 0;
for (const [, boxes] of k2) if (boxes.length > 1) { dupeGroups++; dupeRows += boxes.length; for (const b of boxes) dupePerBox[b] = (dupePerBox[b] || 0) + 1; }
for (const [, boxes] of k11) if (boxes.length > 1) { cloneGroups++; cloneRows += boxes.length; for (const b of boxes) clonePerBox[b] = (clonePerBox[b] || 0) + 1; }

// ── Assemble boxes ───────────────────────────────────────────────────────────
const boxes = Object.keys(boxLoc).map(Number).sort((a, b) => a - b).map(bn => ({
  box: bn, loc: boxLoc[bn], zone: zoneOf(boxLoc[bn]),
  rows: boxCount[bn] ?? boxSummaryComics[bn] ?? 0,
  vcap: capOf(bn), dupes: dupePerBox[bn] || 0, clones: clonePerBox[bn] || 0,
}));
const overCap = boxes.filter(b => b.rows > b.vcap)
  .map(b => ({ box: b.box, rows: b.rows, cap: b.vcap, over: b.rows - b.vcap, loc: b.loc }))
  .sort((a, b) => b.over - a.over);

// ── Authored guide + tripwire content (box numbers around it are regenerated) ─
const GUIDE = [
  { code: '0', title: 'Set Up Camp', est: '5 min · once', accent: 'slate',
    blurb: 'Get the workspace and the right file in place before touching anything.',
    sittings: [{ id: 's0', title: 'Camp setup', est: '5 min', steps: [
      { id: '0.1', text: 'Print the guide (or keep this page open) where the comics live.' },
      { id: '0.2', text: 'Start a new Claude chat in the Comics Project.' },
      { id: '0.3', text: 'Paste the Session Start Block from the session doc.' },
      { id: '0.4', text: 'Attach the session doc (.md) and the inventory file (.xlsx).' },
      { id: '0.5', text: `Confirm the chat reads back ${totalRows.toLocaleString()} rows. If not — STOP, wrong file.` },
    ]}]},
  { code: 'A', title: 'The Clones', est: 'identical twin rows — safest wins first', accent: 'green',
    blurb: `Rows that are exact copies of another row: same book, same box, logged twice. Live count: ${cloneGroups} clone groups / ${cloneRows - cloneGroups} excess rows. Highest confidence, lowest effort, biggest visible progress.`,
    sittings: [
      { id: 'A1', title: 'Sitting A1 — the audited boxes', est: '~45 min', steps: [
        { id: 'A1.1', text: 'Ask the chat for clone groups in Boxes 3, 7, 10, 43, 85 only.' },
        { id: 'A1.2', text: 'Go to each box and count ONLY those clone titles (30 seconds each).' },
        { id: 'A1.3', text: 'Tell the chat each count: "found 1 copy" or "found 2 copies."' },
        { id: 'A1.4', text: 'Found 1 copy = approve the purge. Found 2 = it stays, both are real.' },
        { id: 'A1.5', text: 'Chat runs dry-run first, then purge, then validator. Watch it confirm row count.' },
        { id: 'A1.6', text: 'Done? Take the win. Duplicate count just dropped for real.' },
      ]},
      { id: 'A2', title: 'Sitting A2 — next ~25 clone groups', est: '~45 min', steps: [
        { id: 'A2.1', text: 'Ask for the next 25 groups, sorted by box.' },
        { id: 'A2.2', text: 'Same loop: go to box → count the title → report → approve or keep.' },
        { id: 'A2.3', text: 'Validator after the batch. Row count must match prediction. Mismatch = STOP.' },
      ]},
      { id: 'A3', title: 'Sitting A3 — final clone groups', est: '~45 min', steps: [
        { id: 'A3.1', text: 'Ask for all remaining groups.' },
        { id: 'A3.2', text: 'Same loop. Last one. Clone problem = gone.' },
        { id: 'A3.3', text: 'Log milestone: "Phase A complete" in the Integrity Log.' },
      ]}]},
  { code: 'B', title: 'The Sandwich Rows', est: 'books filed under the wrong box number', accent: 'gold',
    blurb: 'Rows where one book’s box number looks wrong because both its neighbors agree and it doesn’t — a known import glitch. ~72 rows per last audit (reconfirm live). Some are the glitch, some are real single placements. Never bulk-fix.',
    sittings: [
      { id: 'B1', title: 'Sitting B1 — the named-bug rows', est: '~40 min', steps: [
        { id: 'B1.1', text: 'Ask the chat for sandwich rows matching KNOWN bug signatures (6↔87, 47↔88, 12↔86).' },
        { id: 'B1.2', text: 'Approve corrections for those — the bug pattern is already proven.' },
        { id: 'B1.3', text: 'Validator + row count. Rows move boxes; total must NOT change.' },
      ]},
      { id: 'B2', title: 'Sitting B2 — the unproven rows', est: '~60 min', steps: [
        { id: 'B2.1', text: 'Ask for the remaining sandwich rows, ~25 at a time.' },
        { id: 'B2.2', text: 'For each: physically check which box the book is ACTUALLY in.' },
        { id: 'B2.3', text: 'Report what you saw. Chat fixes only what you confirmed.' },
        { id: 'B2.4', text: 'Ask the chat to cross-check fixes against the pre-import file (ALL_BOXES_2).' },
        { id: 'B2.5', text: 'Validator. Milestone log: "Phase B complete."' },
      ]}]},
  { code: 'C', title: 'The Lost Books', est: 'real books, no known home', accent: 'purple',
    blurb: 'Books that exist but the data doesn’t know which box they’re in. ~247 per last audit (reconfirm live). Not duplicates — a treasure hunt. One title cluster per sitting.',
    sittings: [
      { id: 'C1', title: 'Sitting C1 — the likely spot first', est: '~30 min', steps: [
        { id: 'C1.1', text: 'Print the hunt list (chat gives it grouped: DC / Image / Marvel / Skybound).' },
        { id: 'C1.2', text: 'Open Boxes 101, 102, 103 (Bedroom mid shelf — the NEW boxes).' },
        { id: 'C1.3', text: 'Tick off every hunt-list book you find in them.' },
        { id: 'C1.4', text: 'Tell the chat: "found these in 101/102/103" — it assigns real box numbers.' },
        { id: 'C1.5', text: 'Validator. UNKNOWN count drops. Log the new number.' },
      ]},
      { id: 'C2', title: 'Sittings C2–C7 — one cluster at a time', est: '~30 min each', steps: [
        { id: 'C2', text: 'Hunt cluster: The Magic Order (18 books).' },
        { id: 'C3', text: 'Hunt cluster: Absolute titles — Wonder Woman, Flash, Green Lantern (41 books).' },
        { id: 'C4', text: 'Hunt cluster: G.I. Joe + Transformers + Void Rivals (39 books).' },
        { id: 'C5', text: 'Hunt everything left, smallest clusters last.' },
        { id: 'C6', text: 'Can’t find a book anywhere? Leave it UNKNOWN + note "hunted [date]." Never force it.' },
        { id: 'C7', text: 'Special: Avengers #0 (2017) — compare in hand against Box 50 (2012) and Box 24 (2015) copies.' },
      ]}]},
  { code: 'D', title: 'Small Cleanups', est: 'the last two fingerprints', accent: 'slate',
    blurb: 'Low urgency. Do these when a sitting has 15 spare minutes.',
    sittings: [{ id: 'D', title: 'Cleanups', est: '15 min each', steps: [
      { id: 'D1', text: '161 rows missing Date Added: ask the chat to backfill from row-# neighbors where provable, flag the rest.' },
      { id: 'D2', text: '~120 May-24 rows missing Writer: confirm the overnight fill run covered them; queue the leftovers.' },
    ]}]},
  { code: 'E', title: 'The Final Gate', est: 'declare victory properly', accent: 'red',
    blurb: 'When every fingerprint is resolved, close it out cleanly so the win is permanent.',
    sittings: [{ id: 'E', title: 'Final gate', est: 'one session', steps: [
      { id: 'E1', text: 'Run the full validator one last time.' },
      { id: 'E2', text: 'Every check passes OR every failure has a written accepted-reason.' },
      { id: 'E3', text: 'Save as a new VALIDATED file with today’s timestamp.' },
      { id: 'E4', text: 'Add the Integrity Log entry: "Data confidence achieved — all fingerprints resolved."' },
      { id: 'E5', text: 'Rebase BOTH sessions (Chat + Code) on the new file.' },
      { id: 'E6', text: 'Go list the eBay Phase 1 books. The data is no longer the excuse.' },
    ]}]},
];
const TRIPWIRES = [
  'Row count moved by a number nobody predicted → STOP, ask for a diff.',
  'Duplicate count went UP after a purge → STOP.',
  'A box total jumped ±10 that wasn’t part of the batch → STOP.',
  'A check that passed before now fails → STOP.',
  'Two runs disagree on the same file → demand the row-level diff, never a theory.',
];

// ── Write ────────────────────────────────────────────────────────────────────
const data = {
  source: xlsxFiles[0].f,
  generated: new Date().toISOString().slice(0, 10),
  totalRows,
  dupe: { groups: dupeGroups, rows: dupeRows, excess: dupeRows - dupeGroups },
  clone: { groups: cloneGroups, rows: cloneRows, excess: cloneRows - cloneGroups },
  overCap,
  boxes,
  guide: GUIDE,
  tripwires: TRIPWIRES,
};
const js = `// AUTO-GENERATED quest data — source: ${data.source} (${totalRows} rows) · generated ${data.generated}\n`
  + `// Regenerate with: node gen_quest_data.mjs\n`
  + `window.QUEST_DATA = ${JSON.stringify(data, null, 1)};\n`;
writeFileSync(OUT, js, 'utf8');
console.log(`Written: ${OUT}`);
console.log(`  ${boxes.length} boxes · ${dupeGroups} dup groups / ${dupeRows} rows · ${cloneGroups} clone groups · ${overCap.length} over-capacity`);
