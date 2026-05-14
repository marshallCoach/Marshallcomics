import { useState, useMemo } from "react";
import { DATA2 } from "@/data/data2";

const keys = DATA2.boxes_keys;
const BOXES = [...new Set(keys.map((k) => String(k.Box)))].sort((a, b) => Number(a) - Number(b));
const PLATFORMS = [...new Set(keys.map((k) => k.Platform).filter(Boolean))].sort();
const FLAGS = [...new Set(keys.map((k) => k.Action_Flag).filter(Boolean))].sort();

export default function BoxKeys() {
  const [q, setQ] = useState("");
  const [box, setBox] = useState("");
  const [platform, setPlatform] = useState("");
  const [flag, setFlag] = useState("");
  const [terrificon, setTerrificon] = useState("");

  const results = useMemo(() => {
    const ql = q.toLowerCase();
    return keys.filter((k) => {
      if (ql && !`${k.Title} ${k.Issue} ${k.Publisher} ${k.Key_Why}`.toLowerCase().includes(ql)) return false;
      if (box && String(k.Box) !== box) return false;
      if (platform && k.Platform !== platform) return false;
      if (flag && k.Action_Flag !== flag) return false;
      if (terrificon === "YES" && !k.Terrificon) return false;
      return true;
    });
  }, [q, box, platform, flag, terrificon]);

  const clear = () => { setQ(""); setBox(""); setPlatform(""); setFlag(""); setTerrificon(""); };

  const inputStyle: React.CSSProperties = {
    background: "#1a1a1a", border: "1px solid #333", color: "#d4a574",
    padding: "7px 12px", borderRadius: 4, fontSize: "0.82rem", minWidth: 140,
    fontFamily: "Georgia, serif",
  };

  const flagColor = (f: string) => {
    if (f?.includes("CGC IMMEDIATELY")) return { bg: "#3a0000", color: "#ff6666", border: "1px solid #8b1a1a" };
    if (f?.includes("Whatnot ready")) return { bg: "#0a2a0a", color: "#90ee90", border: "1px solid #2a5a2a" };
    if (f?.includes("Hold")) return { bg: "#2a2a00", color: "#ffd700", border: "1px solid #5a5a00" };
    return { bg: "#1a1a3e", color: "#99aaff", border: "1px solid #2a2a5e" };
  };

  return (
    <div>
      <div style={{ background: "#161616", padding: "14px 20px", display: "flex", flexWrap: "wrap", gap: 10, borderBottom: "1px solid #222", position: "sticky", top: 0, zIndex: 10 }}>
        <input style={{ ...inputStyle, minWidth: 200, flex: 1 }} placeholder="Search title, issue, key reason..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select style={inputStyle} value={box} onChange={(e) => setBox(e.target.value)}>
          <option value="">All Boxes</option>
          {BOXES.map((b) => <option key={b} value={b}>Box {b}</option>)}
        </select>
        <select style={inputStyle} value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="">All Platforms</option>
          {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select style={inputStyle} value={flag} onChange={(e) => setFlag(e.target.value)}>
          <option value="">All Actions</option>
          {FLAGS.map((f) => <option key={f}>{f}</option>)}
        </select>
        <select style={inputStyle} value={terrificon} onChange={(e) => setTerrificon(e.target.value)}>
          <option value="">All / Terrificon</option>
          <option value="YES">Terrificon Only</option>
        </select>
        <button onClick={clear} style={{ background: "#8b1a1a", color: "#fff", border: "none", padding: "7px 16px", borderRadius: 4, cursor: "pointer", fontSize: "0.82rem", letterSpacing: 1, fontFamily: "Georgia, serif" }}>
          Clear
        </button>
      </div>

      <div style={{ padding: "8px 20px", color: "#555", fontSize: "0.75rem", letterSpacing: 1, textTransform: "uppercase" }}>
        {results.length} of {keys.length} key issues
      </div>

      {/* Table view for keys */}
      <div style={{ padding: "0 20px 20px", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #8b1a1a" }}>
              {["Box", "Title", "Issue", "Publisher", "Key Significance", "NM Value", "Start Bid", "Platform", "Action", "Terrificon"].map((h) => (
                <th key={h} style={{ color: "#888", textTransform: "uppercase", fontSize: "0.65rem", letterSpacing: 1, padding: "8px 12px", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: "center", color: "#444", padding: 40 }}>No keys match your filters.</td></tr>
            )}
            {results.map((k, i) => {
              const fc = flagColor(k.Action_Flag || "");
              return (
                <tr key={i} style={{ borderBottom: "1px solid #1e1e1e" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1010")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <td style={{ padding: "10px 12px", color: "#8899dd" }}>Box {k.Box}</td>
                  <td style={{ padding: "10px 12px", color: "#e8c99a", fontWeight: "bold" }}>{k.Title}</td>
                  <td style={{ padding: "10px 12px", color: "#888" }}>#{k.Issue}</td>
                  <td style={{ padding: "10px 12px", color: "#888" }}>{k.Publisher}</td>
                  <td style={{ padding: "10px 12px", color: "#c8102e", fontStyle: "italic", maxWidth: 280 }}>{k.Key_Why}</td>
                  <td style={{ padding: "10px 12px", color: "#c8102e", fontWeight: "bold", whiteSpace: "nowrap" }}>${k.Value_NM}</td>
                  <td style={{ padding: "10px 12px", color: "#d4a574", whiteSpace: "nowrap" }}>${k.Start_Bid}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {k.Platform && (
                      <span style={{ fontSize: "0.65rem", padding: "2px 8px", borderRadius: 12,
                        background: k.Platform.includes("WHATNOT") ? "#1a3a1a" : k.Platform === "EBAY" ? "#3a2a00" : "#2a1a3a",
                        color: k.Platform.includes("WHATNOT") ? "#90ee90" : k.Platform === "EBAY" ? "#ffd700" : "#cc99ff"
                      }}>{k.Platform}</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {k.Action_Flag && (
                      <span style={{ fontSize: "0.65rem", padding: "3px 10px", borderRadius: 12, ...fc, whiteSpace: "nowrap" }}>
                        {k.Action_Flag}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    {k.Terrificon && <span style={{ color: "#c8a0ff" }}>★</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
