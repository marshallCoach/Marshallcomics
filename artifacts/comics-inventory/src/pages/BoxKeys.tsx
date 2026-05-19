import { useState, useMemo } from "react";
import { DATA3 } from "@/data/data3";
import { SortableTable, ColDef } from "@/components/SortableTable";
import { Paginator } from "@/components/Paginator";

const CARD_PAGE_SIZE = 48;

const keys  = DATA3.comics.filter(c => (c.Key || "").toUpperCase() === "YES");
const BOXES = [...new Set(keys.map(k => k.Box).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
const PUBS  = [...new Set(keys.map(k => k.Publisher).filter(Boolean))].sort();
const ERAS  = [...new Set(keys.map(k => k.Era).filter(Boolean))].sort();

type Key = (typeof keys)[number];

function parseVal(v: string | undefined | null) {
  if (!v || v === "nan") return 0;
  return parseFloat(String(v).replace(/[^0-9.]/g, "") || "0");
}

function platClass(p: string) {
  const u = (p || "").toUpperCase();
  if (u === "WHATNOT") return "bwn";
  if (u === "EBAY")    return "beb";
  if (u.includes("HERITAGE")) return "bhe";
  return "bb";
}

const LIST_COLS: ColDef<Key>[] = [
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
    cell: r => <span className="lt-sub">{r.Issue}</span>,
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
      return <span className="lt-val">{v || "—"}</span>;
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
    key: "cgc", label: "CGC?", defaultWidth: 70,
    sort: (a, b) => (a.CGC_Worth || "").localeCompare(b.CGC_Worth || ""),
    cell: r => {
      const v = (r.CGC_Worth || "").toUpperCase();
      if (v === "YES" || v.includes("YES")) return <span className="badge bc" style={{ fontSize:"0.62rem" }}>CGC ✓</span>;
      return null;
    },
  },
  {
    key: "tf", label: "Terrificon", defaultWidth: 90,
    sort: (a, b) => (a.Terrificon || "").localeCompare(b.Terrificon || ""),
    cell: r => r.Terrificon ? <span className="badge bt" style={{ fontSize:"0.62rem" }}>TF</span> : null,
  },
];

export default function BoxKeys() {
  const [q,         setQ]         = useState("");
  const [box,       setBox]       = useState("");
  const [pub,       setPub]       = useState("");
  const [era,       setEra]       = useState("");
  const [cgcOnly,   setCgcOnly]   = useState(false);
  const [tfOnly,    setTfOnly]    = useState(false);
  const [signedOnly,setSignedOnly]= useState(false);
  const [view,      setView]      = useState<"card"|"list">("list");
  const [cardPage,  setCardPage]  = useState(1);
  const [open,      setOpen]      = useState<Set<number>>(new Set());

  const results = useMemo(() => {
    const ql = q.toLowerCase();
    return keys.filter(k => {
      if (ql && ![k.Title, k.Issue, k.Key_Why, k.Writer, k.Artist, k.Publisher, k.First_App].join(" ").toLowerCase().includes(ql)) return false;
      if (box && k.Box !== box) return false;
      if (pub && !(k.Publisher || "").toLowerCase().includes(pub.toLowerCase())) return false;
      if (era && k.Era !== era) return false;
      if (cgcOnly   && !(k.CGC_Worth || "").toUpperCase().includes("YES")) return false;
      if (tfOnly    && !(k.Terrificon || "").trim()) return false;
      if (signedOnly && (k.Signed || "").toUpperCase() !== "YES") return false;
      return true;
    });
  }, [q, box, pub, era, cgcOnly, tfOnly, signedOnly]);

  const toggle = (i: number) =>
    setOpen(prev => { const n = new Set(prev); n.has(i)?n.delete(i):n.add(i); return n; });

  const cardPageCount = Math.ceil(results.length / CARD_PAGE_SIZE);
  const cardSlice     = results.slice((cardPage-1)*CARD_PAGE_SIZE, cardPage*CARD_PAGE_SIZE);

  return (
    <div>
      {/* Stats */}
      <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)", padding:"10px 24px", display:"flex", gap:24, flexWrap:"wrap" }}>
        {[
          { val: keys.length,  lbl: "Total Keys" },
          { val: keys.filter(k => (k.CGC_Worth||"").toUpperCase().includes("YES")).length, lbl: "CGC Candidates" },
          { val: keys.filter(k => !!(k.Terrificon||"").trim()).length, lbl: "Terrificon" },
          { val: keys.filter(k => (k.Signed||"").toUpperCase()==="YES").length, lbl: "Signed Keys" },
          { val: BOXES.length, lbl: "Across Boxes" },
        ].map(s => (
          <div key={s.lbl} style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.1rem", color:"var(--red)", letterSpacing:"1px" }}>{s.val}</div>
            <div style={{ fontSize:"0.6rem", letterSpacing:"1.5px", fontFamily:"'Bebas Neue',sans-serif", color:"var(--muted)" }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      <div className="filters">
        <input
          placeholder="Search title, key reason, 1st appearance, writer…"
          value={q}
          onChange={e=>setQ(e.target.value)}
        />
        <select value={box} onChange={e=>setBox(e.target.value)}>
          <option value="">All Boxes</option>
          {BOXES.map(b=><option key={b} value={b}>Box {b}</option>)}
        </select>
        <select value={pub} onChange={e=>setPub(e.target.value)}>
          <option value="">All Publishers</option>
          {PUBS.map(p=><option key={p}>{p}</option>)}
        </select>
        <select value={era} onChange={e=>setEra(e.target.value)}>
          <option value="">All Eras</option>
          {ERAS.map(e=><option key={e}>{e}</option>)}
        </select>
        <button className={`filter-pill${cgcOnly?" active":""}`} onClick={()=>setCgcOnly(v=>!v)}>📋 CGC</button>
        <button className={`filter-pill${tfOnly?" active":""}`}  onClick={()=>setTfOnly(v=>!v)}>🎪 Terrificon</button>
        <button className={`filter-pill${signedOnly?" active":""}`} onClick={()=>setSignedOnly(v=>!v)}>✍️ Signed</button>
        <button className="clear-btn" onClick={()=>{setQ("");setBox("");setPub("");setEra("");setCgcOnly(false);setTfOnly(false);setSignedOnly(false);}}>✕ Clear</button>
      </div>

      <div className="results-bar">
        <span>{results.length} of {keys.length} key issues</span>
        <div style={{ display:"flex", gap:6 }}>
          <button className={`view-toggle-btn${view==="list"?" active":""}`} onClick={()=>setView("list")}>≡ List</button>
          <button className={`view-toggle-btn${view==="card"?" active":""}`} onClick={()=>setView("card")}>⊞ Cards</button>
        </div>
      </div>

      {view === "list" && (
        <div className="list-table">
          <SortableTable
            cols={LIST_COLS}
            rows={results}
            defaultSortKey="box"
            expandCell={k => (
              <div>
                <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
                  {k.Writer    && k.Writer !== "nan"    && <div className="dr"><span className="dl">Writer</span><span className="dv">{k.Writer}</span></div>}
                  {k.Artist    && k.Artist !== "nan"    && <div className="dr"><span className="dl">Artist</span><span className="dv">{k.Artist}</span></div>}
                  {k.First_App && k.First_App !== "nan" && <div className="dr"><span className="dl">1st App</span><span className="dv">{k.First_App}</span></div>}
                  {(k.Signed||"").toUpperCase()==="YES" && k.Signed_By && <div className="dr"><span className="dl">Signed By</span><span className="dv">{k.Signed_By}</span></div>}
                  {k.Terrificon && <div className="dr"><span className="dl">Terrificon</span><span className="dv" style={{color:"#f59e0b"}}>{k.Terrificon}</span></div>}
                  {k.Value_VF  && k.Value_VF !== "nan"  && <div className="dr"><span className="dl">VF Value</span><span className="dv">{k.Value_VF}</span></div>}
                  {k.Sales_Data && k.Sales_Data !== "nan" && <div className="dr"><span className="dl">Sales</span><span className="dv">{k.Sales_Data.substring(0,120)}</span></div>}
                </div>
                {k.Key_Why && <div style={{ marginTop:6, fontSize:"0.85rem", color:"var(--gold)" }}>{k.Key_Why}</div>}
              </div>
            )}
          />
        </div>
      )}

      {view === "card" && (
        <div>
          <div className="card-grid">
            {cardSlice.map((k, i) => {
              const isSigned = (k.Signed||"").toUpperCase() === "YES";
              const isTf     = !!(k.Terrificon||"").trim();
              const nmVal    = k.Value_NM && k.Value_NM !== "nan" ? k.Value_NM : "";
              const cgc      = (k.CGC_Worth||"").toUpperCase().includes("YES");
              const isOpen   = open.has(i);
              return (
                <div key={i} className={`comic-card${isOpen?" open":""}`}
                  style={{ borderTop:"3px solid var(--gold)" }}
                  onClick={()=>toggle(i)}>
                  <div className="card-title">{k.Title || "Untitled"}</div>
                  <div className="card-sub">Box {k.Box} · {k.Publisher} #{k.Issue} · {k.Year}</div>
                  <div className="badges">
                    <span className="badge bk">KEY</span>
                    {isSigned && <span className="badge bs">SIGNED</span>}
                    {k.Era    && <span className="badge be">{k.Era}</span>}
                    {cgc      && <span className="badge bc">CGC ✓</span>}
                    {isTf     && <span className="badge bt">Terrificon</span>}
                    {k.Platform && <span className={`badge ${platClass(k.Platform)}`}>{k.Platform}</span>}
                  </div>
                  {nmVal && <div className="card-value">NM: <span className="v">{nmVal}</span></div>}
                  {k.Key_Why && <div style={{ fontSize:"0.82rem", color:"var(--gold)", marginTop:4, lineHeight:1.4 }}>{k.Key_Why.substring(0,120)}</div>}
                  {isOpen && (
                    <div className="card-expand">
                      {k.Writer    && <div className="dr"><span className="dl">W</span><span className="dv">{k.Writer}</span></div>}
                      {k.Artist    && <div className="dr"><span className="dl">A</span><span className="dv">{k.Artist}</span></div>}
                      {k.First_App && <div className="dr"><span className="dl">1st App</span><span className="dv">{k.First_App}</span></div>}
                      {isSigned && k.Signed_By && <div className="dr"><span className="dl">Signed By</span><span className="dv">{k.Signed_By}</span></div>}
                      {isTf && <div className="dr"><span className="dl">Terrificon</span><span className="dv" style={{color:"#f59e0b"}}>{k.Terrificon}</span></div>}
                      {k.Sales_Data && <div className="dr"><span className="dl">Sales</span><span className="dv">{k.Sales_Data.substring(0,120)}</span></div>}
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
    </div>
  );
}
