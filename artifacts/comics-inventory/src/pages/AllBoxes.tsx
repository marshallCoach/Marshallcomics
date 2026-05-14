import { useState, useMemo } from "react";
import { DATA2 } from "@/data/data2";

const comics = DATA2.boxes_inventory;
const BOXES      = [...new Set(comics.map(c => String(c.Box)))].sort((a, b) => Number(a) - Number(b));
const PUBLISHERS = [...new Set(comics.map(c => c.Publisher).filter(Boolean))].sort();
const PLATFORMS  = [...new Set(comics.map(c => c.Platform).filter(Boolean))].sort();

const BOX_LABELS: Record<string, string> = {
  "1": "Box 1 — DC New 52",
  "2": "Box 2 — Marvel Ultimate",
  "3": "Box 3 — Modern DC",
  "4": "Box 4 — Dawn of DC",
  "5": "Box 5 — Wildstorm/Indie",
  "6": "Box 6 — DC 2021–23",
  "7": "Box 7 — Avengers",
  "8": "Box 8",
  "9": "Box 9",
};

function platClass(p: string) {
  const u = (p || "").toUpperCase();
  if (u === "WHATNOT") return "bwn";
  if (u === "EBAY") return "beb";
  return "bb";
}

export default function AllBoxes() {
  const [q, setQ]             = useState("");
  const [box, setBox]         = useState("");
  const [pub, setPub]         = useState("");
  const [keyOnly, setKeyOnly] = useState("");
  const [platform, setPlatform] = useState("");
  const [open, setOpen]       = useState<Set<number>>(new Set());

  const results = useMemo(() => {
    const ql = q.toLowerCase();
    return comics.filter(c => {
      if (ql && ![c.Title, c.Issue, c.Writer, c.Artist, c.Arc, c.Publisher, c.Key_Why, c.First_App, c.Whatnot_Pitch].join(" ").toLowerCase().includes(ql)) return false;
      if (box && String(c.Box) !== box) return false;
      if (pub && !(c.Publisher || "").toLowerCase().includes(pub.toLowerCase())) return false;
      if (keyOnly && (c.Key || "").toUpperCase() !== keyOnly) return false;
      if (platform && (c.Platform || "").toUpperCase() !== platform.toUpperCase()) return false;
      return true;
    });
  }, [q, box, pub, keyOnly, platform]);

  const clear = () => { setQ(""); setBox(""); setPub(""); setKeyOnly(""); setPlatform(""); setOpen(new Set()); };

  const toggle = (i: number) => {
    setOpen(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };

  return (
    <div>
      <div className="filters">
        <input placeholder="Search title, writer, arc, publisher..." value={q} onChange={e => setQ(e.target.value)} />
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
        <button className="clear-btn" onClick={clear}>✕ Clear</button>
      </div>

      <div className="results-bar">
        <span>{results.length} of {comics.length} books</span>
        <span className="results-hint">1,467 books across 9 boxes</span>
      </div>

      <div className="card-grid">
        {results.length === 0 && <div className="no-res">No books match your filters</div>}
        {results.map((c, i) => {
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
              {nmVal && (
                <div className="card-value">NM: <span className="v">${nmVal}</span></div>
              )}
              {pitch && (
                <div className="card-pitch">{pitch.substring(0, 160)}{pitch.length > 160 ? "…" : ""}</div>
              )}
              {isOpen && (
                <div className="card-expand">
                  {c.Writer   && c.Writer !== "nan"   && <div className="dr"><span className="dl">Writer</span><span className="dv">{c.Writer}</span></div>}
                  {c.Artist   && c.Artist !== "nan"   && <div className="dr"><span className="dl">Artist</span><span className="dv">{c.Artist}</span></div>}
                  {c.Arc      && c.Arc !== "nan"      && <div className="dr"><span className="dl">Arc</span><span className="dv">{c.Arc}</span></div>}
                  {c.Key_Why  && c.Key_Why !== "nan"  && <div className="dr"><span className="dl">Key Why</span><span className="dv">{c.Key_Why}</span></div>}
                  {c.First_App && c.First_App !== "nan" && <div className="dr"><span className="dl">1st App</span><span className="dv">{c.First_App}</span></div>}
                  {c.Condition && c.Condition !== "nan" && <div className="dr"><span className="dl">Condition</span><span className="dv">{c.Condition}</span></div>}
                  {c.Storage  && c.Storage !== "nan"  && <div className="dr"><span className="dl">Storage</span><span className="dv">{c.Storage}</span></div>}
                  {isTf       && <div className="dr"><span className="dl">Terrificon</span><span className="dv">{c.Terrificon}</span></div>}
                  {c.Sales_Data && c.Sales_Data !== "nan" && <div className="dr"><span className="dl">Sales</span><span className="dv">{(c.Sales_Data || "").substring(0, 100)}</span></div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
