import { useState, useEffect } from "react";

const LS_LABELED = "brbBoxLabeled";
const LS_RUNS    = "brbRunsDone";
const LS_STEPS   = "brbStepsDone";

function loadLS<T>(key: string, def: T): T {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? def; }
  catch { return def; }
}

interface BoxEntry {
  newNum: number; oldNum: number; name: string; desc: string;
  comics: number; group: "inventory" | "marvel" | "dc" | "other" | "mixed" | "tpb";
}

const BOXES: BoxEntry[] = [
  { newNum:1,  oldNum:1,  group:"inventory", name:"SALES INVENTORY",                   desc:"92 books. 53 keys. 50 signed. All CGC candidates. Stan Lee, Bagley, King, Hickman, Atwell, Isabella. PRIORITY BOX.",                   comics:92  },
  { newNum:2,  oldNum:42, group:"marvel",    name:"X-Men Semi-Recent",                  desc:"AXM Whedon, X-Men runs, Old Man Logan",                                                                                                   comics:294 },
  { newNum:3,  oldNum:25, group:"marvel",    name:"X-Men Full Runs",                    desc:"AXM/UXM/Cable/X-Force complete runs",                                                                                                       comics:272 },
  { newNum:4,  oldNum:61, group:"marvel",    name:"Fantastic Four",                     desc:"Waid/Hickman/Fraction/Slott/North — near-complete FF",                                                                                      comics:255 },
  { newNum:5,  oldNum:72, group:"marvel",    name:"Thor/Loki Mega-Box",                 desc:"God of Thunder COMPLETE, Mighty Thor, King Thor, Loki AoA",                                                                                comics:251 },
  { newNum:6,  oldNum:23, group:"marvel",    name:"Avengers / Savage Avengers",         desc:"Savage Avengers COMPLETE, Avengers Forever",                                                                                               comics:248 },
  { newNum:7,  oldNum:34, group:"marvel",    name:"Black Panther Archive",              desc:"Priest/Hudlin/Coates/Ridley/Ewing — complete BP archive",                                                                                  comics:246 },
  { newNum:8,  oldNum:66, group:"marvel",    name:"Elektra + Black Widow + Hawkeye",    desc:"Fraction/Aja Hawkeye, Edmondson/Noto BW, Winter Soldier",                                                                                 comics:238 },
  { newNum:9,  oldNum:45, group:"marvel",    name:"X-Men Continuing",                   desc:"OML, Dead Man Logan COMPLETE, Domino, HoXPoX",                                                                                             comics:236 },
  { newNum:10, oldNum:13, group:"marvel",    name:"Captain America",                    desc:"Brubaker/Kirkman/Remender — near-complete Cap",                                                                                             comics:223 },
  { newNum:11, oldNum:41, group:"marvel",    name:"X-Men Mixed",                        desc:"OML, Generations, Phoenix Resurrection, FoHoX, FtA 2024",                                                                                 comics:214 },
  { newNum:12, oldNum:16, group:"marvel",    name:"X-Men + Deadpool + OML",             desc:"X-Men Modern, Deadpool, Old Man Logan",                                                                                                     comics:212 },
  { newNum:13, oldNum:76, group:"marvel",    name:"Iron Man Mega-Box",                  desc:"Extremis COMPLETE, Fraction Vol 2, #600, Moon Knight McKay",                                                                               comics:211 },
  { newNum:14, oldNum:35, group:"marvel",    name:"Krakoa X-Men",                       desc:"HoX+PoX COMPLETE, X-Force, X-Men Red, AXE",                                                                                               comics:205 },
  { newNum:15, oldNum:44, group:"marvel",    name:"X-Men Eras",                         desc:"Cable, Blue/Gold, Extermination, All-New X-Men",                                                                                           comics:205 },
  { newNum:16, oldNum:36, group:"marvel",    name:"Spider-Man Archive",                 desc:"Miles Morales, Scarlet Spider, Moon Knight SM",                                                                                             comics:203 },
  { newNum:17, oldNum:64, group:"marvel",    name:"Guardians of the Galaxy",            desc:"All volumes Bendis/Cates/Ewing/Lanzing COMPLETE",                                                                                          comics:192 },
  { newNum:18, oldNum:60, group:"marvel",    name:"Inhumans + Eternals + Capt Marvel",  desc:"Gaiman/Gillen Eternals, CM DeConnick complete",                                                                                            comics:191 },
  { newNum:19, oldNum:47, group:"marvel",    name:"Marvel Events",                      desc:"Empyre/CW2/Original Sin/Siege/AXIS — All COMPLETE",                                                                                        comics:187 },
  { newNum:20, oldNum:27, group:"marvel",    name:"Marvel Misc",                        desc:"Alpha Flight, New Warriors, What If",                                                                                                       comics:183 },
  { newNum:21, oldNum:65, group:"marvel",    name:"Iron Fist + Jessica Jones + SC",     desc:"Immortal IF near-complete, JJ Bendis COMPLETE, SC Yang",                                                                                  comics:180 },
  { newNum:22, oldNum:49, group:"marvel",    name:"Hulk",                               desc:"Red Hulk/Loeb/Aaron/Cates/PKJ/Indestructible",                                                                                             comics:172 },
  { newNum:23, oldNum:18, group:"marvel",    name:"Ultimate Marvel A",                  desc:"UFF/UXM/Ultimates COMPLETE",                                                                                                                comics:165 },
  { newNum:24, oldNum:26, group:"marvel",    name:"Avengers Full Runs",                 desc:"New/Uncanny Avengers full runs",                                                                                                            comics:165 },
  { newNum:25, oldNum:46, group:"marvel",    name:"Ultimate Marvel B",                  desc:"UXM/Ultimates/UWvH COMPLETE, Cataclysm",                                                                                                   comics:155 },
  { newNum:26, oldNum:52, group:"marvel",    name:"SHIELD + Ultimates (Ewing)",         desc:"Hickman SHIELD, Ewing Ultimates, Fearless Defenders",                                                                                      comics:155 },
  { newNum:27, oldNum:48, group:"marvel",    name:"Avengers Aaron/McKay",               desc:"Aaron Legacy, McKay, Twilight COMPLETE, No Road Home",                                                                                     comics:137 },
  { newNum:28, oldNum:62, group:"marvel",    name:"Annihilation + Nova + Silver Surfer", desc:"Annihilation COMPLETE, Nova, Silver Surfer",                                                                                              comics:123 },
  { newNum:29, oldNum:30, group:"marvel",    name:"Recent Marvel Modern",               desc:"Modern Storm, Miles, Bishop WC, Magic",                                                                                                    comics:111 },
  { newNum:30, oldNum:28, group:"marvel",    name:"Cap America Extended",               desc:"Siege, Super-Soldier, expanded Cap run",                                                                                                   comics:110 },
  { newNum:31, oldNum:67, group:"marvel",    name:"Doctor Strange A",                   desc:"Aaron/Waid/MacKay + Strange Academy near-complete",                                                                                        comics:94  },
  { newNum:32, oldNum:51, group:"marvel",    name:"Doctor Strange B",                   desc:"Aaron/Waid/McKay extends + Strange Academy",                                                                                               comics:91  },
  { newNum:33, oldNum:50, group:"marvel",    name:"Moon Knight All Volumes",            desc:"Ellis/Shalvey LANDMARK + all other volumes",                                                                                               comics:88  },
  { newNum:34, oldNum:31, group:"marvel",    name:"Fantastic Four Extended",            desc:"Hickman FF, Eternals Gaiman, Godzilla COMPLETE",                                                                                           comics:86  },
  { newNum:35, oldNum:39, group:"marvel",    name:"Exiles + Generation X",              desc:"Exiles #1-55 near-complete, GenX #55-75",                                                                                                  comics:80  },
  { newNum:36, oldNum:33, group:"marvel",    name:"Moon Knight + Immortal Thor",        desc:"MK volumes, Immortal Thor COMPLETE",                                                                                                        comics:78  },
  { newNum:37, oldNum:73, group:"marvel",    name:"Thunderbolts + Champions",           desc:"Parker/Zub/Kelly TB, Waid/Zub Champions",                                                                                                  comics:71  },
  { newNum:38, oldNum:4,  group:"marvel",    name:"Bronze Keys",                        desc:"Cap Falcon, Cloak Dagger, Ultimate Fallout, Bronze Age keys",                                                                              comics:60  },
  { newNum:39, oldNum:68, group:"marvel",    name:"Thor (JMS/Fraction) small box",      desc:"JMS Thor, Fraction Mighty Thor early issues",                                                                                              comics:33  },
  { newNum:40, oldNum:75, group:"marvel",    name:"Ultimate X-Men mini-box",            desc:"UXM #21-49, Ultimate X, Ultimate Secret COMPLETE",                                                                                         comics:28  },
  { newNum:41, oldNum:37, group:"marvel",    name:"Misc Overflow Marvel",               desc:"Iron Man, Strange Academy, Dark Angels overflow",                                                                                          comics:10  },
  { newNum:42, oldNum:59, group:"dc",        name:"DC New 52 + Convergence",            desc:"New 52 full runs + Convergence COMPLETE 20 tie-ins + WW Azzarello",                                                                       comics:620 },
  { newNum:43, oldNum:69, group:"dc",        name:"DC Rebirth — Tom King Batman",       desc:"Batman Hush COMPLETE, Flash Williamson, WW Rucka, JL Snyder, Action #1000",                                                               comics:262 },
  { newNum:44, oldNum:70, group:"dc",        name:"DC New 52 — Batgirl/Batwoman/NW",   desc:"Batgirl Simone, Batwoman JH Williams, Grayson, Robin War, Birds of Prey",                                                                  comics:248 },
  { newNum:45, oldNum:53, group:"dc",        name:"DC Birds of Prey / Robin / Batgirl", desc:"Dixon/Simone BoP 1999–2010, Tim Drake Robin complete",                                                                                    comics:215 },
  { newNum:46, oldNum:63, group:"dc",        name:"DC Earth 2 + JL New 52",             desc:"Earth 2 trilogy COMPLETE, World's Finest, JL New 52",                                                                                     comics:213 },
  { newNum:47, oldNum:7,  group:"dc",        name:"Flash Vol 2 + JLA",                  desc:"Waid/Morrison Flash #112-233 near-complete, JLA Morrison/Waid near-complete",                                                             comics:204 },
  { newNum:48, oldNum:15, group:"dc",        name:"DC Rebirth Core",                    desc:"Rebirth #1, JL vs SS COMPLETE, Batman King",                                                                                               comics:180 },
  { newNum:49, oldNum:14, group:"dc",        name:"Hawkman + Far Sector + IF",          desc:"Hawkman Venditti COMPLETE, Far Sector COMPLETE, IF COMPLETE",                                                                              comics:174 },
  { newNum:50, oldNum:12, group:"dc",        name:"Dawn of DC + Birds of Prey",         desc:"Dawn of DC, Birds of Prey 2023 COMPLETE #1-26",                                                                                           comics:171 },
  { newNum:51, oldNum:56, group:"dc",        name:"Impulse + Young Justice + Titans",   desc:"Impulse near-complete, YJ complete, Teen Titans Geoff Johns",                                                                             comics:154 },
  { newNum:52, oldNum:17, group:"dc",        name:"DC New 52 Extended",                 desc:"Aquaman, Batgirl, Flash, Nightwing New 52 runs",                                                                                           comics:146 },
  { newNum:53, oldNum:55, group:"dc",        name:"Legion + Nightwing",                 desc:"Legion Levitz near-complete, Nightwing Dixon complete",                                                                                    comics:143 },
  { newNum:54, oldNum:32, group:"dc",        name:"DC All In Batman",                   desc:"Batman All In, Batman & Robin Year One COMPLETE",                                                                                          comics:142 },
  { newNum:55, oldNum:29, group:"dc",        name:"DC Mixed JL/GL/WW",                  desc:"JLA, JLD, GL, Wonder Woman, Lois Lane",                                                                                                   comics:141 },
  { newNum:56, oldNum:22, group:"dc",        name:"DC Modern World's Finest",           desc:"World's Finest, Batman, Naomi, modern DC",                                                                                                 comics:140 },
  { newNum:57, oldNum:10, group:"dc",        name:"DC Modern Titans/Batman",            desc:"Titans, Tim Drake Robin, Batman, Catwoman BL",                                                                                             comics:139 },
  { newNum:58, oldNum:40, group:"dc",        name:"DC 2005 Identity/Infinite Crisis",   desc:"Identity Crisis COMPLETE, Infinite Crisis, JL Meltzer",                                                                                   comics:130 },
  { newNum:59, oldNum:20, group:"dc",        name:"DC Dawn of DC Cyborg/Jenny Sparks",  desc:"Cyborg, Jenny Sparks, Titans Dawn era",                                                                                                   comics:112 },
  { newNum:60, oldNum:11, group:"dc",        name:"Snyder JL + Dark Knights Metal",     desc:"JL Snyder COMPLETE, DKM COMPLETE, Young Justice COMPLETE",                                                                                comics:95  },
  { newNum:61, oldNum:9,  group:"dc",        name:"Future State + Milestone Returns",   desc:"Future State COMPLETE, Milestone Returns",                                                                                                 comics:86  },
  { newNum:62, oldNum:19, group:"dc",        name:"DC Misc",                            desc:"Kiss/DC misc/All-Star Superman",                                                                                                           comics:53  },
  { newNum:63, oldNum:6,  group:"dc",        name:"Silver Age + Foil",                  desc:"Thor #169 CGC 8.0, Silver Age keys, foil variants",                                                                                       comics:29  },
  { newNum:64, oldNum:71, group:"other",     name:"TV/Media Tie-Ins",                   desc:"Doctor Who all Doctors, Serenity/Firefly, Lone Ranger, Star Trek IDW Vol 1",                                                              comics:194 },
  { newNum:65, oldNum:57, group:"other",     name:"Star Trek IDW",                      desc:"Mirror War COMPLETE, TNG Minis, The Original Series",                                                                                      comics:150 },
  { newNum:66, oldNum:38, group:"other",     name:"Indie/Image",                        desc:"Firefly, Die, Monstress, Paper Girls, Saga, Sandman Overture",                                                                            comics:126 },
  { newNum:67, oldNum:24, group:"other",     name:"Independent/Dark Horse",             desc:"Gatchaman, Rocketeer, various independent titles",                                                                                         comics:118 },
  { newNum:68, oldNum:54, group:"mixed",     name:"DC 2005-2009 Mixed",                 desc:"Final Crisis COMPLETE, Batman & Robin, mixed DC/Vertigo",                                                                                  comics:227 },
  { newNum:69, oldNum:58, group:"mixed",     name:"DC 2001-2009 + Buffy",               desc:"JLA Meltzer/McDuffie, Buffy, Superman, mixed",                                                                                             comics:222 },
  { newNum:70, oldNum:21, group:"mixed",     name:"WildStorm/Vertigo/Indie",            desc:"Ex Machina, WildCATs, Vertigo titles, Indie overflow",                                                                                     comics:135 },
  { newNum:71, oldNum:43, group:"mixed",     name:"Mixed Overflow",                     desc:"Wonder Woman, FF, various overflow",                                                                                                        comics:99  },
  { newNum:72, oldNum:5,  group:"mixed",     name:"Variants + Absolute 1st Prints",     desc:"Wolverine #8 UNSIGNED, Absolute Batman/WW/Superman variants",                                                                              comics:75  },
  { newNum:73, oldNum:3,  group:"mixed",     name:"Marvel Mix",                         desc:"A-Force, Miles, Mockingbird, Star Wars mixed",                                                                                             comics:54  },
  { newNum:74, oldNum:74, group:"tpb",       name:"Trade Paperbacks / Graphic Novels",  desc:"Crisis on IE, JLA Earth 2, JLA/Avengers, Spider-Man Life Story, DC One Million, X-Men Asgardian Wars, The Escapist. 28 items.",          comics:28  },
];

