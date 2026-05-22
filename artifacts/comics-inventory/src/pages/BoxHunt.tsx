import { useState, useMemo, Fragment } from "react";
import { DATA3 } from "@/data/data3";
import { SortableTable, ColDef } from "@/components/SortableTable";
import { Paginator } from "@/components/Paginator";

const ALL   = DATA3.comics;
const BOXES = DATA3.boxes;
type Comic  = (typeof ALL)[number];

const CARD_PAGE = 80;

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseVal(v: string | undefined | null) {
  return parseFloat(String(v || "").replace(/[^0-9.]/g, "") || "0");
}

function extractVol(title: string): string {
  const m = title.match(/\(Vol\.?\s*(\d+)[^)]*\)/i);
  return m ? `Vol ${m[1]}` : "";
}

function nb(s: string | number): string {
  return String(s || "").trim().replace(/^BOX\s*/i, "").replace(/^0+/, "") || "0";
}

function normPub(p: string) {
  const u = (p || "").toUpperCase();
  if (u === "DC" || u === "DC COMICS") return "DC";
  if (u === "MARVEL") return "Marvel";
  return p || "Other";
}
function pubColor(p: string) {
  const n = normPub(p);
  if (n === "DC")    return "#1d6fa4";
  if (n === "Marvel") return "#c8102e";
  const u = (p || "").toUpperCase();
  if (u === "IMAGE") return "#f97316";
  if (u === "IDW")   return "#22c55e";
  if (u.includes("DARK HORSE")) return "#7c3aed";
  if (u === "VALIANT") return "#8b2be2";
  return "#6b7280";
}
function platClass(p: string) {
  const u = (p || "").toUpperCase();
  if (u.includes("WHATNOT")) return "bwn";
  if (u === "EBAY")    return "beb";
  if (u.includes("HERITAGE")) return "bhe";
  return "bb";
}

// Deterministic spine color per title (matches BoxVisual)
const ALL_TITLES = Array.from(new Set(ALL.map(c => c.Title))).sort();
const TITLE_COLOR: Record<string, string> = {};
ALL_TITLES.forEach((t, i) => {
  const hue = (i * 137.508) % 360;
  TITLE_COLOR[t] = `hsl(${Math.round(hue)},${60 + (i % 3) * 10}%,${48 + (i % 4) * 5}%)`;
});

// ── Quick Search config (mirrors Summary.tsx) ─────────────────────────────────
const PUBLISHERS_LIST = [...new Set(ALL.map(c => c.Publisher).filter(Boolean))].sort();
const BOXES_LIST      = [...new Set(ALL.map(c => c.Box).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
const SEARCH_FIELDS   = [
  { value:"everything", label:"Anything" },
  { value:"title",      label:"Title" },
  { value:"writer",     label:"Writer" },
  { value:"artist",     label:"Artist" },
  { value:"character",  label:"Character / 1st App" },
  { value:"arc",        label:"Arc / Story" },
  { value:"signer",     label:"Signer" },
  { value:"publisher",  label:"Publisher" },
  { value:"box",        label:"Box #" },
  { value:"keysonly",   label:"⭐ Keys Only" },
  { value:"signedonly", label:"✍ Signed Only" },
];
const QUICK_PILLS = ["Steranko","Falcon","X-Men","Miller","Punisher","Brubaker","Kirby","Denny O'Neil"];

// ── Sub-components ────────────────────────────────────────────────────────────
function BoxBadge({ box }: { box: string }) {
  return (
    <span style={{ fontSize:"0.6rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
      background:"#7a5c3a18", border:"1.5px solid #7a5c3a", color:"#7a5c3a",
      borderRadius:3, padding:"1px 7px", whiteSpace:"nowrap" }}>Box {box}</span>
  );
}

function CoverThumb({ c }: { c: Comic }) {
  const color = pubColor(c.Publisher);
  const pub = normPub(c.Publisher);
  const abbr = pub === "DC" ? "DC" : pub === "Marvel" ? "M" : (pub[0] || "?").toUpperCase();
  const searchUrl = `https://comicvine.gamespot.com/search/?q=${encodeURIComponent(c.Title + " " + c.Issue)}`;
  const isKey = c.Key?.toUpperCase() === "YES";
  return (
    <a href={searchUrl} target="_blank" rel="noopener noreferrer"
      title={`View ${c.Title} ${c.Issue} on Comic Vine`}
      style={{ display:"block", width:52, flexShrink:0, aspectRatio:"2/3",
        background:`linear-gradient(160deg, ${color}25, ${color}55)`,
        border:`1.5px solid ${color}50`,
        borderTop: isKey ? "3px solid #d4a800" : `1.5px solid ${color}50`,
        borderRadius:4, overflow:"hidden", position:"relative", textDecoration:"none" }}>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center", padding:4, gap:2 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.1rem", color, lineHeight:1, opacity:0.55 }}>{abbr}</div>
        <div style={{ fontSize:"0.44rem", color:"var(--text)", textAlign:"center", lineHeight:1.25,
          fontWeight:600, wordBreak:"break-word", maxWidth:"100%" }}>{c.Title.slice(0,22)}</div>
        {(c.Year||"").trim() && <div style={{ fontSize:"0.4rem", color:"var(--muted2)" }}>{c.Year}</div>}
      </div>
      {isKey && <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"#d4a800",
        color:"#fff", fontSize:"0.42rem", fontFamily:"'Bebas Neue',sans-serif",
        letterSpacing:"1px", textAlign:"center", padding:"1px 0" }}>KEY</div>}
    </a>
  );
}

