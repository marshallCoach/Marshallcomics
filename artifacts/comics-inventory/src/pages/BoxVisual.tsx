import { useState, useMemo } from "react";
import { DATA3 } from "@/data/data3";

const comics = DATA3.comics;
const boxes  = DATA3.boxes;

const PUB_COLORS: Record<string, string> = {
  dc:      "#1d6fa4",
  marvel:  "#c8102e",
  image:   "#f97316",
  dark:    "#6b21a8",
  idw:     "#0ea5e9",
  boom:    "#f59e0b",
  valiant: "#8b5cf6",
  vertigo: "#2563eb",
  wildstorm:"#0891b2",
  other:   "#6b7280",
};

function pubColor(pub: string): string {
  const p = (pub || "").toLowerCase();
  for (const key of Object.keys(PUB_COLORS)) {
    if (p.includes(key)) return PUB_COLORS[key];
  }
  return PUB_COLORS.other;
}

function parseIssueNum(s: string): number {
  const n = parseFloat(String(s||"").replace(/[^0-9.]/g,""));
  return isNaN(n) ? 9999 : n;
}

interface RunGroup {
  title: string;
  issues: typeof comics;
  minIss: number;
  maxIss: number;
}

function groupIntoRuns(comicsList: typeof comics): RunGroup[] {
  const byTitle: Record<string, typeof comics> = {};
  for (const c of comicsList) {
    if (!byTitle[c.Title]) byTitle[c.Title] = [];
    byTitle[c.Title].push(c);
  }
  return Object.entries(byTitle)
    .map(([title, issues]) => {
      const sorted = [...issues].sort((a, b) => parseIssueNum(a.Issue) - parseIssueNum(b.Issue));
      const nums = sorted.map(c => parseIssueNum(c.Issue)).filter(n => n < 9000);
      return { title, issues: sorted, minIss: nums.length ? Math.min(...nums) : 0, maxIss: nums.length ? Math.max(...nums) : 0 };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

function getBoxComics(boxNum: string) {
  return comics.filter(c => {
    const bClean = String(c.Box||"").trim().replace(/^0+/,"");
    const bNum   = boxNum.replace(/^BOX\s*/i,"").replace(/^0+/,"");
    return bClean === bNum;
  });
}

export default function BoxVisual() {
  const [selectedBox, setSelectedBox] = useState<string | null>(null);
  const [selectedComic, setSelectedComic] = useState<typeof comics[number] | null>(null);
  const [view, setView] = useState<"visual" | "runs">("visual");

  const boxComics = useMemo(() =>
    selectedBox ? getBoxComics(selectedBox) : [],
  [selectedBox]);

  const runs = useMemo(() => groupIntoRuns(boxComics), [boxComics]);

  function selectBox(num: string) {
    setSelectedBox(num);
    setSelectedComic(null);
    setView("visual");
  }

  const selectedBoxData = boxes.find(b => b.Num === selectedBox);

  return (
    <div style={{ maxWidth:1100, margin:"0 auto", padding:"18px 18px 60px" }}>

      {/* Intro */}
      <div style={{ marginBottom:16, fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.75rem",
        letterSpacing:"2px", color:"var(--muted)" }}>
        SELECT A BOX TO VISUALIZE ITS CONTENTS
      </div>

      {/* Box grid selector */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(90px, 1fr))", gap:6, marginBottom:24 }}>
        {boxes.map(b => {
          const bComics = getBoxComics(b.Num);
          const isSelected = selectedBox === b.Num;
          return (
            <button
              key={b.Num}
              onClick={() => selectBox(b.Num)}
              style={{
                background: isSelected ? "var(--red)" : "var(--surface)",
                border: isSelected ? "2px solid var(--red-dark)" : "1.5px solid var(--border)",
                borderRadius:6, padding:"8px 6px", cursor:"pointer",
                textAlign:"center", transition:"all 0.15s",
                boxShadow: isSelected ? "0 2px 8px rgba(200,16,46,0.3)" : "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem",
                color: isSelected ? "#fff" : "var(--red)", letterSpacing:"1px", lineHeight:1 }}>
                {b.Num.replace("BOX ","#")}
              </div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem",
                color: isSelected ? "rgba(255,255,255,0.8)" : "var(--muted)", letterSpacing:"1px", marginTop:2 }}>
                {bComics.length || b.Comics} books
              </div>
              {b.Keys > 0 && (
                <div style={{ width:"100%", height:2, background: isSelected ? "rgba(255,255,255,0.6)" : "#d4a800",
                  borderRadius:1, marginTop:4 }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Box detail view */}
      {selectedBox && selectedBoxData && (
        <div>
          {/* Box header */}
          <div style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:8,
            padding:"14px 18px", marginBottom:16, display:"flex", alignItems:"flex-start",
            gap:16, flexWrap:"wrap" }}>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.4rem", color:"var(--red)", letterSpacing:"2px", lineHeight:1 }}>
                {selectedBoxData.Num}
              </div>
              <div style={{ fontSize:"0.92rem", fontWeight:600, color:"var(--brown-light)", marginTop:3 }}>
                {selectedBoxData.Label.replace(/^Box \d+ — /i,"")}
              </div>
              <div style={{ fontSize:"0.78rem", color:"var(--muted)", marginTop:4 }}>
                {selectedBoxData.Publisher} · {selectedBoxData.YearRange} · Added: {selectedBoxData.DateAdded || "Original session"}
              </div>
            </div>
            <div style={{ display:"flex", gap:14, flexShrink:0 }}>
              {[
                { val: boxComics.length, lbl:"COMICS" },
                { val: selectedBoxData.Keys, lbl:"KEYS" },
                { val: selectedBoxData.Signed, lbl:"SIGNED" },
                { val: runs.length, lbl:"RUNS" },
              ].map(s => (
                <div key={s.lbl} style={{ textAlign:"center" }}>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.3rem", color:"var(--red)", letterSpacing:"1px", lineHeight:1 }}>{s.val}</div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem", letterSpacing:"1.5px", color:"var(--muted)", marginTop:2 }}>{s.lbl}</div>
                </div>
              ))}
            </div>
          </div>

          {/* View toggle */}
          <div style={{ display:"flex", gap:6, marginBottom:16 }}>
            {(["visual","runs"] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                background: view === v ? "var(--red)" : "var(--surface)",
                color: view === v ? "#fff" : "var(--muted2)",
                border: view === v ? "1.5px solid var(--red)" : "1.5px solid var(--border)",
                borderRadius:5, padding:"6px 18px", cursor:"pointer",
                fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.78rem", letterSpacing:"1.5px",
                transition:"all 0.15s",
              }}>
                {v === "visual" ? "📦 Visual Box" : "📚 By Run"}
              </button>
            ))}
          </div>

          {/* VISUAL VIEW */}
          {view === "visual" && (
            <div style={{ display:"grid", gridTemplateColumns: selectedComic ? "1fr 280px" : "1fr", gap:16, alignItems:"start" }}>
              {/* Box graphic */}
              <div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.7rem",
                  letterSpacing:"2px", color:"var(--muted)", marginBottom:8 }}>
                  EACH LINE = ONE COMIC · RED = KEY · CLICK TO INSPECT
                </div>
                <div style={{
                  background:"#1a1a1a",
                  border:"3px solid #333",
                  borderTop:"6px solid #555",
                  borderRadius:"4px 4px 0 0",
                  padding:"12px 16px",
                  position:"relative",
                  minHeight:120,
                  boxShadow:"0 4px 16px rgba(0,0,0,0.3)",
                }}>
                  {/* Box label */}
                  <div style={{ position:"absolute", top:-20, left:0, right:0, textAlign:"center",
                    fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.7rem", letterSpacing:"2px", color:"#666" }}>
                    {selectedBoxData.Num} · {boxComics.length} COMICS
                  </div>

                  {/* Comic lines */}
                  <div style={{ display:"flex", flexDirection:"column", gap:"1.5px" }}>
                    {boxComics.map((c, i) => {
                      const isKey    = (c.Key||"").toUpperCase() === "YES";
                      const isSigned = (c.Signed||"").toUpperCase() === "YES";
                      const isActive = selectedComic === c;
                      const color    = isKey ? "#c8102e" : pubColor(c.Publisher);
                      return (
                        <div
                          key={i}
                          title={`${c.Title} #${c.Issue}`}
                          onClick={() => setSelectedComic(isActive ? null : c)}
                          style={{
                            height: isKey ? 5 : 3,
                            background: isActive ? "#fff" : (isKey ? color : color + "88"),
                            borderRadius:1,
                            cursor:"pointer",
                            transition:"all 0.1s",
                            borderLeft: isSigned ? "3px solid #22c55e" : undefined,
                            boxShadow: isActive ? `0 0 6px ${color}` : undefined,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Legend */}
                <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginTop:10, fontSize:"0.72rem",
                  fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", color:"var(--muted)" }}>
                  <span><span style={{ display:"inline-block", width:20, height:4, background:"#c8102e", verticalAlign:"middle", borderRadius:1, marginRight:4 }}/>KEY ISSUE</span>
                  <span><span style={{ display:"inline-block", width:20, height:4, background:"#1d6fa4", verticalAlign:"middle", borderRadius:1, marginRight:4 }}/>DC</span>
                  <span><span style={{ display:"inline-block", width:20, height:4, background:"#c8102e88", verticalAlign:"middle", borderRadius:1, marginRight:4 }}/>MARVEL</span>
                  <span><span style={{ display:"inline-block", width:20, height:4, background:"#f97316", verticalAlign:"middle", borderRadius:1, marginRight:4 }}/>IMAGE</span>
                  <span><span style={{ display:"inline-block", width:4, height:10, background:"#22c55e", verticalAlign:"middle", borderRadius:1, marginRight:4 }}/>SIGNED</span>
                </div>
              </div>

              {/* Comic detail panel */}
              {selectedComic && (
                <div style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:8,
                  padding:"16px", position:"sticky", top:170 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"2px", color:"var(--red)" }}>SELECTED</div>
                    <button onClick={() => setSelectedComic(null)} style={{
                      background:"none", border:"none", cursor:"pointer", color:"var(--muted)", fontSize:"1rem", lineHeight:1 }}>✕</button>
                  </div>
                  <div style={{ fontSize:"0.95rem", fontWeight:700, color:"var(--brown-light)", lineHeight:1.3, marginBottom:4 }}>
                    {selectedComic.Title}
                  </div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", color:"var(--red)", letterSpacing:"1px", marginBottom:10 }}>
                    #{selectedComic.Issue} · {selectedComic.Year}
                  </div>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10 }}>
                    {(selectedComic.Key||"").toUpperCase()==="YES" && (
                      <span style={{ background:"#fff8e0", color:"#8a6000", border:"1px solid #d4a800",
                        borderRadius:3, padding:"1px 7px", fontSize:"0.65rem",
                        fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>KEY</span>
                    )}
                    {(selectedComic.Signed||"").toUpperCase()==="YES" && (
                      <span style={{ background:"var(--green-bg)", color:"var(--green-text)", border:"1px solid #c8e6c8",
                        borderRadius:3, padding:"1px 7px", fontSize:"0.65rem",
                        fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>SIGNED</span>
                    )}
                    <span style={{ background:"var(--surface2)", color:"var(--muted2)", border:"1px solid var(--border)",
                      borderRadius:3, padding:"1px 7px", fontSize:"0.65rem",
                      fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>{selectedComic.Publisher}</span>
                  </div>
                  {[
                    { l:"Writer", v: selectedComic.Writer },
                    { l:"Artist", v: selectedComic.Artist },
                    { l:"Arc",    v: selectedComic.Arc },
                    { l:"Why Key",v: selectedComic.Key_Reason },
                    { l:"1st App",v: selectedComic.First_App },
                    { l:"Signed By",v: selectedComic.Signed_By },
                    { l:"Value NM",v: selectedComic.Value_NM },
                    { l:"Condition",v: selectedComic.Condition },
                  ].filter(r => r.v).map(r => (
                    <div key={r.l} style={{ display:"flex", gap:8, marginBottom:4, fontSize:"0.8rem" }}>
                      <span style={{ color:"var(--muted)", minWidth:64, flexShrink:0, fontSize:"0.72rem" }}>{r.l}</span>
                      <span style={{ color:"var(--text2)", lineHeight:1.4 }}>{r.v.slice(0,100)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* RUNS VIEW */}
          {view === "runs" && (
            <div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.7rem",
                letterSpacing:"2px", color:"var(--muted)", marginBottom:12 }}>
                {runs.length} TITLE{runs.length !== 1 ? "S" : ""} IN THIS BOX — SORTED ALPHABETICALLY
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {runs.map((run, ri) => (
                  <RunBlock key={ri} run={run} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!selectedBox && (
        <div style={{ textAlign:"center", color:"var(--muted)", padding:"60px 20px",
          fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem", letterSpacing:"2px" }}>
          TAP ANY BOX ABOVE TO SEE ITS CONTENTS
        </div>
      )}
    </div>
  );
}

function RunBlock({ run }: { run: RunGroup }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:6 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px",
          cursor:"pointer", transition:"background 0.1s" }}
      >
        <div style={{ flex:1 }}>
          <span style={{ fontSize:"0.9rem", fontWeight:600, color:"var(--brown-light)" }}>{run.title}</span>
          <span style={{ fontSize:"0.78rem", color:"var(--muted)", marginLeft:8 }}>
            {run.issues.length} issue{run.issues.length !== 1 ? "s" : ""}
            {run.minIss < 9000 && run.maxIss > run.minIss && ` · #${Math.round(run.minIss)}–#${Math.round(run.maxIss)}`}
          </span>
        </div>
        <div style={{ display:"flex", gap:5 }}>
          {run.issues.some(c => (c.Key||"").toUpperCase()==="YES") && (
            <span style={{ background:"#fff8e0", color:"#8a6000", border:"1px solid #d4a800",
              borderRadius:3, padding:"1px 6px", fontSize:"0.62rem",
              fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>
              {run.issues.filter(c => (c.Key||"").toUpperCase()==="YES").length} KEY
            </span>
          )}
          {run.issues.some(c => (c.Signed||"").toUpperCase()==="YES") && (
            <span style={{ background:"var(--green-bg)", color:"var(--green-text)", border:"1px solid #c8e6c8",
              borderRadius:3, padding:"1px 6px", fontSize:"0.62rem",
              fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>SGD</span>
          )}
        </div>
        <span style={{ color:"var(--muted)", fontSize:"0.75rem", flexShrink:0 }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div style={{ borderTop:"1px solid var(--border)", padding:"10px 14px" }}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
            {run.issues.map((c, i) => {
              const isKey    = (c.Key||"").toUpperCase()==="YES";
              const isSigned = (c.Signed||"").toUpperCase()==="YES";
              return (
                <div key={i} title={c.Key_Reason || c.Arc} style={{
                  background: isKey ? "#fff8e0" : "var(--surface2)",
                  border: isKey ? "1.5px solid #d4a800" : "1.5px solid var(--border)",
                  borderRadius:4, padding:"3px 8px", fontSize:"0.78rem",
                  fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"0.5px",
                  color: isKey ? "#8a6000" : "var(--text2)",
                  position:"relative",
                }}>
                  #{c.Issue}
                  {isKey && <span style={{ color:"#c8102e", marginLeft:3 }}>★</span>}
                  {isSigned && <span style={{ color:"#22c55e", marginLeft:2 }}>✍</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
