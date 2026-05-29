import { useState } from "react";

interface Signing { Status: string; Creator: string; Deadline: string; Fee: string; Books: string; Strategy: string; ExpectedValue: string; }

const signings: Signing[] = [
  { Status:"✅ SUBMITTED",   Creator:"Stan Lee — BP #513",               Deadline:"AT CGC × JSA NOW",      Fee:"$75",          Books:"Black Panther #513 (Man Without Fear) — Dynamic Forces COA included. Shipped with COA. DO NOT press. DO NOT stream or sell until graded.",  Strategy:"Already submitted to CGC × JSA. Do not press — pressing damages Dynamic Forces ink. Track status at cgccomics.com. Expected return in 3–6 months.", ExpectedValue:"$800–$1,500 authenticated" },
  { Status:"✅ SUBMITTED",   Creator:"Roy Thomas",                        Deadline:"Jul 10, 2026",          Fee:"$90/book",     Books:"Avengers #60, #87, King-Size #2, Marvel Premiere #1, Saga of the Original Human Torch #3 — 5 books submitted.",  Strategy:"Confirm CGC received the package. Track return timeline. Thomas co-created Wolverine, Vision, Carol Danvers, Adam Warlock. Expected return $820–1,630 on $485 investment.", ExpectedValue:"$820–$1,630 across all 5 books" },
  { Status:"✅ SUBMITTED",   Creator:"ASM #361 — Bagley + Sharen",        Deadline:"AT CGC × JSA NOW",      Fee:"$53",          Books:"Amazing Spider-Man #361 (1st full Carnage) — double-signed by Mark Bagley + Bob Sharen. Already shipped.",  Strategy:"Already submitted to CGC × JSA. 1st full Carnage with double creator signature. Significant provenance. Track at cgccomics.com.", ExpectedValue:"$200–$350 Yellow/Black CGC×JSA" },
  { Status:"🚨 URGENT",      Creator:"Jorge Jiménez",                     Deadline:"Jun 5, 2026 ⚠️",        Fee:"$80–100",      Books:"Batman #125 (Failsafe Part 1 — Jiménez drew it). Press FIRST, then submit.",  Strategy:"Jun 5 deadline — confirm submitted immediately. Pull from Box 43 (DC Rebirth). Press first, CGC Modern Tier. Yellow/Black CGC×JSA label (already signed).", ExpectedValue:"$120–$200 Yellow/Black CGC×JSA" },
  { Status:"⭐⭐ OPEN NOW",   Creator:"Geoff Johns + Jason Fabok",         Deadline:"Jun 26, 2026",          Fee:"$150–200",     Books:"Justice League #21 (Johns + Fabok). JSA run books with existing unwitnessed Johns sigs.",  Strategy:"Johns sig adds to existing unwitnessed VA sigs (Carl Lumbly + Phil LaMarr) = Yellow/Green combo label. Pull books, sleeve, submit before Jun 26.", ExpectedValue:"$150–$300 Yellow/Green combo label" },
  { Status:"⭐ OPEN",        Creator:"Mike Mayhew",                       Deadline:"Jul 10, 2026",          Fee:"$80",          Books:"ASM #50 Alex Ross Timeless Virgin cover — already signed (Lachima signing).",  Strategy:"Submit via CGC × JSA Yellow/Black path. Same deadline as Roy Thomas batch — combine shipping. Pull from Box 16 (Spider-Man Archive).", ExpectedValue:"$100–$200 Yellow/Black CGC×JSA" },
  { Status:"⭐ OPEN",        Creator:"Chris Claremont (Terrificon)",       Deadline:"Aug 7–9, 2026",         Fee:"Con fee",      Books:"Wolverine #8 (1982 — MUST STAY UNSIGNED). This is your #1 Terrificon book. Press before con.",  Strategy:"Bring UNSIGNED to Terrificon for Yellow SS label on-site. Press before con. Claremont is confirmed all 3 days. $500+ as Yellow SS CGC 9.8.", ExpectedValue:"$500+ Yellow SS CGC 9.8" },
  { Status:"⭐ OPEN",        Creator:"Jim Lee (Terrificon — SAT ONLY)",    Deadline:"Aug 8, 2026 10am",      Fee:"Con fee",      Books:"WildCATs #2, WildCATs #11 (re-sign for combo label). Superman Unchained #1, Batman Europa #1 (BAG FIRST — in Box 08).",  Strategy:"Jim Lee is SATURDAY ONLY. Arrive 10am sharp — his line fills immediately. Already-signed WildCATs get witnessed re-sign = Yellow/Green combo label.", ExpectedValue:"$200–$600 across Jim Lee books" },
  { Status:"⭐ OPEN",        Creator:"Declan Shalvey (Terrificon)",        Deadline:"Aug 7–9, 2026",         Fee:"Con fee",      Books:"Moon Knight Vol 6 #1–6 (all 6 issues from Box 50). Shalvey drew these books.",  Strategy:"Bring all 6 unsigned issues. Six Yellow SS signings at one table = up to $1,200 in authenticated value from books currently worth ~$25 raw each.", ExpectedValue:"Up to $1,200 for all 6 Yellow SS" },
  { Status:"⭐ OPEN",        Creator:"Walt + Louise Simonson (Terrificon)", Deadline:"Aug 7–9, 2026",        Fee:"Con fee",      Books:"X-Men Legends #4 (both Simonsons). Thor #339 (already signed — witness for combo label).",  Strategy:"Both Simonsons confirmed. X-Men Legends #4 = dual Yellow SS. Thor #339 already signed W+L = witness existing sigs for combo label.", ExpectedValue:"$100–$300 combined" },
  { Status:"⭐ OPEN",        Creator:"Ron Frenz (Terrificon)",             Deadline:"Aug 7–9, 2026",         Fee:"Con fee",      Books:"Thor #390 (Cap lifts Mjolnir KEY) + Thor #412 (1st New Warriors) — both unsigned in Box 01.",  Strategy:"Frenz confirmed. Both are KEY issues. Vintage tier CGC pricing ($70/book). Yellow SS on both. Press before con.", ExpectedValue:"$80–$200 each Yellow SS" },
  { Status:"⭐ OPEN",        Creator:"Mark Waid + Greg LaRocque (Terrificon)", Deadline:"Aug 7–9, 2026",    Fee:"Con fee",      Books:"Flash #164 (Waid's Flash launch) — currently unsigned in Box 07.",  Strategy:"Both Waid AND LaRocque confirmed. Dual Yellow SS on one book. Check condition before pressing. $80–$200 dual-signed.", ExpectedValue:"$80–$200 dual Yellow SS" },
  { Status:"🟡 WATCH",       Creator:"Brian Stelfreeze (Terrificon)",      Deadline:"Aug 7–9, 2026",         Fee:"Con fee",      Books:"Any unsigned Black Panther book — BP #1 (Coates/Stelfreeze, Box 34).",  Strategy:"Stelfreeze confirmed. Bring unsigned BP book for Yellow SS. Verify you have a clean unsigned copy in Box 34.", ExpectedValue:"$80–$150 Yellow SS" },
  { Status:"🟡 WATCH",       Creator:"Skottie Young",                      Deadline:"TBD — monitor",         Fee:"TBD",          Books:"Storm #1 (already signed by SY). FF connecting set #1–5 (for Yellow SS as a set at con).",  Strategy:"Already has SY sig on Storm #1. Monitor for CGC SS private signing. FF set could be $300+ as witnessed SS set.", ExpectedValue:"$150–$400 depending on path" },
  { Status:"🔵 BATCH",       Creator:"Yellow/Black CGC×JSA Mail-in Batch", Deadline:"Before Aug 7",          Fee:"$15–25/press + $53–70 CGC", Books:"Vision #1, Black Lightning #1, New Warriors #1, WildCATs #3, Savage Dragon #1, Mockingbird #8, NM #96, Transformers Compendium #1, Cap Carter #1, Agent Carter #1, Exiles #3, Hawkeye Freefall #1, MOS #18, MOS #19.",  Strategy:"Press ALL books first (except Stan Lee). Submit as one batch to CGC × JSA Yellow/Black Authentic Autograph label. One shipping invoice saves cost.", ExpectedValue:"$80–$300 per book authenticated" },
  { Status:"🔴 CLOSED",      Creator:"Tom King",                           Deadline:"Closed",                Fee:"N/A",          Books:"Vision #1, Supergirl: Woman of Tomorrow #1 — already signed.",  Strategy:"In the Yellow/Black CGC×JSA batch above. Press, then submit mail-in. Vision in Box 02. Supergirl in Box 37.", ExpectedValue:"$150–$300 each Yellow/Black CGC×JSA" },
  { Status:"🔴 CLOSED",      Creator:"Hayley Atwell",                      Deadline:"Closed",                Fee:"N/A",          Books:"Captain Carter #1 (personalized 'To Robert'), Agent Carter #1, Exiles #3 — all in Box 02.",  Strategy:"All three in the Yellow/Black batch. Captain Carter personalized = lower CGC value but massive Whatnot story value. Lead any Captain America-themed show with this book.", ExpectedValue:"$80–$300 combined" },
  { Status:"🔴 CLOSED",      Creator:"Mark Bagley",                        Deadline:"Closed",                Fee:"N/A",          Books:"New Warriors #1 (Bagley signed — Box 02). ASM #361 already submitted.",  Strategy:"New Warriors #1 goes in the Yellow/Black batch. Press first.", ExpectedValue:"$120–$200 New Warriors Yellow/Black" },
];

