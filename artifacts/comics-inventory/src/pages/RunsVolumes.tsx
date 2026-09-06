import { useState, useMemo } from "react";
import { DATA } from "@/data/data";
import { CoverImage } from "@/components/CoverImage";

const comics = DATA.comics;

function parseIssueNum(s: string): number | null {
  const m = String(s ?? "").match(/\d+(\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}
const fmtIss = (n: number) => (Number.isInteger(n) ? String(n) : String(n));

interface Run {
  key: string; title: string; volume: string; publisher: string;
  min: number; max: number; have: number; total: number; pct: number;
  missing: number[]; boxes: string[]; byNum: Map<number, typeof comics[number]>;
  clash: boolean; earlyGap: boolean;
}

export default function RunsVolumes() {
  const [filter, setFilter] = useState<"gaps" | "clash" | "early" | "all">("gaps");
  const [q, setQ] = useState("");
  const [pub, setPub] = useState("All");

  const runs = useMemo<Run[]>(() => {
    const byKey: Record<string, typeof comics> = {};
    for (const c of comics) {
      const k = `${c.Title.trim()}|||${c.Volume || "1"}`;
      (byKey[k] ||= []).push(c);
    }
    // volumes per title -> issue-number sets, for clash detection
    const titleVols: Record<string, { vol: string; nums: Set<number> }[]> = {};
    const out: Run[] = [];
    for (const [key, issues] of Object.entries(byKey)) {
      const sep = key.lastIndexOf("|||");
      const title = key.slice(0, sep), volume = key.slice(sep + 3) || "1";
      const numbered = issues.map(c => ({ c, n: parseIssueNum(c.Issue) }))
        .filter(x => x.n !== null) as { c: typeof comics[number]; n: number }[];
      if (numbered.length < 2) continue;
      const nums = numbered.map(x => x.n);
      const min = Math.min(...nums), max = Math.max(...nums);
      const have = new Set(nums);
      const missing: number[] = [];
      for (let i = Math.ceil(min); i <= Math.floor(max); i++) if (!have.has(i)) missing.push(i);
      const byNum = new Map<number, typeof comics[number]>();
      numbered.forEach(x => { if (!byNum.has(x.n)) byNum.set(x.n, x.c); });
      const boxes = Array.from(new Set(issues.map(c => String(c.Box || "").trim()).filter(Boolean)))
        .sort((a, b) => (parseInt(a) || 999) - (parseInt(b) || 999));
      (titleVols[title] ||= []).push({ vol: volume, nums: have });
      out.push({
        key, title, volume, publisher: issues[0].Publisher || "",
        min, max, have: have.size, total: max - min + 1, pct: (have.size / (max - min + 1)) * 100,
        missing, boxes, byNum, clash: false, earlyGap: missing.some(m => m <= 9),
      });
    }
    // mark clashes: a title with 2+ volumes whose issue-number sets overlap
    for (const r of out) {
      const vs = titleVols[r.title];
      if (vs && vs.length > 1) {
        const others = vs.filter(v => v.vol !== r.volume);
        r.clash = others.some(o => [...r.byNum.keys()].some(n => o.nums.has(n)));
      }
    }
    return out.sort((a, b) => a.title.localeCompare(b.title) || (parseInt(a.volume) || 0) - (parseInt(b.volume) || 0));
  }, []);

  const shown = useMemo(() => {
    let r = runs;
    if (filter === "gaps") r = r.filter(x => x.missing.length > 0);
    else if (filter === "clash") r = r.filter(x => x.clash);
    else if (filter === "early") r = r.filter(x => x.earlyGap);
    if (pub !== "All") r = r.filter(x => pub === "Other"
      ? !/marvel|dc|image/i.test(x.publisher) : x.publisher.toLowerCase().includes(pub.toLowerCase()));
    if (q.trim()) r = r.filter(x => x.title.toLowerCase().includes(q.toLowerCase()));
    return r;
  }, [runs, filter, pub, q]);

  const counts = useMemo(() => ({
    gaps: runs.filter(r => r.missing.length).length,
    clash: runs.filter(r => r.clash).length,
    early: runs.filter(r => r.earlyGap).length,
    all: runs.length,
  }), [runs]);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 14px 80px" }}>
      <style>{CSS}</style>
      <h1 className="rv-h1">Runs &amp; Volumes</h1>
      <p className="rv-sub">Every title+volume as a run — spot missing issues, volume clashes, and which boxes to raid before you buy a replacement.</p>

      <div className="rv-filters">
        {([["gaps", "Has gaps"], ["early", "Missing #1–9"], ["clash", "Volume clashes"], ["all", "All runs"]] as const)
          .map(([k, l]) => (
          <button key={k} className={`rv-pill${filter === k ? " on" : ""}`} onClick={() => setFilter(k)}>
            {l} <span className="rv-n">{counts[k]}</span>
          </button>
        ))}
      </div>
      <div className="rv-filters">
        {["All", "Marvel", "DC", "Other"].map(p => (
          <button key={p} className={`rv-pill sm${pub === p ? " on" : ""}`} onClick={() => setPub(p)}>{p}</button>
        ))}
        <input className="rv-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search title…" />
      </div>

      <div className="rv-count">{shown.length} run{shown.length !== 1 ? "s" : ""}</div>

      {shown.slice(0, 200).map(r => <RunCard key={r.key} r={r} />)}
      {shown.length > 200 && <div className="rv-more">Showing first 200 — narrow with a filter or search.</div>}
    </div>
  );
}

function RunCard({ r }: { r: Run }) {
  const cap = 26;
  const seq: number[] = [];
  const lo = Math.ceil(r.min), hi = Math.floor(r.max);
  for (let i = lo; i <= hi && seq.length < cap; i++) seq.push(i);
  const truncated = hi - lo + 1 > cap;
  return (
    <div className={`rv-card${r.clash ? " clash" : ""}`}>
      <div className="rv-head">
        <div>
          <span className="rv-title">{r.title}</span>
          <span className="rv-vol">Vol {r.volume}</span>
          <span className="rv-range">#{fmtIss(r.min)}–{fmtIss(r.max)}</span>
        </div>
        <div className="rv-tags">
          <span className={`rv-chip pub-${(r.publisher || "o").toLowerCase().slice(0,2)}`}>{r.publisher || "?"}</span>
          {r.clash && <span className="rv-chip warn">⚠ volume clash</span>}
        </div>
      </div>

      <div className="rv-bar"><div className="rv-bar-fill" style={{ width: `${r.pct}%` }} /></div>
      <div className="rv-stats">
        <b>{r.have}</b>/{r.total} · {r.pct.toFixed(0)}%
        {r.missing.length > 0 && <span className="rv-missn"> · {r.missing.length} missing</span>}
      </div>

      {r.boxes.length > 0 && (
        <div className="rv-boxes">📦 check {r.boxes.length > 1 ? "boxes" : "box"} <b>{r.boxes.join(", ")}</b> before buying replacements</div>
      )}

      {r.missing.length > 0 && (
        <div className="rv-miss">
          Missing:{" "}
          {r.missing.slice(0, 30).map(m => (
            <span key={m} className={`rv-mchip${m <= 9 ? " early" : ""}`}>#{fmtIss(m)}</span>
          ))}
          {r.missing.length > 30 && <span className="rv-mchip">+{r.missing.length - 30}</span>}
        </div>
      )}

      <div className="rv-strip">
        {seq.map(n => {
          const c = r.byNum.get(n);
          return c ? (
            <figure key={n} className="rv-cell">
              <CoverImage comic={c} width={64} height={96} objectFit="contain" style={{ borderRadius: 3, background: "#0d0d12", border: "1px solid var(--border,#2c2c38)" }} />
              <figcaption className="rv-cn">#{fmtIss(n)}</figcaption>
            </figure>
          ) : (
            <figure key={n} className="rv-cell">
              <div className="rv-gap">#{fmtIss(n)}<span>missing</span></div>
            </figure>
          );
        })}
        {truncated && <div className="rv-cell rv-tail">+{hi - lo + 1 - cap} more…</div>}
      </div>
    </div>
  );
}

const CSS = `
.rv-h1{margin:0 0 4px;font-size:1.7rem}
.rv-sub{color:var(--muted,#888);margin:0 0 16px;max-width:60ch;font-size:.9rem}
.rv-filters{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;align-items:center}
.rv-pill{background:var(--surface,#1c1c24);border:1.5px solid var(--border,#2c2c38);color:var(--muted2,#aaa);
border-radius:20px;padding:5px 12px;font:inherit;font-size:.8rem;font-weight:600;cursor:pointer}
.rv-pill.sm{padding:4px 11px;font-size:.76rem}
.rv-pill.on{background:var(--red,#c0392b);border-color:var(--red,#c0392b);color:#fff}
.rv-n{opacity:.7;font-weight:700;margin-left:3px}
.rv-search{flex:1;min-width:140px;background:var(--bg,#101014);border:1.5px solid var(--border,#2c2c38);
color:var(--text,#eee);border-radius:8px;padding:6px 11px;font:inherit;font-size:.85rem;outline:none}
.rv-count{color:var(--muted,#888);font-size:.8rem;letter-spacing:1px;margin:10px 0}
.rv-card{background:var(--surface,#1a1a22);border:1px solid var(--border,#2c2c38);border-radius:12px;
padding:14px 16px;margin-bottom:12px}
.rv-card.clash{border-color:#c99a3a}
.rv-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}
.rv-title{font-weight:700;font-size:1.02rem}
.rv-vol{color:var(--muted,#888);font-size:.8rem;margin-left:8px}
.rv-range{color:var(--red,#e05a4a);font-size:.85rem;margin-left:8px;font-variant-numeric:tabular-nums}
.rv-tags{display:flex;gap:6px;flex-wrap:wrap}
.rv-chip{font-size:.68rem;font-weight:700;border-radius:5px;padding:2px 8px;letter-spacing:.5px}
.pub-ma{background:#e23636;color:#fff}.pub-dc{background:#0476c9;color:#fff}.pub-im{background:#111;color:#fff;border:1px solid #444}
.rv-chip:not(.warn):not(.pub-ma):not(.pub-dc):not(.pub-im){background:var(--surface2,#26262f);color:var(--muted,#999)}
.rv-chip.warn{background:#5a4a1e;color:#ffd97a}
.rv-bar{height:6px;background:var(--surface2,#26262f);border-radius:4px;overflow:hidden;margin:10px 0 4px}
.rv-bar-fill{height:100%;background:linear-gradient(90deg,#2f9e6e,#54c78e)}
.rv-stats{font-size:.82rem;color:var(--muted2,#bbb);font-variant-numeric:tabular-nums}
.rv-stats b{color:var(--text,#eee)}
.rv-missn{color:#e0a030}
.rv-boxes{font-size:.78rem;color:#8fd0ff;background:rgba(20,90,150,.15);border:1px solid rgba(60,130,200,.35);
border-radius:6px;padding:6px 9px;margin-top:9px}
.rv-boxes b{color:#cfe9ff}
.rv-miss{font-size:.78rem;color:var(--muted,#999);margin-top:9px;line-height:1.9}
.rv-mchip{background:var(--surface2,#26262f);border:1px solid var(--border,#2c2c38);border-radius:5px;
padding:2px 7px;margin-right:4px;font-variant-numeric:tabular-nums}
.rv-mchip.early{background:#5a1e1e;border-color:#8a2a2a;color:#ffb3b3;font-weight:700}
.rv-strip{display:flex;gap:8px;overflow-x:auto;margin-top:12px;padding-bottom:8px}
.rv-cell{margin:0;flex:0 0 auto;width:64px;text-align:center}
.rv-cn{font-size:.66rem;color:var(--muted2,#bbb);margin-top:3px}
.rv-gap{width:64px;height:96px;border:1.5px dashed #7a3a3a;border-radius:4px;display:flex;flex-direction:column;
align-items:center;justify-content:center;color:#e08a8a;font-size:.72rem;font-weight:700;gap:2px;background:rgba(120,40,40,.12)}
.rv-gap span{font-size:.56rem;font-weight:500;letter-spacing:.5px;opacity:.8}
.rv-tail{width:auto;display:flex;align-items:center;color:var(--muted,#888);font-size:.75rem;padding:0 6px}
.rv-more{color:var(--muted,#888);text-align:center;padding:16px;font-size:.85rem}
`;
