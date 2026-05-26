import { useState, useMemo } from "react";
import { DATA3 } from "@/data/data3";
import type { Comic } from "@/data/data3";

const comics = DATA3.comics;

// ── Build duplicate groups ────────────────────────────────────────────────────
interface DupGroup {
  key: string;
  title: string;
  issue: string;
  copies: Comic[];
  flag: "same-box" | "same-pub-year" | "variant";
}

const RAW_GROUPS = (() => {
  const map = new Map<string, Comic[]>();
  for (const c of comics) {
    const k = `${c.Title.trim()}|||${c.Issue.trim()}`;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(c);
  }
  const groups: DupGroup[] = [];
  for (const [key, copies] of map) {
    if (copies.length < 2) continue;
    const [title, issue] = key.split("|||");
    // Classify flag
    const boxes = new Set(copies.map(c => c.Box));
    const pubs  = new Set(copies.map(c => (c.Publisher || "").toUpperCase()));
    const years = new Set(copies.map(c => c.Year));
    let flag: DupGroup["flag"];
    if (boxes.size < copies.length) flag = "same-box";
    else if (pubs.size === 1 && years.size === 1) flag = "same-pub-year";
    else flag = "variant";
    groups.push({ key, title, issue, copies, flag });
  }
  return groups.sort((a, b) => b.copies.length - a.copies.length || a.title.localeCompare(b.title));
})();

const TOTAL_DUP_BOOKS = RAW_GROUPS.reduce((s, g) => s + g.copies.length, 0);
const SAME_BOX_COUNT  = RAW_GROUPS.filter(g => g.flag === "same-box").length;
const VARIANT_COUNT   = RAW_GROUPS.filter(g => g.flag === "variant").length;

