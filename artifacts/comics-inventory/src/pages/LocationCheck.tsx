import { useState, useMemo } from "react";
import snapshot from "@/data/locationSnapshot.json";

// "Where is it?" — a personal reconciliation widget for books whose Box # is a
// status placeholder (AT CGC / UNKNOWN — needs physical reassignment), from a
// snapshot of the latest xlsx. The xlsx stays the source of truth: this only
// tracks what you've physically confirmed (saved in this browser), so when a
// book turns up, update its real box in the sheet.

interface Row { title: string; issue: string; year: string; box: string; key: boolean; signed: boolean; }
const ROWS = (snapshot.rows as Row[]);
const KEY = "loc_check_v1";
type Mark = { s: 0 | 1 | 2; box?: string }; // 0 to-do · 1 located · 2 still missing

const isCGC = (b: string) => b.toUpperCase().startsWith("AT ");
const GROUPS = [
  { test: isCGC, title: "At CGC", tag: "out for grading" },
  { test: (b: string) => !isCGC(b), title: "Unknown — needs physical reassignment", tag: "location lost" },
];

export default function LocationCheck() {
  const [marks, setMarks] = useState<Record<string, Mark>>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; }
  });
  const [filter, setFilter] = useState<"all" | "todo" | "done">("all");

  const save = (next: Record<string, Mark>) => {
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setMarks(next);
  };
  const cycle = (id: string) => {
    const cur = marks[id]?.s ?? 0;
    const next = { ...marks, [id]: { ...marks[id], s: (((cur + 1) % 3) as 0 | 1 | 2) } };
    save(next);
  };
  const setBox = (id: string, box: string) => save({ ...marks, [id]: { ...marks[id], s: marks[id]?.s ?? 1, box } });
  const reset = () => save({});

  const located = useMemo(() => Object.values(marks).filter(m => m.s === 1).length, [marks]);
  const missing = useMemo(() => Object.values(marks).filter(m => m.s === 2).length, [marks]);
  const pct = ROWS.length ? Math.round((located / ROWS.length) * 100) : 0;

  const label = (s: number) => s === 1 ? "✓ Located" : s === 2 ? "⚠ Still missing" : "Confirm";

  return (
    <div className="locw">
      <style>{css}</style>

      <header className="locw-hero">
        <div className="locw-kicker">Inventory reconciliation</div>
        <h1>Where is it?</h1>
        <p className="locw-sub">Every book whose Box # is a placeholder — <b>at CGC</b> or <b>unknown</b> — from the latest sheet. Walk your boxes, cycle each one to <b>Located</b> (and note the box), or flag it <b>Still missing</b>. Saved in this browser.</p>
      </header>

      <div className="locw-note">
        Heads up — your sheet flags only <b>one</b> book as at CGC (Avengers Annual #2, Roy Thomas SS). The other {ROWS.length - 1} are <b>UNKNOWN — needs physical reassignment</b> (lost location, not CGC). <b>Wolverine #8 is not in this list</b> — the sheet still has it in Box 106, so update that when it's back from grading.
      </div>

      <div className="locw-hud">
        <div className="locw-row">
          <div className="locw-stat"><span className="lbl">Located</span><span className="val ok">{located}</span></div>
          <div className="locw-stat"><span className="lbl">Still missing</span><span className="val bad">{missing}</span></div>
          <div className="locw-stat"><span className="lbl">Total to confirm</span><span className="val">{ROWS.length}</span></div>
          <div className="locw-filters">
            {(["all", "todo", "done"] as const).map(f => (
              <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "todo" ? "To do" : "Handled"}
              </button>
            ))}
            <button className="locw-reset" onClick={reset}>Reset</button>
          </div>
        </div>
        <div className="locw-bar"><i style={{ width: pct + "%" }} /></div>
      </div>

      {GROUPS.map(g => {
        const items = ROWS.map((r, i) => ({ r, i })).filter(x => g.test(x.r.box));
        const shown = items.filter(({ i }) => {
          const s = marks["r" + i]?.s ?? 0;
          return filter === "all" ? true : filter === "todo" ? s === 0 : s !== 0;
        });
        if (!items.length) return null;
        return (
          <section key={g.title} className="locw-section">
            <div className="locw-sechead">
              <h2>{g.title}</h2><span className="locw-tag">{g.tag} · {items.length}</span>
            </div>
            {shown.length === 0
              ? <p className="locw-empty">Nothing here under this filter.</p>
              : <div className="locw-list">
                  {shown.map(({ r, i }) => {
                    const id = "r" + i;
                    const m = marks[id]; const s = m?.s ?? 0;
                    return (
                      <div key={id} className={`locw-item s${s}`}>
                        <div className="locw-book">
                          <span className="bt">{r.title} <b>#{r.issue || "—"}</b></span>
                          <span className="by">{r.year}{r.key ? " · ★ key" : ""}{r.signed ? " · ✍ signed" : ""}</span>
                        </div>
                        {s === 1 && (
                          <input className="locw-box" placeholder="found in box…" value={m?.box || ""}
                            onChange={e => setBox(id, e.target.value)} />
                        )}
                        <button className="locw-mark" onClick={() => cycle(id)}>{label(s)}</button>
                      </div>
                    );
                  })}
                </div>}
          </section>
        );
      })}

      <p className="locw-foot">Snapshot from <b>{snapshot.source}</b> ({snapshot.capturedAt}). This widget tracks your physical confirmation only — it does not change the sheet. When a book turns up, set its real box in the xlsx and re-run the pipeline; ask me to refresh this snapshot anytime.</p>
    </div>
  );
}

const css = `
.locw{max-width:960px;margin:0 auto;padding:0 18px 60px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--text)}
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
.locw-list{display:flex;flex-direction:column;gap:7px}
.locw-item{display:flex;align-items:center;gap:10px;background:var(--surface);border:1.5px solid var(--border);border-left:4px solid var(--border);border-radius:10px;padding:9px 12px}
.locw-item.s1{border-left-color:#16a34a;background:rgba(22,163,74,.06)}
.locw-item.s2{border-left-color:var(--red);background:rgba(200,16,46,.05)}
.locw-book{display:flex;flex-direction:column;min-width:0;flex:1}
.locw-book .bt{font-size:.95rem;line-height:1.2}
.locw-book .by{font-size:.74rem;color:var(--muted)}
.locw-box{width:120px;flex-shrink:0;background:var(--bg);border:1.5px solid var(--border);color:var(--text);border-radius:7px;padding:5px 8px;font-size:.82rem}
.locw-mark{flex-shrink:0;min-width:116px;text-align:center;background:var(--surface2);border:1.5px solid var(--border);color:var(--text2);border-radius:8px;padding:6px 10px;font-size:.74rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;cursor:pointer}
.locw-item.s1 .locw-mark{background:rgba(22,163,74,.14);border-color:#16a34a;color:#16a34a}
.locw-item.s2 .locw-mark{background:rgba(200,16,46,.12);border-color:var(--red);color:var(--red)}
.locw-foot{margin-top:26px;border-top:1px solid var(--border);padding-top:13px;color:var(--muted);font-size:.78rem;line-height:1.5}
@media(max-width:520px){.locw-item{flex-wrap:wrap}.locw-box{width:100%}.locw-mark{flex:1}}
`;
