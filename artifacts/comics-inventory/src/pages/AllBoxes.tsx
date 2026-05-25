import { useState, useMemo } from "react";
import { DATA3 } from "@/data/data3";
import { SortableTable, ColDef } from "@/components/SortableTable";
import { Paginator } from "@/components/Paginator";

const CARD_PAGE_SIZE = 48;

const comics   = DATA3.comics;
const boxSummary = DATA3.boxes;

const BOX_LABELS: Record<string, string> = Object.fromEntries(
  boxSummary.map(b => [b.Num, b.Label])
);

const BOXES      = [...new Set(comics.map(c => c.Box).filter(Boolean))].sort((a,b) => Number(a)-Number(b));
const PUBLISHERS = [...new Set(comics.map(c => c.Publisher).filter(Boolean))].sort();
const PLATFORMS  = [...new Set(comics.map(c => c.Platform).filter(Boolean))].sort();
const ERAS       = [...new Set(comics.map(c => c.Era).filter(Boolean))].sort();

type Comic = (typeof comics)[number];

function platClass(p: string) {
  const u = (p || "").toUpperCase();
  if (u === "WHATNOT") return "bwn";
  if (u === "EBAY")    return "beb";
  return "bb";
}

function parseVal(v: string | undefined | null) {
  if (!v || v === "nan") return 0;
  return parseFloat(String(v).replace(/[^0-9.]/g, "") || "0");
}

const LIST_COLS: ColDef<Comic>[] = [
  {
    key: "box", label: "Box", defaultWidth: 55,
    sort: (a, b) => Number(a.Box) - Number(b.Box),
    cell: r => <span className="lt-sub">{r.Box}</span>,
  },
  {
    key: "title", label: "Title", defaultWidth: 200,
    sort: (a, b) => (a.Title || "").localeCompare(b.Title || ""),
    cell: r => <span className="lt-title">{r.Title || "Untitled"}</span>,
  },
  {
    key: "issue", label: "#", defaultWidth: 55,
    sort: (a, b) => parseVal(a.Issue) - parseVal(b.Issue),
    cell: r => <span className="lt-sub">#{r.Issue}</span>,
  },
  {
    key: "publisher", label: "Publisher", defaultWidth: 100,
    sort: (a, b) => (a.Publisher || "").localeCompare(b.Publisher || ""),
    cell: r => <span className="lt-sub">{r.Publisher}</span>,
  },
  {
    key: "year", label: "Year", defaultWidth: 65,
    sort: (a, b) => parseVal(a.Year) - parseVal(b.Year),
    cell: r => <span className="lt-sub">{r.Year}</span>,
  },
  {
    key: "era", label: "Era", defaultWidth: 80,
    sort: (a, b) => (a.Era || "").localeCompare(b.Era || ""),
    cell: r => r.Era ? <span className="badge be" style={{ fontSize:"0.62rem" }}>{r.Era}</span> : null,
  },
  {
    key: "writer", label: "Writer", defaultWidth: 130,
    sort: (a, b) => (a.Writer || "").localeCompare(b.Writer || ""),
    cell: r => <span className="lt-sub">{r.Writer}</span>,
  },
  {
    key: "nm", label: "NM Value", defaultWidth: 90,
    sort: (a, b) => parseVal(a.Value_NM) - parseVal(b.Value_NM),
    cell: r => {
      const v = r.Value_NM && r.Value_NM !== "nan" ? r.Value_NM : null;
      return <span className="lt-val">{v ? `$${v}` : "—"}</span>;
    },
  },
  {
    key: "vf", label: "VF Value", defaultWidth: 90,
    sort: (a, b) => parseVal(a.Value_VF) - parseVal(b.Value_VF),
    cell: r => {
      const v = r.Value_VF && r.Value_VF !== "nan" ? r.Value_VF.match(/(\d+(?:\.\d+)?)/)?.[1] : "";
      return <span className="lt-vf">{v ? `$${v}` : "—"}</span>;
    },
  },
  {
    key: "bid", label: "Start Bid", defaultWidth: 80,
    sort: (a, b) => parseVal(a.Start_Bid) - parseVal(b.Start_Bid),
    cell: r => {
      const v = r.Start_Bid && r.Start_Bid !== "nan" ? r.Start_Bid : null;
      return <span className="lt-sub">{v ? `$${v}` : "—"}</span>;
    },
  },
  {
    key: "platform", label: "Platform", defaultWidth: 90,
    sort: (a, b) => (a.Platform || "").localeCompare(b.Platform || ""),
    cell: r => r.Platform ? <span className={`badge ${platClass(r.Platform)}`} style={{ fontSize:"0.62rem" }}>{r.Platform}</span> : null,
  },
  {
    key: "key", label: "Key", defaultWidth: 70,
    sort: (a, b) => ((b.Key || "") > (a.Key || "") ? 1 : -1),
    cell: r => (
      <div style={{ display:"flex", gap:3 }}>
        {(r.Key || "").toUpperCase() === "YES" && <span className="badge bk" style={{ fontSize:"0.62rem" }}>KEY</span>}
        {!!(r.Terrificon || "").trim()         && <span className="badge bt" style={{ fontSize:"0.62rem" }}>TF</span>}
        {(r.Signed || "").toUpperCase() === "YES" && <span className="badge be" style={{ fontSize:"0.62rem" }}>SIGNED</span>}
      </div>
    ),
  },
];

