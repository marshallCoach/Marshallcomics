import { useState } from "react";
import { DATA3 } from "@/data/data3";

const strategy = DATA3.cgc_strategy;

// ── Section 1: Terrificon Signing Priority List (from PDF, Aug 7–9 2026) ──
const TERRIFICON_SIGNINGS = [
  { priority: "#1",   book: "Wolverine #8 (1982 — UNSIGNED)",                   box: "8",  creator: "Chris Claremont",                   goal: "Yellow SS $500+",                      note: "MUST STAY UNSIGNED",                   critical: true,  jimlee: false },
  { priority: "#2",   book: "WildC.A.T.s #2 (Jim Lee signed)",                  box: "2",  creator: "Jim Lee (SAT ONLY)",                 goal: "Re-sign → Yellow/Green combo",         note: "Signed — re-sign for witness",         critical: false, jimlee: true  },
  { priority: "#2",   book: "WildC.A.T.s #11 (Jim Lee signed)",                 box: "2",  creator: "Jim Lee (SAT ONLY)",                 goal: "Re-sign → Yellow/Green combo",         note: "Signed — re-sign for witness",         critical: false, jimlee: true  },
  { priority: "HIGH", book: "Superman Unchained #1 (UNSIGNED)",                  box: "15", creator: "Jim Lee (SAT ONLY)",                 goal: "Yellow SS $150-250",                   note: "Unbagged — bag before con",            critical: false, jimlee: true  },
  { priority: "HIGH", book: "Batman Europa #1 (UNSIGNED)",                       box: "15", creator: "Jim Lee (SAT ONLY)",                 goal: "Yellow SS $150-200",                   note: "Unbagged — bag before con",            critical: false, jimlee: true  },
  { priority: "HIGH", book: "The Mighty Thor #339 (dual signed W+L Simonson)",   box: "2",  creator: "Walt + Louise Simonson",             goal: "Re-sign → combo label",                note: "Already dual-signed",                  critical: false, jimlee: false },
  { priority: "HIGH", book: "Superman: Man of Steel #18 (triple signed)",        box: "2",  creator: "Dan Jurgens + Louise Simonson",      goal: "Witness the existing sigs",            note: "Already triple-signed",                critical: false, jimlee: false },
  { priority: "HIGH", book: "The Flash #164 (UNSIGNED)",                         box: "12", creator: "Mark Waid",                          goal: "Yellow SS — Waid's Flash launch",      note: "Check condition before pressing",      critical: false, jimlee: false },
  { priority: "HIGH", book: "The Flash #112 (UNSIGNED)",                         box: "12", creator: "Mark Waid or Greg LaRocque",         goal: "Yellow SS — Waid-era Flash key",       note: "Low grade only — assess",              critical: false, jimlee: false },
  { priority: "HIGH", book: "Hawkman (2018) #1 (UNSIGNED)",                      box: "25", creator: "Robert Venditti",                    goal: "Yellow SS — creator on own book",      note: "Press before con",                     critical: false, jimlee: false },
  { priority: "HIGH", book: "Death of Hawkman #1 (UNSIGNED)",                    box: "25", creator: "Robert Venditti",                    goal: "Yellow SS — Venditti",                 note: "Press before con",                     critical: false, jimlee: false },
  { priority: "HIGH", book: "Nightwing (Rebirth) #1 (UNSIGNED)",                 box: "25", creator: "Tim Seely",                          goal: "Yellow SS — Rebirth Nightwing creator",note: "Press before con",                     critical: false, jimlee: false },
  { priority: "HIGH", book: "Justice League International #1 (UNSIGNED)",         box: "27", creator: "Dan Jurgens",                        goal: "Yellow SS — JLI launch",               note: "Check in Box 27",                      critical: false, jimlee: false },
  { priority: "MED",  book: "Titans (2023) #1 (UNSIGNED)",                       box: "30", creator: "Nicola Scott",                       goal: "Yellow SS — Titans artist",            note: "Check condition",                      critical: false, jimlee: false },
  { priority: "MED",  book: "New Mutants #96 (triple signed)",                   box: "2",  creator: "Bob McLeod (already signed)",        goal: "Already signed — reference only",      note: "Signed Liefeld/Larsen/McLeod",         critical: false, jimlee: false },
  { priority: "MED",  book: "Batman: Long Halloween Special #1 (free)",           box: "22", creator: "Jeph Loeb",                          goal: "Yellow SS — Loeb tribute",             note: "Tim Sale's last Batman work",          critical: false, jimlee: false },
  { priority: "MED",  book: "The Mighty Thor #390 (UNSIGNED)",                   box: "2",  creator: "Ron Frenz",                          goal: "Yellow SS — Cap lifts Mjolnir",        note: "Frenz confirmed — key issue",          critical: false, jimlee: false },
  { priority: "MED",  book: "The Mighty Thor #412 (UNSIGNED)",                   box: "2",  creator: "Ron Frenz",                          goal: "Yellow SS — 1st New Warriors",         note: "Frenz confirmed — KEY issue",          critical: false, jimlee: false },
  { priority: "MED",  book: "Superman/Spider-Man #1 (UNSIGNED — Simonson cover)",box: "3",  creator: "Walt Simonson (cover)",              goal: "Yellow SS on cover artist",            note: "Simonson drew the cover",              critical: false, jimlee: false },
  { priority: "MED",  book: "Black Panther #1 (Stelfreeze — UNSIGNED)",          box: "2",  creator: "Brian Stelfreeze",                   goal: "Yellow SS — Coates/Stelfreeze BP",     note: "Check if you have this unsigned",      critical: false, jimlee: false },
  { priority: "INFO", book: "Storm #1 (SIGNED — SY)",                            box: "2",  creator: "Nicola Scott (she drew Storm)",      goal: "Witness if possible",                  note: "Already signed by SY",                 critical: false, jimlee: false },
  { priority: "INFO", book: "FF Connecting Set #1-5 (Skottie Young — UNSIGNED)", box: "8",  creator: "Skottie Young",                      goal: "5x Yellow SS as a set",                note: "All 5 at once for max value",          critical: false, jimlee: false },
];

