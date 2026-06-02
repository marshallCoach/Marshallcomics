import React, { useState, useMemo, useEffect } from "react";
import { DATA } from "@/data/data";

// ── helpers ──────────────────────────────────────────────────────────────────
function parseVal(v: string | undefined | null): number {
  const m = (v || "").match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}
function fmtLow(v: string): string {
  if (!v || v === "nan" || v === "0") return "";
  const m = v.match(/(\d+(?:\.\d+)?)/);
  return m ? m[1] : "";
}
function fmtMoney(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`;
}
function roiScore(returnMin: number, costMax: number, hours: number): number {
  if (hours <= 0) return 999;
  return Math.round((returnMin - costMax) / hours);
}
function roiBars(score: number): number {
  if (score >= 500) return 5;
  if (score >= 200) return 4;
  if (score >= 100) return 3;
  if (score >= 50)  return 2;
  return 1;
}

// ── types & data ─────────────────────────────────────────────────────────────
type Priority = "RED" | "AMBER" | "GREEN";
type Category = "cgc" | "event" | "hunt" | "prep" | "submit" | "sell";
interface ActionItem {
  id: number; priority: Priority; category: Category;
  label: string; detail: string; deadline: string;
  book: string; box: string;
  costMin: number; costMax: number;
  returnMin: number; returnMax: number;
  effortHours: number;
}
interface CgcBook {
  id: number; title: string; subtitle: string; box: string;
  rawNM: number; label: string; cgcFee: number;
  pressingNeeded: boolean; returnMin: number; returnMax: number;
}
interface SellBook {
  rank: number; title: string; issue: string; subtitle: string;
  box: string; rawVF: number; expectedMin: number; expectedMax: number;
  platform: string; action: string; actionPriority: Priority;
}

const PRIORITY_COLOR: Record<Priority, string> = {
  RED: "#dc2626", AMBER: "#d97706", GREEN: "#16a34a",
};
const PRIORITY_LABEL: Record<Priority, string> = {
  RED: "THIS WEEK", AMBER: "THIS MONTH", GREEN: "BEFORE AUG 7",
};
const CAT_ICON: Record<Category, string> = {
  cgc: "📋", event: "🎪", hunt: "🔍", prep: "📦", submit: "📬", sell: "💰",
};

const ACTION_PLAN: ActionItem[] = [
  { id:1, priority:"RED", category:"cgc",
    label:"Submit BP #513 to CGC × JSA",
    detail:"Stan Lee signed — Dynamic Forces COA accepted by CGC. Fill form at cgccomics.com, include COA, ship insured. Do NOT press. Do NOT stream or sell until graded.",
    deadline:"THIS WEEK", book:"Black Panther #513", box:"2",
    costMin:75, costMax:75, returnMin:800, returnMax:1500, effortHours:2 },
  { id:2, priority:"RED", category:"event",
    label:"Book Terrificon Hotel",
    detail:"Hyatt Regency Mohegan Sun — code G-TRFC. Jim Lee is SATURDAY AUG 8 ONLY. 76 days out and filling up. Books the whole pipeline.",
    deadline:"THIS WEEK", book:"", box:"",
    costMin:150, costMax:250, returnMin:1500, returnMax:3000, effortHours:0.5 },
  { id:3, priority:"RED", category:"prep",
    label:"Bag Box 08 — Jim Lee Terrificon Targets",
    detail:"Superman Unchained #1 + Batman Europa #1 are ALL UNBAGGED in Box 08. Both are Jim Lee Yellow SS targets at Terrificon. Mylar + board before August 7.",
    deadline:"THIS WEEK", book:"Superman Unchained #1 + Batman Europa #1", box:"8",
    costMin:8, costMax:15, returnMin:400, returnMax:800, effortHours:1 },
  { id:4, priority:"RED", category:"submit",
    label:"Identify New Signed WildCATs",
    detail:"New WildCATs purchase — who signed it and which issue? One answer unlocks the CGC × JSA submission path. Reply in one sentence.",
    deadline:"THIS WEEK", book:"WildCATs (new signed)", box:"2",
    costMin:0, costMax:0, returnMin:150, returnMax:400, effortHours:0.25 },
  { id:5, priority:"AMBER", category:"cgc",
    label:"Confirm Jorge Jimenez Signing (Batman #125)",
    detail:"Deadline was Jun 5 — may have passed. Confirm submission received IMMEDIATELY. Jimenez drew Failsafe arc. $90 fee.",
    deadline:"CONFIRM NOW", book:"Batman #125", box:"6",
    costMin:90, costMax:90, returnMin:100, returnMax:300, effortHours:0.5 },
  { id:6, priority:"AMBER", category:"cgc",
    label:"Submit Geoff Johns + Jason Fabok",
    detail:"Justice League #21 + JSA run books. Deadline Jun 26. $90/$160 fee. High-value artist combo — Fabok drew JL with precision.",
    deadline:"Jun 26", book:"Justice League #21 + JSA books", box:"2",
    costMin:250, costMax:300, returnMin:400, returnMax:800, effortHours:2 },
  { id:7, priority:"AMBER", category:"cgc",
    label:"Press + Submit Batman #656 (1st Damian Wayne)",
    detail:"Best single CGC ROI in the collection after Stan Lee. $73 all-in — press + CGC Modern. Blue Universal 9.8 target.",
    deadline:"Jun 2026", book:"Batman #656", box:"1",
    costMin:73, costMax:73, returnMin:350, returnMax:500, effortHours:2 },
  { id:8, priority:"AMBER", category:"cgc",
    label:"Press + Submit Batman #657 (1st Damian as Robin)",
    detail:"Key follow-up to #656. Same CGC path — $73 all-in. Submit both together to save shipping.",
    deadline:"Jun 2026", book:"Batman #657", box:"1",
    costMin:73, costMax:73, returnMin:200, returnMax:350, effortHours:1 },
  { id:9, priority:"AMBER", category:"hunt",
    label:"Hunt New Mutants #98 (1st Deadpool)",
    detail:"Have NM #93 and #97 in Box 39. The #98 is almost certainly there or in Boxes 17-29. Raw NM value: $800+. Check Box 39 FIRST.",
    deadline:"Jun 2026", book:"New Mutants #98", box:"39",
    costMin:0, costMax:0, returnMin:800, returnMax:1200, effortHours:4 },
  { id:10, priority:"AMBER", category:"cgc",
    label:"Submit Ultimate Fallout #4 Foil (1st Miles)",
    detail:"1st Miles Morales — foil variant. Press first (excellent 9.8 candidate). Blue Universal label. Heritage or Whatnot after grading.",
    deadline:"Jun 2026", book:"Ultimate Fallout #4 Foil", box:"2",
    costMin:73, costMax:100, returnMin:800, returnMax:1500, effortHours:2 },
  { id:11, priority:"AMBER", category:"cgc",
    label:"Submit Vision #1 (Tom King signed)",
    detail:"Press first. CGC × JSA Green Qualified. MCU timing is optimal — Vision series incoming. $53 fee.",
    deadline:"Jun 2026", book:"Vision #1", box:"2",
    costMin:53, costMax:75, returnMin:150, returnMax:300, effortHours:1 },
  { id:12, priority:"AMBER", category:"cgc",
    label:"Submit ASM #361 — 1st Carnage (Bagley + Sharen)",
    detail:"Double-signed 1st full Carnage. Press first. CGC × JSA Green Qualified. Symbiote season is never over.",
    deadline:"Jun 2026", book:"ASM #361", box:"2",
    costMin:53, costMax:75, returnMin:200, returnMax:300, effortHours:1 },
  { id:13, priority:"GREEN", category:"event",
    label:"Terrificon: Wolverine #8 — Claremont Yellow SS",
    detail:"Priority #1 at Terrificon. Claremont is there ALL 3 DAYS. DO NOT sign before the con. Press before Aug 7. $500+ Yellow SS 9.8.",
    deadline:"Aug 7", book:"Wolverine #8 (UNSIGNED)", box:"5",
    costMin:70, costMax:120, returnMin:500, returnMax:700, effortHours:8 },
  { id:14, priority:"GREEN", category:"event",
    label:"Terrificon: Moon Knight Vol 6 #1-6 — Shalvey Yellow SS",
    detail:"Declan Shalvey DREW these books. Bring all 6 unsigned. 6 Yellow SS signings = up to $1,200. He's confirmed at the show.",
    deadline:"Aug 7", book:"Moon Knight Vol 6 #1-6", box:"50",
    costMin:200, costMax:350, returnMin:1000, returnMax:1400, effortHours:8 },
  { id:15, priority:"GREEN", category:"event",
    label:"Terrificon: Jim Lee — SAT AUG 8 ONLY (10am sharp)",
    detail:"Longest line at the show. Arrive at 10am. Targets: Batman Europa #1 + Superman Unchained #1 (box 08 — BAG THEM FIRST). $200-400 per Yellow SS.",
    deadline:"Aug 8 10AM", book:"Batman Europa #1 + Superman Unchained #1", box:"8",
    costMin:150, costMax:250, returnMin:400, returnMax:800, effortHours:4 },
  { id:16, priority:"GREEN", category:"cgc",
    label:"Submit Black Lightning #1 (Tony Isabella signed)",
    detail:"1st Black Lightning appearance. Creator-signed. CGC × JSA Green Qualified. Monitor Heritage window — $300-500 is the floor.",
    deadline:"Jun 2026", book:"Black Lightning #1", box:"2",
    costMin:70, costMax:90, returnMin:300, returnMax:500, effortHours:1 },
  { id:17, priority:"GREEN", category:"hunt",
    label:"Hunt ALL_BOXES (Boxes 17-29) for Missing Keys",
    detail:"13 boxes never individually verified (~2,000 comics). Top targets: NM #98, ASM #300, Giant-Size X-Men #1, UXM #266, Thor #337, Saga #1, ASM #129. Could be $3,000-8,000 in uncatalogued keys.",
    deadline:"Before NYCC", book:"See Hunt List", box:"17-29",
    costMin:0, costMax:0, returnMin:2000, returnMax:8000, effortHours:20 },
  { id:18, priority:"GREEN", category:"sell",
    label:"List eBay Non-Key Run Issues",
    detail:"6,357 books tagged eBay. Start with Flash runs (Johns era), non-key JLA, UK sticker variants. $3-15 each — pure passive income. Batch 50 at a time.",
    deadline:"Ongoing", book:"~6,357 eBay-tagged books", box:"Various",
    costMin:0, costMax:0, returnMin:4000, returnMax:9000, effortHours:40 },
];

const CGC_QUEUE: CgcBook[] = [
  { id:1,  title:"Stan Lee BP #513",         subtitle:"Black Panther — Dynamic Forces COA",       box:"2",  rawNM:400, label:"Green Qualified",    cgcFee:75, pressingNeeded:false, returnMin:800,  returnMax:1500 },
  { id:2,  title:"Ultimate Fallout #4 Foil", subtitle:"1st Miles Morales",                        box:"2",  rawNM:300, label:"Blue Universal 9.8", cgcFee:51, pressingNeeded:true,  returnMin:800,  returnMax:1500 },
  { id:3,  title:"Batman #656",              subtitle:"1st full Damian Wayne",                     box:"1",  rawNM:120, label:"Blue Universal 9.8", cgcFee:51, pressingNeeded:true,  returnMin:350,  returnMax:500  },
  { id:4,  title:"Black Lightning #1",       subtitle:"Tony Isabella signed",                      box:"2",  rawNM:150, label:"Green Qualified",    cgcFee:70, pressingNeeded:true,  returnMin:300,  returnMax:500  },
  { id:5,  title:"Vision #1",               subtitle:"Tom King signed",                           box:"2",  rawNM:150, label:"Green Qualified",    cgcFee:51, pressingNeeded:true,  returnMin:150,  returnMax:300  },
  { id:6,  title:"Batman #657",              subtitle:"1st Damian as Robin",                       box:"1",  rawNM:80,  label:"Blue Universal 9.8", cgcFee:51, pressingNeeded:true,  returnMin:200,  returnMax:350  },
  { id:7,  title:"Wolverine #8",             subtitle:"Claremont Yellow SS — Terrificon",          box:"5",  rawNM:80,  label:"Yellow SS 9.8",      cgcFee:51, pressingNeeded:true,  returnMin:500,  returnMax:700  },
  { id:8,  title:"ASM #361",                subtitle:"1st Carnage — Bagley + Sharen signed",       box:"2",  rawNM:100, label:"Green Qualified",    cgcFee:51, pressingNeeded:true,  returnMin:200,  returnMax:300  },
  { id:9,  title:"Moon Knight Vol 6 #1",    subtitle:"Shalvey Yellow SS — Terrificon",             box:"50", rawNM:25,  label:"Yellow SS 9.8",      cgcFee:51, pressingNeeded:true,  returnMin:200,  returnMax:300  },
  { id:10, title:"WildCATs #2",             subtitle:"Jim Lee signed",                             box:"2",  rawNM:80,  label:"Green Qualified",    cgcFee:51, pressingNeeded:true,  returnMin:150,  returnMax:250  },
  { id:11, title:"New Warriors #1",         subtitle:"Mark Bagley signed",                         box:"2",  rawNM:80,  label:"Green Qualified",    cgcFee:51, pressingNeeded:true,  returnMin:120,  returnMax:200  },
  { id:12, title:"Secret Wars #1",          subtitle:"Jonathan Hickman signed",                    box:"2",  rawNM:80,  label:"Green Qualified",    cgcFee:51, pressingNeeded:true,  returnMin:120,  returnMax:250  },
  { id:13, title:"Batman Europa #1",        subtitle:"Jim Lee Yellow SS — Terrificon",             box:"8",  rawNM:80,  label:"Yellow SS 9.8",      cgcFee:51, pressingNeeded:true,  returnMin:200,  returnMax:400  },
  { id:14, title:"Superman Unchained #1",   subtitle:"Jim Lee Yellow SS — Terrificon",             box:"8",  rawNM:80,  label:"Yellow SS 9.8",      cgcFee:51, pressingNeeded:true,  returnMin:200,  returnMax:400  },
  { id:15, title:"Thor #339",               subtitle:"Walt + Louise Simonson dual signed",         box:"2",  rawNM:80,  label:"Green Qualified",    cgcFee:51, pressingNeeded:true,  returnMin:100,  returnMax:200  },
  { id:16, title:"WildCATs #11",            subtitle:"Jim Lee signed",                             box:"2",  rawNM:80,  label:"Green Qualified",    cgcFee:51, pressingNeeded:true,  returnMin:100,  returnMax:200  },
  { id:17, title:"Captain Carter #1",       subtitle:"Hayley Atwell signed personalized",          box:"2",  rawNM:100, label:"Green Qualified",    cgcFee:51, pressingNeeded:true,  returnMin:150,  returnMax:300  },
  { id:18, title:"Flash #164",              subtitle:"Waid + LaRocque — Terrificon dual Yellow SS",box:"7",  rawNM:8,   label:"Yellow SS 9.8",      cgcFee:51, pressingNeeded:true,  returnMin:150,  returnMax:250  },
  { id:19, title:"Truth: RWB #1",           subtitle:"Kyle Baker remarked — Heritage candidate",   box:"2",  rawNM:70,  label:"Green Qualified",    cgcFee:70, pressingNeeded:false, returnMin:300,  returnMax:1000 },
  { id:20, title:"Secret Wars #8",          subtitle:"1st alien black costume (Spider-Man)",       box:"5",  rawNM:80,  label:"Blue Universal 9.8", cgcFee:51, pressingNeeded:true,  returnMin:120,  returnMax:200  },
];

const TOP_30_SELL: SellBook[] = [
  { rank:1,  title:"Stan Lee BP #513",            issue:"",   subtitle:"Black Panther — Dynamic Forces COA",        box:"2",  rawVF:300, expectedMin:800,  expectedMax:1500, platform:"Heritage",       action:"Submit CGC × JSA THIS WEEK",      actionPriority:"RED"   },
  { rank:2,  title:"Ultimate Fallout #4 Foil",    issue:"#4", subtitle:"1st Miles Morales — foil variant",          box:"2",  rawVF:220, expectedMin:800,  expectedMax:1500, platform:"Heritage/CGC",   action:"Press + CGC 9.8",                 actionPriority:"AMBER" },
  { rank:3,  title:"Wolverine #8",                issue:"#8", subtitle:"Yellow SS Claremont — post-Terrificon",     box:"5",  rawVF:55,  expectedMin:500,  expectedMax:700,  platform:"Whatnot",        action:"Terrificon Aug 7 — keep UNSIGNED", actionPriority:"GREEN" },
  { rank:4,  title:"Moon Knight Vol 6 set",       issue:"#1-6",subtitle:"Shalvey Yellow SS × 6 — Terrificon",      box:"50", rawVF:100, expectedMin:1000, expectedMax:1400, platform:"Whatnot/eBay",   action:"Terrificon Aug 7 — 6 books",      actionPriority:"GREEN" },
  { rank:5,  title:"Batman #656",                 issue:"#656",subtitle:"1st full Damian Wayne",                    box:"1",  rawVF:85,  expectedMin:350,  expectedMax:500,  platform:"Whatnot",        action:"Press + CGC 9.8 — June",          actionPriority:"AMBER" },
  { rank:6,  title:"Black Lightning #1",          issue:"#1", subtitle:"Tony Isabella signed — 1st appearance",    box:"2",  rawVF:100, expectedMin:300,  expectedMax:500,  platform:"Heritage/Whatnot",action:"CGC × JSA + Heritage",            actionPriority:"GREEN" },
  { rank:7,  title:"Batman Europa #1",            issue:"#1", subtitle:"Jim Lee Yellow SS — Terrificon",            box:"8",  rawVF:60,  expectedMin:200,  expectedMax:400,  platform:"Whatnot",        action:"Bag first — Jim Lee Aug 8",       actionPriority:"RED"   },
  { rank:8,  title:"Superman Unchained #1",       issue:"#1", subtitle:"Jim Lee Yellow SS — Terrificon",            box:"8",  rawVF:60,  expectedMin:200,  expectedMax:400,  platform:"Whatnot",        action:"Bag first — Jim Lee Aug 8",       actionPriority:"RED"   },
  { rank:9,  title:"Truth: Red, White & Black #1",issue:"#1", subtitle:"Kyle Baker remarked — Heritage candidate",  box:"2",  rawVF:50,  expectedMin:300,  expectedMax:1000, platform:"Heritage",       action:"Verify remark — Heritage auction", actionPriority:"AMBER" },
  { rank:10, title:"Vision #1",                   issue:"#1", subtitle:"Tom King signed",                           box:"2",  rawVF:100, expectedMin:150,  expectedMax:300,  platform:"Whatnot",        action:"Press + CGC × JSA",               actionPriority:"AMBER" },
  { rank:11, title:"Batman #657",                 issue:"#657",subtitle:"1st Damian as Robin",                      box:"1",  rawVF:55,  expectedMin:200,  expectedMax:350,  platform:"Whatnot",        action:"Press + CGC 9.8 — with #656",     actionPriority:"AMBER" },
  { rank:12, title:"ASM #361",                    issue:"#361",subtitle:"1st full Carnage — Bagley + Sharen signed",box:"2",  rawVF:70,  expectedMin:200,  expectedMax:300,  platform:"Whatnot",        action:"Press + CGC × JSA",               actionPriority:"AMBER" },
  { rank:13, title:"Captain Carter #1",           issue:"#1", subtitle:"Hayley Atwell signed to Robert",            box:"2",  rawVF:70,  expectedMin:150,  expectedMax:300,  platform:"Whatnot",        action:"Show 1 anchor — personal story",  actionPriority:"GREEN" },
  { rank:14, title:"Thor #169 CGC 8.0",           issue:"#169",subtitle:"Galactus origin — already slabbed",        box:"15", rawVF:120, expectedMin:150,  expectedMax:300,  platform:"Whatnot/Heritage",action:"Show 15 anchor — already graded", actionPriority:"GREEN" },
  { rank:15, title:"WildCATs #2",                 issue:"#2", subtitle:"Jim Lee signed",                            box:"2",  rawVF:55,  expectedMin:150,  expectedMax:250,  platform:"Whatnot",        action:"CGC × JSA Green Qualified",       actionPriority:"GREEN" },
  { rank:16, title:"Flash #164",                  issue:"#164",subtitle:"Waid + LaRocque Terrificon dual Yellow SS", box:"7",  rawVF:5,   expectedMin:150,  expectedMax:250,  platform:"Whatnot",        action:"Terrificon — dual signing",       actionPriority:"GREEN" },
  { rank:17, title:"Secret Wars #1",              issue:"#1", subtitle:"Jonathan Hickman signed",                   box:"2",  rawVF:55,  expectedMin:120,  expectedMax:250,  platform:"Whatnot",        action:"CGC × JSA Green Qualified",       actionPriority:"GREEN" },
  { rank:18, title:"New Warriors #1",             issue:"#1", subtitle:"Mark Bagley signed",                        box:"2",  rawVF:55,  expectedMin:120,  expectedMax:200,  platform:"Whatnot",        action:"CGC × JSA Green Qualified",       actionPriority:"GREEN" },
  { rank:19, title:"Mockingbird #8",              issue:"#8", subtitle:"Joelle Jones signed",                       box:"2",  rawVF:40,  expectedMin:80,   expectedMax:150,  platform:"Whatnot",        action:"CGC × JSA — show anchor",         actionPriority:"GREEN" },
  { rank:20, title:"Paper Girls #1",              issue:"#1", subtitle:"Cliff Chiang signed — personalized to Robert",box:"38",rawVF:20,  expectedMin:100,  expectedMax:200,  platform:"Whatnot",        action:"Personal story — strong opening", actionPriority:"GREEN" },
  { rank:21, title:"Thor #339",                   issue:"#339",subtitle:"Walt + Louise Simonson dual signed",        box:"2",  rawVF:55,  expectedMin:100,  expectedMax:200,  platform:"Whatnot",        action:"CGC × JSA Green Qualified",       actionPriority:"GREEN" },
  { rank:22, title:"Secret Wars #8",              issue:"#8", subtitle:"1st alien black costume — Spider-Man",      box:"5",  rawVF:55,  expectedMin:80,   expectedMax:150,  platform:"Whatnot",        action:"CGC 9.8 Blue Universal",          actionPriority:"GREEN" },
  { rank:23, title:"Falcon #1",                   issue:"#1", subtitle:"1st solo Falcon limited series",            box:"2",  rawVF:30,  expectedMin:50,   expectedMax:90,   platform:"Whatnot",        action:"Key issue — anchor show",         actionPriority:"GREEN" },
  { rank:24, title:"Thor #390",                   issue:"#390",subtitle:"Cap briefly lifts Mjolnir — major key",    box:"2",  rawVF:55,  expectedMin:60,   expectedMax:100,  platform:"Whatnot",        action:"Mjolnir show opener",             actionPriority:"GREEN" },
  { rank:25, title:"Avengers: Twilight set",      issue:"#1-6",subtitle:"Zdarsky — future Avengers complete",       box:"48", rawVF:40,  expectedMin:60,   expectedMax:90,   platform:"Whatnot",        action:"Complete run package",            actionPriority:"GREEN" },
  { rank:26, title:"Dead Man Logan set",          issue:"#1-12",subtitle:"Complete 12-issue run — Old Man Logan finale",box:"45",rawVF:35, expectedMin:50, expectedMax:80,   platform:"Whatnot/eBay",   action:"Complete run — batch listing",    actionPriority:"GREEN" },
  { rank:27, title:"Absolute Batman #1",          issue:"#1", subtitle:"Unread 1st print — Show 22 anchor",         box:"5",  rawVF:20,  expectedMin:40,   expectedMax:80,   platform:"Whatnot",        action:"Anchor: Absolute Universe show",  actionPriority:"GREEN" },
  { rank:28, title:"WildCATs #11",                issue:"#11",subtitle:"Jim Lee signed",                            box:"2",  rawVF:55,  expectedMin:100,  expectedMax:200,  platform:"Whatnot",        action:"CGC × JSA Green Qualified",       actionPriority:"GREEN" },
  { rank:29, title:"Black Panther #1 (Alex Ross)",issue:"#1", subtitle:"Alex Ross published pencil sketch variant",  box:"5",  rawVF:55,  expectedMin:60,   expectedMax:100,  platform:"Whatnot",        action:"Variant premium — strong opener", actionPriority:"GREEN" },
  { rank:30, title:"Thor #169",                   issue:"#169",subtitle:"Galactus origin — Silver Age bronze raw",  box:"6",  rawVF:90,  expectedMin:80,   expectedMax:150,  platform:"Whatnot",        action:"Silver Age spotlight show",       actionPriority:"GREEN" },
];

// ── sub-components ────────────────────────────────────────────────────────────
function PriorityDot({ p }: { p: Priority }) {
  return <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%",
    background:PRIORITY_COLOR[p], flexShrink:0, marginTop:2 }} />;
}

function RoiBar({ bars, color }: { bars: number; color: string }) {
  return (
    <div style={{ display:"flex", gap:2, alignItems:"center" }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{ width:14, height:6, borderRadius:2,
          background: i <= bars ? color : "var(--border)" }} />
      ))}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
const EBAY_BOOKS = DATA.comics.filter(c => (c.Platform||"").toUpperCase() === "EBAY");

export default function SellerDashboard() {
  type DashTab = "action" | "ebay" | "cgc" | "sell30";
  const [tab, setTab] = useState<DashTab>("action");

  // ── action plan state
  const [done, setDone] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("mc_action_done") || "[]")); }
    catch { return new Set(); }
  });
  const [actionSort, setActionSort] = useState<"priority"|"value"|"roi">("priority");
  const [expandedAction, setExpandedAction] = useState<Set<number>>(new Set());

  useEffect(() => {
    localStorage.setItem("mc_action_done", JSON.stringify([...done]));
  }, [done]);

  const toggleDone = (id: number) =>
    setDone(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleActionExpand = (id: number) =>
    setExpandedAction(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const sortedActions = useMemo(() => {
    const order: Priority[] = ["RED","AMBER","GREEN"];
    const items = [...ACTION_PLAN];
    if (actionSort === "priority") items.sort((a,b) => order.indexOf(a.priority) - order.indexOf(b.priority));
    else if (actionSort === "value") items.sort((a,b) => b.returnMin - a.returnMin);
    else items.sort((a,b) => roiScore(b.returnMin,b.costMax,b.effortHours) - roiScore(a.returnMin,a.costMax,a.effortHours));
    return items;
  }, [actionSort]);

  const actionTotals = useMemo(() => {
    const all = ACTION_PLAN.reduce((s,i) => s + i.returnMin, 0);
    const doneVal = ACTION_PLAN.filter(i => done.has(i.id)).reduce((s,i) => s + i.returnMin, 0);
    const doneCost = ACTION_PLAN.filter(i => done.has(i.id)).reduce((s,i) => s + i.costMin, 0);
    const doneHours = ACTION_PLAN.filter(i => done.has(i.id)).reduce((s,i) => s + i.effortHours, 0);
    return { all, doneVal, doneCost, doneHours, doneCount: done.size };
  }, [done]);

  // ── eBay state
  const [ebayQuery, setEbayQuery] = useState("");
  const [ebayFee, setEbayFee] = useState(13.25);
  const [ebayShip, setEbayShip] = useState(0);
  const [ebaySelected, setEbaySelected] = useState<Set<number>>(new Set());
  const [ebaySort, setEbaySort] = useState<"vf"|"title"|"profit">("vf");

  const ebayResults = useMemo(() => {
    const q = ebayQuery.toLowerCase();
    return EBAY_BOOKS
      .map((c, idx) => ({ c, idx }))
      .filter(({ c }) => !q || (c.Title+c.Issue+c.Arc+c.Box).toLowerCase().includes(q))
      .sort((a, b) => {
        if (ebaySort === "vf") return parseVal(b.c.Value_VF) - parseVal(a.c.Value_VF);
        if (ebaySort === "title") return a.c.Title.localeCompare(b.c.Title);
        const netA = Math.max(0, parseVal(a.c.Value_VF) * (1 - ebayFee/100) - ebayShip);
        const netB = Math.max(0, parseVal(b.c.Value_VF) * (1 - ebayFee/100) - ebayShip);
        return netB - netA;
      });
  }, [ebayQuery, ebaySort, ebayFee, ebayShip]);

  const ebayTotals = useMemo(() => {
    const sel = ebayResults.filter(r => ebaySelected.has(r.idx));
    const gross = sel.reduce((s, r) => s + parseVal(r.c.Value_VF), 0);
    const fees  = gross * (ebayFee/100);
    const ship  = sel.length * ebayShip;
    return { count: sel.length, gross, fees, ship, net: Math.max(0, gross - fees - ship) };
  }, [ebaySelected, ebayResults, ebayFee, ebayShip]);

  const toggleEbay = (idx: number) =>
    setEbaySelected(prev => { const s = new Set(prev); s.has(idx) ? s.delete(idx) : s.add(idx); return s; });
  const selectAllEbay = () => setEbaySelected(new Set(ebayResults.map(r => r.idx)));
  const clearEbay = () => setEbaySelected(new Set());

  // ── CGC state
  const [cgcTier, setCgcTier] = useState<65|100|200>(65);
  const [cgcPressing, setCgcPressing] = useState(true);
  const [cgcSelected, setCgcSelected] = useState<Set<number>>(new Set());

  const pressPerBook = cgcPressing ? 22 : 0;
  const cgcTotals = useMemo(() => {
    const sel = CGC_QUEUE.filter(b => cgcSelected.has(b.id));
    const spend = sel.reduce((s,b) => s + cgcTier + (b.pressingNeeded && cgcPressing ? pressPerBook : 0), 0);
    const retMin = sel.reduce((s,b) => s + b.returnMin, 0);
    const retMax = sel.reduce((s,b) => s + b.returnMax, 0);
    const rawSum = sel.reduce((s,b) => s + b.rawNM, 0);
    return { count:sel.length, spend, retMin, retMax, rawSum, net: retMin - spend };
  }, [cgcSelected, cgcTier, cgcPressing, pressPerBook]);

  const toggleCgc = (id: number) =>
    setCgcSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  // ── sell30 state
  const [sellSort, setSellSort] = useState<"rank"|"vf"|"return">("rank");
  const [sellFilter, setSellFilter] = useState<"all"|"RED"|"AMBER"|"GREEN">("all");

  const sortedSell = useMemo(() => {
    let items = [...TOP_30_SELL];
    if (sellFilter !== "all") items = items.filter(i => i.actionPriority === sellFilter);
    if (sellSort === "vf") items.sort((a,b) => b.rawVF - a.rawVF);
    else if (sellSort === "return") items.sort((a,b) => b.expectedMin - a.expectedMin);
    return items;
  }, [sellSort, sellFilter]);

  // ── headline totals ───────────────────────────────────────────────────────
  const totalUpside = ACTION_PLAN.reduce((s,i) => s + i.returnMin, 0);
  const totalSpend  = ACTION_PLAN.reduce((s,i) => s + i.costMin, 0);
  const totalHours  = ACTION_PLAN.reduce((s,i) => s + i.effortHours, 0);

  const tabs: { id: DashTab; label: string }[] = [
    { id:"action", label:"Action Plan" },
    { id:"ebay",   label:"eBay Finder" },
    { id:"cgc",    label:"CGC Pipeline" },
    { id:"sell30", label:"Top 30 Sellers" },
  ];

  return (
    <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 0 60px" }}>

      {/* ── page header ───────────────────────────────────────────────────── */}
      <div style={{ background:"#1a0a0a", padding:"20px 20px 16px", borderBottom:"3px solid var(--red)" }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.7rem", letterSpacing:"4px", color:"#fff", lineHeight:1 }}>
          SELLER COMMAND CENTER
        </div>
        <div style={{ fontSize:"0.72rem", letterSpacing:"2px", color:"rgba(255,255,255,0.4)", marginTop:4, fontFamily:"'Bebas Neue',sans-serif" }}>
          ROBERTO MARSHALL · BLACKREADBROWN · ROI + ACTION TRACKER
        </div>
        {/* Headline bar */}
        <div style={{ display:"flex", gap:0, marginTop:14, flexWrap:"wrap" }}>
          {[
            { lbl:"Total Upside",    val: fmtMoney(totalUpside),           sub:"if all actions done",  color:"#22c55e" },
            { lbl:"Total Spend",     val: fmtMoney(totalSpend),            sub:"investment needed",    color:"#f59e0b" },
            { lbl:"Est. Hours",      val: `${totalHours}h`,                sub:"time to complete all", color:"#60a5fa" },
            { lbl:"Tasks Done",      val: `${done.size}/${ACTION_PLAN.length}`, sub:"action plan progress", color:"var(--red)" },
            { lbl:"eBay Inventory",  val: EBAY_BOOKS.length.toLocaleString(), sub:"books tagged eBay",   color:"#a78bfa" },
          ].map(s => (
            <div key={s.lbl} style={{ flex:"1 1 120px", padding:"10px 14px", borderRight:"1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.3rem", color:s.color, letterSpacing:"1px" }}>{s.val}</div>
              <div style={{ fontSize:"0.6rem", color:"rgba(255,255,255,0.35)", letterSpacing:"1.5px", textTransform:"uppercase", marginTop:2 }}>{s.lbl}</div>
              <div style={{ fontSize:"0.58rem", color:"rgba(255,255,255,0.2)", marginTop:1 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── tab bar ───────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", borderBottom:"2px solid var(--border)", background:"var(--surface)", overflowX:"auto" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"2px", fontSize:"0.82rem",
              padding:"12px 20px", border:"none", borderBottom: tab===t.id ? "3px solid var(--red)" : "3px solid transparent",
              background:"transparent", color: tab===t.id ? "var(--red)" : "var(--muted2)",
              cursor:"pointer", whiteSpace:"nowrap", transition:"color 0.15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: ACTION PLAN                                                    */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === "action" && (
        <div>
          {/* Progress summary */}
          <div style={{ background:"var(--surface2)", padding:"12px 16px", borderBottom:"1px solid var(--border)",
            display:"flex", gap:20, flexWrap:"wrap", alignItems:"center" }}>
            <div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.1rem", color:"var(--green-text)", letterSpacing:"1px" }}>
                {fmtMoney(actionTotals.doneVal)} secured
              </div>
              <div style={{ fontSize:"0.62rem", color:"var(--muted)", letterSpacing:"1px" }}>
                {actionTotals.doneCount} tasks complete · {actionTotals.doneHours.toFixed(1)}h spent · {fmtMoney(actionTotals.doneCost)} invested
              </div>
            </div>
            <div style={{ flex:1, minWidth:120 }}>
              <div style={{ height:6, background:"var(--border)", borderRadius:3, overflow:"hidden" }}>
                <div style={{ height:"100%", borderRadius:3, background:"var(--green-text)",
                  width:`${Math.round((actionTotals.doneVal/actionTotals.all)*100)}%`,
                  transition:"width 0.4s ease" }} />
              </div>
              <div style={{ fontSize:"0.58rem", color:"var(--muted)", marginTop:3 }}>
                {fmtMoney(actionTotals.all - actionTotals.doneVal)} still on the table
              </div>
            </div>
            {/* Sort */}
            <div style={{ display:"flex", gap:4 }}>
              {(["priority","value","roi"] as const).map(s => (
                <button key={s} onClick={() => setActionSort(s)}
                  style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"1.5px",
                    padding:"4px 10px", border:`1.5px solid ${actionSort===s?"var(--red)":"var(--border)"}`,
                    background:actionSort===s?"var(--red)":"transparent", color:actionSort===s?"#fff":"var(--muted2)",
                    borderRadius:3, cursor:"pointer" }}>
                  {s === "priority" ? "URGENCY" : s === "value" ? "VALUE" : "ROI/HR"}
                </button>
              ))}
            </div>
          </div>

          {/* Action cards */}
          <div style={{ padding:"12px 12px" }}>
            {sortedActions.map(item => {
              const isDone = done.has(item.id);
              const isOpen = expandedAction.has(item.id);
              const roi = roiScore(item.returnMin, item.costMax, item.effortHours);
              const bars = roiBars(roi);
              const roiColor = bars >= 4 ? "#22c55e" : bars === 3 ? "#f59e0b" : "#94a3b8";
              const pColor = PRIORITY_COLOR[item.priority];
              return (
                <div key={item.id}
                  style={{ background: isDone ? "var(--surface2)" : "var(--surface)",
                    border:`1px solid ${isDone ? "var(--border)" : pColor+"44"}`,
                    borderLeft:`4px solid ${isDone ? "var(--border)" : pColor}`,
                    borderRadius:6, marginBottom:8, overflow:"hidden",
                    opacity: isDone ? 0.55 : 1, transition:"opacity 0.2s" }}>

                  {/* Card header */}
                  <div style={{ padding:"10px 14px 8px", cursor:"pointer", display:"flex", gap:10, alignItems:"flex-start" }}
                    onClick={() => toggleActionExpand(item.id)}>

                    {/* Left: priority dot + title */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4, flexWrap:"wrap" }}>
                        <PriorityDot p={item.priority} />
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"2px",
                          background:pColor+"18", color:pColor, padding:"1px 7px", borderRadius:2 }}>
                          {item.deadline}
                        </span>
                        <span style={{ fontSize:"0.62rem", color:"var(--muted)", letterSpacing:"1px" }}>
                          {CAT_ICON[item.category]} {item.category.toUpperCase()}
                        </span>
                        {isDone && <span style={{ fontSize:"0.6rem", color:"var(--green-text)", letterSpacing:"1px",
                          fontFamily:"'Bebas Neue',sans-serif" }}>✓ DONE</span>}
                      </div>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.98rem", letterSpacing:"1.5px",
                        color: isDone ? "var(--muted)" : "var(--text)", lineHeight:1.2 }}>
                        {item.label}
                      </div>
                      {item.book && (
                        <div style={{ fontSize:"0.68rem", color:"var(--muted2)", marginTop:3 }}>
                          {item.book}{item.box ? ` · Box ${item.box}` : ""}
                        </div>
                      )}
                    </div>

                    {/* Right: value + ROI */}
                    <div style={{ flexShrink:0, textAlign:"right" }}>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem", color:"var(--green-text)", letterSpacing:"1px" }}>
                        {fmtMoney(item.returnMin)}–{fmtMoney(item.returnMax)}
                      </div>
                      {item.costMin > 0 && (
                        <div style={{ fontSize:"0.62rem", color:"var(--muted)", marginTop:1 }}>
                          spend {fmtMoney(item.costMin)}{item.costMin !== item.costMax ? `–${fmtMoney(item.costMax)}` : ""}
                        </div>
                      )}
                      <div style={{ marginTop:5 }}>
                        <RoiBar bars={bars} color={roiColor} />
                        <div style={{ fontSize:"0.58rem", color:roiColor, marginTop:2, textAlign:"right" }}>
                          {roi >= 999 ? "FREE MONEY" : `$${roi.toLocaleString()}/hr net`}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Effort row */}
                  <div style={{ padding:"0 14px 8px", display:"flex", gap:14, alignItems:"center", flexWrap:"wrap" }}>
                    <div style={{ display:"flex", gap:3, alignItems:"center" }}>
                      {["Effort", `${item.effortHours}h`].map((v,i) => (
                        <span key={i} style={{ fontSize:"0.62rem",
                          color: i === 0 ? "var(--muted)" : "var(--text)",
                          fontFamily: i === 1 ? "'Bebas Neue',sans-serif" : undefined,
                          letterSpacing: i === 1 ? "1px" : undefined }}>{v}</span>
                      ))}
                    </div>
                    <div style={{ display:"flex", gap:3 }}>
                      {["Time", item.effortHours <= 1 ? "Quick Win" : item.effortHours <= 4 ? "Half Day" : item.effortHours <= 8 ? "Full Day" : "Project"].map((v,i) => (
                        <span key={i} style={{ fontSize:"0.62rem",
                          color: i === 0 ? "var(--muted)" : item.effortHours <= 2 ? "#22c55e" : item.effortHours <= 8 ? "#f59e0b" : "#94a3b8" }}>{v}</span>
                      ))}
                    </div>
                    <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
                      {isOpen && (
                        <button onClick={e=>{e.stopPropagation();toggleDone(item.id);}}
                          style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"1.5px",
                            padding:"4px 12px", borderRadius:3, cursor:"pointer", border:"none",
                            background: isDone ? "#dc262622" : "var(--green-text)",
                            color: isDone ? "#dc2626" : "#fff" }}>
                          {isDone ? "MARK UNDONE" : "✓ MARK DONE"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div style={{ padding:"10px 14px 12px", borderTop:"1px solid var(--border)",
                      background:"var(--surface2)", fontSize:"0.82rem", color:"var(--muted2)", lineHeight:1.6,
                      fontFamily:"'Crimson Pro',serif" }}>
                      {item.detail}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: eBay FINDER                                                    */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === "ebay" && (
        <div>
          {/* Controls */}
          <div style={{ background:"var(--surface2)", padding:"12px 16px", borderBottom:"1px solid var(--border)" }}>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
              <input value={ebayQuery} onChange={e=>{setEbayQuery(e.target.value);clearEbay();}}
                placeholder="Search title, arc, box…"
                style={{ flex:"1 1 200px", padding:"7px 12px", border:"1.5px solid var(--border)",
                  borderRadius:4, fontFamily:"'Crimson Pro',serif", fontSize:"0.9rem",
                  background:"var(--surface)", color:"var(--text)" }} />
              {ebayQuery && <button onClick={()=>setEbayQuery("")}
                style={{ padding:"7px 12px", border:"1.5px solid var(--border)", borderRadius:4,
                  background:"transparent", color:"var(--muted)", cursor:"pointer", fontSize:"0.8rem" }}>
                Clear
              </button>}
              <div style={{ display:"flex", gap:4 }}>
                {(["vf","profit","title"] as const).map(s => (
                  <button key={s} onClick={()=>setEbaySort(s)}
                    style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"1.5px",
                      padding:"4px 10px", border:`1.5px solid ${ebaySort===s?"var(--red)":"var(--border)"}`,
                      background:ebaySort===s?"var(--red)":"transparent", color:ebaySort===s?"#fff":"var(--muted2)",
                      borderRadius:3, cursor:"pointer" }}>
                    {s === "vf" ? "VF ↓" : s === "profit" ? "NET ↓" : "A→Z"}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", gap:20, flexWrap:"wrap", alignItems:"center", marginTop:10 }}>
              <label style={{ display:"flex", gap:6, alignItems:"center", fontSize:"0.78rem", color:"var(--muted2)" }}>
                eBay fee
                <input type="number" value={ebayFee} min={0} max={25} step={0.25}
                  onChange={e=>setEbayFee(+e.target.value)}
                  style={{ width:60, padding:"3px 6px", border:"1.5px solid var(--border)", borderRadius:3,
                    background:"var(--surface)", color:"var(--text)", fontSize:"0.82rem" }} />
                %
              </label>
              <label style={{ display:"flex", gap:6, alignItems:"center", fontSize:"0.78rem", color:"var(--muted2)" }}>
                Shipping cost
                <input type="number" value={ebayShip} min={0} max={20} step={0.5}
                  onChange={e=>setEbayShip(+e.target.value)}
                  style={{ width:60, padding:"3px 6px", border:"1.5px solid var(--border)", borderRadius:3,
                    background:"var(--surface)", color:"var(--text)", fontSize:"0.82rem" }} />
                $
              </label>
              <span style={{ fontSize:"0.72rem", color:"var(--muted)", marginLeft:"auto" }}>
                Using <strong style={{color:"var(--red)"}}>VF value only</strong> · {ebayResults.length.toLocaleString()} books shown
              </span>
              <button onClick={selectAllEbay}
                style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"1.5px",
                  padding:"4px 10px", border:"1.5px solid var(--border)", borderRadius:3,
                  background:"transparent", color:"var(--muted2)", cursor:"pointer" }}>
                SELECT ALL
              </button>
            </div>
          </div>

          {/* Sticky calculator */}
          {ebayTotals.count > 0 && (
            <div style={{ position:"sticky", top:94, zIndex:20, background:"#1a0a0a",
              borderBottom:"2px solid var(--red)", padding:"10px 16px",
              display:"flex", gap:20, flexWrap:"wrap", alignItems:"center" }}>
              <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", color:"#fff", letterSpacing:"1.5px" }}>
                {ebayTotals.count} SELECTED
              </span>
              {[
                { lbl:"Gross VF",   val:`$${ebayTotals.gross.toFixed(2)}`,       color:"#fff" },
                { lbl:"eBay Fees",  val:`-$${ebayTotals.fees.toFixed(2)}`,        color:"#f87171" },
                { lbl:"Shipping",   val:`-$${ebayTotals.ship.toFixed(2)}`,        color:"#f87171" },
                { lbl:"NET PROFIT", val:`$${ebayTotals.net.toFixed(2)}`,          color:"#4ade80" },
              ].map(s => (
                <div key={s.lbl}>
                  <span style={{ fontSize:"0.6rem", color:"rgba(255,255,255,0.4)", letterSpacing:"1.5px" }}>{s.lbl} </span>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem", color:s.color, letterSpacing:"1px" }}>{s.val}</span>
                </div>
              ))}
              <button onClick={clearEbay}
                style={{ marginLeft:"auto", fontSize:"0.7rem", padding:"4px 10px", border:"1.5px solid rgba(255,255,255,0.2)",
                  background:"transparent", color:"rgba(255,255,255,0.5)", borderRadius:3, cursor:"pointer" }}>
                Clear
              </button>
            </div>
          )}

          {/* Book list */}
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.8rem" }}>
              <thead>
                <tr style={{ background:"var(--surface2)", borderBottom:"2px solid var(--border)" }}>
                  <th style={{ width:36, padding:"8px 10px" }}>
                    <input type="checkbox" checked={ebayTotals.count === ebayResults.length && ebayResults.length > 0}
                      onChange={e => e.target.checked ? selectAllEbay() : clearEbay()}
                      style={{ cursor:"pointer" }} />
                  </th>
                  {["Title","Box","Issue","VF Value","eBay Fee","Net Profit","Key"].map(h => (
                    <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontFamily:"'Bebas Neue',sans-serif",
                      letterSpacing:"1.5px", fontSize:"0.65rem", color:"var(--muted)", fontWeight:400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ebayResults.slice(0, 200).map(({ c, idx }) => {
                  const vfN  = parseVal(c.Value_VF);
                  const vfStr = fmtLow(c.Value_VF);
                  const fee  = vfN * (ebayFee/100);
                  const net  = Math.max(0, vfN - fee - ebayShip);
                  const isKey = (c.Key||"").toUpperCase() === "YES";
                  const isSel = ebaySelected.has(idx);
                  return (
                    <tr key={idx} onClick={() => toggleEbay(idx)}
                      style={{ borderBottom:"1px solid var(--border)",
                        background: isSel ? "var(--red)0d" : "transparent",
                        cursor:"pointer", transition:"background 0.1s" }}>
                      <td style={{ padding:"7px 10px" }} onClick={e=>e.stopPropagation()}>
                        <input type="checkbox" checked={isSel} onChange={() => toggleEbay(idx)}
                          style={{ cursor:"pointer" }} />
                      </td>
                      <td style={{ padding:"7px 10px", color:"var(--text)", fontWeight: isKey ? 600 : 400 }}>
                        {c.Title}
                      </td>
                      <td style={{ padding:"7px 10px", color:"var(--muted2)" }}>
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", fontSize:"0.72rem",
                          background:"#7a5c3a18", border:"1.5px solid #7a5c3a", color:"#7a5c3a",
                          borderRadius:3, padding:"1px 6px" }}>Box {c.Box}</span>
                      </td>
                      <td style={{ padding:"7px 10px", color:"var(--muted)" }}>{c.Issue}</td>
                      <td style={{ padding:"7px 10px", color: vfStr ? "var(--green-text)" : "var(--muted)", fontWeight:600 }}>
                        {vfStr ? `$${vfStr}` : "—"}
                      </td>
                      <td style={{ padding:"7px 10px", color:"#f87171", fontSize:"0.76rem" }}>
                        {vfN > 0 ? `-$${fee.toFixed(2)}` : "—"}
                      </td>
                      <td style={{ padding:"7px 10px", color: net > 0 ? "#4ade80" : "var(--muted)", fontWeight:600 }}>
                        {net > 0 ? `$${net.toFixed(2)}` : "—"}
                      </td>
                      <td style={{ padding:"7px 10px" }}>
                        {isKey && <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"1.5px",
                          background:"#d4a80022", border:"1.5px solid #d4a800", color:"#d4a800",
                          borderRadius:2, padding:"1px 5px" }}>KEY</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {ebayResults.length > 200 && (
              <div style={{ padding:"10px 16px", fontSize:"0.75rem", color:"var(--muted)", textAlign:"center" }}>
                Showing first 200 of {ebayResults.length.toLocaleString()} — refine your search to narrow results
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: CGC PIPELINE                                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === "cgc" && (
        <div>
          {/* Controls */}
          <div style={{ background:"var(--surface2)", padding:"12px 16px", borderBottom:"1px solid var(--border)" }}>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
              <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", letterSpacing:"2px", color:"var(--muted)" }}>CGC TIER</span>
              {([65,100,200] as const).map(t => (
                <button key={t} onClick={()=>setCgcTier(t)}
                  style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", letterSpacing:"1.5px",
                    padding:"5px 14px", border:`1.5px solid ${cgcTier===t?"var(--red)":"var(--border)"}`,
                    background:cgcTier===t?"var(--red)":"transparent", color:cgcTier===t?"#fff":"var(--muted2)",
                    borderRadius:4, cursor:"pointer" }}>
                  {t === 65 ? "Economy $65" : t === 100 ? "Standard $100" : "Express $200"}
                </button>
              ))}
              <label style={{ display:"flex", gap:6, alignItems:"center", fontSize:"0.78rem", color:"var(--muted2)",
                cursor:"pointer", marginLeft:8 }}>
                <input type="checkbox" checked={cgcPressing} onChange={e=>setCgcPressing(e.target.checked)} />
                Pressing ($22/book)
              </label>
            </div>
          </div>

          {/* Sticky calculator */}
          {cgcTotals.count > 0 && (
            <div style={{ position:"sticky", top:94, zIndex:20, background:"#1a0a0a",
              borderBottom:"2px solid var(--red)", padding:"10px 16px",
              display:"flex", gap:20, flexWrap:"wrap", alignItems:"center" }}>
              <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", color:"#fff", letterSpacing:"1.5px" }}>
                {cgcTotals.count} BOOKS SELECTED
              </span>
              {[
                { lbl:"Raw Value",      val:fmtMoney(cgcTotals.rawSum),          color:"#fff" },
                { lbl:"Total Spend",    val:fmtMoney(cgcTotals.spend),           color:"#f87171" },
                { lbl:"Min Return",     val:fmtMoney(cgcTotals.retMin),          color:"#4ade80" },
                { lbl:"Max Return",     val:fmtMoney(cgcTotals.retMax),          color:"#4ade80" },
                { lbl:"Min NET GAIN",   val:fmtMoney(cgcTotals.net),             color: cgcTotals.net >= 0 ? "#4ade80" : "#f87171" },
              ].map(s => (
                <div key={s.lbl}>
                  <span style={{ fontSize:"0.6rem", color:"rgba(255,255,255,0.4)", letterSpacing:"1.5px" }}>{s.lbl} </span>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem", color:s.color, letterSpacing:"1px" }}>{s.val}</span>
                </div>
              ))}
            </div>
          )}

          {/* CGC table */}
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.8rem" }}>
              <thead>
                <tr style={{ background:"var(--surface2)", borderBottom:"2px solid var(--border)" }}>
                  <th style={{ width:36, padding:"8px 10px" }} />
                  {["#","Book","Box","Raw NM","Pressing","CGC Fee","Total Spend","Min Return","Net Gain","Label"].map(h => (
                    <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontFamily:"'Bebas Neue',sans-serif",
                      letterSpacing:"1.5px", fontSize:"0.62rem", color:"var(--muted)", fontWeight:400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CGC_QUEUE.map(book => {
                  const press = book.pressingNeeded && cgcPressing ? pressPerBook : 0;
                  const spend = cgcTier + press;
                  const net   = book.returnMin - spend;
                  const isSel = cgcSelected.has(book.id);
                  return (
                    <tr key={book.id} onClick={() => toggleCgc(book.id)}
                      style={{ borderBottom:"1px solid var(--border)",
                        background: isSel ? "#c8102e0d" : "transparent",
                        cursor:"pointer", transition:"background 0.1s" }}>
                      <td style={{ padding:"8px 10px" }} onClick={e=>e.stopPropagation()}>
                        <input type="checkbox" checked={isSel} onChange={() => toggleCgc(book.id)}
                          style={{ cursor:"pointer" }} />
                      </td>
                      <td style={{ padding:"8px 10px", color:"var(--muted)", fontFamily:"'Bebas Neue',sans-serif",
                        letterSpacing:"1px", fontSize:"0.72rem" }}>{book.id}</td>
                      <td style={{ padding:"8px 10px" }}>
                        <div style={{ fontWeight:600, color:"var(--text)" }}>{book.title}</div>
                        <div style={{ fontSize:"0.7rem", color:"var(--muted2)", marginTop:1 }}>{book.subtitle}</div>
                      </td>
                      <td style={{ padding:"8px 10px" }}>
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", fontSize:"0.7rem",
                          background:"#7a5c3a18", border:"1.5px solid #7a5c3a", color:"#7a5c3a",
                          borderRadius:3, padding:"1px 5px" }}>Box {book.box}</span>
                      </td>
                      <td style={{ padding:"8px 10px", color:"var(--green-text)", fontWeight:600 }}>${book.rawNM}</td>
                      <td style={{ padding:"8px 10px", color: press > 0 ? "#f87171" : "var(--muted)" }}>
                        {book.pressingNeeded ? (cgcPressing ? `-$${press}` : "Skip") : "N/A"}
                      </td>
                      <td style={{ padding:"8px 10px", color:"#f87171" }}>-${cgcTier}</td>
                      <td style={{ padding:"8px 10px", color:"#f87171", fontWeight:600 }}>-${spend}</td>
                      <td style={{ padding:"8px 10px", color:"var(--green-text)", fontWeight:600 }}>
                        ${book.returnMin}–${book.returnMax}
                      </td>
                      <td style={{ padding:"8px 10px", color: net >= 0 ? "#4ade80" : "#f87171", fontWeight:700 }}>
                        {net >= 0 ? "+" : ""}{fmtMoney(net)}
                      </td>
                      <td style={{ padding:"8px 10px" }}>
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem", letterSpacing:"1px",
                          background: book.label.includes("Yellow") ? "#d4a80022" : book.label.includes("Blue") ? "#1d6fa422" : "#16a34a22",
                          border:`1.5px solid ${book.label.includes("Yellow") ? "#d4a800" : book.label.includes("Blue") ? "#1d6fa4" : "#16a34a"}`,
                          color: book.label.includes("Yellow") ? "#d4a800" : book.label.includes("Blue") ? "#1d6fa4" : "#16a34a",
                          borderRadius:2, padding:"2px 6px", whiteSpace:"nowrap" }}>
                          {book.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: TOP 30 SELLERS                                                 */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === "sell30" && (
        <div>
          {/* Controls */}
          <div style={{ background:"var(--surface2)", padding:"12px 16px", borderBottom:"1px solid var(--border)",
            display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", letterSpacing:"2px", color:"var(--muted)" }}>SORT</span>
            {(["rank","return","vf"] as const).map(s => (
              <button key={s} onClick={()=>setSellSort(s)}
                style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"1.5px",
                  padding:"4px 10px", border:`1.5px solid ${sellSort===s?"var(--red)":"var(--border)"}`,
                  background:sellSort===s?"var(--red)":"transparent", color:sellSort===s?"#fff":"var(--muted2)",
                  borderRadius:3, cursor:"pointer" }}>
                {s === "rank" ? "PRIORITY" : s === "return" ? "EXPECTED ↓" : "VF VALUE ↓"}
              </button>
            ))}
            <span style={{ margin:"0 4px", color:"var(--border)" }}>|</span>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", letterSpacing:"2px", color:"var(--muted)" }}>FILTER</span>
            {(["all","RED","AMBER","GREEN"] as const).map(f => (
              <button key={f} onClick={()=>setSellFilter(f)}
                style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"1.5px",
                  padding:"4px 10px", borderRadius:3, cursor:"pointer",
                  border:`1.5px solid ${sellFilter===f ? (f==="all"?"var(--red)":PRIORITY_COLOR[f as Priority]) : "var(--border)"}`,
                  background: sellFilter===f ? (f==="all"?"var(--red)":PRIORITY_COLOR[f as Priority]+"22") : "transparent",
                  color: sellFilter===f ? (f==="all"?"#fff":PRIORITY_COLOR[f as Priority]) : "var(--muted2)" }}>
                {f === "all" ? "ALL 30" : f === "RED" ? "THIS WEEK" : f === "AMBER" ? "THIS MONTH" : "BY AUG 7"}
              </button>
            ))}
            <span style={{ marginLeft:"auto", fontSize:"0.7rem", color:"var(--muted)" }}>
              Total upside: <strong style={{color:"var(--green-text)"}}>
                {fmtMoney(sortedSell.reduce((s,b) => s + b.expectedMin, 0))}–{fmtMoney(sortedSell.reduce((s,b) => s + b.expectedMax, 0))}
              </strong>
            </span>
          </div>

          {/* Sell cards grid */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:10, padding:"12px 12px" }}>
            {sortedSell.map(book => {
              const pColor = PRIORITY_COLOR[book.actionPriority];
              const vfStr = book.rawVF > 0 ? `$${book.rawVF}` : "—";
              return (
                <div key={book.rank} style={{ flex:"1 1 280px", background:"var(--surface)",
                  border:`1px solid ${pColor}44`, borderTop:`3px solid ${pColor}`,
                  borderRadius:6, padding:"12px 14px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"2px",
                      color:"var(--muted)", background:"var(--surface2)", padding:"1px 7px", borderRadius:2 }}>
                      #{book.rank}
                    </span>
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"1.5px",
                      background:pColor+"18", color:pColor, padding:"1px 7px", borderRadius:2 }}>
                      {PRIORITY_LABEL[book.actionPriority]}
                    </span>
                  </div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.95rem", letterSpacing:"1px",
                    color:"var(--text)", lineHeight:1.2 }}>
                    {book.title} {book.issue}
                  </div>
                  <div style={{ fontSize:"0.72rem", color:"var(--muted2)", marginTop:3, lineHeight:1.4 }}>
                    {book.subtitle}
                  </div>
                  <div style={{ fontSize:"0.68rem", color:"var(--muted)", marginTop:4 }}>Box {book.box}</div>
                  <div style={{ display:"flex", gap:10, marginTop:8 }}>
                    <div>
                      <div style={{ fontSize:"0.58rem", color:"var(--muted)", letterSpacing:"1.5px" }}>VF VALUE</div>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.9rem", color:"var(--muted2)", letterSpacing:"1px" }}>{vfStr}</div>
                    </div>
                    <div style={{ borderLeft:"1px solid var(--border)", paddingLeft:10 }}>
                      <div style={{ fontSize:"0.58rem", color:"var(--muted)", letterSpacing:"1.5px" }}>EXPECTED</div>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.9rem", color:"var(--green-text)", letterSpacing:"1px" }}>
                        {fmtMoney(book.expectedMin)}–{fmtMoney(book.expectedMax)}
                      </div>
                    </div>
                    <div style={{ borderLeft:"1px solid var(--border)", paddingLeft:10, flex:1 }}>
                      <div style={{ fontSize:"0.58rem", color:"var(--muted)", letterSpacing:"1.5px" }}>PLATFORM</div>
                      <div style={{ fontSize:"0.72rem", color:"var(--text)", marginTop:1 }}>{book.platform}</div>
                    </div>
                  </div>
                  <div style={{ marginTop:8, padding:"5px 8px", background: pColor+"11",
                    border:`1px solid ${pColor}33`, borderRadius:3, fontSize:"0.7rem", color:pColor, lineHeight:1.4 }}>
                    → {book.action}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
