import { useState, useMemo, useCallback, useEffect } from "react";
import { DATA } from "@/data/data";

// Volume Confirm — review titles whose issues span more than one Volume, spot
// the odd issue out (an era outlier, e.g. a 2019 legacy issue sitting in Vol 1
// among 1963–1996 issues), set the correct Volume per issue, and export a
// `solution` JSON that brb_apply_data_fixes applies PER ISSUE (never propagated,
// so it can't clobber a run). This is the safe, visual counterpart to the CLI
// gate — confirm the siblings, then apply.

const comics = DATA.comics;
type Comic = (typeof comics)[number];

const LS = "volconfirm-overrides-v1";
const todayStr = () => new Date().toISOString().slice(0, 10);

function issueNum(s: string): number | null {
  const m = String(s ?? "").match(/\d+(\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}
function firstYear(y: string | undefined): number | null {
  const m = String(y || "").match(/\d{4}/g);
  if (!m) return null;
  const nums = m.map(Number).filter(n => n > 1900 && n < 2100);
  return nums.length ? nums[0] : null;
}
const nv = (v: string | undefined) => {
  const s = String(v ?? "").trim();
  return s === "" ? "1" : s;
};
const rowId = (c: Comic) =>
  `${c.Title}|||${String(c.Issue).replace(/^#/, "").trim()}|||${String(c.Box ?? "").trim()}`;

interface Row {
  c: Comic; iss: string; issN: number | null; year: number | null;
  vol: string; mismatch: boolean;
}
interface TitleGroup {
  title: string; vols: string[]; rows: Row[]; flagged: number;
}

export default function VolumeConfirm() {
  const [overrides, setOverrides] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch { return {}; }
  });
  const [q, setQ] = useState("");
  const [onlyFlagged, setOnlyFlagged] = useState(true);

  useEffect(() => {
    try { localStorage.setItem(LS, JSON.stringify(overrides)); } catch { /* private mode */ }
  }, [overrides]);

  // Build title groups: only titles whose issues span >1 Volume.
  const groups = useMemo<TitleGroup[]>(() => {
    const byTitle = new Map<string, Comic[]>();
    for (const c of comics) {
      const t = (c.Title || "").trim();
      if (!t) continue;
      (byTitle.get(t) ?? byTitle.set(t, []).get(t)!).push(c);
    }
    const out: TitleGroup[] = [];
    for (const [title, list] of byTitle) {
      const vols = [...new Set(list.map(c => nv(c.Volume)))];
      if (vols.length < 2) continue; // single-volume titles can't clobber
      // year span per volume, to flag outliers
      const spanByVol = new Map<string, number[]>();
      for (const c of list) {
        const y = firstYear(c.Year);
        if (y == null) continue;
        const v = nv(c.Volume);
        (spanByVol.get(v) ?? spanByVol.set(v, []).get(v)!).push(y);
      }
      const rows: Row[] = list.map(c => {
        const v = nv(c.Volume);
        const y = firstYear(c.Year);
        const others = (spanByVol.get(v) || []).filter(yy => yy !== y);
        let mismatch = false;
        if (y != null && others.length >= 3) {
          const lo = Math.min(...others), hi = Math.max(...others);
          if (y < lo - 2 || y > hi + 2) mismatch = true; // outlier vs its volume's era
        }
        return { c, iss: String(c.Issue).replace(/^#/, "").trim(), issN: issueNum(c.Issue), year: y, vol: v, mismatch };
      });
      rows.sort((a, b) => (a.vol.localeCompare(b.vol, undefined, { numeric: true }))
        || ((a.issN ?? 1e9) - (b.issN ?? 1e9)));
      out.push({ title, vols: vols.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
        rows, flagged: rows.filter(r => r.mismatch).length });
    }
    out.sort((a, b) => (b.flagged - a.flagged) || a.title.localeCompare(b.title));
    return out;
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return groups.filter(g =>
      (!onlyFlagged || g.flagged > 0 || g.rows.some(r => overrides[rowId(r.c)])) &&
      (!needle || g.title.toLowerCase().includes(needle)));
  }, [groups, q, onlyFlagged, overrides]);

  const pending = useMemo(() =>
    Object.entries(overrides).filter(([, v]) => v && v.trim()).length, [overrides]);

  const setVol = useCallback((c: Comic, v: string) => {
    const id = rowId(c);
    setOverrides(o => {
      const next = { ...o };
      const clean = v.trim();
      if (!clean || clean === nv(c.Volume)) delete next[id]; else next[id] = clean;
      return next;
    });
  }, []);

  const exportJson = useCallback(() => {
    const recs = Object.entries(overrides)
      .filter(([, v]) => v && v.trim())
      .map(([id, v]) => {
        const [title, issue, box] = id.split("|||");
        return { id, title, issue, box, kind: "solution", value: `vol:${v.trim()}`, problem: "volume-confirm", at: new Date().toISOString() };
      });
    const blob = new Blob([JSON.stringify(recs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `volume-confirm-${todayStr()}.json`; a.click();
    URL.revokeObjectURL(url);
  }, [overrides]);

  const reset = useCallback(() => {
    if (!confirm("Clear all your volume-confirm overrides?")) return;
    setOverrides({});
  }, []);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "20px 16px 90px" }}>
      <style>{CSS}</style>

      <div className="vc-head">
        <div>
          <h1 className="vc-h1">Volume Confirm</h1>
          <p className="vc-sub">
            Titles whose issues span more than one volume. ⚠ marks an issue whose
            year is an outlier for its volume — the kind of mismatch that
            clobbered runs. Set the right volume, then <b>Export</b> and apply.
          </p>
        </div>
        <div className="vc-actions">
          <span className="vc-pill">{pending} to apply</span>
          <button className="vc-btn" onClick={exportJson} disabled={!pending}>Export JSON</button>
          <button className="vc-btn ghost" onClick={reset} disabled={!pending}>Reset</button>
        </div>
      </div>

      <div className="vc-bar">
        <input className="vc-input" placeholder="Search title…" value={q} onChange={e => setQ(e.target.value)} />
        <label className="vc-check">
          <input type="checkbox" checked={onlyFlagged} onChange={e => setOnlyFlagged(e.target.checked)} />
          Flagged / edited only
        </label>
        <span className="vc-count">{shown.length} titles</span>
      </div>

      {pending > 0 && (
        <div className="vc-note">
          Apply on the Mac: <code>python3 brb_apply_data_fixes.py --flags volume-confirm-{todayStr()}.json --apply</code>
          {" "}→ <code>python3 brb.py --commit "confirm volumes" --yes</code>. Sets each issue only — no run propagation.
        </div>
      )}

      {shown.map(g => (
        <div key={g.title} className="vc-card">
          <div className="vc-card-h">
            <span className="vc-title">{g.title}</span>
            <span className="vc-vols">vols {g.vols.join(", ")}</span>
            {g.flagged > 0 && <span className="vc-flag">⚠ {g.flagged}</span>}
          </div>
          <div className="vc-scroll">
            <table className="vc-tbl">
              <thead>
                <tr><th>Vol</th><th>Issue</th><th>Year</th><th>Set volume</th></tr>
              </thead>
              <tbody>
                {g.rows.map((r, i) => {
                  const id = rowId(r.c);
                  const ov = overrides[id];
                  return (
                    <tr key={id + i} className={(r.mismatch ? "warn " : "") + (ov ? "edited" : "")}>
                      <td className="mono">{r.vol}</td>
                      <td className="mono">#{r.iss}{r.mismatch && <span className="vc-w">⚠</span>}</td>
                      <td className="mono">{r.year ?? "—"}</td>
                      <td>
                        <input
                          className="vc-vol"
                          inputMode="numeric"
                          placeholder={r.vol}
                          value={ov ?? ""}
                          onChange={e => setVol(r.c, e.target.value.replace(/[^0-9]/g, ""))}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {shown.length === 0 && <p className="vc-empty">No titles match. Uncheck "Flagged / edited only" to see every multi-volume title.</p>}
    </div>
  );
}

const CSS = `
.vc-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:14px}
.vc-h1{font-size:22px;font-weight:700;margin:0 0 4px}
.vc-sub{color:var(--muted);font-size:14px;margin:0;max-width:640px;line-height:1.5}
.vc-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.vc-pill{font-size:13px;font-weight:600;background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:4px 12px}
.vc-btn{font-size:13px;font-weight:600;padding:7px 14px;border-radius:8px;border:1px solid var(--border);background:#4f9cf9;color:#fff;cursor:pointer}
.vc-btn.ghost{background:var(--surface);color:var(--text)}
.vc-btn:disabled{opacity:.45;cursor:default}
.vc-bar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:12px}
.vc-input{flex:1;min-width:200px;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 10px;font-size:14px}
.vc-check{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted)}
.vc-count{font-size:13px;color:var(--muted)}
.vc-note{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:13px;color:var(--muted);margin-bottom:14px;line-height:1.7}
.vc-note code{background:var(--surface);padding:1px 6px;border-radius:5px;font-size:12px}
.vc-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:14px}
.vc-card-h{display:flex;align-items:baseline;gap:12px;margin-bottom:8px;flex-wrap:wrap}
.vc-title{font-size:16px;font-weight:600}
.vc-vols{font-size:12px;color:var(--muted)}
.vc-flag{font-size:12px;font-weight:700;color:#f59e0b;margin-left:auto}
.vc-scroll{overflow-x:auto}
.vc-tbl{border-collapse:collapse;width:100%;font-size:13px}
.vc-tbl th{text-align:left;color:var(--muted);font-weight:600;padding:5px 10px;border-bottom:1px solid var(--border)}
.vc-tbl td{padding:5px 10px;border-bottom:1px solid var(--border)}
.vc-tbl tr.warn{background:rgba(245,158,11,.09)}
.vc-tbl tr.edited{background:rgba(79,156,249,.12)}
.mono{font-variant-numeric:tabular-nums}
.vc-w{color:#f59e0b;margin-left:5px;font-weight:700}
.vc-vol{width:64px;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:4px 8px;font-size:13px;font-variant-numeric:tabular-nums}
.vc-empty{color:var(--muted);font-size:14px;text-align:center;padding:40px 0}
`;
