import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { DATA, type Comic } from "@/data/data";
import { comicId, loadFlags, saveFlags, type FlaggedCover } from "./CoverCatalog";
import { clearAllFlags, exportFlags as exportFlagsLib } from "@/lib/coverFlags";
import { CoverModal } from "@/components/CoverImage";
import { splitCreators } from "@/utils/creators";
import flaggedBaseline from "@/data/flaggedCoversBaseline.json";

const BASELINE_FLAGGED_IDS = new Set((flaggedBaseline as { id: string }[]).map(f => f.id));

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const BATCH_SIZE = 20;
const CYCLE_MS = 30_000;

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

export default function CoverReview({ initTitle, initCreative }: { initTitle?: string; initCreative?: string }) {
  const [pool, setPool]         = useState<Pooled[] | null>(null);
  const [coversMap, setCoversMap] = useState<Record<string, { url: string | null }>>({});
  const [batchStart, setBatchStart] = useState(0);
  const [flags, setFlags]       = useState<Map<string, FlaggedCover>>(() => loadFlags());
  const [msLeft, setMsLeft]     = useState(CYCLE_MS);
  const [paused, setPaused]     = useState(false);
  const [titleFilter, setTitleFilter] = useState<string | null>(initTitle || null);
  const [creativeFilter, setCreativeFilter] = useState<string | null>(initCreative || null);
  const [modal, setModal] = useState<{ comic: Comic; url: string } | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Title and creative filters are mutually exclusive — picking one clears the other.
  const pickTitle = useCallback((t: string | null) => { setCreativeFilter(null); setTitleFilter(t); }, []);
  const pickCreative = useCallback((c: string | null) => { setTitleFilter(null); setCreativeFilter(c); }, []);

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
          const flagId = comicId({ Title: c.Title, Issue: c.Issue, Volume: c.Volume, Box: c.Box });
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
  useEffect(() => { if (initTitle) pickTitle(initTitle); }, [initTitle, pickTitle]);
  // Deep-link from the Creative Credits page: open filtered to one creator's books.
  useEffect(() => { if (initCreative) pickCreative(initCreative); }, [initCreative, pickCreative]);

  // 30s auto-advance cycle — paused when the timer is stopped or a filter is pinned.
  useEffect(() => {
    if (!pool || pool.length === 0 || paused || titleFilter || creativeFilter) return;
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
  }, [pool, batchStart, paused, titleFilter, creativeFilter]);

  // Every covered issue of the pinned title, grouped by volume (ascending) and
  // then sorted by issue number within each volume, so the run reads straight
  // through volume by volume.
  const titleView = useMemo(() => {
    if (!titleFilter) return { groups: [] as { vol: string; items: Pooled[] }[], volCount: 0, total: 0 };
    const seen = new Set<string>();
    const byVol = new Map<string, Pooled[]>();
    for (const c of DATA.comics as Comic[]) {
      if (c.Title !== titleFilter) continue;
      const vol = String(c.Volume || "1").trim();
      const key = `${c.Title}|||${c.Issue}|||${vol}`;
      if (seen.has(key)) continue;
      const entry = coversMap[key] ?? coversMap[`${c.Title}|||${c.Issue}`];
      if (entry?.url) {
        seen.add(key);
        if (!byVol.has(vol)) byVol.set(vol, []);
        byVol.get(vol)!.push({ comic: c, url: entry.url });
      }
    }
    const groups = [...byVol.entries()]
      .map(([vol, items]) => ({
        vol,
        items: items.sort((a, b) =>
          (parseFloat(String(a.comic.Issue)) || 0) - (parseFloat(String(b.comic.Issue)) || 0)),
      }))
      .sort((a, b) => (parseInt(a.vol) || 0) - (parseInt(b.vol) || 0));
    const total = groups.reduce((s, g) => s + g.items.length, 0);
    return { groups, volCount: byVol.size, total };
  }, [titleFilter, coversMap]);

  const titleCount = titleView.total;

  // Every covered book this creator worked on (writer, artist OR cover artist),
  // grouped by Title (A–Z) and sorted by issue within — same treatment as the
  // title view, just one level up (title headers instead of volume headers).
  const creativeView = useMemo(() => {
    if (!creativeFilter) return { groups: [] as { title: string; items: Pooled[] }[], titleCount: 0, total: 0 };
    const seen = new Set<string>();
    const byTitle = new Map<string, Pooled[]>();
    for (const c of DATA.comics as Comic[]) {
      const credited =
        splitCreators(c.Writer).includes(creativeFilter) ||
        splitCreators(c.Artist).includes(creativeFilter) ||
        splitCreators(c.Cover_Artist).includes(creativeFilter);
      if (!credited) continue;
      const vol = String(c.Volume || "1").trim();
      const key = `${c.Title}|||${c.Issue}|||${vol}`;
      if (seen.has(key)) continue;
      const entry = coversMap[key] ?? coversMap[`${c.Title}|||${c.Issue}`];
      if (entry?.url) {
        seen.add(key);
        if (!byTitle.has(c.Title)) byTitle.set(c.Title, []);
        byTitle.get(c.Title)!.push({ comic: c, url: entry.url });
      }
    }
    const groups = [...byTitle.entries()]
      .map(([title, items]) => ({
        title,
        items: items.sort((a, b) =>
          (parseFloat(String(a.comic.Issue)) || 0) - (parseFloat(String(b.comic.Issue)) || 0)),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
    const total = groups.reduce((s, g) => s + g.items.length, 0);
    return { groups, titleCount: byTitle.size, total };
  }, [creativeFilter, coversMap]);

  const batch = useMemo(() => {
    if (!pool || pool.length === 0) return [] as Pooled[];
    const out: Pooled[] = [];
    for (let i = 0; i < BATCH_SIZE && i < pool.length; i++) {
      out.push(pool[(batchStart + i) % pool.length]);
    }
    return out;
  }, [pool, batchStart]);

  const toggleFlag = useCallback((p: Pooled) => {
    setFlags(prev => {
      const next = new Map(prev);
      const id = comicId({ Title: p.comic.Title, Issue: p.comic.Issue, Volume: p.comic.Volume, Box: p.comic.Box });
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

  const card = (p: Pooled, k: string, showVol = false, issueOnly = false) => {
    const id = comicId({ Title: p.comic.Title, Issue: p.comic.Issue, Volume: p.comic.Volume, Box: p.comic.Box });
    const flagged = flags.has(id);
    return (
      <div key={k} style={{ width: "100%", textAlign: "center" }}>
        <div
          onClick={() => setModal({ comic: p.comic, url: p.url })}
          title="Open to mark incorrect / variant / dupe"
          style={{ width: "100%", aspectRatio: "2 / 3", borderRadius: 4, overflow: "hidden", background: "#1a1628", border: flagged ? "2px solid var(--red)" : "1px solid var(--border)", cursor: "pointer" }}
        >
          <img src={p.url} alt={`${p.comic.Title} ${p.comic.Issue}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="lazy" />
        </div>
        {issueOnly ? (
          <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)", marginTop: 6, lineHeight: 1.3, width: "100%" }}>
            #{p.comic.Issue}
          </div>
        ) : (
          <button
            className="cr-tl"
            onClick={() => pickTitle(p.comic.Title)}
            title={`Show all ${p.comic.Title} issues`}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "0.82rem", color: "var(--red)", marginTop: 6, lineHeight: 1.25, whiteSpace: "normal", wordBreak: "break-word", textDecoration: "underline", width: "100%" }}
          >
            {p.comic.Title} #{p.comic.Issue}
          </button>
        )}
        {showVol && <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>Vol {p.comic.Volume || "1"}</div>}
        <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: "0.875rem", color: flagged ? "var(--red)" : "var(--muted)", cursor: "pointer", marginTop: 8 }}>
          <input type="checkbox" checked={flagged} onChange={() => toggleFlag(p)} />
          wrong
        </label>
      </div>
    );
  };

  return (
    <div className="cr-wrap" style={{ padding: "20px 24px 60px" }}>
      <style>{`
        .cr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;align-items:start}
        .cr-tl{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.3em}
        @media(max-width:480px){
          .cr-wrap{padding:16px 16px 60px}
          .cr-grid{grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:10px}
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: "1.75rem", letterSpacing: "2px", color: "var(--text)" }}>
            {titleFilter ? "Cover Review by title" : creativeFilter ? "Cover Review by creator" : "Cover Review"}
          </div>
          <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
            {titleFilter
              ? `${titleFilter} · ${titleCount} issue${titleCount === 1 ? "" : "s"}${titleView.volCount > 1 ? ` · ${titleView.volCount} volumes` : ""} · click "wrong" on any incorrect cover`
              : creativeFilter
              ? `${creativeFilter} · ${creativeView.total} book${creativeView.total === 1 ? "" : "s"} across ${creativeView.titleCount} title${creativeView.titleCount === 1 ? "" : "s"} · click "wrong" on any incorrect cover`
              : `${pool.length.toLocaleString()} covers in pool · batch ${Math.floor(batchStart / BATCH_SIZE) + 1} of ${Math.ceil(pool.length / BATCH_SIZE)} · ${flags.size} flagged so far`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {titleFilter || creativeFilter ? (
            <button onClick={() => { setTitleFilter(null); setCreativeFilter(null); }} style={btnStyle(false)}>← All covers</button>
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

      {!titleFilter && !creativeFilter && (
        <div style={{ height: 3, background: "var(--border)", borderRadius: 2, marginBottom: 20, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${paused ? 0 : pct}%`, background: paused ? "var(--muted)" : "var(--red)", transition: "width 0.25s linear" }} />
        </div>
      )}

      {creativeFilter ? (
        creativeView.total === 0 ? (
          <div style={{ color: "var(--muted)", marginTop: 20 }}>No covered books found for {creativeFilter}.</div>
        ) : (
          <div style={{ marginTop: 20 }}>
            {creativeView.groups.map(g => (
              <div key={g.title} style={{ marginBottom: 24 }}>
                <button
                  onClick={() => pickTitle(g.title)}
                  title={`Show all ${g.title} issues`}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: "0.95rem", letterSpacing: "1.5px", color: "var(--text)", marginBottom: 10, borderBottom: "1px solid var(--border)", paddingBottom: 5, width: "100%", display: "block" }}
                >
                  {g.title.toUpperCase()} · {g.items.length} book{g.items.length === 1 ? "" : "s"}
                </button>
                <div className="cr-grid">
                  {g.items.map((p, i) => card(p, `cr-${g.title}-${i}`, false, true))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : titleFilter ? (
        titleCount === 0 ? (
          <div style={{ color: "var(--muted)", marginTop: 20 }}>No covered issues found for this title.</div>
        ) : (
          <div style={{ marginTop: 20 }}>
            {titleView.groups.map(g => (
              <div key={g.vol} style={{ marginBottom: 24 }}>
                {titleView.volCount > 1 && (
                  <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: "0.95rem", letterSpacing: "1.5px", color: "var(--muted)", marginBottom: 10, borderBottom: "1px solid var(--border)", paddingBottom: 5 }}>
                    VOLUME {g.vol} · {g.items.length} issue{g.items.length === 1 ? "" : "s"}
                  </div>
                )}
                <div className="cr-grid">
                  {g.items.map((p, i) => card(p, `t-${g.vol}-${i}`, false, true))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="cr-grid">
          {batch.map((p, i) => card(p, `${comicId({ Title: p.comic.Title, Issue: p.comic.Issue, Volume: p.comic.Volume, Box: p.comic.Box })}-${i}`))}
        </div>
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
