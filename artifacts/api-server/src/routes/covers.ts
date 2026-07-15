import { Router, type IRouter } from "express";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const router: IRouter = Router();

const CV_BASE  = "https://comicvine.gamespot.com/api";
const API_KEY  = process.env["COMIC_VINE_API_KEY"] ?? "";
// covers.json lives at the project root (two levels up from artifacts/api-server)
const CACHE_PATH = resolve(process.cwd(), "../../covers.json");

// ── Disk cache (covers.json) ──────────────────────────────────────────────────
// Shape: { "Title|||Issue": { url, large, date, volume_id?, volume_name? } | null }
// volume_id/volume_name are Comic Vine's own volume identity for the matched
// issue — captured from the SAME response as the cover (zero extra API calls) so
// brb_reconcile_volumes.py can cluster/auto-number volumes without a new pass.
// volume_start_year is captured only if CV happens to include it (the issue
// search usually doesn't); chronological ordering uses `date` (cover_date).
interface CacheEntry {
  url: string | null; large: string | null; date: string;
  volume_id?: number | null; volume_name?: string | null; volume_start_year?: number | null;
}

let diskCache: Record<string, CacheEntry | null> = {};
let cacheLoaded = false;

function loadCache() {
  if (cacheLoaded) return;
  try {
    diskCache = JSON.parse(readFileSync(CACHE_PATH, "utf8"));
  } catch {
    diskCache = {};
  }
  cacheLoaded = true;
}

function saveCache() {
  try {
    writeFileSync(CACHE_PATH, JSON.stringify(diskCache, null, 2), "utf8");
  } catch {
    // Non-fatal — cache write failures don't affect the response
  }
}

// Title|||Issue|||Volume is the standard key for every new cache write -
// disambiguates same-title-different-printing cases that a bare Title|||Issue
// key silently collides on. Volume defaults to "1" when the row doesn't have
// one, matching fetchCovers.mjs's own coverKey() convention. legacyKey() is
// kept only to read entries written before this change, not for new writes.
function diskKey(title: string, issue: string, volume?: string) {
  const vol = String(volume || "1").trim();
  return `${title}|||${issue}|||${vol}`;
}
function legacyKey(title: string, issue: string) {
  return `${title}|||${issue}`;
}

// ── Comic Vine helpers ────────────────────────────────────────────────────────
function cvParams(extra: Record<string, string> = {}) {
  const p = new URLSearchParams({ api_key: API_KEY, format: "json", ...extra });
  return p.toString();
}

// The inventory's Year field is often a range ("2012-2015", "2012–2015" with
// an en-dash), not a single year - pull out every 4-digit run and use the
// min/max instead of relying on exact string equality, which never matches
// a range against Comic Vine's single cover_date year.
function parseYearRange(year: string | undefined): [number, number] | null {
  const matches = String(year || "").match(/\d{4}/g);
  if (!matches) return null;
  const nums = matches.map(Number).filter(n => n > 1900 && n < 2100);
  if (!nums.length) return null;
  return [Math.min(...nums), Math.max(...nums)];
}

// Comic Vine volume names often carry the run's start year in parens, e.g.
// "Black Panther (2016)" - used as a secondary tiebreaker alongside the
// cover_date check, since cover_date is sometimes blank on CV's own records.
function volumeStartYear(volumeName: string | undefined): number | null {
  const s = String(volumeName || "");
  const paren = s.match(/\((\d{4})\)/);
  const any   = s.match(/\d{4}/);
  const m = paren?.[1] ?? any?.[0];
  if (!m) return null;
  const n = parseInt(m, 10);
  return n > 1900 && n < 2100 ? n : null;
}

// ── Two-step volume-scoped lookup ──────────────────────────────────────────────
// The free-text /search/ endpoint returns <=10 issues with no series scoping, so
// for common titles the correct issue often isn't in the list at all — and no
// re-scoring can pick a candidate that isn't there. This resolves the exact CV
// VOLUME first (by name + year + publisher), then fetches the issue INSIDE that
// volume. That's the accurate path; the free-text search stays as a fallback so
// this can only improve matches, never regress them.
interface ResolvedVolume { id: number; name: string; start_year: number | null; }

