import { useState, useMemo, useCallback } from "react";
import { DATA1 } from "@/data/data1";
import { DATA2 } from "@/data/data2";
import { SortableTable, ColDef } from "@/components/SortableTable";
import { Paginator } from "@/components/Paginator";

const CARD_PAGE = 48;

// ── Unified record ────────────────────────────────────────────────────────────
interface UnifiedComic {
  _id:      string;
  _source:  "box" | "orig";
  Box:      string;   // box number or "Sales"
  Title:    string;
  Issue:    string;
  Publisher:string;
  Year:     string;
  Era:      string;
  Universe: string;
  Arc:      string;
  Key:      string;
  Key_Why:  string;
  First_App:string;
  Writer:   string;
  Artist:   string;
  Cover_Artist: string;
  Signed:   string;
  Signed_By:string;
  Condition:string;
  Value_NM: string;
  Value_VF: string;
  Platform: string;
  Notes:    string;
  Start_Bid:string;
}

const orig  = DATA1.orig_inventory;
const boxes = DATA2.boxes_inventory;

const ALL: UnifiedComic[] = [
  ...boxes.map((c, i): UnifiedComic => ({
    _id: `box-${i}`, _source: "box",
    Box: c.Box, Title: c.Title, Issue: c.Issue, Publisher: c.Publisher,
    Year: c.Year, Era: c.Era, Universe: c.Universe, Arc: c.Arc,
    Key: c.Key, Key_Why: c.Key_Why, First_App: c.First_App,
    Writer: c.Writer, Artist: c.Artist, Cover_Artist: c.Cover_Artist,
    Signed: c.Signed, Signed_By: c.Signed_By, Condition: c.Condition,
    Value_NM: c.Value_NM, Value_VF: c.Value_VF, Platform: c.Platform,
    Notes: c.Notes, Start_Bid: c.Start_Bid,
  })),
  ...orig.map((c, i): UnifiedComic => ({
    _id: `orig-${i}`, _source: "orig",
    Box: "Sales", Title: c.Title ?? "", Issue: c.Issue ?? "",
    Publisher: c.Publisher ?? "", Year: c.Year ?? "", Era: c.Era ?? "",
    Universe: (c as any).Universe ?? "", Arc: (c as any).Arc ?? "",
    Key: c.Key ?? "", Key_Why: (c as any).Key_Why ?? "",
    First_App: (c as any).First_App ?? "",
    Writer: (c as any).Writer ?? "", Artist: (c as any).Artist ?? "",
    Cover_Artist: (c as any).Cover_Artist ?? "",
    Signed: c.Signed ?? "", Signed_By: c.Signed_By ?? "",
    Condition: (c as any).Condition ?? "", Value_NM: c.Value_NM ?? "",
    Value_VF: c.Value_VF ?? "", Platform: c.Platform ?? "",
    Notes: (c as any).Notes ?? "", Start_Bid: (c as any).Start_Bid ?? "",
  })),
];