function HuntCard({ comic: c }: { comic: Comic }) {
  const isKey    = (c.Key    || "").toUpperCase() === "YES";
  const isSigned = (c.Signed || "").toUpperCase() === "YES";
  return (
    <div className="ev-card" style={{ borderTop: isKey ? "3px solid #d4a800" : undefined }}>
      <div style={{ display:"flex", gap:10, marginBottom:8 }}>
        <CoverThumb c={c} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4, gap:4 }}>
            <BoxBadge box={c.Box} />
            <div style={{ display:"flex", gap:3, flexWrap:"wrap", justifyContent:"flex-end" }}>
              {isKey    && <span className="badge bkey"  style={{fontSize:"0.57rem"}}>KEY</span>}
              {isSigned && <span className="badge bgold" style={{fontSize:"0.57rem"}}>SGD</span>}
              {c.Platform && <span className={`badge ${platClass(c.Platform)}`} style={{fontSize:"0.57rem"}}>{c.Platform}</span>}
            </div>
          </div>
          <div style={{ fontWeight:600, fontSize:"0.88rem", color:"var(--brown-light)", lineHeight:1.3 }}>{c.Title}</div>
          <div style={{ fontSize:"0.78rem", color:"var(--muted2)", marginTop:2 }}>
            {c.Issue}{extractVol(c.Title) ? ` · ${extractVol(c.Title)}` : ""}{c.Year ? ` · ${c.Year}` : ""}
          </div>
          {c.Publisher && <div style={{ fontSize:"0.72rem", color:"var(--muted)" }}>{c.Publisher}</div>}
        </div>
      </div>
      {(c.Writer || c.Artist) && (
        <div style={{ fontSize:"0.72rem", color:"var(--muted2)", lineHeight:1.4, marginBottom:4 }}>
          {c.Writer && <div><span style={{color:"var(--muted)"}}>W:</span> {c.Writer}</div>}
          {c.Artist && c.Artist !== c.Writer && <div><span style={{color:"var(--muted)"}}>A:</span> {c.Artist}</div>}
        </div>
      )}
      {isKey && c.Key_Reason && (
        <div style={{ fontSize:"0.78rem", color:"#8a6000", marginTop:4, lineHeight:1.4,
          background:"#fff8e0", borderRadius:3, padding:"3px 8px" }}>
          {c.Key_Reason.substring(0, 110)}
        </div>
      )}
      {isSigned && c.Signed_By && (
        <div style={{ fontSize:"0.7rem", color:"var(--brown)", marginTop:4 }}>✍ {c.Signed_By}</div>
      )}
      {(c.Value_NM || c.Value_VF) && (
        <div style={{ display:"flex", gap:10, marginTop:6, fontSize:"0.72rem" }}>
          {c.Value_NM && <span style={{color:"var(--green-text)"}}>NM <strong>{c.Value_NM}</strong></span>}
          {c.Value_VF && <span style={{color:"var(--muted)"}}>VF {c.Value_VF}</span>}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function BoxHunt() {
  // Quick Search state
  const [searchField, setSearchField] = useState("everything");
  const [searchVal,   setSearchVal]   = useState("");
  const [searchBox,   setSearchBox]   = useState("");
  const [searchPub,   setSearchPub]   = useState("");
  const [searched,    setSearched]    = useState(false);
  const [view,        setView]        = useState<"list"|"card">("list");
  const [cardPage,    setCardPage]    = useState(1);

  // Box visualization state
  const [selectedBox, setSelectedBox] = useState<string | null>(null);

  const noTextFields = ["keysonly", "signedonly", "publisher", "box"];
  const showTextInput = !noTextFields.includes(searchField);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const results = useMemo(() => {
    if (!searched) return [];
    return ALL.filter(c => {
      if (searchField === "keysonly")   return (c.Key    || "").toUpperCase() === "YES";
      if (searchField === "signedonly") return (c.Signed || "").toUpperCase() === "YES";
      if (searchField === "publisher")  return searchPub ? c.Publisher === searchPub : true;
      if (searchField === "box")        return searchBox ? c.Box === searchBox : true;
      const q = searchVal.trim().toLowerCase();
      if (!q) return true;
      if (searchField === "title")     return c.Title.toLowerCase().includes(q);
      if (searchField === "writer")    return (c.Writer || "").toLowerCase().includes(q);
      if (searchField === "artist")    return (c.Artist || "").toLowerCase().includes(q);
      if (searchField === "character") return (c.First_App || "").toLowerCase().includes(q);
      if (searchField === "arc")       return (c.Arc || "").toLowerCase().includes(q);
      if (searchField === "signer")    return (c.Signed_By || "").toLowerCase().includes(q);
      return [c.Title, c.Issue, c.Publisher, c.Writer, c.Artist,
              c.Cover_Artist, c.Signed_By, c.Key_Reason, c.First_App,
              c.Arc, c.Seller_Notes, c.Era, `box ${c.Box}`, c.Terrificon,
             ].join(" ").toLowerCase().includes(q);
    });
  }, [searched, searchField, searchVal, searchBox, searchPub]);

  // Box hit map
  const matchesByBox = useMemo(() => {
    const m: Record<string, Comic[]> = {};
    for (const c of results) {
      const k = nb(String(c.Box));
      if (!m[k]) m[k] = [];
      m[k].push(c);
    }
    return m;
  }, [results]);

  // Comics in selected box (all, not just matches)
  const boxComics = useMemo(() => {
    if (!selectedBox) return [];
    const target = nb(selectedBox);
    return ALL.filter(c => nb(String(c.Box)) === target);
  }, [selectedBox]);

  // Set of match keys in selected box
  const matchSet = useMemo(() => {
    if (!selectedBox) return new Set<string>();
    const key = nb(selectedBox);
    return new Set((matchesByBox[key] || []).map(c => `${c.Title}|${c.Issue}`));
  }, [selectedBox, matchesByBox]);

  const selectedBoxData    = BOXES.find(b => b.Num === selectedBox);
  const selectedBoxMatches = useMemo(() => {
    if (!selectedBox) return [];
    const key = nb(selectedBox);
    return (matchesByBox[key] || []).slice().sort((a, b) => parseVal(a.Issue) - parseVal(b.Issue));
  }, [selectedBox, matchesByBox]);

  // Card pagination
  const cardSlice = useMemo(() => {
    const start = (cardPage - 1) * CARD_PAGE;
    return results.slice(start, start + CARD_PAGE);
  }, [results, cardPage]);

  // List cols
  const cols = useMemo<ColDef<Comic>[]>(() => [
    { key:"box",    label:"Box",       defaultWidth:70,  sort:(a,b)=>Number(a.Box)-Number(b.Box),          cell:r=><BoxBadge box={r.Box} /> },
    { key:"title",  label:"Title",     defaultWidth:220, sort:(a,b)=>a.Title.localeCompare(b.Title),       cell:r=><span style={{fontWeight:600,color:"var(--brown-light)"}}>{r.Title}</span> },
    { key:"issue",  label:"#",         defaultWidth:55,  sort:(a,b)=>parseVal(a.Issue)-parseVal(b.Issue),  cell:r=><span className="lt-sub">{r.Issue}</span> },
    { key:"vol",    label:"Vol",       defaultWidth:58,  sort:(a,b)=>extractVol(a.Title).localeCompare(extractVol(b.Title)), cell:r=><span className="lt-sub">{extractVol(r.Title)||"—"}</span> },
    { key:"pub",    label:"Publisher", defaultWidth:100, sort:(a,b)=>a.Publisher.localeCompare(b.Publisher), cell:r=><span className="lt-sub">{r.Publisher}</span> },
    { key:"writer", label:"Writer",    defaultWidth:130, sort:(a,b)=>a.Writer.localeCompare(b.Writer),     cell:r=><span className="lt-sub">{r.Writer||"—"}</span> },
    { key:"key",    label:"Key",       defaultWidth:55,  sort:(a,b)=>a.Key.localeCompare(b.Key),           cell:r=>r.Key?.toUpperCase()==="YES"?<span className="badge bkey" style={{fontSize:"0.6rem"}}>KEY</span>:null },
    { key:"nm",     label:"NM Value",  defaultWidth:90,  sort:(a,b)=>parseVal(a.Value_NM)-parseVal(b.Value_NM), cell:r=><span className="lt-val">{r.Value_NM||"—"}</span> },
    { key:"year",   label:"Year",      defaultWidth:65,  sort:(a,b)=>parseVal(a.Year)-parseVal(b.Year),   cell:r=><span className="lt-sub">{r.Year}</span> },
    { key:"signed", label:"Signed",    defaultWidth:90,  sort:(a,b)=>a.Signed.localeCompare(b.Signed),    cell:r=>r.Signed?.toUpperCase()==="YES"?<span className="lt-sub" style={{color:"var(--gold)"}}>✍ {r.Signed_By||"Yes"}</span>:null },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  function doSearch() {
    setSearched(true);
    setCardPage(1);
    setSelectedBox(null);
  }

  function doQuickPill(term: string) {
    setSearchField("everything");
    setSearchVal(term);
    setSearchPub("");
    setSearchBox("");
    setSearched(true);
    setCardPage(1);
    setSelectedBox(null);
  }

  function clearSearch() {
    setSearchField("everything");
    setSearchVal("");
    setSearchPub("");
    setSearchBox("");
    setSearched(false);
    setCardPage(1);
    setSelectedBox(null);
  }

  return (
    <div style={{ maxWidth:1400, margin:"0 auto", padding:"16px 14px 60px" }}>

      {/* Page header */}
      <div style={{ marginBottom:18 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"2rem",
          letterSpacing:"4px", color:"var(--red)", lineHeight:1 }}>BOX HUNT</div>
        <div style={{ fontSize:"0.9rem", color:"var(--muted2)", marginTop:4,
          fontFamily:"'Crimson Pro',serif" }}>
          Search the full collection — results show in list or card view, and the box grid lights up where your matches live.
        </div>
      </div>

      {/* ── Quick Search widget (mirrors Home page) ── */}
      <section className="qs-section" style={{ marginBottom:16 }}>
        <div className="qs-header">
          <span className="qs-title">FIND A BOOK</span>
          <span className="qs-sub">search by field → results appear below · box grid shows where matches live</span>
        </div>
        <div className="qs-row">
          <select className="qs-field-select" value={searchField}
            onChange={e => { setSearchField(e.target.value); setSearchVal(""); setSearchBox(""); setSearchPub(""); }}>
            {SEARCH_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>

          {showTextInput && (
            <input
              className="qs-input"
              autoFocus
              placeholder={
                searchField === "writer"    ? "e.g. Tom King, Grant Morrison, Christopher Priest…" :
                searchField === "artist"    ? "e.g. Jim Lee, Andy Kubert, Brian Stelfreeze…" :
                searchField === "character" ? "e.g. Miles Morales, Damian Wayne, Storm…" :
                searchField === "arc"       ? "e.g. Batman and Son, Krakoa Era, Hickman FF…" :
                searchField === "signer"    ? "e.g. Skottie Young, Tony Isabella, Tom King…" :
                searchField === "title"     ? "e.g. Batman, Black Panther, Wolverine…" :
                "title, writer, artist, character, arc, key reason, signer…"
              }
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doSearch()}
            />
          )}

          {searchField === "publisher" && (
            <select className="qs-field-select" value={searchPub} onChange={e => setSearchPub(e.target.value)}>
              <option value="">Choose publisher…</option>
              {PUBLISHERS_LIST.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}

          {searchField === "box" && (
            <select className="qs-field-select" value={searchBox} onChange={e => setSearchBox(e.target.value)}>
              <option value="">Choose box…</option>
              {BOXES_LIST.map(b => <option key={b} value={b}>Box {b}</option>)}
            </select>
          )}

          <button className="qs-btn" onClick={doSearch}>Search →</button>
          {searched && <button className="btn-clear" onClick={clearSearch}>Clear</button>}
        </div>

        {/* Quick pills */}
        <div className="qs-pills">
          <span className="qs-pill-label">Quick:</span>
          {QUICK_PILLS.map(term => (
            <button key={term} className="qs-pill" onClick={() => doQuickPill(term)}>{term}</button>
          ))}
          <button className="qs-pill qs-pill-key" onClick={() => { setSearchField("keysonly"); setSearchVal(""); doSearch(); }}>⭐ All Keys</button>
          <button className="qs-pill qs-pill-sgn" onClick={() => { setSearchField("signedonly"); setSearchVal(""); doSearch(); }}>✍ All Signed</button>
        </div>
      </section>

      {/* ── Results count + view toggle ── */}
      {searched && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
          marginBottom:14, flexWrap:"wrap", gap:8 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1.5px",
            fontSize:"0.82rem", color:"var(--muted2)" }}>
            {results.length === 0
              ? "No results — try a different search"
              : <><span style={{color:"var(--red)",fontSize:"1.05rem"}}>{results.length.toLocaleString()}</span> {results.length===1?"book":"books"} across <span style={{color:"var(--red)"}}>{Object.keys(matchesByBox).length}</span> {Object.keys(matchesByBox).length===1?"box":"boxes"} · {results.filter(c=>(c.Key||"").toUpperCase()==="YES").length} keys · {ALL.length.toLocaleString()} total in collection</>
            }
          </div>
          {results.length > 0 && (
            <div style={{ display:"flex", gap:6 }}>
              {(["list","card"] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", letterSpacing:"1.5px",
                  padding:"5px 14px", border:`1.5px solid ${view===v?"var(--red)":"var(--border)"}`,
                  background:view===v?"var(--red)":"var(--surface)",
                  color:view===v?"#fff":"var(--muted2)",
                  borderRadius:4, cursor:"pointer",
                }}>
                  {v==="list"?"≡ List":"⊞ Cards"}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Box hit grid ── */}
      {searched && results.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem",
            letterSpacing:"2px", color:"var(--muted)", marginBottom:10 }}>
            BOXES WITH MATCHES — CLICK TO SEE SPINE VIEW
          </div>
          <div className="boxes-grid">
            {BOXES.map(b => {
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
                    ...(isSelected ? {
                      borderColor:"var(--red)", background:"#fef2f2",
                      boxShadow:"0 4px 14px rgba(200,16,46,0.25)", transform:"translateY(-3px)",
                    } : isHit ? {
                      borderColor:"var(--red)", background:"#fff6f6",
                    } : {}),
                  }}
                >
                  <div className="box-tile-count"
                    style={{ color:isHit?"var(--red)":undefined, fontSize:isHit?"1.1rem":undefined }}>
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

      {/* ── Selected box dig view ── */}
      {selectedBox && selectedBoxData && (
        <div style={{ marginBottom:28 }}>
          <div style={{ background:"var(--surface)", border:"2px solid var(--red)",
            borderRadius:8, padding:"14px 18px", marginBottom:14,
            display:"flex", alignItems:"flex-start", gap:16, flexWrap:"wrap" }}>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.5rem",
                color:"var(--red)", letterSpacing:"2px", lineHeight:1 }}>{selectedBoxData.Num}</div>
              <div style={{ fontSize:"0.92rem", fontWeight:700, color:"var(--brown-light)", marginTop:4 }}>
                {selectedBoxData.Label.replace(/^Box \d+ — /i,"")}
              </div>
              <div style={{ fontSize:"0.78rem", color:"var(--muted)", marginTop:4 }}>
                {selectedBoxData.Publisher} · {selectedBoxData.YearRange}
              </div>
            </div>
            <div style={{ display:"flex", gap:20, alignItems:"center" }}>
              {[
                { val:selectedBoxMatches.length, lbl:"MATCHES", red:true },
                { val:boxComics.length,          lbl:"TOTAL",   red:false },
              ].map(s => (
                <div key={s.lbl} style={{ textAlign:"center" }}>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.8rem",
                    color:s.red?"var(--red)":"var(--muted2)", lineHeight:1 }}>{s.val}</div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.55rem",
                    letterSpacing:"1.5px", color:"var(--muted)", marginTop:2 }}>{s.lbl}</div>
                </div>
              ))}
              <button onClick={() => setSelectedBox(null)} style={{
                background:"none", border:"1.5px solid var(--border)", borderRadius:5,
                padding:"6px 14px", cursor:"pointer", color:"var(--muted)",
                fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.7rem", letterSpacing:"1px" }}>
                CLOSE ✕
              </button>
            </div>
          </div>

          {/* Spine visualization */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem",
              letterSpacing:"2px", color:"var(--muted)", marginBottom:8 }}>
              SPINE VIEW — RED &amp; WIDER = YOUR MATCH · HOVER FOR TITLE
            </div>
            <div style={{ background:"#f0ede8", border:"3px solid #ccc9c2",
              borderTop:"8px solid #b0aca4", borderBottom:"10px solid #d4d0c8",
              borderRadius:"4px 4px 2px 2px", padding:"20px 16px 14px",
              overflowX:"auto", position:"relative",
              boxShadow:"0 4px 16px rgba(0,0,0,0.12)" }}>
              <div style={{ position:"absolute", top:-18, left:"50%", transform:"translateX(-50%)",
                fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem",
                letterSpacing:"3px", color:"#666" }}>
                {selectedBoxData.Num} · {boxComics.length} COMICS
              </div>
              <div style={{ display:"flex", gap:"1px", alignItems:"flex-end", minWidth:"max-content" }}>
                {boxComics.map((c, i) => {
                  const mk       = `${c.Title}|${c.Issue}`;
                  const hit      = matchSet.has(mk);
                  const isKey    = (c.Key    || "").toUpperCase() === "YES";
                  const isSigned = (c.Signed || "").toUpperCase() === "YES";
                  return (
                    <div key={i}
                      title={`${c.Title} #${c.Issue}${hit?" ← MATCH":""}${isKey?" ★KEY":""}${isSigned?" ✍":""}`}
                      style={{
                        width:  hit ? 7 : 5,
                        height: isKey ? 200 : 160,
                        background: hit ? "var(--red)" : TITLE_COLOR[c.Title] || "#888",
                        opacity: hit ? 1 : 0.35,
                        borderTop: isKey ? `3px solid ${hit ? "#ff9f9f" : "#d4a800"}` : undefined,
                        boxShadow: isSigned ? "inset 2px 0 0 #22c55e" : undefined,
                        borderRadius:"1px 1px 0 0", flexShrink:0,
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
              <span style={{ color:"var(--muted2)" }}>hover any spine to identify</span>
            </div>
          </div>

          {/* Match list */}
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem",
            letterSpacing:"2px", color:"var(--muted)", marginBottom:10 }}>
            {selectedBoxMatches.length} MATCH{selectedBoxMatches.length !== 1 ? "ES" : ""} IN {selectedBoxData.Num}
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
                    <div style={{ fontWeight:700, color:"var(--brown-light)", fontSize:"0.95rem" }}>
                      {c.Title}
                      <span style={{ fontWeight:400, color:"var(--muted2)", marginLeft:6, fontSize:"0.85rem" }}>
                        {c.Issue}{extractVol(c.Title) ? ` · ${extractVol(c.Title)}` : ""}
                      </span>
                    </div>
                    <div style={{ fontSize:"0.8rem", color:"var(--muted)", marginTop:3 }}>
                      {[c.Year, c.Publisher, c.Writer].filter(Boolean).join(" · ")}
                    </div>
                    {isKey && c.Key_Reason && (
                      <div style={{ fontSize:"0.8rem", color:"#8a6000", marginTop:4,
                        fontFamily:"'Crimson Pro',serif", fontStyle:"italic" }}>★ {c.Key_Reason}</div>
                    )}
                    {isSigned && (
                      <div style={{ fontSize:"0.78rem", color:"#16a34a", marginTop:3 }}>
                        ✍ {c.Signed_By || "Signed"}
                      </div>
                    )}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end", flexShrink:0 }}>
                    <BoxBadge box={c.Box} />
                    {isKey    && <span className="badge bkey"  style={{fontSize:"0.58rem"}}>KEY</span>}
                    {isSigned && <span className="badge bgold" style={{fontSize:"0.58rem"}}>SGD</span>}
                    {c.Value_NM && <span style={{ fontSize:"0.78rem", color:"var(--green-text)", fontWeight:600 }}>{c.Value_NM}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Results — list ── */}
      {searched && results.length > 0 && view === "list" && !selectedBox && (
        <SortableTable rows={results} cols={cols} rowKey={(_r, i) => String(i)}
          pageSize={100} defaultSortKey="box"
          expandCell={c => (
            <div>
              <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
                {c.Arc       && <div className="dr"><span className="dl">Arc</span><span className="dv">{c.Arc}</span></div>}
                {c.Key_Reason   && <div className="dr"><span className="dl">Key</span><span className="dv" style={{color:"var(--gold)"}}>{c.Key_Reason}</span></div>}
                {c.First_App && <div className="dr"><span className="dl">1st App</span><span className="dv">{c.First_App}</span></div>}
                {(c.Signed||"").toUpperCase()==="YES" && c.Signed_By && <div className="dr"><span className="dl">Signed By</span><span className="dv">{c.Signed_By}</span></div>}
              </div>
              {c.Story_Pitch && (
                <div style={{ marginTop:6, color:"var(--muted2)", fontSize:"0.85rem", lineHeight:1.5 }}>{c.Story_Pitch.substring(0,200)}</div>
              )}
              <div style={{ marginTop:8 }}>
                <a href={`https://comicvine.gamespot.com/search/?q=${encodeURIComponent(c.Title+" "+c.Issue)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize:"0.72rem", color:"var(--muted2)", textDecoration:"underline" }}>
                  🔎 View on Comic Vine
                </a>
              </div>
            </div>
          )}
        />
      )}

      {/* ── Results — cards ── */}
      {searched && results.length > 0 && view === "card" && !selectedBox && (
        <>
          <div className="ev-card-grid">
            {cardSlice.map((c, i) => <HuntCard key={i} comic={c} />)}
          </div>
          <Paginator
            total={results.length} page={cardPage} pageSize={CARD_PAGE}
            pageCount={Math.ceil(results.length / CARD_PAGE)}
            onChange={p => { setCardPage(p); window.scrollTo({top:0,behavior:"smooth"}); }}
          />
        </>
      )}

      {/* ── Show results when a box is selected (filtered to that box only) ── */}
      {searched && results.length > 0 && selectedBox && view === "list" && (
        <Fragment>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem",
            letterSpacing:"2px", color:"var(--muted)", marginBottom:10, marginTop:4 }}>
            ALL {results.length.toLocaleString()} RESULTS — CLICK A BOX ABOVE TO DRILL IN, OR CLOSE BOX TO SEE FULL LIST
          </div>
        </Fragment>
      )}

      {/* Empty state */}
      {!searched && (
        <div style={{ textAlign:"center", padding:"50px 20px 20px" }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.4rem",
            letterSpacing:"4px", color:"var(--muted)", marginBottom:10 }}>WHAT ARE YOU HUNTING?</div>
          <div style={{ fontSize:"0.95rem", color:"var(--muted2)", fontFamily:"'Crimson Pro',serif",
            maxWidth:460, margin:"0 auto", lineHeight:1.7 }}>
            Pick a search field above, type your term, and hit Search. The full collection is yours —
            results appear as a list or card grid, and the box grid shows exactly where your books live.
          </div>
        </div>
      )}

      {searched && results.length === 0 && (
        <div style={{ textAlign:"center", padding:"48px 20px", color:"var(--muted2)", fontSize:"0.9rem" }}>
          <div style={{ fontSize:"1.5rem", marginBottom:8, opacity:0.4 }}>🔍</div>
          No comics found — try a different search or field.
        </div>
      )}
    </div>
  );
}