// ── Section 2: Books to Press Before Terrificon ──
const PRESS_LIST = [
  { title: "Batman #656",                    box: "4",  path: "CGC Universal Blue — 1st Damian Wayne",      cost: "$73", value: "$350–500 CGC 9.8",  pressed: false, bagged: false },
  { title: "Batman #657",                    box: "4",  path: "CGC Universal Blue — 1st Damian as Robin",   cost: "$73", value: "$200–350 CGC 9.8",  pressed: false, bagged: false },
  { title: "Wolverine #8 (1982)",            box: "8",  path: "Terrificon SS Yellow — UNSIGNED MUST PRESS", cost: "$70", value: "$500+ Yellow SS",    pressed: false, bagged: false },
  { title: "Hawkman (2018) #1",              box: "25", path: "Venditti SS — creator at con",               cost: "$53", value: "$80–150 Yellow SS",  pressed: false, bagged: false },
  { title: "Death of Hawkman #1",            box: "25", path: "Venditti SS — creator at con",               cost: "$53", value: "$60–120 Yellow SS",  pressed: false, bagged: false },
  { title: "Nightwing (Rebirth) #1",         box: "25", path: "Seely SS — creator at con",                  cost: "$53", value: "$60–100 Yellow SS",  pressed: false, bagged: false },
  { title: "Superman Unchained #1",          box: "15", path: "Jim Lee SS — Saturday only",                 cost: "$53", value: "$150–250 Yellow SS", pressed: false, bagged: false },
  { title: "Batman Europa #1",               box: "15", path: "Jim Lee SS — Saturday only",                 cost: "$53", value: "$100–200 Yellow SS", pressed: false, bagged: false },
  { title: "The Flash #164",                 box: "12", path: "Mark Waid SS — Waid's first issue",          cost: "$53", value: "$50–100 Yellow SS",  pressed: false, bagged: false },
  { title: "Justice League Int'l #1",        box: "27", path: "Dan Jurgens SS",                             cost: "$53", value: "$60–120 Yellow SS",  pressed: false, bagged: false },
  { title: "Vision #1 (Tom King signed)",    box: "2",  path: "CGC × JSA → Green Qualified",               cost: "$53", value: "$150–300 Green",     pressed: false, bagged: false },
  { title: "Secret Wars #1 (Hickman signed)",box: "2",  path: "CGC × JSA → Green Qualified",               cost: "$53", value: "$120–250 Green",     pressed: false, bagged: false },
  { title: "ASM #361 (Bagley/Sharen signed)",box: "2",  path: "CGC × JSA → Green Qualified",               cost: "$53", value: "$200–300 Green",     pressed: false, bagged: false },
  { title: "New Warriors #1 (Bagley signed)",box: "2",  path: "CGC × JSA → Green Qualified",               cost: "$53", value: "$120–200 Green",     pressed: false, bagged: false },
  { title: "Mockingbird #8 (Jones signed)",  box: "2",  path: "CGC × JSA → Green Qualified",               cost: "$53", value: "$80–150 Green",      pressed: false, bagged: false },
];

