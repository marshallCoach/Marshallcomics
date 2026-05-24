/**
 * Marshall Comics — Cover Thumbnail System
 * Mode 1: generateSpineSVG  — coloured vertical spine, no API
 * Mode 2: generateThumbnailSVG — full cover placeholder, no API
 * Mode 3: getCoverUrl (async) — real covers via Marvel/ComicVine APIs, falls back to Mode 2
 */

export const PUBLISHER_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  "Marvel":     { bg: "#ED1D24", text: "#FFFFFF", accent: "#F7BC00" },
  "DC":         { bg: "#0078F0", text: "#FFFFFF", accent: "#F7BC00" },
  "Image":      { bg: "#1A5C2A", text: "#FFFFFF", accent: "#E5E5E5" },
  "IDW":        { bg: "#2B2B2B", text: "#FFFFFF", accent: "#E5841B" },
  "Dark Horse": { bg: "#1A1A1A", text: "#FFFFFF", accent: "#C8960C" },
  "BOOM!":      { bg: "#6B1A8A", text: "#FFFFFF", accent: "#FF6B35" },
  "Valiant":    { bg: "#003366", text: "#FFFFFF", accent: "#C8960C" },
  "Dynamite":   { bg: "#8B0000", text: "#FFFFFF", accent: "#FFD700" },
  "default":    { bg: "#2F4060", text: "#FFFFFF", accent: "#C8960C" },
};

export function pubColors(publisher: string): { bg: string; text: string; accent: string } {
  const key = Object.keys(PUBLISHER_COLORS).find(k => (publisher || "").startsWith(k));
  return PUBLISHER_COLORS[key ?? "default"];
}

function titleHash(title: string): number {
  return [...(title || "")].reduce((a, c) => a + c.charCodeAt(0), 0);
}

export interface ComicLike {
  Title: string;
  Issue: string | number;
  Publisher: string;
  Year?: string | number;
  Writer?: string;
  Key?: string;
  Signed?: string;
}

// ── Mode 1: Spine SVG ───────────────────────────────────────────────────────
export function generateSpineSVG(
  comic: ComicLike,
  options: { width?: number; height?: number } = {}
): string {
  const { width = 8, height = 160 } = options;
  const colors = pubColors(comic.Publisher);
  const hash   = titleHash(comic.Title);
  const hue    = hash % 360;

  const isKey    = (comic.Key    ?? "").toUpperCase() === "YES";
  const isSigned = (comic.Signed ?? "").toUpperCase() === "YES";

  const keyBar     = isKey    ? `<rect x="0" y="0" width="${width}" height="5" fill="${colors.accent}"/>` : "";
  const signedBar  = isSigned ? `<rect x="0" y="0" width="3" height="${height}" fill="#22c55e" opacity="0.85"/>` : "";
  const issueText  = String(comic.Issue ?? "").substring(0, 4);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><linearGradient id="sg${hash}" x1="0%" y1="0%" x2="100%" y2="0%">` +
    `<stop offset="0%" style="stop-color:${colors.bg};stop-opacity:1"/>` +
    `<stop offset="100%" style="stop-color:hsl(${hue},38%,20%);stop-opacity:1"/>` +
    `</linearGradient></defs>` +
    `<rect width="${width}" height="${height}" fill="url(#sg${hash})"/>` +
    keyBar + signedBar +
    (width >= 12
      ? `<text transform="rotate(-90,${width/2},${height/2})" x="${width/2}" y="${height/2}" ` +
        `text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" ` +
        `font-size="7" fill="rgba(255,255,255,0.7)">${issueText}</text>`
      : "") +
    `</svg>`
  );
}

