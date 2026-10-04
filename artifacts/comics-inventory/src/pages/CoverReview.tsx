import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { DATA, type Comic } from "@/data/data";
import { comicId, loadFlags, saveFlags, type FlaggedCover } from "./CoverCatalog";
import { clearAllFlags, exportFlags as exportFlagsLib } from "@/lib/coverFlags";
import { CoverModal } from "@/components/CoverImage";
import flaggedBaseline from "@/data/flaggedCoversBaseline.json";

const BASELINE_FLAGGED_IDS = new Set((flaggedBaseline as { id: string }[]).map(f => f.id));

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const LANES = 5;
const BATCH_SIZE = 20;
const CYCLE_MS = 30_000;
const PER_LANE = BATCH_SIZE / LANES;
const CARD_W = 150;   // cover thumbnail width  (was 96)
const CARD_H = 225;   // cover thumbnail height (was 144) — keeps the 2:3 ratio

interface Pooled {
  comic: Comic;
  url: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function CoverReview({ initTitle }: { initTitle?: string }) {
  const [pool, setPool]         = useState<Pooled[] | null>(null);
  const [coversMap, setCoversMap] = useState<Record<string, { url: string | null }>>({});
  const [batchStart, setBatchStart] = useState(0);
  const [flags, setFlags]       = useState<Map<string, FlaggedCover>>(() => loadFlags());
  const [msLeft, setMsLeft]     = useState(CYCLE_MS);
  const [paused, setPaused]     = useState(false);
  const [titleFilter, setTitleFilter] = useState<string | null>(initTitle || null);
  const [modal, setModal] = useState<{ comic: Comic; url: string } | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Build the review pool once: every comic that has a real (non-placeholder) cover,
  // excluding anything already flagged as an incorrect cover (baseline export or this
  // browser's live flags) - once it's confirmed wrong, no point re-showing it.
  useEffect(() => {
    let cancelled = false;
    const liveFlagged = loadFlags();
    fetch(`${BASE}/covers.json`)
      .then(r => r.json())
      .then((coversMap: Record<string, { url: string | null }>) => {
        if (cancelled) return;
        setCoversMap(coversMap);
        const seen = new Set<string>();
        const found: Pooled[] = [];
        for (const c of DATA.comics as Comic[]) {
          const vol = String(c.Volume || "1").trim();
          const key = `${c.Title}|||${c.Issue}|||${vol}`;
          if (seen.has(key)) continue;
          const flagId = comicId({ Title: c.Title, Issue: c.Issue, Box: c.Box });
          if (BASELINE_FLAGGED_IDS.has(flagId) || liveFlagged.has(flagId)) continue;
          const entry = coversMap[key] ?? coversMap[`${c.Title}|||${c.Issue}`];
          if (entry?.url) {
            seen.add(key);
            found.push({ comic: c, url: entry.url });
          }
        }
        setPool(shuffle(found));
      })
      .catch(() => setPool([]));
    return () => { cancelled = true; };
  }, []);

  // Deep-link from the homepage: a cover title opens this page already filtered
  // to that title ("Cover by Title"). Re-applies whenever the incoming title changes.
  useEffect(() => { setTitleFilter(initTitle || null); }, [initTitle]);

  // 30s auto-advance cycle — paused when the timer is stopped or a title is pinned.
  useEffect(() => {
    if (!pool || pool.length === 0 || paused || titleFilter) return;
    setMsLeft(CYCLE_MS);
    const startedAt = Date.now();
    tickRef.current = setInterval(() => {
      const left = CYCLE_MS - (Date.now() - startedAt);
      if (left <= 0) {
        setBatchStart(s => (s + BATCH_SIZE) % pool.length);
      } else {
        setMsLeft(left);
      }
    }, 250);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [pool, batchStart, paused, titleFilter]);

  // Every covered issue of the pinned title, ordered by issue number (then
  // volume), so the run reads straight through. Volume is surfaced per-cover
  // only when the title actually spans more than one volume.
  const titleView = useMemo(() => {
    if (!titleFilter) return { items: [] as Pooled[], volCount: 0 };
    const seen = new Set<string>();
    const items: Pooled[] = [];
    const vols = new Set<string>();
    for (const c of DATA.comics as Comic[]) {
      if (c.Title !== titleFilter) continue;
      const vol = String(c.Volume || "1").trim();
      const key = `${c.Title}|||${c.Issue}|||${vol}`;
      if (seen.has(key)) continue;
      const entry = coversMap[key] ?? coversMap[`${c.Title}|||${c.Issue}`];
      if (entry?.url) { seen.add(key); items.push({ comic: c, url: entry.url }); vols.add(vol); }
    }
    items.sort((a, b) => {
      const ia = parseFloat(String(a.comic.Issue)) || 0, ib = parseFloat(String(b.comic.Issue)) || 0;
      if (ia !== ib) return ia - ib;
      return (parseInt(String(a.comic.Volume || "1")) || 0) - (parseInt(String(b.comic.Volume || "1")) || 0);
    });
    return { items, volCount: vols.size };
  }, [titleFilter, coversMap]);

  const titleCount = titleView.items.length;

  const lanes = useMemo(() => {
    if (!pool || pool.length === 0) return [];
    const batch: Pooled[] = [];
    for (let i = 0; i < BATCH_SIZE && i < pool.length; i++) {
      batch.push(pool[(batchStart + i) % pool.length]);
    }
    const out: Pooled[][] = Array.from({ length: LANES }, () => []);
    batch.forEach((p, i) => out[i % LANES].push(p));
    return out;
  }, [pool, batchStart]);

  const toggleFlag = useCallback((p: Pooled) => {
    setFlags(prev => {
      const next = new Map(prev);
      const id = comicId({ Title: p.comic.Title, Issue: p.comic.Issue, Box: p.comic.Box });
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.set(id, {
          id,
          Title: p.comic.Title,
          Issue: p.comic.Issue,
          Box: p.comic.Box,
          Cover_Artist: p.comic.Cover_Artist,
          Publisher: p.comic.Publisher,
          Year: p.comic.Year,
          flaggedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        });
      }
      saveFlags(next);
      return next;
    });
  }, []);

  const exportFlags = useCallback(() => { exportFlagsLib(); }, []);

  const clearFlags = useCallback(() => {
    if (!window.confirm(`Clear all ${flags.size} flagged covers? This resets the count to 0 and cannot be undone (export first if you haven't).`)) return;
    clearAllFlags();
    setFlags(new Map());
  }, [flags.size]);

  const nextNow = useCallback(() => {
    if (!pool || pool.length === 0) return;
    setBatchStart(s => (s + BATCH_SIZE) % pool.length);
  }, [pool]);

  if (pool === null) {
    return <div style={{ padding: 40, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "var(--muted)" }}>Loading cover pool…</div>;
  }
  if (pool.length === 0) {
    return <div style={{ padding: 40, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "var(--muted)" }}>No covers found in covers.json.</div>;
  }

  const pct = Math.max(0, Math.min(100, 100 - (msLeft / CYCLE_MS) * 100));

  const card = (p: Pooled, k: string, showVol = false) => {
    const id = comicId({ Title: p.comic.Title, Issue: p.comic.Issue, Box: p.comic.Box });
    const flagged = flags.has(id);
    return (
      <div key={k} style={{ flexShrink: 0, width: CARD_W, textAlign: "center" }}>
        <div
          onClick={() => setModal({ comic: p.comic, url: p.url })}
          title="Open to mark incorrect / variant / dupe"
          style={{ width: CARD_W, height: CARD_H, borderRadius: 4, overflow: "hidden", background: "#1a1628", border: flagged ? "2px solid var(--red)" : "1px solid var(--border)", cursor: "pointer" }}
        >
          <img src={p.url} alt={`${p.comic.Title} ${p.comic.Issue}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="lazy" />
        </div>
        <button
          onClick={() => setTitleFilter(p.comic.Title)}
          title={`Show all ${p.comic.Title} issues`}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "0.9rem", color: "var(--red)", marginTop: 6, lineHeight: 1.3, overflow: "visible", whiteSpace: "normal", wordBreak: "break-word", textDecoration: "underline", width: "100%" }}
        >
          {p.comic.Title} #{p.comic.Issue}
        </button>
        {showVol && <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>Vol {p.comic.Volume || "1"}</div>}
        <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: "0.875rem", color: flagged ? "var(--red)" : "var(--muted)", cursor: "pointer", marginTop: 8 }}>
          <input type="checkbox" checked={flagged} onChange={() => toggleFlag(p)} />
          wrong
        </label>
      </div>
    );
  };

  return (
    <div style={{ padding: "20px 24px 60px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: "1.75rem", letterSpacing: "2px", color: "var(--text)" }}>
            {titleFilter ? (
              <><span style={{ fontSize: "0.7rem", letterSpacing: "2px", color: "var(--muted)", display: "block" }}>COVER BY TITLE</span>{titleFilter}</>
            ) : "Cover Review"}
          </div>
          <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
            {titleFilter
              ? `${titleCount} issue${titleCount === 1 ? "" : "s"}${titleView.volCount > 1 ? ` across ${titleView.volCount} volumes` : ""} · click "wrong" on any incorrect cover`
              : `${pool.length.toLocaleString()} covers in pool · batch ${Math.floor(batchStart / BATCH_SIZE) + 1} of ${Math.ceil(pool.length / BATCH_SIZE)} · ${flags.size} flagged so far`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {titleFilter ? (
            <button onClick={() => setTitleFilter(null)} style={btnStyle(false)}>← All covers</button>
          ) : (
            <>
              <button onClick={() => setPaused(p => !p)} style={btnStyle(false)}>{paused ? "▶ Resume" : "⏸ Pause"}</button>
              <button onClick={nextNow} style={btnStyle(false)}>Skip batch →</button>
            </>
          )}
          <button onClick={exportFlags} style={btnStyle(true)}>Export flagged ({flags.size})</button>
          {flags.size > 0 && (
            <button onClick={clearFlags} style={{ ...btnStyle(false), color: "var(--red)", borderColor: "var(--red)" }}>Clear flags</button>
          )}
        </div>
      </div>

      {!titleFilter && (
        <div style={{ height: 3, background: "var(--border)", borderRadius: 2, marginBottom: 20, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${paused ? 0 : pct}%`, background: paused ? "var(--muted)" : "var(--red)", transition: "width 0.25s linear" }} />
        </div>
      )}

