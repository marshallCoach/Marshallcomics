import { useState } from "react";
import { DATA2 } from "@/data/data2";

const shows = DATA2.show_planner;
const runsheet = DATA2.show2;

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  "✅ Ready": { bg: "#0a2a0a", color: "#90ee90" },
  "🔴 CGC First": { bg: "#2a0000", color: "#ff8888" },
  "🟡 Needs Prep": { bg: "#2a2000", color: "#ffd700" },
};

export default function ShowPlanner() {
  const [view, setView] = useState<"concepts" | "runsheet">("concepts");

  const tabBtn = (id: typeof view, label: string) => (
    <button onClick={() => setView(id)} style={{
      padding: "8px 20px", background: view === id ? "#8b1a1a" : "transparent",
      color: view === id ? "#fff" : "#888", border: "none",
      borderBottom: view === id ? "2px solid #c8102e" : "2px solid transparent",
      cursor: "pointer", fontSize: "0.8rem", letterSpacing: 1, textTransform: "uppercase",
      fontFamily: "Georgia, serif",
    }}>
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ background: "#161616", borderBottom: "1px solid #222", padding: "0 20px", display: "flex", gap: 0 }}>
        {tabBtn("concepts", `19 Show Concepts`)}
        {tabBtn("runsheet", `$1 Keys Night Runsheet (${runsheet.length} books)`)}
      </div>

      {view === "concepts" && (
        <div style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
            {shows.map((s, i) => {
              const sc = STATUS_COLORS[s.Status] || { bg: "#1a1a3e", color: "#99aaff" };
              return (
                <div key={i} style={{ background: "#141414", border: "1px solid #222", borderRadius: 8, padding: 18, transition: "border-color 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#8b1a1a")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#222")}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ color: "#e8c99a", fontWeight: "bold", fontSize: "0.95rem", flex: 1 }}>{s.Theme}</div>
                    <span style={{ fontSize: "0.65rem", padding: "3px 10px", borderRadius: 12, ...sc, whiteSpace: "nowrap", marginLeft: 8 }}>{s.Status}</span>
                  </div>
                  <div style={{ color: "#c8102e", fontSize: "0.78rem", fontStyle: "italic", marginBottom: 10 }}>
                    Anchor: {s.Anchor_Book}
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: "0.78rem", marginBottom: 10 }}>
                    <span style={{ color: "#666" }}>Box: <span style={{ color: "#8899dd" }}>{s.Box}</span></span>
                    <span style={{ color: "#666" }}>Start: <span style={{ color: "#d4a574" }}>{s.Start_Bid}</span></span>
                    <span style={{ color: "#666" }}>Est: <span style={{ color: "#90ee90" }}>{s.Est_Revenue}</span></span>
                  </div>
                  {s.Notes && (
                    <div style={{ color: "#888", fontSize: "0.75rem", lineHeight: 1.5 }}>{s.Notes}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "runsheet" && (
        <div style={{ padding: 20 }}>
          <div style={{ background: "#1a1500", border: "1px solid #5a4a00", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: "0.82rem", color: "#ffd700" }}>
            $1 Keys Night — {runsheet.length}-book runsheet. Every book starts at $1. Designed to build momentum and auction energy through the show.
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #8b1a1a" }}>
                  {["#", "Book", "Issue", "Publisher", "Box", "NM Value", "Start", "Audience Hook", "Pitch"].map((h) => (
                    <th key={h} style={{ color: "#888", textTransform: "uppercase", fontSize: "0.65rem", letterSpacing: 1, padding: "8px 12px", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runsheet.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #1e1e1e" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1010")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "10px 12px", color: "#555", fontWeight: "bold" }}>{r.Order}</td>
                    <td style={{ padding: "10px 12px", color: "#e8c99a", fontWeight: "bold" }}>{r.Book}</td>
                    <td style={{ padding: "10px 12px", color: "#888" }}>{r.Issue}</td>
                    <td style={{ padding: "10px 12px", color: "#888" }}>{r.Publisher}</td>
                    <td style={{ padding: "10px 12px", color: "#8899dd" }}>{r.Box}</td>
                    <td style={{ padding: "10px 12px", color: "#c8102e", fontWeight: "bold" }}>${r.Value_NM}</td>
                    <td style={{ padding: "10px 12px", color: "#ffd700", fontWeight: "bold" }}>{r.Start}</td>
                    <td style={{ padding: "10px 12px", color: "#90ee90", fontSize: "0.75rem" }}>{r.Audience_Hook}</td>
                    <td style={{ padding: "10px 12px", color: "#888", fontSize: "0.75rem", maxWidth: 280 }}>{r.Whatnot_Pitch}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
