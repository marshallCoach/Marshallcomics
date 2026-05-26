import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { DATA3 } from "@/data/data3";
import type { Comic } from "@/data/data3";

const comics = DATA3.comics;

const MONTH_LABELS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const MONTH_FULL   = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const TODAY       = new Date();
const END_YEAR    = TODAY.getFullYear();
const END_MONTH   = TODAY.getMonth(); // 0-indexed
const START_YEAR  = 1974;
const START_MONTH = 6; // July

// ── Publisher colour system ───────────────────────────────────────────────
type PubKey = "MARVEL" | "DC" | "IMAGE" | "DARK HORSE" | "IDW" | "BOOM" | "VALIANT" | "OTHER";

const PUB_META: Record<PubKey, { bg: string; dark: string; text: string }> = {
  "MARVEL":     { bg: "#c8102e", dark: "#8c0a20", text: "#fff" },
  "DC":         { bg: "#1d6fa4", dark: "#134e74", text: "#fff" },
  "IMAGE":      { bg: "#f97316", dark: "#b45309", text: "#fff" },
  "DARK HORSE": { bg: "#7c3aed", dark: "#5521b5", text: "#fff" },
  "IDW":        { bg: "#16a34a", dark: "#0f6b32", text: "#fff" },
  "BOOM":       { bg: "#0ea5e9", dark: "#0369a1", text: "#fff" },
  "VALIANT":    { bg: "#8b2be2", dark: "#6014a8", text: "#fff" },
  "OTHER":      { bg: "#64748b", dark: "#44556b", text: "#fff" },
};

function getPubKey(pub: string): PubKey {
  const u = (pub || "").toUpperCase();
  if (u === "MARVEL" || u === "MARVEL COMICS") return "MARVEL";
  if (u === "DC" || u === "DC COMICS")         return "DC";
  if (u === "IMAGE")                            return "IMAGE";
  if (u.includes("DARK HORSE"))                 return "DARK HORSE";
  if (u.includes("IDW"))                        return "IDW";
  if (u.includes("BOOM"))                       return "BOOM";
  if (u === "VALIANT")                          return "VALIANT";
  return "OTHER";
}

// ── Static data ───────────────────────────────────────────────────────────
const BY_YEAR = (() => {
  const m = new Map<number, Comic[]>();
  for (const c of comics) {
    const y = parseInt(c.Year || "0");
    if (y < START_YEAR || y > END_YEAR) continue;
    if (!m.has(y)) m.set(y, []);
    m.get(y)!.push(c);
  }
  for (const [, arr] of m) {
    arr.sort((a, b) => a.Title.localeCompare(b.Title) || a.Issue.localeCompare(b.Issue));
  }
  return m;
})();

const YEARS_PRESENT = [...BY_YEAR.keys()].sort((a, b) => a - b);

function isMonthVisible(year: number, mi: number): boolean {
  if (year === START_YEAR && mi < START_MONTH) return false;
  if (year === END_YEAR   && mi > END_MONTH)   return false;
  return true;
}

function monthPool(yearComics: Comic[], mi: number): Comic[] {
  return yearComics.filter((_, i) => i % 12 === mi);
}

// ── Filter types ──────────────────────────────────────────────────────────
type PubFilter = "ALL" | PubKey;

const PUB_FILTERS: Array<{ id: PubFilter; label: string }> = [
  { id: "ALL",        label: "ALL" },
  { id: "MARVEL",     label: "MARVEL" },
  { id: "DC",         label: "DC" },
  { id: "IMAGE",      label: "IMAGE" },
  { id: "DARK HORSE", label: "DARK HORSE" },
  { id: "VALIANT",    label: "VALIANT" },
  { id: "OTHER",      label: "OTHER" },
];

