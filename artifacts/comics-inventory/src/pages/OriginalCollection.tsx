import { useState, useMemo, useRef } from "react";
import { DATA3 } from "@/data/data3";
import { SortableTable, ColDef } from "@/components/SortableTable";
import { Paginator } from "@/components/Paginator";

const CARD_PAGE_SIZE = 100;

const allComics  = DATA3.comics;
const comics     = allComics.filter(c =>
  (c.Key    || "").toUpperCase() === "YES" ||
  (c.Signed || "").toUpperCase() === "YES"
);
const PUBLISHERS = [...new Set(comics.map(c => c.Publisher).filter(Boolean))].sort();
const ERAS       = [...new Set(comics.map(c => c.Era).filter(Boolean))].sort();
const PLATFORMS  = [...new Set(comics.map(c => c.Platform).filter(Boolean))].sort();

type Comic = (typeof comics)[number];

function platClass(p: string) {
  const u = (p || "").toUpperCase();
  if (u === "WHATNOT") return "bwn";
  if (u === "EBAY")    return "beb";
  if (u.includes("HERITAGE")) return "bhe";
  return "bb";
}

function parseVal(v: string | undefined | null) {
  if (!v) return 0;
  return parseFloat(String(v).replace(/[^0-9.]/g, "") || "0");
}

const LIST_COLS: ColDef<Comic>[] = [
  {
    key: "box", label: "Box", defaultWidth: 55,
    sort: (a, b) => Number(a.Box) - Number(b.Box),
    cell: r => <span className="lt-sub">{r.Box}</span>,
  },
  {
    key: "title", label: "Title", defaultWidth: 220,
    sort: (a, b) => (a.Title || "").localeCompare(b.Title || ""),
    cell: r => (
      <button className="title-link" onClick={e=>{e.stopPropagation();_salTitleClick?.(r.Title||"");}}>
        {r.Title || "Untitled"}
      </button>
    ),
  },
  {
    key: "issue", label: "#", defaultWidth: 60,
    sort: (a, b) => parseVal(a.Issue) - parseVal(b.Issue),
    cell: r => <span className="lt-sub">{r.Issue}</span>,
  },
  {
    key: "publisher", label: "Publisher", defaultWidth: 100,
    sort: (a, b) => (a.Publisher || "").localeCompare(b.Publisher || ""),
    cell: r => <span className="lt-sub">{r.Publisher}</span>,
  },
  {
    key: "writer", label: "Writer", defaultWidth: 130,
    sort: (a, b) => (a.Writer || "").localeCompare(b.Writer || ""),
    cell: r => <span className="lt-sub">{r.Writer && r.Writer !== "nan" ? r.Writer : "—"}</span>,
  },
  {
    key: "artist", label: "Artist", defaultWidth: 130,
    sort: (a, b) => (a.Artist || "").localeCompare(b.Artist || ""),
    cell: r => <span className="lt-sub">{r.Artist && r.Artist !== "nan" ? r.Artist : "—"}</span>,
  },
  {
    key: "year", label: "Year", defaultWidth: 70,
    sort: (a, b) => parseVal(a.Year) - parseVal(b.Year),
    cell: r => <span className="lt-sub">{r.Year}</span>,
  },
  {
    key: "era", label: "Era", defaultWidth: 80,
    sort: (a, b) => (a.Era || "").localeCompare(b.Era || ""),
    cell: r => r.Era ? <span className="badge be" style={{ fontSize: "0.62rem" }}>{r.Era}</span> : null,
  },
  {
    key: "nm", label: "NM Value", defaultWidth: 90,
    sort: (a, b) => parseVal(a.Value_NM) - parseVal(b.Value_NM),
    cell: r => <span className="lt-val">{r.Value_NM ? `$${r.Value_NM}` : "—"}</span>,
  },
  {
    key: "vf", label: "VF Value", defaultWidth: 80,
    sort: (a, b) => parseVal(a.Value_VF) - parseVal(b.Value_VF),
    cell: r => <span className="lt-vf">{r.Value_VF ? `$${r.Value_VF}` : "—"}</span>,
  },
  {
    key: "platform", label: "Platform", defaultWidth: 110,
    sort: (a, b) => (a.Platform || "").localeCompare(b.Platform || ""),
    cell: r => r.Platform ? <span className={`badge ${platClass(r.Platform)}`} style={{ fontSize: "0.62rem" }}>{r.Platform}</span> : null,
  },
  {
    key: "flags", label: "Flags", defaultWidth: 90,
    cell: r => (
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        {(r.Key || "").toUpperCase() === "YES"       && <span className="badge bk" style={{ fontSize: "0.62rem" }}>KEY</span>}
        {(r.Signed || "").toUpperCase() === "YES"    && <span className="badge bs" style={{ fontSize: "0.62rem" }}>✍</span>}
        {(r.CGC_Worth || "").toUpperCase() === "YES" && <span className="badge bc" style={{ fontSize: "0.62rem" }}>CGC</span>}
        {!!(r.Terrificon || "").trim()               && <span className="badge bt" style={{ fontSize: "0.62rem" }}>TF</span>}
      </div>
    ),
  },
];

