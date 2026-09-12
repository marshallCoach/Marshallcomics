import { useState, useEffect } from "react";
import { DATA } from "@/data/data";
const _d = DATA.comics;
const _b = DATA.boxes;
const _LIVE_STATS = `Jul 2026 — Action Plan v6, refreshed from the Jul 7 Action Plan + Business Plan docs. ${_d.length.toLocaleString()} comics · ${_b.length} boxes · ${_d.filter(c=>(c.Key||"").toUpperCase()==="YES").length.toLocaleString()} keys · ${_d.filter(c=>(c.Signed||"").toUpperCase()==="YES").length} signed. Terrificon Aug 7 is the driving deadline.`;

export const NEXT_STEPS = [
  { urgency:"critical", deadline:"ASAP",        title:"Call Magic Pressing — confirm real turnaround time",                        detail:"No turnaround estimate has been confirmed. This determines whether Uncanny X-Men #141/142 and every other Terrificon pressing candidate can realistically be ready by Aug 7. Do this before boxing any more signing candidates.", category:"CGC" },
  { urgency:"critical", deadline:"Photos: tomorrow AM", title:"List eBay Phase 1 — 19 books, fully data-ready",                     detail:"Photo/listing guide already exists (eBay_Phase1_Listing_Guide.md). No data blocker remains — the only step left is taking photos in natural daylight and listing. Est. return $300–400.", category:"Sales" },
  { urgency:"critical", deadline:"Before Aug 7", title:"Uncanny X-Men #141 & #142 (Days of Future Past) — confirm pressing on track", detail:"Most valuable Terrificon signing target currently owned — top priority over every other Claremont book. Status as of this session: sent to Magic Pressing → CGC, condition NM (raw), not signed, CGC grade pending. Confirm turnaround lands before Aug 7.", category:"Show" },
  { urgency:"high",     deadline:"Aug 7–9",     title:"Wolverine #8 (1982) — keep UNSIGNED until Terrificon",                       detail:"Sequence matters: Chris Claremont signs at Terrificon (all 3 days) FIRST, then Frank Miller signs at NYCC SECOND, for the combo signature. Do not reverse this order or sign it anywhere in between.", category:"Show" },
  { urgency:"high",     deadline:"Sat Aug 8, 10am", title:"Superman Unchained #1 — Jim Lee, Saturday only",                        detail:"Grade 8.5–9.0. Jim Lee confirmed Saturday only, arrive 10am.", category:"Show" },
  { urgency:"high",     deadline:"Sat Aug 8, 10am", title:"Batman Europa #1 — Jim Lee, Saturday only",                             detail:"Grade 9.4–9.6. Same Jim Lee Saturday window as Superman Unchained #1.", category:"Show" },
  { urgency:"medium",   deadline:"Aug 7–9",     title:"What If? #105 — Ron Frenz, all 3 days",                                     detail:"1st Spider-Girl.", category:"Show" },
  { urgency:"medium",   deadline:"Aug 7–9",     title:"Thor #390 — Ron Frenz + Brett Breeding, all 3 days",                        detail:"1st Cap lifts Mjolnir.", category:"Show" },
  { urgency:"medium",   deadline:"Before Aug 7", title:"Resolve: is the Jim Lee 4-signature pack con-specific or remote?",          detail:"Mechanism (witnessed con slots vs. remote/mail-in service) is still unconfirmed — it determines which books actually qualify. Resolve before finalizing target books for Terrificon or NYCC.", category:"Signing" },
  { urgency:"medium",   deadline:"Before NYCC", title:"Absolute Batman — confirm CGC post-grading signature path",                 detail:"7 of an originally-misstated 20 books remain unsigned/unpressed. #1 is already at CGC UNSIGNED. Confirm with CGC whether a post-grading signature path exists before assuming the remaining 7 follow the same process.", category:"CGC" },
  { urgency:"medium",   deadline:"Ongoing",     title:"Source 6 new-purchase titles flagged NEEDS VERIFY",                         detail:"Fury of Firestorm #4, Transformers #34, Doctor Who: Circuit Breaker, Barbara Gordon: Breakout #3, Absolute Catwoman #2, Destination Kill #3 — added Box 101/102/103, credits unconfirmed.", category:"Inventory" },
  { urgency:"medium",   deadline:"Check Aug 4", title:"Black Panther #513 (Stan Lee) — at CCS, DO NOT PRESS",                       detail:"In the active CGC submission pipeline. Check status Aug 4.", category:"CGC" },
  { urgency:"medium",   deadline:"Check Aug 4", title:"ASM #361 (Bagley/Sharen) — at CGC",                                          detail:"In the active CGC submission pipeline. Check status Aug 4.", category:"CGC" },
  { urgency:"low",      deadline:"Shipped ahead of Jul 10", title:"Avengers #60, #62, #87 — AT CGC, Roy Thomas SS",                 detail:"Already shipped — tracking only, no action needed unless CGC flags an issue.", category:"Signing" },
  { urgency:"low",      deadline:"Not urgent",  title:"Heroes Reborn: Doomsday #1 (2000) — third Claremont book, lowest priority",  detail:"Vintage back-issue pickup (Claremont/McKone/McKenna), not part of any weekly haul. Yields to Uncanny X-Men #141/142 without hesitation if Claremont signing capacity at Terrificon is limited.", category:"Signing" },
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
      fontSize:"0.875rem", fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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
          fontSize:"0.875rem", fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing:"1px",
          background:cc+"18", border:`1px solid ${cc}`, color:cc,
          borderRadius:3, padding:"2px 8px",
        }}>{step.category}</span>
        <span style={{ fontSize:"0.875rem", color:step.urgency==="critical"?"#dc2626":"var(--muted2)", fontWeight:step.urgency==="critical"?700:400 }}>
          {step.deadline}
        </span>
      </div>

      <div style={{ flex:1 }}>
        <div style={{
          fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize:"0.875rem", letterSpacing:"1px",
          color:"var(--text)", marginBottom:4,
          textDecoration: isDone ? "line-through" : "none",
        }}>{step.title}</div>
        <div style={{ fontSize:"0.875rem", color:"var(--muted2)", lineHeight:1.6 }}>{step.detail}</div>
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
            {isDone && <span style={{ color:"#fff", fontSize:"0.875rem", lineHeight:1 }}>✓</span>}
          </div>
          <span style={{ fontSize:"0.875rem", color:"var(--muted2)", fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing:"1px" }}>DONE</span>
        </label>

        <select
          value={status}
          onChange={e => onStatusChange(e.target.value as Status)}
          onClick={e => e.stopPropagation()}
          style={{
            background:"var(--surface2)", border:`1px solid ${statusObj.color}`,
            color:statusObj.color, borderRadius:4,
            fontSize:"0.875rem", fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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
        <h2 style={{ fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize:"1.75rem", letterSpacing:"2px", color:"var(--red)", margin:0 }}>
          Action Plan — v6
        </h2>
        {doneCount > 0 && (
          <span style={{ fontSize:"0.875rem", fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing:"1.5px", color:"#16a34a" }}>
            {doneCount} / {NEXT_STEPS.length} DONE
          </span>
        )}
      </div>
      <p style={{ fontSize:"0.875rem", color:"var(--muted2)", marginBottom:20 }}>
        {_LIVE_STATS}
      </p>

      {critical.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize:"0.875rem", letterSpacing:"2px", color:"#dc2626", marginBottom:10 }}>🔴 CRITICAL — ACT NOW</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {critical.map((s,i) => <StepCard key={i} step={s} status={getStatus(s.title)} onStatusChange={st=>setStatus(s.title,st)} />)}
          </div>
        </div>
      )}

      {high.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize:"0.875rem", letterSpacing:"2px", color:"#d97706", marginBottom:10, marginTop:24 }}>🟠 HIGH PRIORITY</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {high.map((s,i) => <StepCard key={i} step={s} status={getStatus(s.title)} onStatusChange={st=>setStatus(s.title,st)} />)}
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <div>
          <div style={{ fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize:"0.875rem", letterSpacing:"2px", color:"var(--muted2)", marginBottom:10, marginTop:24 }}>UPCOMING & ONGOING</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {rest.map((s,i) => <StepCard key={i} step={s} status={getStatus(s.title)} onStatusChange={st=>setStatus(s.title,st)} />)}
          </div>
        </div>
      )}
    </div>
  );
}
