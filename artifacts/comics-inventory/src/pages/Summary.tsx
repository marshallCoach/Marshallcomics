import { DATA3 } from "@/data/data3";

const comics   = DATA3.comics;
const boxData  = DATA3.boxes;

const totalComics  = comics.length;
const totalBoxes   = boxData.length;
const keyCount     = comics.filter(c => (c.Key || "").toUpperCase() === "YES").length;
const signedCount  = comics.filter(c => (c.Signed || "").toUpperCase() === "YES").length;
const whatnotCount = comics.filter(c => (c.Platform || "").toUpperCase() === "WHATNOT").length;
const ebayCount    = comics.filter(c => (c.Platform || "").toUpperCase() === "EBAY").length;
const tfCount      = comics.filter(c => !!(c.Terrificon || "").trim()).length;

const NEXT_STEPS = [
  {
    urgency: "critical",
    deadline: "ASAP",
    title: "Authenticate Stan Lee BP #513 BEFORE any streaming or sale",
    detail: "Your most valuable single book ($800–$1,500+ authenticated). Do NOT press. Submit via PSA/DNA at NYCC or CGC × JSA. Never stream ungraded.",
    category: "CGC",
  },
  {
    urgency: "critical",
    deadline: "Jun 5 ⚠️",
    title: "Jorge Jiménez CGC SS — Batman #125 — DEADLINE IMMINENT",
    detail: "Batman #125 (Failsafe arc — Jiménez drew it). Press and submit immediately. This deadline is days away.",
    category: "Signing",
  },
  {
    urgency: "critical",
    deadline: "This week",
    title: "Bag Box 15 — DC New 52 (ALL UNBAGGED)",
    detail: "Batman Annual #1 (Mr. Freeze key), Batman Europa #1 (Jim Lee), Superman Unchained #1 (Snyder/Lee) are all unbagged. CGC will not accept unbagged books.",
    category: "Bagging",
  },
  {
    urgency: "high",
    deadline: "Jun 26",
    title: "Geoff Johns + Jason Fabok CGC SS — JL #21 + JSA",
    detail: "Johns sig adds to existing unwitnessed VA sigs = yellow/green combo label. Pull books, sleeve, ship. Deadline Jun 26.",
    category: "Signing",
  },
  {
    urgency: "high",
    deadline: "Jul 10",
    title: "Roy Thomas — 5 books = $450 fees → $820–$1,630 return",
    detail: "Avengers #60, #87, King-Size #2, Marvel Premiere #1, Saga Human Torch #3. Thomas co-created Wolverine, Vision, Carol Danvers, Adam Warlock. High ROI signing.",
    category: "Signing",
  },
  {
    urgency: "high",
    deadline: "Jul 10",
    title: "Mike Mayhew CGC SS — ASM #50 Alex Ross Timeless Virgin",
    detail: "Already signed — submit via CGC × JSA green Qualified path. $100–200 authenticated. Same deadline as Roy Thomas.",
    category: "Signing",
  },
  {
    urgency: "high",
    deadline: "Before Aug 7",
    title: "Press CGC batch — submit all simultaneously to save shipping",
    detail: "Batman #656+#657, Wolverine #8 (UNSIGNED), ASM #361, Vision #1, Secret Wars #1, NW #1, Mockingbird #8, WildCATs #2/#11, Savage Dragon #1, Transformers #1. Cost $15–25/book.",
    category: "CGC",
  },
  {
    urgency: "high",
    deadline: "Before Aug 7",
    title: "Bag Box 25 (DC Rebirth, 10% bagged) — keys first",
    detail: "DC Universe Rebirth Special #1, Batman #21+#22 (The Button), Batman #50, Hawkman #1, Justice League #1 Snyder. All unbagged keys.",
    category: "Bagging",
  },
  {
    urgency: "high",
    deadline: "Before Aug 7",
    title: "Bag Box 26 (X-Men, 20% bagged) — keys first",
    detail: "Deadpool #1 (Way/Medina 2008), Old Man Logan #71–72, Extreme X-Men #1, New Mutants #1 (2009). Keys bag first.",
    category: "Bagging",
  },
  {
    urgency: "high",
    deadline: "Aug 8 SHARP",
    title: "Terrificon — Jim Lee is SATURDAY AUG 8 ONLY — arrive 10am",
    detail: "Hotel: Hyatt code G-TRFC. Bring UNSIGNED books for yellow SS label. Wolverine #8 unsigned = priority #1 ($500+ SS 9.8). Verify Agent of Slabs presence. DO NOT bring already-signed books for yellow SS.",
    category: "Show",
  },
  {
    urgency: "medium",
    deadline: "Oct 8–11",
    title: "NYCC — Stan Lee BP #513 authentication + Heritage networking",
    detail: "Bring BP #513 for PSA/DNA authentication. Bring Thor #169 CGC 8.0 (slabbed) for Heritage dealer evaluation. Buy budget $100–300 for undervalued keys.",
    category: "Show",
  },
  {
    urgency: "medium",
    deadline: "Ongoing",
    title: "Bag Box 23 (Cap America, 10%) + Box 24 (DC Mixed, 10%)",
    detail: "Box 23: Cap #1 Brubaker, Cap #25 (Death of Cap), Cap #600. Box 24: Batman/Superman World's Finest #1, Far Sector #1, Infinite Frontier #0. Keys first.",
    category: "Bagging",
  },
  {
    urgency: "low",
    deadline: "Ongoing",
    title: "eBay Now — reader/poor condition issues, no pressing required",
    detail: "Flash Vol 2 #112–125 (low grade), ASM #583 (water damage), Aquaman #58–74, Extreme X-Men #6–25, New Mutants DeFilippis #1–13. Start at $1–3 each or bundle lots.",
    category: "Sales",
  },
];