// ── Cover thumbnail component ─────────────────────────────────────────────
function ComicCover({ comic, mi, year, isAnimating, pool, curIdx }: {
  comic: Comic | null;
  mi: number;
  year: number;
  isAnimating: boolean;
  pool: Comic[];
  curIdx: number;
}) {
  const pk  = comic ? getPubKey(comic.Publisher) : "OTHER";
  const pub = comic ? PUB_META[pk] : null;

  return (
    <div style={{
      height: 172,
      background: pub
        ? `linear-gradient(150deg, ${pub.bg} 0%, ${pub.dark} 100%)`
        : "var(--surface2)",
      position: "relative",
      overflow: "hidden",
      flexShrink: 0,
    }}>
      {/* halftone-dot texture overlay */}
      {pub && (
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)`,
          backgroundSize: "8px 8px",
          pointerEvents: "none",
        }} />
      )}
      {/* shine */}
      {pub && (
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 25% 25%, rgba(255,255,255,0.18) 0%, transparent 55%)",
          pointerEvents: "none",
        }} />
      )}

      {/* month label top-left */}
      <div style={{
        position: "absolute", top: 8, left: 10,
        fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.6rem", letterSpacing: "2px",
        color: pub ? "rgba(255,255,255,0.7)" : "var(--muted)",
      }}>
        {MONTH_FULL[mi].toUpperCase()} {year}
      </div>

      {/* counter top-right */}
      {pool.length > 1 && (
        <div style={{
          position: "absolute", top: 8, right: 8,
          fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.52rem", letterSpacing: "1px",
          color: "rgba(255,255,255,0.65)",
          background: "rgba(0,0,0,0.28)", borderRadius: 10, padding: "2px 7px",
        }}>
          {curIdx + 1} / {pool.length}
        </div>
      )}

      {/* Comic title + issue */}
      <div
        className={isAnimating ? "hc-comic-in" : ""}
        style={{
          position: "absolute", inset: "0 0 0 0",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "28px 10px 10px",
          textAlign: "center",
          gap: 4,
        }}
      >
        {comic ? (
          <>
            <div style={{
              fontFamily: "'Bebas Neue',sans-serif",
              fontSize: comic.Title.length > 24 ? "0.88rem" : comic.Title.length > 16 ? "1.05rem" : "1.2rem",
              letterSpacing: "1px", color: "#fff",
              lineHeight: 1.15, textShadow: "0 2px 6px rgba(0,0,0,0.45)",
              textTransform: "uppercase",
              maxHeight: 72, overflow: "hidden",
            }}>
              {comic.Title}
            </div>
            <div style={{
              fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.8rem",
              letterSpacing: "4px", color: "rgba(255,255,255,0.92)",
              textShadow: "0 2px 8px rgba(0,0,0,0.5)", lineHeight: 1,
            }}>
              #{comic.Issue.replace(/^#/, "")}
            </div>
          </>
        ) : (
          <div style={{
            fontFamily: "'Crimson Pro',serif", fontSize: "0.75rem",
            color: "var(--muted)", fontStyle: "italic",
          }}>
            No book this month
          </div>
        )}
      </div>

      {/* KEY banner bottom ribbon */}
      {comic && (comic.Key || "").toUpperCase() === "YES" && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "rgba(217,119,6,0.85)",
          fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.55rem", letterSpacing: "2px",
          color: "#fff", textAlign: "center", padding: "3px 0",
        }}>
          ★ KEY ISSUE
        </div>
      )}
    </div>
  );
}

// ── Spinner button ─────────────────────────────────────────────────────────
function SpinBtn({ pubKey, isSpinning, onClick, poolLen }: {
  pubKey: PubKey;
  isSpinning: boolean;
  onClick: () => void;
  poolLen: number;
}) {
  const { bg } = PUB_META[pubKey];
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <button
        ref={ref}
        onClick={onClick}
        disabled={isSpinning}
        className={`hc-spin-btn${isSpinning ? " hc-spinning" : ""}`}
        style={{
          width: 60, height: 60, borderRadius: "50%",
          background: `${bg}18`,
          border: `2.5px solid ${bg}`,
          color: bg,
          fontSize: "1.7rem", lineHeight: 1,
          cursor: isSpinning ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          transition: "background 0.15s, transform 0.15s",
          userSelect: "none",
        }}
        onMouseEnter={e => { if (!isSpinning) { e.currentTarget.style.background = `${bg}30`; e.currentTarget.style.transform = "scale(1.1)"; } }}
        onMouseLeave={e => { e.currentTarget.style.background = `${bg}18`; e.currentTarget.style.transform = "scale(1)"; }}
        title={`${poolLen} books this month — spin for another`}
      >
        ↻
      </button>
      <div style={{
        fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.52rem", letterSpacing: "1.5px",
        color: "var(--muted)",
      }}>
        {poolLen} BOOKS
      </div>
    </div>
  );
}

// ── Month card ─────────────────────────────────────────────────────────────
function MonthCard({ year, mi, pool, spinIdx, spinning, animating, onSpin }: {
  year: number; mi: number;
  pool: Comic[];
  spinIdx: Map<string, number>;
  spinning: Set<string>;
  animating: Set<string>;
  onSpin: (key: string, pool: Comic[]) => void;
}) {
  const key     = `${year}-${mi}`;
  const curIdx  = Math.min(spinIdx.get(key) ?? 0, Math.max(pool.length - 1, 0));
  const comic   = pool[curIdx] ?? null;
  const isSpin  = spinning.has(key);
  const isAnim  = animating.has(key);
  const pk      = comic ? getPubKey(comic.Publisher) : "OTHER";
  const pub     = PUB_META[pk];
  const isSigned = comic && (comic.Signed || "").toUpperCase() === "YES";

  return (
    <div style={{
      background: "var(--surface)",
      border: `1.5px solid ${pool.length > 0 ? "var(--border)" : "transparent"}`,
      borderRadius: 10,
      overflow: "hidden",
      display: "flex", flexDirection: "column",
      opacity: pool.length === 0 ? 0.22 : 1,
      transition: "opacity 0.2s, box-shadow 0.2s",
      boxShadow: pool.length > 0 ? "0 1px 4px rgba(0,0,0,0.07)" : "none",
    }}
    onMouseEnter={e => { if (pool.length > 0) (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.13)"; }}
    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = pool.length > 0 ? "0 1px 4px rgba(0,0,0,0.07)" : "none"; }}
    >
      <ComicCover
        comic={comic} mi={mi} year={year}
        isAnimating={isAnim} pool={pool} curIdx={curIdx}
      />

      {/* Card body */}
      <div style={{
        padding: "10px 12px 14px",
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 8,
        flex: 1,
      }}>
        {/* Publisher + signed badge row */}
        {comic && (
          <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <span style={{
              fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.55rem", letterSpacing: "1.5px",
              color: pub.bg, background: pub.bg + "18",
              border: `1px solid ${pub.bg}40`,
              padding: "2px 7px", borderRadius: 3,
            }}>
              {comic.Publisher || "INDEPENDENT"}
            </span>
            {isSigned && (
              <span style={{
                fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.55rem", letterSpacing: "1px",
                color: "#8b2be2", background: "#8b2be215",
                border: "1px solid #8b2be230", padding: "2px 6px", borderRadius: 3,
              }}>✍ SIGNED</span>
            )}
          </div>
        )}

        {/* Key reason */}
        {comic && (comic.Key || "").toUpperCase() === "YES" && comic.Key_Reason && (
          <div style={{
            fontSize: "0.63rem", color: "var(--muted2)", fontFamily: "'Crimson Pro',serif",
            textAlign: "center", lineHeight: 1.35, fontStyle: "italic",
            display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const, overflow: "hidden",
            maxWidth: "100%",
          }}>
            {comic.Key_Reason}
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Spin button */}
        {pool.length > 1 ? (
          <SpinBtn
            pubKey={pk}
            isSpinning={isSpin}
            onClick={() => onSpin(key, pool)}
            poolLen={pool.length}
          />
        ) : pool.length === 1 ? (
          <div style={{ height: 60, display: "flex", alignItems: "center" }}>
            <div style={{
              fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.52rem", letterSpacing: "1.5px",
              color: "var(--muted)", padding: "4px 10px", border: "1px dashed var(--border)", borderRadius: 20,
            }}>
              1 BOOK
            </div>
          </div>
        ) : (
          <div style={{ height: 60, display: "flex", alignItems: "center" }}>
            <div style={{
              fontFamily: "'Crimson Pro',serif", fontSize: "0.65rem",
              color: "var(--muted)", fontStyle: "italic",
            }}>
              no match
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function ComicHistory() {
  const [pubFilter,  setPubFilter]  = useState<PubFilter>("ALL");
  const [keyOnly,    setKeyOnly]    = useState(false);
  const [signedOnly, setSignedOnly] = useState(false);
  const [spinIdx,    setSpinIdx]    = useState<Map<string, number>>(new Map());
  const [spinning,   setSpinning]   = useState<Set<string>>(new Set());
  const [animating,  setAnimating]  = useState<Set<string>>(new Set());

  // Reset spin positions when filter changes
  useEffect(() => { setSpinIdx(new Map()); }, [pubFilter, keyOnly, signedOnly]);

  const filterComic = useCallback((c: Comic): boolean => {
    if (pubFilter !== "ALL" && getPubKey(c.Publisher) !== pubFilter) return false;
    if (keyOnly    && (c.Key    || "").toUpperCase() !== "YES") return false;
    if (signedOnly && (c.Signed || "").toUpperCase() !== "YES") return false;
    return true;
  }, [pubFilter, keyOnly, signedOnly]);

  const spin = useCallback((key: string, pool: Comic[]) => {
    if (pool.length < 2) return;
    setSpinning(prev => new Set(prev).add(key));
    setAnimating(prev => new Set(prev).add(key));

    setTimeout(() => {
      setSpinIdx(prev => {
        const next = new Map(prev);
        const cur  = next.get(key) ?? 0;
        let ni     = Math.floor(Math.random() * pool.length);
        if (ni === cur && pool.length > 1) ni = (cur + 1) % pool.length;
        next.set(key, ni);
        return next;
      });
    }, 180);

    setTimeout(() => {
      setSpinning(prev => { const n = new Set(prev); n.delete(key); return n; });
    }, 200);

    setTimeout(() => {
      setAnimating(prev => { const n = new Set(prev); n.delete(key); return n; });
    }, 540);
  }, []);

  const years = useMemo(() => [...YEARS_PRESENT].reverse(), []);

  // Per-year filtered comic count
  const yearStats = useMemo(() => {
    const m = new Map<number, number>();
    for (const y of YEARS_PRESENT) {
      const count = (BY_YEAR.get(y) || []).filter(filterComic).length;
      m.set(y, count);
    }
    return m;
  }, [filterComic]);

  const totalFiltered = useMemo(() =>
    [...yearStats.values()].reduce((a, b) => a + b, 0),
  [yearStats]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 16px 80px" }}>

      {/* ── HEADER ── */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{
          fontFamily: "'Bebas Neue',sans-serif", fontSize: "2.4rem",
          letterSpacing: "4px", color: "var(--red)", margin: 0, lineHeight: 1,
        }}>
          COMIC HISTORY
        </h1>
        <p style={{
          fontSize: "0.87rem", color: "var(--muted2)", marginTop: 7,
          fontFamily: "'Crimson Pro',serif",
        }}>
          July 1974 to today — one book from Roberto's collection for every month in history.
          Hit the big round button to spin to another.
        </p>
      </div>

      {/* ── FILTER BAR ── */}
      <div style={{
        background: "var(--surface)", border: "1.5px solid var(--border)",
        borderRadius: 10, padding: "12px 16px", marginBottom: 24,
        display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
      }}>
        {/* Publisher pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PUB_FILTERS.map(f => {
            const active = pubFilter === f.id;
            const color  = f.id === "ALL" ? "var(--red)" : PUB_META[f.id as PubKey]?.bg ?? "var(--red)";
            return (
              <button
                key={f.id}
                onClick={() => setPubFilter(f.id)}
                style={{
                  fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.7rem", letterSpacing: "1.5px",
                  padding: "5px 14px", borderRadius: 20,
                  background: active ? color : "transparent",
                  color: active ? "#fff" : "var(--muted)",
                  border: `1.5px solid ${active ? color : "var(--border)"}`,
                  cursor: "pointer", transition: "all 0.14s",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: "var(--border)", flexShrink: 0 }} />

        {/* Toggle buttons */}
        {([
          { label: "★ KEY ONLY",    active: keyOnly,    toggle: () => setKeyOnly(v => !v),    color: "#d97706" },
          { label: "✍ SIGNED ONLY", active: signedOnly, toggle: () => setSignedOnly(v => !v), color: "#8b2be2" },
        ] as const).map(t => (
          <button
            key={t.label}
            onClick={t.toggle}
            style={{
              fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.7rem", letterSpacing: "1.5px",
              padding: "5px 14px", borderRadius: 20,
              background: t.active ? t.color : "transparent",
              color: t.active ? "#fff" : "var(--muted)",
              border: `1.5px solid ${t.active ? t.color : "var(--border)"}`,
              cursor: "pointer", transition: "all 0.14s",
            }}
          >
            {t.label}
          </button>
        ))}

        {/* Result count */}
        <div style={{
          marginLeft: "auto",
          fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", letterSpacing: "1.5px",
          color: "var(--muted)",
        }}>
          {totalFiltered.toLocaleString()} BOOKS IN VIEW
        </div>
      </div>

      {/* ── YEARS ── */}
      {years.map(year => {
        const yearComics = BY_YEAR.get(year)!;
        const filtered   = yearStats.get(year) ?? 0;
        if (filtered === 0) return null;

        return (
          <div key={year} style={{ marginBottom: 36 }}>
            {/* Year heading */}
            <div style={{
              display: "flex", alignItems: "baseline", gap: 14,
              borderBottom: "3px solid var(--red)", paddingBottom: 8, marginBottom: 14,
            }}>
              <span style={{
                fontFamily: "'Bebas Neue',sans-serif", fontSize: "2.6rem",
                letterSpacing: "5px", color: "var(--red)", lineHeight: 1,
              }}>
                {year}
              </span>
              <span style={{
                fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.62rem",
                letterSpacing: "2px", color: "var(--muted)",
              }}>
                {filtered} BOOKS
              </span>
            </div>

            {/* 12-month grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))",
              gap: 12,
            }}>
              {MONTH_LABELS.map((_, mi) => {
                if (!isMonthVisible(year, mi)) return null;
                const rawPool = monthPool(yearComics, mi);
                const pool    = rawPool.filter(filterComic);
                return (
                  <MonthCard
                    key={mi}
                    year={year} mi={mi}
                    pool={pool}
                    spinIdx={spinIdx}
                    spinning={spinning}
                    animating={animating}
                    onSpin={spin}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Jump to top */}
      <div style={{ textAlign: "center", marginTop: 32 }}>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{
            fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.8rem", letterSpacing: "2px",
            color: "var(--red)", background: "none",
            border: "1.5px solid var(--red)", borderRadius: 6, padding: "9px 28px", cursor: "pointer",
          }}
        >
          ↑ BACK TO TOP
        </button>
      </div>
    </div>
  );
}
