import { useState } from "react";
import { DATA3 } from "@/data/data3";

const shows = DATA3.show_themes;

export default function ShowPlanner() {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setOpen(prev => {
    const n = new Set(prev); n.has(i)?n.delete(i):n.add(i); return n;
  });

  return (
    <div>
      <div className="section-intro">
        <h2>Whatnot Show Planner — 2026</h2>
        <p>12 themed show concepts based on your collection. Every show has a recommended anchor book, mix strategy, and Whatnot story pitch. Revenue target: $9,000–$18,000 for the year.</p>
      </div>

      <div style={{ background:"var(--surface2)", borderBottom:"1px solid var(--border)", padding:"10px 20px", fontSize:"0.8rem", color:"var(--muted2)" }}>
        📅 Wednesday shows · Juneteenth Special Jun 19 AM · Terrificon Aug 7–9 · NYCC Oct 8–11 · 31 scheduled events · 12 themed concepts
      </div>

      <div className="list-view">
        {shows.map((s, i) => {
          const isOpen = open.has(i);
          return (
            <div key={i} className={`lcard lc-whatnot${isOpen?" open":""}`} onClick={()=>toggle(i)}>
              <div className="lcard-head">
                <span className="lcard-date">Show {s.Num}</span>
                <span className="lcard-title">{s.Title}</span>
              </div>
              {isOpen && (
                <div className="lcard-expand">
                  <div style={{ fontSize:"0.82rem", color:"var(--text2)", lineHeight:1.7, whiteSpace:"pre-wrap" }}>
                    {s.Description}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Revenue guide */}
      <div style={{ margin:"24px 20px 40px", padding:"16px 20px", background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:8 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", letterSpacing:"1.5px", color:"var(--red)", marginBottom:8 }}>
          WHATNOT SHOW STRATEGY PRINCIPLES
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:14, fontSize:"0.78rem", color:"var(--muted2)", lineHeight:1.6 }}>
          {[
            { h:"Anchor + Fillers", t:"Every show: 1–2 anchor books (tell a story) + 10–20 fillers to keep momentum. Never start with your best book." },
            { h:"Signed Books", t:"Lead with the STORY of the signing, not just the book. 'Hayley Atwell signed this to Robert' = emotional connection = higher bids." },
            { h:"Price Architecture", t:"Start at $1 for fillers, build to anchor. End-of-show reveals drive the highest bids. Keep audience for 90–120 min." },
            { h:"Whatnot-specific wins", t:"MCU fans cross over to comics. Themed shows outperform mixed shows. Repeat buyers build loyalty over a season of shows." },
          ].map(p => (
            <div key={p.h} style={{ flex:"1 1 220px" }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", letterSpacing:"1px", color:"var(--text)", marginBottom:3 }}>{p.h}</div>
              <div>{p.t}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
