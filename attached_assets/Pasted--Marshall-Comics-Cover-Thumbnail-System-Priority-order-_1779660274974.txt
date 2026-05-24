/**
 * Marshall Comics — Cover Thumbnail System
 * 
 * Priority order:
 * 1. Marvel API (marvel.com) — best quality for Marvel books
 * 2. ComicVine API (comicvine.gamespot.com) — DC, Image, Indie
 * 3. Generated SVG placeholder — always works, no API needed
 *
 * SETUP:
 * Get free Marvel API key: developer.marvel.com
 * Get free ComicVine key: comicvine.gamespot.com/api
 * 
 * Usage in Replit:
 *   import { getCoverUrl, generateSpineSVG } from './coverThumbnails.js'
 *   const url = await getCoverUrl(comic)
 */

// ── CONFIGURATION ──────────────────────────────────────────────────────────
// Set these in Replit Secrets (not hardcoded)
const MARVEL_PUBLIC_KEY = typeof window !== 'undefined' 
  ? window.MARVEL_PUBLIC_KEY 
  : process.env.MARVEL_PUBLIC_KEY || '';

const COMICVINE_KEY = typeof window !== 'undefined'
  ? window.COMICVINE_KEY
  : process.env.COMICVINE_KEY || '';

// In-memory cache — persists during session
const coverCache = new Map();

// ── PUBLISHER COLORS (for SVG fallbacks) ──────────────────────────────────
const PUBLISHER_COLORS = {
  'Marvel':      { bg: '#ED1D24', text: '#FFFFFF', accent: '#F7BC00' },
  'DC':          { bg: '#0078F0', text: '#FFFFFF', accent: '#F7BC00' },
  'Image':       { bg: '#1A5C2A', text: '#FFFFFF', accent: '#E5E5E5' },
  'IDW':         { bg: '#2B2B2B', text: '#FFFFFF', accent: '#E5841B' },
  'Dark Horse':  { bg: '#1A1A1A', text: '#FFFFFF', accent: '#C8960C' },
  'BOOM!':       { bg: '#6B1A8A', text: '#FFFFFF', accent: '#FF6B35' },
  'Valiant':     { bg: '#003366', text: '#FFFFFF', accent: '#C8960C' },
  'Dynamite':    { bg: '#8B0000', text: '#FFFFFF', accent: '#FFD700' },
  'default':     { bg: '#2F4060', text: '#FFFFFF', accent: '#C8960C' },
};

