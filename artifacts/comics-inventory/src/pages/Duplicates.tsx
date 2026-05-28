import { useState, useMemo, useEffect, useRef } from "react";
import { DATA3 } from "@/data/data3";
import type { Comic } from "@/data/data3";

const LS_DUP_RESOLVED = "brbDupResolved";
const LS_NOT_DUP      = "brbNotDup";
const LS_PLANNED      = "brbPlannedDup";
function loadSetLS(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); }
  catch { return new Set(); }
}
const loadResolvedLS = () => loadSetLS(LS_DUP_RESOLVED);
const loadNotDupLS   = () => loadSetLS(LS_NOT_DUP);
const loadPlannedLS  = () => loadSetLS(LS_PLANNED);

const comics = DATA3.comics;

// ── Build duplicate groups ────────────────────────────────────────────────────
// Grouped by: Title + Issue + Publisher + Year + Volume — true duplicates only
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

const RAW_GROUPS = (() => {
  const map = new Map<string, Comic[]>();
  for (const c of comics) {
    const normPub = (c.Publisher || "").trim().toUpperCase();
    const normVol = String(c.Volume || "").trim();
    const normYear = (c.Year || "").trim();
    const k = [
      c.Title.trim(),
      (c.Issue || "").trim().toLowerCase(),
      normPub,
      normYear,
      normVol,
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

const TOTAL_DUP_BOOKS  = RAW_GROUPS.reduce((s, g) => s + g.copies.length, 0);
const SAME_BOX_COUNT   = RAW_GROUPS.filter(g => g.flag === "same-box").length;
const BOUGHT_TWICE_COUNT = RAW_GROUPS.filter(g => g.flag === "bought-twice").length;

// ── Helpers ───────────────────────────────────────────────────────────────────
function flagLabel(f: DupGroup["flag"]) {
  if (f === "same-box")    return "SAME BOX";
  return "BOUGHT TWICE";
}
function flagColor(f: DupGroup["flag"]) {
  if (f === "same-box") return "#dc2626";
  return "#d97706";
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
  const [filter,   setFilter]   = useState<"all" | "same-box" | "bought-twice">("all");
  const [sort,     setSort]     = useState<"count" | "alpha">("count");
  const [openKey,  setOpenKey]  = useState<string | null>(null);
  const [showAll,  setShowAll]  = useState(false);
  const [view,     setView]     = useState<"standard" | "resolve">("standard");
  const [resolved,   setResolved]   = useState<Set<string>>(() => loadResolvedLS());
  const [notDup,     setNotDup]     = useState<Set<string>>(() => loadNotDupLS());
  const [planned,    setPlanned]    = useState<Set<string>>(() => loadPlannedLS());
  const [showOutput, setShowOutput] = useState(false);
  const [copied,     setCopied]     = useState(false);
  const outputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { localStorage.setItem(LS_DUP_RESOLVED, JSON.stringify([...resolved])); }, [resolved]);
  useEffect(() => { localStorage.setItem(LS_NOT_DUP,      JSON.stringify([...notDup]));   }, [notDup]);
  useEffect(() => { localStorage.setItem(LS_PLANNED,      JSON.stringify([...planned]));  }, [planned]);

  function toggle(set: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) {
    set(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }
  function toggleResolved(key: string) { toggle(setResolved, key); }

  // Per-copy key: groupKey + copy index
  const ck = (grKey: string, ci: number) => `${grKey}|||${ci}`;

  interface MarkedCopy { gr: DupGroup; ci: number; c: Comic; }
  const notDupCopies = useMemo<MarkedCopy[]>(() =>
    RAW_GROUPS.flatMap(gr => gr.copies.map((c, ci) => ({ gr, ci, c })).filter(m => notDup.has(ck(m.gr.key, m.ci)))),
    [notDup]
  );
  const plannedCopies = useMemo<MarkedCopy[]>(() =>
    RAW_GROUPS.flatMap(gr => gr.copies.map((c, ci) => ({ gr, ci, c })).filter(m => planned.has(ck(m.gr.key, m.ci)))),
    [planned]
  );

  const totalMarked = notDupCopies.length + plannedCopies.length;

  const outputText = useMemo(() => {
    if (totalMarked === 0) return "";
    const today = new Date().toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" });
    const lines: string[] = [`DUPLICATE REVIEW — BlackReadBrown Comics`, `Reviewed: ${today}`, ``];
    const fmtCopy = (m: MarkedCopy, i: number) => {
      const { gr, ci, c } = m;
      const base = `${i+1}. ${gr.title} ${gr.issue}${gr.volume ? ` Vol ${gr.volume}` : ""} · ${gr.publisher}${gr.year ? ` ${gr.year}` : ""} — Box ${c.Box}`;
      const meta = [
        `   Copy ${ci+1} of ${gr.copies.length}`,
        c.Writer ? `W: ${c.Writer}` : "",
        c.Artist ? `A: ${c.Artist}` : "",
        c.Condition ? `Cond: ${c.Condition}` : "",
      ].filter(Boolean).join(" · ");
      return [base, meta, ``];
    };
    if (notDupCopies.length > 0) {
      lines.push(`── NOT DUPLICATE (${notDupCopies.length}) ── confirmed intentional, leave as-is:`, ``);
      notDupCopies.forEach((m, i) => lines.push(...fmtCopy(m, i)));
    }
    if (plannedCopies.length > 0) {
      lines.push(`── PLANNED TO ADDRESS (${plannedCopies.length}) ── will sell / remove / resolve:`, ``);
      plannedCopies.forEach((m, i) => lines.push(...fmtCopy(m, i)));
    }
    lines.push(`---`, `Total marked: ${totalMarked} copies`);
    return lines.join("\n");
  }, [notDupCopies, plannedCopies, totalMarked]);

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
          { val: RAW_GROUPS.length.toLocaleString(),       lbl: "Duplicate Groups",  sub: "same title+issue+pub+year+vol", color: "#dc2626" },
          { val: TOTAL_DUP_BOOKS.toLocaleString(),       lbl: "Total Copies",      sub: "books across all groups",       color: "#d97706" },
          { val: SAME_BOX_COUNT.toLocaleString(),        lbl: "Same-Box Dupes",    sub: "data entry errors — same box",  color: "#dc2626" },
          { val: BOUGHT_TWICE_COUNT.toLocaleString(),    lbl: "Bought Twice",      sub: "same book in different boxes",  color: "#d97706" },
        ].map((s, i) => (
          <div key={i} style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderTop: `3px solid ${s.color}`, borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.8rem", color: s.color, letterSpacing: "2px", lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", letterSpacing: "2px", color: "var(--muted2)", marginTop: 4 }}>{s.lbl}</div>
            <div style={{ fontSize: "0.65rem", color: "var(--muted)", marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── LEGEND ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
        {([
          ["same-box",     "#dc2626", "SAME BOX",      "Two+ copies of the exact same book recorded in the same box — likely a data entry error"],
          ["bought-twice", "#d97706", "BOUGHT TWICE",  "Exact same book (same title + issue + publisher + year + volume) in different boxes — purchased twice"],
        ] as const).map(([, color, label, desc]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.7rem", color: "var(--muted2)" }}>
            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.6rem", letterSpacing: "1.5px", color, background: color + "18", border: `1px solid ${color}40`, padding: "2px 7px", borderRadius: 3 }}>{label}</span>
            <span>{desc}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: "0.7rem", color: "var(--muted)", marginBottom: 18, fontFamily: "'Crimson Pro',serif" }}>
        Groups are now exact-match only — same title, issue, publisher, year <em>and</em> volume. Different volumes or years of the same title are shown separately.
      </p>

      {/* ── VIEW TOGGLE ── */}
      <div style={{ display:"flex", gap:6, marginBottom:14 }}>
        {([["standard","≡ Standard"],["resolve","✓ Resolve Mode"]] as const).map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={{
            fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", letterSpacing:"1.5px",
            padding:"6px 16px", border:`1.5px solid ${view===v?"var(--red)":"var(--border)"}`,
            background:view===v?"var(--red)":"var(--surface)",
            color:view===v?"#fff":"var(--muted2)",
            borderRadius:4, cursor:"pointer",
          }}>{label}</button>
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
          <option value="same-box">Same Box (Data Error)</option>
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

      {/* ── RESOLVE MODE ── */}
      {view === "resolve" && (
        <div style={{ marginBottom:20 }}>
          {/* Progress */}
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16, background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:8, padding:"12px 16px" }}>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"2px", color:"var(--muted)" }}>RESOLVE PROGRESS</span>
                <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"1px", color:"#16a34a" }}>
                  {filtered.filter(g => resolved.has(g.key)).length} / {filtered.length} REVIEWED
                </span>
              </div>
              <div style={{ height:6, background:"var(--surface2)", borderRadius:3, overflow:"hidden" }}>
                <div style={{ height:"100%", background:"#16a34a", borderRadius:3, transition:"width 0.3s",
                  width:`${filtered.length ? (filtered.filter(g => resolved.has(g.key)).length / filtered.length) * 100 : 0}%` }} />
              </div>
            </div>
            {resolved.size > 0 && (
              <button onClick={() => setResolved(new Set())} style={{
                fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"1px",
                background:"none", border:"1px solid var(--border)", color:"var(--muted)",
                borderRadius:3, padding:"3px 10px", cursor:"pointer", flexShrink:0,
              }}>RESET</button>
            )}
          </div>

          {/* Flag group sections */}
          {([
            ["same-box",     "#dc2626", "SAME BOX",      "Two+ copies of the exact same book in the same physical box — likely a data entry error. Verify before actioning."],
            ["bought-twice", "#d97706", "BOUGHT TWICE",  "Exact same book (title + issue + pub + year + vol) in different boxes — possibly purchased twice. Decide: keep or sell."],
          ] as const).map(([flagType, color, label, desc]) => {
            const groupsInFlag = filtered.filter(g => g.flag === flagType);
            if (groupsInFlag.length === 0) return null;
            const doneCount = groupsInFlag.filter(g => resolved.has(g.key)).length;
            return (
              <div key={flagType} style={{ marginBottom:24 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10, borderBottom:`2px solid ${color}30`, paddingBottom:8 }}>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", letterSpacing:"2px", color }}>{label}</span>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"1px", color:"var(--muted)" }}>
                    {doneCount}/{groupsInFlag.length} REVIEWED
                  </span>
                  <div style={{ flex:1, height:3, background:"var(--surface2)", borderRadius:2, overflow:"hidden" }}>
                    <div style={{ height:"100%", background:color, width:`${(doneCount/groupsInFlag.length)*100}%`, transition:"width 0.3s" }} />
                  </div>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1.5px", color:"var(--muted2)", background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:3, padding:"1px 8px" }}>
                    {desc.slice(0,60)}…
                  </span>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                  {groupsInFlag.map(gr => {
                    const done = resolved.has(gr.key);
                    const boxes = [...new Set(gr.copies.map(c => c.Box))].filter(Boolean);
                    const hasKey    = gr.copies.some(c => (c.Key    || "").toUpperCase() === "YES");
                    const hasSigned = gr.copies.some(c => (c.Signed || "").toUpperCase() === "YES");
                    const pubs  = [...new Set(gr.copies.map(c => c.Publisher))].filter(Boolean);
                    const years = [...new Set(gr.copies.map(c => c.Year))].filter(Boolean).sort();
                    return (
                      <div key={gr.key} onClick={() => toggleResolved(gr.key)}
                        style={{
                          display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
                          background: done ? "#f0faf4" : "var(--surface)",
                          border:`1.5px solid ${done ? "#16a34a" : color+"40"}`,
                          borderLeft:`4px solid ${done ? "#16a34a" : color}`,
                          borderRadius:6, cursor:"pointer", transition:"all 0.15s",
                          opacity: done ? 0.6 : 1,
                        }}>
                        {/* Checkbox */}
                        <div style={{
                          width:22, height:22, borderRadius:4, flexShrink:0,
                          border:`2px solid ${done ? "#16a34a" : color}`,
                          background: done ? "#16a34a" : "transparent",
                          display:"flex", alignItems:"center", justifyContent:"center",
                        }}>
                          {done && <span style={{ color:"#fff", fontSize:"0.72rem" }}>✓</span>}
                        </div>
                        {/* Copy count */}
                        <div style={{ flexShrink:0, textAlign:"center", minWidth:36 }}>
                          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.4rem", color: done ? "var(--muted)" : countColor(gr.copies.length), lineHeight:1 }}>
                            {gr.copies.length}
                          </div>
                          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.48rem", letterSpacing:"1.5px", color:"var(--muted)" }}>COPIES</div>
                        </div>
                        {/* Title + meta */}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.95rem", letterSpacing:"0.5px",
                            color: done ? "var(--muted)" : "var(--text)",
                            textDecoration: done ? "line-through" : "none", lineHeight:1.2 }}>
                            {gr.title}
                            <span style={{ color:"var(--red)", marginLeft:6, fontSize:"0.85rem" }}>{gr.issue}</span>
                          </div>
                          <div style={{ fontSize:"0.7rem", color:"var(--muted2)", marginTop:2 }}>
                            {pubs.join(" · ")}{years.length ? ` — ${years.join(", ")}` : ""}
                          </div>
                        </div>
                        {/* Boxes + badges */}
                        <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end", flexShrink:0 }}>
                          <div style={{ display:"flex", gap:3, flexWrap:"wrap", justifyContent:"flex-end" }}>
                            {boxes.slice(0,5).map(b => (
                              <span key={b} style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.55rem", letterSpacing:"1px",
                                color:"var(--muted2)", background:"var(--surface2)", border:"1px solid var(--border)",
                                padding:"1px 5px", borderRadius:3 }}>B{b}</span>
                            ))}
                            {boxes.length > 5 && <span style={{ fontSize:"0.55rem", color:"var(--muted)" }}>+{boxes.length-5}</span>}
                          </div>
                          <div style={{ display:"flex", gap:3 }}>
                            {hasKey    && <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.55rem", letterSpacing:"1px", background:"#fff8e0", color:"#8a6000", border:"1px solid #d4a800", borderRadius:3, padding:"1px 5px" }}>★ KEY</span>}
                            {hasSigned && <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.55rem", letterSpacing:"1px", background:"#f0faf0", color:"#16a34a", border:"1px solid #c8e6c8", borderRadius:3, padding:"1px 5px" }}>✍ SGD</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── GROUP LIST (standard view) ── */}
      {view === "standard" && (<>
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
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", cursor: "pointer" }}
              >
                {/* Copy count badge */}
                <div style={{ flexShrink: 0, fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.3rem", color: cc, lineHeight: 1, minWidth: 28, textAlign: "center" }}>
                  {gr.copies.length}
                  <div style={{ fontSize: "0.42rem", letterSpacing: "1.5px", color: "var(--muted)" }}>COPIES</div>
                </div>

                {/* Title — userSelect:text so titles can be copied */}
                <div style={{ flex: 1, minWidth: 0, userSelect: "text" }}>
                  <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.95rem", letterSpacing: "1px", color: "var(--text)" }}>
                    {gr.title}
                  </span>
                  <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.85rem", color: "var(--red)", marginLeft: 6 }}>
                    {gr.issue}
                  </span>
                  {gr.volume && (
                    <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", letterSpacing: "1px", color: "var(--muted2)", marginLeft: 8, background: "var(--surface2)", border: "1px solid var(--border)", padding: "1px 6px", borderRadius: 3 }}>
                      VOL {gr.volume}
                    </span>
                  )}
                  {/* Publisher / year / creators summary */}
                  <div style={{ fontSize: "0.67rem", color: "var(--muted)", marginTop: 3, display: "flex", flexWrap: "wrap", gap: "4px 10px" }}>
                    <span>{gr.publisher}{gr.year ? ` · ${gr.year}` : ""}</span>
                    {(() => {
                      const writers = [...new Set(gr.copies.map(c => c.Writer).filter(Boolean))];
                      const artists = [...new Set(gr.copies.map(c => c.Artist).filter(Boolean))];
                      return <>
                        {writers.length > 0 && <span style={{ color: "var(--muted)" }}>W: {writers.slice(0,2).join(", ")}{writers.length > 2 ? "…" : ""}</span>}
                        {artists.length > 0 && <span style={{ color: "var(--muted)" }}>A: {artists.slice(0,2).join(", ")}{artists.length > 2 ? "…" : ""}</span>}
                      </>;
                    })()}
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
                        {["Not Dup", "Planned", "#", "Box", "Vol", "Writer", "Artist", "Condition", "Key", "Signed", "NM Value", "VF Value"].map(h => (
                          <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.6rem", letterSpacing: "2px", color: "var(--muted)", fontWeight: 600, whiteSpace: "nowrap", borderBottom: "1px solid var(--border)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gr.copies.map((c, ci) => {
                        const isKey    = (c.Key    || "").toUpperCase() === "YES";
                        const isSigned = (c.Signed || "").toUpperCase() === "YES";
                        const boxDup = gr.copies.filter(x => x.Box === c.Box).length > 1;
                        return (
                          <tr key={ci} style={{ background: notDup.has(ck(gr.key,ci)) ? "#f0faf4" : planned.has(ck(gr.key,ci)) ? "#fefce8" : boxDup ? "#fff8f8" : ci % 2 === 0 ? "var(--surface)" : "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                            {/* Not Dup checkbox */}
                            <td style={{ padding: "6px 10px", textAlign: "center" }}>
                              <button
                                onClick={() => toggle(setNotDup, ck(gr.key, ci))}
                                title="Mark this copy as Not a Duplicate"
                                style={{
                                  width: 20, height: 20, borderRadius: 3, border: `2px solid ${notDup.has(ck(gr.key,ci)) ? "#16a34a" : "var(--border)"}`,
                                  background: notDup.has(ck(gr.key,ci)) ? "#16a34a" : "var(--surface2)",
                                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0,
                                }}>
                                {notDup.has(ck(gr.key,ci)) && <span style={{ color:"#fff", fontSize:"0.6rem", lineHeight:1 }}>✓</span>}
                              </button>
                            </td>
                            {/* Planned checkbox */}
                            <td style={{ padding: "6px 10px", textAlign: "center" }}>
                              <button
                                onClick={() => toggle(setPlanned, ck(gr.key, ci))}
                                title="Mark this copy as Planned to address"
                                style={{
                                  width: 20, height: 20, borderRadius: 3, border: `2px solid ${planned.has(ck(gr.key,ci)) ? "#d97706" : "var(--border)"}`,
                                  background: planned.has(ck(gr.key,ci)) ? "#d97706" : "var(--surface2)",
                                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0,
                                }}>
                                {planned.has(ck(gr.key,ci)) && <span style={{ color:"#fff", fontSize:"0.6rem", lineHeight:1 }}>✓</span>}
                              </button>
                            </td>
                            <td style={{ padding: "7px 12px", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", color: "var(--muted)" }}>#{ci + 1}</td>
                            <td style={{ padding: "7px 12px", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.78rem", color: "var(--red)" }}>
                              Box {c.Box}
                              {boxDup && <span style={{ marginLeft: 4, fontSize: "0.5rem", color: "#dc2626", letterSpacing: "1px" }}>⚠</span>}
                            </td>
                            <td style={{ padding: "7px 12px", color: "var(--muted2)", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.72rem" }}>{c.Volume ? `V${c.Volume}` : "—"}</td>
                            <td style={{ padding: "7px 10px", color: "var(--text2)", maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={c.Writer || ""}>{c.Writer || "—"}</td>
                            <td style={{ padding: "7px 10px", color: "var(--text2)", maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={c.Artist || ""}>{c.Artist || "—"}</td>
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
                    {gr.flag === "same-box"    && "⚠ One or more copies share a box — verify these are physical duplicates before deciding to sell or flag."}
                    {gr.flag === "bought-twice" && "↗ Exact same book (publisher, year, volume all match) found in different boxes — likely purchased twice. Check if intentional."}
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
      </>)}

      {/* ── OUTPUT PANEL ── */}
      {totalMarked > 0 && (
        <div style={{ marginTop: 32, borderTop: "2px solid #16a34a40", paddingTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.2rem", letterSpacing: "3px", color: "#16a34a", margin: 0 }}>
              DUPLICATE REVIEW OUTPUT
            </h2>
            {notDupCopies.length > 0 && (
              <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", letterSpacing: "1.5px", background: "#16a34a18", color: "#16a34a", border: "1px solid #16a34a40", borderRadius: 3, padding: "2px 8px" }}>
                {notDupCopies.length} NOT DUP
              </span>
            )}
            {plannedCopies.length > 0 && (
              <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", letterSpacing: "1.5px", background: "#d9770618", color: "#d97706", border: "1px solid #d9770640", borderRadius: 3, padding: "2px 8px" }}>
                {plannedCopies.length} PLANNED
              </span>
            )}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowOutput(v => !v)}
                style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.72rem", letterSpacing: "1.5px", padding: "7px 18px", border: "1.5px solid #16a34a", background: showOutput ? "#16a34a" : "none", color: showOutput ? "#fff" : "#16a34a", borderRadius: 4, cursor: "pointer" }}
              >
                {showOutput ? "HIDE OUTPUT" : "GENERATE OUTPUT"}
              </button>
              <button
                onClick={() => { setNotDup(new Set()); setPlanned(new Set()); }}
                style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", letterSpacing: "1px", padding: "7px 14px", border: "1px solid var(--border)", background: "none", color: "var(--muted)", borderRadius: 4, cursor: "pointer" }}
              >
                CLEAR ALL
              </button>
            </div>
          </div>

          {/* Marked copies summary list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: showOutput ? 16 : 0 }}>
            {[
              ...notDupCopies.map(m => ({ ...m, type: "not-dup" as const })),
              ...plannedCopies.map(m => ({ ...m, type: "planned" as const })),
            ].map((m, i) => (
              <div key={`${m.type}-${m.gr.key}-${m.ci}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", background: m.type === "not-dup" ? "#f0faf4" : "#fefce8", border: `1px solid ${m.type === "not-dup" ? "#c6e8d0" : "#fcd34d"}`, borderRadius: 5, fontSize: "0.78rem" }}>
                <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.62rem", color: "var(--muted)", minWidth: 20 }}>{i + 1}.</span>
                <span style={{ fontFamily: "'Bebas Neue',sans-serif", color: "var(--text)", fontSize: "0.85rem" }}>{m.gr.title}</span>
                <span style={{ color: "var(--red)", fontFamily: "'Bebas Neue',sans-serif" }}>{m.gr.issue}</span>
                <span style={{ color: "var(--muted2)", fontSize: "0.72rem" }}>Box {m.c.Box} · Copy {m.ci+1}</span>
                <span style={{ marginLeft: "auto", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.55rem", letterSpacing: "1px",
                  color: m.type === "not-dup" ? "#16a34a" : "#d97706",
                  background: m.type === "not-dup" ? "#16a34a18" : "#d9770618",
                  border: `1px solid ${m.type === "not-dup" ? "#16a34a40" : "#d9770640"}`,
                  borderRadius: 3, padding: "1px 6px" }}>
                  {m.type === "not-dup" ? "NOT DUP" : "PLANNED"}
                </span>
                <button
                  onClick={() => m.type === "not-dup" ? toggle(setNotDup, ck(m.gr.key, m.ci)) : toggle(setPlanned, ck(m.gr.key, m.ci))}
                  style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "0.9rem", padding: "0 4px", lineHeight: 1 }}
                  title="Remove"
                >×</button>
              </div>
            ))}
          </div>

          {showOutput && (
            <div style={{ position: "relative" }}>
              <textarea
                ref={outputRef}
                readOnly
                value={outputText}
                style={{
                  width: "100%", minHeight: 320, padding: "14px 16px",
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
                  borderRadius: 4, cursor: "pointer", transition: "all 0.2s",
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
