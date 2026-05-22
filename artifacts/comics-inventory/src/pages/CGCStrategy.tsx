import { useState, useEffect, useRef } from "react";

// ── CGC BOOKS — corrected data model (press + CGC split) ──────────────────────
interface CgcBook {
  priority: number; tier: "critical" | "high" | "medium";
  book: string; box: number; labelType: string;
  pressedCost: number; cgcCost: number; totalCost: number;
  rawNM: number; projectedLow: number; projectedHigh: number;
  roiMultiple: string; status: string; note: string;
  terrificon?: boolean; doNotPress?: boolean; alert?: string;
}

const CGC_BOOKS: CgcBook[] = [
  { priority:1,  tier:"critical", book:"Wolverine #8 (1982) — UNSIGNED",                        box:5,  labelType:"Yellow SS (Terrificon — Claremont)",         pressedCost:20, cgcCost:70, totalCost:90,  rawNM:60,  projectedLow:500, projectedHigh:700,  roiMultiple:"5.6x–7.8x", status:"Not Started", note:"DO NOT SUBMIT pre-con. Press only. Claremont signs at Terrificon Aug 8 in front of CGC witness.", terrificon:true },
  { priority:2,  tier:"critical", book:"Batman #656 (1st full Damian Wayne)",                    box:4,  labelType:"Blue Universal",                             pressedCost:20, cgcCost:53, totalCost:73,  rawNM:120, projectedLow:350, projectedHigh:500,  roiMultiple:"4.8x–6.8x", status:"Not Started", note:"Best single-book ROI in collection. Press + submit immediately." },
  { priority:3,  tier:"critical", book:"Batman #657 (1st Damian as Robin)",                      box:4,  labelType:"Blue Universal",                             pressedCost:20, cgcCost:53, totalCost:73,  rawNM:80,  projectedLow:200, projectedHigh:350,  roiMultiple:"2.7x–4.8x", status:"Not Started", note:"Always submit with #656." },
  { priority:4,  tier:"critical", book:"Stan Lee BP #513 (SIGNED)",                              box:2,  labelType:"Green Qualified (PSA/DNA auth first)",        pressedCost:0,  cgcCost:75, totalCost:75,  rawNM:300, projectedLow:800, projectedHigh:1500, roiMultiple:"10.7x–20x", status:"Not Started", note:"DO NOT PRESS — pressing damages signature ink. PSA/DNA at NYCC Oct, then CGC × JSA.", doNotPress:true, alert:"DO NOT PRESS" },
  { priority:5,  tier:"high",     book:"Vision #1 (Tom King signed)",                            box:2,  labelType:"Green Qualified (CGC × JSA)",                pressedCost:20, cgcCost:53, totalCost:73,  rawNM:150, projectedLow:150, projectedHigh:300,  roiMultiple:"2.1x–4.1x", status:"Not Started", note:"Press then CGC × JSA mail-in. Tom King signature authenticated." },
  { priority:6,  tier:"high",     book:"Secret Wars #1 (Hickman signed)",                        box:2,  labelType:"Green Qualified (CGC × JSA)",                pressedCost:20, cgcCost:53, totalCost:73,  rawNM:90,  projectedLow:120, projectedHigh:250,  roiMultiple:"1.6x–3.4x", status:"Not Started", note:"Press then CGC × JSA mail-in." },
  { priority:7,  tier:"high",     book:"ASM #361 (Bagley/Sharen — 1st Carnage)",                 box:2,  labelType:"Green Qualified (CGC × JSA)",                pressedCost:20, cgcCost:53, totalCost:73,  rawNM:100, projectedLow:200, projectedHigh:300,  roiMultiple:"2.7x–4.1x", status:"Not Started", note:"1st Carnage with double creator signature. Significant provenance." },
  { priority:8,  tier:"high",     book:"Black Lightning #1 (Tony Isabella signed)",               box:2,  labelType:"Green Qualified (CGC × JSA)",                pressedCost:20, cgcCost:70, totalCost:90,  rawNM:175, projectedLow:200, projectedHigh:500,  roiMultiple:"2.2x–5.6x", status:"Not Started", note:"Creator on first appearance. Vintage tier pricing." },
  { priority:9,  tier:"high",     book:"New Warriors #1 (Bagley signed)",                        box:2,  labelType:"Green Qualified (CGC × JSA)",                pressedCost:20, cgcCost:53, totalCost:73,  rawNM:80,  projectedLow:120, projectedHigh:200,  roiMultiple:"1.6x–2.7x", status:"Not Started", note:"Bagley's breakthrough book." },
  { priority:10, tier:"high",     book:"WildCATs #2 (Jim Lee signed)",                           box:2,  labelType:"Yellow/Green Combo (Terrificon re-sign)",     pressedCost:20, cgcCost:53, totalCost:73,  rawNM:115, projectedLow:150, projectedHigh:250,  roiMultiple:"2.1x–3.4x", status:"Not Started", note:"Re-sign at Terrificon in front of witness = Yellow/Green combo label.", terrificon:true },
  { priority:11, tier:"high",     book:"Mockingbird #8 (Joëlle Jones signed)",                   box:2,  labelType:"Green Qualified (CGC × JSA)",                pressedCost:20, cgcCost:53, totalCost:73,  rawNM:70,  projectedLow:80,  projectedHigh:150,  roiMultiple:"1.1x–2.1x", status:"Not Started", note:"Feminist agenda cover. Jones signature authenticated." },
  { priority:12, tier:"high",     book:"Flash #164 (UNSIGNED — Waid + LaRocque)",                box:7,  labelType:"Yellow SS (Terrificon dual signing)",         pressedCost:20, cgcCost:53, totalCost:73,  rawNM:12,  projectedLow:80,  projectedHigh:200,  roiMultiple:"1.1x–2.7x", status:"Not Started", note:"Mark Waid AND Greg LaRocque BOTH confirmed at Terrificon. Dual Yellow SS on first issue of Waid Flash run.", terrificon:true },
  { priority:13, tier:"high",     book:"Hawkman #1 (UNSIGNED — Venditti)",                       box:15, labelType:"Yellow SS (Terrificon)",                     pressedCost:20, cgcCost:53, totalCost:73,  rawNM:10,  projectedLow:80,  projectedHigh:150,  roiMultiple:"1.1x–2.1x", status:"Not Started", note:"Robert Venditti confirmed. Creator on his own book.", terrificon:true },
  { priority:14, tier:"high",     book:"Superman Unchained #1 (UNSIGNED) — UNBAGGED",            box:8,  labelType:"Yellow SS (Jim Lee SAT)",                    pressedCost:20, cgcCost:53, totalCost:73,  rawNM:20,  projectedLow:150, projectedHigh:250,  roiMultiple:"2.1x–3.4x", status:"Not Started", note:"BAG FIRST — currently unbagged in Box 08. Jim Lee Saturday only. 10am sharp.", terrificon:true, alert:"BAG FIRST" },
  { priority:15, tier:"high",     book:"Batman Europa #1 (UNSIGNED) — UNBAGGED",                 box:8,  labelType:"Yellow SS (Jim Lee SAT)",                    pressedCost:20, cgcCost:53, totalCost:73,  rawNM:25,  projectedLow:100, projectedHigh:200,  roiMultiple:"1.4x–2.7x", status:"Not Started", note:"BAG FIRST — currently unbagged. Jim Lee Saturday only.", terrificon:true, alert:"BAG FIRST" },
  { priority:16, tier:"high",     book:"Thor #390 (UNSIGNED — Cap lifts Mjolnir KEY)",           box:5,  labelType:"Yellow SS (Terrificon — Ron Frenz)",         pressedCost:20, cgcCost:70, totalCost:90,  rawNM:20,  projectedLow:100, projectedHigh:200,  roiMultiple:"1.1x–2.2x", status:"Not Started", note:"Ron Frenz confirmed at Terrificon. KEY issue. Vintage tier.", terrificon:true },
  { priority:17, tier:"high",     book:"Thor #412 (UNSIGNED — 1st New Warriors KEY)",            box:5,  labelType:"Yellow SS (Terrificon — Ron Frenz)",         pressedCost:20, cgcCost:70, totalCost:90,  rawNM:30,  projectedLow:80,  projectedHigh:150,  roiMultiple:"0.9x–1.7x", status:"Not Started", note:"Ron Frenz confirmed. 1st New Warriors. Vintage tier.", terrificon:true },
  { priority:18, tier:"high",     book:"X-Men Legends #4 (BOTH Simonsons — UNSIGNED)",           box:41, labelType:"Yellow SS (Terrificon dual — W+L Simonson)", pressedCost:20, cgcCost:53, totalCost:73,  rawNM:8,   projectedLow:80,  projectedHigh:150,  roiMultiple:"1.1x–2.1x", status:"Not Started", note:"Louise Simonson (writer) AND Walter Simonson (artist) BOTH confirmed. Dual Yellow SS.", terrificon:true },
  { priority:19, tier:"medium",   book:"House of X #1 (Hickman/Larraz)",                         box:35, labelType:"Blue Universal",                             pressedCost:20, cgcCost:53, totalCost:73,  rawNM:40,  projectedLow:80,  projectedHigh:150,  roiMultiple:"1.1x–2.1x", status:"Not Started", note:"Assess condition first. Modern tier." },
  { priority:20, tier:"medium",   book:"Immortal Iron Fist #1 (Brubaker/Aja)",                   box:42, labelType:"Blue Universal",                             pressedCost:20, cgcCost:53, totalCost:73,  rawNM:18,  projectedLow:80,  projectedHigh:150,  roiMultiple:"1.1x–2.1x", status:"Not Started", note:"Landmark Iron Fist relaunch." },
  { priority:21, tier:"medium",   book:"Paper Girls #1 (Cliff Chiang SIGNED — to Robert)",       box:38, labelType:"Green Qualified (CGC × JSA)",                pressedCost:20, cgcCost:53, totalCost:73,  rawNM:30,  projectedLow:100, projectedHigh:200,  roiMultiple:"1.4x–2.7x", status:"Not Started", note:"Personalized to Robert by Cliff Chiang. BKV/Chiang Image breakout." },
  { priority:22, tier:"medium",   book:"Sandman: Overture #1 (Gaiman/JH Williams III)",          box:38, labelType:"Blue Universal",                             pressedCost:20, cgcCost:53, totalCost:73,  rawNM:40,  projectedLow:80,  projectedHigh:150,  roiMultiple:"1.1x–2.1x", status:"Not Started", note:"Gaiman returns to Sandman. JH Williams III art." },
  { priority:23, tier:"medium",   book:"ASM #27 (Dan Slott SIGNED)",                             box:42, labelType:"Green Qualified (CGC × JSA)",                pressedCost:20, cgcCost:53, totalCost:73,  rawNM:10,  projectedLow:40,  projectedHigh:80,   roiMultiple:"0.5x–1.1x", status:"Not Started", note:"Newly found signed book. Dan Slott signature. CGC × JSA." },
];

