import { useState } from "react";
import { DATA1 } from "@/data/data1";

const strategy = DATA1.cgc_strategy;

export default function CGCStrategy() {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (i: number) => {
    setOpen(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };

  return (
    <div>
      <div className="section-intro">
        <h2>CGC Submission Priority — Best ROI</h2>
        <p>Press everything before submitting (except Stan Lee BP #513 — authenticate first)</p>
      </div>

      <div className="list-view">
        {strategy.map((c, i) => {
          const isOpen = open.has(i);
          return (
            <div key={i} className={`lcard lc-cgc${isOpen ? " open" : ""}`} onClick={() => toggle(i)}>
              <div className="lcard-head">
                <span className="lcard-date">{c.Priority || ""}</span>
                <span className="lcard-title">{c.Book}</span>
                <span className="lcard-right">{c.ROI || ""}</span>
                <span className="lcard-tag">{c.Cost || ""}</span>
              </div>
              {isOpen && (
                <div className="lcard-expand">
                  {c.Service        && <div className="dr"><span className="dl">Service</span><span className="dv">{c.Service}</span></div>}
                  {c.Expected_Grade && <div className="dr"><span className="dl">Grade</span><span className="dv">{c.Expected_Grade}</span></div>}
                  {c.Raw_Value      && <div className="dr"><span className="dl">Raw Now</span><span className="dv">{c.Raw_Value}</span></div>}
                  {c.CGC_Value      && <div className="dr"><span className="dl">After CGC</span><span className="dv" style={{ color: "var(--gold)" }}>{c.CGC_Value}</span></div>}
                  {c.Notes          && <div style={{ marginTop: 8, fontStyle: "italic" }}>{(c.Notes || "").substring(0, 300)}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
