import { useState, useEffect } from "react";
import { DATA } from "@/data/data";
const _d = DATA.comics;
const _b = DATA.boxes;
const _LIVE_STATS = `May 2026 — Business Plan v6. ${_d.length.toLocaleString()} comics · ${_b.length} boxes · ${_d.filter(c=>(c.Key||"").toUpperCase()==="YES").length.toLocaleString()} keys · ${_d.filter(c=>(c.Signed||"").toUpperCase()==="YES").length} signed. Critical items first.`;

export const NEXT_STEPS = [
  { urgency:"critical", deadline:"This week",    title:"Submit BP #513 to CGC × JSA — Stan Lee Dynamic Forces COA",               detail:"Stan Lee signed Black Panther #513 — Dynamic Forces COA accepted by CGC. Fill cgccomics.com form, include COA, ship insured. DO NOT press. DO NOT stream until graded. $800–1,500 authenticated vs $400 raw — best single ROI in the collection.",  category:"CGC"      },
  { urgency:"critical", deadline:"This week",    title:"Book Terrificon Hotel — Hyatt Regency Mohegan Sun, code G-TRFC",           detail:"Hyatt Regency Mohegan Sun, Uncasville CT. Code G-TRFC. Jim Lee is SATURDAY AUG 8 ONLY. 76 days out and this fills up fast. Book immediately to protect the entire Terrificon strategy.",                                                                 category:"Show"     },
  { urgency:"critical", deadline:"This week",    title:"Bag Box 08 — DC New 52 ALL UNBAGGED — Jim Lee targets inside",             detail:"Superman Unchained #1 and Batman Europa #1 are Jim Lee Terrificon targets for Yellow SS. Both currently unbagged in Box 08. Bag every book: keys in mylar, runs in poly. CGC will not accept unbagged books. Protects $200+ in Yellow SS value.",    category:"Bagging"  },
  { urgency:"critical", deadline:"This week",    title:"Identify new signed WildCATs — which issue, who signed?",                  detail:"New WildCATs purchase — confirm which issue and whose signature. One sentence updates the entire CGC × JSA submission queue. Determines if it goes in the current Green Qualified batch or a separate mail-in submission.",                               category:"Signing"  },
  { urgency:"high",     deadline:"Jun 5 ⚠️",    title:"Jorge Jiménez CGC SS — Batman #125 — DEADLINE MAY HAVE PASSED",            detail:"Batman #125 (Failsafe Part 1 — Jiménez drew it). Jun 5 deadline — confirm submitted. Pull from Box 43 (DC Rebirth). Press first, then CGC Modern Tier. Green Qualified label (already signed). Check cgccomics.com/signature-series/ immediately.",   category:"Signing"  },
  { urgency:"high",     deadline:"Jun 26",       title:"Geoff Johns + Jason Fabok CGC SS — Justice League #21 + JSA run",          detail:"Justice League #21 + JSA run books. Submit NOW before Jun 26 deadline. Pull from Box 46 (DC Earth 2 + JL New 52). Johns sig adds to existing unwitnessed VA sigs = Yellow/Green combo label. Do not miss this deadline.",                           category:"Signing"  },
  { urgency:"high",     deadline:"Jun 2026",     title:"Hunt New Mutants #98 — first Deadpool — check Box 39 first",               detail:"Box 39 has NM #93 and #97 — #98 is the first Deadpool. Physical proximity makes it near-certain. Also check ALL_BOXES import (Boxes 17–29). Raw NM value: $800+. The single most valuable likely-unfound book in the collection.",               category:"Inventory"},
  { urgency:"high",     deadline:"Jun 2026",     title:"Press + submit Batman #656 & #657 — 1st and 2nd Damian Wayne",             detail:"Best single-book ROI after Stan Lee. Press first (CGC pressing service or Crushing Comics), then CGC Modern tier. $73 in fees per book = $350–500 out. Combined CGC 9.8 value: $550–900 on $200 investment. Both in Box 01.",                     category:"CGC"      },
  { urgency:"high",     deadline:"Jul 10",       title:"Roy Thomas — 5 books SUBMITTED — confirm CGC receipt",                     detail:"Avengers #60, #87, King-Size #2, Marvel Premiere #1, Saga Human Torch #3 — already submitted. Confirm CGC received the package and track return timeline. Expected return $820–1,630 on $485 investment. Thomas co-created Wolverine, Vision, Carol Danvers.", category:"Signing" },
  { urgency:"high",     deadline:"Jul 10",       title:"Mike Mayhew CGC SS — ASM #50 Alex Ross Timeless Virgin",                   detail:"Already signed via Lachima private signing. Submit via CGC × JSA Yellow/Black path. Same deadline as Roy Thomas — combine shipping. $100–200 authenticated. Pull from Box 16 (Spider-Man Archive). Deadline Jul 10 — do not miss.",                   category:"Signing"  },
  { urgency:"high",     deadline:"Before Aug 7", title:"Yellow/Black CGC × JSA batch — press all, submit together",                detail:"Press first: Vision #1, Black Lightning #1, New Warriors #1, WildCATs #3, Savage Dragon #1, Thor #339, MOS #18/#19, Mockingbird #8, NM #96, Transformers Compendium #1, Cap Carter, Agent Carter, Hawkeye Freefall #1. Submit as one CGC × JSA batch. Cost: $15–25/book press.", category:"CGC" },
  { urgency:"high",     deadline:"Aug 7",        title:"Terrificon — Wolverine #8 — KEEP UNSIGNED — Chris Claremont Yellow SS",    detail:"Box 72 (Variants). Priority #1 Terrificon target. Chris Claremont is confirmed all 3 days. Yellow SS 9.8 = $500+ vs $80 raw. DO NOT sign this book before August 7. DO NOT bring already-signed books for Yellow SS — it breaks the label.",         category:"Show"     },
  { urgency:"high",     deadline:"Aug 7",        title:"Terrificon — Moon Knight Vol 6 #1–6 — Declan Shalvey Yellow SS ×6",        detail:"Box 50 (Moon Knight). Pull all 6 issues. Shalvey is confirmed and he DREW these books. Six Yellow SS signings = up to $1,200 in authenticated value from books currently worth ~$25 raw each. Most scalable ROI at Terrificon.",                      category:"Show"     },
  { urgency:"high",     deadline:"Aug 8 10am",   title:"Terrificon — Jim Lee SATURDAY ONLY — arrive 10am sharp",                   detail:"Jim Lee is SATURDAY AUG 8 ONLY. Arrive 10am. Targets: Superman Unchained #1 + Batman Europa #1 (both in Box 08 — BAG FIRST). Also: Flash #164 → Mark Waid + LaRocque (dual confirmed), X-Men Legends #4 → Walt + Louise Simonson (both confirmed).", category:"Show"    },
  { urgency:"medium",   deadline:"Oct 8–11",     title:"NYCC 2026 — Heritage networking + dealer floor buy",                       detail:"BP #513 already handled via CGC × JSA — no NYCC action needed for that book. Bring Thor #169 CGC 8.0 (slabbed) for Heritage dealer evaluation. Buy budget: $100–300 for undervalued keys on the dealer floor. Post-NYCC haul show Oct 14 is your highest-engagement Q4 Whatnot show.", category:"Show" },
  { urgency:"low",      deadline:"Ongoing",      title:"eBay passive listings — reader/poor condition issues",                      detail:"Flash Vol 2 #112–125 (low grade), ASM #583 (water damage), non-key run issues, duplicates, UK sticker variants. Start at $1–3 each or bundle lots. Set and forget. Right buyer finds it — no story pitch needed.",                               category:"Sales"    },
];

