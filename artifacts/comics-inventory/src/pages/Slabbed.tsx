import { useMemo } from "react";
import { DATA, type Comic } from "@/data/data";
import { CoverImage } from "@/components/CoverImage";
import { SLAB_PHOTOS, slabFileUrl, slabPhotoUrl, isSlab, isCgc, slabGrade } from "@/components/Slab";

const num = (s?: string) => { const n = parseFloat(String(s ?? "").replace(/[$,]/g, "")); return isNaN(n) ? 0 : n; };

export default function Slabbed({ onNavigate }: { onNavigate?: (tab: string, params?: Record<string, string>) => void }) {
  const slabs = useMemo(
    () => (DATA.comics as Comic[])
      .filter(isSlab)
      .sort((a, b) => {
        const g = parseFloat(slabGrade(b) || "0") - parseFloat(slabGrade(a) || "0");
        if (g !== 0) return g;                       // graded first, highest grade first
        return a.Title.localeCompare(b.Title) || num(a.Issue) - num(b.Issue);
      }),
    []
  );
  const graded = slabs.filter(isCgc).length;
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
        {slabs.length} books in CC10 · {graded} CGC-graded · ${Math.round(totalNM).toLocaleString()} NM total
      </div>

      {/* Featured slab photos — real CGC cases, each captioned with its book. */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 26 }}>
        {SLAB_PHOTOS.map(p => (
          <figure key={p.file} style={{ margin: 0, width: 150 }}>
            <img
              src={slabFileUrl(p.file)}
              alt={`${p.title} #${p.issue} — CGC ${p.grade} slab`}
              loading="lazy"
              onError={e => { const f = e.currentTarget.closest("figure"); if (f) (f as HTMLElement).style.display = "none"; }}
              style={{ width: 150, height: 225, objectFit: "cover", borderRadius: 6, boxShadow: "0 4px 14px rgba(0,0,0,0.22)", background: "var(--surface2)", display: "block" }}
            />
            <figcaption style={{ fontSize: "0.78rem", color: "var(--muted2)", marginTop: 4, lineHeight: 1.25 }}>
              {p.title} #{p.issue} · <strong>CGC {p.grade}</strong>
            </figcaption>
          </figure>
        ))}
      </div>

      {/* All slabs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16 }}>
        {slabs.map((c, i) => (
          <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, borderTop: "3px solid #111" }}>
            <div style={{ position: "relative", textAlign: "center" }}>
              {slabPhotoUrl(c)
                ? <img src={slabPhotoUrl(c)!} alt={`${c.Title} #${c.Issue} — CGC ${slabGrade(c)} slab`} loading="lazy"
                    style={{ width: 128, height: 192, objectFit: "cover", borderRadius: 5, boxShadow: "0 2px 8px rgba(0,0,0,0.18)", display: "block", margin: "0 auto" }} />
                : <CoverImage comic={c} width={128} height={192} style={{ borderRadius: 5, boxShadow: "0 2px 8px rgba(0,0,0,0.18)", display: "block", margin: "0 auto" }} />
              }
              <span style={{ position: "absolute", top: 6, left: 6, fontSize: "0.72rem", fontWeight: 800, color: "#fff", background: "#111", borderRadius: 3, padding: "2px 7px" }}>
                {slabGrade(c) ? `CGC ${slabGrade(c)}` : "SLAB"}
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
