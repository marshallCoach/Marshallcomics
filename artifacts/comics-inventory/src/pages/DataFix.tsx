import { useState, useMemo, useCallback } from "react";
import { DATA, type Comic } from "@/data/data";
import { CoverImage, CoverModal, fmtPubDate } from "@/components/CoverImage";

// ── Data-cleanup spot-check ──────────────────────────────────────────────────
// Surfaces every comic with a fixable data problem, grouped by problem →
// publisher → year. Each card offers a Fandom link or a one-tap suggested fix;
// resolving hides the comic and feeds an export the pipeline consumes. Built to
// be a daily driver — progress ring, category chips, and a streak for momentum.
const comics = DATA.comics;

const LS_FIXES = "brbDataFixes_v1";     // id -> resolution record
const LS_META  = "brbDataFixMeta_v1";   // { lastDate, streak, todayCount }

type FixKind = "fandom" | "solution";
interface FixRecord { id: string; title: string; issue: string; box: string; problem: string; kind: FixKind; value: string; at: string; }
type ProblemId = "no-date" | "date-conflict" | "no-volume" | "no-year";

const PROBLEMS: { id: ProblemId; label: string; blurb: string; color: string; solutions: { key: string; label: string }[] }[] = [
  { id: "no-date",       label: "Missing publication date", blurb: "Not matched in GCD/Comic Vine — no on-sale date", color: "#c8102e",
    solutions: [{ key: "cv", label: "Try Comic Vine next run" }, { key: "no-entry", label: "No catalogue entry — accept blank" }] },
  { id: "date-conflict", label: "Date conflicts with Year",  blurb: "On-sale date disagrees with the Year field", color: "#b45309",
    solutions: [{ key: "trust-gcd", label: "Trust the on-sale date" }, { key: "trust-year", label: "Trust my Year" }] },
  { id: "no-volume",     label: "Missing volume",            blurb: "No volume number recorded", color: "#7c3aed",
    solutions: [{ key: "vol1", label: "It's Volume 1" }, { key: "research", label: "Needs research" }] },
  { id: "no-year",       label: "Missing / bad year",        blurb: "Year is blank or not a 4-digit year", color: "#0e7490",
    solutions: [{ key: "research", label: "Needs research" }] },
];
const PROBLEM_MAP = Object.fromEntries(PROBLEMS.map(p => [p.id, p]));

