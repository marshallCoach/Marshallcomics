import { useState, useMemo } from "react";
import { DATA2 } from "@/data/data2";
import { SortableTable, ColDef } from "@/components/SortableTable";
import { Paginator } from "@/components/Paginator";

const CARD_PAGE_SIZE = 48;

const comics = DATA2.boxes_inventory;
const BOXES      = [...new Set(comics.map(c => String(c.Box)))].sort((a, b) => Number(a) - Number(b));
const PUBLISHERS = [...new Set(comics.map(c => c.Publisher).filter(Boolean))].sort();
const PLATFORMS  = [...new Set(comics.map(c => c.Platform).filter(Boolean))].sort();

type Comic = (typeof comics)[number];

const BOX_LABELS: Record<string, string> = {
  "1": "Box 1 — DC New 52", "2": "Box 2 — Marvel Ultimate",
  "3": "Box 3 — Modern DC", "4": "Box 4 — Dawn of DC",
  "5": "Box 5 — Wildstorm/Indie", "6": "Box 6 — DC 2021–23",
  "7": "Box 7 — Avengers", "8": "Box 8", "9": "Box 9",
};

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
    key: "box", label: "Box", defaultWidth: 65,
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
    cell: r => {
      const v = r.Value_NM && r.Value_NM !== "nan" ? r.Value_NM : null;
      return <span className="lt-val">{v ? `$${v}` : "—"}</span>;
    },
  },
  {
    key: "bid", label: "Start Bid", defaultWidth: 85,
    sort: (a, b) => parseVal(a.Start_Bid) - parseVal(b.Start_Bid),
    cell: r => {
      const v = r.Start_Bid && r.Start_Bid !== "nan" ? r.Start_Bid : null;
      return <span className="lt-sub">{v ? `$${v}` : "—"}</span>;
    },
  },
  {
    key: "platform", label: "Platform", defaultWidth: 100,
    sort: (a, b) => (a.Platform || "").localeCompare(b.Platform || ""),
    cell: r => r.Platform ? <span className={`badge ${platClass(r.Platform)}`} style={{ fontSize: "0.62rem" }}>{r.Platform}</span> : null,
  },
  {
    key: "key", label: "Key", defaultWidth: 70,
    sort: (a, b) => ((b.Key || "") > (a.Key || "") ? 1 : -1),
    cell: r => (
      <div style={{ display: "flex", gap: 3 }}>
        {(r.Key || "").toUpperCase() === "YES" && <span className="badge bk" style={{ fontSize: "0.62rem" }}>KEY</span>}
        {!!(r.Terrificon || "").trim()         && <span className="badge bt" style={{ fontSize: "0.62rem" }}>TF</span>}
      </div>
    ),
  },
];

