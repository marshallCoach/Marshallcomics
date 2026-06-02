import { useMemo, useState, useRef } from "react";
import { DATA, DATA_LS_KEY } from "@/data/data";

const comics = DATA.comics;
const total  = comics.length;

interface FieldStat {
  field: string;
  label: string;
  count: number;
  pct: number;
  sample: string;
}

const FIELDS: { key: keyof typeof comics[0]; label: string }[] = [
  { key: "Title",        label: "Title" },
  { key: "Issue",        label: "Issue #" },
  { key: "Publisher",    label: "Publisher" },
  { key: "Year",         label: "Year" },
  { key: "Box",          label: "Box #" },
  { key: "Key",          label: "Key Issue?" },
  { key: "Key_Reason",   label: "Key Reason" },
  { key: "First_App",    label: "1st Appearances" },
  { key: "Writer",       label: "Writer(s)" },
  { key: "Artist",       label: "Artist(s)" },
  { key: "Cover_Artist", label: "Cover Artist" },
  { key: "Signed",       label: "Signed?" },
  { key: "Signed_By",    label: "Signed By" },
  { key: "Personal",     label: "Personalization" },
  { key: "Condition",    label: "Condition" },
  { key: "CGC_Worth",    label: "CGC Worth It?" },
  { key: "Value_NM",     label: "Value (NM)" },
  { key: "Value_VF",     label: "Value (VF)" },
  { key: "Start_Bid",    label: "Starting Bid" },
  { key: "Category",     label: "Whatnot Category" },
  { key: "Era",          label: "Era" },
  { key: "Universe",     label: "Universe" },
  { key: "Imprint",      label: "Imprint" },
  { key: "Arc",          label: "Arc / Story" },
  { key: "Seller_Notes", label: "Seller Notes" },
  { key: "Story_Pitch",  label: "Whatnot Story Pitch" },
  { key: "Content",      label: "Content Notes" },
  { key: "Platform",     label: "Platform Rec." },
  { key: "Sales_Data",   label: "Sales Data" },
  { key: "Terrificon",   label: "Terrificon Creator" },
  { key: "Date_Added",   label: "Date Added" },
];

function barColor(pct: number): string {
  if (pct >= 90) return "#22c55e";
  if (pct >= 70) return "#84cc16";
  if (pct >= 50) return "#f59e0b";
  if (pct >= 25) return "#f97316";
  return "#c8102e";
}

type SortMode = "pct" | "alpha" | "pct-asc" | "alpha-desc";

