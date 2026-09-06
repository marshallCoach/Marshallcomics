import { useState, useEffect, useCallback, useRef } from "react";
import { getCoverSvgUrl, type ComicLike } from "@/utils/coverThumbnails";
import { coverId, isFlagged as isCoverFlaggedLib, toggleFlag as toggleCoverFlagLib } from "@/lib/coverFlags";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// ── Static cover map loaded once from /covers.json ───────────────────────────
let coversMap: Record<string, { url: string | null; large?: string | null }> | null = null;
let coversLoading: Promise<void> | null = null;

// Fallback index: normalized "title|||issue" → url, built ONLY from entries whose
// normalized key maps to a single distinct url. Rescues covers orphaned by a title
// rename (e.g. "Icon & Rocket: Season One" vs the stored "Icon and Rocket", or
// "&" vs "and", ":" vs ",", "x" vs "X"). Ambiguous keys (same title+issue across
// multiple volumes/urls) are intentionally EXCLUDED so a rename fix never pastes a
// wrong-volume cover onto a book — Volume stays significant.
let normIndex: Map<string, string> | null = null;
const normTitle = (t: string) =>
  t.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const normIssue = (i: string) =>
  String(i).replace(/^#/, "").replace(/^0+(\d)/, "$1").trim();
const normCoverKey = (title: string, issue: string) =>
  `${normTitle(title)}|||${normIssue(issue)}`;

function buildNormIndex(map: Record<string, { url: string | null }>) {
  const groups = new Map<string, Set<string>>();
  for (const [k, v] of Object.entries(map)) {
    const url = v?.url;
    if (!url) continue;
    const p = k.split("|||");
    if (p.length < 2) continue;
    const nk = `${normTitle(p[0])}|||${normIssue(p[1])}`;
    (groups.get(nk) ?? groups.set(nk, new Set()).get(nk)!).add(url);
  }
  const idx = new Map<string, string>();
  for (const [nk, urls] of groups) if (urls.size === 1) idx.set(nk, [...urls][0]);
  return idx;
}

function loadCovers(): Promise<void> {
  if (coversMap !== null) return Promise.resolve();
  if (coversLoading) return coversLoading;
  coversLoading = fetch(`${BASE}/covers.json`)
    .then(r => r.json())
    .then(data => { coversMap = data; normIndex = buildNormIndex(data); })
    .catch(() => { coversMap = {}; normIndex = new Map(); });
  return coversLoading;
}

// Pre-load covers as soon as the module is imported
loadCovers();

const memCache = new Map<string, string | null>();
const inFlight  = new Map<string, Promise<string | null>>();

function cacheKey(c: ComicLike) {
  const vol = String((c as { Volume?: string | number }).Volume || "1").trim();
  return `${c.Title}|||${c.Issue}|||${vol}`;
}

/** Clears the client-side memory cache for a specific comic so it re-fetches. */
export function clearCoverMemCache(title: string, issue: string | number) {
  memCache.delete(`${title}|||${issue}`);
}

async function fetchCover(c: ComicLike): Promise<string | null> {
  const key = cacheKey(c);
  if (memCache.has(key)) return memCache.get(key)!;
  if (inFlight.has(key)) return inFlight.get(key)!;

  const p = (async () => {
    try {
      await loadCovers();
      const issueStr = String(c.Issue);
      // Lookup priority: volume-aware key → legacy key → legacy with # prefix
      const entry =
        coversMap?.[key] ??
        coversMap?.[`${c.Title}|||${issueStr}`] ??
        coversMap?.[`${c.Title}|||#${issueStr.replace(/^#/, "")}`] ??
        null;
      // Rename-tolerant fallback: only when the exact keys miss, and only when the
      // normalized title+issue resolves to a single unambiguous cover.
      const url =
        entry?.url ??
        normIndex?.get(normCoverKey(c.Title, issueStr)) ??
        null;
      memCache.set(key, url);
      return url;
    } catch {
      memCache.set(key, null);
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, p);
  return p;
}

interface Props {
  comic: { Title: string; Issue: string | number; Publisher?: string; Year?: string; Key?: string; Signed?: string };
  width?: number;
  height?: number;
  onClick?: (largeUrl: string | null) => void;
  className?: string;
  style?: React.CSSProperties;
  objectFit?: "cover" | "contain";
}

export function CoverImage({ comic, width = 56, height = 84, onClick, style, objectFit = "cover" }: Props) {
  const [src, setSrc]         = useState<string>(() => getCoverSvgUrl(comic as ComicLike, { width, height }));
  const [realUrl, setRealUrl] = useState<string | null>(null);
  const [loaded, setLoaded]   = useState(false);
  const [error, setError]     = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setLoaded(false);
    setError(false);
    setSrc(getCoverSvgUrl(comic as ComicLike, { width, height }));
    setRealUrl(null);

    fetchCover(comic as ComicLike).then(url => {
      if (!mountedRef.current) return;
      if (url) {
        setRealUrl(url);
        setSrc(url);
      }
    });

    return () => { mountedRef.current = false; };
  }, [comic.Title, comic.Issue]);

  const handleClick = useCallback(() => {
    if (onClick) onClick(realUrl);
  }, [onClick, realUrl]);

  const isSvg = src.startsWith("data:image/svg");

  return (
    <div
      onClick={onClick ? handleClick : undefined}
      style={{
        width, height, flexShrink: 0,
        borderRadius: 4, overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        position: "relative",
        background: "#e5e7eb",
        ...style,
      }}
    >
      <img
        src={src}
        alt={`${comic.Title} ${comic.Issue}`}
        width={width}
        height={height}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!isSvg) {
            setError(true);
            setSrc(getCoverSvgUrl(comic as ComicLike, { width, height }));
          }
        }}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit,
          borderRadius: 4,
          transition: "opacity 0.2s",
          opacity: (isSvg || loaded) && !error ? 1 : 0.7,
        }}
      />
      {onClick && !isSvg && loaded && (
        <div style={{
          position: "absolute", inset: 0, background: "rgba(0,0,0,0)",
          transition: "background 0.15s",
        }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.15)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,0,0,0)")}
        />
      )}
    </div>
  );
}

