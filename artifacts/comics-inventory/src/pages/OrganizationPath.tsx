import { useState, useEffect } from "react";

const LS_LABELED  = "brbBoxLabeled";
const LS_RUNS     = "brbRunsDone";
const LS_STEPS    = "brbStepsDone";
const LS_TASKS    = "brbOrgTasks";
const LS_BAGGED   = "brbBoxBagged";

function loadLS<T>(key: string, def: T): T {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? def; }
  catch { return def; }
}

// ─── SUPPLIES ────────────────────────────────────────────────────────────────
interface SupplyItem {
  item: string; qty: string; notes: string; retail: string; shop: string;
}
const SUPPLIES: SupplyItem[] = [
  { item:"BCW Current Bags (1,000ct bulk)",          qty:"9 cases",  notes:"~8,250 needed + 750 buffer for current pull & future buys", retail:"~$270", shop:"~$162" },
  { item:"BCW Current Backing Boards (1,000ct bulk)", qty:"9 cases",  notes:"Matches bag count exactly — buy together",                   retail:"~$315", shop:"~$189" },
  { item:"BCW Short Boxes",                          qty:"18 boxes", notes:"Overspill from 38 over-capacity boxes. Buy 3×5-pack + 1×3-pack.", retail:"~$110", shop:"~$70"  },
  { item:"BCW Silver Age bags (100ct)",              qty:"1 pack",   notes:"For ~10 Silver Age keys (Tales of Suspense, World's Finest #26/#47)", retail:"~$10",  shop:"~$6"   },
];

// ─── BOX SPLITTING ───────────────────────────────────────────────────────────
interface SplitBox {
  box: number; comics: number; over: number; newBoxes: string; keys: number; contents: string;
}
const SPLITS: SplitBox[] = [
  { box:42, comics:620, over:470, newBoxes:"+3", keys:81,  contents:"DC New 52 + Convergence — SPLIT DONE → Boxes 82, 83, 84" },
  { box:2,  comics:294, over:144, newBoxes:"+1", keys:28,  contents:"X-Men Semi-Recent: AXM Whedon + X-Men runs" },
  { box:3,  comics:272, over:122, newBoxes:"+1", keys:14,  contents:"Marvel X-Men Full Runs: AXM/UXM/Cable/X-Force" },
  { box:43, comics:262, over:112, newBoxes:"+1", keys:23,  contents:"DC Rebirth — Batman Hush COMPLETE + Tom King Batman + Flash" },
  { box:4,  comics:255, over:105, newBoxes:"+1", keys:24,  contents:"Marvel: Fantastic Four — Waid/Hickman/Fraction/Slott/North" },
  { box:5,  comics:251, over:101, newBoxes:"+1", keys:26,  contents:"Marvel: Thor/Loki mega-box — God of Thunder COMPLETE" },
  { box:6,  comics:248, over:98,  newBoxes:"+1", keys:13,  contents:"Marvel: Savage Avengers COMPLETE + Avengers Forever" },
  { box:44, comics:248, over:98,  newBoxes:"+1", keys:17,  contents:"DC New 52 — Batgirl Simone + Batwoman JH Williams + Nightwing" },
  { box:7,  comics:246, over:96,  newBoxes:"+1", keys:30,  contents:"BLACK PANTHER ARCHIVE: Priest/Hudlin/Coates/Ridley/Ewing" },
  { box:8,  comics:238, over:88,  newBoxes:"+1", keys:22,  contents:"Elektra + Black Widow + Hawkeye + Winter Soldier — SIGNED BOOKS" },
  { box:9,  comics:236, over:86,  newBoxes:"+1", keys:31,  contents:"X-Men Continuing: OML/Dead Man Logan COMPLETE/Domino/HoXPoX" },
  { box:68, comics:227, over:77,  newBoxes:"+1", keys:12,  contents:"DC 2005-2009 — Final Crisis COMPLETE + Batman & Robin" },
  { box:10, comics:223, over:73,  newBoxes:"+1", keys:24,  contents:"Captain America COMPLETE: Brubaker/Kirkman/Remender/Spencer" },
  { box:69, comics:222, over:72,  newBoxes:"+1", keys:17,  contents:"DC 2001-2009 Mixed — JLA Meltzer/McDuffie + Buffy" },
  { box:45, comics:215, over:65,  newBoxes:"+1", keys:8,   contents:"DC: Birds of Prey + Robin + Batgirl (Dixon/Simone 1999-2010)" },
  { box:11, comics:214, over:64,  newBoxes:"+1", keys:47,  contents:"X-Men Mixed: OML/Generations/Phoenix Resurrection/FoHoX/FtA" },
  { box:46, comics:213, over:63,  newBoxes:"+1", keys:14,  contents:"DC: Earth 2 + World's Finest + Justice League New 52" },
  { box:12, comics:212, over:62,  newBoxes:"+1", keys:24,  contents:"X-Men + Marvel Modern: Deadpool/Old Man Logan" },
  { box:13, comics:211, over:61,  newBoxes:"+1", keys:23,  contents:"Iron Man mega-box — Extremis Ellis + Fraction + Bendis + Moon Knight" },
  { box:14, comics:205, over:55,  newBoxes:"+1", keys:28,  contents:"Krakoa X-Men: HoX+PoX COMPLETE/X-Force/X-Men Red/AXE" },
  { box:15, comics:205, over:55,  newBoxes:"+1", keys:18,  contents:"X-Men Semi-Recent: Cable/Blue/Gold/Extermination/All-New X-Men" },
  { box:47, comics:204, over:54,  newBoxes:"+1", keys:10,  contents:"Flash Vol 2 #112-233 + JLA/JLoA Waid/Morrison/Johns" },
  { box:16, comics:203, over:53,  newBoxes:"+1", keys:18,  contents:"Spider-Man Archive: Miles/Scarlet Spider/Moon Knight SM" },
  { box:64, comics:194, over:44,  newBoxes:"+1", keys:14,  contents:"TV/Media Tie-In — Doctor Who + Serenity/Firefly + Star Trek" },
  { box:17, comics:192, over:42,  newBoxes:"+1", keys:22,  contents:"Guardians of the Galaxy — All Volumes Bendis/Cates/Ewing/Lanzing" },
  { box:18, comics:191, over:41,  newBoxes:"+1", keys:26,  contents:"Inhumans + Eternals Gaiman/Gillen + Captain Marvel" },
  { box:19, comics:187, over:37,  newBoxes:"+1", keys:21,  contents:"Marvel Events: Empyre/CW2/Original Sin/Siege/AXIS ALL COMPLETE" },
  { box:20, comics:183, over:33,  newBoxes:"+1", keys:22,  contents:"Marvel Misc: Alpha Flight/New Warriors/What If" },
  { box:48, comics:180, over:30,  newBoxes:"+1", keys:38,  contents:"DC Rebirth: Rebirth #1 + JL vs SS COMPLETE + Batman" },
  { box:21, comics:180, over:30,  newBoxes:"+1", keys:25,  contents:"Immortal Iron Fist + Jessica Jones + Shang-Chi" },
  { box:49, comics:174, over:24,  newBoxes:"+1", keys:18,  contents:"Hawkman + Far Sector + Infinite Frontier COMPLETE" },
  { box:22, comics:172, over:22,  newBoxes:"+1", keys:18,  contents:"Hulk: Red Hulk/Loeb/Aaron/Cates/PKJ/Indestructible" },
  { box:50, comics:171, over:21,  newBoxes:"+1", keys:21,  contents:"Dawn of DC + Birds of Prey COMPLETE #1-26" },
  { box:23, comics:165, over:15,  newBoxes:"+1", keys:23,  contents:"Ultimate Marvel: UFF/UXM/Ultimates COMPLETE" },
  { box:24, comics:165, over:15,  newBoxes:"+1", keys:13,  contents:"Marvel Avengers Full Runs: New/Uncanny Avengers" },
  { box:25, comics:155, over:5,   newBoxes:"+1", keys:14,  contents:"Ultimate Marvel: UXM/Ultimates/UWvH COMPLETE/Cataclysm" },
  { box:26, comics:155, over:5,   newBoxes:"+1", keys:24,  contents:"Shield/Ultimates Ewing/Fearless Defenders/Astonishing" },
  { box:51, comics:154, over:4,   newBoxes:"+1", keys:4,   contents:"DC: Impulse + Young Justice + Teen Titans — just over capacity" },
];

