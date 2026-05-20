import { useState, useEffect } from "react";
import { DATA3 } from "@/data/data3";
import { NEXT_STEPS, Status, StepCard, loadStatuses, saveStatuses } from "./ActionPlan";
import type { NavParams } from "../App";

const comics  = DATA3.comics;
const boxData = DATA3.boxes;

const totalComics  = comics.length;
const totalBoxes   = boxData.length;
const keyCount     = comics.filter(c => (c.Key    || "").toUpperCase() === "YES").length;
const signedCount  = comics.filter(c => (c.Signed || "").toUpperCase() === "YES").length;
const whatnotCount = comics.filter(c => (c.Platform || "").toUpperCase().includes("WHATNOT")).length;
const ebayCount    = comics.filter(c => (c.Platform || "").toUpperCase() === "EBAY").length;
const tfCount      = comics.filter(c => !!(c.Terrificon || "").trim()).length;

const TARGET_BOXES = 65;
const BOX_PCT = Math.round((totalBoxes / TARGET_BOXES) * 100);

const TODAY = new Date(2026, 4, 20);
function daysUntil(y: number, m: number, d: number) {
  return Math.ceil((new Date(y, m - 1, d).getTime() - TODAY.getTime()) / 86400000);
}

const TIMELINE = [
  { label:"Jorge Jiménez CGC SS — Batman #125",       date:"Jun 5",       days:daysUntil(2026,6,5),   urgency:"critical", cat:"Signing"  },
  { label:"Geoff Johns + Fabok SS",                   date:"Jun 26",      days:daysUntil(2026,6,26),  urgency:"high",     cat:"Signing"  },
  { label:"Roy Thomas SS — 5 books → $820–$1,630 ROI",date:"Jul 10",      days:daysUntil(2026,7,10),  urgency:"high",     cat:"Signing"  },
  { label:"CGC Press Batch — ship all simultaneously",date:"Before Aug 7",days:daysUntil(2026,8,1),   urgency:"high",     cat:"CGC"      },
  { label:"✦ TERRIFICON — Jim Lee Sat Aug 8 only",    date:"Aug 7–9",     days:daysUntil(2026,8,7),   urgency:"event",    cat:"Show"     },
  { label:"NYCC — Stan Lee auth + Heritage eval",     date:"Oct 8–11",    days:daysUntil(2026,10,8),  urgency:"medium",   cat:"Show"     },
];

const PUBLISHERS_QS = ["DC","Marvel","Image","IDW","Dark Horse","Valiant","Independent"];
const BOXES_QS      = [...new Set(comics.map(c => c.Box).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));

const SEARCH_FIELDS = [
  { value:"everything", label:"Anything" },
  { value:"title",      label:"Title" },
  { value:"writer",     label:"Writer" },
  { value:"artist",     label:"Artist" },
  { value:"character",  label:"Character / 1st App" },
  { value:"arc",        label:"Arc / Story" },
  { value:"signer",     label:"Signer" },
  { value:"publisher",  label:"Publisher" },
  { value:"box",        label:"Box #" },
  { value:"keysonly",   label:"⭐ Keys Only" },
  { value:"signedonly", label:"✍ Signed Only" },
];

function urgColor(u: string) {
  if (u === "critical") return "#c8102e";
  if (u === "event")    return "#8b2be2";
  if (u === "high")     return "#d97706";
  return "#1d6fa4";
}
function catColor(cat: string) {
  if (cat === "CGC")     return "#8b2be2";
  if (cat === "Signing") return "#d97706";
  if (cat === "Show")    return "#1d6fa4";
  return "#16a34a";
}

