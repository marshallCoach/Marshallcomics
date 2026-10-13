import { useMemo, useState, useEffect } from "react";
import { DATA } from "@/data/data";

// Adi Granov cover checklist. Ownership + cover-artist confirmation are read
// LIVE from the inventory (never asserted). Books you don't own are shown as
// placeholders and marked unverified — their Granov attribution comes from
// Robert's source checklists (keycollectorcomics / comicbookinvest / freshcomics
// / comicartfans), NOT independently confirmed here, and no cover image is
// fabricated. Owned covers come from covers.json.
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const comics = DATA.comics as Array<{ Title?: string; Issue?: string; Volume?: string; Box?: string; Cover_Artist?: string; Publisher?: string }>;

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
const normIss = (s: unknown) => norm(s).replace(/^#/, "").replace(/\.0$/, "");

interface Entry { title: string; vol: string; issues: string[]; note?: string; }
interface Group { heading: string; sub: string; entries: Entry[]; }

// Faithful to Robert's two lists. Issue strings only.
const GROUPS: Group[] = [
  {
    heading: "In your collection — box-tagged",
    sub: "The Granov covers you listed as owned, with their boxes. Owned issues are confirmed live against the inventory and highlighted.",
    entries: [
      { title: "Iron Man", vol: "1", issues: ["2", "5", "6", "8", "9", "10", "11", "12", "13", "14", "15"], note: "Box 13 · classic Granov painted covers" },
      { title: "Iron Man: Viva Las Vegas", vol: "1", issues: ["1", "2"], note: "Box 13 · Favreau collaboration" },
      { title: "Captain America: Living Legend", vol: "1", issues: ["1", "2", "3", "4"], note: "Box 10 · complete miniseries" },
      { title: "Tony Stark: Iron Man", vol: "1", issues: ["1"], note: "Box 13 · modern armor showcase" },
      { title: "The Will of Doom", vol: "1", issues: ["1"], note: "Box CC2 · high-demand variant" },
      { title: "Fantastic Four", vol: "3", issues: ["538", "539", "540", "541", "543"], note: "Boxes 4 & 75 · Civil War era" },
      { title: "X-Men", vol: "6", issues: ["1", "2", "4", "5", "6", "20", "21", "22"], note: "Boxes 3, 12 & CC4 · variant contributions" },
      { title: "Nova", vol: "4", issues: ["2", "3"], note: "Box 28" },
      { title: "Nova", vol: "5", issues: ["10"], note: "Box 28" },
      { title: "Nova", vol: "8", issues: ["6"], note: "Box 17" },
      { title: "New Avengers", vol: "1", issues: ["24"], note: "Box 87" },
      { title: "Secret Avengers", vol: "1", issues: ["15"], note: "Box 6" },
      { title: "Original Sin: Hulk vs. Iron Man", vol: "1", issues: ["1"], note: "Box 19" },
      { title: "Quest of the Mutants: X-Men #2", vol: "3", issues: ["2"], note: "Box 12" },
    ],
  },
  {
    heading: "Granov cover checklist — from your sources",
    sub: "Attributions per your source links (keycollectorcomics, comicbookinvest, freshcomics, comicartfans) — NOT independently verified here. Owned ones still highlight; the rest are leads to confirm.",
    entries: [
      { title: "Iron Man", vol: "4", issues: ["1", "2", "3", "4", "5", "6"], note: "\"Extremis\" — Extremis armor debuts #5" },
      { title: "Iron Man 2: Public Identity", vol: "1", issues: ["1", "2", "3"], note: "MCU tie-in" },
      { title: "Iron Man", vol: "5", issues: ["1"], note: "1:50 variant" },
      { title: "Marvel's Iron Man 3 Prelude", vol: "1", issues: ["1"], note: "Regal Cinemas exclusive variant" },
      { title: "Amazing Spider-Man", vol: "6", issues: ["52"], note: "1:25 variant, 2024" },
      { title: "Deadpool", vol: "6", issues: ["13"], note: "Marvels 25th Anniversary variant" },
      { title: "Daredevil", vol: "7", issues: ["3"], note: "1:25 variant, 2023" },
      { title: "Moon Knight", vol: "7", issues: ["1"], note: "1:50 variant" },
      { title: "Uncanny X-Men", vol: "1", issues: ["524"], note: "painted finish" },
      { title: "X-Men Gold", vol: "2", issues: ["30"], note: "wedding issue variant" },
      { title: "Thor: Son of Asgard", vol: "1", issues: ["1"], note: "early cover work" },
      { title: "She-Hulk", vol: "1", issues: ["1"], note: "2004" },
      { title: "Necrowar", vol: "1", issues: ["1"], note: "one of his earliest covers" },
      { title: "Marvel Comics Presents", vol: "1", issues: ["1"], note: "anthology cover" },
      { title: "Miracleman", vol: "1", issues: ["9"], note: "painted take" },
      { title: "Wade Wilson: Deadpool", vol: "1", issues: ["1"], note: "standard & virgin variants, 2026" },
      { title: "Avengers: Armageddon", vol: "1", issues: ["2"], note: "2026 ensemble cover" },
      { title: "Captain Marvel", vol: "1", issues: ["1"], note: "1:25 variant" },
      { title: "Invincible Iron Man", vol: "1", issues: ["1"], note: "variant" },
      { title: "Marvel's The Avengers: Black Widow Strikes", vol: "1", issues: ["2"], note: "tie-in cover" },
    ],
  },
];

const pubClass = (t: string) => /x-men|cable|miracleman|deadpool|wade wilson/i.test(t) ? "mv" : "mv";

export default function AdiGranov() {
  const [covers, setCovers] = useState<Record<string, { url: string | null }>>({});
  const [ownedOnly, setOwnedOnly] = useState(false);
  useEffect(() => {
    let off = false;
    fetch(`${BASE}/covers.json`).then(r => r.ok ? r.json() : {}).then(m => { if (!off) setCovers(m); }).catch(() => {});
    return () => { off = true; };
  }, []);

  // owned index: title|vol|issue and title|issue -> {box, coverArtist}
  const ownedIdx = useMemo(() => {
    const m = new Map<string, { box: string; ca: string }>();
    for (const c of comics) {
      const t = norm(c.Title), v = norm(c.Volume || "1"), i = normIss(c.Issue);
      const rec = { box: String(c.Box || "?"), ca: String(c.Cover_Artist || "") };
      m.set(`${t}|${v}|${i}`, rec);
      if (!m.has(`${t}|${i}`)) m.set(`${t}|${i}`, rec);
    }
    return m;
  }, []);

  const look = (title: string, vol: string, iss: string) =>
    ownedIdx.get(`${norm(title)}|${norm(vol)}|${normIss(iss)}`) || ownedIdx.get(`${norm(title)}|${normIss(iss)}`) || null;
  const coverUrl = (title: string, vol: string, iss: string) =>
    covers[`${title}|||${normIss(iss)}|||${vol}`]?.url || covers[`${title}|||${normIss(iss)}`]?.url || null;

  const stats = useMemo(() => {
    let total = 0, owned = 0, confirmed = 0;
    for (const g of GROUPS) for (const e of g.entries) for (const iss of e.issues) {
      total++;
      const o = look(e.title, e.vol, iss);
      if (o) { owned++; if (/granov/i.test(o.ca)) confirmed++; }
    }
    return { total, owned, confirmed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownedIdx]);

  return (
    <div className="ag">
      <style>{CSS}</style>
      <header className="ag-hero">
        <div className="ag-kicker">Cover artist spotlight</div>
        <h1>Adi Granov</h1>
        <p className="ag-sub">Granov cover checklist. Books you own are highlighted with your real cover; a ✓ means <b>your inventory’s Cover Artist field confirms Granov</b>. Checklist books you don’t own are placeholders — their attribution is from your source links and is <b>not independently verified here</b>.</p>
      </header>

      <div className="ag-hud">
        <div className="ag-stat"><span className="l">Checklist issues</span><span className="v">{stats.total}</span></div>
        <div className="ag-stat"><span className="l">You own</span><span className="v ok">{stats.owned}</span></div>
        <div className="ag-stat"><span className="l">Granov-confirmed (your data)</span><span className="v ok">{stats.confirmed}</span></div>
        <button className={`ag-toggle ${ownedOnly ? "on" : ""}`} onClick={() => setOwnedOnly(o => !o)}>{ownedOnly ? "Showing owned" : "Show owned only"}</button>
      </div>

      {GROUPS.map(g => (
        <section key={g.heading} className="ag-section">
          <div className="ag-sechead"><h2>{g.heading}</h2><p className="ag-secsub">{g.sub}</p></div>
          {g.entries.map(e => {
            const cards = e.issues.map(iss => {
              const o = look(e.title, e.vol, iss);
              const conf = !!o && /granov/i.test(o.ca);
              // Pull a cover from covers.json whether or not it's owned — the
              // json holds covers for books beyond the collection.
              return { iss, owned: !!o, conf, box: o?.box, url: coverUrl(e.title, e.vol, iss) };
            }).filter(c => !ownedOnly || c.owned);
            if (!cards.length) return null;
            return (
              <div key={e.title + e.vol} className="ag-title">
                <div className="ag-tl">{e.title} <span className="ag-vol">Vol {e.vol}</span>{e.note && <span className="ag-note"> · {e.note}</span>}</div>
                <div className="ag-grid">
                  {cards.map(c => (
                    <div key={c.iss} className={`ag-card ${c.owned ? "owned" : "missing"}`} title={c.owned ? (c.conf ? "Owned · Granov confirmed in your data" : "Owned · cover artist not logged as Granov") : "Not in your collection"}>
                      <div className={`ag-cov ${pubClass(e.title)}`}>
                        {c.url
                          ? <img src={c.url} alt={`${e.title} #${c.iss}`} loading="lazy" onError={ev => { (ev.currentTarget as HTMLImageElement).style.display = "none"; }} />
                          : <span className="ag-ph">#{c.iss}</span>}
                        {c.owned && <span className="ag-badge">{c.conf ? "✓" : "●"}</span>}
                      </div>
                      <div className="ag-cap">#{c.iss}{c.owned ? <span className="ag-box">📦 {c.box}</span> : <span className="ag-miss">not owned</span>}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ))}

      <p className="ag-foot">✓ = Granov confirmed by your inventory’s Cover Artist field. ● = you own the issue but the field doesn’t say Granov (likely a variant logged under the standard artist — worth checking). Placeholders = not owned; attribution per your source checklists, not verified here, and no cover image is fabricated. Ask me to source real covers for the not-owned via the cover pipeline.</p>
    </div>
  );
}

const CSS = `
.ag{max-width:calc(1080px + var(--wide));margin:0 auto;padding:0 18px 60px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--text)}
.ag-hero{padding:24px 0 14px;border-bottom:3px solid var(--text)}
.ag-kicker{font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);font-weight:700;margin-bottom:6px}
.ag-hero h1{margin:0;font-size:clamp(2.1rem,7vw,3.4rem);line-height:.95}
.ag-sub{margin-top:9px;max-width:66ch;color:var(--muted2);font-size:.95rem;line-height:1.5}
.ag-hud{position:sticky;top:0;z-index:5;background:var(--surface);border:2px solid var(--text);border-radius:14px;margin-top:16px;padding:13px 16px;display:flex;gap:18px;align-items:center;flex-wrap:wrap;box-shadow:0 6px 20px rgba(0,0,0,.13)}
.ag-stat{display:flex;flex-direction:column}
.ag-stat .l{font-size:.62rem;letter-spacing:.11em;text-transform:uppercase;color:var(--muted);font-weight:700}
.ag-stat .v{font-size:1.7rem;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}
.ag-stat .v.ok{color:#16a34a}
.ag-toggle{margin-left:auto;background:var(--surface2);border:1px solid var(--border);color:var(--muted2);border-radius:8px;padding:8px 13px;font-size:.78rem;font-weight:700;cursor:pointer}
.ag-toggle.on{background:var(--red);border-color:var(--red);color:#fff}
.ag-section{margin-top:28px}
.ag-sechead{border-bottom:2px solid var(--border);padding-bottom:7px;margin-bottom:14px}
.ag-sechead h2{margin:0;font-size:1.35rem}
.ag-secsub{margin:4px 0 0;color:var(--muted2);font-size:.86rem;line-height:1.45;max-width:72ch}
.ag-title{margin-bottom:18px}
.ag-tl{font-size:1rem;font-weight:800;margin-bottom:8px}
.ag-vol{font-size:.74rem;color:var(--muted);font-weight:700}
.ag-note{font-size:.78rem;color:var(--muted);font-weight:500}
.ag-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px}
.ag-card{border-radius:10px;overflow:hidden;border:1.5px solid var(--border);background:var(--surface)}
.ag-card.owned{border-color:#16a34a;box-shadow:0 0 0 2px rgba(22,163,74,.3)}
.ag-card.missing{opacity:.55}
.ag-cov{position:relative;width:100%;aspect-ratio:2/3;background:linear-gradient(160deg,#e23048,#9c0c23);display:flex;align-items:center;justify-content:center;overflow:hidden}
.ag-cov img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.ag-ph{color:#fff;font-size:1.3rem;font-weight:800;opacity:.85}
.ag-badge{position:absolute;top:6px;right:6px;z-index:2;width:22px;height:22px;border-radius:6px;background:#16a34a;color:#fff;font-weight:800;font-size:.8rem;display:flex;align-items:center;justify-content:center;border:2px solid #fff}
.ag-cap{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:7px 9px;font-size:.82rem;font-weight:700}
.ag-box{font-size:.68rem;color:var(--muted2);font-weight:700}
.ag-miss{font-size:.66rem;color:var(--muted);font-weight:600}
.ag-foot{margin-top:26px;border-top:1px solid var(--border);padding-top:13px;color:var(--muted);font-size:.78rem;line-height:1.55}
@media(max-width:480px){.ag{padding:0 14px 60px}.ag-grid{grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:9px}}
`;