// ─── BAGGING PRIORITY ORDER ───────────────────────────────────────────────────
type BagPriority = "P0" | "P1" | "P2" | "P3" | "P4";
interface BagEntry {
  order: number; box: number; comics: number; keys: number; sgn: number;
  extra: string; priority: BagPriority; contents: string;
}
const BAG_ORDER: BagEntry[] = [
  { order:1,  box:1,  comics:93,  keys:54, sgn:51, extra:"OK",    priority:"P0", contents:"⭐ SALES INVENTORY — All signed books + premium keys — BAG FIRST. CGC/Heritage candidates — every spine tick costs money." },
  { order:2,  box:2,  comics:294, keys:28, sgn:1,  extra:"+1 box",priority:"P1", contents:"X-Men Semi-Recent: AXM Whedon + X-Men runs — SIGNED BOOKS — bag individually, spine side in first, no rough handling." },
  { order:3,  box:8,  comics:238, keys:22, sgn:1,  extra:"+1 box",priority:"P1", contents:"Elektra + Black Widow + Hawkeye + Winter Soldier — SIGNED BOOKS — bag individually, spine side in first, no rough handling." },
  { order:4,  box:66, comics:126, keys:36, sgn:1,  extra:"OK",    priority:"P1", contents:"Indie: Firefly/Die/Monstress/Paper Girls — SIGNED/keys — bag individually, spine side in first, no rough handling." },
  { order:5,  box:72, comics:75,  keys:26, sgn:2,  extra:"OK",    priority:"P1", contents:"Variants + Absolute 1st Prints — Wolverine #8 UNSIGNED — bag individually, spine side in first, no rough handling." },
  { order:6,  box:42, comics:620, keys:81, sgn:0,  extra:"DONE",  priority:"P2", contents:"DC New 52 + Convergence — Split into Boxes 42, 82, 83, 84 — COMPLETE." },
  { order:7,  box:3,  comics:272, keys:14, sgn:0,  extra:"+1 box",priority:"P2", contents:"Marvel X-Men Full Runs: AXM/UXM/Cable/X-Force — Split into 2 boxes during bagging." },
  { order:8,  box:43, comics:262, keys:23, sgn:0,  extra:"+1 box",priority:"P2", contents:"DC Rebirth — Batman Hush COMPLETE + Tom King Batman + Flash — Split into 2 boxes during bagging." },
  { order:9,  box:4,  comics:255, keys:24, sgn:0,  extra:"+1 box",priority:"P2", contents:"Marvel: Fantastic Four — Waid/Hickman/Fraction/Slott/North — Split into 2 boxes during bagging." },
  { order:10, box:5,  comics:251, keys:26, sgn:0,  extra:"+1 box",priority:"P2", contents:"Marvel: Thor/Loki mega-box — God of Thunder COMPLETE — Split into 2 boxes during bagging." },
  { order:11, box:6,  comics:248, keys:13, sgn:0,  extra:"+1 box",priority:"P2", contents:"Marvel: Savage Avengers COMPLETE + Avengers Forever — Split into 2 boxes during bagging." },
  { order:12, box:44, comics:248, keys:17, sgn:0,  extra:"+1 box",priority:"P2", contents:"DC New 52 — Batgirl Simone + Batwoman JH Williams + Nightwing — Split into 2 boxes during bagging." },
  { order:13, box:7,  comics:246, keys:30, sgn:0,  extra:"+1 box",priority:"P2", contents:"BLACK PANTHER ARCHIVE: Priest/Hudlin/Coates/Ridley/Ewing — Split into 2 boxes during bagging." },
  { order:14, box:9,  comics:236, keys:31, sgn:0,  extra:"+1 box",priority:"P2", contents:"X-Men Continuing: OML/Dead Man Logan COMPLETE/Domino/HoXPoX — Split into 2 boxes during bagging." },
  { order:15, box:68, comics:227, keys:12, sgn:0,  extra:"+1 box",priority:"P2", contents:"DC 2005-2009 — Final Crisis COMPLETE + Batman & Robin — Split into 2 boxes during bagging." },
  { order:16, box:10, comics:223, keys:24, sgn:0,  extra:"+1 box",priority:"P2", contents:"Captain America COMPLETE: Brubaker/Kirkman/Remender/Spencer — Split into 2 boxes during bagging." },
  { order:17, box:69, comics:222, keys:17, sgn:0,  extra:"+1 box",priority:"P2", contents:"DC 2001-2009 Mixed — JLA Meltzer/McDuffie + Buffy — Split into 2 boxes during bagging." },
  { order:18, box:45, comics:215, keys:8,  sgn:0,  extra:"+1 box",priority:"P2", contents:"DC: Birds of Prey + Robin + Batgirl (Dixon/Simone 1999-2010) — Split into 2 boxes during bagging." },
  { order:19, box:11, comics:214, keys:47, sgn:0,  extra:"+1 box",priority:"P2", contents:"X-Men Mixed: OML/Generations/Phoenix Resurrection/FoHoX/FtA — Split into 2 boxes during bagging." },
  { order:20, box:46, comics:213, keys:14, sgn:0,  extra:"+1 box",priority:"P2", contents:"DC: Earth 2 + World's Finest + Justice League New 52 — Split into 2 boxes during bagging." },
  { order:21, box:12, comics:212, keys:24, sgn:0,  extra:"+1 box",priority:"P2", contents:"X-Men + Marvel Modern: Deadpool/Old Man Logan — Split into 2 boxes during bagging." },
  { order:22, box:13, comics:211, keys:23, sgn:0,  extra:"+1 box",priority:"P2", contents:"Iron Man mega-box — Extremis Ellis + Fraction + Bendis + Moon Knight — Split into 2 boxes during bagging." },
  { order:23, box:14, comics:205, keys:28, sgn:0,  extra:"+1 box",priority:"P2", contents:"Krakoa X-Men: HoX+PoX COMPLETE/X-Force/X-Men Red/AXE — Split into 2 boxes during bagging." },
  { order:24, box:15, comics:205, keys:18, sgn:0,  extra:"+1 box",priority:"P2", contents:"X-Men Semi-Recent: Cable/Blue/Gold/Extermination/All-New X-Men — Split into 2 boxes during bagging." },
  { order:25, box:47, comics:204, keys:10, sgn:0,  extra:"+1 box",priority:"P2", contents:"Flash Vol 2 #112-233 + JLA/JLoA Waid/Morrison/Johns — Split into 2 boxes during bagging." },
  { order:26, box:16, comics:203, keys:18, sgn:0,  extra:"+1 box",priority:"P2", contents:"Spider-Man Archive: Miles/Scarlet Spider/Moon Knight SM — Split into 2 boxes during bagging." },
  { order:27, box:64, comics:194, keys:14, sgn:0,  extra:"+1 box",priority:"P2", contents:"TV/Media Tie-In — Doctor Who + Serenity/Firefly + Star Trek — Split into 2 boxes during bagging." },
  { order:28, box:17, comics:192, keys:22, sgn:0,  extra:"+1 box",priority:"P2", contents:"Guardians of the Galaxy — All Volumes Bendis/Cates/Ewing/Lanzing — Split into 2 boxes during bagging." },
  { order:29, box:18, comics:191, keys:26, sgn:0,  extra:"+1 box",priority:"P2", contents:"Inhumans + Eternals Gaiman/Gillen + Captain Marvel — Split into 2 boxes during bagging." },
  { order:30, box:19, comics:187, keys:21, sgn:0,  extra:"+1 box",priority:"P2", contents:"Marvel Events: Empyre/CW2/Original Sin/Siege/AXIS ALL COMPLETE — Split into 2 boxes during bagging." },
  { order:31, box:20, comics:183, keys:22, sgn:0,  extra:"+1 box",priority:"P2", contents:"Marvel Misc: Alpha Flight/New Warriors/What If — Split into 2 boxes during bagging." },
  { order:32, box:48, comics:180, keys:38, sgn:0,  extra:"+1 box",priority:"P2", contents:"DC Rebirth: Rebirth #1 + JL vs SS COMPLETE + Batman — Split into 2 boxes during bagging." },
  { order:33, box:21, comics:180, keys:25, sgn:0,  extra:"+1 box",priority:"P2", contents:"Immortal Iron Fist + Jessica Jones + Shang-Chi — Split into 2 boxes during bagging." },
  { order:34, box:49, comics:174, keys:18, sgn:0,  extra:"+1 box",priority:"P2", contents:"Hawkman + Far Sector + Infinite Frontier COMPLETE — Split into 2 boxes during bagging." },
  { order:35, box:22, comics:172, keys:18, sgn:0,  extra:"+1 box",priority:"P2", contents:"Hulk: Red Hulk/Loeb/Aaron/Cates/PKJ/Indestructible — Split into 2 boxes during bagging." },
  { order:36, box:50, comics:171, keys:21, sgn:0,  extra:"+1 box",priority:"P2", contents:"Dawn of DC + Birds of Prey COMPLETE #1-26 — Split into 2 boxes during bagging." },
  { order:37, box:23, comics:165, keys:23, sgn:0,  extra:"+1 box",priority:"P2", contents:"Ultimate Marvel: UFF/UXM/Ultimates COMPLETE — Split into 2 boxes during bagging." },
  { order:38, box:24, comics:165, keys:13, sgn:0,  extra:"+1 box",priority:"P2", contents:"Marvel Avengers Full Runs: New/Uncanny Avengers — Split into 2 boxes during bagging." },
  { order:39, box:25, comics:155, keys:14, sgn:0,  extra:"+1 box",priority:"P2", contents:"Ultimate Marvel: UXM/Ultimates/UWvH COMPLETE/Cataclysm — Split into 2 boxes during bagging." },
  { order:40, box:26, comics:155, keys:24, sgn:0,  extra:"+1 box",priority:"P2", contents:"Shield/Ultimates Ewing/Fearless Defenders/Astonishing — Split into 2 boxes during bagging." },
  { order:41, box:65, comics:150, keys:24, sgn:0,  extra:"OK",    priority:"P2", contents:"Star Trek IDW — Mirror War COMPLETE + TNG Minis — Single box — bag and done." },
  { order:42, box:52, comics:146, keys:43, sgn:0,  extra:"OK",    priority:"P2", contents:"DC New 52 Full Runs: Aquaman/Batgirl/Flash/NW — Single box — bag and done." },
  { order:43, box:54, comics:142, keys:16, sgn:0,  extra:"OK",    priority:"P2", contents:"DC All In: Batman All In + Batman & Robin Year One — Single box — bag and done." },
  { order:44, box:55, comics:141, keys:15, sgn:0,  extra:"OK",    priority:"P2", contents:"DC Mixed: JL/JLD/GL/Wonder Woman/Lois Lane — Single box — bag and done." },
  { order:45, box:56, comics:140, keys:14, sgn:0,  extra:"OK",    priority:"P2", contents:"DC Modern: World's Finest/Batman/Naomi — Single box — bag and done." },
  { order:46, box:57, comics:139, keys:15, sgn:0,  extra:"OK",    priority:"P2", contents:"DC Modern: Titans/Tim Drake Robin/Batman/Catwoman — Single box — bag and done." },
  { order:47, box:27, comics:137, keys:26, sgn:0,  extra:"OK",    priority:"P2", contents:"Avengers: Aaron Legacy/McKay/Twilight COMPLETE — Single box — bag and done." },
  { order:48, box:70, comics:135, keys:11, sgn:0,  extra:"OK",    priority:"P2", contents:"Wildstorm/Vertigo/Indie: Ex Machina/WildCATs — Single box — bag and done." },
  { order:49, box:58, comics:130, keys:17, sgn:0,  extra:"OK",    priority:"P2", contents:"DC 2005: Identity Crisis + Infinite Crisis + Justice League Meltzer — Single box — bag and done." },
  { order:50, box:28, comics:123, keys:20, sgn:0,  extra:"OK",    priority:"P2", contents:"Annihilation + Nova + Silver Surfer + Guardians Abnett — Single box — bag and done." },
  { order:51, box:67, comics:118, keys:17, sgn:0,  extra:"OK",    priority:"P2", contents:"Independent/Dark Horse: Gatchaman/Rocketeer — Single box — bag and done." },
  { order:52, box:59, comics:112, keys:18, sgn:0,  extra:"OK",    priority:"P2", contents:"DC Dawn of DC: Cyborg/Jenny Sparks/Titans — Single box — bag and done." },
  { order:53, box:29, comics:111, keys:10, sgn:0,  extra:"OK",    priority:"P2", contents:"Recent Marvel Modern: Storm/Miles/Bishop WC/Magic — Single box — bag and done." },
  { order:54, box:30, comics:110, keys:11, sgn:0,  extra:"OK",    priority:"P2", contents:"Cap America Extended: Siege/Super-Soldier — Single box — bag and done." },
  { order:55, box:71, comics:99,  keys:20, sgn:0,  extra:"OK",    priority:"P2", contents:"Misc Overflow: Wonder Woman/FF/Various — Single box — bag and done." },
  { order:56, box:60, comics:95,  keys:14, sgn:0,  extra:"OK",    priority:"P2", contents:"Snyder JL + Dark Knights Metal + Young Justice COMPLETE — Single box — bag and done." },
  { order:57, box:31, comics:94,  keys:12, sgn:0,  extra:"OK",    priority:"P2", contents:"Doctor Strange (Aaron/Waid/MacKay) + Strange Academy — Single box — bag and done." },
  { order:58, box:32, comics:91,  keys:19, sgn:0,  extra:"OK",    priority:"P2", contents:"Doctor Strange extended + Strange Academy — Single box — bag and done." },
  { order:59, box:33, comics:88,  keys:14, sgn:0,  extra:"OK",    priority:"P2", contents:"Moon Knight: ALL VOLUMES — Ellis/Shalvey LANDMARK — Single box — bag and done." },
  { order:60, box:61, comics:86,  keys:12, sgn:0,  extra:"OK",    priority:"P2", contents:"Future State COMPLETE + Milestone Returns — Single box — bag and done." },
  { order:61, box:34, comics:86,  keys:19, sgn:0,  extra:"OK",    priority:"P2", contents:"Mixed Marvel: FF Hickman/Eternals Gaiman/Godzilla — Single box — bag and done." },
  { order:62, box:36, comics:78,  keys:9,  sgn:0,  extra:"OK",    priority:"P2", contents:"Moon Knight + Immortal Thor COMPLETE #1-25 — Single box — bag and done." },
  { order:63, box:37, comics:71,  keys:11, sgn:0,  extra:"OK",    priority:"P2", contents:"Thunderbolts + Champions — Single box — bag and done." },
  { order:64, box:38, comics:60,  keys:25, sgn:0,  extra:"OK",    priority:"P2", contents:"Bronze Keys: Cap Falcon/Cloak Dagger/Ultimate Fallout — Single box — bag and done." },
  { order:65, box:73, comics:54,  keys:30, sgn:0,  extra:"OK",    priority:"P2", contents:"Marvel S2: A-Force/Miles/Mockingbird/Star Wars — Single box — bag and done." },
  { order:66, box:62, comics:53,  keys:11, sgn:0,  extra:"OK",    priority:"P2", contents:"Mixed Publishers: Kiss/DC misc/All-Star Superman — Single box — bag and done." },
  { order:67, box:39, comics:33,  keys:6,  sgn:0,  extra:"OK",    priority:"P2", contents:"Thor (JMS/Fraction/Aaron) — tiny box — Single box — bag and done." },
  { order:68, box:63, comics:29,  keys:10, sgn:0,  extra:"OK",    priority:"P2", contents:"Foil + Silver Age — Thor #169 CGC 8.0 slabbed — Single box — bag and done." },
  { order:69, box:74, comics:28,  keys:10, sgn:0,  extra:"OK",    priority:"P2", contents:"Trade Paperbacks / Graphic Novels — shelved separately — Single box — bag and done." },
  { order:70, box:51, comics:154, keys:4,  sgn:0,  extra:"+1 box",priority:"P3", contents:"DC: Impulse + Young Justice + Teen Titans — just over capacity — Split into 2 boxes during bagging." },
  { order:71, box:53, comics:143, keys:5,  sgn:0,  extra:"OK",    priority:"P4", contents:"DC: Legion of Superheroes + Nightwing + Outsiders — Single box — bag and done." },
  { order:72, box:35, comics:80,  keys:3,  sgn:0,  extra:"OK",    priority:"P4", contents:"Exiles #1-55 + Generation X #55-75 — Single box — bag and done." },
  { order:73, box:40, comics:28,  keys:2,  sgn:0,  extra:"OK",    priority:"P4", contents:"Ultimate X-Men #21-49 + Ultimate X + Ultimate Secret — Single box — bag and done." },
  { order:74, box:41, comics:10,  keys:3,  sgn:0,  extra:"OK",    priority:"P4", contents:"Misc Overflow: Iron Man/Strange Academy/Dark Angels — Single box — bag and done." },
];