interface ModalProps {
  comic: ComicLike & {
    Publisher?: string; Year?: string; Key?: string; Key_Reason?: string;
    Value_NM?: string; Condition?: string; Box?: string;
    Writer?: string; Artist?: string; Cover_Artist?: string;
    Signed?: string; Signed_By?: string; Era?: string;
  };
  largeUrl: string | null;
  onClose: () => void;
}

export function CoverModal({ comic, largeUrl, onClose }: ModalProps) {
  const box        = (comic as { Box?: string }).Box ?? "";
  const coverKey   = coverId({ Title: comic.Title, Issue: comic.Issue, Box: box });

  const [coverFlagged, setCoverFlagged] = useState(() => isCoverFlaggedLib(coverKey));

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  function handleCoverFlag() {
    const c = comic as { Cover_Artist?: string; Publisher?: string; Year?: string };
    const next = toggleCoverFlagLib({
      Title: comic.Title, Issue: comic.Issue, Box: box,
      Cover_Artist: c.Cover_Artist, Publisher: c.Publisher, Year: c.Year,
    });
    setCoverFlagged(next);
  }

  const isKey    = (comic.Key    ?? "").toUpperCase() === "YES";
  const fallback = getCoverSvgUrl(comic, { width: 300, height: 460 });

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(3px)" }}
      />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        zIndex: 9501,
        display: "flex", gap: 0, alignItems: "flex-start",
        width: "min(820px, 94vw)",
        maxHeight: "90vh",
        background: "var(--bg)",
        border: "2px solid var(--border)",
        borderRadius: 10,
        boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
        overflow: "hidden",
        animation: "drawerSlideIn 0.18s ease-out",
      }}>
        {/* Cover */}
        <div style={{ flexShrink: 0, width: 220, alignSelf: "stretch", overflow: "hidden", background: "#111" }}>
          <img
            src={largeUrl ?? fallback}
            alt={`${comic.Title} ${comic.Issue}`}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={e => { (e.target as HTMLImageElement).src = fallback; }}
          />
        </div>

        {/* Info panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, maxHeight: "90vh" }}>
          {/* Header */}
          <div style={{ padding: "16px 18px 12px", borderBottom: "1.5px solid var(--border)", background: "var(--surface)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: "1.75rem", letterSpacing: "2px", color: "var(--text)", lineHeight: 1 }}>
                  {comic.Title}
                </div>
                <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: "0.875rem", color: "var(--red)", letterSpacing: "1px", marginTop: 4 }}>
                  #{comic.Issue}
                  {(comic as { Year?: string }).Year && <span style={{ color: "var(--muted)", marginLeft: 8, fontSize: "0.875rem" }}>{(comic as { Year?: string }).Year}</span>}
                </div>
              </div>
              <button onClick={onClose} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, width: 30, height: 30, cursor: "pointer", color: "var(--muted)", fontSize: "0.875rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {(comic as { Publisher?: string }).Publisher && (
                <span style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: "0.875rem", letterSpacing: "1px", background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--muted2)", borderRadius: 3, padding: "2px 8px" }}>
                  {(comic as { Publisher?: string }).Publisher}
                </span>
              )}
              {box && (
                <span style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: "0.875rem", letterSpacing: "1px", background: "#7a5c3a18", border: "1.5px solid #7a5c3a", color: "#7a5c3a", borderRadius: 3, padding: "2px 8px" }}>
                  Box {box}
                </span>
              )}
              {isKey && (
                <span style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: "0.875rem", letterSpacing: "1px", background: "#fff8e0", color: "#8a6000", border: "1px solid #fde68a", borderRadius: 3, padding: "2px 8px" }}>★ KEY</span>
              )}
              {(comic as { Condition?: string }).Condition && (
                <span style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: "0.875rem", letterSpacing: "1px", background: "var(--surface2)", color: "var(--muted2)", border: "1px solid var(--border)", borderRadius: 3, padding: "2px 8px" }}>
                  {(comic as { Condition?: string }).Condition}
                </span>
              )}
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px 18px" }}>
            {isKey && (comic as { Key_Reason?: string }).Key_Reason && (
              <div style={{ background: "#fff8e0", border: "1.5px solid #fde68a", borderRadius: 6, padding: "10px 14px", marginBottom: 12 }}>
                <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: "0.875rem", letterSpacing: "2px", color: "#8a6000", marginBottom: 4 }}>KEY REASON</div>
                <div style={{ fontSize: "0.875rem", color: "#5a4000", lineHeight: 1.5 }}>{(comic as { Key_Reason?: string }).Key_Reason}</div>
              </div>
            )}
            {(comic as { Value_NM?: string }).Value_NM && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <span style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: "0.875rem", letterSpacing: "1.5px", color: "var(--muted)", paddingTop: 1, flexShrink: 0, width: 70 }}>VALUE NM</span>
                <span style={{ fontSize: "0.875rem", color: "var(--red)", fontWeight: 600 }}>{(comic as { Value_NM?: string }).Value_NM}</span>
              </div>
            )}

            {/* ── Flag cover as incorrect ── */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginBottom: 14 }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: "0.875rem", letterSpacing: "2px", color: "var(--muted)", marginBottom: 7 }}>COVER AUDIT</div>
              <button
                onClick={handleCoverFlag}
                style={{
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: "0.875rem", letterSpacing: "1.5px",
                  padding: "7px 14px", borderRadius: 5, cursor: "pointer",
                  border: `1.5px solid ${coverFlagged ? "#c8102e" : "var(--border)"}`,
                  background: coverFlagged ? "#fff0f0" : "var(--surface2)",
                  color: coverFlagged ? "#c8102e" : "var(--muted2)",
                  transition: "all 0.15s",
                }}
              >
                {coverFlagged ? "🚩 COVER FLAGGED AS INCORRECT" : "🚩 FLAG COVER AS INCORRECT"}
              </button>
              {coverFlagged && (
                <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: "0.875rem", color: "var(--muted)", marginTop: 5, fontStyle: "italic" }}>
                  Added to the 🚩 flagged covers — export them all from Cover → Cover Review
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
