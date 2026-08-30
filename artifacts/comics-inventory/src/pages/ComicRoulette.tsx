import { useEffect, useMemo, useRef, useState } from "react";

// comic_roulette.json (built from vision_characters_enriched.xlsx, green rows):
//   { group: { character: [ {url, artist, title, issue}, ... ] } }
// Every cover carries its OWN cover artist + verified characters, so a named
// artist is the one who actually drew the displayed covers (the Replit fix).
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Cover = { url: string; artist: string | null; title: string; issue: string };
type Group = "DC" | "Marvel" | "Image" | "Other";
type Dataset = Record<Group, Record<string, Cover[]>>;
type Data = { all: Dataset; cc: Dataset };
type Scope = "all" | "cc";
type Mode = "character" | "title" | "all";

let dataCache: Data | null = null;
let dataPromise: Promise<Data> | null = null;
function loadData(): Promise<Data> {
  if (dataCache) return Promise.resolve(dataCache);
  if (!dataPromise) dataPromise = fetch(`${BASE}/comic_roulette.json`).then(r => r.json()).then((d: Data) => (dataCache = d));
  return dataPromise;
}

const GROUPS: Group[] = ["DC", "Marvel", "Image", "Other"];
const GROUP_WEIGHTS: [Group, number][] = [["DC", 40], ["Marvel", 40], ["Other", 15], ["Image", 5]];

function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }
function weightedGroup(data: Dataset): Group {
  const avail = GROUP_WEIGHTS.filter(([g]) => data[g] && Object.keys(data[g]).length);
  const total = avail.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [g, w] of avail) if ((r -= w) <= 0) return g;
  return avail[0][0];
}
function mode2(arr: (string | null)[]): string | null {
  const c = new Map<string, number>();
  for (const v of arr) if (v) c.set(v, (c.get(v) ?? 0) + 1);
  let best: string | null = null, n = 0;
  for (const [v, k] of c) if (k > n) { best = v; n = k; }
  return best;
}
function sample8(all: Cover[]): Cover[] { return [...all].sort(() => Math.random() - 0.5).slice(0, 8); }

// Title index: group → title → deduped covers (derived from the character data).
function buildTitleIndex(data: Dataset) {
  const idx: Record<Group, Record<string, Cover[]>> = { DC: {}, Marvel: {}, Image: {}, Other: {} };
  const seen: Record<string, Set<string>> = {};
  for (const g of GROUPS) for (const covers of Object.values(data[g] || {})) for (const c of covers) {
    if (!c.title) continue;
    const k = `${g}|${c.title}`;
    (seen[k] ||= new Set());
    if (seen[k].has(c.url)) continue;
    seen[k].add(c.url);
    (idx[g][c.title] ||= []).push(c);
  }
  return idx;
}

type Result = { mode: Mode; group: Group; character: string | null; title: string; artist: string | null; covers: Cover[] };

function spin(data: Dataset, titleIdx: ReturnType<typeof buildTitleIndex>, mode: Mode): Result | null {
  if (mode === "character") {
    const group = weightedGroup(data);
    const chars = Object.keys(data[group] || {});
    if (!chars.length) return null;
    const character = pick(chars);
    const s = sample8(data[group][character]);
    const artist = mode2(s.map(c => c.artist));
    const title = mode2(s.map(c => c.title)) ?? "";
    const coherent = s.filter(c => c.artist === artist);
    return { mode, group, character, title, artist, covers: coherent.length >= 2 ? coherent : s };
  }
  // title / all
  let group: Group, title: string;
  if (mode === "title") {
    group = weightedGroup(data);
    const titles = Object.keys(titleIdx[group] || {});
    if (!titles.length) return null;
    title = pick(titles);
  } else {
    // ✦ All — any publisher, any title
    const pairs = GROUPS.flatMap(g => Object.keys(titleIdx[g] || {}).map(t => [g, t] as [Group, string]));
    if (!pairs.length) return null;
    [group, title] = pick(pairs);
  }
  const s = sample8(titleIdx[group][title]);
  const artist = mode2(s.map(c => c.artist));
  const coherent = s.filter(c => c.artist === artist);
  return { mode, group, character: null, title, artist, covers: coherent.length >= 2 ? coherent : s };
}

