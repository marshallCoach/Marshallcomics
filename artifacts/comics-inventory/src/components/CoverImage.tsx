import { useState, useEffect, useCallback, useRef } from "react";
import { getCoverSvgUrl, type ComicLike } from "@/utils/coverThumbnails";
import { comicFlagKey, getComicFlag, setComicFlag, clearComicFlag } from "@/lib/comicFlags";

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

// ── Cover-flag helpers (mirrors brbFlaggedCovers_v1 used in CoverCatalog) ─────
const COVER_FLAG_LS = "brbFlaggedCovers_v1";
function readCoverFlags(): Record<string, unknown> {
  try { return JSON.parse(localStorage.getItem(COVER_FLAG_LS) || "{}"); }
  catch { return {}; }
}
function isCoverFlagged(key: string): boolean { return key in readCoverFlags(); }
function toggleCoverFlag(key: string, data: { Title: string; Issue: string | number; Box?: string; Publisher?: string; Year?: string; Cover_Artist?: string }): boolean {
  const all = readCoverFlags();
  if (key in all) {
    delete all[key];
    localStorage.setItem(COVER_FLAG_LS, JSON.stringify(all));
    return false;
  }
  all[key] = {
    id: key,
    Title: data.Title,
    Issue: String(data.Issue),
    Box: data.Box ?? "",
    Publisher: data.Publisher ?? "",
    Year: data.Year ?? "",
    Cover_Artist: data.Cover_Artist ?? "",
    flaggedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  };
  localStorage.setItem(COVER_FLAG_LS, JSON.stringify(all));
  return true;
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
  const coverKey   = `${comic.Title}|||${comic.Issue}|||${box}`;
  const dataKey    = comicFlagKey(comic.Title, String(comic.Issue), box);

  const [coverFlagged, setCoverFlagged] = useState(() => isCoverFlagged(coverKey));
  const [notes,        setNotes]        = useState(() => getComicFlag(dataKey)?.notes ?? "");
  const [copied,       setCopied]       = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  function handleCoverFlag() {
    const next = toggleCoverFlag(coverKey, comic as Parameters<typeof toggleCoverFlag>[1]);
    setCoverFlagged(next);
  }

  function handleNotes(val: string) {
    setNotes(val);
    if (val.trim()) setComicFlag(dataKey, getComicFlag(dataKey)?.fields ?? [], val);
    else {
      const existing = getComicFlag(dataKey);
      if (existing?.fields?.length) setComicFlag(dataKey, existing.fields, "");
      else clearComicFlag(dataKey);
    }
  }

  function buildPrompt() {
    const divider = "────────────────────────────────";
    const lines = [
      "BOOK NOTE REQUEST", divider,
      `Title:     ${comic.Title}`,
      `Issue:     ${comic.Issue}`,
    ];
    if ((comic as { Year?: string }).Year)      lines.push(`Year:      ${(comic as { Year?: string }).Year}`);
    if ((comic as { Publisher?: string }).Publisher) lines.push(`Publisher: ${(comic as { Publisher?: string }).Publisher}`);
    if (box) lines.push(`Box:       ${box}`);
    if ((comic as { Era?: string }).Era)        lines.push(`Era:       ${(comic as { Era?: string }).Era}`);
    lines.push("");
    if (notes.trim()) { lines.push("NOTES", divider, notes.trim(), ""); }
    if (coverFlagged)  { lines.push("COVER NOTE", divider, "Cover image appears incorrect — needs Comic Vine verification.", ""); }
    lines.push(divider, "Please review and update this entry as needed.");
    return lines.join("\n");
  }

  async function copyForClaude() {
    try { await navigator.clipboard.writeText(buildPrompt()); }
    catch { const ta = document.getElementById("cm-prompt-preview") as HTMLTextAreaElement; if (ta) { ta.select(); document.execCommand("copy"); } }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  const isKey    = (comic.Key    ?? "").toUpperCase() === "YES";
  const fallback = getCoverSvgUrl(comic, { width: 300, height: 460 });
  const hasNote  = notes.trim().length > 0;

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
              {box && (
                <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.58rem", letterSpacing: "1px", background: "#7a5c3a18", border: "1.5px solid #7a5c3a", color: "#7a5c3a", borderRadius: 3, padding: "2px 8px" }}>
                  Box {box}
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
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.6rem", letterSpacing: "1.5px", color: "var(--muted)", paddingTop: 1, flexShrink: 0, width: 70 }}>VALUE NM</span>
                <span style={{ fontSize: "0.88rem", color: "var(--red)", fontWeight: 600 }}>{(comic as { Value_NM?: string }).Value_NM}</span>
              </div>
            )}

            {/* ── Flag cover as incorrect ── */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginBottom: 14 }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.6rem", letterSpacing: "2px", color: "var(--muted)", marginBottom: 7 }}>COVER AUDIT</div>
              <button
                onClick={handleCoverFlag}
                style={{
                  fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.68rem", letterSpacing: "1.5px",
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
                <div style={{ fontFamily: "'Crimson Pro',serif", fontSize: "0.78rem", color: "var(--muted)", marginTop: 5, fontStyle: "italic" }}>
                  Queued for review in Cover Catalog → Flagged section
                </div>
              )}
            </div>

            {/* ── Claude note ── */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.6rem", letterSpacing: "2px", color: hasNote ? "#d97706" : "var(--muted)", marginBottom: 7 }}>
                NOTE TO CLAUDE{hasNote ? " ●" : ""}
              </div>
              <textarea
                value={notes}
                onChange={e => handleNotes(e.target.value)}
                placeholder="What needs correcting or adding? Any known values, sources, or context…"
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "9px 11px", minHeight: 80,
                  fontFamily: "'Crimson Pro',serif", fontSize: "0.88rem", lineHeight: 1.55,
                  color: "var(--text)", background: "var(--surface)",
                  border: `1.5px solid ${hasNote ? "#d97706" : "var(--border)"}`,
                  borderRadius: 6, resize: "vertical", outline: "none",
                }}
                onFocus={e => e.currentTarget.style.borderColor = "#d97706"}
                onBlur={e => e.currentTarget.style.borderColor = hasNote ? "#d97706" : "var(--border)"}
              />
              {(hasNote || coverFlagged) && (
                <>
                  <textarea
                    id="cm-prompt-preview"
                    readOnly
                    value={buildPrompt()}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      padding: "8px 10px", height: 110, marginTop: 8,
                      fontFamily: "'Courier New',monospace", fontSize: "0.68rem", lineHeight: 1.45,
                      color: "var(--muted2)", background: "var(--surface)",
                      border: "1px solid var(--border)", borderRadius: 5,
                      resize: "none", outline: "none",
                    }}
                  />
                  <button
                    onClick={copyForClaude}
                    style={{
                      marginTop: 8, width: "100%", padding: "9px 0",
                      fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.7rem", letterSpacing: "1.5px",
                      background: copied ? "#16a34a" : "#d97706",
                      border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", transition: "background 0.2s",
                    }}
                  >
                    {copied ? "✓ COPIED TO CLIPBOARD" : "COPY FOR CLAUDE →"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