export default function DataView() {
  const [sortMode,     setSortMode]     = useState<SortMode>("pct");
  const [search,       setSearch]       = useState("");
  const [importMsg,    setImportMsg]    = useState<{ ok: boolean; text: string } | null>(null);
  const [hasOverride,  setHasOverride]  = useState(() => !!localStorage.getItem(DATA_LS_KEY));
  const fileRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `brb-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text   = ev.target?.result as string;
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed?.comics) || !Array.isArray(parsed?.boxes)) {
          setImportMsg({ ok: false, text: "Invalid file — expected { comics: [...], boxes: [...] }" });
          return;
        }
        localStorage.setItem(DATA_LS_KEY, text);
        setImportMsg({ ok: true, text: `Imported ${parsed.comics.length.toLocaleString()} comics, ${parsed.boxes.length} boxes — reload to apply` });
        setHasOverride(true);
      } catch (err) {
        setImportMsg({ ok: false, text: `Parse error: ${String(err)}` });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleClearOverride() {
    localStorage.removeItem(DATA_LS_KEY);
    setHasOverride(false);
    setImportMsg({ ok: true, text: "Override cleared — reload to use original data" });
  }

  const stats: FieldStat[] = useMemo(() => {
    return FIELDS.map(({ key, label }) => {
      let count = 0;
      let sampleVal = "";
      for (const c of comics) {
        const v = String(c[key] || "").trim();
        if (v && v.toLowerCase() !== "no" && v !== "0") {
          count++;
          if (!sampleVal) sampleVal = v;
        }
      }
      return {
        field: String(key),
        label,
        count,
        pct: Math.round((count / total) * 100),
        sample: sampleVal.slice(0, 60),
      };
    });
  }, []);

  const displayed = useMemo(() => {
    let list = stats;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => s.label.toLowerCase().includes(q) || s.field.toLowerCase().includes(q));
    }
    if (sortMode === "pct")      return [...list].sort((a, b) => b.pct - a.pct || a.label.localeCompare(b.label));
    if (sortMode === "pct-asc")  return [...list].sort((a, b) => a.pct - b.pct || a.label.localeCompare(b.label));
    if (sortMode === "alpha-desc") return [...list].sort((a, b) => b.label.localeCompare(a.label));
    return [...list].sort((a, b) => a.label.localeCompare(b.label));
  }, [stats, sortMode, search]);

  // Bucket summary
  const buckets = useMemo(() => {
    const b = { full: 0, high: 0, mid: 0, low: 0, sparse: 0 };
    for (const s of stats) {
      if (s.pct >= 90) b.full++;
      else if (s.pct >= 70) b.high++;
      else if (s.pct >= 50) b.mid++;
      else if (s.pct >= 25) b.low++;
      else b.sparse++;
    }
    return b;
  }, [stats]);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 18px 60px" }}>

      {/* Page header */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.6rem",
          color: "var(--red)", letterSpacing: "3px", lineHeight: 1 }}>
          Data View
        </div>
        <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: 4 }}>
          Column population across <strong>{total.toLocaleString()}</strong> comics — how complete is the catalogue?
        </div>
      </div>

      {/* ── Data Import / Export ─────────────────────────────────── */}
      <div style={{
        background: "var(--surface)", border: "1.5px solid var(--border)",
        borderRadius: 8, padding: "14px 16px", marginBottom: 20, marginTop: 14,
      }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"2px", color:"var(--muted)", marginBottom:10 }}>
          OFFLINE DATA MANAGEMENT
          {hasOverride && <span style={{ marginLeft:8, color:"#d97706", letterSpacing:"1px" }}>● OVERRIDE ACTIVE</span>}
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          {/* Export */}
          <button
            onClick={handleExport}
            style={{
              fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem", letterSpacing:"1.5px",
              padding:"7px 16px", border:"1.5px solid var(--border)",
              background:"var(--surface2)", color:"var(--muted2)", borderRadius:5, cursor:"pointer",
            }}
          >
            ↓ Export Data JSON
          </button>
          {/* Import */}
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem", letterSpacing:"1.5px",
              padding:"7px 16px", border:"1.5px solid #2563eb",
              background:"none", color:"#2563eb", borderRadius:5, cursor:"pointer",
            }}
          >
            ↑ Import Data JSON
          </button>
          <input ref={fileRef} type="file" accept=".json" style={{ display:"none" }} onChange={handleImport} />
          {/* Clear override */}
          {hasOverride && (
            <button
              onClick={handleClearOverride}
              style={{
                fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"1.5px",
                padding:"7px 14px", border:"1.5px solid #c8102e",
                background:"none", color:"#c8102e", borderRadius:5, cursor:"pointer",
              }}
            >
              ✕ Clear Override
            </button>
          )}
        </div>
        {importMsg && (
          <div style={{
            marginTop:10, padding:"7px 12px", borderRadius:5, fontSize:"0.8rem",
            fontFamily:"'Crimson Pro',serif", lineHeight:1.45,
            background: importMsg.ok ? "#f0fdf4" : "#fff0f0",
            border: `1px solid ${importMsg.ok ? "#86efac" : "#fca5a5"}`,
            color: importMsg.ok ? "#166534" : "#991b1b",
          }}>
            {importMsg.text}
          </div>
        )}
        <div style={{ marginTop:8, fontSize:"0.72rem", color:"var(--muted)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic" }}>
          Export JSON from this page · drop the file in a new xlsx build · re-import offline. After import, reload the page.
        </div>
      </div>

      {/* Bucket summary pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20, marginTop: 14 }}>
        {[
          { label: "Full (90–100%)", count: buckets.full,   color: "#22c55e" },
          { label: "High (70–89%)",  count: buckets.high,   color: "#84cc16" },
          { label: "Mid (50–69%)",   count: buckets.mid,    color: "#f59e0b" },
          { label: "Low (25–49%)",   count: buckets.low,    color: "#f97316" },
          { label: "Sparse (<25%)",  count: buckets.sparse, color: "#c8102e" },
        ].map(b => (
          <div key={b.label} style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "var(--surface)", border: `1.5px solid ${b.color}`,
            borderRadius: 6, padding: "5px 12px",
          }}>
            <div style={{ width: 8, height: 8, background: b.color, borderRadius: "50%", flexShrink: 0 }} />
            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.7rem",
              letterSpacing: "1px", color: b.color }}>{b.count}</span>
            <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{b.label}</span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search columns…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 160, maxWidth: 280,
            border: "1.5px solid var(--border)", borderRadius: 6,
            padding: "7px 12px", fontSize: "0.85rem",
            fontFamily: "'Crimson Pro',Georgia,serif", background: "var(--surface)",
            color: "var(--text2)", outline: "none" }}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {([
            ["pct",       "Most → Least"],
            ["pct-asc",   "Least → Most"],
            ["alpha",     "A → Z"],
            ["alpha-desc","Z → A"],
          ] as const).map(([m, lbl]) => (
            <button key={m} onClick={() => setSortMode(m)} style={{
              background: sortMode === m ? "var(--red)" : "var(--surface)",
              color: sortMode === m ? "#fff" : "var(--muted2)",
              border: sortMode === m ? "1.5px solid var(--red)" : "1.5px solid var(--border)",
              borderRadius: 5, padding: "6px 14px", cursor: "pointer",
              fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.75rem", letterSpacing: "1px",
              transition: "all 0.15s",
            }}>
              {lbl}
            </button>
          ))}
        </div>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.7rem",
          letterSpacing: "1px", color: "var(--muted)", marginLeft: "auto" }}>
          {displayed.length} of {stats.length} FIELDS
        </div>
      </div>

      {/* Field rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {displayed.map((s, i) => {
          const color = barColor(s.pct);
          return (
            <div key={s.field} style={{
              background: "var(--surface)", border: "1.5px solid var(--border)",
              borderRadius: 8, padding: "10px 14px",
              borderLeft: `4px solid ${color}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                {/* Rank */}
                {sortMode === "pct" && (
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.75rem",
                    color: "var(--muted)", minWidth: 22, textAlign: "right", flexShrink: 0 }}>
                    #{i + 1}
                  </div>
                )}
                {/* Label */}
                <div style={{ flex: 1, fontSize: "0.88rem", fontWeight: 600, color: "var(--brown-light)" }}>
                  {s.label}
                  <span style={{ fontFamily: "monospace", fontSize: "0.72rem",
                    color: "var(--muted)", marginLeft: 8, fontWeight: 400 }}>
                    .{s.field}
                  </span>
                </div>
                {/* Count */}
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.8rem",
                  color: "var(--muted2)", letterSpacing: "0.5px", flexShrink: 0 }}>
                  {s.count.toLocaleString()} / {total.toLocaleString()}
                </div>
                {/* Percentage */}
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.1rem",
                  color, letterSpacing: "1px", minWidth: 42, textAlign: "right", flexShrink: 0 }}>
                  {s.pct}%
                </div>
              </div>

              {/* Bar */}
              <div style={{ height: 7, background: "var(--surface2)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  width: `${s.pct}%`, height: "100%", background: color,
                  borderRadius: 4, transition: "width 0.4s ease",
                }} />
              </div>

              {/* Sample value */}
              {s.sample && (
                <div style={{ marginTop: 5, fontSize: "0.73rem", color: "var(--muted)",
                  fontFamily: "'Crimson Pro',Georgia,serif", fontStyle: "italic",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  e.g. "{s.sample}"
                </div>
              )}
            </div>
          );
        })}
      </div>

      {displayed.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)",
          fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "2px" }}>
          NO COLUMNS MATCH "{search}"
        </div>
      )}
    </div>
  );
}
