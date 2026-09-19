import { useState, useEffect, useMemo, useCallback } from "react";
import { DATA } from "@/data/data";
import {
  CoverImage, coversReady, coverUrlSync, saveCoverLink, fandomGuesses,
} from "@/components/CoverImage";

// A run-through worklist of every book with no cover, sorted by Title then
// Issue. Clicking a book opens a full-page SOLO view (not a modal) with
// Prev/Next and an "N of TOTAL" counter, so you can work one book at a time
// and populate a cover link right there. Missing = coverUrlSync() returns null.
const comics = DATA.comics;
const LS = "brbDataFixes_v1"; // the Save-image/Fandom buttons queue here

const norm = (v: unknown) => String(v ?? "").trim();
const issueNorm = (v: unknown) => norm(v).replace(/^#/, "");
const issueNum = (v: unknown) => { const m = issueNorm(v).match(/[\d.]+/); return m ? parseFloat(m[0]) : Number.POSITIVE_INFINITY; };
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
  const [solo, setSolo] = useState<number | null>(null);   // index into `shown`
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
    // Sort by Title (A→Z), then Issue number ascending.
    out.sort((a, b) =>
      norm(a.Title).toLowerCase().localeCompare(norm(b.Title).toLowerCase()) ||
      (issueNum(a.Issue) - issueNum(b.Issue)));
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

  // Export the saved image/Fandom links as data-fixes-<date>.json — same store
  // and format as the Data Fix page, so brb_apply_fandom_pages.py picks it up.
  const exportLinks = useCallback(() => {
    let map: Record<string, unknown> = {};
    try { map = JSON.parse(localStorage.getItem(LS) || "{}"); } catch { map = {}; }
    const blob = new Blob([JSON.stringify(Object.values(map), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `data-fixes-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Reset only the cover-link queue (problem "no-cover") — leaves Data Fix
  // resolutions in the shared store untouched. Use after you've exported.
  const resetLinks = useCallback(() => {
    if (!confirm("Clear all saved cover links? Export first if you still need them.")) return;
    let map: Record<string, { problem?: string }> = {};
    try { map = JSON.parse(localStorage.getItem(LS) || "{}"); } catch { map = {}; }
    for (const k of Object.keys(map)) if (map[k]?.problem === "no-cover") delete map[k];
    try { localStorage.setItem(LS, JSON.stringify(map)); } catch { /* ignore */ }
    setQueued(loadQueued());
  }, []);

  // Self-prune: once a saved link has been applied + reingested (the book now
  // has a cover), drop it from the queue so the count reflects only real work.
  useEffect(() => {
    if (!ready) return;
    const covered = new Set<string>();
    for (const c of comics) if (coverUrlSync(c) !== null) covered.add(`${norm(c.Title).toLowerCase()}|||${issueNorm(c.Issue)}`);
    let map: Record<string, { problem?: string; title?: string; issue?: string }> = {};
    try { map = JSON.parse(localStorage.getItem(LS) || "{}"); } catch { return; }
    let changed = false;
    for (const [k, rec] of Object.entries(map)) {
      if (rec?.problem !== "no-cover") continue;
      const ti = `${norm(rec.title).toLowerCase()}|||${issueNorm(rec.issue)}`;
      if (covered.has(ti)) { delete map[k]; changed = true; }
    }
    if (changed) {
      try { localStorage.setItem(LS, JSON.stringify(map)); } catch { /* ignore */ }
      setQueued(loadQueued());
    }
  }, [ready]);

  const topPubs = Object.entries(pubCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);

  // ── Solo book view ──────────────────────────────────────────────────────
  if (solo !== null && shown[solo]) {
    return (
      <SoloBook
        comic={shown[solo]}
        index={solo}
        total={shown.length}
        onPrev={() => setSolo(i => Math.max(0, (i ?? 0) - 1))}
        onNext={() => setSolo(i => Math.min(shown.length - 1, (i ?? 0) + 1))}
        onBack={() => { setSolo(null); setQueued(loadQueued()); }}
        onQueuedChange={() => setQueued(loadQueued())}
      />
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 80px" }}>
      <style>{CSS}</style>
      <div className="mc-head">
        <div>
          <h1 className="mc-h1">Missing Covers</h1>
          <p className="mc-sub">Every book with no cover, sorted by title then issue. Click one to open its <b>solo page</b> — jump to the cover with <b>Find image</b> / <b>Find on Fandom</b>, then <b>Save</b> the link. Use <b>Prev/Next</b> (or ← →) to work straight down the list. Saves queue into the Data Fix export.</p>
        </div>
        <div className="mc-head-right">
          <button className="mc-export" onClick={exportLinks} disabled={!queued.size}>⬇ Export {queued.size || ""} link{queued.size === 1 ? "" : "s"}</button>
          <button className="mc-reset" onClick={resetLinks} disabled={!queued.size}>Reset</button>
          <div className="mc-count">{ready ? shown.length.toLocaleString() : "…"}<span>to fix</span></div>
        </div>
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
            <button key={bookId(c) + i} className="mc-card" onClick={() => setSolo(i)}>
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
    </div>
  );
}

// ── Solo book page ──────────────────────────────────────────────────────────
function SoloBook({ comic, index, total, onPrev, onNext, onBack, onQueuedChange }: {
  comic: Comic; index: number; total: number;
  onPrev: () => void; onNext: () => void; onBack: () => void; onQueuedChange: () => void;
}) {
  const box = norm((comic as { Box?: string }).Box);
  const yr = norm((comic as { Year?: string }).Year);
  const iss = issueNorm(comic.Issue);
  const [imgDraft, setImgDraft] = useState("");
  const [fanDraft, setFanDraft] = useState("");
  const [saved, setSaved] = useState<null | "image" | "fandom">(null);

  // Reset the draft/saved state whenever we move to a different book.
  useEffect(() => { setImgDraft(""); setFanDraft(""); setSaved(null); }, [index]);

  // Arrow keys move through the list; Esc returns to the grid.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;   // don't hijack typing
      if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
      else if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onPrev, onNext, onBack]);

  const imgSearch = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${comic.Title} ${iss} ${yr} comic cover`)}`;
  const fandomOpts = fandomGuesses(comic.Title, iss, yr, norm(comic.Publisher));

  function doSave(kind: "image" | "fandom", value: string) {
    if (!value.trim()) return;
    saveCoverLink(comic, box, kind, value.trim());
    setSaved(kind);
    onQueuedChange();
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 80px" }}>
      <style>{CSS}</style>

      {/* Nav bar: back + position + prev/next */}
      <div className="sb-nav">
        <button className="sb-back" onClick={onBack}>← All missing</button>
        <div className="sb-pos">{index + 1} <span>of {total.toLocaleString()}</span></div>
        <div className="sb-steps">
          <button className="sb-step" onClick={onPrev} disabled={index === 0}>‹ Prev</button>
          <button className="sb-step" onClick={onNext} disabled={index === total - 1}>Next ›</button>
        </div>
      </div>

      <div className="sb-book">
        <div className="sb-cov">
          <CoverImage comic={comic} width={260} height={390} objectFit="contain" />
        </div>
        <div className="sb-info">
          <h1 className="sb-title">{comic.Title}</h1>
          <div className="sb-sub">#{iss}{yr ? ` · ${yr}` : ""}</div>
          <div className="sb-tags">
            {norm(comic.Publisher) && <span className="sb-tag">{norm(comic.Publisher)}</span>}
            {box && <span className="sb-tag box">Box {box}</span>}
            {isKey(comic) && <span className="sb-tag key">★ KEY</span>}
            {nm((comic as { Value_NM?: string }).Value_NM) > 0 && <span className="sb-tag val">${nm((comic as { Value_NM?: string }).Value_NM)}</span>}
          </div>
          {isKey(comic) && (comic as { Key_Reason?: string }).Key_Reason && (
            <div className="sb-keyreason">{(comic as { Key_Reason?: string }).Key_Reason}</div>
          )}

          {/* Add-a-link controls */}
          <div className="sb-add">
            <div className="sb-add-h">ADD A COVER LINK</div>
            <div className="sb-finds">
              <a href={imgSearch} target="_blank" rel="noopener noreferrer" className="sb-find">🖼 Find image ↗</a>
              {fandomOpts.map(o => (
                <a key={o.url} href={o.url} target="_blank" rel="noopener noreferrer" className="sb-find">🔍 {o.label}</a>
              ))}
            </div>
            <div className="sb-row">
              <input value={imgDraft} onChange={e => setImgDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") doSave("image", imgDraft); }}
                placeholder="Paste cover IMAGE URL…" className="sb-input" />
              <button className="sb-save img" onClick={() => doSave("image", imgDraft)} disabled={!imgDraft.trim()}>Save image</button>
            </div>
            <div className="sb-row">
              <input value={fanDraft} onChange={e => setFanDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") doSave("fandom", fanDraft); }}
                placeholder="Paste FANDOM page URL…" className="sb-input" />
              <button className="sb-save fan" onClick={() => doSave("fandom", fanDraft)} disabled={!fanDraft.trim()}>Save Fandom</button>
            </div>
            {saved && <div className="sb-saved">✓ Saved {saved === "image" ? "image link" : "Fandom link"} — queued for export. Next ›</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.mc-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:12px}
.mc-h1{margin:0 0 4px;font-size:1.7rem}
.mc-sub{color:var(--muted,#888);margin:0;max-width:70ch;font-size:.84rem;line-height:1.5}
.mc-head-right{display:flex;align-items:center;gap:14px}
.mc-export{font-size:.8rem;font-weight:700;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;background:#16a34a;color:#04220f;white-space:nowrap}
.mc-export:disabled{opacity:.4;cursor:default}
.mc-reset{font-size:.78rem;font-weight:600;border:1px solid var(--border,#2c2c38);background:var(--surface2,#26262f);color:var(--muted2,#bbb);border-radius:8px;padding:7px 12px;cursor:pointer}
.mc-reset:disabled{opacity:.4;cursor:default}
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

.sb-nav{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.sb-back{font-size:.82rem;font-weight:700;border:1px solid var(--border,#2c2c38);background:var(--surface2,#26262f);color:var(--muted2,#bbb);border-radius:8px;padding:7px 13px;cursor:pointer}
.sb-back:hover{border-color:var(--red,#c8102e);color:var(--red,#c8102e)}
.sb-pos{font-size:1.2rem;font-weight:800;color:var(--text,#eee);font-variant-numeric:tabular-nums}
.sb-pos span{font-size:.8rem;font-weight:600;color:var(--muted,#888)}
.sb-steps{display:flex;gap:8px}
.sb-step{font-size:.85rem;font-weight:700;border:1px solid var(--border,#2c2c38);background:var(--surface2,#26262f);color:var(--text,#eee);border-radius:8px;padding:7px 14px;cursor:pointer}
.sb-step:disabled{opacity:.35;cursor:default}
.sb-step:not(:disabled):hover{border-color:var(--red,#c8102e)}
.sb-book{display:flex;gap:22px;flex-wrap:wrap}
.sb-cov{flex-shrink:0;display:flex;justify-content:center;background:#111;border:1px solid var(--border,#2c2c38);border-radius:10px;overflow:hidden}
.sb-info{flex:1;min-width:260px}
.sb-title{margin:0;font-size:1.6rem;line-height:1.15;color:var(--text,#eee)}
.sb-sub{font-size:1rem;color:var(--red,#c8102e);font-weight:700;margin-top:4px}
.sb-tags{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
.sb-tag{font-size:.74rem;background:var(--surface2,#26262f);border:1px solid var(--border,#2c2c38);color:var(--muted2,#bbb);border-radius:4px;padding:3px 9px}
.sb-tag.box{background:#7a5c3a18;border-color:#7a5c3a;color:#c79b6a}
.sb-tag.key{background:#fff8e0;border-color:#fde68a;color:#8a6000;font-weight:700}
.sb-tag.val{color:var(--red,#c8102e);font-weight:700}
.sb-keyreason{margin-top:12px;background:#fff8e0;border:1px solid #fde68a;color:#5a4000;border-radius:6px;padding:9px 13px;font-size:.84rem;line-height:1.5}
.sb-add{margin-top:18px;border-top:1px solid var(--border,#2c2c38);padding-top:14px}
.sb-add-h{font-size:.74rem;letter-spacing:2px;color:var(--muted,#888);margin-bottom:9px}
.sb-finds{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:11px}
.sb-find{font-size:.8rem;color:#5ab0e0;text-decoration:none;background:var(--surface2,#26262f);border:1px solid var(--border,#2c2c38);border-radius:6px;padding:6px 11px}
.sb-find:hover{border-color:#5ab0e0}
.sb-row{display:flex;gap:7px;margin-bottom:8px}
.sb-input{flex:1;min-width:0;font-size:.84rem;padding:8px 11px;border-radius:6px;border:1px solid var(--border,#2c2c38);background:var(--bg,#141419);color:var(--text,#eee)}
.sb-save{font-size:.82rem;font-weight:700;padding:8px 15px;border-radius:6px;cursor:pointer;border:none;color:#fff;white-space:nowrap}
.sb-save.img{background:#1d6fa4}
.sb-save.fan{background:#7c3aed}
.sb-save:disabled{opacity:.4;cursor:default}
.sb-saved{margin-top:8px;font-size:.82rem;color:#16a34a;font-weight:600}
`;