// Computed totals from data
const pressableBooks      = CGC_BOOKS.filter(b => b.pressedCost > 0);
const totalPressInvest    = pressableBooks.length * 20;
const totalCGCInvest      = CGC_BOOKS.reduce((s, b) => s + b.cgcCost, 0);
const totalAllIn          = CGC_BOOKS.reduce((s, b) => s + b.totalCost, 0);
const projReturnLow       = CGC_BOOKS.reduce((s, b) => s + b.projectedLow, 0);
const projReturnHigh      = CGC_BOOKS.reduce((s, b) => s + b.projectedHigh, 0);
const netGainLow          = projReturnLow - totalAllIn;
const netGainHigh         = projReturnHigh - totalAllIn;

// ── Terrificon Signing Priority ───────────────────────────────────────────────
const TERRIFICON_SIGNINGS = [
  { priority: "#1",   book: "Wolverine #8 (1982)",                               box: "8",  creator: "Chris Claremont",                   goal: "Yellow SS $500+",                      note: "MUST STAY UNSIGNED — do not sign before con", critical: true,  jimlee: false, alreadySigned: false },
  { priority: "#2",   book: "WildC.A.T.s #2",                                    box: "2",  creator: "Jim Lee (SAT ONLY)",                 goal: "Re-sign → Yellow/Green combo label",   note: "Already Jim Lee signed — get witnessed re-sign for combo label", critical: false, jimlee: true, alreadySigned: true  },
  { priority: "#2",   book: "WildC.A.T.s #11",                                   box: "2",  creator: "Jim Lee (SAT ONLY)",                 goal: "Re-sign → Yellow/Green combo label",   note: "Already Jim Lee signed — get witnessed re-sign for combo label", critical: false, jimlee: true, alreadySigned: true  },
  { priority: "HIGH", book: "Superman Unchained #1",                              box: "15", creator: "Jim Lee (SAT ONLY)",                 goal: "Yellow SS $150–250",                   note: "Unbagged — bag before con",            critical: false, jimlee: true, alreadySigned: false },
  { priority: "HIGH", book: "Batman Europa #1",                                   box: "15", creator: "Jim Lee (SAT ONLY)",                 goal: "Yellow SS $150–200",                   note: "Unbagged — bag before con",            critical: false, jimlee: true, alreadySigned: false },
  { priority: "HIGH", book: "The Mighty Thor #339",                               box: "2",  creator: "Walt + Louise Simonson",             goal: "Witness existing sigs → combo label",  note: "Already dual-signed W+L Simonson",     critical: false, jimlee: false, alreadySigned: true  },
  { priority: "HIGH", book: "Superman: Man of Steel #18",                         box: "2",  creator: "Dan Jurgens + Louise Simonson",      goal: "Witness the existing sigs",            note: "Already triple-signed",                critical: false, jimlee: false, alreadySigned: true  },
  { priority: "HIGH", book: "The Flash #164",                                     box: "12", creator: "Mark Waid",                          goal: "Yellow SS — Waid's Flash launch",      note: "Check condition before pressing",      critical: false, jimlee: false, alreadySigned: false },
  { priority: "HIGH", book: "The Flash #112",                                     box: "12", creator: "Mark Waid or Greg LaRocque",         goal: "Yellow SS — Waid-era Flash key",       note: "Low grade only — assess first",        critical: false, jimlee: false, alreadySigned: false },
  { priority: "HIGH", book: "Hawkman (2018) #1",                                  box: "25", creator: "Robert Venditti",                    goal: "Yellow SS — creator on own book",      note: "Press before con",                     critical: false, jimlee: false, alreadySigned: false },
  { priority: "HIGH", book: "Death of Hawkman #1",                                box: "25", creator: "Robert Venditti",                    goal: "Yellow SS — Venditti",                 note: "Press before con",                     critical: false, jimlee: false, alreadySigned: false },
  { priority: "HIGH", book: "Nightwing (Rebirth) #1",                             box: "25", creator: "Tim Seely",                          goal: "Yellow SS — Rebirth Nightwing creator",note: "Press before con",                     critical: false, jimlee: false, alreadySigned: false },
  { priority: "HIGH", book: "Justice League International #1",                    box: "27", creator: "Dan Jurgens",                        goal: "Yellow SS — JLI launch",               note: "Check in Box 27",                      critical: false, jimlee: false, alreadySigned: false },
  { priority: "MED",  book: "Titans (2023) #1",                                   box: "30", creator: "Nicola Scott",                       goal: "Yellow SS — Titans artist",            note: "Check condition",                      critical: false, jimlee: false, alreadySigned: false },
  { priority: "MED",  book: "New Mutants #96",                                    box: "2",  creator: "Bob McLeod",                         goal: "Witness existing sigs → combo label",  note: "Already signed Liefeld/Larsen/McLeod", critical: false, jimlee: false, alreadySigned: true  },
  { priority: "MED",  book: "Batman: Long Halloween Special #1",                  box: "22", creator: "Jeph Loeb",                          goal: "Yellow SS — Loeb tribute",             note: "Tim Sale's last Batman work",          critical: false, jimlee: false, alreadySigned: false },
  { priority: "MED",  book: "The Mighty Thor #390",                               box: "2",  creator: "Ron Frenz",                          goal: "Yellow SS — Cap lifts Mjolnir",        note: "Frenz confirmed — key issue",          critical: false, jimlee: false, alreadySigned: false },
  { priority: "MED",  book: "The Mighty Thor #412",                               box: "2",  creator: "Ron Frenz",                          goal: "Yellow SS — 1st New Warriors",         note: "Frenz confirmed — KEY issue",          critical: false, jimlee: false, alreadySigned: false },
  { priority: "MED",  book: "Superman/Spider-Man #1",                             box: "3",  creator: "Walt Simonson (cover artist)",       goal: "Yellow SS on cover artist",            note: "Simonson drew the cover",              critical: false, jimlee: false, alreadySigned: false },
  { priority: "MED",  book: "Black Panther #1 (Stelfreeze)",                      box: "2",  creator: "Brian Stelfreeze",                   goal: "Yellow SS — Coates/Stelfreeze BP",     note: "Verify you have the unsigned copy",    critical: false, jimlee: false, alreadySigned: false },
  { priority: "INFO", book: "Storm #1",                                            box: "2",  creator: "Nicola Scott",                      goal: "Witness if possible",                  note: "Already signed by Skottie Young",      critical: false, jimlee: false, alreadySigned: true  },
  { priority: "INFO", book: "FF Connecting Set #1–5",                             box: "8",  creator: "Skottie Young",                      goal: "5× Yellow SS as a set",                note: "All 5 at once for max value",          critical: false, jimlee: false, alreadySigned: false },
];

