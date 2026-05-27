import { useState, useMemo, useEffect, useRef } from "react";
import { DATA3 } from "@/data/data3";
import { pubColors } from "@/utils/coverThumbnails";

const comics = DATA3.comics;
const boxes  = DATA3.boxes;

function parseIssueNum(s: string): number {
  const n = parseFloat(String(s || "").replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 9999 : n;
}

function titleColor(index: number): string {
  const hue = (index * 137.508) % 360;
  const sat = 60 + (index % 3) * 10;
  const lit = 48 + (index % 4) * 5;
  return `hsl(${Math.round(hue)},${sat}%,${lit}%)`;
}

function getBoxComics(boxNum: string) {
  return comics.filter(c => {
    const bClean = String(c.Box || "").trim().replace(/^0+/, "");
    const bNum   = boxNum.replace(/^BOX\s*/i, "").replace(/^0+/, "");
    return bClean === bNum;
  });
}

interface TitleGroup {
  title: string;
  color: string;
  issues: typeof comics;
  keyCount: number;
  signedCount: number;
}

function buildGroups(comicsList: typeof comics): TitleGroup[] {
  const byTitle: Record<string, typeof comics> = {};
  for (const c of comicsList) {
    if (!byTitle[c.Title]) byTitle[c.Title] = [];
    byTitle[c.Title].push(c);
  }
  const titles = Object.keys(byTitle).sort((a, b) => a.localeCompare(b));
  return titles.map((title, i) => {
    const issues = byTitle[title].sort((a, b) => parseIssueNum(a.Issue) - parseIssueNum(b.Issue));
    return {
      title,
      color: titleColor(i),
      issues,
      keyCount: issues.filter(c => (c.Key || "").toUpperCase() === "YES").length,
      signedCount: issues.filter(c => (c.Signed || "").toUpperCase() === "YES").length,
    };
  });
}

function CountUp({ end, duration = 1000 }: { end: number; duration?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (end <= 0) return;
    const steps   = Math.min(end, 60);
    const stepMs  = duration / steps;
    let current   = 0;
    const timer   = setInterval(() => {
      current = Math.min(end, current + Math.ceil(end / steps));
      setVal(current);
      if (current >= end) clearInterval(timer);
    }, stepMs);
    return () => clearInterval(timer);
  }, [end, duration]);
  return <>{val || end}</>;
}

