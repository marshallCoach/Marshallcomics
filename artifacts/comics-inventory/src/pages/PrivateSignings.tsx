import { useState } from "react";
import { DATA3 } from "@/data/data3";

const signings = DATA3.cgc_signings;

function urgencyColor(deadline: string) {
  const d = (deadline || "").toLowerCase();
  if (d.includes("jun 5") || d.includes("june 5") || d.includes("urgent")) return "#dc2626";
  if (d.includes("jun") || d.includes("jul 10") || d.includes("july")) return "#d97706";
  if (d.includes("sep") || d.includes("oct")) return "#1d6fa4";
  return "#6b7280";
}

function urgencyLabel(deadline: string) {
  const d = (deadline || "").toLowerCase();
  if (d.includes("jun 5") || d.includes("june 5") || d.includes("urgent")) return "CRITICAL";
  if (d.includes("jun") || d.includes("jul")) return "HIGH";
  if (d.includes("sep") || d.includes("oct")) return "UPCOMING";
  return "MONITOR";
}

export default function PrivateSignings() {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setOpen(prev => {
    const n = new Set(prev); n.has(i)?n.delete(i):n.add(i); return n;
  });

  return (
    <div>
      <div className="section-intro">
        <h2>CGC Private Signings — 2026</h2>
        <p>Monitor cgccomics.com/signature-series/ weekly · Follow @CGCSignatureSeries on Instagram/TikTok</p>
      </div>

      {/* Legend */}
      <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)", padding:"10px 24px", display:"flex", gap:16, flexWrap:"wrap", fontSize:"0.72rem", color:"var(--muted2)" }}>
        <span>🟡 <strong>Yellow SS</strong> = unsigned book + witnessed signing (Terrificon) → max value</span>
        <span>🟢 <strong>Green Qualified</strong> = already-signed book via CGC × JSA mail-in → authenticated</span>
        <span>⚠️ <strong>Stan Lee</strong> = authenticate via PSA/DNA at NYCC — do NOT press</span>
      </div>

      <div className="list-view">
        {signings.map((s, i) => {
          const isOpen = open.has(i);
          const color  = urgencyColor(s.Deadline);
          const badge  = urgencyLabel(s.Deadline);
          return (
            <div key={i} className={`lcard${isOpen?" open":""}`}
              style={{ borderLeft:`3px solid ${color}` }}
              onClick={()=>toggle(i)}>
              <div className="lcard-head">
                <span style={{
                  fontSize:"0.6rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
                  background:`${color}18`, border:`1px solid ${color}`, color, borderRadius:3,
                  padding:"1px 7px", whiteSpace:"nowrap", flexShrink:0,
                }}>{badge}</span>
                <span className="lcard-title">{s.Creator}</span>
                {s.Fee      && <span className="lcard-tag">{s.Fee}/item</span>}
                {s.Deadline && <span className="lcard-right" style={{color}}>{s.Deadline}</span>}
              </div>
              {s.Books && !isOpen && (
                <div style={{ fontSize:"0.78rem", color:"var(--muted2)", marginTop:4, paddingLeft:4 }}>
                  {s.Books.substring(0,120)}{s.Books.length>120?"…":""}
                </div>
              )}
              {isOpen && (
                <div className="lcard-expand">
                  {s.Books    && <div className="dr"><span className="dl">Books</span><span className="dv">{s.Books}</span></div>}
                  {s.Strategy && <div className="dr" style={{marginTop:8}}><span className="dl">Strategy</span><span className="dv" style={{fontStyle:"italic"}}>{s.Strategy}</span></div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pressing reminder */}
      <div style={{ margin:"24px 20px 40px", padding:"16px 20px", background:"#fff8e0", border:"1.5px solid #d4a800", borderRadius:8 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", letterSpacing:"1.5px", color:"#8a6000", marginBottom:8 }}>
          📦 PRESSING BATCH — Submit All Simultaneously
        </div>
        <div style={{ fontSize:"0.8rem", color:"#6a4800", lineHeight:1.7 }}>
          Batman #656, #657 · Wolverine #8 (UNSIGNED) · ASM #361 · Vision #1 · Secret Wars #1 ·
          New Warriors #1 · Mockingbird #8 · WildCATs #2/#11 · Savage Dragon #1 · Transformers #1 ·
          All Avengers (Roy Thomas books)
        </div>
        <div style={{ marginTop:8, fontSize:"0.75rem", color:"#8a6000" }}>
          Cost: $15–25/book · Turnaround: 4–8 weeks · Submit all at once to save shipping · <strong>DO NOT PRESS: Stan Lee BP #513</strong>
        </div>
      </div>
    </div>
  );
}
