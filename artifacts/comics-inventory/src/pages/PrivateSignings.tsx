import { useState } from "react";

interface Signing { Status: string; Creator: string; Deadline: string; Fee: string; Books: string; Strategy: string; ExpectedValue: string; }

const signings: Signing[] = [
  { Status:"🚨 URGENT",    Creator:"Jorge Jiménez",               Deadline:"Jun 5, 2026 ⚠️",  Fee:"$80–100",      Books:"Batman #125 (Failsafe Part 1 — Jiménez drew it). Press FIRST, then submit.",  Strategy:"Press immediately. Submit CGC Express. Green Qualified label (already signed — mailed to CGC × JSA).",  ExpectedValue:"$120–$200 Green Qualified" },
  { Status:"⭐⭐ OPEN NOW", Creator:"Geoff Johns + Jason Fabok",    Deadline:"Jun 26, 2026",    Fee:"$150–200",     Books:"Justice League #21 (Johns + Fabok). JSA books with existing unwitnessed Johns sigs.",  Strategy:"Johns sig adds to existing unwitnessed VA sigs = yellow/green combo label. Pull books, sleeve, submit.",  ExpectedValue:"$150–$300 Green or combo label" },
  { Status:"⭐⭐ OPEN NOW", Creator:"Roy Thomas",                   Deadline:"Jul 10, 2026",    Fee:"$90/book",     Books:"Avengers #60, #87, King-Size #2, Marvel Premiere #1, Saga Human Torch #3. Submit all 5.",  Strategy:"Thomas co-created Wolverine, Vision, Carol Danvers, Adam Warlock. High ROI. Submit same batch as Mayhew.",  ExpectedValue:"$820–$1,630 across all 5 books" },
  { Status:"⭐ OPEN",       Creator:"Mike Mayhew",                 Deadline:"Jul 10, 2026",    Fee:"$80",          Books:"ASM #50 Alex Ross Timeless Virgin cover — already signed. Submit for Green Qualified.",  Strategy:"Submit via CGC × JSA Green Qualified path. Same deadline as Roy Thomas — combine shipping.",  ExpectedValue:"$100–$200 Green Qualified" },
  { Status:"⭐ OPEN",       Creator:"Chris Claremont (Terrificon)", Deadline:"Aug 7–9, 2026",   Fee:"Con fee",      Books:"Wolverine #8 (1982 — MUST STAY UNSIGNED). Submit for Yellow SS on-site at Terrificon.",  Strategy:"Bring UNSIGNED to Terrificon for Yellow SS label. Priority #1. Press before con. $500+ as Yellow SS CGC 9.8.",  ExpectedValue:"$500+ Yellow SS CGC 9.8" },
  { Status:"⭐ OPEN",       Creator:"Jim Lee (Terrificon — SAT ONLY)", Deadline:"Aug 8, 2026", Fee:"Con fee",      Books:"WildCATs #2, WildCATs #11 (re-sign for combo label). Superman Unchained #1, Batman Europa #1.",  Strategy:"Jim Lee is SATURDAY ONLY. Arrive 10am. Already-signed WildCATs get witnessed re-sign for combo label.",  ExpectedValue:"$200–$500 across all Jim Lee books" },
  { Status:"🟡 WATCH",      Creator:"Stan Lee (PSA/DNA — NYCC)",    Deadline:"Oct 8–11, 2026",  Fee:"PSA table fee", Books:"Black Panther #513 (Stan Lee signed — NEVER PRESS). Bring in hard case for PSA/DNA authentication.",  Strategy:"Authenticate via PSA/DNA at NYCC first. NEVER press or submit to CGC before authentication. Book PSA/DNA appointment.",  ExpectedValue:"$800–$1,500 authenticated" },
  { Status:"🟡 WATCH",      Creator:"Skottie Young",                Deadline:"TBD — monitor",   Fee:"TBD",          Books:"Storm #1 (already signed by SY). FF connecting set #1–5 (for Yellow SS as a set at con).",  Strategy:"Already has SY sig on Storm #1. Monitor for CGC SS private signing. FF set could be $300+ as witnessed SS set.",  ExpectedValue:"$150–$400 depending on path" },
  { Status:"🔴 CLOSED",     Creator:"Tom King",                    Deadline:"Closed",          Fee:"N/A",          Books:"Vision #1, Batman #1 (Snyder/Capullo), Heroes in Crisis #1 — all already signed.",  Strategy:"Already signed. Submit via CGC × JSA Green Qualified path in the next press batch. Don't miss Terrificon batch.",  ExpectedValue:"$150–$350 Green Qualified each" },
  { Status:"🔴 CLOSED",     Creator:"Hayley Atwell",               Deadline:"Closed",          Fee:"N/A",          Books:"Captain Carter #1 (personalized 'To Robert' by Atwell at private signing).",  Strategy:"Personalized = lower CGC value but huge emotional/story value for Whatnot. Lead Show 1 with the story.",  ExpectedValue:"$80–$150 personalized (story value = priceless)" },
  { Status:"🔴 CLOSED",     Creator:"Mark Bagley + Saviuk",        Deadline:"Closed",          Fee:"N/A",          Books:"ASM #361 (1st Carnage — dual signed Bagley + Sharen). New Warriors #1. Mockingbird #8.",  Strategy:"Submit all three in the same press batch. Green Qualified. ASM #361 is the anchor.",  ExpectedValue:"$200–$500 across all Bagley books" },
];