let _salTitleClick: ((title: string) => void) | undefined;

export default function OriginalCollection({ initSigned }: { initSigned?: string }) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [q,        setQ]        = useState("");
  const [pub,      setPub]      = useState("");
  const [era,      setEra]      = useState("");
  const [platform, setPlatform] = useState("");
  const [signed,   setSigned]   = useState(initSigned || "");
  const [keyOnly,  setKeyOnly]  = useState("");
  const [cgcOnly,  setCgcOnly]  = useState("");
  const [view,     setView]     = useState<"card" | "list">("card");
  const [open,     setOpen]     = useState<Set<number>>(new Set());
  const [cardPage, setCardPage] = useState(1);
  _salTitleClick = (t: string) => { setQ(t); setCardPage(1); };

  const results = useMemo(() => {
    const ql = q.toLowerCase();
    return comics.filter(c => {
      if (ql && ![c.Title, c.Writer, c.Artist, c.Key_Reason, c.First_App, c.Signed_By, c.Arc, c.Publisher, c.Category].join(" ").toLowerCase().includes(ql)) return false;
      if (pub      && c.Publisher !== pub) return false;
      if (era      && c.Era !== era) return false;
      if (platform && c.Platform !== platform) return false;
      if (signed   && (c.Signed || "").toUpperCase() !== signed) return false;
      if (keyOnly  && (c.Key || "").toUpperCase() !== keyOnly) return false;
      if (cgcOnly  && (c.CGC_Worth || "").toUpperCase() !== cgcOnly) return false;
      return true;
    });
  }, [q, pub, era, platform, signed, keyOnly, cgcOnly]);

  const clearFilters = () => {
    setOpen(new Set()); setCardPage(1);
    setQ(""); setPub(""); setEra(""); setPlatform(""); setSigned(""); setKeyOnly(""); setCgcOnly("");
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const toggle = (i: number) =>
    setOpen(prev => { const n = new Set(prev); n.has(i)?n.delete(i):n.add(i); return n; });

  const cardPageCount = Math.ceil(results.length / CARD_PAGE_SIZE);
  const cardSlice     = results.slice((cardPage-1)*CARD_PAGE_SIZE, cardPage*CARD_PAGE_SIZE);

  return (
    <div>
      <div className="qs-section" style={{ margin:"14px 16px 0", borderRadius:7 }}>
        <div className="qs-header">
          <span className="qs-title">SEARCH SALES INVENTORY</span>
          <span className="qs-sub">{comics.length} key &amp; signed books — active sales shelf</span>
        </div>
        <div className="qs-row">
          <input
            ref={searchInputRef}
            className="qs-input"
            placeholder="Search title, writer, character, signer, arc…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === "Enter" && setCardPage(1)}
          />
          <select className="qs-field-select" value={pub} onChange={e => { setPub(e.target.value); setCardPage(1); }}>
            <option value="">All Publishers</option>
            {PUBLISHERS.map(p => <option key={p}>{p}</option>)}
          </select>
          <select className="qs-field-select" value={era} onChange={e => { setEra(e.target.value); setCardPage(1); }}>
            <option value="">All Eras</option>
            {ERAS.map(e => <option key={e}>{e}</option>)}
          </select>
          <select className="qs-field-select" value={platform} onChange={e => { setPlatform(e.target.value); setCardPage(1); }}>
            <option value="">All Platforms</option>
            {PLATFORMS.map(p => <option key={p}>{p}</option>)}
          </select>
          <button className="qs-btn" onClick={() => setCardPage(1)}>Search →</button>
        </div>
        <div className="qs-pills">
          <button
            className={`qs-pill${signed==="YES"?" qs-pill-sgn":""}`}
            onClick={() => { setSigned(signed==="YES"?"":"YES"); setCardPage(1); }}>
            ✍️ Signed Only
          </button>
          <button
            className={`qs-pill${keyOnly==="YES"?" qs-pill-key":""}`}
            onClick={() => { setKeyOnly(keyOnly==="YES"?"":"YES"); setCardPage(1); }}>
            ★ Keys Only
          </button>
          <button
            className={`qs-pill${cgcOnly==="YES"?" qs-pill-key":""}`}
            onClick={() => { setCgcOnly(cgcOnly==="YES"?"":"YES"); setCardPage(1); }}>
            📋 CGC Candidates
          </button>
          <button
            className="qs-pill"
            style={{ marginLeft:"auto", opacity: (!q&&!pub&&!era&&!platform&&!signed&&!keyOnly&&!cgcOnly)?0.35:1 }}
            onClick={clearFilters}>
            ✕ Clear
          </button>
        </div>
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
        margin:"10px 16px 0", flexWrap:"wrap", gap:8 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1.5px", fontSize:"0.82rem", color:"var(--muted2)" }}>
          {results.length === 0
            ? "No results — try a different search"
            : <><span style={{ color:"var(--red)", fontSize:"1.05rem" }}>{results.length.toLocaleString()}</span> of {comics.length.toLocaleString()} key &amp; signed books</>
          }
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          <span style={{ fontSize:"0.72rem", color:"var(--muted2)" }}>Click headers to sort · Drag to resize</span>
          {(["list","card"] as const).map(v => (
            <button key={v} onClick={() => setView(v as "list"|"card")}
              style={{
                fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", letterSpacing:"1.5px",
                padding:"5px 14px", border:`1.5px solid ${view===v?"var(--red)":"var(--border)"}`,
                background:view===v?"var(--red)":"var(--surface)", color:view===v?"#fff":"var(--muted2)",
                borderRadius:4, cursor:"pointer", transition:"all 0.15s",
              }}>
              {v==="list"?"≡ List":"⊞ Cards"}
            </button>
          ))}
        </div>
      </div>

      {results.length === 0 && <div className="no-res">No books match your filters</div>}

      {results.length > 0 && view === "card" && (
        <div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:10, padding:"12px 16px" }}>
            {cardSlice.map((c, i) => {
              const isKey    = (c.Key    || "").toUpperCase() === "YES";
              const isSigned = (c.Signed || "").toUpperCase() === "YES";
              const isTf     = !!(c.Terrificon || "").trim();
              const nmVal    = c.Value_NM && c.Value_NM !== "nan" ? c.Value_NM : "";
              const pitch    = c.Story_Pitch && c.Story_Pitch !== "nan" ? c.Story_Pitch : "";
              const isOpen   = open.has(i);
              const accentHex = isKey ? "#c8102e" : isSigned ? "#7a5c3a" : "#e2dfd8";
              return (
                <div key={i}
                  onClick={() => toggle(i)}
                  className="flagship-card"
                  style={{
                    flex: isOpen ? "1 1 100%" : "1 1 280px",
                    borderLeftColor: accentHex,
                    borderColor: isOpen ? accentHex : accentHex+"66",
                    boxShadow: isOpen ? `0 4px 16px ${accentHex}20` : "none",
                  }}>
                  {/* Header */}
                  <div style={{ display:"flex", alignItems:"flex-start", gap:8, flexWrap:"wrap" }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      {isTf && <span className="tf-badge" style={{ marginBottom:4, display:"inline-block" }}>TERRIFICON</span>}
                      <button
                        className="title-link"
                        onClick={e => { e.stopPropagation(); setQ(c.Title||""); setCardPage(1); }}
                        style={{ display:"block", textAlign:"left", fontFamily:"'Bebas Neue',sans-serif",
                          fontSize:"0.92rem", letterSpacing:"1px", lineHeight:1.2 }}
                      >{c.Title || "Untitled"}</button>
                    </div>
                    <div style={{ fontSize:"0.7rem", color:"var(--muted)", flexShrink:0, marginTop:2 }}>
                      #{c.Issue} {isOpen?"▲":"▼"}
                    </div>
                  </div>
                  {/* Subtitle */}
                  <div style={{ fontSize:"0.8rem", color:"var(--muted2)", marginTop:4 }}>
                    {[c.Publisher, c.Year, c.Era].filter(Boolean).join(" · ")}
                    {c.Platform ? ` · ${c.Platform}` : ""}
                  </div>
                  {/* Badges */}
                  <div style={{ display:"flex", gap:5, marginTop:7, flexWrap:"wrap" }}>
                    {isKey    && <span className="badge bk" style={{fontSize:"0.6rem"}}>KEY</span>}
                    {isSigned && <span className="badge bs" style={{fontSize:"0.6rem"}}>SIGNED</span>}
                  </div>
                  {/* NM value */}
                  {nmVal && (
                    <div style={{ fontSize:"0.8rem", color:"var(--brown)", marginTop:6 }}>
                      NM: <span style={{ color:"var(--red)", fontWeight:700 }}>{nmVal}</span>
                    </div>
                  )}
                  {/* Pitch (collapsed) */}
                  {pitch && !isOpen && (
                    <div style={{ fontSize:"0.82rem", color:"var(--muted2)", lineHeight:1.5, marginTop:5 }}>
                      {pitch.substring(0,120)}{pitch.length>120?"…":""}
                    </div>
                  )}
                  {/* Expanded */}
                  {isOpen && (
                    <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${accentHex}30`,
                      display:"flex", flexWrap:"wrap", gap:"10px 28px" }}>
                      {c.Writer    && c.Writer    !== "nan" && <div className="dr"><span className="dl">Writer</span><span className="dv">{c.Writer}</span></div>}
                      {c.Artist    && c.Artist    !== "nan" && <div className="dr"><span className="dl">Artist</span><span className="dv">{c.Artist}</span></div>}
                      {isSigned && c.Signed_By              && <div className="dr"><span className="dl">Signed By</span><span className="dv">{c.Signed_By}</span></div>}
                      {c.Key_Reason && c.Key_Reason !== "nan" && <div className="dr"><span className="dl">Key</span><span className="dv">{c.Key_Reason}</span></div>}
                      {c.First_App  && c.First_App  !== "nan" && <div className="dr"><span className="dl">1st App</span><span className="dv">{c.First_App}</span></div>}
                      {c.Condition  && c.Condition  !== "nan" && <div className="dr"><span className="dl">Condition</span><span className="dv">{c.Condition}</span></div>}
                      {isTf && c.Terrificon && <div className="dr"><span className="dl">Terrificon</span><span className="dv" style={{color:"#f59e0b"}}>{c.Terrificon}</span></div>}
                      {pitch && <div style={{ flex:"1 1 100%", marginTop:6, fontSize:"0.85rem", color:"var(--muted2)", lineHeight:1.5 }}>{pitch}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Paginator page={cardPage} pageCount={cardPageCount} total={results.length} pageSize={CARD_PAGE_SIZE}
            onChange={p=>{ setCardPage(p); setOpen(new Set()); }} />
        </div>
      )}

      {results.length > 0 && view === "list" && (
        <div className="list-table">
          <SortableTable
            cols={LIST_COLS}
            rows={results}
            defaultSortKey="box"
            expandCell={c => (
              <div>
                <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
                  {c.Writer   && c.Writer !== "nan"   && <div className="dr"><span className="dl">Writer</span><span className="dv">{c.Writer}</span></div>}
                  {c.Artist   && c.Artist !== "nan"   && <div className="dr"><span className="dl">Artist</span><span className="dv">{c.Artist}</span></div>}
                  {c.Key_Reason  && c.Key_Reason !== "nan"  && <div className="dr"><span className="dl">Key</span><span className="dv">{c.Key_Reason}</span></div>}
                  {(c.Signed||"").toUpperCase()==="YES" && c.Signed_By && <div className="dr"><span className="dl">Signed By</span><span className="dv">{c.Signed_By}</span></div>}
                  {c.Condition && c.Condition !== "nan" && <div className="dr"><span className="dl">Condition</span><span className="dv">{c.Condition}</span></div>}
                </div>
                {c.Story_Pitch && c.Story_Pitch !== "nan" && (
                  <div style={{ marginTop:6, color:"var(--muted2)", fontSize:"0.88rem" }}>
                    {c.Story_Pitch.substring(0,200)}
                  </div>
                )}
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
}
