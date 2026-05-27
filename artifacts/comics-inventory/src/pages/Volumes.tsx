import { useState, useMemo } from "react";
import { DATA3 } from "@/data/data3";

const comics = DATA3.comics;
type Comic = (typeof comics)[number];

function parseIssueNum(s: string): number | null {
  const raw = String(s || "").trim().replace(/^#/, "");
  if (/annual|special|giant|tpb|vol\b|omnibus/i.test(raw)) return null;
  const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
  if (isNaN(n) || n <= 0 || n > 9999) return null;
  return n;
}

function pubGroup(publisher: string): "Marvel" | "DC" | "Other" {
  const u = (publisher || "").toUpperCase();
  if (u === "MARVEL" || u.includes("MARVEL")) return "Marvel";
  if (u === "DC" || u.includes("DC COMICS")) return "DC";
  return "Other";
}

interface Volume {
  volNum: number;
  issues: Comic[];
  startYear: string;
  endYear: string;
  writer: string;
  artist: string;
  keyCount: number;
  signedCount: number;
}

interface TitleEntry {
  title: string;
  publisher: string;
  pubGroup: "Marvel" | "DC" | "Other";
  volumes: Volume[];
  totalIssues: number;
  totalKeys: number;
  totalSigned: number;
}

function splitVolumes(issues: Comic[]): Volume[] {
  const sorted = [...issues].sort((a, b) => {
    const ya = Number(a.Year || 0);
    const yb = Number(b.Year || 0);
    if (ya !== yb) return ya - yb;
    const na = parseIssueNum(a.Issue) ?? 9999;
    const nb = parseIssueNum(b.Issue) ?? 9999;
    return na - nb;
  });

  const groups: Comic[][] = [];
  let cur: Comic[] = [];
  let prevNum: number | null = null;

  for (const c of sorted) {
    const n = parseIssueNum(c.Issue);
    if (n !== null && prevNum !== null && prevNum > 15 && n <= 5) {
      if (cur.length > 0) { groups.push(cur); cur = []; }
    }
    cur.push(c);
    if (n !== null) prevNum = n;
  }
  if (cur.length > 0) groups.push(cur);

  return groups.map((g, i) => {
    const years = g.map(c => Number(c.Year || 0)).filter(y => y > 1900);
    const startYear = years.length ? String(Math.min(...years)) : "?";
    const endYear   = years.length ? String(Math.max(...years)) : "?";
    const first = g[0];
    return {
      volNum: i + 1,
      issues: g,
      startYear,
      endYear,
      writer: (first?.Writer && first.Writer !== "nan") ? first.Writer : "—",
      artist: (first?.Artist && first.Artist !== "nan") ? first.Artist : "—",
      keyCount:    g.filter(c => (c.Key    || "").toUpperCase() === "YES").length,
      signedCount: g.filter(c => (c.Signed || "").toUpperCase() === "YES").length,
    };
  });
}

const PUB_GROUPS: { key: "Marvel" | "DC" | "Other"; label: string; color: string; bg: string; border: string }[] = [
  { key: "Marvel", label: "Marvel",      color: "#c8102e", bg: "#fff8f8", border: "#fecaca" },
  { key: "DC",     label: "DC",          color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  { key: "Other",  label: "Independent", color: "#16a34a", bg: "#f3faf4", border: "#bbf7d0" },
];

export default function Volumes() {
  const [search,      setSearch]      = useState("");
  const [pubFilter,   setPubFilter]   = useState<"" | "Marvel" | "DC" | "Other">("");
  const [sortBy,      setSortBy]      = useState<"title" | "vols" | "issues">("title");
  const [multiOnly,   setMultiOnly]   = useState(false);
  const [openPubs,    setOpenPubs]    = useState<Set<string>>(new Set(["Marvel","DC","Other"]));
  const [openTitles,  setOpenTitles]  = useState<Set<string>>(new Set());

  const allTitles = useMemo<TitleEntry[]>(() => {
    const byTitle: Record<string, Comic[]> = {};
    for (const c of comics) {
      const k = (c.Title || "").trim();
      if (!k) continue;
      if (!byTitle[k]) byTitle[k] = [];
      byTitle[k].push(c);
    }
    return Object.entries(byTitle).map(([title, issues]) => {
      const pub    = issues[0]?.Publisher || "";
      const pg     = pubGroup(pub);
      const vols   = splitVolumes(issues);
      return {
        title,
        publisher: pub,
        pubGroup: pg,
        volumes: vols,
        totalIssues:  issues.length,
        totalKeys:    issues.filter(c => (c.Key    || "").toUpperCase() === "YES").length,
        totalSigned:  issues.filter(c => (c.Signed || "").toUpperCase() === "YES").length,
      };
    });
  }, []);

  const filtered = useMemo(() => {
    let list = allTitles;
    if (pubFilter) list = list.filter(t => t.pubGroup === pubFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => t.title.toLowerCase().includes(q) || t.publisher.toLowerCase().includes(q));
    }
    if (multiOnly) list = list.filter(t => t.volumes.length > 1);
    if (sortBy === "title")  list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (sortBy === "vols")   list = [...list].sort((a, b) => b.volumes.length - a.volumes.length);
    if (sortBy === "issues") list = [...list].sort((a, b) => b.totalIssues - a.totalIssues);
    return list;
  }, [allTitles, pubFilter, search, sortBy, multiOnly]);

  const totalVols = filtered.reduce((s, t) => s + t.volumes.length, 0);
  const multiVol  = filtered.filter(t => t.volumes.length > 1).length;

  function togglePub(key: string) {
    setOpenPubs(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }
  function toggleTitle(key: string) {
    setOpenTitles(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }
  function expandAll()  { setOpenPubs(new Set(["Marvel","DC","Other"])); setOpenTitles(new Set(filtered.map(t => t.title))); }
  function collapseAll(){ setOpenPubs(new Set()); setOpenTitles(new Set()); }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "18px 18px 60px" }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.6rem", color:"var(--red)",
          letterSpacing:"3px", lineHeight:1, margin:0 }}>Volumes</h1>
        <p style={{ color:"var(--muted2)", fontSize:"0.88rem", marginTop:6 }}>
          Every title in the collection, broken into distinct volumes — grouped by publisher.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
        {([
          { val: filtered.length,                                                  lbl: "Titles",        clickable: false },
          { val: totalVols,                                                        lbl: "Volumes",       clickable: false },
          { val: allTitles.filter(t => t.volumes.length > 1).length,              lbl: "Multi-Volume",  clickable: true  },
          { val: filtered.reduce((s,t) => s + t.totalIssues, 0).toLocaleString(), lbl: "Issues",        clickable: false },
        ] as const).map(s => {
          const isActive = s.clickable && multiOnly;
          return (
            <div key={s.lbl}
              onClick={s.clickable ? () => setMultiOnly(v => !v) : undefined}
              style={{
                background: isActive ? "var(--red)" : "var(--surface)",
                border: isActive ? "1.5px solid var(--red)" : "1.5px solid var(--border)",
                borderRadius:6, padding:"10px 16px", textAlign:"center", flex:"1 1 100px",
                cursor: s.clickable ? "pointer" : "default",
                boxShadow: isActive ? "0 4px 14px rgba(200,16,46,0.22)" : "none",
                transform: isActive ? "translateY(-2px)" : "none",
                transition:"all 0.18s",
              }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.5rem",
                color: isActive ? "#fff" : "var(--red)", letterSpacing:"1px", lineHeight:1 }}>{s.val}</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"1.5px",
                color: isActive ? "rgba(255,255,255,0.8)" : "var(--muted)", marginTop:3 }}>{s.lbl}</div>
              {s.clickable && !isActive && (
                <div style={{ fontSize:"0.52rem", color:"var(--muted)", marginTop:3,
                  fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>CLICK TO FILTER</div>
              )}
              {isActive && (
                <div style={{ fontSize:"0.52rem", color:"rgba(255,255,255,0.65)", marginTop:3,
                  fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>CLICK TO CLEAR ▲</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:20,
        background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:6, padding:"12px 14px" }}>

        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search title or publisher…"
          style={{ background:"var(--bg)", border:"1.5px solid var(--border)", color:"var(--text)",
            padding:"6px 10px", borderRadius:5, fontFamily:"'Crimson Pro',serif", fontSize:"0.88rem",
            flex:"1 1 180px", minWidth:0 }}
        />

        <select value={pubFilter} onChange={e => setPubFilter(e.target.value as typeof pubFilter)}
          style={{ background:"var(--bg)", border:"1.5px solid var(--border)", color:"var(--text)",
            padding:"6px 10px", borderRadius:5, fontFamily:"'Crimson Pro',serif", fontSize:"0.88rem" }}>
          <option value="">All Publishers</option>
          <option value="Marvel">Marvel</option>
          <option value="DC">DC</option>
          <option value="Other">Independent</option>
        </select>

        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {([["title","A–Z"],["vols","Most Volumes"],["issues","Most Issues"]] as const).map(([v,l]) => (
            <button key={v} onClick={() => setSortBy(v)} style={{
              background: sortBy===v ? "var(--red)" : "var(--surface2)",
              color: sortBy===v ? "#fff" : "var(--muted2)",
              border: sortBy===v ? "1.5px solid var(--red)" : "1.5px solid var(--border)",
              borderRadius:5, padding:"5px 12px", cursor:"pointer",
              fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem", letterSpacing:"1.5px",
              transition:"all 0.15s",
            }}>{l}</button>
          ))}
        </div>

        <button onClick={() => setMultiOnly(v => !v)} style={{
          background: multiOnly ? "#1a1a2e" : "var(--surface2)",
          color: multiOnly ? "#a78bfa" : "var(--muted2)",
          border: multiOnly ? "1.5px solid #a78bfa" : "1.5px solid var(--border)",
          borderRadius:5, padding:"5px 14px", cursor:"pointer",
          fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem", letterSpacing:"1.5px",
          transition:"all 0.15s", whiteSpace:"nowrap",
        }}>
          {multiOnly ? "▦ MULTI-VOL ONLY ✓" : "▦ MULTI-VOL ONLY"}
        </button>

        <div style={{ marginLeft:"auto", display:"flex", gap:6, alignItems:"center" }}>
          <button onClick={expandAll}
            style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1px",
              background:"var(--surface2)", color:"var(--muted2)", border:"1.5px solid var(--border)",
              borderRadius:5, padding:"4px 10px", cursor:"pointer" }}>Expand All</button>
          <button onClick={collapseAll}
            style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1px",
              background:"var(--surface2)", color:"var(--muted2)", border:"1.5px solid var(--border)",
              borderRadius:5, padding:"4px 10px", cursor:"pointer" }}>Collapse All</button>
        </div>
      </div>

      {/* Results bar */}
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1.5px", fontSize:"0.82rem",
        color:"var(--muted2)", marginBottom:14 }}>
        <span style={{ color:"var(--red)", fontSize:"1.05rem" }}>{filtered.length.toLocaleString()}</span>
        {" "}titles · {totalVols.toLocaleString()} volumes
        {search && <span style={{ marginLeft:10, color:"var(--muted)" }}>— filtered by "{search}"</span>}
      </div>

      {/* Publisher sections */}
      {PUB_GROUPS
        .filter(pg => !pubFilter || pubFilter === pg.key)
        .map(pg => {
          const titles = filtered.filter(t => t.pubGroup === pg.key);
          if (titles.length === 0) return null;
          const pgVols = titles.reduce((s, t) => s + t.volumes.length, 0);
          const isOpen = openPubs.has(pg.key);

          return (
            <div key={pg.key} style={{ marginBottom: 24 }}>
              {/* Publisher header */}
              <button onClick={() => togglePub(pg.key)} style={{
                display:"flex", alignItems:"center", gap:12, width:"100%",
                background:"none", border:"none", cursor:"pointer",
                borderBottom:`2px solid ${pg.color}`, paddingBottom:8, marginBottom: isOpen ? 10 : 0,
                textAlign:"left",
              }}>
                <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem",
                  letterSpacing:"3px", color:pg.color }}>{pg.label}</span>
                <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem",
                  letterSpacing:"1.5px", color:"var(--muted)" }}>
                  {titles.length} TITLES · {pgVols} VOLUMES
                </span>
                <span style={{ marginLeft:"auto", color:pg.color, fontSize:"0.7rem",
                  fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>
                  {isOpen ? "▲ COLLAPSE" : "▼ EXPAND"}
                </span>
              </button>

              {isOpen && (
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  {titles.map(t => {
                    const tKey   = t.title;
                    const tOpen  = openTitles.has(tKey);
                    const multiV = t.volumes.length > 1;

                    return (
                      <div key={tKey} style={{
                        border:`1.5px solid ${tOpen ? pg.border : multiV ? pg.border : "var(--border)"}`,
                        borderLeft: multiV ? `4px solid ${pg.color}` : tOpen ? `3px solid ${pg.color}` : "1.5px solid var(--border)",
                        borderRadius:6,
                        background: tOpen ? pg.bg : multiV ? `${pg.bg}cc` : "#fff",
                        overflow:"hidden",
                        transition:"border-color 0.15s",
                        boxShadow: multiV && !tOpen ? `inset 0 0 0 0 transparent` : "none",
                      }}>
                        {/* Title row */}
                        <button onClick={() => toggleTitle(tKey)} style={{
                          display:"flex", alignItems:"center", gap:10, width:"100%",
                          background:"none", border:"none", cursor:"pointer",
                          padding:"10px 14px", textAlign:"left",
                        }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <span style={{
                              fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.92rem",
                              letterSpacing:"1.5px", color:"var(--text)",
                              display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                            }}>{t.title}</span>
                            <span style={{ fontSize:"0.72rem", color:"var(--muted2)",
                              fontFamily:"'Crimson Pro',serif" }}>
                              {t.publisher}
                            </span>
                          </div>

                          <div style={{ display:"flex", gap:10, alignItems:"center", flexShrink:0 }}>
                            {multiV && (
                              <span style={{
                                fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"1.5px",
                                background:pg.color, color:"#fff", borderRadius:3, padding:"2px 7px",
                              }}>{t.volumes.length} VOLS</span>
                            )}
                            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem",
                              letterSpacing:"1px", color:"var(--muted)", minWidth:52, textAlign:"right" }}>
                              {t.totalIssues} issues
                            </span>
                            {t.totalKeys > 0 && (
                              <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem",
                                letterSpacing:"1px", color:"#8a6000", background:"#fff8e0",
                                border:"1px solid #d4a800", borderRadius:3, padding:"1px 6px" }}>
                                {t.totalKeys}k
                              </span>
                            )}
                            {t.totalSigned > 0 && (
                              <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem",
                                letterSpacing:"1px", color:"#1a7a1a", background:"#f0faf0",
                                border:"1px solid #c8e6c8", borderRadius:3, padding:"1px 6px" }}>
                                {t.totalSigned}s
                              </span>
                            )}
                            <span style={{ color:"var(--muted)", fontSize:"0.7rem",
                              fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", marginLeft:4 }}>
                              {tOpen ? "▲" : "▼"}
                            </span>
                          </div>
                        </button>

                        {/* Volume rows */}
                        {tOpen && (
                          <div style={{ borderTop:"1px solid var(--border)" }}>
                            {t.volumes.map((v, vi) => (
                              <div key={vi} style={{
                                display:"flex", alignItems:"flex-start", gap:12, flexWrap:"wrap",
                                padding:"10px 14px 10px 20px",
                                borderBottom: vi < t.volumes.length - 1 ? "1px solid var(--border)" : "none",
                                background: vi % 2 === 0 ? "var(--surface2)" : "#fff",
                              }}>
                                {/* Volume label */}
                                <div style={{ flexShrink:0, minWidth:60 }}>
                                  <div style={{
                                    fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.78rem",
                                    letterSpacing:"2px", color: t.volumes.length > 1 ? pg.color : "var(--muted2)",
                                    lineHeight:1,
                                  }}>
                                    {t.volumes.length > 1 ? `Vol. ${v.volNum}` : "Series"}
                                  </div>
                                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem",
                                    letterSpacing:"1px", color:"var(--muted)", marginTop:2 }}>
                                    {v.startYear === v.endYear ? v.startYear : `${v.startYear}–${v.endYear}`}
                                  </div>
                                </div>

                                {/* Writer / Artist */}
                                <div style={{ flex:1, minWidth:180, display:"flex", gap:20, flexWrap:"wrap" }}>
                                  <div>
                                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.55rem",
                                      letterSpacing:"2px", color:"var(--muted)", marginBottom:1 }}>WRITER</div>
                                    <div style={{ fontFamily:"'Crimson Pro',serif", fontSize:"0.82rem",
                                      color:"var(--text2)", lineHeight:1.3 }}>{v.writer}</div>
                                  </div>
                                  <div>
                                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.55rem",
                                      letterSpacing:"2px", color:"var(--muted)", marginBottom:1 }}>ARTIST</div>
                                    <div style={{ fontFamily:"'Crimson Pro',serif", fontSize:"0.82rem",
                                      color:"var(--text2)", lineHeight:1.3 }}>{v.artist}</div>
                                  </div>
                                </div>

                                {/* Issue count + badges */}
                                <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
                                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem",
                                    letterSpacing:"1.5px", color:"var(--muted)", minWidth:52, textAlign:"right" }}>
                                    {v.issues.length} issues
                                  </span>
                                  {v.keyCount > 0 && (
                                    <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem",
                                      letterSpacing:"1px", color:"#8a6000", background:"#fff8e0",
                                      border:"1px solid #d4a800", borderRadius:3, padding:"1px 6px" }}>
                                      ★ {v.keyCount} key{v.keyCount > 1 ? "s" : ""}
                                    </span>
                                  )}
                                  {v.signedCount > 0 && (
                                    <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem",
                                      letterSpacing:"1px", color:"#1a7a1a", background:"#f0faf0",
                                      border:"1px solid #c8e6c8", borderRadius:3, padding:"1px 6px" }}>
                                      ✍ {v.signedCount} sgd
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

      {filtered.length === 0 && (
        <div style={{ textAlign:"center", padding:"60px 20px",
          fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.9rem", letterSpacing:"2px", color:"var(--muted)" }}>
          NO TITLES MATCH YOUR SEARCH
        </div>
      )}
    </div>
  );
}
