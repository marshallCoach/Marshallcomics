// Showcase — a curated, lean-back carousel of the collection.
// Not random: a playlist of themed "reels" (vampires, every X-team, Avengers
// rosters, a writer's room, an arc read in order, an event night, a decade...).
// Each book gets a big cover + its full details; tap the cover to jump into its
// arc / title page, come back and the next reel is waiting. iPhone first:
// swipe to skip, story-style progress bar, and a little sparkle as a reward.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DATA, type Comic } from "@/data/data";
import { CoverImage, CoverModal, coversReady, coverUrlSync, fmtPubDate } from "@/components/CoverImage";
import { arcOf, eventOf, CONF } from "@/lib/arc";
import { navTo } from "@/lib/nav";

const ALL: Comic[] = DATA.comics;
const MAX = 12, MIN = 4;

// ── small helpers ─────────────────────────────────────────────────────────────
const yearOf = (c: Comic) => parseInt(String(c.Year), 10) || 0;
const pubKey = (c: Comic) => (c.Pub_Date && /^\d{4}/.test(c.Pub_Date) ? c.Pub_Date : `${String(yearOf(c)).padStart(4, "0")}-00-00`);
const issueNum = (c: Comic) => { const n = parseFloat(String(c.Issue).replace(/^#/, "")); return Number.isFinite(n) ? n : 9999; };
const isKey = (c: Comic) => (c.Key || "").toUpperCase() === "YES";
const isSigned = (c: Comic) => (c.Signed || "").toUpperCase() === "YES";
const val = (c: Comic) => parseFloat(String(c.Value_NM || "").replace(/[^0-9.]/g, "")) || 0;
const bookId = (c: Comic) => `${c.Title}|${c.Issue}|${c.Volume || "1"}`;
const chrono = (l: Comic[]) => [...l].sort((a, b) => pubKey(a).localeCompare(pubKey(b)) || issueNum(a) - issueNum(b));
const textOf = (c: Comic) => [c.Title, c.Content, c.Story_Pitch, c.Key_Reason, c.First_App, c.Story_Arc, c.Crossover_Event].join(" ");
// "best" copy to represent a title: keys first, then #1s, then value, then earliest
const score = (c: Comic) => (isKey(c) ? 1000 : 0) + (String(c.Issue) === "1" ? 400 : 0) + Math.min(val(c), 300) + (c.First_App ? 150 : 0);

function dedupe(l: Comic[]) {
  const seen = new Set<string>(); const out: Comic[] = [];
  for (const c of l) { const k = bookId(c); if (!seen.has(k)) { seen.add(k); out.push(c); } }
  return out;
}
function seeded(n: number) { let s = (n * 9301 + 49297) % 233280; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
function sample<T>(l: T[], k: number, seed: number) {
  const r = seeded(seed + 7), a = [...l];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, k);
}
function capPerTitle(l: Comic[], n: number) {
  const cnt: Record<string, number> = {}; const out: Comic[] = [];
  for (const c of l) { cnt[c.Title] = (cnt[c.Title] || 0) + 1; if (cnt[c.Title] <= n) out.push(c); }
  return out;
}
/** One standout book per title (in the order given), shown chronologically. */
function onePer(pool: Comic[], titles: string[]) {
  const out: Comic[] = [];
  for (const t of titles) {
    const books = pool.filter(c => c.Title === t);
    if (books.length) out.push([...books].sort((a, b) => score(b) - score(a) || yearOf(a) - yearOf(b))[0]);
  }
  return chrono(out).slice(0, MAX);
}
/** Highlights of a pool: the strongest books, max 2 per title, then in story order. */
function highlights(pool: Comic[], seed: number, perTitle = 2) {
  const ranked = capPerTitle([...pool].sort((a, b) => score(b) - score(a)), perTitle);
  return chrono(sample(ranked.slice(0, 30), MAX, seed));
}

// ── the reels (playlist order is deliberate: big → themed → people → fun) ─────
type Ctx = { pool: Comic[]; cycle: number };
type Reel = { id: string; emoji: string; title: (c: Ctx) => string; tag: string; hue: [string, string]; pick: (c: Ctx) => Comic[] };

const WRITERS = ["Jonathan Hickman", "Brian Michael Bendis", "Mark Waid", "Geoff Johns", "Gail Simone", "Al Ewing", "Kieron Gillen",
  "Ed Brubaker", "Jason Aaron", "Matt Fraction", "Kelly Thompson", "Rick Remender", "Tom Taylor", "Jeff Lemire", "Warren Ellis", "Mark Millar"];
const COVER_ARTISTS = ["Alex Ross", "David Finch", "Dan Mora", "Leinil Francis Yu", "Ed McGuinness", "Phil Noto", "Esad Ribić", "Bryan Hitch", "Terry Dodson", "Ivan Reis"];
const DECADES: [string, number, number][] = [["the vintage years", 0, 1989], ["the '90s", 1990, 1999], ["the 2000s", 2000, 2009], ["the 2010s", 2010, 2019], ["the 2020s", 2020, 2099]];
const has = (c: Comic, rx: RegExp) => rx.test(textOf(c));
const whoWrote = (c: Comic, w: string) => (c.Writer || "").includes(w);

function rotating<T>(list: T[], cycle: number, ok: (t: T) => boolean): T | null {
  for (let i = 0; i < list.length; i++) { const t = list[(cycle + i) % list.length]; if (ok(t)) return t; }
  return null;
}
const pickWriter = (c: Ctx) => rotating(WRITERS, c.cycle, w => c.pool.filter(b => whoWrote(b, w)).length >= 8);
const pickArtist = (c: Ctx) => rotating(COVER_ARTISTS, c.cycle, a => c.pool.filter(b => (b.Cover_Artist || "").includes(a)).length >= 8);
const pickDecade = (c: Ctx) => DECADES[c.cycle % DECADES.length];
function eventList(pool: Comic[]) {
  const n: Record<string, number> = {};
  for (const c of pool) { const e = eventOf(c); if (e) n[e] = (n[e] || 0) + 1; }
  return Object.entries(n).filter(([, k]) => k >= 6).sort((a, b) => b[1] - a[1]).map(([e]) => e);
}
function arcList(pool: Comic[]) {
  const g: Record<string, Comic[]> = {};
  for (const c of pool) { const a = arcOf(c); if (a && a.part) (g[`${c.Title}|${c.Volume || "1"}|${a.name}`] ||= []).push(c); }
  return Object.values(g).filter(l => new Set(l.map(c => arcOf(c)!.part)).size >= 3)
    .sort((a, b) => b.length - a.length);
}

const REELS: Reel[] = [
  { id: "keys", emoji: "🔑", title: () => "Crown Jewels", tag: "The key issues that carry the collection", hue: ["#7c2d12", "#f59e0b"],
    pick: c => chrono(sample(capPerTitle([...c.pool.filter(isKey)].sort((a, b) => val(b) - val(a)), 1).slice(0, 48), MAX, c.cycle)) },
  { id: "xteams", emoji: "❌", title: () => "Every X-Team", tag: "One book from each mutant squad, in order", hue: ["#1e3a8a", "#facc15"],
    pick: c => onePer(c.pool, ["X-Men", "Uncanny X-Men", "New Mutants", "X-Factor", "Excalibur", "X-Force", "Generation X", "X-Treme X-Men",
      "New X-Men", "Astonishing X-Men", "Uncanny X-Force", "All-New X-Men", "Wolverine and the X-Men", "X-Men Gold", "X-Men Blue", "X-Men Red",
      "Exceptional X-Men", "Cable and X-Force", "Ultimate X-Men"]) },
  { id: "vamps", emoji: "🧛", title: () => "Creatures of the Night", tag: "Vampires, slayers and things that bite", hue: ["#450a0a", "#dc2626"],
    pick: c => highlights(c.pool.filter(b => has(b, /vampir|dracula|\bblade\b|daughter of blade|morbius|nosferatu|slayer|bloodhunt/i)), c.cycle) },
  { id: "writer", emoji: "✍️", title: c => `Writer's Room: ${pickWriter(c) ?? ""}`, tag: "Their best books in your boxes, in the order they wrote them", hue: ["#134e4a", "#5eead4"],
    pick: c => { const w = pickWriter(c); return w ? highlights(c.pool.filter(b => whoWrote(b, w)), c.cycle) : []; } },
  { id: "avengers", emoji: "🅰️", title: () => "Avengers Rosters", tag: "Every line-up that assembled on your shelves", hue: ["#7f1d1d", "#60a5fa"],
    pick: c => onePer(c.pool, ["Avengers", "West Coast Avengers", "New Avengers", "Mighty Avengers", "Young Avengers", "Dark Avengers", "Secret Avengers",
      "Avengers Academy", "Avengers Arena", "Uncanny Avengers", "Avengers Assemble", "Savage Avengers", "The Ultimates", "Avengers Forever", "Occupy Avengers", "All-Out Avengers"]) },
  { id: "firsts", emoji: "🌟", title: () => "First Appearances", tag: "Where characters walked on stage for the first time", hue: ["#581c87", "#f0abfc"],
    pick: c => chrono(sample(capPerTitle(c.pool.filter(b => b.First_App), 2), MAX, c.cycle)) },
  { id: "arc", emoji: "📖", title: c => { const a = arcList(c.pool)[c.cycle % Math.max(1, arcList(c.pool).length)]; return a ? `Arc in Full: ${arcOf(a[0])!.name}` : "Arc in Full"; },
    tag: "A whole story, part by part", hue: ["#312e81", "#a5b4fc"],
    pick: c => { const l = arcList(c.pool); if (!l.length) return []; return [...l[c.cycle % l.length]].sort((a, b) => (arcOf(a)!.part! - arcOf(b)!.part!)).slice(0, MAX); } },
  { id: "bats", emoji: "🦇", title: () => "The Bat-Family", tag: "Gotham's whole household", hue: ["#0f172a", "#facc15"],
    pick: c => onePer(c.pool, ["Batman", "Detective Comics", "Nightwing", "Batgirl", "Robin", "Red Hood and the Outlaws", "Catwoman", "Batwoman",
      "Batman and Robin", "Tim Drake: Robin", "We Are Robin", "Robins", "Batman and the Outsiders", "Absolute Batman", "Batman: Urban Legends"]) },
  { id: "decade", emoji: "🕰️", title: c => `Time Machine: ${pickDecade(c)[0]}`, tag: "Standouts from one stretch of time", hue: ["#3f2a14", "#fbbf24"],
    pick: c => { const [, lo, hi] = pickDecade(c); return highlights(c.pool.filter(b => yearOf(b) >= lo && yearOf(b) <= hi), c.cycle, 1); } },
  { id: "cosmic", emoji: "🌌", title: () => "Cosmic Marvel", tag: "Guardians, Novas, Surfers and the Mad Titan", hue: ["#020617", "#a78bfa"],
    pick: c => highlights(c.pool.filter(b => /guardians|nova|silver surfer|thanos|captain marvel|annihilation|infinity/i.test(b.Title)), c.cycle) },
  { id: "artist", emoji: "🎨", title: c => `Cover Gallery: ${pickArtist(c) ?? ""}`, tag: "A wall of covers by one artist", hue: ["#831843", "#fda4af"],
    pick: c => { const a = pickArtist(c); return a ? highlights(c.pool.filter(b => (b.Cover_Artist || "").includes(a)), c.cycle) : []; } },
  { id: "magic", emoji: "🔮", title: () => "Sorcerers & Witches", tag: "The mystic side of the boxes", hue: ["#2e1065", "#34d399"],
    pick: c => highlights(c.pool.filter(b => /doctor strange|dr\. strange|scarlet witch|zatanna|strange academy|justice league dark|magic order|constantine|hellblazer/i.test(b.Title)), c.cycle) },
  { id: "event", emoji: "💥", title: c => `Event Night: ${eventList(c.pool)[c.cycle % Math.max(1, eventList(c.pool).length)] ?? ""}`, tag: "The tie-ins, in reading order", hue: ["#7c2d12", "#fb923c"],
    pick: c => { const l = eventList(c.pool); if (!l.length) return []; const e = l[c.cycle % l.length]; return chrono(capPerTitle(c.pool.filter(b => eventOf(b) === e), 2)).slice(0, MAX); } },
  { id: "speed", emoji: "⚡", title: () => "The Speed Force", tag: "Fastest books in the collection", hue: ["#7f1d1d", "#fde047"],
    pick: c => highlights(c.pool.filter(b => /flash|quicksilver|impulse|jay garrick/i.test(b.Title)), c.cycle, 3) },
  { id: "wakanda", emoji: "👑", title: () => "Wakanda Forever", tag: "Black Panther across the eras", hue: ["#1e1b4b", "#c084fc"],
    pick: c => highlights(c.pool.filter(b => /black panther|wakanda/i.test(b.Title)), c.cycle) },
  { id: "number1", emoji: "🥇", title: () => "Number Ones", tag: "Every great run starts somewhere", hue: ["#713f12", "#fde68a"],
    pick: c => chrono(sample(capPerTitle(c.pool.filter(b => String(b.Issue) === "1" && (isKey(b) || val(b) >= 10)), 1), MAX, c.cycle)) },
  { id: "signed", emoji: "✒️", title: () => "Ink & Autographs", tag: "Books signed by the people who made them", hue: ["#422006", "#fcd34d"],
    pick: c => chrono(sample(c.pool.filter(isSigned), MAX, c.cycle)) },
  { id: "ultimate", emoji: "🌀", title: () => "The Ultimate Universe", tag: "Both waves of Marvel's remix", hue: ["#0c0a09", "#f87171"],
    pick: c => onePer(c.pool, ["Ultimate Spider-Man", "Ultimate X-Men", "The Ultimates", "Ultimate Fantastic Four", "Ultimates 2", "Ultimate Comics Spider-Man",
      "Ultimate Black Panther", "Ultimate Wolverine", "Ultimate X", "Miles Morales: The Ultimate Spider-Man", "Ultimate Iron Man", "Ultimate Captain America"]) },
  { id: "absolute", emoji: "✴️", title: () => "The Absolute Universe", tag: "DC's new world, title by title", hue: ["#18181b", "#e879f9"],
    pick: c => onePer(c.pool, ["Absolute Batman", "Absolute Wonder Woman", "Absolute Superman", "Absolute Flash", "Absolute Green Lantern", "Absolute Martian Manhunter",
      "Absolute Green Arrow", "Absolute Catwoman", "Absolute Cassandra Cain"]) },
  { id: "frontier", emoji: "🖖", title: () => "Final Frontiers", tag: "Starships, TARDISes and Autobots", hue: ["#082f49", "#38bdf8"],
    pick: c => highlights(c.pool.filter(b => /star trek|doctor who|transformers|star wars/i.test(b.Title)), c.cycle) },
  { id: "asgard", emoji: "🔨", title: () => "Gods of Asgard", tag: "Thunder, mischief and worthiness", hue: ["#1e3a8a", "#e5e7eb"],
    pick: c => highlights(c.pool.filter(b => /\bthor\b|loki|asgard|jane foster/i.test(b.Title)), c.cycle) },
  { id: "milestones", emoji: "💯", title: () => "Big Numbers", tag: "Anniversary issues and landmark numbers", hue: ["#14532d", "#86efac"],
    pick: c => chrono(sample(capPerTitle(c.pool.filter(b => [25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 600, 700, 750, 800, 900, 1000].includes(issueNum(b))), 1), MAX, c.cycle)) },
  { id: "street", emoji: "🌃", title: () => "Street Level", tag: "Rooftops, alleys and Hell's Kitchen", hue: ["#111827", "#9ca3af"],
    pick: c => onePer(c.pool, ["Daredevil", "Moon Knight", "Elektra", "The Immortal Iron Fist", "Luke Cage", "Power Man and Iron Fist", "Jessica Jones",
      "Punisher War Journal", "Vengeance of the Moon Knight", "Iron Fist", "Marc Spector: Moon Knight"]) },
  { id: "justice", emoji: "⚖️", title: () => "Justice League Line-ups", tag: "Every flavour of the League", hue: ["#172554", "#fde047"],
    pick: c => onePer(c.pool, ["Justice League", "JLA", "Justice League of America", "Justice League Dark", "Justice League International",
      "Justice League United", "Justice League Unlimited", "JSA", "Justice Society of America", "Justice League Odyssey", "Justice League 3000"]) },
  { id: "fallen", emoji: "🕯️", title: () => "Fallen Heroes", tag: "Deaths, funerals and last stands", hue: ["#1c1917", "#d6d3d1"],
    pick: c => highlights(c.pool.filter(b => /\bdeath of\b|\bdies\b|\bfuneral\b|\bkilled\b|last stand|fallen son/i.test(textOf(b))), c.cycle) },
];

// ── rewards (per-device, best effort) ─────────────────────────────────────────
type Stats = { day: string; today: number; total: number; reels: number; badges: string[] };
const STATS_KEY = "brbShowcaseStats_v1", POS_KEY = "brbShowcasePos_v1", AWAY_KEY = "brbShowcaseAway";
const BADGES: [string, (s: Stats) => boolean, string][] = [
  ["first", s => s.total >= 1, "🎬 Opening Night — your first Showcase"],
  ["b25", s => s.total >= 25, "📚 Page Turner — 25 books admired"],
  ["r3", s => s.reels >= 3, "🎞️ Triple Feature — 3 reels finished"],
  ["b100", s => s.total >= 100, "🏅 Binge Reader — 100 books admired"],
  ["r10", s => s.reels >= 10, "🍿 Film Festival — 10 reels finished"],
  ["b250", s => s.total >= 250, "💎 Curator — 250 books admired"],
  ["b500", s => s.total >= 500, "👑 Archivist — 500 books admired"],
  ["r25", s => s.reels >= 25, "🌌 Full Playlist — 25 reels finished"],
];
const today = () => new Date().toISOString().slice(0, 10);
function readJSON<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? { ...d, ...JSON.parse(v) } : d; } catch { return d; } }
function writeJSON(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }

const reduceMotion = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

// ── component ─────────────────────────────────────────────────────────────────
export default function Showcase() {
  const [ready, setReady] = useState(false);
  const [pos, setPos] = useState(() => readJSON(POS_KEY, { reel: 0, cycle: 0 }));
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [intro, setIntro] = useState(true);
  const [welcome, setWelcome] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [stats, setStats] = useState<Stats>(() => { const s = readJSON<Stats>(STATS_KEY, { day: today(), today: 0, total: 0, reels: 0, badges: [] }); return s.day === today() ? s : { ...s, day: today(), today: 0 }; });
  const [toast, setToast] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const [art, setArt] = useState<Comic | null>(null);
  const [w, setW] = useState(() => (typeof window === "undefined" ? 360 : window.innerWidth));
  const [vh, setVh] = useState(() => (typeof window === "undefined" ? 800 : window.innerHeight));
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const swipedAt = useRef(0);

  useEffect(() => { let on = true; coversReady().then(() => on && setReady(true)); return () => { on = false; }; }, []);
  useEffect(() => { const f = () => { setW(window.innerWidth); setVh(window.innerHeight); }; window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);

  // Came back from an arc/title page → roll on to a fresh reel.
  useEffect(() => {
    let away = false; try { away = sessionStorage.getItem(AWAY_KEY) === "1"; sessionStorage.removeItem(AWAY_KEY); } catch { /* ignore */ }
    if (away) { setWelcome(true); advanceReel(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only books with a real cover make the cut (it's a showcase).
  const pool = useMemo(() => (ready ? dedupe(ALL.filter(c => coverUrlSync(c))) : []), [ready]);

  const reelAt = useCallback((p: { reel: number; cycle: number }) => {
    for (let k = 0; k < REELS.length; k++) {
      const r = (p.reel + k) % REELS.length;
      const cyc = p.cycle + Math.floor((p.reel + k) / REELS.length);
      const ctx = { pool, cycle: cyc };
      const books = REELS[r].pick(ctx);
      if (books.length >= MIN) return { reel: REELS[r], books, at: { reel: r, cycle: cyc }, title: REELS[r].title(ctx) };
    }
    return null;
  }, [pool]);

  const cur = useMemo(() => (pool.length ? reelAt(pos) : null), [pool, pos, reelAt]);
  const book = cur?.books[Math.min(idx, cur.books.length - 1)];
  const dur = book ? 6500 + Math.min(6000, (book.Content || "").length * 22) : 6500;

  function persist(p: { reel: number; cycle: number }) { setPos(p); writeJSON(POS_KEY, p); }
  function advanceReel(finished: boolean) {
    setPos(p => {
      const base = cur ? cur.at : p;
      const n = base.reel + 1;
      const np = { reel: n % REELS.length, cycle: base.cycle + (n >= REELS.length ? 1 : 0) };
      writeJSON(POS_KEY, np);
      return np;
    });
    setIdx(0); setElapsed(0); setIntro(true);
    if (finished) {
      setBurst(b => b + 1);
      bump(s => ({ ...s, reels: s.reels + 1 }), "🎞️ Reel complete!");
    }
  }
  function bump(f: (s: Stats) => Stats, msg?: string) {
    setStats(s => {
      const n = f(s);
      const fresh = BADGES.filter(([id, ok]) => ok(n) && !n.badges.includes(id));
      if (fresh.length) { n.badges = [...n.badges, ...fresh.map(b => b[0])]; setToast(fresh[fresh.length - 1][2]); setBurst(b => b + 1); }
      else if (msg) setToast(`${msg}  ·  ${n.reels} today`);
      writeJSON(STATS_KEY, n);
      return n;
    });
  }
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t); }, [toast]);

  // intro card → play
  useEffect(() => { if (!intro || !cur) return; const t = setTimeout(() => { setIntro(false); setWelcome(false); }, reduceMotion() ? 1200 : 2600); return () => clearTimeout(t); }, [intro, cur]);

  // count a book as "seen" once it is on screen
  useEffect(() => { if (!intro && book) bump(s => ({ ...s, today: s.today + 1, total: s.total + 1 })); /* eslint-disable-next-line */ }, [intro, book && bookId(book)]);

  // the clock (pauses when hidden, paused or on the intro card)
  useEffect(() => {
    if (intro || paused || !cur || art) return;
    const t = setInterval(() => { if (!document.hidden) setElapsed(e => e + 100); }, 100);
    return () => clearInterval(t);
  }, [intro, paused, cur, art]);
  useEffect(() => { if (elapsed >= dur) next(); /* eslint-disable-next-line */ }, [elapsed, dur]);

  function next() { if (!cur) return; setElapsed(0); if (idx + 1 >= cur.books.length) advanceReel(true); else setIdx(i => i + 1); }
  function prev() { setElapsed(0); setIdx(i => Math.max(0, i - 1)); }

  function openBook(c: Comic) {
    if (Date.now() - swipedAt.current < 400) return;
    try { sessionStorage.setItem(AWAY_KEY, "1"); } catch { /* ignore */ }
    const a = arcOf(c);
    navTo("coverreview", a ? { title: c.Title, arc: a.name, vol: String(c.Volume || "1"), from: "showcase" } : { title: c.Title, from: "showcase" });
  }
  function openCreator(name: string) {
    try { sessionStorage.setItem(AWAY_KEY, "1"); } catch { /* ignore */ }
    navTo("coverreview", { creative: name, from: "showcase" });
  }

  // keyboard (desktop): ← → space
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (art) return;
      if (e.key === "ArrowRight") next(); else if (e.key === "ArrowLeft") prev();
      else if (e.key === " ") { e.preventDefault(); setPaused(p => !p); }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  });

  if (!ready || !cur) {
    return <div className="sc-stage sc-loading"><div className="sc-spinner" />Rolling the film…</div>;
  }

  // big, but the play controls stay on screen without scrolling
  const coverW = Math.round(Math.max(200, Math.min(w - 48, 380, (vh - 360) / 1.5))), coverH = Math.round(coverW * 1.5);
  const [h1, h2] = cur.reel.hue;
  const arc = book ? arcOf(book) : null;
  const ev = book ? eventOf(book) : "";
  const reelNo = cur.at.cycle * REELS.length + cur.at.reel + 1;

  return (
    <div className="sc-stage" style={{ ["--h1" as string]: h1, ["--h2" as string]: h2 }}
      onTouchStart={e => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY, t: Date.now() }; }}
      onTouchEnd={e => {
        const s = touch.current; touch.current = null; if (!s || intro) return;
        const t = e.changedTouches[0]; const dx = t.clientX - s.x, dy = t.clientY - s.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { swipedAt.current = Date.now(); dx < 0 ? next() : prev(); }
      }}>
      <div className="sc-glow" />

      {/* header: reel name + stats */}
      <div className="sc-head">
        <div className="sc-reel"><span className="sc-emoji">{cur.reel.emoji}</span>
          <div><div className="sc-title">{cur.title}</div><div className="sc-tag">{cur.reel.tag}</div></div>
        </div>
        <div className="sc-xp" title={`${stats.total} books admired all-time · ${stats.reels} reels finished`}>⚡ {stats.today}</div>
      </div>

      {/* story-style progress */}
      <div className="sc-bars">
        {cur.books.map((b, i) => (
          <button key={bookId(b)} className="sc-bar" aria-label={`Book ${i + 1}`} onClick={() => { setElapsed(0); setIdx(i); }}>
            <span style={{ width: `${i < idx ? 100 : i > idx ? 0 : Math.min(100, (elapsed / dur) * 100)}%` }} />
          </button>
        ))}
      </div>

      {intro ? (
        <button className="sc-intro" onClick={() => { setIntro(false); setWelcome(false); }} key={`intro-${reelNo}`}>
          {welcome && <div className="sc-welcome">Welcome back ✨ — fresh reel coming up</div>}
          <div className="sc-intro-emoji">{cur.reel.emoji}</div>
          <div className="sc-intro-up">Reel {reelNo}</div>
          <div className="sc-intro-title">{cur.title}</div>
          <div className="sc-intro-tag">{cur.reel.tag} · {cur.books.length} books</div>
          <Sparkles n={18} />
        </button>
      ) : book && (
        <>
          <div className="sc-coverwrap" key={bookId(book)}>
            <div className={`sc-cover${isKey(book) ? " sc-foil" : ""}${isSigned(book) ? " sc-signed" : ""}`} style={{ width: coverW, height: coverH }}>
              <CoverImage comic={book} width={coverW} height={coverH} titleLink={false} onClick={() => openBook(book)}
                style={{ borderRadius: 10, cursor: "pointer" }} />
              {isKey(book) && <Sparkles n={10} />}
              <div className="sc-chips">
                {isKey(book) && <span className="sc-chip key">🔑 KEY</span>}
                {isSigned(book) && <span className="sc-chip sig">✒️ SIGNED</span>}
                {arc?.part && <span className="sc-chip part">pt {arc.part}{arc.length ? ` of ${arc.length}` : ""}</span>}
              </div>
            </div>
            <div className="sc-taphint">tap the cover for its {arc ? "arc" : "title"} page · swipe to skip</div>
          </div>

          {/* controls */}
          <div className="sc-controls">
            <button onClick={prev} aria-label="Previous">⏮</button>
            <button className="sc-play" onClick={() => setPaused(p => !p)} aria-label={paused ? "Play" : "Pause"}>{paused ? "▶" : "⏸"}</button>
            <button onClick={next} aria-label="Next">⏭</button>
            <button className="sc-skip" onClick={() => advanceReel(false)}>Next reel ⏩</button>
          </div>

          {/* details */}
          <div className="sc-details" key={`d-${bookId(book)}`}>
            <div className="sc-d-title">{book.Title} <span>#{book.Issue}</span></div>
            <div className="sc-d-sub">{[book.Publisher, fmtPubDate(book.Pub_Date) || book.Year, book.Volume && book.Volume !== "1" ? `Vol ${book.Volume}` : ""].filter(Boolean).join(" · ")}</div>
            {book.Key_Reason && <Row k="Why it matters" v={book.Key_Reason} hot />}
            {book.First_App && <Row k="First appearance" v={book.First_App} />}
            {arc && <div className="sc-row"><span className="sc-k">Story arc</span><span className="sc-v">
              <button className="sc-link" onClick={() => openBook(book)}>{arc.name}</button>
              {arc.part ? ` · part ${arc.part}${arc.length ? ` of ${arc.length}` : ""}` : ""}
              {arc.conf && <span className="sc-conf" style={{ color: CONF[arc.conf].color }}> ● {CONF[arc.conf].label}</span>}
            </span></div>}
            {ev && <Row k="Event" v={ev} />}
            {book.Writer && <div className="sc-row"><span className="sc-k">Writer</span><span className="sc-v"><button className="sc-link" onClick={() => openCreator(book.Writer)}>{book.Writer}</button></span></div>}
            {book.Artist && <div className="sc-row"><span className="sc-k">Artist</span><span className="sc-v"><button className="sc-link" onClick={() => openCreator(book.Artist)}>{book.Artist}</button></span></div>}
            {book.Cover_Artist && <div className="sc-row"><span className="sc-k">Cover</span><span className="sc-v"><button className="sc-link" onClick={() => openCreator(book.Cover_Artist)}>{book.Cover_Artist}</button></span></div>}
            {(book.Content || book.Story_Pitch) && <p className="sc-story">{book.Content || book.Story_Pitch}</p>}
            {isSigned(book) && book.Signed_By && <Row k="Signed by" v={book.Signed_By} />}
            {book.Condition && <Row k="Condition" v={book.Condition} />}
            {val(book) > 0 && <Row k="Value (NM)" v={`$${val(book).toLocaleString()}`} />}
            <Row k="Where" v={/^\d+$/.test(book.Box) ? `Box ${book.Box}` : book.Box} />
            <div className="sc-actions">
              <button onClick={() => openBook(book)}>{arc ? "📖 Open the arc" : "🗂 Open the title"}</button>
              <button onClick={() => { setPaused(true); setArt(book); }}>🔍 Full art</button>
            </div>
          </div>
        </>
      )}

      {burst > 0 && <Confetti key={burst} />}
      {toast && <div className="sc-toast" key={toast}>{toast}</div>}
      {art && <CoverModal comic={art} largeUrl={coverUrlSync(art)} onClose={() => setArt(null)} />}
    </div>
  );
}

