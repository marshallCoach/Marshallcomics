import { Router, type IRouter } from "express";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const router: IRouter = Router();

const CV_BASE  = "https://comicvine.gamespot.com/api";
const API_KEY  = process.env["COMIC_VINE_API_KEY"] ?? "";
// covers.json lives at the project root (two levels up from artifacts/api-server)
const CACHE_PATH = resolve(process.cwd(), "../../covers.json");

// ── Disk cache (covers.json) ──────────────────────────────────────────────────
// Shape: { "Title|||Issue": { url, large, date } | null }
interface CacheEntry { url: string | null; large: string | null; date: string }

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
      res.json({ cover_url: cached.url, large_url: cached.large, match: null, candidates: [], cached: true });
    }
    return;
  }

  // ── Cache miss → Comic Vine ────────────────────────────────────────────────
  if (!API_KEY) {
    res.json({ cover_url: null, large_url: null, match: null, candidates: [], cached: false });
    return;
  }
  try {
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
        volume?: { name: string };
        image?: { medium_url?: string; small_url?: string; super_url?: string };
        cover_date?: string;
      }>;
    };

    const results = (data.results ?? []).map(r => ({
      id:           r.id,
      name:         r.name,
      issue_number: r.issue_number,
      volume:       r.volume?.name ?? "",
      image_url:    r.image?.medium_url ?? r.image?.small_url ?? null,
      large_url:    r.image?.super_url  ?? r.image?.medium_url ?? null,
      cover_date:   r.cover_date ?? "",
    }));

    const issueNum  = String(issue || "").replace(/^#/, "").trim();
    const yearRange = parseYearRange(year);
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
      ? { url: best.image_url ?? null, large: best.large_url ?? null, date: best.cover_date }
      : null;
    saveCache();

    res.json({
      cover_url:  best?.image_url  ?? null,
      large_url:  best?.large_url  ?? null,
      match:      best ? { id: best.id, name: best.name, issue: best.issue_number, volume: best.volume, cover_date: best.cover_date } : null,
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
