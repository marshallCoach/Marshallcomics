import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { DATA, type Comic } from "@/data/data";
import { CoverImage, CoverModal, fmtPubDate, coverUrlSync, coverSourceSync, coversReady } from "@/components/CoverImage";
import { setFlagKind as setCoverFlagKind } from "@/lib/coverFlags";
import { Guide, FLOW } from "./dataFixGuides";
import { openFocus, fandomGuess, type FocusItem } from "@/lib/focusQueue";
import { Trend, deployPrev } from "@/lib/trend";
import { PROBLEMS, PROBLEM_MAP, INFO_PROBLEMS, missingData, comicId, issueNum, problemsFor, type ProblemId } from "@/lib/problems";

type OpenItems = { items: (FocusItem & { id: string })[]; tasks: { id: string; title: string; problem: string; action: string }[] };

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
  return p.replace(/_Vol_\d+.*$/i, "").replace(/,?_Issue_.*$/i, "").replace(/_/g, " ").trim();
}

const LS_FIXES = "brbDataFixes_v1";     // id -> resolution record
const LS_META  = "brbDataFixMeta_v1";   // { lastDate, streak, todayCount }

type FixKind = "fandom" | "solution";
interface FixRecord { id: string; title: string; issue: string; box: string; problem: string; kind: FixKind; value: string; at: string; auto?: boolean;
  year?: string; vol?: string; }   // pin the exact copy: one box can hold an issue # from several eras