function Row({ k, v, hot }: { k: string; v: string; hot?: boolean }) {
  return <div className={`sc-row${hot ? " hot" : ""}`}><span className="sc-k">{k}</span><span className="sc-v">{v}</span></div>;
}

function Sparkles({ n }: { n: number }) {
  const s = useMemo(() => Array.from({ length: n }, (_, i) => ({
    l: Math.random() * 100, t: Math.random() * 100, d: Math.random() * 2.4, z: 0.6 + Math.random() * 0.9, k: i,
  })), [n]);
  if (reduceMotion()) return null;
  return <div className="sc-sparkles" aria-hidden>{s.map(p => (
    <span key={p.k} style={{ left: `${p.l}%`, top: `${p.t}%`, animationDelay: `${p.d}s`, transform: `scale(${p.z})` }}>✦</span>
  ))}</div>;
}

function Confetti() {
  const bits = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    x: (Math.random() - 0.5) * 520, y: -(120 + Math.random() * 380), r: Math.random() * 720,
    c: ["#f59e0b", "#ef4444", "#3b82f6", "#10b981", "#a855f7", "#facc15", "#ec4899"][i % 7], d: Math.random() * 0.25,
  })), []);
  if (reduceMotion()) return null;
  return <div className="sc-confetti" aria-hidden>{bits.map((b, i) => (
    <span key={i} style={{ background: b.c, animationDelay: `${b.d}s`, ["--x" as string]: `${b.x}px`, ["--y" as string]: `${b.y}px`, ["--r" as string]: `${b.r}deg` }} />
  ))}</div>;
}
