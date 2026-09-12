import { useState, useMemo } from "react";
import { DATA, type Comic } from "@/data/data";
import { CoverImage, CoverModal, fmtPubDate } from "@/components/CoverImage";
import ComicDrawer, { type DrawerComic } from "@/components/ComicDrawer";

const comics = DATA.comics;

// A "purchase" is a row the weekly intake stamped — Date_Added carries the
// "(new-comics intake)" marker. That is the only reliable bought-this-week
// signal; the ~11k bulk-import/transcription dates are NOT purchases.
const INTAKE_RE = /new-comics intake/i;

function parseDate(s: string): Date | null {
  const d = new Date(String(s || "").replace(/\s*\(.*\)\s*/g, "").trim());
  return isNaN(d.getTime()) ? null : d;
}
function mondayOf(d: Date): Date {
  const x = new Date(d); const back = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - back); x.setHours(0, 0, 0, 0); return x;
}
function parseNM(raw?: string): number {
  const m = String(raw || "").match(/\$?\s*(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}
// This is a PURCHASES tracker, so "price" = what the book cost = its cover
// price. Prefer the real Cover Price captured at intake; otherwise estimate it
// from modern standard cover prices (never guess $0). eBay/NM are resale value,
// not purchase cost — they live in the detail drawer, not here.
function coverEstimate(c: Comic): number {
  const t = `${c.Title} ${(c as { Seller_Notes?: string }).Seller_Notes || ""}`.toLowerCase();
  if (/anniversary|giant-size|giant size|omnibus|deluxe|60th|50th/.test(t)) return 8.99;
  const iss = parseNM(c.Issue);
  if (iss === 1 || /annual|one-shot|one shot|special|legends|#1\b/.test(t)) return 4.99;
  return 3.99;
}
function priceOf(c: Comic): { val: number; kind: "cover" | "est" } {
  const cp = parseNM((c as { Cover_Price?: string }).Cover_Price);
  if (cp > 0) return { val: cp, kind: "cover" };
  return { val: coverEstimate(c), kind: "est" };
}
const ERA_RANK: Record<string, number> = {
  Golden: 0, "Golden Age": 0, Silver: 1, "Silver Age": 1, Bronze: 2, "Bronze Age": 2,
  Copper: 3, "Copper Age": 3, Modern: 4, "Modern Age": 4,
};
const eraKey = (c: Comic) => (c.Era || "").trim() || "—";
const money = (n: number) => "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

interface WeekGrp { key: number; label: string; total: number; est: boolean; items: Comic[]; }
interface MonthGrp { key: number; label: string; total: number; count: number; weeks: WeekGrp[]; }

export default function RecentPurchases() {
  const [drawer, setDrawer] = useState<Comic | null>(null);
  const [coverModal, setCoverModal] = useState<{ comic: Comic; large: string | null } | null>(null);
  const [flagV, setFlagV] = useState(0);
  const [open, setOpen] = useState<Record<number, boolean>>({});

  const { months, grand, count } = useMemo(() => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 24);
    cutoff.setHours(0, 0, 0, 0);
    const buys = comics
      .map(c => ({ c, d: parseDate(c.Date_Added) }))
      .filter((x): x is { c: Comic; d: Date } =>
        !!x.d && x.d >= cutoff && INTAKE_RE.test(x.c.Date_Added || ""));

    const mMap = new Map<number, Map<number, Comic[]>>();
    for (const { c, d } of buys) {
      const mk = d.getFullYear() * 100 + d.getMonth();
      const wk = mondayOf(d).getTime();
      if (!mMap.has(mk)) mMap.set(mk, new Map());
      const wMap = mMap.get(mk)!;
      (wMap.get(wk) ?? wMap.set(wk, []).get(wk)!).push(c);
    }
    const sumItems = (arr: Comic[]) => arr.reduce((s, c) => s + priceOf(c).val, 0);
    const anyEst = (arr: Comic[]) => arr.some(c => priceOf(c).kind === "est");

    const months: MonthGrp[] = [...mMap.entries()].sort((a, b) => b[0] - a[0]).map(([mk, wMap]) => {
      const weeks: WeekGrp[] = [...wMap.entries()].sort((a, b) => b[0] - a[0]).map(([wk, items]) => {
        items.sort((a, b) => (ERA_RANK[eraKey(a)] ?? 9) - (ERA_RANK[eraKey(b)] ?? 9)
          || a.Title.localeCompare(b.Title) || parseNM(a.Issue) - parseNM(b.Issue));
        const ws = new Date(wk);
        return {
          key: wk, items, total: sumItems(items), est: anyEst(items),
          label: "Week of " + ws.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        };
      });
      const mLabel = new Date(mk % 100 === 0 ? mk / 100 : Math.floor(mk / 100), mk % 100)
        .toLocaleDateString(undefined, { month: "long", year: "numeric" });
      const items = weeks.flatMap(w => w.items);
      return { key: mk, label: mLabel, weeks, count: items.length, total: sumItems(items) };
    });
    return { months, grand: months.reduce((s, m) => s + m.total, 0), count: buys.length };
  }, []);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "20px 16px 80px" }}>
      <style>{CSS}</style>
      <div className="rp-head">
        <div>
          <h1 className="rp-h1">Recent Purchases</h1>
          <p className="rp-sub">Comics bought each week (from weekly intake), grouped by month · week · era. Price = cover price (real where captured at intake, else a modern cover-price estimate).</p>
        </div>
        <div className="rp-grand">
          <div className="rp-grand-val">{money(grand)}</div>
          <div className="rp-grand-lbl">{count} books tracked</div>
        </div>
      </div>

      {months.length === 0 && (
        <div className="rp-empty">No tracked purchases yet. They appear here once a weekly intake stamps rows with the “new-comics intake” marker.</div>
      )}

      {months.map((m, mi) => {
        const isOpen = open[m.key] ?? (mi === 0);   // newest month open by default
        return (
        <section key={m.key} className="rp-month">
          <button className="rp-month-hd" onClick={() => setOpen(o => ({ ...o, [m.key]: !isOpen }))}>
            <span className="rp-month-name"><span className="rp-chev">{isOpen ? "▾" : "▸"}</span> {m.label}</span>
            <span className="rp-month-meta">{m.count} book{m.count !== 1 ? "s" : ""} · <b>{money(m.total)}</b></span>
          </button>
          {isOpen && m.weeks.map(w => (
            <div key={w.key} className="rp-week">
              <div className="rp-week-hd">
                <span className="rp-week-name">{w.label}</span>
                <span className="rp-week-meta">{w.items.length} · <b>{money(w.total)}</b>{w.est ? <span className="rp-esttag"> est</span> : null}</span>
              </div>
              <div className="rp-grid">
                {w.items.map((c, i) => {
                  const p = priceOf(c);
                  return (
                    <div className="rp-card" key={c.Title + c.Issue + i}>
                      <CoverImage comic={c} width={92} height={138} objectFit="contain"
                        style={{ background: "#0d0d12", border: "1px solid var(--border)" }}
                        onClick={(large) => setCoverModal({ comic: c, large })} />
                      <div className="rp-info" onClick={() => setDrawer(c)}>
                        <div className="rp-title">{c.Title} <span className="rp-iss">#{c.Issue}</span></div>
                        <div className="rp-chips">
                          <span className="rp-era">{eraKey(c)}</span>
                          {fmtPubDate((c as { Pub_Date?: string }).Pub_Date) && <span className="rp-box">📅 {fmtPubDate((c as { Pub_Date?: string }).Pub_Date)}</span>}
                          {c.Box && <span className="rp-box">📦{c.Box}</span>}
                          {(c.Key || "").toUpperCase() === "YES" && <span className="rp-key">★</span>}
                        </div>
                        <div className="rp-price">
                          {money(p.val)}
                          <span className={`rp-ptag ${p.kind}`}>{p.kind === "cover" ? "cover" : "est"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
        );
      })}

      <ComicDrawer comic={drawer as DrawerComic | null} onClose={() => setDrawer(null)} onFlagChange={() => setFlagV(v => v + 1)} />
      {coverModal && <CoverModal comic={coverModal.comic} largeUrl={coverModal.large} onClose={() => setCoverModal(null)} />}
      <span hidden>{flagV}</span>
    </div>
  );
}

const CSS = `
.rp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:18px}
.rp-h1{margin:0 0 4px;font-size:1.7rem}
.rp-sub{color:var(--muted,#888);margin:0;max-width:60ch;font-size:.86rem}
.rp-grand{background:var(--surface,#1a1a22);border:1.5px solid var(--red,#c0392b);border-radius:10px;padding:10px 16px;text-align:right}
.rp-grand-val{font-size:1.5rem;font-weight:800;color:var(--text,#eee);font-variant-numeric:tabular-nums}
.rp-grand-lbl{font-size:.72rem;color:var(--muted,#888);letter-spacing:.5px}
.rp-empty{color:var(--muted,#888);background:var(--surface,#1a1a22);border:1px solid var(--border,#2c2c38);border-radius:10px;padding:24px;text-align:center}
.rp-month{margin-bottom:26px}
.rp-month-hd{display:flex;justify-content:space-between;align-items:baseline;width:100%;
border:none;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer;
border-bottom:2px solid var(--border,#2c2c38);padding:0 0 6px;margin-bottom:10px}
.rp-month-hd:hover .rp-month-name{color:var(--red,#e05a4a)}
.rp-month-name{font-size:1.25rem;font-weight:800}
.rp-chev{color:var(--muted,#888);font-size:.9rem}
.rp-month-meta{font-size:.85rem;color:var(--muted2,#bbb);font-variant-numeric:tabular-nums}
.rp-month-meta b{color:var(--text,#eee)}
.rp-week{margin:0 0 16px}
.rp-week-hd{display:flex;justify-content:space-between;align-items:baseline;margin:8px 0 8px;padding-left:2px}
.rp-week-name{font-size:.9rem;font-weight:700;color:var(--red,#e05a4a);letter-spacing:.3px}
.rp-week-meta{font-size:.8rem;color:var(--muted2,#bbb);font-variant-numeric:tabular-nums}
.rp-week-meta b{color:var(--text,#eee)}
.rp-esttag{color:#c99a3a;font-size:.7rem}
.rp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.rp-card{display:flex;gap:10px;background:var(--surface,#1a1a22);border:1px solid var(--border,#2c2c38);border-radius:9px;padding:8px}
.rp-info{flex:1;min-width:0;cursor:pointer;display:flex;flex-direction:column;gap:5px}
.rp-title{font-weight:700;font-size:.86rem;line-height:1.25}
.rp-iss{color:var(--red,#e05a4a)}
.rp-chips{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.rp-era{font-size:.62rem;font-weight:700;background:var(--surface2,#26262f);border:1px solid var(--border,#2c2c38);color:var(--muted2,#bbb);border-radius:4px;padding:1px 6px}
.rp-box{font-size:.62rem;color:#8fd0ff}
.rp-key{color:#e6b95c;font-size:.72rem}
.rp-price{margin-top:auto;font-weight:800;font-size:.95rem;color:var(--text,#eee);font-variant-numeric:tabular-nums;display:flex;align-items:center;gap:6px}
.rp-ptag{font-size:.6rem;font-weight:700;border-radius:4px;padding:1px 5px}
.rp-ptag.cover{background:#14351f;color:#7fd0a6;border:1px solid #2f9e6e}
.rp-ptag.est{background:#3a2f14;color:#e6b95c;border:1px dashed #c99a3a}
`;
