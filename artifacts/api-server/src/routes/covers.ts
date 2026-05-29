import { Router, type IRouter } from "express";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const router: IRouter = Router();

const CV_BASE  = "https://comicvine.gamespot.com/api";
const API_KEY  = process.env["COMIC_VINE_API_KEY"] ?? "";
const CACHE_PATH = resolve(process.cwd(), "covers.json");

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

function diskKey(title: string, issue: string) {
  return `${title}|||${issue}`;
}

// ── Comic Vine helpers ────────────────────────────────────────────────────────
function cvParams(extra: Record<string, string> = {}) {
  const p = new URLSearchParams({ api_key: API_KEY, format: "json", ...extra });
  return p.toString();
}

// ── Route ─────────────────────────────────────────────────────────────────────
router.get("/covers/search", async (req, res) => {
  if (!API_KEY) {
    res.status(503).json({ error: "COMIC_VINE_API_KEY not configured" });
    return;
  }

  const { title, issue, publisher, year } = req.query as Record<string, string>;
  if (!title) { res.status(400).json({ error: "title required" }); return; }

  loadCache();
  const key = diskKey(title, issue ?? "");

  // ── Cache hit ──────────────────────────────────────────────────────────────
  if (Object.prototype.hasOwnProperty.call(diskCache, key)) {
    const cached = diskCache[key];
    if (cached === null) {
      res.json({ cover_url: null, large_url: null, match: null, candidates: [], cached: true });
    } else {
      res.json({ cover_url: cached.url, large_url: cached.large, match: null, candidates: [], cached: true });
    }
    return;
  }

  // ── Cache miss → Comic Vine ────────────────────────────────────────────────
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

    const issueNum = String(issue || "").replace(/^#/, "").trim();
    const scored = results.map(r => {
      let score = 0;
      const rVol       = (r.volume || "").toLowerCase();
      const rName      = (r.name   || "").toLowerCase();
      const titleLower = (title    || "").toLowerCase();
      if (rVol.includes(titleLower) || titleLower.includes(rVol)) score += 10;
      if (rName.toLowerCase().includes(titleLower))                score += 3;
      if (issueNum && r.issue_number === issueNum)                 score += 15;
      if (issueNum && r.issue_number?.replace(/^0+/, "") === issueNum.replace(/^0+/, "")) score += 12;
      if (year      && r.cover_date?.startsWith(year))            score += 4;
      if (publisher) {
        const rPub = rVol + rName;
        if (rPub.toLowerCase().includes((publisher || "").toLowerCase())) score += 2;
      }
      return { ...r, score };
    }).sort((a, b) => b.score - a.score);

    const best = scored[0] ?? null;

    // Write result to disk cache (null if nothing matched)
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

export default router;
