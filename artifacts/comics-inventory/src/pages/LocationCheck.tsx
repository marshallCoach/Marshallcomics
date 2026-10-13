import { useState, useMemo } from "react";
import snapshot from "@/data/locationSnapshot.json";
import { CoverImage } from "@/components/CoverImage";

// "Where is it?" — a personal reconciliation widget for books whose Box # is a
// status placeholder (AT CGC / UNKNOWN — needs physical reassignment), from a
// snapshot of the latest xlsx. The xlsx stays the source of truth: this only
// tracks what you've physically confirmed (saved in this browser), so when a
// book turns up, update its real box in the sheet.

interface Row { title: string; issue: string; year: string; volume?: string; box: string; key: boolean; signed: boolean; }
const ROWS = (snapshot.rows as Row[]);
const KEY = "loc_check_v2";
// Where the book actually is, confirmed by walking it down.
type Loc = "home" | "cgc" | "presser" | "unknown";
type Mark = { loc?: Loc; box?: string };
const LOCS: { id: Loc; label: string; color: string }[] = [
  { id: "home",    label: "Home",          color: "#16a34a" },
  { id: "cgc",     label: "At CGC",        color: "#1d6fa4" },
  { id: "presser", label: "At the presser", color: "#b4690e" },
  { id: "unknown", label: "Not known",     color: "#c0392b" },
];

const isCGC = (b: string) => b.toUpperCase().startsWith("AT ");
const GROUPS = [
  { test: isCGC, title: "At CGC", tag: "out for grading" },
  { test: (b: string) => !isCGC(b), title: "Unknown — needs physical reassignment", tag: "location lost" },
];

// Title → Volume → Issue grouping helpers (mirror the Cover Review page).
const norm = (v: unknown) => String(v ?? "").trim();
const volOf = (r: Row) => norm(r.volume) || "1";
const volNum = (r: Row) => parseInt(volOf(r), 10) || 0;
const issueNum = (v: unknown) => { const m = String(v ?? "").match(/[\d.]+/); return m ? parseFloat(m[0]) : Number.POSITIVE_INFINITY; };

