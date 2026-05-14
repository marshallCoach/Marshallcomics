import { DATA1 } from "@/data/data1";

const strategy = DATA1.cgc_strategy;

const PRIORITY_COLORS: Record<string, string> = {
  "1": "#ff4444",
  "2": "#ff6644",
  "3": "#ff8844",
  "4": "#ffaa44",
  "5": "#ffcc44",
  "6": "#ddcc44",
  "7": "#bbcc44",
  "8": "#99bb44",
  "9": "#77aa44",
  "10": "#55aa44",
};

export default function CGCStrategy() {
  const totalCost = strategy.reduce((sum, s) => {
    const match = s.Cost?.replace(/[^0-9]/g, "");
    return sum + (match ? parseInt(match) : 0);
  }, 0);

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      {/* Summary bar */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ background: "#141414", border: "1px solid #222", borderRadius: 8, padding: "12px 20px", flex: 1, minWidth: 160 }}>
          <div style={{ color: "#666", fontSize: "0.65rem", letterSpacing: 1, textTransform: "uppercase" }}>Priority Submissions</div>
          <div style={{ color: "#e8c99a", fontSize: "1.6rem", fontWeight: "bold" }}>{strategy.length}</div>
        </div>
        <div style={{ background: "#141414", border: "1px solid #222", borderRadius: 8, padding: "12px 20px", flex: 1, minWidth: 160 }}>
          <div style={{ color: "#666", fontSize: "0.65rem", letterSpacing: 1, textTransform: "uppercase" }}>Total CGC Budget</div>
          <div style={{ color: "#c8102e", fontSize: "1.6rem", fontWeight: "bold" }}>${totalCost}</div>
        </div>
        <div style={{ background: "#0d1a0d", border: "1px solid #2a5a2a", borderRadius: 8, padding: "12px 20px", flex: 2, minWidth: 240 }}>
          <div style={{ color: "#90ee90", fontSize: "0.82rem", lineHeight: 1.6 }}>
            Top Terrificon priority: witness Jim Lee, Tom King, Chris Claremont, Mark Bagley CGC SS on-site.
            Send Batch 1 to CGC Sarasota before May 6 deadline.
          </div>
        </div>
      </div>

      {/* Strategy cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {strategy.map((s, i) => {
          const priorityNum = s.Priority?.match(/\d+/)?.[0] || String(i + 1);
          const pColor = PRIORITY_COLORS[priorityNum] || "#888";
          const isTerrificon = s.Notes?.toLowerCase().includes("terrificon");

          return (
            <div key={i} style={{ background: "#141414", border: "1px solid #222", borderRadius: 8, padding: 20, transition: "border-color 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#8b1a1a")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#222")}>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
                {/* Priority badge */}
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: pColor + "22", border: `2px solid ${pColor}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: pColor, fontWeight: "bold", fontSize: "1rem" }}>#{priorityNum}</span>
                </div>

                {/* Main content */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                    <div style={{ color: "#e8c99a", fontWeight: "bold", fontSize: "0.95rem" }}>{s.Book}</div>
                    {isTerrificon && (
                      <span style={{ fontSize: "0.65rem", padding: "2px 10px", borderRadius: 12, background: "#2a1f4a", color: "#c8a0ff" }}>Terrificon</span>
                    )}
                  </div>
                  <div style={{ color: "#888", fontSize: "0.8rem", marginBottom: 8 }}>Service: {s.Service}</div>
                  {s.Notes && (
                    <div style={{ color: "#d4a574", fontSize: "0.8rem", lineHeight: 1.5 }}>{s.Notes}</div>
                  )}
                </div>

                {/* Financial grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, minWidth: 260 }}>
                  <div style={{ background: "#0a0a0a", borderRadius: 6, padding: "8px 12px" }}>
                    <div style={{ color: "#555", fontSize: "0.6rem", letterSpacing: 1, textTransform: "uppercase" }}>Cost</div>
                    <div style={{ color: "#ffd700", fontSize: "0.9rem", fontWeight: "bold" }}>{s.Cost}</div>
                  </div>
                  <div style={{ background: "#0a0a0a", borderRadius: 6, padding: "8px 12px" }}>
                    <div style={{ color: "#555", fontSize: "0.6rem", letterSpacing: 1, textTransform: "uppercase" }}>Expected Grade</div>
                    <div style={{ color: "#d4a574", fontSize: "0.9rem", fontWeight: "bold" }}>{s.Expected_Grade}</div>
                  </div>
                  <div style={{ background: "#0a0a0a", borderRadius: 6, padding: "8px 12px" }}>
                    <div style={{ color: "#555", fontSize: "0.6rem", letterSpacing: 1, textTransform: "uppercase" }}>Raw Value</div>
                    <div style={{ color: "#888", fontSize: "0.9rem" }}>{s.Raw_Value}</div>
                  </div>
                  <div style={{ background: "#0d1a0d", borderRadius: 6, padding: "8px 12px" }}>
                    <div style={{ color: "#555", fontSize: "0.6rem", letterSpacing: 1, textTransform: "uppercase" }}>CGC Value</div>
                    <div style={{ color: "#90ee90", fontSize: "0.9rem", fontWeight: "bold" }}>{s.CGC_Value}</div>
                  </div>
                  <div style={{ background: "#1a1500", borderRadius: 6, padding: "8px 12px", gridColumn: "span 2" }}>
                    <div style={{ color: "#555", fontSize: "0.6rem", letterSpacing: 1, textTransform: "uppercase" }}>ROI</div>
                    <div style={{ color: "#ffd700", fontSize: "1rem", fontWeight: "bold" }}>{s.ROI}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