type ArcSide = { name: string; part: string; length: string; source?: string; finale?: string; url?: string };
type ArcConflict = { id: string; title: string; issue: string; box: string; vol: string; year: number | null; fandom: ArcSide; cv: ArcSide };
const cleanArc = (n: string) => (n || "").replace(/^\s*["\u201c][^"\u201d]{1,60}["\u201d]\s+/, "").trim() || (n || "").trim();
const partTxt = (a: ArcSide) => a.part ? ` · part ${a.part}${a.length ? ` of ${a.length}` : ""}` : (a.length ? ` · ${a.length} parts` : "");

type SMCand = { base: string; url: string; verified: number; of: number; years: number[]; sim: number };
type SeriesMatch = { key: string; wiki: string; title: string; vol: string; count: number; years: number[]; issues: string[]; reason: string; best: SMCand | null; conf: "high" | "medium" | "none"; cands: SMCand[] };
type Reclaim = { id: string; tier: 1 | 2; today: string; title: string; issue: string; year: string; box: string; pub: string; vol: string; dropped: string; commit: string; why: string };
type Restored = {
  restored: { entry: string; old: string; dropped: string }[];
  noIssue: { title: string; vol: string; year: string; box: string; pub: string }[];
  alreadyThere: { title: string; issue: string; vol: string; year: string; box: string }[];
};
type SeriesHeld = { key: string; title: string; vol: string; fandom: string; wiki: string; fit: number };
const SM_COLOR = { high: "#16a34a", medium: "#d97706", none: "#dc2626" } as const;

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

export default function DataFix({ onNavigate }: { onNavigate?: (tab: string, params?: { query?: string }) => void } = {}) {
  const [fixes, setFixes] = useState<Map<string, FixRecord>>(() => loadFixes());
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [linkDraft, setLinkDraft] = useState<Record<string, string>>({});
  const [volDraft, setVolDraft] = useState<Record<string, string>>({});
  const [yearDraft, setYearDraft] = useState<Record<string, string>>({});
  const [activeProblem, setActiveProblem] = useState<ProblemId | "all">("all");
  const [sortByCount, setSortByCount] = useState(true);    // most-issues-first (default, Nov 20) vs title A→Z
  const [spreadNote, setSpreadNote] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [coverModal, setCoverModal] = useState<{ comic: Comic; large: string | null } | null>(null);
  const [meta, setMeta] = useState<Meta>(() => loadMeta());
  const [session, setSession] = useState(0);
  const [pop, setPop] = useState(0);
  const [notInGcd, setNotInGcd] = useState<Set<string>>(new Set());
  const [variantDone, setVariantDone] = useState<Set<string>>(new Set());
  const [resolvedFlags, setResolvedFlags] = useState<Record<string, string[]>>({});
  const [coversLoaded, setCoversLoaded] = useState(false);
  const [flOpen, setFlOpen] = useState(false);
  const [flDupOk, setFlDupOk] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("brbFandomDupOk_v1") || "[]")); } catch { return new Set(); }
  });
  useEffect(() => { try { localStorage.setItem("brbFandomDupOk_v1", JSON.stringify([...flDupOk])); } catch { /* ignore */ } }, [flDupOk]);
  const [unresolved, setUnresolved] = useState<{ title: string; issue: string; reason: string }[]>([]);
  const [urOpen, setUrOpen] = useState(false);
  const [fandomLinks, setFandomLinks] = useState<Record<string, string>>({});
  const [cgOpen, setCgOpen] = useState(false);
  const [arcConflicts, setArcConflicts] = useState<ArcConflict[]>([]);
  const [seriesMatch, setSeriesMatch] = useState<SeriesMatch[]>([]);
  const [seriesMapped, setSeriesMapped] = useState<Record<string, unknown>>({});
  const [seriesHeld, setSeriesHeld] = useState<SeriesHeld[]>([]);
  const [heldHints, setHeldHints] = useState<Record<string, { hint: "better" | "stale"; fandom?: string; why: string }>>({});
  const [reclaim, setReclaim] = useState<Reclaim[]>([]);
  const [rcOpen, setRcOpen] = useState(false);
  const [rcTitle, setRcTitle] = useState<string | null>(null);
  const [rcTier, setRcTier] = useState<1 | 2>(2);     // Tier 1 was restored Nov 19 -> 📦 Restored books
  const [restoredData, setRestoredData] = useState<Restored | null>(null);
  const [rsOpen, setRsOpen] = useState(false);
  const [openItems, setOpenItems] = useState<OpenItems | null>(null);
  const [oiOpen, setOiOpen] = useState(true);
  const [rsTab, setRsTab] = useState<"box" | "copy" | "placed" | "noissue" | "skipped">("box");
  const [rsTitle, setRsTitle] = useState<string | null>(null);
  const [flowOpen, setFlowOpen] = useState(true);
  const [rcCovers, setRcCovers] = useState<Record<string, { url: string; large: string }>>({});
  const [rcUndo, setRcUndo] = useState<string[][]>([]);
  const [smOpen, setSmOpen] = useState(false);
  const [smPick, setSmPick] = useState<Record<string, string>>({});
  const [acOpen, setAcOpen] = useState(false);
  const [cgDismiss, setCgDismiss] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("brbCoverGuessDismiss_v1") || "[]")); } catch { return new Set(); }
  });
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
    fetch(`${BASE}/fandom_links.json`).then(r => r.ok ? r.json() : {})
      .then((o: Record<string, string>) => setFandomLinks(o && typeof o === "object" ? o : {})).catch(() => {});
    fetch(`${BASE}/confirmed_variants.json`).then(r => r.ok ? r.json() : [])
      .then((a: string[]) => setVariantDone(new Set(Array.isArray(a) ? a : []))).catch(() => {});
    fetch(`${BASE}/series_match.json`).then(r => r.ok ? r.json() : [])
      .then((a: SeriesMatch[]) => setSeriesMatch(Array.isArray(a) ? a : [])).catch(() => {});
    fetch(`${BASE}/reclaim_covers.json`).then(r => r.ok ? r.json() : {})
      .then((o: Record<string, { url: string; large: string }>) => setRcCovers(o && typeof o === "object" ? o : {})).catch(() => {});
    fetch(`${BASE}/open_items.json`).then(r => r.ok ? r.json() : null)
      .then((o: OpenItems | null) => setOpenItems(o && Array.isArray(o.items) ? { items: o.items, tasks: o.tasks || [] } : null)).catch(() => {});
    fetch(`${BASE}/reclaim_restored.json`).then(r => r.ok ? r.json() : null)
      .then((o: Restored | null) => setRestoredData(o && Array.isArray(o.restored) ? o : null)).catch(() => {});
    fetch(`${BASE}/reclaim_candidates.json`).then(r => r.ok ? r.json() : [])
      .then((a: Reclaim[]) => setReclaim(Array.isArray(a) ? a : [])).catch(() => {});
    fetch(`${BASE}/series_held_hints.json`).then(r => r.ok ? r.json() : {})
      .then((o: Record<string, { hint: "better" | "stale"; fandom?: string; why: string }>) => setHeldHints(o && typeof o === "object" ? o : {})).catch(() => {});
    fetch(`${BASE}/series_held.json`).then(r => r.ok ? r.json() : [])
      .then((a: SeriesHeld[]) => setSeriesHeld(Array.isArray(a) ? a : [])).catch(() => {});
    fetch(`${BASE}/series_map.json`).then(r => r.ok ? r.json() : {})
      .then((o: Record<string, unknown>) => setSeriesMapped(o && typeof o === "object" ? o : {})).catch(() => {});
    fetch(`${BASE}/arc_conflicts.json`).then(r => r.ok ? r.json() : [])
      .then((a: ArcConflict[]) => setArcConflicts(Array.isArray(a) ? a : [])).catch(() => {});
    fetch(`${BASE}/resolved_flags.json`).then(r => r.ok ? r.json() : {})
      .then((o: Record<string, string[]>) => setResolvedFlags(o && typeof o === "object" ? o : {})).catch(() => {});
    coversReady().then(() => setCoversLoaded(true));
  }, []);
  useEffect(() => { try { localStorage.setItem("brbCoverGuessDismiss_v1", JSON.stringify([...cgDismiss])); } catch { /* ignore */ } }, [cgDismiss]);

  // All comics that have ≥1 problem (computed once).
  const flagged = useMemo(() => {
    const rows: { c: Comic; id: string; problems: ProblemId[] }[] = [];
    for (const c of comics) {
      const id = comicId(c);
      let ps = problemsFor(c);
      if (notInGcd.has(id)) ps.push("not-in-gcd");
      if (coversLoaded && coverUrlSync(c) === null) ps.push("no-cover");
      else if (coversLoaded && missingData(c).length) ps.push("cover-no-data");
      // Triage memory: any problem you've already resolved on this book (from the
      // committed resolved_flags.json, rebuilt from all your exports) is dropped so
      // it never re-asks. variantDone covers legacy CC1 confirmations too.
      const rf = resolvedFlags[id];
      if (rf && rf.length) ps = ps.filter(p => !rf.includes(p));
      if (variantDone.has(id)) ps = ps.filter(p => p !== "likely-variant");
      if (ps.length) rows.push({ c, id, problems: ps });
    }
    return rows;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notInGcd, coversLoaded, variantDone, resolvedFlags]);

  const flaggedRef = useRef(flagged);
  flaggedRef.current = flagged;
  // Books per title on the page — sections list the biggest runs first (Nov 20), so one
  // link on a big run extrapolates across the most issues.
  const titleCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of flagged) { const t = (f.c.Title || "").trim(); m.set(t, (m.get(t) || 0) + 1); }
    return m;
  }, [flagged]);
  const byRun = useCallback((a: Comic, b: Comic) =>
    (titleCount.get((b.Title || "").trim()) || 0) - (titleCount.get((a.Title || "").trim()) || 0) ||
    (a.Title || "").localeCompare(b.Title || "") || issueNum(a.Issue) - issueNum(b.Issue), [titleCount]);

  // Books that are flagged AND already carry a Fandom-sourced cover — a Fandom
  // link resolved their image, yet they still read as a problem. Those are the
  // most likely duplication / mislabel errors (like the Wildcats V3.0 dupes), so
  // gather them into one collapsible section for a focused review.
  const fandomLinked = useMemo(() => {
    void coversLoaded; // recompute once covers.json has loaded
    return flagged.filter(f =>
      /fandom/i.test(coverSourceSync(f.c) || "") && coverUrlSync(f.c) !== null &&
      // Only keep books with a REAL (non-informational) problem. A book whose only
      // flag is "not-in-gcd" (info) isn't a dup/mislabel — it just isn't catalogued,
      // and a Fandom link never clears it, so it used to live here forever.
      f.problems.some(p => !INFO_PROBLEMS.has(p)) &&
      // Once you've queued a fix for it, it's handled — drop it from the review.
      !fixes.has(f.id)).sort((a, b) => byRun(a.c, b.c));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagged, coversLoaded, fixes, byRun]);

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
  // Covers to jog the memory: a series' own books, ones with a cover first, lowest issue first.
  const byTitle = useMemo(() => {
    const g = new Map<string, Comic[]>();
    for (const c of comics) { const t = (c.Title || "").trim(); if (!g.has(t)) g.set(t, []); g.get(t)!.push(c); }
    const n = (x: unknown) => { const v = parseFloat(String(x ?? "").replace(/^#/, "")); return Number.isFinite(v) ? v : 1e9; };
    for (const list of g.values()) list.sort((a, b) => n(a.Issue) - n(b.Issue));
    return g;
  }, []);
  const coversFor = useCallback((title: string, vol?: string, max = 4) => {
    const all = byTitle.get((title || "").trim()) || [];
    const pool = vol ? all.filter(c => String(c.Volume || "1") === String(vol)) : all;
    const list = pool.length ? pool : all;
    return [...list.filter(c => coverUrlSync(c)), ...list.filter(c => !coverUrlSync(c))].slice(0, max);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byTitle, coversLoaded]);
  const strip = (list: Comic[], w = 54) => list.length > 0 && (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {list.map((c, i) => (
        <div key={i} style={{ textAlign: "center", width: w }}>
          <CoverImage comic={c} width={w} height={Math.round(w * 1.5)} style={{ borderRadius: 3 }} onClick={large => setCoverModal({ comic: c, large })} />
          <div style={{ fontSize: "0.68rem", color: "var(--muted2,#aaa)" }}>#{c.Issue}</div>
        </div>
      ))}
    </div>
  );
  const comicByKey = useMemo(() => {
    const m = new Map<string, Comic>();
    for (const c of comics) {
      const k = normTitleKey(c.Title || "") + "|||" + String(c.Issue ?? "").replace(/^#/, "");
      if (!m.has(k)) m.set(k, c);
    }
    return m;
  }, []);
  // Index previously-found Fandom links by exact lowercase title → the single
  // confirmed volume + page stem + wiki base, but ONLY for titles that map to one
  // volume (a title spanning several volumes can't be extrapolated safely — that's
  // the Avengers-clobber trap). Parsed straight from the URL path, no fetch.
  const linkIndex = useMemo(() => {
    const vols: Record<string, Set<string>> = {};
    const stem: Record<string, { base: string; stem: string }> = {};
    for (const [k, url] of Object.entries(fandomLinks)) {
      const t = (k.split("|||")[0] || "").trim().toLowerCase();
      const m = (url || "").match(/\/wiki\/(.+?)_Vol_(\d+)(?:_|$)/);
      if (!t || !m) continue;
      (vols[t] ||= new Set()).add(m[2]);
      stem[t] = { base: (url.split("/wiki/")[0] || ""), stem: m[1] };
    }
    const out: Record<string, { vol: string; base: string; stem: string }> = {};
    for (const t of Object.keys(vols)) {
      if (vols[t].size === 1) out[t] = { vol: [...vols[t]][0], ...stem[t] };
    }
    return out;
  }, [fandomLinks]);

  // Cover guesses: every no-cover book whose title has a single-volume sibling
  // link → construct a candidate Fandom URL. `confident` = the page stem matches
  // the inventory title (low risk); otherwise it's a different-named page (the
  // "skipped" tier — e.g. a Mighty Thor row pointing at a Mortal Thor page), shown
  // with a warning so you verify before accepting.
  const coverGuesses = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const rows: { c: Comic; id: string; url: string; pageName: string; confident: boolean }[] = [];
    for (const f of flagged) {
      if (!f.problems.includes("no-cover")) continue;
      if (cgDismiss.has(f.id) || fixes.has(f.id)) continue;     // linked anywhere on the page -> gone
      const idx = linkIndex[(f.c.Title || "").trim().toLowerCase()];
      if (!idx) continue;
      const iss = String(f.c.Issue ?? "").replace(/^#/, "").trim();
      if (!iss) continue;
      const url = `${idx.base}/wiki/${idx.stem}_Vol_${idx.vol}_${encodeURIComponent(iss)}`;
      const pageName = idx.stem.replace(/_/g, " ");
      const it = norm(f.c.Title || ""), st = norm(pageName);
      const confident = it === st || it.includes(st) || st.includes(it);
      rows.push({ c: f.c, id: f.id, url, pageName, confident });
    }
    rows.sort((a, b) => Number(b.confident) - Number(a.confident) || byRun(a.c, b.c));
    return rows;
  }, [flagged, linkIndex, cgDismiss, fixes, byRun]);
  // Fandom-fill unresolved, minus books already linked anywhere on the page; biggest runs first.
  const openUnresolved = useMemo(() => {
    const withC = unresolved.map(u => ({ u, c: comicByKey.get(normTitleKey(u.title) + "|||" + String(u.issue).replace(/^#/, "")) }));
    return withC.filter(x => !x.c || !fixes.has(comicId(x.c)))
      .sort((a, b) => (a.c && b.c) ? byRun(a.c, b.c) : a.u.title.localeCompare(b.u.title)).map(x => x.u);
  }, [unresolved, comicByKey, fixes, byRun]);

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
      for (const [id, rec] of [...next]) if (!ids.has(id) && rec.kind === "solution" && !["arc-conflict", "series-match", "reclaim"].includes(rec.problem as string)) { next.delete(id); changed = true; }
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
  // share of the WHOLE collection still needing a fix - green under 3%, amber under 10%
  const share = comics.length ? (remaining / comics.length) * 100 : 0;
  const sharePct = share < 10 ? share.toFixed(1) : Math.round(share).toString();
  const shareGrad = share < 3 ? "linear-gradient(135deg,#22c55e,#06b6d4)"
    : share < 10 ? "linear-gradient(135deg,#f59e0b,#ec4899)" : "linear-gradient(135deg,#ef4444,#a855f7)";
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
  // ▲▼– per category vs the previous deploy (same store as the homepage; Nov 24).
  // Recorded only once covers have loaded, so a half-loaded page never becomes the baseline.
  const [dfPrev, setDfPrev] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!coversLoaded) return;
    const now: Record<string, number> = { dfTotal: remaining };
    PROBLEMS.forEach(p => { if (!p.info) now[`df:${p.id}`] = counts[p.id] || 0; });
    setDfPrev(deployPrev(now));
  }, [coversLoaded, counts, remaining]);

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

  // Arc-name conflicts still open: not decided here, not remembered as "keep", and
  // not already changed in the data (Comic Vine name applied / a new Fandom source).
  const comicIndex = useMemo(() => new Map(comics.map(c => [comicId(c), c])), []);
  const openArcConflicts = useMemo(() => arcConflicts.map(a => ({ a, c: comicIndex.get(a.id) })).filter(({ a, c }) => {
    if (fixes.has(`${a.id}|||arc`)) return false;
    if ((resolvedFlags[a.id] || []).includes("arc-conflict")) return false;
    const cur = c as (Comic & { Story_Arc?: string; Arc_Source?: string }) | undefined;
    if (cur?.Story_Arc && cur.Story_Arc === cleanArc(a.cv.name)) return false;
    if (cur?.Arc_Source && a.fandom.source && cur.Arc_Source !== a.fandom.source) return false;
    return true;
  }), [arcConflicts, comicIndex, fixes, resolvedFlags]);

  // Held: a bulk "map all green" pick whose Fandom name doesn't fit your title - needs a
  // one-by-one yes/no. A fresh decision other than a bulk "map:" clears it.
  const openHeld = useMemo(() => seriesHeld.filter(h => heldHints[h.key]?.hint !== "stale").filter(h => {
    const f = fixes.get(`${h.key}|||series`) as unknown as { value?: string } | undefined;
    const v = String(f?.value || ""); return !v || v.startsWith("map:");
  }), [seriesHeld, fixes, heldHints]);
  // Reclaim: books that dropped out of the inventory (history scan, Nov 19). A click
  // records Still own / Sold and the book leaves the list; Export carries the answers.
  // Restored books (Nov 19 reclaim): looked up LIVE by entry number, so a book leaves
  // "Needs a box" as soon as its Box # is no longer UNKNOWN in the deployed data.
  const restored = useMemo(() => {
    if (!restoredData) return null;
    const byEntry = new Map(comics.map(c => [String((c as { Entry?: string }).Entry ?? ""), c]));
    const rows = restoredData.restored.map(r => ({ ...r, c: byEntry.get(String(r.entry)) }))
      .filter((r): r is { entry: string; old: string; dropped: string; c: Comic } => !!r.c);
    const k = (c: Comic) => `${c.Title}|||${String(c.Issue).replace(/^#/, "")}|||${c.Volume || "1"}`;
    const n = new Map<string, number>();
    rows.forEach(r => n.set(k(r.c), (n.get(k(r.c)) || 0) + 1));
    const isUnknown = (c: Comic) => /^UNKNOWN/i.test(String(c.Box || ""));
    return { rows, unknown: rows.filter(r => isUnknown(r.c)), copies: rows.filter(r => (n.get(k(r.c)) || 0) > 1),
             placed: rows.filter(r => !isUnknown(r.c)) };
  }, [restoredData]);
  const openReclaim = useMemo(() => reclaim.filter(r => !fixes.has(`reclaim|||${r.id}`)), [reclaim, fixes]);
  const reclaimDone = useMemo(() => {
    let own = 0, sold = 0;
    for (const r of reclaim) { const f = fixes.get(`reclaim|||${r.id}`) as unknown as { value?: string } | undefined; if (f?.value === "own") own++; else if (f?.value === "sold" || f?.value === "same") sold++; }
    return { own, sold, t1: openReclaim.filter(r => r.tier !== 2).length, t2: openReclaim.filter(r => r.tier === 2).length };
  }, [reclaim, fixes, openReclaim]);
  const reclaimGroups = useMemo(() => {
    const g = new Map<string, Reclaim[]>();
    for (const r of openReclaim) { if ((r.tier === 2 ? 2 : 1) !== rcTier) continue; if (!g.has(r.title)) g.set(r.title, []); g.get(r.title)!.push(r); }
    const num = (x: string) => { const n = parseFloat(x); return Number.isFinite(n) ? n : 1e9; };
    return [...g.entries()].map(([t, rows]) => [t, rows.sort((a, b) => num(a.issue) - num(b.issue))] as const)
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [openReclaim, rcTier]);
  const rcComic = (r: Reclaim) => ({ Title: r.title, Issue: r.issue, Year: r.year, Publisher: r.pub, Volume: r.vol, Box: r.box } as unknown as Comic);
  const rcCover = (r: Reclaim, w: number) => {
    const rec = rcCovers[r.id];
    return rec
      ? <img src={rec.url} alt={`${r.title} #${r.issue}`} loading="lazy" width={w} height={Math.round(w * 1.5)}
          style={{ width: w, height: Math.round(w * 1.5), display: "block", overflow: "hidden", flexShrink: 0, fontSize: 0, objectFit: "cover", borderRadius: 4, cursor: "zoom-in", background: "#0d0d12" }}
          onClick={() => setCoverModal({ comic: rcComic(r), large: rec.large })} />
      : <CoverImage comic={rcComic(r)} width={w} height={Math.round(w * 1.5)} style={{ borderRadius: 4 }}
          onClick={large => setCoverModal({ comic: rcComic(r), large })} />;
  };
  const decideReclaim = useCallback((list: Reclaim[], value: "own" | "sold" | "same") => {
    const at = new Date().toISOString();
    setFixes(prev => {
      const n = new Map(prev);
      for (const r of list) {
        const id = `reclaim|||${r.id}`;
        n.set(id, { id, title: r.title, issue: r.issue, box: r.box, problem: "reclaim", kind: "solution", value, at,
                    year: r.year, vol: r.vol, pub: r.pub, entry: r.id, dropped: r.dropped, tier: r.tier } as unknown as FixRecord);
      }
      saveFixes(n); return n;
    });
    setRcUndo(u => [...u.slice(-19), list.map(r => `reclaim|||${r.id}`)]);
    setMeta(bumpStreak()); setPop(p => p + 1);
  }, []);
  const undoReclaim = useCallback(() => {
    setRcUndo(u => {
      const last = u[u.length - 1]; if (!last) return u;
      setFixes(prev => { const n = new Map(prev); for (const id of last) n.delete(id); saveFixes(n); return n; });
      return u.slice(0, -1);
    });
  }, []);
  const openSeries = useMemo(() => seriesMatch.filter(m => !fixes.has(`${m.key}|||series`) && !(m.key in seriesMapped)), [seriesMatch, fixes, seriesMapped]);
  const decideSeries = useCallback((list: SeriesMatch[], valueFor: (m: SeriesMatch) => string | null) => {
    const at = new Date().toISOString();
    setFixes(prev => {
      const n = new Map(prev);
      for (const m of list) {
        const value = valueFor(m); if (!value) continue;
        const id = `${m.key}|||series`;
        n.set(id, { id, title: m.title, issue: m.vol, box: "", problem: "series-match", kind: "solution", value, at, vol: m.vol, wiki: m.wiki } as unknown as FixRecord);
      }
      saveFixes(n); return n;
    });
    setMeta(bumpStreak()); setPop(p => p + 1);
  }, []);

  const resolve = useCallback((c: Comic, id: string, problem: ProblemId, kind: FixKind, value: string) => {
    // Shorthand in the link box ("Vol_8_18" or "Vol 8 18") -> the full Marvel/DC Fandom URL
    // for this book's title, so a typed volume+issue isn't silently ignored.
    if (kind === "fandom" && !/^https?:\/\//i.test(value)) {
      const sm = value.trim().match(/^Vol[_\s]*(\d+)[_\s]+(\S+)$/i);
      const pub = (c.Publisher || "").toLowerCase();
      const host = pub.includes("marvel") ? "marvel.fandom.com" : (pub === "dc" || pub.startsWith("dc ") || pub.includes("dc comics")) ? "dc.fandom.com" : "";
      if (sm && host) {
        const t = (c.Title || "").trim().replace(host.startsWith("marvel") ? /^The\s+/i : /^$/, "");
        value = `https://${host}/wiki/${encodeURIComponent(t.replace(/ /g, "_")).replace(/%3A/g, ":").replace(/%2F/g, "/").replace(/%27/g, "'")}_Vol_${sm[1]}_${sm[2]}`;
      }
    }
    // A confirmed cover-buy variant also sets the cover flag (kind "variant")
    // so it shows in the cover audit / export, not just the data-fix export.
    if (value === "confirm-variant") {
      setCoverFlagKind({ Title: c.Title, Issue: c.Issue, Box: c.Box,
        Cover_Artist: c.Cover_Artist, Publisher: c.Publisher, Year: c.Year }, "variant");
    }
    const at = new Date().toISOString();
    const rec: FixRecord = { id, title: c.Title, issue: String(c.Issue ?? ""), box: c.Box ?? "", problem, kind, value, at,
                             year: String(c.Year ?? "").slice(0, 4), vol: String(c.Volume ?? "") };
    // One Fandom link clears the book EVERYWHERE on the page (Nov 20):
    //  · other copies of the same book (same title + issue + volume, other boxes) get the same
    //    link - it is the same book, so it applies to them too;
    //  · the other open issues of the same title + volume get the link with the issue number
    //    swapped ("auto": the Mac treats it as a guess - never changes Volume, stays year-checked,
    //    a dead page just skips). Everything they touch leaves the page.
    const extra: FixRecord[] = [];
    if (kind === "fandom" && /^https?:\/\//i.test(value)) {
      const iss = String(c.Issue ?? "").replace(/^#/, "").trim();
      const vol = String(c.Volume || "1");
      const tk = normTitleKey(c.Title || "");
      for (const o of comics) {
        const oid = comicId(o);
        if (oid === id || normTitleKey(o.Title || "") !== tk || String(o.Volume || "1") !== vol) continue;
        if (String(o.Issue ?? "").replace(/^#/, "").trim() === iss)
          extra.push({ id: oid, title: o.Title, issue: String(o.Issue ?? ""), box: o.Box ?? "", problem, kind, value, at,
                       year: String(o.Year ?? "").slice(0, 4), vol: String(o.Volume ?? "") });
      }
      const m = value.match(/^(https?:\/\/[^?#]+?_Vol_\d+)_([^?#/]+)$/);
      if (m && decodeURIComponent(m[2]) === iss) {
        for (const f of flaggedRef.current) {
          const o = f.c, oi = String(o.Issue ?? "").replace(/^#/, "").trim();
          if (f.id === id || !oi || oi === iss || normTitleKey(o.Title || "") !== tk || String(o.Volume || "1") !== vol) continue;
          if (!/^[\d.]+$/.test(oi)) continue;               // only plain issue numbers extrapolate
          extra.push({ id: f.id, title: o.Title, issue: String(o.Issue ?? ""), box: o.Box ?? "", problem: "extrapolated",
                       kind, value: `${m[1]}_${encodeURIComponent(oi)}`, at, auto: true,
                       year: String(o.Year ?? "").slice(0, 4), vol: String(o.Volume ?? "") });
        }
      }
    }
    const ids = [id, ...extra.map(e => e.id)];
    setLeaving(prev => { const n = new Set(prev); ids.forEach(x => n.add(x)); return n; });
    if (extra.length) setSpreadNote(`🔗 ${c.Title} #${String(c.Issue).replace(/^#/, "")}: link also queued for ${extra.length} more issue${extra.length === 1 ? "" : "s"} / copies — they left the page`);
    setTimeout(() => {
      setFixes(prev => {
        const n = new Map(prev); n.set(id, rec);
        for (const e of extra) if (!n.has(e.id)) n.set(e.id, e);   // never overwrite something you chose
        saveFixes(n); return n;
      });
      setLeaving(prev => { const n = new Set(prev); ids.forEach(x => n.delete(x)); return n; });
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
        {/* Perspective: the open problems as a share of the whole collection (Nov 26) */}
        <div className="df-share" title={`${remaining.toLocaleString()} of ${comics.length.toLocaleString()} books still need a fix`}>
          <div className="df-share-n" style={{ backgroundImage: shareGrad }}>{sharePct}%</div>
          <div className="df-streak-lbl">of the collection</div>
          <div className="df-today">{remaining.toLocaleString()} of {comics.length.toLocaleString()} books</div>
        </div>
      </div>

      {/* How the page works — the loop, so the "where does this go?" is always on screen */}
      <details className="df-guide df-flow" open={flowOpen} onToggle={e => setFlowOpen((e.target as HTMLDetailsElement).open)}>
        <summary>🔁 How Data Fix works (the 4-step loop)</summary>
        <ol>{FLOW.map((f, i) => <li key={i}>{f}</li>)}</ol>
        <p>Each section below starts closed and is sorted biggest job first (most to solve at the top). Open one, and its 📘 guide explains what the problem is, why it happens, and exactly how to clear it.</p>
      </details>

      {spreadNote && (
        <div onClick={() => setSpreadNote("")} style={{ margin: "0 0 12px", padding: "8px 12px", borderRadius: 8, background: "rgba(22,163,74,0.12)", border: "1px solid #16a34a", fontSize: "0.85rem", cursor: "pointer" }}>
          {spreadNote} <span style={{ color: "var(--muted,#888)" }}>· tap to dismiss</span>
        </div>
      )}

      {/* Category chips */}
      <div className="df-chips">
        <button className={`df-chip${activeProblem === "all" ? " on" : ""}`} onClick={() => setActiveProblem("all")}>
          All problems <span className="df-chip-n">{remaining.toLocaleString()}</span> <Trend now={remaining} prev={dfPrev.dfTotal} goodUp={false} />
        </button>
        {PROBLEMS.map(p => (
          <button key={p.id} className={`df-chip${activeProblem === p.id ? " on" : ""}${p.info ? " info" : ""}`}
            style={{ ["--pc" as string]: p.color }} onClick={() => setActiveProblem(p.id)}
            title={p.info ? "Informational — not counted toward work to do" : undefined}>
            {p.info ? "ⓘ " : ""}{p.label} <span className="df-chip-n" style={{ background: p.color }}>{counts[p.id] || 0}</span>
            {!p.info && <> <Trend now={counts[p.id] || 0} prev={dfPrev[`df:${p.id}`]} goodUp={false} /></>}
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

      {/* Every section below sits in one column ordered by its count: biggest job first (Nov 26). */}
      <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Fandom linked — flagged books that already have a Fandom-sourced cover.
          Collapsed by default; these are the likely duplication / mislabel cases. */}
      {fandomLinked.length > 0 && (
        <section className="df-group" style={{ marginBottom: 14, order: -(fandomLinked.length) }}>
          <button className="df-group-hd" onClick={() => setFlOpen(o => !o)} style={{ borderLeft: "4px solid #7c3aed" }}>
            <span className="df-group-name">
              <span className="df-chev">{flOpen ? "▾" : "▸"}</span> 🔗 Fandom linked — likely duplication/mislabel
            </span>
            <span className="df-chip-n">{fandomLinked.filter(f => !flDupOk.has(f.id)).length}</span>
          </button>
          {flOpen && (
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              <Guide id="fandom-linked" />
              <div style={{ fontSize: "0.78rem", color: "var(--muted2,#aaa)" }}>
                Already carry a Fandom cover, so likely a dup or mislabel. If the cover is for the <b>wrong</b> issue/volume, paste the correct Fandom page link — it overwrites the row's volume next run. If the cover is <b>right</b>, tick <b>Cover's correct</b> to clear it from the queue.
                {flDupOk.size > 0 && <> · <button className="df-find" style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }} onClick={() => setFlDupOk(new Set())}>{flDupOk.size} confirmed — show again</button></>}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {fandomLinked.filter(f => !flDupOk.has(f.id)).map((f, i) => {
                const saved = fixes.has(f.id);
                return (
                  <div key={f.id + i} style={{ display: "flex", flexDirection: "column", gap: 6, width: 170, border: "1px solid var(--border,#2c2c38)", borderRadius: 8, padding: 8, fontSize: "0.8rem" }}>
                    <CoverImage comic={f.c} width={150} height={225} objectFit="contain" style={{ borderRadius: 4, background: "#0d0d12", border: "1px solid var(--border,#2c2c38)" }} onClick={(large) => setCoverModal({ comic: f.c, large })} />
                    <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <a href={`https://www.google.com/search?q=${encodeURIComponent(`${f.c.Title} #${f.c.Issue} fandom comic`)}`} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{f.c.Title} #{f.c.Issue} 🔍↗</a>
                    </div>
                    <div style={{ color: "var(--muted2,#aaa)", fontSize: "0.72rem" }}>Box {f.c.Box || "—"} · {f.problems.join(", ")}</div>
                    <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.75rem", cursor: "pointer", color: "#16a34a" }}>
                      <input type="checkbox" checked={false} onChange={() => setFlDupOk(s => new Set(s).add(f.id))} /> Cover's correct
                    </label>
                    {saved ? <span style={{ color: "#16a34a", fontWeight: 700 }}>✓ link queued</span> : (
                      <div className="df-linkrow" style={{ display: "flex", gap: 4 }}>
                        <input className="df-link-in" style={{ flex: 1, minWidth: 0 }} placeholder="Wrong? paste link…"
                          value={linkDraft[f.id] || ""} onChange={e => setLinkDraft(d => ({ ...d, [f.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter" && (linkDraft[f.id] || "").trim()) resolve(f.c, f.id, f.problems[0] || "no-date", "fandom", linkDraft[f.id].trim()); }} />
                        <button className="df-link-save" disabled={!(linkDraft[f.id] || "").trim()}
                          onClick={() => resolve(f.c, f.id, f.problems[0] || "no-date", "fandom", (linkDraft[f.id] || "").trim())}>Save</button>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Cover guesses — no-cover books where a previously-found sibling link lets
          us CONSTRUCT a candidate Fandom URL. Confident (page name matches title)
          first, then the "skipped" tier (different-named page) with a warning. You
          Use / paste / dismiss each; accepted ones queue like any Fandom fix. */}
      {coverGuesses.length > 0 && (
        <section className="df-group" style={{ marginBottom: 14, order: -(coverGuesses.length) }}>
          <button className="df-group-hd" onClick={() => setCgOpen(o => !o)} style={{ borderLeft: "4px solid #0d9488" }}>
            <span className="df-group-name">
              <span className="df-chev">{cgOpen ? "▾" : "▸"}</span> 🧩 Cover guesses — verify &amp; apply
            </span>
            <span className="df-chip-n">{coverGuesses.length}</span>
          </button>
          {cgOpen && (
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              <Guide id="cover-guesses" />
              <div style={{ fontSize: "0.78rem", color: "var(--muted2,#aaa)" }}>
                Built from a sibling issue's confirmed link. <b style={{ color: "#16a34a" }}>✓</b> = page name matches the title (safe). <b style={{ color: "#d97706" }}>⚠</b> = a <i>different-named</i> page (could be the wrong book) — open it first. <b>Use this</b> queues it; the Mac run fetches it and a dead page self-skips.
              </div>
              {coverGuesses.map(g => {
                const saved = fixes.has(g.id);
                return (
                  <div key={g.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", border: "1px solid var(--border,#2c2c38)", borderRadius: 6, padding: "6px 9px", fontSize: "0.82rem" }}>
                    <CoverImage comic={g.c} width={34} height={51} />
                    <div style={{ minWidth: 150, flex: "0 1 auto" }}>
                      <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        <span style={{ color: g.confident ? "#16a34a" : "#d97706" }}>{g.confident ? "✓" : "⚠"}</span> {g.c.Title} #{g.c.Issue}
                      </div>
                      <div style={{ color: "var(--muted2,#aaa)" }}>Box {g.c.Box || "—"} · page: {g.pageName}</div>
                    </div>
                    {saved ? <span style={{ color: "#16a34a", fontWeight: 700 }}>✓ queued</span> : (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", flex: 1, minWidth: 260 }}>
                        <a className="df-find" href={g.url} target="_blank" rel="noopener noreferrer">Check guess ↗</a>
                        <button className="df-link-save" onClick={() => resolve(g.c, g.id, "no-cover", "fandom", g.url)}>Use this</button>
                        <input className="df-link-in" style={{ flex: 1, minWidth: 140 }} placeholder="…or paste the right link"
                          value={linkDraft[g.id] || ""} onChange={e => setLinkDraft(d => ({ ...d, [g.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter" && (linkDraft[g.id] || "").trim()) resolve(g.c, g.id, "no-cover", "fandom", linkDraft[g.id].trim()); }} />
                        <button className="df-link-save" style={{ background: "transparent", color: "var(--muted,#888)" }}
                          title="Not this book — hide this guess"
                          onClick={() => setCgDismiss(s => new Set(s).add(g.id))}>✕</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Series match — series our arc fetch couldn't find on Fandom. A candidate page is
          proposed (verified = your issue exists there with the right year). Map = lookup only,
          your title stays; Map + rename only for genuine title errors (covers follow). */}
      {(openSeries.length > 0 || openHeld.length > 0) && (
        <section className="df-group" style={{ marginBottom: 14, order: -(openSeries.length + openHeld.length) }}>
          <button className="df-group-hd" onClick={() => setSmOpen(o => !o)} style={{ borderLeft: "4px solid #0891b2" }}>
            <span className="df-group-name"><span className="df-chev">{smOpen ? "▾" : "▸"}</span> 🧭 Series match — line your titles up with Fandom</span>
            <span className="df-chip-n">{openSeries.length + openHeld.length}</span>
          </button>
          {smOpen && (
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              <Guide id="series-match" />
              <div style={{ fontSize: "0.78rem", color: "var(--muted2,#aaa)" }}>
                <b>Map</b> = lookup only, your title stays (the default). <b>Map + rename</b> only when your title is actually wrong — covers follow the rename.
                <b style={{ color: SM_COLOR.high }}> ●</b> both test issues found with the right year · <b style={{ color: SM_COLOR.medium }}>●</b> one found · <b style={{ color: SM_COLOR.none }}>●</b> nothing verified — paste the right page.
              </div>
              {openHeld.length > 0 && (
                <div style={{ border: "1px solid #d97706", borderRadius: 6, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: "0.82rem" }}><b style={{ color: "#d97706" }}>⚠ {openHeld.length} held — the Fandom name doesn't match your title.</b> A year match alone isn't proof (e.g. "Low Slain" → Crime Syndicate). Confirm each one, paste the right page, or mark it not on Fandom.</div>
                  {openHeld.map(h => {
                    const m = { key: h.key, title: h.title, vol: h.vol, wiki: h.wiki } as unknown as SeriesMatch;
                    const draftId = `${h.key}|||series`;
                    const url = `https://${h.wiki === "DC" ? "dc" : "marvel"}.fandom.com/wiki/${encodeURIComponent(h.fandom.replace(/ /g, "_"))}`;
                    return (
                      <div key={h.key} style={{ borderTop: "1px solid var(--border,#2c2c38)", paddingTop: 6, fontSize: "0.82rem", display: "flex", flexDirection: "column", gap: 4 }}>
                        <div><b>{h.title}</b> <span style={{ color: "var(--muted2,#aaa)" }}>v{h.vol}</span> → {h.fandom} <span style={{ color: "var(--muted2,#aaa)" }}>· fit {Math.round(h.fit * 100)}%</span></div>
                        {heldHints[h.key]?.hint === "better" && heldHints[h.key].fandom && (
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", color: "#16a34a" }}>
                            <span>✓ Checked on Fandom: <b>{heldHints[h.key].fandom}</b> — {heldHints[h.key].why}</span>
                            <button className="df-link-save" onClick={() => decideSeries([m], () => `map!:${heldHints[h.key].fandom}`)}>Use this one</button>
                          </div>
                        )}
                        {strip(coversFor(h.title, h.vol))}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          <a className="df-find" href={url} target="_blank" rel="noopener noreferrer">open ↗</a>
                          <button className="df-link-save" onClick={() => decideSeries([m], () => `map!:${h.fandom}`)}>Yes, it's this</button>
                          <input className="df-link-in" style={{ flex: 1, minWidth: 160 }} placeholder="…or paste the right Fandom page"
                            value={linkDraft[draftId] || ""} onChange={e => setLinkDraft(d => ({ ...d, [draftId]: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter" && (linkDraft[draftId] || "").trim()) decideSeries([m], () => `link:${linkDraft[draftId].trim()}`); }} />
                          <button className="df-link-save" disabled={!(linkDraft[draftId] || "").trim()} onClick={() => decideSeries([m], () => `link:${(linkDraft[draftId] || "").trim()}`)}>Save link</button>
                          <button className="df-link-save" style={{ background: "transparent", color: "var(--muted,#888)" }} onClick={() => decideSeries([m], () => "skip-series")}>Not on Fandom</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {openSeries.some(m => m.conf === "high") && (
                <div><button className="df-link-save" onClick={() => {
                  const hi = openSeries.filter(m => m.conf === "high");
                  if (confirm(`Map all ${hi.length} green (fully verified) series to their proposed Fandom page? Titles are NOT renamed.`))
                    decideSeries(hi, m => m.best ? `map:${m.best.base}` : null);
                }}>✓ Map all {openSeries.filter(m => m.conf === "high").length} green matches</button></div>
              )}
              {openSeries.map(m => {
                const chosen = smPick[m.key] || m.best?.base || "";
                const cand = m.cands.find(c => c.base === chosen);
                const draftId = `${m.key}|||series`;
                return (
                  <div key={m.key} style={{ border: "1px solid var(--border,#2c2c38)", borderRadius: 6, padding: "8px 10px", fontSize: "0.82rem", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div><b>{m.title}</b> <span style={{ color: "var(--muted2,#aaa)" }}>v{m.vol} · {m.wiki} · {m.years.join("–")} · {m.count} book{m.count === 1 ? "" : "s"} (#{m.issues.slice(0, 6).join(", #")}{m.issues.length > 6 ? "…" : ""})</span>
                      <span style={{ marginLeft: 8, color: SM_COLOR[m.conf], fontWeight: 700 }}>● {m.conf === "none" ? "no verified match" : m.conf}</span></div>
                    {strip(coversFor(m.title, m.vol))}
                    {m.cands.length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {m.cands.map(c => (
                          <button key={c.base} onClick={() => setSmPick(p => ({ ...p, [m.key]: c.base }))}
                            style={{ border: `1px solid ${c.base === chosen ? "#0891b2" : "var(--border,#2c2c38)"}`, background: c.base === chosen ? "rgba(8,145,178,0.15)" : "transparent",
                              borderRadius: 999, padding: "3px 9px", cursor: "pointer", fontSize: "0.78rem", color: "inherit" }}>
                            {c.base} <span style={{ color: c.verified ? SM_COLOR.high : "var(--muted2,#aaa)" }}>{c.verified}/{c.of}{c.years.length ? ` · ${c.years.join(",")}` : ""}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      {cand && <a className="df-find" href={cand.url} target="_blank" rel="noopener noreferrer">open ↗</a>}
                      <button className="df-link-save" disabled={!chosen} onClick={() => decideSeries([m], () => `map!:${chosen}`)}>Map</button>
                      <button className="df-link-save" style={{ background: "#b45309" }} disabled={!chosen}
                        onClick={() => { const t = chosen.replace(/\s+Vol \d+$/, ""); if (confirm(`Rename "${m.title}" to "${t}" everywhere? (covers follow)`)) decideSeries([m], () => `maprename:${chosen}`); }}>Map + rename</button>
                      <input className="df-link-in" style={{ flex: 1, minWidth: 160 }} placeholder="…or paste the right Fandom page"
                        value={linkDraft[draftId] || ""} onChange={e => setLinkDraft(d => ({ ...d, [draftId]: e.target.value }))}
                        onKeyDown={e => { if (e.key === "Enter" && (linkDraft[draftId] || "").trim()) decideSeries([m], () => `link:${linkDraft[draftId].trim()}`); }} />
                      <button className="df-link-save" disabled={!(linkDraft[draftId] || "").trim()} onClick={() => decideSeries([m], () => `link:${(linkDraft[draftId] || "").trim()}`)}>Save link</button>
                      <button className="df-link-save" style={{ background: "transparent", color: "var(--muted,#888)" }} onClick={() => decideSeries([m], () => "skip-series")}>Not on Fandom</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 📋 Open items — the open crosses from Claude's review (public/open_items.json). Each has
          the problem, a best-guess page, and ✏️ Edit, which starts a ‹ Prev / Next › session on Edit Comic. */}
      {openItems && (openItems.items.length + openItems.tasks.length) > 0 && (() => {
        const live = openItems.items.filter(it => comics.some(c => c.Title === it.title && String(c.Issue).replace(/^#/, "") === String(it.issue).replace(/^#/, "")));
        const pubOf = (it: FocusItem) => comics.find(c => c.Title === it.title && String(c.Issue).replace(/^#/, "") === String(it.issue).replace(/^#/, ""));
        const withLinks: FocusItem[] = live.map(it => {
          const c = pubOf(it);
          return it.link ? it : { ...it, link: c ? fandomGuess({ ...c, Volume: it.volume || c.Volume }) : undefined, linkLabel: "Fandom guess" };
        });
        return (
          <section className="df-group" style={{ marginBottom: 14, order: -1000000 }}>
            <button className="df-group-hd" onClick={() => setOiOpen(o => !o)} style={{ borderLeft: "4px solid #e0a21b" }}>
              <span className="df-group-name"><span className="df-chev">{oiOpen ? "▾" : "▸"}</span> 📋 Open items — each with its next move</span>
              <span className="df-chip-n">{live.length + openItems.tasks.length}</span>
            </button>
            {oiOpen && (
              <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                {withLinks.length > 0 && (
                  <button className="df-link-save" style={{ alignSelf: "flex-start", background: "#e0a21b", color: "#111" }}
                    onClick={() => openFocus("Open items", withLinks, 0)}>▶ Work through all {withLinks.length} on Edit Comic (‹ Prev / Next ›)</button>
                )}
                {withLinks.map((it, i) => (
                  <div key={i} className="df-oi">
                    <div className="df-oi-hd"><b>{it.title} #{String(it.issue).replace(/^#/, "")}</b> <span>📦 {String(it.box || "").replace(/^UNKNOWN.*/, "UNKNOWN")}</span></div>
                    <div className="df-oi-p">{it.problem}</div>
                    {it.next && <div className="df-oi-p df-oi-next">→ <b>Next:</b> {it.next}</div>}
                    <div className="df-oi-btns">
                      {it.link && <a className="df-find" href={it.link} target="_blank" rel="noopener noreferrer">🔗 {it.linkLabel || "Check page"} ↗</a>}
                      <button className="df-solve" onClick={() => openFocus("Open items", withLinks, i)}>✏️ Edit</button>
                    </div>
                    {(() => {
                      // Nov 24: paste the fixing link right here (Fandom or Image Comics) - saved like any
                      // Data Fix link; Export + brb_all applies it (Image links via step 2a).
                      const c = pubOf(it);
                      if (!c) return null;
                      const fid = comicId(c);
                      const done = fixes.get(fid);
                      return done ? (
                        <div className="df-oi-p" style={{ color: "#16a34a" }}>✓ Link saved — ⬇ Export (top right), then run brb_all. <span style={{ color: "var(--muted2,#aaa)" }}>{String(done.value).slice(0, 80)}</span></div>
                      ) : (
                        <div className="df-linkrow">
                          <input className="df-link-in" placeholder="Paste the Fandom or Image Comics page that fixes it…"
                            value={linkDraft[fid] || ""} onChange={e => setLinkDraft(d => ({ ...d, [fid]: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter" && (linkDraft[fid] || "").trim()) resolve(c, fid, problemsFor(c)[0] || "no-cover", "fandom", linkDraft[fid].trim()); }} />
                          <button className="df-link-save" disabled={!(linkDraft[fid] || "").trim()}
                            onClick={() => resolve(c, fid, problemsFor(c)[0] || "no-cover", "fandom", (linkDraft[fid] || "").trim())}>Save link</button>
                        </div>
                      );
                    })()}
                  </div>
                ))}
                {openItems.tasks.map(t => (
                  <div key={t.id} className="df-oi" style={{ borderStyle: "dashed" }}>
                    <div className="df-oi-hd"><b>{t.title}</b></div>
                    <div className="df-oi-p">{t.problem}</div>
                    <div className="df-oi-p" style={{ color: "#b45309" }}>→ {t.action}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })()}

      {/* 📦 Restored books — the 744 put back on Nov 19 (brb_reclaim_restore.py). Live: a book
          leaves "Needs a box" once its Box # stops being UNKNOWN in the deployed data. */}
      {restored && restoredData && (
        <section className="df-group" style={{ marginBottom: 14, order: -(restored.unknown.length + restored.copies.length + restoredData.noIssue.length) }}>
          <button className="df-group-hd" onClick={() => setRsOpen(o => !o)} style={{ borderLeft: "4px solid #16a34a" }}>
            <span className="df-group-name"><span className="df-chev">{rsOpen ? "▾" : "▸"}</span> 📦 Restored books — {restored.rows.length} put back Nov 19</span>
            <span className="df-chip-n">{restored.unknown.length + restored.copies.length + restoredData.noIssue.length}</span>
          </button>
          {rsOpen && (
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              <Guide id="restored" />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {([["box", `📍 Needs a box (${restored.unknown.length})`], ["copy", `⚠ Copies to verify (${restored.copies.length})`],
                   ["noissue", `✋ Not restored — no issue # (${restoredData.noIssue.length})`], ["placed", `✓ Back in their box (${restored.placed.length})`],
                   ["skipped", `↷ Already in your data (${restoredData.alreadyThere.length})`]] as const).map(([t, label]) => (
                  <button key={t} onClick={() => { setRsTab(t); setRsTitle(null); }}
                    style={{ border: `1px solid ${rsTab === t ? "#16a34a" : "var(--border,#2c2c38)"}`, background: rsTab === t ? "rgba(22,163,74,0.12)" : "transparent", color: "inherit", borderRadius: 999, padding: "4px 10px", cursor: "pointer", fontSize: "0.78rem" }}>{label}</button>
                ))}
              </div>
              {(rsTab === "box" || rsTab === "copy" || rsTab === "placed") && (() => {
                const list = rsTab === "box" ? restored.unknown : rsTab === "copy" ? restored.copies : restored.placed;
                const g = new Map<string, typeof list>();
                for (const r of list) { const t = r.c.Title; if (!g.has(t)) g.set(t, []); g.get(t)!.push(r); }
                const num = (x: string) => { const v = parseFloat(String(x).replace(/^#/, "")); return Number.isFinite(v) ? v : 1e9; };
                const groups = [...g.entries()].map(([t, rows]) => [t, rows.sort((a, b) => num(a.c.Issue) - num(b.c.Issue))] as const)
                  .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
                if (!groups.length) return <div style={{ fontSize: "0.85rem", color: "#16a34a", fontWeight: 600 }}>🎉 Nothing left here.</div>;
                return groups.map(([title, rows]) => {
                  const open = rsTitle === title;
                  return (
                    <div key={title} style={{ border: "1px solid var(--border,#2c2c38)", borderRadius: 8 }}>
                      <button onClick={() => setRsTitle(open ? null : title)}
                        style={{ width: "100%", textAlign: "left", background: "none", border: "none", color: "inherit", cursor: "pointer", padding: "7px 10px", fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span className="df-chev">{open ? "▾" : "▸"}</span> <b>{title}</b> <span style={{ color: "var(--muted2,#aaa)" }}>· {rows.length} · #{rows.slice(0, 8).map(r => String(r.c.Issue).replace(/^#/, "")).join(", #")}{rows.length > 8 ? "…" : ""}</span>
                      </button>
                      {open && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "4px 10px 10px" }}>
                          {rows.map(r => (
                            <div key={r.entry} style={{ width: 120, display: "flex", flexDirection: "column", gap: 4, fontSize: "0.74rem" }}>
                              <CoverImage comic={r.c} width={120} height={180} style={{ borderRadius: 4 }} onClick={large => setCoverModal({ comic: r.c, large })} />
                              <div style={{ fontWeight: 700 }}>#{String(r.c.Issue).replace(/^#/, "")} <span style={{ color: "var(--muted2,#aaa)", fontWeight: 400 }}>v{r.c.Volume || "1"} · {r.c.Year}</span></div>
                              <div style={{ color: "var(--muted2,#aaa)" }}>was Box {r.old.replace(/^UNKNOWN.*/, "unknown")} → {/^UNKNOWN/i.test(String(r.c.Box)) ? <b style={{ color: "#d97706" }}>needs a box</b> : <b style={{ color: "#16a34a" }}>Box {r.c.Box}</b>}</div>
                              {onNavigate && (
                                <button className="df-solve" onClick={() => {
                                  const all = groups.flatMap(([, rs]) => rs);
                                  const why = (x: typeof r) => rsTab === "copy" ? `Restored Nov 19 as an extra copy (⚠ Verify Duplicate) — confirm you really own two, else tick Delete.`
                                    : rsTab === "box" ? `Restored Nov 19; its old box (${x.old.replace(/^UNKNOWN.*/, "unknown")}) is gone or full — find it and set its real Box #.`
                                    : `Restored Nov 19 into Box ${x.c.Box} (was ${x.old}).`;
                                  openFocus(rsTab === "copy" ? "Restored copies to verify" : rsTab === "box" ? "Restored books needing a box" : "Restored books",
                                    all.map(x => ({ title: x.c.Title, issue: String(x.c.Issue), box: String(x.c.Box), volume: String(x.c.Volume || "1"), problem: why(x), link: fandomGuess(x.c), linkLabel: "Fandom guess" })),
                                    all.indexOf(r));
                                }}>
                                  ✏️ {rsTab === "copy" ? "Check / delete copy" : "Set box"}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
              {rsTab === "box" && onNavigate && (
                <button className="df-link-save" style={{ alignSelf: "flex-start" }} onClick={() => onNavigate("locationcheck")}>🗺️ Open “Where Is It?” to walk your boxes</button>
              )}
              {rsTab === "noissue" && (
                <div style={{ fontSize: "0.82rem", display: "flex", flexDirection: "column", gap: 4 }}>
                  {restoredData.noIssue.map((r, i) => (
                    <div key={i}>• <b>{r.title}</b> <span style={{ color: "var(--muted2,#aaa)" }}>· vol {r.vol || "?"} · {r.year} · was Box {r.box} · {r.pub}</span> — <i>no issue number on the old row; find the book and add it via weekly intake</i></div>
                  ))}
                </div>
              )}
              {rsTab === "skipped" && (
                <div style={{ fontSize: "0.82rem", display: "flex", flexDirection: "column", gap: 4 }}>
                  {restoredData.alreadyThere.map((r, i) => (
                    <div key={i}>• <b>{r.title}</b> #{r.issue} <span style={{ color: "var(--muted2,#aaa)" }}>· vol {r.vol || "?"} · {r.year} · was Box {r.box}</span> — already in your data, not added twice</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Reclaim missing books — dropped out of the inventory in past deploys (mostly the
          Jun 15 one). Still own -> restored to its old box after you confirm; Sold -> left out. */}
      {(openReclaim.length > 0 || reclaimDone.own + reclaimDone.sold > 0) && (
        <section className="df-group" style={{ marginBottom: 14, order: -(openReclaim.length) }}>
          <button className="df-group-hd" onClick={() => setRcOpen(o => !o)} style={{ borderLeft: "4px solid #dc2626" }}>
            <span className="df-group-name"><span className="df-chev">{rcOpen ? "▾" : "▸"}</span> 🛟 Reclaim missing books — do you still own these?</span>
            <span className="df-chip-n">{openReclaim.length}</span>
          </button>
          {rcOpen && (
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              <Guide id="reclaim" />
              <div style={{ fontSize: "0.78rem", color: "var(--muted2,#aaa)" }}>
                These books were in your inventory and dropped out during a past update (most on Jun 15). Nothing is restored until you confirm the list.
                <b> Still own</b> = put it back in its old box · <b>Sold / gone</b> = leave it out. A click removes the book from this list; <b>Export</b> saves your answers.
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: "0.82rem" }}>
                <span>✓ restore <b>{reclaimDone.own}</b> · ✗ leave out <b>{reclaimDone.sold}</b> · left <b>{openReclaim.length}</b></span>
                <button className="df-link-save" disabled={!rcUndo.length} style={{ background: "transparent", color: "var(--muted,#888)" }} onClick={undoReclaim}>↶ Undo last</button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {([[1, `Tier 1 · not in your data in ANY volume (${reclaimDone.t1})`, reclaimDone.t1], [2, `Tier 2 · same title+issue exists in another volume/year (${reclaimDone.t2})`, reclaimDone.t2]] as const).filter(x => x[2] > 0).map(([t, label]) => (
                  <button key={t} onClick={() => { setRcTier(t); setRcTitle(null); }}
                    style={{ border: `1px solid ${rcTier === t ? "#dc2626" : "var(--border,#2c2c38)"}`, background: rcTier === t ? "rgba(220,38,38,0.12)" : "transparent", color: "inherit", borderRadius: 999, padding: "4px 10px", cursor: "pointer", fontSize: "0.78rem" }}>{label}</button>
                ))}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--muted2,#aaa)" }}>
                {rcTier === 1 ? <>Title + issue + volume checked: no copy of these exists today in any volume or the CC catalogs. <b>✓</b> = still own, restore it · <b>✗</b> = sold / gone.</>
                  : <>Your data still has this title + issue but in a <b>different volume or year</b> (shown under each book). <b>✓ Separate copy</b> = a second book that got lost, restore it · <b>✗ Same book</b> = it's the one already listed (its volume/year was just corrected).</>}
              </div>
              {reclaimGroups.map(([title, rows]) => {
                const open = rcTitle === title;
                return (
                  <div key={title} style={{ border: "1px solid var(--border,#2c2c38)", borderRadius: 6, fontSize: "0.82rem" }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", padding: "6px 10px" }}>
                      <button onClick={() => setRcTitle(open ? null : title)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, textAlign: "left", flex: 1, minWidth: 160 }}>
                        <span className="df-chev">{open ? "▾" : "▸"}</span> <b>{title}</b> <span style={{ color: "var(--muted2,#aaa)" }}>· {rows.length} · #{rows.slice(0, 8).map(r => r.issue).join(", #")}{rows.length > 8 ? "…" : ""}</span>
                      </button>
                      {!open && (
                        <div style={{ display: "flex", gap: 4, width: "100%", overflow: "hidden" }} onClick={() => setRcTitle(title)}>
                          {[...rows.filter(r => rcCovers[r.id]), ...rows.filter(r => !rcCovers[r.id])].slice(0, 6).map(r => (
                            <div key={r.id} style={{ flexShrink: 0 }}>{rcCover(r, 44)}</div>
                          ))}
                        </div>
                      )}
                      <button className="df-link-save" onClick={() => decideReclaim(rows, "own")}>{rcTier === 1 ? "✓ All still own" : "✓ All separate copies"}</button>
                      <button className="df-link-save" style={{ background: "#6b7280" }} onClick={() => decideReclaim(rows, rcTier === 1 ? "sold" : "same")}>{rcTier === 1 ? "✗ All sold" : "✗ All same book"}</button>
                    </div>
                    {open && (
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "4px 10px 10px" }}>
                        {rows.map(r => (
                          <div key={r.id} style={{ width: 112, display: "flex", flexDirection: "column", gap: 4, alignItems: "center", textAlign: "center" }}>
                            {rcCover(r, 90)}
                            <a className="df-find" href={fandomSearch(rcComic(r))} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.7rem" }}>🔍 Fandom ↗</a>
                            <div><b>#{r.issue}</b> · Vol {r.vol || "?"} · {r.year}<br /><span style={{ color: "var(--muted2,#aaa)" }}>was Box {r.box} · {r.dropped.slice(5)}</span>
                              {r.tier === 2 && r.today && <><br /><span style={{ color: "#d97706" }}>today: {r.today}</span></>}</div>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button className="df-link-save" style={{ padding: "3px 8px" }} title="Still own - restore it" onClick={() => decideReclaim([r], "own")}>✓</button>
                              <button className="df-link-save" style={{ padding: "3px 8px", background: "#6b7280" }} title={r.tier === 2 ? "Same book - already listed" : "Sold / gone"} onClick={() => decideReclaim([r], r.tier === 2 ? "same" : "sold")}>✗</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Arc-name conflicts — Fandom and Comic Vine name a different story arc for
          the same book. Keep Fandom, take Comic Vine, or paste the right Fandom page
          (the Mac run reads the arc off that page). */}
      {openArcConflicts.length > 0 && (
        <section className="df-group" style={{ marginBottom: 14, order: -(openArcConflicts.length) }}>
          <button className="df-group-hd" onClick={() => setAcOpen(o => !o)} style={{ borderLeft: "4px solid #4f46e5" }}>
            <span className="df-group-name">
              <span className="df-chev">{acOpen ? "▾" : "▸"}</span> 🧭 Arc conflicts — Fandom vs Comic Vine
            </span>
            <span className="df-chip-n">{openArcConflicts.length}</span>
          </button>
          {acOpen && (
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              <Guide id="arc-conflict" />
              <div style={{ fontSize: "0.78rem", color: "var(--muted2,#aaa)" }}>
                The two sources call this book's story arc different things. Open either page to check, then <b>Keep Fandom</b>, <b>Use Comic Vine</b>,
                or paste the correct Fandom issue page — the next <code>brb_all</code> reads the arc off that page (and fixes the volume from the link).
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button className="df-link-save" onClick={() => {
                  if (!confirm(`Keep Fandom's arc for all ${openArcConflicts.length} remaining conflicts? (Each is remembered and never re-asked.)`)) return;
                  const at = new Date().toISOString();
                  setFixes(prev => {
                    const n = new Map(prev);
                    for (const { a } of openArcConflicts) n.set(`${a.id}|||arc`, { id: `${a.id}|||arc`, title: a.title, issue: a.issue, box: a.box,
                      problem: "arc-conflict", kind: "solution", value: "keep-fandom", at } as FixRecord);
                    saveFixes(n); return n;
                  });
                  setMeta(bumpStreak()); setPop(p => p + 1);
                }}>✓ Keep Fandom for all {openArcConflicts.length}</button>
                <span style={{ fontSize: "0.78rem", color: "var(--muted2,#aaa)" }}>Pick Comic Vine / paste a link on the exceptions first — then sweep the rest.</span>
              </div>
              {openArcConflicts.map(({ a, c }) => {
                const aid = `${a.id}|||arc`;
                const book = c ?? ({ Title: a.title, Issue: a.issue, Box: a.box, Volume: a.vol, Year: String(a.year ?? "") } as unknown as Comic);
                return (
                  <div key={aid} style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap", border: "1px solid var(--border,#2c2c38)", borderRadius: 6, padding: "8px 10px", fontSize: "0.82rem" }}>
                    <CoverImage comic={book} width={44} height={66} />
                    <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{a.title} #{a.issue} <span style={{ fontWeight: 400, color: "var(--muted2,#aaa)" }}>· Vol {a.vol || "1"} · {a.year ?? "—"} · Box {a.box || "—"}</span></div>
                      <div style={{ marginTop: 4 }}>
                        <span style={{ color: "#16a34a", fontWeight: 700 }}>Fandom:</span> {a.fandom.name || "—"}{partTxt(a.fandom)}
                        {a.fandom.source && <> · <a className="df-find" href={a.fandom.source} target="_blank" rel="noopener noreferrer">open ↗</a></>}
                      </div>
                      <div>
                        <span style={{ color: "#c2410c", fontWeight: 700 }}>Comic Vine:</span> {cleanArc(a.cv.name)}{partTxt(a.cv)}
                        {a.cv.url && <> · <a className="df-find" href={a.cv.url} target="_blank" rel="noopener noreferrer">open ↗</a></>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", flex: "1 1 300px" }}>
                      <button className="df-link-save" onClick={() => resolve(book, aid, "arc-conflict", "solution", "keep-fandom")}>Keep Fandom</button>
                      <button className="df-link-save" style={{ background: "#c2410c" }} onClick={() => resolve(book, aid, "arc-conflict", "solution", "use-cv")}>Use Comic Vine</button>
                      <input className="df-link-in" style={{ flex: 1, minWidth: 150 }} placeholder="…or paste the right Fandom page"
                        value={linkDraft[aid] || ""} onChange={e => setLinkDraft(d => ({ ...d, [aid]: e.target.value }))}
                        onKeyDown={e => { if (e.key === "Enter" && (linkDraft[aid] || "").trim()) resolve(book, aid, "arc-conflict", "fandom", linkDraft[aid].trim()); }} />
                      <button className="df-link-save" disabled={!(linkDraft[aid] || "").trim()}
                        onClick={() => resolve(book, aid, "arc-conflict", "fandom", (linkDraft[aid] || "").trim())}>Save link</button>
                    </div>
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
      {openUnresolved.length > 0 && (
        <section className="df-group" style={{ marginBottom: 14, order: -(openUnresolved.length) }}>
          <button className="df-group-hd" onClick={() => setUrOpen(o => !o)} style={{ borderLeft: "4px solid #0e7490" }}>
            <span className="df-group-name">
              <span className="df-chev">{urOpen ? "▾" : "▸"}</span> 🔍 Fandom fill — unresolved (investigate)
            </span>
            <span className="df-chip-n">{openUnresolved.length}</span>
          </button>
          {urOpen && (
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              <Guide id="unresolved" />
              <div style={{ fontSize: "0.78rem", color: "var(--muted2,#aaa)" }}>
                The wiki page didn't exist at run time — but if you find a working one, paste it and it applies next run (exactly like the other cards).
              </div>
              {openUnresolved.map((u, i) => {
                const c = comicByKey.get(normTitleKey(u.title) + "|||" + String(u.issue).replace(/^#/, ""));
                const id = c ? comicId(c) : "";
                const saved = !!id && fixes.has(id);
                return (
                  <div key={u.title + u.issue + i} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", padding: "6px 9px", borderBottom: "1px solid var(--border,#2c2c38)", fontSize: "0.82rem" }}>
                    {c && <CoverImage comic={c} width={60} height={90} style={{ borderRadius: 3, flexShrink: 0 }} onClick={large => setCoverModal({ comic: c, large })} />}
                    <div style={{ minWidth: 200, flex: 1 }}>
                      <a href={`https://www.google.com/search?q=${encodeURIComponent(`${u.title} #${u.issue} fandom comic`)}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: "inherit", textDecoration: "none" }}>{u.title} <b>#{u.issue}</b> 🔍↗</a>
                      <div style={{ color: "var(--muted2,#aaa)", fontSize: "0.72rem" }}>{u.reason}</div>
                    </div>
                    {c ? (
                      saved ? <span style={{ color: "#16a34a", fontWeight: 700 }}>✓ link queued</span> : (
                        <div className="df-linkrow" style={{ flex: 1, minWidth: 220, maxWidth: 420 }}>
                          <input className="df-link-in" placeholder="Paste Fandom or Image Comics link that fixes it…"
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
        <section className="df-group" style={{ marginBottom: 14, order: -(collisions.length + fuzzy.length) }}>
          <button className="df-group-hd" onClick={() => setTcOpen(o => !o)} style={{ borderLeft: "4px solid #b45309" }}>
            <span className="df-group-name"><span className="df-chev">{tcOpen ? "▾" : "▸"}</span> 🔤 Title cleanup — merge split spellings</span>
            <span className="df-chip-n">{collisions.length + fuzzy.length}</span>
          </button>
          {tcOpen && (
            <div style={{ padding: "10px 14px" }}>
              <Guide id="title-cleanup" />
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
                        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                          {g.spellings.map(sp => (
                            <div key={sp.t}>
                              <div style={{ fontSize: "0.68rem", color: "var(--muted2,#aaa)", marginBottom: 2, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sp.t}</div>
                              {strip(coversFor(sp.t, undefined, 3), 46)}
                            </div>
                          ))}
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
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "6px 0", fontSize: "0.8rem", borderBottom: "1px solid var(--border,#2c2c38)" }}>
                      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                        {[p.a, p.b].map(t => (
                          <div key={t}>
                            <div style={{ fontSize: "0.72rem", marginBottom: 2, maxWidth: 240 }}>{t}</div>
                            {strip(coversFor(t, undefined, 3), 46)}
                          </div>
                        ))}
                      </div>
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
        const gopen = openGroups[g.pid] ?? false;          // every section starts closed
        return (
          <section key={g.pid} className="df-group" style={{ order: -(g.count) }}>
            <button className="df-group-hd" onClick={() => setOpenGroups(o => ({ ...o, [g.pid]: !gopen }))}
              style={{ borderLeft: `4px solid ${g.problem.color}` }}>
              <span className="df-group-name"><span className="df-chev">{gopen ? "▾" : "▸"}</span> {g.problem.label}</span>
              <span className="df-group-meta"><span className="df-group-blurb">{g.problem.blurb}</span> <b style={{ color: g.problem.color }}>{g.count.toLocaleString()}</b>{!g.problem.info && <> <Trend now={counts[g.pid] || 0} prev={dfPrev[`df:${g.pid}`]} goodUp={false} /></>}</span>
            </button>
            {gopen && <Guide id={g.pid} />}
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
                          <button className="df-solve" onClick={() => {
                            const all = g.pubs.flatMap(pg => pg.items.map(x => x.c));
                            openFocus(g.problem.label, all.map(x => ({
                              title: x.Title, issue: String(x.Issue), box: String(x.Box), volume: String(x.Volume || "1"),
                              problem: `${g.problem.label} — ${g.problem.blurb}`, link: fandomGuess(x), linkLabel: "Fandom guess",
                            })), all.indexOf(c));
                          }}>✏️ Edit</button>
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
                        {g.pid === "cover-no-data" && (
                          <div style={{ fontSize: ".75rem", color: "#059669", margin: "2px 0" }}>
                            Missing: <b>{missingData(c).join(" · ")}</b>
                          </div>
                        )}
                        {g.pid === "likely-variant" && (
                          <div style={{ fontSize: ".72rem", color: "var(--muted,#888)", margin: "2px 0 -2px" }}>
                            Cover right? Hit <b>✓ Cover's right</b> above — skip the box below. The link is only for a wrong cover.
                          </div>
                        )}
                        <div className="df-linkrow">
                          <input className="df-link-in" placeholder="Paste Fandom or Image Comics link that fixes it…"
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
      </div>

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
.df-share{display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--surface2,#26262f);border:1px solid var(--border,#2c2c38);border-radius:12px;padding:10px 16px;min-width:96px;text-align:center}
.df-share-n{font-size:1.5rem;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums;-webkit-background-clip:text;background-clip:text;color:transparent}
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
.df-guide{margin:0 0 10px;padding:8px 12px;border:1px solid var(--border,#2c2c38);border-left:3px solid #2563eb;border-radius:8px;background:var(--surface2,rgba(127,127,127,.06));font-size:.82rem;line-height:1.5;overflow-wrap:anywhere}
.df-guide summary{cursor:pointer;font-weight:700}
.df-guide p{margin:6px 0}
.df-guide ol{margin:4px 0 4px 20px;padding:0}
.df-guide li{margin:2px 0}
.df-flow{margin:0 0 14px}
`;
