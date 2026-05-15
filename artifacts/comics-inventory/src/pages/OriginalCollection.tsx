import { useState, useMemo } from "react";
import { DATA1 } from "@/data/data1";

const comics = DATA1.orig_inventory;
const PUBLISHERS = [...new Set(comics.map(c => c.Publisher).filter(Boolean))].sort();
const ERAS       = [...new Set(comics.map(c => c.Era).filter(Boolean))].sort();
const PLATFORMS  = [...new Set(comics.map(c => c.Platform).filter(Boolean))].sort();

function platClass(p: string) {
  const u = (p || "").toUpperCase();
  if (u === "WHATNOT") return "bwn";
  if (u === "EBAY")    return "beb";
  if (u.includes("HERITAGE")) return "bhe";
  return "bb";
}

export default function OriginalCollection() {
  const [q, setQ]               = useState("");
  const [pub, setPub]           = useState("");
  const [era, setEra]           = useState("");
  const [platform, setPlatform] = useState("");
  const [signed, setSigned]     = useState("");
  const [keyOnly, setKeyOnly]   = useState("");
  const [cgcOnly, setCgcOnly]   = useState("");
  const [view, setView]         = useState<"card" | "list">("card");
  const [hasSearched, setHasSearched] = useState(false);
  const [open, setOpen]         = useState<Set<number>>(new Set());

  const hasFilters = q || pub || era || platform || signed || keyOnly || cgcOnly;

  const results = useMemo(() => {
    if (!hasSearched) return [];
    const ql = q.toLowerCase();
    return comics.filter(c => {
      if (ql && ![c.Title, c.Writer, c.Artist, c.Key_Why, c.First_App, c.Signed_By, c.Arc, c.Publisher, c.Whatnot_Category].join(" ").toLowerCase().includes(ql)) return false;
      if (pub && c.Publisher !== pub) return false;
      if (era && c.Era !== era) return false;
      if (platform && c.Platform !== platform) return false;
      if (signed && (c.Signed || "").toUpperCase() !== signed) return false;
      if (keyOnly && (c.Key || "").toUpperCase() !== keyOnly) return false;
      if (cgcOnly && (c.CGC_Worth || "").toUpperCase() !== cgcOnly) return false;
      return true;
    });
  }, [q, pub, era, platform, signed, keyOnly, cgcOnly, hasSearched]);

  const runSearch = () => { setHasSearched(true); setOpen(new Set()); };
  const clearResults = () => {
    setHasSearched(false); setOpen(new Set());
    setQ(""); setPub(""); setEra(""); setPlatform(""); setSigned(""); setKeyOnly(""); setCgcOnly("");
  };

  const toggle = (i: number) => {
    setOpen(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };

  return (
    <div>
      {/* Filters */}
      <div className="filters">
        <input
          placeholder="Search title, writer, character, signer..."
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === "Enter" && runSearch()}
        />
        <select value={pub} onChange={e => setPub(e.target.value)}>
          <option value="">All Publishers</option>
          {PUBLISHERS.map(p => <option key={p}>{p}</option>)}
        </select>
        <select value={era} onChange={e => setEra(e.target.value)}>
          <option value="">All Eras</option>
          {ERAS.map(e2 => <option key={e2}>{e2}</option>)}
        </select>
        <select value={platform} onChange={e => setPlatform(e.target.value)}>
          <option value="">All Platforms</option>
          {PLATFORMS.map(p => <option key={p}>{p}</option>)}
        </select>
        <select value={signed} onChange={e => setSigned(e.target.value)}>
          <option value="">All / Signed</option>
          <option value="YES">Signed Only</option>
          <option value="NO">Unsigned Only</option>
        </select>
        <select value={keyOnly} onChange={e => setKeyOnly(e.target.value)}>
          <option value="">All / Keys</option>
          <option value="YES">Keys Only</option>
        </select>
        <select value={cgcOnly} onChange={e => setCgcOnly(e.target.value)}>
          <option value="">CGC / All</option>
          <option value="YES">CGC Worthy</option>
        </select>
        <button className="clear-btn" onClick={runSearch}>Search</button>
        {hasSearched && <button className="clear-results-btn" onClick={clearResults}>✕ Clear Results</button>}
      </div>

      {/* Results bar */}
      {hasSearched && (
        <div className="results-bar">
          <span>{results.length} of {comics.length} books</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="results-hint">Click a row to expand</span>
            <div className="view-toggle">
              <button className={`view-toggle-btn${view === "list" ? " active" : ""}`} onClick={() => setView("list")}>≡ List</button>
              <button className={`view-toggle-btn${view === "card" ? " active" : ""}`} onClick={() => setView("card")}>⊞ Cards</button>
            </div>
          </div>
        </div>
      )}

      {/* Blank state */}
      {!hasSearched && (
        <div className="blank-state">
          <div className="blank-state-icon">📦</div>
          <div className="blank-state-title">Original Collection — 308 Books</div>
          <div className="blank-state-sub">Use the filters above and press Search, or just press Search to see all books.</div>
        </div>
      )}

      {/* No results */}
      {hasSearched && results.length === 0 && (
        <div className="no-res">No books match your filters</div>
      )}

      {/* CARD VIEW */}
      {hasSearched && results.length > 0 && view === "card" && (
        <div className="card-grid">
          {results.map((c, i) => {
            const isKey    = (c.Key || "").toUpperCase() === "YES";
            const isSigned = (c.Signed || "").toUpperCase() === "YES";
            const isCGC    = (c.CGC_Worth || "").toUpperCase() === "YES";
            const isTf     = !!(c.Terrificon || "").trim();
            const isOpen   = open.has(i);
            return (
              <div key={i} className={`comic-card${isOpen ? " open" : ""}`} onClick={() => toggle(i)}>
                <div className="card-title">{c.Title || "Untitled"}</div>
                <div className="card-sub">{c.Publisher} {c.Issue} · {c.Year} · {c.Era}</div>
                <div className="badges">
                  {isKey    && <span className="badge bk">KEY</span>}
                  {isSigned && <span className="badge bs">✍ {(c.Signed_By || "").substring(0, 22)}</span>}
                  {c.Era    && <span className="badge be">{c.Era}</span>}
                  {c.Platform && <span className={`badge ${platClass(c.Platform)}`}>{c.Platform}</span>}
                  {isCGC    && <span className="badge bc">CGC ✓</span>}
                  {isTf     && <span className="badge bt">Terrificon</span>}
                </div>
                {c.Value_NM && (
                  <div className="card-value">
                    NM: <span className="v">{c.Value_NM}</span>
                    {c.Value_VF && <span className="vf"> · VF: {c.Value_VF}</span>}
                  </div>
                )}
                {c.Whatnot_Pitch && (
                  <div className="card-pitch">{c.Whatnot_Pitch.substring(0, 170)}{c.Whatnot_Pitch.length > 170 ? "…" : ""}</div>
                )}
                {isOpen && (
                  <div className="card-expand">
                    {c.Writer      && <div className="dr"><span className="dl">Writer</span><span className="dv">{c.Writer}</span></div>}
                    {c.Artist      && <div className="dr"><span className="dl">Artist</span><span className="dv">{c.Artist}</span></div>}
                    {c.Arc         && <div className="dr"><span className="dl">Arc</span><span className="dv">{c.Arc}</span></div>}
                    {c.Key_Why     && <div className="dr"><span className="dl">Key Why</span><span className="dv">{c.Key_Why}</span></div>}
                    {c.First_App   && <div className="dr"><span className="dl">1st App</span><span className="dv">{c.First_App}</span></div>}
                    {c.Condition   && <div className="dr"><span className="dl">Condition</span><span className="dv">{c.Condition}</span></div>}
                    {c.Personalization && <div className="dr"><span className="dl">Personalized</span><span className="dv">{c.Personalization}</span></div>}
                    {isTf          && <div className="dr"><span className="dl">Terrificon</span><span className="dv">{c.Terrificon}</span></div>}
                    {c.Sales_Data  && <div className="dr"><span className="dl">Sales</span><span className="dv">{(c.Sales_Data || "").substring(0, 140)}</span></div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* LIST VIEW */}
      {hasSearched && results.length > 0 && view === "list" && (
        <div className="list-table">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>#</th>
                <th>Publisher</th>
                <th>Year</th>
                <th>Era</th>
                <th>NM Value</th>
                <th>VF Value</th>
                <th>Platform</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {results.map((c, i) => {
                const isKey    = (c.Key || "").toUpperCase() === "YES";
                const isSigned = (c.Signed || "").toUpperCase() === "YES";
                const isCGC    = (c.CGC_Worth || "").toUpperCase() === "YES";
                const isTf     = !!(c.Terrificon || "").trim();
                const isOpen   = open.has(i);
                return (
                  <>
                    <tr key={`r-${i}`} className={isOpen ? "open-row" : ""} onClick={() => toggle(i)}>
                      <td className="lt-title">{c.Title || "Untitled"}</td>
                      <td className="lt-sub">{c.Issue}</td>
                      <td className="lt-sub">{c.Publisher}</td>
                      <td className="lt-sub">{c.Year}</td>
                      <td><span className="badge be" style={{ fontSize: "0.62rem" }}>{c.Era}</span></td>
                      <td className="lt-val">{c.Value_NM || "—"}</td>
                      <td className="lt-vf">{c.Value_VF || "—"}</td>
                      <td>{c.Platform && <span className={`badge ${platClass(c.Platform)}`} style={{ fontSize: "0.62rem" }}>{c.Platform}</span>}</td>
                      <td>
                        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                          {isKey    && <span className="badge bk" style={{ fontSize: "0.62rem" }}>KEY</span>}
                          {isSigned && <span className="badge bs" style={{ fontSize: "0.62rem" }}>✍</span>}
                          {isCGC    && <span className="badge bc" style={{ fontSize: "0.62rem" }}>CGC</span>}
                          {isTf     && <span className="badge bt" style={{ fontSize: "0.62rem" }}>TF</span>}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`e-${i}`} className="list-expand-row">
                        <td colSpan={9}>
                          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                            {c.Writer      && <div className="dr"><span className="dl">Writer</span><span className="dv">{c.Writer}</span></div>}
                            {c.Artist      && <div className="dr"><span className="dl">Artist</span><span className="dv">{c.Artist}</span></div>}
                            {c.Key_Why     && <div className="dr"><span className="dl">Key</span><span className="dv">{c.Key_Why}</span></div>}
                            {c.First_App   && <div className="dr"><span className="dl">1st App</span><span className="dv">{c.First_App}</span></div>}
                            {c.Signed_By   && <div className="dr"><span className="dl">Signed By</span><span className="dv">{c.Signed_By}</span></div>}
                            {c.Condition   && <div className="dr"><span className="dl">Condition</span><span className="dv">{c.Condition}</span></div>}
                            {c.Sales_Data  && <div className="dr"><span className="dl">Sales</span><span className="dv">{(c.Sales_Data || "").substring(0, 120)}</span></div>}
                          </div>
                          {c.Whatnot_Pitch && <div style={{ marginTop: 6, fontStyle: "italic", color: "var(--muted2)", fontSize: "0.8rem" }}>{c.Whatnot_Pitch.substring(0, 200)}</div>}
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