function priorityColor(p: string) {
  if (p === "#1")   return "#dc2626";
  if (p === "#2")   return "#ea580c";
  if (p === "HIGH") return "#d97706";
  if (p === "MED")  return "#2563eb";
  return "#6b7280";
}
function priorityBg(p: string) {
  if (p === "#1")   return "#fef2f2";
  if (p === "#2")   return "#fff7ed";
  if (p === "HIGH") return "#fffbeb";
  if (p === "MED")  return "#eff6ff";
  return "#f9fafb";
}

function labelColor(lt: string) {
  if (lt.includes("Yellow")) return "#d4a800";
  if (lt.includes("Green"))  return "#16a34a";
  if (lt.includes("Blue"))   return "#2563eb";
  return "#6b7280";
}
function labelBg(lt: string) {
  if (lt.includes("Yellow")) return "#fffbeb";
  if (lt.includes("Green"))  return "#f0fdf4";
  if (lt.includes("Blue"))   return "#eff6ff";
  return "#f9fafb";
}
function tierColor(t: string) {
  if (t === "critical") return "#dc2626";
  if (t === "high")     return "#d97706";
  return "#2563eb";
}

type SortField = "priority" | "roi" | "total" | "raw" | "box" | "press" | "cgc" | "proj";
type View = "terrificon" | "roi" | "press" | "nycc";