const PRESS_TOTAL = PRESS_LIST.reduce((sum, p) => sum + parseFloat(p.cost.replace("$","")), 0);

function priorityColor(p: string) {
  if (p === "#1")     return "#dc2626";
  if (p === "#2")     return "#ea580c";
  if (p === "HIGH")   return "#d97706";
  if (p === "MED")    return "#2563eb";
  return "#6b7280";
}

function priorityBg(p: string) {
  if (p === "#1")     return "#fef2f2";
  if (p === "#2")     return "#fff7ed";
  if (p === "HIGH")   return "#fffbeb";
  if (p === "MED")    return "#eff6ff";
  return "#f9fafb";
}

type View = "cgc" | "terrificon" | "press" | "nycc";

export default function CGCStrategy() {
  const [open,   setOpen]   = useState<Set<number>>(new Set());
  const [openTf, setOpenTf] = useState<Set<number>>(new Set());
  const [view,   setView]   = useState<View>("terrificon");

  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<number>>>, i: number) =>
    setter(prev => { const n = new Set(prev); n.has(i)?n.delete(i):n.add(i); return n; });

  const jimLeeBooks = TERRIFICON_SIGNINGS.filter(s => s.jimlee);
  const topBooks    = TERRIFICON_SIGNINGS.filter(s => s.priority === "#1" || s.priority === "#2");

  return (
    <div>
      <div className="section-intro">
        <h2>CGC Strategy — Terrificon 2026</h2>
        <p>August 7–9, 2026 · Mohegan Sun, Uncasville CT · Hotel: Hyatt code <strong>G-TRFC</strong></p>
      </div>

      {/* Critical Rules banner */}
      <div style={{ background:"#fef2f2", borderBottom:"2px solid #dc2626", padding:"10px 20px 12px", fontSize:"0.8rem", color:"#7f1d1d", lineHeight:1.8 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", letterSpacing:"1.5px", color:"#dc2626", marginBottom:4 }}>⚡ CRITICAL RULES — READ BEFORE PACKING</div>
        <div>🚫 <strong>Wolverine #8:</strong> MUST REMAIN UNSIGNED — this is your $500+ Yellow SS book with Chris Claremont</div>
        <div>⏰ <strong>Jim Lee is SATURDAY AUG 8 ONLY</strong> — arrive at 10AM SHARP. His line fills immediately. ({jimLeeBooks.length} books)</div>
        <div>📋 Pre-fill ALL CGC submission forms at <strong>cgccomics.com</strong> before leaving home</div>
        <div>🛡️ Every book going to CGC must be in a mylar bag + backing board. CGC will not accept unbagged books</div>
      </div>

      {/* Sub-tabs */}
      <div style={{ background:"#0b0b0b", borderBottom:"1px solid #222", display:"flex", paddingLeft:14 }}>
        {([
          ["terrificon","🎪 Signing Priority"],
          ["press",     "🗜️ Press List"],
          ["cgc",       "📊 CGC Priority"],
          ["nycc",      "🏙️ NYCC"],
        ] as [View,string][]).map(([id,lbl])=>(
          <button key={id} className={`tab-btn${view===id?" active":""}`}
            style={{fontSize:"0.82rem", color: view===id?"#fff":"rgba(255,255,255,0.5)", borderBottomColor: view===id?"var(--red)":"transparent"}}
            onClick={()=>setView(id)}>{lbl}</button>
        ))}
      </div>

      {/* ── Terrificon Signing Priority (Section 1) ── */}
      {view === "terrificon" && (
        <>
          <div style={{ background:"var(--surface2)", borderBottom:"1px solid var(--border)", padding:"10px 20px", display:"flex", gap:24, flexWrap:"wrap" }}>
            {[
              { val: TERRIFICON_SIGNINGS.length, lbl: "Books to Bring" },
              { val: topBooks.length,            lbl: "#1 / #2 Priority" },
              { val: jimLeeBooks.length,          lbl: "Jim Lee (Sat Only)" },
              { val: TERRIFICON_SIGNINGS.filter(s=>s.priority==="HIGH").length, lbl: "High Priority" },
              { val: TERRIFICON_SIGNINGS.filter(s=>s.priority==="MED").length,  lbl: "Med Priority" },
            ].map(s=>(
              <div key={s.lbl} style={{ textAlign:"center" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.1rem", color:"var(--red)", letterSpacing:"1px" }}>{s.val}</div>
                <div style={{ fontSize:"0.6rem", letterSpacing:"1.5px", fontFamily:"'Bebas Neue',sans-serif", color:"var(--muted)" }}>{s.lbl}</div>
              </div>
            ))}
          </div>

          <div className="list-view">
            {TERRIFICON_SIGNINGS.map((s, i) => {
              const isOpen = openTf.has(i);
              const pc     = priorityColor(s.priority);
              const pb     = priorityBg(s.priority);
              return (
                <div
                  key={i}
                  className={`lcard${isOpen?" open":""}`}
                  style={{ borderLeft:`3px solid ${pc}`, background: isOpen ? pb : undefined }}
                  onClick={()=>toggle(setOpenTf, i)}
                >
                  <div className="lcard-head">
                    <span style={{
                      fontSize:"0.6rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
                      background:`${pc}18`, border:`1px solid ${pc}`, color:pc,
                      borderRadius:3, padding:"1px 7px", whiteSpace:"nowrap", flexShrink:0,
                    }}>{s.priority}</span>
                    <span className="lcard-title" style={{ fontWeight: s.priority==="HIGH" || s.priority==="#1" || s.priority==="#2" ? 600 : undefined }}>
                      {s.book}
                    </span>
                    <span style={{ fontSize:"0.7rem", color:"var(--muted)", flexShrink:0 }}>Box {s.box}</span>
                    {s.jimlee && (
                      <span style={{ fontSize:"0.6rem", background:"#d97706", color:"#fff", borderRadius:3, padding:"1px 6px", flexShrink:0, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>
                        SAT ONLY
                      </span>
                    )}
                    {s.critical && (
                      <span style={{ fontSize:"0.6rem", background:"#dc2626", color:"#fff", borderRadius:3, padding:"1px 6px", flexShrink:0, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>
                        🚫 MUST STAY UNSIGNED
                      </span>
                    )}
                  </div>
                  {!isOpen && (
                    <div style={{ fontSize:"0.78rem", color:"var(--muted2)", marginTop:3, paddingLeft:4 }}>
                      {s.creator}
                    </div>
                  )}
                  {isOpen && (
                    <div className="lcard-expand">
                      <div className="dr"><span className="dl">Creator</span><span className="dv">{s.creator}</span></div>
                      <div className="dr" style={{marginTop:6}}><span className="dl">Goal</span><span className="dv" style={{color:"var(--gold)", fontWeight:600}}>{s.goal}</span></div>
                      <div className="dr" style={{marginTop:6}}><span className="dl">Condition</span><span className="dv">{s.note}</span></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Press List (Section 2) ── */}
      {view === "press" && (
        <>
          <div style={{ background:"var(--surface2)", borderBottom:"1px solid var(--border)", padding:"10px 20px", fontSize:"0.8rem", color:"var(--muted2)" }}>
            🗜️ <strong>Must be pressed AND returned before August 7.</strong> Submit all at once to save shipping. Total pressing cost: <strong>${PRESS_TOTAL.toLocaleString()}</strong>
          </div>

          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.8rem" }}>
              <thead>
                <tr style={{ background:"var(--surface2)", borderBottom:"2px solid var(--border)" }}>
                  {["Title","Box","CGC Path","Cost","Projected Value"].map(h=>(
                    <th key={h} style={{ padding:"8px 14px", textAlign:"left", fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", letterSpacing:"1.5px", color:"var(--muted)", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PRESS_LIST.map((p, i) => {
                  const isYellow = p.path.includes("Yellow") || p.path.includes("SS");
                  const isGreen  = p.path.includes("Green");
                  const isBlue   = p.path.includes("Universal Blue");
                  const valColor = isYellow ? "#d4a800" : isGreen ? "#16a34a" : isBlue ? "#2563eb" : "var(--text)";
                  return (
                    <tr key={i} style={{ borderBottom:"1px solid var(--border)", background: i%2===0?"transparent":"var(--surface2)" }}>
                      <td style={{ padding:"9px 14px", fontWeight:600 }}>{p.title}</td>
                      <td style={{ padding:"9px 14px", color:"var(--muted)", textAlign:"center" }}>{p.box}</td>
                      <td style={{ padding:"9px 14px", color:"var(--muted2)" }}>{p.path}</td>
                      <td style={{ padding:"9px 14px", textAlign:"center", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>{p.cost}</td>
                      <td style={{ padding:"9px 14px", color:valColor, fontWeight:600 }}>{p.value}</td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop:"2px solid var(--border)", background:"var(--surface)" }}>
                  <td colSpan={3} style={{ padding:"9px 14px", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", fontSize:"0.75rem", color:"var(--muted)" }}>TOTAL — {PRESS_LIST.length} BOOKS</td>
                  <td style={{ padding:"9px 14px", textAlign:"center", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", fontWeight:700 }}>${PRESS_TOTAL}</td>
                  <td style={{ padding:"9px 14px", color:"var(--gold)", fontWeight:700 }}>$1,900–$3,750+ projected</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ padding:"20px 24px 40px", display:"flex", flexWrap:"wrap", gap:16 }}>
            {[
              { color:"#d4a800", label:"🟡 YELLOW SS",         desc:"CGC witness present at signing. Bring UNSIGNED book. Creator signs in front of facilitator. Max value." },
              { color:"#16a34a", label:"🟢 GREEN QUALIFIED",   desc:"Already-signed books go via CGC × JSA mail-in. JSA authenticates unwitnessed signatures." },
              { color:"#2563eb", label:"🔵 BLUE UNIVERSAL",    desc:"Unsigned ungraded books submitted for grade only. Best for high-condition key issues." },
            ].map(l => (
              <div key={l.label} style={{ flex:"1 1 220px", background:"var(--surface)", border:`1.5px solid ${l.color}40`, borderRadius:6, padding:"12px 14px" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.75rem", letterSpacing:"1.5px", color:l.color, marginBottom:4 }}>{l.label}</div>
                <div style={{ fontSize:"0.78rem", color:"var(--muted2)", lineHeight:1.5 }}>{l.desc}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── CGC Priority (from spreadsheet) ── */}
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
          <div style={{ padding:"20px 24px 40px", display:"flex", flexWrap:"wrap", gap:16 }}>
            {[
              { color:"#d4a800", label:"🟡 YELLOW SS",        desc:"CGC witness PRESENT at signing. You bring UNSIGNED book. Creator signs in front of facilitator. Max value." },
              { color:"#16a34a", label:"🟢 GREEN QUALIFIED",  desc:"Your already-signed books go via CGC × JSA mail-in. JSA authenticates unwitnessed signatures. Still valuable." },
              { color:"#1d4ed8", label:"🔵 BLUE UNIVERSAL",   desc:"Unsigned ungraded books. Just grade them as-is. Best for high-condition books with strong key issue status." },
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

      {/* ── NYCC ── */}
      {view === "nycc" && (
        <div style={{ padding:"40px 24px", textAlign:"center", color:"var(--muted2)" }}>
          <div style={{ fontSize:"2rem", marginBottom:12 }}>🏙️</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.1rem", letterSpacing:"2px", color:"var(--text)", marginBottom:8 }}>NYCC — Oct 8–11, 2026</div>
          <div style={{ fontSize:"0.85rem", lineHeight:1.8 }}>
            Javits Center, NYC · 20th Anniversary<br/>
            Stan Lee authentication (PSA/DNA) · Heritage Auctions networking<br/>
            <strong style={{color:"var(--red)"}}>DO NOT PRESS Stan Lee BP #513</strong> — authenticate via PSA/DNA at NYCC first
          </div>
        </div>
      )}
    </div>
  );
}
