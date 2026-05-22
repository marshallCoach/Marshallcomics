import { useState, useMemo, useRef } from "react";
import { DATA3 } from "@/data/data3";

const comics = DATA3.comics;
const boxes  = DATA3.boxes;

function parseIssueNum(s: string): number {
  const n = parseFloat(String(s ?? "").replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 9999 : n;
}

function nb(s: string | number): string {
  return String(s || "").trim().replace(/^BOX\s*/i, "").replace(/^0+/, "") || "0";
}

function titleColor(index: number): string {
  const hue = (index * 137.508) % 360;
  return `hsl(${Math.round(hue)},${60 + (index % 3) * 10}%,${48 + (index % 4) * 5}%)`;
}
const ALL_TITLES = Array.from(new Set(comics.map(c => c.Title))).sort();
const TITLE_COLOR: Record<string, string> = {};
ALL_TITLES.forEach((t, i) => { TITLE_COLOR[t] = titleColor(i); });

const QUICK_HUNTS = ["Steranko", "Falcon", "X-Men", "Miller", "Punisher", "Brubaker", "Kirby", "Denny O'Neil"];

export default function BoxHunt() {
  const [query,       setQuery]       = useState("");
  const [selectedBox, setSelectedBox] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim().toLowerCase();
  const hasQuery = trimmed.length >= 2;

  const matches = useMemo(() => {
    if (!hasQuery) return [];
    return comics.filter(c =>
      [c.Title, c.Issue, c.Writer, c.Artist, c.Arc, c.Key_Reason, c.First_App, c.Publisher, c.Seller_Notes]
        .join(" ").toLowerCase().includes(trimmed)
    );
  }, [trimmed, hasQuery]);

  const matchesByBox = useMemo(() => {
    const m: Record<string, typeof comics> = {};
    for (const c of matches) {
      const k = nb(String(c.Box));
      if (!m[k]) m[k] = [];
      m[k].push(c);
    }
    return m;
  }, [matches]);

  const boxComics = useMemo(() => {
    if (!selectedBox) return [];
    const target = nb(selectedBox);
    return comics.filter(c => nb(String(c.Box)) === target);
  }, [selectedBox]);

  const matchSet = useMemo(() => {
    if (!selectedBox) return new Set<string>();
    const key = nb(selectedBox);
    return new Set((matchesByBox[key] || []).map(c => `${c.Title}|${c.Issue}`));
  }, [selectedBox, matchesByBox]);

  const selectedBoxData    = boxes.find(b => b.Num === selectedBox);
  const selectedBoxMatches = useMemo(() => {
    if (!selectedBox) return [];
    const key = nb(selectedBox);
    return (matchesByBox[key] || []).slice().sort((a, b) => parseIssueNum(a.Issue) - parseIssueNum(b.Issue));
  }, [selectedBox, matchesByBox]);

  function clearSearch() {
    setQuery("");
    setSelectedBox(null);
    inputRef.current?.focus();
  }

  const sortedMatches = useMemo(() =>
    matches.slice().sort((a, b) => {
      const ba = Number(a.Box) || 0, bb = Number(b.Box) || 0;
      return ba !== bb ? ba - bb : parseIssueNum(a.Issue) - parseIssueNum(b.Issue);
    })
  , [matches]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "18px 18px 60px" }}>

      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "2.2rem",
          letterSpacing: "5px", color: "var(--red)", lineHeight: 1 }}>
          BOX HUNT
        </div>
        <div style={{ fontSize: "0.95rem", color: "var(--muted2)", marginTop: 5,
          fontFamily: "'Crimson Pro', serif", lineHeight: 1.5 }}>
          Know the title. Find the box. Dig it out. Your whole collection, searchable by anything.
        </div>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <div style={{ position:"absolute", left:16, top:"50%", transform:"translateY(-50%)",
          color:"var(--muted)", fontSize:"1rem", pointerEvents:"none" }}>🔍</div>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedBox(null); }}
          placeholder="Search title, issue #, writer, arc, key reason, first appearance…"
          autoFocus
          style={{
            width: "100%", boxSizing: "border-box",
            fontSize: "1.05rem", padding: "14px 48px 14px 44px",
            border: "2px solid var(--border)", borderRadius: 8,
            fontFamily: "'Crimson Pro', serif",
            background: "#fff", color: "var(--text2)",
            outline: "none", transition: "border-color 0.15s, box-shadow 0.15s",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
          onFocus={e => { e.currentTarget.style.borderColor = "var(--red)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(200,16,46,0.12)"; }}
          onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)"; }}
        />
        {query && (
          <button onClick={clearSearch} style={{
            position:"absolute", right:14, top:"50%", transform:"translateY(-50%)",
            background:"none", border:"none", cursor:"pointer", color:"var(--muted)",
            fontSize:"1rem", lineHeight:1, padding:"4px" }}>
            ✕
          </button>
        )}
      </div>

      {/* Quick hunts */}
      {!hasQuery && (
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:24 }}>
          {QUICK_HUNTS.map(term => (
            <button key={term} onClick={() => setQuery(term)} style={{
              background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:20,
              padding:"5px 14px", fontSize:"0.8rem", color:"var(--muted2)", cursor:"pointer",
              fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1.5px",
              transition:"all 0.12s",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--red)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--red)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--muted2)"; }}
            >{term}</button>
          ))}
        </div>
      )}

      {/* Results count */}
      {hasQuery && (
        <div style={{ marginBottom: 16, fontFamily:"'Bebas Neue',sans-serif",
          fontSize:"0.78rem", letterSpacing:"2.5px",
          color: matches.length === 0 ? "var(--muted)" : "var(--red)" }}>
          {matches.length === 0
            ? "NO MATCHES — TRY DIFFERENT KEYWORDS"
            : `${matches.length} BOOK${matches.length !== 1 ? "S" : ""} · ${Object.keys(matchesByBox).length} BOX${Object.keys(matchesByBox).length !== 1 ? "ES" : ""} · ${matches.filter(c => (c.Key||"").toUpperCase()==="YES").length} KEYS`}
        </div>
      )}

      {/* Box grid — hit map */}
      {hasQuery && matches.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem",
            letterSpacing:"2px", color:"var(--muted)", marginBottom:10 }}>
            BOXES WITH MATCHES HIGHLIGHTED — CLICK ANY TO DIG
          </div>
          <div className="boxes-grid">
            {boxes.map(b => {
              const hitCount  = matchesByBox[nb(b.Num)]?.length || 0;
              const isHit     = hitCount > 0;
              const isSelected = selectedBox === b.Num;
              return (
                <div key={b.Num}
                  onClick={() => isHit && setSelectedBox(isSelected ? null : b.Num)}
                  className="box-tile"
                  style={{
                    opacity: isHit ? 1 : 0.18,
                    cursor: isHit ? "pointer" : "default",
                    position: "relative",
                    ...(isSelected ? {
                      borderColor:"var(--red)", background:"#fef2f2",
                      boxShadow:"0 4px 14px rgba(200,16,46,0.25)",
                      transform:"translateY(-3px)",
                    } : isHit ? {
                      borderColor:"var(--red)", background:"#fff6f6",
                    } : {}),
                  }}
                >
                  <div className="box-tile-count"
                    style={{ color: isHit ? "var(--red)" : undefined, fontSize: isHit ? "1.1rem" : undefined }}>
                    {isHit ? hitCount : b.Comics}
                  </div>
                  <div className="box-tile-num">{b.Num.replace("BOX ","Box ")}</div>
                  {isHit && (
                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.52rem",
                      letterSpacing:"1px", color:"var(--red)", marginTop:1 }}>
                      {hitCount === 1 ? "1 HIT" : `${hitCount} HITS`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasQuery && (
        <div style={{ textAlign:"center", padding:"50px 20px 20px" }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.4rem",
            letterSpacing:"4px", color:"var(--muted)", marginBottom:10 }}>
            WHAT ARE YOU HUNTING?
          </div>
          <div style={{ fontSize:"0.95rem", color:"var(--muted2)", fontFamily:"'Crimson Pro', serif",
            maxWidth:460, margin:"0 auto", lineHeight:1.7 }}>
            Type any title, writer, arc, character, or key reason above. 
            The boxes that contain matches will light up. Click one to see its spine — your book will be highlighted in red.
          </div>
        </div>
      )}

      {/* Selected box dig view */}
      {selectedBox && selectedBoxData && (
        <div style={{ marginBottom: 32 }}>

          {/* Box header */}
          <div style={{ background:"var(--surface)", border:"2px solid var(--red)",
            borderRadius:8, padding:"14px 18px", marginBottom:16,
            display:"flex", alignItems:"flex-start", gap:16, flexWrap:"wrap" }}>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.5rem",
                color:"var(--red)", letterSpacing:"2px", lineHeight:1 }}>
                {selectedBoxData.Num}
              </div>
              <div style={{ fontSize:"0.92rem", fontWeight:700, color:"var(--brown-light)", marginTop:4 }}>
                {selectedBoxData.Label.replace(/^Box \d+ — /i,"")}
              </div>
              <div style={{ fontSize:"0.78rem", color:"var(--muted)", marginTop:4 }}>
                {selectedBoxData.Publisher} · {selectedBoxData.YearRange}
              </div>
            </div>
            <div style={{ display:"flex", gap:20, alignItems:"center" }}>
              {[
                { val: selectedBoxMatches.length, lbl:"MATCHES", red:true },
                { val: boxComics.length,          lbl:"TOTAL",   red:false },
              ].map(s => (
                <div key={s.lbl} style={{ textAlign:"center" }}>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.8rem",
                    color: s.red ? "var(--red)" : "var(--muted2)", lineHeight:1 }}>{s.val}</div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.55rem",
                    letterSpacing:"1.5px", color:"var(--muted)", marginTop:2 }}>{s.lbl}</div>
                </div>
              ))}
              <button onClick={() => setSelectedBox(null)} style={{
                background:"none", border:"1.5px solid var(--border)", borderRadius:5,
                padding:"6px 14px", cursor:"pointer", color:"var(--muted)",
                fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.7rem", letterSpacing:"1px",
                transition:"all 0.12s",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--red)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--red)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}
              >CLOSE ✕</button>
            </div>
          </div>

          {/* Spine visualization */}
          <div style={{ marginBottom:18 }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem",
              letterSpacing:"2px", color:"var(--muted)", marginBottom:8 }}>
              SPINE VIEW — RED & WIDER = YOUR MATCH · HOVER FOR TITLE
            </div>
            <div style={{
              background:"#f0ede8", border:"3px solid #ccc9c2",
              borderTop:"8px solid #b0aca4", borderBottom:"10px solid #d4d0c8",
              borderRadius:"4px 4px 2px 2px", padding:"20px 16px 14px",
              overflowX:"auto", position:"relative",
              boxShadow:"0 4px 16px rgba(0,0,0,0.12)",
            }}>
              <div style={{ position:"absolute", top:-18, left:"50%", transform:"translateX(-50%)",
                fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem",
                letterSpacing:"3px", color:"#666" }}>
                {selectedBoxData.Num} · {boxComics.length} COMICS
              </div>
              <div style={{ display:"flex", gap:"1px", alignItems:"flex-end", minWidth:"max-content" }}>
                {boxComics.map((c, i) => {
                  const mk   = `${c.Title}|${c.Issue}`;
                  const hit  = matchSet.has(mk);
                  const isKey    = (c.Key    || "").toUpperCase() === "YES";
                  const isSigned = (c.Signed || "").toUpperCase() === "YES";
                  return (
                    <div key={i}
                      title={`${c.Title} #${c.Issue}${hit ? "  ← MATCH" : ""}${isKey ? "  ★KEY" : ""}${isSigned ? "  ✍" : ""}`}
                      style={{
                        width:  hit ? 7 : 5,
                        height: isKey ? 200 : 160,
                        background: hit ? "var(--red)" : TITLE_COLOR[c.Title] || "#888",
                        opacity: hit ? 1 : 0.35,
                        borderTop: isKey ? `3px solid ${hit ? "#ff9f9f" : "#d4a800"}` : undefined,
                        boxShadow: isSigned ? "inset 2px 0 0 #22c55e" : undefined,
                        borderRadius:"1px 1px 0 0",
                        flexShrink:0,
                        transition:"opacity 0.1s",
                        cursor:"default",
                      }}
                    />
                  );
                })}
              </div>
            </div>
            <div style={{ display:"flex", gap:16, marginTop:8, fontSize:"0.68rem",
              fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
              color:"var(--muted)", flexWrap:"wrap" }}>
              <span>
                <span style={{ display:"inline-block", width:7, height:14, background:"var(--red)",
                  verticalAlign:"middle", marginRight:4, borderRadius:"1px 1px 0 0" }}/>
                YOUR MATCH (wider)
              </span>
              <span>
                <span style={{ display:"inline-block", width:5, height:14, background:"#888",
                  verticalAlign:"middle", marginRight:4, borderRadius:"1px 1px 0 0", opacity:0.35 }}/>
                REST OF BOX
              </span>
              <span style={{ color:"var(--muted2)" }}>
                hover any spine to identify · tall + bright top = key issue
              </span>
            </div>
          </div>

          {/* Match list */}
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem",
            letterSpacing:"2px", color:"var(--muted)", marginBottom:10 }}>
            {selectedBoxMatches.length} MATCHING BOOK{selectedBoxMatches.length !== 1 ? "S" : ""} IN {selectedBoxData.Num}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {selectedBoxMatches.map((c, i) => {
              const isKey    = (c.Key    || "").toUpperCase() === "YES";
              const isSigned = (c.Signed || "").toUpperCase() === "YES";
              return (
                <div key={i} style={{
                  display:"flex", gap:12, alignItems:"flex-start",
                  background: isKey ? "#fffdf0" : "#fff",
                  border:`1.5px solid ${isKey ? "#d4a800" : "var(--border)"}`,
                  borderLeft:`4px solid ${isKey ? "#d4a800" : "var(--red)"}`,
                  borderRadius:6, padding:"10px 14px",
                }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, color:"var(--brown-light)", fontSize:"0.95rem", lineHeight:1.2 }}>
                      {c.Title}
                      <span style={{ fontWeight:400, color:"var(--muted2)", marginLeft:6, fontSize:"0.85rem" }}>
                        #{c.Issue}
                      </span>
                    </div>
                    <div style={{ fontSize:"0.8rem", color:"var(--muted)", marginTop:3 }}>
                      {[c.Year, c.Publisher, c.Writer].filter(Boolean).join(" · ")}
                    </div>
                    {isKey && c.Key_Reason && (
                      <div style={{ fontSize:"0.8rem", color:"#8a6000", marginTop:4,
                        fontFamily:"'Crimson Pro',serif", fontStyle:"italic", lineHeight:1.4 }}>
                        ★ {c.Key_Reason}
                      </div>
                    )}
                    {isSigned && (
                      <div style={{ fontSize:"0.78rem", color:"#16a34a", marginTop:3 }}>
                        ✍ Signed — {c.Signed_By || "Yes"}
                      </div>
                    )}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end", flexShrink:0 }}>
                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem",
                      letterSpacing:"1px", color:"var(--muted)", background:"var(--surface)",
                      border:"1px solid var(--border)", borderRadius:4, padding:"2px 8px" }}>
                      {selectedBoxData.Num}
                    </div>
                    {isKey    && <span className="badge bkey"   style={{ fontSize:"0.58rem" }}>KEY</span>}
                    {isSigned && <span className="badge" style={{ fontSize:"0.58rem", background:"#dcfce7",
                      color:"#166534", border:"1px solid #bbf7d0" }}>SGD</span>}
                    {c.Value_NM && <span style={{ fontSize:"0.78rem", color:"var(--muted2)",
                      fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"0.5px" }}>{c.Value_NM}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Global match list (no box selected) */}
      {hasQuery && matches.length > 0 && !selectedBox && (
        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem",
            letterSpacing:"2px", color:"var(--muted)", marginBottom:12 }}>
            ALL MATCHES — SELECT A BOX ABOVE TO SEE THE SPINE VIEW
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {sortedMatches.slice(0, 150).map((c, i) => {
              const isKey    = (c.Key    || "").toUpperCase() === "YES";
              const isSigned = (c.Signed || "").toUpperCase() === "YES";
              return (
                <div key={i} style={{
                  display:"flex", gap:10, alignItems:"center",
                  padding:"8px 12px",
                  background: isKey ? "#fffdf0" : "var(--surface)",
                  border:`1.5px solid ${isKey ? "#e8d200" : "var(--border)"}`,
                  borderRadius:5,
                }}>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem",
                    letterSpacing:"1.5px", color:"var(--red)", minWidth:58, flexShrink:0 }}>
                    BOX {c.Box}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <span style={{ fontWeight:600, color:"var(--brown-light)", fontSize:"0.9rem" }}>{c.Title}</span>
                    <span style={{ color:"var(--muted)", fontSize:"0.82rem", marginLeft:6 }}>#{c.Issue}</span>
                    {c.Year && <span style={{ color:"var(--muted)", fontSize:"0.78rem", marginLeft:6 }}>{c.Year}</span>}
                    {isKey && c.Key_Reason && (
                      <span style={{ color:"#8a6000", fontSize:"0.75rem", marginLeft:8,
                        fontFamily:"'Crimson Pro',serif", fontStyle:"italic" }}>
                        — {c.Key_Reason.slice(0, 80)}
                      </span>
                    )}
                  </div>
                  <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                    {isKey    && <span className="badge bkey"   style={{ fontSize:"0.55rem" }}>KEY</span>}
                    {isSigned && <span className="badge" style={{ fontSize:"0.55rem", background:"#dcfce7",
                      color:"#166534", border:"1px solid #bbf7d0" }}>SGD</span>}
                  </div>
                </div>
              );
            })}
            {sortedMatches.length > 150 && (
              <div style={{ textAlign:"center", color:"var(--muted)", fontSize:"0.78rem",
                fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"2px", padding:"14px",
                border:"1.5px dashed var(--border)", borderRadius:6 }}>
                + {sortedMatches.length - 150} MORE RESULTS — NARROW YOUR SEARCH OR SELECT A BOX
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