      {titleFilter ? (
        titleCount === 0 ? (
          <div style={{ color: "var(--muted)", marginTop: 20 }}>No covered issues found for this title.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 20 }}>
            {titleView.items.map((p, i) => card(p, `t-${i}`, titleView.volCount > 1))}
          </div>
        )
      ) : (
        lanes.map((lane, li) => (
          <div key={li} style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: "0.875rem", letterSpacing: "1.5px", color: "var(--muted)", marginBottom: 6 }}>
              LANE {li + 1}
            </div>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
              {lane.map((p, i) => card(p, `${comicId({ Title: p.comic.Title, Issue: p.comic.Issue, Box: p.comic.Box })}-${i}`))}
            </div>
          </div>
        ))
      )}

      {modal && (
        <CoverModal
          comic={modal.comic}
          largeUrl={modal.url}
          onClose={() => { setModal(null); setFlags(loadFlags()); }}
        />
      )}
    </div>
  );
}

function btnStyle(primary: boolean): React.CSSProperties {
  return {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: "0.875rem", letterSpacing: "1px",
    padding: "8px 14px", borderRadius: 6, cursor: "pointer",
    background: primary ? "var(--red)" : "var(--surface2)",
    color: primary ? "#fff" : "var(--muted2)",
    border: primary ? "none" : "1px solid var(--border)",
  };
}