interface ConsolidationRun {
  priority: 1 | 2 | 3;
  title: string;
  currentBoxes: number[];
  targetBox: number;
  action: string;
  impact: string;
}

const RUNS: ConsolidationRun[] = [
  { priority:1, title:"The Flash Vol 2 (#112–233 + Rebirth)",        currentBoxes:[47,25,26,48,46],  targetBox:47, action:"Flash Vol 2 lives primarily in Box 47. Pull Flash issues from overflow boxes (25, 26, 48, 46) and consolidate into Box 47. Cross-reference issue numbers before moving.", impact:"Single near-complete Flash run spanning Waid through Geoff Johns. Major Whatnot package." },
  { priority:1, title:"Birds of Prey Vol 1 (Dixon/Simone #1–127)",   currentBoxes:[45,26,58,46,47,68,69,71], targetBox:45, action:"BoP core lives in Box 45. Pull BoP issues from all other boxes and move to Box 45. Cross-check issue numbers.", impact:"Gail Simone's Birds of Prey complete in one box — major Whatnot package." },
  { priority:1, title:"JLA Vol 2 (Meltzer/McDuffie)",                 currentBoxes:[58,68,69,71],     targetBox:58, action:"JLA Vol 2 split between 4 boxes. Consolidate to Box 58 (DC 2005-2009) which already holds the Meltzer/McDuffie era.", impact:"Cleaner DC 2000s section." },
  { priority:1, title:"Batman — Tom King run",                        currentBoxes:[1,43,58,68,69],   targetBox:43, action:"King Batman issues in Box 1 are SIGNED — keep in Box 1 (INVENTORY). Unsigned King Batman issues consolidate to Box 43 (DC Rebirth). Move Batman from 58/68/69 to 43 if King era.", impact:"Box 43 becomes the definitive King Batman box." },
  { priority:1, title:"Detective Comics (New 52 + Tynion Rebirth)",  currentBoxes:[43,44,49,60,73],  targetBox:43, action:"DetCom New 52 (Tynion #934+) lives in Box 43. Older issues from other boxes: Rebirth era → Box 43, New 52 era → Box 44.", impact:"Clean Detective Comics continuity across two boxes." },
  { priority:2, title:"Miles Morales: Spider-Man Vol 1",              currentBoxes:[1,16,29,34],      targetBox:16, action:"Miles issues in Box 1 are signed/keys — stay in INVENTORY. Pull unsigned Miles from Boxes 29 and 34 into Box 16 (Spider-Man Archive).", impact:"All Miles content in one place except signed/key copies in Box 1." },
  { priority:2, title:"Exiles Vol 1 (#1-87 near-complete)",          currentBoxes:[1,2,3,35],        targetBox:35, action:"Exiles primary box is Box 35. Pull Exiles issues from Boxes 2 and 3 into Box 35.", impact:"Near-complete Exiles run in one box." },
  { priority:2, title:"Uncanny X-Men Vol 1 (various eras)",          currentBoxes:[2,9,12,15,41],    targetBox:2,  action:"Claremont era UXM → Box 2, Morrison era → Box 3, Bendis/Fraction era → Box 12. Sort by creative era.", impact:"X-Men boxes organized by creative era." },
  { priority:2, title:"Black Panther Vol 3 (Priest run)",            currentBoxes:[1,7,35,73],       targetBox:7,  action:"Priest BP in Box 1 is SIGNED — stay in INVENTORY. Unsigned Priest BP from other boxes go to Box 7 (Black Panther Archive).", impact:"Box 7 becomes complete BP archive. Box 1 keeps signed copies." },
  { priority:2, title:"Transformers (various)",                       currentBoxes:[1,65,66,67,72],   targetBox:66, action:"Transformers Compendium #1 (signed) stays in Box 1. Individual Transformers issues from other boxes consolidate into Box 66 or 67 (Other publisher).", impact:"Transformers collection unified." },
  { priority:3, title:"Wonder Woman (multiple eras)",                 currentBoxes:[2,43,50,55,62,63,71,72], targetBox:43, action:"WW Rucka Rebirth → Box 43. WW Azzarello New 52 → Box 42. WW Dawn of DC/modern → Box 50. Older WW → Box 55 or 58.", impact:"Wonder Woman organized by creative era across logical DC boxes." },
  { priority:3, title:"Action Comics (various eras)",                 currentBoxes:[49,50,52,53,55,59,72], targetBox:43, action:"Action Comics #1000 (landmark) lives in Box 43. Other issues: New 52 → Box 42, Rebirth → Box 43, Dawn of DC → Box 50.", impact:"Action Comics sorted by era." },
  { priority:3, title:"Sam Wilson: Captain America",                  currentBoxes:[8,10,19,30],      targetBox:10, action:"Sam Wilson Cap primarily in Box 10. Pull SWCap issues from other boxes into Box 10.", impact:"Captain America box contains all Cap incarnations." },
];