export default function BoxVisual({ initBox }: { initBox?: string } = {}) {
  const [selectedBox,   setSelectedBox]   = useState<string | null>(initBox || null);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [sorted,        setSorted]        = useState(false);
  const [view,          setView]          = useState<"visual" | "runs">("visual");
  const [hoveredBox,   setHoveredBox]   = useState<string | null>(null);
  const [panelPos,     setPanelPos]     = useState({ x: 0, y: 0 });
  const [hoveredSpine, setHoveredSpine] = useState<{title:string;issue:string;year?:string;publisher?:string;writer?:string;isKey:boolean;isSigned:boolean;x:number;y:number}|null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const boxComics = useMemo(() =>
    selectedBox ? getBoxComics(selectedBox) : [],
  [selectedBox]);

  const titleGroups = useMemo(() => buildGroups(boxComics), [boxComics]);

  const titleColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const g of titleGroups) m[g.title] = g.color;
    return m;
  }, [titleGroups]);

  const displayComics = useMemo(() => {
    if (sorted) return titleGroups.flatMap(g => g.issues);
    return boxComics;
  }, [sorted, boxComics, titleGroups]);

  function selectBox(num: string) {
    setSelectedBox(num);
    setSelectedTitle(null);
    setView("visual");
    setSorted(false);
  }

  useEffect(() => {
    if (!selectedBox) return;
    const el = detailRef.current;
    if (!el) return;
    setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }, [selectedBox]);

  const selectedBoxData    = boxes.find(b => b.Num === selectedBox);
  const selectedTitleGroup = titleGroups.find(g => g.title === selectedTitle);
  const hoveredBoxData     = boxes.find(b => b.Num === hoveredBox);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "18px 18px 60px" }}>

      {/* Intro label */}
      <div style={{ marginBottom: 14, fontFamily: "'Bebas Neue',sans-serif",
        fontSize: "0.75rem", letterSpacing: "2px", color: "var(--muted)" }}>
        SELECT A BOX TO VISUALIZE ITS CONTENTS
      </div>

      {/* Box grid — sectioned by publisher */}
      {(() => {
        const sorted_ = [...boxes]
          .filter(b => Number(b.Num.replace(/\D/g,"")) > 0)
          .sort((a,b) => Number(a.Num.replace(/\D/g,"")) - Number(b.Num.replace(/\D/g,"")));

        function getGroup(num: string): string {
          const n = Number(num.replace(/\D/g,""));
          if (n === 1)           return "inventory";
          if (n >= 2  && n <= 41) return "marvel";
          if (n >= 42 && n <= 63) return "dc";
          if (n >= 64 && n <= 67) return "other";
          if (n >= 68 && n <= 71) return "mixed";
          return "tpb";
        }

        const SECTIONS: { key: string; label: string; subtitle: string; color: string; bg: string }[] = [
          { key:"inventory", label:"INVENTORY",        subtitle:"Key & signed books — CGC candidates",       color:"#c8102e",  bg:"#fff5f5"  },
          { key:"marvel",    label:"MARVEL",           subtitle:"Boxes 2–41 · 40 boxes",                     color:"#c8102e",  bg:"#fff8f8"  },
          { key:"dc",        label:"DC",               subtitle:"Boxes 42–63 · 22 boxes",                    color:"#1d6fa4",  bg:"#f4f8fd"  },
          { key:"other",     label:"INDEPENDENT",      subtitle:"Boxes 64–67 · Image, IDW, Vertigo & more",  color:"#16a34a",  bg:"#f3faf4"  },
          { key:"mixed",     label:"MIXED",            subtitle:"Boxes 68–71 · Multi-publisher",             color:"#7c3aed",  bg:"#f7f4fe"  },
          { key:"tpb",       label:"VARIANTS & TPB",   subtitle:"Boxes 72–74 · Foils, connecting sets, TPBs",color:"#d97706",  bg:"#fffbf0"  },
        ];

        let globalIdx = 0;
        return (
          <div style={{ marginBottom: 24, display:"flex", flexDirection:"column", gap:18 }}>
            {SECTIONS.map(sec => {
              const secBoxes = sorted_.filter(b => getGroup(b.Num) === sec.key);
              if (secBoxes.length === 0) return null;
              const secComics = secBoxes.reduce((s,b) => s + Number(b.Comics), 0);
              const secKeys   = secBoxes.reduce((s,b) => s + Number(b.Keys),   0);
              return (
                <div key={sec.key}>
                  {/* Section header */}
                  <div style={{
                    display:"flex", alignItems:"baseline", gap:10, marginBottom:8,
                    borderBottom:`2px solid ${sec.color}22`, paddingBottom:6,
                  }}>
                    <span style={{
                      fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem",
                      letterSpacing:"3px", color:sec.color,
                    }}>{sec.label}</span>
                    <span style={{ fontSize:"0.68rem", color:"var(--muted2)", fontFamily:"'Crimson Pro',serif" }}>
                      {sec.subtitle}
                    </span>
                    <span style={{
                      marginLeft:"auto", fontFamily:"'Bebas Neue',sans-serif",
                      fontSize:"0.65rem", letterSpacing:"1.5px", color:"var(--muted)",
                    }}>
                      {secComics.toLocaleString()} books · {secKeys} keys
                    </span>
                  </div>
                  {/* Boxes */}
                  <div className="boxes-grid">
                    {secBoxes.map(b => {
                      const idx        = globalIdx++;
                      const isSelected = selectedBox === b.Num;
                      const lowBook    = Number(b.Comics) < 100;
                      return (
                        <div
                          key={b.Num}
                          onClick={() => selectBox(b.Num)}
                          onMouseEnter={e => {
                            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setPanelPos({ x: r.right + 10, y: r.top });
                            setHoveredBox(b.Num);
                          }}
                          onMouseLeave={() => setHoveredBox(null)}
                          className="box-tile"
                          style={{
                            animationDelay: `${idx * 0.018}s`,
                            ...(isSelected ? {
                              borderColor: sec.color,
                              background: sec.bg,
                              boxShadow: `0 4px 14px ${sec.color}38`,
                              transform: "translateY(-2px)",
                            } : {}),
                            ...(lowBook && !isSelected ? {
                              borderColor: "#d6456a",
                              background: "#fdf0f4",
                            } : {}),
                          }}
                        >
                          <div className="box-tile-count">{b.Comics}</div>
                          <div className="box-tile-num">{b.Num.replace("BOX ", "Box ")}</div>
                          {Number(b.Keys)   > 0 && <div className="box-tile-keys">{b.Keys}k</div>}
                          {Number(b.Signed) > 0 && <div className="box-tile-sgn">{b.Signed}s</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Hover floating panel */}
      {hoveredBox && hoveredBoxData && (
        <div style={{
          position:"fixed",
          left: Math.min(panelPos.x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 290),
          top:  Math.max(60, Math.min(panelPos.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 330)),
          zIndex:500, background:"#fff",
          border:"1.5px solid var(--border)", borderRadius:8,
          padding:"14px 16px", width:268,
          boxShadow:"0 8px 32px rgba(0,0,0,0.14)",
          pointerEvents:"none",
        }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.15rem", color:"var(--red)", letterSpacing:"2px", lineHeight:1 }}>{hoveredBoxData.Num}</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", color:"var(--muted2)", letterSpacing:"1px", marginBottom:10 }}>
            {hoveredBoxData.Label.replace(/^Box \d+ — /i,"")}
          </div>
          <div style={{ display:"flex", gap:20, marginBottom:10 }}>
            {([
              { val:hoveredBoxData.Comics, lbl:"BOOKS"  },
              { val:hoveredBoxData.Keys,   lbl:"KEYS"   },
              { val:hoveredBoxData.Signed, lbl:"SIGNED" },
            ]).map(s => (
              <div key={s.lbl} style={{ textAlign:"center" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.3rem", color:"var(--red)", lineHeight:1 }}>{s.val}</div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.55rem", letterSpacing:"2px", color:"var(--muted)", marginTop:1 }}>{s.lbl}</div>
              </div>
            ))}
          </div>
          {hoveredBoxData.Notes && (
            <div style={{ fontSize:"0.78rem", color:"var(--muted2)", lineHeight:1.5, borderTop:"1px solid var(--border)", paddingTop:8 }}>
              {hoveredBoxData.Notes}
            </div>
          )}
          {hoveredBoxData.YearRange && (
            <div style={{ fontSize:"0.65rem", color:"var(--muted)", marginTop:6 }}>
              {hoveredBoxData.YearRange}
            </div>
          )}
          <div style={{ fontSize:"0.6rem", color:"var(--muted)", marginTop:8, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1.5px", opacity:0.65 }}>
            CLICK TO EXPLORE →
          </div>
        </div>
      )}

      {/* Empty state */}
      {!selectedBox && (
        <div style={{ textAlign: "center", color: "var(--muted)", padding: "60px 20px",
          fontFamily: "'Bebas Neue',sans-serif", fontSize: "1rem", letterSpacing: "2px" }}>
          TAP ANY BOX ABOVE TO SEE ITS CONTENTS
        </div>
      )}

      {/* Box detail */}
      {selectedBox && selectedBoxData && (
        <div ref={detailRef}>
          {/* Box header */}
          <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)",
            borderRadius: 8, padding: "14px 18px", marginBottom: 14,
            display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.4rem",
                color: "var(--red)", letterSpacing: "2px", lineHeight: 1 }}>
                {selectedBoxData.Num}
              </div>
              <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--brown-light)", marginTop: 3 }}>
                {selectedBoxData.Label.replace(/^Box \d+ — /i, "")}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: 4 }}>
                {selectedBoxData.YearRange}
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
              {[
                { val: boxComics.length,       lbl: "COMICS" },
                { val: selectedBoxData.Keys,   lbl: "KEYS" },
                { val: selectedBoxData.Signed, lbl: "SIGNED" },
                { val: titleGroups.length,     lbl: "TITLES" },
              ].map(s => (
                <div key={s.lbl} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.3rem",
                    color: "var(--red)", letterSpacing: "1px", lineHeight: 1 }}>{s.val}</div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.58rem",
                    letterSpacing: "1.5px", color: "var(--muted)", marginTop: 2 }}>{s.lbl}</div>
                </div>
              ))}
            </div>
          </div>

          {/* View toggle */}
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            {(["visual", "runs"] as const).map(v => (
              <button key={v} onClick={() => { setView(v); setSelectedTitle(null); }} style={{
                background: view === v ? "var(--red)" : "var(--surface)",
                color: view === v ? "#fff" : "var(--muted2)",
                border: view === v ? "1.5px solid var(--red)" : "1.5px solid var(--border)",
                borderRadius: 5, padding: "6px 18px", cursor: "pointer",
                fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.78rem", letterSpacing: "1.5px",
                transition: "all 0.15s",
              }}>
                {v === "visual" ? "Visual Box" : "By Run"}
              </button>
            ))}

            {view === "visual" && (
              <button onClick={() => { setSorted(s => !s); setSelectedTitle(null); }} style={{
                background: sorted ? "#1a1a2e" : "var(--surface)",
                color: sorted ? "#a78bfa" : "var(--muted2)",
                border: sorted ? "1.5px solid #a78bfa" : "1.5px solid var(--border)",
                borderRadius: 5, padding: "6px 18px", cursor: "pointer",
                fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.78rem", letterSpacing: "1.5px",
                transition: "all 0.15s",
                marginLeft: "auto",
              }}>
                {sorted ? "SORTED BY TITLE" : "BOX ORDER"}
              </button>
            )}
          </div>

          {/* Title index — ABOVE the visual, sorted view only */}
          {view === "visual" && sorted && titleGroups.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, padding: "8px 10px", background: "var(--surface2)", borderRadius: 6, border: "1px solid var(--border)" }}>
              <div style={{ width:"100%", fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem", letterSpacing:"2px", color:"var(--muted)", marginBottom:3 }}>
                CLICK A TITLE TO HIGHLIGHT — {titleGroups.length} TITLES
              </div>
              {titleGroups.map((g, i) => (
                <button key={i}
                  onClick={() => setSelectedTitle(selectedTitle === g.title ? null : g.title)}
                  style={{
                    background: selectedTitle === g.title ? g.color : "var(--surface)",
                    border: `1.5px solid ${g.color}`,
                    borderRadius: 4, padding: "3px 10px", cursor: "pointer",
                    fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem",
                    letterSpacing: "0.5px",
                    color: selectedTitle === g.title ? "#fff" : g.color,
                    transition: "all 0.12s",
                    maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                  {g.title}
                  <span style={{ opacity: 0.7, marginLeft: 5 }}>{g.issues.length}</span>
                </button>
              ))}
            </div>
          )}

          {/* ── VISUAL VIEW ─────────────────────────────────────────────────── */}
          {view === "visual" && (
            <div style={{ display: "grid",
              gridTemplateColumns: selectedTitle ? "1fr 300px" : "1fr",
              gap: 16, alignItems: "start" }}>

              <div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.68rem",
                  letterSpacing: "2px", color: "var(--muted)", marginBottom: 8 }}>
                  {sorted
                    ? `${titleGroups.length} TITLES · SORTED ALPHABETICALLY · CLICK A GROUP TO INSPECT`
                    : `${boxComics.length} COMICS IN BOX ORDER · COLORED BY TITLE · CLICK ANY SPINE`}
                </div>

                {/* Box graphic — horizontal scroll */}
                <div key={selectedBox} style={{
                  background: "#f0ede8",
                  border: "3px solid #ccc9c2",
                  borderTop: "8px solid #b0aca4",
                  borderBottom: "10px solid #d4d0c8",
                  borderRadius: "4px 4px 2px 2px",
                  padding: "20px 16px 14px",
                  overflowX: "auto",
                  position: "relative",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                }}>
                  <div style={{ position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)",
                    fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem",
                    letterSpacing: "3px", color: "#666" }}>
                    {selectedBoxData.Num} · {boxComics.length} COMICS
                  </div>

                  {sorted ? (
                    /* ── SORTED: groups with labels ── */
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, minWidth: "max-content" }}>
                      {titleGroups.map((group, gi) => {
                        const isActive = selectedTitle === group.title;
                        const hasSel   = !!selectedTitle;
                        return (
                          <div key={gi}
                            onClick={() => setSelectedTitle(isActive ? null : group.title)}
                            title={group.title}
                            style={{ display: "flex", flexDirection: "column", alignItems: "center",
                              gap: 4, cursor: "pointer", opacity: hasSel && !isActive ? 0.22 : 1,
                              transition: "opacity 0.15s",
                            }}>
                            {/* Title label — rotated */}
                            <div style={{
                              writingMode: "vertical-rl",
                              transform: "rotate(180deg)",
                              fontSize: "0.6rem",
                              fontFamily: "'Bebas Neue',sans-serif",
                              letterSpacing: "1px",
                              color: isActive ? group.color : "#888",
                              maxHeight: 80,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              marginBottom: 4,
                              transition: "color 0.15s",
                            }}>
                              {group.title}
                            </div>
                            {/* Spines */}
                            <div style={{ display: "flex", gap: "1px", alignItems: "flex-end" }}>
                              {group.issues.map((c, ci) => {
                                const isKey    = (c.Key    || "").toUpperCase() === "YES";
                                const isSigned = (c.Signed || "").toUpperCase() === "YES";
                                return (
                                  <div key={ci}
                                    onMouseEnter={e => { const r = e.currentTarget.getBoundingClientRect(); setHoveredSpine({title:c.Title,issue:c.Issue,year:c.Year,publisher:c.Publisher,writer:c.Writer,isKey,isSigned,x:r.left+r.width/2,y:r.top}); }}
                                    onMouseLeave={() => setHoveredSpine(null)}
                                    style={{
                                      width: 5,
                                      height: isKey ? 200 : 160,
                                      background: group.color,
                                      borderTop: isKey ? "3px solid #fbbf24" : undefined,
                                      boxShadow: isSigned ? "inset 2px 0 0 #22c55e" : undefined,
                                      borderRadius: "1px 1px 0 0",
                                      flexShrink: 0,
                                      cursor: "crosshair",
                                      animationName: "spineIn",
                                      animationDuration: "0.28s",
                                      animationFillMode: "both",
                                      animationDelay: `${ci * 0.007}s`,
                                    }}
                                  />
                                );
                              })}
                            </div>
                            {/* Count badge */}
                            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.55rem",
                              letterSpacing: "0.5px", color: isActive ? group.color : "#555",
                              marginTop: 2, transition: "color 0.15s" }}>
                              {group.issues.length}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* ── UNSORTED: box order, publisher-coloured gradient ── */
                    <div style={{ display: "flex", gap: "1px", alignItems: "flex-end", minWidth: "max-content" }}>
                      {displayComics.map((c, i) => {
                        const pc       = pubColors(c.Publisher);
                        const hash     = [...(c.Title||"")].reduce((a,ch)=>a+ch.charCodeAt(0),0);
                        const hue      = hash % 360;
                        const isKey    = (c.Key    || "").toUpperCase() === "YES";
                        const isSigned = (c.Signed || "").toUpperCase() === "YES";
                        const isSel    = selectedTitle === c.Title;
                        const hasSel   = !!selectedTitle;
                        return (
                          <div key={i}
                            onMouseEnter={e => { const r = e.currentTarget.getBoundingClientRect(); setHoveredSpine({title:c.Title,issue:c.Issue,year:c.Year,publisher:c.Publisher,writer:c.Writer,isKey,isSigned,x:r.left+r.width/2,y:r.top}); }}
                            onMouseLeave={() => setHoveredSpine(null)}
                            onClick={() => setSelectedTitle(isSel ? null : c.Title)}
                            style={{
                              width: 5,
                              height: isKey ? 200 : 160,
                              background: `linear-gradient(to right, ${pc.bg}, hsl(${hue},40%,20%))`,
                              opacity: hasSel && !isSel ? 0.15 : 1,
                              borderTop: isKey ? `3px solid ${pc.accent}` : undefined,
                              boxShadow: isSigned ? "inset 2px 0 0 #22c55e" : undefined,
                              borderRadius: "1px 1px 0 0",
                              cursor: "pointer",
                              flexShrink: 0,
                              transition: "opacity 0.12s",
                              animationName: "spineIn",
                              animationDuration: "0.28s",
                              animationFillMode: "both",
                              animationDelay: `${i * 0.007}s`,
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Legend */}
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10,
                  fontSize: "0.7rem", fontFamily: "'Bebas Neue',sans-serif",
                  letterSpacing: "1px", color: "var(--muted)" }}>
                  <span>
                    <span style={{ display:"inline-block", width:5, height:14, background:"#888",
                      verticalAlign:"middle", borderTop:"3px solid #fbbf24", marginRight:4, borderRadius:"1px 1px 0 0" }} />
                    KEY (tall + gold top)
                  </span>
                  <span>
                    <span style={{ display:"inline-block", width:5, height:14, background:"#22c55e",
                      verticalAlign:"middle", marginRight:4, borderRadius:"1px 1px 0 0" }} />
                    SIGNED (green left edge)
                  </span>
                  <span style={{ color: "var(--muted2)" }}>
                    each colour = one title · click to select
                  </span>
                </div>

              </div>

              {/* ── Title detail panel ── */}
              {selectedTitle && selectedTitleGroup && (
                <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)",
                  borderRadius: 8, padding: "16px", position: "sticky", top: 170 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.6rem",
                      letterSpacing: "2px", color: selectedTitleGroup.color }}>TITLE DETAIL</div>
                    <button onClick={() => setSelectedTitle(null)} style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--muted)", fontSize: "1rem", lineHeight: 1, padding: 0 }}>✕</button>
                  </div>

                  <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--brown-light)",
                    lineHeight: 1.3, marginBottom: 8, borderLeft: `3px solid ${selectedTitleGroup.color}`,
                    paddingLeft: 10 }}>
                    {selectedTitleGroup.title}
                  </div>

                  <div style={{ display: "flex", gap: 14, marginBottom: 12 }}>
                    {[
                      { val: selectedTitleGroup.issues.length, lbl: "ISSUES" },
                      { val: selectedTitleGroup.keyCount,      lbl: "KEYS" },
                      { val: selectedTitleGroup.signedCount,   lbl: "SIGNED" },
                    ].map(s => (
                      <div key={s.lbl} style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.2rem",
                          color: "var(--red)", lineHeight: 1 }}>{s.val}</div>
                        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.55rem",
                          letterSpacing: "1.5px", color: "var(--muted)", marginTop: 2 }}>{s.lbl}</div>
                      </div>
                    ))}
                  </div>

                  {/* Publisher / Writer / Artist from first issue */}
                  {(() => {
                    const first = selectedTitleGroup.issues[0];
                    return (
                      <div style={{ marginBottom: 12 }}>
                        {[
                          { l: "Publisher", v: first.Publisher },
                          { l: "Writer",    v: first.Writer },
                          { l: "Artist",    v: first.Artist },
                          { l: "Era",       v: first.Era },
                        ].filter(r => r.v).map(r => (
                          <div key={r.l} style={{ display: "flex", gap: 8, marginBottom: 3, fontSize: "0.78rem" }}>
                            <span style={{ color: "var(--muted)", minWidth: 60, flexShrink: 0, fontSize: "0.7rem" }}>{r.l}</span>
                            <span style={{ color: "var(--text2)", lineHeight: 1.4 }}>{r.v.slice(0, 80)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Issue list */}
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.6rem",
                    letterSpacing: "1.5px", color: "var(--muted)", marginBottom: 6 }}>
                    ISSUES IN THIS BOX
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxHeight: 260, overflowY: "auto" }}>
                    {selectedTitleGroup.issues.map((c, i) => {
                      const isKey    = (c.Key    || "").toUpperCase() === "YES";
                      const isSigned = (c.Signed || "").toUpperCase() === "YES";
                      return (
                        <div key={i} title={c.Key_Reason || c.Arc} style={{
                          background: isKey ? "#fff8e0" : "var(--surface2)",
                          border: `1.5px solid ${isKey ? "#d4a800" : "var(--border)"}`,
                          borderRadius: 4, padding: "3px 8px",
                          fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.75rem",
                          letterSpacing: "0.5px", color: isKey ? "#8a6000" : "var(--text2)",
                        }}>
                          #{c.Issue}
                          {isKey    && <span style={{ color: "#c8102e",  marginLeft: 3 }}>★</span>}
                          {isSigned && <span style={{ color: "#22c55e",  marginLeft: 2 }}>✍</span>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Key reasons */}
                  {selectedTitleGroup.issues.some(c => c.Key_Reason) && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.6rem",
                        letterSpacing: "1.5px", color: "var(--muted)", marginBottom: 6 }}>KEY NOTES</div>
                      {selectedTitleGroup.issues.filter(c => c.Key_Reason).map((c, i) => (
                        <div key={i} style={{ fontSize: "0.75rem", color: "var(--text2)",
                          lineHeight: 1.4, marginBottom: 5, paddingLeft: 8,
                          borderLeft: "2px solid #d4a800" }}>
                          <span style={{ color: "#8a6000", fontWeight: 600 }}>#{c.Issue}</span> — {c.Key_Reason.slice(0, 120)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── RUNS VIEW ───────────────────────────────────────────────────── */}
          {view === "runs" && (
            <div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.7rem",
                letterSpacing: "2px", color: "var(--muted)", marginBottom: 12 }}>
                {titleGroups.length} TITLE{titleGroups.length !== 1 ? "S" : ""} IN THIS BOX — ALPHABETICAL
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {titleGroups.map((group, gi) => (
                  <RunBlock key={gi} group={group} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {hoveredSpine && (
        <div style={{
          position:"fixed", left:hoveredSpine.x, top:hoveredSpine.y - 10,
          transform:"translateX(-50%) translateY(-100%)",
          background:"#fff",
          borderRadius:8,
          padding:"10px 14px",
          zIndex:900, pointerEvents:"none",
          boxShadow:"0 6px 28px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08)",
          border:"1.5px solid var(--border)",
          borderTop:"3px solid var(--red)",
          whiteSpace:"nowrap",
          minWidth:160,
        }}>
          <div style={{
            fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.78rem",
            letterSpacing:"1.5px", color:"var(--red)", marginBottom:3,
          }}>
            {hoveredSpine.title}
          </div>
          <div style={{
            fontFamily:"'Crimson Pro',serif", fontSize:"0.85rem",
            color:"var(--text2)", display:"flex", alignItems:"center", gap:6, flexWrap:"wrap",
          }}>
            <span style={{color:"var(--muted)"}}>#{hoveredSpine.issue}</span>
            {hoveredSpine.year && <span style={{color:"var(--muted2)", fontSize:"0.78rem"}}>{hoveredSpine.year}</span>}
            {hoveredSpine.isKey && (
              <span style={{
                background:"#fff8e0", color:"#8a6000",
                border:"1px solid #d4a800", borderRadius:3,
                padding:"1px 6px", fontSize:"0.62rem",
                fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
              }}>★ KEY</span>
            )}
            {hoveredSpine.isSigned && (
              <span style={{
                background:"#f0faf0", color:"#1a7a1a",
                border:"1px solid #c8e6c8", borderRadius:3,
                padding:"1px 6px", fontSize:"0.62rem",
                fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
              }}>✍ SGD</span>
            )}
          </div>
          {hoveredSpine.publisher && (
            <div style={{ fontSize:"0.68rem", color:"var(--muted)", marginTop:4, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>
              {hoveredSpine.publisher}
              {hoveredSpine.writer && <span style={{ marginLeft:6, color:"var(--muted2)" }}>{hoveredSpine.writer}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RunBlock({ group }: { group: TitleGroup }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 6,
      borderLeft: `3px solid ${group.color}` }}>
      <div onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
        cursor: "pointer" }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--brown-light)" }}>{group.title}</span>
          <span style={{ fontSize: "0.78rem", color: "var(--muted)", marginLeft: 8 }}>
            {group.issues.length} issue{group.issues.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          {group.keyCount > 0 && (
            <span style={{ background: "#fff8e0", color: "#8a6000", border: "1px solid #d4a800",
              borderRadius: 3, padding: "1px 6px", fontSize: "0.62rem",
              fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "1px" }}>
              {group.keyCount} KEY
            </span>
          )}
          {group.signedCount > 0 && (
            <span style={{ background: "var(--green-bg)", color: "var(--green-text)", border: "1px solid #c8e6c8",
              borderRadius: 3, padding: "1px 6px", fontSize: "0.62rem",
              fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "1px" }}>SGD</span>
          )}
        </div>
        <span style={{ color: "var(--muted)", fontSize: "0.75rem", flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "10px 14px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {group.issues.map((c, i) => {
              const isKey    = (c.Key    || "").toUpperCase() === "YES";
              const isSigned = (c.Signed || "").toUpperCase() === "YES";
              return (
                <div key={i} title={c.Key_Reason || c.Arc} style={{
                  background: isKey ? "#fff8e0" : "var(--surface2)",
                  border: isKey ? "1.5px solid #d4a800" : "1.5px solid var(--border)",
                  borderRadius: 4, padding: "3px 8px", fontSize: "0.78rem",
                  fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.5px",
                  color: isKey ? "#8a6000" : "var(--text2)",
                }}>
                  #{c.Issue}
                  {isKey    && <span style={{ color: "#c8102e", marginLeft: 3 }}>★</span>}
                  {isSigned && <span style={{ color: "#22c55e", marginLeft: 2 }}>✍</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
