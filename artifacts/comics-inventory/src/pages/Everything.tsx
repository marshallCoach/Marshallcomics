import { useState, useMemo, useCallback, useEffect } from "react";
import { DATA3 } from "@/data/data3";
import { getCoverSvgUrl, type ComicLike } from "@/utils/coverThumbnails";
import { SortableTable, ColDef } from "@/components/SortableTable";
import { Paginator } from "@/components/Paginator";

const CARD_PAGE = 80;
const ALL = DATA3.comics;
type Comic = (typeof ALL)[number];

const PUBLISHERS = [...new Set(ALL.map(c => c.Publisher).filter(Boolean))].sort();
const ERAS       = [...new Set(ALL.map(c => c.Era).filter(Boolean))].sort();
const PLATFORMS  = [...new Set(ALL.map(c => c.Platform).filter(Boolean))].sort();
const BOXES      = [...new Set(ALL.map(c => c.Box).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));

const CHAR_FAMILIES = [
  { name:"Batman Family",   kw:["Batman","Nightwing","Robin","Batgirl","Red Hood","Batwoman","Catwoman","Joker","Harley Quinn","Gotham","Batwing"], emoji:"🦇" },
  { name:"Superman Family", kw:["Superman","Supergirl","Superboy","Action Comics","Lois Lane","Man of Steel"], emoji:"🦸" },
  { name:"Spider-Man",      kw:["Spider-Man","Spider Man","Amazing Spider","Spectacular Spider","Venom","Carnage","Miles Morales","Spider-Gwen","Silk"], emoji:"🕷️" },
  { name:"X-Men/Mutants",   kw:["X-Men","Uncanny X","New Mutants","X-Force","X-Factor","Excalibur","Wolverine","Deadpool","Cable","Gambit","Krakoa","HoX","PoX"], emoji:"⚡" },
  { name:"Avengers",        kw:["Avengers","Captain America","Iron Man","Thor","Hulk","Black Widow","Hawkeye","Ant-Man","Vision","Scarlet Witch","West Coast"], emoji:"🛡️" },
  { name:"Black Panther",   kw:["Black Panther","Wakanda","Jungle Action","Shuri"], emoji:"🐾" },
  { name:"Justice League",  kw:["Justice League","JLA","Justice Society","JSA"], emoji:"⚖️" },
  { name:"Green Lantern",   kw:["Green Lantern","GL Corps"], emoji:"💚" },
  { name:"Flash Family",    kw:["The Flash","Kid Flash","Impulse"], emoji:"💨" },
  { name:"Titans",          kw:["Teen Titans","Titans","Young Justice"], emoji:"🌟" },
  { name:"Captain America", kw:["Captain America","Sam Wilson: Cap","Steve Rogers"], emoji:"🗡️" },
  { name:"Fantastic Four",  kw:["Fantastic Four","Silver Surfer"], emoji:"4️⃣" },
];

function getFamily(c: Comic): string {
  const hay = `${c.Title} ${c.Arc} ${c.First_App}`.toLowerCase();
  for (const f of CHAR_FAMILIES) {
    if (f.kw.some(k => hay.includes(k.toLowerCase()))) return f.name;
  }
  return "";
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

function parseVal(v: string | undefined | null) {
  return parseFloat(String(v || "").replace(/[^0-9.]/g, "") || "0");
}

function extractVol(title: string): string {
  const m = title.match(/\(Vol\.?\s*(\d+)[^)]*\)/i);
  return m ? `Vol ${m[1]}` : "";
}

function platClass(p: string) {
  const u = (p || "").toUpperCase();
  if (u.includes("WHATNOT")) return "bwn";
  if (u === "EBAY")    return "beb";
  if (u.includes("HERITAGE")) return "bhe";
  return "bb";
}

function BoxBadge({ box }: { box: string }) {
  return (
    <span style={{ fontSize:"0.6rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
      background:"#7a5c3a18", border:"1.5px solid #7a5c3a", color:"#7a5c3a",
      borderRadius:3, padding:"1px 7px", whiteSpace:"nowrap" }}>Box {box}</span>
  );
}