// ── Mode 2: Thumbnail SVG ───────────────────────────────────────────────────
export function generateThumbnailSVG(
  comic: ComicLike,
  options: { width?: number; height?: number } = {}
): string {
  const { width = 56, height = 84 } = options;
  const colors = pubColors(comic.Publisher);
  const hash   = titleHash(comic.Title);
  const hue    = hash % 360;

  const isKey    = (comic.Key    ?? "").toUpperCase() === "YES";
  const isSigned = (comic.Signed ?? "").toUpperCase() === "YES";

  const pubText    = (comic.Publisher || "").substring(0, 9).toUpperCase();
  const title      = comic.Title || "Unknown";
  const line1      = esc(title.substring(0, 13));
  const line2      = title.length > 13 ? esc(title.substring(13, 24)) : "";
  const issueText  = esc(String(comic.Issue ?? "").substring(0, 6));
  const yearText   = esc(String(comic.Year ?? ""));
  const writerText = esc((comic.Writer || "").substring(0, 20));

  const titleY  = height * 0.38;
  const issueY  = height * 0.64;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><linearGradient id="tg${hash}" x1="0%" y1="0%" x2="0%" y2="100%">` +
    `<stop offset="0%" style="stop-color:${colors.bg};stop-opacity:1"/>` +
    `<stop offset="55%" style="stop-color:hsl(${hue},36%,18%);stop-opacity:1"/>` +
    `<stop offset="100%" style="stop-color:hsl(${(hue+28)%360},28%,12%);stop-opacity:1"/>` +
    `</linearGradient></defs>` +
    `<rect width="${width}" height="${height}" fill="url(#tg${hash})" rx="3"/>` +
    // Publisher bar
    `<rect x="0" y="0" width="${width}" height="15" fill="${colors.bg}" opacity="0.88" rx="3"/>` +
    `<text x="${width/2}" y="10.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="6.5" font-weight="bold" fill="${colors.accent}">${pubText}</text>` +
    // Title line(s)
    `<text x="${width/2}" y="${titleY}" text-anchor="middle" font-family="Arial,sans-serif" font-size="7.5" font-weight="bold" fill="white">${line1}</text>` +
    (line2 ? `<text x="${width/2}" y="${titleY+10}" text-anchor="middle" font-family="Arial,sans-serif" font-size="7.5" font-weight="bold" fill="white">${line2}</text>` : "") +
    // Issue number — big
    `<text x="${width/2}" y="${issueY}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${width > 90 ? 28 : 17}" font-weight="bold" fill="${colors.accent}" opacity="0.92">#${issueText}</text>` +
    // Year
    `<text x="${width/2}" y="${height-14}" text-anchor="middle" font-family="Arial,sans-serif" font-size="5.5" fill="rgba(255,255,255,0.45)">${yearText}</text>` +
    // Writer
    `<text x="${width/2}" y="${height-5}" text-anchor="middle" font-family="Arial,sans-serif" font-size="5" fill="rgba(255,255,255,0.38)">${writerText}</text>` +
    // Key corner triangle
    (isKey ? `<polygon points="${width-7},1 ${width-1},8 ${width-1},1" fill="${colors.accent}"/>` : "") +
    // Signed left stripe
    (isSigned ? `<rect x="0" y="0" width="3" height="${height}" fill="#22c55e" opacity="0.82" rx="1"/>` : "") +
    `</svg>`
  );
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── In-memory cache ─────────────────────────────────────────────────────────
const thumbCache = new Map<string, string>();
const spineCache = new Map<string, string>();

export function getCoverSvgUrl(
  comic: ComicLike,
  options?: { width?: number; height?: number }
): string {
  const key = `${comic.Title}::${comic.Issue}::${options?.width ?? 56}`;
  if (thumbCache.has(key)) return thumbCache.get(key)!;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(generateThumbnailSVG(comic, options))}`;
  thumbCache.set(key, url);
  return url;
}

export function getSpineSvgUrl(
  comic: ComicLike,
  options?: { width?: number; height?: number }
): string {
  const key = `${comic.Title}::${comic.Issue}::spine::${options?.width ?? 8}`;
  if (spineCache.has(key)) return spineCache.get(key)!;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(generateSpineSVG(comic, options))}`;
  spineCache.set(key, url);
  return url;
}

// ── Mode 3 stub (async, ready for API keys) ──────────────────────────────────
// Set VITE_MARVEL_PUBLIC_KEY and VITE_COMICVINE_KEY in Replit Secrets to activate.
const _marvelKey   = import.meta.env.VITE_MARVEL_PUBLIC_KEY  ?? "";
const _comicVineKey = import.meta.env.VITE_COMICVINE_KEY     ?? "";

const apiCache = new Map<string, string>();

export async function getCoverUrl(
  comic: ComicLike,
  options?: { width?: number; height?: number }
): Promise<string> {
  const key = `${comic.Title}::${comic.Issue}`;
  if (apiCache.has(key)) return apiCache.get(key)!;

  let url: string | null = null;

  // Marvel API
  if (_marvelKey && (comic.Publisher || "").toLowerCase().includes("marvel")) {
    try {
      const issueNum = parseInt(String(comic.Issue).replace(/\D/g, "")) || 1;
      const params = new URLSearchParams({ title: comic.Title, issueNumber: String(issueNum), limit: "1", apikey: _marvelKey });
      const res = await fetch(`https://gateway.marvel.com/v1/public/comics?${params}`);
      if (res.ok) {
        const data = await res.json();
        const t = data.data?.results?.[0]?.thumbnail;
        if (t && !t.path.includes("image_not_available")) url = `${t.path}/portrait_medium.${t.extension}`;
      }
    } catch { /* fall through */ }
  }

  // ComicVine API (needs backend proxy — CORS blocks browser calls)
  // Placeholder for future: add a /api/cover-proxy endpoint

  // Fallback to Mode 2
  if (!url) url = getCoverSvgUrl(comic, options);

  apiCache.set(key, url);
  return url;
}
