import { useState } from "react";

interface ShowTheme { Num: string; Title: string; Description: string; }

const shows: ShowTheme[] = [
  { Num:"1",  Title:"Black Heroes Month: Priest-Era Black Panther + Signed Books",  Description:"Anchor: Captain Carter #1 (Hayley Atwell — personalized to Robert). Supporting: Priest BP vol3 #1–10, Truth: RWB #1 (Baker remarked), Black Lightning #1. Strategy: Lead with the STORY of the Atwell signing. Emotional connection sells. Revenue target: $300–$600." },
  { Num:"2",  Title:"Batman Family: King/Snyder + Tom King Vision (Signed)",  Description:"Anchor: Vision #1 (Tom King signed). Supporting: Batman #21+#22 The Button, Batman #50 Wedding issue, Batman #125 Jiménez. Strategy: Tell the Tom King story — Vision to Batman to Heroes in Crisis. Revenue target: $250–$500." },
  { Num:"3",  Title:"Spider-Man Family + Carnage Keys",  Description:"Anchor: ASM #361 (1st Carnage — dual signed Bagley/Sharen). Supporting: Ultimate Fallout #4 Foil (1st Miles Morales), Spider-Man keys from Box 3. Strategy: Bagley + Sharen dual signature is a conversation piece. Miles Morales is the emotional modern core. Revenue target: $300–$600." },
  { Num:"4",  Title:"Captain America: Brubaker Complete + Sam Wilson Era",  Description:"Anchor: Captain America Vol5 #1 (Brubaker). Supporting: #25 Death of Cap, Winter Soldier arc, Remender run, Sam Wilson Cap. Strategy: 'The greatest Cap run ever written.' Box 13 = 223 books, 24 keys. Revenue target: $200–$450." },
  { Num:"5",  Title:"X-Men: Krakoa Era + Immortal Thor",  Description:"Anchor: House of X #1 / Powers of X #1 (both). Supporting: X-Force #1, X-Men Red, AXE: Judgment Day complete, Immortal Thor #1–25. Strategy: 'Krakoa ended. It's already history. Already collectible.' Box 35 = 205 books, 28 keys. Revenue target: $300–$600." },
  { Num:"6",  Title:"SIGNED BOOKS SPECIAL — Stories Behind the Signatures",  Description:"Anchor: Stan Lee Black Panther #513 + Hayley Atwell Captain Carter. All 48+ signed books from Box 2. Every book has a STORY. Lead with Captain Carter (personalized by Atwell). End with Stan Lee (signed in his final years). Revenue target: $500–$1,200." },
  { Num:"7",  Title:"DC Rebirth Era: Snyder Justice League + Dark Nights Metal",  Description:"Anchor: Dark Knights Metal #1 (Snyder). Supporting: Batman Who Laughs #1, Justice League #1 Snyder run, Rebirth Special #1. Strategy: 'The most ambitious DC event of the decade.' Box 11 = 95 books, 14 keys. Revenue target: $250–$500." },
  { Num:"8",  Title:"Ultimate Marvel Universe: UXM / UFF / Ultimates Complete",  Description:"Anchor: Ultimate Fallout #4 Foil (1st Miles — if not sold yet). Supporting: Ultimate X-Men full run, Ultimate Fantastic Four #1, Ultimates. Strategy: Box 18 = 165 books, 23 keys. 'The universe that created Miles Morales.' Revenue target: $200–$400." },
  { Num:"9",  Title:"Flash: Waid Era Complete (Flash #112–233)",  Description:"Anchor: The Flash #112. Supporting: Waid-era Flash complete run (Box 7 = 204 books). Strategy: 'The definitive Flash run. 204 consecutive issues from one of the greatest writers in DC history.' Revenue target: $150–$350." },
  { Num:"10", Title:"Foil Covers + Variants + Absolute Batman",  Description:"Anchor: Absolute Batman #1–8 1st prints. Supporting: All foil covers from Box 5 (Wolverine #8 variant, Daredevil foil, etc.), World's Finest foil. Strategy: 'Modern keys and 90s nostalgia — the two best moods in comics.' Revenue target: $200–$450." },
  { Num:"11", Title:"Black Panther Complete Archive: Priest / Hudlin / Coates / Ridley / Ewing",  Description:"Anchor: Black Panther vol3 #1 (Priest). Supporting: Hudlin run, Coates run, Ridley run, Ewing run. Box 34 = 246 books, 30 keys. Strategy: 'The only complete Black Panther archive you've ever seen on Whatnot.' Revenue target: $400–$900." },
  { Num:"12", Title:"Post-Terrificon Celebration Show — Best of the Collection",  Description:"Anchor: Thor #169 CGC 8.0 (Galactus origin — slabbed). Supporting: Fresh off Terrificon — newly signed books, show stories, Wolverine #8 story. Strategy: Tell the STORY of Terrificon. What happened. What you got signed. Hype builds community. Revenue target: $300–$700." },
];

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
