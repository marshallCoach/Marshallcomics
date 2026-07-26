import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');

// ── Auto-detect newest xlsx ───────────────────────────────────────────────────
const xlsxFiles = readdirSync('attached_assets')
  .filter(f => f.includes('comics_inventory') && f.endsWith('.xlsx') && !f.startsWith('~$'))
  .map(f => ({ f, mtime: statSync(`attached_assets/${f}`).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);
if (!xlsxFiles.length) { console.error('No comics_inventory*.xlsx found in attached_assets/'); process.exit(1); }
const XLSX_FILE = `attached_assets/${xlsxFiles[0].f}`;
console.log(`Using: ${XLSX_FILE}`);

// ── ExcelJS helpers ───────────────────────────────────────────────────────────
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
    const vals = row.values;
    const arr = [];
    for (let c = 1; c < vals.length; c++) arr.push(cellValueToString(vals[c], defval));
    maxCol = Math.max(maxCol, arr.length);
    rows.push(arr);
  });
  for (const row of rows) while (row.length < maxCol) row.push(defval);
  return rows;
}

// ── Parse existing DATA from box-quest.html ───────────────────────────────────
const HTML_FILE = 'artifacts/comics-inventory/public/box-quest.html';
const htmlContent = readFileSync(HTML_FILE, 'utf8');

function extractDataFromHtml(content) {
  const marker = 'const DATA = ';
  const start = content.indexOf(marker);
  if (start === -1) throw new Error('Could not find const DATA in HTML');
  const jsonStart = start + marker.length;
  let depth = 0, inStr = false, esc = false;
  for (let i = jsonStart; i < content.length; i++) {
    const c = content[i];
    if (esc) { esc = false; continue; }
    if (c === '\\' && inStr) { esc = true; continue; }
    if (c === '"' && !esc) { inStr = !inStr; continue; }
    if (!inStr) {
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return JSON.parse(content.slice(jsonStart, i + 1)); }
    }
  }
  throw new Error('Could not find end of DATA object');
}

const existingData = extractDataFromHtml(htmlContent);
const existingQuests = existingData.quests;

// ── Build series→quest mapping from existing moves ────────────────────────────
// Map: titleLower → quest index
const seriesQuestMap = new Map();
for (let qi = 0; qi < existingQuests.length; qi++) {
  const q = existingQuests[qi];
  for (const move of (q.moves || [])) {
    for (const book of (move.books || [])) {
      const key = book.title.toLowerCase().trim();
      if (!seriesQuestMap.has(key)) seriesQuestMap.set(key, qi);
    }
  }
}

console.log(`Parsed ${existingQuests.length} quests, ${seriesQuestMap.size} series→quest mappings`);

// ── Read Excel inventory ──────────────────────────────────────────────────────
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(XLSX_FILE);

const comicsSheet = wb.worksheets.find(ws => ws.name.startsWith('✅ Clean Inventory'));
if (!comicsSheet) {
  console.error('Cannot find inventory sheet. Available:', wb.worksheets.map(ws => ws.name).join(', '));
  process.exit(1);
}
const allRows = worksheetToArrays(comicsSheet, '');
const headers = allRows[0];

// ── Box → physical location, from Box Summary sheet ───────────────────────────
const boxSummarySheet = wb.worksheets.find(ws => ws.name === 'Box Summary');
const boxLocations = {};
if (boxSummarySheet) {
  const summaryRows = worksheetToArrays(boxSummarySheet, '');
  const sHeaders = summaryRows[0];
  const boxCol = sHeaders.findIndex(h => String(h).trim() === 'Box #');
  const locCol = sHeaders.findIndex(h => String(h).trim() === 'Location');
  if (boxCol !== -1 && locCol !== -1) {
    for (let r = 1; r < summaryRows.length; r++) {
      const boxNum = parseInt(summaryRows[r][boxCol], 10);
      const loc = String(summaryRows[r][locCol] ?? '').trim();
      if (!isNaN(boxNum) && loc) boxLocations[boxNum] = loc;
    }
  }
  console.log(`Read ${Object.keys(boxLocations).length} box locations from Box Summary sheet`);
} else {
  console.warn('Box Summary sheet not found — locations will be unavailable in Box Quest');
}