export type Status = "not_started" | "started" | "stalled" | "delayed" | "done";

export const STATUS_OPTIONS: { value: Status; label: string; color: string }[] = [
  { value:"not_started", label:"Not Started", color:"#6b7280" },
  { value:"started",     label:"Started",     color:"#1d6fa4" },
  { value:"stalled",     label:"Stalled",     color:"#d97706" },
  { value:"delayed",     label:"Delayed",     color:"#c2410c" },
  { value:"done",        label:"Done ✓",      color:"#16a34a" },
];

export const LS_KEY = "brbActionStatus";

export function loadStatuses(): Record<string, Status> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
  catch { return {}; }
}
export function saveStatuses(s: Record<string, Status>) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

function catColor(cat: string) {
  if (cat === "CGC")       return "#8b2be2";
  if (cat === "Signing")   return "#c8102e";
  if (cat === "Bagging")   return "#d97706";
  if (cat === "Show")      return "#1d6fa4";
  if (cat === "Sales")     return "#16a34a";
  if (cat === "Inventory") return "#0f766e";
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
      background:m.color+"15", border:`1.5px solid ${m.color}`,
      borderRadius:3, padding:"2px 9px",
      fontSize:"0.7rem", fontFamily:"'Bebas Neue',sans-serif",
      letterSpacing:"1px", color:m.color,
    }}>{m.label}</span>
  );
}

