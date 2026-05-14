import { useState } from "react";
import { DATA1 } from "@/data/data1";

const signings   = DATA1.private_signings;
const terrificon = DATA1.terrificon;
const nycc       = DATA1.nycc;

function sigClass(status: string) {
  const s = (status || "").toUpperCase();
  if (s.includes("OPEN"))   return "lc-open";
  if (s.includes("CLOSED") || s.includes("MISSED")) return "lc-closed";
  return "lc-watch";
}
function sigBadge(status: string) {
  const s = (status || "").toUpperCase();
  if (s.includes("OPEN"))   return "status-open";
  if (s.includes("CLOSED") || s.includes("MISSED")) return "status-closed";
  return "status-watch";
}

type View = "signings" | "terrificon" | "nycc";

export default function PrivateSignings() {
  const [view, setView]     = useState<View>("signings");
  const [open, setOpen]     = useState<Set<number>>(new Set());
  const [openTf, setOpenTf] = useState<Set<number>>(new Set());
  const [openNy, setOpenNy] = useState<Set<number>>(new Set());

  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<number>>>, i: number) => {
    setter(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };

  const tabBtn = (id: View, label: string) => (
    <button
      className={`tab-btn${view === id ? " active" : ""}`}
      onClick={() => setView(id)}
      style={{ fontSize: "0.82rem" }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="section-intro">
        <h2>CGC Private Signings — 2026</h2>
        <p>Follow @CGCSignatureSeries on IG/TikTok · Check cgccomics.com weekly for new announcements</p>
      </div>

      <div style={{ background: "#0b0b0b", borderBottom: "1px solid #222", display: "flex", paddingLeft: 14 }}>
        {tabBtn("signings",   "Private Signings")}
        {tabBtn("terrificon", `Terrificon Prep (${terrificon.length})`)}
        {tabBtn("nycc",       `NYCC Prep (${nycc.length})`)}
      </div>

      {view === "signings" && (
        <div className="list-view">
          {signings.map((s, i) => {
            const isOpen = open.has(i);
            return (
              <div key={i} className={`lcard ${sigClass(s.status)}${isOpen ? " open" : ""}`} onClick={() => toggle(setOpen, i)}>
                <div className="lcard-head">
                  <span className="lcard-title">{s.creator}</span>
                  <span className={`lcard-tag ${sigBadge(s.status)}`}>{s.status}</span>
                  {s.deadline && <span style={{ color: "var(--muted)", fontSize: "0.72rem", marginLeft: "auto" }}>{s.deadline}</span>}
                </div>
                {isOpen && (
                  <div className="lcard-expand">
                    {s.fee        && <div className="dr"><span className="dl">Fee</span><span className="dv">{s.fee}</span></div>}
                    {s.your_books && <div className="dr"><span className="dl">Your Books</span><span className="dv">{s.your_books}</span></div>}
                    {s.action     && <div className="dr" style={{ marginTop: 6 }}><span className="dl">Action</span><span className="dv" style={{ color: "var(--green-text)" }}>{s.action}</span></div>}
                    {s.strategy   && <div style={{ marginTop: 8, fontStyle: "italic" }}>{s.strategy}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(view === "terrificon" || view === "nycc") && (
        <div className="list-view">
          {view === "terrificon" && (
            <div className="lcard lc-con" style={{ cursor: "default", opacity: 0.85 }}>
              <div className="lcard-head">
                <span className="lcard-title">Terrificon 2026 — Aug 8–9, Connecticut Convention Center</span>
                <span className="lcard-tag" style={{ background: "var(--purple-bg)", color: "var(--purple-text)" }}>Jim Lee: SAT ONLY</span>
              </div>
            </div>
          )}
          {view === "nycc" && (
            <div className="lcard lc-con" style={{ cursor: "default", opacity: 0.85 }}>
              <div className="lcard-head">
                <span className="lcard-title">NYCC 2026 — October, Javits Center, New York City</span>
              </div>
            </div>
          )}
          {(view === "terrificon" ? terrificon : nycc).map((item, i) => {
            const setter = view === "terrificon" ? setOpenTf : setOpenNy;
            const openSet = view === "terrificon" ? openTf : openNy;
            const isOpen = openSet.has(i);
            return (
              <div key={i} className={`lcard lc-con${isOpen ? " open" : ""}`} onClick={() => toggle(setter, i)}>
                <div className="lcard-head">
                  <span className="lcard-date">{item.priority}</span>
                  <span className="lcard-title">{item.book}</span>
                  <span className="lcard-tag" style={{ background: "var(--blue-bg)", color: "var(--blue-text)" }}>{item.goal}</span>
                </div>
                {isOpen && (
                  <div className="lcard-expand">
                    {item.creator && <div className="dr"><span className="dl">Creator</span><span className="dv" style={{ color: "var(--red)" }}>{item.creator}</span></div>}
                    {item.notes   && <div style={{ marginTop: 6, fontStyle: "italic" }}>{item.notes}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