function catColor(cat: string) {
  if (cat === "CGC")     return "#8b2be2";
  if (cat === "Signing") return "#c8102e";
  if (cat === "Bagging") return "#d97706";
  if (cat === "Show")    return "#1d6fa4";
  if (cat === "Sales")   return "#16a34a";
  return "#555";
}

function UrgencyBadge({ u }: { u: string }) {
  const map: Record<string, { label: string; color: string }> = {
    critical: { label:"CRITICAL", color:"#dc2626" },
    high:     { label:"HIGH",     color:"#d97706" },
    medium:   { label:"MEDIUM",   color:"#1d6fa4" },
    low:      { label:"WATCH",    color:"#6b7280" },
  };
  const m = map[u] || map.low;
  return (
    <span style={{
      background: m.color+"15", border:`1.5px solid ${m.color}`,
      borderRadius:3, padding:"1px 8px",
      fontSize:"0.62rem", fontFamily:"'Bebas Neue',sans-serif",
      letterSpacing:"1px", color:m.color,
    }}>{m.label}</span>
  );
}

function StepCard({ step }: { step: typeof NEXT_STEPS[number] }) {
  const cc = catColor(step.category);
  return (
    <div style={{
      display:"flex", gap:14, alignItems:"flex-start",
      border:"1.5px solid var(--border)", borderRadius:6,
      padding:"12px 16px", background:"var(--surface)",
      borderLeft:`3px solid ${step.urgency==="critical"?"#dc2626":step.urgency==="high"?"#d97706":"var(--border)"}`,
    }}>
      <div style={{ flex:"0 0 auto", display:"flex", flexDirection:"column", alignItems:"center", gap:5, minWidth:72 }}>
        <UrgencyBadge u={step.urgency} />
        <span style={{
          fontSize:"0.62rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
          background:cc+"18", border:`1px solid ${cc}`, color:cc,
          borderRadius:3, padding:"1px 7px",
        }}>{step.category}</span>
        <span style={{ fontSize:"0.63rem", color:step.urgency==="critical"?"#dc2626":"var(--muted2)", fontWeight:step.urgency==="critical"?700:400 }}>
          {step.deadline}
        </span>
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.9rem", letterSpacing:"1px", color:"var(--text)", marginBottom:3 }}>{step.title}</div>
        <div style={{ fontSize:"0.78rem", color:"var(--muted2)", lineHeight:1.5 }}>{step.detail}</div>
      </div>
    </div>
  );
}

