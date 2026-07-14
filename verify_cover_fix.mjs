/**
 * verify_cover_fix.mjs — Before/after report for the covers.ts scoring fix.
 * Run from: ~/marshallcomics/
 *
 * Re-scores the 66 entries from a flagged-covers export against the local
 * api-server (which must be running with COMIC_VINE_API_KEY set), forcing a
 * fresh Comic Vine lookup for each (refresh=1, bypasses cache), and prints a
 * before/after table plus a JSON report.
 *
 * "Before" comes from a snapshot of covers.json taken prior to the fix
 * (covers_before_snapshot.json) so this script doesn't need to guess what
 * changed vs. what was already there.
 *
 * Usage:
 *   1. In one terminal: cd artifacts/api-server && pnpm dev
 *   2. In another:      node verify_cover_fix.mjs
 *
 * Options:
 *   --flagged <path>   Defaults to ~/Downloads/flagged-covers-2026-07-12-4.json
 *   --before <path>    Defaults to the scratchpad snapshot taken before the fix
 *   --delay <ms>       Delay between requests (default 500ms — well under CV's
 *                      free-tier rate limit for a 66-entry batch)
 */

import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";

const args = process.argv.slice(2);
const argVal = (flag, def) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const FLAGGED_PATH = argVal("--flagged", `${homedir()}/Downloads/flagged-covers-2026-07-12-4.json`);
const BEFORE_PATH  = argVal("--before",  "/private/tmp/claude-501/-Users-robertmarshall/acf3d17c-fe28-4e05-a1c6-199b8f64a1d3/scratchpad/covers_before_snapshot.json");
const DELAY_MS      = Number(argVal("--delay", "500"));
const API_BASE       = process.env.APP_URL || "http://localhost:5001";

const flagged = JSON.parse(readFileSync(FLAGGED_PATH, "utf8"));
const before  = JSON.parse(readFileSync(BEFORE_PATH, "utf8"));
const beforeById = new Map(before.map(b => [b.id, b]));

console.log(`Re-scoring ${flagged.length} entries from ${FLAGGED_PATH}`);
console.log(`Before-snapshot: ${BEFORE_PATH}`);
console.log(`API base: ${API_BASE}\n`);

function beforeUrl(id) {
  const b = beforeById.get(id);
  if (!b) return "(no snapshot)";
  if (b.two_part_value && b.two_part_value !== "__ABSENT__") return b.two_part_value.url ?? "(null)";
  const threePartVals = Object.values(b.three_part_matches || {});
  if (threePartVals.length) return threePartVals.map(v => v?.url ?? "(null)").join(" | ");
  return "(absent)";
}

const results = [];
let changed = 0, stillNull = 0, sameUrl = 0;

for (let i = 0; i < flagged.length; i++) {
  const f = flagged[i];
  const params = new URLSearchParams({
    title: f.Title,
    issue: f.Issue,
    publisher: f.Publisher || "",
    year: f.Year || "",
    volume: "1", // flagged-covers export doesn't carry Volume directly; server
                 // falls back to Year-range scoring regardless
    refresh: "1",
  });

  let after = { cover_url: null, error: null };
  try {
    const res = await fetch(`${API_BASE}/api/covers/search?${params}`);
    if (res.ok) {
      const data = await res.json();
      after = { cover_url: data.cover_url ?? null, match: data.match ?? null };
    } else {
      after = { cover_url: null, error: `HTTP ${res.status}` };
    }
  } catch (err) {
    after = { cover_url: null, error: String(err) };
  }

  const beforeU = beforeUrl(f.id);
  const afterU  = after.cover_url ?? "(null)";
  const isChanged = beforeU !== afterU;
  if (isChanged) changed++;
  else sameUrl++;
  if (afterU === "(null)") stillNull++;

  results.push({
    title: f.Title, issue: f.Issue, year: f.Year,
    before: beforeU, after: afterU, changed: isChanged,
    match: after.match ?? null, error: after.error ?? null,
  });

  console.log(`[${i + 1}/${flagged.length}] ${f.Title} #${f.Issue} (${f.Year})`);
  console.log(`  before: ${beforeU}`);
  console.log(`  after:  ${afterU}${isChanged ? "  ← CHANGED" : ""}${after.error ? `  ERROR: ${after.error}` : ""}`);

  await new Promise(r => setTimeout(r, DELAY_MS));
}

console.log(`\n${"=".repeat(60)}`);
console.log(`Total: ${flagged.length}  Changed: ${changed}  Same: ${sameUrl}  Still null after: ${stillNull}`);
console.log(`${"=".repeat(60)}`);

writeFileSync("cover_fix_report.json", JSON.stringify(results, null, 2));
console.log(`\nFull report written to cover_fix_report.json`);