// Unique filter options
const PUBLISHERS = ["", ...new Set(ALL.map(c => c.Publisher).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
const ERAS       = ["", ...new Set(ALL.map(c => c.Era).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
const PLATFORMS  = ["", ...new Set(ALL.map(c => c.Platform).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
const SOURCES    = ["", "Boxes", "Sales Inventory"];

function parseVal(v: string | undefined | null) {
  return parseFloat(String(v || "").replace(/[^0-9.]/g, "") || "0");
}

function platClass(p: string) {
  const u = (p || "").toUpperCase();
  if (u === "WHATNOT") return "bwn";
  if (u === "EBAY")    return "beb";
  if (u.includes("HERITAGE")) return "bhe";
  return "bb";
}

function SourceBadge({ src, box }: { src: "box"|"orig"; box: string }) {
  if (src === "orig") return (
    <span style={{ fontSize:"0.62rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
      background:"#1d6fa415", border:"1.5px solid #1d6fa4", color:"#1d6fa4",
      borderRadius:3, padding:"1px 7px", whiteSpace:"nowrap" }}>Sales</span>
  );
  return (
    <span style={{ fontSize:"0.62rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
      background:"#7a5c3a18", border:"1.5px solid #7a5c3a", color:"#7a5c3a",
      borderRadius:3, padding:"1px 7px", whiteSpace:"nowrap" }}>Box {box}</span>
  );
}

// ── List columns ──────────────────────────────────────────────────────────────
const COLS: ColDef<UnifiedComic>[] = [
  {
    key:"source", label:"Source", defaultWidth:80,
    sort:(a,b)=>a.Box.localeCompare(b.Box),
    cell:r=><SourceBadge src={r._source} box={r.Box} />,
  },
  {
    key:"title", label:"Title", defaultWidth:220,
    sort:(a,b)=>a.Title.localeCompare(b.Title),
    cell:r=><span className="lt-title">{r.Title||"Untitled"}</span>,
  },
  {
    key:"issue", label:"#", defaultWidth:55,
    sort:(a,b)=>parseVal(a.Issue)-parseVal(b.Issue),
    cell:r=><span className="lt-sub">{r.Issue}</span>,
  },
  {
    key:"publisher", label:"Publisher", defaultWidth:100,
    sort:(a,b)=>a.Publisher.localeCompare(b.Publisher),
    cell:r=><span className="lt-sub">{r.Publisher}</span>,
  },
  {
    key:"writer", label:"Writer", defaultWidth:130,
    sort:(a,b)=>a.Writer.localeCompare(b.Writer),
    cell:r=><span className="lt-sub">{r.Writer||"—"}</span>,
  },
  {
    key:"artist", label:"Artist", defaultWidth:130,
    sort:(a,b)=>a.Artist.localeCompare(b.Artist),
    cell:r=><span className="lt-sub">{r.Artist||"—"}</span>,
  },
  {
    key:"key", label:"Key", defaultWidth:55,
    sort:(a,b)=>a.Key.localeCompare(b.Key),
    cell:r=>r.Key.toUpperCase()==="YES"
      ?<span className="badge bkey" style={{fontSize:"0.6rem"}}>KEY</span>:null,
  },
  {
    key:"nm", label:"NM Value", defaultWidth:90,
    sort:(a,b)=>parseVal(a.Value_NM)-parseVal(b.Value_NM),
    cell:r=><span className="lt-val">{r.Value_NM||"—"}</span>,
  },
  {
    key:"platform", label:"Platform", defaultWidth:90,
    sort:(a,b)=>a.Platform.localeCompare(b.Platform),
    cell:r=>r.Platform
      ?<span className={`badge ${platClass(r.Platform)}`} style={{fontSize:"0.6rem"}}>{r.Platform}</span>
      :null,
  },
  {
    key:"year", label:"Year", defaultWidth:65,
    sort:(a,b)=>parseVal(a.Year)-parseVal(b.Year),
    cell:r=><span className="lt-sub">{r.Year}</span>,
  },
  {
    key:"signed", label:"Signed", defaultWidth:80,
    sort:(a,b)=>a.Signed.localeCompare(b.Signed),
    cell:r=>r.Signed.toUpperCase()==="YES"
      ?<span className="lt-sub" style={{color:"var(--gold)"}}>✍ {r.Signed_By||"Yes"}</span>:null,
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function Everything() {
  const [query,      setQuery]     = useState("");
  const [publisher,  setPub]       = useState("");
  const [era,        setEra]       = useState("");
  const [platform,   setPlat]      = useState("");
  const [sourceF,    setSourceF]   = useState("");
  const [keysOnly,   setKeysOnly]  = useState(false);
  const [signedOnly, setSignedOnly]= useState(false);
  const [view,       setView]      = useState<"list"|"card">("list");
  const [searched,   setSearched]  = useState(false);
  const [cardPage,   setCardPage]  = useState(1);

  const results = useMemo(() => {
    if (!searched) return [];

    const q = query.trim().toLowerCase();

    return ALL.filter(c => {
      if (keysOnly  && c.Key.toUpperCase()    !== "YES") return false;
      if (signedOnly && c.Signed.toUpperCase() !== "YES") return false;
      if (publisher  && c.Publisher !== publisher)         return false;
      if (era        && c.Era !== era)                     return false;
      if (platform   && c.Platform !== platform)           return false;
      if (sourceF === "Boxes"           && c._source !== "box")  return false;
      if (sourceF === "Sales Inventory" && c._source !== "orig") return false;

      if (!q) return true;

      return (
        c.Title.toLowerCase().includes(q)       ||
        c.Issue.toLowerCase().includes(q)        ||
        c.Publisher.toLowerCase().includes(q)    ||
        c.Writer.toLowerCase().includes(q)       ||
        c.Artist.toLowerCase().includes(q)       ||
        c.Cover_Artist.toLowerCase().includes(q) ||
        c.Signed_By.toLowerCase().includes(q)    ||
        c.Key_Why.toLowerCase().includes(q)      ||
        c.First_App.toLowerCase().includes(q)    ||
        c.Arc.toLowerCase().includes(q)          ||
        c.Notes.toLowerCase().includes(q)        ||
        c.Era.toLowerCase().includes(q)          ||
        c.Universe.toLowerCase().includes(q)     ||
        `box ${c.Box}`.toLowerCase().includes(q)
      );
    });
  }, [searched, query, publisher, era, platform, sourceF, keysOnly, signedOnly]);

  const cardSlice = useMemo(() => {
    const start = (cardPage - 1) * CARD_PAGE;
    return results.slice(start, start + CARD_PAGE);
  }, [results, cardPage]);

  const handleSearch = useCallback(() => {
    setSearched(true);
    setCardPage(1);
  }, []);

  const handleClear = useCallback(() => {
    setQuery(""); setPub(""); setEra(""); setPlat(""); setSourceF("");
    setKeysOnly(false); setSignedOnly(false);
    setSearched(false); setCardPage(1);
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
  }

  // Creator quick-filter chips derived from current results
  const topWriters = useMemo(() => {
    if (!searched || results.length === 0) return [];
    const counts: Record<string,number> = {};
    results.forEach(c => { if (c.Writer) counts[c.Writer] = (counts[c.Writer]||0)+1; });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([w])=>w);
  }, [results, searched]);

  const topArtists = useMemo(() => {
    if (!searched || results.length === 0) return [];
    const counts: Record<string,number> = {};
    results.forEach(c => { if (c.Artist) counts[c.Artist] = (counts[c.Artist]||0)+1; });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([a])=>a);
  }, [results, searched]);

  const isCreatorSearch = query && (
    results.some(c => c.Writer.toLowerCase().includes(query.toLowerCase()) ||
                       c.Artist.toLowerCase().includes(query.toLowerCase()) ||
                       c.Cover_Artist.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 16px 60px" }}>

      {/* ── Search bar ── */}
      <div className="filters" style={{ borderRadius: 8, marginBottom: 16, padding: "16px 20px" }}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>

          {/* Main search */}
          <div style={{ flex:"1 1 260px", display:"flex", flexDirection:"column", gap:4 }}>
            <label style={{ fontSize:"0.65rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1.5px", color:"var(--muted2)" }}>
              Search — title, issue, publisher, writer, artist, cover artist, signer, notes
            </label>
            <div style={{ position:"relative" }}>
              <input
                className="search-input"
                value={query}
                onChange={e=>setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="e.g. Tom King, Batman, Jiménez, Miles Morales…"
                style={{ width:"100%", paddingRight:32 }}
              />
              {query && (
                <button onClick={()=>setQuery("")} style={{
                  position:"absolute", right:8, top:"50%", transform:"translateY(-50%)",
                  background:"none", border:"none", cursor:"pointer", color:"var(--muted)", fontSize:"1rem", lineHeight:1,
                }}>×</button>
              )}
            </div>
          </div>

          {/* Dropdowns */}
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"flex-end" }}>
            {[
              { label:"Source",    val:sourceF,   set:setSourceF,  opts:SOURCES },
              { label:"Publisher", val:publisher,  set:setPub,      opts:PUBLISHERS },
              { label:"Platform",  val:platform,   set:setPlat,     opts:PLATFORMS },
              { label:"Era",       val:era,        set:setEra,      opts:ERAS },
            ].map(f=>(
              <div key={f.label} style={{ display:"flex", flexDirection:"column", gap:4 }}>
                <label style={{ fontSize:"0.62rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1.5px", color:"var(--muted2)" }}>{f.label}</label>
                <select className="filter-select" value={f.val} onChange={e=>f.set(e.target.value)} style={{ minWidth:110 }}>
                  <option value="">All</option>
                  {f.opts.filter(Boolean).map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Toggles */}
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <label style={{ fontSize:"0.62rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1.5px", color:"var(--muted2)" }}>Filter</label>
            <div style={{ display:"flex", gap:8 }}>
              <label className="toggle-pill">
                <input type="checkbox" checked={keysOnly} onChange={e=>setKeysOnly(e.target.checked)} />
                Keys Only
              </label>
              <label className="toggle-pill">
                <input type="checkbox" checked={signedOnly} onChange={e=>setSignedOnly(e.target.checked)} />
                Signed Only
              </label>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <label style={{ fontSize:"0.62rem", color:"transparent" }}>.</label>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn-search" onClick={handleSearch}>Search</button>
              {searched && <button className="btn-clear" onClick={handleClear}>Clear</button>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Creator quick-search chips (shown after a result set) ── */}
      {searched && (topWriters.length > 0 || topArtists.length > 0) && isCreatorSearch && (
        <div style={{ marginBottom: 14, display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
          <span style={{ fontSize:"0.65rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", color:"var(--muted2)" }}>Top Writers:</span>
          {topWriters.map(w=>(
            <button key={w} onClick={()=>{ setQuery(w); setSearched(true); setCardPage(1); }}
              style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:20,
                padding:"2px 10px", fontSize:"0.72rem", cursor:"pointer", color:"var(--text2)",
                fontFamily:"'Crimson Pro',Georgia,serif", transition:"border-color 0.15s" }}
              onMouseOver={e=>(e.currentTarget.style.borderColor="#c8102e")}
              onMouseOut={e=>(e.currentTarget.style.borderColor="var(--border)")}
            >{w}</button>
          ))}
          {topArtists.length > 0 && <>
            <span style={{ fontSize:"0.65rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", color:"var(--muted2)", marginLeft:8 }}>Top Artists:</span>
            {topArtists.map(a=>(
              <button key={a} onClick={()=>{ setQuery(a); setSearched(true); setCardPage(1); }}
                style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:20,
                  padding:"2px 10px", fontSize:"0.72rem", cursor:"pointer", color:"var(--text2)",
                  fontFamily:"'Crimson Pro',Georgia,serif", transition:"border-color 0.15s" }}
                onMouseOver={e=>(e.currentTarget.style.borderColor="#7a5c3a")}
                onMouseOut={e=>(e.currentTarget.style.borderColor="var(--border)")}
              >{a}</button>
            ))}
          </>}
        </div>
      )}

      {/* ── Results header ── */}
      {searched && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1.5px", fontSize:"0.85rem", color:"var(--muted2)" }}>
            {results.length === 0
              ? "No results"
              : <><span style={{ color:"var(--red)", fontSize:"1.1rem" }}>{results.length.toLocaleString()}</span> {results.length===1?"book":"books"} across both collections</>}
          </div>
          <div style={{ display:"flex", gap:6 }}>
            {(["list","card"] as const).map(v=>(
              <button key={v} onClick={()=>setView(v)}
                style={{
                  fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.75rem", letterSpacing:"1.5px",
                  padding:"5px 14px", border:`1.5px solid ${view===v?"var(--red)":"var(--border)"}`,
                  background:view===v?"var(--red)":"var(--surface)", color:view===v?"#fff":"var(--muted2)",
                  borderRadius:4, cursor:"pointer", transition:"all 0.15s",
                }}>
                {v==="list"?"≡ List":"⊞ Cards"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Blank state ── */}
      {!searched && (
        <div style={{ textAlign:"center", padding:"60px 20px", color:"var(--muted2)" }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.5rem", letterSpacing:"3px", marginBottom:10, color:"var(--text2)" }}>
            Search Everything
          </div>
          <div style={{ fontSize:"0.9rem", lineHeight:1.7 }}>
            2,462 comics — both the boxed collection and sales inventory — in one search.<br />
            Search by title, issue, publisher, writer, artist, cover artist, signer, key notes, or anything else.
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap", marginTop:20 }}>
            {["Tom King","Frank Miller","Jim Lee","Donny Cates","Neal Adams","Grant Morrison"].map(name=>(
              <button key={name} onClick={()=>{ setQuery(name); setSearched(true); }}
                style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:20,
                  padding:"5px 14px", fontSize:"0.8rem", cursor:"pointer", color:"var(--text2)",
                  fontFamily:"'Crimson Pro',Georgia,serif" }}>
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {searched && results.length > 0 && view === "list" && (
        <SortableTable rows={results} cols={COLS} rowKey={(r,i)=>r._id ?? i} pageSize={50} />
      )}

      {searched && results.length > 0 && view === "card" && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(210px,1fr))", gap:10 }}>
            {cardSlice.map(c=><EverythingCard key={c._id} comic={c} />)}
          </div>
          <Paginator
            total={results.length}
            page={cardPage}
            pageSize={CARD_PAGE}
            pageCount={Math.ceil(results.length / CARD_PAGE)}
            onChange={p=>{ setCardPage(p); window.scrollTo({top:0,behavior:"smooth"}); }}
          />
        </>
      )}

      {searched && results.length === 0 && (
        <div style={{ textAlign:"center", padding:"48px 20px", color:"var(--muted2)", fontSize:"0.9rem" }}>
          No comics found matching those criteria.
        </div>
      )}
    </div>
  );
}

// ── Card component ────────────────────────────────────────────────────────────
function EverythingCard({ comic: c }: { comic: UnifiedComic }) {
  const isKey    = c.Key.toUpperCase() === "YES";
  const isSigned = c.Signed.toUpperCase() === "YES";

  return (
    <div className="comic-card" style={{ borderTop: isKey ? "3px solid var(--gold)" : undefined }}>
      {/* Source tag */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
        <SourceBadge src={c._source} box={c.Box} />
        <div style={{ display:"flex", gap:4, flexWrap:"wrap", justifyContent:"flex-end" }}>
          {isKey    && <span className="badge bkey"   style={{fontSize:"0.58rem"}}>KEY</span>}
          {isSigned && <span className="badge bgold"  style={{fontSize:"0.58rem"}}>SIGNED</span>}
          {c.Platform && <span className={`badge ${platClass(c.Platform)}`} style={{fontSize:"0.58rem"}}>{c.Platform}</span>}
        </div>
      </div>

      {/* Title / issue */}
      <div className="card-title">{c.Title}</div>
      <div className="card-issue">#{c.Issue}{c.Year ? ` · ${c.Year}` : ""}</div>

      {/* Publisher / era */}
      {c.Publisher && <div className="card-pub">{c.Publisher}{c.Era ? ` · ${c.Era}` : ""}</div>}

      {/* Creator line */}
      {(c.Writer || c.Artist) && (
        <div style={{ fontSize:"0.72rem", color:"var(--muted2)", marginTop:5, lineHeight:1.4 }}>
          {c.Writer && <div><span style={{color:"var(--muted)"}}>W:</span> {c.Writer}</div>}
          {c.Artist && c.Artist !== c.Writer && <div><span style={{color:"var(--muted)"}}>A:</span> {c.Artist}</div>}
          {c.Cover_Artist && c.Cover_Artist !== c.Artist && <div><span style={{color:"var(--muted)"}}>CA:</span> {c.Cover_Artist}</div>}
        </div>
      )}

      {/* Key why */}
      {isKey && c.Key_Why && (
        <div style={{ fontSize:"0.7rem", color:"var(--gold)", marginTop:5, lineHeight:1.4, fontStyle:"italic" }}>
          {c.Key_Why}
        </div>
      )}

      {/* Signed by */}
      {isSigned && c.Signed_By && (
        <div style={{ fontSize:"0.7rem", color:"var(--brown)", marginTop:4 }}>✍ {c.Signed_By}</div>
      )}

      {/* Value */}
      {(c.Value_NM || c.Value_VF) && (
        <div style={{ display:"flex", gap:12, marginTop:6, fontSize:"0.72rem", color:"var(--green-text)" }}>
          {c.Value_NM && <span>NM <strong>{c.Value_NM}</strong></span>}
          {c.Value_VF && <span>VF <strong>{c.Value_VF}</strong></span>}
        </div>
      )}
    </div>
  );
}