function comicId(c: Comic): string {
  return `${(c.Title ?? "").trim()}|||${String(c.Issue ?? "").trim()}|||${(c.Box ?? "").trim()}`;
}
function problemsFor(c: Comic): ProblemId[] {
  const out: ProblemId[] = [];
  const pd = (c as { Pub_Date?: string }).Pub_Date || "";
  const yr = (c.Year || "").trim();
  const pdY = /^(\d{4})/.exec(pd)?.[1];
  if (!pd) out.push("no-date");
  else if (pdY && /^\d{4}$/.test(yr) && Math.abs(+pdY - +yr) > 1) out.push("date-conflict");
  if (!(c.Volume || "").trim()) out.push("no-volume");
  if (!/^\d{4}$/.test(yr)) out.push("no-year");
  return out;
}
function loadFixes(): Map<string, FixRecord> {
  try { return new Map(Object.entries(JSON.parse(localStorage.getItem(LS_FIXES) || "{}"))); }
  catch { return new Map(); }
}
function saveFixes(m: Map<string, FixRecord>) {
  const o: Record<string, FixRecord> = {}; m.forEach((v, k) => { o[k] = v; });
  localStorage.setItem(LS_FIXES, JSON.stringify(o));
}
interface Meta { lastDate: string; streak: number; todayCount: number; }
function loadMeta(): Meta {
  try { return JSON.parse(localStorage.getItem(LS_META) || "") as Meta; }
  catch { return { lastDate: "", streak: 0, todayCount: 0 }; }
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function bumpStreak(): Meta {
  const m = loadMeta(); const today = todayStr();
  if (m.lastDate !== today) {
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    m.streak = m.lastDate === y ? m.streak + 1 : 1;
    m.todayCount = 0; m.lastDate = today;
  }
  m.todayCount += 1;
  localStorage.setItem(LS_META, JSON.stringify(m));
  return m;
}
const yearOf = (c: Comic) => {
  const pd = (c as { Pub_Date?: string }).Pub_Date || "";
  const pdY = /^(\d{4})/.exec(pd)?.[1];
  return pdY || (/^\d{4}$/.test((c.Year || "").trim()) ? c.Year.trim() : "—");
};

export default function DataFix() {
  const [fixes, setFixes] = useState<Map<string, FixRecord>>(() => loadFixes());
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [linkDraft, setLinkDraft] = useState<Record<string, string>>({});
  const [activeProblem, setActiveProblem] = useState<ProblemId | "all">("all");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [coverModal, setCoverModal] = useState<{ comic: Comic; large: string | null } | null>(null);
  const [meta, setMeta] = useState<Meta>(() => loadMeta());
  const [session, setSession] = useState(0);
  const [pop, setPop] = useState(0);

  // All comics that have ≥1 problem (computed once).
  const flagged = useMemo(() => {
    const rows: { c: Comic; id: string; problems: ProblemId[] }[] = [];
    for (const c of comics) {
      const ps = problemsFor(c);
      if (ps.length) rows.push({ c, id: comicId(c), problems: ps });
    }
    return rows;
  }, []);

  const totalProblems = flagged.length;
  const resolvedCount = useMemo(() => flagged.filter(f => fixes.has(f.id)).length, [flagged, fixes]);
  const remaining = totalProblems - resolvedCount;
  const pct = totalProblems ? Math.round((resolvedCount / totalProblems) * 100) : 100;

  // Per-problem remaining counts.
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of flagged) {
      if (fixes.has(f.id)) continue;
      for (const p of f.problems) m[p] = (m[p] || 0) + 1;
    }
    return m;
  }, [flagged, fixes]);

  // Groups: problem → publisher → [comics], only unresolved & matching filter.
  const groups = useMemo(() => {
    const visibleProblems = activeProblem === "all" ? PROBLEMS.map(p => p.id) : [activeProblem];
    return visibleProblems.map(pid => {
      const rows = flagged.filter(f => f.problems.includes(pid) && !fixes.has(f.id));
      const byPub = new Map<string, { c: Comic; id: string }[]>();
      for (const r of rows) {
        const pub = (r.c.Publisher || "—").trim() || "—";
        (byPub.get(pub) ?? byPub.set(pub, []).get(pub)!).push({ c: r.c, id: r.id });
      }
      const pubs = [...byPub.entries()].sort((a, b) => b[1].length - a[1].length).map(([pub, items]) => {
        items.sort((a, b) => (yearOf(a.c)).localeCompare(yearOf(b.c)) || a.c.Title.localeCompare(b.c.Title));
        return { pub, items };
      });
      return { pid, problem: PROBLEM_MAP[pid], count: rows.length, pubs };
    }).filter(g => g.count > 0);
  }, [flagged, fixes, activeProblem]);

  const resolve = useCallback((c: Comic, id: string, problem: ProblemId, kind: FixKind, value: string) => {
    setLeaving(prev => new Set(prev).add(id));
    const rec: FixRecord = { id, title: c.Title, issue: String(c.Issue ?? ""), box: c.Box ?? "", problem, kind, value, at: new Date().toISOString() };
    setTimeout(() => {
      setFixes(prev => { const n = new Map(prev); n.set(id, rec); saveFixes(n); return n; });
      setLeaving(prev => { const n = new Set(prev); n.delete(id); return n; });
    }, 340);
    setMeta(bumpStreak());
    setSession(s => s + 1);
    setPop(p => p + 1);
  }, []);

  const undoAll = useCallback(() => {
    if (!confirm("Clear ALL your data-fix resolutions and show every problem again?")) return;
    localStorage.removeItem(LS_FIXES); setFixes(new Map());
  }, []);

  const exportFixes = useCallback(() => {
    const all = [...fixes.values()];
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `data-fixes-${todayStr()}.json`; a.click();
    URL.revokeObjectURL(url);
  }, [fixes]);

  const fandomSearch = (c: Comic) =>
    `https://www.google.com/search?q=${encodeURIComponent(`${c.Title} ${c.Publisher || ""} #${c.Issue} fandom`)}`;

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "20px 16px 90px" }}>
      <style>{CSS}</style>

      {/* Hero: progress + streak */}
      <div className="df-hero">
        <div className="df-ring" style={{ background: `conic-gradient(#22c55e ${pct * 3.6}deg, var(--surface2) 0deg)` }}>
          <div className="df-ring-in"><span className="df-ring-pct">{pct}%</span><span className="df-ring-lbl">clean</span></div>
        </div>
        <div className="df-hero-mid">
          <h1 className="df-h1">Data Fix</h1>
          <p className="df-sub">Every book with a fixable data problem. Pick a fix or drop a Fandom link — it disappears and feeds the next pipeline run. A little every day keeps the collection honest.</p>
          <div className="df-bar"><div className="df-bar-fill" style={{ width: `${pct}%` }} /></div>
          <div className="df-counts-line">{resolvedCount.toLocaleString()} resolved · <b>{remaining.toLocaleString()}</b> to go</div>
        </div>
        <div className="df-streak">
          <div key={pop} className="df-streak-flame">🔥</div>
          <div className="df-streak-n">{meta.streak}</div>
          <div className="df-streak-lbl">day streak</div>
          <div className="df-today">{meta.todayCount} today{session ? ` · ${session} this session` : ""}</div>
        </div>
      </div>

      {/* Category chips */}
      <div className="df-chips">
        <button className={`df-chip${activeProblem === "all" ? " on" : ""}`} onClick={() => setActiveProblem("all")}>
          All problems <span className="df-chip-n">{remaining.toLocaleString()}</span>
        </button>
        {PROBLEMS.map(p => (
          <button key={p.id} className={`df-chip${activeProblem === p.id ? " on" : ""}`}
            style={{ ["--pc" as string]: p.color }} onClick={() => setActiveProblem(p.id)}>
            {p.label} <span className="df-chip-n" style={{ background: p.color }}>{counts[p.id] || 0}</span>
          </button>
        ))}
        <div className="df-actions">
          <button className="df-export" onClick={exportFixes} disabled={!fixes.size}>⬇ Export {fixes.size ? `(${fixes.size})` : ""}</button>
          <button className="df-reset" onClick={undoAll} disabled={!fixes.size}>Reset</button>
        </div>
      </div>

      {remaining === 0 && (
        <div className="df-clear">🎉 Inbox zero. Every flagged book has been handled. Come back after the next pipeline run.</div>
      )}

      {/* Groups */}
      {groups.map(g => {
        const gopen = openGroups[g.pid] ?? true;
        return (
          <section key={g.pid} className="df-group">
            <button className="df-group-hd" onClick={() => setOpenGroups(o => ({ ...o, [g.pid]: !gopen }))}
              style={{ borderLeft: `4px solid ${g.problem.color}` }}>
              <span className="df-group-name"><span className="df-chev">{gopen ? "▾" : "▸"}</span> {g.problem.label}</span>
              <span className="df-group-meta"><span className="df-group-blurb">{g.problem.blurb}</span> <b style={{ color: g.problem.color }}>{g.count.toLocaleString()}</b></span>
            </button>
            {gopen && g.pubs.map(pg => (
              <div key={pg.pub} className="df-pub">
                <div className="df-pub-hd">{pg.pub} <span className="df-pub-n">{pg.items.length}</span></div>
                <div className="df-grid">
                  {pg.items.map(({ c, id }) => (
                    <div key={id} className={`df-card${leaving.has(id) ? " leaving" : ""}`}>
                      <CoverImage comic={c} width={78} height={117} objectFit="contain"
                        style={{ background: "#0d0d12", border: "1px solid var(--border)" }}
                        onClick={(large) => setCoverModal({ comic: c, large })} />
                      <div className="df-info">
                        <div className="df-title">{c.Title} <span className="df-iss">#{c.Issue}</span></div>
                        <div className="df-metaline">
                          <span className="df-year">{yearOf(c)}</span>
                          {(c as { Pub_Date?: string }).Pub_Date && <span className="df-pd">📅 {fmtPubDate((c as { Pub_Date?: string }).Pub_Date)}</span>}
                          {c.Box && <span className="df-box">📦{c.Box}</span>}
                          {(c.Volume || "").trim() && <span className="df-vol">Vol {c.Volume}</span>}
                        </div>
                        <div className="df-solutions">
                          {g.problem.solutions.map(s => (
                            <button key={s.key} className="df-solve" onClick={() => resolve(c, id, g.pid, "solution", s.key)}>{s.label}</button>
                          ))}
                          <a className="df-find" href={fandomSearch(c)} target="_blank" rel="noopener noreferrer">🔍 Find on Fandom ↗</a>
                        </div>
                        <div className="df-linkrow">
                          <input className="df-link-in" placeholder="Paste Fandom link that fixes it…"
                            value={linkDraft[id] || ""} onChange={e => setLinkDraft(d => ({ ...d, [id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter" && (linkDraft[id] || "").trim()) resolve(c, id, g.pid, "fandom", linkDraft[id].trim()); }} />
                          <button className="df-link-save" disabled={!(linkDraft[id] || "").trim()}
                            onClick={() => resolve(c, id, g.pid, "fandom", (linkDraft[id] || "").trim())}>Save link</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        );
      })}

      {coverModal && <CoverModal comic={coverModal.comic} largeUrl={coverModal.large} onClose={() => setCoverModal(null)} />}
    </div>
  );
}

const CSS = `
.df-hero{display:flex;gap:18px;align-items:center;background:var(--surface,#1a1a22);border:1px solid var(--border,#2c2c38);border-radius:14px;padding:16px 18px;margin-bottom:16px;flex-wrap:wrap}
.df-ring{width:96px;height:96px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .5s ease}
.df-ring-in{width:74px;height:74px;border-radius:50%;background:var(--bg,#111);display:flex;flex-direction:column;align-items:center;justify-content:center}
.df-ring-pct{font-size:1.4rem;font-weight:800;color:var(--text,#eee);font-variant-numeric:tabular-nums;line-height:1}
.df-ring-lbl{font-size:.62rem;letter-spacing:1px;color:var(--muted,#888);text-transform:uppercase}
.df-hero-mid{flex:1;min-width:240px}
.df-h1{margin:0 0 4px;font-size:1.6rem}
.df-sub{color:var(--muted,#888);margin:0 0 10px;font-size:.84rem;line-height:1.45;max-width:60ch}
.df-bar{height:8px;background:var(--surface2,#26262f);border-radius:5px;overflow:hidden}
.df-bar-fill{height:100%;background:linear-gradient(90deg,#22c55e,#16a34a);border-radius:5px;transition:width .5s ease}
.df-counts-line{font-size:.8rem;color:var(--muted2,#bbb);margin-top:6px;font-variant-numeric:tabular-nums}
.df-counts-line b{color:var(--text,#eee)}
.df-streak{display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--surface2,#26262f);border:1px solid var(--border,#2c2c38);border-radius:12px;padding:10px 16px;min-width:96px}
.df-streak-flame{font-size:1.5rem;line-height:1;animation:df-pop .4s ease}
.df-streak-n{font-size:1.5rem;font-weight:800;color:#f59e0b;line-height:1.1;font-variant-numeric:tabular-nums}
.df-streak-lbl{font-size:.62rem;letter-spacing:1px;color:var(--muted,#888);text-transform:uppercase}
.df-today{font-size:.66rem;color:var(--muted2,#bbb);margin-top:4px;text-align:center}
@keyframes df-pop{0%{transform:scale(.4);opacity:.3}60%{transform:scale(1.3)}100%{transform:scale(1)}}
.df-chips{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:18px}
.df-chip{display:inline-flex;align-items:center;gap:7px;font-size:.78rem;font-weight:600;border:1px solid var(--border,#2c2c38);background:var(--surface,#1a1a22);color:var(--muted2,#bbb);border-radius:20px;padding:5px 12px;cursor:pointer;transition:all .15s}
.df-chip:hover{border-color:var(--pc,#888)}
.df-chip.on{background:var(--pc,#333);color:#fff;border-color:var(--pc,#333)}
.df-chip-n{font-size:.68rem;font-weight:800;background:var(--surface2,#26262f);color:#fff;border-radius:10px;padding:1px 7px;font-variant-numeric:tabular-nums}
.df-chip.on .df-chip-n{background:rgba(0,0,0,.25)}
.df-actions{margin-left:auto;display:flex;gap:8px}
.df-export,.df-reset{font-size:.75rem;font-weight:600;border-radius:8px;padding:5px 12px;cursor:pointer;border:1px solid var(--border,#2c2c38);background:var(--surface2,#26262f);color:var(--muted2,#bbb)}
.df-export:disabled,.df-reset:disabled{opacity:.4;cursor:default}
.df-clear{background:#14351f;border:1.5px solid #2f9e6e;color:#7fd0a6;border-radius:12px;padding:26px;text-align:center;font-size:1rem;font-weight:600}
.df-group{margin-bottom:22px}
.df-group-hd{display:flex;justify-content:space-between;align-items:center;width:100%;border:none;background:var(--surface,#1a1a22);color:inherit;font:inherit;text-align:left;cursor:pointer;padding:11px 14px;border-radius:9px;margin-bottom:8px}
.df-group-name{font-size:1.1rem;font-weight:800}
.df-chev{color:var(--muted,#888);font-size:.9rem}
.df-group-meta{font-size:.78rem;color:var(--muted,#888);display:flex;gap:8px;align-items:center}
.df-group-blurb{font-style:italic}
.df-pub{margin:0 0 12px}
.df-pub-hd{font-size:.82rem;font-weight:700;color:var(--muted2,#bbb);margin:8px 0 6px;letter-spacing:.3px}
.df-pub-n{font-size:.68rem;color:var(--muted,#888);background:var(--surface2,#26262f);border-radius:9px;padding:1px 7px;margin-left:5px}
.df-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:10px}
.df-card{display:flex;gap:10px;background:var(--surface,#1a1a22);border:1px solid var(--border,#2c2c38);border-radius:10px;padding:9px;overflow:hidden;transition:opacity .32s ease,transform .32s ease,max-height .32s ease;max-height:220px}
.df-card.leaving{opacity:0;transform:translateX(30px) scale(.96);max-height:0;padding-top:0;padding-bottom:0;margin:0;border-width:0}
.df-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.df-title{font-weight:700;font-size:.9rem;line-height:1.25}
.df-iss{color:var(--red,#e05a4a)}
.df-metaline{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:.66rem}
.df-year{font-weight:700;color:var(--muted2,#bbb);background:var(--surface2,#26262f);border-radius:4px;padding:1px 6px}
.df-pd{color:#8fd0ff}.df-box{color:#8fd0ff}.df-vol{color:#c9a35a}
.df-solutions{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.df-solve{font-size:.72rem;font-weight:600;border:1px solid var(--border,#2c2c38);background:var(--surface2,#26262f);color:var(--text,#eee);border-radius:7px;padding:4px 10px;cursor:pointer;transition:all .12s}
.df-solve:hover{background:#22c55e;border-color:#22c55e;color:#04220f}
.df-find{font-size:.72rem;color:var(--muted2,#bbb);text-decoration:none;border-bottom:1px dashed var(--border,#444)}
.df-find:hover{color:#8fd0ff}
.df-linkrow{display:flex;gap:6px}
.df-link-in{flex:1;min-width:0;font-size:.75rem;background:var(--bg,#111);border:1px solid var(--border,#2c2c38);border-radius:7px;padding:5px 9px;color:var(--text,#eee)}
.df-link-in:focus{outline:none;border-color:#7c3aed}
.df-link-save{font-size:.72rem;font-weight:700;border:none;border-radius:7px;padding:5px 12px;cursor:pointer;background:#7c3aed;color:#fff}
.df-link-save:disabled{opacity:.4;cursor:default}
`;
