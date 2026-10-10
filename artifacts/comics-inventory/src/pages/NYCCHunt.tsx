import { useState, useMemo, useEffect } from "react";
import { DATA } from "@/data/data";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const pubOf = (title: string) => {
  const t = title.toLowerCase();
  if (/transformers/.test(t)) return "skybound";
  if (/batman|catwoman|wonder woman|dark knight|superman|justice/.test(t)) return "dc";
  return "marvel";
};

// ── NYCC signing hunt — Friday + Saturday ──────────────────────────────────────
// All dollar figures, boxes and creator assignments come from Robert's own NYCC
// analysis against comics_inventory_FINAL_0510_2058.xlsx; not independently
// re-verified here. Where two notes disagreed, the later refined plan was used.

type Group = "fri" | "sat" | "verify" | "skip";
interface Book {
  g: Group; pub: "dc" | "marvel" | "skybound"; corner: string;
  title: string; issue: string; vol: string; box: string;
  dayLabel: string; dayCls: "fri" | "sat" | "verify"; who: string;
  netLow: number | null; netHigh?: number; netNote?: string; roi: string; fee: string; cover?: string;
}

const COVERS: Record<string, string> = {
  "Absolute Batman #21": "https://comicvine.gamespot.com/a/uploads/scale_medium/11/110017/10099329-wwww.jpg",
  "Absolute Batman #6": "https://comicvine.gamespot.com/a/uploads/scale_medium/11161/111615891/9663675-cover.jpg",
  "Absolute Batman #19": "https://comicvine.gamespot.com/a/uploads/scale_medium/11161/111615891/10041672-cover.jpg",
  "Absolute Batman #8": "https://comicvine.gamespot.com/a/uploads/scale_medium/11/110017/9720719-wwww.jpg",
  "Absolute Batman #5": "https://comicvine.gamespot.com/a/uploads/scale_medium/11/110017/9627063-wwww.jpg",
  "Absolute Batman #23": "https://static.wikia.nocookie.net/marvel_dc/images/1/1f/Absolute_Batman_Vol_1_23.jpg",
  "House of X #1": "https://comicvine.gamespot.com/a/uploads/scale_medium/6/67663/8183320-7505114075-77168.jpg",
  "Wolverine #8": "https://i.ebayimg.com/images/g/QL8AAeSwD6JpFiEQ/s-l960.webp",
  "Uncanny X-Men #268": "https://static.wikia.nocookie.net/marveldatabase/images/7/7e/Uncanny_X-Men_Vol_1_268.jpg",
  "Superman Unchained #1": "https://comicvine.gamespot.com/a/uploads/scale_medium/6/67663/5102326-01.jpg",
  "X-Men: Hellfire Gala #1": "https://comicvine.gamespot.com/a/uploads/scale_medium/11155/111551850/8348898-clean.jpg",
  "Supergirl: Woman of Tomorrow #4": "https://comicvine.gamespot.com/a/uploads/scale_medium/6/67663/8162862-04.jpg",
  "Batman #3": "https://static.wikia.nocookie.net/marvel_dc/images/6/68/Batman_Vol_4_3.jpg",
};
const cov = (t: string, i: string) => COVERS[`${t} #${i}`];

