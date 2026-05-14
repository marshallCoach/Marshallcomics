import { useState, useMemo } from "react";
import { DATA1 } from "@/data/data1";

const events = DATA1.calendar;
const EVENT_TYPES = [...new Set(events.map((e) => e.Event_Type).filter(Boolean))];

export default function Calendar() {
  const [filter, setFilter] = useState("");

  const results = useMemo(() => {
    if (!filter) return events;
    return events.filter((e) => e.Event_Type === filter);
  }, [filter]);

  const inputStyle: React.CSSProperties = {
    background: "#1a1a1a", border: "1px solid #333", color: "#d4a574",
    padding: "7px 12px", borderRadius: 4, fontSize: "0.82rem",
    fontFamily: "Georgia, serif",
  };

  const getCardStyle = (eventType: string) => {
    if (eventType?.includes("WHATNOT"))
      return { border: "1px solid #2a5a2a", background: "#0d1a0d" };
    if (eventType?.includes("CGC"))
      return { border: "1px solid #5a4a00", background: "#1a1500" };
    if (eventType?.includes("DEADLINE") || eventType?.includes("SIGNING"))
      return { border: "1px solid #5a1a1a", background: "#1a0a0a" };
    return { border: "1px solid #222", background: "#141414" };
  };

  const getDateBadge = (eventType: string) => {
    if (eventType?.includes("WHATNOT")) return { bg: "#1a3a1a", color: "#90ee90" };
    if (eventType?.includes("CGC")) return { bg: "#2a2200", color: "#ffd700" };
    return { bg: "#3a1a1a", color: "#ff8888" };
  };

  return (
    <div>
      <div style={{ background: "#161616", padding: "14px 20px", display: "flex", flexWrap: "wrap", gap: 10, borderBottom: "1px solid #222", position: "sticky", top: 0, zIndex: 10 }}>
        <select style={inputStyle} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All Events</option>
          {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {filter && (
          <button onClick={() => setFilter("")} style={{ background: "#8b1a1a", color: "#fff", border: "none", padding: "7px 16px", borderRadius: 4, cursor: "pointer", fontSize: "0.82rem", fontFamily: "Georgia, serif" }}>
            Clear
          </button>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ fontSize: "0.75rem", color: "#555" }}>{results.length} events</span>
          <span style={{ fontSize: "0.75rem" }}><span style={{ color: "#90ee90" }}>■</span> <span style={{ color: "#666" }}>Whatnot Show</span></span>
          <span style={{ fontSize: "0.75rem" }}><span style={{ color: "#ffd700" }}>■</span> <span style={{ color: "#666" }}>CGC Deadline</span></span>
          <span style={{ fontSize: "0.75rem" }}><span style={{ color: "#ff8888" }}>■</span> <span style={{ color: "#666" }}>Other</span></span>
        </div>
      </div>

      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 900, margin: "0 auto" }}>
        {results.map((ev, i) => {
          const cs = getCardStyle(ev.Event_Type || "");
          const db = getDateBadge(ev.Event_Type || "");
          return (
            <div key={i} style={{ ...cs, borderRadius: 8, padding: 20 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ background: db.bg, color: db.color, padding: "6px 14px", borderRadius: 6, fontSize: "0.82rem", fontWeight: "bold", whiteSpace: "nowrap", minWidth: 160, textAlign: "center" }}>
                  <div>{ev.Date}</div>
                  <div style={{ fontSize: "0.65rem", opacity: 0.8 }}>{ev.Day}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#e8c99a", fontWeight: "bold", fontSize: "0.95rem", marginBottom: 4 }}>
                    {ev.Event_Type}
                  </div>
                  <div style={{ color: "#c8102e", fontSize: "0.85rem", fontStyle: "italic" }}>
                    {ev.Theme}
                  </div>
                </div>
              </div>

              {ev.Featured_Books && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ color: "#666", fontSize: "0.65rem", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Featured Books</div>
                  <div style={{ color: "#d4a574", fontSize: "0.8rem", lineHeight: 1.7, whiteSpace: "pre-line" }}>
                    {ev.Featured_Books}
                  </div>
                </div>
              )}

              {ev.Prep && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ color: "#666", fontSize: "0.65rem", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Prep Checklist</div>
                  <div style={{ color: "#888", fontSize: "0.78rem", lineHeight: 1.7, whiteSpace: "pre-line" }}>
                    {ev.Prep}
                  </div>
                </div>
              )}

              {ev.Revenue_Notes && (
                <div style={{ background: "rgba(200,16,46,0.08)", border: "1px solid rgba(200,16,46,0.2)", borderRadius: 4, padding: "8px 12px", fontSize: "0.78rem", color: "#d4a574" }}>
                  {ev.Revenue_Notes}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