export default function AllBoxes() {
  const [q,          setQ]          = useState("");
  const [box,        setBox]        = useState("");
  const [pub,        setPub]        = useState("");
  const [era,        setEra]        = useState("");
  const [keyOnly,    setKeyOnly]    = useState(false);
  const [signedOnly, setSignedOnly] = useState(false);
  const [platform,   setPlatform]   = useState("");
  const [view,       setView]       = useState<"card"|"list">("card");
  const [hasSearched, setHasSearched] = useState(false);
  const [open,        setOpen]        = useState<Set<number>>(new Set());
  const [cardPage,    setCardPage]    = useState(1);

  const results = useMemo(() => {
    if (!hasSearched) return [];
    const ql = q.toLowerCase();
    return comics.filter(c => {
      if (ql && ![c.Title, c.Issue, c.Writer, c.Artist, c.Arc, c.Publisher, c.Key_Reason, c.First_App, c.Story_Pitch, c.Signed_By].join(" ").toLowerCase().includes(ql)) return false;
      if (box        && c.Box !== box) return false;
      if (pub        && !(c.Publisher || "").toLowerCase().includes(pub.toLowerCase())) return false;
      if (era        && (c.Era || "") !== era) return false;
      if (platform   && (c.Platform || "").toUpperCase() !== platform.toUpperCase()) return false;
      if (keyOnly    && (c.Key || "").toUpperCase() !== "YES") return false;
      if (signedOnly && (c.Signed || "").toUpperCase() !== "YES") return false;
      return true;
    });
  }, [q, box, pub, era, platform, keyOnly, signedOnly, hasSearched]);

  const runSearch  = () => { setHasSearched(true); setOpen(new Set()); setCardPage(1); };
  const clearAll   = () => {
    setHasSearched(false); setOpen(new Set());
    setQ(""); setBox(""); setPub(""); setEra(""); setPlatform(""); setKeyOnly(false); setSignedOnly(false);
  };

  const toggle = (i: number) =>
    setOpen(prev => { const n = new Set(prev); n.has(i)?n.delete(i):n.add(i); return n; });

  const cardPageCount = Math.ceil(results.length / CARD_PAGE_SIZE);
  const cardSlice     = results.slice((cardPage-1)*CARD_PAGE_SIZE, cardPage*CARD_PAGE_SIZE);

  return (
    <div>
      <div className="filters">
        <input
          placeholder="Search title, writer, artist, key reason, arc…"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === "Enter" && runSearch()}
        />
        <select value={box} onChange={e => setBox(e.target.value)}>
          <option value="">All Boxes</option>
          {BOXES.map(b => <option key={b} value={b}>{BOX_LABELS[b] || `Box ${b}`}</option>)}
        </select>
        <select value={pub} onChange={e => setPub(e.target.value)}>
          <option value="">All Publishers</option>
          {PUBLISHERS.map(p => <option key={p}>{p}</option>)}
        </select>
        <select value={era} onChange={e => setEra(e.target.value)}>
          <option value="">All Eras</option>
          {ERAS.map(e => <option key={e}>{e}</option>)}
        </select>
        <select value={platform} onChange={e => setPlatform(e.target.value)}>
          <option value="">All Platforms</option>
          {PLATFORMS.map(p => <option key={p}>{p}</option>)}
        </select>
        <button
          className={`filter-pill${keyOnly ? " active" : ""}`}
          onClick={() => setKeyOnly(v => !v)}>
          🔑 Keys
        </button>
        <button
          className={`filter-pill${signedOnly ? " active" : ""}`}
          onClick={() => setSignedOnly(v => !v)}>
          ✍️ Signed
        </button>
        <button className="clear-btn" onClick={runSearch}>Search</button>
        {hasSearched && <button className="clear-results-btn" onClick={clearAll}>✕ Clear</button>}
      </div>

      {hasSearched && (
        <div className="results-bar">
          <span>{results.length} of {comics.length} books</span>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span className="results-hint">Click headers to sort · Drag edges to resize</span>
            <div className="view-toggle">
              <button className={`view-toggle-btn${view==="list"?" active":""}`} onClick={()=>setView("list")}>≡ List</button>
              <button className={`view-toggle-btn${view==="card"?" active":""}`} onClick={()=>setView("card")}>⊞ Cards</button>
            </div>
          </div>
        </div>
      )}

      {!hasSearched && (
        <div className="blank-state">
          <div className="blank-state-icon">🗃️</div>
          <div className="blank-state-title">All Boxes — 1,793 Comics · 16 Boxes</div>
          <div className="blank-state-sub">Filter by box, publisher, era, or keyword and press Search.</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center", marginTop:16 }}>
            {DATA3.boxes.map(b => (
              <button key={b.Num} className="chip" onClick={()=>{ setBox(b.Num); setHasSearched(true); setCardPage(1); }}>
                Box {b.Num} <span style={{opacity:0.6, fontSize:"0.75em"}}>({b.Comics})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {hasSearched && results.length === 0 && <div className="no-res">No books match your filters</div>}

      {hasSearched && results.length > 0 && view === "card" && (
        <div>
          <div className="card-grid">
            {cardSlice.map((c, i) => {
              const isKey  = (c.Key || "").toUpperCase() === "YES";
              const isTf   = !!(c.Terrificon || "").trim();
              const isSigned = (c.Signed || "").toUpperCase() === "YES";
              const bid    = c.Start_Bid && c.Start_Bid !== "nan" ? c.Start_Bid : "";
              const isOpen = open.has(i);
              const nmVal  = c.Value_NM && c.Value_NM !== "nan" ? c.Value_NM : "";
              const vfLow  = c.Value_VF && c.Value_VF !== "nan" ? (c.Value_VF.match(/(\d+(?:\.\d+)?)/) || [])[1] || "" : "";
              const pitch  = c.Story_Pitch && c.Story_Pitch !== "nan" ? c.Story_Pitch : "";
              return (
                <div key={i} className={`comic-card${isOpen?" open":""}`} onClick={()=>toggle(i)}>
                  <div className="card-title">{c.Title || "Untitled"}</div>
                  <div className="card-sub">Box {c.Box} · {c.Publisher} #{c.Issue} · {c.Year}</div>
                  <div className="badges">
                    {isKey    && <span className="badge bk">KEY</span>}
                    {isSigned && <span className="badge bs">SIGNED</span>}
                    {c.Era    && <span className="badge be">{c.Era}</span>}
                    {c.Platform && <span className={`badge ${platClass(c.Platform)}`}>{c.Platform}</span>}
                    {bid      && <span className="badge bcg">Start ${bid}</span>}
                    {isTf     && <span className="badge bt">Terrificon</span>}
                  </div>
                  {(nmVal || vfLow) && <div className="card-value">
                    {nmVal && <span>NM: <span className="v">${nmVal}</span></span>}
                    {nmVal && vfLow && <span style={{color:"var(--border)"}}> · </span>}
                    {vfLow && <span style={{color:"var(--muted2)"}}>VF: <strong>${vfLow}</strong></span>}
                  </div>}
                  {pitch && <div className="card-pitch">{pitch.substring(0,160)}{pitch.length>160?"…":""}</div>}
                  {isOpen && (
                    <div className="card-expand">
                      {c.Writer      && c.Writer !== "nan"     && <div className="dr"><span className="dl">W</span><span className="dv">{c.Writer}</span></div>}
                      {c.Artist      && c.Artist !== "nan"     && <div className="dr"><span className="dl">A</span><span className="dv">{c.Artist}</span></div>}
                      {c.Cover_Artist && c.Cover_Artist !== "nan" && <div className="dr"><span className="dl">CA</span><span className="dv">{c.Cover_Artist}</span></div>}
                      {isSigned && c.Signed_By && <div className="dr"><span className="dl">Signed By</span><span className="dv">{c.Signed_By}</span></div>}
                      {c.Arc         && c.Arc !== "nan"        && <div className="dr"><span className="dl">Arc</span><span className="dv">{c.Arc}</span></div>}
                      {c.Key_Reason     && c.Key_Reason !== "nan"    && <div className="dr"><span className="dl">Key Why</span><span className="dv">{c.Key_Reason}</span></div>}
                      {c.First_App   && c.First_App !== "nan"  && <div className="dr"><span className="dl">1st App</span><span className="dv">{c.First_App}</span></div>}
                      {c.Condition   && c.Condition !== "nan"  && <div className="dr"><span className="dl">Condition</span><span className="dv">{c.Condition}</span></div>}
                      {c.Terrificon  && <div className="dr"><span className="dl">Terrificon</span><span className="dv" style={{color:"#f59e0b"}}>{c.Terrificon}</span></div>}
                      {c.Sales_Data  && c.Sales_Data !== "nan" && <div className="dr"><span className="dl">Sales</span><span className="dv">{c.Sales_Data.substring(0,120)}</span></div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Paginator page={cardPage} pageCount={cardPageCount} total={results.length} pageSize={CARD_PAGE_SIZE} onChange={p=>{ setCardPage(p); setOpen(new Set()); }} />
        </div>
      )}

      {hasSearched && results.length > 0 && view === "list" && (
        <div className="list-table">
          <SortableTable
            cols={LIST_COLS}
            rows={results}
            defaultSortKey="box"
            expandCell={c => (
              <div>
                <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
                  {c.Writer   && c.Writer !== "nan"  && <div className="dr"><span className="dl">Writer</span><span className="dv">{c.Writer}</span></div>}
                  {c.Artist   && c.Artist !== "nan"  && <div className="dr"><span className="dl">Artist</span><span className="dv">{c.Artist}</span></div>}
                  {c.Key_Reason  && c.Key_Reason !== "nan" && <div className="dr"><span className="dl">Key</span><span className="dv">{c.Key_Reason}</span></div>}
                  {(c.Signed||"").toUpperCase()==="YES" && c.Signed_By && <div className="dr"><span className="dl">Signed By</span><span className="dv">{c.Signed_By}</span></div>}
                  {c.Condition && c.Condition !== "nan" && <div className="dr"><span className="dl">Condition</span><span className="dv">{c.Condition}</span></div>}
                  {c.Terrificon && <div className="dr"><span className="dl">Terrificon</span><span className="dv" style={{color:"#f59e0b"}}>{c.Terrificon}</span></div>}
                </div>
                {c.Story_Pitch && c.Story_Pitch !== "nan" && (
                  <div style={{ marginTop:6, fontStyle:"italic", color:"var(--muted2)", fontSize:"0.8rem" }}>
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
