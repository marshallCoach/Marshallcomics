import { useState, useMemo } from "react";
import { DATA } from "@/data/data";

const STORAGE_KEY = "boxlabels_checked";

function loadChecked(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* */ }
  return new Set();
}
function saveChecked(s: Set<string>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...s])); } catch { /* */ }
}

type PubType = "Marvel" | "DC" | "Independent" | "Mixed";

const PUB_COLORS: Record<PubType, { bg: string; card: string; accent: string; label: string }> = {
  Marvel:      { bg: "#c8102e", card: "#fff5f6", accent: "#c8102e", label: "#fff" },
  DC:          { bg: "#1d4ed8", card: "#eff6ff", accent: "#1d4ed8", label: "#fff" },
  Independent: { bg: "#16a34a", card: "#f0faf2", accent: "#16a34a", label: "#fff" },
  Mixed:       { bg: "#7c3aed", card: "#f5f0ff", accent: "#7c3aed", label: "#fff" },
};

function dominantPublisher(boxNum: string): PubType {
  const comics = DATA.comics.filter(c => String(c.Box).trim() === String(boxNum).trim());
  if (!comics.length) return "Mixed";
  const counts: Record<string, number> = {};
  for (const c of comics) {
    const p = (c.Publisher || "").toUpperCase();
    const key = p.includes("MARVEL") ? "Marvel" : p.includes("DC") ? "DC" : "Independent";
    counts[key] = (counts[key] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length < 2) return sorted[0][0] as PubType;
  const total  = Object.values(counts).reduce((s, n) => s + n, 0);
  if (sorted[0][1] / total < 0.55) return "Mixed";
  return sorted[0][0] as PubType;
}

// Split an array into chunks of `size`
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function BoxLabels() {
  const [checked,   setChecked]   = useState<Set<string>>(loadChecked);
  const [filter,    setFilter]    = useState<"all" | "todo" | "done">("todo");
  const [pubFilter, setPubFilter] = useState<"" | PubType>("");
  // collapsed groups: set of group-index strings
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const boxes = DATA.boxes;

  const enriched = useMemo(() =>
    boxes.map(b => ({ ...b, pub: dominantPublisher(b.Num) })),
  [boxes]);

  const [todo, done] = useMemo(() => {
    const t = enriched.filter(b => !checked.has(b.Num));
    const d = enriched.filter(b =>  checked.has(b.Num));
    return [t, d];
  }, [enriched, checked]);

  const displayed = useMemo(() => {
    let list = filter === "done" ? done : filter === "todo" ? todo : enriched;
    if (pubFilter) list = list.filter(b => b.pub === pubFilter);
    return list;
  }, [filter, pubFilter, todo, done, enriched]);

  const groups = useMemo(() => chunk(displayed, 10), [displayed]);

  const allCollapsed = collapsed.size === groups.length && groups.length > 0;
  const allExpanded  = collapsed.size === 0;

  function toggle(num: string) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(num) ? next.delete(num) : next.add(num);
      saveChecked(next);
      return next;
    });
  }

  function clearAll() {
    setChecked(new Set());
    saveChecked(new Set());
  }

  function toggleGroup(i: number) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function collapseAll() {
    setCollapsed(new Set(groups.map((_, i) => i)));
  }

  function expandAll() {
    setCollapsed(new Set());
  }

  const progress = Math.round((checked.size / boxes.length) * 100);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 80 }}>

      {/* ── Sticky Controls ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "var(--surface)", borderBottom: "2px solid var(--border)",
        padding: "10px 14px",
      }}>
        {/* Progress bar */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.75rem", letterSpacing: "1.5px", color: "var(--muted2)" }}>LABELLED</span>
            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.9rem", letterSpacing: "1px", color: checked.size > 0 ? "var(--red)" : "var(--muted2)" }}>
              {checked.size} / {boxes.length} — {progress}%
            </span>
          </div>
          <div style={{ height: 5, background: "var(--surface2)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "var(--red)", borderRadius: 3, transition: "width 0.3s ease" }} />
          </div>
        </div>

        {/* Filter pills + collapse controls */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
          {(["todo","all","done"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.72rem", letterSpacing: "1.5px",
              padding: "5px 12px", borderRadius: 20, border: "1.5px solid",
              cursor: "pointer", transition: "all 0.15s",
              background: filter === f ? "var(--red)" : "transparent",
              borderColor: filter === f ? "var(--red)" : "var(--border)",
              color: filter === f ? "#fff" : "var(--muted2)",
            }}>
              {f === "todo" ? `To Do (${todo.length})` : f === "done" ? `Done (${done.length})` : `All (${boxes.length})`}
            </button>
          ))}

          {(Object.keys(PUB_COLORS) as PubType[]).map(p => {
            const col = PUB_COLORS[p];
            const isOn = pubFilter === p;
            return (
              <button key={p} onClick={() => setPubFilter(isOn ? "" : p)} style={{
                fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.68rem", letterSpacing: "1.2px",
                padding: "5px 11px", borderRadius: 20, border: `1.5px solid ${col.bg}`,
                cursor: "pointer", transition: "all 0.15s",
                background: isOn ? col.bg : "transparent",
                color: isOn ? col.label : col.bg,
              }}>{p}</button>
            );
          })}

          {/* Separator */}
          <div style={{ width: 1, height: 18, background: "var(--border)", margin: "0 2px" }} />

          {/* Collapse / Expand All */}
          <button onClick={expandAll} disabled={allExpanded} style={{
            fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.68rem", letterSpacing: "1.2px",
            padding: "5px 11px", borderRadius: 20, border: "1.5px solid var(--border)",
            cursor: allExpanded ? "default" : "pointer", background: "transparent",
            color: allExpanded ? "var(--muted)" : "var(--text2)", opacity: allExpanded ? 0.45 : 1,
          }}>Expand All</button>
          <button onClick={collapseAll} disabled={allCollapsed || groups.length === 0} style={{
            fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.68rem", letterSpacing: "1.2px",
            padding: "5px 11px", borderRadius: 20, border: "1.5px solid var(--border)",
            cursor: (allCollapsed || groups.length === 0) ? "default" : "pointer", background: "transparent",
            color: (allCollapsed || groups.length === 0) ? "var(--muted)" : "var(--text2)",
            opacity: (allCollapsed || groups.length === 0) ? 0.45 : 1,
          }}>Collapse All</button>

          {checked.size > 0 && (
            <button onClick={clearAll} style={{
              fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.68rem", letterSpacing: "1.2px",
              padding: "5px 11px", borderRadius: 20, border: "1.5px solid var(--border)",
              cursor: "pointer", background: "transparent", color: "var(--muted2)",
              marginLeft: "auto",
            }}>Reset All</button>
          )}
        </div>
      </div>

      {/* ── Publisher Key ── */}
      <div style={{
        display: "flex", gap: 8, flexWrap: "wrap", padding: "10px 14px 4px",
        borderBottom: "1px solid var(--border)", background: "var(--surface)",
      }}>
        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.62rem", letterSpacing: "1.5px", color: "var(--muted)", alignSelf: "center" }}>KEY:</span>
        {(Object.entries(PUB_COLORS) as [PubType, typeof PUB_COLORS[PubType]][]).map(([p, col]) => (
          <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", letterSpacing: "1px", color: "var(--text2)" }}>
            <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, background: col.bg, flexShrink: 0 }} />
            {p}
          </span>
        ))}
      </div>

      {/* ── Groups of 10 ── */}
      <div style={{ padding: "12px 10px", display: "flex", flexDirection: "column", gap: 0 }}>

        {groups.length === 0 && (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.9rem",
            letterSpacing: "2px", color: "var(--muted)",
          }}>
            {filter === "done" ? "No boxes labelled yet — tap a card to mark it done." : "ALL DONE — GREAT WORK!"}
          </div>
        )}

        {groups.map((group, gi) => {
          const isCollapsed = collapsed.has(gi);
          const firstNum = parseInt(group[0].Num.replace(/\D/g, ""), 10);
          const lastNum  = parseInt(group[group.length - 1].Num.replace(/\D/g, ""), 10);
          const doneInGroup = group.filter(b => checked.has(b.Num)).length;
          const allDone = doneInGroup === group.length;

          return (
            <div key={gi} style={{ marginBottom: 16 }}>

              {/* Group header */}
              <button
                onClick={() => toggleGroup(gi)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  background: allDone ? "#f4f3f0" : "var(--surface)",
                  border: "1.5px solid var(--border)",
                  borderBottom: isCollapsed ? "1.5px solid var(--border)" : "none",
                  borderRadius: isCollapsed ? 8 : "8px 8px 0 0",
                  padding: "10px 16px", cursor: "pointer",
                  fontFamily: "'Bebas Neue',sans-serif",
                  transition: "background 0.15s",
                }}
              >
                {/* Chevron */}
                <span style={{
                  display: "inline-block", fontSize: "0.7rem",
                  color: "var(--muted)", transition: "transform 0.2s",
                  transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                }}>▼</span>

                {/* Range label */}
                <span style={{ fontSize: "0.85rem", letterSpacing: "3px", color: "var(--text2)", flex: 1, textAlign: "left" }}>
                  BOXES {String(firstNum).padStart(2, "0")} – {String(lastNum).padStart(2, "0")}
                </span>

                {/* Progress badge */}
                <span style={{
                  fontSize: "0.65rem", letterSpacing: "1px",
                  color: allDone ? "#16a34a" : doneInGroup > 0 ? "var(--red)" : "var(--muted)",
                  background: allDone ? "#f0faf2" : doneInGroup > 0 ? "#fff5f6" : "var(--surface2)",
                  border: `1px solid ${allDone ? "#bbf7d0" : doneInGroup > 0 ? "#fecdd3" : "var(--border)"}`,
                  borderRadius: 20, padding: "2px 10px",
                }}>
                  {doneInGroup}/{group.length}{allDone ? " ✓" : ""}
                </span>
              </button>

              {/* Cards grid — hidden when collapsed */}
              {!isCollapsed && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
                  gap: 12,
                  padding: 12,
                  background: "var(--bg)",
                  border: "1.5px solid var(--border)",
                  borderTop: "none",
                  borderRadius: "0 0 8px 8px",
                }}>
                  {group.map(b => {
                    const isDone = checked.has(b.Num);
                    const col    = PUB_COLORS[b.pub];

                    return (
                      <div
                        key={b.Num}
                        onClick={() => toggle(b.Num)}
                        style={{
                          background:   isDone ? "#f2f1ef" : col.card,
                          border:       `2px solid ${isDone ? "#d0cec8" : col.accent}`,
                          borderTop:    `6px solid ${isDone ? "#c0beba" : col.bg}`,
                          borderRadius: 10,
                          padding:      "18px 18px 16px",
                          cursor:       "pointer",
                          opacity:      isDone ? 0.6 : 1,
                          transition:   "all 0.2s ease",
                          position:     "relative",
                          userSelect:   "none",
                          WebkitTapHighlightColor: "transparent",
                          minHeight:    350,
                          display:      "flex",
                          flexDirection:"column",
                          gap:          12,
                          boxShadow:    isDone ? "none" : "0 2px 10px rgba(0,0,0,0.07)",
                        }}
                      >
                        {/* Checkbox indicator */}
                        <div style={{
                          position: "absolute", top: 14, right: 14,
                          width: 30, height: 30, borderRadius: "50%",
                          border: `2.5px solid ${isDone ? "#a0a09a" : col.accent}`,
                          background: isDone ? "#a0a09a" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.2s", flexShrink: 0,
                        }}>
                          {isDone && (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>

                        {/* Publisher badge */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", letterSpacing: "2px",
                            background: isDone ? "#c0beba" : col.bg, color: isDone ? "#7a7875" : col.label,
                            padding: "2px 9px", borderRadius: 3,
                          }}>{b.pub.toUpperCase()}</span>
                          {b.Location && (
                            <span style={{
                              fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.62rem", letterSpacing: "1px",
                              color: "var(--muted)", background: "var(--surface2)",
                              padding: "2px 8px", borderRadius: 3, border: "1px solid var(--border)",
                            }}>{b.Location}</span>
                          )}
                        </div>

                        {/* Box Number — HUGE */}
                        <div style={{
                          fontFamily: "'Bebas Neue',sans-serif",
                          fontSize: "clamp(3.5rem, 14vw, 5rem)",
                          lineHeight: 0.9, letterSpacing: "2px",
                          color: isDone ? "#a0a09a" : col.accent,
                        }}>
                          BOX {String(b.Num).padStart(2, "0")}
                        </div>

                        {/* Label */}
                        {b.Label && b.Label !== "nan" && (
                          <div style={{
                            fontFamily: "'Bebas Neue',sans-serif",
                            fontSize: "1.15rem", letterSpacing: "2px",
                            color: isDone ? "#a0a09a" : "var(--text2)", lineHeight: 1.2,
                          }}>
                            {b.Label}
                          </div>
                        )}

                        {/* First / Last books */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, flex: 1 }}>
                          {[["FIRST BOOK", b.FirstBook], ["LAST BOOK", b.LastBook]].map(([lbl, val]) => (
                            <div key={lbl} style={{
                              background: "rgba(0,0,0,0.04)", borderRadius: 6, padding: "10px 12px",
                              borderLeft: `3px solid ${isDone ? "#c0beba" : col.accent}`,
                            }}>
                              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.58rem", letterSpacing: "2px", color: "var(--muted)", marginBottom: 4 }}>{lbl}</div>
                              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(0.82rem, 3.2vw, 1rem)", letterSpacing: "0.5px", lineHeight: 1.3, color: isDone ? "#a0a09a" : "var(--text)" }}>
                                {val && val !== "nan" ? val : "—"}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Stats row */}
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.05rem", letterSpacing: "1px", color: isDone ? "#a0a09a" : "var(--text2)" }}>
                            {b.Comics} <span style={{ fontSize: "0.6rem", letterSpacing: "1.5px", color: "var(--muted)" }}>COMICS</span>
                          </span>
                          {b.Keys > 0 && (
                            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.05rem", letterSpacing: "1px", color: isDone ? "#a0a09a" : "#8a6000" }}>
                              {b.Keys} <span style={{ fontSize: "0.6rem", letterSpacing: "1.5px", color: isDone ? "var(--muted)" : "#8a6000" }}>KEYS</span>
                            </span>
                          )}
                          {b.Signed > 0 && (
                            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.05rem", letterSpacing: "1px", color: isDone ? "#a0a09a" : "#16a34a" }}>
                              {b.Signed} <span style={{ fontSize: "0.6rem", letterSpacing: "1.5px", color: isDone ? "var(--muted)" : "#16a34a" }}>SIGNED</span>
                            </span>
                          )}
                          {b.YearRange && b.YearRange !== "nan" && (
                            <span style={{ marginLeft: "auto", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.82rem", letterSpacing: "1px", color: "var(--muted)" }}>
                              {b.YearRange}
                            </span>
                          )}
                        </div>

                        {/* Notes */}
                        {b.Notes && b.Notes !== "nan" && (
                          <div style={{ fontFamily: "'Crimson Pro',serif", fontSize: "0.82rem", lineHeight: 1.4, color: "var(--muted2)", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                            {b.Notes}
                          </div>
                        )}

                        {/* Done overlay text */}
                        {isDone && (
                          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.75rem", letterSpacing: "2.5px", color: "#b0ada8", textAlign: "center", marginTop: 4 }}>
                            TAP TO UNMARK
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
