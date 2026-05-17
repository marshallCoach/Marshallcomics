import { useState } from "react";
import { DATA2 } from "@/data/data2";

const shows    = DATA2.show_planner;
const runsheet = DATA2.show2;

function statusClass(s: string) {
  if ((s || "").includes("Ready"))      return "ss-ready";
  if ((s || "").includes("CGC"))        return "ss-cgc";
  if ((s || "").includes("Terrificon")) return "ss-after";
  return "";
}

export default function ShowPlanner() {
  const [openShows, setOpenShows] = useState<Set<number>>(new Set());
  const [openRun,   setOpenRun]   = useState<Set<number>>(new Set());

  const toggleShow = (i: number) => {
    setOpenShows(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };
  const toggleRun = (i: number) => {
    setOpenRun(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };

  return (
    <div>
      <div className="section-intro">
        <h2>Whatnot Show Planner — Box Collection</h2>
        <p>19 themed show concepts from your all-boxes inventory. Includes $1 Keys Night full runsheet.</p>
      </div>

      <div className="shows-grid">
        {shows.map((s, i) => {
          const isOpen = openShows.has(i);
          return (
            <div key={i} className={`show-card${isOpen ? " open" : ""}`} onClick={() => toggleShow(i)}>
              <div className="show-theme">{s.Theme}</div>
              <div className="show-anchor">{s.Anchor}</div>
              <div className="show-meta">
                <span className="show-rev">{s.Est_Revenue}</span>
                <span className={`show-status-badge ${statusClass(s.Status)}`}>{s.Status}</span>
                {s.Box && <span className="badge bb">Box {s.Box}</span>}
              </div>
              {isOpen && s.Notes && (
                <div className="show-expand">{s.Notes}</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="section-intro" style={{ marginTop: 8 }}>
        <h2>$1 Keys Night — Full Runsheet</h2>
        <p>23 books sequenced across 4 acts for maximum bidding engagement</p>
      </div>

      <div className="list-view">
        {runsheet.map((r, i) => {
          const isOpen = openRun.has(i);
          const nmVal  = r.Value_NM && r.Value_NM !== "nan" ? r.Value_NM : "";
          return (
            <div key={i} className={`lcard${isOpen ? " open" : ""}`} onClick={() => toggleRun(i)}>
              <div className="lcard-head">
                <span className="lcard-date">#{r.Order}</span>
                <span className="lcard-title">{r.Book} {r.Issue}</span>
                {r.Start && <span className="lcard-right">Start ${r.Start}</span>}
                {nmVal   && <span className="lcard-tag">NM ${nmVal}</span>}
              </div>
              {isOpen && (
                <div className="lcard-expand">
                  {r.Pitch && <div style={{ marginBottom: 6, fontStyle: "italic" }}>{r.Pitch}</div>}
                  {r.Hook  && <div className="dr"><span className="dl">Hook</span><span className="dv">{r.Hook}</span></div>}
                  {r.Publisher      && <div className="dr"><span className="dl">Publisher</span><span className="dv">{r.Publisher} · Box {r.Box || "?"}</span></div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