interface OrgStep {
  key: string;
  num: number;
  title: string;
  time: string;
  tools: string;
  tasks: string[];
}

const STEPS: OrgStep[] = [
  { key:"s1", num:1, title:"Label All Boxes With New Numbers",    time:"~1 hour",
    tools:"Label maker or marker, box list from this document",
    tasks:["Print pages 1-2 of this document — the New Box Order table","Starting with Box 1 (INVENTORY), apply new number labels to the outside of each box","Cross-reference: each box shows its OLD number so you know which physical box gets which new label","Do NOT move any comics at this stage — just relabel the boxes","When done, update the Box Summary tab in the spreadsheet to remove the 'was Box X' notation"] },
  { key:"s2", num:2, title:"Handle All CGC Submissions First",     time:"~2 hours across several days",
    tools:"CGC submission portal, mylar bags, backing boards, shipping supplies",
    tasks:["Stan Lee BP #513 — ALREADY SHIPPED to CGC. Monitor tracking","ASM #361 Bagley/Sharen — ALREADY SHIPPED to CGC. Monitor tracking","Roy Thomas ×5 books — ALREADY SUBMITTED. Confirm CGC received package","GREEN QUALIFIED BATCH: Press Vision #1, Black Lightning #1, New Warriors #1, WildCATs #3, Savage Dragon #1, Thor #339, MOS #18/19, Mockingbird #8, NM #96, Transformers #1, Cap Carter, Agent Carter, Hawkeye Freefall #1 — submit all to CGC × JSA","BATMAN PAIR: Send Batman #656 and #657 to presser now. Then submit CGC Modern","Do not move anything out of Box 1 (INVENTORY) until CGC submissions are complete"] },
  { key:"s3", num:3, title:"Consolidate Priority 1 Runs",          time:"~half day",
    tools:"Long box or short box, issue checklist from Section 2",
    tasks:["The Flash Vol 2: Pull Flash issues from Boxes 25, 26, 48, 46 overflow into Box 47","Birds of Prey Vol 1: Pull BoP issues from Boxes 26, 58, 46, 47, 68, 69, 71 into Box 45. Simone's run — #1-127","Batman Tom King (unsigned): Move unsigned King Batman from Boxes 58/68/69 to Box 43","Detective Comics Tynion Rebirth: Consolidate all #934+ issues into Box 43","After each series: quick count to confirm expected issue numbers are present"] },
  { key:"s4", num:4, title:"Consolidate Priority 2 Runs",          time:"~half day",
    tools:"Same as Step 3",
    tasks:["Miles Morales Spider-Man (unsigned): Pull from Boxes 29, 34 into Box 16. Leave signed Miles in Box 1","Exiles: Pull from Boxes 2, 3 into Box 35","Black Panther (unsigned): Pull from Box 73 into Box 7. Leave signed Priest BP in Box 1","Transformers issues (individual): Consolidate to Box 66 or 67 (Other publishers)","After this step: X-Men boxes (2, 3, 9, 11, 12, 14, 15) should contain ONLY X-Men content"] },
  { key:"s5", num:5, title:"Box 1 Final Audit",                    time:"~1 hour",
    tools:"Box 1 contents list from spreadsheet",
    tasks:["Box 1 (INVENTORY) should contain ONLY: signed books, high-value unsigned keys slated for CGC, and Bronze/Silver Age keys","Any non-key, non-signed, non-CGC book in Box 1 should be moved to its appropriate publisher box","After this audit, Box 1 is the crown jewels — everything that touches CGC or Heritage","Create a physical checklist of Box 1 contents. Keep it inside the box lid"] },
  { key:"s6", num:6, title:"Update Spreadsheet After Physical Moves", time:"~2–3 hours",
    tools:"Laptop, inventory spreadsheet",
    tasks:["After each physical consolidation (Steps 3-5), update the Box column in the spreadsheet for each moved book","Search by title in the spreadsheet to find all issues of a series, then batch-update the box number","Rebuild the JSON exports after all moves are complete (run the build script)","Update the Box Summary tab to reflect the new box contents"] },
  { key:"s7", num:7, title:"Terrificon Prep (Before Aug 7)",        time:"~2–3 hours",
    tools:"CGC submission forms, mylar bags, boards",
    tasks:["Wolverine #8 (Box 72) — confirm still UNSIGNED. This is your Claremont Yellow SS target","Moon Knight Vol 6 #1-6 — pull all 6 from Box 33 for Terrificon","Superman Unchained #1 + Batman Europa #1 — BAG THESE NOW. Currently unbagged","Strange Academy: buy issue #14 (~$5) before the show to complete the set for Skottie Young","Pack CGC submission forms. Drop books at CGC booth on arrival Aug 7","Hotel booked: Hyatt code G-TRFC. Jim Lee: Saturday Aug 8, 10am sharp"] },
];

