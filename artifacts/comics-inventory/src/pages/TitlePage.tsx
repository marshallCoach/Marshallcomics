// Title page — search any title, then see the whole run in one place: every issue you
// own (covers, volume by volume), the gaps in each run, which boxes hold it, keys and
// signed books. The (t) pill on every cover opens this page.
import { useEffect, useMemo, useState } from "react";
import { DATA, type Comic } from "@/data/data";
import { CoverImage } from "@/components/CoverImage";
import ComicDrawer, { type DrawerComic } from "@/components/ComicDrawer";
import { navTo } from "@/lib/nav";

const comics = DATA.comics as Comic[];
const LAST_KEY = "brbTitlePageLast_v1";

// "&" vs "and", punctuation and case never stop a search ("cap wolf and" finds "Capwolf &").
const norm = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "");
const issueNum = (i: string) => { const n = parseFloat(String(i).replace(/^#/, "")); return Number.isFinite(n) ? n : Infinity; };
const yes = (v?: string) => (v || "").toUpperCase() === "YES";

type TitleInfo = { title: string; n: number; publisher: string; minY: number; maxY: number; key: string };

const TITLES: TitleInfo[] = (() => {
  const m = new Map<string, TitleInfo>();
  for (const c of comics) {
    const t = (c.Title || "").trim();
    if (!t) continue;
    const y = parseInt(c.Year) || 0;
    const e = m.get(t) || { title: t, n: 0, publisher: c.Publisher || "", minY: 9999, maxY: 0, key: norm(t) };
    e.n++;
    if (y) { e.minY = Math.min(e.minY, y); e.maxY = Math.max(e.maxY, y); }
    m.set(t, e);
  }
  return [...m.values()].sort((a, b) => a.title.localeCompare(b.title));
})();
const span = (a: number, b: number) => (!b ? "" : a === b ? String(a) : `${a}–${b}`);

function readLast(): string {
  try { return localStorage.getItem(LAST_KEY) || ""; } catch { return ""; }
}
function saveLast(t: string) {
  try { localStorage.setItem(LAST_KEY, t); } catch { /* private mode: fine */ }
}

export default function TitlePage({ initTitle }: { initTitle?: string }) {
  const [title, setTitle] = useState<string>(() => initTitle || "");
  const [q, setQ] = useState("");
  const [drawer, setDrawer] = useState<DrawerComic | null>(null);

  // A (t) click (or any deep link) always wins over what's on screen.
  // Follows the page's params both ways, so Back / Forward land on the right title (or the search).
  useEffect(() => { setTitle(initTitle || ""); setQ(""); }, [initTitle]);
  useEffect(() => { if (title) saveLast(title); }, [title]);

  const matches = useMemo(() => {
    const k = norm(q);
    if (!k) return [];
    const starts = TITLES.filter(t => t.key.startsWith(k));
    const has = TITLES.filter(t => !t.key.startsWith(k) && t.key.includes(k));
    return [...starts, ...has].slice(0, 40);
  }, [q]);

  const view = useMemo(() => {
    if (!title) return null;
    const rows = comics.filter(c => c.Title === title);
    const byVol = new Map<string, Comic[]>();
    for (const c of rows) {
      const v = String(c.Volume || "1").trim() || "1";
      if (!byVol.has(v)) byVol.set(v, []);
      byVol.get(v)!.push(c);
    }
    const vols = [...byVol.entries()].map(([vol, list]) => {
      // one tile per issue; extra copies show as "×2"
      const per = new Map<string, Comic[]>();
      for (const c of list) {
        const k = String(c.Issue).replace(/^#/, "");
        if (!per.has(k)) per.set(k, []);
        per.get(k)!.push(c);
      }
      const issues = [...per.entries()].sort((a, b) => issueNum(a[0]) - issueNum(b[0]) || a[0].localeCompare(b[0]));
      const ys = list.map(c => parseInt(c.Year) || 0).filter(Boolean);
      const nums = issues.map(([i]) => issueNum(i)).filter(n => Number.isInteger(n) && n >= 1 && n < 2000);
      const gaps: number[] = [];
      if (nums.length > 1) {
        const have = new Set(nums);
        for (let n = Math.min(...nums); n <= Math.max(...nums) && gaps.length <= 60; n++) if (!have.has(n)) gaps.push(n);
      }
      return { vol, issues, copies: list.length, years: span(Math.min(...(ys.length ? ys : [0])), Math.max(...(ys.length ? ys : [0]))), firstY: ys.length ? Math.min(...ys) : 0, gaps };
    }).sort((a, b) => (parseInt(a.vol) || 0) - (parseInt(b.vol) || 0) || a.firstY - b.firstY);
    const boxes = new Map<string, number>();
    for (const c of rows) boxes.set(c.Box || "—", (boxes.get(c.Box || "—") || 0) + 1);
    const ys = rows.map(c => parseInt(c.Year) || 0).filter(Boolean);
    const base = norm(title);
    const related = TITLES.filter(t => t.title !== title && t.key.startsWith(base) && t.key.length > base.length).slice(0, 24);
    return {
      rows, vols, related,
      boxes: [...boxes.entries()].sort((a, b) => b[1] - a[1]),
      keys: rows.filter(c => yes(c.Key)).length,
      signed: rows.filter(c => yes(c.Signed)).length,
      years: ys.length ? span(Math.min(...ys), Math.max(...ys)) : "",
      publisher: rows[0]?.Publisher || "",
    };
  }, [title]);

  // Picking a title goes through the site's history, so Back returns to the previous title.
  const pick = (t: string) => { setQ(""); if (t === title) return; navTo("title", { title: t }); };
  const last = readLast();

  return (
    <div className="tp">
      <style>{CSS}</style>
      <div className="tp-search">
        <input
          className="tp-in" type="search" autoFocus={!initTitle}
          placeholder="Search a title — e.g. Moon Knight, Capwolf, X-Force"
          value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && matches[0]) pick(matches[0].title); }}
          aria-label="Search titles"
        />
        {q && (
          <div className="tp-results" role="listbox">
            {matches.length === 0 && <div className="tp-none">No title matches "{q}".</div>}
            {matches.map(t => (
              <button key={t.title} className="tp-res" onClick={() => pick(t.title)}>
                <span className="tp-res-t">{t.title}</span>
                <span className="tp-res-m">{t.publisher} · {span(t.minY, t.maxY)} · {t.n} book{t.n === 1 ? "" : "s"}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!view && !q && (
        <div className="tp-empty">
          <div>{TITLES.length.toLocaleString()} titles. Type a few letters to jump to one.</div>
          {last && <button className="tp-chip" onClick={() => pick(last)}>↺ Last viewed: {last}</button>}
        </div>
      )}

      {view && !q && (
        <>
          <header className="tp-head">
            <h1 className="tp-h1">{title}</h1>
            <div className="tp-meta">
              {view.publisher && <span>{view.publisher}</span>}
              {view.years && <span>{view.years}</span>}
              <span><b>{view.rows.length}</b> book{view.rows.length === 1 ? "" : "s"}</span>
              {view.vols.length > 1 && <span><b>{view.vols.length}</b> volumes</span>}
              {view.keys > 0 && <span className="tp-key">★ {view.keys} key{view.keys === 1 ? "" : "s"}</span>}
              {view.signed > 0 && <span className="tp-sig">✍ {view.signed} signed</span>}
            </div>
            <div className="tp-actions">
              <button className="tp-btn" onClick={() => navTo("coverreview", { title })}>🖼 Cover Review</button>
              <button className="tp-btn" onClick={() => navTo("everything", { query: title })}>📋 Every Book</button>
            </div>
            <div className="tp-boxes">
              <span className="tp-lbl">Boxes</span>
              {view.boxes.map(([b, n]) => (
                <button key={b} className="tp-chip" onClick={() => navTo("boxvisual", { box: b })} title={`Open box ${b}`}>
                  {/^\d+$/.test(b) ? `Box ${b}` : b.split(" — ")[0]} · {n}
                </button>
              ))}
            </div>
          </header>

          {view.vols.map(v => (
            <section key={v.vol} className="tp-vol">
              <div className="tp-vol-hd">
                <span className="tp-vol-name">Vol {v.vol}</span>
                <span className="tp-vol-meta">{v.years} · {v.issues.length} issue{v.issues.length === 1 ? "" : "s"}{v.copies > v.issues.length ? ` · ${v.copies} copies` : ""}</span>
              </div>
              {v.gaps.length > 0 && (
                <div className="tp-gaps">Missing from the run: {v.gaps.slice(0, 60).map(n => `#${n}`).join(", ")}{v.gaps.length > 60 ? " …" : ""}</div>
              )}
              <div className="tp-grid">
                {v.issues.map(([iss, copies]) => {
                  const c = copies[0];
                  return (
                    <button key={iss} className="tp-card" onClick={() => setDrawer(c as unknown as DrawerComic)} title={`${title} #${iss}`}>
                      <CoverImage comic={c} width={66} height={100} titleLink={false} />
                      <span className="tp-info">
                        <span className="tp-iss">#{iss}{copies.length > 1 && <span className="tp-x"> ×{copies.length}</span>}</span>
                        <span className="tp-sub">{c.Year}</span>
                        <span className="tp-sub">{[...new Set(copies.map(x => /^\d+$/.test(x.Box) ? `Box ${x.Box}` : (x.Box || "—").split(" — ")[0]))].join(", ")}</span>
                        <span className="tp-flags">
                          {copies.some(x => yes(x.Key)) && <span className="tp-key" title={c.Key_Reason || "Key issue"}>★</span>}
                          {copies.some(x => yes(x.Signed)) && <span className="tp-sig" title="Signed">✍</span>}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          {view.related.length > 0 && (
            <section className="tp-vol">
              <div className="tp-vol-hd"><span className="tp-vol-name">Related titles</span></div>
              <div className="tp-boxes">
                {view.related.map(t => <button key={t.title} className="tp-chip" onClick={() => pick(t.title)}>{t.title} · {t.n}</button>)}
              </div>
            </section>
          )}
        </>
      )}

      <ComicDrawer comic={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

const CSS = `
.tp{max-width:1200px;margin:0 auto}
.tp-search{position:relative;margin-bottom:16px}
.tp-in{width:100%;box-sizing:border-box;font-size:1rem;padding:11px 14px;border-radius:10px;border:1.5px solid var(--border,#2c2c38);background:var(--surface,#1a1a22);color:var(--text,#eee)}
.tp-in:focus{outline:none;border-color:var(--red,#e05a4a)}
.tp-results{margin-top:6px;border:1px solid var(--border,#2c2c38);border-radius:10px;background:var(--surface,#1a1a22);max-height:60vh;overflow-y:auto}
.tp-res{display:flex;flex-direction:column;gap:2px;width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--border,#2c2c38);padding:9px 12px;color:inherit;font:inherit;cursor:pointer}
.tp-res:last-child{border-bottom:none}
.tp-res:hover,.tp-res:focus{background:var(--surface2,#26262f)}
.tp-res-t{font-weight:700;overflow-wrap:anywhere}
.tp-res-m{font-size:.76rem;color:var(--muted,#888)}
.tp-none,.tp-empty{color:var(--muted,#888);padding:14px 4px;display:flex;flex-direction:column;gap:10px;align-items:flex-start}
.tp-head{margin-bottom:18px;display:flex;flex-direction:column;gap:8px}
.tp-h1{margin:0;font-size:1.7rem;line-height:1.2;overflow-wrap:anywhere}
.tp-meta{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:.88rem;color:var(--muted2,#bbb)}
.tp-meta b{color:var(--text,#eee)}
.tp-actions{display:flex;flex-wrap:wrap;gap:8px}
.tp-btn{border:1px solid var(--border,#2c2c38);background:var(--surface,#1a1a22);color:var(--text,#eee);border-radius:8px;padding:6px 12px;font:inherit;font-size:.85rem;cursor:pointer}
.tp-btn:hover{border-color:var(--red,#e05a4a)}
.tp-boxes{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.tp-lbl{font-size:.72rem;letter-spacing:.5px;text-transform:uppercase;color:var(--muted,#888);margin-right:2px}
.tp-chip{border:1px solid var(--border,#2c2c38);background:var(--surface2,#26262f);color:var(--muted2,#bbb);border-radius:999px;padding:3px 10px;font:inherit;font-size:.76rem;cursor:pointer;max-width:100%;overflow-wrap:anywhere;text-align:left}
.tp-chip:hover{color:var(--text,#eee);border-color:var(--red,#e05a4a)}
.tp-vol{margin-bottom:24px}
.tp-vol-hd{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:4px 12px;border-bottom:2px solid var(--border,#2c2c38);padding-bottom:5px;margin-bottom:8px}
.tp-vol-name{font-size:1.15rem;font-weight:800}
.tp-vol-meta{font-size:.82rem;color:var(--muted2,#bbb)}
.tp-gaps{font-size:.78rem;color:#d97706;margin:0 0 10px;overflow-wrap:anywhere}
.tp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(136px,1fr));gap:8px}
.tp-card{display:flex;gap:8px;align-items:flex-start;text-align:left;background:var(--surface,#1a1a22);border:1px solid var(--border,#2c2c38);border-radius:9px;padding:6px;color:inherit;font:inherit;cursor:pointer;min-width:0}
.tp-card:hover{border-color:var(--red,#e05a4a)}
.tp-info{display:flex;flex-direction:column;gap:3px;min-width:0}
.tp-iss{font-weight:800;font-size:.95rem;color:var(--red,#e05a4a)}
.tp-x{color:var(--muted2,#bbb);font-weight:600;font-size:.78rem}
.tp-sub{font-size:.74rem;color:var(--muted2,#bbb);overflow-wrap:anywhere}
.tp-flags{display:flex;gap:6px;font-size:.85rem}
.tp-key{color:#e6b95c}
.tp-sig{color:#8fd0ff}
`;
