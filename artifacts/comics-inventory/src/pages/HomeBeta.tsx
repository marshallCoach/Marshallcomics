import { useEffect, useMemo, useState } from "react";
import { DATA } from "@/data/data";
import { CoverImage, coverUrlSync, coversReady } from "@/components/CoverImage";
import ComicDrawer from "@/components/ComicDrawer";
import { arcOf, arcIssueRange } from "@/lib/arc";
import { ebayHeadline } from "@/utils/ebay";
import { navTo, openTitle, openArc } from "@/lib/nav";
import { pubColors } from "@/utils/coverThumbnails";

// Home β (Nov 28) - a redesign of the home page. Hero: one expensive KEY at full cover size
// with every detail, and its story arc stacked beside it. Below: the existing home features
// (search, numbers, value, completeness, flagship books, creators, publishers, boxes) as
// calm, tactile cards. "Make live homepage" swaps the Home tab to this page (this browser).

type Comic = (typeof DATA.comics)[number];
const comics = DATA.comics as Comic[];
export const HOME_BETA_KEY = "brbHomeBetaLive";
export const homeBetaLive = () => { try { return localStorage.getItem(HOME_BETA_KEY) === "1"; } catch { return false; } };

const money = (n: number) => "$" + Math.round(n).toLocaleString();
const firstNum = (s?: string) => { const m = String(s ?? "").match(/\$?(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };
const yes = (s?: string) => /^(y|true)/i.test(String(s ?? "").trim());
const priceOf = (c: Comic) => {
  const eb = ebayHeadline(c as { eBay_Median?: number | null; eBay_Avg?: number | null });
  return eb != null && eb > 0 ? eb : firstNum(c.Value_NM);
};
const largeOf = (u: string | null) => u ? u.replace("/scale_medium/", "/scale_large/") : null;
const issNum = (s: string) => { const v = parseFloat(String(s).replace(/^#/, "")); return Number.isFinite(v) ? v : 1e9; };

// ── numbers (same rules as the classic home) ──
const STATS = (() => {
  const keys = comics.filter(c => yes(c.Key)).length;
  const signed = comics.filter(c => yes(c.Signed)).length;
  const boxes = new Set(comics.map(c => String(c.Box || "")).filter(b => /^\d+$|^CC\d+$/i.test(b))).size;
  let value = 0, priced = 0;
  for (const c of comics) { const p = priceOf(c); if (p > 0) { value += p; priced++; } }
  return { total: comics.length, keys, signed, boxes, value, priced };
})();
const FILL = ([
  ["Writer", "Writers"], ["Artist", "Artists"], ["Cover_Artist", "Cover art"], ["Pub_Date", "Pub dates"],
  ["Volume", "Volumes"], ["Story_Arc", "Story arcs"], ["Condition", "Condition"],
] as [keyof Comic, string][]).map(([k, label]) => {
  const n = comics.reduce((a, c) => a + (String(c[k] ?? "").trim() && !/^(n\/a|unknown|\?|tbd|none)$/i.test(String(c[k]).trim()) ? 1 : 0), 0);
  return { label, pct: n >= comics.length ? 100 : Math.min(99.9, Math.floor((1000 * n) / comics.length) / 10) };
});
const TOP = (k: keyof Comic) => {
  const m: Record<string, number> = {};
  for (const c of comics) for (const n of String(c[k] ?? "").split(/,|&|\band\b/).map(s => s.trim()).filter(s => s && s.length > 2 && !/^(various|n\/a|unknown)$/i.test(s))) m[n] = (m[n] || 0) + 1;
  return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5);
};
const CREATORS = { Writers: TOP("Writer"), Artists: TOP("Artist"), "Cover artists": TOP("Cover_Artist") };
const PUBS = (() => {
  const m: Record<string, number> = {};
  for (const c of comics) { const p = /marvel/i.test(c.Publisher) ? "Marvel" : /^dc/i.test(c.Publisher) ? "DC" : /image|skybound/i.test(c.Publisher) ? "Image" : "Other"; m[p] = (m[p] || 0) + 1; }
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
})();
const FLAGSHIP = (() => {
  const seen = new Set<string>();
  return [...comics].filter(c => priceOf(c) > 0).sort((a, b) => priceOf(b) - priceOf(a))
    .filter(c => { const k = `${c.Title}|${c.Issue}|${c.Signed_By || ""}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 12);
})();
const RECENT = (() => {
  const d = (c: Comic) => { const t = Date.parse(String(c.Date_Added || "")); return Number.isFinite(t) ? t : 0; };
  return [...comics].filter(c => d(c) > 0).sort((a, b) => d(b) - d(a)).slice(0, 12);
})();
const BOXFILL = (() => {
  const cap: Record<string, number> = { "15": 150, "23": 155, "40": 80, "44": 200, "72": 100, "85": 155 };
  const n: Record<string, number> = {};
  for (const c of comics) { const b = String(c.Box || ""); if (/^\d+$/.test(b)) n[b] = (n[b] || 0) + 1; }
  return Object.entries(n).map(([b, k]) => ({ b, k, cap: cap[b] ?? 240 })).sort((a, b) => b.k / b.cap - a.k / a.cap).slice(0, 10);
})();
// Pool for the hero: priced KEY books, most valuable first (one per title+issue).
const KEY_POOL = (() => {
  const seen = new Set<string>();
  return [...comics].filter(c => yes(c.Key) && priceOf(c) > 0).sort((a, b) => priceOf(b) - priceOf(a))
    .filter(c => { const k = `${c.Title}|${c.Issue}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 40);
})();

function useCount(target: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const p = Math.min(1, (t - t0) / ms); setV(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Stat({ n, label, sub, money: isMoney, accent }: { n: number; label: string; sub?: string; money?: boolean; accent: string }) {
  const v = useCount(n);
  return (
    <div className="hb-card hb-stat">
      <div className="hb-stat-n" style={{ color: accent }}>{isMoney ? money(v) : v.toLocaleString()}</div>
      <div className="hb-stat-l">{label}</div>
      {sub && <div className="hb-stat-s">{sub}</div>}
    </div>
  );
}

function Ring({ pct, label }: { pct: number; label: string }) {
  const r = 26, c = 2 * Math.PI * r;
  const col = pct >= 99 ? "#16a34a" : pct >= 90 ? "#2563eb" : pct >= 70 ? "#d97706" : "#dc2626";
  return (
    <div className="hb-ring">
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--border, #e5e7eb)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={col} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 32 32)" className="hb-ring-arc" />
      </svg>
      <div className="hb-ring-n">{pct >= 100 ? "100" : pct.toFixed(pct >= 99 ? 1 : 0)}%</div>
      <div className="hb-ring-l">{label}</div>
    </div>
  );
}

export default function HomeBeta() {
  const [ready, setReady] = useState(false);
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * Math.min(12, KEY_POOL.length)));
  const [drawer, setDrawer] = useState<Comic | null>(null);
  const [q, setQ] = useState("");
  const [live, setLive] = useState(homeBetaLive);
  const [imgFailed, setImgFailed] = useState<Set<string>>(new Set());   // large cover failed -> normal cover
  useEffect(() => { coversReady().then(() => setReady(true)); window.scrollTo(0, 0); }, []);

  const hero = KEY_POOL.length ? KEY_POOL[idx % KEY_POOL.length] : null;
  const heroCover = useMemo(() => (ready && hero ? largeOf(coverUrlSync(hero)) : null), [ready, hero]);

  // The hero's own arc, or (if it has none) a complete owned arc so the stack is never empty.
  const arc = useMemo(() => {
    const group = (title: string, vol: string, name: string) => {
      const books = comics.filter(c => c.Title === title && String(c.Volume || "1") === vol && arcOf(c)?.name === name);
      const seen = new Set<number>();
      const uniq = books.filter(b => { const i = issNum(b.Issue); if (seen.has(i)) return false; seen.add(i); return true; })
        .sort((a, b) => (arcOf(a)?.part ?? issNum(a.Issue)) - (arcOf(b)?.part ?? issNum(b.Issue)) || issNum(a.Issue) - issNum(b.Issue));
      const range = arcIssueRange(books);
      const owned = new Set(uniq.map(b => issNum(b.Issue)));
      const missing = range ? range.filter(i => !owned.has(i)) : [];
      return { title, vol, name, books: uniq, missing, length: range?.length ?? uniq.length };
    };
    const a = hero && arcOf(hero);
    if (hero && a) return { own: true, ...group(hero.Title, String(hero.Volume || "1"), a.name) };
    const keys = new Map<string, number>();
    for (const c of comics) { const x = arcOf(c); if (x && x.length && x.length >= 4) keys.set(`${c.Title}|||${c.Volume || "1"}|||${x.name}`, x.length); }
    const pool = [...keys.keys()];
    if (!pool.length) return null;
    const [t, v, n] = pool[(idx * 7919) % pool.length].split("|||");
    return { own: false, ...group(t, v, n) };
  }, [hero, idx]);

  const go = () => { if (q.trim()) navTo("everything", { query: q.trim() }); };
  const makeLive = () => { try { localStorage.setItem(HOME_BETA_KEY, "1"); } catch { /* private mode */ } setLive(true); navTo("summary"); };
  const backToClassic = () => {
    try { localStorage.removeItem(HOME_BETA_KEY); } catch { /* ignore */ }
    setLive(false);
    try { history.replaceState(null, "", "#summary"); location.reload(); } catch { navTo("summary"); }
  };
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const price = hero ? priceOf(hero) : 0;
  const ebay = hero ? ebayHeadline(hero as { eBay_Median?: number | null; eBay_Avg?: number | null }) : null;
  const pc = hero ? pubColors(hero.Publisher) : null;

  return (
    <div className="hb">
      <style>{CSS}</style>

      <header className="hb-top">
        <div style={{ minWidth: 0 }}>
          <div className="hb-eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
          <h1 className="hb-h1">{greet}, Robert.</h1>
          <div className="hb-lede">{STATS.total.toLocaleString()} comics, {STATS.keys.toLocaleString()} keys, one collection.</div>
        </div>
        <div className="hb-top-actions">
          {live
            ? <button className="hb-btn hb-ghost" onClick={backToClassic}>Back to classic home</button>
            : <><span className="hb-beta">BETA</span><button className="hb-btn hb-primary" onClick={makeLive}>Make live homepage</button></>}
        </div>
      </header>

      {/* ── HERO: showcase key + its arc ── */}
      {hero && (
        <section className="hb-hero">
          <article className="hb-card hb-key">
            <div className="hb-key-cover" onClick={() => setDrawer(hero)} role="button" title="Full details">
              {heroCover && !imgFailed.has(heroCover)
                ? <img src={heroCover} alt={`${hero.Title} #${hero.Issue}`} className="hb-key-img"
                    onError={() => setImgFailed(s => new Set(s).add(heroCover))} />
                : <CoverImage comic={hero} width={320} height={490} objectFit="contain" style={{ width: "100%", height: "auto", aspectRatio: "2 / 3", borderRadius: 14 }} />}
              <span className="hb-ribbon">KEY</span>
            </div>
            <div className="hb-key-body">
              <div className="hb-chips">
                <span className="hb-chip" style={{ background: pc?.bg, color: pc?.text }}>{hero.Publisher || "—"}</span>
                <span className="hb-chip hb-chip-soft">{hero.Year}{hero.Volume && hero.Volume !== "1" ? ` · Vol ${hero.Volume}` : ""}</span>
                {yes(hero.Signed) && <span className="hb-chip hb-chip-sig">Signed{hero.Signed_By ? ` · ${hero.Signed_By}` : ""}</span>}
              </div>
              <h2 className="hb-key-title"><a onClick={() => openTitle(hero.Title)}>{hero.Title}</a> <span className="hb-key-iss">#{hero.Issue}</span></h2>
              {hero.Key_Reason && <p className="hb-key-why">{hero.Key_Reason}</p>}
              <div className="hb-price">
                <div><div className="hb-price-n">{money(price)}</div><div className="hb-price-l">{ebay != null && ebay > 0 ? "eBay market" : "Est. NM"}</div></div>
                {hero.Value_NM && <div><div className="hb-price-m">{hero.Value_NM.startsWith("$") ? hero.Value_NM : `$${hero.Value_NM}`}</div><div className="hb-price-l">Sheet NM</div></div>}
                {hero.Value_VF && <div><div className="hb-price-m">{hero.Value_VF.startsWith("$") ? hero.Value_VF : `$${hero.Value_VF}`}</div><div className="hb-price-l">VF</div></div>}
              </div>
              <dl className="hb-facts">
                {([["First appearance", hero.First_App], ["Writer", hero.Writer], ["Artist", hero.Artist], ["Cover", hero.Cover_Artist],
                   ["Condition", hero.Condition], ["CGC-worthy", hero.CGC_Worth], ["Story arc", arcOf(hero)?.name], ["Box", hero.Box]] as [string, string | undefined][])
                  .filter(([, v]) => v && String(v).trim()).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
              <div className="hb-key-actions">
                <button className="hb-btn hb-primary" onClick={() => setDrawer(hero)}>Full details</button>
                <button className="hb-btn hb-ghost" onClick={() => setIdx(i => (i + 1) % KEY_POOL.length)}>Next key ↻</button>
                <span className="hb-count">{(idx % KEY_POOL.length) + 1} of {KEY_POOL.length} top keys</span>
              </div>
            </div>
          </article>

          <aside className="hb-card hb-arc">
            <div className="hb-eyebrow">{arc?.own ? "From the same story" : "Arc of the day"}</div>
            {arc ? (
              <>
                <h3 className="hb-arc-name"><a onClick={() => openArc(arc.title, arc.name, arc.vol)}>{arc.name}</a></h3>
                <div className="hb-arc-sub">{arc.title}{arc.vol !== "1" ? ` · Vol ${arc.vol}` : ""} · {arc.books.length} of {arc.length} owned{arc.missing.length ? ` · missing #${arc.missing.join(", #")}` : " · complete ✓"}</div>
                <div className="hb-stack">
                  {arc.books.slice(0, 12).map((b, i) => (
                    <div key={`${b.Issue}-${i}`} className={`hb-stack-item${b === hero ? " is-hero" : ""}`} style={{ zIndex: 50 - i }} onClick={() => setDrawer(b)} title={`${b.Title} #${b.Issue}`}>
                      <CoverImage comic={b} width={120} height={180} style={{ borderRadius: 10, width: "100%", height: "auto", aspectRatio: "2 / 3" }} />
                      <span className="hb-stack-tag">{arcOf(b)?.part ? `Part ${arcOf(b)?.part}` : `#${b.Issue}`}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <div className="hb-arc-sub">No story arcs on file yet.</div>}
          </aside>
        </section>
      )}

      {/* ── search ── */}
      <div className="hb-search">
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} placeholder="Search 11,000+ comics: title, creator, character…" />
        <button className="hb-btn hb-primary" onClick={go}>Search</button>
      </div>

      {/* ── numbers ── */}
      <section className="hb-stats">
        <Stat n={STATS.total} label="Comics" accent="var(--red, #c8102e)" />
        <Stat n={STATS.keys} label="Key issues" sub={`${((100 * STATS.keys) / STATS.total).toFixed(1)}% of the collection`} accent="#b45309" />
        <Stat n={STATS.signed} label="Signed" accent="#7c3aed" />
        <Stat n={STATS.boxes} label="Boxes" accent="#2563eb" />
        <Stat n={STATS.value} money label="Collection value" sub={`${STATS.priced.toLocaleString()} books priced`} accent="#15803d" />
      </section>

      {/* ── quick moves ── */}
      <section className="hb-moves">
        {[["datafix", "Data Fix", "Clear today's problems", "#c8102e"], ["pulllist", "Pull List", "This month + next month", "#7c3aed"],
          ["unknownboxes", "Unknown → Box", "509 books to re-home", "#2563eb"], ["coverreview", "Cover Review", "Spot the wrong covers", "#b45309"],
          ["hunting", "Box Hunt", "Find any book fast", "#15803d"]].map(([tab, t, s, col]) => (
          <button key={tab} className="hb-card hb-move" onClick={() => navTo(tab)} style={{ ["--accent" as string]: col }}>
            <span className="hb-move-t">{t}</span><span className="hb-move-s">{s}</span><span className="hb-move-go">→</span>
          </button>
        ))}
      </section>

      {/* ── flagship strip ── */}
      <section className="hb-section">
        <div className="hb-sec-head"><h3>Most valuable</h3><a onClick={() => navTo("keycatalog")}>All keys →</a></div>
        <div className="hb-strip">
          {FLAGSHIP.map((c, i) => (
            <button key={i} className="hb-strip-item" onClick={() => setDrawer(c)}>
              <CoverImage comic={c} width={130} height={195} style={{ borderRadius: 10 }} />
              <span className="hb-strip-v">{money(priceOf(c))}</span>
              <span className="hb-strip-t">{c.Title} #{c.Issue}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── completeness + publishers ── */}
      <section className="hb-two">
        <div className="hb-card hb-pad">
          <div className="hb-sec-head"><h3>Data completeness</h3><a onClick={() => navTo("datafix")}>Fix →</a></div>
          <div className="hb-rings">{FILL.map(f => <Ring key={f.label} pct={f.pct} label={f.label} />)}</div>
        </div>
        <div className="hb-card hb-pad">
          <div className="hb-sec-head"><h3>Publishers</h3><a onClick={() => navTo("stats")}>Stats →</a></div>
          {PUBS.map(([p, n]) => (
            <div key={p} className="hb-bar">
              <span className="hb-bar-l">{p}</span>
              <span className="hb-bar-t"><span className="hb-bar-f" style={{ width: `${(100 * n) / STATS.total}%`, background: pubColors(p).bg }} /></span>
              <span className="hb-bar-n">{n.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── creators ── */}
      <section className="hb-three">
        {Object.entries(CREATORS).map(([h, list]) => (
          <div key={h} className="hb-card hb-pad">
            <div className="hb-sec-head"><h3>Top {h.toLowerCase()}</h3></div>
            <ol className="hb-list">{list.map(([n, k], i) => <li key={n}><span className="hb-rank">{i + 1}</span><span className="hb-name">{n}</span><span className="hb-num">{k}</span></li>)}</ol>
          </div>
        ))}
      </section>

      {/* ── recent + boxes ── */}
      <section className="hb-section">
        <div className="hb-sec-head"><h3>Recently added</h3><a onClick={() => navTo("recent")}>All →</a></div>
        <div className="hb-strip">
          {RECENT.map((c, i) => (
            <button key={i} className="hb-strip-item" onClick={() => setDrawer(c)}>
              <CoverImage comic={c} width={110} height={165} style={{ borderRadius: 10 }} />
              <span className="hb-strip-t">{c.Title} #{c.Issue}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="hb-card hb-pad">
        <div className="hb-sec-head"><h3>Fullest boxes</h3><a onClick={() => navTo("boxvisual")}>Box view →</a></div>
        <div className="hb-boxes">
          {BOXFILL.map(x => {
            const p = Math.min(130, (100 * x.k) / x.cap);
            return (
              <div key={x.b} className="hb-box" onClick={() => navTo("boxvisual", { box: x.b })}>
                <div className="hb-box-fill" style={{ height: `${Math.min(100, p)}%`, background: x.k > x.cap ? "#dc2626" : p > 90 ? "#d97706" : "#2563eb" }} />
                <div className="hb-box-n">{x.b}</div>
                <div className="hb-box-k">{x.k}/{x.cap}</div>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="hb-foot">
        Anything missing from the classic home (update banner, schedule, platform split) is one tap away: <a onClick={() => navTo("summary")}>{live ? "" : "Classic home →"}</a>
        {live && <a onClick={backToClassic}>Back to classic home →</a>}
      </footer>

      {drawer && <ComicDrawer comic={drawer as never} onClose={() => setDrawer(null)} />}
    </div>
  );
}

const CSS = `
.hb{max-width:calc(1160px + var(--wide, 0px));margin:0 auto;padding:28px 16px 90px;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",Roboto,sans-serif;color:#1d1d1f}
.hb a{cursor:pointer;color:#0066cc;text-decoration:none}.hb a:hover{text-decoration:underline}
.hb-card{background:#fff;border-radius:20px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 8px 28px rgba(0,0,0,.06);border:1px solid rgba(0,0,0,.05)}
.hb-pad{padding:20px}
.hb-top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.hb-eyebrow{font-size:.78rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#86868b}
.hb-h1{font-size:clamp(1.9rem,4.4vw,2.9rem);font-weight:700;letter-spacing:-.02em;margin:4px 0 2px;line-height:1.05}
.hb-lede{color:#6e6e73;font-size:1.05rem}
.hb-top-actions{display:flex;gap:8px;align-items:center}
.hb-beta{font-size:.7rem;font-weight:800;letter-spacing:.1em;color:#7c3aed;background:#f3e8ff;border-radius:999px;padding:4px 10px}
.hb-btn{border:none;border-radius:999px;padding:9px 18px;font:inherit;font-weight:600;font-size:.9rem;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,background .15s}
.hb-btn:active{transform:scale(.97)}
.hb-primary{background:#1d1d1f;color:#fff}.hb-primary:hover{background:#000;box-shadow:0 6px 16px rgba(0,0,0,.18)}
.hb-ghost{background:rgba(0,0,0,.05);color:#1d1d1f}.hb-ghost:hover{background:rgba(0,0,0,.09)}
.hb-hero{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);gap:18px;margin-bottom:22px;align-items:start}
.hb-key{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px;padding:22px;overflow:hidden;position:relative;background:linear-gradient(160deg,#fff 0%,#fffaf0 100%)}
.hb-key-cover{position:relative;cursor:zoom-in;animation:hb-rise .6s cubic-bezier(.2,.8,.2,1) both}
.hb-key-img{width:100%;height:auto;display:block;border-radius:14px;box-shadow:0 18px 40px rgba(0,0,0,.28);transition:transform .35s cubic-bezier(.2,.8,.2,1)}
.hb-key-cover:hover .hb-key-img{transform:translateY(-4px) rotate(-.6deg)}
.hb-ribbon{position:absolute;top:12px;left:-6px;background:linear-gradient(135deg,#f5c542,#d4a017);color:#3b2a00;font-weight:800;font-size:.72rem;letter-spacing:.12em;padding:5px 12px;border-radius:0 6px 6px 0;box-shadow:0 4px 10px rgba(180,130,0,.35)}
.hb-key-body{min-width:0;display:flex;flex-direction:column;gap:12px;animation:hb-fade .7s .1s ease both}
.hb-chips{display:flex;gap:6px;flex-wrap:wrap}
.hb-chip{font-size:.72rem;font-weight:700;letter-spacing:.04em;padding:4px 10px;border-radius:999px}
.hb-chip-soft{background:#f2f2f7;color:#3a3a3c}.hb-chip-sig{background:#f3e8ff;color:#6d28d9}
.hb-key-title{font-size:clamp(1.5rem,2.6vw,2.1rem);font-weight:700;letter-spacing:-.02em;line-height:1.1;margin:0;overflow-wrap:anywhere}
.hb-key-title a{color:inherit}.hb-key-iss{color:#c8102e}
.hb-key-why{margin:0;font-size:1rem;line-height:1.45;color:#3a3a3c;border-left:3px solid #f5c542;padding-left:12px}
.hb-price{display:flex;gap:22px;flex-wrap:wrap;align-items:flex-end}
.hb-price-n{font-size:2rem;font-weight:800;letter-spacing:-.02em;color:#15803d;line-height:1}
.hb-price-m{font-size:1.1rem;font-weight:700;color:#3a3a3c}
.hb-price-l{font-size:.72rem;color:#86868b;text-transform:uppercase;letter-spacing:.06em;margin-top:3px}
.hb-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px;margin:0}
.hb-facts dt{font-size:.7rem;color:#86868b;text-transform:uppercase;letter-spacing:.06em}
.hb-facts dd{margin:2px 0 0;font-size:.9rem;font-weight:500;overflow-wrap:anywhere}
.hb-key-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:auto}
.hb-count{font-size:.78rem;color:#86868b}
.hb-arc{padding:20px;min-width:0}
.hb-arc-name{font-size:1.35rem;font-weight:700;letter-spacing:-.01em;margin:6px 0 2px}.hb-arc-name a{color:inherit}
.hb-arc-sub{font-size:.85rem;color:#6e6e73;margin-bottom:14px}
.hb-stack{display:flex;flex-direction:column;align-items:center;padding:6px 0 0}
.hb-stack-item{position:relative;width:min(62%,200px);margin-top:-58%;transition:transform .3s cubic-bezier(.2,.8,.2,1),margin .3s;cursor:pointer;filter:drop-shadow(0 8px 14px rgba(0,0,0,.2))}
.hb-stack-item:first-child{margin-top:0}
.hb-stack:hover .hb-stack-item{margin-top:-40%}.hb-stack:hover .hb-stack-item:first-child{margin-top:0}
.hb-stack-item:hover{transform:translateX(18px) scale(1.03)}
.hb-stack-item.is-hero{outline:3px solid #f5c542;border-radius:12px}
.hb-stack-tag{position:absolute;right:-8px;bottom:12px;background:#1d1d1f;color:#fff;font-size:.68rem;font-weight:700;padding:3px 8px;border-radius:999px}
.hb-search{display:flex;gap:8px;margin:0 0 22px}
.hb-search input{flex:1;min-width:0;border:1px solid rgba(0,0,0,.1);border-radius:999px;padding:13px 20px;font:inherit;font-size:1rem;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.04);outline:none;transition:box-shadow .2s,border-color .2s}
.hb-search input:focus{border-color:#0066cc;box-shadow:0 0 0 4px rgba(0,102,204,.15)}
.hb-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:22px}
.hb-stat{padding:18px;transition:transform .2s}.hb-stat:hover{transform:translateY(-2px)}
.hb-stat-n{font-size:clamp(1.4rem,2.6vw,2rem);font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1}
.hb-stat-l{font-size:.85rem;font-weight:600;margin-top:6px}.hb-stat-s{font-size:.74rem;color:#86868b;margin-top:2px}
.hb-moves{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:26px}
.hb-move{position:relative;text-align:left;padding:16px 16px 16px 18px;cursor:pointer;font:inherit;display:flex;flex-direction:column;gap:3px;overflow:hidden;transition:transform .2s,box-shadow .2s}
.hb-move::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--accent)}
.hb-move:hover{transform:translateY(-3px);box-shadow:0 12px 30px rgba(0,0,0,.1)}
.hb-move-t{font-weight:700}.hb-move-s{font-size:.78rem;color:#6e6e73}
.hb-move-go{position:absolute;right:14px;top:14px;color:var(--accent);font-weight:800;transition:transform .2s}.hb-move:hover .hb-move-go{transform:translateX(3px)}
.hb-section{margin-bottom:26px}
.hb-sec-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:12px}
.hb-sec-head h3{margin:0;font-size:1.15rem;font-weight:700;letter-spacing:-.01em}.hb-sec-head a{font-size:.85rem}
.hb-strip{display:flex;gap:14px;overflow-x:auto;padding:4px 2px 12px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch}
.hb-strip-item{flex:0 0 auto;width:130px;scroll-snap-align:start;background:none;border:none;padding:0;text-align:left;cursor:pointer;font:inherit;transition:transform .2s}
.hb-strip-item:hover{transform:translateY(-4px)}
.hb-strip-v{display:block;font-weight:800;color:#15803d;margin-top:8px;font-size:.95rem}
.hb-strip-t{display:block;font-size:.78rem;color:#3a3a3c;line-height:1.3;margin-top:2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.hb-two{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:18px;margin-bottom:22px}
.hb-three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-bottom:26px}
.hb-rings{display:grid;grid-template-columns:repeat(auto-fill,minmax(82px,1fr));gap:12px}
.hb-ring{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center}
.hb-ring-arc{transition:stroke-dasharray 1.2s cubic-bezier(.2,.8,.2,1)}
.hb-ring-n{position:absolute;top:22px;font-size:.78rem;font-weight:800}
.hb-ring-l{font-size:.74rem;color:#6e6e73;margin-top:4px}
.hb-bar{display:grid;grid-template-columns:62px minmax(0,1fr) 56px;gap:10px;align-items:center;margin:10px 0}
.hb-bar-l{font-size:.85rem;font-weight:600}.hb-bar-n{font-size:.85rem;text-align:right;font-variant-numeric:tabular-nums;color:#3a3a3c}
.hb-bar-t{height:10px;background:#f2f2f7;border-radius:999px;overflow:hidden}
.hb-bar-f{display:block;height:100%;border-radius:999px;animation:hb-grow 1.1s cubic-bezier(.2,.8,.2,1) both}
.hb-list{list-style:none;margin:0;padding:0}
.hb-list li{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:8px;align-items:center;padding:7px 0;border-top:1px solid #f2f2f7}
.hb-list li:first-child{border-top:none}
.hb-rank{font-size:.78rem;font-weight:800;color:#86868b}.hb-name{font-size:.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hb-num{font-size:.82rem;color:#6e6e73;font-variant-numeric:tabular-nums}
.hb-boxes{display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:10px}
.hb-box{position:relative;height:96px;background:#f2f2f7;border-radius:12px;overflow:hidden;cursor:pointer;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding-bottom:8px;transition:transform .2s}
.hb-box:hover{transform:translateY(-2px)}
.hb-box-fill{position:absolute;left:0;right:0;bottom:0;opacity:.22;animation:hb-grow-y 1s cubic-bezier(.2,.8,.2,1) both}
.hb-box-n{position:relative;font-weight:800;font-size:1.1rem}.hb-box-k{position:relative;font-size:.7rem;color:#3a3a3c}
.hb-foot{margin-top:30px;text-align:center;font-size:.82rem;color:#86868b;display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
@keyframes hb-rise{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none}}
@keyframes hb-fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes hb-grow{from{width:0!important}}
@keyframes hb-grow-y{from{height:0!important}}
@media (max-width:900px){
  .hb-hero{grid-template-columns:minmax(0,1fr)}
  .hb-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.hb-stats>:last-child{grid-column:1/-1}
  .hb-moves{grid-template-columns:repeat(2,minmax(0,1fr))}
  .hb-two,.hb-three{grid-template-columns:minmax(0,1fr)}
  .hb-stack{flex-direction:row;overflow-x:auto;align-items:flex-start;padding-bottom:10px}
  .hb-stack-item{width:120px;flex:0 0 auto;margin-top:0!important;margin-left:-60px}.hb-stack-item:first-child{margin-left:0}
  .hb-stack:hover .hb-stack-item{margin-top:0}
}
@media (max-width:600px){
  .hb-key{grid-template-columns:minmax(0,1fr);padding:16px}
  .hb-facts{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .hb-search .hb-btn{padding:9px 14px}
}
@media (prefers-reduced-motion:reduce){.hb *{animation:none!important;transition:none!important}}
`;