// Resolved volumes are cached in-memory per server run, keyed by normalized
// title + start-year, so a title with 20 issues costs one /volumes/ call, not 20.
const volumeCache = new Map<string, ResolvedVolume | null>();
function normTitle(t: string): string {
  return String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
async function cvFetch(url: string): Promise<any | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "BlackReadBrown-Comics/1.0" } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function resolveVolume(title: string, yearRange: [number, number] | null, publisher: string): Promise<ResolvedVolume | null> {
  const cacheKey = `${normTitle(title)}|${yearRange ? yearRange[0] : ""}`;
  if (volumeCache.has(cacheKey)) return volumeCache.get(cacheKey)!;

  const url = `${CV_BASE}/volumes/?${cvParams({
    filter: `name:${title}`,
    field_list: "id,name,start_year,count_of_issues,publisher",
    limit: "50",
  })}`;
  const data = await cvFetch(url);
  const results: Array<{ id: number; name: string; start_year?: string | number; publisher?: { name?: string } }> = data?.results ?? [];

  const tnorm = normTitle(title);
  let best: ResolvedVolume | null = null;
  let bestScore = -Infinity;
  for (const v of results) {
    const vnorm = normTitle(v.name || "");
    let score = 0;
    if (vnorm === tnorm) score += 20;                                  // exact name match
    else if (vnorm.includes(tnorm) || tnorm.includes(vnorm)) score += 6;
    else continue;                                                     // unrelated name — skip
    const sy = v.start_year != null ? parseInt(String(v.start_year), 10) : NaN;
    if (yearRange && !isNaN(sy)) {
      if (sy >= yearRange[0] - 1 && sy <= yearRange[1] + 1) score += 15;
      else score -= Math.min(10, Math.abs(sy - yearRange[0]));
    }
    if (publisher && v.publisher?.name && v.publisher.name.toLowerCase().includes(publisher.toLowerCase())) score += 4;
    if (score > bestScore) { bestScore = score; best = { id: v.id, name: v.name, start_year: isNaN(sy) ? null : sy }; }
  }
  // Require a genuine name match (exact = 20, or contains + year corroboration).
  const resolved = best && bestScore >= 20 ? best : null;
  volumeCache.set(cacheKey, resolved);
  return resolved;
}