const FLAGSHIP = [
  { book:"Stan Lee signed BP #513",                    note:"Authenticate first (PSA/DNA) — $800–$1,500+ auth",         color:"#dc2626", box:"2",  publisher:"Marvel", year:"1966", valueNM:"$800–$1,500 authenticated", condition:"Raw — DO NOT press",            cgcPath:"PSA/DNA at NYCC → CGC × JSA Green Qualified",   action:"NYCC Oct 8–11. Never press. Submit via PSA/DNA first.", terrificon:false },
  { book:"Truth: RWB #1 (Baker remarked)",             note:"Verify remark → Green Qual. → Heritage — $500–$2,000",     color:"#d97706", box:"2",  publisher:"Marvel", year:"2003", valueNM:"$500–$2,000 with remark",   condition:"Has Baker remark",              cgcPath:"CGC × JSA → Green Qualified → Heritage",        action:"Verify remark authenticity before submitting.", terrificon:false },
  { book:"Ultimate Fallout #4 Foil (1st Miles)",       note:"1st Miles Morales — $800–$1,500 CGC 9.8",                  color:"#8b2be2", box:"2",  publisher:"Marvel", year:"2011", valueNM:"$800–$1,500 CGC 9.8",       condition:"Check for pressing",            cgcPath:"Press → CGC Universal Blue 9.8",                action:"Press then submit for Blue Universal label.", terrificon:false },
  { book:"Thor #169 CGC 8.0 (Galactus Origin)",        note:"Already slabbed. Galactus origin. Kirby/Lee. Show 15.",    color:"#1d6fa4", box:"15", publisher:"Marvel", year:"1969", valueNM:"CGC 8.0 — already slabbed", condition:"Slabbed CGC 8.0",               cgcPath:"Already graded — ready for Heritage or auction", action:"Feature in Show 15 — Whatnot anchor book.", terrificon:false },
  { book:"Wolverine #8 (UNSIGNED — 1982)",             note:"Keep unsigned → Yellow SS at Terrificon → $500+ SS 9.8",   color:"#d97706", box:"8",  publisher:"Marvel", year:"1982", valueNM:"$500+ Yellow SS CGC 9.8",   condition:"MUST STAY UNSIGNED",            cgcPath:"Yellow SS at Terrificon → Chris Claremont SS",  action:"Priority #1 at Terrificon. Press before Aug 7. DO NOT sign until con.", terrificon:true },
  { book:"Batman #656 (1st Damian Wayne)",             note:"Press + Blue Universal → $350–$500 CGC 9.8 — Best ROI",    color:"#16a34a", box:"4",  publisher:"DC",     year:"2006", valueNM:"$350–$500 CGC 9.8",         condition:"In press list — send ASAP",     cgcPath:"Press → CGC Universal Blue 9.8",                action:"Press and submit before Terrificon. Best ROI in collection.", terrificon:true },
  { book:"Vision #1 (Tom King signed)",                note:"Press + Green Qual. → $150–$300. Film timing.",            color:"#8b2be2", box:"2",  publisher:"Marvel", year:"2015", valueNM:"$150–$300 Green Qualified",  condition:"Signed — press first",          cgcPath:"Press → CGC × JSA → Green Qualified",           action:"In press batch — submit with the Terrificon batch before Aug 7.", terrificon:false },
  { book:"ASM #361 (1st Carnage — Bagley/Sharen sgd)", note:"Bagley+Sharen. Press + Green Qual. → $200–$300 auth.",    color:"#dc2626", box:"2",  publisher:"Marvel", year:"1992", valueNM:"$200–$300 Green Qualified",  condition:"Dual signed — press first",     cgcPath:"Press → CGC × JSA → Green Qualified",           action:"In press batch — submit with the Terrificon batch before Aug 7.", terrificon:false },
  { book:"Black Lightning #1 (Isabella)",              note:"Press + Green Qual. → $300–$500. Whatnot/Heritage.",       color:"#16a34a", box:"2",  publisher:"DC",     year:"1977", valueNM:"$300–$500 Green Qualified",  condition:"Check for pressing",            cgcPath:"CGC × JSA → Green Qualified",                   action:"Monitor CGC private signing window — high Heritage value.", terrificon:false },
  { book:"Captain Carter #1 (Atwell — To Robert)",    note:"Emotional anchor for Show 1 — personalized signing.",      color:"#1d6fa4", box:"2",  publisher:"Marvel", year:"2022", valueNM:"$80–$150 personalized",      condition:"Signed personalized",           cgcPath:"Whatnot anchor — personal story sells",          action:"Lead Show 1 with the story of the Hayley Atwell signing.", terrificon:false },
];

