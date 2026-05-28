import { useState, useEffect, useRef } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { DATA3 } from "@/data/data3";
import { NEXT_STEPS, Status, StepCard, loadStatuses, saveStatuses } from "./ActionPlan";
import { CALENDAR_EVENTS } from "./Calendar";
import type { NavParams } from "../App";

// ── Static data ──────────────────────────────────────────────────────────────
const comics  = DATA3.comics;
const boxData = DATA3.boxes;

const totalComics  = comics.length;
const totalBoxes   = boxData.length;
const keyCount     = comics.filter(c => (c.Key    || "").toUpperCase() === "YES").length;
const signedCount  = comics.filter(c => (c.Signed || "").toUpperCase() === "YES").length;
const whatnotCount = comics.filter(c => (c.Platform || "").toUpperCase().includes("WHATNOT")).length;
const ebayCount    = comics.filter(c => (c.Platform || "").toUpperCase() === "EBAY").length;
const tfCount      = comics.filter(c => !!(c.Terrificon || "").trim()).length;

// ── Update banner data — derives from live data where possible ────────────────
const LAST_UPDATE_DATE = "May 28, 2026";
const UPDATE_DELTAS    = ["+10 Boxes (74→84)", "+835 Comics", "+333 Keys"];
const INTERFACE_UPDATES = [
  `Data refresh — ${totalComics.toLocaleString()} comics · ${totalBoxes} boxes · ${keyCount.toLocaleString()} keys · ${signedCount} signed`,
  "Global search added — press ⌘K / Ctrl+K from anywhere to search all comics, boxes, and pages",
  "Comic detail drawer — click any book to see full details, values, signing info, and Comic Vine link",
  "Runs page updated — grouped by title + volume, completion % shown, legacy issue format supported",
  "Touch ID / Face ID / Windows Hello login — set up on first password entry",
];
function buildTopCreators(field: "Writer" | "Artist"): [string, number][] {
  const m: Record<string, number> = {};
  for (const c of comics) {
    const v = (c[field] as string | undefined) || "";
    if (v && v !== "nan" && v !== "Various" && v !== "Unknown" && v.trim()) {
      m[v] = (m[v] || 0) + 1;
    }
  }
  return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5);
}
const TOP_WRITERS_BNR = buildTopCreators("Writer");
const TOP_ARTISTS_BNR = buildTopCreators("Artist");
function parseNMVal(raw: string): number {
  // Take the first number found — gives lower bound for ranges like "$15–25"
  const m = (raw || "").match(/\$?(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}
const TOTAL_NM_VALUE = Math.round(
  comics.reduce((sum, c) => sum + parseNMVal(c.Value_NM || ""), 0)
);
const TOTAL_VF_VALUE = Math.round(
  comics.reduce((sum, c) => {
    const m = (c.Value_VF || "").match(/\$?(\d+(?:\.\d+)?)/);
    return sum + (m ? parseFloat(m[1]) : 0);
  }, 0)
);
// "Previous" top creators = collection before the May 2026 renumbering (boxes 1–61)
function buildTopCreatorsPrev(field: "Writer" | "Artist"): [string, number][] {
  const m: Record<string, number> = {};
  for (const c of comics) {
    if (Number(c.Box) > 61) continue;
    const v = (c[field] as string | undefined) || "";
    if (v && v !== "nan" && v !== "Various" && v !== "Unknown" && v.trim()) {
      m[v] = (m[v] || 0) + 1;
    }
  }
  return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5);
}
const TOP_WRITERS_PREV = buildTopCreatorsPrev("Writer");
const TOP_ARTISTS_PREV = buildTopCreatorsPrev("Artist");

function normPubGroup(p: string): string {
  const u = (p || "").toUpperCase();
  if (u === "MARVEL") return "Marvel";
  if (u === "DC" || u === "DC COMICS") return "DC";
  if (u === "IMAGE") return "Image";
  if (u.includes("BOOM")) return "BOOM! Studios";
  if (u === "IDW") return "IDW";
  if (u.includes("DARK HORSE")) return "Dark Horse";
  if (u === "VALIANT") return "Valiant";
  return "Independent";
}
const PUB_PIE_COLORS: Record<string, string> = {
  Marvel: "#c8102e", DC: "#1d6fa4", Image: "#f97316",
  "BOOM! Studios": "#16a34a", IDW: "#22c55e",
  "Dark Horse": "#7c3aed", Valiant: "#8b2be2", Independent: "#6b7280",
};
const PUB_COUNTS = (() => {
  const c: Record<string, number> = {};
  for (const cm of comics) { const k = normPubGroup(cm.Publisher); c[k] = (c[k]||0)+1; }
  return Object.entries(c).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value);
})();

