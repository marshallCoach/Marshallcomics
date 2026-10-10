import { useMemo, useState } from "react";
import { DATA } from "@/data/data";
import { tallyCreators } from "@/utils/creators";
import type { NavParams } from "../App";

// Browse every creator in the collection, split to individuals (a name inside
// "Stan Lee, Jack Kirby" counts on its own). Click a creator to open Cover
// Review filtered to just their books — grouped by title, sorted by issue.
const comics = DATA.comics;

type Role = "Writer" | "Artist" | "Cover_Artist";
const ROLE_LABEL: Record<Role, string> = { Writer: "Writers", Artist: "Artists", Cover_Artist: "Cover Artists" };
const ROLE_COLOR: Record<Role, string> = { Writer: "var(--red)", Artist: "#1d6fa4", Cover_Artist: "#16a34a" };

const RANKED: Record<Role, [string, number][]> = {
  Writer: Object.entries(tallyCreators(comics, c => c.Writer)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  Artist: Object.entries(tallyCreators(comics, c => c.Artist)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  Cover_Artist: Object.entries(tallyCreators(comics, c => c.Cover_Artist)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
};

export default function CreativeCredits({ onNavigate }: { onNavigate?: (tab: string, params?: NavParams) => void }) {
  const [role, setRole] = useState<Role>("Artist");
  const [q, setQ] = useState("");
  const [sortAZ, setSortAZ] = useState(false);

  const list = useMemo(() => {
    let rows = RANKED[role];
    const needle = q.trim().toLowerCase();
    if (needle) rows = rows.filter(([n]) => n.toLowerCase().includes(needle));
    if (sortAZ) rows = [...rows].sort((a, b) => a[0].localeCompare(b[0]));
    return rows;
  }, [role, q, sortAZ]);

  const open = (name: string) => onNavigate?.("coverreview", { creative: name });

  return (
    <div className="cc-wrap">
      <style>{CSS}</style>
      <h1 className="cc-h1">Creative Credits</h1>
      <p className="cc-sub">Every writer, artist and cover artist in the collection, counted individually. Tap a name to see all their covered books in Cover Review — grouped by title, sorted by issue.</p>

      <div className="cc-controls">
        <div className="cc-roles">
          {(Object.keys(ROLE_LABEL) as Role[]).map(r => (
            <button key={r} onClick={() => setRole(r)}
              className={`cc-role ${role === r ? "on" : ""}`}
              style={role === r ? { background: ROLE_COLOR[r], borderColor: ROLE_COLOR[r], color: "#fff" } : undefined}>
              {ROLE_LABEL[r]} <span className="cc-count">{RANKED[r].length.toLocaleString()}</span>
            </button>
          ))}
        </div>
        <div className="cc-tools">
          <input className="cc-search" placeholder="Search names…" value={q} onChange={e => setQ(e.target.value)} />
          <div className="cc-seg" role="group" aria-label="Sort">
            <button className={`cc-sort ${!sortAZ ? "on" : ""}`} onClick={() => setSortAZ(false)}>Count</button>
            <button className={`cc-sort ${sortAZ ? "on" : ""}`} onClick={() => setSortAZ(true)}>A–Z</button>
          </div>
        </div>
      </div>

      <div className="cc-meta">{list.length.toLocaleString()} {ROLE_LABEL[role].toLowerCase()}{q ? ` matching “${q}”` : ""}</div>

      <div className="cc-grid">
        {list.map(([name, count]) => (
          <button key={name} className="cc-item" onClick={() => open(name)} title={`See ${name}'s books in Cover Review`}>
            <span className="cc-name">{name}</span>
            <span className="cc-badge" style={{ background: ROLE_COLOR[role] }}>{count}</span>
          </button>
        ))}
        {list.length === 0 && <div className="cc-empty">No {ROLE_LABEL[role].toLowerCase()} match “{q}”.</div>}
      </div>
    </div>
  );
}

const CSS = `
.cc-wrap{max-width:1080px;margin:0 auto;padding:20px 24px 60px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--text)}
.cc-h1{margin:0 0 4px;font-size:1.75rem;letter-spacing:1px}
.cc-sub{margin:0 0 16px;color:var(--muted2);font-size:.9rem;line-height:1.45;max-width:64ch}
.cc-controls{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;justify-content:space-between;margin-bottom:12px}
.cc-roles{display:flex;gap:8px;flex-wrap:wrap}
.cc-role{font-size:.82rem;font-weight:700;padding:7px 13px;border-radius:99px;cursor:pointer;background:var(--surface2);border:1px solid var(--border);color:var(--muted2)}
.cc-role .cc-count{opacity:.7;font-variant-numeric:tabular-nums;margin-left:4px}
.cc-tools{display:flex;gap:8px;align-items:center}
.cc-search{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);font-size:.9rem;min-width:160px}
.cc-seg{display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden}
.cc-sort{background:var(--surface2);border:none;padding:8px 14px;color:var(--muted2);font-size:.8rem;font-weight:700;cursor:pointer;white-space:nowrap}
.cc-sort+.cc-sort{border-left:1px solid var(--border)}
.cc-sort.on{background:var(--red);color:#fff}
.cc-meta{font-size:.78rem;color:var(--muted);margin-bottom:12px;font-variant-numeric:tabular-nums}
.cc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
.cc-item{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:9px 12px;cursor:pointer;text-align:left;transition:border-color .12s,transform .12s}
.cc-item:hover{border-color:var(--muted);transform:translateY(-1px)}
.cc-name{font-size:.88rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cc-badge{color:#fff;font-size:.72rem;font-weight:800;font-variant-numeric:tabular-nums;border-radius:6px;padding:2px 7px;min-width:22px;text-align:center;flex-shrink:0}
.cc-empty{grid-column:1/-1;color:var(--muted);padding:24px;text-align:center}
@media(max-width:480px){.cc-wrap{padding:16px 16px 60px}.cc-grid{grid-template-columns:1fr 1fr;gap:7px}.cc-name{font-size:.8rem}}
`;