// ── Helpers ───────────────────────────────────────────────────────────────────
function flagLabel(f: DupGroup["flag"]) {
  if (f === "same-box")     return "SAME BOX";
  if (f === "same-pub-year") return "LIKELY DUP";
  return "VARIANT";
}
function flagColor(f: DupGroup["flag"]) {
  if (f === "same-box")     return "#dc2626";
  if (f === "same-pub-year") return "#d97706";
  return "#16a34a";
}
function countColor(n: number) {
  if (n >= 5) return "#dc2626";
  if (n >= 3) return "#d97706";
  return "#ca8a04";
}
function fmtVal(v: string) {
  const m = (v || "").match(/\$?(\d+(?:\.\d+)?)/);
  return m ? `$${m[1]}` : "—";
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Duplicates() {
  const [query,    setQuery]    = useState("");
  const [filter,   setFilter]   = useState<"all" | "same-box" | "same-pub-year" | "variant">("all");
  const [sort,     setSort]     = useState<"count" | "alpha">("count");
  const [openKey,  setOpenKey]  = useState<string | null>(null);
  const [showAll,  setShowAll]  = useState(false);

  const filtered = useMemo(() => {
    let g = RAW_GROUPS;
    if (filter !== "all") g = g.filter(gr => gr.flag === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      g = g.filter(gr => gr.title.toLowerCase().includes(q) || gr.issue.toLowerCase().includes(q));
    }
    if (sort === "alpha") g = [...g].sort((a, b) => a.title.localeCompare(b.title));
    return g;
  }, [query, filter, sort]);

  const visible = showAll ? filtered : filtered.slice(0, 60);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 80px" }}>

      {/* ── HEADER ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "2rem", letterSpacing: "3px", color: "var(--red)", margin: 0, lineHeight: 1 }}>
          DUPLICATE DETECTOR
        </h1>
        <p style={{ fontSize: "0.82rem", color: "var(--muted2)", marginTop: 6, fontFamily: "'Crimson Pro',serif" }}>
          Books where the same title + issue number appears more than once. Some are intentional variants — others may be data entry errors.
        </p>
      </div>

      {/* ── STAT TILES ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
        {[
          { val: RAW_GROUPS.length.toLocaleString(), lbl: "Duplicate Groups",  sub: "unique title + issue combos", color: "#dc2626" },
          { val: TOTAL_DUP_BOOKS.toLocaleString(),   lbl: "Total Copies",      sub: "books across all groups",    color: "#d97706" },
          { val: SAME_BOX_COUNT.toLocaleString(),    lbl: "Same-Box Dupes",    sub: "possible data entry errors", color: "#dc2626" },
          { val: VARIANT_COUNT.toLocaleString(),     lbl: "Likely Variants",   sub: "different pub / year / era", color: "#16a34a" },
        ].map((s, i) => (
          <div key={i} style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderTop: `3px solid ${s.color}`, borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.8rem", color: s.color, letterSpacing: "2px", lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", letterSpacing: "2px", color: "var(--muted2)", marginTop: 4 }}>{s.lbl}</div>
            <div style={{ fontSize: "0.65rem", color: "var(--muted)", marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── LEGEND ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        {([
          ["same-box",      "#dc2626", "SAME BOX",     "Two+ copies recorded in the same box — likely a data entry error"],
          ["same-pub-year", "#d97706", "LIKELY DUP",   "Same publisher + year — possibly bought twice"],
          ["variant",       "#16a34a", "VARIANT",      "Different publisher, year or era — probably intentional (reprints, imports, etc.)"],
        ] as const).map(([, color, label, desc]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.7rem", color: "var(--muted2)" }}>
            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.6rem", letterSpacing: "1.5px", color, background: color + "18", border: `1px solid ${color}40`, padding: "2px 7px", borderRadius: 3 }}>{label}</span>
            <span>{desc}</span>
          </div>
        ))}
      </div>

      {/* ── CONTROLS ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <input
          placeholder="Search title or issue…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ flex: "1 1 220px", padding: "8px 12px", border: "1.5px solid var(--border)", borderRadius: 6, fontSize: "0.85rem", fontFamily: "'Crimson Pro',serif", background: "var(--surface)", color: "var(--text2)" }}
        />
        <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}
          style={{ padding: "8px 10px", border: "1.5px solid var(--border)", borderRadius: 6, fontSize: "0.82rem", background: "var(--surface)", color: "var(--text2)", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "1px" }}>
          <option value="all">All Types</option>
          <option value="same-box">Same Box</option>
          <option value="same-pub-year">Likely Duplicate</option>
          <option value="variant">Variant / Reprint</option>
        </select>
        <select value={sort} onChange={e => setSort(e.target.value as typeof sort)}
          style={{ padding: "8px 10px", border: "1.5px solid var(--border)", borderRadius: 6, fontSize: "0.82rem", background: "var(--surface)", color: "var(--text2)", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "1px" }}>
          <option value="count">Most Copies First</option>
          <option value="alpha">A → Z</option>
        </select>
        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: "auto", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "1px" }}>
          {filtered.length.toLocaleString()} GROUPS
        </div>
      </div>

      {/* ── GROUP LIST ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map(gr => {
          const isOpen = openKey === gr.key;
          const cc = countColor(gr.copies.length);
          const fc = flagColor(gr.flag);
          return (
            <div key={gr.key}
              style={{ background: "var(--surface)", border: `1.5px solid ${isOpen ? cc + "60" : "var(--border)"}`, borderRadius: 8, overflow: "hidden", boxShadow: isOpen ? `0 2px 12px ${cc}18` : "none" }}>

              {/* Row header */}
              <div
                onClick={() => setOpenKey(isOpen ? null : gr.key)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", cursor: "pointer", userSelect: "none" }}
              >
                {/* Copy count badge */}
                <div style={{ flexShrink: 0, fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.3rem", color: cc, lineHeight: 1, minWidth: 28, textAlign: "center" }}>
                  {gr.copies.length}
                  <div style={{ fontSize: "0.42rem", letterSpacing: "1.5px", color: "var(--muted)" }}>COPIES</div>
                </div>

                {/* Title */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.95rem", letterSpacing: "1px", color: "var(--text)" }}>
                    {gr.title}
                  </span>
                  <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.85rem", color: "var(--red)", marginLeft: 6 }}>
                    {gr.issue}
                  </span>
                  {/* Publishers / years summary */}
                  <div style={{ fontSize: "0.67rem", color: "var(--muted)", marginTop: 2 }}>
                    {[...new Set(gr.copies.map(c => c.Publisher))].filter(Boolean).join(" · ")}
                    {" — "}
                    {[...new Set(gr.copies.map(c => c.Year))].filter(Boolean).sort().join(", ")}
                  </div>
                </div>

                {/* Boxes */}
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flexShrink: 0 }}>
                  {[...new Set(gr.copies.map(c => c.Box))].filter(Boolean).slice(0, 6).map(b => (
                    <span key={b} style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.55rem", letterSpacing: "1px", color: "var(--muted2)", background: "var(--surface2)", border: "1px solid var(--border)", padding: "2px 6px", borderRadius: 3 }}>
                      B{b}
                    </span>
                  ))}
                </div>

                {/* Flag */}
                <span style={{ flexShrink: 0, fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.58rem", letterSpacing: "1.5px", color: fc, background: fc + "18", border: `1px solid ${fc}40`, padding: "3px 8px", borderRadius: 3 }}>
                  {flagLabel(gr.flag)}
                </span>

                <span style={{ color: "var(--muted)", fontSize: "0.75rem", flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
              </div>

              {/* Expanded copy detail */}
              {isOpen && (
                <div style={{ borderTop: "1px solid var(--border)", overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                    <thead>
                      <tr style={{ background: "var(--surface2)" }}>
                        {["#", "Box", "Publisher", "Year", "Condition", "Key", "Signed", "NM Value", "VF Value"].map(h => (
                          <th key={h} style={{ padding: "7px 12px", textAlign: "left", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.6rem", letterSpacing: "2px", color: "var(--muted)", fontWeight: 600, whiteSpace: "nowrap", borderBottom: "1px solid var(--border)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gr.copies.map((c, ci) => {
                        const isKey    = (c.Key    || "").toUpperCase() === "YES";
                        const isSigned = (c.Signed || "").toUpperCase() === "YES";
                        // Highlight rows in same box as another copy
                        const boxDup = gr.copies.filter(x => x.Box === c.Box).length > 1;
                        return (
                          <tr key={ci} style={{ background: boxDup ? "#fff8f8" : ci % 2 === 0 ? "var(--surface)" : "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "7px 12px", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", color: "var(--muted)" }}>#{ci + 1}</td>
                            <td style={{ padding: "7px 12px", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.78rem", color: "var(--red)" }}>
                              Box {c.Box}
                              {boxDup && <span style={{ marginLeft: 4, fontSize: "0.5rem", color: "#dc2626", letterSpacing: "1px" }}>⚠</span>}
                            </td>
                            <td style={{ padding: "7px 12px", color: "var(--text2)", whiteSpace: "nowrap" }}>{c.Publisher || "—"}</td>
                            <td style={{ padding: "7px 12px", color: "var(--muted2)", fontFamily: "'Bebas Neue',sans-serif" }}>{c.Year || "—"}</td>
                            <td style={{ padding: "7px 12px", color: "var(--muted2)" }}>{c.Condition || "—"}</td>
                            <td style={{ padding: "7px 12px" }}>
                              {isKey && <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.58rem", letterSpacing: "1px", color: "#d97706", background: "#d9770618", border: "1px solid #d9770640", padding: "2px 6px", borderRadius: 3 }}>KEY</span>}
                            </td>
                            <td style={{ padding: "7px 12px" }}>
                              {isSigned && <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.58rem", letterSpacing: "1px", color: "#8b2be2", background: "#8b2be218", border: "1px solid #8b2be240", padding: "2px 6px", borderRadius: 3 }}>SGD</span>}
                            </td>
                            <td style={{ padding: "7px 12px", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.82rem", color: "var(--red)", whiteSpace: "nowrap" }}>{fmtVal(c.Value_NM)}</td>
                            <td style={{ padding: "7px 12px", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.78rem", color: "var(--muted2)", whiteSpace: "nowrap" }}>{fmtVal(c.Value_VF)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {/* Insight row */}
                  <div style={{ padding: "10px 14px", background: fc + "0a", borderTop: "1px solid " + fc + "20", fontSize: "0.72rem", color: "var(--muted2)", fontFamily: "'Crimson Pro',serif" }}>
                    {gr.flag === "same-box" && "⚠ One or more copies share a box — verify these are physical duplicates before deciding to sell or flag."}
                    {gr.flag === "same-pub-year" && "↗ Same publisher and year across all copies. Check if these are different printings, or truly duplicated data entries."}
                    {gr.flag === "variant"   && "✓ Different publishers or years — these are likely intentional variants, reprints, or imports. No action needed."}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Show all toggle */}
      {filtered.length > 60 && !showAll && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button
            onClick={() => setShowAll(true)}
            style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.85rem", letterSpacing: "2px", color: "var(--red)", background: "none", border: "1.5px solid var(--red)", borderRadius: 6, padding: "10px 28px", cursor: "pointer" }}
          >
            SHOW ALL {filtered.length.toLocaleString()} GROUPS
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.1rem", letterSpacing: "3px", marginBottom: 8 }}>NO MATCHES</div>
          <div style={{ fontSize: "0.8rem" }}>Try adjusting your search or filter.</div>
        </div>
      )}
    </div>
  );
}