// ── Calendar utils ────────────────────────────────────────────────────────────
function calEvInfo(type: string) {
  const t = (type || "").toUpperCase();
  if (t.includes("WHATNOT"))    return { icon:"📺", color:"#1a6a1a", bg:"#e8f5e8", page:"showplanner" };
  if (t.includes("CGC"))        return { icon:"🏆", color:"#1a4a99", bg:"#e8f0ff", page:"calendar"    };
  if (t.includes("TERRIFICON")) return { icon:"🎪", color:"#5522aa", bg:"#f0ebff", page:"calendar"    };
  if (t.includes("NYCC"))       return { icon:"🗽", color:"#5522aa", bg:"#f0ebff", page:"calendar"    };
  return { icon:"📅", color:"var(--muted2)" as string, bg:"var(--surface2)" as string, page:"calendar" };
}

// ── Dynamic today ─────────────────────────────────────────────────────────────
const TODAY      = new Date();
const TODAY_SORT = TODAY.getFullYear()*10000 + (TODAY.getMonth()+1)*100 + TODAY.getDate();
const TODAY_0    = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());

function daysUntil(y: number, m: number, d: number) {
  return Math.ceil((new Date(y, m-1, d).getTime() - TODAY_0.getTime()) / 86400000);
}
function daysFromSortDate(sortDate: number) {
  const y = Math.floor(sortDate/10000);
  const m = Math.floor((sortDate%10000)/100) - 1;
  const d = sortDate%100;
  return Math.ceil((new Date(y, m, d).getTime() - TODAY_0.getTime()) / 86400000);
}
function schedColor(days: number): string {
  if (days <= 14) return "#c8102e";
  if (days <= 30) return "#ea580c";
  if (days <= 60) return "#d97706";
  return "#16a34a";
}

const upcomingCal = [...CALENDAR_EVENTS]
  .filter(e => e.sortDate >= TODAY_SORT)
  .sort((a, b) => a.sortDate - b.sortDate)
  .slice(0, 6);

