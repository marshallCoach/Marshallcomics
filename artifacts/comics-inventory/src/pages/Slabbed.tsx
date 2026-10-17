import { useMemo } from "react";
import { DATA, type Comic } from "@/data/data";
import { CoverImage } from "@/components/CoverImage";
import { SLAB_EXAMPLES, isSlab, slabGrade } from "@/components/Slab";

const num = (s?: string) => { const n = parseFloat(String(s ?? "").replace(/[$,]/g, "")); return isNaN(n) ? 0 : n; };

export default function Slabbed({ onNavigate }: { onNavigate?: (tab: string, params?: Record<string, string>) => void }) {
  const slabs = useMemo(
    () => (DATA.comics as Comic[])
      .filter(isSlab)
      .sort((a, b) => parseFloat(slabGrade(b) || "0") - parseFloat(slabGrade(a) || "0")),
    []
  );
  const totalNM = slabs.reduce((s, c) => s + num(c.Value_NM), 0);

  function editComic(c: Comic) {
    if (!onNavigate) return;
    const issue = String(c.Issue || "").replace(/^#/, "");
    onNavigate("editcomic", { query: `${c.Title}${issue ? ` #${issue}` : ""}` });
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 14px 60px" }}>
      <h1 style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: "1px", fontSize: "1.5rem", marginBottom: 4 }}>
        🏷️ Slabbed — CGC Graded
      </h1>
      <div style={{ color: "var(--muted2)", fontSize: "0.95rem", marginBottom: 18 }}>
        {slabs.length} graded books · ${Math.round(totalNM).toLocaleString()} NM total
      </div>

      {/* Featured example slab photos. Each hides itself if its file isn't pushed yet. */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        {SLAB_EXAMPLES.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`Slab example ${i + 1}`}
            loading="lazy"
            onError={e => { e.currentTarget.style.display = "none"; }}
            style={{ width: 150, height: 225, objectFit: "cover", borderRadius: 6, boxShadow: "0 4px 14px rgba(0,0,0,0.22)", background: "var(--surface2)" }}
          />
        ))}
      </div>

      {/* All slabs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16 }}>
        {slabs.map((c, i) => (
          <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, borderTop: "3px solid #111" }}>
            <div style={{ position: "relative" }}>
              <CoverImage comic={c} width={128} height={192} style={{ borderRadius: 5, boxShadow: "0 2px 8px rgba(0,0,0,0.18)", display: "block", margin: "0 auto" }} />
              <span style={{ position: "absolute", top: 6, left: 6, fontSize: "0.72rem", fontWeight: 800, color: "#fff", background: "#111", borderRadius: 3, padding: "2px 7px" }}>
                CGC {slabGrade(c)}
              </span>
            </div>
            <div style={{ marginTop: 8, fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.25 }}>{c.Title}</div>
            <div style={{ color: "var(--muted2)", fontSize: "0.875rem" }}>
              #{String(c.Issue || "").replace(/^#/, "")}{c.Year ? ` · ${c.Year}` : ""}{c.Box ? ` · Box ${c.Box}` : ""}
            </div>
            {(c.Signed || "").toUpperCase() === "YES" && c.Signed_By && (
              <div style={{ fontSize: "0.85rem", color: "var(--brown)", marginTop: 2 }}>✍ {c.Signed_By}</div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
              {c.Value_NM && c.Value_NM !== "nan"
                ? <span style={{ color: "var(--green-text)", fontSize: "0.9rem" }}>NM <strong>${c.Value_NM}</strong></span>
                : <span />}
              {onNavigate && (
                <button
                  onClick={() => editComic(c)}
                  title="Edit this book's details"
                  style={{ all: "unset", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700, color: "var(--brown)", border: "1px solid var(--brown)", borderRadius: 4, padding: "1px 6px" }}
                >e</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