function statusColor(status: string) {
  if (status.startsWith("🚨")) return "#dc2626";
  if (status.startsWith("⭐⭐")) return "#d97706";
  if (status.startsWith("⭐")) return "#d97706";
  if (status.startsWith("🟡")) return "#6366f1";
  if (status.startsWith("🔴")) return "#9ca3af";
  return "#6b7280";
}

function statusBadge(status: string) {
  if (status.startsWith("🚨")) return "URGENT";
  if (status.startsWith("⭐⭐")) return "OPEN NOW";
  if (status.startsWith("⭐")) return "OPEN";
  if (status.startsWith("🟡")) return "WATCH";
  if (status.startsWith("🔴")) return "CLOSED";
  return "MONITOR";
}

function isClosed(status: string) {
  return status.startsWith("🔴");
}

export default function PrivateSignings() {
  const [open, setOpen] = useState<Set<number>>(new Set([0, 1]));
  const toggle = (i: number) => setOpen(prev => {
    const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n;
  });

  const urgent  = signings.filter(s => s.Status.startsWith("🚨"));
  const open_   = signings.filter(s => s.Status.startsWith("⭐"));
  const watch   = signings.filter(s => s.Status.startsWith("🟡"));
  const closed  = signings.filter(s => s.Status.startsWith("🔴"));

  return (
    <div>
      <div className="section-intro">
        <h2>CGC Private Signings — 2026</h2>
        <p>Monitor <strong>cgccomics.com/signature-series/</strong> weekly · Follow <strong>@CGCSignatureSeries</strong> on Instagram &amp; TikTok</p>
      </div>

      {/* Legend */}
      <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)", padding:"10px 24px", display:"flex", gap:16, flexWrap:"wrap", fontSize:"0.72rem", color:"var(--muted2)" }}>
        <span>🟡 <strong>Yellow SS</strong> = unsigned book + witnessed signing at show → highest CGC value</span>
        <span>🟢 <strong>Green Qualified</strong> = already-signed book mailed to CGC × JSA → authenticated</span>
        <span>⚠️ <strong>Stan Lee</strong> = authenticate via PSA/DNA at NYCC — do NOT press first</span>
      </div>

      {/* Urgent banner */}
      {urgent.length > 0 && (
        <div style={{ background:"#fef2f2", borderBottom:"2px solid #dc2626", padding:"10px 24px", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.8rem", letterSpacing:"1.5px", color:"#dc2626" }}>⚡ ACTION REQUIRED</span>
          <span style={{ fontSize:"0.78rem", color:"#7f1d1d" }}>
            {urgent.map(s => <strong key={s.Creator}>{s.Creator} ({s.Deadline.replace(' ⚠️','')}) </strong>)}
            — submit books immediately
          </span>
        </div>
      )}

      <div className="list-view">
        {signings.map((s, i) => {
          const isOpen   = open.has(i);
          const color    = statusColor(s.Status);
          const badge    = statusBadge(s.Status);
          const closed_  = isClosed(s.Status);

          return (
            <div
              key={i}
              className={`lcard${isOpen ? " open" : ""}`}
              style={{ borderLeft:`3px solid ${color}`, opacity: closed_ ? 0.55 : 1 }}
              onClick={() => toggle(i)}
            >
              <div className="lcard-head">
                <span style={{
                  fontSize:"0.6rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
                  background:`${color}18`, border:`1px solid ${color}`, color,
                  borderRadius:3, padding:"1px 7px", whiteSpace:"nowrap", flexShrink:0,
                }}>{badge}</span>

                <span className="lcard-title">{s.Creator}</span>

                {s.Fee && !closed_ && (
                  <span className="lcard-tag">{s.Fee}</span>
                )}

                <span className="lcard-right" style={{ color, fontSize:"0.72rem" }}>
                  {s.Deadline.replace(' ⚠️','')}
                </span>
              </div>

              {s.Books && !isOpen && (
                <div style={{ fontSize:"0.78rem", color:"var(--muted2)", marginTop:4, paddingLeft:4 }}>
                  {s.Books.substring(0, 140)}{s.Books.length > 140 ? "…" : ""}
                </div>
              )}

              {isOpen && (
                <div className="lcard-expand">
                  {s.Books && (
                    <div className="dr">
                      <span className="dl">Books to Send</span>
                      <span className="dv">{s.Books}</span>
                    </div>
                  )}
                  {s.Strategy && (
                    <div className="dr" style={{ marginTop:8 }}>
                      <span className="dl">Strategy</span>
                      <span className="dv">{s.Strategy}</span>
                    </div>
                  )}
                  {s.ExpectedValue && (
                    <div className="dr" style={{ marginTop:6 }}>
                      <span className="dl">Est. Value</span>
                      <span className="dv" style={{ color:"var(--green-text)", fontWeight:600 }}>{s.ExpectedValue}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Stats footer */}
      <div style={{ margin:"24px 20px 12px", display:"flex", gap:20, flexWrap:"wrap", fontSize:"0.75rem", color:"var(--muted2)" }}>
        {[
          { n:urgent.length, lbl:"Urgent — Submit Now", c:"#dc2626" },
          { n:open_.length,  lbl:"Open — Submit This Week", c:"#d97706" },
          { n:watch.length,  lbl:"Watch — Not Yet Announced", c:"#6366f1" },
          { n:closed.length, lbl:"Closed — Next Round", c:"#9ca3af" },
        ].map(s=>(
          <div key={s.lbl} style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem", color:s.c }}>{s.n}</span>
            <span>{s.lbl}</span>
          </div>
        ))}
      </div>

      {/* Pressing batch — exact Section 2 from Terrificon checklist PDF */}
      <div style={{ margin:"12px 20px 40px", padding:"16px 20px", background:"#fff8e0", border:"1.5px solid #d4a800", borderRadius:8 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", letterSpacing:"1.5px", color:"#8a6000", marginBottom:10 }}>
          🗜️ PRESS LIST — Must Be Pressed &amp; Returned Before Aug 7
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:"6px 20px", fontSize:"0.78rem", color:"#6a4800", lineHeight:1.6 }}>
          {[
            { t:"Batman #656",                     b:"Box 4",  v:"$350–500 CGC 9.8",  c:"$20" },
            { t:"Batman #657",                     b:"Box 4",  v:"$200–350 CGC 9.8",  c:"$20" },
            { t:"Wolverine #8 (1982 — UNSIGNED)",  b:"Box 8",  v:"$500+ Yellow SS",   c:"$20" },
            { t:"Hawkman (2018) #1",               b:"Box 25", v:"$80–150 Yellow SS", c:"$20" },
            { t:"Death of Hawkman #1",             b:"Box 25", v:"$60–120 Yellow SS", c:"$20" },
            { t:"Nightwing (Rebirth) #1",          b:"Box 25", v:"$60–100 Yellow SS", c:"$20" },
            { t:"Superman Unchained #1",           b:"Box 15", v:"$150–250 Yellow SS",c:"$20" },
            { t:"Batman Europa #1",                b:"Box 15", v:"$100–200 Yellow SS", c:"$20" },
            { t:"The Flash #164",                  b:"Box 12", v:"$50–100 Yellow SS", c:"$20" },
            { t:"Justice League Int'l #1",         b:"Box 27", v:"$60–120 Yellow SS", c:"$20" },
            { t:"Vision #1 (Tom King signed)",     b:"Box 2",  v:"$150–300 Green",    c:"$20" },
            { t:"Secret Wars #1 (Hickman signed)", b:"Box 2",  v:"$120–250 Green",    c:"$20" },
            { t:"ASM #361 (Bagley/Sharen signed)", b:"Box 2",  v:"$200–300 Green",    c:"$20" },
            { t:"New Warriors #1 (Bagley signed)", b:"Box 2",  v:"$120–200 Green",    c:"$20" },
            { t:"Mockingbird #8 (Jones signed)",   b:"Box 2",  v:"$80–150 Green",     c:"$20" },
          ].map(p => (
            <div key={p.t} style={{ display:"flex", justifyContent:"space-between", gap:8, borderBottom:"1px dotted #e8c84080", paddingBottom:2 }}>
              <span><strong>{p.t}</strong> <span style={{color:"#a07000", fontSize:"0.72rem"}}>· {p.b}</span></span>
              <span style={{ whiteSpace:"nowrap", color:"#8a6000" }}>{p.c} → <span style={{fontWeight:600}}>{p.v}</span></span>
            </div>
          ))}
        </div>
        <div style={{ marginTop:10, fontSize:"0.75rem", color:"#8a6000", lineHeight:1.6, borderTop:"1px solid #e8c840aa", paddingTop:8 }}>
          15 books · Total pressing cost: <strong>$300</strong> ($20/book) · Turnaround: 4–8 weeks · Submit all at once to save shipping ·{" "}
          <strong>DO NOT PRESS: Stan Lee BP #513</strong> (authenticate via PSA/DNA at NYCC first)
        </div>
      </div>
    </div>
  );
}