function Drum({ label, value, spinning, pool }: { label: string; value: string; spinning: boolean; pool: string[] }) {
  const [d, setD] = useState(value);
  useEffect(() => {
    if (!spinning) { setD(value); return; }
    const t = setInterval(() => setD(pool.length ? pick(pool) : value), 70);
    return () => clearInterval(t);
  }, [spinning, value, pool]);
  return (
    <div className="cr-drum">
      <div className="cr-drum-label">{label}</div>
      <div className={`cr-drum-window${spinning ? " spinning" : ""}`}><span className="cr-drum-value">{d || "—"}</span></div>
    </div>
  );
}

export default function ComicRoulette() {
  const [data, setData] = useState<Data | null>(null);
  const [scope, setScope] = useState<Scope>("all");
  const [mode, setMode] = useState<Mode>("character");
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [qa, setQa] = useState<Result[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadData().then(setData); return () => { if (timer.current) clearTimeout(timer.current); }; }, []);
  // Active dataset: whole collection ("all") or cover-boxes only ("cc").
  const active = useMemo<Dataset | null>(() => (data ? (data[scope] ?? {} as Dataset) : null), [data, scope]);
  const titleIdx = useMemo(() => (active ? buildTitleIndex(active) : null), [active]);

  const charPool = useMemo(() => (active ? GROUPS.flatMap(g => Object.keys(active[g] || {})).slice(0, 400) : []), [active]);
  const titlePool = useMemo(() => (titleIdx ? GROUPS.flatMap(g => Object.keys(titleIdx[g] || {})).slice(0, 400) : []), [titleIdx]);
  const artistPool = useMemo(() => (active ? Array.from(new Set(GROUPS.flatMap(g => Object.values(active[g] || {}).flat().map(c => c.artist).filter(Boolean) as string[]))).slice(0, 400) : []), [active]);

  const midLabel = mode === "character" ? "Character" : "Title";
  const midPool = mode === "character" ? charPool : titlePool;

  function doSpin() {
    if (!active || !titleIdx || spinning) return;
    setSpinning(true); setLightbox(null); setQa(null);
    const r = spin(active, titleIdx, mode);
    timer.current = setTimeout(() => { setResult(r); setSpinning(false); }, 1400);
  }

  function runQA() {
    if (!active || !titleIdx) return;
    const rows: Result[] = [];
    for (let i = 0; i < 25; i++) { const r = spin(active, titleIdx, mode); if (r) rows.push(r); }
    setQa(rows); setResult(null);
  }
  function exportQA() {
    if (!qa) return;
    const blob = new Blob([JSON.stringify(qa.map((r, i) => ({
      id: i + 1, mode: r.mode, publisher: r.group, character: r.character, title: r.title,
      artist: r.artist, cover_count: r.covers.length, covers: r.covers.map(c => c.url),
    })), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `comic-roulette-qa-${Date.now()}.json`; a.click();
  }

  return (
    <div className="cr-root">
      <style>{CR_CSS}</style>
      <div className="cr-header">
        <h1>🎰 Comic Roulette</h1>
        <p className="cr-sub">Spin the drums — every cover shown carries its real cover artist and the characters verified on it, from your collection scan.</p>
      </div>

      <div className="cr-scope">
        {([["all", "🗂 Whole collection"], ["cc", "🖼 Cover boxes only"]] as [Scope, string][]).map(([sc, l]) => {
          const empty = sc === "cc" && data && !GROUPS.some(g => Object.keys(data.cc[g] || {}).length);
          return (
            <button key={sc} className={`cr-scope-btn${scope === sc ? " active" : ""}`}
              disabled={!!empty}
              title={empty ? "No cover-box characters yet — run the character enrichment" : ""}
              onClick={() => { setScope(sc); setResult(null); setQa(null); }}>{l}</button>
          );
        })}
      </div>

      <div className="cr-modes">
        {([["character", "Character"], ["title", "Title"], ["all", "✦ All"]] as [Mode, string][]).map(([m, l]) => (
          <button key={m} className={`cr-mode-btn${mode === m ? " active" : ""}`} onClick={() => { setMode(m); setResult(null); setQa(null); }}>{l}</button>
        ))}
      </div>

      <div className={`cr-machine${mode === "all" ? " lock" : ""}`}>
        {mode !== "all" && <Drum label="Publisher" value={result?.group ?? ""} spinning={spinning} pool={GROUPS} />}
        <Drum label={mode === "all" ? "Any Publisher · Title" : midLabel} value={mode === "all" ? (result?.title ?? "") : (mode === "character" ? (result?.character ?? "") : (result?.title ?? ""))} spinning={spinning} pool={midPool} />
        {mode !== "all" && <Drum label="Cover Artist" value={result?.artist ?? "—"} spinning={spinning} pool={artistPool} />}
      </div>

      <div className="cr-actions">
        <button className="cr-spin-btn" onClick={doSpin} disabled={!data || spinning}>{spinning ? "Spinning…" : data ? "SPIN" : "Loading…"}</button>
        <button className="cr-qa-btn" onClick={runQA} disabled={!data || spinning} title="Generate 25 spins to review">QA · 25</button>
        {qa && <button className="cr-qa-btn" onClick={exportQA}>Export JSON</button>}
      </div>

      {result && !spinning && <ResultPanel r={result} onOpen={setLightbox} />}

      {qa && (
        <div className="cr-qa">
          <div className="cr-qa-head">{qa.length} spins · {mode} mode — eyeball each row's artist/characters against the covers</div>
          {qa.map((r, i) => (
            <div key={i} className="cr-qa-row">
              <div className="cr-qa-meta">
                <span className="cr-qa-n">#{i + 1}</span>
                <span className={`cr-chip cr-${r.group.toLowerCase()}`}>{r.group}</span>
                {r.character && <strong>{r.character}</strong>}
                <span className="cr-title">{r.title}</span>
                {r.artist && <span className="cr-artist">{r.artist}</span>}
              </div>
              <div className="cr-qa-thumbs">
                {r.covers.slice(0, 8).map((c, j) => <img key={j} src={c.url} loading="lazy" onClick={() => setLightbox(c.url)} alt="" />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {lightbox && <div className="cr-lightbox" onClick={() => setLightbox(null)}><img src={lightbox} alt="cover" /></div>}
    </div>
  );
}

function ResultPanel({ r, onOpen }: { r: Result; onOpen: (u: string) => void }) {
  return (
    <div className="cr-result">
      <div className="cr-result-head">
        <span className={`cr-chip cr-${r.group.toLowerCase()}`}>{r.group}</span>
        {r.character && <strong>{r.character}</strong>}
        {r.title && <span className="cr-title">{r.character ? "in " : ""}<em>{r.title}</em></span>}
        {r.artist && <span className="cr-artist">— art by {r.artist}</span>}
        <span className="cr-count">{r.covers.length} cover{r.covers.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="cr-grid">
        {r.covers.map((c, i) => (
          <figure key={c.url + i} className="cr-cover" onClick={() => onOpen(c.url)}>
            <img src={c.url} alt={`${c.title} #${c.issue}`} loading="lazy" />
            <figcaption><span className="cr-cap-title">{c.title} {c.issue && `#${c.issue}`}</span>{c.artist && <span className="cr-cap-artist">{c.artist}</span>}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

const CR_CSS = `
.cr-root { max-width: 1100px; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
.cr-header h1 { margin: 0 0 .25rem; font-size: 1.9rem; }
.cr-sub { color: var(--muted,#888); margin: 0 0 1.25rem; max-width: 640px; }
.cr-scope { display: flex; gap: .5rem; justify-content: center; margin-bottom: .6rem; }
.cr-scope-btn { background: transparent; border: 1px solid var(--border,#2c2c38); color: var(--muted,#999); padding: .35rem 1rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: .8rem; }
.cr-scope-btn.active { background: #0891b2; border-color: #0891b2; color: #fff; }
.cr-scope-btn:disabled { opacity: .4; cursor: not-allowed; }
.cr-modes { display: flex; gap: .5rem; justify-content: center; margin-bottom: 1rem; }
.cr-mode-btn { background: var(--surface2,#1a1a22); border: 1px solid var(--border,#2c2c38); color: var(--muted,#999); padding: .4rem 1.1rem; border-radius: 999px; cursor: pointer; font-weight: 600; font-size: .85rem; }
.cr-mode-btn.active { background: #c0392b; border-color: #c0392b; color: #fff; }
.cr-machine { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin: 0 auto 1.25rem; max-width: 760px; }
.cr-machine.lock { grid-template-columns: 1fr; max-width: 420px; }
.cr-drum-label { font-size: .72rem; text-transform: uppercase; letter-spacing: .08em; color: var(--muted,#888); margin-bottom: .4rem; text-align: center; }
.cr-drum-window { background: linear-gradient(180deg,#1a1a22,#0d0d12); border: 2px solid #2c2c38; border-radius: 12px; height: 84px; display: flex; align-items: center; justify-content: center; padding: 0 .75rem; box-shadow: inset 0 2px 12px rgba(0,0,0,.6); overflow: hidden; }
.cr-drum-window.spinning { border-color: #c0392b; }
.cr-drum-value { font-weight: 700; font-size: 1.05rem; color: #fff; text-align: center; line-height: 1.15; }
.cr-drum-window.spinning .cr-drum-value { opacity: .55; filter: blur(.4px); }
.cr-actions { display: flex; gap: .75rem; justify-content: center; align-items: center; margin-bottom: 2rem; }
.cr-spin-btn { padding: .8rem 2.6rem; font-size: 1.1rem; font-weight: 800; letter-spacing: .1em; color: #fff; background: linear-gradient(180deg,#e74c3c,#c0392b); border: none; border-radius: 999px; cursor: pointer; box-shadow: 0 4px 16px rgba(192,57,43,.5); }
.cr-spin-btn:disabled { opacity: .6; cursor: default; }
.cr-qa-btn { padding: .55rem 1.1rem; font-weight: 700; color: var(--text,#eee); background: var(--surface2,#1a1a22); border: 1px solid var(--border,#2c2c38); border-radius: 999px; cursor: pointer; }
.cr-result-head, .cr-qa-meta { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; margin-bottom: 1rem; font-size: 1.02rem; }
.cr-chip { font-size: .72rem; font-weight: 700; padding: .15rem .5rem; border-radius: 6px; color: #fff; }
.cr-dc { background:#0476F2; } .cr-marvel { background:#ED1D24; } .cr-image { background:#111; border:1px solid #444; } .cr-other { background:#6b5b95; }
.cr-title { color: var(--muted,#888); } .cr-artist { color:#e0a030; font-weight:600; } .cr-count { margin-left:auto; color:var(--muted,#888); font-size:.85rem; }
.cr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px,1fr)); gap: .9rem; }
.cr-cover { margin: 0; cursor: pointer; background:#15151c; border:1px solid #26262f; border-radius:8px; overflow:hidden; transition: transform .12s; }
.cr-cover:hover { transform: translateY(-3px); }
.cr-cover img { width:100%; aspect-ratio: 2/3; object-fit: cover; display:block; }
.cr-cover figcaption { padding: .4rem .5rem; font-size: .72rem; display:flex; flex-direction:column; gap:2px; }
.cr-cap-title { font-weight:600; color:#eee; } .cr-cap-artist { color:#e0a030; }
.cr-qa-head { color: var(--muted,#888); font-size: .85rem; margin-bottom: .75rem; }
.cr-qa-row { border-top: 1px solid var(--border,#26262f); padding: .7rem 0; }
.cr-qa-meta { margin-bottom: .4rem; font-size: .9rem; }
.cr-qa-n { color: var(--muted,#888); font-weight: 700; }
.cr-qa-thumbs { display: flex; gap: .4rem; flex-wrap: wrap; }
.cr-qa-thumbs img { width: 54px; height: 81px; object-fit: cover; border-radius: 4px; cursor: pointer; background:#15151c; }
.cr-lightbox { position: fixed; inset:0; background: rgba(0,0,0,.9); display:flex; align-items:center; justify-content:center; z-index: 1000; cursor: zoom-out; }
.cr-lightbox img { max-width: 92vw; max-height: 92vh; border-radius: 6px; }
`;