const GROUP_META: Record<string, { label: string; color: string; accent: string }> = {
  inventory: { label:"📦 Inventory",          color:"#c8102e", accent:"#fff0f0" },
  marvel:    { label:"🔴 Marvel (Boxes 2–41)", color:"#c8102e", accent:"#fff8f8" },
  dc:        { label:"🔵 DC (Boxes 42–63)",    color:"#1d6fa4", accent:"#f0f6ff" },
  other:     { label:"🟢 Other (Boxes 64–67)", color:"#16a34a", accent:"#f0faf2" },
  mixed:     { label:"🟡 Mixed (Boxes 68–73)", color:"#d97706", accent:"#fffbf0" },
  tpb:       { label:"📚 TPB (Box 74)",        color:"#6b7280", accent:"#f8f8f8" },
};
const GROUP_ORDER = ["inventory","marvel","dc","other","mixed","tpb"];

function BoxCard({ b, labeled, onToggle }: { b: BoxEntry; labeled: boolean; onToggle: () => void }) {
  const gm = GROUP_META[b.group];
  const changed = b.newNum !== b.oldNum;
  return (
    <div style={{
      border: labeled ? "1.5px solid #16a34a" : `1.5px solid ${gm.color}30`,
      background: labeled ? "#f0faf4" : gm.accent,
      borderRadius:8, padding:"12px 14px", position:"relative",
      opacity: labeled ? 0.7 : 1, transition:"all 0.15s",
    }}>
      {labeled && <div style={{ position:"absolute", top:6, right:8, color:"#16a34a", fontSize:"0.85rem", fontWeight:700 }}>✓</div>}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
        <span style={{
          fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.55rem", letterSpacing:"1px",
          color: gm.color, lineHeight:1,
        }}>
          {String(b.newNum).padStart(2,"0")}
        </span>
        {changed && (
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <span style={{ fontSize:"0.62rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", color:"var(--muted)", background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:3, padding:"1px 6px" }}>
              was {b.oldNum}
            </span>
            <span style={{ color:"var(--muted)", fontSize:"0.8rem" }}>→</span>
          </div>
        )}
        {!changed && (
          <span style={{ fontSize:"0.6rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", color:"var(--muted)", background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:3, padding:"1px 6px" }}>
            UNCHANGED
          </span>
        )}
      </div>
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", letterSpacing:"0.8px", color:"var(--text)", marginBottom:3, lineHeight:1.2 }}>
        {b.name}
      </div>
      <div style={{ fontSize:"0.72rem", color:"var(--muted2)", lineHeight:1.4, marginBottom:8 }}>{b.desc}</div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.7rem", letterSpacing:"1px", color:gm.color }}>
          {b.comics} COMICS
        </span>
        <button
          onClick={onToggle}
          style={{
            fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"1px",
            padding:"3px 10px", borderRadius:4, cursor:"pointer", transition:"all 0.12s",
            background: labeled ? "#16a34a" : "transparent",
            color: labeled ? "#fff" : "#16a34a",
            border: `1.5px solid #16a34a`,
          }}
        >
          {labeled ? "LABELED ✓" : "MARK LABELED"}
        </button>
      </div>
    </div>
  );
}

