import { useState, useEffect } from "react";

export const NEXT_STEPS = [
  { urgency:"critical", deadline:"ASAP",          title:"Authenticate Stan Lee BP #513 BEFORE any streaming or sale",                 detail:"Your most valuable single book ($800–$1,500+ authenticated). Do NOT press. Submit via PSA/DNA at NYCC or CGC × JSA. Never stream ungraded.",                                                                                      category:"CGC"     },
  { urgency:"critical", deadline:"Jun 5 ⚠️",      title:"Jorge Jiménez CGC SS — Batman #125 — DEADLINE IMMINENT",                    detail:"Batman #125 (Failsafe arc — Jiménez drew it). Press and submit immediately. This deadline is days away.",                                                                                                              category:"Signing" },
  { urgency:"critical", deadline:"This week",      title:"Bag Box 15 — DC New 52 (ALL UNBAGGED)",                                     detail:"Batman Annual #1 (Mr. Freeze key), Batman Europa #1 (Jim Lee), Superman Unchained #1 (Snyder/Lee) are all unbagged. CGC will not accept unbagged books.",                                                                   category:"Bagging" },
  { urgency:"high",     deadline:"Jun 26",         title:"Geoff Johns + Jason Fabok CGC SS — JL #21 + JSA",                           detail:"Johns sig adds to existing unwitnessed VA sigs = yellow/green combo label. Pull books, sleeve, ship. Deadline Jun 26.",                                                                                                  category:"Signing" },
  { urgency:"high",     deadline:"Jul 10",         title:"Roy Thomas — 5 books = $450 fees → $820–$1,630 return",                     detail:"Avengers #60, #87, King-Size #2, Marvel Premiere #1, Saga Human Torch #3. Thomas co-created Wolverine, Vision, Carol Danvers, Adam Warlock. High ROI signing.",                                                         category:"Signing" },
  { urgency:"high",     deadline:"Jul 10",         title:"Mike Mayhew CGC SS — ASM #50 Alex Ross Timeless Virgin",                    detail:"Already signed — submit via CGC × JSA green Qualified path. $100–200 authenticated. Same deadline as Roy Thomas.",                                                                                                     category:"Signing" },
  { urgency:"high",     deadline:"Before Aug 7",   title:"Press CGC batch — submit all simultaneously to save shipping",              detail:"Batman #656+#657, Wolverine #8 (UNSIGNED), ASM #361, Vision #1, Secret Wars #1, NW #1, Mockingbird #8, WildCATs #2/#11, Savage Dragon #1, Transformers #1. Cost $15–25/book.",                                          category:"CGC"     },
  { urgency:"high",     deadline:"Before Aug 7",   title:"Bag Box 25 (DC Rebirth, 10% bagged) — keys first",                          detail:"DC Universe Rebirth Special #1, Batman #21+#22 (The Button), Batman #50, Hawkman #1, Justice League #1 Snyder. All unbagged keys.",                                                                                    category:"Bagging" },
  { urgency:"high",     deadline:"Before Aug 7",   title:"Bag Box 26 (X-Men, 20% bagged) — keys first",                               detail:"Deadpool #1 (Way/Medina 2008), Old Man Logan #71–72, Extreme X-Men #1, New Mutants #1 (2009). Keys bag first.",                                                                                                        category:"Bagging" },
  { urgency:"high",     deadline:"Aug 8 SHARP",    title:"Terrificon — Jim Lee is SATURDAY AUG 8 ONLY — arrive 10am",                 detail:"Hotel: Hyatt code G-TRFC. Bring UNSIGNED books for yellow SS label. Wolverine #8 unsigned = priority #1 ($500+ SS 9.8). Verify Agent of Slabs presence. DO NOT bring already-signed books for yellow SS.",                category:"Show"    },
  { urgency:"medium",   deadline:"Oct 8–11",       title:"NYCC — Stan Lee BP #513 authentication + Heritage networking",               detail:"Bring BP #513 for PSA/DNA authentication. Bring Thor #169 CGC 8.0 (slabbed) for Heritage dealer evaluation. Buy budget $100–300 for undervalued keys.",                                                               category:"Show"    },
  { urgency:"medium",   deadline:"Ongoing",        title:"Bag Box 23 (Cap America, 10%) + Box 24 (DC Mixed, 10%)",                    detail:"Box 23: Cap #1 Brubaker, Cap #25 (Death of Cap), Cap #600. Box 24: Batman/Superman World's Finest #1, Far Sector #1, Infinite Frontier #0. Keys first.",                                                           category:"Bagging" },
  { urgency:"low",      deadline:"Ongoing",        title:"eBay Now — reader/poor condition issues, no pressing required",              detail:"Flash Vol 2 #112–125 (low grade), ASM #583 (water damage), Aquaman #58–74, Extreme X-Men #6–25, New Mutants DeFilippis #1–13. Start at $1–3 each or bundle lots.",                                                   category:"Sales"   },
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
          Action Plan
        </h2>
        {doneCount > 0 && (
          <span style={{ fontSize:"0.8rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1.5px", color:"#16a34a" }}>
            {doneCount} / {NEXT_STEPS.length} DONE
          </span>
        )}
      </div>
      <p style={{ fontSize:"0.9rem", color:"var(--muted2)", marginBottom:20 }}>
        As of May 18, 2026 — Business Plan v4. Critical items first.
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