type NavFn = (tab: string, params?: NavParams) => void;

export default function Summary({ onNavigate }: { onNavigate: NavFn }) {
  const [statuses,     setStatuses]    = useState<Record<string, Status>>(loadStatuses);
  const [openFlag,     setOpenFlag]    = useState<number | null>(null);
  const [searchField,  setSearchField] = useState("everything");
  const [searchVal,    setSearchVal]   = useState("");
  const [searchBox,    setSearchBox]   = useState("");
  const [searchPub,    setSearchPub]   = useState("");

  useEffect(() => { saveStatuses(statuses); }, [statuses]);

  const getStatus = (title: string): Status => statuses[title] || "not_started";
  const setStatus = (title: string, s: Status) => setStatuses(prev => ({ ...prev, [title]: s }));

  const doneCount   = NEXT_STEPS.filter(s => getStatus(s.title) === "done").length;
  const nextActions = NEXT_STEPS.filter(s => getStatus(s.title) !== "done").slice(0, 3);

  const noTextFields = ["keysonly", "signedonly", "publisher", "box"];
  const showTextInput = !noTextFields.includes(searchField);

  function doSearch() {
    if (searchField === "publisher" && searchPub) {
      onNavigate("everything", { publisher: searchPub });
    } else if (searchField === "box" && searchBox) {
      onNavigate("everything", { box: searchBox });
    } else if (searchField === "keysonly") {
      onNavigate("everything", { keysOnly: "true" });
    } else if (searchField === "signedonly") {
      onNavigate("everything", { signed: "YES" });
    } else if (searchVal.trim()) {
      onNavigate("everything", { query: searchVal.trim() });
    }
  }

  return (
    <div style={{ maxWidth:1100, margin:"0 auto", padding:"20px 16px 80px" }}>

      {/* ── Welcome banner ── */}
      <section className="welcome-banner">
        <div className="welcome-text">
          <div className="welcome-title">Welcome back, Roberto.</div>
          <div className="welcome-sub">
            {totalComics.toLocaleString()} comics across {totalBoxes} boxes &mdash; {keyCount.toLocaleString()} keys, {signedCount} signed. You've built something remarkable.
          </div>
        </div>
        <div className="welcome-date">Updated May 20, 2026</div>
      </section>

      {/* ── Quick Search ── */}
      <section className="qs-section">
        <div className="qs-header">
          <span className="qs-title">FIND A BOOK</span>
          <span className="qs-sub">search by field → results appear in Every Book</span>
        </div>
        <div className="qs-row">
          <select
            className="qs-field-select"
            value={searchField}
            onChange={e => { setSearchField(e.target.value); setSearchVal(""); setSearchBox(""); setSearchPub(""); }}
          >
            {SEARCH_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>

          {showTextInput && (
            <input
              className="qs-input"
              placeholder={
                searchField === "writer"    ? "e.g. Tom King, Grant Morrison, Christopher Priest…" :
                searchField === "artist"    ? "e.g. Jim Lee, Andy Kubert, Brian Stelfreeze…" :
                searchField === "character" ? "e.g. Miles Morales, Damian Wayne, Storm…" :
                searchField === "arc"       ? "e.g. Batman and Son, Krakoa Era, Hickman FF…" :
                searchField === "signer"    ? "e.g. Skottie Young, Tony Isabella, Tom King…" :
                searchField === "title"     ? "e.g. Batman, Black Panther, Wolverine…" :
                "title, writer, artist, character, arc, signer…"
              }
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doSearch()}
              autoFocus
            />
          )}

          {searchField === "publisher" && (
            <select className="qs-field-select" value={searchPub} onChange={e => setSearchPub(e.target.value)}>
              <option value="">Choose publisher…</option>
              {PUBLISHERS_QS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}

          {searchField === "box" && (
            <select className="qs-field-select" value={searchBox} onChange={e => setSearchBox(e.target.value)}>
              <option value="">Choose box…</option>
              {BOXES_QS.map(b => <option key={b} value={b}>Box {b}</option>)}
            </select>
          )}

          <button className="qs-btn" onClick={doSearch}>
            Search →
          </button>
        </div>

        {/* Quick pills */}
        <div className="qs-pills">
          <span className="qs-pill-label">Quick:</span>
          {["Tom King","Jim Lee","Christopher Priest","Grant Morrison","Krakoa","X-Men","Black Panther","Batman"].map(term => (
            <button key={term} className="qs-pill" onClick={() => { setSearchField("everything"); onNavigate("everything", { query: term }); }}>
              {term}
            </button>
          ))}
          <button className="qs-pill qs-pill-key" onClick={() => onNavigate("everything", { keysOnly: "true" })}>⭐ All Keys</button>
          <button className="qs-pill qs-pill-sgn" onClick={() => onNavigate("everything", { signed: "YES" })}>✍ All Signed</button>
        </div>
      </section>

      {/* ── Box Progress ── */}
      <section className="progress-section">
        <div className="progress-header">
          <div>
            <span className="progress-title">BOX COLLECTION PROGRESS</span>
            <span className="progress-fraction">{totalBoxes} of {TARGET_BOXES} boxes catalogued</span>
          </div>
          <div className="progress-pct">{BOX_PCT}%</div>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width:`${BOX_PCT}%` }} />
          {[...Array(TARGET_BOXES)].map((_,i) => (
            <div key={i} className={`progress-tick ${i < totalBoxes ? "filled" : ""}`} style={{ left:`${((i+1)/TARGET_BOXES)*100}%` }} />
          ))}
        </div>
        <div className="progress-sub">{TARGET_BOXES - totalBoxes} more boxes to go — you're more than halfway there, Roberto.</div>
      </section>

      {/* ── Upcoming ── */}
      <section style={{ marginBottom:32 }}>
        <h2 className="section-h2">⚡ COMING UP</h2>
        <div className="timeline-grid">
          {TIMELINE.filter(t => t.days >= 0).map((t, i) => (
            <div key={i} className="timeline-card" style={{ borderLeftColor: urgColor(t.urgency) }}>
              <div className="timeline-days" style={{ color: urgColor(t.urgency) }}>
                {t.days === 0 ? "TODAY" : `${t.days}d`}
              </div>
              <div className="timeline-body">
                <div className="timeline-label">{t.label}</div>
                <div className="timeline-date">
                  {t.date}
                  <span className="timeline-cat" style={{ background: catColor(t.cat)+"22", color: catColor(t.cat) }}>{t.cat}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Collection overview stats ── */}
      <section style={{ marginBottom:32 }}>
        <h2 className="section-h2">📊 COLLECTION</h2>
        <div className="stat-grid">
          {[
            { val:totalComics.toLocaleString(), lbl:"Total Comics",     sub:"master inventory",        click:()=>onNavigate("everything",{}),              color:"#c8102e" },
            { val:keyCount.toLocaleString(),    lbl:"Key Issues",        sub:"confirmed across all",    click:()=>onNavigate("boxkeys"),                     color:"#d97706" },
            { val:signedCount.toString(),       lbl:"Signed Books",      sub:"by verified creators",    click:()=>onNavigate("everything",{signed:"YES"}),   color:"#8b2be2" },
            { val:totalBoxes.toString(),        lbl:"Boxes",             sub:"physically catalogued",   click:()=>onNavigate("everything",{}),              color:"#1d6fa4" },
            { val:tfCount.toString(),           lbl:"Terrificon Books",  sub:"creator appearances",     click:undefined,                                     color:"#d97706" },
            { val:whatnotCount.toLocaleString(),lbl:"Whatnot",           sub:"assigned to platform",    click:undefined,                                     color:"#16a34a" },
            { val:ebayCount.toLocaleString(),   lbl:"eBay",              sub:"assigned to platform",    click:undefined,                                     color:"#6b7280" },
            { val:`${Math.round((keyCount/totalComics)*100)}%`, lbl:"Key Rate", sub:"of total collection", click:undefined, color:"#d97706" },
          ].map((s, i) => (
            <div key={i} className={`stat-tile${s.click?" clickable":""}`} onClick={s.click} style={{ borderTopColor: s.color }}>
              <div className="stat-tile-val" style={{ color: s.color }}>{s.val}</div>
              <div className="stat-tile-lbl">{s.lbl}</div>
              <div className="stat-tile-sub">{s.sub}</div>
              {s.click && <div className="stat-tile-cta">View →</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ── Flagship Assets ── */}
      <section style={{ marginBottom:32 }}>
        <h2 className="section-h2">🏆 FLAGSHIP ASSETS</h2>
        <p style={{ fontSize:"0.82rem", color:"var(--muted2)", marginBottom:12 }}>Your highest-value books — click any card for full action details.</p>
        <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
          {FLAGSHIP.map((a, i) => {
            const isOpen = openFlag === i;
            return (
              <div
                key={a.book}
                onClick={() => setOpenFlag(isOpen ? null : i)}
                className="flagship-card"
                style={{
                  flex: isOpen ? "1 1 100%" : "1 1 280px",
                  borderLeftColor: a.color,
                  borderColor: isOpen ? a.color : a.color+"50",
                  boxShadow: isOpen ? `0 4px 16px ${a.color}20` : "none",
                }}
              >
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  {a.terrificon && <span className="tf-badge">TERRIFICON</span>}
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.92rem", letterSpacing:"1px", color:a.color, flex:1 }}>{a.book}</div>
                  <div style={{ fontSize:"0.7rem", color:"var(--muted)", flexShrink:0 }}>Box {a.box} {isOpen?"▲":"▼"}</div>
                </div>
                <div style={{ fontSize:"0.82rem", color:"var(--muted2)", lineHeight:1.5, marginTop:4 }}>{a.note}</div>

                {isOpen && (
                  <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${a.color}30`, display:"flex", flexWrap:"wrap", gap:"10px 28px" }}>
                    {[
                      { l:"Box",       v:`Box ${a.box}` },
                      { l:"Publisher", v:a.publisher },
                      { l:"Year",      v:a.year },
                      { l:"Condition", v:a.condition },
                      { l:"Value",     v:a.valueNM },
                      { l:"CGC Path",  v:a.cgcPath },
                    ].map(r => (
                      <div key={r.l} className="dr">
                        <span className="dl">{r.l}</span>
                        <span className="dv">{r.v}</span>
                      </div>
                    ))}
                    <div style={{ flex:"1 1 100%", marginTop:6, padding:"8px 12px", background:`${a.color}0d`, borderRadius:4, fontSize:"0.85rem", color:a.color, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>
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
        <h2 className="section-h2">📦 BOOKS PER BOX</h2>
        <div className="boxes-grid">
          {[...boxData].sort((a,b)=>Number(a.Num)-Number(b.Num)).map(b => (
            <div
              key={b.Num}
              onClick={() => onNavigate("everything", { box: b.Num })}
              className="box-tile"
              title={b.Description}
            >
              <div className="box-tile-count">{b.Comics}</div>
              <div className="box-tile-num">Box {b.Num}</div>
              {Number(b.Keys)   > 0 && <div className="box-tile-keys">{b.Keys}k</div>}
              {Number(b.Signed) > 0 && <div className="box-tile-sgn">{b.Signed}s</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ── Next Actions ── */}
      <section>
        <div className="actions-header">
          <div style={{ display:"flex", alignItems:"baseline", gap:14 }}>
            <h2 className="section-h2" style={{ margin:0 }}>✅ NEXT ACTIONS</h2>
            {doneCount > 0 && (
              <span style={{ fontSize:"0.75rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1.5px", color:"#16a34a" }}>
                {doneCount}/{NEXT_STEPS.length} DONE
              </span>
            )}
          </div>
          <button className="btn-view-all" onClick={() => onNavigate("actionplan")}>
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
