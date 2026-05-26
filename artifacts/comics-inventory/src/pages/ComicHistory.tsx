import { useState, useMemo, useCallback } from "react";
import { DATA3 } from "@/data/data3";
import type { Comic } from "@/data/data3";

const comics = DATA3.comics;

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTH_LABELS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const MONTH_FULL   = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const TODAY      = new Date();
const END_YEAR   = TODAY.getFullYear();
const END_MONTH  = TODAY.getMonth(); // 0-indexed
const START_YEAR = 1974;
const START_MONTH = 6; // July 1974, 0-indexed

// ── Build year → sorted comic list (static, computed once at module level) ────
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

// Get comics assigned to a particular month slot (index % 12 === monthIdx)
function monthPool(yearComics: Comic[], monthIdx: number): Comic[] {
  return yearComics.filter((_, i) => i % 12 === monthIdx);
}

// ── Publisher chip color ──────────────────────────────────────────────────────
function pubColor(pub: string): string {
  const u = (pub || "").toUpperCase();
  if (u === "MARVEL" || u === "MARVEL COMICS") return "#c8102e";
  if (u === "DC" || u === "DC COMICS")         return "#1d6fa4";
  if (u === "IMAGE")                           return "#f97316";
  if (u.includes("DARK HORSE"))                return "#7c3aed";
  if (u === "IDW" || u.includes("IDW"))        return "#22c55e";
  if (u.includes("BOOM"))                      return "#16a34a";
  if (u === "VALIANT")                         return "#8b2be2";
  return "#6b7280";
}

// ── Stats ─────────────────────────────────────────────────────────────────────
const YEARS_PRESENT = [...BY_YEAR.keys()].sort((a, b) => a - b);
const TOTAL_MONTHS  = (() => {
  let n = 0;
  for (const y of YEARS_PRESENT) {
    const arr = BY_YEAR.get(y)!;
    for (let m = 0; m < 12; m++) {
      if (!isMonthVisible(y, m)) continue;
      if (monthPool(arr, m).length > 0) n++;
    }
  }
  return n;
})();