export function StepCard({
  step, status, onStatusChange,
}: {
  step: typeof NEXT_STEPS[number];
  status: Status;
  onStatusChange: (s: Status) => void;
}) {
  const cc     = catColor(step.category);
  const isDone = status === "done";
  const statusObj = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];

  return (
    <div style={{
      display:"flex", gap:16, alignItems:"flex-start",
      border:"1.5px solid var(--border)", borderRadius:6,
      padding:"14px 18px", background:"var(--surface)",
      borderLeft:`3px solid ${step.urgency==="critical"?"#dc2626":step.urgency==="high"?"#d97706":"var(--border)"}`,
      opacity: isDone ? 0.45 : 1, transition:"opacity 0.2s",
    }}>
      <div style={{ flex:"0 0 auto", display:"flex", flexDirection:"column", alignItems:"center", gap:6, minWidth:80 }}>
        <UrgencyBadge u={step.urgency} />
        <span style={{
          fontSize:"0.7rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
          background:cc+"18", border:`1px solid ${cc}`, color:cc,
          borderRadius:3, padding:"2px 8px",
        }}>{step.category}</span>
        <span style={{ fontSize:"0.72rem", color:step.urgency==="critical"?"#dc2626":"var(--muted2)", fontWeight:step.urgency==="critical"?700:400 }}>
          {step.deadline}
        </span>
      </div>

      <div style={{ flex:1 }}>
        <div style={{
          fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem", letterSpacing:"1px",
          color:"var(--text)", marginBottom:4,
          textDecoration: isDone ? "line-through" : "none",
        }}>{step.title}</div>
        <div style={{ fontSize:"0.88rem", color:"var(--muted2)", lineHeight:1.6 }}>{step.detail}</div>
      </div>

      <div style={{ flex:"0 0 auto", display:"flex", flexDirection:"column", alignItems:"flex-end", gap:9 }}>
        <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", userSelect:"none" }}>
          <div
            onClick={() => onStatusChange(isDone ? "not_started" : "done")}
            style={{
              width:20, height:20, borderRadius:4,
              border:`2px solid ${isDone ? "#16a34a" : "var(--border)"}`,
              background: isDone ? "#16a34a" : "transparent",
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", transition:"all 0.15s", flexShrink:0,
            }}
          >
            {isDone && <span style={{ color:"#fff", fontSize:"0.75rem", lineHeight:1 }}>✓</span>}
          </div>
          <span style={{ fontSize:"0.7rem", color:"var(--muted2)", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>DONE</span>
        </label>

        <select
          value={status}
          onChange={e => onStatusChange(e.target.value as Status)}
          onClick={e => e.stopPropagation()}
          style={{
            background:"var(--surface2)", border:`1px solid ${statusObj.color}`,
            color:statusObj.color, borderRadius:4,
            fontSize:"0.7rem", fontFamily:"'Bebas Neue',sans-serif",
            letterSpacing:"1px", padding:"4px 8px", cursor:"pointer",
            outline:"none", appearance:"none", textAlign:"center",
          }}
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function ActionPlan() {
  const [statuses, setStatuses] = useState<Record<string, Status>>(loadStatuses);
  useEffect(() => { saveStatuses(statuses); }, [statuses]);

  const setStatus = (title: string, s: Status) =>
    setStatuses(prev => ({ ...prev, [title]: s }));
  const getStatus = (title: string): Status => statuses[title] || "not_started";

  const critical = NEXT_STEPS.filter(s => s.urgency === "critical");
  const high     = NEXT_STEPS.filter(s => s.urgency === "high");
  const rest     = NEXT_STEPS.filter(s => s.urgency !== "critical" && s.urgency !== "high");
  const doneCount = NEXT_STEPS.filter(s => getStatus(s.title) === "done").length;

  return (
    <div style={{ maxWidth:1100, margin:"0 auto", padding:"24px 20px 60px" }}>
      <div style={{ display:"flex", alignItems:"baseline", gap:16, marginBottom:8 }}>
        <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.4rem", letterSpacing:"2px", color:"var(--red)", margin:0 }}>
          Action Plan — v5
        </h2>
        {doneCount > 0 && (
          <span style={{ fontSize:"0.8rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1.5px", color:"#16a34a" }}>
            {doneCount} / {NEXT_STEPS.length} DONE
          </span>
        )}
      </div>
      <p style={{ fontSize:"0.9rem", color:"var(--muted2)", marginBottom:20 }}>
        {_LIVE_STATS}
      </p>

      {critical.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.8rem", letterSpacing:"2px", color:"#dc2626", marginBottom:10 }}>🔴 CRITICAL — ACT NOW</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {critical.map((s,i) => <StepCard key={i} step={s} status={getStatus(s.title)} onStatusChange={st=>setStatus(s.title,st)} />)}
          </div>
        </div>
      )}

      {high.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.8rem", letterSpacing:"2px", color:"#d97706", marginBottom:10, marginTop:24 }}>🟠 HIGH PRIORITY</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {high.map((s,i) => <StepCard key={i} step={s} status={getStatus(s.title)} onStatusChange={st=>setStatus(s.title,st)} />)}
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.8rem", letterSpacing:"2px", color:"var(--muted2)", marginBottom:10, marginTop:24 }}>UPCOMING & ONGOING</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {rest.map((s,i) => <StepCard key={i} step={s} status={getStatus(s.title)} onStatusChange={st=>setStatus(s.title,st)} />)}
          </div>
        </div>
      )}
    </div>
  );
}
