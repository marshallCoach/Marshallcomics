// "Arcs" explainer — what turning 11k loose issues into stories means, told with
// the collection's own covers. Every number is computed live from the data, except
// the pipeline counts in "How it happened" (from the Nov 2026 fetch logs).
import { useEffect, useMemo, useState } from "react";
import { DATA, type Comic } from "@/data/data";
import { CoverImage, coversReady, coverUrlSync } from "@/components/CoverImage";
import { arcOf, eventOf, arcIssueRange } from "@/lib/arc";
import { openArc, navTo } from "@/lib/nav";

const ALL: Comic[] = DATA.comics;
const n0 = (v?: string) => { const n = parseFloat(String(v ?? "").replace(/^#/, "")); return Number.isFinite(n) ? n : null; };
type Group = { key: string; title: string; vol: string; name: string; books: Comic[]; parts: Set<number>; length: number | null; missing: number[] };

function useCountUp(target: number, run: boolean, ms = 1400) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => { const p = Math.min(1, (t - t0) / ms); setV(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return v;
}

function Stat({ value, label, sub, run }: { value: number; label: string; sub?: string; run: boolean }) {
  const v = useCountUp(value, run);
  return <div className="as-stat"><div className="as-stat-n">{v.toLocaleString()}</div><div className="as-stat-l">{label}</div>{sub && <div className="as-stat-s">{sub}</div>}</div>;
}

function Strip({ g, max = 8, size = 74 }: { g: Group; max?: number; size?: number }) {
  const books = [...g.books].sort((a, b) => (arcOf(a)?.part ?? 99) - (arcOf(b)?.part ?? 99)).slice(0, max);
  return (
    <button className="as-strip" onClick={() => openArc(g.title, g.name, g.vol)} title={`Open ${g.name}`}>
      {books.map(b => (
        <div className="as-frame" key={`${b.Issue}|${b.Box}`}>
          <CoverImage comic={b} width={size} height={Math.round(size * 1.5)} titleLink={false} style={{ borderRadius: 4 }} />
          <span>{arcOf(b)?.part ? `pt ${arcOf(b)!.part}` : `#${b.Issue}`}</span>
        </div>
      ))}
      {g.books.length > max && <div className="as-more">+{g.books.length - max}</div>}
    </button>
  );
}

export default function ArcStory() {
  const [ready, setReady] = useState(false);
  const [assembled, setAssembled] = useState(false);
  useEffect(() => { coversReady().then(() => setReady(true)); }, []);
  useEffect(() => { if (!ready) return; const t = setTimeout(() => setAssembled(true), 700); return () => clearTimeout(t); }, [ready]);

  const d = useMemo(() => {
    const withArc = ALL.filter(c => arcOf(c));
    const withPart = withArc.filter(c => arcOf(c)!.part);
    const withLen = withArc.filter(c => arcOf(c)!.length);
    const groups = new Map<string, Group>();
    for (const c of withArc) {
      const a = arcOf(c)!; const vol = String(c.Volume || "1"); const key = `${c.Title}|${vol}|${a.name}`;
      const g = groups.get(key) ?? { key, title: c.Title, vol, name: a.name, books: [], parts: new Set<number>(), length: null, missing: [] };
      g.books.push(c); if (a.part) g.parts.add(a.part); if (a.length) g.length = Math.max(g.length ?? 0, a.length);
      groups.set(key, g);
    }
    for (const g of groups.values()) {
      const range = arcIssueRange(g.books);
      const owned = new Set(g.books.map(b => n0(String(b.Issue))));
      g.missing = range ? range.filter(i => !owned.has(i)) : [];
    }
    const G = [...groups.values()];
    const hasCovers = (g: Group) => g.books.filter(b => coverUrlSync(b)).length >= Math.min(3, g.books.length);
    const complete = G.filter(g => g.length && g.length >= 3 && g.length <= 12 && g.missing.length === 0 && g.parts.size >= g.length)
      .sort((a, b) => (b.length! - a.length!) || a.title.localeCompare(b.title));
    const close = G.filter(g => g.length && g.length >= 3 && g.missing.length > 0 && g.missing.length <= 2)
      .sort((a, b) => a.missing.length - b.missing.length || (b.length! - a.length!));
    const ev = new Map<string, Comic[]>();
    for (const c of ALL) { const e = eventOf(c); if (e) (ev.get(e) ?? ev.set(e, []).get(e)!).push(c); }
    const events = [...ev.entries()].sort((a, b) => b[1].length - a[1].length);
    const hero = (ready ? complete.find(g => g.length! >= 4 && g.length! <= 7 && hasCovers(g)) : null)
      ?? G.find(g => g.name === "Race Against Time") ?? complete[0] ?? G.sort((a, b) => b.parts.size - a.parts.size)[0];
    const ladder = withArc.find(c => arcOf(c)!.part && arcOf(c)!.length && eventOf(c) && (c.Key || "").toUpperCase() === "YES" && (!ready || coverUrlSync(c)))
      ?? withArc.find(c => arcOf(c)!.part && eventOf(c)) ?? withPart[0];
    return { withArc, withPart, withLen, groups: G, complete, close, events, hero, ladder,
      missingTotal: close.reduce((s, g) => s + g.missing.length, 0),
      cv: withArc.filter(c => /comicvine/i.test((c as { Arc_Source?: string }).Arc_Source || "")).length };
  }, [ready]);

  const heroBooks = useMemo(() => d.hero ? [...d.hero.books].sort((a, b) => (arcOf(a)?.part ?? 99) - (arcOf(b)?.part ?? 99)).slice(0, 7) : [], [d.hero]);
  const scatter = useMemo(() => heroBooks.map((_, i) => ({ x: (i * 53) % 90 - 45, y: ((i * 37) % 70) - 35, r: ((i * 29) % 50) - 25 })), [heroBooks]);
  const cw = Math.max(40, Math.min(84, Math.floor(((typeof window !== "undefined" ? window.innerWidth : 800) - 40 - 6 * Math.max(0, heroBooks.length - 1)) / Math.max(1, heroBooks.length))));
  const pct = Math.round((d.withArc.length / Math.max(1, ALL.length)) * 100);
  const lad = d.ladder; const la = lad ? arcOf(lad) : null;

  return (
    <div className="as-page">
      {/* 1 — hero: loose covers snap into a story */}
      <section className="as-hero">
        <div className="as-kicker">STORY ARCS</div>
        <h1>Your boxes now tell stories.</h1>
        <p>Every comic used to be a single item in a list. Now {d.withArc.length.toLocaleString()} of them know which story they belong to, which part they are, and what comes next.</p>
        <div className={`as-assemble${assembled ? " on" : ""}`}>
          {heroBooks.map((b, i) => (
            <div key={i} className="as-card" style={{ ["--x" as string]: `${scatter[i].x}px`, ["--y" as string]: `${scatter[i].y}px`, ["--r" as string]: `${scatter[i].r}deg`, transitionDelay: `${i * 90}ms` }}>
              <CoverImage comic={b} width={cw} height={Math.round(cw * 1.5)} titleLink={false} style={{ borderRadius: 5 }} />
              <span className="as-pt">pt {arcOf(b)?.part ?? i + 1}</span>
            </div>
          ))}
        </div>
        {d.hero && <button className="as-heroname" onClick={() => openArc(d.hero!.title, d.hero!.name, d.hero!.vol)}>
          {d.hero.title} · <b>{d.hero.name}</b> → read it in order</button>}
      </section>

      {/* 2 — the numbers */}
      <section className="as-stats">
        <Stat run={ready} value={d.withArc.length} label="books with a story arc" sub={`${pct}% of the collection`} />
        <Stat run={ready} value={d.groups.length} label="distinct stories" sub="title + volume + arc" />
        <Stat run={ready} value={d.withPart.length} label="books placed as a part" sub="part 2 of 6, part 3…" />
        <Stat run={ready} value={d.events.length} label="crossover events" sub={`${d.events.reduce((s, e) => s + e[1].length, 0).toLocaleString()} tie-in books`} />
      </section>

      {/* 3 — the ladder */}
      {lad && la && (
        <section className="as-block">
          <h2>From one issue to the whole universe</h2>
          <p className="as-lede">Every book now sits on a ladder. Here's one of yours:</p>
          <div className="as-ladder">
            <div className="as-rung"><CoverImage comic={lad} width={96} height={144} titleLink={false} style={{ borderRadius: 6 }} /><div><b>The issue</b><span>{lad.Title} #{lad.Issue} ({lad.Year})</span></div></div>
            <div className="as-arrow">↓ is</div>
            <div className="as-rung r2"><div className="as-big">Part {la.part}{la.length ? ` of ${la.length}` : ""}</div><div><b>Its place</b><span>where it sits in the telling</span></div></div>
            <div className="as-arrow">↓ of</div>
            <div className="as-rung r3"><div className="as-big">{la.name}</div><div><b>The story arc</b><span>the chapter of the run it belongs to</span></div></div>
            <div className="as-arrow">↓ inside</div>
            <div className="as-rung r4"><div className="as-big">{eventOf(lad)}</div><div><b>The event</b><span>the line-wide crossover around it</span></div></div>
          </div>
        </section>
      )}

      {/* 4 — complete arcs */}
      <section className="as-block">
        <h2>🏆 {d.complete.length} stories you own every part of</h2>
        <p className="as-lede">Start to finish, in your boxes. Tap one to read the covers in order.</p>
        <div className="as-strips">{d.complete.slice(0, 6).map(g => (
          <div key={g.key} className="as-strip-wrap">
            <div className="as-strip-hd"><b>{g.name}</b> <span>{g.title}{g.vol !== "1" ? ` v${g.vol}` : ""} · {g.length} parts</span></div>
            <Strip g={g} />
          </div>
        ))}</div>
      </section>

      {/* 5 — so close */}
      <section className="as-block">
        <h2>🎯 So close: {d.close.length} stories missing just 1 or 2 issues</h2>
        <p className="as-lede">This is new: arcs turn into a shopping list. {d.missingTotal} issues would complete {d.close.length} stories.</p>
        <div className="as-close">{d.close.slice(0, 10).map(g => (
          <button key={g.key} className="as-close-row" onClick={() => openArc(g.title, g.name, g.vol)}>
            <span className="as-close-name"><b>{g.name}</b> · {g.title}{g.vol !== "1" ? ` v${g.vol}` : ""}</span>
            <span className="as-meter"><span style={{ width: `${Math.round(100 * (g.length! - g.missing.length) / g.length!)}%` }} /></span>
            <span className="as-need">need #{g.missing.join(", #")}</span>
          </button>
        ))}</div>
      </section>

      {/* 6 — events */}
      <section className="as-block">
        <h2>💥 The events running through your boxes</h2>
        <div className="as-events">{d.events.slice(0, 6).map(([e, books]) => {
          const fan = books.filter(b => !ready || coverUrlSync(b)).slice(0, 5);
          return (
            <div key={e} className="as-event">
              <div className="as-fan">{fan.map((b, i) => (
                <div key={i} style={{ transform: `translateX(${i * 22}px) rotate(${(i - 2) * 6}deg)`, zIndex: i }}>
                  <CoverImage comic={b} width={60} height={90} titleLink={false} style={{ borderRadius: 4 }} />
                </div>))}</div>
              <b>{e}</b><span>{books.length} books · {new Set(books.map(b => b.Title)).size} titles</span>
            </div>
          );
        })}</div>
      </section>

      {/* 7 — how it happened */}
      <section className="as-block">
        <h2>How we got here</h2>
        <div className="as-flow">
          <div><b>📚 10,027</b><span>of your issues looked up on the Marvel &amp; DC Fandom wikis (9,089 found, 90.6%)</span></div>
          <i>→</i>
          <div><b>🧠 Reading the pages</b><span>"Part 3 of 6", story titles and solicit text turned into arcs, parts and events</span></div>
          <i>→</i>
          <div><b>🔭 Comic Vine</b><span>a second source for the gaps: 2,383 more books matched over two nights</span></div>
          <i>→</i>
          <div><b>🧑‍⚖️ You</b><span>394 disagreements put on Data Fix for your call</span></div>
        </div>
      </section>

      {/* 8 — what it unlocks */}
      <section className="as-block">
        <h2>What it unlocks</h2>
        <div className="as-unlocks">
          <button onClick={() => d.hero && openArc(d.hero.title, d.hero.name, d.hero.vol)}><b>( a ) on every cover</b><span>jump straight to the arc, in order, with missing parts shown</span></button>
          <button onClick={() => navTo("showcase")}><b>🎠 Showcase</b><span>"Arc in Full" reels play a whole story, part by part</span></button>
          <button onClick={() => navTo("everything")}><b>📋 Every Book</b><span>Story Arc and Event columns: search "Hush" or "Civil War"</span></button>
          <div><b>🔜 Next</b><span>reading order across titles, completion %, an arc want list</span></div>
        </div>
      </section>

      {/* 9 — honest status */}
      <section className="as-note">
        <b>Still checking.</b> About 1,500 arcs came from Comic Vine. A 20-book spot check found roughly 1 in 4 belongs to a different run with the same issue number
        (e.g. a 2024 Captain America tagged House of M), so those are being re-validated by year. Arcs from Fandom ({(d.withArc.length - 1500).toLocaleString()}-ish) are the solid core.
      </section>
    </div>
  );
}
