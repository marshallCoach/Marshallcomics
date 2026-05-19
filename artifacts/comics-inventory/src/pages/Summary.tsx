import { useState, useEffect } from "react";
import { DATA3 } from "@/data/data3";
import { NEXT_STEPS, Status, StepCard, loadStatuses, saveStatuses } from "./ActionPlan";

const comics  = DATA3.comics;
const boxData = DATA3.boxes;

const totalComics  = comics.length;
const totalBoxes   = boxData.length;
const keyCount     = comics.filter(c => (c.Key    || "").toUpperCase() === "YES").length;
const signedCount  = comics.filter(c => (c.Signed || "").toUpperCase() === "YES").length;
const whatnotCount = comics.filter(c => (c.Platform || "").toUpperCase() === "WHATNOT").length;
const ebayCount    = comics.filter(c => (c.Platform || "").toUpperCase() === "EBAY").length;
const tfCount      = comics.filter(c => !!(c.Terrificon || "").trim()).length;

// ── Flagship assets ──────────────────────────────────────────────────────────
const FLAGSHIP = [
  // Row 1 — peak value assets
  { book:"Stan Lee signed BP #513",                   note:"Authenticate first (PSA/DNA) — $800–$1,500+ auth",         color:"#dc2626", box:"2",  publisher:"Marvel", year:"1966", valueNM:"$800–$1,500 authenticated", condition:"Raw — DO NOT press",            cgcPath:"PSA/DNA at NYCC → CGC × JSA Green Qualified",   action:"NYCC Oct 8–11. Never press. Submit via PSA/DNA first.",           terrificon:false },
  { book:"Truth: RWB #1 (Baker remarked)",            note:"Verify remark → Green Qual. → Heritage — $500–$2,000",    color:"#d97706", box:"2",  publisher:"Marvel", year:"2003", valueNM:"$500–$2,000 with remark",   condition:"Has Baker remark",              cgcPath:"CGC × JSA → Green Qualified → Heritage",        action:"Verify remark authenticity before submitting.",                   terrificon:false },
  { book:"Ultimate Fallout #4 Foil (1st Miles)",      note:"1st Miles Morales — $800–$1,500 CGC 9.8",                 color:"#8b2be2", box:"2",  publisher:"Marvel", year:"2011", valueNM:"$800–$1,500 CGC 9.8",       condition:"Check for pressing",            cgcPath:"Press → CGC Universal Blue 9.8",                action:"Press then submit for Blue Universal label.",                     terrificon:false },
  { book:"Thor #169 CGC 8.0 (Galactus Origin)",       note:"Already slabbed. Galactus origin. Kirby/Lee. Show 15.",   color:"#1d6fa4", box:"15", publisher:"Marvel", year:"1969", valueNM:"CGC 8.0 — already slabbed", condition:"Slabbed CGC 8.0",               cgcPath:"Already graded — ready for Heritage or auction", action:"Feature in Show 15 — Whatnot anchor book.",                      terrificon:false },
  // Row 2 — Terrificon priority first, then others
  { book:"Wolverine #8 (UNSIGNED — 1982)",            note:"Keep unsigned → Yellow SS at Terrificon → $500+ SS 9.8",  color:"#d97706", box:"8",  publisher:"Marvel", year:"1982", valueNM:"$500+ Yellow SS CGC 9.8",   condition:"MUST STAY UNSIGNED",            cgcPath:"Yellow SS at Terrificon → Chris Claremont SS",  action:"Priority #1 at Terrificon. Press before Aug 7. DO NOT sign until con.", terrificon:true  },
  { book:"Batman #656 (1st Damian Wayne)",            note:"Press + Blue Universal → $350–$500 CGC 9.8 — Best ROI",   color:"#16a34a", box:"4",  publisher:"DC",     year:"2006", valueNM:"$350–$500 CGC 9.8",         condition:"In press list — send ASAP",     cgcPath:"Press → CGC Universal Blue 9.8",                action:"Press and submit before Terrificon. Best ROI in collection.",     terrificon:true  },
  { book:"Vision #1 (Tom King signed)",               note:"Press + Green Qual. → $150–$300. Film timing.",           color:"#8b2be2", box:"2",  publisher:"Marvel", year:"2015", valueNM:"$150–$300 Green Qualified",  condition:"Signed — press first",          cgcPath:"Press → CGC × JSA → Green Qualified",           action:"In press batch — submit with the Terrificon batch before Aug 7.", terrificon:false },
  { book:"ASM #361 (1st Carnage — Bagley/Sharen sgd)",note:"Bagley+Sharen. Press + Green Qual. → $200–$300 auth.",   color:"#dc2626", box:"2",  publisher:"Marvel", year:"1992", valueNM:"$200–$300 Green Qualified",  condition:"Dual signed — press first",     cgcPath:"Press → CGC × JSA → Green Qualified",           action:"In press batch — submit with the Terrificon batch before Aug 7.", terrificon:false },
  { book:"Black Lightning #1 (Isabella)",             note:"Press + Green Qual. → $300–$500. Whatnot/Heritage.",      color:"#16a34a", box:"2",  publisher:"DC",     year:"1977", valueNM:"$300–$500 Green Qualified",  condition:"Check for pressing",            cgcPath:"CGC × JSA → Green Qualified",                   action:"Monitor CGC private signing window — high Heritage value.",       terrificon:false },
  { book:"Captain Carter #1 (Atwell — To Robert)",   note:"Emotional anchor for Show 1 — personalized signing.",     color:"#1d6fa4", box:"2",  publisher:"Marvel", year:"2022", valueNM:"$80–$150 personalized",      condition:"Signed personalized",           cgcPath:"Whatnot anchor — personal story sells",          action:"Lead Show 1 with the story of the Hayley Atwell signing.",        terrificon:false },
];