// Live countdown
function useCountdown(target: Date) {
  const [diff, setDiff] = useState(target.getTime() - Date.now());
  useEffect(() => {
    const t = setInterval(() => setDiff(target.getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, past: true };
  const total = Math.floor(diff / 1000);
  return {
    days:    Math.floor(total / 86400),
    hours:   Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    past:    false,
  };
}

export default function CGCStrategy() {
  const [view,       setView]       = useState<View>("roi");
  const [tfFilter,   setTfFilter]   = useState(false);
  const [sortField,  setSortField]  = useState<SortField>("priority");
  const [sortDesc,   setSortDesc]   = useState(false);
  const [openTf,     setOpenTf]     = useState<Set<number>>(new Set());
  const [statuses,   setStatuses]   = useState<Record<number, string>>({});

  const terrificon = new Date(2026, 7, 7, 9, 0, 0);
  const cd = useCountdown(terrificon);

  const toggleTf = (i: number) =>
    setOpenTf(prev => { const n = new Set(prev); n.has(i)?n.delete(i):n.add(i); return n; });

  const jimLeeBooks  = TERRIFICON_SIGNINGS.filter(s => s.jimlee);
  const unsignedList = TERRIFICON_SIGNINGS.filter(s => !s.alreadySigned);
  const signedList   = TERRIFICON_SIGNINGS.filter(s => s.alreadySigned);

  const displayBooks = useMemo(() => {
    let books = tfFilter ? CGC_BOOKS.filter(b => b.terrificon) : [...CGC_BOOKS];
    books.sort((a, b) => {
      if (sortField === "priority") return sortDesc ? b.priority - a.priority : a.priority - b.priority;
      if (sortField === "roi")      return sortDesc ? (parseFloat(a.roiMultiple)-parseFloat(b.roiMultiple)) : (parseFloat(b.roiMultiple)-parseFloat(a.roiMultiple));
      if (sortField === "total")    return sortDesc ? a.totalCost - b.totalCost : b.totalCost - a.totalCost;
      if (sortField === "raw")      return sortDesc ? a.rawNM - b.rawNM : b.rawNM - a.rawNM;
      if (sortField === "box")      return sortDesc ? b.box - a.box : a.box - b.box;
      if (sortField === "press")    return sortDesc ? b.pressedCost - a.pressedCost : a.pressedCost - b.pressedCost;
      if (sortField === "cgc")      return sortDesc ? b.cgcCost - a.cgcCost : a.cgcCost - b.cgcCost;
      if (sortField === "proj")     { const am=(a.projectedLow+a.projectedHigh)/2,bm=(b.projectedLow+b.projectedHigh)/2; return sortDesc?bm-am:am-bm; }
      return 0;
    });
    return books;
  }, [tfFilter, sortField, sortDesc]);

  const pressBooks = CGC_BOOKS.filter(b => !b.doNotPress);

  const TERRIF_DAYS = Math.ceil((terrificon.getTime() - Date.now()) / 86400000);

  return (
    <div>
      {/* Terrificon countdown banner */}
      <div style={{ background:"#0b0b18", borderBottom:"2px solid #d4a800", padding:"10px 20px",
        display:"flex", alignItems:"center", gap:24, flexWrap:"wrap" }}>
        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", letterSpacing:"2px", color:"#d4a800" }}>
            🎪 TERRIFICON — AUG 7–9, 2026 · MOHEGAN SUN, CT
          </div>
          <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.5)", marginTop:1 }}>
            Hotel: Hyatt code G-TRFC · Jim Lee = Saturday Aug 8 ONLY — 10am sharp
          </div>
        </div>
        {!cd.past && (
          <div style={{ display:"flex", gap:12, marginLeft:"auto" }}>
            {[
              { val: cd.days,    lbl: "DAYS" },
              { val: cd.hours,   lbl: "HRS" },
              { val: cd.minutes, lbl: "MIN" },
              { val: cd.seconds, lbl: "SEC" },
            ].map(u => (
              <div key={u.lbl} style={{ textAlign:"center" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.4rem", color:"#d4a800", lineHeight:1, minWidth:36, textAlign:"center" }}>
                  {String(u.val).padStart(2,"0")}
                </div>
                <div style={{ fontSize:"0.52rem", letterSpacing:"1.5px", color:"rgba(255,255,255,0.4)", fontFamily:"'Bebas Neue',sans-serif" }}>{u.lbl}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Critical Rules banner */}
      <div style={{ background:"#fef2f2", borderBottom:"2px solid #dc2626", padding:"10px 20px 12px", fontSize:"0.8rem", color:"#7f1d1d", lineHeight:1.8 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", letterSpacing:"1.5px", color:"#dc2626", marginBottom:4 }}>⚡ CRITICAL RULES — READ BEFORE PACKING</div>
        <div>🚫 <strong>Wolverine #8:</strong> MUST REMAIN UNSIGNED — this is your $500+ Yellow SS book with Chris Claremont</div>
        <div>⏰ <strong>Jim Lee is SATURDAY AUG 8 ONLY</strong> — arrive 10AM SHARP. His line fills immediately. ({jimLeeBooks.length} books)</div>
        <div>📋 Pre-fill ALL CGC submission forms at <strong>cgccomics.com</strong> before leaving home</div>
        <div>🛡️ Every book going to CGC must be bagged + boarded. CGC will NOT accept unbagged books</div>
      </div>

      {/* Sub-tabs */}
      <div style={{ background:"#0b0b0b", borderBottom:"1px solid #222", display:"flex", paddingLeft:14 }}>
        {([
          ["roi",        "📊 CGC ROI Table"],
          ["terrificon", "🎪 Signing Priority"],
          ["press",      "🗜️ Press List"],
          ["nycc",       "🏙️ NYCC"],
        ] as [View, string][]).map(([id, lbl]) => (
          <button key={id} className={`tab-btn${view===id?" active":""}`}
            style={{ fontSize:"0.82rem", color: view===id?"#fff":"rgba(255,255,255,0.5)", borderBottomColor: view===id?"var(--red)":"transparent" }}
            onClick={() => setView(id)}>{lbl}</button>
        ))}
      </div>

      {/* ── ROI TABLE ── */}
      {view === "roi" && (
        <>
          {/* Summary stats */}
          <div style={{ background:"var(--surface2)", borderBottom:"1px solid var(--border)", padding:"10px 20px",
            display:"flex", gap:20, flexWrap:"wrap", alignItems:"center" }}>
            {[
              { val:`$${totalPressInvest.toLocaleString()}`, lbl:"Pressing", sub:`${pressableBooks.length} books × $20` },
              { val:`$${totalCGCInvest.toLocaleString()}`,   lbl:"CGC Submit", sub:"varies by tier" },
              { val:`$${totalAllIn.toLocaleString()}`,        lbl:"Total All-In", sub:"press + CGC", accent:true },
              { val:`$${projReturnLow.toLocaleString()}–$${projReturnHigh.toLocaleString()}`, lbl:"Projected Return", sub:"across 23 books" },
              { val:`+$${netGainLow.toLocaleString()}–$${netGainHigh.toLocaleString()}`,      lbl:"Net Projected Gain", sub:"after all costs" },
            ].map(s => (
              <div key={s.lbl} style={{ textAlign:"center", flex:"0 0 auto" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.1rem",
                  color: s.accent ? "var(--red)" : "var(--red)", letterSpacing:"1px", lineHeight:1 }}>{s.val}</div>
                <div style={{ fontSize:"0.6rem", letterSpacing:"1.5px", fontFamily:"'Bebas Neue',sans-serif", color:"var(--muted)" }}>{s.lbl}</div>
                {s.sub && <div style={{ fontSize:"0.6rem", color:"var(--muted2)" }}>{s.sub}</div>}
              </div>
            ))}

            {/* Controls */}
            <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              <button
                onClick={() => setTfFilter(v => !v)}
                style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem", letterSpacing:"1.5px",
                  background: tfFilter ? "#d4a800" : "var(--surface)",
                  color: tfFilter ? "#000" : "var(--muted2)",
                  border: tfFilter ? "1.5px solid #d4a800" : "1.5px solid var(--border)",
                  borderRadius:5, padding:"5px 12px", cursor:"pointer" }}>
                🎪 Terrificon Only ({CGC_BOOKS.filter(b=>b.terrificon).length})
              </button>
              <div style={{ display:"flex", gap:4 }}>
                {([["priority","Priority"],["roi","ROI"],["total","Cost"],["raw","Raw NM"]] as [SortField,string][]).map(([f,l]) => (
                  <button key={f} onClick={() => { sortField===f ? setSortDesc(d=>!d) : (setSortField(f), setSortDesc(false)); }}
                    style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1px",
                      background: sortField===f ? "var(--red)" : "var(--surface)",
                      color: sortField===f ? "#fff" : "var(--muted2)",
                      border: `1.5px solid ${sortField===f?"var(--red)":"var(--border)"}`,
                      borderRadius:5, padding:"4px 10px", cursor:"pointer", transition:"all 0.15s" }}>
                    {l} {sortField===f ? (sortDesc?"↑":"↓") : ""}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tier reference */}
          <div style={{ background:"#fffff8", borderBottom:"1px solid var(--border)", padding:"6px 20px",
            display:"flex", gap:16, flexWrap:"wrap", fontSize:"0.72rem", color:"var(--muted2)", alignItems:"center" }}>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"1.5px", color:"var(--muted)" }}>TIER PRICING:</span>
            {[
              { label:"🗜️ Press", price:"$20/book (flat — all except Stan Lee)" },
              { label:"📋 Modern", price:"$53/book (post-2000)" },
              { label:"📋 Vintage", price:"$70/book (1975–2000)" },
              { label:"📋 PSA/DNA", price:"$75 (Stan Lee only — no press)" },
            ].map(t => (
              <span key={t.label}><strong>{t.label}</strong> · {t.price}</span>
            ))}
          </div>

          {/* Table */}
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.78rem" }}>
              <thead>
                <tr style={{ background:"var(--surface2)", borderBottom:"2px solid var(--border)" }}>
                  {([
                    { h:"#",          f:"priority" as SortField },
                    { h:"Book",       f:null },
                    { h:"Box",        f:"box"   as SortField },
                    { h:"Label Type", f:null },
                    { h:"🗜️ Press",   f:"press" as SortField },
                    { h:"📋 CGC",     f:"cgc"   as SortField },
                    { h:"💰 Total",   f:"total" as SortField },
                    { h:"Raw NM",     f:"raw"   as SortField },
                    { h:"Projected",  f:"proj"  as SortField },
                    { h:"ROI",        f:"roi"   as SortField },
                    { h:"Notes",      f:null },
                  ] as {h:string;f:SortField|null}[]).map(({ h, f }) => (
                    <th key={h}
                      onClick={f ? () => { sortField===f ? setSortDesc(d=>!d) : (setSortField(f!), setSortDesc(false)); } : undefined}
                      style={{ padding:"8px 10px", textAlign:"left", fontFamily:"'Bebas Neue',sans-serif",
                        fontSize:"0.65rem", letterSpacing:"1.5px", whiteSpace:"nowrap",
                        color: f && sortField===f ? "var(--red)" : "var(--muted)",
                        cursor: f ? "pointer" : "default", userSelect:"none",
                        transition:"color 0.12s",
                      }}>
                      {h}{f && sortField===f ? (sortDesc ? " ↑" : " ↓") : (f ? " ·" : "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayBooks.map((b, i) => {
                  const lc = labelColor(b.labelType);
                  const lb = labelBg(b.labelType);
                  const tc = tierColor(b.tier);
                  const status = statuses[b.priority] || b.status;
                  return (
                    <tr key={b.priority} style={{
                      borderBottom:"1px solid var(--border)",
                      background: b.doNotPress ? "#fff8f8" : i%2===0 ? "transparent" : "var(--surface2)",
                    }}>
                      <td style={{ padding:"8px 10px", textAlign:"center" }}>
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem",
                          color:tc, border:`1px solid ${tc}30`, background:`${tc}10`,
                          borderRadius:3, padding:"1px 5px" }}>{b.priority}</span>
                      </td>
                      <td style={{ padding:"8px 10px", minWidth:200 }}>
                        <div style={{ fontWeight:600, color:"var(--brown-light)", lineHeight:1.3 }}>{b.book}</div>
                        {b.doNotPress && (
                          <span style={{ fontSize:"0.6rem", background:"#dc2626", color:"#fff", fontFamily:"'Bebas Neue',sans-serif",
                            letterSpacing:"1px", borderRadius:3, padding:"1px 6px", display:"inline-block", marginTop:2 }}>
                            🚫 DO NOT PRESS
                          </span>
                        )}
                        {b.alert && b.alert !== "DO NOT PRESS" && (
                          <span style={{ fontSize:"0.6rem", background:"#d97706", color:"#fff", fontFamily:"'Bebas Neue',sans-serif",
                            letterSpacing:"1px", borderRadius:3, padding:"1px 6px", display:"inline-block", marginTop:2, marginLeft:4 }}>
                            ⚠️ {b.alert}
                          </span>
                        )}
                        {b.terrificon && (
                          <span style={{ fontSize:"0.6rem", background:"#d4a800", color:"#000", fontFamily:"'Bebas Neue',sans-serif",
                            letterSpacing:"1px", borderRadius:3, padding:"1px 6px", display:"inline-block", marginTop:2, marginLeft:4 }}>
                            🎪 TF
                          </span>
                        )}
                      </td>
                      <td style={{ padding:"8px 10px", textAlign:"center", color:"var(--muted)" }}>{b.box}</td>
                      <td style={{ padding:"8px 10px", minWidth:140 }}>
                        <span style={{ fontSize:"0.68rem", background:lb, color:lc, border:`1px solid ${lc}40`,
                          borderRadius:3, padding:"2px 7px", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"0.5px" }}>
                          {b.labelType}
                        </span>
                      </td>
                      <td style={{ padding:"8px 10px", textAlign:"center", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>
                        {b.doNotPress
                          ? <span style={{ color:"#dc2626", fontSize:"0.7rem" }}>$0</span>
                          : <span style={{ color:"var(--text)" }}>${b.pressedCost}</span>
                        }
                      </td>
                      <td style={{ padding:"8px 10px", textAlign:"center", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>
                        ${b.cgcCost}
                      </td>
                      <td style={{ padding:"8px 10px", textAlign:"center", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", fontWeight:700 }}>
                        ${b.totalCost}
                      </td>
                      <td style={{ padding:"8px 10px", textAlign:"center", color:"var(--muted2)" }}>${b.rawNM}</td>
                      <td style={{ padding:"8px 10px", color:"var(--gold)", fontWeight:600, whiteSpace:"nowrap" }}>
                        ${b.projectedLow}–${b.projectedHigh}
                      </td>
                      <td style={{ padding:"8px 10px", textAlign:"center", color:"#16a34a", fontWeight:700, whiteSpace:"nowrap", fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem" }}>
                        {b.roiMultiple}
                      </td>
                      <td style={{ padding:"8px 10px", color:"var(--muted2)", fontSize:"0.72rem", maxWidth:200 }}>
                        {b.note}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background:"var(--surface)", borderTop:"2px solid var(--border)", fontWeight:700 }}>
                  <td colSpan={4} style={{ padding:"10px 14px", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", fontSize:"0.75rem" }}>
                    TOTAL — {displayBooks.length} BOOKS {tfFilter ? "(Terrificon filter active)" : ""}
                  </td>
                  <td style={{ padding:"10px 10px", textAlign:"center", fontFamily:"'Bebas Neue',sans-serif" }}>
                    ${displayBooks.reduce((s,b)=>s+b.pressedCost,0)}
                  </td>
                  <td style={{ padding:"10px 10px", textAlign:"center", fontFamily:"'Bebas Neue',sans-serif" }}>
                    ${displayBooks.reduce((s,b)=>s+b.cgcCost,0)}
                  </td>
                  <td style={{ padding:"10px 10px", textAlign:"center", fontFamily:"'Bebas Neue',sans-serif", color:"var(--red)" }}>
                    ${displayBooks.reduce((s,b)=>s+b.totalCost,0)}
                  </td>
                  <td style={{ padding:"10px 10px", textAlign:"center", color:"var(--muted2)" }}>
                    ${displayBooks.reduce((s,b)=>s+b.rawNM,0)}
                  </td>
                  <td style={{ padding:"10px 10px", color:"var(--gold)", fontWeight:700 }}>
                    ${displayBooks.reduce((s,b)=>s+b.projectedLow,0).toLocaleString()}–
                    ${displayBooks.reduce((s,b)=>s+b.projectedHigh,0).toLocaleString()}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Label legend */}
          <div style={{ padding:"16px 20px 40px", display:"flex", flexWrap:"wrap", gap:12 }}>
            {[
              { color:"#d4a800", label:"🟡 YELLOW SS",        desc:"CGC witness present at signing. Bring UNSIGNED book. Creator signs in front of facilitator. Max value." },
              { color:"#16a34a", label:"🟢 GREEN QUALIFIED",  desc:"Already-signed books via CGC × JSA mail-in. JSA authenticates unwitnessed signatures." },
              { color:"#2563eb", label:"🔵 BLUE UNIVERSAL",   desc:"Unsigned books. Submit for grade only. Best for high-condition key issues." },
              { color:"#dc2626", label:"⚠️ STAN LEE SPECIAL", desc:"DO NOT PRESS. Authenticate via PSA/DNA at NYCC first. BP #513 is your most valuable single book." },
            ].map(l => (
              <div key={l.label} style={{ flex:"1 1 220px", background:"var(--surface)", border:`1.5px solid ${l.color}40`, borderRadius:6, padding:"12px 14px" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", letterSpacing:"1.5px", color:l.color, marginBottom:4 }}>{l.label}</div>
                <div style={{ fontSize:"0.75rem", color:"var(--muted2)", lineHeight:1.5 }}>{l.desc}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── TERRIFICON SIGNING PRIORITY ── */}
      {view === "terrificon" && (
        <>
          <div style={{ background:"var(--surface2)", borderBottom:"1px solid var(--border)", padding:"10px 20px", display:"flex", gap:24, flexWrap:"wrap" }}>
            {[
              { val: TERRIFICON_SIGNINGS.length, lbl: "Total Books" },
              { val: unsignedList.length,         lbl: "Need Signing" },
              { val: signedList.length,            lbl: "Already Signed" },
              { val: jimLeeBooks.length,           lbl: "Jim Lee (Sat Only)" },
            ].map(s => (
              <div key={s.lbl} style={{ textAlign:"center" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.1rem", color:"var(--red)", letterSpacing:"1px" }}>{s.val}</div>
                <div style={{ fontSize:"0.6rem", letterSpacing:"1.5px", fontFamily:"'Bebas Neue',sans-serif", color:"var(--muted)" }}>{s.lbl}</div>
              </div>
            ))}
          </div>

          {([
            { label:"🟡 UNSIGNED — Bring to Get Signed", sublabel:"These books must arrive UNSIGNED to receive a Yellow SS label", items:unsignedList, accent:"#d97706" },
            { label:"✍️ ALREADY SIGNED — Witness / Re-Sign", sublabel:"Already signed — bring for CGC witnessing or re-sign to upgrade to combo label", items:signedList, accent:"#2563eb" },
          ] as const).map(group => (
            <div key={group.label}>
              <div style={{ padding:"10px 18px 6px", background:`${group.accent}0d`, borderBottom:`1px solid ${group.accent}30`, borderTop:"1px solid var(--border)" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", letterSpacing:"2px", color:group.accent }}>{group.label}</div>
                <div style={{ fontSize:"0.75rem", color:"var(--muted2)", marginTop:2 }}>{group.sublabel}</div>
              </div>
              <div className="list-view" style={{ marginBottom:0 }}>
                {group.items.map(s => {
                  const gi = TERRIFICON_SIGNINGS.indexOf(s);
                  const isOpen = openTf.has(gi);
                  const pc = priorityColor(s.priority);
                  const pb = priorityBg(s.priority);
                  return (
                    <div key={gi} className={`lcard${isOpen?" open":""}`}
                      style={{ borderLeft:`3px solid ${pc}`, background: isOpen ? pb : undefined }}
                      onClick={() => toggleTf(gi)}>
                      <div className="lcard-head">
                        <span style={{ fontSize:"0.6rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
                          background:`${pc}18`, border:`1px solid ${pc}`, color:pc,
                          borderRadius:3, padding:"1px 7px", whiteSpace:"nowrap", flexShrink:0 }}>{s.priority}</span>
                        <span className="lcard-title" style={{ fontWeight: ["HIGH","#1","#2"].includes(s.priority) ? 600 : undefined }}>
                          {s.book}
                        </span>
                        <span style={{ fontSize:"0.7rem", color:"var(--muted)", flexShrink:0 }}>Box {s.box}</span>
                        {s.jimlee    && <span style={{ fontSize:"0.6rem", background:"#d97706", color:"#fff", borderRadius:3, padding:"1px 6px", flexShrink:0, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>SAT ONLY</span>}
                        {s.critical  && <span style={{ fontSize:"0.6rem", background:"#dc2626", color:"#fff", borderRadius:3, padding:"1px 6px", flexShrink:0, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>🚫 UNSIGNED</span>}
                        {s.alreadySigned && <span style={{ fontSize:"0.6rem", background:"#2563eb", color:"#fff", borderRadius:3, padding:"1px 6px", flexShrink:0, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>SIGNED</span>}
                      </div>
                      {!isOpen && <div style={{ fontSize:"0.78rem", color:"var(--muted2)", marginTop:3, paddingLeft:4 }}>{s.creator}</div>}
                      {isOpen && (
                        <div className="lcard-expand">
                          <div className="dr"><span className="dl">Creator</span><span className="dv">{s.creator}</span></div>
                          <div className="dr" style={{marginTop:6}}><span className="dl">Goal</span><span className="dv" style={{color:"var(--gold)", fontWeight:600}}>{s.goal}</span></div>
                          <div className="dr" style={{marginTop:6}}><span className="dl">Notes</span><span className="dv">{s.note}</span></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── PRESS LIST ── */}
      {view === "press" && (
        <>
          <div style={{ background:"#fff8e0", borderBottom:"2px solid #d4a800", padding:"10px 20px", fontSize:"0.8rem", color:"#8a6000", lineHeight:1.7 }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.82rem", letterSpacing:"2px", marginBottom:4 }}>
              🗜️ PRESS SCHEDULE — ALL BOOKS MUST BE BACK BEFORE AUG 7
            </div>
            <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
              <span>🗜️ <strong>Pressing:</strong> ${totalPressInvest} ({pressableBooks.length} books × $20/book flat rate)</span>
              <span>📋 <strong>CGC Submission:</strong> ${totalCGCInvest} (Modern $53 · Vintage $70 · PSA $75)</span>
              <span style={{ fontWeight:700, color:"#5a3800" }}>💰 <strong>Total All-In:</strong> ${totalAllIn}</span>
            </div>
          </div>

          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.79rem" }}>
              <thead>
                <tr style={{ background:"var(--surface2)", borderBottom:"2px solid var(--border)" }}>
                  {["Book","Box","CGC Path","🗜️ Press","📋 CGC Submit","💰 Total","Projected Value"].map(h => (
                    <th key={h} style={{ padding:"8px 14px", textAlign:"left", fontFamily:"'Bebas Neue',sans-serif",
                      fontSize:"0.65rem", letterSpacing:"1.5px", color:"var(--muted)", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Pressable books */}
                {pressBooks.map((p, i) => {
                  const lc = labelColor(p.labelType);
                  return (
                    <tr key={p.priority} style={{ borderBottom:"1px solid var(--border)", background: i%2===0?"transparent":"var(--surface2)" }}>
                      <td style={{ padding:"9px 14px", fontWeight:600 }}>
                        {p.book}
                        {p.alert && (
                          <span style={{ fontSize:"0.6rem", background:"#d97706", color:"#fff", fontFamily:"'Bebas Neue',sans-serif",
                            letterSpacing:"1px", borderRadius:3, padding:"1px 6px", marginLeft:6 }}>⚠️ {p.alert}</span>
                        )}
                        {p.terrificon && (
                          <span style={{ fontSize:"0.6rem", background:"#d4a800", color:"#000", fontFamily:"'Bebas Neue',sans-serif",
                            letterSpacing:"1px", borderRadius:3, padding:"1px 6px", marginLeft:4 }}>🎪</span>
                        )}
                      </td>
                      <td style={{ padding:"9px 14px", color:"var(--muted)", textAlign:"center" }}>{p.box}</td>
                      <td style={{ padding:"9px 14px" }}>
                        <span style={{ fontSize:"0.68rem", color:lc, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"0.5px" }}>
                          {p.labelType}
                        </span>
                      </td>
                      <td style={{ padding:"9px 14px", textAlign:"center", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>${p.pressedCost}</td>
                      <td style={{ padding:"9px 14px", textAlign:"center", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>${p.cgcCost}</td>
                      <td style={{ padding:"9px 14px", textAlign:"center", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", fontWeight:700 }}>${p.totalCost}</td>
                      <td style={{ padding:"9px 14px", color:"var(--gold)", fontWeight:600 }}>${p.projectedLow}–${p.projectedHigh}</td>
                    </tr>
                  );
                })}

                {/* Stan Lee special row */}
                {CGC_BOOKS.filter(b => b.doNotPress).map(p => (
                  <tr key={p.priority} style={{ borderBottom:"1px solid var(--border)", background:"#fff0f0" }}>
                    <td style={{ padding:"9px 14px", fontWeight:600 }}>
                      {p.book}
                      <span style={{ fontSize:"0.6rem", background:"#dc2626", color:"#fff", fontFamily:"'Bebas Neue',sans-serif",
                        letterSpacing:"1px", borderRadius:3, padding:"1px 6px", marginLeft:6 }}>🚫 DO NOT PRESS</span>
                    </td>
                    <td style={{ padding:"9px 14px", color:"var(--muted)", textAlign:"center" }}>{p.box}</td>
                    <td style={{ padding:"9px 14px", fontSize:"0.72rem", color:"#dc2626" }}>PSA/DNA at NYCC first, then CGC × JSA</td>
                    <td style={{ padding:"9px 14px", textAlign:"center", color:"#dc2626", fontFamily:"'Bebas Neue',sans-serif" }}>$0</td>
                    <td style={{ padding:"9px 14px", textAlign:"center", fontFamily:"'Bebas Neue',sans-serif" }}>${p.cgcCost}</td>
                    <td style={{ padding:"9px 14px", textAlign:"center", fontFamily:"'Bebas Neue',sans-serif", fontWeight:700 }}>${p.totalCost}</td>
                    <td style={{ padding:"9px 14px", color:"var(--gold)", fontWeight:600 }}>${p.projectedLow}–${p.projectedHigh}</td>
                  </tr>
                ))}

                {/* Totals row */}
                <tr style={{ borderTop:"2px solid var(--border)", background:"var(--surface)", fontWeight:700 }}>
                  <td colSpan={3} style={{ padding:"10px 14px", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", fontSize:"0.75rem" }}>
                    TOTAL — {CGC_BOOKS.length} BOOKS
                  </td>
                  <td style={{ padding:"10px 14px", textAlign:"center", fontFamily:"'Bebas Neue',sans-serif" }}>
                    ${totalPressInvest}
                  </td>
                  <td style={{ padding:"10px 14px", textAlign:"center", fontFamily:"'Bebas Neue',sans-serif" }}>
                    ${totalCGCInvest}
                  </td>
                  <td style={{ padding:"10px 14px", textAlign:"center", fontFamily:"'Bebas Neue',sans-serif", color:"var(--red)", fontSize:"0.95rem" }}>
                    ${totalAllIn}
                  </td>
                  <td style={{ padding:"10px 14px", color:"var(--gold)", fontWeight:700 }}>
                    ${projReturnLow.toLocaleString()}–${projReturnHigh.toLocaleString()} projected
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ padding:"16px 20px 40px", display:"flex", flexWrap:"wrap", gap:12 }}>
            {[
              { color:"#d4a800", label:"🟡 YELLOW SS",        desc:"CGC witness PRESENT at signing. Bring UNSIGNED book. Max value." },
              { color:"#16a34a", label:"🟢 GREEN QUALIFIED",  desc:"Already-signed via CGC × JSA mail-in. JSA authenticates unwitnessed signatures." },
              { color:"#2563eb", label:"🔵 BLUE UNIVERSAL",   desc:"Unsigned books, grade only. Best for high-condition key issues." },
              { color:"#dc2626", label:"⚠️ STAN LEE SPECIAL", desc:"DO NOT PRESS. Authenticate via PSA/DNA at NYCC first. Never press before authentication." },
            ].map(l => (
              <div key={l.label} style={{ flex:"1 1 220px", background:"var(--surface)", border:`1.5px solid ${l.color}40`, borderRadius:6, padding:"12px 14px" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", letterSpacing:"1.5px", color:l.color, marginBottom:4 }}>{l.label}</div>
                <div style={{ fontSize:"0.75rem", color:"var(--muted2)", lineHeight:1.5 }}>{l.desc}</div>
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
          <div style={{ marginTop:20, display:"inline-block", background:"var(--surface)", border:"1.5px solid var(--border)",
            borderRadius:6, padding:"16px 28px", textAlign:"left" }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", letterSpacing:"2px", color:"var(--red)", marginBottom:8 }}>NYCC CHECKLIST</div>
            {["Stan Lee BP #513 — hard case, DO NOT PRESS until PSA/DNA verified","Heritage Auctions meeting — bring CGC returns for valuation","Book PSA/DNA appointment in advance","Pre-register online for faster entry"].map((item, i) => (
              <div key={i} style={{ fontSize:"0.8rem", color:"var(--muted2)", lineHeight:2, display:"flex", gap:8 }}>
                <span style={{ color:"var(--red)" }}>→</span> {item}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Missing import
import { useMemo } from "react";
