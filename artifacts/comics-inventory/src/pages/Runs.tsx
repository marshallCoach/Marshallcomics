import { useState, useMemo } from "react";
import { DATA3 } from "@/data/data3";

const comics = DATA3.comics;

function parseIssueNum(s: string): number | null {
  const raw = String(s || "").trim().replace(/^#/, "");
  if (/annual|special|giant|tpb|vol|omnibus/i.test(raw)) return null;
  const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
  if (isNaN(n) || n <= 0 || n > 999) return null;
  if (!Number.isInteger(n) && !raw.match(/^\d+$/)) return null;
  return Math.round(n);
}

interface RunEntry {
  key: string;       // unique: "Title|||Volume"
  title: string;
  volume: string;    // "1", "2", "3"...
  publisher: string;
  haveCount: number;
  rangeMin: number;
  rangeMax: number;
  rangeSize: number;
  pct: number;
  missing: number[];
  issues: typeof comics;
  keys: number;
  signed: number;
}

const PCT_BUCKETS = [
  { label: "100% — COMPLETE", min: 100, max: 100,   color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  { label: "90–99%",          min: 90,  max: 99.99,  color: "#1d6fa4", bg: "#eff6ff", border: "#bfdbfe" },
  { label: "80–89%",          min: 80,  max: 89.99,  color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  { label: "70–79%",          min: 70,  max: 79.99,  color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  { label: "60–69%",          min: 60,  max: 69.99,  color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
  { label: "50–59%",          min: 50,  max: 59.99,  color: "#c8102e", bg: "#fef2f2", border: "#fecaca" },
];

const PUB_GROUPS = [
  { key: "Marvel", label: "Marvel", color: "#c8102e", accent: "#fef2f2", border: "#fecaca" },
  { key: "DC",     label: "DC",     color: "#1d4ed8", accent: "#eff6ff", border: "#bfdbfe" },
  { key: "Other",  label: "Other",  color: "#6b7280", accent: "#f9fafb", border: "#e5e7eb" },
];

function pubGroup(publisher: string): string {
  const u = (publisher || "").toUpperCase();
  if (u === "MARVEL" || u.includes("MARVEL")) return "Marvel";
  if (u === "DC" || u.includes("DC COMICS")) return "DC";
  return "Other";
}

export default function Runs() {
  const [threshold,     setThreshold]     = useState(75);
  const [sortBy,        setSortBy]        = useState<"pct"|"count"|"missing"|"title">("pct");
  const [pubFilter,     setPubFilter]     = useState("");
  const [view,          setView]          = useState<"grouped"|"card">("grouped");
  const [selectedRun,   setSelectedRun]   = useState<RunEntry | null>(null);
  const [openPublishers,setOpenPublishers]= useState<Set<string>>(new Set(["Marvel","DC","Other"]));
  const [openBuckets,   setOpenBuckets]   = useState<Set<string>>(() => {
    const all: string[] = [];
    ["Marvel","DC","Other"].forEach(p => PCT_BUCKETS.forEach(b => all.push(`${p}::${b.label}`)));
    return new Set(all);
  });
  const [drillKey,      setDrillKey]      = useState<"filtered"|"complete"|"near"|"all"|null>(null);
  const [drillView,     setDrillView]     = useState<"list"|"card">("list");
  const [hideSingle,    setHideSingle]    = useState(false);
  const [hideComplete,  setHideComplete]  = useState(false);

  const togglePublisher = (key: string) =>
    setOpenPublishers(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const toggleBucket = (key: string) =>
    setOpenBuckets(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const allRuns = useMemo<RunEntry[]>(() => {
    const byKey: Record<string, typeof comics> = {};
    for (const c of comics) {
      const k = `${c.Title.trim()}|||${c.Volume || "1"}`;
      if (!byKey[k]) byKey[k] = [];
      byKey[k].push(c);
    }

    const result: RunEntry[] = [];

    for (const [entryKey, issues] of Object.entries(byKey)) {
      const sepIdx = entryKey.lastIndexOf("|||");
      const title  = entryKey.slice(0, sepIdx);
      const volume = entryKey.slice(sepIdx + 3) || "1";
      const numbered = issues
        .map(c => ({ comic: c, num: parseIssueNum(c.Issue) }))
        .filter(x => x.num !== null) as { comic: typeof comics[number]; num: number }[];

      if (numbered.length < 3) continue;

      const nums   = numbered.map(x => x.num);
      const minIss = Math.min(...nums);
      const maxIss = Math.max(...nums);
      const range  = maxIss - minIss + 1;

      if (range < 4) continue;

      const haveSet = new Set(nums);
      const pct     = (haveSet.size / range) * 100;

      const missing: number[] = [];
      for (let i = minIss; i <= maxIss; i++) {
        if (!haveSet.has(i)) missing.push(i);
      }

      const pub    = issues[0].Publisher || "";
      const sorted = [...numbered].sort((a, b) => a.num - b.num).map(x => x.comic);
      const keys   = issues.filter(c => (c.Key||"").toUpperCase()==="YES").length;
      const sgn    = issues.filter(c => (c.Signed||"").toUpperCase()==="YES").length;

      result.push({ key: entryKey, title, volume, publisher: pub, haveCount: haveSet.size, rangeMin: minIss, rangeMax: maxIss, rangeSize: range, pct, missing, issues: sorted, keys, signed: sgn });
    }

    return result;
  }, []);

  const filtered = useMemo(() => {
    let runs = allRuns.filter(r => r.pct >= threshold);
    if (pubFilter)    runs = runs.filter(r => r.publisher.toLowerCase().includes(pubFilter.toLowerCase()));
    if (hideSingle)   runs = runs.filter(r => r.haveCount > 1);
    if (hideComplete) runs = runs.filter(r => r.missing.length > 0);
    if (sortBy === "pct")     runs.sort((a, b) => b.pct - a.pct);
    if (sortBy === "count")   runs.sort((a, b) => b.haveCount - a.haveCount);
    if (sortBy === "missing") runs.sort((a, b) => a.missing.length - b.missing.length);
    if (sortBy === "title")   runs.sort((a, b) => a.title.localeCompare(b.title));
    return runs;
  }, [allRuns, threshold, sortBy, pubFilter, hideSingle, hideComplete]);

  // Group into Publisher → Bucket → Runs
  const grouped = useMemo(() =>
    PUB_GROUPS.map(pg => {
      const pubRuns = filtered.filter(r => pubGroup(r.publisher) === pg.key);
      const buckets = PCT_BUCKETS
        .map(b => ({ ...b, runs: pubRuns.filter(r => r.pct >= b.min && r.pct <= b.max) }))
        .filter(b => b.runs.length > 0);
      return { ...pg, runs: pubRuns, buckets };
    }).filter(pg => pg.runs.length > 0),
  [filtered]);

  const perfect     = filtered.filter(r => r.missing.length === 0).length;
  const nearPerfect = filtered.filter(r => r.pct >= 95 && r.missing.length > 0).length;

  const drillRuns = useMemo(() => {
    if (drillKey === "filtered") return filtered;
    if (drillKey === "complete") return filtered.filter(r => r.missing.length === 0);
    if (drillKey === "near")     return filtered.filter(r => r.pct >= 95 && r.missing.length > 0);
    if (drillKey === "all")      return [...allRuns].sort((a, b) => b.pct - a.pct);
    return [];
  }, [drillKey, filtered, allRuns]);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "18px 18px 60px" }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.6rem", color:"var(--red)",
          letterSpacing:"3px", lineHeight:1, margin:0 }}>Run Completion</h1>
        <p style={{ color:"var(--muted2)", fontSize:"0.88rem", marginTop:6 }}>
          Titles where you own {threshold}%+ of a consecutive run — grouped by publisher.
        </p>
      </div>

      {/* Stats — clickable drill-down tiles */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
        {([
          { dk: "filtered" as const, val: filtered.length, lbl: `Runs ≥ ${threshold}%` },
          { dk: "complete" as const, val: perfect,          lbl: "Complete Runs" },
          { dk: "near"     as const, val: nearPerfect,      lbl: "≥ 95% Complete" },
          { dk: "all"      as const, val: allRuns.length,   lbl: "Total Title Groups" },
        ]).map(s => {
          const isActive = drillKey === s.dk;
          return (
            <div key={s.lbl}
              onClick={() => { setDrillKey(isActive ? null : s.dk); setSelectedRun(null); }}
              style={{
                background: isActive ? "var(--red)" : "var(--surface)",
                border: isActive ? "1.5px solid var(--red)" : "1.5px solid var(--border)",
                borderRadius:6, padding:"10px 16px", textAlign:"center", flex:"1 1 110px",
                cursor:"pointer", transition:"all 0.18s",
                boxShadow: isActive ? "0 4px 14px rgba(200,16,46,0.22)" : "none",
                transform: isActive ? "translateY(-2px)" : "none",
              }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.5rem",
                color: isActive ? "#fff" : "var(--red)",
                letterSpacing:"1px", lineHeight:1 }}>{s.val}</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"1.5px",
                color: isActive ? "rgba(255,255,255,0.8)" : "var(--muted)", marginTop:3 }}>{s.lbl}</div>
              {isActive && (
                <div style={{ fontSize:"0.55rem", color:"rgba(255,255,255,0.65)", marginTop:4,
                  fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>CLICK TO CLOSE ▲</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:20,
        background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:6, padding:"12px 14px" }}>

        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <label style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.7rem",
            letterSpacing:"1.5px", color:"var(--muted2)", whiteSpace:"nowrap" }}>
            MIN COMPLETE
          </label>
          <input type="range" min={50} max={100} step={5} value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            style={{ width:90, accentColor:"var(--red)" }} />
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.9rem", color:"var(--red)",
            letterSpacing:"1px", minWidth:36 }}>{threshold}%</span>
        </div>

        <select value={pubFilter} onChange={e => setPubFilter(e.target.value)}
          style={{ background:"var(--bg)", border:"1.5px solid var(--border)", color:"var(--text)",
            padding:"6px 10px", borderRadius:5, fontFamily:"'Crimson Pro',serif", fontSize:"0.88rem" }}>
          <option value="">All Publishers</option>
          <option value="Marvel">Marvel</option>
          <option value="DC">DC</option>
          <option value="Other">Other</option>
        </select>

        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {([["pct","% Complete"],["count","# Issues"],["missing","Fewest Missing"],["title","A–Z"]] as const).map(([v,l]) => (
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

        {/* Visibility toggles */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
          {([
            { val: hideSingle,   set: setHideSingle,   label: "HIDE 1-ISSUE" },
            { val: hideComplete, set: setHideComplete,  label: "HIDE 100%" },
          ] as const).map(({ val, set, label }) => (
            <button key={label} onClick={() => set(v => !v)} style={{
              fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1.5px",
              padding:"4px 11px", cursor:"pointer", borderRadius:5, transition:"all 0.15s",
              background: val ? "#1e293b" : "var(--surface2)",
              color:       val ? "#f8fafc"  : "var(--muted2)",
              border:      val ? "1.5px solid #334155" : "1.5px solid var(--border)",
            }}>
              {val ? `✓ ${label}` : label}
            </button>
          ))}
        </div>

        {/* Collapse/expand all */}
        <div style={{ marginLeft:"auto", display:"flex", gap:6, alignItems:"center" }}>
          <button
            onClick={() => setOpenPublishers(new Set(PUB_GROUPS.map(p=>p.key)))}
            style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1px",
              background:"var(--surface2)", color:"var(--muted2)", border:"1.5px solid var(--border)",
              borderRadius:5, padding:"4px 10px", cursor:"pointer" }}>
            Expand All
          </button>
          <button
            onClick={() => { setOpenPublishers(new Set()); setOpenBuckets(new Set()); }}
            style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1px",
              background:"var(--surface2)", color:"var(--muted2)", border:"1.5px solid var(--border)",
              borderRadius:5, padding:"4px 10px", cursor:"pointer" }}>
            Collapse All
          </button>
        </div>
      </div>

      {/* Results bar */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
        marginBottom:14, flexWrap:"wrap", gap:8 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1.5px", fontSize:"0.82rem", color:"var(--muted2)" }}>
          {filtered.length === 0
            ? "No runs found — try lowering the threshold"
            : <><span style={{ color:"var(--red)", fontSize:"1.05rem" }}>{filtered.length.toLocaleString()}</span> {filtered.length===1?"run":"runs"} — {allRuns.length.toLocaleString()} total groups</>
          }
        </div>
        {!drillKey && (
          <div style={{ display:"flex", gap:6 }}>
            {(["grouped","card"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{
                  fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", letterSpacing:"1.5px",
                  padding:"5px 14px", border:`1.5px solid ${view===v?"var(--red)":"var(--border)"}`,
                  background:view===v?"var(--red)":"var(--surface)", color:view===v?"#fff":"var(--muted2)",
                  borderRadius:4, cursor:"pointer", transition:"all 0.15s",
                }}>
                {v==="grouped"?"≡ Grouped":"⊞ Cards"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Drill-down results ─────────────────────────────────────────────── */}
      {drillKey && (
        <div style={{ marginBottom:28 }}>
          {/* Drill header */}
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, flexWrap:"wrap" }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem",
              letterSpacing:"2px", color:"var(--red)" }}>
              {{ filtered:`Runs ≥ ${threshold}%`, complete:"Complete Runs", near:"≥ 95% Complete", all:"All Title Groups" }[drillKey]}
            </div>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem", color:"var(--muted)",
              background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:10, padding:"2px 10px" }}>
              {drillRuns.length} runs
            </span>
            <div style={{ marginLeft:"auto", display:"flex", gap:5 }}>
              {(["list","card"] as const).map(v => (
                <button key={v} onClick={() => setDrillView(v)} style={{
                  fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem", letterSpacing:"1.5px",
                  padding:"4px 12px", border:`1.5px solid ${drillView===v?"var(--red)":"var(--border)"}`,
                  background:drillView===v?"var(--red)":"var(--surface)",
                  color:drillView===v?"#fff":"var(--muted2)",
                  borderRadius:4, cursor:"pointer", transition:"all 0.15s",
                }}>{v==="list"?"≡ List":"⊞ Cards"}</button>
              ))}
            </div>
          </div>

          {/* ── Card view ── */}
          {drillView === "card" && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
              {drillRuns.map((run, i) => {
                const pg = PUB_GROUPS.find(p => p.key === pubGroup(run.publisher)) ?? PUB_GROUPS[2];
                const pctFill = Math.min(run.pct, 100);
                const isSelected = selectedRun?.key === run.key;
                return (
                  <div key={i}
                    onClick={() => setSelectedRun(isSelected ? null : run)}
                    className="flagship-card"
                    style={{
                      flex: isSelected ? "1 1 100%" : "1 1 260px",
                      borderLeftColor: pg.color,
                      borderColor: isSelected ? pg.color : pg.color+"33",
                      boxShadow: isSelected ? `0 4px 16px ${pg.color}20` : "none",
                    }}>
                    <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.9rem",
                        letterSpacing:"1px", color:pg.color, flex:1, lineHeight:1.2 }}>
                        {run.title}
                        {run.volume !== "1" && <span style={{ fontSize:"0.6rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", background:"rgba(0,0,0,0.08)", borderRadius:3, padding:"1px 5px", marginLeft:5 }}>Vol {run.volume}</span>}
                      </div>
                      <div style={{ fontSize:"0.68rem", color:"var(--muted)", flexShrink:0 }}>{isSelected?"▲":"▼"}</div>
                    </div>
                    <div style={{ display:"flex", gap:5, marginTop:5, flexWrap:"wrap" }}>
                      <span style={{ fontSize:"0.58rem", fontFamily:"'Bebas Neue',sans-serif",
                        letterSpacing:"1px", background:pg.accent, color:pg.color,
                        border:`1px solid ${pg.border}`, borderRadius:3, padding:"1px 6px" }}>{pg.label}</span>
                      {run.keys > 0 && (
                        <span style={{ fontSize:"0.58rem", fontFamily:"'Bebas Neue',sans-serif",
                          letterSpacing:"1px", background:"#fff8e0", color:"#8a6000",
                          border:"1px solid #fde68a", borderRadius:3, padding:"1px 6px" }}>
                          {run.keys} KEY{run.keys>1?"S":""}
                        </span>
                      )}
                    </div>
                    <div style={{ height:5, background:"var(--border)", borderRadius:3, margin:"8px 0 4px" }}>
                      <div style={{ width:`${pctFill}%`, height:"100%", background:pg.color, borderRadius:3, transition:"width 0.4s" }} />
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                      <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem",
                        color:pg.color, letterSpacing:"1px", lineHeight:1 }}>
                        {run.pct >= 100 ? "COMPLETE" : `${run.pct.toFixed(0)}%`}
                      </span>
                      <span style={{ fontSize:"0.68rem", color:"var(--muted)" }}>
                        {run.haveCount}/{run.rangeSize}
                        {run.missing.length > 0 && <span style={{ color:"var(--red)", marginLeft:4 }}>{run.missing.length} missing</span>}
                      </span>
                    </div>
                    {isSelected && (
                      <div style={{ marginTop:10, borderTop:"1px solid var(--border)", paddingTop:8 }}>
                        {run.missing.length > 0 && (
                          <>
                            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem",
                              letterSpacing:"2px", color:"var(--red)", marginBottom:6 }}>MISSING ({run.missing.length})</div>
                            <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:10 }}>
                              {run.missing.map(n => (
                                <a key={n}
                                  href={`https://comicvine.gamespot.com/search/?q=${encodeURIComponent(run.title + " " + n)}&resources=issue`}
                                  target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                  style={{ background:"#fff0f0", color:"var(--red)", border:"1.5px solid #f5c8c8",
                                    borderRadius:4, padding:"2px 8px", fontSize:"0.72rem",
                                    fontFamily:"'Bebas Neue',sans-serif", textDecoration:"none" }}>
                                  #{n}
                                </a>
                              ))}
                            </div>
                          </>
                        )}
                        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem",
                          letterSpacing:"2px", color:"var(--muted2)", marginBottom:6 }}>YOU OWN ({run.haveCount})</div>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>
                          {run.issues.map((c, ci) => {
                            const isKey    = (c.Key||"").toUpperCase()==="YES";
                            const isSigned = (c.Signed||"").toUpperCase()==="YES";
                            return (
                              <div key={ci} title={isKey ? c.Key_Reason : c.Arc} style={{
                                background: isKey ? "#fff8e0" : "var(--surface2)",
                                border: isKey ? "1.5px solid #d4a800" : "1.5px solid var(--border)",
                                borderRadius:4, padding:"2px 7px", fontSize:"0.72rem",
                                fontFamily:"'Bebas Neue',sans-serif",
                                color: isKey ? "#8a6000" : "var(--text2)",
                              }}>
                                #{c.Issue}
                                {isKey    && <span style={{ color:"#c8102e", marginLeft:2 }}>★</span>}
                                {isSigned && <span style={{ color:"#22c55e", marginLeft:2 }}>✍</span>}
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ marginTop:8, fontSize:"0.68rem", color:"var(--muted)" }}>
                          Boxes: {Array.from(new Set(run.issues.map(c => `Box ${c.Box}`))).join(", ")}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── List view ── */}
          {drillView === "list" && (
            <div style={{ border:"1.5px solid var(--border)", borderRadius:8, overflow:"hidden" }}>
              {drillRuns.map((run, i) => {
                const pg = PUB_GROUPS.find(p => p.key === pubGroup(run.publisher)) ?? PUB_GROUPS[2];
                const pctFill = Math.min(run.pct, 100);
                const isSelected = selectedRun?.key === run.key;
                return (
                  <div key={i} style={{
                    borderBottom: i < drillRuns.length-1 ? "1px solid var(--border)" : "none",
                    background: isSelected ? "var(--surface2)" : i % 2 === 0 ? "var(--surface)" : "var(--bg)",
                    transition:"background 0.12s",
                  }}>
                    <div onClick={() => setSelectedRun(isSelected ? null : run)}
                      style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px", cursor:"pointer", flexWrap:"wrap" }}>
                      <div style={{ width:6, height:6, borderRadius:"50%", background:pg.color, flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:"0.88rem", fontWeight:600, color:"var(--brown-light)",
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {run.title}
                          {run.volume !== "1" && <span style={{ fontSize:"0.6rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", background:"rgba(0,0,0,0.08)", borderRadius:3, padding:"1px 5px", marginLeft:5 }}>Vol {run.volume}</span>}
                        </div>
                        <div style={{ fontSize:"0.83rem", color:"var(--text2)", marginTop:2, lineHeight:1.4 }}>
                          <span style={{ color:"var(--muted2)" }}>#{run.rangeMin}–#{run.rangeMax}</span>
                          {run.keys   > 0 && <span style={{ color:"#d97706", marginLeft:6, fontWeight:600 }}>· {run.keys} key{run.keys>1?"s":""}</span>}
                          {run.signed > 0 && <span style={{ color:"#8b2be2", marginLeft:6, fontWeight:600 }}>· {run.signed} signed</span>}
                        </div>
                      </div>
                      <div style={{ flex:"0 0 140px", height:5, background:"var(--border)", borderRadius:3, overflow:"hidden" }}>
                        <div style={{ width:`${pctFill}%`, height:"100%", background:pg.color, borderRadius:3, transition:"width 0.4s" }} />
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0, minWidth:80 }}>
                        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.95rem",
                          color:pg.color, letterSpacing:"1px", lineHeight:1 }}>
                          {run.pct >= 100 ? "COMPLETE" : `${run.pct.toFixed(0)}%`}
                        </div>
                        <div style={{ fontSize:"0.62rem", color:"var(--muted)", marginTop:1 }}>
                          {run.haveCount}/{run.rangeSize}
                          {run.missing.length > 0 && ` · ${run.missing.length} missing`}
                        </div>
                      </div>
                      <span style={{ color:"var(--muted)", fontSize:"0.7rem", flexShrink:0 }}>{isSelected?"▲":"▼"}</span>
                    </div>
                    {isSelected && (
                      <div style={{ padding:"12px 16px 14px 34px", borderTop:"1px solid var(--border)", background:"var(--surface)" }}>
                        {run.missing.length > 0 && (
                          <div style={{ marginBottom:12 }}>
                            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem",
                              letterSpacing:"2px", color:"var(--red)", marginBottom:6 }}>
                              MISSING ISSUES ({run.missing.length})
                            </div>
                            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                              {run.missing.map(n => (
                                <a key={n}
                                  href={`https://comicvine.gamespot.com/search/?q=${encodeURIComponent(run.title + " " + n)}&resources=issue`}
                                  target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                  style={{ background:"#fff0f0", color:"var(--red)", border:"1.5px solid #f5c8c8",
                                    borderRadius:4, padding:"3px 10px", fontSize:"0.74rem",
                                    fontFamily:"'Bebas Neue',sans-serif", textDecoration:"none" }}>
                                  #{n}
                                </a>
                              ))}
                            </div>
                            <div style={{ fontSize:"0.68rem", color:"var(--muted)", marginTop:5, fontStyle:"italic" }}>
                              Click any missing issue to search Comic Vine
                            </div>
                          </div>
                        )}
                        <div>
                          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem",
                            letterSpacing:"2px", color:"var(--muted2)", marginBottom:6 }}>
                            ISSUES YOU OWN ({run.haveCount})
                          </div>
                          <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                            {run.issues.map((c, ci) => {
                              const isKey    = (c.Key||"").toUpperCase()==="YES";
                              const isSigned = (c.Signed||"").toUpperCase()==="YES";
                              return (
                                <div key={ci} title={isKey ? c.Key_Reason : c.Arc} style={{
                                  background: isKey ? "#fff8e0" : "var(--surface2)",
                                  border: isKey ? "1.5px solid #d4a800" : "1.5px solid var(--border)",
                                  borderRadius:4, padding:"3px 8px", fontSize:"0.74rem",
                                  fontFamily:"'Bebas Neue',sans-serif",
                                  color: isKey ? "#8a6000" : "var(--text2)",
                                }}>
                                  #{c.Issue}
                                  {isKey    && <span style={{ color:"#c8102e", marginLeft:2 }}>★</span>}
                                  {isSigned && <span style={{ color:"#22c55e", marginLeft:2 }}>✍</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div style={{ marginTop:8, fontSize:"0.7rem", color:"var(--muted)" }}>
                          Boxes: {Array.from(new Set(run.issues.map(c => `Box ${c.Box}`))).join(", ")}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Divider before publisher groups */}
          <div style={{ marginTop:28, borderTop:"2px solid var(--border)", paddingTop:6, display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem", letterSpacing:"2px", color:"var(--muted)", flex:1 }}>
              ALL PUBLISHER GROUPS BELOW
            </div>
          </div>
        </div>
      )}

      {/* Flat card view (no drill selected) */}
      {!drillKey && view === "card" && filtered.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom:40 }}>
          {filtered.map((run, i) => {
            const pg = PUB_GROUPS.find(p => p.key === pubGroup(run.publisher)) ?? PUB_GROUPS[2];
            const pct = Math.min(run.pct, 100);
            const isSelected = selectedRun?.key === run.key;
            return (
              <div key={i}
                onClick={() => setSelectedRun(isSelected ? null : run)}
                className="flagship-card"
                style={{
                  flex: isSelected ? "1 1 100%" : "1 1 280px",
                  borderLeftColor: pg.color,
                  borderColor: isSelected ? pg.color : pg.color+"33",
                  boxShadow: isSelected ? `0 4px 16px ${pg.color}20` : "none",
                }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.92rem",
                    letterSpacing:"1px", color:pg.color, flex:1, lineHeight:1.2 }}>
                    {run.title}
                    {run.volume !== "1" && <span style={{ fontSize:"0.6rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", background:"rgba(0,0,0,0.08)", borderRadius:3, padding:"1px 5px", marginLeft:5 }}>Vol {run.volume}</span>}
                  </div>
                  <div style={{ fontSize:"0.7rem", color:"var(--muted)", flexShrink:0, marginTop:1 }}>{isSelected?"▲":"▼"}</div>
                </div>
                <div style={{ display:"flex", gap:5, marginTop:6, flexWrap:"wrap" }}>
                  <span style={{ fontSize:"0.6rem", fontFamily:"'Bebas Neue',sans-serif",
                    letterSpacing:"1px", background:pg.accent, color:pg.color,
                    border:`1px solid ${pg.border}`, borderRadius:3, padding:"1px 7px" }}>{pg.label}</span>
                  {run.keys > 0 && (
                    <span style={{ fontSize:"0.6rem", fontFamily:"'Bebas Neue',sans-serif",
                      letterSpacing:"1px", background:"#fff8e0", color:"#8a6000",
                      border:"1px solid #fde68a", borderRadius:3, padding:"1px 7px" }}>
                      {run.keys} KEY{run.keys>1?"S":""}
                    </span>
                  )}
                </div>
                <div style={{ height:5, background:"var(--border)", borderRadius:3, marginBottom:6 }}>
                  <div style={{ width:`${pct}%`, height:"100%", background:pg.color, borderRadius:3, transition:"width 0.4s" }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.1rem",
                    color:pg.color, letterSpacing:"1px", lineHeight:1 }}>
                    {run.pct >= 100 ? "COMPLETE" : `${run.pct.toFixed(0)}%`}
                  </span>
                  <span style={{ fontSize:"0.7rem", color:"var(--muted)" }}>
                    {run.haveCount}/{run.rangeSize}
                    {run.missing.length > 0 && <span style={{ color:"var(--red)", marginLeft:4 }}>{run.missing.length} missing</span>}
                  </span>
                </div>
                {isSelected && run.missing.length > 0 && (
                  <div style={{ marginTop:10, borderTop:"1px solid var(--border)", paddingTop:8 }}>
                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem",
                      letterSpacing:"2px", color:"var(--red)", marginBottom:6 }}>MISSING</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                      {run.missing.map(n => (
                        <a key={n}
                          href={`https://comicvine.gamespot.com/search/?q=${encodeURIComponent(run.title + " " + n)}&resources=issue`}
                          target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ background:"#fff0f0", color:"var(--red)", border:"1.5px solid #f5c8c8",
                            borderRadius:4, padding:"2px 8px", fontSize:"0.72rem",
                            fontFamily:"'Bebas Neue',sans-serif", textDecoration:"none" }}>
                          #{n}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Publisher groups */}
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {grouped.map(pg => {
          const isPubOpen = openPublishers.has(pg.key);
          const complete  = pg.runs.filter(r => r.missing.length === 0).length;

          return (
            <div key={pg.key} style={{ border:`2px solid ${pg.border}`, borderRadius:10, overflow:"hidden" }}>

              {/* Publisher header */}
              <button
                onClick={() => togglePublisher(pg.key)}
                style={{ width:"100%", background: isPubOpen ? pg.accent : "var(--surface)",
                  border:"none", cursor:"pointer", padding:"14px 18px",
                  display:"flex", alignItems:"center", gap:12, textAlign:"left",
                  transition:"background 0.15s" }}>

                {/* Publisher badge */}
                <div style={{ width:28, height:28, borderRadius:6, background:pg.color,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.75rem",
                  color:"#fff", letterSpacing:"1px", flexShrink:0 }}>
                  {pg.key === "Other" ? "IND" : pg.key.toUpperCase()}
                </div>

                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.05rem",
                    letterSpacing:"3px", color: pg.color, lineHeight:1 }}>
                    {pg.label}
                  </div>
                  <div style={{ fontSize:"0.72rem", color:"var(--muted)", marginTop:2 }}>
                    {pg.runs.length} runs · {complete} complete
                    {" · "}avg {(pg.runs.reduce((s,r)=>s+r.pct,0)/pg.runs.length).toFixed(0)}%
                  </div>
                </div>

                {/* Bucket pills summary */}
                <div style={{ display:"flex", gap:5, flexShrink:0, flexWrap:"wrap" }}>
                  {pg.buckets.map(b => (
                    <span key={b.label} style={{ fontSize:"0.62rem", fontFamily:"'Bebas Neue',sans-serif",
                      letterSpacing:"0.5px", background:b.bg, color:b.color,
                      border:`1px solid ${b.border}`, borderRadius:10, padding:"2px 8px" }}>
                      {b.label === "100% — COMPLETE" ? "100%" : b.label} · {b.runs.length}
                    </span>
                  ))}
                </div>

                <span style={{ color:"var(--muted)", fontSize:"0.8rem", flexShrink:0 }}>
                  {isPubOpen ? "▲" : "▼"}
                </span>
              </button>

              {/* Publisher content */}
              {isPubOpen && (
                <div style={{ borderTop:`1px solid ${pg.border}` }}>
                  {pg.buckets.map(bucket => {
                    const bucketKey = `${pg.key}::${bucket.label}`;
                    const isBucketOpen = openBuckets.has(bucketKey);
                    const isComplete   = bucket.min === 100;

                    return (
                      <div key={bucket.label} style={{ borderBottom:`1px solid ${bucket.border}` }}>

                        {/* Bucket header */}
                        <button
                          onClick={() => toggleBucket(bucketKey)}
                          style={{ width:"100%", background: isBucketOpen ? bucket.bg : "var(--surface2)",
                            border:"none", cursor:"pointer", padding:"10px 18px 10px 42px",
                            display:"flex", alignItems:"center", gap:10, textAlign:"left",
                            transition:"background 0.15s", borderLeft:`3px solid ${bucket.color}` }}>

                          <div style={{ width:8, height:8, borderRadius:"50%", background:bucket.color, flexShrink:0 }} />
                          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.82rem",
                            letterSpacing:"2px", color: bucket.color, flex:1 }}>
                            {bucket.label}
                          </span>
                          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem",
                            letterSpacing:"1.5px", color:"var(--muted)", background:"var(--surface)",
                            border:"1px solid var(--border)", borderRadius:10, padding:"2px 8px", flexShrink:0 }}>
                            {bucket.runs.length} {bucket.runs.length === 1 ? "run" : "runs"}
                          </span>
                          {isComplete && (
                            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1px",
                              background:"#16a34a", color:"#fff", borderRadius:3, padding:"2px 8px", flexShrink:0 }}>
                              🎉 ALL COMPLETE
                            </span>
                          )}
                          <span style={{ color:"var(--muted)", fontSize:"0.72rem", flexShrink:0 }}>
                            {isBucketOpen ? "▲" : "▼"}
                          </span>
                        </button>

                        {/* Bucket runs */}
                        {isBucketOpen && (
                          <div style={{ background: bucket.bg }}>
                            {bucket.runs.map((run, i) => {
                              const isSelected = selectedRun?.key === run.key;
                              const pctFill    = Math.min(run.pct, 100);

                              return (
                                <div key={i} style={{
                                  background: isSelected ? "var(--surface)" : "transparent",
                                  borderBottom: i < bucket.runs.length-1 ? `1px solid ${bucket.border}` : "none",
                                  transition:"background 0.15s",
                                }}>

                                  {/* Run row */}
                                  <div onClick={() => setSelectedRun(isSelected ? null : run)}
                                    style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 18px 10px 52px",
                                      cursor:"pointer", flexWrap:"wrap" }}>

                                    <div style={{ flex:1, minWidth:0 }}>
                                      <div style={{ fontSize:"0.88rem", fontWeight:600, color:"var(--brown-light)",
                                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                        {run.title}
                                        {run.volume !== "1" && <span style={{ fontSize:"0.6rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", background:"rgba(0,0,0,0.08)", borderRadius:3, padding:"1px 5px", marginLeft:5 }}>Vol {run.volume}</span>}
                                      </div>
                                      <div style={{ fontSize:"0.72rem", color:"var(--muted)", marginTop:1 }}>
                                        #{run.rangeMin}–#{run.rangeMax}
                                        {run.keys > 0 && ` · ${run.keys} key${run.keys>1?"s":""}`}
                                        {run.signed > 0 && ` · ${run.signed} signed`}
                                      </div>
                                    </div>

                                    <div style={{ textAlign:"right", flexShrink:0, minWidth:90 }}>
                                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem",
                                        color: bucket.color, letterSpacing:"1px", lineHeight:1 }}>
                                        {run.pct >= 100 ? "COMPLETE" : `${run.pct.toFixed(0)}%`}
                                      </div>
                                      <div style={{ fontSize:"0.65rem", color:"var(--muted)", marginTop:1 }}>
                                        {run.haveCount}/{run.rangeSize}
                                        {run.missing.length > 0 && ` · ${run.missing.length} missing`}
                                      </div>
                                    </div>

                                    <span style={{ color:"var(--muted)", fontSize:"0.7rem", flexShrink:0 }}>
                                      {isSelected ? "▲" : "▼"}
                                    </span>
                                  </div>

                                  {/* Mini progress bar */}
                                  <div style={{ height:3, background:`${bucket.border}`, margin:"0 52px 4px" }}>
                                    <div style={{ width:`${pctFill}%`, height:"100%", background:bucket.color,
                                      borderRadius:2, transition:"width 0.4s ease" }} />
                                  </div>

                                  {/* Expanded detail */}
                                  {isSelected && (
                                    <div style={{ padding:"14px 18px 14px 52px", borderTop:`1px solid ${bucket.border}`, background:"var(--surface)" }}>

                                      {run.missing.length > 0 && (
                                        <div style={{ marginBottom:14 }}>
                                          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem",
                                            letterSpacing:"2px", color:"var(--red)", marginBottom:8 }}>
                                            MISSING ISSUES ({run.missing.length})
                                          </div>
                                          <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                                            {run.missing.map(n => (
                                              <a key={n}
                                                href={`https://comicvine.gamespot.com/search/?q=${encodeURIComponent(run.title + " " + n)}&resources=issue`}
                                                target="_blank" rel="noopener noreferrer"
                                                onClick={e => e.stopPropagation()}
                                                style={{ background:"#fff0f0", color:"var(--red)", border:"1.5px solid #f5c8c8",
                                                  borderRadius:4, padding:"3px 10px", fontSize:"0.76rem",
                                                  fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"0.5px",
                                                  textDecoration:"none" }}>
                                                #{n}
                                              </a>
                                            ))}
                                          </div>
                                          <div style={{ fontSize:"0.72rem", color:"var(--muted)", marginTop:6, fontStyle:"italic" }}>
                                            Click any missing issue to search Comic Vine
                                          </div>
                                        </div>
                                      )}

                                      <div>
                                        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem",
                                          letterSpacing:"2px", color:"var(--muted2)", marginBottom:8 }}>
                                          ISSUES YOU OWN ({run.haveCount})
                                        </div>
                                        <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                                          {run.issues.map((c, ci) => {
                                            const isKey    = (c.Key||"").toUpperCase()==="YES";
                                            const isSigned = (c.Signed||"").toUpperCase()==="YES";
                                            return (
                                              <div key={ci} title={isKey ? c.Key_Reason : c.Arc} style={{
                                                background: isKey ? "#fff8e0" : "var(--surface2)",
                                                border: isKey ? "1.5px solid #d4a800" : "1.5px solid var(--border)",
                                                borderRadius:4, padding:"3px 8px", fontSize:"0.76rem",
                                                fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"0.5px",
                                                color: isKey ? "#8a6000" : "var(--text2)",
                                              }}>
                                                #{c.Issue}
                                                {isKey    && <span style={{ color:"#c8102e", marginLeft:2 }}>★</span>}
                                                {isSigned && <span style={{ color:"#22c55e", marginLeft:2 }}>✍</span>}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      <div style={{ marginTop:10, fontSize:"0.72rem", color:"var(--muted)" }}>
                                        Boxes: {Array.from(new Set(run.issues.map(c => `Box ${c.Box}`))).join(", ")}
                                      </div>
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
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign:"center", color:"var(--muted)", padding:"60px 20px",
          fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem", letterSpacing:"2px" }}>
          NO RUNS FOUND AT {threshold}% — TRY LOWERING THE THRESHOLD
        </div>
      )}
    </div>
  );
}