// ── Completed runs ────────────────────────────────────────────────────────────
function computeCompleteRuns(): number {
  const byKey: Record<string, Set<number>> = {};
  for (const c of comics) {
    const key = `${c.Title}|||${c.Volume || "1"}`;
    const n = parseFloat(String(c.Issue || "").replace(/^#/, "").trim());
    if (!isNaN(n) && n > 0 && n <= 999) {
      if (!byKey[key]) byKey[key] = new Set();
      byKey[key].add(Math.round(n));
    }
  }
  let complete = 0;
  for (const nums of Object.values(byKey)) {
    if (nums.size < 3) continue;
    const arr = [...nums].sort((a,b) => a-b);
    if (arr[arr.length-1] - arr[0] + 1 === nums.size) complete++;
  }
  return complete;
}
const COMPLETE_RUNS = computeCompleteRuns();

// ── Timeline ─────────────────────────────────────────────────────────────────
const TARGET_BOXES  = totalBoxes;
const BOX_PCT       = 100;
const BOX_REMAINING = 0;

const TIMELINE = [
  { label:"Jorge Jiménez CGC SS — Batman #125",       date:"Jun 5",       days:daysUntil(2026,6,5),   urgency:"critical", cat:"Signing"  },
  { label:"Geoff Johns + Fabok SS",                   date:"Jun 26",      days:daysUntil(2026,6,26),  urgency:"high",     cat:"Signing"  },
  { label:"Roy Thomas SS — 5 books → $820–$1,630 ROI",date:"Jul 10",      days:daysUntil(2026,7,10),  urgency:"high",     cat:"Signing"  },
  { label:"CGC Press Batch — ship all simultaneously",date:"Before Aug 7",days:daysUntil(2026,8,1),   urgency:"high",     cat:"CGC"      },
  { label:"✦ TERRIFICON — Jim Lee Sat Aug 8 only",    date:"Aug 7–9",     days:daysUntil(2026,8,7),   urgency:"event",    cat:"Show"     },
  { label:"NYCC — Stan Lee auth + Heritage eval",     date:"Oct 8–11",    days:daysUntil(2026,10,8),  urgency:"medium",   cat:"Show"     },
];

function urgColor(u: string): string {
  if (u === "critical") return "#c8102e";
  if (u === "event")    return "#8b2be2";
  if (u === "high")     return "#d97706";
  return "#1d6fa4";
}
function catColor(cat: string): string {
  if (cat === "CGC")     return "#8b2be2";
  if (cat === "Signing") return "#d97706";
  if (cat === "Show")    return "#1d6fa4";
  return "#16a34a";
}
function catNavPage(cat: string): string {
  if (cat === "CGC")     return "cgc";
  if (cat === "Signing") return "signings";
  if (cat === "Show")    return "calendar";
  if (cat === "Sales")   return "everything";
  return "actionplan";
}
function catNavLabel(cat: string): string {
  if (cat === "CGC")     return "CGC Strategy";
  if (cat === "Signing") return "Signings";
  if (cat === "Show")    return "Calendar";
  if (cat === "Sales")   return "Every Book";
  return "Action Plan";
}

// ── Flagship ─────────────────────────────────────────────────────────────────
const FLAGSHIP = [
  { book:"Stan Lee signed BP #513",                    note:"Authenticate first (PSA/DNA) — $800–$1,500+ auth",         color:"#dc2626", box:"1",  publisher:"Marvel", year:"1966", valueNM:"$800–$1,500 authenticated", condition:"Raw — DO NOT press",            cgcPath:"PSA/DNA at NYCC → CGC × JSA Green Qualified",   action:"NYCC Oct 8–11. Never press. Submit via PSA/DNA first.", terrificon:false },
  { book:"Truth: RWB #1 (Baker remarked)",             note:"Verify remark → Green Qual. → Heritage — $500–$2,000",     color:"#d97706", box:"1",  publisher:"Marvel", year:"2003", valueNM:"$500–$2,000 with remark",   condition:"Has Baker remark",              cgcPath:"CGC × JSA → Green Qualified → Heritage",        action:"Verify remark authenticity before submitting.", terrificon:false },
  { book:"Ultimate Fallout #4 Foil (1st Miles)",       note:"1st Miles Morales — $800–$1,500 CGC 9.8",                  color:"#8b2be2", box:"38", publisher:"Marvel", year:"2011", valueNM:"$800–$1,500 CGC 9.8",       condition:"Check for pressing",            cgcPath:"Press → CGC Universal Blue 9.8",                action:"Press then submit for Blue Universal label.", terrificon:false },
  { book:"Thor #169 CGC 8.0 (Galactus Origin)",        note:"Already slabbed. Galactus origin. Kirby/Lee. Show 15.",    color:"#1d6fa4", box:"63", publisher:"Marvel", year:"1969", valueNM:"CGC 8.0 — already slabbed", condition:"Slabbed CGC 8.0",               cgcPath:"Already graded — ready for Heritage or auction", action:"Feature in Show 15 — Whatnot anchor book.", terrificon:false },
  { book:"Wolverine #8 (UNSIGNED — 1982)",             note:"Keep unsigned → Yellow SS at Terrificon → $500+ SS 9.8",   color:"#d97706", box:"72", publisher:"Marvel", year:"1982", valueNM:"$500+ Yellow SS CGC 9.8",   condition:"MUST STAY UNSIGNED",            cgcPath:"Yellow SS at Terrificon → Chris Claremont SS",  action:"Priority #1 at Terrificon. Press before Aug 7. DO NOT sign until con.", terrificon:true },
  { book:"Batman #656 (1st Damian Wayne)",             note:"Press + Blue Universal → $350–$500 CGC 9.8 — Best ROI",    color:"#16a34a", box:"1",  publisher:"DC",     year:"2006", valueNM:"$350–$500 CGC 9.8",         condition:"In press list — send ASAP",     cgcPath:"Press → CGC Universal Blue 9.8",                action:"Press and submit before Terrificon. Best ROI in collection.", terrificon:true },
  { book:"Vision #1 (Tom King signed)",                note:"Press + Green Qual. → $150–$300. Film timing.",            color:"#8b2be2", box:"1",  publisher:"Marvel", year:"2015", valueNM:"$150–$300 Green Qualified",  condition:"Signed — press first",          cgcPath:"Press → CGC × JSA → Green Qualified",           action:"In press batch — submit with the Terrificon batch before Aug 7.", terrificon:false },
  { book:"ASM #361 (1st Carnage — Bagley/Sharen sgd)", note:"Bagley+Sharen. Press + Green Qual. → $200–$300 auth.",    color:"#dc2626", box:"1",  publisher:"Marvel", year:"1992", valueNM:"$200–$300 Green Qualified",  condition:"Dual signed — press first",     cgcPath:"Press → CGC × JSA → Green Qualified",           action:"In press batch — submit with the Terrificon batch before Aug 7.", terrificon:false },
  { book:"Black Lightning #1 (Isabella)",              note:"Press + Green Qual. → $300–$500. Whatnot/Heritage.",       color:"#16a34a", box:"1",  publisher:"DC",     year:"1977", valueNM:"$300–$500 Green Qualified",  condition:"Check for pressing",            cgcPath:"CGC × JSA → Green Qualified",                   action:"Monitor CGC private signing window — high Heritage value.", terrificon:false },
  { book:"Captain Carter #1 (Atwell — To Robert)",    note:"Emotional anchor for Show 1 — personalized signing.",      color:"#1d6fa4", box:"1",  publisher:"Marvel", year:"2022", valueNM:"$80–$150 personalized",      condition:"Signed personalized",           cgcPath:"Whatnot anchor — personal story sells",          action:"Lead Show 1 with the story of the Hayley Atwell signing.", terrificon:false },
];

// ── Search helpers ─────────────────────────────────────────────────────────────
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

// ── Hooks ─────────────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900, trigger = true): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!trigger) { setVal(target); return; }
    const startTime = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(ease * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, trigger, duration]);
  return val;
}
// Gas-station style: fast linear sprint → smooth settle
function useGasUp(target: number, trigger = true): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!trigger || target === 0) { setVal(target); return; }
    let live = true;
    let step = 0;
    const FAST_N = 48;
    const fast = setInterval(() => {
      if (!live) return;
      step++;
      setVal(Math.round((step / FAST_N) * target * 0.88));
      if (step >= FAST_N) {
        clearInterval(fast);
        const base = Math.round(0.88 * target);
        let s2 = 0;
        const SETTLE_N = 26;
        const settle = setInterval(() => {
          if (!live) { clearInterval(settle); return; }
          s2++;
          const p = s2 / SETTLE_N;
          const ease = 1 - Math.pow(1 - p, 3);
          setVal(Math.round(base + ease * (target - base)));
          if (s2 >= SETTLE_N) { clearInterval(settle); setVal(target); }
        }, 30);
      }
    }, 16);
    return () => { live = false; };
  }, [target, trigger]);
  return val;
}