const BOOKS: Book[] = [
  // FRIDAY — Miller, Ewing, and Snyder/Dragotta/Martin (confirmed Fri)
  { g: "fri", pub: "dc", corner: "BATMAN", title: "Dark Knight Returns · Facsimile", issue: "4", vol: "DKR Book 4 · Miller variant cover", box: "BUY — not owned", dayLabel: "Miller · Fri", dayCls: "fri", who: "Frank Miller — variant cover (Wolverine #8 is at CGC)", netLow: null, netNote: "value TBD", roi: "Miller signature — set the value in your sheet", fee: "$115 Miller · $64 CGC" },
  { g: "fri", pub: "dc", corner: "BATMAN", title: "Absolute Batman", issue: "21", vol: "Vol 1", box: "BOX 72", dayLabel: "Snyder · Fri", dayCls: "fri", who: "Snyder / Dragotta", netLow: 233, roi: "+1,165% on a $20 sig", fee: "flat con fee", cover: cov("Absolute Batman", "21") },
  { g: "fri", pub: "dc", corner: "BATMAN", title: "Absolute Batman", issue: "8", vol: "Vol 1 · NM", box: "BOX 104", dayLabel: "Snyder · Fri", dayCls: "fri", who: "Snyder + Dragotta + Martin (3 free sigs)", netLow: 116, netHigh: 236, roi: "free-sig standout", fee: "$0 sig · $64 CGC", cover: cov("Absolute Batman", "8") },
  { g: "fri", pub: "dc", corner: "BATMAN", title: "Absolute Batman", issue: "6", vol: "Vol 1", box: "BOX 104", dayLabel: "Snyder · Fri", dayCls: "fri", who: "Snyder / Dragotta", netLow: 135, roi: "+676%", fee: "flat con fee", cover: cov("Absolute Batman", "6") },
  { g: "fri", pub: "dc", corner: "BATMAN", title: "Absolute Batman", issue: "19", vol: "Vol 1", box: "BOX 104", dayLabel: "Snyder · Fri", dayCls: "fri", who: "Snyder / Dragotta", netLow: 123, roi: "+615%", fee: "flat con fee", cover: cov("Absolute Batman", "19") },
  { g: "fri", pub: "dc", corner: "BATMAN", title: "Absolute Batman", issue: "5", vol: "Vol 1", box: "BOX 104", dayLabel: "Snyder · Fri", dayCls: "fri", who: "Snyder / Dragotta", netLow: 58, roi: "+291%", fee: "flat con fee", cover: cov("Absolute Batman", "5") },
  { g: "fri", pub: "dc", corner: "BATMAN", title: "Absolute Batman", issue: "23", vol: "Vol 1 · NM", box: "BOX 104", dayLabel: "Snyder · Fri", dayCls: "fri", who: "Snyder + Dragotta + Martin", netLow: 38, netHigh: 88, roi: "3 sigs on an $8 raw", fee: "$0 sig · $64 CGC", cover: cov("Absolute Batman", "23") },
  { g: "fri", pub: "dc", corner: "BATMAN", title: "Absolute Batman #20 ×4", issue: "20", vol: "Vol 1 · four copies", box: "BOX 104", dayLabel: "Snyder · Fri", dayCls: "fri", who: "Snyder + Dragotta", netLow: 104, netHigh: 264, roi: "+26–66 each ×4", fee: "$0 sig · $64 CGC ea" },
  { g: "fri", pub: "marvel", corner: "HULK", title: "Immortal Hulk", issue: "1", vol: "VG/F", box: "BOX CC4", dayLabel: "Ewing · Fri 3pm", dayCls: "fri", who: "Al Ewing", netLow: 16, netHigh: 66, roi: "+16–66", fee: "$0 sig · $64 CGC" },
  // SATURDAY — Jim Lee
  { g: "sat", pub: "marvel", corner: "X-MEN", title: "Uncanny X-Men", issue: "268", vol: "Vol 1", box: "BOX 106", dayLabel: "Lee · Sat", dayCls: "sat", who: "Jim Lee (triple) — +Williams +Claremont", netLow: null, roi: "highest ceiling in the collection", fee: "part of $250 Lee bundle", cover: cov("Uncanny X-Men", "268") },
  { g: "sat", pub: "marvel", corner: "X-MEN", title: "X-Men", issue: "1", vol: "Vol 2 · 1991", box: "BOX 106", dayLabel: "Lee · Sat", dayCls: "sat", who: "Jim Lee (triple) — +Williams +Claremont", netLow: null, roi: "best-selling comic of all time", fee: "part of $250 Lee bundle" },
  { g: "sat", pub: "dc", corner: "SUPERMAN", title: "Superman Unchained", issue: "1", vol: "Vol 1 · 8.5", box: "BOX 106", dayLabel: "Lee Sat + Snyder Fri", dayCls: "sat", who: "Lee (Sat) + Snyder (Fri) + Williams + Sinclair = full team", netLow: 101, netHigh: 181, roi: "4-sig complete creative team", fee: "$83.33 Lee", cover: cov("Superman Unchained", "1") },
  // VERIFY AT BOOTH — creator day not pinned
  { g: "verify", pub: "marvel", corner: "X-MEN", title: "House of X", issue: "1", vol: "Vol 1", box: "BOX 14", dayLabel: "Larraz · verify", dayCls: "verify", who: "Pepe Larraz", netLow: 178, roi: "+890%", fee: "$20 sig", cover: cov("House of X", "1") },
  { g: "verify", pub: "skybound", corner: "SKYBOUND", title: "Transformers", issue: "1", vol: "Vol 1", box: "BOX 66", dayLabel: "DWJ · verify", dayCls: "verify", who: "Daniel Warren Johnson", netLow: 62, roi: "+308%", fee: "$20 sig" },
  { g: "verify", pub: "dc", corner: "SUPERGIRL", title: "Supergirl: Woman of Tomorrow", issue: "4", vol: "Vol 1", box: "BOX CC3", dayLabel: "King · verify", dayCls: "verify", who: "Tom King", netLow: 21, roi: "+70%", fee: "$30 King", cover: cov("Supergirl: Woman of Tomorrow", "4") },
  { g: "verify", pub: "dc", corner: "BATMAN", title: "Batman", issue: "3", vol: "Vol 3", box: "BOX CC1", dayLabel: "King · verify", dayCls: "verify", who: "Tom King", netLow: 19, roi: "+65%", fee: "$30 King", cover: cov("Batman", "3") },
  // PC ONLY
  { g: "skip", pub: "marvel", corner: "X-MEN", title: "X-Men: Hellfire Gala", issue: "1", vol: "Vol 3", box: "BOX 11 · 102", dayLabel: "Lee package", dayCls: "verify", who: "Jim Lee (package rate)", netLow: -21, roi: "−25% — PC yellow-label only", fee: "$83.33 Lee", cover: cov("X-Men: Hellfire Gala", "1") },
];

const KEY = "nycc_loot_v2";
const fmt = (n: number) => (n < 0 ? "−$" : "+$") + Math.abs(Math.round(n)).toLocaleString();

const SECTIONS: { g: Group; title: string; tag: string; tagCls: string; sub: string }[] = [
  { g: "fri", title: "Locked for Friday", tag: "Miller · Ewing · Snyder", tagCls: "fri", sub: "Everything confirmed for Friday — including the Absolute Batman free-sig engine. This is where the money is." },
  { g: "sat", title: "Locked for Saturday", tag: "Jim Lee · 3pm · DC booth", tagCls: "sat", sub: "Your three purchased Lee slots ($250 / $83.33 each). Pull from Box 106 and bag separately." },
  { g: "verify", title: "Verify at the booth", tag: "Day not pinned", tagCls: "verify", sub: "Worth grabbing if the creator has Fri/Sat hours — confirm at the booth before committing a fee." },
  { g: "skip", title: "Personal collection only", tag: "Underwater on fees", tagCls: "verify", sub: "Sign for love, not profit — the fee costs more than the signature adds." },
];