// ── Box Locations tab → photo-verified zone codes (preferred, added 2507) ─────
// Overrides Box Summary with "Zone Full Name — CODE" (e.g. "Boiler Room — BLR-5")
// for confirmed-real boxes; ghost boxes (36/37/79/97) are absent from this tab.
{
  const blSheet = wb.worksheets.find(ws => ws.name === 'Box Locations');
  if (blSheet) {
    const blRows = worksheetToArrays(blSheet, '');
    const lh = blRows[0];
    const cB = lh.findIndex(h => String(h).trim() === 'Box #');
    const cCode = lh.findIndex(h => String(h).trim() === 'Location Code');
    const cZoneFull = lh.findIndex(h => String(h).trim() === 'Zone Full Name');
    let n = 0;
    for (let r = 1; r < blRows.length; r++) {
      const boxNum = parseInt(blRows[r][cB], 10);
      if (isNaN(boxNum)) continue;
      const code = String(blRows[r][cCode] ?? '').trim();
      const zoneFull = String(blRows[r][cZoneFull] ?? '').trim();
      if (zoneFull || code) { boxLocations[boxNum] = `${zoneFull}${code ? ' — ' + code : ''}`; n++; }
    }
    console.log(`Read ${n} zone codes from Box Locations tab (preferred)`);
  }
}

function col(name) {
  const i = headers.findIndex(h => String(h).trim() === name);
  if (i === -1) console.warn('Missing column:', name);
  return i;
}

const C = {
  title: col('Title'),
  issue: col('Issue #'),
  year:  col('Year'),
  box:   col('Box #'),
  key:   col('Key Issue?'),
  keyWhy: col('Key Issue — Why'),
};

console.log(`Column indices: title=${C.title} issue=${C.issue} year=${C.year} box=${C.box}`);

// ── Parse all comics ──────────────────────────────────────────────────────────
const comics = [];
for (let r = 1; r < allRows.length; r++) {
  const row = allRows[r];
  const title = String(row[C.title] ?? '').trim();
  if (!title) continue;
  const issue = String(row[C.issue] ?? '').trim();
  const year  = String(row[C.year]  ?? '').trim();
  const boxRaw = String(row[C.box]  ?? '').trim();
  const boxNum = parseInt(boxRaw, 10);
  if (!boxRaw || isNaN(boxNum)) continue;
  comics.push({ title, issue, year, box: boxNum });
}

console.log(`Read ${comics.length} comics from inventory`);

