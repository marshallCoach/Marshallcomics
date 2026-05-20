import { useState, useMemo } from "react";
import { DATA3 } from "@/data/data3";

const comics = DATA3.comics;

function parseIssueNum(s: string): number | null {
  const raw = String(s || "").trim().replace(/^#/, "");
  // Skip annuals, specials, etc.
  if (/annual|special|giant|tpb|vol|omnibus/i.test(raw)) return null;
  const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
  if (isNaN(n) || n <= 0 || n > 999) return null;
  // Only whole-number issues (skip .1 tie-ins etc)
  if (!Number.isInteger(n) && !raw.match(/^\d+$/)) return null;
  return Math.round(n);
}

interface RunEntry {
  title: string;
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

export default function Runs() {
  const [threshold, setThreshold] = useState(75);
  const [sortBy, setSortBy] = useState<"pct" | "count" | "missing" | "title">("pct");
  const [pubFilter, setPubFilter] = useState("");
  const [selectedRun, setSelectedRun] = useState<RunEntry | null>(null);

  const allRuns = useMemo<RunEntry[]>(() => {
    // Group by title
    const byTitle: Record<string, typeof comics> = {};
    for (const c of comics) {
      const key = c.Title.trim();
      if (!byTitle[key]) byTitle[key] = [];
      byTitle[key].push(c);
    }

    const result: RunEntry[] = [];

    for (const [title, issues] of Object.entries(byTitle)) {
      // Parse issue numbers
      const numbered = issues
        .map(c => ({ comic: c, num: parseIssueNum(c.Issue) }))
        .filter(x => x.num !== null) as { comic: typeof comics[number]; num: number }[];

      if (numbered.length < 3) continue; // Need at least 3 to be a "run"

      const nums    = numbered.map(x => x.num);
      const minIss  = Math.min(...nums);
      const maxIss  = Math.max(...nums);
      const range   = maxIss - minIss + 1;

      if (range < 4) continue; // Skip very short ranges

      const haveSet = new Set(nums);
      const pct     = (haveSet.size / range) * 100;

      // Find missing issues
      const missing: number[] = [];
      for (let i = minIss; i <= maxIss; i++) {
        if (!haveSet.has(i)) missing.push(i);
      }

      const pub    = issues[0].Publisher || "";
      const sorted = [...numbered].sort((a, b) => a.num - b.num).map(x => x.comic);
      const keys   = issues.filter(c => (c.Key||"").toUpperCase()==="YES").length;
      const sgn    = issues.filter(c => (c.Signed||"").toUpperCase()==="YES").length;

      result.push({
        title, publisher: pub,
        haveCount: haveSet.size,
        rangeMin: minIss, rangeMax: maxIss, rangeSize: range,
        pct, missing, issues: sorted, keys, signed: sgn,
      });
    }

    return result;
  }, []);

  const filtered = useMemo(() => {
    let runs = allRuns.filter(r => r.pct >= threshold);
    if (pubFilter) runs = runs.filter(r => r.publisher.toLowerCase().includes(pubFilter.toLowerCase()));
    if (sortBy === "pct")     runs.sort((a, b) => b.pct - a.pct);
    if (sortBy === "count")   runs.sort((a, b) => b.haveCount - a.haveCount);
    if (sortBy === "missing") runs.sort((a, b) => a.missing.length - b.missing.length);
    if (sortBy === "title")   runs.sort((a, b) => a.title.localeCompare(b.title));
    return runs;
  }, [allRuns, threshold, sortBy, pubFilter]);

  const publishers = useMemo(() => {
    const s = new Set(allRuns.map(r => r.publisher).filter(Boolean));
    return Array.from(s).sort();
  }, [allRuns]);

  const perfect   = filtered.filter(r => r.missing.length === 0).length;
  const nearPerfect = filtered.filter(r => r.pct >= 95 && r.missing.length > 0).length;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "18px 18px 60px" }}>

      {/* Header */}
      <div style={{ marginBottom:16 }}>
        <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.6rem", color:"var(--red)",
          letterSpacing:"3px", lineHeight:1, margin:0 }}>Run Completion</h1>
        <p style={{ color:"var(--muted2)", fontSize:"0.88rem", marginTop:6 }}>
          Titles where you own {threshold}%+ of a consecutive run — so you can track down the gaps.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
        {[
          { val: filtered.length,   lbl: `Runs ≥ ${threshold}%` },
          { val: perfect,           lbl: "Complete Runs" },
          { val: nearPerfect,       lbl: "≥ 95% Complete" },
          { val: allRuns.length,    lbl: "Total Title Groups" },
        ].map(s => (
          <div key={s.lbl} style={{ background:"var(--surface)", border:"1.5px solid var(--border)",
            borderRadius:6, padding:"10px 16px", textAlign:"center", flex:"1 1 110px" }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.5rem", color:"var(--red)",
              letterSpacing:"1px", lineHeight:1 }}>{s.val}</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"1.5px",
              color:"var(--muted)", marginTop:3 }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16,
        background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:6, padding:"12px 14px" }}>

        {/* Threshold slider */}
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

        {/* Publisher filter */}
        <select value={pubFilter} onChange={e => setPubFilter(e.target.value)}
          style={{ background:"var(--bg)", border:"1.5px solid var(--border)", color:"var(--text)",
            padding:"6px 10px", borderRadius:5, fontFamily:"'Crimson Pro',serif", fontSize:"0.88rem" }}>
          <option value="">All Publishers</option>
          {publishers.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* Sort */}
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
      </div>

      {/* Results */}
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.7rem", letterSpacing:"2px",
        color:"var(--muted)", marginBottom:10 }}>
        {filtered.length} RUNS FOUND
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {filtered.map((run, i) => {
          const isSelected = selectedRun?.title === run.title;
          const pctFill = Math.min(run.pct, 100);
          const pctColor = run.pct >= 100 ? "#16a34a" : run.pct >= 90 ? "#1d6fa4" : run.pct >= 75 ? "var(--gold)" : "var(--red)";

          return (
            <div key={i}
              style={{ background:"var(--surface)", border:"1.5px solid " + (isSelected ? "var(--red)" : "var(--border)"),
                borderRadius:6, overflow:"hidden", transition:"border-color 0.15s" }}>

              {/* Header row */}
              <div onClick={() => setSelectedRun(isSelected ? null : run)}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px",
                  cursor:"pointer", flexWrap:"wrap" }}>

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:"0.9rem", fontWeight:600, color:"var(--brown-light)",
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {run.title}
                  </div>
                  <div style={{ fontSize:"0.75rem", color:"var(--muted)", marginTop:2 }}>
                    {run.publisher} · #{run.rangeMin}–#{run.rangeMax}
                    {run.keys > 0 && ` · ${run.keys} key${run.keys>1?"s":""}`}
                    {run.signed > 0 && ` · ${run.signed} signed`}
                  </div>
                </div>

                {/* Progress */}
                <div style={{ textAlign:"right", flexShrink:0, minWidth:100 }}>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.1rem",
                    color: pctColor, letterSpacing:"1px", lineHeight:1 }}>
                    {run.pct >= 100 ? "COMPLETE" : `${run.pct.toFixed(0)}%`}
                  </div>
                  <div style={{ fontSize:"0.7rem", color:"var(--muted)", marginTop:2 }}>
                    {run.haveCount}/{run.rangeSize} issues
                    {run.missing.length > 0 && ` · ${run.missing.length} missing`}
                  </div>
                </div>

                {/* Chevron */}
                <span style={{ color:"var(--muted)", fontSize:"0.75rem", flexShrink:0 }}>
                  {isSelected ? "▲" : "▼"}
                </span>
              </div>

              {/* Progress bar */}
              <div style={{ height:4, background:"var(--border)", position:"relative" }}>
                <div style={{ width:`${pctFill}%`, height:"100%", background:pctColor,
                  transition:"width 0.4s ease" }} />
              </div>

              {/* Expanded detail */}
              {isSelected && (
                <div style={{ padding:"14px 16px", borderTop:"1px solid var(--border)" }}>

                  {run.missing.length > 0 && (
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.7rem",
                        letterSpacing:"2px", color:"var(--red)", marginBottom:8 }}>
                        MISSING ISSUES ({run.missing.length})
                      </div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                        {run.missing.map(n => (
                          <a
                            key={n}
                            href={`https://comicvine.gamespot.com/search/?q=${encodeURIComponent(run.title + " " + n)}&resources=issue`}
                            target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ background:"#fff0f0", color:"var(--red)", border:"1.5px solid #f5c8c8",
                              borderRadius:4, padding:"3px 10px", fontSize:"0.78rem",
                              fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"0.5px",
                              textDecoration:"none", transition:"background 0.1s" }}
                          >
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
                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.7rem",
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
                            borderRadius:4, padding:"3px 8px", fontSize:"0.78rem",
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

                  {/* Box locations */}
                  <div style={{ marginTop:12, fontSize:"0.75rem", color:"var(--muted)" }}>
                    Boxes: {Array.from(new Set(run.issues.map(c => `Box ${c.Box}`))).join(", ")}
                  </div>
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