async function fetchIssueInVolume(vol: ResolvedVolume, issueNum: string): Promise<{ image_url: string | null; large_url: string | null; cover_date: string } | null> {
  const url = `${CV_BASE}/issues/?${cvParams({
    filter: `volume:${vol.id},issue_number:${issueNum}`,
    field_list: "id,issue_number,image,cover_date",
    limit: "1",
  })}`;
  const data = await cvFetch(url);
  const r = (data?.results ?? [])[0];
  if (!r?.image) return null;
  return {
    image_url: r.image.medium_url ?? r.image.small_url ?? null,
    large_url: r.image.super_url ?? r.image.medium_url ?? null,
    cover_date: r.cover_date ?? "",
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────
router.get("/covers/search", async (req, res) => {
  // Never allow browser caching — these are dynamic API responses
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");

  const { title, issue, publisher, year, volume } = req.query as Record<string, string>;
  if (!title) { res.status(400).json({ error: "title required" }); return; }

  loadCache();
  const key    = diskKey(title, issue ?? "", volume);
  const legacy = legacyKey(title, issue ?? "");

  // ── Force-refresh: delete cached entry (either key form) so it re-fetches ─
  if (req.query["refresh"] === "1") {
    let cleared = false;
    if (Object.prototype.hasOwnProperty.call(diskCache, key))    { delete diskCache[key];    cleared = true; }
    if (Object.prototype.hasOwnProperty.call(diskCache, legacy)) { delete diskCache[legacy]; cleared = true; }
    if (cleared) saveCache();
  }

  // ── Cache hit — check the 3-part key first, then fall back to the legacy
  //    2-part key so entries written before this change don't get needlessly
  //    re-fetched. No API key needed either way.
  const hitKey = Object.prototype.hasOwnProperty.call(diskCache, key) ? key
    : Object.prototype.hasOwnProperty.call(diskCache, legacy) ? legacy
    : null;
  if (hitKey) {
    const cached = diskCache[hitKey];
    if (cached === null) {
      res.json({ cover_url: null, large_url: null, match: null, candidates: [], cached: true });
    } else {
      res.json({
        cover_url: cached.url, large_url: cached.large,
        match: (cached.volume_id != null || cached.volume_name != null)
          ? { volume_id: cached.volume_id ?? null, volume_name: cached.volume_name ?? null, cover_date: cached.date }
          : null,
        candidates: [], cached: true,
      });
    }
    return;
  }

  // ── Cache miss → Comic Vine ────────────────────────────────────────────────
  if (!API_KEY) {
    res.json({ cover_url: null, large_url: null, match: null, candidates: [], cached: false });
    return;
  }
  try {
    const issueNum  = String(issue || "").replace(/^#/, "").trim();
    const yearRange = parseYearRange(year);

    // ── Primary: resolve the exact volume, then fetch the issue inside it ─────
    if (issueNum) {
      const vol = await resolveVolume(title, yearRange, publisher);
      if (vol) {
        const iss = await fetchIssueInVolume(vol, issueNum);
        if (iss && iss.image_url) {
          diskCache[key] = {
            url: iss.image_url, large: iss.large_url, date: iss.cover_date,
            volume_id: vol.id, volume_name: vol.name, volume_start_year: vol.start_year,
          };
          saveCache();
          res.json({
            cover_url: iss.image_url, large_url: iss.large_url,
            match: { volume_id: vol.id, volume_name: vol.name, volume_start_year: vol.start_year, cover_date: iss.cover_date, source: "volume-scoped" },
            candidates: [], cached: false,
          });
          return;
        }
      }
    }

    // ── Fallback: free-text issue search + scoring ───────────────────────────
    const q = `${title} ${issue || ""}`.trim();
    const searchUrl = `${CV_BASE}/search/?${cvParams({
      query: q,
      resources: "issue",
      field_list: "id,name,issue_number,volume,image,cover_date",
      limit: "10",
    })}`;

    const resp = await fetch(searchUrl, {
      headers: { "User-Agent": "BlackReadBrown-Comics/1.0" },
    });
    if (!resp.ok) { res.status(resp.status).json({ error: "Comic Vine error" }); return; }

    const data = await resp.json() as {
      results?: Array<{
        id: number;
        name: string;
        issue_number: string;
        volume?: { id?: number; name?: string; start_year?: number | string };
        image?: { medium_url?: string; small_url?: string; super_url?: string };
        cover_date?: string;
      }>;
    };

    const results = (data.results ?? []).map(r => ({
      id:           r.id,
      name:         r.name,
      issue_number: r.issue_number,
      volume:       r.volume?.name ?? "",           // name — used by scoring below
      volume_id:    r.volume?.id ?? null,           // CV's volume identity (for reconciliation)
      volume_start_year: r.volume?.start_year != null ? parseInt(String(r.volume.start_year), 10) : null,
      image_url:    r.image?.medium_url ?? r.image?.small_url ?? null,
      large_url:    r.image?.super_url  ?? r.image?.medium_url ?? null,
      cover_date:   r.cover_date ?? "",
    }));

    const scored = results.map(r => {
      let score = 0;
      const rVol       = (r.volume || "").toLowerCase();
      const rName      = (r.name   || "").toLowerCase();
      const titleLower = (title    || "").toLowerCase();
      if (rVol.includes(titleLower) || titleLower.includes(rVol)) score += 10;
      if (rName.toLowerCase().includes(titleLower))                score += 3;

      // Issue number: reward a match, but also penalize a confirmed
      // mismatch instead of just withholding the bonus - otherwise a wrong
      // candidate can still win purely on title-substring/publisher when
      // several real CV volumes share the same title and issue numbering.
      const issueExact = !!issueNum && r.issue_number === issueNum;
      const issueLoose = !!issueNum && r.issue_number?.replace(/^0+/, "") === issueNum.replace(/^0+/, "");
      if (issueExact) score += 15;
      if (issueLoose) score += 12;
      if (issueNum && r.issue_number && !issueExact && !issueLoose) score -= 10;

      // Year: the row's Year field is often a range: match if CV's cover_date
      // falls anywhere inside it (inclusive), not exact string equality.
      // Weighted high enough to outweigh a tied issue+title match from a
      // wrong volume - Year is the only signal that distinguishes "which
      // physical run is this" on long-running titles with 3+ real volumes.
      if (yearRange) {
        const coverYear = r.cover_date ? parseInt(r.cover_date.slice(0, 4), 10) : NaN;
        if (!isNaN(coverYear) && coverYear >= yearRange[0] && coverYear <= yearRange[1]) score += 20;

        // Secondary tiebreaker: CV volume names often carry their start year
        // in parens ("Black Panther (2016)") - a corroborating signal for
        // cases where cover_date itself is blank on CV's record.
        const volYear = volumeStartYear(r.volume);
        if (volYear !== null && volYear >= yearRange[0] - 1 && volYear <= yearRange[1]) score += 3;
      }

      if (publisher) {
        const rPub = rVol + rName;
        if (rPub.toLowerCase().includes((publisher || "").toLowerCase())) score += 2;
      }
      return { ...r, score };
    }).sort((a, b) => b.score - a.score);

    const best = scored[0] ?? null;

    // Write result to disk cache under the new 3-part key (null if nothing
    // matched). Legacy 2-part entries are read but never written going
    // forward.
    diskCache[key] = best
      ? { url: best.image_url ?? null, large: best.large_url ?? null, date: best.cover_date,
          volume_id: best.volume_id, volume_name: best.volume || null, volume_start_year: best.volume_start_year }
      : null;
    saveCache();

    res.json({
      cover_url:  best?.image_url  ?? null,
      large_url:  best?.large_url  ?? null,
      match:      best ? { id: best.id, name: best.name, issue: best.issue_number, volume: best.volume, volume_id: best.volume_id, volume_name: best.volume || null, volume_start_year: best.volume_start_year, cover_date: best.cover_date } : null,
      candidates: scored.slice(0, 5).map(({ score: _s, ...r }) => r),
      cached:     false,
    });
  } catch (err) {
    req.log.error({ err }, "Comic Vine search error");
    res.status(500).json({ error: "Search failed" });
  }
});

// ── Manually set a cover (user-confirmed correct match) ───────────────────────
router.post("/covers/set", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const { title, issue, volume, url, large } = req.body as { title?: string; issue?: string; volume?: string; url?: string | null; large?: string | null };
  if (!title) { res.status(400).json({ error: "title required" }); return; }

  loadCache();
  const key = diskKey(title, issue ?? "", volume);
  diskCache[key] = { url: url ?? null, large: large ?? null, date: new Date().toISOString().slice(0, 10) };
  saveCache();
  res.json({ ok: true });
});

export default router;
