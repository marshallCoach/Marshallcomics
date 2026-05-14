import { useState } from "react";
import { DATA1 } from "@/data/data1";

const signings = DATA1.private_signings;
const terrificon = DATA1.terrificon;
const nycc = DATA1.nycc;

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  open: { background: "#0a2a0a", color: "#90ee90", border: "1px solid #2a5a2a" },
  closed: { background: "#2a0a0a", color: "#ff7777", border: "1px solid #5a1a1a" },
  pending: { background: "#2a2000", color: "#ffd700", border: "1px solid #5a4a00" },
};

function getStatusStyle(status: string): React.CSSProperties {
  const s = status?.toLowerCase() || "";
  if (s.includes("open")) return STATUS_STYLE.open;
  if (s.includes("closed") || s.includes("missed")) return STATUS_STYLE.closed;
  return STATUS_STYLE.pending;
}

export default function PrivateSignings() {
  const [view, setView] = useState<"signings" | "terrificon" | "nycc">("signings");

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
        {tabBtn("signings", "Private Signings")}
        {tabBtn("terrificon", `Terrificon Prep (${terrificon.length})`)}
        {tabBtn("nycc", `NYCC Prep (${nycc.length})`)}
      </div>

      {view === "signings" && (
        <div style={{ padding: 20, maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {signings.map((s, i) => {
            const ss = getStatusStyle(s.status);
            const isOpen = s.status?.toLowerCase().includes("open");
            return (
              <div key={i} style={{ background: isOpen ? "#0d1a0d" : "#141414", border: isOpen ? "1px solid #2a5a2a" : "1px solid #222", borderRadius: 8, padding: 20 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#e8c99a", fontWeight: "bold", fontSize: "1rem", marginBottom: 4 }}>{s.creator}</div>
                    <div style={{ color: "#888", fontSize: "0.78rem" }}>Deadline: {s.deadline}</div>
                  </div>
                  <div>
                    <span style={{ ...ss, fontSize: "0.72rem", padding: "4px 14px", borderRadius: 20, fontWeight: "bold", letterSpacing: 0.5 }}>
                      {s.status}
                    </span>
                  </div>
                </div>

                {s.fee && (
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ color: "#555", fontSize: "0.65rem", letterSpacing: 1, textTransform: "uppercase" }}>Fee: </span>
                    <span style={{ color: "#ffd700", fontSize: "0.82rem" }}>{s.fee}</span>
                  </div>
                )}

                {s.your_books && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ color: "#555", fontSize: "0.65rem", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Your Books</div>
                    <div style={{ color: "#d4a574", fontSize: "0.82rem", lineHeight: 1.6 }}>{s.your_books}</div>
                  </div>
                )}

                {s.action && (
                  <div style={{ background: isOpen ? "rgba(144,238,144,0.08)" : "rgba(200,16,46,0.06)", border: isOpen ? "1px solid rgba(144,238,144,0.2)" : "1px solid rgba(200,16,46,0.15)", borderRadius: 6, padding: "10px 14px", marginBottom: 10 }}>
                    <div style={{ color: "#555", fontSize: "0.65rem", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Action</div>
                    <div style={{ color: isOpen ? "#90ee90" : "#d4a574", fontSize: "0.82rem", lineHeight: 1.5 }}>{s.action}</div>
                  </div>
                )}

                {s.strategy && (
                  <div style={{ color: "#888", fontSize: "0.78rem", lineHeight: 1.5, borderTop: "1px solid #1e1e1e", paddingTop: 10 }}>
                    {s.strategy}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(view === "terrificon" || view === "nycc") && (
        <div style={{ padding: 20 }}>
          {view === "terrificon" && (
            <div style={{ background: "#1a1500", border: "1px solid #5a4a00", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: "0.82rem", color: "#ffd700" }}>
              Terrificon 2026 — August 8 (Sat) & 9 (Sun), Connecticut Convention Center. Jim Lee: SAT ONLY.
            </div>
          )}
          {view === "nycc" && (
            <div style={{ background: "#1a1a3e", border: "1px solid #3a3a6a", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: "0.82rem", color: "#99aaff" }}>
              NYCC 2026 — October, Javits Center, New York City.
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #8b1a1a" }}>
                  {["Priority", "Book", "Goal", "Creator", "Notes"].map((h) => (
                    <th key={h} style={{ color: "#888", textTransform: "uppercase", fontSize: "0.65rem", letterSpacing: 1, padding: "8px 12px", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(view === "terrificon" ? terrificon : nycc).map((item, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #1e1e1e" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1010")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "10px 12px", color: "#ffd700", fontWeight: "bold", whiteSpace: "nowrap" }}>{item.priority}</td>
                    <td style={{ padding: "10px 12px", color: "#e8c99a", fontWeight: "bold" }}>{item.book}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: "0.72rem", padding: "3px 10px", borderRadius: 12, background: "#1a2a3a", color: "#66ccff" }}>{item.goal}</span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#c8102e", fontStyle: "italic" }}>{item.creator}</td>
                    <td style={{ padding: "10px 12px", color: "#888", fontSize: "0.78rem" }}>{item.notes}</td>
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