// Top signing targets — Robert's own analysis (pub date, key rationale,
// baseline value, net on a $20 fee). Cover artist carried over where known;
// covers and Owned · Box are read live. Values transcribed verbatim from
// Robert's pasted table — not re-derived.
interface Target { r: number; title: string; issue: string; iss: string; vol: string; date: string; cover?: string; why: string; base: number; net: number; }
const TARGETS: Target[] = [
  { r: 1,  title: "Absolute Batman", issue: "21", iss: "21", vol: "1", date: "Aug 2026", cover: "Nick Dragotta & Frank Martin", why: "Absolute Universe flagship hit", base: 114.99, net: 232.98 },
  { r: 2,  title: "House of X", issue: "1", iss: "1", vol: "1", date: "Sep 2019", cover: "Pepe Larraz", why: "Krakoa Era launch; “To me, my X-Men”", base: 90.00, net: 178.00 },
  { r: 3,  title: "Absolute Batman", issue: "6", iss: "6", vol: "1", date: "May 2025", cover: "Nick Dragotta & Frank Martin", why: "High-velocity 1st print run", base: 70.59, net: 135.30 },
  { r: 4,  title: "Absolute Batman", issue: "19", iss: "19", vol: "1", date: "Jun 2026", cover: "Nick Dragotta & Frank Martin", why: "Core Absolute continuity landmark", base: 65.00, net: 123.00 },
  { r: 5,  title: "Absolute Batman", issue: "8", iss: "8", vol: "1", date: "Jul 2025", cover: "Nick Dragotta & Frank Martin", why: "High-demand modern Snyder/Dragotta key", base: 52.14, net: 94.71 },
  { r: 6,  title: "Transformers", issue: "1", iss: "1", vol: "1", date: "Oct 2023", cover: "Daniel Warren Johnson", why: "Skybound relaunch; DWJ signature style", base: 37.05, net: 61.51 },
  { r: 7,  title: "Absolute Batman", issue: "5", iss: "5", vol: "1", date: "Apr 2025", cover: "Nick Dragotta & Frank Martin", why: "Established modern baseline key", base: 35.59, net: 58.30 },
  { r: 8,  title: "X-Men: Hellfire Gala", issue: "1", iss: "1", vol: "3", date: "Sep 2023", cover: "Phil Noto", why: "X-Men ’97 Disney+ animated tie-in spec", base: 28.49, net: 42.68 },
  { r: 9,  title: "Absolute Catwoman", issue: "2", iss: "2", vol: "1", date: "Sep 2026", cover: "Bengal", why: "Expanding Absolute DC line key", base: 24.75, net: 34.45 },
  { r: 10, title: "Absolute Batman", issue: "16", iss: "16", vol: "1", date: "Mar 2026", cover: "Nick Dragotta & Frank Martin", why: "Key issue in record-breaking Absolute run", base: 23.99, net: 32.78 },
  { r: 11, title: "Dark Knights: Metal", issue: "2", iss: "2", vol: "1", date: "Nov 2017", cover: "Greg Capullo, Jonathan Glapion, FCO Plascencia", why: "Snyder/Capullo Dark Multiverse invasion", base: 23.49, net: 31.68 },
  { r: 12, title: "Absolute Batman", issue: "7", iss: "7", vol: "1", date: "Jun 2025", cover: "Nick Dragotta & Frank Martin", why: "Strong contemporary collector demand", base: 22.00, net: 28.40 },
  { r: 13, title: "X-Men", issue: "35 (Legacy #700)", iss: "35", vol: "6", date: "Jun 2024", cover: "Pepe Larraz & Marte Gracia", why: "Massive milestone ending the Krakoa Era", base: 20.00, net: 24.00 },
  { r: 14, title: "Absolute Batman", issue: "12", iss: "12", vol: "1", date: "Nov 2025", cover: "Nick Dragotta & Frank Martin", why: "Mid-run spec issue", base: 19.99, net: 23.98 },
  { r: 15, title: "Winter Soldier", issue: "1", iss: "1", vol: "1", date: "Apr 2012", cover: "Lee Bermejo", why: "Brubaker/Guice classic spy thriller launch", base: 17.20, net: 17.84 },
  { r: 16, title: "Absolute Batman", issue: "15", iss: "15", vol: "1", date: "Feb 2026", cover: "Nick Dragotta & Frank Martin", why: "Continuing collector momentum", base: 16.99, net: 17.38 },
  { r: 17, title: "Absolute Batman", issue: "1", iss: "1", vol: "1", date: "Dec 2024", cover: "Nick Dragotta", why: "2024’s #1 bestselling comic launch", base: 16.94, net: 17.27 },
  { r: 18, title: "Absolute Batman", issue: "23", iss: "23", vol: "1", date: "2026 (unknown)", cover: "Nick Dragotta & Frank Martin", why: "Recent high-demand release", base: 15.00, net: 13.00 },
  { r: 19, title: "Absolute Batman", issue: "2", iss: "2", vol: "1", date: "Jan 2025", cover: "Nick Dragotta", why: "1st print continuation of blockbuster launch", base: 14.99, net: 12.98 },
  { r: 20, title: "Fantastic Four", issue: "35 (Legacy #680)", iss: "35", vol: "6", date: "Sep 2021", cover: "Variant / unlisted", why: "60 Years special milestone issue", base: 14.68, net: 12.30 },
  { r: 21, title: "Hulk", issue: "1", iss: "1", vol: "5", date: "Nov 2021", cover: "Ryan Ottley", why: "Donny Cates & Ryan Ottley starship-Hulk", base: 13.99, net: 10.78 },
  { r: 22, title: "House of X", issue: "2", iss: "2", vol: "1", date: "Oct 2019", cover: "Pepe Larraz", why: "Moira MacTaggert timeline twist", base: 13.77, net: 10.29 },
  { r: 23, title: "Wonder Woman", issue: "0", iss: "0", vol: "4", date: "Nov 2012", cover: "Cliff Chiang", why: "Azzarello/Chiang Greek god reimagining", base: 13.30, net: 9.26 },
  { r: 24, title: "Wonder Woman", issue: "0", iss: "0", vol: "1", date: "Unknown", why: "Anniversary milestone multi-story special", base: 13.30, net: 9.26 },
  { r: 25, title: "Transformers", issue: "17", iss: "17", vol: "1", date: "Feb 2025", cover: "Daniel Warren Johnson", why: "DWJ ongoing hit run spec", base: 12.46, net: 7.41 },
  { r: 26, title: "Absolute Batman", issue: "3", iss: "3", vol: "1", date: "Feb 2025", cover: "Nick Dragotta & Frank Martin", why: "Early Snyder/Dragotta hit", base: 12.29, net: 7.04 },
  { r: 27, title: "Wonder Woman/JLD: The Witching Hour", issue: "1", iss: "1", vol: "1", date: "Oct 2018", why: "Crossover event key", base: 11.95, net: 6.29 },
  { r: 28, title: "Spider-Man/Deadpool", issue: "1", iss: "1", vol: "1", date: "Mar 2016", why: "Kelly/McGuinness fan-favorite launch", base: 15.75, net: 4.65 },
  { r: 29, title: "Blood Hunt", issue: "1", iss: "1", vol: "1", date: "Jul 2024", why: "Major Marvel vampire event launch", base: 10.99, net: 4.18 },
  { r: 30, title: "Batman/Deathblow: After the Fire", issue: "1", iss: "1", vol: "1", date: "May 2002", why: "Lee/Azzarello miniseries key", base: 10.99, net: 4.18 },
  { r: 31, title: "Green Lantern/Space Ghost", issue: "1", iss: "1", vol: "6", date: "Mar 2017", why: "Hanna-Barbera crossover special", base: 10.50, net: 3.10 },
  { r: 32, title: "Justice League", issue: "3", iss: "3", vol: "4", date: "Oct 2016", why: "Rebirth era team book key", base: 9.99, net: 1.98 },
  { r: 33, title: "Justice League: No Justice", issue: "1", iss: "1", vol: "1", date: "Jul 2018", why: "Snyder event prelude key", base: 9.99, net: 1.98 },
  { r: 34, title: "Batman", issue: "650", iss: "650", vol: "1", date: "Apr 2006", why: "Post-Infinite Crisis Batman arc key", base: 9.99, net: 1.98 },
  { r: 35, title: "Batman and Robin Eternal", issue: "1", iss: "1", vol: "1", date: "Dec 2015", why: "Weekly series launch key", base: 9.99, net: 1.98 },
  { r: 36, title: "Justice League Dark", issue: "1", iss: "1", vol: "3", date: "Sep 2018", why: "Tynion/Martinez supernatural team launch", base: 9.99, net: 1.98 },
  { r: 37, title: "Captain Marvel", issue: "1", iss: "1", vol: "14", date: "Mar 2019", why: "Kelly Sue DeConnick/Carla Pacheco era key", base: 9.99, net: 1.98 },
  { r: 38, title: "Captain Marvel", issue: "1", iss: "1", vol: "1", date: "May 1968", why: "Classic Marvel silver-age key issue", base: 9.99, net: 1.98 },
  { r: 39, title: "Captain America", issue: "616", iss: "616", vol: "13", date: "May 2011", why: "Anniversary oversized milestone issue", base: 9.99, net: 1.98 },
  { r: 40, title: "Wonder Woman", issue: "1", iss: "1", vol: "4", date: "Nov 2011", why: "New 52 Azzarello/Chiang launch", base: 9.50, net: 0.90 },
  { r: 41, title: "X-Men", issue: "1", iss: "1", vol: "6", date: "Dec 2019", why: "Hickman Dawn of X relaunch", base: 8.97, net: -0.27 },
  { r: 42, title: "X-Men", issue: "1", iss: "1", vol: "8", date: "Dec 2019", why: "Alternate printing/variant entry", base: 8.97, net: -0.27 },
  { r: 43, title: "JLD/Wonder Woman: Witching Hour", issue: "1", iss: "1", vol: "1", date: "Unknown", why: "Part 2 crossover tie-in key", base: 8.54, net: -1.21 },
  { r: 44, title: "Batman: Rebirth", issue: "1", iss: "1", vol: "1", date: "Aug 2016", why: "King/Snyder Rebirth era kick-off", base: 13.00, net: -1.40 },
  { r: 45, title: "Batman Annual", issue: "1", iss: "1", vol: "2", date: "Jul 2012", why: "Snyder/Capullo New 52 Annual key", base: 8.10, net: -2.18 },
  { r: 46, title: "DC K.O.: Red Hood vs. Joker", issue: "1", iss: "1", vol: "1", date: "Feb 2026", why: "Modern event tie-in key", base: 8.00, net: -2.40 },
  { r: 47, title: "X of Swords: Creation", issue: "1", iss: "1", vol: "1", date: "Nov 2020", why: "Hickman X-Men crossover kickoff", base: 8.00, net: -2.40 },
  { r: 48, title: "X-Force", issue: "1", iss: "1", vol: "5", date: "Feb 2019", why: "Brisson/Ov OGN-style launch", base: 7.99, net: -2.42 },
  { r: 49, title: "X-Force", issue: "1", iss: "1", vol: "9", date: "Feb 2019", why: "Percy Dawn of X launch", base: 7.99, net: -2.42 },
  { r: 50, title: "Fall of the House of X", issue: "1", iss: "1", vol: "1", date: "Mar 2024", why: "Duggan Krakoa finale event key", base: 7.35, net: -3.83 },
];
const netFmt = (n: number) => (n < 0 ? "−$" : "+$") + Math.abs(n).toFixed(2);
const tNorm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/^#/, "").replace(/\.0$/, "");

