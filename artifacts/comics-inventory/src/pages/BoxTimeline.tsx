import { useMemo, useState } from "react";
import { DATA3 } from "@/data/data3";

const boxes  = DATA3.boxes;
const comics = DATA3.comics;

const MONTH_ORDER: Record<string, number> = {
  jan:0, feb:1, mar:2, apr:3, may:4, jun:5,
  jul:6, aug:7, sep:8, oct:9, nov:10, dec:11,
};

function parseDate(s: string): number {
  if (!s || s.toLowerCase().includes("original") || s.toLowerCase().includes("session")) return 0;
  const m = s.match(/([a-z]+)\s*\.?\s*(\d{1,2})[,.]?\s*(\d{4})?/i);
  if (!m) return 1;
  const mon = MONTH_ORDER[(m[1]||"").toLowerCase().slice(0,3)] ?? 0;
  const day = parseInt(m[2])||1;
  const yr  = parseInt(m[3]||"2025");
  return yr * 10000 + mon * 100 + day;
}

const TARGET_BOXES = 65;

export default function BoxTimeline() {
  const entries = useMemo(() => {
    return boxes
      .map(b => {
        const comicsInBox = comics.filter(c => {
          const bNum = b.Num.replace("BOX ","").replace(/^0/,"");
          const cBox = String(c.Box||"").replace(/^0/,"");
          return cBox === bNum || `BOX ${c.Box.padStart(2,"0")}` === b.Num;
        });
        return {
          ...b,
          sortKey: parseDate(b.DateAdded),
          comicCount: comicsInBox.length || b.Comics,
          keys: b.Keys,
          signed: b.Signed,
        };
      })
      .sort((a, b) => a.sortKey - b.sortKey);
  }, []);

  const maxCount = Math.max(...entries.map(e => e.comicCount));

  const groups = useMemo(() => {
    const g: Record<string, typeof entries> = {};
    for (const e of entries) {
      const label = e.sortKey === 0 ? "Original Session" : (e.DateAdded || "Unknown");
      if (!g[label]) g[label] = [];
      g[label].push(e);
    }
    return Object.entries(g);
  }, [entries]);

  // First group open by default
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([0]));

  const toggleGroup = (gi: number) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(gi) ? n.delete(gi) : n.add(gi);
      return n;
    });
  };

  const boxPct = Math.round((entries.length / TARGET_BOXES) * 100);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "18px 18px 60px" }}>

      {/* Progress summary */}
      <div style={{ marginBottom: 24, padding: "14px 18px",
        background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.75rem", letterSpacing: "2px", color: "var(--red)", marginBottom: 2 }}>
              BOX COLLECTION PROGRESS
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--muted2)" }}>
              <strong style={{ color: "var(--text)", fontFamily: "'Bebas Neue',sans-serif", fontSize: "1rem" }}>{entries.length}</strong> of{" "}
              <strong style={{ color: "var(--text)", fontFamily: "'Bebas Neue',sans-serif", fontSize: "1rem" }}>{TARGET_BOXES}</strong> boxes catalogued
              &nbsp;·&nbsp;{TARGET_BOXES - entries.length} remaining
              &nbsp;·&nbsp;<span style={{ color: "var(--muted)" }}>{groups.length} entry sessions</span>
            </div>
          </div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "2rem", color: "var(--red)", letterSpacing: "1px", lineHeight: 1 }}>
            {boxPct}%
          </div>
        </div>
        <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${boxPct}%`, height: "100%", background: "var(--red)", borderRadius: 4, transition: "width 0.4s ease" }} />
        </div>
      </div>

      {/* Timeline label */}
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.8rem", letterSpacing: "2px", color: "var(--red)", marginBottom: 16 }}>
        COLLECTION TIMELINE — BOXES BY DATE ADDED
      </div>

      <div style={{ position: "relative", paddingLeft: 28 }}>
        {/* Vertical line */}
        <div style={{ position: "absolute", left: 10, top: 8, bottom: 8, width: 2, background: "var(--border)", borderRadius: 2 }} />

        {groups.map(([dateLabel, groupBoxes], gi) => {
          const isOpen = expanded.has(gi);
          const isOriginal = dateLabel === "Original Session";
          const dotColor = isOriginal ? "#4a3018" : "var(--red)";

          return (
            <div key={gi} style={{ marginBottom: 24, position: "relative" }}>
              {/* Date dot */}
              <div style={{
                position: "absolute", left: -22, top: 3,
                width: 14, height: 14, borderRadius: "50%",
                background: dotColor,
                border: "2px solid var(--surface)",
                boxShadow: "0 0 0 2px " + dotColor + "20",
              }} />

              {/* Clickable date header */}
              <button
                onClick={() => toggleGroup(gi)}
                style={{
                  background: "none", border: "none", padding: "0 0 8px 0", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
                }}
              >
                <span style={{
                  fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.85rem", letterSpacing: "2px",
                  color: isOriginal ? "var(--brown)" : "var(--red)",
                }}>
                  {dateLabel.toUpperCase()}
                </span>
                <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.68rem", letterSpacing: "1px", color: "var(--muted)" }}>
                  {groupBoxes.length} {groupBoxes.length === 1 ? "box" : "boxes"}
                </span>
                <span style={{ fontSize: "0.7rem", color: "var(--muted)", marginLeft: "auto" }}>
                  {isOpen ? "▲" : "▼"}
                </span>
              </button>

              {/* Boxes in this session — collapsible */}
              {isOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {groupBoxes.map(box => {
                    const pct = maxCount > 0 ? (box.comicCount / maxCount) * 100 : 0;
                    const shortLabel = box.Label.replace(/^Box \d+ — /,"").replace(/^BOX \d+ — /i,"");
                    return (
                      <div key={box.Num} style={{
                        background: "var(--surface)", border: "1.5px solid var(--border)",
                        borderRadius: 6, padding: "12px 16px",
                        borderLeft: `4px solid ${isOriginal ? "#4a3018" : "var(--red)"}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1rem",
                            color: isOriginal ? "var(--brown)" : "var(--red)", letterSpacing: "1px", minWidth: 56 }}>
                            {box.Num}
                          </span>
                          <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--brown-light)", flex: 1 }}>
                            {shortLabel}
                          </span>
                          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.85rem",
                              color: "var(--text)", letterSpacing: "0.5px" }}>
                              {box.comicCount} <span style={{ color: "var(--muted)", fontSize: "0.65rem", letterSpacing: "1px" }}>COMICS</span>
                            </span>
                            {box.keys > 0 && (
                              <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.75rem",
                                background: "#fff8e0", color: "#8a6000", border: "1px solid #d4a800",
                                borderRadius: 3, padding: "1px 7px", letterSpacing: "1px" }}>
                                {box.keys} KEY{box.keys !== 1 ? "S" : ""}
                              </span>
                            )}
                            {box.signed > 0 && (
                              <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.75rem",
                                background: "var(--green-bg)", color: "var(--green-text)", border: "1px solid #c8e6c8",
                                borderRadius: 3, padding: "1px 7px", letterSpacing: "1px" }}>
                                {box.signed} SIGNED
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bar */}
                        <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%",
                            background: isOriginal ? "#4a3018" : "var(--red)",
                            borderRadius: 3, transition: "width 0.4s ease" }} />
                        </div>

                        {/* Meta row */}
                        <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: "0.75rem", color: "var(--muted)", flexWrap: "wrap" }}>
                          {box.YearRange && <span>{box.YearRange}</span>}
                          {box.Notes && <span style={{ color: "var(--muted2)", fontStyle: "italic" }}>{box.Notes.slice(0,80)}{box.Notes.length>80?"…":""}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Target marker */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <div style={{ position: "absolute", left: -22, top: 3,
            width: 14, height: 14, borderRadius: "50%",
            background: "var(--border)", border: "2px dashed var(--muted)" }} />
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.85rem", letterSpacing: "2px",
            color: "var(--muted)", marginBottom: 8 }}>
            TARGET: {TARGET_BOXES} BOXES
          </div>
          <div style={{ background: "var(--surface2)", border: "1.5px dashed var(--border)", borderRadius: 6,
            padding: "10px 16px", color: "var(--muted)", fontSize: "0.82rem", fontStyle: "italic" }}>
            {TARGET_BOXES - entries.length} more boxes to catalogue. You're {boxPct}% of the way there.
          </div>
        </div>
      </div>
    </div>
  );
}