function CoverThumb({ c }: { c: Comic }) {
  const searchUrl = `https://comicvine.gamespot.com/search/?q=${encodeURIComponent(c.Title + " " + c.Issue)}`;
  const svgUrl = getCoverSvgUrl(c as ComicLike, { width: 56, height: 84 });
  return (
    <a
      href={searchUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={`View cover for ${c.Title} #${c.Issue} on Comic Vine`}
      style={{ display:"block", width:56, height:84, flexShrink:0, borderRadius:4, overflow:"hidden", textDecoration:"none", transition:"opacity 0.15s" }}
    >
      <img src={svgUrl} alt={`${c.Title} #${c.Issue}`} width={56} height={84} style={{ display:"block", width:"100%", height:"100%", borderRadius:4 }} />
    </a>
  );
}

export default function Everything({
  initBox, initQuery, initPublisher, initKeysOnly, initSignedOnly,
}: {
  initBox?: string; initQuery?: string; initPublisher?: string;
  initKeysOnly?: boolean; initSignedOnly?: boolean;
}) {
  const [query,       setQuery]      = useState(initQuery    || "");
  const [publisher,   setPub]        = useState(initPublisher || "");
  const [era,         setEra]        = useState("");
  const [platform,    setPlat]       = useState("");
  const [boxFilter,   setBoxFilter]  = useState(initBox      || "");
  const [keysOnly,    setKeysOnly]   = useState(!!initKeysOnly);
  const [signedOnly,  setSignedOnly] = useState(!!initSignedOnly);
  const [familyFilter,setFamily]     = useState("");
  const [view,        setView]       = useState<"list"|"card">("list");
  const [searched,    setSearched]   = useState(true);
  const [cardPage,    setCardPage]   = useState(1);
  const [showFamilies,setShowFams]   = useState(false);
  const [exactTitle,  setExactTitle] = useState("");

  const cols = useMemo<ColDef<Comic>[]>(() => [
    { key:"title",     label:"Title",     defaultWidth:220, sort:(a,b)=>a.Title.localeCompare(b.Title), cell:r=>(
      <button className="title-link" onClick={e=>{e.stopPropagation();setExactTitle(r.Title||"");setQuery("");setSearched(true);setCardPage(1);}}>
        {r.Title||"Untitled"}
      </button>
    )},
    { key:"issue",     label:"#",         defaultWidth:55,  sort:(a,b)=>parseVal(a.Issue)-parseVal(b.Issue), cell:r=><span className="lt-sub">{r.Issue}</span> },
    { key:"volume",    label:"Vol",       defaultWidth:58,  sort:(a,b)=>Number(a.Volume||0)-Number(b.Volume||0), cell:r=><span className="lt-sub">{r.Volume||"—"}</span> },
    { key:"publisher", label:"Publisher", defaultWidth:100, sort:(a,b)=>a.Publisher.localeCompare(b.Publisher), cell:r=><span className="lt-sub">{r.Publisher}</span> },
    { key:"box",       label:"Box",       defaultWidth:70,  sort:(a,b)=>Number(a.Box)-Number(b.Box), cell:r=><BoxBadge box={r.Box} /> },
    { key:"writer",    label:"Writer",    defaultWidth:130, sort:(a,b)=>a.Writer.localeCompare(b.Writer), cell:r=><span className="lt-sub">{r.Writer||"—"}</span> },
    { key:"artist",    label:"Artist",    defaultWidth:130, sort:(a,b)=>a.Artist.localeCompare(b.Artist), cell:r=><span className="lt-sub">{r.Artist||"—"}</span> },
    { key:"key",       label:"Key",       defaultWidth:55,  sort:(a,b)=>a.Key.localeCompare(b.Key), cell:r=>r.Key?.toUpperCase()==="YES"?<span className="badge bkey" style={{fontSize:"0.6rem"}}>KEY</span>:null },
    { key:"nm",        label:"NM Value",  defaultWidth:90,  sort:(a,b)=>parseVal(a.Value_NM)-parseVal(b.Value_NM), cell:r=><span className="lt-val">{r.Value_NM && r.Value_NM!=="nan" ? `$${r.Value_NM}` : "—"}</span> },
    { key:"vf",        label:"VF Value",  defaultWidth:90,  sort:(a,b)=>parseVal(a.Value_VF)-parseVal(b.Value_VF), cell:r=>{ const v=r.Value_VF&&r.Value_VF!=="nan"?r.Value_VF.match(/(\d+(?:\.\d+)?)/)?.[1]:""; return <span className="lt-vf">{v?`$${v}`:"—"}</span>; }},
    { key:"platform",  label:"Platform",  defaultWidth:90,  sort:(a,b)=>a.Platform.localeCompare(b.Platform), cell:r=>r.Platform?<span className={`badge ${platClass(r.Platform)}`} style={{fontSize:"0.6rem"}}>{r.Platform}</span>:null },
    { key:"year",      label:"Year",      defaultWidth:65,  sort:(a,b)=>parseVal(a.Year)-parseVal(b.Year), cell:r=><span className="lt-sub">{r.Year}</span> },
    { key:"signed",    label:"Signed",    defaultWidth:90,  sort:(a,b)=>a.Signed.localeCompare(b.Signed), cell:r=>r.Signed?.toUpperCase()==="YES"?<span className="lt-sub" style={{color:"var(--gold)"}}>✍ {r.Signed_By||"Yes"}</span>:null },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  // When parent re-navigates with new params, re-init
  useEffect(() => {
    if (initQuery !== undefined)    setQuery(initQuery || "");
    if (initPublisher !== undefined) setPub(initPublisher || "");
    if (initBox !== undefined)      setBoxFilter(initBox || "");
    setKeysOnly(!!initKeysOnly);
    setSignedOnly(!!initSignedOnly);
    setSearched(true); setCardPage(1);
  }, [initBox, initQuery, initPublisher, initKeysOnly, initSignedOnly]);

  const results = useMemo(() => {
    if (!searched) return [];
    const q = query.trim().toLowerCase();
    return ALL.filter(c => {
      if (keysOnly   && (c.Key    || "").toUpperCase() !== "YES") return false;
      if (signedOnly && (c.Signed || "").toUpperCase() !== "YES") return false;
      if (publisher  && c.Publisher !== publisher)  return false;
      if (era        && c.Era !== era)              return false;
      if (platform   && c.Platform !== platform)    return false;
      if (boxFilter  && c.Box !== boxFilter)        return false;
      if (familyFilter && getFamily(c) !== familyFilter) return false;
      if (exactTitle && c.Title !== exactTitle)     return false;
      if (!q) return true;
      // Parse "Title #N" pattern (e.g. "Batman #656", "Wolverine #1")
      const issuePat = q.match(/^(.*?)\s*#(\d+(?:\.\d+)?)\s*$/);
      if (issuePat) {
        const tp = issuePat[1].trim();
        const ip = issuePat[2];
        const tOk = !tp || c.Title.toLowerCase().includes(tp);
        const iOk = c.Issue.replace(/^#/, "") === ip || c.Issue === ip || String(parseFloat(c.Issue)) === ip;
        return tOk && iOk;
      }
      return [
        c.Title, c.Issue, c.Publisher, c.Writer, c.Artist,
        c.Cover_Artist, c.Signed_By, c.Key_Reason, c.First_App,
        c.Arc, c.Seller_Notes, c.Era, c.Universe, `box ${c.Box}`,
        c.Story_Pitch, c.Imprint, c.Terrificon,
      ].join(" ").toLowerCase().includes(q);
    });
  }, [searched, query, publisher, era, platform, boxFilter, keysOnly, signedOnly, familyFilter, exactTitle]);

  const cardSlice = useMemo(() => {
    const start = (cardPage - 1) * CARD_PAGE;
    return results.slice(start, start + CARD_PAGE);
  }, [results, cardPage]);

  const handleSearch = useCallback(() => { setSearched(true); setCardPage(1); }, []);
  const handleClear  = useCallback(() => {
    setQuery(""); setPub(""); setEra(""); setPlat(""); setBoxFilter("");
    setKeysOnly(false); setSignedOnly(false); setFamily(""); setExactTitle("");
    setCardPage(1);
  }, []);

  const topWriters = useMemo(() => {
    if (results.length === 0) return [];
    const counts: Record<string,number> = {};
    results.forEach(c => { if (c.Writer) counts[c.Writer] = (counts[c.Writer]||0)+1; });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([w])=>w);
  }, [results]);

  const topArtists = useMemo(() => {
    if (results.length === 0) return [];
    const counts: Record<string,number> = {};
    results.forEach(c => { if (c.Artist) counts[c.Artist] = (counts[c.Artist]||0)+1; });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([a])=>a);
  }, [results]);

  const isCreatorSearch = searched && query && results.some(c =>
    c.Writer?.toLowerCase().includes(query.toLowerCase()) ||
    c.Artist?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{ maxWidth:1400, margin:"0 auto", padding:"16px 14px 60px" }}>

      {/* ─── Search bar ─── */}
      <div className="filters" style={{ borderRadius:8, marginBottom:14, padding:"14px 18px" }}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>

          <div style={{ flex:"1 1 240px", display:"flex", flexDirection:"column", gap:4 }}>
            <label className="filter-label">Search — title, writer, artist, signer, key reason, 1st appearance, arc, notes</label>
            <div style={{ position:"relative" }}>
              <input
                className="search-input"
                value={query}
                onChange={e=>setQuery(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&handleSearch()}
                placeholder="e.g. Tom King, Damian Wayne, Jim Lee, Wolverine, Carnage, Krakoa…"
                style={{ width:"100%", paddingRight:32 }}
              />
              {query && (
                <button onClick={()=>setQuery("")} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"var(--muted)", fontSize:"1rem" }}>×</button>
              )}
            </div>
          </div>

          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"flex-end" }}>
            {[
              { label:"Box",       val:boxFilter, set:setBoxFilter, opts:BOXES      },
              { label:"Publisher", val:publisher,  set:setPub,       opts:PUBLISHERS },
              { label:"Platform",  val:platform,   set:setPlat,      opts:PLATFORMS  },
              { label:"Era",       val:era,        set:setEra,       opts:ERAS       },
            ].map(f=>(
              <div key={f.label} style={{ display:"flex", flexDirection:"column", gap:4 }}>
                <label className="filter-label">{f.label}</label>
                <select className="filter-select" value={f.val} onChange={e=>f.set(e.target.value)} style={{ minWidth:90 }}>
                  <option value="">All</option>
                  {f.opts.map(o=><option key={o} value={o}>{f.label==="Box"?`Box ${o}`:o}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <label className="filter-label">Filter</label>
            <div style={{ display:"flex", gap:8 }}>
              <label className="toggle-pill">
                <input type="checkbox" checked={keysOnly} onChange={e=>setKeysOnly(e.target.checked)} />⭐ Keys
              </label>
              <label className="toggle-pill">
                <input type="checkbox" checked={signedOnly} onChange={e=>setSignedOnly(e.target.checked)} />✍ Signed
              </label>
            </div>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <label className="filter-label" style={{ color:"transparent" }}>.</label>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn-search" onClick={handleSearch}>Search</button>
              {searched && <button className="btn-clear" onClick={handleClear}>Clear</button>}
            </div>
          </div>
        </div>

        {/* Character family pills */}
        <div style={{ marginTop:12, display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
          <button
            onClick={() => setShowFams(!showFamilies)}
            style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.7rem", letterSpacing:"1.5px", color:"var(--muted2)", background:"none", border:"1px solid var(--border)", borderRadius:4, padding:"3px 10px", cursor:"pointer" }}
          >
            {showFamilies ? "▲" : "▼"} Character Family
          </button>
          {showFamilies && (
            <>
              {familyFilter && (
                <button onClick={() => setFamily("")} style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem", letterSpacing:"1px", color:"var(--red)", background:"rgba(200,16,46,0.08)", border:"1px solid var(--red)", borderRadius:12, padding:"3px 10px", cursor:"pointer" }}>
                  ✕ {familyFilter}
                </button>
              )}
              {CHAR_FAMILIES.map(f => (
                <button
                  key={f.name}
                  onClick={() => { setFamily(f.name === familyFilter ? "" : f.name); setSearched(true); setCardPage(1); }}
                  style={{
                    fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem", letterSpacing:"1px",
                    color: familyFilter === f.name ? "#fff" : "var(--muted2)",
                    background: familyFilter === f.name ? "var(--red)" : "var(--surface)",
                    border: `1px solid ${familyFilter === f.name ? "var(--red)" : "var(--border)"}`,
                    borderRadius:12, padding:"3px 10px", cursor:"pointer", whiteSpace:"nowrap",
                  }}
                >
                  {f.emoji} {f.name}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Creator chips after search */}
      {searched && isCreatorSearch && (topWriters.length > 0 || topArtists.length > 0) && (
        <div style={{ marginBottom:12, display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
          {topWriters.length > 0 && <>
            <span style={{ fontSize:"0.62rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", color:"var(--muted2)" }}>Writers:</span>
            {topWriters.map(w=>(
              <button key={w} onClick={()=>{ setQuery(w); handleSearch(); }}
                style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:20, padding:"2px 10px", fontSize:"0.72rem", cursor:"pointer", color:"var(--text2)" }}>{w}</button>
            ))}
          </>}
          {topArtists.length > 0 && <>
            <span style={{ fontSize:"0.62rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", color:"var(--muted2)", marginLeft:8 }}>Artists:</span>
            {topArtists.map(a=>(
              <button key={a} onClick={()=>{ setQuery(a); handleSearch(); }}
                style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:20, padding:"2px 10px", fontSize:"0.72rem", cursor:"pointer", color:"var(--text2)" }}>{a}</button>
            ))}
          </>}
        </div>
      )}

      {/* Exact title mode badge */}
      {exactTitle && (
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10,
          background:"#fef2f2", border:"1.5px solid var(--red)", borderRadius:6, padding:"8px 14px" }}>
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"2px", color:"var(--red)" }}>
            TITLE FILTER — EXACT MATCH
          </span>
          <span style={{ fontWeight:700, color:"var(--brown-light)", fontSize:"0.9rem" }}>{exactTitle}</span>
          <button onClick={() => { setExactTitle(""); setSearched(true); }}
            style={{ marginLeft:"auto", background:"none", border:"1px solid var(--red)", borderRadius:4,
              padding:"2px 10px", cursor:"pointer", fontFamily:"'Bebas Neue',sans-serif",
              fontSize:"0.65rem", letterSpacing:"1.5px", color:"var(--red)" }}>
            CLEAR ✕
          </button>
        </div>
      )}

      {/* Results header */}
      {searched && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1.5px", fontSize:"0.82rem", color:"var(--muted2)" }}>
            {results.length === 0
              ? "No results — try a different search"
              : <><span style={{ color:"var(--red)", fontSize:"1.05rem" }}>{results.length.toLocaleString()}</span> {results.length===1?"book":"books"} {familyFilter && `· ${familyFilter}`} {exactTitle && `· "${exactTitle}" only`} — {ALL.length.toLocaleString()} total, {DATA3.boxes.length} boxes</>
            }
          </div>
          <div style={{ display:"flex", gap:6 }}>
            {(["list","card"] as const).map(v=>(
              <button key={v} onClick={()=>setView(v)}
                style={{
                  fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", letterSpacing:"1.5px",
                  padding:"5px 14px", border:`1.5px solid ${view===v?"var(--red)":"var(--border)"}`,
                  background:view===v?"var(--red)":"var(--surface)", color:view===v?"#fff":"var(--muted2)",
                  borderRadius:4, cursor:"pointer",
                }}>
                {v==="list"?"≡ List":"⊞ Cards"}
              </button>
            ))}
          </div>
        </div>
      )}


      {/* Results — list */}
      {searched && results.length > 0 && view === "list" && (
        <SortableTable rows={results} cols={cols} rowKey={(_r,i)=>String(i)} pageSize={100} defaultSortKey="box" expandCell={c => (
          <div>
            <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
              {c.Arc       && <div className="dr"><span className="dl">Arc</span><span className="dv">{c.Arc}</span></div>}
              {c.Key_Reason   && <div className="dr"><span className="dl">Key</span><span className="dv" style={{color:"var(--gold)"}}>{c.Key_Reason}</span></div>}
              {c.First_App && <div className="dr"><span className="dl">1st App</span><span className="dv">{c.First_App}</span></div>}
              {(c.Signed||"").toUpperCase()==="YES" && c.Signed_By && <div className="dr"><span className="dl">Signed By</span><span className="dv">{c.Signed_By}</span></div>}
              {c.Terrificon && <div className="dr"><span className="dl">Terrificon</span><span className="dv" style={{color:"#f59e0b"}}>{c.Terrificon}</span></div>}
              {c.Condition && <div className="dr"><span className="dl">Condition</span><span className="dv">{c.Condition}</span></div>}
              {c.Imprint   && <div className="dr"><span className="dl">Imprint</span><span className="dv">{c.Imprint}</span></div>}
            </div>
            {c.Story_Pitch && (
              <div style={{ marginTop:6, color:"var(--muted2)", fontSize:"0.85rem", lineHeight:1.5 }}>{c.Story_Pitch.substring(0,220)}</div>
            )}
            <div style={{ marginTop:8 }}>
              <a href={`https://comicvine.gamespot.com/search/?q=${encodeURIComponent(c.Title + " " + c.Issue)}`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize:"0.72rem", color:"var(--muted2)", textDecoration:"underline" }}>
                🔎 View cover on Comic Vine
              </a>
            </div>
          </div>
        )} />
      )}

      {/* Results — cards */}
      {searched && results.length > 0 && view === "card" && (
        <>
          <div className="ev-card-grid">
            {cardSlice.map((c,i)=>(
              <EverythingCard key={i} comic={c}
                onTitleClick={t=>{setExactTitle(t);setQuery("");setSearched(true);setCardPage(1);}} />
            ))}
          </div>
          <Paginator
            total={results.length} page={cardPage} pageSize={CARD_PAGE}
            pageCount={Math.ceil(results.length/CARD_PAGE)}
            onChange={p=>{ setCardPage(p); window.scrollTo({top:0,behavior:"smooth"}); }}
          />
        </>
      )}

      {searched && results.length === 0 && (
        <div style={{ textAlign:"center", padding:"48px 20px", color:"var(--muted2)", fontSize:"0.9rem" }}>
          <div style={{ fontSize:"1.5rem", marginBottom:8, opacity:0.4 }}>🔍</div>
          No comics found matching those criteria. Try a broader search.
        </div>
      )}
    </div>
  );
}

function EverythingCard({ comic: c, onTitleClick }: { comic: Comic; onTitleClick?: (title: string) => void }) {
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
              {isSigned && <span className="badge bgold" style={{fontSize:"0.57rem"}}>SIGNED</span>}
              {c.Platform && <span className={`badge ${platClass(c.Platform)}`} style={{fontSize:"0.57rem"}}>{c.Platform}</span>}
            </div>
          </div>
          {onTitleClick
            ? <button className="title-link" style={{fontSize:"inherit",fontWeight:600,lineHeight:1.3}} onClick={e=>{e.stopPropagation();onTitleClick(c.Title);}} title="Click to show only this title">{c.Title}</button>
            : <div className="card-title">{c.Title}</div>
          }
          <div className="card-issue">{c.Issue}{c.Year?` · ${c.Year}`:""}</div>
          {c.Publisher && <div className="card-pub">{c.Publisher}{c.Era?` · ${c.Era}`:""}</div>}
        </div>
      </div>

      {(c.Writer || c.Artist) && (
        <div style={{ fontSize:"0.72rem", color:"var(--muted2)", lineHeight:1.4, marginBottom:4 }}>
          {c.Writer && <div><span style={{color:"var(--muted)"}}>W:</span> {c.Writer}</div>}
          {c.Artist && c.Artist !== c.Writer && <div><span style={{color:"var(--muted)"}}>A:</span> {c.Artist}</div>}
        </div>
      )}

      {isKey && c.Key_Reason && (
        <div style={{ fontSize:"0.78rem", color:"#8a6000", marginTop:4, lineHeight:1.4, background:"#fff8e0", borderRadius:3, padding:"3px 8px" }}>
          {c.Key_Reason.substring(0, 110)}
        </div>
      )}

      {isSigned && c.Signed_By && (
        <div style={{ fontSize:"0.7rem", color:"var(--brown)", marginTop:4 }}>✍ {c.Signed_By}{c.Personal ? ` — "${c.Personal}"` : ""}</div>
      )}

      {(c.Value_NM || c.Value_VF) && (
        <div style={{ display:"flex", gap:10, marginTop:6, fontSize:"0.72rem" }}>
          {c.Value_NM && c.Value_NM!=="nan" && <span style={{color:"var(--green-text)"}}>NM <strong>${c.Value_NM}</strong></span>}
          {(()=>{ const v=c.Value_VF&&c.Value_VF!=="nan"?c.Value_VF.match(/(\d+(?:\.\d+)?)/)?.[1]:""; return v?<span style={{color:"var(--muted)"}}>VF <strong>${v}</strong></span>:null; })()}
        </div>
      )}
    </div>
  );
}
