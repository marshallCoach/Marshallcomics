import { useState, useMemo, useCallback, useEffect } from "react";
import { DATA, type Comic } from "@/data/data";
import { CoverImage, CoverModal, fmtPubDate, coverUrlSync, coverSourceSync, coversReady } from "@/components/CoverImage";
import { setFlagKind as setCoverFlagKind } from "@/lib/coverFlags";

// ── Data-cleanup spot-check ──────────────────────────────────────────────────
// Surfaces every comic with a fixable data problem, grouped by problem →
// publisher → year. Each card offers a Fandom link or a one-tap suggested fix;
// resolving hides the comic and feeds an export the pipeline consumes. Built to
// be a daily driver — progress ring, category chips, and a streak for momentum.
const comics = DATA.comics;
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// Title consistency — same normalization as brb_validate.py Check 12, so the
// on-page list matches the validator's "split by punctuation/case" output.
const normTitleKey = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function simRatio(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m && !n) return 1;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n);
}
// Canonical title from a Fandom URL ("link is truth"): strip /wiki/, decode, drop
// the _Vol_N_ISSUE tail, underscores -> spaces. No fetch needed — the page title
// is in the path. e.g. .../wiki/Batman/Superman:_World%27s_Finest_Vol_1_33
function canonicalFromFandom(url: string): string {
  const m = (url || "").match(/\/wiki\/(.+)$/);
  if (!m) return "";
  let p = m[1].split(/[?#]/)[0];
  try { p = decodeURIComponent(p); } catch { /* keep raw */ }
  return p.replace(/_Vol_\d+.*$/i, "").replace(/_/g, " ").trim();
}

const LS_FIXES = "brbDataFixes_v1";     // id -> resolution record
const LS_META  = "brbDataFixMeta_v1";   // { lastDate, streak, todayCount }

type FixKind = "fandom" | "solution";
interface FixRecord { id: string; title: string; issue: string; box: string; problem: string; kind: FixKind; value: string; at: string; }
type ProblemId = "no-date" | "date-conflict" | "no-volume" | "no-year" | "likely-variant" | "not-in-gcd" | "no-cover";

const PROBLEMS: { id: ProblemId; label: string; blurb: string; color: string; vol?: boolean; yr?: boolean; info?: boolean; solutions: { key: string; label: string }[] }[] = [
  { id: "no-date",       label: "Missing publication date", blurb: "Not matched in GCD/Comic Vine — no on-sale date", color: "#c8102e",
    solutions: [{ key: "cv", label: "Try Comic Vine next run" }, { key: "no-entry", label: "No catalogue entry — accept blank" }] },
  { id: "date-conflict", label: "Year / volume conflict",    blurb: "On-sale date disagrees with Year — year or volume likely wrong", color: "#b45309", vol: true, yr: true,
    solutions: [{ key: "trust-gcd", label: "Trust the on-sale date" }, { key: "trust-year", label: "Trust my Year" }] },
  { id: "no-volume",     label: "Missing volume",            blurb: "No volume number recorded", color: "#7c3aed", vol: true,
    solutions: [{ key: "vol1", label: "It's Volume 1" }, { key: "research", label: "Needs research" }] },
  { id: "no-year",       label: "Missing / bad year",        blurb: "Year is blank or not a 4-digit year", color: "#0e7490", yr: true,
    solutions: [{ key: "research", label: "Needs research" }] },
  { id: "likely-variant", label: "Likely variant (cover-buy)", blurb: "CC1 cover-buy. If the cover shown is correct, click “Cover's right”. Only paste a Fandom link if the cover is wrong.", color: "#db2777",
    solutions: [{ key: "confirm-variant", label: "✓ Cover's right — keep as variant" }, { key: "not-variant", label: "Not a variant (regular copy)" }] },
  { id: "not-in-gcd",    label: "Not in GCD",                blurb: "Informational — GCD has no series, but most are verified by a Fandom cover or are variants/recent. Not counted as work.", color: "#0891b2", vol: true, info: true,
    solutions: [{ key: "indie", label: "Indie — not catalogued" }, { key: "research", label: "Needs research" }] },
  { id: "no-cover",      label: "Missing cover",             blurb: "No cover image yet — paste the Fandom page link to pull one (big bucket; collapsed by default)", color: "#2563eb",
    solutions: [{ key: "no-art", label: "No art available — accept blank" }] },
];
const PROBLEM_MAP = Object.fromEntries(PROBLEMS.map(p => [p.id, p]));
// Informational problems are shown for reference but excluded from the "to go"
// count and the default (all) view — they need no per-book action here.
const INFO_PROBLEMS = new Set<ProblemId>(PROBLEMS.filter(p => p.info).map(p => p.id));

function comicId(c: Comic): string {
  return `${(c.Title ?? "").trim()}|||${String(c.Issue ?? "").trim()}|||${(c.Box ?? "").trim()}`;
}
const issueNum = (v: unknown) => {
  const m = String(v ?? "").replace(/^#/, "").match(/[\d.]+/);
  return m ? parseFloat(m[0]) : Number.POSITIVE_INFINITY;
};
function problemsFor(c: Comic): ProblemId[] {
  const out: ProblemId[] = [];
  const pd = (c as { Pub_Date?: string }).Pub_Date || "";
  const yr = (c.Year || "").trim();
  const pdY = /^(\d{4})/.exec(pd)?.[1];
  if (!pd) out.push("no-date");
  else if (pdY && /^\d{4}$/.test(yr) && Math.abs(+pdY - +yr) > 1) out.push("date-conflict");
  if (!(c.Volume || "").trim()) out.push("no-volume");
  if (!/^\d{4}$/.test(yr)) out.push("no-year");
  if ((c.Box || "").trim() === "CC1") out.push("likely-variant");
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
  const [volDraft, setVolDraft] = useState<Record<string, string>>({});
  const [yearDraft, setYearDraft] = useState<Record<string, string>>({});
  const [activeProblem, setActiveProblem] = useState<ProblemId | "all">("all");
  const [sortByCount, setSortByCount] = useState(false);   // title A→Z vs most-issues-first
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [coverModal, setCoverModal] = useState<{ comic: Comic; large: string | null } | null>(null);
  const [meta, setMeta] = useState<Meta>(() => loadMeta());
  const [session, setSession] = useState(0);
  const [pop, setPop] = useState(0);
  const [notInGcd, setNotInGcd] = useState<Set<string>>(new Set());
  const [coversLoaded, setCoversLoaded] = useState(false);
  const [flOpen, setFlOpen] = useState(false);
  const [unresolved, setUnresolved] = useState<{ title: string; issue: string; reason: string }[]>([]);
  const [urOpen, setUrOpen] = useState(false);
  const [tcOpen, setTcOpen] = useState(false);
  const [titleMerges, setTitleMerges] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("brbTitleMerges_v1") || "{}"); } catch { return {}; }
  });
  useEffect(() => { try { localStorage.setItem("brbTitleMerges_v1", JSON.stringify(titleMerges)); } catch { /* ignore */ } }, [titleMerges]);
  const [titleLinks, setTitleLinks] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("brbTitleLinks_v1") || "{}"); } catch { return {}; }
  });
  useEffect(() => { try { localStorage.setItem("brbTitleLinks_v1", JSON.stringify(titleLinks)); } catch { /* ignore */ } }, [titleLinks]);

  useEffect(() => {
    fetch(`${BASE}/gcd_notfound.json`).then(r => r.ok ? r.json() : [])
      .then((a: string[]) => setNotInGcd(new Set(a))).catch(() => {});
    fetch(`${BASE}/fandom_unresolved.json`).then(r => r.ok ? r.json() : [])
      .then((a: { title: string; issue: string; reason: string }[]) => setUnresolved(Array.isArray(a) ? a : [])).catch(() => {});
    coversReady().then(() => setCoversLoaded(true));
  }, []);

  // All comics that have ≥1 problem (computed once).
  const flagged = useMemo(() => {
    const rows: { c: Comic; id: string; problems: ProblemId[] }[] = [];
    for (const c of comics) {
      const id = comicId(c);
      const ps = problemsFor(c);
      if (notInGcd.has(id)) ps.push("not-in-gcd");
      if (coversLoaded && coverUrlSync(c) === null) ps.push("no-cover");
      if (ps.length) rows.push({ c, id, problems: ps });
    }
    return rows;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notInGcd, coversLoaded]);

  // Books that are flagged AND already carry a Fandom-sourced cover — a Fandom
  // link resolved their image, yet they still read as a problem. Those are the
  // most likely duplication / mislabel errors (like the Wildcats V3.0 dupes), so
  // gather them into one collapsible section for a focused review.
  const fandomLinked = useMemo(() => {
    void coversLoaded; // recompute once covers.json has loaded
    return flagged.filter(f => /fandom/i.test(coverSourceSync(f.c) || "") && coverUrlSync(f.c) !== null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagged, coversLoaded]);

  // ── Title consistency (client-side, mirrors validator Check 12) ──────────────
  const titleGroups = useMemo(() => {
    const g: Record<string, Map<string, number>> = {};
    for (const c of comics) {
      const t = (c.Title || "").trim(); if (!t) continue;
      const k = normTitleKey(t);
      (g[k] ||= new Map()).set(t, (g[k].get(t) || 0) + 1);
    }
    return g;
  }, []);
  // Exact titles that already carry a Fandom-sourced cover (exact-key match, no
  // normalized fallback) — so each split spelling shows whether IT holds the link.
  const fandomTitles = useMemo(() => {
    void coversLoaded;
    const s = new Set<string>();
    for (const c of comics) {
      const src = coverSourceSync(c);
      if (src && /fandom|wikia/i.test(src)) s.add((c.Title || "").trim());
    }
    return s;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coversLoaded]);
  // Same series, split spellings → mergeable. `linked` = this exact spelling
  // already has a Fandom cover (keep it, or let a pasted link override).
  const collisions = useMemo(() =>
    Object.entries(titleGroups).filter(([, m]) => m.size > 1)
      .map(([key, m]) => ({ key, spellings: [...m.entries()].map(([t, n]) => ({ t, n, linked: fandomTitles.has(t) })).sort((a, b) => b.n - a.n) }))
      .sort((a, b) => a.spellings[0].t.localeCompare(b.spellings[0].t)),
    [titleGroups, fandomTitles]);
  // Near-identical (may be distinct series) → review only.
  const fuzzy = useMemo(() => {
    const keys = Object.keys(titleGroups).sort();
    const stripTail = (s: string) => s.replace(/\s*\d+$/, "").trim();
    const out: { a: string; b: string }[] = [];
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i], b = keys[j];
      if (Math.abs(a.length - b.length) > 4) continue;
      if ((stripTail(a) !== a || stripTail(b) !== b) && stripTail(a) === stripTail(b)) continue;
      if (simRatio(a, b) >= 0.94) out.push({ a: [...titleGroups[a].keys()][0], b: [...titleGroups[b].keys()][0] });
    }
    return out;
  }, [titleGroups]);
  // Match a Fandom-fill-unresolved record (title/issue) back to its inventory row,
  // so the user can still paste a link for it and it saves through the pipeline.
  const comicByKey = useMemo(() => {
    const m = new Map<string, Comic>();
    for (const c of comics) {
      const k = normTitleKey(c.Title || "") + "|||" + String(c.Issue ?? "").replace(/^#/, "");
      if (!m.has(k)) m.set(k, c);
    }
    return m;
  }, []);
  const mergeQueuedCount = Object.keys(titleMerges).filter(k => titleMerges[k]).length;
  // Export a persistent title_aliases map (normKey -> {canonical, source}). The
  // pipeline merges it into title_aliases.json and re-applies it every brb_all,
  // so the merge is permanent — a later intake that re-splits self-heals.
  const exportTitleAliases = useCallback(() => {
    const out: Record<string, { canonical: string; source: string }> = {};
    for (const [k, canonical] of Object.entries(titleMerges)) {
      if (!canonical) continue;
      out[k] = { canonical, source: titleLinks[k] || "" };
    }
    if (!Object.keys(out).length) { alert("Nothing chosen — paste a Fandom link or click a spelling to keep first."); return; }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `title_aliases_${todayStr().replace(/-/g, "")}.json`;
    a.click();
  }, [titleMerges, titleLinks]);
  const setLink = useCallback((key: string, url: string) => {
    setTitleLinks(prev => ({ ...prev, [key]: url }));
    const canon = canonicalFromFandom(url);
    if (canon) setTitleMerges(prev => ({ ...prev, [key]: canon }));  // link is truth
  }, []);

  // Self-prune: once a resolution has been applied + reingested, its comic no
  // longer has that problem, so it drops out of `flagged`. Remove those stale
  // records so the counters and the export reflect only outstanding work.
  useEffect(() => {
    const ids = new Set(flagged.map(f => f.id));
    setFixes(prev => {
      let changed = false;
      const next = new Map(prev);
      // Keep link records (fandom/image) even for non-flagged books — the user
      // pasted them to apply (unresolved / too-new rows). Only prune stale
      // 'solution' records whose underlying problem is gone.
      for (const [id, rec] of [...next]) if (!ids.has(id) && rec.kind === "solution") { next.delete(id); changed = true; }
      if (changed) saveFixes(next);
      return changed ? next : prev;
    });
  }, [flagged]);

  // Actionable = rows with at least one non-informational problem. The header
  // progress, the "to go" number and the "all" view all track actionable work;
  // informational flags (not-in-gcd) are browsable via their chip but never
  // inflate the count.
  const actionableRows = useMemo(
    () => flagged.filter(f => f.problems.some(p => !INFO_PROBLEMS.has(p))), [flagged]);
  const totalProblems = actionableRows.length;
  const resolvedCount = useMemo(() => actionableRows.filter(f => fixes.has(f.id)).length, [actionableRows, fixes]);
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

  // Groups: problem → TITLE → [issues], only unresolved & matching filter.
  // Grouped by title (series) so you can clear one book at a time — fix one
  // issue and its siblings are right there; the back-end extrapolation fills
  // the rest of the run from the confirmed series+volume.
  const groups = useMemo(() => {
    const visibleProblems = activeProblem === "all"
      ? PROBLEMS.filter(p => !p.info).map(p => p.id)   // info groups only when their chip is picked
      : [activeProblem];
    return visibleProblems.map(pid => {
      const rows = flagged.filter(f => f.problems.includes(pid) && !fixes.has(f.id));
      const byTitle = new Map<string, { c: Comic; id: string }[]>();
      for (const r of rows) {
        const key = (r.c.Title || "—").trim() || "—";
        (byTitle.get(key) ?? byTitle.set(key, []).get(key)!).push({ c: r.c, id: r.id });
      }
      // Alphabetical by title so you move top-to-bottom; issues ascending within.
      const pubs = [...byTitle.entries()].sort((a, b) =>
        sortByCount ? (b[1].length - a[1].length || a[0].localeCompare(b[0])) : a[0].localeCompare(b[0])
      ).map(([pub, items]) => {
        items.sort((a, b) => issueNum(a.c.Issue) - issueNum(b.c.Issue));
        return { pub, items };
      });
      return { pid, problem: PROBLEM_MAP[pid], count: rows.length, pubs };
    }).filter(g => g.count > 0);
  }, [flagged, fixes, activeProblem, sortByCount]);

  const resolve = useCallback((c: Comic, id: string, problem: ProblemId, kind: FixKind, value: string) => {
    // A confirmed cover-buy variant also sets the cover flag (kind "variant")
    // so it shows in the cover audit / export, not just the data-fix export.
    if (value === "confirm-variant") {
      setCoverFlagKind({ Title: c.Title, Issue: c.Issue, Box: c.Box,
        Cover_Artist: c.Cover_Artist, Publisher: c.Publisher, Year: c.Year }, "variant");
    }
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

  const fandomSearch = (c: Comic) => {
    const yr = ((c as { Pub_Date?: string }).Pub_Date || "").slice(0, 4) || (c.Year || "").trim();
    const q = `${c.Title} ${c.Publisher || ""} #${c.Issue} ${yr} fandom comic book issue`.replace(/\s+/g, " ").trim();
    return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  };
  // Series-level Fandom guess for the Title cleanup rows (no issue — it's a whole
  // series), same idea as the per-book "Find on Fandom" link elsewhere.
  const fandomTitleSearch = (title: string) =>
    `https://www.google.com/search?q=${encodeURIComponent(`${title} fandom comic series wiki`)}`;

  return (
    <div style={{ maxWidth: "calc(1040px + var(--wide))", margin: "0 auto", padding: "20px 16px 90px" }}>
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
          <button key={p.id} className={`df-chip${activeProblem === p.id ? " on" : ""}${p.info ? " info" : ""}`}
            style={{ ["--pc" as string]: p.color }} onClick={() => setActiveProblem(p.id)}
            title={p.info ? "Informational — not counted toward work to do" : undefined}>
            {p.info ? "ⓘ " : ""}{p.label} <span className="df-chip-n" style={{ background: p.color }}>{counts[p.id] || 0}</span>
          </button>
        ))}
        <div className="df-actions">
          <button className={`df-reset${sortByCount ? " on" : ""}`} onClick={() => setSortByCount(s => !s)}
            title="Toggle title order">{sortByCount ? "↕ Most issues" : "↕ Title A–Z"}</button>
          <button className="df-export" onClick={exportFixes} disabled={!fixes.size}>⬇ Export {fixes.size ? `(${fixes.size})` : ""}</button>
          <button className="df-reset" onClick={undoAll} disabled={!fixes.size}>Reset</button>
        </div>
      </div>

      {remaining === 0 && (
        <div className="df-clear">🎉 Inbox zero. Every flagged book has been handled. Come back after the next pipeline run.</div>
      )}

      {/* Fandom linked — flagged books that already have a Fandom-sourced cover.
          Collapsed by default; these are the likely duplication / mislabel cases. */}
      {fandomLinked.length > 0 && (
        <section className="df-group" style={{ marginBottom: 14 }}>
          <button className="df-group-hd" onClick={() => setFlOpen(o => !o)} style={{ borderLeft: "4px solid #7c3aed" }}>
            <span className="df-group-name">
              <span className="df-chev">{flOpen ? "▾" : "▸"}</span> 🔗 Fandom linked — likely duplication/mislabel
            </span>
            <span className="df-chip-n">{fandomLinked.length}</span>
          </button>
          {flOpen && (
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: "0.78rem", color: "var(--muted2,#aaa)" }}>
                Already carry a Fandom cover, so likely a dup or mislabel. If the cover is for the <b>wrong</b> issue/volume, paste the correct Fandom page link — it overwrites the row's volume next run. Right cover + still here = leave it.
              </div>
              {fandomLinked.map((f, i) => {
                const saved = fixes.has(f.id);
                return (
                  <div key={f.id + i} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", border: "1px solid var(--border,#2c2c38)", borderRadius: 6, padding: "6px 9px", fontSize: "0.82rem" }}>
                    <CoverImage comic={f.c} width={34} height={51} />
                    <div style={{ minWidth: 160, flex: "0 1 auto" }}>
                      <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        <a href={`https://www.google.com/search?q=${encodeURIComponent(`${f.c.Title} #${f.c.Issue} fandom comic`)}`} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{f.c.Title} #{f.c.Issue} 🔍↗</a>
                      </div>
                      <div style={{ color: "var(--muted2,#aaa)" }}>Box {f.c.Box || "—"} · {f.problems.join(", ")}</div>
                    </div>
                    {saved ? <span style={{ color: "#16a34a", fontWeight: 700 }}>✓ link queued</span> : (
                      <div className="df-linkrow" style={{ flex: 1, minWidth: 220, maxWidth: 420 }}>
                        <input className="df-link-in" placeholder="Paste Fandom link that fixes it…"
                          value={linkDraft[f.id] || ""} onChange={e => setLinkDraft(d => ({ ...d, [f.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter" && (linkDraft[f.id] || "").trim()) resolve(f.c, f.id, f.problems[0] || "no-date", "fandom", linkDraft[f.id].trim()); }} />
                        <button className="df-link-save" disabled={!(linkDraft[f.id] || "").trim()}
                          onClick={() => resolve(f.c, f.id, f.problems[0] || "no-date", "fandom", (linkDraft[f.id] || "").trim())}>Save link</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Fandom fill — unresolved: books with a Fandom cover still missing a
          creator/date that the wiki lookup couldn't fill (too new, no mapped
          wiki, or a volume mismatch). Surfaced for manual investigation. */}
      {unresolved.length > 0 && (
        <section className="df-group" style={{ marginBottom: 14 }}>
          <button className="df-group-hd" onClick={() => setUrOpen(o => !o)} style={{ borderLeft: "4px solid #0e7490" }}>
            <span className="df-group-name">
              <span className="df-chev">{urOpen ? "▾" : "▸"}</span> 🔍 Fandom fill — unresolved (investigate)
            </span>
            <span className="df-chip-n">{unresolved.length}</span>
          </button>
          {urOpen && (
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: "0.78rem", color: "var(--muted2,#aaa)" }}>
                The wiki page didn't exist at run time — but if you find a working one, paste it and it applies next run (exactly like the other cards).
              </div>
              {unresolved.map((u, i) => {
                const c = comicByKey.get(normTitleKey(u.title) + "|||" + String(u.issue).replace(/^#/, ""));
                const id = c ? comicId(c) : "";
                const saved = !!id && fixes.has(id);
                return (
                  <div key={u.title + u.issue + i} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", padding: "6px 9px", borderBottom: "1px solid var(--border,#2c2c38)", fontSize: "0.82rem" }}>
                    <div style={{ minWidth: 200 }}>
                      <a href={`https://www.google.com/search?q=${encodeURIComponent(`${u.title} #${u.issue} fandom comic`)}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: "inherit", textDecoration: "none" }}>{u.title} <b>#{u.issue}</b> 🔍↗</a>
                      <div style={{ color: "var(--muted2,#aaa)", fontSize: "0.72rem" }}>{u.reason}</div>
                    </div>
                    {c ? (
                      saved ? <span style={{ color: "#16a34a", fontWeight: 700 }}>✓ link queued</span> : (
                        <div className="df-linkrow" style={{ flex: 1, minWidth: 220, maxWidth: 420 }}>
                          <input className="df-link-in" placeholder="Paste Fandom link that fixes it…"
                            value={linkDraft[id] || ""} onChange={e => setLinkDraft(d => ({ ...d, [id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter" && (linkDraft[id] || "").trim()) resolve(c, id, "no-date", "fandom", linkDraft[id].trim()); }} />
                          <button className="df-link-save" disabled={!(linkDraft[id] || "").trim()}
                            onClick={() => resolve(c, id, "no-date", "fandom", (linkDraft[id] || "").trim())}>Save link</button>
                        </div>
                      )
                    ) : <span style={{ color: "var(--muted,#888)", fontSize: "0.72rem" }}>no inventory row match</span>}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Title cleanup — merge split spellings (same series), review near-identical. */}
      {(collisions.length > 0 || fuzzy.length > 0) && (
        <section className="df-group" style={{ marginBottom: 14 }}>
          <button className="df-group-hd" onClick={() => setTcOpen(o => !o)} style={{ borderLeft: "4px solid #b45309" }}>
            <span className="df-group-name"><span className="df-chev">{tcOpen ? "▾" : "▸"}</span> 🔤 Title cleanup — merge split spellings</span>
            <span className="df-chip-n">{collisions.length + fuzzy.length}</span>
          </button>
          {tcOpen && (
            <div style={{ padding: "10px 14px" }}>
              {collisions.length > 0 && (
                <>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted2,#aaa)", marginBottom: 8 }}>
                    Same series, different spelling. Click the spelling to <b>keep</b> — the others rename to it. <b style={{ color: "#7c3aed" }}>🔗</b> = that spelling already has a Fandom cover, so prefer it (the merge keeps the cover either way). Then Export and run <code>brb_all</code>.
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "0 0 12px", position: "sticky", top: 0, background: "var(--surface,#1a1a22)", padding: "6px 0", zIndex: 5 }}>
                    <button onClick={exportTitleAliases} disabled={!mergeQueuedCount}
                      style={{ fontSize: "0.82rem", fontWeight: 700, border: "none", borderRadius: 7, padding: "7px 14px",
                        cursor: mergeQueuedCount ? "pointer" : "default",
                        background: mergeQueuedCount ? "#16a34a" : "var(--surface2,#26262f)", color: mergeQueuedCount ? "#04220f" : "var(--muted,#888)" }}>
                      ⬇ Export {mergeQueuedCount || ""} title alias{mergeQueuedCount === 1 ? "" : "es"}
                    </button>
                    <span style={{ fontSize: "0.72rem", color: "var(--muted,#888)" }}>Drop in ~/Downloads → run brb_all. Applied every run, so it sticks for good.</span>
                  </div>
                  {collisions.map(g => {
                    const chosenT = titleMerges[g.key];
                    const fromLink = !!canonicalFromFandom(titleLinks[g.key] || "");
                    return (
                      <div key={g.key} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0", borderBottom: "1px solid var(--border,#2c2c38)" }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          {g.spellings.map(s => {
                            const chosen = chosenT === s.t;
                            return (
                              <button key={s.t} onClick={() => setTitleMerges(prev => ({ ...prev, [g.key]: s.t }))}
                                title={s.linked ? "This spelling already has a Fandom cover" : undefined}
                                style={{ fontSize: "0.82rem", padding: "4px 10px", borderRadius: 6, cursor: "pointer",
                                  border: `1.5px solid ${chosen ? "#16a34a" : s.linked ? "#7c3aed" : "var(--border,#2c2c38)"}`,
                                  background: chosen ? "#16653420" : "var(--surface2,#26262f)",
                                  color: chosen ? "#16a34a" : "var(--text,#eee)", fontWeight: chosen ? 700 : 400 }}>
                                {chosen ? "✓ keep " : ""}{s.linked ? "🔗 " : ""}{s.t} <span style={{ opacity: 0.6 }}>×{s.n}</span>
                              </button>
                            );
                          })}
                          {chosenT && (
                            <button onClick={() => { setTitleMerges(prev => { const n = { ...prev }; delete n[g.key]; return n; }); setTitleLinks(prev => { const n = { ...prev }; delete n[g.key]; return n; }); }}
                              style={{ fontSize: "0.72rem", background: "none", border: "none", color: "var(--muted,#888)", cursor: "pointer" }}>clear</button>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <a className="df-find" href={fandomTitleSearch(g.spellings[0].t)} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: "0.78rem", color: "#5ab0e0", textDecoration: "none", whiteSpace: "nowrap" }}>🔍 Find on Fandom ↗</a>
                          <input value={titleLinks[g.key] || ""} onChange={e => setLink(g.key, e.target.value)}
                            placeholder="…then paste the Fandom link here (its title wins)"
                            style={{ flex: 1, minWidth: 220, fontSize: "0.78rem", padding: "5px 9px", borderRadius: 5, border: "1.5px solid var(--border,#2c2c38)", background: "var(--bg,#141419)", color: "var(--text,#eee)" }} />
                          {fromLink && <span style={{ fontSize: "0.78rem", color: "#16a34a", fontWeight: 700 }}>→ {chosenT}</span>}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
              {fuzzy.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted2,#aaa)", marginBottom: 6 }}>
                    Near-identical — may be <b>distinct</b> series (e.g. “Year One” vs “Year Two”). Review; rename via the Edit page only if truly the same.
                  </div>
                  {fuzzy.map((p, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "4px 0", fontSize: "0.8rem", borderBottom: "1px solid var(--border,#2c2c38)" }}>
                      <span>{p.a} <span style={{ color: "var(--muted,#888)" }}>~</span> {p.b}</span>
                      <a href={`https://www.google.com/search?q=${encodeURIComponent(p.a + " vs " + p.b + " comic series")}`} target="_blank" rel="noopener noreferrer" style={{ color: "#1d6fa4", textDecoration: "none" }}>check ↗</a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Groups */}
      {groups.map(g => {
        const gopen = openGroups[g.pid] ?? (g.pid !== "no-cover");
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
                      <CoverImage comic={c} width={150} height={225} objectFit="contain"
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
                        {g.problem.vol && (
                          <div className="df-linkrow">
                            <input className="df-link-in" style={{ maxWidth: 120 }} inputMode="numeric" placeholder="Set volume → e.g. 3"
                              value={volDraft[id] || ""} onChange={e => setVolDraft(d => ({ ...d, [id]: e.target.value.replace(/[^0-9]/g, "") }))}
                              onKeyDown={e => { if (e.key === "Enter" && (volDraft[id] || "").trim()) resolve(c, id, g.pid, "solution", `vol:${volDraft[id].trim()}`); }} />
                            <button className="df-link-save" style={{ background: "#7c3aed" }} disabled={!(volDraft[id] || "").trim()}
                              onClick={() => resolve(c, id, g.pid, "solution", `vol:${(volDraft[id] || "").trim()}`)}>Set volume</button>
                          </div>
                        )}
                        {g.problem.yr && (
                          <div className="df-linkrow">
                            <input className="df-link-in" style={{ maxWidth: 120 }} inputMode="numeric" maxLength={4} placeholder="Set year → e.g. 2012"
                              value={yearDraft[id] || ""} onChange={e => setYearDraft(d => ({ ...d, [id]: e.target.value.replace(/[^0-9]/g, "").slice(0, 4) }))}
                              onKeyDown={e => { if (e.key === "Enter" && /^\d{4}$/.test(yearDraft[id] || "")) resolve(c, id, g.pid, "solution", `year:${yearDraft[id].trim()}`); }} />
                            <button className="df-link-save" style={{ background: "#0e7490" }} disabled={!/^\d{4}$/.test(yearDraft[id] || "")}
                              onClick={() => resolve(c, id, g.pid, "solution", `year:${(yearDraft[id] || "").trim()}`)}>Set year</button>
                          </div>
                        )}
                        {g.pid === "likely-variant" && (
                          <div style={{ fontSize: ".72rem", color: "var(--muted,#888)", margin: "2px 0 -2px" }}>
                            Cover right? Hit <b>✓ Cover's right</b> above — skip the box below. The link is only for a wrong cover.
                          </div>
                        )}
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
.df-chip.info{opacity:.62;border-style:dashed}
.df-chip.info.on{opacity:1}
.df-chip-n{font-size:.68rem;font-weight:800;background:var(--surface2,#26262f);color:#fff;border-radius:10px;padding:1px 7px;font-variant-numeric:tabular-nums}
.df-chip.on .df-chip-n{background:rgba(0,0,0,.25)}
.df-actions{margin-left:auto;display:flex;gap:8px}
.df-export,.df-reset{font-size:.75rem;font-weight:600;border-radius:8px;padding:5px 12px;cursor:pointer;border:1px solid var(--border,#2c2c38);background:var(--surface2,#26262f);color:var(--muted2,#bbb)}
.df-reset.on{background:#1d4ed8;border-color:#1d4ed8;color:#fff}
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
.df-card{display:flex;gap:10px;background:var(--surface,#1a1a22);border:1px solid var(--border,#2c2c38);border-radius:10px;padding:9px;overflow:hidden;transition:opacity .32s ease,transform .32s ease,max-height .32s ease;max-height:320px}
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
