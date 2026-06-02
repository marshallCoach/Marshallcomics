import { useState, useEffect, useCallback, useRef } from "react";
import { getCoverSvgUrl, type ComicLike } from "@/utils/coverThumbnails";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const memCache = new Map<string, string | null>();
const inFlight  = new Map<string, Promise<string | null>>();

function cacheKey(c: ComicLike) {
  return `${c.Title}|||${c.Issue}`;
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
      const params = new URLSearchParams({
        title: c.Title,
        issue: String(c.Issue || ""),
        publisher: (c as { Publisher?: string }).Publisher ?? "",
        year: String((c as { Year?: string }).Year ?? ""),
      });
      const res = await fetch(`${BASE}/api/covers/search?${params}`);
      if (!res.ok) return null;
      const data = await res.json() as { cover_url?: string | null };
      const url = data.cover_url ?? null;
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
}

export function CoverImage({ comic, width = 56, height = 84, onClick, style }: Props) {
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
        alt={`${comic.Title} #${comic.Issue}`}
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
          objectFit: "cover",
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
  comic: ComicLike & { Publisher?: string; Year?: string; Key?: string; Key_Reason?: string; Value_NM?: string; Condition?: string; Box?: string };
  largeUrl: string | null;
  onClose: () => void;
}

export function CoverModal({ comic, largeUrl, onClose }: ModalProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

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
            alt={`${comic.Title} #${comic.Issue}`}
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
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.5rem", letterSpacing: "2px", color: "var(--text)", lineHeight: 1 }}>
                  {comic.Title}
                </div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1rem", color: "var(--red)", letterSpacing: "1px", marginTop: 4 }}>
                  #{comic.Issue}
                  {(comic as { Year?: string }).Year && <span style={{ color: "var(--muted)", marginLeft: 8, fontSize: "0.8rem" }}>{(comic as { Year?: string }).Year}</span>}
                </div>
              </div>
              <button onClick={onClose} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, width: 30, height: 30, cursor: "pointer", color: "var(--muted)", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {(comic as { Publisher?: string }).Publisher && (
                <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.58rem", letterSpacing: "1px", background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--muted2)", borderRadius: 3, padding: "2px 8px" }}>
                  {(comic as { Publisher?: string }).Publisher}
                </span>
              )}
              {(comic as { Box?: string }).Box && (
                <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.58rem", letterSpacing: "1px", background: "#7a5c3a18", border: "1.5px solid #7a5c3a", color: "#7a5c3a", borderRadius: 3, padding: "2px 8px" }}>
                  Box {(comic as { Box?: string }).Box}
                </span>
              )}
              {isKey && (
                <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.58rem", letterSpacing: "1px", background: "#fff8e0", color: "#8a6000", border: "1px solid #fde68a", borderRadius: 3, padding: "2px 8px" }}>★ KEY</span>
              )}
              {(comic as { Condition?: string }).Condition && (
                <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.58rem", letterSpacing: "1px", background: "var(--surface2)", color: "var(--muted2)", border: "1px solid var(--border)", borderRadius: 3, padding: "2px 8px" }}>
                  {(comic as { Condition?: string }).Condition}
                </span>
              )}
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px 18px" }}>
            {isKey && (comic as { Key_Reason?: string }).Key_Reason && (
              <div style={{ background: "#fff8e0", border: "1.5px solid #fde68a", borderRadius: 6, padding: "10px 14px", marginBottom: 12 }}>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.6rem", letterSpacing: "2px", color: "#8a6000", marginBottom: 4 }}>KEY REASON</div>
                <div style={{ fontSize: "0.88rem", color: "#5a4000", lineHeight: 1.5 }}>{(comic as { Key_Reason?: string }).Key_Reason}</div>
              </div>
            )}
            {(comic as { Value_NM?: string }).Value_NM && (
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.6rem", letterSpacing: "1.5px", color: "var(--muted)", paddingTop: 1, flexShrink: 0, width: 70 }}>VALUE NM</span>
                <span style={{ fontSize: "0.88rem", color: "var(--red)", fontWeight: 600 }}>{(comic as { Value_NM?: string }).Value_NM}</span>
              </div>
            )}
            <div style={{ marginTop: 12, fontSize: "0.75rem", color: "var(--muted)", fontFamily: "'Crimson Pro',serif" }}>
              Click outside or press Esc to close
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
