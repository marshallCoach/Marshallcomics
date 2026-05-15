import { useState, useMemo } from "react";
import { DATA2 } from "@/data/data2";

const keys = DATA2.boxes_keys;
const BOXES = [...new Set(keys.map(k => String(k.Box)))].sort((a, b) => Number(a) - Number(b));

export default function BoxKeys() {
  const [q, setQ]         = useState("");
  const [box, setBox]     = useState("");
  const [action, setAction] = useState("");
  const [tf, setTf]       = useState("");
  const [view, setView]   = useState<"card" | "list">("list");
  const [hasSearched, setHasSearched] = useState(false);
  const [open, setOpen]   = useState<Set<number>>(new Set());

  const results = useMemo(() => {
    if (!hasSearched) return [];
    const ql = q.toLowerCase();
    return keys.filter(k => {
      if (ql && ![k.Title, k.Publisher, k.Key_Why, k.Issue].join(" ").toLowerCase().includes(ql)) return false;
      if (box && String(k.Box) !== box) return false;
      if (action && !(k.Action_Flag || "").includes(action)) return false;
      if (tf && (k.Terrificon || "").toUpperCase() !== tf) return false;
      return true;
    });
  }, [q, box, action, tf, hasSearched]);

  const runSearch = () => { setHasSearched(true); setOpen(new Set()); };
  const clearResults = () => { setHasSearched(false); setOpen(new Set()); setQ(""); setBox(""); setAction(""); setTf(""); };
  const toggle = (i: number) => {
    setOpen(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };

  function actionBadge(flag: string) {
    if (!flag) return null;
    if (flag.includes("CGC")) return <span className="badge bc" style={{ fontSize: "0.62rem" }}>CGC NOW</span>;
    if (flag.includes("Whatnot")) return <span className="badge bwn" style={{ fontSize: "0.62rem" }}>Whatnot</span>;
    return <span className="badge bb" style={{ fontSize: "0.62rem" }}>{flag}</span>;
  }

  return (
    <div>
      <div className="filters">
        <input placeholder="Search title, key reason, publisher..." value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && runSearch()} />
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
        <button className="clear-btn" onClick={runSearch}>Search</button>
        {hasSearched && <button className="clear-results-btn" onClick={clearResults}>✕ Clear Results</button>}
      </div>

      {hasSearched && (
        <div className="results-bar">
          <span>{results.length} of {keys.length} key issues</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="results-hint">141 keys extracted from all boxes</span>
            <div className="view-toggle">
              <button className={`view-toggle-btn${view === "list" ? " active" : ""}`} onClick={() => setView("list")}>≡ List</button>
              <button className={`view-toggle-btn${view === "card" ? " active" : ""}`} onClick={() => setView("card")}>⊞ Cards</button>
            </div>
          </div>
        </div>
      )}

      {!hasSearched && (
        <div className="blank-state">
          <div className="blank-state-icon">🔑</div>
          <div className="blank-state-title">Box Keys — 141 Key Issues</div>
          <div className="blank-state-sub">Filter by box, action flag, or keyword and press Search.</div>
        </div>
      )}

      {hasSearched && results.length === 0 && <div className="no-res">No keys match your filters</div>}

      {hasSearched && results.length > 0 && view === "card" && (
        <div className="card-grid">
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
                {nmVal && <div className="card-value">NM: <span className="v">${nmVal}</span>{k.Start_Bid && k.Start_Bid !== "nan" && <span className="vf"> · Start: ${k.Start_Bid}</span>}</div>}
                {keyWhy && <div className="card-pitch">{keyWhy.substring(0, 180)}{keyWhy.length > 180 ? "…" : ""}</div>}
                {isOpen && (
                  <div className="card-expand">
                    {k.Storage    && k.Storage !== "nan"    && <div className="dr"><span className="dl">Storage</span><span className="dv">{k.Storage}</span></div>}
                    {k.Action_Flag && <div className="dr"><span className="dl">Action</span><span className="dv">{k.Action_Flag}</span></div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasSearched && results.length > 0 && view === "list" && (
        <div className="list-table">
          <table>
            <thead>
              <tr>
                <th>Box</th><th>Title</th><th>#</th><th>Publisher</th><th>NM Value</th><th>Start Bid</th><th>Platform</th><th>Action</th><th>Terrificon</th>
              </tr>
            </thead>
            <tbody>
              {results.map((k, i) => {
                const isTf   = (k.Terrificon || "").toUpperCase() === "YES";
                const nmVal  = k.Value_NM && k.Value_NM !== "nan" ? `$${k.Value_NM}` : "—";
                const bid    = k.Start_Bid && k.Start_Bid !== "nan" ? `$${k.Start_Bid}` : "—";
                const isOpen = open.has(i);
                return (
                  <>
                    <tr key={`r-${i}`} className={isOpen ? "open-row" : ""} onClick={() => toggle(i)}>
                      <td className="lt-sub">Box {k.Box}</td>
                      <td className="lt-title">{k.Title || "Untitled"}</td>
                      <td className="lt-sub">#{k.Issue}</td>
                      <td className="lt-sub">{k.Publisher}</td>
                      <td className="lt-val">{nmVal}</td>
                      <td className="lt-sub">{bid}</td>
                      <td>{k.Platform && <span className={`badge ${k.Platform === "EBAY" ? "beb" : "bwn"}`} style={{ fontSize: "0.62rem" }}>{k.Platform}</span>}</td>
                      <td>{actionBadge(k.Action_Flag || "")}</td>
                      <td>{isTf && <span className="badge bt" style={{ fontSize: "0.62rem" }}>★</span>}</td>
                    </tr>
                    {isOpen && (
                      <tr key={`e-${i}`} className="list-expand-row">
                        <td colSpan={9}>
                          {k.Key_Why && <div className="dr"><span className="dl">Key Why</span><span className="dv">{k.Key_Why}</span></div>}
                          {k.Storage && k.Storage !== "nan" && <div className="dr"><span className="dl">Storage</span><span className="dv">{k.Storage}</span></div>}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
