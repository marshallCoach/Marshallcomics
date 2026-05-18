import { useState } from "react";
import { DATA3 } from "@/data/data3";

const strategy = DATA3.cgc_strategy;
const conBooks  = DATA3.con_books;

const terrificon = conBooks.filter(c => (c.Notes + c.Goal + c.Creator).toUpperCase().includes("TERRIFICON") || (c.Priority + "").toUpperCase().includes("SAT") || (c.Creator + "").toUpperCase().includes("JIM LEE") || (c.Creator + "").toUpperCase().includes("CLAREMONT") || (c.Creator + "").toUpperCase().includes("BAGLEY"));
const nycc       = conBooks.filter(c => (c.Notes + c.Goal).toUpperCase().includes("NYCC") || (c.Goal + "").toUpperCase().includes("PSA") || (c.Goal + "").toUpperCase().includes("HERITAGE"));
const other_con  = conBooks.filter(c => !terrificon.includes(c) && !nycc.includes(c));

type View = "cgc" | "terrificon" | "nycc";

export default function CGCStrategy() {
  const [open,    setOpen]   = useState<Set<number>>(new Set());
  const [openTf,  setOpenTf] = useState<Set<number>>(new Set());
  const [openNy,  setOpenNy] = useState<Set<number>>(new Set());
  const [view,    setView]   = useState<View>("cgc");

  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<number>>>, i: number) =>
    setter(prev => { const n = new Set(prev); n.has(i)?n.delete(i):n.add(i); return n; });

  return (
    <div>
      <div className="section-intro">
        <h2>CGC Strategy — Best Use of $500</h2>
        <p>Press everything before submitting — except Stan Lee BP #513 (authenticate via PSA/DNA first)</p>
      </div>

      {/* Sub-tabs */}
      <div style={{ background:"#0b0b0b", borderBottom:"1px solid #222", display:"flex", paddingLeft:14 }}>
        {([["cgc","📊 CGC Priority"],["terrificon","🎪 Terrificon"],["nycc","🏙️ NYCC"]] as [View,string][]).map(([id,lbl])=>(
          <button key={id} className={`tab-btn${view===id?" active":""}`}
            style={{fontSize:"0.82rem", color: view===id?"#fff":"rgba(255,255,255,0.5)", borderBottomColor: view===id?"var(--red)":"transparent"}}
            onClick={()=>setView(id)}>{lbl}</button>
        ))}
      </div>

      {/* CGC Priority */}
      {view === "cgc" && (
        <>
          <div style={{ background:"var(--surface2)", borderBottom:"1px solid var(--border)", padding:"10px 20px", fontSize:"0.8rem", color:"var(--muted2)" }}>
            ⚠️ <strong>Pressing rule:</strong> Every book requires pressing ($15–25) before CGC submission — except Stan Lee BP #513.
            Pressing turnaround: 4–8 weeks. Submit all simultaneously to save shipping.
          </div>
          <div className="list-view">
            {strategy.map((c, i) => {
              const isOpen = open.has(i);
              return (
                <div key={i} className={`lcard lc-cgc${isOpen?" open":""}`} onClick={()=>toggle(setOpen, i)}>
                  <div className="lcard-head">
                    <span className="lcard-date">{c.Priority}</span>
                    <span className="lcard-title">{c.Book}</span>
                    {c.ROI && <span className="lcard-right" style={{color:"var(--gold)"}}>{c.ROI}</span>}
                    {c.Cost && <span className="lcard-tag">{c.Cost}</span>}
                  </div>
                  {isOpen && (
                    <div className="lcard-expand">
                      {c.Service   && <div className="dr"><span className="dl">Service</span><span className="dv">{c.Service}</span></div>}
                      {c.Grade     && <div className="dr"><span className="dl">Grade</span><span className="dv">{c.Grade}</span></div>}
                      {c.RawValue  && <div className="dr"><span className="dl">Raw Now</span><span className="dv">{c.RawValue}</span></div>}
                      {c.CGCValue  && <div className="dr"><span className="dl">After CGC</span><span className="dv" style={{color:"var(--gold)"}}>{c.CGCValue}</span></div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Label explanation */}
          <div style={{ padding:"20px 24px 40px", display:"flex", flexWrap:"wrap", gap:16 }}>
            {[
              { color:"#d4a800", label:"🟡 YELLOW SS", desc:"CGC witness PRESENT at signing. You bring UNSIGNED book. Creator signs in front of facilitator. Max value." },
              { color:"#16a34a", label:"🟢 GREEN QUALIFIED", desc:"Your already-signed books go via CGC x JSA mail-in. JSA authenticates unwitnessed signatures. Still valuable." },
              { color:"#1d4ed8", label:"🔵 BLUE UNIVERSAL", desc:"Unsigned ungraded books. Just grade them as-is. Best for high-condition books with strong key issue status." },
              { color:"#dc2626", label:"⚠️ STAN LEE SPECIAL", desc:"DO NOT PRESS. Authenticate via PSA/DNA at NYCC first. BP #513 is your most valuable single book." },
            ].map(l => (
              <div key={l.label} style={{ flex:"1 1 240px", background:"var(--surface)", border:`1.5px solid ${l.color}40`, borderRadius:6, padding:"12px 14px" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.75rem", letterSpacing:"1.5px", color:l.color, marginBottom:4 }}>{l.label}</div>
                <div style={{ fontSize:"0.78rem", color:"var(--muted2)", lineHeight:1.5 }}>{l.desc}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Terrificon */}
      {view === "terrificon" && (
        <>
          <div style={{ background:"var(--surface2)", borderBottom:"1px solid var(--border)", padding:"10px 20px", fontSize:"0.8rem", color:"var(--muted2)" }}>
            🎪 <strong>Terrificon — Aug 7–9, 2026</strong> | Mohegan Sun, Uncasville CT |
            Hotel: Hyatt code <strong>G-TRFC</strong> |
            ⭐ <strong>Jim Lee — Saturday Aug 8 ONLY — arrive 10am sharp</strong>
          </div>
          <div className="list-view">
            {(terrificon.length > 0 ? terrificon : conBooks).map((c, i) => {
              const isOpen = openTf.has(i);
              return (
                <div key={i} className={`lcard lc-con${isOpen?" open":""}`} onClick={()=>toggle(setOpenTf, i)}>
                  <div className="lcard-head">
                    <span className="lcard-date">{c.Priority}</span>
                    <span className="lcard-title">{c.Book}</span>
                    {c.Creator && <span className="lcard-tag">{c.Creator}</span>}
                  </div>
                  {isOpen && (
                    <div className="lcard-expand">
                      {c.Goal  && <div className="dr"><span className="dl">Goal</span><span className="dv">{c.Goal}</span></div>}
                      {c.Notes && <div className="dr" style={{marginTop:6}}><span className="dl">Notes</span><span className="dv">{c.Notes}</span></div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* NYCC */}
      {view === "nycc" && (
        <>
          <div style={{ background:"var(--surface2)", borderBottom:"1px solid var(--border)", padding:"10px 20px", fontSize:"0.8rem", color:"var(--muted2)" }}>
            🏙️ <strong>NYCC — Oct 8–11, 2026</strong> | Javits Center, NYC | 20th Anniversary |
            Stan Lee authentication (PSA/DNA) + Heritage Auctions networking
          </div>
          <div className="list-view">
            {(nycc.length > 0 ? nycc : other_con).map((c, i) => {
              const isOpen = openNy.has(i);
              return (
                <div key={i} className={`lcard lc-con${isOpen?" open":""}`} onClick={()=>toggle(setOpenNy, i)}>
                  <div className="lcard-head">
                    <span className="lcard-date">{c.Priority}</span>
                    <span className="lcard-title">{c.Book}</span>
                    {c.Creator && <span className="lcard-tag">{c.Creator}</span>}
                  </div>
                  {isOpen && (
                    <div className="lcard-expand">
                      {c.Goal  && <div className="dr"><span className="dl">Goal</span><span className="dv">{c.Goal}</span></div>}
                      {c.Notes && <div className="dr" style={{marginTop:6}}><span className="dl">Notes</span><span className="dv">{c.Notes}</span></div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