function isMonthVisible(year: number, monthIdx: number): boolean {
  if (year === START_YEAR && monthIdx < START_MONTH) return false;
  if (year === END_YEAR   && monthIdx > END_MONTH)   return false;
  return true;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ComicHistory() {
  // spinIdx: "year-month" → current index in that month's pool
  const [spinIdx,  setSpinIdx]  = useState<Map<string, number>>(new Map());
  const [spinning, setSpinning] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([END_YEAR]));

  const toggleYear = useCallback((y: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(y) ? next.delete(y) : next.add(y);
      return next;
    });
  }, []);

  const spin = useCallback((key: string, poolLen: number) => {
    if (poolLen < 2) return;
    setSpinning(prev => new Set(prev).add(key));
    setTimeout(() => {
      setSpinIdx(prev => {
        const next = new Map(prev);
        const cur = next.get(key) ?? 0;
        next.set(key, (cur + 1) % poolLen);
        return next;
      });
      setSpinning(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 180);
  }, []);

  // Years in descending order (most recent first)
  const years = useMemo(() => [...YEARS_PRESENT].reverse(), []);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 80px" }}>

      {/* ── HEADER ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"2rem", letterSpacing:"3px", color:"var(--red)", margin:0, lineHeight:1 }}>
          COMIC HISTORY
        </h1>
        <p style={{ fontSize:"0.82rem", color:"var(--muted2)", marginTop:6, fontFamily:"'Crimson Pro',serif" }}>
          Every month from July 1974 to today — one book from Roberto's collection featured per month. Hit ↻ to spin to another.
        </p>
      </div>

      {/* ── STAT ROW ── */}
      <div style={{ display:"flex", gap:12, marginBottom:28, flexWrap:"wrap" }}>
        {[
          { val: YEARS_PRESENT.length, lbl: "Years Covered" },
          { val: TOTAL_MONTHS,         lbl: "Months with Books" },
          { val: comics.filter(c => parseInt(c.Year||"0") >= START_YEAR).length.toLocaleString(), lbl: "Comics in Range" },
        ].map((s, i) => (
          <div key={i} style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderTop:"3px solid var(--red)", borderRadius:8, padding:"10px 18px", flex:"0 0 auto" }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.6rem", color:"var(--red)", letterSpacing:"2px", lineHeight:1 }}>{s.val}</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem", letterSpacing:"2.5px", color:"var(--muted)", marginTop:3 }}>{s.lbl}</div>
          </div>
        ))}
        <div style={{ fontSize:"0.7rem", color:"var(--muted)", alignSelf:"center", marginLeft:"auto", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>
          ↻ = SPIN TO ANOTHER BOOK FROM THAT YEAR
        </div>
      </div>

      {/* ── TIMELINE ── */}
      {years.map(year => {
        const yearComics = BY_YEAR.get(year)!;
        const isOpen = expanded.has(year);

        // How many months have at least one comic
        const activeMo = MONTH_LABELS
          .map((_, mi) => mi)
          .filter(mi => isMonthVisible(year, mi) && monthPool(yearComics, mi).length > 0).length;

        return (
          <div key={year} style={{ marginBottom: 16 }}>
            {/* Year header */}
            <button
              onClick={() => toggleYear(year)}
              style={{
                width:"100%", display:"flex", alignItems:"center", gap:14,
                background: isOpen ? "var(--red)" : "var(--surface)",
                border:`2px solid ${isOpen ? "var(--red)" : "var(--border)"}`,
                borderRadius:8, padding:"12px 18px", cursor:"pointer", textAlign:"left",
                transition:"all 0.18s",
              }}
            >
              <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"2rem", letterSpacing:"4px", color: isOpen ? "#fff" : "var(--red)", lineHeight:1 }}>
                {year}
              </span>
              <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"2px", color: isOpen ? "rgba(255,255,255,0.7)" : "var(--muted)" }}>
                {yearComics.length} BOOKS · {activeMo} MONTHS
              </span>
              <span style={{ marginLeft:"auto", fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.75rem", color: isOpen ? "rgba(255,255,255,0.6)" : "var(--muted)" }}>
                {isOpen ? "▲ COLLAPSE" : "▼ EXPAND"}
              </span>
            </button>

            {/* Month grid */}
            {isOpen && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))", gap:8, marginTop:8 }}>
                {MONTH_LABELS.map((lbl, mi) => {
                  if (!isMonthVisible(year, mi)) return null;

                  const pool  = monthPool(yearComics, mi);
                  const key   = `${year}-${mi}`;
                  const idx   = spinIdx.get(key) ?? 0;
                  const comic = pool[idx] ?? null;
                  const isSpinning = spinning.has(key);
                  const isKey    = comic && (comic.Key    || "").toUpperCase() === "YES";
                  const isSigned = comic && (comic.Signed || "").toUpperCase() === "YES";
                  const pc = comic ? pubColor(comic.Publisher) : "#6b7280";

                  return (
                    <div
                      key={mi}
                      style={{
                        background: comic ? "var(--surface)" : "var(--surface2)",
                        border: `1.5px solid ${comic ? "var(--border)" : "transparent"}`,
                        borderRadius: 8,
                        padding: "12px 12px 10px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        minHeight: 148,
                        opacity: comic ? 1 : 0.35,
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      {/* Month label */}
                      <div style={{ display:"flex", alignItems:"baseline", gap:5, justifyContent:"space-between" }}>
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.9rem", letterSpacing:"2px", color:"var(--red)" }}>
                          {lbl}
                        </span>
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.55rem", letterSpacing:"1px", color:"var(--muted)" }}>
                          {year}
                        </span>
                      </div>

                      {/* Accent bar */}
                      <div style={{ height:2, borderRadius:1, background: comic ? pc : "var(--border)", width:"100%", flexShrink:0 }} />

                      {/* Comic content or empty state */}
                      {comic ? (
                        <div
                          className={isSpinning ? "history-card-spin" : ""}
                          style={{ flex:1, display:"flex", flexDirection:"column", gap:4 }}
                        >
                          {/* Publisher chip */}
                          <span style={{
                            fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.52rem",
                            letterSpacing:"1.5px", color: pc,
                            background: pc + "18", border:`1px solid ${pc}30`,
                            padding:"1px 6px", borderRadius:3, alignSelf:"flex-start",
                          }}>
                            {comic.Publisher || "Independent"}
                          </span>

                          {/* Title */}
                          <div style={{
                            fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.82rem",
                            letterSpacing:"0.5px", color:"var(--text)",
                            lineHeight:1.2, flex:1,
                            overflow:"hidden", display:"-webkit-box",
                            WebkitLineClamp:3, WebkitBoxOrient:"vertical" as const,
                          }}>
                            {comic.Title}
                          </div>

                          {/* Issue */}
                          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", color:"var(--red)", letterSpacing:"1px" }}>
                            {comic.Issue}
                          </div>

                          {/* Badges */}
                          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                            {isKey && (
                              <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.48rem", letterSpacing:"1px", color:"#d97706", background:"#d9770618", border:"1px solid #d9770630", padding:"1px 5px", borderRadius:3 }}>
                                KEY
                              </span>
                            )}
                            {isSigned && (
                              <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.48rem", letterSpacing:"1px", color:"#8b2be2", background:"#8b2be218", border:"1px solid #8b2be230", padding:"1px 5px", borderRadius:3 }}>
                                SIGNED
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <span style={{ fontSize:"0.65rem", color:"var(--muted)", fontFamily:"'Crimson Pro',serif" }}>
                            No book this month
                          </span>
                        </div>
                      )}

                      {/* Spinner button */}
                      {pool.length > 1 && (
                        <button
                          onClick={() => spin(key, pool.length)}
                          title={`${pool.length} books this month — spin for another`}
                          style={{
                            position:"absolute", top:8, right:8,
                            background:"none", border:"none", cursor:"pointer",
                            fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.75rem",
                            color:"var(--muted)", padding:"2px 4px",
                            borderRadius:4, lineHeight:1,
                            transition:"color 0.12s, transform 0.18s",
                          }}
                          onMouseOver={e => { e.currentTarget.style.color = "var(--red)"; }}
                          onMouseOut={e => { e.currentTarget.style.color = "var(--muted)"; }}
                        >
                          ↻ {pool.length}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Jump to top */}
      <div style={{ textAlign:"center", marginTop:24 }}>
        <button
          onClick={() => window.scrollTo({ top:0, behavior:"smooth" })}
          style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.8rem", letterSpacing:"2px", color:"var(--red)", background:"none", border:"1.5px solid var(--red)", borderRadius:6, padding:"9px 24px", cursor:"pointer" }}
        >
          ↑ BACK TO TOP
        </button>
      </div>
    </div>
  );
}