function RunCard({ run, done, onToggle }: { run: ConsolidationRun; done: boolean; onToggle: () => void }) {
  const [open, setOpen] = useState(false);
  const pColor = run.priority === 1 ? "#dc2626" : run.priority === 2 ? "#d97706" : "#1d6fa4";
  return (
    <div style={{
      border:`1.5px solid ${done ? "#16a34a" : pColor+"40"}`,
      background: done ? "#f0faf4" : "var(--surface)",
      borderLeft:`3px solid ${done ? "#16a34a" : pColor}`,
      borderRadius:6, padding:"12px 16px",
      opacity: done ? 0.6 : 1, transition:"all 0.15s",
    }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
        <button
          onClick={onToggle}
          style={{
            width:20, height:20, flexShrink:0, borderRadius:4, cursor:"pointer", transition:"all 0.15s",
            border:`2px solid ${done ? "#16a34a" : "var(--border)"}`,
            background: done ? "#16a34a" : "transparent",
            display:"flex", alignItems:"center", justifyContent:"center", marginTop:1,
          }}
        >{done && <span style={{ color:"#fff", fontSize:"0.7rem" }}>✓</span>}</button>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1.5px",
              background:pColor+"18", border:`1px solid ${pColor}`, color:pColor, borderRadius:3, padding:"1px 8px" }}>
              PRIORITY {run.priority}
            </span>
          </div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.95rem", letterSpacing:"0.5px",
            color:"var(--text)", marginBottom:4, textDecoration: done ? "line-through" : "none" }}>
            {run.title}
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:6 }}>
            {run.currentBoxes.map(n => (
              <span key={n} style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"1px",
                background: n === run.targetBox ? "#16a34a20" : "var(--surface2)",
                border:`1px solid ${n === run.targetBox ? "#16a34a" : "var(--border)"}`,
                color: n === run.targetBox ? "#16a34a" : "var(--muted)",
                borderRadius:3, padding:"1px 7px" }}>
                {n === run.targetBox ? `→ Box ${n}` : `Box ${n}`}
              </span>
            ))}
          </div>
          {!open && (
            <button onClick={() => setOpen(true)} style={{ background:"none", border:"none", cursor:"pointer",
              fontSize:"0.72rem", color:"var(--muted)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic" }}>
              Show action + impact ▾
            </button>
          )}
          {open && (
            <div>
              <div style={{ fontSize:"0.8rem", color:"var(--text)", lineHeight:1.55, marginBottom:4 }}><strong>Action:</strong> {run.action}</div>
              <div style={{ fontSize:"0.8rem", color:"var(--muted2)", lineHeight:1.55, fontStyle:"italic" }}><strong>Impact:</strong> {run.impact}</div>
              <button onClick={() => setOpen(false)} style={{ background:"none", border:"none", cursor:"pointer",
                fontSize:"0.72rem", color:"var(--muted)", fontFamily:"'Crimson Pro',serif", marginTop:4 }}>
                ▲ collapse
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepCard({ step, stepDone, tasksDone, onStepToggle, onTaskToggle }: {
  step: OrgStep; stepDone: boolean;
  tasksDone: boolean[]; onStepToggle: () => void;
  onTaskToggle: (i: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const completed = tasksDone.filter(Boolean).length;
  return (
    <div style={{
      border:`1.5px solid ${stepDone ? "#16a34a" : "var(--border)"}`,
      background: stepDone ? "#f0faf4" : "var(--surface)",
      borderLeft:`4px solid ${stepDone ? "#16a34a" : "var(--red)"}`,
      borderRadius:6, padding:"14px 18px",
      opacity: stepDone ? 0.65 : 1, transition:"all 0.15s",
    }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
        <div style={{
          width:32, height:32, borderRadius:"50%", flexShrink:0,
          background: stepDone ? "#16a34a" : "var(--red)", color:"#fff",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem", letterSpacing:"1px",
        }}>{stepDone ? "✓" : step.num}</div>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:2 }}>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem", letterSpacing:"0.5px",
              color:"var(--text)", textDecoration: stepDone ? "line-through" : "none" }}>
              {step.title}
            </span>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"1.5px",
              color:"var(--muted)", background:"var(--surface2)", border:"1px solid var(--border)",
              borderRadius:3, padding:"1px 8px" }}>
              {step.time}
            </span>
          </div>
          <div style={{ fontSize:"0.78rem", color:"var(--muted2)", marginBottom:6 }}>
            <strong>Tools:</strong> {step.tools}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom: open ? 10 : 0 }}>
            <div style={{ fontSize:"0.7rem", color:"var(--muted)", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>
              {completed}/{step.tasks.length} TASKS
            </div>
            <div style={{ flex:1, height:4, background:"var(--surface2)", borderRadius:2, overflow:"hidden" }}>
              <div style={{ height:"100%", background:"#16a34a", width:`${(completed/step.tasks.length)*100}%`, transition:"width 0.3s" }} />
            </div>
            <button onClick={() => setOpen(o => !o)} style={{ background:"none", border:"none", cursor:"pointer",
              fontSize:"0.72rem", color:"var(--muted)", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>
              {open ? "COLLAPSE ▲" : "TASKS ▾"}
            </button>
          </div>
          {open && (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {step.tasks.map((t, i) => (
                <label key={i} style={{ display:"flex", alignItems:"flex-start", gap:8, cursor:"pointer" }}>
                  <div
                    onClick={() => onTaskToggle(i)}
                    style={{
                      width:16, height:16, borderRadius:3, flexShrink:0, marginTop:1, cursor:"pointer", transition:"all 0.12s",
                      border:`2px solid ${tasksDone[i] ? "#16a34a" : "var(--border)"}`,
                      background: tasksDone[i] ? "#16a34a" : "transparent",
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }}
                  >{tasksDone[i] && <span style={{ color:"#fff", fontSize:"0.6rem" }}>✓</span>}</div>
                  <span style={{ fontSize:"0.82rem", color: tasksDone[i] ? "var(--muted)" : "var(--text2)",
                    textDecoration: tasksDone[i] ? "line-through" : "none", lineHeight:1.5 }}>{t}</span>
                </label>
              ))}
              <button
                onClick={onStepToggle}
                style={{
                  fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"1.5px",
                  alignSelf:"flex-start", padding:"5px 16px", borderRadius:4, cursor:"pointer", marginTop:6,
                  background: stepDone ? "#16a34a" : "transparent",
                  color: stepDone ? "#fff" : "#16a34a", border:"1.5px solid #16a34a",
                }}
              >{stepDone ? "STEP DONE ✓" : "MARK STEP DONE"}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OrganizationPath() {
  const [tab, setTab]         = useState<"boxes"|"runs"|"steps">("steps");
  const [labeled, setLabeled] = useState<Record<number, boolean>>(() => loadLS(LS_LABELED, {}));
  const [runsDone, setRunsDone] = useState<Record<string, boolean>>(() => loadLS(LS_RUNS, {}));
  const [stepsDone, setStepsDone] = useState<Record<string, boolean>>(() => loadLS(LS_STEPS, {}));
  const [tasksDone, setTasksDone] = useState<Record<string, boolean[]>>(() =>
    loadLS("brbOrgTasks", Object.fromEntries(STEPS.map(s => [s.key, s.tasks.map(() => false)])))
  );

  useEffect(() => { localStorage.setItem(LS_LABELED, JSON.stringify(labeled)); }, [labeled]);
  useEffect(() => { localStorage.setItem(LS_RUNS, JSON.stringify(runsDone)); }, [runsDone]);
  useEffect(() => { localStorage.setItem(LS_STEPS, JSON.stringify(stepsDone)); }, [stepsDone]);
  useEffect(() => { localStorage.setItem("brbOrgTasks", JSON.stringify(tasksDone)); }, [tasksDone]);

  const labeledCount = Object.values(labeled).filter(Boolean).length;
  const runsDoneCount = Object.values(runsDone).filter(Boolean).length;
  const stepsDoneCount = STEPS.filter(s => stepsDone[s.key]).length;

  return (
    <div style={{ maxWidth:1100, margin:"0 auto", padding:"24px 20px 80px" }}>
      {/* Header */}
      <div style={{ marginBottom:16 }}>
        <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.5rem", letterSpacing:"2px", color:"var(--red)", margin:0, marginBottom:4 }}>
          Organization Path
        </h2>
        <p style={{ fontSize:"0.88rem", color:"var(--muted2)", margin:0, fontFamily:"'Crimson Pro',serif" }}>
          May 2026 — 11,776 comics · 74 boxes · Logical order: Inventory → Marvel → DC → Other → Mixed → TPB
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ display:"flex", gap:16, marginBottom:20, flexWrap:"wrap" }}>
        {[
          { label:"BOXES LABELED", val:labeledCount, total:74,                color:"#16a34a" },
          { label:"RUNS CONSOLIDATED", val:runsDoneCount, total:RUNS.length,  color:"#1d6fa4" },
          { label:"STEPS COMPLETE",   val:stepsDoneCount, total:STEPS.length, color:"var(--red)" },
        ].map(({ label, val, total, color }) => (
          <div key={label} style={{ flex:"1 1 160px", background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:8, padding:"10px 14px" }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"2px", color:"var(--muted)", marginBottom:4 }}>{label}</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.4rem", letterSpacing:"1px", color, lineHeight:1 }}>{val}<span style={{ fontSize:"0.8rem", color:"var(--muted)", marginLeft:4 }}>/ {total}</span></div>
            <div style={{ height:3, background:"var(--surface2)", borderRadius:2, marginTop:6, overflow:"hidden" }}>
              <div style={{ height:"100%", background:color, width:`${(val/total)*100}%`, transition:"width 0.3s" }} />
            </div>
          </div>
        ))}
      </div>

      {/* Tab nav */}
      <div style={{ display:"flex", gap:6, marginBottom:20, borderBottom:"2px solid var(--border)", paddingBottom:0 }}>
        {([["steps","Step-by-Step Process"],["boxes","Box Order (74 Boxes)"],["runs","Consolidate Runs"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.78rem", letterSpacing:"1.5px",
            padding:"8px 18px", cursor:"pointer", background:"none",
            color: tab===id ? "var(--red)" : "var(--muted2)",
            border:"none", borderBottom: tab===id ? "3px solid var(--red)" : "3px solid transparent",
            marginBottom:"-2px", transition:"all 0.12s",
          }}>{label}</button>
        ))}
      </div>

      {/* ── STEPS TAB ── */}
      {tab === "steps" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {STEPS.map(step => {
            const tasks = tasksDone[step.key] || step.tasks.map(() => false);
            return (
              <StepCard
                key={step.key}
                step={step}
                stepDone={!!stepsDone[step.key]}
                tasksDone={tasks}
                onStepToggle={() => setStepsDone(p => ({ ...p, [step.key]: !p[step.key] }))}
                onTaskToggle={i => {
                  const next = [...tasks];
                  next[i] = !next[i];
                  setTasksDone(p => ({ ...p, [step.key]: next }));
                }}
              />
            );
          })}
        </div>
      )}

      {/* ── BOXES TAB ── */}
      {tab === "boxes" && (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, flexWrap:"wrap" }}>
            <span style={{ fontSize:"0.8rem", color:"var(--muted2)", fontFamily:"'Crimson Pro',serif" }}>
              {labeledCount} of 74 boxes labeled. Check off each box as you apply the new number label.
            </span>
            {labeledCount > 0 && (
              <button onClick={() => setLabeled({})} style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"1px",
                background:"none", border:"1px solid var(--border)", color:"var(--muted)", borderRadius:3, padding:"2px 10px", cursor:"pointer" }}>
                RESET ALL
              </button>
            )}
          </div>
          {GROUP_ORDER.map(grp => {
            const gm = GROUP_META[grp];
            const groupBoxes = BOXES.filter(b => b.group === grp);
            const doneInGroup = groupBoxes.filter(b => labeled[b.newNum]).length;
            return (
              <div key={grp} style={{ marginBottom:28 }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10, borderBottom:`2px solid ${gm.color}30`, paddingBottom:8 }}>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem", letterSpacing:"2px", color:gm.color }}>{gm.label}</span>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"1px", color:"var(--muted)" }}>
                    {doneInGroup}/{groupBoxes.length} LABELED
                  </span>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))", gap:10 }}>
                  {groupBoxes.map(b => (
                    <BoxCard key={b.newNum} b={b} labeled={!!labeled[b.newNum]}
                      onToggle={() => setLabeled(p => ({ ...p, [b.newNum]: !p[b.newNum] }))} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── RUNS TAB ── */}
      {tab === "runs" && (
        <div>
          <p style={{ fontSize:"0.88rem", color:"var(--muted2)", marginBottom:16, fontFamily:"'Crimson Pro',serif" }}>
            338 series are currently split across multiple boxes. Work through Priority 1 first — these are the runs with the most commercial and collecting significance.
          </p>
          {([1,2,3] as const).map(p => {
            const pRuns = RUNS.filter(r => r.priority === p);
            const pColor = p===1?"#dc2626":p===2?"#d97706":"#1d6fa4";
            const pLabel = p===1?"PRIORITY 1 — Act First":p===2?"PRIORITY 2":"PRIORITY 3";
            const doneInGroup = pRuns.filter(r => runsDone[r.title]).length;
            return (
              <div key={p} style={{ marginBottom:28 }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10, borderBottom:`2px solid ${pColor}30`, paddingBottom:6 }}>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", letterSpacing:"2px", color:pColor }}>{pLabel}</span>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"1px", color:"var(--muted)" }}>
                    {doneInGroup}/{pRuns.length} DONE
                  </span>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {pRuns.map(r => (
                    <RunCard key={r.title} run={r} done={!!runsDone[r.title]}
                      onToggle={() => setRunsDone(p2 => ({ ...p2, [r.title]: !p2[r.title] }))} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
