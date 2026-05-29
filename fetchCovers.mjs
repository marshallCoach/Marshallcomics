/**
 * BlackReadBrown — Cover Batch Fetch Script
 * Usage: node fetchCovers.mjs [--limit 190] [--start 0]
 *
 * Fetches real cover URLs from Comic Vine via the /api/covers/search proxy.
 * Saves results to covers.json (title|||issue -> { url, large, date }).
 * Run repeatedly — skips already-cached entries. Rate: ~190/hr on free tier.
 *
 * Example (run once per hour):
 *   node fetchCovers.mjs --limit 190
 *   node fetchCovers.mjs --limit 190 --start 190
 *   ...
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { DATA3 } from "./artifacts/comics-inventory/src/data/data3.js";

// ── Config ────────────────────────────────────────────────────────────────────
const CACHE_FILE = "./covers.json";
const API_BASE   = process.env.APP_URL || "http://localhost:80";

const args      = process.argv.slice(2);
const limitIdx  = args.indexOf("--limit");
const startIdx  = args.indexOf("--start");
const limit     = limitIdx >= 0 ? parseInt(args[limitIdx + 1] ?? "190") : 190;
const startAt   = startIdx >= 0 ? parseInt(args[startIdx + 1] ?? "0")   : 0;
const onlyKeys  = args.includes("--keys-only");
const delay    = 300; // ms between requests (~200/hr safe margin)

// ── Load cache ────────────────────────────────────────────────────────────────
let cache = {};
if (existsSync(CACHE_FILE)) {
  try { cache = JSON.parse(readFileSync(CACHE_FILE, "utf-8")); } catch {}
}
console.log(`Loaded ${Object.keys(cache).length} cached covers.`);

// ── Build fetch queue ─────────────────────────────────────────────────────────
const comics = DATA3.comics;
const queue = comics
  .filter(c => !onlyKeys || (c.Key || "").toUpperCase() === "YES")
  .filter(c => !cache[`${c.Title}|||${c.Issue}`])
  .slice(startAt, startAt + limit);

console.log(`Queue: ${queue.length} comics to fetch (limit=${limit}, start=${startAt})`);
if (queue.length === 0) { console.log("Nothing to fetch — all done or increase --start."); process.exit(0); }

// ── Fetch loop ────────────────────────────────────────────────────────────────
let fetched = 0, found = 0, missed = 0;

for (const c of queue) {
  const cacheKey = `${c.Title}|||${c.Issue}`;
  const params   = new URLSearchParams({
    title: c.Title,
    issue: c.Issue || "",
    publisher: c.Publisher || "",
    year: c.Year || "",
  });

  try {
    const res  = await fetch(`${API_BASE}/api/covers/search?${params}`);
    const data = await res.json();

    if (data.cover_url) {
      cache[cacheKey] = { url: data.cover_url, large: data.large_url, date: data.match?.cover_date };
      found++;
    } else {
      cache[cacheKey] = null; // explicitly mark as not found
      missed++;
    }

    fetched++;
    if (fetched % 10 === 0) {
      writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
      process.stdout.write(`\r[${fetched}/${queue.length}] found=${found} missed=${missed}   `);
    }
  } catch (err) {
    console.error(`\nError fetching ${c.Title} #${c.Issue}:`, err.message);
    missed++;
  }

  await new Promise(r => setTimeout(r, delay));
}

writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
console.log(`\nDone. Fetched ${fetched}, found ${found} covers, ${missed} missed.`);
console.log(`Cache now has ${Object.keys(cache).length} entries.`);
console.log(`Run again with --start ${startAt + fetched} to continue.`);
