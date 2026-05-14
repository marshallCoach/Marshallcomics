import { useState, useMemo } from "react";
import { DATA2 } from "@/data/data2";

const keys = DATA2.boxes_keys;
const BOXES = [...new Set(keys.map(k => String(k.Box)))].sort((a, b) => Number(a) - Number(b));

export default function BoxKeys() {
  const [q, setQ]         = useState("");
  const [box, setBox]     = useState("");
  const [action, setAction] = useState("");
  const [tf, setTf]       = useState("");
  const [open, setOpen]   = useState<Set<number>>(new Set());

  const results = useMemo(() => {
    const ql = q.toLowerCase();
    return keys.filter(k => {
      if (ql && ![k.Title, k.Publisher, k.Key_Why, k.Issue].join(" ").toLowerCase().includes(ql)) return false;
      if (box && String(k.Box) !== box) return false;
      if (action && !(k.Action_Flag || "").includes(action)) return false;
      if (tf && (k.Terrificon || "").toUpperCase() !== tf) return false;
      return true;
    });
  }, [q, box, action, tf]);

  const clear = () => { setQ(""); setBox(""); setAction(""); setTf(""); setOpen(new Set()); };
  const toggle = (i: number) => {
    setOpen(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };

  return (
    <div>
      <div className="filters">
        <input placeholder="Search title, key reason, publisher..." value={q} onChange={e => setQ(e.target.value)} />
        <select value={box} onChange={e => setBox(e.target.value)}>
          <option value="">All Boxes</option>
          {BOXES.map(b => <option key={b} value={b}>Box {b}</option>)}
        </select>
        <select value={action} onChange={e => setAction(e.target.value)}>
          <option value="">All Actions</option>
          <option value="CGC">CGC Immediately</option>
          <option value="Whatnot">Whatnot Ready</option>
        </select>
        <select value={tf} onChange={e => setTf(e.target.value)}>
          <option value="">All / Terrificon</option>
          <option value="YES">Terrificon Books</option>
        </select>
        <button className="clear-btn" onClick={clear}>✕ Clear</button>
      </div>

      <div className="results-bar">
        <span>{results.length} of {keys.length} keys</span>
        <span className="results-hint">141 keys extracted from all boxes</span>
      </div>

      <div className="card-grid">
        {results.length === 0 && <div className="no-res">No keys match your filters</div>}
        {results.map((k, i) => {
          const isCGC     = (k.Action_Flag || "").includes("CGC");
          const isWhatnot = (k.Action_Flag || "").includes("Whatnot");
          const isTf      = (k.Terrificon || "").toUpperCase() === "YES";
          const isOpen    = open.has(i);
          const nmVal     = k.Value_NM && k.Value_NM !== "nan" ? k.Value_NM : "";
          const keyWhy    = k.Key_Why && k.Key_Why !== "nan" ? k.Key_Why : "";
          return (
            <div key={i} className={`comic-card${isOpen ? " open" : ""}`} onClick={() => toggle(i)}>
              <div className="card-title">{k.Title || "Untitled"}</div>
              <div className="card-sub">Box {k.Box} · {k.Publisher} #{k.Issue}</div>
              <div className="badges">
                <span className="badge bk">KEY</span>
                {isCGC     && <span className="badge bc">CGC NOW</span>}
                {isWhatnot && <span className="badge bwn">Whatnot Ready</span>}
                {k.Platform && <span className={`badge ${k.Platform === "EBAY" ? "beb" : "bwn"}`}>{k.Platform}</span>}
                {isTf      && <span className="badge bt">Terrificon</span>}
              </div>
              {nmVal && (
                <div className="card-value">
                  NM: <span className="v">${nmVal}</span>
                  {k.Start_Bid && k.Start_Bid !== "nan" && <span className="vf"> · Start: ${k.Start_Bid}</span>}
                </div>
              )}
              {keyWhy && (
                <div className="card-pitch">{keyWhy.substring(0, 180)}{keyWhy.length > 180 ? "…" : ""}</div>
              )}
              {isOpen && (
                <div className="card-expand">
                  {k.Storage    && k.Storage !== "nan"    && <div className="dr"><span className="dl">Storage</span><span className="dv">{k.Storage}</span></div>}
                  {k.Action_Flag && k.Action_Flag !== "nan" && <div className="dr"><span className="dl">Action</span><span className="dv">{k.Action_Flag}</span></div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