// ── MARVEL API ─────────────────────────────────────────────────────────────
async function fetchMarvelCover(title, issueNumber) {
  if (!MARVEL_PUBLIC_KEY) return null;
  
  try {
    // Marvel API requires MD5 hash of timestamp+privateKey+publicKey
    // Since we don't want to expose private key in frontend, 
    // this works only server-side or via a proxy
    const ts = Date.now();
    
    // Clean issue number
    const issueNum = parseInt(String(issueNumber).replace(/[^0-9]/g, '')) || 1;
    
    const params = new URLSearchParams({
      title: title,
      issueNumber: issueNum,
      limit: 1,
      apikey: MARVEL_PUBLIC_KEY,
      ts: ts,
    });
    
    // Note: Full auth requires MD5(ts+privateKey+publicKey) as 'hash' param
    // For client-side use, you'll need a proxy endpoint
    const url = `https://gateway.marvel.com/v1/public/comics?${params}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    
    if (!res.ok) return null;
    const data = await res.json();
    
    if (data.data?.results?.[0]?.thumbnail) {
      const t = data.data.results[0].thumbnail;
      if (!t.path.includes('image_not_available')) {
        return `${t.path}/portrait_medium.${t.extension}`;
      }
    }
  } catch (e) {
    // Silently fail — use fallback
  }
  return null;
}

// ── COMICVINE API ──────────────────────────────────────────────────────────
async function fetchComicVineCover(title, issueNumber, year) {
  if (!COMICVINE_KEY) return null;
  
  try {
    const issueNum = String(issueNumber).replace(/[^0-9.]/g, '');
    const cleanTitle = title.replace(/[^a-zA-Z0-9 ]/g, '').trim();
    
    // ComicVine: search for the volume first
    const searchUrl = `https://comicvine.gamespot.com/api/search/?` + new URLSearchParams({
      api_key: COMICVINE_KEY,
      format: 'json',
      resources: 'issue',
      query: `${cleanTitle} ${issueNum}`,
      field_list: 'image,volume,issue_number,cover_date',
      limit: 5,
    });
    
    // NOTE: ComicVine blocks CORS from browsers — needs a proxy
    // Use this server-side or via Replit backend
    const res = await fetch(searchUrl, { 
      headers: { 
        'User-Agent': 'MarshallComicsApp/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (!res.ok) return null;
    const data = await res.json();
    
    if (data.results?.length > 0) {
      // Find best match by year if available
      let best = data.results[0];
      if (year) {
        const yr = parseInt(year);
        best = data.results.find(r => {
          const coverYear = parseInt((r.cover_date || '').split('-')[0]);
          return Math.abs(coverYear - yr) < 2;
        }) || data.results[0];
      }
      return best.image?.medium_url || null;
    }
  } catch (e) {
    // Silently fail
  }
  return null;
}

// ── SVG PLACEHOLDER GENERATOR ──────────────────────────────────────────────
export function generateSpineSVG(comic, options = {}) {
  /**
   * Generates a colored SVG spine for the box view.
   * No API needed. Used as:
   * 1. The spine in the visual box view (always)
   * 2. Fallback thumbnail when no cover image available
   */
  const { width = 24, height = 120 } = options;
  const publisher = comic.publisher || 'default';
  const colors = PUBLISHER_COLORS[publisher.split('/')[0]] || PUBLISHER_COLORS.default;
  
  // Deterministic color variation by title hash
  const hash = [...(comic.title || '')].reduce((a,c) => a + c.charCodeAt(0), 0);
  const hue = hash % 360;
  const isKey = comic.isKey;
  
  // Key books get gold top indicator
  const keyIndicator = isKey 
    ? `<rect x="0" y="0" width="${width}" height="8" fill="${colors.accent}" opacity="0.9"/>`
    : '';
  
  // Signed books get green left stripe
  const signedIndicator = comic.isSigned
    ? `<rect x="0" y="0" width="4" height="${height}" fill="#1A5C2A" opacity="0.9"/>`
    : '';
  
  // CGC priority gets red left stripe
  const cgcIndicator = comic.cgcPriority && !comic.isSigned
    ? `<rect x="0" y="0" width="4" height="${height}" fill="#C00000" opacity="0.9"/>`
    : '';
  
  // Title text (vertical)
  const displayTitle = (comic.title || '').substring(0, 18);
  const issueText = comic.issue || '';
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="spine_${hash}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${colors.bg};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:hsl(${hue},40%,25%);stop-opacity:1"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#spine_${hash})"/>
  ${keyIndicator}
  ${signedIndicator}
  ${cgcIndicator}
  <text 
    transform="rotate(-90, ${width/2}, ${height/2})" 
    x="${width/2}" 
    y="${height/2}" 
    text-anchor="middle" 
    dominant-baseline="middle"
    font-family="Arial, sans-serif" 
    font-size="9" 
    font-weight="${isKey ? 'bold' : 'normal'}"
    fill="${colors.text}"
    letter-spacing="0.5">
    ${displayTitle}
  </text>
  <text 
    x="${width/2}" 
    y="${height - 8}"
    text-anchor="middle"
    font-family="Arial, sans-serif"
    font-size="7"
    fill="${colors.accent}">
    ${issueText}
  </text>
</svg>`;
}

export function generateThumbnailSVG(comic, options = {}) {
  /**
   * Full cover thumbnail placeholder — used in detail panels.
   * Larger format, shows more info.
   */
  const { width = 160, height = 240 } = options;
  const publisher = comic.publisher || 'default';
  const colors = PUBLISHER_COLORS[publisher.split('/')[0]] || PUBLISHER_COLORS.default;
  const hash = [...(comic.title || '')].reduce((a,c) => a + c.charCodeAt(0), 0);
  const hue = hash % 360;
  
  const titleLines = (comic.title || 'Unknown').match(/.{1,16}/g) || ['Unknown'];
  const titleY = height * 0.4;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="thumb_${hash}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.bg};stop-opacity:1"/>
      <stop offset="60%" style="stop-color:hsl(${hue},35%,20%);stop-opacity:1"/>
      <stop offset="100%" style="stop-color:hsl(${(hue+30)%360},30%,15%);stop-opacity:1"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#thumb_${hash})" rx="4"/>
  
  <!-- Publisher bar -->
  <rect x="0" y="0" width="${width}" height="28" fill="${colors.bg}" opacity="0.9" rx="4"/>
  <text x="${width/2}" y="18" text-anchor="middle" font-family="Arial,sans-serif" 
    font-size="10" font-weight="bold" fill="${colors.accent}">
    ${(comic.publisher || '').toUpperCase().substring(0,12)}
  </text>
  
  <!-- Title -->
  ${titleLines.slice(0,3).map((line, i) => 
    `<text x="${width/2}" y="${titleY + i*20}" text-anchor="middle" 
      font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="white">
      ${line}
    </text>`
  ).join('\n  ')}
  
  <!-- Issue number -->
  <text x="${width/2}" y="${titleY + 70}" text-anchor="middle"
    font-family="Arial,sans-serif" font-size="28" font-weight="bold" 
    fill="${colors.accent}" opacity="0.9">
    ${(comic.issue || '').substring(0,8)}
  </text>
  
  <!-- Year -->
  <text x="${width/2}" y="${height - 30}" text-anchor="middle"
    font-family="Arial,sans-serif" font-size="10" fill="rgba(255,255,255,0.6)">
    ${comic.year || ''}
  </text>
  
  <!-- Writers -->
  <text x="${width/2}" y="${height - 16}" text-anchor="middle"
    font-family="Arial,sans-serif" font-size="9" fill="rgba(255,255,255,0.5)">
    ${(comic.writer || '').substring(0,22)}
  </text>
  
  <!-- Key indicator -->
  ${comic.isKey ? `<polygon points="${width-8},2 ${width-2},8 ${width-2},2" fill="${colors.accent}"/>` : ''}
  
  <!-- Signed indicator -->
  ${comic.isSigned ? `<rect x="0" y="0" width="6" height="${height}" fill="#1A5C2A" opacity="0.8" rx="3"/>` : ''}
</svg>`;
}

// ── MAIN EXPORT: getCoverUrl ────────────────────────────────────────────────
export async function getCoverUrl(comic, options = {}) {
  /**
   * Main function — returns a cover image URL or SVG data URL.
   * 
   * Usage:
   *   const url = await getCoverUrl(comic)
   *   <img src={url} alt={`${comic.title} ${comic.issue}`} />
   * 
   * Or for inline SVG spine:
   *   const svg = generateSpineSVG(comic)
   *   <div dangerouslySetInnerHTML={{__html: svg}} />
   */
  const { useSVGFallback = true, thumbnailSize = 'medium' } = options;
  const cacheKey = `${comic.title}::${comic.issue}::${comic.year}`;
  
  if (coverCache.has(cacheKey)) {
    return coverCache.get(cacheKey);
  }
  
  let url = null;
  
  // Try Marvel API first for Marvel books
  if (comic.publisher?.includes('Marvel') && MARVEL_PUBLIC_KEY) {
    url = await fetchMarvelCover(comic.title, comic.issue);
  }
  
  // Try ComicVine for everything else (or Marvel fallback)
  if (!url && COMICVINE_KEY) {
    url = await fetchComicVineCover(comic.title, comic.issue, comic.year);
  }
  
  // SVG fallback — always works
  if (!url && useSVGFallback) {
    const svg = generateThumbnailSVG(comic, {
      width: thumbnailSize === 'small' ? 80 : 160,
      height: thumbnailSize === 'small' ? 120 : 240,
    });
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  
  if (url) coverCache.set(cacheKey, url);
  return url;
}

// ── BATCH PREFETCH ─────────────────────────────────────────────────────────
export async function prefetchBoxCovers(comics, maxConcurrent = 5) {
  /**
   * Prefetch covers for all key issues in a box.
   * Rate-limited to avoid API overuse.
   */
  const keysOnly = comics.filter(c => c.isKey);
  
  for (let i = 0; i < keysOnly.length; i += maxConcurrent) {
    const batch = keysOnly.slice(i, i + maxConcurrent);
    await Promise.all(batch.map(comic => getCoverUrl(comic)));
    
    // Small delay between batches
    if (i + maxConcurrent < keysOnly.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
}

// ── REPLIT INTEGRATION EXAMPLE ─────────────────────────────────────────────
/*

// In your main App.jsx or BoxView component:

import { getCoverUrl, generateSpineSVG, prefetchBoxCovers } from './coverThumbnails.js'

// For the spine view (fast, no API):
function ComicSpine({ comic, onClick }) {
  const svg = generateSpineSVG(comic, { width: 24, height: 120 })
  return (
    <div 
      className="comic-spine cursor-pointer hover:brightness-125 transition-all"
      onClick={() => onClick(comic)}
      dangerouslySetInnerHTML={{ __html: svg }}
      title={`${comic.title} ${comic.issue}`}
    />
  )
}

// For the detail panel thumbnail (with API fetch):
function ComicThumbnail({ comic }) {
  const [imgUrl, setImgUrl] = useState(null)
  
  useEffect(() => {
    getCoverUrl(comic).then(setImgUrl)
  }, [comic.title, comic.issue])
  
  if (!imgUrl) return <div className="w-40 h-60 bg-gray-800 animate-pulse rounded" />
  
  return (
    <img 
      src={imgUrl} 
      alt={`${comic.title} ${comic.issue} cover`}
      className="w-40 h-60 object-cover rounded shadow-lg"
      onError={(e) => {
        // If real image 404s, fall back to SVG
        const svg = generateThumbnailSVG(comic)
        e.target.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
      }}
    />
  )
}

// Prefetch when a box is opened:
function BoxView({ box, comics }) {
  useEffect(() => {
    prefetchBoxCovers(comics)
  }, [box])
  
  return (
    <div className="box-view">
      {comics.map(comic => <ComicSpine key={comic.row} comic={comic} />)}
    </div>
  )
}

*/

export { PUBLISHER_COLORS };