export default function LocationCheck() {
  const [marks, setMarks] = useState<Record<string, Mark>>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; }
  });
  const [filter, setFilter] = useState<"all" | "todo" | "done">("all");
  // The big "Unknown — needs reassignment" pile is hidden by default; toggle to show it.
  const [showUnknown, setShowUnknown] = useState(false);

  const save = (next: Record<string, Mark>) => {
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setMarks(next);
  };
  const setLoc = (id: string, loc: Loc) => {
    const cur = marks[id]?.loc;
    save({ ...marks, [id]: { ...marks[id], loc: cur === loc ? undefined : loc } });
  };
  const setBox = (id: string, box: string) => save({ ...marks, [id]: { ...marks[id], box } });
  const reset = () => save({});

  const counts = useMemo(() => {
    const c: Record<Loc, number> = { home: 0, cgc: 0, presser: 0, unknown: 0 };
    for (const m of Object.values(marks)) if (m.loc) c[m.loc]++;
    return c;
  }, [marks]);
  const handled = useMemo(() => Object.values(marks).filter(m => m.loc).length, [marks]);
  const pct = ROWS.length ? Math.round((handled / ROWS.length) * 100) : 0;

  return (
    <div className="locw">
      <style>{css}</style>

      <header className="locw-hero">
        <div className="locw-kicker">Inventory reconciliation</div>
        <h1>Where is it?</h1>
        <p className="locw-sub">Every book whose Box # is a placeholder — <b>at CGC</b> or <b>unknown</b> — from the latest sheet, grouped by title and volume. Walk your boxes and tag each one: <b>Home</b> (note the box), <b>At CGC</b>, <b>At the presser</b>, or <b>Not known</b>. Saved in this browser.</p>
      </header>

      <div className="locw-note">
        Heads up — your sheet flags only <b>one</b> book as at CGC (Avengers Annual #2, Roy Thomas SS). The other {ROWS.length - 1} are <b>UNKNOWN — needs physical reassignment</b> (lost location, not CGC). <b>Wolverine #8 is not in this list</b> — the sheet still has it in Box 106, so update that when it's back from grading.
      </div>

      <div className="locw-hud">
        <div className="locw-row">
          <div className="locw-stat"><span className="lbl">Home</span><span className="val" style={{ color: "#16a34a" }}>{counts.home}</span></div>
          <div className="locw-stat"><span className="lbl">At CGC</span><span className="val" style={{ color: "#1d6fa4" }}>{counts.cgc}</span></div>
          <div className="locw-stat"><span className="lbl">Presser</span><span className="val" style={{ color: "#b4690e" }}>{counts.presser}</span></div>
          <div className="locw-stat"><span className="lbl">Not known</span><span className="val bad">{counts.unknown}</span></div>
          <div className="locw-stat"><span className="lbl">To confirm</span><span className="val">{ROWS.length}</span></div>
          <div className="locw-filters">
            {(["all", "todo", "done"] as const).map(f => (
              <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "todo" ? "To do" : "Handled"}
              </button>
            ))}
            <button className={showUnknown ? "on" : ""} onClick={() => setShowUnknown(s => !s)}>
              {showUnknown ? "Hide unknown" : "Show unknown"}
            </button>
            <button className="locw-reset" onClick={reset}>Reset</button>
          </div>
        </div>
        <div className="locw-bar"><i style={{ width: pct + "%" }} /></div>
      </div>

      {GROUPS.map(g => {
        if (g.title.startsWith("Unknown") && !showUnknown) return null;
        // Keep the ORIGINAL ROWS index as the stable mark id, so saved
        // confirmations survive the regrouping.
        const items = ROWS.map((r, i) => ({ r, i })).filter(x => g.test(x.r.box));
        const shown = items.filter(({ i }) => {
          const done = !!marks["r" + i]?.loc;
          return filter === "all" ? true : filter === "todo" ? !done : done;
        });
        if (!items.length) return null;

        // Sort Title A→Z, Volume asc, Issue asc; then group Title → Volume.
        const sorted = [...shown].sort((a, b) =>
          norm(a.r.title).toLowerCase().localeCompare(norm(b.r.title).toLowerCase()) ||
          (volNum(a.r) - volNum(b.r)) ||
          (issueNum(a.r.issue) - issueNum(b.r.issue)));
        const byTitle = new Map<string, Map<string, { r: Row; i: number }[]>>();
        for (const it of sorted) {
          const t = norm(it.r.title) || "—", v = volOf(it.r);
          if (!byTitle.has(t)) byTitle.set(t, new Map());
          const vmap = byTitle.get(t)!;
          if (!vmap.has(v)) vmap.set(v, []);
          vmap.get(v)!.push(it);
        }
        const titles = [...byTitle.entries()].map(([title, vmap]) => ({
          title,
          total: [...vmap.values()].reduce((s, a) => s + a.length, 0),
          vols: [...vmap.entries()].map(([vol, list]) => ({ vol, list })),
        }));

        return (
          <section key={g.title} className="locw-section">
            <div className="locw-sechead">
              <h2>{g.title}</h2><span className="locw-tag">{g.tag} · {items.length}</span>
            </div>
            {shown.length === 0
              ? <p className="locw-empty">Nothing here under this filter.</p>
              : titles.map(tg => (
                  <div key={tg.title} className="locw-tgroup">
                    <div className="locw-thead">{tg.title.toUpperCase()} <span>· {tg.total} book{tg.total === 1 ? "" : "s"}</span></div>
                    {tg.vols.map(vg => (
                      <div key={vg.vol} className="locw-vgroup">
                        <div className="locw-vhead">VOLUME {vg.vol} · {vg.list.length} issue{vg.list.length === 1 ? "" : "s"}</div>
                        <div className="locw-grid">
                          {vg.list.map(({ r, i }) => {
                            const id = "r" + i;
                            const m = marks[id]; const loc = m?.loc;
                            return (
                              <div key={id} className={`locw-card ${loc ? "loc-" + loc : ""}`}>
                                <CoverImage comic={{ Title: r.title, Issue: r.issue, Year: r.year }} width={150} height={225} />
                                <div className="locw-book">
                                  <span className="bt">{r.title} <b>#{r.issue || "—"}</b></span>
                                  <span className="by">{r.year}{r.key ? " · ★ key" : ""}{r.signed ? " · ✍ signed" : ""}</span>
                                </div>
                                <div className="locw-opts">
                                  {LOCS.map(o => (
                                    <button key={o.id}
                                      className={`locw-opt ${loc === o.id ? "on" : ""}`}
                                      style={loc === o.id ? { background: o.color, borderColor: o.color, color: "#fff" } : undefined}
                                      onClick={() => setLoc(id, o.id)}>
                                      {o.label}
                                    </button>
                                  ))}
                                </div>
                                {loc === "home" && (
                                  <input className="locw-box" placeholder="found in box…" value={m?.box || ""}
                                    onChange={e => setBox(id, e.target.value)} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
          </section>
        );
      })}

      <p className="locw-foot">Snapshot from <b>{snapshot.source}</b> ({snapshot.capturedAt}). This widget tracks your physical confirmation only — it does not change the sheet. When a book turns up, set its real box in the xlsx and re-run the pipeline; ask me to refresh this snapshot anytime.</p>
    </div>
  );
}

const css = `
.locw{max-width:calc(1040px + var(--wide));margin:0 auto;padding:0 18px 60px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--text)}
.locw h1,.locw h2{margin:0;text-wrap:balance}
.locw-hero{padding:26px 0 14px;border-bottom:3px solid var(--text)}
.locw-kicker{font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);font-weight:700;margin-bottom:6px}
.locw-hero h1{font-size:clamp(2rem,6vw,3rem);line-height:.95;font-weight:800}
.locw-sub{margin-top:9px;max-width:64ch;color:var(--muted2);font-size:1rem;line-height:1.5}
.locw-note{margin-top:16px;border:1.5px solid var(--border);border-left:5px solid var(--gold);border-radius:10px;background:var(--surface);padding:12px 15px;font-size:.9rem;line-height:1.5}
.locw-hud{position:sticky;top:0;z-index:5;background:var(--surface);border:2px solid var(--text);border-radius:14px;margin-top:16px;padding:13px 15px;display:flex;flex-direction:column;gap:10px;box-shadow:0 6px 20px rgba(0,0,0,.13)}
.locw-row{display:flex;flex-wrap:wrap;gap:14px 20px;align-items:center}
.locw-stat{display:flex;flex-direction:column}
.locw-stat .lbl{font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:700}
.locw-stat .val{font-size:1.7rem;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}
.locw-stat .val.ok{color:#16a34a}.locw-stat .val.bad{color:var(--red)}
.locw-filters{margin-left:auto;display:flex;gap:5px;flex-wrap:wrap}
.locw-filters button{background:var(--surface2);border:1px solid var(--border);color:var(--muted2);border-radius:7px;padding:5px 11px;font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
.locw-filters button.on{background:var(--red);color:#fff;border-color:var(--red)}
.locw-reset{background:none;border:1px solid var(--border);color:var(--muted);border-radius:7px;padding:5px 11px;font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
.locw-bar{height:11px;border-radius:99px;background:var(--surface2);border:1px solid var(--border);overflow:hidden}
.locw-bar>i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),#16a34a);transition:width .4s}
.locw-section{margin-top:26px}
.locw-sechead{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;border-bottom:2px solid var(--border);padding-bottom:7px;margin-bottom:12px}
.locw-sechead h2{font-size:1.3rem;font-weight:800}
.locw-tag{font-size:.64rem;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--muted);background:var(--surface2);border:1px solid var(--border);border-radius:99px;padding:3px 9px}
.locw-empty{color:var(--muted);font-size:.9rem;padding:6px 2px}
/* Title / Volume page-breaking rules */
.locw-tgroup{margin-bottom:30px}
.locw-thead{font-size:1.05rem;font-weight:800;letter-spacing:1.5px;color:var(--text);border-bottom:2px solid var(--border);padding-bottom:6px;margin-bottom:12px}
.locw-thead span{font-weight:600;letter-spacing:.5px;color:var(--muted)}
.locw-vgroup{margin-bottom:18px}
.locw-vhead{font-size:.82rem;font-weight:700;letter-spacing:1.2px;color:var(--muted2);margin-bottom:10px}
/* Larger cover cards in a responsive grid */
.locw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:14px}
.locw-card{display:flex;flex-direction:column;gap:9px;background:var(--surface);border:1.5px solid var(--border);border-top:4px solid var(--border);border-radius:12px;padding:12px}
.locw-card.loc-home{border-top-color:#16a34a;background:rgba(22,163,74,.06)}
.locw-card.loc-cgc{border-top-color:#1d6fa4;background:rgba(29,111,164,.06)}
.locw-card.loc-presser{border-top-color:#b4690e;background:rgba(180,105,14,.06)}
.locw-card.loc-unknown{border-top-color:var(--red);background:rgba(200,16,46,.05)}
.locw-card img{width:150px;height:225px;object-fit:cover;border-radius:6px;align-self:center;background:#1a1628;box-shadow:0 3px 10px rgba(0,0,0,.22)}
.locw-book{display:flex;flex-direction:column;min-width:0}
.locw-book .bt{font-size:.98rem;line-height:1.2}
.locw-book .by{font-size:.76rem;color:var(--muted);margin-top:2px}
.locw-opts{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.locw-opt{background:var(--surface2);border:1.5px solid var(--border);color:var(--muted2);border-radius:8px;padding:6px 8px;font-size:.74rem;font-weight:700;cursor:pointer;white-space:nowrap;text-align:center}
.locw-box{width:100%;background:var(--bg);border:1.5px solid var(--border);color:var(--text);border-radius:7px;padding:6px 9px;font-size:.84rem}
.locw-foot{margin-top:26px;border-top:1px solid var(--border);padding-top:13px;color:var(--muted);font-size:.78rem;line-height:1.5}
@media(max-width:520px){.locw-grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}.locw-card img{width:112px;height:168px}}
`;