function StatCard({ val, lbl, sub, quip, onClick }: {
  val: string; lbl: string; sub: string; quip: string; onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        background:"var(--surface)", border:"1.5px solid var(--border)",
        borderRadius:6, padding:"14px 16px",
        transform: hovered ? "scale(1.03)" : "scale(1)",
        transition:"transform 0.15s ease, border-color 0.15s ease",
        borderColor: hovered ? "var(--red)" : "var(--border)",
        cursor: onClick ? "pointer" : "default",
        position:"relative", overflow:"hidden",
      }}
    >
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.7rem", color:"var(--red)", letterSpacing:"1px" }}>{val}</div>
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.78rem", letterSpacing:"1.5px", color:"var(--text)" }}>{lbl}</div>
      <div style={{ fontSize:"0.78rem", color:"var(--muted2)", marginTop:2, transition:"opacity 0.2s", opacity:hovered?0:1, position:hovered?"absolute":"static" }}>{sub}</div>
      <div style={{ fontSize:"0.82rem", color:"var(--muted2)", marginTop:2, lineHeight:1.4, opacity:hovered?1:0, transition:"opacity 0.2s", position:hovered?"static":"absolute" }}>
        {onClick ? <span style={{ color:"var(--red)" }}>→ {quip}</span> : quip}
      </div>
    </div>
  );
}

type NavFn = (tab: string, params?: Record<string, string>) => void;