const PRIORITY_META: Record<BagPriority, { label: string; color: string; bg: string; desc: string }> = {
  P0: { label:"P0 — INVENTORY",     color:"#c8102e", bg:"#fff5f5", desc:"Bag FIRST. Every book is CGC-bound or Heritage-bound." },
  P1: { label:"P1 — SIGNED BOOKS",  color:"#d97706", bg:"#fffbf0", desc:"Signed books in other boxes. Damage here destroys financial value." },
  P2: { label:"P2 — KEY-HEAVY",     color:"#1d6fa4", bg:"#f0f6ff", desc:"High key count. Bag in descending order of key count / box size." },
  P3: { label:"P3 — OVERSPILL",     color:"#7c3aed", bg:"#f5f0ff", desc:"Just over 150. Bag + split into spare box." },
  P4: { label:"P4 — STANDARD",      color:"#16a34a", bg:"#f0faf2", desc:"Under-capacity. Bag at your own pace." },
};

// ─── BOX ORDER ───────────────────────────────────────────────────────────────
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

// ─── CONSOLIDATION RUNS ──────────────────────────────────────────────────────
interface ConsolidationRun {
  priority: 1 | 2 | 3; title: string; currentBoxes: number[];
  targetBox: number; action: string; impact: string;
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

// ─── STEPS (v2) ──────────────────────────────────────────────────────────────
interface OrgStep { key: string; num: number; title: string; time: string; tools: string; tasks: string[]; }
const STEPS: OrgStep[] = [
  { key:"s1", num:1, title:"Order Supplies First", time:"~30 min",
    tools:"Phone / laptop to place order, or drive to comic shop",
    tasks:[
      "Go to the comic shop TODAY. Ask about trade pricing on BCW bags, boards, and short boxes.",
      "Order: 9 cases BCW current bags (1,000ct) + 9 cases BCW current boards (1,000ct) + 18 short boxes.",
      "Also order 1 pack of 100 BCW Silver Age bags for the handful of pre-1970 books.",
      "If shop can't order at trade: use Amazon, buy the 1,000-count bulk packs. Avoid 100-count packs — triple the cost.",
      "DO NOT start bagging until supplies arrive. Partially bagged boxes are a mess.",
    ],
  },
  { key:"s2", num:2, title:"Bag Box 1 — INVENTORY (Priority 0)", time:"~45 min",
    tools:"BCW current bags, backing boards, Box 1 contents list",
    tasks:[
      "Open Box 1. This contains all 56 signed books + premium keys.",
      "Bag every single book. Board inside, comic on top, bag sealed.",
      "Handle signed books with care — spine side in first, no bending.",
      "The Stan Lee, ASM #361, and Batman #125 are already at CGC — do not bag those.",
      "Confirm contents match spreadsheet Box 1 list. Any discrepancy — note it.",
      "Box 1 is already at correct capacity (93 comics < 150). No splitting needed.",
    ],
  },
  { key:"s3", num:3, title:"Bag Priority 1 Boxes — Signed Books in Other Boxes", time:"~2–3 hours",
    tools:"BCW current bags, backing boards, careful hands",
    tasks:[
      "Box 2 (294 comics, 1 signed): bag all, split into 2 boxes. Label Box 2A and Box 2B.",
      "Box 8 (238 comics, 1 signed): bag all, split into 2 boxes. Contains Batman Europa + Superman Unchained — THESE MUST BE BAGGED BEFORE TERRIFICON.",
      "Box 66 (126 comics, 1 signed): bag all — already under 150, no split needed.",
      "Box 72 (75 comics, 2 signed — Wolverine #8 UNSIGNED + Absolute variants): bag all. WOLVERINE #8 STAYS UNSIGNED — bag it separately with a note.",
    ],
  },
  { key:"s4", num:4, title:"Bag Priority 2 — Key-Heavy Boxes (Largest First)", time:"Full day × 2",
    tools:"BCW bags and boards (bulk), sharpie, new box labels",
    tasks:[
      "Box 42 overflow — DONE. Boxes 82, 83, 84 created with DC New 52 / Rebirth / Bombshells overflow. All 4 boxes now labelled.",
      "Then work down the P2 list in order: Box 3 (272) → Box 43 (262) → Box 4 (255) → Box 5 (251) → Box 6 (248) → Box 44 (248)...",
      "For every box over 150: bag the first 150, move remainder into a new labelled box.",
      "New box label format: 'Box 3B — X-Men Full Runs (overspill)'.",
      "After each box: update the spreadsheet box number for moved comics. You can batch-update by title/series.",
      "Take breaks. This is a marathon. Aim for 5-6 boxes per session maximum.",
    ],
  },
  { key:"s5", num:5, title:"Label All Boxes After Bagging", time:"~1 hour",
    tools:"Label maker or marker, box list printout",
    tasks:[
      "Once a box is bagged and at correct capacity, apply the new label.",
      "Label format: 'Box [N] — [Publisher] — [Key series]' on the SPINE of the box.",
      "For overspill boxes: 'Box [N]B — [Same label as parent] — OVERSPILL'.",
      "Print box labels from the Box Labels PDF (updated per session).",
      "Add a card divider inside every box at the 75-comic midpoint — makes finding issues faster.",
    ],
  },
  { key:"s6", num:6, title:"Terrificon Prep — Before August 6", time:"~2 hours",
    tools:"CGC submission forms, mylar bags, boards, Hotel code G-TRFC",
    tasks:[
      "Box 8 MUST be bagged before Terrificon — Batman Europa + Superman Unchained are in there.",
      "Wolverine #8 (Box 72) — confirm unsigned, bag it separately in a CGC submission bag (mylar), label clearly.",
      "Moon Knight Vol 6 #1-6 — pull from Box 33, bag in individual mylar bags for Terrificon.",
      "Pre-fill CGC submission forms at cgccomics.com before leaving.",
      "Pack: CGC forms + mylar-bagged books + backing boards + Hotel code G-TRFC confirmed.",
      "Jim Lee: Saturday August 8, arrive 10am sharp. His line fills in minutes.",
    ],
  },
  { key:"s7", num:7, title:"Bag Remaining Boxes (P3 + P4) — No Rush", time:"Ongoing",
    tools:"BCW bags, boards",
    tasks:[
      "Box 51 (154 comics) — just 4 over capacity. Bag and move 4 to a new small overflow box.",
      "Box 53, 35, 40, 41 — all under 150. Bag at your own pace. These are the easy ones.",
      "As you bag P4 boxes, update the spreadsheet. Run gen_data.mjs after each session to rebuild labels.",
      "Once all bagging is complete: run the full rebuild to update all documents.",
    ],
  },
];

// ─── GROUP META ───────────────────────────────────────────────────────────────
const GROUP_META: Record<string, { label: string; color: string; accent: string }> = {
  inventory: { label:"Inventory",          color:"#c8102e", accent:"#fff0f0" },
  marvel:    { label:"Marvel (Boxes 2–41)", color:"#c8102e", accent:"#fff8f8" },
  dc:        { label:"DC (Boxes 42–63)",    color:"#1d6fa4", accent:"#f0f6ff" },
  other:     { label:"Other (Boxes 64–67)", color:"#16a34a", accent:"#f0faf2" },
  mixed:     { label:"Mixed (Boxes 68–73)", color:"#d97706", accent:"#fffbf0" },
  tpb:       { label:"TPB (Box 74)",        color:"#6b7280", accent:"#f8f8f8" },
};
const GROUP_ORDER = ["inventory","marvel","dc","other","mixed","tpb"];

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────
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
        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.55rem", letterSpacing:"1px", color:gm.color, lineHeight:1 }}>
          {String(b.newNum).padStart(2,"0")}
        </span>
        {changed ? (
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <span style={{ fontSize:"0.62rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", color:"var(--muted)", background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:3, padding:"1px 6px" }}>
              was {b.oldNum}
            </span>
            <span style={{ color:"var(--muted)", fontSize:"0.8rem" }}>→</span>
          </div>
        ) : (
          <span style={{ fontSize:"0.6rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", color:"var(--muted)", background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:3, padding:"1px 6px" }}>UNCHANGED</span>
        )}
      </div>
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", letterSpacing:"0.8px", color:"var(--text)", marginBottom:3, lineHeight:1.2 }}>{b.name}</div>
      <div style={{ fontSize:"0.72rem", color:"var(--muted2)", lineHeight:1.4, marginBottom:8 }}>{b.desc}</div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.7rem", letterSpacing:"1px", color:gm.color }}>{b.comics} COMICS</span>
        <button onClick={onToggle} style={{
          fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"1px",
          padding:"3px 10px", borderRadius:4, cursor:"pointer", transition:"all 0.12s",
          background: labeled ? "#16a34a" : "transparent",
          color: labeled ? "#fff" : "#16a34a", border:`1.5px solid #16a34a`,
        }}>{labeled ? "LABELED ✓" : "MARK LABELED"}</button>
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
      borderRadius:6, padding:"12px 16px", opacity: done ? 0.6 : 1, transition:"all 0.15s",
    }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
        <button onClick={onToggle} style={{
          width:20, height:20, flexShrink:0, borderRadius:4, cursor:"pointer", transition:"all 0.15s",
          border:`2px solid ${done ? "#16a34a" : "var(--border)"}`, background: done ? "#16a34a" : "transparent",
          display:"flex", alignItems:"center", justifyContent:"center", marginTop:1,
        }}>{done && <span style={{ color:"#fff", fontSize:"0.7rem" }}>✓</span>}</button>
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
          {!open ? (
            <button onClick={() => setOpen(true)} style={{ background:"none", border:"none", cursor:"pointer",
              fontSize:"0.72rem", color:"var(--muted)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic" }}>
              Show action + impact ▾
            </button>
          ) : (
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
  step: OrgStep; stepDone: boolean; tasksDone: boolean[]; onStepToggle: () => void; onTaskToggle: (i: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const completed = tasksDone.filter(Boolean).length;
  return (
    <div style={{
      border:`1.5px solid ${stepDone ? "#16a34a" : "var(--border)"}`,
      background: stepDone ? "#f0faf4" : "var(--surface)",
      borderLeft:`4px solid ${stepDone ? "#16a34a" : "var(--red)"}`,
      borderRadius:6, padding:"14px 18px", opacity: stepDone ? 0.65 : 1, transition:"all 0.15s",
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
              borderRadius:3, padding:"1px 8px" }}>{step.time}</span>
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
                  <div onClick={() => onTaskToggle(i)} style={{
                    width:16, height:16, borderRadius:3, flexShrink:0, marginTop:1, cursor:"pointer", transition:"all 0.12s",
                    border:`2px solid ${tasksDone[i] ? "#16a34a" : "var(--border)"}`,
                    background: tasksDone[i] ? "#16a34a" : "transparent",
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}>{tasksDone[i] && <span style={{ color:"#fff", fontSize:"0.6rem" }}>✓</span>}</div>
                  <span style={{ fontSize:"0.82rem", color: tasksDone[i] ? "var(--muted)" : "var(--text2)",
                    textDecoration: tasksDone[i] ? "line-through" : "none", lineHeight:1.5 }}>{t}</span>
                </label>
              ))}
              <button onClick={onStepToggle} style={{
                fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"1.5px",
                alignSelf:"flex-start", padding:"5px 16px", borderRadius:4, cursor:"pointer", marginTop:6,
                background: stepDone ? "#16a34a" : "transparent",
                color: stepDone ? "#fff" : "#16a34a", border:"1.5px solid #16a34a",
              }}>{stepDone ? "STEP DONE ✓" : "MARK STEP DONE"}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function OrganizationPath() {
  const [tab, setTab]           = useState<"steps"|"supplies"|"bagorder"|"boxes"|"runs">("steps");
  const [labeled,   setLabeled]   = useState<Record<number, boolean>>(() => loadLS(LS_LABELED, {}));
  const [bagged,    setBagged]    = useState<Record<number, boolean>>(() => loadLS(LS_BAGGED,  {}));
  const [runsDone,  setRunsDone]  = useState<Record<string, boolean>>(() => loadLS(LS_RUNS, {}));
  const [stepsDone, setStepsDone] = useState<Record<string, boolean>>(() => loadLS(LS_STEPS, {}));
  const [tasksDone, setTasksDone] = useState<Record<string, boolean[]>>(() =>
    loadLS(LS_TASKS, Object.fromEntries(STEPS.map(s => [s.key, s.tasks.map(() => false)])))
  );
  const [splitFilter, setSplitFilter] = useState(false);
  const [bagPrioFilter, setBagPrioFilter] = useState<BagPriority | "">("");

  useEffect(() => { localStorage.setItem(LS_LABELED, JSON.stringify(labeled)); }, [labeled]);
  useEffect(() => { localStorage.setItem(LS_BAGGED,  JSON.stringify(bagged)); }, [bagged]);
  useEffect(() => { localStorage.setItem(LS_RUNS,    JSON.stringify(runsDone)); }, [runsDone]);
  useEffect(() => { localStorage.setItem(LS_STEPS,   JSON.stringify(stepsDone)); }, [stepsDone]);
  useEffect(() => { localStorage.setItem(LS_TASKS,   JSON.stringify(tasksDone)); }, [tasksDone]);

  const labeledCount   = Object.values(labeled).filter(Boolean).length;
  const baggedCount    = Object.values(bagged).filter(Boolean).length;
  const runsDoneCount  = Object.values(runsDone).filter(Boolean).length;
  const stepsDoneCount = STEPS.filter(s => stepsDone[s.key]).length;

  const displayedBagOrder = bagPrioFilter ? BAG_ORDER.filter(b => b.priority === bagPrioFilter) : BAG_ORDER;

  return (
    <div style={{ maxWidth:1100, margin:"0 auto", padding:"20px 16px 80px" }}>

      {/* Roy Thomas urgent notice */}
      <div style={{
        background:"#fff8e0", border:"1.5px solid #d4a800", borderLeft:"4px solid #d4a800",
        borderRadius:6, padding:"12px 16px", marginBottom:18,
        display:"flex", gap:14, alignItems:"flex-start", flexWrap:"wrap",
      }}>
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.8rem", letterSpacing:"2px", color:"#8a6000", marginBottom:4 }}>
            ⚠ URGENT — ROY THOMAS SS DEADLINE: JULY 10, 2026
          </div>
          <div style={{ fontSize:"0.82rem", color:"#7a5500", lineHeight:1.55, fontFamily:"'Crimson Pro',serif" }}>
            <strong>Saga of the Human Torch #3</strong> — book in hand, NOT YET SUBMITTED.
            Press immediately (CGC in-house pressing — add to next CGC submission as an add-on).
            Then ship to Roy Thomas CGC SS before July 10. Expected return: $50–80 post-signing.
            <br />
            <em>Shipping reminder: write RT on all four sides of the box. Ship tracked and insured. Include CGC form.</em>
          </div>
        </div>
      </div>

      {/* Header */}
      <div style={{ marginBottom:14 }}>
        <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.5rem", letterSpacing:"2px", color:"var(--red)", margin:0, marginBottom:4 }}>
          Organization Path — v2
        </h2>
        <p style={{ fontSize:"0.88rem", color:"var(--muted2)", margin:0, fontFamily:"'Crimson Pro',serif" }}>
          May 2026 — 11,776 comics · 74 boxes · 1,463 keys · 56 signed · 18 new short boxes needed · 70% unbagged
        </p>
      </div>

      {/* Progress tiles */}
      <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        {[
          { label:"STEPS COMPLETE",      val:stepsDoneCount, total:STEPS.length,  color:"var(--red)" },
          { label:"BOXES BAGGED",        val:baggedCount,    total:74,            color:"#1d6fa4"    },
          { label:"BOXES LABELED",       val:labeledCount,   total:74,            color:"#16a34a"    },
          { label:"RUNS CONSOLIDATED",   val:runsDoneCount,  total:RUNS.length,   color:"#d97706"    },
        ].map(({ label, val, total, color }) => (
          <div key={label} style={{ flex:"1 1 140px", background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:8, padding:"10px 14px" }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem", letterSpacing:"2px", color:"var(--muted)", marginBottom:4 }}>{label}</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.4rem", letterSpacing:"1px", color, lineHeight:1 }}>
              {val}<span style={{ fontSize:"0.8rem", color:"var(--muted)", marginLeft:4 }}>/ {total}</span>
            </div>
            <div style={{ height:3, background:"var(--surface2)", borderRadius:2, marginTop:6, overflow:"hidden" }}>
              <div style={{ height:"100%", background:color, width:`${(val/total)*100}%`, transition:"width 0.3s" }} />
            </div>
          </div>
        ))}
      </div>

      {/* Tab nav */}
      <div style={{ display:"flex", gap:2, marginBottom:20, borderBottom:"2px solid var(--border)", overflowX:"auto", scrollbarWidth:"none" }}>
        {([
          ["steps",    "Steps"],
          ["supplies", "Supplies"],
          ["bagorder", "Bag Order"],
          ["boxes",    "Box Map"],
          ["runs",     "Consolidate"],
        ] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.78rem", letterSpacing:"1.5px",
            padding:"8px 16px", cursor:"pointer", background:"none", whiteSpace:"nowrap",
            color: tab===id ? "var(--red)" : "var(--muted2)",
            border:"none", borderBottom: tab===id ? "3px solid var(--red)" : "3px solid transparent",
            marginBottom:"-2px", transition:"all 0.12s", flexShrink:0,
          }}>{label}</button>
        ))}
      </div>

      {/* ── STEPS ── */}
      {tab === "steps" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {STEPS.map(step => {
            const tasks = tasksDone[step.key] || step.tasks.map(() => false);
            return (
              <StepCard key={step.key} step={step} stepDone={!!stepsDone[step.key]} tasksDone={tasks}
                onStepToggle={() => setStepsDone(p => ({ ...p, [step.key]: !p[step.key] }))}
                onTaskToggle={i => {
                  const next = [...tasks]; next[i] = !next[i];
                  setTasksDone(p => ({ ...p, [step.key]: next }));
                }}
              />
            );
          })}
        </div>
      )}

      {/* ── SUPPLIES ── */}
      {tab === "supplies" && (
        <div>
          <div style={{ background:"#fff8e0", border:"1.5px solid #d4a800", borderRadius:6, padding:"12px 16px", marginBottom:20 }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.75rem", letterSpacing:"2px", color:"#8a6000", marginBottom:6 }}>
              11,776 comics · 74 short boxes at 150 capacity = 79 boxes needed · 18 new short boxes required for overspill · 70% unbagged ≈ 8,250 comics needing bags and boards
            </div>
            <div style={{ fontSize:"0.82rem", color:"#7a5500", fontFamily:"'Crimson Pro',serif", lineHeight:1.6 }}>
              <strong>ORDER VIA YOUR COMIC SHOP</strong> — trade pricing saves ~$280 vs retail.
              Order bags + boards together. Buy short boxes in packs (5-pack is cheapest per unit).
              <strong> DO NOT order boxes until after you have bagged one box</strong> and confirmed your actual comics-per-box number — it varies by board thickness.
            </div>
          </div>

          {/* Supplies table */}
          <div style={{ border:"1.5px solid var(--border)", borderRadius:8, overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:"2fr 80px 2fr 90px 90px",
              background:"#1a1a1a", padding:"8px 14px", gap:12 }}>
              {["ITEM","QTY","NOTES","RETAIL","VIA SHOP"].map(h => (
                <span key={h} style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"2px", color:"rgba(255,255,255,0.7)" }}>{h}</span>
              ))}
            </div>
            {SUPPLIES.map((s, i) => (
              <div key={i} style={{
                display:"grid", gridTemplateColumns:"2fr 80px 2fr 90px 90px",
                gap:12, padding:"12px 14px", alignItems:"start",
                background: i % 2 === 0 ? "var(--surface)" : "var(--surface2)",
                borderTop:"1px solid var(--border)",
              }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.88rem", letterSpacing:"0.5px", color:"var(--text)", lineHeight:1.3 }}>{s.item}</div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.1rem", letterSpacing:"1px", color:"var(--red)" }}>{s.qty}</div>
                <div style={{ fontSize:"0.8rem", color:"var(--muted2)", lineHeight:1.5, fontFamily:"'Crimson Pro',serif" }}>{s.notes}</div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.88rem", color:"var(--muted2)" }}>{s.retail}</div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.88rem", color:"#16a34a" }}>{s.shop}</div>
              </div>
            ))}
            {/* Totals row */}
            <div style={{
              display:"grid", gridTemplateColumns:"2fr 80px 2fr 90px 90px",
              gap:12, padding:"12px 14px", alignItems:"start",
              background:"var(--surface)", borderTop:"2px solid var(--border)",
            }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.88rem", letterSpacing:"1px", color:"var(--text)", gridColumn:"1/3" }}>TOTAL</div>
              <div />
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem", color:"var(--muted2)" }}>~$705</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem", color:"#16a34a", fontWeight:700 }}>~$427</div>
            </div>
          </div>

          {/* Box splitting summary */}
          <div style={{ marginTop:28 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, borderBottom:"2px solid var(--border)", paddingBottom:8 }}>
              <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem", letterSpacing:"2px", color:"var(--red)" }}>BOX SPLITTING — WHERE THE 18 NEW BOXES GO</span>
              <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1px", color:"var(--muted)" }}>
                38 BOXES OVER 150 CAPACITY
              </span>
              <button onClick={() => setSplitFilter(v => !v)} style={{
                marginLeft:"auto", fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"1px",
                padding:"4px 12px", borderRadius:4, cursor:"pointer",
                background: splitFilter ? "var(--red)" : "transparent",
                color: splitFilter ? "#fff" : "var(--red)", border:"1.5px solid var(--red)",
              }}>
                {splitFilter ? "SHOW ALL ▲" : "BIGGEST FIRST ▼"}
              </button>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.82rem" }}>
                <thead>
                  <tr style={{ background:"var(--surface2)" }}>
                    {["Box","Comics","Over 150","New Boxes","Keys","Contents"].map(h => (
                      <th key={h} style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"1.5px",
                        color:"var(--muted)", padding:"7px 10px", textAlign:"left", whiteSpace:"nowrap", borderBottom:"2px solid var(--border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(splitFilter ? [...SPLITS].sort((a,b) => b.over - a.over) : SPLITS).map((s, i) => (
                    <tr key={s.box} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--surface2)" }}>
                      <td style={{ padding:"7px 10px", fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem", letterSpacing:"1px", color:"var(--red)" }}>{s.box}</td>
                      <td style={{ padding:"7px 10px", fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.9rem", color:"var(--text)" }}>{s.comics}</td>
                      <td style={{ padding:"7px 10px", fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.9rem", color:"#dc2626" }}>+{s.over}</td>
                      <td style={{ padding:"7px 10px" }}>
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.78rem", letterSpacing:"1px",
                          background:"#fff5f5", color:"#dc2626", border:"1px solid #fca5a5", borderRadius:3, padding:"2px 8px" }}>{s.newBoxes}</span>
                      </td>
                      <td style={{ padding:"7px 10px" }}>
                        {s.keys > 0 && <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.75rem", letterSpacing:"1px",
                          background:"#fff8e0", color:"#8a6000", border:"1px solid #d4a800", borderRadius:3, padding:"1px 7px" }}>★ {s.keys}</span>}
                      </td>
                      <td style={{ padding:"7px 10px", fontSize:"0.78rem", color:"var(--muted2)", lineHeight:1.4 }}>{s.contents}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── BAG ORDER ── */}
      {tab === "bagorder" && (
        <div>
          {/* Priority key */}
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
            {(Object.entries(PRIORITY_META) as [BagPriority, typeof PRIORITY_META[BagPriority]][]).map(([p, m]) => (
              <button key={p} onClick={() => setBagPrioFilter(bagPrioFilter === p ? "" : p)} style={{
                display:"flex", flexDirection:"column", gap:2,
                padding:"8px 12px", borderRadius:6, cursor:"pointer", transition:"all 0.15s", textAlign:"left",
                background: bagPrioFilter === p ? m.color : m.bg,
                border:`1.5px solid ${m.color}`,
              }}>
                <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem", letterSpacing:"1.5px",
                  color: bagPrioFilter === p ? "#fff" : m.color }}>{m.label}</span>
                <span style={{ fontSize:"0.68rem", color: bagPrioFilter === p ? "rgba(255,255,255,0.8)" : "var(--muted2)",
                  fontFamily:"'Crimson Pro',serif", lineHeight:1.3 }}>{m.desc}</span>
              </button>
            ))}
          </div>

          <div style={{ fontSize:"0.8rem", color:"var(--muted2)", marginBottom:14, fontFamily:"'Crimson Pro',serif" }}>
            {baggedCount} of 74 boxes bagged. Tap a row to mark it done.
            {baggedCount > 0 && (
              <button onClick={() => setBagged({})} style={{ marginLeft:12, fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"1px",
                background:"none", border:"1px solid var(--border)", color:"var(--muted)", borderRadius:3, padding:"2px 10px", cursor:"pointer" }}>
                RESET
              </button>
            )}
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {displayedBagOrder.map(b => {
              const done = !!bagged[b.box];
              const pm = PRIORITY_META[b.priority];
              const needsSplit = b.extra !== "OK";
              return (
                <div key={b.order} onClick={() => setBagged(p => ({ ...p, [b.box]: !p[b.box] }))}
                  style={{
                    display:"flex", alignItems:"flex-start", gap:12,
                    padding:"10px 14px",
                    background: done ? "#f0faf4" : b.priority === "P0" ? "#fff5f5" : b.priority === "P1" ? "#fffbf0" : "var(--surface)",
                    border: `1.5px solid ${done ? "#16a34a" : pm.color+"40"}`,
                    borderLeft: `4px solid ${done ? "#16a34a" : pm.color}`,
                    borderRadius:6, cursor:"pointer", transition:"all 0.15s",
                    opacity: done ? 0.6 : 1,
                  }}>
                  {/* Order + checkbox */}
                  <div style={{ flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", gap:4, minWidth:30 }}>
                    <div style={{
                      width:22, height:22, borderRadius:4,
                      border:`2px solid ${done ? "#16a34a" : pm.color}`,
                      background: done ? "#16a34a" : "transparent",
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }}>
                      {done && <span style={{ color:"#fff", fontSize:"0.72rem" }}>✓</span>}
                    </div>
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem", letterSpacing:"1px", color:"var(--muted)" }}>#{b.order}</span>
                  </div>

                  {/* Box number */}
                  <div style={{ flexShrink:0, minWidth:54 }}>
                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.5rem", letterSpacing:"1px", color: done ? "var(--muted)" : pm.color, lineHeight:1 }}>
                      {String(b.box).padStart(2,"0")}
                    </div>
                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem", letterSpacing:"1.5px", color:"var(--muted)", marginTop:1 }}>{b.priority}</div>
                  </div>

                  {/* Contents */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:"0.82rem", color: done ? "var(--muted)" : "var(--text)", lineHeight:1.45,
                      fontFamily:"'Crimson Pro',serif", textDecoration: done ? "line-through" : "none" }}>
                      {b.contents}
                    </div>
                  </div>

                  {/* Right badges */}
                  <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end", flexShrink:0 }}>
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem", letterSpacing:"1px", color:"var(--muted)" }}>
                      {b.comics}
                    </span>
                    {b.keys > 0 && (
                      <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem", letterSpacing:"1px",
                        background:"#fff8e0", color:"#8a6000", border:"1px solid #d4a800", borderRadius:3, padding:"1px 5px" }}>
                        ★{b.keys}
                      </span>
                    )}
                    {b.sgn > 0 && (
                      <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem", letterSpacing:"1px",
                        background:"#f0faf0", color:"#16a34a", border:"1px solid #c8e6c8", borderRadius:3, padding:"1px 5px" }}>
                        ✍{b.sgn}
                      </span>
                    )}
                    {needsSplit && (
                      <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem", letterSpacing:"1px",
                        background:"#fff0f0", color:"#dc2626", border:"1px solid #fca5a5", borderRadius:3, padding:"1px 5px" }}>
                        {b.extra}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── BOX MAP ── */}
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

      {/* ── RUNS ── */}
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