function statusColor(status: string) {
  if (status.startsWith("✅")) return "#16a34a";
  if (status.startsWith("🚨")) return "#dc2626";
  if (status.startsWith("⭐⭐")) return "#d97706";
  if (status.startsWith("⭐")) return "#d97706";
  if (status.startsWith("🟡")) return "#6366f1";
  if (status.startsWith("🔵")) return "#8b2be2";
  if (status.startsWith("🔴")) return "#9ca3af";
  return "#6b7280";
}

function statusBadge(status: string) {
  if (status.startsWith("✅")) return "SUBMITTED";
  if (status.startsWith("🚨")) return "URGENT";
  if (status.startsWith("⭐⭐")) return "OPEN NOW";
  if (status.startsWith("⭐")) return "OPEN";
  if (status.startsWith("🟡")) return "WATCH";
  if (status.startsWith("🔵")) return "BATCH";
  if (status.startsWith("🔴")) return "CLOSED";
  return "MONITOR";
}

function isClosed(status: string) {
  return status.startsWith("🔴");
}

function isSubmitted(status: string) {
  return status.startsWith("✅");
}

export default function PrivateSignings() {
  const [open,     setOpen]     = useState<Set<number>>(new Set([0, 1, 2, 3]));
  const [viewMode, setViewMode] = useState<"list"|"card">("list");
  const toggle = (i: number) => setOpen(prev => {
    const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n;
  });

  const submitted = signings.filter(s => s.Status.startsWith("✅"));
  const urgent  = signings.filter(s => s.Status.startsWith("🚨"));
  const openS   = signings.filter(s => s.Status.startsWith("⭐"));
  const watch   = signings.filter(s => s.Status.startsWith("🟡"));
  const batch   = signings.filter(s => s.Status.startsWith("🔵"));
  const closed  = signings.filter(s => s.Status.startsWith("🔴"));

  const sections = [
    { label:"✅ AT CGC — SUBMITTED",    color:"#16a34a", items: submitted },
    { label:"🚨 URGENT — ACT NOW",      color:"#dc2626", items: urgent   },
    { label:"⭐ OPEN SIGNINGS",          color:"#d97706", items: openS    },
    { label:"🔵 MAIL-IN BATCH",         color:"#8b2be2", items: batch    },
    { label:"🟡 WATCH",                 color:"#6366f1", items: watch    },
    { label:"CLOSED",                   color:"#9ca3af", items: closed   },
  ].filter(s => s.items.length > 0);

  const flatItems = [...submitted, ...urgent, ...openS, ...batch, ...watch, ...closed];

  return (
    <div>
      <div className="section-intro">
        <h2>CGC Signings — 2026</h2>
        <p>Monitor <strong>cgccomics.com/signature-series/</strong> weekly · Follow <strong>@CGCSignatureSeries</strong></p>
      </div>

      {/* Label legend */}
      <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)", padding:"10px 24px", display:"flex", gap:16, flexWrap:"wrap", fontSize:"0.72rem", color:"var(--muted2)" }}>
        <span>🟡 <strong>Yellow SS</strong> = unsigned book + witnessed signing at con → highest CGC value</span>
        <span>🟡⬛ <strong>Yellow/Black CGC×JSA</strong> = already-signed book mailed to CGC × JSA → authenticated</span>
        <span>🟡🟢 <strong>Yellow/Green combo</strong> = witnessed + unwitnessed sigs on same book</span>
        <span>🚫 <strong>Green Qualified = physical defect ONLY</strong> — do NOT use for signatures</span>
      </div>

      {/* Status summary strip */}
      <div style={{ background:"var(--surface2)", borderBottom:"1px solid var(--border)", padding:"8px 20px", display:"flex", gap:20, flexWrap:"wrap" }}>
        {[
          { val: submitted.length, lbl:"AT CGC",     color:"#16a34a" },
          { val: urgent.length,    lbl:"URGENT",      color:"#dc2626" },
          { val: openS.length,     lbl:"OPEN",        color:"#d97706" },
          { val: watch.length,     lbl:"WATCH",       color:"#6366f1" },
        ].map(s => (
          <div key={s.lbl} style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.1rem", color:s.color, letterSpacing:"1px", lineHeight:1 }}>{s.val}</div>
            <div style={{ fontSize:"0.58rem", letterSpacing:"1.5px", fontFamily:"'Bebas Neue',sans-serif", color:"var(--muted)" }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* View toggle */}
      <div style={{ display:"flex", gap:6, padding:"10px 20px 2px", alignItems:"center" }}>
        {(["list","card"] as const).map(v => (
          <button key={v} onClick={() => setViewMode(v)}
            style={{
              fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", letterSpacing:"1.5px",
              padding:"5px 14px", border:`1.5px solid ${viewMode===v?"var(--red)":"var(--border)"}`,
              background:viewMode===v?"var(--red)":"var(--surface)", color:viewMode===v?"#fff":"var(--muted2)",
              borderRadius:4, cursor:"pointer",
            }}>
            {v==="list"?"≡ List":"⊞ Cards"}
          </button>
        ))}
      </div>

      {/* List view — grouped */}
      {viewMode === "list" && (
        <div style={{ padding:"14px 16px 40px" }}>
          {sections.map(sec => (
            <div key={sec.label} style={{ marginBottom:24 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.8rem", letterSpacing:"2px", color:sec.color, marginBottom:10, borderBottom:`1.5px solid ${sec.color}22`, paddingBottom:4 }}>
                {sec.label}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {sec.items.map((s, i) => {
                  const gi = flatItems.indexOf(s);
                  const isOpen = open.has(gi);
                  const sc = statusColor(s.Status);
                  const closed_ = isClosed(s.Status);
                  const submitted_ = isSubmitted(s.Status);
                  return (
                    <div key={i}
                      onClick={() => toggle(gi)}
                      style={{
                        border:`1.5px solid ${isOpen?sc:"var(--border)"}`,
                        borderRadius:6, padding:"12px 16px",
                        background: submitted_ ? "#f0fdf4" : closed_ ? "var(--surface)" : "var(--surface)",
                        opacity: closed_ ? 0.55 : 1,
                        cursor:"pointer", transition:"all 0.15s",
                      }}
                    >
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2, flexWrap:"wrap" }}>
                            <span style={{
                              fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1.5px",
                              background:sc+"20", border:`1px solid ${sc}`, color:sc, borderRadius:3, padding:"1px 7px",
                            }}>{statusBadge(s.Status)}</span>
                            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.9rem", letterSpacing:"1px", color:"var(--text)" }}>{s.Creator}</span>
                          </div>
                          <div style={{ fontSize:"0.72rem", color:"var(--muted2)", marginTop:1 }}>
                            {s.Deadline} · {s.Fee}
                          </div>
                        </div>
                        <span style={{ fontSize:"0.62rem", color:"var(--red)", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", flexShrink:0, marginTop:2 }}>{s.ExpectedValue}</span>
                      </div>
                      {isOpen && (
                        <div style={{ marginTop:10, borderTop:"1px solid var(--border)", paddingTop:10 }}>
                          <div style={{ marginBottom:6 }}>
                            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"2px", color:"var(--muted)", marginBottom:2 }}>BOOKS</div>
                            <div style={{ fontSize:"0.82rem", color:"var(--text)", lineHeight:1.5 }}>{s.Books}</div>
                          </div>
                          <div>
                            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"2px", color:"var(--muted)", marginBottom:2 }}>STRATEGY</div>
                            <div style={{ fontSize:"0.82rem", color:"var(--muted2)", lineHeight:1.5 }}>{s.Strategy}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Card view */}
      {viewMode === "card" && (
        <div className="card-grid" style={{ padding:"16px" }}>
          {flatItems.map((s, i) => {
            const sc = statusColor(s.Status);
            const closed_ = isClosed(s.Status);
            const submitted_ = isSubmitted(s.Status);
            return (
              <div key={i} className="comic-card"
                style={{
                  borderTop:`3px solid ${sc}`,
                  opacity: closed_ ? 0.55 : 1,
                  background: submitted_ ? "#f0fdf4" : "var(--surface)",
                }}
              >
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
                  <span style={{
                    fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1.5px",
                    background:sc+"20", border:`1px solid ${sc}`, color:sc, borderRadius:3, padding:"1px 7px",
                  }}>{statusBadge(s.Status)}</span>
                  <span style={{ fontSize:"0.7rem", color:"var(--red)", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>{s.ExpectedValue}</span>
                </div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.95rem", letterSpacing:"1px", color:"var(--text)", marginBottom:2 }}>{s.Creator}</div>
                <div style={{ fontSize:"0.7rem", color:"var(--muted2)", marginBottom:6 }}>{s.Deadline} · {s.Fee}</div>
                <div style={{ fontSize:"0.78rem", color:"var(--text)", lineHeight:1.4, marginBottom:6 }}>{s.Books.substring(0, 120)}</div>
                <div style={{ fontSize:"0.75rem", color:"var(--muted2)", lineHeight:1.4 }}>{s.Strategy.substring(0, 180)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