// ── Helper: issue number parsing & range compression ─────────────────────────
function parseIssueNum(issue) {
  const s = String(issue).replace(/^#/, '').trim();
  // Handle things like "1A", "1/2", etc — extract leading numeric
  const m = s.match(/^(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : NaN;
}

function compressRanges(issues) {
  // Parse and sort issue numbers
  const nums = issues.map(iss => ({ orig: iss, num: parseIssueNum(iss) }))
    .filter(x => !isNaN(x.num))
    .sort((a, b) => a.num - b.num);

  // Also keep non-numeric ones
  const nonNums = issues.filter(iss => isNaN(parseIssueNum(iss)));

  if (nums.length === 0) return nonNums.map(i => i.replace(/^#/, '#')).join(', ');

  const ranges = [];
  let rangeStart = nums[0], rangeEnd = nums[0];
  for (let i = 1; i < nums.length; i++) {
    if (nums[i].num === rangeEnd.num + 1) {
      rangeEnd = nums[i];
    } else {
      ranges.push([rangeStart, rangeEnd]);
      rangeStart = rangeEnd = nums[i];
    }
  }
  ranges.push([rangeStart, rangeEnd]);

  const parts = ranges.map(([s, e]) => {
    const sn = s.num % 1 === 0 ? Math.round(s.num) : s.num;
    const en = e.num % 1 === 0 ? Math.round(e.num) : e.num;
    if (sn === en) return `#${sn}`;
    return `#${sn}–${en}`;
  });

  if (nonNums.length) parts.push(...nonNums);
  return parts.join(', ');
}

function formatYearRange(years) {
  const ys = years.map(y => parseInt(y, 10)).filter(y => y > 1900);
  if (!ys.length) return '';
  const mn = Math.min(...ys), mx = Math.max(...ys);
  return mn === mx ? String(mn) : `${mn}–${mx}`;
}

// ── Group comics by quest ─────────────────────────────────────────────────────
// For each quest, we need to know which comics belong to it and which boxes
// they are currently in vs target boxes.

// Build per-quest data
const questData = existingQuests.map((q, qi) => {
  const targetSet = new Set(q.targetBoxes);
  return {
    qi,
    name: q.name,
    color: q.color,
    short: q.short,
    pub: q.pub,
    id: q.id,
    targetBoxes: q.targetBoxes,
    spareBoxes: q.spareBoxes || [],
    targets: q.targets,
    clues: q.clues || [],
    targetSet,
    // Map: seriesTitle → { issues in target boxes (box→[issues]), issues in source boxes (box→[issues]) }
    series: new Map(),
  };
});

// Build a lookup: titleLower → questData index
function findQuestForSeries(titleLower) {
  if (seriesQuestMap.has(titleLower)) return seriesQuestMap.get(titleLower);
  return -1;
}

// For each comic, assign to its quest
for (const comic of comics) {
  const key = comic.title.toLowerCase().trim();
  const qi = findQuestForSeries(key);
  if (qi === -1) continue; // Not mapped to any quest — skip

  const qd = questData[qi];
  if (!qd.series.has(key)) {
    qd.series.set(key, { title: comic.title, inTarget: new Map(), inSource: new Map() });
  }
  const sd = qd.series.get(key);

  if (qd.targetSet.has(comic.box)) {
    if (!sd.inTarget.has(comic.box)) sd.inTarget.set(comic.box, []);
    sd.inTarget.get(comic.box).push(comic);
  } else {
    if (!sd.inSource.has(comic.box)) sd.inSource.set(comic.box, []);
    sd.inSource.get(comic.box).push(comic);
  }
}

// ── Ghost boxes: no physical books, skip as source boxes ─────────────────────
// These box numbers exist in inventory records but have no physical presence.
const GHOST_BOXES = new Set([84, 91, 92, 94, 100]);

// ── For each quest, assign each series to ONE home target box ─────────────────
// Then build moves: source_box → home_box

function buildQuestMoves(qd) {
  const targetBoxes = qd.targetBoxes;

  // Count total already assigned to each target box (to balance)
  const targetAssignedCount = new Map(targetBoxes.map(b => [b, 0]));

  // First pass: determine home box for each series
  const seriesHomeBox = new Map(); // titleLower → home box number

  // Count existing in-target issues per series per target box to find "home"
  for (const [key, sd] of qd.series) {
    if (sd.inTarget.size === 0 && sd.inSource.size === 0) continue;

    let homeBox = null;

    if (sd.inTarget.size > 0) {
      // Pick target box with most issues of this series
      let bestBox = null, bestCount = 0;
      for (const [box, issues] of sd.inTarget) {
        if (issues.length > bestCount) { bestCount = issues.length; bestBox = box; }
      }
      homeBox = bestBox;
    } else {
      // No issues in any target box — pick target with fewest assigned
      let minBox = targetBoxes[0], minCount = Infinity;
      for (const box of targetBoxes) {
        const cnt = targetAssignedCount.get(box) ?? 0;
        if (cnt < minCount) { minCount = cnt; minBox = box; }
      }
      homeBox = minBox;
    }

    seriesHomeBox.set(key, homeBox);

    // Count total issues for this series to update assigned count
    const totalCount = [...sd.inTarget.values()].flat().length +
                       [...sd.inSource.values()].flat().length;
    targetAssignedCount.set(homeBox, (targetAssignedCount.get(homeBox) ?? 0) + totalCount);
  }

  // Build moves: only issues in source boxes (not already in home target box)
  // Group by from→to
  const moveMap = new Map(); // `from,to` → Map<titleLower, issues[]>

  for (const [key, sd] of qd.series) {
    const homeBox = seriesHomeBox.get(key);
    if (homeBox == null) continue;

    for (const [fromBox, issues] of sd.inSource) {
      if (fromBox === homeBox) continue; // Already in right place
      if (GHOST_BOXES.has(fromBox)) continue; // Skip ghost boxes
      const moveKey = `${fromBox},${homeBox}`;
      if (!moveMap.has(moveKey)) moveMap.set(moveKey, new Map());
      const booksInMove = moveMap.get(moveKey);
      if (!booksInMove.has(key)) booksInMove.set(key, { title: sd.title, issues: [] });
      booksInMove.get(key).issues.push(...issues);
    }

    // Also move issues from wrong target boxes to home box
    for (const [fromBox, issues] of sd.inTarget) {
      if (fromBox === homeBox) continue;
      if (GHOST_BOXES.has(fromBox)) continue; // Skip ghost boxes
      const moveKey = `${fromBox},${homeBox}`;
      if (!moveMap.has(moveKey)) moveMap.set(moveKey, new Map());
      const booksInMove = moveMap.get(moveKey);
      if (!booksInMove.has(key)) booksInMove.set(key, { title: sd.title, issues: [] });
      booksInMove.get(key).issues.push(...issues);
    }
  }

  // ── Micro-move batching ───────────────────────────────────────────────────────
  // Group all micro-moves (≤3 books) from the same source box into one sweep:
  // Instead of separate trips (box15→box3, box15→box7, box15→box12 each with 1 book),
  // collect everything into a single "grab all from box15" move to the most common dest.
  const microThreshold = 3;
  const fromBoxMicroBooks = new Map(); // fromBox → Map<titleKey, bookData>
  const microDestCount = new Map(); // fromBox → Map<toBox, count>

  for (const [moveKey, booksMap] of moveMap) {
    const totalBooks = [...booksMap.values()].reduce((s, b) => s + b.issues.length, 0);
    if (totalBooks <= microThreshold) {
      const [from, to] = moveKey.split(',').map(Number);
      if (!fromBoxMicroBooks.has(from)) fromBoxMicroBooks.set(from, new Map());
      if (!microDestCount.has(from)) microDestCount.set(from, new Map());
      for (const [key, bd] of booksMap) {
        fromBoxMicroBooks.get(from).set(key, { ...bd, toBox: to });
      }
      const dc = microDestCount.get(from);
      dc.set(to, (dc.get(to) ?? 0) + totalBooks);
      moveMap.delete(moveKey);
    }
  }

  // Re-add batched micro-moves, all going to the most common destination from each source
  for (const [fromBox, booksMap] of fromBoxMicroBooks) {
    const dc = microDestCount.get(fromBox);
    let bestDest = null, bestCount = 0;
    for (const [dest, cnt] of dc) {
      if (cnt > bestCount) { bestCount = cnt; bestDest = dest; }
    }
    const moveKey = `${fromBox},${bestDest}`;
    if (!moveMap.has(moveKey)) moveMap.set(moveKey, new Map());
    const existing = moveMap.get(moveKey);
    for (const [key, bd] of booksMap) {
      if (!existing.has(key)) existing.set(key, { title: bd.title, issues: [] });
      existing.get(key).issues.push(...bd.issues);
    }
  }

  // Convert to moves array
  const moves = [];
  let bookIdxCounter = 0;

  for (const [moveKey, booksMap] of moveMap) {
    const [from, to] = moveKey.split(',').map(Number);
    const totalCount = [...booksMap.values()].reduce((s, b) => s + b.issues.length, 0);

    const books = [];
    for (const [key, bd] of booksMap) {
      const issues = bd.issues.map(c => c.issue);
      const years = bd.issues.map(c => c.year);
      const range = compressRanges(issues);
      const yearStr = formatYearRange(years);
      const pct = Math.round((bd.issues.length / totalCount) * 100) / 100;

      // Generate id: qXXXbYY format using quest's short name
      const shortId = qd.short.replace(/[^a-zA-Z]/g, '').slice(0, 8);
      const bid = `q${shortId}b${bookIdxCounter++}`;

      books.push({
        title: bd.title,
        range,
        year: yearStr,
        count: bd.issues.length,
        pct,
        id: bid,
      });
    }

    // Sort books by count descending
    books.sort((a, b) => b.count - a.count);

    moves.push({
      from,
      to,
      count: totalCount,
      fromNew: false,
      toNew: false,
      books,
      pct: 1,
    });
  }

  // Sort moves by from box
  moves.sort((a, b) => a.from - b.from || a.to - b.to);

  return moves;
}

// ── Build all quest objects ───────────────────────────────────────────────────
const prevTotals = { moves: 0, lines: 0 };
for (const q of existingQuests) {
  prevTotals.moves += q.moves.length;
  prevTotals.lines += q.moves.reduce((s, m) => s + m.books.length, 0);
}

const newQuests = [];
let totalMoves = 0, totalLines = 0;

for (const qd of questData) {
  const prevQ = existingQuests[qd.qi];

  const moves = buildQuestMoves(qd);
  const moveBooks = moves.reduce((s, m) => s + m.count, 0);
  const lineCount = moves.reduce((s, m) => s + m.books.length, 0);

  // Compute total: all comics assigned to this quest
  let total = 0;
  for (const [, sd] of qd.series) {
    total += [...sd.inTarget.values()].flat().length +
             [...sd.inSource.values()].flat().length;
  }

  const prevMoves = prevQ.moves.length;
  const prevLines = prevQ.moves.reduce((s, m) => s + m.books.length, 0);

  console.log(`Quest: ${qd.name} — ${moves.length} moves, ${lineCount} lines (was ${prevMoves} moves, ${prevLines} lines)`);

  totalMoves += moves.length;
  totalLines += lineCount;

  newQuests.push({
    name: qd.name,
    color: qd.color,
    short: qd.short,
    pub: qd.pub,
    id: qd.id,
    total,
    targets: qd.targets,
    targetBoxes: qd.targetBoxes,
    spareBoxes: qd.spareBoxes,
    moves,
    moveBooks,
    lineCount,
    clues: qd.clues,
  });
}

console.log(`\nTotal: ${totalMoves} moves, ${totalLines} lines (was ${prevTotals.moves} moves, ${prevTotals.lines} lines)`);

// ── Write updated DATA back to HTML ──────────────────────────────────────────
const newData = { quests: newQuests, locations: boxLocations };
const newDataStr = JSON.stringify(newData);

// Find the extent of the old DATA object in HTML
const marker = 'const DATA = ';
const markerStart = htmlContent.indexOf(marker);
const jsonStart = markerStart + marker.length;

let depth = 0, inStr = false, esc = false;
let jsonEnd = jsonStart;
for (let i = jsonStart; i < htmlContent.length; i++) {
  const c = htmlContent[i];
  if (esc) { esc = false; continue; }
  if (c === '\\' && inStr) { esc = true; continue; }
  if (c === '"' && !esc) { inStr = !inStr; continue; }
  if (!inStr) {
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { jsonEnd = i + 1; break; } }
  }
}

const newHtml = htmlContent.slice(0, jsonStart) + newDataStr + htmlContent.slice(jsonEnd);
writeFileSync(HTML_FILE, newHtml, 'utf8');
console.log(`Written: ${HTML_FILE}`);
