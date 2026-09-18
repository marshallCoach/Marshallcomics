import { useState, useEffect, useMemo, useCallback } from "react";
import { DATA } from "@/data/data";
import { CoverImage, CoverModal, coversReady, coverUrlSync } from "@/components/CoverImage";

// A run-through worklist of every book with no cover, keys/$ first, each click
// opening the cover modal (Find links + Save image / Save Fandom). Missing =
// coverUrlSync() returns null, the exact test the app uses to render a cover.
const comics = DATA.comics;
const LS = "brbDataFixes_v1"; // the Save-image/Fandom buttons queue here

const norm = (v: unknown) => String(v ?? "").trim();
const issueNorm = (v: unknown) => norm(v).replace(/^#/, "");
const nm = (v?: string) => { const m = String(v || "").match(/([\d.]+)/); return m ? parseFloat(m[1]) : 0; };
const isKey = (c: { Key?: string }) => (c.Key || "").toUpperCase() === "YES";

function loadQueued(): Set<string> {
  try { return new Set(Object.keys(JSON.parse(localStorage.getItem(LS) || "{}"))); }
  catch { return new Set(); }
}

type Comic = typeof comics[number];
const bookId = (c: Comic) => `${c.Title}|||${issueNorm(c.Issue)}|||${norm((c as { Box?: string }).Box)}`;

export default function MissingCovers() {
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<{ comic: Comic } | null>(null);
  const [pub, setPub] = useState("all");
  const [keysOnly, setKeysOnly] = useState(false);
  const [queued, setQueued] = useState<Set<string>>(() => loadQueued());

  useEffect(() => { coversReady().then(() => setReady(true)); }, []);

  const missing = useMemo(() => {
    if (!ready) return [];
    const seen = new Set<string>(), out: Comic[] = [];
    for (const c of comics) {
      const k = `${norm(c.Title).toLowerCase()}|||${issueNorm(c.Issue)}`;
      if (seen.has(k)) continue;
      if (coverUrlSync(c) !== null) continue;   // already has a cover
      seen.add(k); out.push(c);
    }
    out.sort((a, b) =>
      (Number(isKey(b)) - Number(isKey(a))) ||
      (nm((b as { Value_NM?: string }).Value_NM) - nm((a as { Value_NM?: string }).Value_NM)) ||
      a.Title.localeCompare(b.Title));
    return out;
  }, [ready]);

  const pubCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of missing) { const p = norm(c.Publisher) || "—"; m[p] = (m[p] || 0) + 1; }
    return m;
  }, [missing]);

  const shown = useMemo(() =>
    missing.filter(c => (pub === "all" || (norm(c.Publisher) || "—") === pub) && (!keysOnly || isKey(c))),
    [missing, pub, keysOnly]);

  const onClose = useCallback(() => { setModal(null); setQueued(loadQueued()); }, []);

  const topPubs = Object.entries(pubCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 80px" }}>
      <style>{CSS}</style>
      <div className="mc-head">
        <div>
          <h1 className="mc-h1">Missing Covers</h1>
          <p className="mc-sub">Every book with no cover — keys and highest value first. Click one to open the cover pop-up: use <b>Find cover image ↗</b> / <b>Find on Fandom ↗</b>, then <b>Save image</b> or <b>Save Fandom link</b>. Your saves queue into the Data Fix export; run the apply script on the Mac to make them live.</p>
        </div>
        <div className="mc-count">{ready ? shown.length.toLocaleString() : "…"}<span>to fix</span></div>
      </div>

      <div className="mc-filters">
        <button className={`mc-chip${pub === "all" ? " on" : ""}`} onClick={() => setPub("all")}>All ({missing.length})</button>
        {topPubs.map(([p, n]) => (
          <button key={p} className={`mc-chip${pub === p ? " on" : ""}`} onClick={() => setPub(p)}>{p} ({n})</button>
        ))}
        <button className={`mc-chip key${keysOnly ? " on" : ""}`} onClick={() => setKeysOnly(k => !k)}>★ Keys only</button>
      </div>

      {!ready && <div className="mc-empty">Loading covers…</div>}
      {ready && shown.length === 0 && <div className="mc-empty">No missing covers here — nice.</div>}

      <div className="mc-grid">
        {shown.map((c, i) => {
          const q = queued.has(bookId(c));
          return (
            <button key={bookId(c) + i} className="mc-card" onClick={() => setModal({ comic: c })}>
              <div className="mc-cov">
                <CoverImage comic={c} width={110} height={165} objectFit="contain" />
                {q && <span className="mc-queued">✓ linked</span>}
                {isKey(c) && <span className="mc-key">★</span>}
              </div>
              <div className="mc-title">{c.Title}</div>
              <div className="mc-meta">#{issueNorm(c.Issue)}{c.Year ? ` · ${c.Year}` : ""}</div>
              <div className="mc-meta2">{norm(c.Publisher) || "—"}{nm((c as { Value_NM?: string }).Value_NM) ? ` · $${nm((c as { Value_NM?: string }).Value_NM)}` : ""}</div>
            </button>
          );
        })}
      </div>

      {modal && <CoverModal comic={modal.comic} largeUrl={null} onClose={onClose} />}
    </div>
  );
}

const CSS = `
.mc-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:12px}
.mc-h1{margin:0 0 4px;font-size:1.7rem}
.mc-sub{color:var(--muted,#888);margin:0;max-width:70ch;font-size:.84rem;line-height:1.5}
.mc-count{font-size:1.9rem;font-weight:800;color:var(--red,#c8102e);text-align:right;line-height:1;font-variant-numeric:tabular-nums}
.mc-count span{display:block;font-size:.6rem;letter-spacing:1px;color:var(--muted,#888);text-transform:uppercase;font-weight:600;margin-top:3px}
.mc-filters{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0 16px}
.mc-chip{font-size:.76rem;border:1px solid var(--border,#2c2c38);background:var(--surface2,#26262f);color:var(--muted2,#bbb);border-radius:20px;padding:5px 12px;cursor:pointer}
.mc-chip.on{background:var(--red,#c8102e);border-color:var(--red,#c8102e);color:#fff}
.mc-chip.key.on{background:#8a6000;border-color:#8a6000}
.mc-empty{color:var(--muted,#888);text-align:center;padding:40px;background:var(--surface,#1a1a22);border:1px solid var(--border,#2c2c38);border-radius:10px}
.mc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:12px}
.mc-card{text-align:left;background:var(--surface,#1a1a22);border:1px solid var(--border,#2c2c38);border-radius:10px;padding:9px;cursor:pointer;color:inherit;font:inherit;transition:border-color .12s}
.mc-card:hover{border-color:var(--red,#c8102e)}
.mc-cov{position:relative;display:flex;justify-content:center;background:#111;border-radius:6px;overflow:hidden;margin-bottom:7px}
.mc-queued{position:absolute;left:4px;bottom:4px;background:#16a34a;color:#fff;font-size:.62rem;font-weight:700;border-radius:4px;padding:1px 5px}
.mc-key{position:absolute;right:4px;top:4px;background:#fff8e0;color:#8a6000;border:1px solid #fde68a;border-radius:4px;font-size:.7rem;padding:0 4px}
.mc-title{font-size:.78rem;font-weight:700;line-height:1.2;color:var(--text,#eee);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.mc-meta{font-size:.72rem;color:var(--muted2,#bbb);margin-top:2px}
.mc-meta2{font-size:.7rem;color:var(--muted,#888);margin-top:1px}
`;
