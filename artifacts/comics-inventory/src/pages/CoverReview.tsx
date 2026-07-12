import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { DATA, type Comic } from "@/data/data";
import { comicId, loadFlags, saveFlags, type FlaggedCover } from "./CoverCatalog";
import flaggedBaseline from "@/data/flaggedCoversBaseline.json";

const BASELINE_FLAGGED_IDS = new Set((flaggedBaseline as { id: string }[]).map(f => f.id));

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const LANES = 5;
const BATCH_SIZE = 50;
const CYCLE_MS = 30_000;
const PER_LANE = BATCH_SIZE / LANES;

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

export default function CoverReview() {
  const [pool, setPool]         = useState<Pooled[] | null>(null);
  const [batchStart, setBatchStart] = useState(0);
  const [flags, setFlags]       = useState<Map<string, FlaggedCover>>(() => loadFlags());
  const [msLeft, setMsLeft]     = useState(CYCLE_MS);
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

  // 30s auto-advance cycle.
  useEffect(() => {
    if (!pool || pool.length === 0) return;
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
  }, [pool, batchStart]);

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

  const exportFlags = useCallback(() => {
    const all = loadFlags();
    const blob = new Blob([JSON.stringify([...all.values()], null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flagged-covers-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

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

  return (
    <div style={{ padding: "20px 24px 60px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: "1.75rem", letterSpacing: "2px", color: "var(--text)" }}>
            Cover Review
          </div>
          <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
            {pool.length.toLocaleString()} covers in pool · batch {Math.floor(batchStart / BATCH_SIZE) + 1} of {Math.ceil(pool.length / BATCH_SIZE)} · {flags.size} flagged so far
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={nextNow} style={btnStyle(false)}>Skip batch →</button>
          <button onClick={exportFlags} style={btnStyle(true)}>Export flagged ({flags.size})</button>
        </div>
      </div>

      <div style={{ height: 3, background: "var(--border)", borderRadius: 2, marginBottom: 20, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "var(--red)", transition: "width 0.25s linear" }} />
      </div>

      {lanes.map((lane, li) => (
        <div key={li} style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: "0.875rem", letterSpacing: "1.5px", color: "var(--muted)", marginBottom: 6 }}>
            LANE {li + 1}
          </div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
            {lane.map((p, i) => {
              const id = comicId({ Title: p.comic.Title, Issue: p.comic.Issue, Box: p.comic.Box });
              const flagged = flags.has(id);
              return (
                <div key={`${id}-${i}`} style={{ flexShrink: 0, width: 96, textAlign: "center" }}>
                  <div style={{ width: 96, height: 144, borderRadius: 4, overflow: "hidden", background: "#1a1628", border: flagged ? "2px solid var(--red)" : "1px solid var(--border)" }}>
                    <img src={p.url} alt={`${p.comic.Title} ${p.comic.Issue}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="lazy" />
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "var(--muted)", marginTop: 4, lineHeight: 1.3, height: 36, overflow: "hidden" }}>
                    {p.comic.Title} #{p.comic.Issue}
                  </div>
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: "0.875rem", color: flagged ? "var(--red)" : "var(--muted)", cursor: "pointer", marginTop: 8 }}>
                    <input type="checkbox" checked={flagged} onChange={() => toggleFlag(p)} />
                    wrong
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      ))}
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