export default function AllBoxes() {
  const [q, setQ]               = useState("");
  const [box, setBox]           = useState("");
  const [pub, setPub]           = useState("");
  const [keyOnly, setKeyOnly]   = useState("");
  const [platform, setPlatform] = useState("");
  const [view, setView]         = useState<"card" | "list">("card");
  const [hasSearched, setHasSearched] = useState(false);
  const [open, setOpen]         = useState<Set<number>>(new Set());
  const [cardPage, setCardPage] = useState(1);

  const results = useMemo(() => {
    if (!hasSearched) return [];
    const ql = q.toLowerCase();
    return comics.filter(c => {
      if (ql && ![c.Title, c.Issue, c.Writer, c.Artist, c.Arc, c.Publisher, c.Key_Why, c.First_App, c.Whatnot_Pitch].join(" ").toLowerCase().includes(ql)) return false;
      if (box && String(c.Box) !== box) return false;
      if (pub && !(c.Publisher || "").toLowerCase().includes(pub.toLowerCase())) return false;
      if (keyOnly && (c.Key || "").toUpperCase() !== keyOnly) return false;
      if (platform && (c.Platform || "").toUpperCase() !== platform.toUpperCase()) return false;
      return true;
    });
  }, [q, box, pub, keyOnly, platform, hasSearched]);

  const runSearch = () => { setHasSearched(true); setOpen(new Set()); setCardPage(1); };
  const clearResults = () => {
    setHasSearched(false); setOpen(new Set());
    setQ(""); setBox(""); setPub(""); setKeyOnly(""); setPlatform("");
  };

  const toggle = (i: number) => {
    setOpen(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };

  const cardPageCount = Math.ceil(results.length / CARD_PAGE_SIZE);
  const cardSlice     = results.slice((cardPage - 1) * CARD_PAGE_SIZE, cardPage * CARD_PAGE_SIZE);

  return (
    <div>
      <div className="filters">
        <input placeholder="Search title, writer, arc, publisher..." value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && runSearch()} />
        <select value={box} onChange={e => setBox(e.target.value)}>
          <option value="">All Boxes</option>
          {BOXES.map(b => <option key={b} value={b}>{BOX_LABELS[b] || `Box ${b}`}</option>)}
        </select>
        <select value={pub} onChange={e => setPub(e.target.value)}>
          <option value="">All Publishers</option>
          {PUBLISHERS.map(p => <option key={p}>{p}</option>)}
        </select>
        <select value={keyOnly} onChange={e => setKeyOnly(e.target.value)}>
          <option value="">All / Keys</option>
          <option value="YES">Keys Only</option>
        </select>
        <select value={platform} onChange={e => setPlatform(e.target.value)}>
          <option value="">All Platforms</option>
          {PLATFORMS.map(p => <option key={p}>{p}</option>)}
        </select>
        <button className="clear-btn" onClick={runSearch}>Search</button>
        {hasSearched && <button className="clear-results-btn" onClick={clearResults}>✕ Clear Results</button>}
      </div>

      {hasSearched && (
        <div className="results-bar">
          <span>{results.length} of {comics.length} books</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="results-hint">Click column headers to sort · Drag edges to resize</span>
            <div className="view-toggle">
              <button className={`view-toggle-btn${view === "list" ? " active" : ""}`} onClick={() => setView("list")}>≡ List</button>
              <button className={`view-toggle-btn${view === "card" ? " active" : ""}`} onClick={() => setView("card")}>⊞ Cards</button>
            </div>
          </div>
        </div>
      )}

      {!hasSearched && (
        <div className="blank-state">
          <div className="blank-state-icon">🗃️</div>
          <div className="blank-state-title">All Boxes — 1,467 Books</div>
          <div className="blank-state-sub">Filter by box, publisher, or keyword and press Search.</div>
        </div>
      )}

      {hasSearched && results.length === 0 && <div className="no-res">No books match your filters</div>}

      {hasSearched && results.length > 0 && view === "card" && (
        <div>
        <div className="card-grid">
          {cardSlice.map((c, i) => {
            const isKey  = (c.Key || "").toUpperCase() === "YES";
            const isTf   = !!(c.Terrificon || "").trim();
            const bid    = c.Start_Bid && c.Start_Bid !== "nan" ? c.Start_Bid : "";
            const isOpen = open.has(i);
            const nmVal  = c.Value_NM && c.Value_NM !== "nan" ? c.Value_NM : "";
            const pitch  = c.Whatnot_Pitch && c.Whatnot_Pitch !== "nan" ? c.Whatnot_Pitch : "";
            return (
              <div key={i} className={`comic-card${isOpen ? " open" : ""}`} onClick={() => toggle(i)}>
                <div className="card-title">{c.Title || "Untitled"}</div>
                <div className="card-sub">Box {c.Box} · {c.Publisher} #{c.Issue} · {c.Year}</div>
                <div className="badges">
                  {isKey && <span className="badge bk">KEY</span>}
                  {c.Era && <span className="badge be">{c.Era}</span>}
                  {c.Platform && <span className={`badge ${platClass(c.Platform)}`}>{c.Platform}</span>}
                  {bid  && <span className="badge bcg">Start ${bid}</span>}
                  {isTf && <span className="badge bt">Terrificon</span>}
                </div>
                {nmVal && <div className="card-value">NM: <span className="v">${nmVal}</span></div>}
                {pitch && <div className="card-pitch">{pitch.substring(0, 160)}{pitch.length > 160 ? "…" : ""}</div>}
                {isOpen && (
                  <div className="card-expand">
                    {c.Writer   && c.Writer !== "nan"   && <div className="dr"><span className="dl">Writer</span><span className="dv">{c.Writer}</span></div>}
                    {c.Artist   && c.Artist !== "nan"   && <div className="dr"><span className="dl">Artist</span><span className="dv">{c.Artist}</span></div>}
                    {c.Arc      && c.Arc !== "nan"      && <div className="dr"><span className="dl">Arc</span><span className="dv">{c.Arc}</span></div>}
                    {c.Key_Why  && c.Key_Why !== "nan"  && <div className="dr"><span className="dl">Key Why</span><span className="dv">{c.Key_Why}</span></div>}
                    {c.First_App && c.First_App !== "nan" && <div className="dr"><span className="dl">1st App</span><span className="dv">{c.First_App}</span></div>}
                    {c.Condition && c.Condition !== "nan" && <div className="dr"><span className="dl">Condition</span><span className="dv">{c.Condition}</span></div>}
                    {c.Sales_Data && c.Sales_Data !== "nan" && <div className="dr"><span className="dl">Sales</span><span className="dv">{(c.Sales_Data || "").substring(0, 100)}</span></div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <Paginator page={cardPage} pageCount={cardPageCount} total={results.length} pageSize={CARD_PAGE_SIZE} onChange={p => { setCardPage(p); setOpen(new Set()); }} />
        </div>
      )}

      {hasSearched && results.length > 0 && view === "list" && (
        <div className="list-table">
          <SortableTable
            cols={LIST_COLS}
            rows={results}
            expandCell={c => (
              <div>
                <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                  {c.Writer   && c.Writer !== "nan"   && <div className="dr"><span className="dl">Writer</span><span className="dv">{c.Writer}</span></div>}
                  {c.Artist   && c.Artist !== "nan"   && <div className="dr"><span className="dl">Artist</span><span className="dv">{c.Artist}</span></div>}
                  {c.Key_Why  && c.Key_Why !== "nan"  && <div className="dr"><span className="dl">Key</span><span className="dv">{c.Key_Why}</span></div>}
                  {c.Condition && c.Condition !== "nan" && <div className="dr"><span className="dl">Condition</span><span className="dv">{c.Condition}</span></div>}
                </div>
                {c.Whatnot_Pitch && c.Whatnot_Pitch !== "nan" && <div style={{ marginTop: 6, fontStyle: "italic", color: "var(--muted2)", fontSize: "0.8rem" }}>{c.Whatnot_Pitch.substring(0, 200)}</div>}
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
}
