/**
 * BlackReadBrown — Cover Batch Fetch Script
 * Usage: pnpm exec tsx fetchCovers.mjs [options]
 *
 * Fetches cover URLs from Comic Vine via the /api/covers/search proxy.
 * Saves results to covers.json (title|||issue -> { url, large, date } | null).
 * Run repeatedly with increasing --start to page through the full inventory.
 *
 * Comic Vine free-tier allows ~200 requests/hour (1 per 18s).
 * The script auto-detects rate limiting (420/429) and pauses 65s before
 * continuing. Use --overnight to set the correct delay automatically.
 *
 * Options:
 *   --limit N        Comics to fetch this run (default 190)
 *   --start N        Skip first N un-cached comics (default 0)
 *   --keys-only      Only fetch key issues
 *   --retry-nulls    Re-queue comics cached as null (e.g. after prior rate-limit
 *                    errors were incorrectly saved as "not found")
 *   --delay MS       Override ms between requests (default 300)
 *   --overnight      Sets --limit 1500 and --delay 19000 (stays within
 *                    Comic Vine 200/hr; runs ~8 hours unattended)
 *
 * Example workflow (overnight run):
 *   pnpm exec tsx fetchCovers.mjs --overnight
 *   # → fetches up to 1500 comics at 1 per 19s (~8 hrs, never hits rate limit)
 *
 *   # If prior batches were all rate-limited (found=0), retry the bad nulls:
 *   pnpm exec tsx fetchCovers.mjs --overnight --retry-nulls
 *
 * Quick test (hits rate limit after ~200 but good for small batches):
 *   pnpm exec tsx fetchCovers.mjs --limit 190
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { DATA3 } from "./artifacts/comics-inventory/src/data/data3.js";

// ── Config ────────────────────────────────────────────────────────────────────
const CACHE_FILE = "./covers.json";
const API_BASE   = process.env.APP_URL || "http://localhost:80";

const args         = process.argv.slice(2);
const limitIdx     = args.indexOf("--limit");
const startIdx     = args.indexOf("--start");
const delayIdx     = args.indexOf("--delay");
const overnight    = args.includes("--overnight");
const onlyKeys     = args.includes("--keys-only");
const retryNulls   = args.includes("--retry-nulls");

// --overnight: 19s delay stays within Comic Vine's 200/hr; 1500 limit ≈ 8 hrs
const limit    = limitIdx >= 0 ? parseInt(args[limitIdx + 1] ?? "190") : overnight ? 1500 : 190;
const startAt  = startIdx >= 0 ? parseInt(args[startIdx + 1] ?? "0")   : 0;
const delayMs  = delayIdx >= 0 ? parseInt(args[delayIdx + 1] ?? "300") : overnight ? 19_000 : 300;

// ── Load cache ────────────────────────────────────────────────────────────────
let cache = {};
if (existsSync(CACHE_FILE)) {
  try { cache = JSON.parse(readFileSync(CACHE_FILE, "utf-8")); } catch {}
}
const nullsBefore = Object.values(cache).filter(v => v === null).length;
const urlsBefore  = Object.values(cache).filter(v => v !== null).length;
console.log(`Loaded ${Object.keys(cache).length} cached covers (${urlsBefore} with URL, ${nullsBefore} null/missed).`);

// ── Build fetch queue ─────────────────────────────────────────────────────────
// BUG FIX: use `in` operator — !cache[key] passes null entries (truthy for !null)
// which caused already-missed comics to be re-queued on every run.
const comics = DATA3.comics;
const queue = comics
  .filter(c => !onlyKeys || (c.Key || "").toUpperCase() === "YES")
  .filter(c => {
    const key = `${c.Title}|||${c.Issue}`;
    if (!(key in cache)) return true;          // never fetched → include
    if (retryNulls && cache[key] === null) return true;  // retry flag → re-queue nulls
    return false;                               // already has a result → skip
  })
  .slice(startAt, startAt + limit);

if (retryNulls) {
  console.log(`--retry-nulls: null entries will be re-fetched this run.`);
}
console.log(`Queue: ${queue.length} comics to fetch (limit=${limit}, start=${startAt}, delay=${delayMs}ms)`);
if (queue.length === 0) {
  console.log("Nothing to fetch — all done! Try --start N to continue, or --retry-nulls to redo missed comics.");
  process.exit(0);
}

// ── Fetch loop ────────────────────────────────────────────────────────────────
let fetched = 0, found = 0, missed = 0, errors = 0;

for (const c of queue) {
  const cacheKey = `${c.Title}|||${c.Issue}`;
  const params   = new URLSearchParams({
    title:     c.Title,
    issue:     c.Issue     || "",
    publisher: c.Publisher || "",
    year:      c.Year      || "",
  });

  try {
    const res = await fetch(`${API_BASE}/api/covers/search?${params}`);

    // ── Rate limit / server error — do NOT cache, just back off ──────────────
    if (!res.ok) {
      errors++;
      const body = await res.json().catch(() => ({}));
      process.stdout.write(`\n  [HTTP ${res.status}] ${c.Title} #${c.Issue}: ${body.error ?? "server error"} (not cached)`);

      if (res.status === 420 || res.status === 429) {
        console.log("\n  Rate limited by Comic Vine — pausing 65 seconds...");
        await new Promise(r => setTimeout(r, 65_000));
      } else {
        // Other server errors: short backoff then continue
        await new Promise(r => setTimeout(r, delayMs * 3));
      }
      continue; // skip cache write + fetched count — comic stays un-cached for next run
    }

    const data = await res.json();
    fetched++;

    if (data.cover_url) {
      cache[cacheKey] = {
        url:   data.cover_url,
        large: data.large_url  ?? null,
        date:  data.match?.cover_date ?? "",
      };
      found++;
    } else {
      // Genuine Comic Vine miss (API responded OK but found nothing)
      cache[cacheKey] = null;
      missed++;
    }

    if (fetched % 10 === 0) {
      writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    }
    process.stdout.write(`\r[${fetched + errors}/${queue.length}] found=${found} missed=${missed} errors=${errors}   `);

  } catch (err) {
    errors++;
    process.stdout.write(`\n  [NET ERR] ${c.Title} #${c.Issue}: ${err.message} (not cached)`);
  }

  await new Promise(r => setTimeout(r, delayMs));
}

writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));

const urlsAfter = Object.values(cache).filter(v => v !== null).length;
console.log(`\nDone. Fetched ${fetched}, found ${found} covers, ${missed} genuine misses, ${errors} errors (not cached).`);
console.log(`Cache: ${Object.keys(cache).length} total entries (${urlsAfter} with URL).`);
if (errors > 0) {
  console.log(`  ${errors} error responses were NOT cached — run again to retry them.`);
}
if (fetched > 0) {
  console.log(`Run again with --start ${startAt + fetched} to continue.`);
}
