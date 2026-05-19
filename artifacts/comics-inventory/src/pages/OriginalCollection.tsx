import { useState, useMemo } from "react";
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
    cell: r => <span className="lt-title">{r.Title || "Untitled"}</span>,
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
    cell: r => <span className="lt-val">{r.Value_NM || "—"}</span>,
  },
  {
    key: "vf", label: "VF Value", defaultWidth: 80,
    sort: (a, b) => parseVal(a.Value_VF) - parseVal(b.Value_VF),
    cell: r => <span className="lt-vf">{r.Value_VF || "—"}</span>,
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

export default function OriginalCollection({ initSigned }: { initSigned?: string }) {
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

  const results = useMemo(() => {
    const ql = q.toLowerCase();
    return comics.filter(c => {
      if (ql && ![c.Title, c.Writer, c.Artist, c.Key_Why, c.First_App, c.Signed_By, c.Arc, c.Publisher, c.Whatnot_Category].join(" ").toLowerCase().includes(ql)) return false;
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
  };

  const toggle = (i: number) =>
    setOpen(prev => { const n = new Set(prev); n.has(i)?n.delete(i):n.add(i); return n; });

  const cardPageCount = Math.ceil(results.length / CARD_PAGE_SIZE);
  const cardSlice     = results.slice((cardPage-1)*CARD_PAGE_SIZE, cardPage*CARD_PAGE_SIZE);

  return (
    <div>
      <div className="filters">
        <input
          placeholder="Search title, writer, character, signer…"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === "Enter" && setCardPage(1)}
        />
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
        <select value={signed} onChange={e => setSigned(e.target.value)}>
          <option value="">All / Signed</option>
          <option value="YES">Signed Only</option>
        </select>
        <select value={keyOnly} onChange={e => setKeyOnly(e.target.value)}>
          <option value="">All / Keys</option>
          <option value="YES">Keys Only</option>
        </select>
        <select value={cgcOnly} onChange={e => setCgcOnly(e.target.value)}>
          <option value="">All / CGC</option>
          <option value="YES">CGC Candidates</option>
        </select>
        <button className="clear-results-btn" onClick={clearFilters}>✕ Clear</button>
      </div>

      <div className="results-bar">
        <span>{results.length} of {comics.length} key &amp; signed books</span>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span className="results-hint">Click column headers to sort · Drag edges to resize</span>
          <div className="view-toggle">
            <button className={`view-toggle-btn${view==="list"?" active":""}`} onClick={()=>setView("list")}>≡ List</button>
            <button className={`view-toggle-btn${view==="card"?" active":""}`} onClick={()=>setView("card")}>⊞ Cards</button>
          </div>
        </div>
      </div>

      {results.length === 0 && <div className="no-res">No books match your filters</div>}

      {results.length > 0 && view === "card" && (
        <div>
          <div className="card-grid">
            {cardSlice.map((c, i) => {
              const isKey    = (c.Key || "").toUpperCase() === "YES";
              const isSigned = (c.Signed || "").toUpperCase() === "YES";
              const isTf     = !!(c.Terrificon || "").trim();
              const nmVal    = c.Value_NM && c.Value_NM !== "nan" ? c.Value_NM : "";
              const pitch    = c.Whatnot_Pitch && c.Whatnot_Pitch !== "nan" ? c.Whatnot_Pitch : "";
              const isOpen   = open.has(i);
              return (
                <div key={i} className={`comic-card${isOpen?" open":""}`} onClick={()=>toggle(i)}>
                  <div className="card-title">{c.Title || "Untitled"}</div>
                  <div className="card-sub">Box {c.Box} · {c.Publisher} #{c.Issue} · {c.Year}</div>
                  <div className="badges">
                    {isKey    && <span className="badge bk">KEY</span>}
                    {isSigned && <span className="badge bs">SIGNED</span>}
                    {c.Era    && <span className="badge be">{c.Era}</span>}
                    {c.Platform && <span className={`badge ${platClass(c.Platform)}`}>{c.Platform}</span>}
                    {isTf     && <span className="badge bt">Terrificon</span>}
                  </div>
                  {nmVal && <div className="card-value">NM: <span className="v">{nmVal}</span></div>}
                  {pitch && <div className="card-pitch">{pitch.substring(0,160)}{pitch.length>160?"…":""}</div>}
                  {isOpen && (
                    <div className="card-expand">
                      {c.Writer   && c.Writer !== "nan"   && <div className="dr"><span className="dl">W</span><span className="dv">{c.Writer}</span></div>}
                      {c.Artist   && c.Artist !== "nan"   && <div className="dr"><span className="dl">A</span><span className="dv">{c.Artist}</span></div>}
                      {isSigned && c.Signed_By            && <div className="dr"><span className="dl">Signed By</span><span className="dv">{c.Signed_By}</span></div>}
                      {c.Key_Why  && c.Key_Why !== "nan"  && <div className="dr"><span className="dl">Key Why</span><span className="dv">{c.Key_Why}</span></div>}
                      {c.First_App && c.First_App !== "nan" && <div className="dr"><span className="dl">1st App</span><span className="dv">{c.First_App}</span></div>}
                      {c.Condition && c.Condition !== "nan" && <div className="dr"><span className="dl">Condition</span><span className="dv">{c.Condition}</span></div>}
                      {isTf && <div className="dr"><span className="dl">Terrificon</span><span className="dv" style={{color:"#f59e0b"}}>{c.Terrificon}</span></div>}
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
                  {c.Key_Why  && c.Key_Why !== "nan"  && <div className="dr"><span className="dl">Key</span><span className="dv">{c.Key_Why}</span></div>}
                  {(c.Signed||"").toUpperCase()==="YES" && c.Signed_By && <div className="dr"><span className="dl">Signed By</span><span className="dv">{c.Signed_By}</span></div>}
                  {c.Condition && c.Condition !== "nan" && <div className="dr"><span className="dl">Condition</span><span className="dv">{c.Condition}</span></div>}
                </div>
                {c.Whatnot_Pitch && c.Whatnot_Pitch !== "nan" && (
                  <div style={{ marginTop:6, color:"var(--muted2)", fontSize:"0.88rem" }}>
                    {c.Whatnot_Pitch.substring(0,200)}
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