export default function NYCCHunt() {
  const ownedT = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const c of (DATA.comics as Array<{ Title?: string; Issue?: string; Box?: string }>)) {
      const k = `${String(c.Title || "").trim().toLowerCase()}|${tNorm(c.Issue)}`;
      (m[k] ||= []).push(String(c.Box || "?"));
    }
    return m;
  }, []);

  const [t25covers, setT25covers] = useState<Record<string, { url: string | null }>>({});
  useEffect(() => {
    let off = false;
    fetch(`${BASE}/covers.json`).then(r => r.ok ? r.json() : {})
      .then(m => { if (!off) setT25covers(m); }).catch(() => {});
    return () => { off = true; };
  }, []);
  const coverFor = (t: Target) =>
    t25covers[`${t.title}|||${t.iss}|||${t.vol}`]?.url
    || t25covers[`${t.title}|||${t.iss}`]?.url
    || null;

  // ── David Nakayama cover tracker ──────────────────────────────────────────
  // Live list of every book with a Nakayama cover credit (auto-updates as the
  // inventory's Cover Artist field is filled). Check what you bought; checked
  // ones float to the top and can be isolated with the "Only bought" filter.
  interface Nak { key: string; title: string; issue: string; iss: string; vol: string; box: string; }
  const nakayama = useMemo<Nak[]>(() => {
    const seen = new Set<string>();
    const out: Nak[] = [];
    for (const c of DATA.comics as Array<{ Title?: string; Issue?: string; Volume?: string; Box?: string; Cover_Artist?: string }>) {
      if (!/nakayama/i.test(c.Cover_Artist || "")) continue;
      const vol = String(c.Volume || "1").trim();
      const iss = tNorm(c.Issue);
      const key = `${String(c.Title || "").trim()}|||${iss}|||${vol}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, title: String(c.Title || "").trim(), issue: String(c.Issue || ""), iss, vol, box: String(c.Box || "?") });
    }
    return out.sort((a, b) => a.title.localeCompare(b.title) || (parseFloat(a.iss) || 0) - (parseFloat(b.iss) || 0));
  }, []);
  const NAK_KEY = "nycc_nakayama_bought_v1";
  const [bought, setBought] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(NAK_KEY) || "{}") || {}; } catch { return {}; }
  });
  const [onlyBought, setOnlyBought] = useState(false);
  const toggleBought = (k: string) => setBought(prev => {
    const n = { ...prev }; if (n[k]) delete n[k]; else n[k] = true;
    try { localStorage.setItem(NAK_KEY, JSON.stringify(n)); } catch { /* ignore */ }
    return n;
  });
  const nakCover = (n: Nak) => t25covers[`${n.title}|||${n.iss}|||${n.vol}`]?.url || t25covers[`${n.title}|||${n.iss}`]?.url || null;
  const nakBoughtCount = nakayama.filter(n => bought[n.key]).length;
  const nakShown = (onlyBought ? nakayama.filter(n => bought[n.key]) : nakayama)
    .slice().sort((a, b) => (bought[b.key] ? 1 : 0) - (bought[a.key] ? 1 : 0)); // checked float to top

  const t25rows = useMemo(
    () => TARGETS.map(t => ({ t, boxes: ownedT[`${t.title.toLowerCase()}|${t.iss}`] || [] })),
    [ownedT]);
  const t25owned = t25rows.filter(x => x.boxes.length);
  const t25missing = t25rows.filter(x => !x.boxes.length);

  const t25Table = (rows: { t: Target; boxes: string[] }[]) => (
    <div className="t25-wrap">
      <table className="t25">
        <thead><tr><th>#</th><th>Book</th><th>Vol</th><th>Released</th><th>Why it's a key &amp; in demand</th><th>Baseline</th><th>Net +$20</th><th>Owned · Box</th></tr></thead>
        <tbody>
          {rows.map(({ t, boxes }) => (
            <tr key={t.r}>
              <td className="t25-rank">{t.r}</td>
              <td className="t25-book">{t.title} #{t.issue}</td>
              <td className="t25-c">{t.vol}</td>
              <td className="t25-cov">{t.date}</td>
              <td className="t25-why">{t.why}</td>
              <td className="t25-num">${t.base.toFixed(2)}</td>
              <td className={`t25-num net${t.net < 0 ? " neg" : ""}`}>{netFmt(t.net)}</td>
              <td className="t25-own">{boxes.length
                ? <><b>{boxes.length}×</b> {boxes.slice(0, 4).map((b, i) => <span key={i} className="t25-box">{b}</span>)}</>
                : <span className="t25-no">not owned</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const t25Cards = (rows: { t: Target; boxes: string[] }[]) => (
    <div className="t25grid">
      {rows.map(({ t, boxes }) => {
        const url = coverFor(t);
        return (
          <div key={t.r} className="t25c">
            <div className={`t25c-cov ${pubOf(t.title)}`}>
              {url
                ? <img src={url} alt={`${t.title} #${t.issue}`} loading="lazy"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                : null}
              <span className="t25c-corner">#{t.issue}</span>
              <span className="t25c-rank">{t.r}</span>
            </div>
            <div className="t25c-body">
              <div className="t25c-title">{t.title} #{t.issue}</div>
              <div className={`t25c-net${t.net < 0 ? " neg" : ""}`}>{netFmt(t.net)}</div>
              <div className="t25c-tags">
                {boxes.slice(0, 2).map((b, i) => <span key={i} className="t25c-box">📦 {b}</span>)}
                <span className="t25c-vol">Vol {t.vol}</span>
                <span className="t25c-vol">{t.date}</span>
              </div>
              {t.cover ? <div className="t25c-ca">✍ {t.cover}</div> : null}
              <div className="t25c-why">{t.why}</div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const [captured, setCaptured] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; }
  });

  const possible = useMemo(
    () => BOOKS.reduce((s, b) => s + (b.netLow && b.netLow > 0 ? b.netLow : 0), 0), []);
  const { loot, count } = useMemo(() => {
    let loot = 0, count = 0;
    BOOKS.forEach((b, i) => {
      if (captured["b" + i]) { count++; if (b.netLow && b.netLow > 0) loot += b.netLow; }
    });
    return { loot, count };
  }, [captured]);

  const toggle = (id: string) => setCaptured(prev => {
    const n = { ...prev }; if (n[id]) delete n[id]; else n[id] = true;
    try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* ignore */ }
    return n;
  });
  const reset = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } setCaptured({}); };

  const pct = possible ? Math.min(100, (loot / possible) * 100) : 0;

  return (
    <div className="nycc">
      <style>{nyccCSS}</style>

      <header className="nycc-hero">
        <div className="nycc-kicker">New York Comic Con · Javits Center</div>
        <h1>The <em>Signature</em> Loot Hunt</h1>
        <p className="nycc-sub">Two days on the floor — Friday and Saturday. Every target is a book you own, matched to a creator and a payday. Bag them, witness every signature, cash out at CGC before you leave Saturday. Tap a card to capture it.</p>
      </header>

      <div className="nycc-hud">
        <div className="nycc-hud-row">
          <div className="nycc-stat"><span className="lbl">Loot bagged (floor)</span><span className="val loot">${Math.round(loot).toLocaleString()}</span></div>
          <div className="nycc-stat"><span className="lbl">Targets captured</span><span className="val">{count}</span></div>
          <div className="nycc-stat"><span className="lbl">Sig fees committed</span><span className="val">$365</span></div>
          <button className="nycc-reset" onClick={reset}>Reset hunt</button>
        </div>
        <div className="nycc-bar"><i style={{ width: pct + "%" }} /></div>
        <div className="nycc-hudnote">
          {count === 0
            ? <>Floor = sum of the <b>low end</b> of each captured book's net profit. Bag them all for a <b>${Math.round(possible).toLocaleString()}</b> floor.</>
            : <>Bagged <b>{count}</b> · <b>${Math.round(loot).toLocaleString()}</b> of a <b>${Math.round(possible).toLocaleString()}</b> floor. Lee ceiling books carry no stated net.</>}
        </div>
      </div>

      <section id="nakayama" className="nycc-section">
        <div className="nycc-sechead">
          <h2 className="disp">David Nakayama covers</h2>
          <span className="tag confirm">{nakBoughtCount} / {nakayama.length} bought</span>
          <p className="sec-sub">Every book with a Nakayama cover credit, live from inventory. Tap a card to mark it bought — bought ones jump to the top. Use "Only bought" to isolate your haul.</p>
        </div>
        <div className="nak-tools">
          <button className={`cc-seg-btn ${!onlyBought ? "on" : ""}`} onClick={() => setOnlyBought(false)}>All ({nakayama.length})</button>
          <button className={`cc-seg-btn ${onlyBought ? "on" : ""}`} onClick={() => setOnlyBought(true)}>Only bought ({nakBoughtCount})</button>
        </div>
        <div className="t25grid">
          {nakShown.map(n => {
            const url = nakCover(n);
            const isB = !!bought[n.key];
            return (
              <button key={n.key} className={`t25c nak-c ${isB ? "bought" : ""}`} onClick={() => toggleBought(n.key)} title={isB ? "Bought — tap to clear" : "Tap to mark bought"}>
                <div className={`t25c-cov ${pubOf(n.title)}`}>
                  {url
                    ? <img src={url} alt={`${n.title} #${n.issue}`} loading="lazy" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    : <span className="t25c-corner">#{n.issue}</span>}
                  <span className="nak-check">{isB ? "✓" : ""}</span>
                </div>
                <div className="t25c-body">
                  <div className="t25c-title">{n.title} #{n.issue}</div>
                  <div className="t25c-tags"><span className="t25c-box">📦 {n.box}</span><span className="t25c-vol">Vol {n.vol}</span></div>
                </div>
              </button>
            );
          })}
          {nakShown.length === 0 && <p className="nycc-foot">Nothing marked bought yet — tap a cover to add it.</p>}
        </div>
      </section>

      {SECTIONS.map(sec => {
        const items = BOOKS.map((b, i) => ({ b, i })).filter(x => x.b.g === sec.g);
        if (!items.length) return null;
        return (
          <section key={sec.g} className="nycc-section">
            <div className="nycc-sechead">
              <h2>{sec.title}</h2>
              <span className={`nycc-tag ${sec.tagCls}`}>{sec.tag}</span>
              <p className="nycc-secsub">{sec.sub}</p>
            </div>
            <div className="nycc-grid">
              {items.map(({ b, i }) => {
                const id = "b" + i;
                const isCap = !!captured[id];
                const flame = b.netLow == null ? "" : b.netLow >= 100 ? "🔥 " : b.netLow > 0 ? "⭐ " : "🚫 ";
                return (
                  <article key={id} className={`nycc-card ${isCap ? "captured" : ""} ${b.g === "skip" ? "skip" : ""}`}>
                    <div className="nycc-stamp">Bagged ✓</div>
                    <div className={`nycc-cover ${b.pub}`}>
                      {b.cover
                        ? <img src={b.cover} alt={`${b.title} #${b.issue}`} loading="lazy"
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        : null}
                      <span className="corner">{b.corner}</span>
                      <div className="ctile"><div className="issue">#{b.issue}</div><div className="ctitle">{b.title}</div></div>
                    </div>
                    <div className="nycc-body">
                      <div className="nycc-title">{b.title} #{b.issue}<small>{b.vol}</small></div>
                      <div className="nycc-rowline">
                        <span className={`nycc-pill loc ${/^(BUY|FIND)/.test(b.box) ? "find" : ""}`}>📦 {b.box}</span>
                        <span className={`nycc-pill day ${b.dayCls}`}>{b.dayLabel}</span>
                      </div>
                      <div className="nycc-who">{b.who}</div>
                      <div className="nycc-econ">
                        {b.netLow == null
                          ? <span className="nycc-net none">{b.netNote || "ceiling play"}</span>
                          : <span className={`nycc-net ${b.netLow < 0 ? "neg" : ""}`}>
                              {fmt(b.netLow)}{b.netHigh ? "–$" + Math.round(b.netHigh).toLocaleString() : ""}
                            </span>}
                        <span className="nycc-roi">{flame}{b.roi}</span>
                      </div>
                      <div className="nycc-note">{b.fee}</div>
                      <button className="nycc-cap" onClick={() => toggle(id)}>
                        <span className="box">{isCap ? "✓" : ""}</span>{isCap ? "Captured" : "Capture"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="nycc-section">
        <div className="nycc-sechead"><h2 className="disp">Top signing targets — owned</h2><span className="tag confirm">{t25owned.length} you own · ranked by net on a $20 fee</span>
          <p className="sec-sub">The ones you already have, ready to pull and get signed — with cover artist, why the issue is a key, and the box it's in. Books you don't own are dropped to the bottom of the page.</p></div>
        {t25owned.length ? t25Cards(t25owned)
          : <p className="nycc-foot">None of the 25 matched a copy in your inventory (by title + issue).</p>}
        <p className="nycc-foot" style={{ marginTop: 10 }}>Cover artists, key rationale and values are your own analysis; covers and Owned · Box are read live from the inventory.</p>
      </section>

      <section className="nycc-section">
        <div className="nycc-sechead"><h2>The two-day plan</h2></div>
        <div className="nycc-days">
          <div className="nycc-day">
            <div className="dd">Day 1</div><h3>Friday</h3>
            <ul className="nycc-timeline">
              <li><span className="t">On open</span><span className="d"><b>Verify your bag:</b> the DKR #4 Facsimile (for Miller), Immortal Hulk #1 (CC4), and the Absolute Batman books (Box 104 + the FIND-IT issues).</span></li>
              <li><span className="t">Slot</span><span className="d"><b>Frank Miller — your purchased slot.</b> DKR #4 Facsimile (Miller variant cover). CGC witness. <em>(Wolverine #8 is still at CGC — not available.)</em></span></li>
              <li><span className="t">DC booth</span><span className="d"><b>Snyder + Dragotta + Martin.</b> Run every Absolute Batman copy — the free-sig engine. Also sign <b>Superman Unchained #1</b> here (Snyder) so it's ready for Lee on Saturday.</span></li>
              <li><span className="t">~3:00</span><span className="d"><b>Al Ewing, DC booth.</b> Immortal Hulk #1.</span></li>
              <li><span className="t">EOD</span><span className="d">Everything signed into a hard case — unwitnessed = green label = the math collapses.</span></li>
            </ul>
          </div>
          <div className="nycc-day">
            <div className="dd">Day 2</div><h3>Saturday</h3>
            <ul className="nycc-timeline">
              <li><span className="t">On open</span><span className="d">Join the <b>Jim Lee digital queue the instant it opens</b> — it caps fast. Carry UXM #268 · X-Men #1 · Superman Unchained #1.</span></li>
              <li><span className="t">~3:00</span><span className="d"><b>Jim Lee, DC booth.</b> The three Lee books. CGC witness on every signature.</span></li>
              <li><span className="t">After Lee</span><span className="d"><b>CGC booth — submit EVERYTHING</b> signed Friday + Saturday in one batch. Last day; don't leave without submitting.</span></li>
              <li><span className="t">Buy-side</span><span className="d">Raw keys grabbed as cover-buys → log to CC1 (Marvel) / CC5 (DC) when home.</span></li>
            </ul>
          </div>
        </div>
      </section>

      <section className="nycc-section">
        <div className="nycc-sechead"><h2>The money</h2><span className="nycc-tag sat">From your analysis</span>
          <p className="nycc-secsub">With Snyder confirmed Friday, the Absolute Batman engine is in play. Note: Wolverine #8 is out (still at CGC) — the Miller slot now holds the DKR #4 Facsimile, value TBD, so re-base the net once you price it.</p></div>
        <div className="nycc-money">
          <div className="mcell"><div className="lbl">Total out (if all land)</div><div className="v">~$877</div></div>
          <div className="mcell"><div className="lbl">Fees already spent</div><div className="v">$365</div></div>
          <div className="mcell hot"><div className="lbl">Est. value created</div><div className="v">$1,460–2,180</div></div>
          <div className="mcell hot"><div className="lbl">Net (full plan)</div><div className="v">+$583–1,303</div></div>
        </div>
      </section>

      {t25missing.length > 0 && (
        <section className="nycc-section t25-ignore">
          <div className="nycc-sechead"><h2 className="disp">Don't own — probably ignore</h2><span className="tag verify">{t25missing.length} not in your inventory</span>
            <p className="sec-sub">These {t25missing.length} targets aren't in your inventory, so there's nothing to get signed. Buy-or-skip decisions for later — parked here out of the way.</p></div>
          {t25Table(t25missing)}
        </section>
      )}

      <p className="nycc-foot">All dollar figures, boxes and creator assignments are from <b>your own NYCC analysis</b> against <b>comics_inventory_FINAL_0510_2058.xlsx</b> — not independently re-verified. "Don't own" = no copy matched title + issue in the data (volume ignored). Captures and the loot total are saved in this browser only.</p>
    </div>
  );
}

const nyccCSS = `
.nycc{max-width:1080px;margin:0 auto;padding:0 18px 60px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--text)}
.nycc h1,.nycc h2,.nycc h3{margin:0;text-wrap:balance}
.nycc-hero{padding:26px 0 16px;border-bottom:3px solid var(--text)}
.nycc-kicker{font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);font-weight:700;margin-bottom:6px}
.nycc-hero h1{font-size:clamp(2.1rem,7vw,3.6rem);line-height:.95;letter-spacing:.01em}
.nycc-hero h1 em{font-style:normal;color:var(--red)}
.nycc-sub{margin-top:10px;max-width:62ch;color:var(--muted2);font-size:1rem;line-height:1.5}
.nycc-hud{position:sticky;top:0;z-index:5;background:var(--surface);border:2px solid var(--text);border-radius:14px;margin-top:16px;padding:14px 16px;display:flex;flex-direction:column;gap:11px;box-shadow:0 6px 20px rgba(0,0,0,.14)}
.nycc-hud-row{display:flex;flex-wrap:wrap;gap:14px 22px;align-items:flex-end}
.nycc-stat{display:flex;flex-direction:column;gap:1px}
.nycc-stat .lbl{font-size:.62rem;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);font-weight:700}
.nycc-stat .val{font-size:1.8rem;line-height:1;font-weight:800;font-variant-numeric:tabular-nums}
.nycc-stat .val.loot{color:#16a34a}
.nycc-reset{margin-left:auto;background:none;border:1px solid var(--border);color:var(--muted);border-radius:8px;padding:5px 10px;font-size:.66rem;letter-spacing:.09em;text-transform:uppercase;font-weight:700;cursor:pointer}
.nycc-bar{height:12px;border-radius:99px;background:var(--surface2);border:1px solid var(--border);overflow:hidden}
.nycc-bar>i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--gold),#16a34a);transition:width .5s cubic-bezier(.2,.8,.2,1)}
.nycc-hudnote{font-size:.8rem;color:var(--muted2)}
.nycc-section{margin-top:30px}
.nycc-sechead{display:flex;align-items:baseline;gap:11px;flex-wrap:wrap;border-bottom:2px solid var(--border);padding-bottom:8px;margin-bottom:15px}
.nycc-sechead h2{font-size:1.4rem}
.nycc-tag{font-size:.64rem;letter-spacing:.11em;text-transform:uppercase;font-weight:700;padding:3px 9px;border-radius:99px;white-space:nowrap}
.nycc-tag.fri{background:rgba(124,83,232,.18);color:#7c53e8}
.nycc-tag.sat{background:rgba(22,163,74,.18);color:#16a34a}
.nycc-tag.verify{background:rgba(180,105,14,.2);color:#b4690e}
.nycc-secsub{flex:1 1 100%;margin:-4px 0 0;color:var(--muted2);font-size:.88rem;line-height:1.45}
.nycc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:13px}
.nycc-card{position:relative;display:grid;grid-template-columns:92px 1fr;background:var(--surface);border:1.5px solid var(--border);border-radius:14px;overflow:hidden;box-shadow:0 2px 7px rgba(0,0,0,.08)}
.nycc-card.captured{border-color:#16a34a;background:rgba(22,163,74,.06)}
.nycc-card.skip{opacity:.74}
.nycc-cover{position:relative;min-width:0;background:#333;color:#fff;display:flex;flex-direction:column;justify-content:space-between;padding:7px}
.nycc-cover.dc{background:linear-gradient(160deg,#2a5bd7,#13308a)}
.nycc-cover.marvel{background:linear-gradient(160deg,#e23048,#9c0c23)}
.nycc-cover.skybound{background:linear-gradient(160deg,#2f8d68,#17533c)}
.nycc-cover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.nycc-cover .corner{position:relative;z-index:1;align-self:flex-start;background:rgba(0,0,0,.42);border:1px solid rgba(255,255,255,.5);border-radius:3px;font-size:.5rem;letter-spacing:.07em;font-weight:700;padding:2px 4px;text-transform:uppercase;line-height:1.05}
.nycc-cover .ctile{position:relative;z-index:1}
.nycc-cover img~.ctile,.nycc-cover img~.corner{opacity:0}
.nycc-cover .issue{font-size:2rem;line-height:.85;font-weight:800;text-shadow:0 2px 0 rgba(0,0,0,.35)}
.nycc-cover .ctitle{font-size:.58rem;font-weight:700;letter-spacing:.03em;text-transform:uppercase;opacity:.95;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.nycc-body{min-width:0;padding:11px 13px;display:flex;flex-direction:column;gap:7px}
.nycc-title{font-weight:800;font-size:1rem;line-height:1.12}
.nycc-title small{display:block;font-weight:600;color:var(--muted);font-size:.73rem;margin-top:2px}
.nycc-rowline{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.nycc-pill{font-size:.6rem;letter-spacing:.07em;text-transform:uppercase;font-weight:700;padding:2px 7px;border-radius:99px;white-space:nowrap;border:1px solid transparent}
.nycc-pill.loc{background:var(--surface2);border-color:var(--border);color:var(--text)}
.nycc-pill.loc.find{color:#b4690e;border-color:rgba(180,105,14,.4)}
.nycc-pill.day{color:#fff}
.nycc-pill.day.fri{background:#7c53e8}
.nycc-pill.day.sat{background:#16a34a}
.nycc-pill.day.verify{background:#b4690e}
.nycc-who{font-size:.82rem;color:var(--muted2)}
.nycc-econ{display:flex;flex-wrap:wrap;gap:3px 13px;align-items:baseline}
.nycc-net{font-size:1.4rem;font-weight:800;color:#16a34a;font-variant-numeric:tabular-nums}
.nycc-net.neg{color:var(--red)}
.nycc-net.none{color:var(--muted);font-size:1rem;font-weight:700}
.nycc-roi{font-size:.74rem;font-weight:700;color:var(--gold)}
.nycc-note{font-size:.76rem;color:var(--muted)}
.nycc-cap{margin-top:auto;display:flex;align-items:center;gap:8px;justify-content:center;background:none;border:1.5px dashed var(--border);color:var(--muted);border-radius:9px;padding:8px;cursor:pointer;font-size:.72rem;letter-spacing:.11em;text-transform:uppercase;font-weight:700}
.nycc-card.captured .nycc-cap{border-style:solid;border-color:#16a34a;color:#16a34a;background:rgba(22,163,74,.12)}
.nycc-cap .box{width:16px;height:16px;border-radius:4px;border:2px solid currentColor;display:grid;place-items:center;font-size:.7rem}
.nycc-stamp{position:absolute;top:9px;right:9px;z-index:2;font-size:.78rem;font-weight:800;letter-spacing:.06em;color:#16a34a;border:2.5px solid #16a34a;border-radius:6px;padding:2px 7px;transform:rotate(-7deg);opacity:0;transition:opacity .2s}
.nycc-card.captured .nycc-stamp{opacity:1}
.nycc-days{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.nycc-day{background:var(--surface);border:1.5px solid var(--border);border-radius:14px;padding:16px}
.nycc-day .dd{font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--gold);margin-bottom:8px}
.nycc-day h3{font-size:1.4rem;font-weight:800;margin-bottom:10px}
.nycc-timeline{list-style:none;margin:0;padding:0;display:grid;gap:9px}
.nycc-timeline li{display:grid;grid-template-columns:64px 1fr;gap:9px;align-items:start}
.nycc-timeline .t{font-size:.72rem;font-weight:700;text-align:center;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:2px 0;color:var(--text)}
.nycc-timeline .d{font-size:.88rem;line-height:1.4;color:var(--text2)}
.nycc-money{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:11px}
.nycc-money .mcell{background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:13px 15px}
.nycc-money .lbl{font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--muted)}
.nycc-money .v{font-size:1.6rem;font-weight:800;margin-top:3px;font-variant-numeric:tabular-nums}
.nycc-money .mcell.hot .v{color:#16a34a}
.nycc-foot{margin-top:28px;border-top:1px solid var(--border);padding-top:13px;color:var(--muted);font-size:.78rem;line-height:1.5}
.t25-wrap{overflow-x:auto;border:1.5px solid var(--border);border-radius:12px;background:var(--surface)}
.t25{width:100%;border-collapse:collapse;font-size:.86rem}
.t25 th{text-align:left;font-size:.6rem;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);font-weight:700;padding:9px 12px;border-bottom:2px solid var(--border);background:var(--surface2);white-space:nowrap}
.t25 td{padding:8px 12px;border-bottom:1px solid var(--border);vertical-align:top}
.t25 tr:last-child td{border-bottom:none}
.t25-rank{font-weight:800;color:var(--muted2);font-variant-numeric:tabular-nums}
.t25-book{font-weight:700;white-space:nowrap}
.t25-c{color:var(--muted);font-variant-numeric:tabular-nums}
.t25-cov{color:var(--text2);min-width:130px}
.t25-why{color:var(--muted2);min-width:200px;line-height:1.35}
.t25-num{font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:600}
.t25-num.net{color:#16a34a}
.t25-own{white-space:nowrap;font-size:.8rem}
.t25-box{display:inline-block;background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:1px 6px;margin:0 3px 2px 0;font-weight:700;font-variant-numeric:tabular-nums}
.t25-no{color:var(--muted)}
.t25-ignore{opacity:.62}
.t25-ignore:hover{opacity:1}
.t25grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.t25c{background:var(--surface);border:1.5px solid var(--border);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 2px 7px rgba(0,0,0,.08)}
.t25c-cov{position:relative;width:100%;aspect-ratio:2/3;background:#2a2a33;color:#fff;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:7px}
.t25c-cov.dc{background:linear-gradient(160deg,#2a5bd7,#13308a)}
.t25c-cov.marvel{background:linear-gradient(160deg,#e23048,#9c0c23)}
.t25c-cov.skybound{background:linear-gradient(160deg,#2f8d68,#17533c)}
.t25c-cov img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.t25c-corner{position:relative;z-index:1;font-size:1.5rem;font-weight:800;line-height:.9;text-shadow:0 2px 0 rgba(0,0,0,.4)}
.t25c-cov img~.t25c-corner{display:none}
.t25c-rank{position:absolute;top:6px;left:6px;z-index:2;background:var(--gold);color:#1a1200;font-weight:800;font-size:.72rem;min-width:20px;height:20px;border-radius:5px;display:flex;align-items:center;justify-content:center;padding:0 5px;box-shadow:0 1px 3px rgba(0,0,0,.4)}
.t25c-body{padding:9px 10px 11px;display:flex;flex-direction:column;gap:4px;min-width:0}
.t25c-title{font-weight:800;font-size:.84rem;line-height:1.15}
.t25c-net{font-size:1.25rem;font-weight:800;color:#16a34a;font-variant-numeric:tabular-nums;line-height:1}
.t25c-net.neg{color:var(--red)}
.t25-num.net.neg{color:var(--red)}
.nycc-tag.confirm{background:rgba(22,163,74,.18);color:#16a34a}
.t25c-tags{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.t25c-box{background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:1px 6px;font-size:.66rem;font-weight:700;white-space:nowrap}
.t25c-vol{font-size:.66rem;color:var(--muted);font-weight:700}
.t25c-ca{font-size:.72rem;color:var(--muted2);line-height:1.25}
.t25c-why{font-size:.72rem;color:var(--muted);line-height:1.3}
@media(max-width:480px){.t25grid{grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:9px}}
@media(max-width:620px){.nycc-days{grid-template-columns:1fr}}
.nak-tools{display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:14px}
.cc-seg-btn{background:var(--surface2);border:none;padding:8px 14px;color:var(--muted2);font-size:.8rem;font-weight:700;cursor:pointer;white-space:nowrap}
.cc-seg-btn+.cc-seg-btn{border-left:1px solid var(--border)}
.cc-seg-btn.on{background:var(--gold);color:#1a1200}
.nak-c{padding:0;border:1.5px solid var(--border);background:var(--surface);cursor:pointer;text-align:left}
.nak-c.bought{border-color:#16a34a;box-shadow:0 0 0 2px rgba(22,163,74,.35)}
.nak-check{position:absolute;top:6px;right:6px;z-index:2;width:22px;height:22px;border-radius:6px;border:2px solid #fff;background:rgba(0,0,0,.45);color:#fff;font-weight:800;font-size:.8rem;display:flex;align-items:center;justify-content:center}
.nak-c.bought .nak-check{background:#16a34a;border-color:#16a34a}
`;
