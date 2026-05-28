import { useState, useMemo, useCallback, useRef } from "react";
import { DATA3 } from "@/data/data3";
import type { Comic } from "@/data/data3";

// ── LocalStorage ──────────────────────────────────────────────────────────────
const LS_DECISIONS = "brbGroupDecisions";

type Action = "not-dup" | "planned" | "data-error";
interface Decision { action: Action; note: string; }

function loadDecisions(): Map<string, Decision> {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_DECISIONS) || "{}");
    return new Map(Object.entries(raw));
  } catch { return new Map(); }
}
function saveDecisions(m: Map<string, Decision>) {
  const obj: Record<string, Decision> = {};
  m.forEach((v, k) => { obj[k] = v; });
  localStorage.setItem(LS_DECISIONS, JSON.stringify(obj));
}

// ── Duplicate groups ──────────────────────────────────────────────────────────
interface DupGroup {
  key: string;
  title: string;
  issue: string;
  volume: string;
  publisher: string;
  year: string;
  copies: Comic[];
  flag: "same-box" | "bought-twice";
}

const comics = DATA3.comics;

const RAW_GROUPS = (() => {
  const map = new Map<string, Comic[]>();
  for (const c of comics) {
    const k = [
      c.Title.trim(),
      (c.Issue || "").trim().toLowerCase(),
      (c.Publisher || "").trim().toUpperCase(),
      (c.Year || "").trim(),
      String(c.Volume || "").trim(),
    ].join("|||");
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(c);
  }
  const groups: DupGroup[] = [];
  for (const [key, copies] of map) {
    if (copies.length < 2) continue;
    const [title, issue,, year, volume] = key.split("|||");
    const publisher = copies[0].Publisher || "";
    const boxes = new Set(copies.map(c => c.Box));
    const flag: DupGroup["flag"] = boxes.size < copies.length ? "same-box" : "bought-twice";
    groups.push({ key, title, issue: copies[0].Issue || issue, volume, publisher, year, copies, flag });
  }
  return groups.sort((a, b) => b.copies.length - a.copies.length || a.title.localeCompare(b.title));
})();

const TOTAL_DUP_BOOKS    = RAW_GROUPS.reduce((s, g) => s + g.copies.length, 0);
const SAME_BOX_COUNT     = RAW_GROUPS.filter(g => g.flag === "same-box").length;
const BOUGHT_TWICE_COUNT = RAW_GROUPS.filter(g => g.flag === "bought-twice").length;

// ── Helpers ───────────────────────────────────────────────────────────────────
function countColor(n: number) {
  if (n >= 5) return "#dc2626";
  if (n >= 3) return "#d97706";
  return "#ca8a04";
}
function fmtVal(v: string) {
  const m = (v || "").match(/\$?(\d+(?:\.\d+)?)/);
  return m ? `$${m[1]}` : "—";
}