function useInView(threshold = 0.1): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

// ── Component ─────────────────────────────────────────────────────────────────
type NavFn = (tab: string, params?: NavParams) => void;

export default function Summary({ onNavigate }: { onNavigate: NavFn }) {
  const [statuses,    setStatuses]   = useState<Record<string, Status>>(loadStatuses);
  const [openFlag,    setOpenFlag]   = useState<number | null>(null);
  const [searchField, setSearchField]= useState("everything");
  const [searchVal,   setSearchVal]  = useState("");
  const [searchBox,   setSearchBox]  = useState("");
  const [searchPub,   setSearchPub]  = useState("");

  // Animation states
  const [mounted,   setMounted]   = useState(false);
  const [progWidth, setProgWidth] = useState(0);
  const [schedRef,  schedVisible] = useInView(0.08);
  const [pubRef,    pubVisible]   = useInView(0.08);

  useEffect(() => { saveStatuses(statuses); }, [statuses]);

  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => setProgWidth(BOX_PCT), 250);
    return () => clearTimeout(t);
  }, []);

  // Gas-station value counters
  const cNmValue = useGasUp(TOTAL_NM_VALUE, mounted);
  const cVfValue = useGasUp(TOTAL_VF_VALUE, mounted);

  // Animated counters
  const cTotal   = useCountUp(totalComics,  1100, mounted);
  const cKeys    = useCountUp(keyCount,     900,  mounted);
  const cSigned  = useCountUp(signedCount,  750,  mounted);
  const cBoxes   = useCountUp(totalBoxes,   600,  mounted);
  const cWhatnot = useCountUp(whatnotCount, 950,  mounted);
  const cEbay    = useCountUp(ebayCount,    750,  mounted);
  const cTF      = useCountUp(tfCount,      700,  mounted);

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
      onNavigate("boxvisual", { box: searchBox });
    } else if (searchField === "keysonly") {
      onNavigate("everything", { keysOnly: "true" });
    } else if (searchField === "signedonly") {
      onNavigate("everything", { signed: "YES" });
    } else if (searchVal.trim()) {
      onNavigate("everything", { query: searchVal.trim() });
    }
  }

  const [bannerClosed, setBannerClosed] = useState(() => localStorage.getItem("mc_update_banner_closed") === "1");
  function closeBanner() { localStorage.setItem("mc_update_banner_closed", "1"); setBannerClosed(true); }

  return (
    <div style={{ maxWidth:1100, margin:"0 auto", padding:"20px 16px 80px" }}>

      {/* ── LATEST UPDATE BANNER ── */}
      {!bannerClosed && (
      <section style={{ marginBottom:28, background:"var(--surface)", border:"1.5px solid var(--red)", borderRadius:8, padding:"18px 20px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:"var(--red)", borderRadius:"8px 8px 0 0" }} />
        {/* Close button */}
        <button
          onClick={closeBanner}
          title="Dismiss"
          style={{ position:"absolute", top:10, right:12, background:"none", border:"none", cursor:"pointer", color:"var(--muted)", fontSize:"1rem", lineHeight:1, padding:4, borderRadius:4 }}
          onMouseOver={e => (e.currentTarget.style.color = "var(--red)")}
          onMouseOut={e => (e.currentTarget.style.color = "var(--muted)")}
        >×</button>
        {/* Header row */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap", paddingRight:24 }}>
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.9rem", letterSpacing:"3px", color:"var(--red)" }}>LATEST UPDATE</span>
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem", letterSpacing:"1.5px", color:"var(--muted)", background:"var(--surface2)", padding:"2px 8px", borderRadius:3, border:"1px solid var(--border)" }}>{LAST_UPDATE_DATE}</span>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
            {UPDATE_DELTAS.map(d => (
              <span key={d} style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1px", color:"#16a34a", background:"rgba(22,163,74,0.08)", border:"1px solid rgba(22,163,74,0.18)", padding:"2px 8px", borderRadius:3 }}>
                {d}
              </span>
            ))}
          </div>
        </div>

        {/* Interface updates only — writers/artists/value have their own dedicated cards below */}
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          {INTERFACE_UPDATES.map(u => (
            <div key={u} style={{ fontSize:"2.88rem", color:"var(--muted2)", lineHeight:1.4, fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>→ {u}</div>
          ))}
        </div>
      </section>
      )}

      {/* ── Box Progress — animated fill ── */}
      <section className="progress-section">
        <div className="progress-header">
          <div>
            <span className="progress-title">BOX COLLECTION PROGRESS</span>
            <span className="progress-fraction">{totalBoxes} of {TARGET_BOXES} boxes catalogued</span>
          </div>
          <div className="progress-pct">{BOX_PCT}%</div>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{
            width: `${progWidth}%`,
            backgroundImage: `linear-gradient(90deg, #c8102e 0%, #e85d04 25%, #f4a107 55%, #84cc16 80%, #22c55e 100%)`,
            backgroundSize: `${progWidth > 0 ? (100 / progWidth) * 100 : 100}% 100%`,
            backgroundRepeat: "no-repeat",
          }} />
          {[...Array(TARGET_BOXES)].map((_,i) => (
            <div key={i} className={`progress-tick ${i < totalBoxes ? "filled" : ""}`} style={{ left:`${((i+1)/TARGET_BOXES)*100}%` }} />
          ))}
        </div>
        <div className="progress-sub">All {totalBoxes} boxes catalogued — complete ✓ · {COMPLETE_RUNS} runs finished cover-to-cover</div>
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
          <button className="qs-btn" onClick={doSearch}>Search →</button>
        </div>
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

      {/* ── COMING UP — staggered entrance + nav links ── */}
      <section style={{ marginBottom:32 }}>
        <h2 className="section-h2">⚡ COMING UP</h2>
        <div className="timeline-grid">
          {TIMELINE.filter(t => t.days >= 0).map((t, i) => (
            <div
              key={i}
              className="timeline-card timeline-card-anim"
              style={{ borderLeftColor: urgColor(t.urgency), animationDelay: `${i * 0.09}s` }}
            >
              <div style={{ flex: 1 }}>
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
              <button className="tl-nav-link" onClick={(e) => { e.stopPropagation(); onNavigate(catNavPage(t.cat)); }}>
                → {catNavLabel(t.cat)}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── COLLECTION STATS — animated counters ── */}
      <section style={{ marginBottom:14 }}>
        <h2 className="section-h2">📚 COLLECTION</h2>
        <div className="stat-grid">
          {([
            { val: cTotal.toLocaleString(),   lbl:"Total Comics",  sub:"master inventory",      click:()=>onNavigate("everything",{}),             color:"#c8102e" },
            { val: cKeys.toLocaleString(),    lbl:"Key Issues",    sub:"confirmed across all",  click:()=>onNavigate("boxkeys"),                   color:"#d97706" },
            { val: cSigned.toString(),        lbl:"Signed Books",  sub:"by verified creators",  click:()=>onNavigate("everything",{signed:"YES"}), color:"#8b2be2" },
            { val: cBoxes.toString(),         lbl:"Boxes",         sub:"physically catalogued", click:()=>onNavigate("everything",{}),             color:"#1d6fa4" },
            { val:`${Math.round((keyCount/totalComics)*100)}%`, lbl:"Key Rate", sub:"of total collection", click: undefined, color:"#d97706" },
          ] as const).map((s, i) => (
            <div key={i} className={`stat-tile${s.click ? " clickable" : ""}`} onClick={s.click} style={{ borderTopColor: s.color }}>
              <div className="stat-tile-val" style={{ color: s.color }}>{s.val}</div>
              <div className="stat-tile-lbl">{s.lbl}</div>
              <div className="stat-tile-sub">{s.sub}</div>
              {s.click && <div className="stat-tile-cta">View →</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ── PLATFORM STATS — second row ── */}
      <section style={{ marginBottom:32 }}>
        <div className="stat-section-label">PLATFORM ASSIGNMENTS</div>
        <div className="stat-grid">
          {([
            { val: cWhatnot.toLocaleString(), lbl:"Whatnot",         sub:"assigned to platform",  color:"#16a34a" },
            { val: cEbay.toLocaleString(),    lbl:"eBay",             sub:"assigned to platform",  color:"#6b7280" },
            { val: cTF.toString(),            lbl:"Terrificon Books", sub:"creator appearances",   color:"#d97706" },
          ] as const).map((s, i) => (
            <div key={i} className="stat-tile" style={{ borderTopColor: s.color }}>
              <div className="stat-tile-val" style={{ color: s.color }}>{s.val}</div>
              <div className="stat-tile-lbl">{s.lbl}</div>
              <div className="stat-tile-sub">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── COLLECTION VALUE — gas station display ── */}
      <section style={{ marginBottom:24 }}>
        <div style={{ background:"#0f1a12", border:"1px solid #1e3a22", borderRadius:10, padding:"22px 24px", overflow:"hidden", position:"relative" }}>
          {/* Scanline texture */}
          <div style={{ position:"absolute", inset:0, backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,255,80,0.015) 3px,rgba(0,255,80,0.015) 4px)", pointerEvents:"none" }} />
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"4px", color:"rgba(100,220,120,0.5)", marginBottom:18 }}>
            COLLECTION VALUE EST. — {LAST_UPDATE_DATE.toUpperCase()}
          </div>
          <div style={{ display:"flex", gap:0, flexWrap:"wrap" }}>
            {/* NM Value */}
            <div style={{ flex:"1 1 200px", paddingRight:32, borderRight:"1px solid #1e3a22" }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem", letterSpacing:"3px", color:"rgba(100,220,120,0.45)", marginBottom:6 }}>
                NM RAW TOTAL
              </div>
              <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
                <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.9rem", color:"rgba(100,220,120,0.6)", letterSpacing:"1px", alignSelf:"flex-start", marginTop:6 }}>$</span>
                <span className="gas-num" style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"3.2rem", color:"#4ade80", letterSpacing:"3px", lineHeight:1, fontVariantNumeric:"tabular-nums" }}>
                  {cNmValue.toLocaleString()}
                </span>
              </div>
              <div style={{ fontSize:"0.62rem", color:"rgba(100,220,120,0.35)", marginTop:6, letterSpacing:"1px" }}>
                Near Mint (9.4+) raw — {totalComics.toLocaleString()} books
              </div>
            </div>
            {/* VF Value */}
            <div style={{ flex:"1 1 200px", paddingLeft:32 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem", letterSpacing:"3px", color:"rgba(100,220,120,0.45)", marginBottom:6 }}>
                VF COLLECTION VALUE EST.
              </div>
              <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
                <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.9rem", color:"rgba(100,220,120,0.4)", letterSpacing:"1px", alignSelf:"flex-start", marginTop:6 }}>$</span>
                <span className="gas-num" style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"3.2rem", color:"#86efac", letterSpacing:"3px", lineHeight:1, fontVariantNumeric:"tabular-nums" }}>
                  {cVfValue.toLocaleString()}
                </span>
              </div>
              <div style={{ fontSize:"0.62rem", color:"rgba(100,220,120,0.35)", marginTop:6, letterSpacing:"1px" }}>
                Very Fine (8.0) lower bounds — realistic sell-raw estimate
              </div>
            </div>
          </div>
          {/* Bottom note */}
          <div style={{ marginTop:16, paddingTop:14, borderTop:"1px solid #1e3a22", fontSize:"0.62rem", color:"rgba(100,220,120,0.25)", letterSpacing:"1px" }}>
            Values derived from Value_NM and Value_VF fields across all {totalComics.toLocaleString()} catalogued books. VF uses lower bound of any range (e.g. "$5–12" counts as $5).
          </div>
        </div>
      </section>

      {/* ── TOP CREATORS — with delta arrows ── */}
      <section style={{ marginBottom:32 }}>
        <h2 className="section-h2">✍ TOP CREATORS</h2>
        <p style={{ fontSize:"0.78rem", color:"var(--muted2)", marginBottom:12, fontFamily:"'Crimson Pro',serif" }}>
          Ranked by book count across all {totalComics.toLocaleString()} comics. Arrows show rank change vs. previous snapshot (boxes 1–61).
        </p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {(["Writer","Artist"] as const).map(field => {
            const current = field === "Writer" ? TOP_WRITERS_BNR : TOP_ARTISTS_BNR;
            const prev    = field === "Writer" ? TOP_WRITERS_PREV : TOP_ARTISTS_PREV;
            return (
              <div key={field} style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:8, padding:"14px 16px" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"3px",
                  color: field === "Writer" ? "var(--red)" : "#1d6fa4", marginBottom:12 }}>
                  TOP {field.toUpperCase()}S
                </div>
                {current.map(([name, count], i) => {
                  const prevIdx  = prev.findIndex(([n]) => n === name);
                  const prevRank = prevIdx === -1 ? 99 : prevIdx + 1;
                  const prevCount = prevIdx === -1 ? 0 : prev[prevIdx][1];
                  const delta    = count - prevCount;
                  const isNew    = prevIdx === -1;
                  const dir: "up"|"same"|"down" = isNew ? "up" : prevRank > i + 1 ? "up" : prevRank < i + 1 ? "down" : "same";
                  const arrowChar = dir === "up" ? "↑" : dir === "down" ? "↓" : "→";
                  const arrowColor = dir === "up" ? "#16a34a" : dir === "down" ? "#dc2626" : "var(--muted)";
                  const tip = isNew
                    ? `New to top 5 — +${delta} books added`
                    : dir === "same"
                    ? `Held #${i+1} — +${delta} books added`
                    : dir === "up"
                    ? `Was #${prevRank} → now #${i+1} — +${delta} books added`
                    : `Was #${prevRank} → now #${i+1} — +${delta} books added`;
                  return (
                    <div key={name} className="creator-row"
                      style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, position:"relative" }}>
                      <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", color:"var(--muted)",
                        minWidth:20, textAlign:"right" }}>#{i+1}</span>
                      <div style={{ width:3, height:20, borderRadius:2, flexShrink:0,
                        background: field === "Writer" ? "var(--red)" : "#1d6fa4", opacity: 1 - i * 0.15 }} />
                      <span style={{ flex:1, fontSize:"0.82rem", color:"var(--text2)",
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                        fontFamily:"'Crimson Pro',serif" }}>{name}</span>
                      <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.82rem",
                        color: field === "Writer" ? "var(--red)" : "#1d6fa4", minWidth:30, textAlign:"right" }}>{count}</span>
                      {/* Delta arrow with tooltip */}
                      <div className="delta-wrap" style={{ position:"relative", flexShrink:0 }}>
                        <span className="delta-arrow" style={{ fontFamily:"'Bebas Neue',sans-serif",
                          fontSize:"0.8rem", color:arrowColor, cursor:"default",
                          display:"inline-flex", alignItems:"center", justifyContent:"center",
                          width:20, height:20, borderRadius:3,
                          background: dir === "up" ? "#16a34a18" : dir === "down" ? "#dc262618" : "#6b728018" }}>
                          {arrowChar}
                        </span>
                        <div className="delta-tip">{tip}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── PUBLISHER SPLIT — lazy load + animated bars ── */}
      <div ref={pubRef}>
        <section style={{ marginBottom:32 }}>
          <h2 className="section-h2">📊 PUBLISHER SPLIT</h2>
          <div style={{ display:"flex", gap:24, alignItems:"flex-start", flexWrap:"wrap" }}>
            <div style={{ flex:"0 0 170px", minWidth:150 }}>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={PUB_COUNTS} cx="50%" cy="50%" innerRadius={42} outerRadius={70} dataKey="value" paddingAngle={2}>
                    {PUB_COUNTS.map(entry => (
                      <Cell key={entry.name} fill={PUB_PIE_COLORS[entry.name] || "#6b7280"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v.toLocaleString(), "Comics"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex:1, minWidth:180, display:"flex", flexDirection:"column", gap:10 }}>
              {PUB_COUNTS.map((p, pi) => {
                const pct = Math.round((p.value / totalComics) * 100);
                const color = PUB_PIE_COLORS[p.name] || "#6b7280";
                return (
                  <div key={p.name}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:10, height:10, borderRadius:2, background:color, flexShrink:0 }} />
                      <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.78rem", letterSpacing:"1px", color:"var(--muted2)", minWidth:110 }}>{p.name}</span>
                      <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.9rem", color:"var(--red)", letterSpacing:"1px" }}>{p.value.toLocaleString()}</span>
                      <span style={{ fontSize:"0.67rem", color:"var(--muted)" }}>({pct}%)</span>
                    </div>
                    <div className="pub-bar-track">
                      <div
                        className="pub-bar-fill"
                        style={{
                          width: pubVisible ? `${pct}%` : "0%",
                          background: color,
                          transitionDelay: `${pi * 0.11}s`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* ── FLAGSHIP ASSETS ── */}
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

      {/* ── UPCOMING SCHEDULE — lazy load, color-coded red→green ── */}
      {upcomingCal.length > 0 && (
        <div ref={schedRef}>
          <section style={{ marginBottom:32 }}>
            <h2 className="section-h2">📅 UPCOMING SCHEDULE</h2>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {upcomingCal.map((e, i) => {
                const info = calEvInfo(e.Type);
                const days = daysFromSortDate(e.sortDate);
                const urg  = schedColor(days);
                return (
                  <div
                    key={i}
                    className={`sched-card${schedVisible ? " visible" : ""}`}
                    style={{
                      ["--idx" as string]: i,
                      animationDelay: schedVisible ? `${i * 0.1}s` : "0s",
                      background: info.bg,
                      borderLeftColor: urg,
                      borderLeft: `3px solid ${urg}`,
                    } as React.CSSProperties}
                    onClick={() => onNavigate(info.page)}
                  >
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", minWidth:38, flexShrink:0 }}>
                      <div style={{ fontSize:"1.1rem", lineHeight:1 }}>{info.icon}</div>
                      <div className="sched-days" style={{ color: urg }}>
                        {days === 0 ? "NOW" : days === 1 ? "TMRW" : `${days}`}
                      </div>
                      <div className="sched-days-label" style={{ color: urg }}>
                        {days > 1 ? "DAYS" : ""}
                      </div>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.82rem", letterSpacing:"1px", color:info.color, lineHeight:1.2, marginBottom:2 }}>
                        {e.Theme.length > 72 ? e.Theme.substring(0,72)+"…" : e.Theme}
                      </div>
                      <div style={{ fontSize:"0.72rem", color:"var(--muted2)" }}>
                        {e.Date}
                        <span style={{ marginLeft:8, fontSize:"0.62rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", color: urg }}>
                          → {info.page === "showplanner" ? "VIEW SHOW PLAN" : "VIEW CALENDAR"}
                        </span>
                      </div>
                    </div>
                    <div className="sched-urgdot" style={{ background: urg }} />
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* ── BOOKS PER BOX ── */}
      <section style={{ marginBottom:32 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
          <h2 className="section-h2" style={{ margin:0 }}>📦 BOOKS PER BOX</h2>
          <div className="info-tip-wrap">
            <span className="info-tip-icon">ⓘ</span>
            <div className="info-tip-popup">
              <div className="info-tip-title">READING THE BOX TILES</div>
              <div className="info-tip-row"><span className="info-tip-label">Large number</span> Comics in that box</div>
              <div className="info-tip-row"><span className="info-tip-label">★k</span> Key issues — first apps, origins, landmark events</div>
              <div className="info-tip-row"><span className="info-tip-label">✍s</span> Creator-signed books verified at conventions</div>
              <div className="info-tip-row"><span className="info-tip-label">Pink border</span> Box has fewer than 100 books (not yet full)</div>
              <div className="info-tip-divider" />
              <div className="info-tip-title">DATA PRICING (Value fields)</div>
              <div className="info-tip-row"><span className="info-tip-label">NM value</span> Near-Mint (9.4+) raw market price</div>
              <div className="info-tip-row"><span className="info-tip-label">VF value</span> Very Fine (8.0) raw market price</div>
              <div className="info-tip-title" style={{ marginTop:8 }}>CGC SUBMISSION TIERS</div>
              <div className="info-tip-row"><span className="info-tip-label">Press</span> $20/book flat (all except Stan Lee)</div>
              <div className="info-tip-row"><span className="info-tip-label">Modern</span> $53/book (post-2000)</div>
              <div className="info-tip-row"><span className="info-tip-label">Vintage</span> $70/book (1975–2000)</div>
              <div className="info-tip-row"><span className="info-tip-label">PSA/DNA</span> $75 (Stan Lee only — no press)</div>
              <div className="info-tip-row"><span className="info-tip-label">Yellow SS</span> CGC witnessed signing — max label value</div>
              <div className="info-tip-row"><span className="info-tip-label">Green Qual.</span> Authenticated unwitnessed signature</div>
              <div className="info-tip-row"><span className="info-tip-label">Blue Univ.</span> Grade only — no signature</div>
            </div>
          </div>
        </div>
        <div className="boxes-grid">
          {[...boxData].filter(b => Number(b.Num.replace(/\D/g,"")) > 0).sort((a,b)=>Number(a.Num.replace(/\D/g,""))-Number(b.Num.replace(/\D/g,""))).map(b => {
            const boxNum = String(parseInt(b.Num.replace(/\D/g,""), 10));
            const lowBook = b.Comics < 100;
            return (
              <div
                key={b.Num}
                onClick={() => onNavigate("boxvisual", { box: boxNum })}
                className="box-tile"
                title={b.Notes || b.Label}
                style={lowBook ? { borderColor:"#d6456a", background:"#fdf0f4" } : {}}
              >
                <div className="box-tile-count">{b.Comics}</div>
                <div className="box-tile-num">Box {b.Num.replace("BOX ","")}</div>
                {Number(b.Keys)   > 0 && <div className="box-tile-keys">{b.Keys}k</div>}
                {Number(b.Signed) > 0 && <div className="box-tile-sgn">{b.Signed}s</div>}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── NEXT ACTIONS — with nav links ── */}
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
            <div key={i} style={{ position:"relative" }}>
              <StepCard step={s} status={getStatus(s.title)} onStatusChange={st => setStatus(s.title, st)} />
              <button
                className="action-nav-btn"
                onClick={() => onNavigate(catNavPage(s.category))}
              >
                → {catNavLabel(s.category)}
              </button>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
