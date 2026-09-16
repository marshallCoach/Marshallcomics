import { useState, useEffect, useMemo, useCallback } from "react";

// Review widget for Fandom-canonical title renames. Reads the proposals file
// brb_apply_fandom_titles.py writes, lets you approve/reject each, and exports
// only the approved ones for the apply pass. Decisions persist per-browser.
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const LS = "brbTitleRenameDecisions_v1";

interface Proposal { old: string; new: string; count: number; issues: string[]; }
type Decision = "approve" | "reject";

function loadDecisions(): Record<string, Decision> {
  try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch { return {}; }
}
function saveDecisions(d: Record<string, Decision>) {
  try { localStorage.setItem(LS, JSON.stringify(d)); } catch { /* ignore */ }
}

export default function TitleFixes() {
  const [props, setProps] = useState<Proposal[] | null>(null);
  const [dec, setDec] = useState<Record<string, Decision>>(() => loadDecisions());

  useEffect(() => {
    fetch(`${BASE}/title_rename_proposals.json`).then(r => r.ok ? r.json() : [])
      .then(setProps).catch(() => setProps([]));
  }, []);

  const set = useCallback((old: string, d: Decision) => {
    setDec(prev => {
      const next = { ...prev };
      if (next[old] === d) delete next[old]; else next[old] = d;
      saveDecisions(next); return next;
    });
  }, []);

  const { approved, rejected, pending } = useMemo(() => {
    let a = 0, r = 0, p = 0;
    for (const x of props || []) {
      const d = dec[x.old];
      if (d === "approve") a++; else if (d === "reject") r++; else p++;
    }
    return { approved: a, rejected: r, pending: p };
  }, [props, dec]);

  const exportApproved = useCallback(() => {
    const out = (props || []).filter(x => dec[x.old] === "approve").map(x => ({ old: x.old, new: x.new }));
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `title-renames-approved-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  }, [props, dec]);

  const total = props?.length ?? 0;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 80px" }}>
      <style>{CSS}</style>
      <div className="tf-head">
        <div>
          <h1 className="tf-h1">Title Fixes</h1>
          <p className="tf-sub">Rename proposals from your Fandom links (canonical title from the URL). Approve the good ones, reject the rest, then Export — the apply script renames only what you approved and re-points each book's cover.</p>
        </div>
        <div className="tf-actions">
          <button className="tf-export" onClick={exportApproved} disabled={!approved}>⬇ Export approved ({approved})</button>
        </div>
      </div>

      {total > 0 && (
        <div className="tf-stats">
          <span className="tf-stat ok">✓ {approved} approved</span>
          <span className="tf-stat no">✗ {rejected} rejected</span>
          <span className="tf-stat pend">• {pending} pending</span>
          <span className="tf-stat total">{total} total</span>
        </div>
      )}

      {props === null && <div className="tf-empty">Loading proposals…</div>}
      {props && total === 0 && (
        <div className="tf-empty">No title proposals yet. Run <code>brb_apply_fandom_titles.py</code> on the Mac and push <code>public/title_rename_proposals.json</code>.</div>
      )}

      {(props || []).map(p => {
        const d = dec[p.old];
        return (
          <div key={p.old} className={`tf-card ${d || ""}`}>
            <div className="tf-rename">
              <span className="tf-old">{p.old}</span>
              <span className="tf-arrow">→</span>
              <span className="tf-new">{p.new}</span>
            </div>
            <div className="tf-meta">
              {p.count} issue{p.count !== 1 ? "s" : ""}
              {p.issues?.length ? <span className="tf-issues"> · #{p.issues.join(" #")}{p.count > p.issues.length ? " …" : ""}</span> : null}
            </div>
            <div className="tf-btns">
              <button className={`tf-btn approve ${d === "approve" ? "on" : ""}`} onClick={() => set(p.old, "approve")}>✓ Approve</button>
              <button className={`tf-btn reject ${d === "reject" ? "on" : ""}`} onClick={() => set(p.old, "reject")}>✗ Reject</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const CSS = `
.tf-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:14px}
.tf-h1{margin:0 0 4px;font-size:1.7rem}
.tf-sub{color:var(--muted,#888);margin:0;max-width:64ch;font-size:.86rem;line-height:1.45}
.tf-export{font-size:.8rem;font-weight:700;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;background:#22c55e;color:#04220f}
.tf-export:disabled{opacity:.4;cursor:default}
.tf-stats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;font-size:.8rem;font-variant-numeric:tabular-nums}
.tf-stat{font-weight:700}
.tf-stat.ok{color:#22c55e}.tf-stat.no{color:#c0392b}.tf-stat.pend{color:var(--muted2,#bbb)}.tf-stat.total{color:var(--muted,#888)}
.tf-empty{color:var(--muted,#888);background:var(--surface,#1a1a22);border:1px solid var(--border,#2c2c38);border-radius:10px;padding:24px;text-align:center}
.tf-empty code{color:#e6b95c}
.tf-card{background:var(--surface,#1a1a22);border:1px solid var(--border,#2c2c38);border-left:4px solid var(--border,#2c2c38);border-radius:10px;padding:12px 14px;margin-bottom:10px;transition:all .15s}
.tf-card.approve{border-left-color:#22c55e;background:#12271a}
.tf-card.reject{border-left-color:#c0392b;opacity:.55}
.tf-rename{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:1rem}
.tf-old{color:var(--muted2,#bbb);text-decoration:line-through}
.tf-arrow{color:var(--muted,#888)}
.tf-new{color:var(--text,#eee);font-weight:800}
.tf-meta{font-size:.76rem;color:var(--muted,#888);margin:5px 0 9px}
.tf-issues{color:var(--muted2,#bbb)}
.tf-btns{display:flex;gap:8px}
.tf-btn{font-size:.78rem;font-weight:700;border-radius:7px;padding:5px 14px;cursor:pointer;background:var(--surface2,#26262f);border:1px solid var(--border,#2c2c38);color:var(--muted2,#bbb)}
.tf-btn.approve.on{background:#22c55e;border-color:#22c55e;color:#04220f}
.tf-btn.reject.on{background:#c0392b;border-color:#c0392b;color:#fff}
`;