export default function Summary() {
  const critical = NEXT_STEPS.filter(s => s.urgency === "critical");
  const high     = NEXT_STEPS.filter(s => s.urgency === "high");
  const rest     = NEXT_STEPS.filter(s => s.urgency !== "critical" && s.urgency !== "high");

  return (
    <div style={{ maxWidth:1100, margin:"0 auto", padding:"24px 20px 60px" }}>

      {/* Overview stats */}
      <section style={{ marginBottom:32 }}>
        <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.3rem", letterSpacing:"2px", color:"var(--red)", marginBottom:16 }}>
          Collection Overview
        </h2>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12 }}>
          {[
            { val:totalComics.toLocaleString(), lbl:"Total Comics",    sub:"master inventory" },
            { val:totalBoxes.toString(),        lbl:"Total Boxes",     sub:"physically organized" },
            { val:keyCount.toLocaleString(),    lbl:"Key Issues",      sub:"confirmed across all boxes" },
            { val:signedCount.toString(),       lbl:"Signed Books",    sub:"by verified creators" },
            { val:tfCount.toString(),           lbl:"Terrificon Books",sub:"creator appearances" },
            { val:whatnotCount.toLocaleString(),lbl:"Whatnot",         sub:"platform assigned" },
            { val:ebayCount.toLocaleString(),   lbl:"eBay",            sub:"platform assigned" },
            { val:"$25k–$55k",                 lbl:"Est. Raw Value",  sub:"$60k–$120k+ post-CGC" },
          ].map(s => (
            <div key={s.lbl} style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:6, padding:"14px 16px" }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.6rem", color:"var(--red)", letterSpacing:"1px" }}>{s.val}</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.7rem", letterSpacing:"1.5px", color:"var(--text)" }}>{s.lbl}</div>
              <div style={{ fontSize:"0.7rem", color:"var(--muted2)", marginTop:2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Collection highlights */}
      <section style={{ marginBottom:32 }}>
        <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.3rem", letterSpacing:"2px", color:"var(--red)", marginBottom:12 }}>
          Flagship Assets
        </h2>
        <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
          {[
            { book:"Stan Lee signed BP #513",         note:"Authenticate first (PSA/DNA) — $800–$1,500+ auth",           color:"#dc2626" },
            { book:"Truth: RWB #1 (Baker remarked)",  note:"Verify remark → Green Qual. → Heritage — $500–$2,000",        color:"#d97706" },
            { book:"Ultimate Fallout #4 Foil",        note:"1st Miles Morales — $800–$1,500 CGC 9.8",                     color:"#8b2be2" },
            { book:"Thor #169 CGC 8.0",               note:"Already slabbed. Galactus origin. Kirby/Lee. Show 15.",        color:"#1d6fa4" },
            { book:"Batman #656 (1st Damian Wayne)",  note:"Press + Blue Universal → $350–$500 CGC 9.8 — Best ROI",       color:"#16a34a" },
            { book:"Wolverine #8 (UNSIGNED)",         note:"Keep unsigned → Yellow SS at Terrificon → $500+ SS 9.8",      color:"#d97706" },
            { book:"Vision #1 (Tom King signed)",     note:"Press + Green Qual. → $150–$300. Film timing.",               color:"#8b2be2" },
            { book:"ASM #361 (1st Carnage, dbl-sgnd)",note:"Bagley+Sharen. Press + Green Qual. → $200–$300 auth.",        color:"#dc2626" },
            { book:"Black Lightning #1 (Isabella)",   note:"Press + Green Qual. → $300–$500. Whatnot/Heritage.",          color:"#16a34a" },
            { book:"Captain Carter #1 (Atwell, personalized)", note:"'To Robert' — emotional anchor for Show 1.",         color:"#1d6fa4" },
          ].map(a => (
            <div key={a.book} style={{ flex:"1 1 280px", background:"var(--surface)", border:`1.5px solid ${a.color}40`, borderLeft:`3px solid ${a.color}`, borderRadius:6, padding:"10px 14px" }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", letterSpacing:"1px", color:a.color, marginBottom:3 }}>{a.book}</div>
              <div style={{ fontSize:"0.76rem", color:"var(--muted2)", lineHeight:1.4 }}>{a.note}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Box breakdown */}
      <section style={{ marginBottom:32 }}>
        <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.3rem", letterSpacing:"2px", color:"var(--red)", marginBottom:12 }}>
          Books per Box
        </h2>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {[...boxData].sort((a,b) => Number(a.Num) - Number(b.Num)).map(b => (
            <div key={b.Num} style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:5, padding:"8px 14px", textAlign:"center", minWidth:72 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.2rem", color:"var(--red)" }}>{b.Comics}</div>
              <div style={{ fontSize:"0.65rem", color:"var(--muted2)", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>Box {b.Num}</div>
              {Number(b.Keys)   > 0 && <div style={{ fontSize:"0.58rem", color:"#d97706" }}>{b.Keys} keys</div>}
              {Number(b.Signed) > 0 && <div style={{ fontSize:"0.58rem", color:"#16a34a" }}>{b.Signed} sgnd</div>}
            </div>
          ))}
        </div>
      </section>

      {/* Next Steps */}
      <section>
        <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.3rem", letterSpacing:"2px", color:"var(--red)", marginBottom:6 }}>
          Action Plan
        </h2>
        <p style={{ fontSize:"0.78rem", color:"var(--muted2)", marginBottom:16 }}>
          As of May 18, 2026 — Business Plan v4. Critical items first.
        </p>

        {critical.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", letterSpacing:"2px", color:"#dc2626", marginBottom:8 }}>🔴 CRITICAL — ACT NOW</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {critical.map((s,i) => <StepCard key={i} step={s} />)}
            </div>
          </div>
        )}

        {high.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", letterSpacing:"2px", color:"#d97706", marginBottom:8, marginTop:20 }}>🟠 HIGH PRIORITY</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {high.map((s,i) => <StepCard key={i} step={s} />)}
            </div>
          </div>
        )}

        {rest.length > 0 && (
          <div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", letterSpacing:"2px", color:"var(--muted2)", marginBottom:8, marginTop:20 }}>UPCOMING & ONGOING</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {rest.map((s,i) => <StepCard key={i} step={s} />)}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