export default function Summary({ onNavigate }: { onNavigate: NavFn }) {
  const [statuses, setStatuses] = useState<Record<string, Status>>(loadStatuses);
  const [openFlag, setOpenFlag] = useState<number | null>(null);

  useEffect(() => { saveStatuses(statuses); }, [statuses]);

  const getStatus = (title: string): Status => statuses[title] || "not_started";
  const setStatus = (title: string, s: Status) =>
    setStatuses(prev => ({ ...prev, [title]: s }));

  const doneCount   = NEXT_STEPS.filter(s => getStatus(s.title) === "done").length;
  const nextActions = NEXT_STEPS.filter(s => getStatus(s.title) !== "done").slice(0, 3);

  return (
    <div style={{ maxWidth:1100, margin:"0 auto", padding:"24px 20px 60px" }}>

      {/* ── Overview stats ── */}
      <section style={{ marginBottom:32 }}>
        <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.4rem", letterSpacing:"2px", color:"var(--red)", marginBottom:16 }}>
          Collection Overview
        </h2>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))", gap:12 }}>
          <StatCard val={totalComics.toLocaleString()} lbl="Total Comics"     sub="master inventory"           quip="View Everything"     onClick={() => onNavigate("everything")} />
          <StatCard val={totalBoxes.toString()}        lbl="Total Boxes"      sub="physically organized"       quip="Organized chaos is still organized." />
          <StatCard val={keyCount.toLocaleString()}    lbl="Key Issues"       sub="confirmed across all boxes" quip="View Box Keys"       onClick={() => onNavigate("boxkeys")} />
          <StatCard val={signedCount.toString()}       lbl="Signed Books"     sub="by verified creators"       quip="View Signed"         onClick={() => onNavigate("collection", { signed:"YES" })} />
          <StatCard val={tfCount.toString()}           lbl="Terrificon Books" sub="creator appearances"        quip="Pack the mylar. Leave early." />
          <StatCard val={whatnotCount.toLocaleString()} lbl="Whatnot"         sub="platform assigned"          quip="Live audience. No reserve." />
          <StatCard val={ebayCount.toLocaleString()}   lbl="eBay"             sub="platform assigned"          quip="Set it. Let it breathe." />
          <StatCard val="$25k–$55k"                   lbl="Est. Raw Value"   sub="$60k–$120k+ post-CGC"      quip="Before anyone pressed anything." />
        </div>
      </section>

      {/* ── Flagship Assets ── */}
      <section style={{ marginBottom:32 }}>
        <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.4rem", letterSpacing:"2px", color:"var(--red)", marginBottom:12 }}>
          Flagship Assets
        </h2>
        <p style={{ fontSize:"0.88rem", color:"var(--muted2)", marginBottom:14 }}>Click any card to expand details.</p>
        <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
          {FLAGSHIP.map((a, i) => {
            const isOpen = openFlag === i;
            return (
              <div
                key={a.book}
                onClick={() => setOpenFlag(isOpen ? null : i)}
                style={{
                  flex: isOpen ? "1 1 100%" : "1 1 280px",
                  background:"var(--surface)",
                  border:`1.5px solid ${isOpen ? a.color : a.color+"40"}`,
                  borderLeft:`4px solid ${a.color}`,
                  borderRadius:6, padding:"12px 16px",
                  cursor:"pointer",
                  transition:"flex 0.25s ease, border-color 0.15s, box-shadow 0.15s",
                  boxShadow: isOpen ? `0 4px 16px ${a.color}22` : "none",
                }}
              >
                <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                  {a.terrificon && (
                    <span style={{ fontSize:"0.65rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", background:"#d97706", color:"#fff", borderRadius:3, padding:"1px 7px", flexShrink:0 }}>
                      TERRIFICON
                    </span>
                  )}
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.95rem", letterSpacing:"1px", color:a.color }}>{a.book}</div>
                  <div style={{ marginLeft:"auto", fontSize:"0.75rem", color:"var(--muted)", flexShrink:0 }}>Box {a.box} {isOpen ? "▲" : "▼"}</div>
                </div>
                <div style={{ fontSize:"0.85rem", color:"var(--muted2)", lineHeight:1.5, marginTop:4 }}>{a.note}</div>

                {isOpen && (
                  <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${a.color}30`, display:"flex", flexWrap:"wrap", gap:"10px 32px" }}>
                    {[
                      { l:"Box",       v:`Box ${a.box}` },
                      { l:"Publisher", v:a.publisher },
                      { l:"Year",      v:a.year },
                      { l:"Condition", v:a.condition },
                      { l:"Value",     v:a.valueNM },
                      { l:"CGC Path",  v:a.cgcPath },
                    ].map(r => (
                      <div key={r.l} className="dr" style={{ marginBottom:0 }}>
                        <span className="dl">{r.l}</span>
                        <span className="dv">{r.v}</span>
                      </div>
                    ))}
                    <div style={{ flex:"1 1 100%", marginTop:6, padding:"8px 12px", background:`${a.color}0d`, borderRadius:4, fontSize:"0.88rem", color:a.color, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>
                      → {a.action}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Books per Box ── */}
      <section style={{ marginBottom:32 }}>
        <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.4rem", letterSpacing:"2px", color:"var(--red)", marginBottom:12 }}>
          Books per Box
        </h2>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {[...boxData].sort((a,b) => Number(a.Num) - Number(b.Num)).map(b => (
            <div
              key={b.Num}
              onClick={() => onNavigate("everything", { box: b.Num })}
              title={`Open Everything filtered to Box ${b.Num}`}
              style={{
                background:"var(--surface)", border:"1.5px solid var(--border)",
                borderRadius:5, padding:"8px 14px", textAlign:"center", minWidth:74,
                cursor:"pointer", transition:"border-color 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--red)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(200,16,46,0.12)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
            >
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.3rem", color:"var(--red)" }}>{b.Comics}</div>
              <div style={{ fontSize:"0.72rem", color:"var(--muted2)", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>Box {b.Num}</div>
              {Number(b.Keys)   > 0 && <div style={{ fontSize:"0.68rem", color:"#d97706" }}>{b.Keys} keys</div>}
              {Number(b.Signed) > 0 && <div style={{ fontSize:"0.68rem", color:"#16a34a" }}>{b.Signed} sgnd</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ── Next 3 Actions preview ── */}
      <section>
        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:12, flexWrap:"wrap", gap:10 }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:14 }}>
            <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.4rem", letterSpacing:"2px", color:"var(--red)", margin:0 }}>
              Next Actions
            </h2>
            {doneCount > 0 && (
              <span style={{ fontSize:"0.8rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1.5px", color:"#16a34a" }}>
                {doneCount} / {NEXT_STEPS.length} DONE
              </span>
            )}
          </div>
          <button
            onClick={() => onNavigate("actionplan")}
            style={{
              background:"var(--red)", color:"#fff", border:"none",
              padding:"7px 18px", borderRadius:4, cursor:"pointer",
              fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem",
              letterSpacing:"1.5px", transition:"background 0.15s",
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = "var(--red-dark)")}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = "var(--red)")}
          >
            View All {NEXT_STEPS.length - doneCount} Actions →
          </button>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {nextActions.map((s, i) => (
            <StepCard key={i} step={s} status={getStatus(s.title)} onStatusChange={st => setStatus(s.title, st)} />
          ))}
        </div>
      </section>
    </div>
  );
}
