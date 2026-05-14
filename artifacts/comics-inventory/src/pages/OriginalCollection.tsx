import { useState, useMemo } from "react";
import { DATA1 } from "@/data/data1";

const comics = DATA1.orig_inventory;

const PUBLISHERS = [...new Set(comics.map((c) => c.Publisher).filter(Boolean))].sort();
const ERAS = [...new Set(comics.map((c) => c.Era).filter(Boolean))].sort();
const PLATFORMS = [...new Set(comics.map((c) => c.Platform).filter(Boolean))].sort();

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: "0.65rem", padding: "2px 8px", borderRadius: 12, background: bg, color, letterSpacing: 0.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

export default function OriginalCollection() {
  const [q, setQ] = useState("");
  const [pub, setPub] = useState("");
  const [era, setEra] = useState("");
  const [platform, setPlatform] = useState("");
  const [signed, setSigned] = useState("");
  const [keyOnly, setKeyOnly] = useState("");

  const results = useMemo(() => {
    const ql = q.toLowerCase();
    return comics.filter((c) => {
      if (ql && !`${c.Title} ${c.Writer} ${c.Artist} ${c.Key_Why} ${c.First_App} ${c.Signed_By} ${c.Arc} ${c.Whatnot_Category}`.toLowerCase().includes(ql)) return false;
      if (pub && c.Publisher !== pub) return false;
      if (era && c.Era !== era) return false;
      if (platform && c.Platform !== platform) return false;
      if (signed && (c.Signed || "").toUpperCase() !== signed) return false;
      if (keyOnly && (c.Key || "").toUpperCase() !== keyOnly) return false;
      return true;
    });
  }, [q, pub, era, platform, signed, keyOnly]);

  const clear = () => { setQ(""); setPub(""); setEra(""); setPlatform(""); setSigned(""); setKeyOnly(""); };

  const inputStyle: React.CSSProperties = {
    background: "#1a1a1a", border: "1px solid #333", color: "#d4a574",
    padding: "7px 12px", borderRadius: 4, fontSize: "0.82rem", minWidth: 140,
    fontFamily: "Georgia, serif",
  };

  return (
    <div>
      {/* Filters */}
      <div style={{ background: "#161616", padding: "14px 20px", display: "flex", flexWrap: "wrap", gap: 10, borderBottom: "1px solid #222", position: "sticky", top: 0, zIndex: 10 }}>
        <input style={{ ...inputStyle, minWidth: 240, flex: 1 }} placeholder="Search title, writer, character, category..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select style={inputStyle} value={pub} onChange={(e) => setPub(e.target.value)}>
          <option value="">All Publishers</option>
          {PUBLISHERS.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select style={inputStyle} value={era} onChange={(e) => setEra(e.target.value)}>
          <option value="">All Eras</option>
          {ERAS.map((e2) => <option key={e2}>{e2}</option>)}
        </select>
        <select style={inputStyle} value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="">All Platforms</option>
          {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select style={inputStyle} value={signed} onChange={(e) => setSigned(e.target.value)}>
          <option value="">Signed / Unsigned</option>
          <option value="YES">Signed</option>
          <option value="NO">Unsigned</option>
        </select>
        <select style={inputStyle} value={keyOnly} onChange={(e) => setKeyOnly(e.target.value)}>
          <option value="">All / Keys Only</option>
          <option value="YES">Keys Only</option>
        </select>
        <button onClick={clear} style={{ background: "#8b1a1a", color: "#fff", border: "none", padding: "7px 16px", borderRadius: 4, cursor: "pointer", fontSize: "0.82rem", letterSpacing: 1, fontFamily: "Georgia, serif" }}>
          Clear
        </button>
      </div>

      <div style={{ padding: "8px 20px", color: "#555", fontSize: "0.75rem", letterSpacing: 1, textTransform: "uppercase" }}>
        {results.length} of {comics.length} books
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14, padding: "0 20px 20px" }}>
        {results.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", color: "#444", padding: 60, fontSize: "1rem" }}>
            No books match your filters.
          </div>
        )}
        {results.map((c, i) => {
          const isKey = (c.Key || "").toUpperCase() === "YES";
          const isSigned = (c.Signed || "").toUpperCase() === "YES";
          const isCGC = (c.CGC_Worth || "").toUpperCase() === "YES";
          const isTerrificon = !!c.Terrificon;
          return (
            <div key={i} style={{ background: "#141414", border: "1px solid #222", borderRadius: 6, padding: 16, transition: "border-color 0.15s", cursor: "default" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#8b1a1a")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#222")}>
              <div style={{ color: "#e8c99a", fontWeight: "bold", fontSize: "0.95rem", marginBottom: 2 }}>{c.Title}</div>
              <div style={{ color: "#666", fontSize: "0.75rem", marginBottom: 10 }}>
                {c.Publisher} {c.Issue} · {c.Year} · {c.Era}
                {c.Writer ? ` · ${c.Writer}` : ""}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                {isKey && <Badge label="KEY" bg="#8b1a1a" color="#fff" />}
                {isSigned && <Badge label={`Signed: ${c.Signed_By || "YES"}`} bg="#1a3e1a" color="#90ee90" />}
                {c.Era && <Badge label={c.Era} bg="#1a1a3e" color="#99aaff" />}
                {isCGC && <Badge label="CGC Candidate" bg="#1a2a3a" color="#66ccff" />}
                {isTerrificon && <Badge label="Terrificon" bg="#2a1f4a" color="#c8a0ff" />}
                {c.Platform && <Badge label={c.Platform} bg={c.Platform.includes("WHATNOT") ? "#1a3a1a" : c.Platform === "EBAY" ? "#3a2a00" : "#2a1a3a"} color={c.Platform.includes("WHATNOT") ? "#90ee90" : c.Platform === "EBAY" ? "#ffd700" : "#cc99ff"} />}
              </div>
              {isKey && c.Key_Why && (
                <div style={{ color: "#c8102e", fontSize: "0.75rem", marginBottom: 6, fontStyle: "italic" }}>
                  {c.Key_Why}
                </div>
              )}
              {c.Value_NM && (
                <div style={{ fontSize: "0.78rem", color: "#d4a574", marginBottom: 4 }}>
                  NM: <span style={{ color: "#c8102e", fontWeight: "bold" }}>{c.Value_NM}</span>
                  {c.Value_VF ? <span style={{ color: "#888", marginLeft: 8 }}>VF: {c.Value_VF}</span> : ""}
                </div>
              )}
              {c.Whatnot_Pitch && (
                <div style={{ color: "#888", fontSize: "0.75rem", lineHeight: 1.4, marginTop: 6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
                  {c.Whatnot_Pitch}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