const ACTION_META: Record<Action, { label: string; color: string; bg: string; border: string; desc: string }> = {
  "not-dup":    { label: "NOT DUP",      color: "#16a34a", bg: "#f0faf4", border: "#c6e8d0", desc: "Different books — intentional, keep as-is" },
  "planned":    { label: "PLANNED",      color: "#d97706", bg: "#fefce8", border: "#fcd34d", desc: "Intentional duplicate — held for selling/trading" },
  "data-error": { label: "FIX IN SHEET", color: "#dc2626", bg: "#fff8f8", border: "#fecaca", desc: "Data entry error — remove duplicate row in xlsx" },
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function Duplicates() {
  const [decisions, setDecisions]   = useState<Map<string, Decision>>(() => loadDecisions());
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteDraft,  setNoteDraft]  = useState("");

  const [query,   setQuery]   = useState("");
  const [filter,  setFilter]  = useState<"all" | "same-box" | "bought-twice" | "unreviewed">("unreviewed");
  const [sort,    setSort]    = useState<"count" | "alpha">("count");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [copied,  setCopied]  = useState(false);
  const outputRef = useRef<HTMLTextAreaElement>(null);

  const setDecision = useCallback((key: string, action: Action) => {
    setDecisions(prev => {
      const next = new Map(prev);
      const existing = next.get(key);
      if (existing?.action === action) {
        next.delete(key);
      } else {
        next.set(key, { action, note: existing?.note || "" });
      }
      saveDecisions(next);
      return next;
    });
  }, []);

  const updateNote = useCallback((key: string, note: string) => {
    setDecisions(prev => {
      const next = new Map(prev);
      const existing = next.get(key);
      if (existing) {
        next.set(key, { ...existing, note });
        saveDecisions(next);
      }
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setDecisions(new Map());
    saveDecisions(new Map());
  }, []);

  const reviewed = useMemo(() => new Set(decisions.keys()), [decisions]);

  const filtered = useMemo(() => {
    let g = RAW_GROUPS;
    if (filter === "same-box")    g = g.filter(gr => gr.flag === "same-box");
    else if (filter === "bought-twice") g = g.filter(gr => gr.flag === "bought-twice");
    else if (filter === "unreviewed")   g = g.filter(gr => !reviewed.has(gr.key));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      g = g.filter(gr => gr.title.toLowerCase().includes(q) || gr.issue.toLowerCase().includes(q));
    }
    if (sort === "alpha") g = [...g].sort((a, b) => a.title.localeCompare(b.title));
    return g;
  }, [query, filter, sort, reviewed]);

  const visible = showAll ? filtered : filtered.slice(0, 80);

  // Output text for Claude
  const outputText = useMemo(() => {
    if (decisions.size === 0) return "";
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const lines: string[] = [
      `DUPLICATE REVIEW — BlackReadBrown Comics`,
      `Date: ${today}`,
      `Reviewed: ${decisions.size} of ${RAW_GROUPS.length} groups`,
      ``,
    ];
    const byAction: Record<Action, DupGroup[]> = { "not-dup": [], "planned": [], "data-error": [] };
    for (const [key, dec] of decisions) {
      const gr = RAW_GROUPS.find(g => g.key === key);
      if (gr) byAction[dec.action].push(gr);
    }
    const sections: [Action, string, string][] = [
      ["not-dup",    "NOT DUPLICATES",    "Different books sharing branding/numbering — leave as-is"],
      ["planned",    "PLANNED DUPLICATES","Intentional copies kept for selling or trading"],
      ["data-error", "FIX IN SHEET",      "Data entry errors — duplicate rows to remove from xlsx"],
    ];
    for (const [action, heading, subhead] of sections) {
      const groups = byAction[action];
      if (groups.length === 0) continue;
      lines.push(`── ${heading} (${groups.length}) ──`);
      lines.push(subhead);
      lines.push(``);
      groups.forEach((gr, i) => {
        const dec = decisions.get(gr.key)!;
        const boxes = [...new Set(gr.copies.map(c => c.Box))].filter(Boolean).map(b => `Box ${b}`).join(", ");
        const writers = [...new Set(gr.copies.map(c => c.Writer).filter(Boolean))];
        lines.push(`${i+1}. ${gr.title} ${gr.issue}${gr.volume ? ` Vol ${gr.volume}` : ""}`);
        lines.push(`   ${gr.publisher}${gr.year ? ` (${gr.year})` : ""} · ${gr.copies.length} copies · ${boxes}`);
        if (writers.length) lines.push(`   W: ${writers.join(", ")}`);
        if (dec.note) lines.push(`   Note: ${dec.note}`);
        lines.push(``);
      });
    }
    const unreviewed = RAW_GROUPS.length - decisions.size;
    if (unreviewed > 0) lines.push(`${unreviewed} groups still unreviewed.`);
    return lines.join("\n");
  }, [decisions]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 80px" }}>

      {/* ── HEADER ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "2rem", letterSpacing: "3px", color: "var(--red)", margin: 0, lineHeight: 1 }}>
          DUPLICATE DETECTOR
        </h1>
        <p style={{ fontSize: "0.82rem", color: "var(--muted2)", marginTop: 6, fontFamily: "'Crimson Pro',serif" }}>
          Same title + issue + publisher + year + volume appearing more than once. Classify each group in one click — no expanding required.
        </p>
      </div>

      {/* ── STAT TILES ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
        {[
          { val: RAW_GROUPS.length.toLocaleString(),    lbl: "Duplicate Groups",  sub: "same title+issue+pub+year+vol", color: "#dc2626" },
          { val: TOTAL_DUP_BOOKS.toLocaleString(),      lbl: "Total Copies",      sub: "books across all groups",       color: "#d97706" },
          { val: SAME_BOX_COUNT.toLocaleString(),       lbl: "Same-Box",          sub: "likely data entry errors",      color: "#dc2626" },
          { val: `${reviewed.size}/${RAW_GROUPS.length}`, lbl: "Reviewed",        sub: `${RAW_GROUPS.length - reviewed.size} groups left`, color: "#16a34a" },
        ].map((s, i) => (
          <div key={i} style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderTop: `3px solid ${s.color}`, borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.8rem", color: s.color, letterSpacing: "2px", lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", letterSpacing: "2px", color: "var(--muted2)", marginTop: 4 }}>{s.lbl}</div>
            <div style={{ fontSize: "0.65rem", color: "var(--muted)", marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── ACTION LEGEND ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        {(Object.entries(ACTION_META) as [Action, typeof ACTION_META[Action]][]).map(([action, meta]) => {
          const count = [...decisions.values()].filter(d => d.action === action).length;
          return (
            <div key={action} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.7rem", color: "var(--muted2)" }}>
              <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.6rem", letterSpacing: "1.5px",
                color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`,
                padding: "2px 7px", borderRadius: 3 }}>{meta.label}</span>
              <span>{meta.desc}</span>
              {count > 0 && <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.58rem", color: meta.color }}>({count})</span>}
            </div>
          );
        })}
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
          <option value="unreviewed">Unreviewed Only</option>
          <option value="all">All Groups</option>
          <option value="same-box">Same Box</option>
          <option value="bought-twice">Bought Twice</option>
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
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {visible.map(gr => {
          const isOpen   = openKey === gr.key;
          const dec      = decisions.get(gr.key);
          const meta     = dec ? ACTION_META[dec.action] : null;
          const cc       = countColor(gr.copies.length);
          const flagColor = gr.flag === "same-box" ? "#dc2626" : "#d97706";
          const isEditingNote = editingNote === gr.key;
          const boxes    = [...new Set(gr.copies.map(c => c.Box))].filter(Boolean);

          return (
            <div key={gr.key} style={{
              background: meta ? meta.bg : "var(--surface)",
              border: `1.5px solid ${meta ? meta.border : "var(--border)"}`,
              borderLeft: `4px solid ${meta ? meta.color : flagColor}`,
              borderRadius: 8,
              overflow: "hidden",
              opacity: dec ? 0.88 : 1,
            }}>

              {/* ── GROUP ROW ── */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>

                {/* Copy count */}
                <div style={{ flexShrink: 0, textAlign: "center", minWidth: 32 }}>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.3rem", color: dec ? meta!.color : cc, lineHeight: 1 }}>{gr.copies.length}</div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.42rem", letterSpacing: "1.5px", color: "var(--muted)" }}>COPIES</div>
                </div>

                {/* Title — click to expand */}
                <div
                  onClick={() => setOpenKey(isOpen ? null : gr.key)}
                  style={{ flex: 1, minWidth: 0, cursor: "pointer", userSelect: "text" }}
                >
                  <div>
                    <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.95rem", letterSpacing: "1px",
                      color: dec ? "var(--muted2)" : "var(--text)",
                      textDecoration: dec ? "line-through" : "none" }}>
                      {gr.title}
                    </span>
                    <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.85rem", color: "var(--red)", marginLeft: 6 }}>
                      {gr.issue}
                    </span>
                    {gr.volume && (
                      <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.6rem", letterSpacing: "1px",
                        color: "var(--muted2)", marginLeft: 6, background: "var(--surface2)",
                        border: "1px solid var(--border)", padding: "1px 5px", borderRadius: 3 }}>
                        VOL {gr.volume}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.67rem", color: "var(--muted)", marginTop: 2, display: "flex", gap: "4px 10px", flexWrap: "wrap" }}>
                    <span>{gr.publisher}{gr.year ? ` · ${gr.year}` : ""}</span>
                    <span style={{ color: "var(--muted)" }}>
                      {boxes.slice(0,5).map(b => `Box ${b}`).join(", ")}{boxes.length > 5 ? ` +${boxes.length-5}` : ""}
                    </span>
                  </div>
                </div>

                {/* Flag badge */}
                <span style={{
                  fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.55rem", letterSpacing: "1.5px",
                  color: flagColor, background: flagColor + "14", border: `1px solid ${flagColor}40`,
                  padding: "2px 7px", borderRadius: 3, flexShrink: 0,
                }}>
                  {gr.flag === "same-box" ? "SAME BOX" : "BOUGHT TWICE"}
                </span>

                {/* ── DECISION BUTTONS ── */}
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  {(Object.entries(ACTION_META) as [Action, typeof ACTION_META[Action]][]).map(([action, m]) => {
                    const active = dec?.action === action;
                    return (
                      <button
                        key={action}
                        onClick={e => { e.stopPropagation(); setDecision(gr.key, action); }}
                        title={m.desc}
                        style={{
                          fontFamily: "'Bebas Neue',sans-serif",
                          fontSize: "0.56rem",
                          letterSpacing: "1px",
                          padding: "4px 8px",
                          border: `1.5px solid ${active ? m.color : "var(--border)"}`,
                          background: active ? m.color : "var(--surface2)",
                          color: active ? "#fff" : "var(--muted)",
                          borderRadius: 4,
                          cursor: "pointer",
                          transition: "all 0.12s",
                          whiteSpace: "nowrap",
                        }}
                      >{m.label}</button>
                    );
                  })}
                  {/* Expand toggle */}
                  <button
                    onClick={() => setOpenKey(isOpen ? null : gr.key)}
                    style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, width: 24, height: 24, cursor: "pointer", color: "var(--muted)", fontSize: "0.7rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                  >{isOpen ? "▲" : "▼"}</button>
                </div>
              </div>

              {/* ── NOTE ROW (when classified) ── */}
              {dec && (
                <div style={{ padding: "0 12px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.56rem", letterSpacing: "1.5px",
                    color: meta!.color, background: meta!.bg, border: `1px solid ${meta!.border}`,
                    padding: "2px 7px", borderRadius: 3, flexShrink: 0 }}>
                    {meta!.label}
                  </span>
                  {isEditingNote ? (
                    <input
                      autoFocus
                      value={noteDraft}
                      onChange={e => setNoteDraft(e.target.value)}
                      onBlur={() => { updateNote(gr.key, noteDraft); setEditingNote(null); }}
                      onKeyDown={e => { if (e.key === "Enter") { updateNote(gr.key, noteDraft); setEditingNote(null); } if (e.key === "Escape") setEditingNote(null); }}
                      placeholder="add a note…"
                      style={{ flex: 1, padding: "3px 8px", border: `1px solid ${meta!.color}`, borderRadius: 4, fontSize: "0.75rem", fontFamily: "'Crimson Pro',serif", background: "#fff", color: "var(--text2)", outline: "none" }}
                    />
                  ) : (
                    <span
                      onClick={() => { setEditingNote(gr.key); setNoteDraft(dec.note || ""); }}
                      style={{ flex: 1, fontSize: "0.75rem", fontFamily: "'Crimson Pro',serif", color: dec.note ? "var(--text2)" : "var(--muted)", fontStyle: dec.note ? "normal" : "italic", cursor: "text", padding: "2px 4px", borderRadius: 3 }}
                      title="Click to add a note"
                    >
                      {dec.note || "click to add a note…"}
                    </span>
                  )}
                </div>
              )}

              {/* ── EXPANDED COPIES ── */}
              {isOpen && (
                <div style={{ borderTop: "1px solid var(--border)" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                      <thead>
                        <tr style={{ background: "var(--surface2)", borderBottom: "1.5px solid var(--border)" }}>
                          {["#","BOX","VOL","WRITER","ARTIST","CONDITION","KEY","SIGNED","NM VALUE","VF VALUE"].map(h => (
                            <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.6rem", letterSpacing: "1.5px", color: "var(--muted)", fontWeight: 400 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {gr.copies.map((c, ci) => {
                          const boxCounts = gr.copies.filter(x => x.Box === c.Box).length;
                          const boxDup    = boxCounts > 1;
                          const isKey     = (c.Key    || "").toUpperCase() === "YES";
                          const isSigned  = (c.Signed || "").toUpperCase() === "YES";
                          return (
                            <tr key={ci} style={{ borderBottom: "1px solid var(--border)", background: boxDup ? "#fff8f8" : "transparent" }}>
                              <td style={{ padding: "7px 12px", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", color: "var(--muted)" }}>#{ci + 1}</td>
                              <td style={{ padding: "7px 12px", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.78rem", color: "var(--red)" }}>
                                Box {c.Box}
                                {boxDup && <span style={{ marginLeft: 4, fontSize: "0.5rem", color: "#dc2626" }}>⚠</span>}
                              </td>
                              <td style={{ padding: "7px 12px", color: "var(--muted2)", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.72rem" }}>{c.Volume ? `V${c.Volume}` : "—"}</td>
                              <td style={{ padding: "7px 10px", color: "var(--text2)", maxWidth: 150, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={c.Writer || ""}>{c.Writer || "—"}</td>
                              <td style={{ padding: "7px 10px", color: "var(--text2)", maxWidth: 150, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={c.Artist || ""}>{c.Artist || "—"}</td>
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
                  </div>
                  <div style={{ padding: "9px 14px", background: (gr.flag === "same-box" ? "#dc2626" : "#d97706") + "08", borderTop: "1px solid var(--border)", fontSize: "0.72rem", color: "var(--muted2)", fontFamily: "'Crimson Pro',serif" }}>
                    {gr.flag === "same-box"    && "⚠ Two or more copies share a box — likely a data entry error unless you own multiple copies."}
                    {gr.flag === "bought-twice" && "↗ Same book in different boxes — likely purchased more than once."}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Show all */}
      {filtered.length > 80 && !showAll && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={() => setShowAll(true)}
            style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.85rem", letterSpacing: "2px", color: "var(--red)", background: "none", border: "1.5px solid var(--red)", borderRadius: 6, padding: "10px 28px", cursor: "pointer" }}>
            SHOW ALL {filtered.length.toLocaleString()} GROUPS
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.1rem", letterSpacing: "3px", marginBottom: 8 }}>
            {filter === "unreviewed" && reviewed.size > 0 ? "ALL GROUPS REVIEWED" : "NO MATCHES"}
          </div>
          <div style={{ fontSize: "0.8rem" }}>
            {filter === "unreviewed" && reviewed.size > 0 ? "Switch to 'All Groups' to see your decisions." : "Try adjusting your search or filter."}
          </div>
        </div>
      )}

      {/* ── OUTPUT PANEL ── */}
      {decisions.size > 0 && (
        <div style={{ marginTop: 32, borderTop: "2px solid var(--border)", paddingTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.2rem", letterSpacing: "3px", color: "var(--red)", margin: 0 }}>
              DUPLICATE REVIEW OUTPUT
            </h2>
            {(Object.entries(ACTION_META) as [Action, typeof ACTION_META[Action]][]).map(([action, meta]) => {
              const count = [...decisions.values()].filter(d => d.action === action).length;
              if (!count) return null;
              return (
                <span key={action} style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", letterSpacing: "1.5px",
                  background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`,
                  borderRadius: 3, padding: "2px 8px" }}>
                  {count} {meta.label}
                </span>
              );
            })}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowOutput(v => !v)}
                style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.72rem", letterSpacing: "1.5px", padding: "7px 18px", border: "1.5px solid var(--red)", background: showOutput ? "var(--red)" : "none", color: showOutput ? "#fff" : "var(--red)", borderRadius: 4, cursor: "pointer" }}>
                {showOutput ? "HIDE OUTPUT" : "GENERATE OUTPUT"}
              </button>
              <button
                onClick={clearAll}
                style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", letterSpacing: "1px", padding: "7px 14px", border: "1px solid var(--border)", background: "none", color: "var(--muted)", borderRadius: 4, cursor: "pointer" }}>
                CLEAR ALL
              </button>
            </div>
          </div>

          {/* Summary list */}
          {!showOutput && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 6, marginBottom: 8 }}>
              {(["not-dup","planned","data-error"] as Action[]).map(action => {
                const meta   = ACTION_META[action];
                const groups = RAW_GROUPS.filter(g => decisions.get(g.key)?.action === action);
                if (!groups.length) return null;
                return (
                  <div key={action} style={{ background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 6, padding: "10px 12px" }}>
                    <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", letterSpacing: "2px", color: meta.color, marginBottom: 6 }}>
                      {meta.label} · {groups.length} groups
                    </div>
                    {groups.map(gr => (
                      <div key={gr.key} style={{ fontSize: "0.72rem", color: "var(--text2)", marginBottom: 3, display: "flex", gap: 6, alignItems: "baseline" }}>
                        <span style={{ fontFamily: "'Bebas Neue',sans-serif", color: "var(--text)" }}>{gr.title} {gr.issue}</span>
                        <span style={{ color: "var(--muted)", fontSize: "0.66rem" }}>×{gr.copies.length}</span>
                        {decisions.get(gr.key)?.note && <span style={{ fontFamily: "'Crimson Pro',serif", fontStyle: "italic", color: "var(--muted)", fontSize: "0.7rem" }}>— {decisions.get(gr.key)!.note}</span>}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {showOutput && (
            <div style={{ position: "relative" }}>
              <textarea
                ref={outputRef}
                readOnly
                value={outputText}
                style={{
                  width: "100%", minHeight: 360, padding: "14px 16px",
                  fontFamily: "monospace", fontSize: "0.8rem", lineHeight: 1.6,
                  background: "#0f1a12", color: "#4ade80",
                  border: "1.5px solid #1e3a22", borderRadius: 8,
                  resize: "vertical", boxSizing: "border-box",
                }}
                onFocus={e => e.target.select()}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(outputText).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
                style={{
                  position: "absolute", top: 10, right: 10,
                  fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", letterSpacing: "1.5px",
                  padding: "5px 14px", border: `1.5px solid ${copied ? "#16a34a" : "#2d6a3f"}`,
                  background: copied ? "#16a34a" : "#1e3a22", color: copied ? "#fff" : "#4ade80",
                  borderRadius: 4, cursor: "pointer",
                }}
              >
                {copied ? "COPIED ✓" : "COPY"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
