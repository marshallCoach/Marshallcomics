import { useState, useMemo, useEffect } from "react";
import { DATA, type Comic } from "@/data/data";
import { CoverImage, CoverModal, fmtPubDate } from "@/components/CoverImage";
import ComicDrawer, { type DrawerComic } from "@/components/ComicDrawer";

const comics = DATA.comics;
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// pub_dates.json is built on the Mac by brb_pubdates.py: for every modern
// Marvel/DC/Image book it records the REAL GCD on-sale date (key_date), keyed
// Title|||issue|||volume, only for books published in the last 3 years. This
// page groups the collection by that PUBLISHED week — the working assumption
// (the user's) is that a modern book was bought the week it dropped. Old
// back-issues never enter the file, so they can't distort the timeline.
interface PubRec { date: string; year: number; month: number; week: string; }
type PubMap = Record<string, PubRec>;

function normIssue(v: string): string {
  const s = String(v ?? "").trim().replace(/^#/, "");
  if (/^\d+(\.\d+)?$/.test(s)) {
    const f = parseFloat(s);
    return f === Math.floor(f) ? String(Math.floor(f)) : s;
  }
  return s;
}
const pubKey = (c: Comic) => `${c.Title}|||${normIssue(c.Issue)}|||${c.Volume || "1"}`;

function parseNM(raw?: string): number {
  const m = String(raw || "").match(/\$?\s*(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}
// Cover-price basis, same rules as Recent Purchases: real Cover Price where we
// captured it at intake, else a modern cover-price estimate. Never $0.
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

const money = (n: number) => "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function mondayOfISOWeek(week: string): Date | null {
  const m = week.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const [, yy, ww] = m; const simple = new Date(Date.UTC(+yy, 0, 1 + (+ww - 1) * 7));
  const dow = simple.getUTCDay(); const mon = new Date(simple);
  mon.setUTCDate(simple.getUTCDate() - ((dow + 6) % 7));
  return mon;
}

// ISO week string ("YYYY-Www") for a UTC date.
function isoWeekStr(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
// Parse the sheet's Publication Date (GCD key_date, e.g. "2024-05-15" or
// "2024-05-00" when GCD only knows the month — day 0 → the 1st, same
// approximation pub_dates.json used).
function parsePubDate(s?: string): PubRec | null {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = +m[1], mo = +m[2] >= 1 ? +m[2] : 1, dd = +m[3] >= 1 ? +m[3] : 1;
  if (y < 1900 || y > 2100) return null;
  const d = new Date(Date.UTC(y, mo - 1, dd));
  return { date: `${y}-${String(mo).padStart(2, "0")}-${String(dd).padStart(2, "0")}`, year: y, month: mo, week: isoWeekStr(d) };
}
// The timeline is the "modern releases" view: Marvel/DC/Image only, last 3 years.
const PUB_RE = /marvel|dc\b|image|skybound/i;

interface WeekGrp { key: string; label: string; total: number; est: boolean; items: Comic[]; }
interface MonthGrp { key: number; label: string; total: number; count: number; weeks: WeekGrp[]; }

export default function ReleaseTimeline() {
  const [pub, setPub] = useState<PubMap | null>(null);
  const [drawer, setDrawer] = useState<Comic | null>(null);
  const [coverModal, setCoverModal] = useState<{ comic: Comic; large: string | null } | null>(null);
  const [flagV, setFlagV] = useState(0);
  const [open, setOpen] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetch(`${BASE}/pub_dates.json`).then(r => r.ok ? r.json() : {}).then(setPub).catch(() => setPub({}));
  }, []);

  const { months, grand, count, byYear } = useMemo(() => {
    const fallback = pub || {};
    const cutoff = new Date(); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 3); cutoff.setUTCHours(0, 0, 0, 0);
    // Prefer the real Publication Date column; fall back to pub_dates.json for
    // any modern book the column hasn't been filled for yet.
    const placed: { c: Comic; p: PubRec }[] = [];
    for (const c of comics) {
      if (!PUB_RE.test(c.Publisher || "")) continue;
      const p = parsePubDate((c as { Pub_Date?: string }).Pub_Date) || fallback[pubKey(c)] || null;
      if (!p) continue;
      if (new Date(`${p.date}T00:00:00Z`) < cutoff) continue;   // last 3 years only
      placed.push({ c, p });
    }

    const mMap = new Map<number, Map<string, Comic[]>>();
    for (const { c, p } of placed) {
      const mk = p.year * 100 + p.month;
      if (!mMap.has(mk)) mMap.set(mk, new Map());
      const wMap = mMap.get(mk)!;
      (wMap.get(p.week) ?? wMap.set(p.week, []).get(p.week)!).push(c);
    }
    const sum = (arr: Comic[]) => arr.reduce((s, c) => s + priceOf(c).val, 0);
    const anyEst = (arr: Comic[]) => arr.some(c => priceOf(c).kind === "est");

    const months: MonthGrp[] = [...mMap.entries()].sort((a, b) => b[0] - a[0]).map(([mk, wMap]) => {
      const weeks: WeekGrp[] = [...wMap.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([wk, items]) => {
        items.sort((a, b) => a.Title.localeCompare(b.Title) || parseNM(a.Issue) - parseNM(b.Issue));
        const mon = mondayOfISOWeek(wk);
        const label = mon ? "Week of " + `${MONTHS[mon.getUTCMonth()]} ${mon.getUTCDate()}` : wk;
        return { key: wk, items, total: sum(items), est: anyEst(items), label };
      });
      const items = weeks.flatMap(w => w.items);
      const label = `${MONTHS[(mk % 100) - 1]} ${Math.floor(mk / 100)}`;
      return { key: mk, label, weeks, count: items.length, total: sum(items) };
    });

    const yr = new Map<number, number>();
    for (const { p } of placed) yr.set(p.year, (yr.get(p.year) || 0) + 1);
    return {
      months, grand: months.reduce((s, m) => s + m.total, 0), count: placed.length,
      byYear: [...yr.entries()].sort((a, b) => a[0] - b[0]),
    };
  }, [pub]);

  const maxYear = Math.max(1, ...byYear.map(y => y[1]));

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "20px 16px 80px" }}>
      <style>{CSS}</style>
      <div className="rt-head">
        <div>
          <h1 className="rt-h1">Release Timeline</h1>
          <p className="rt-sub">Your modern Marvel / DC / Image books placed on the week they were <b>published</b> (real GCD on-sale dates), last 3 years. Working assumption: a modern book was bought the week it dropped. Price = cover price (real where captured, else a modern-cover estimate).</p>
        </div>
        <div className="rt-grand">
          <div className="rt-grand-val">{money(grand)}</div>
          <div className="rt-grand-lbl">{count} books placed</div>
        </div>
      </div>

      {byYear.length > 0 && (
        <div className="rt-years">
          {byYear.map(([y, n]) => (
            <div key={y} className="rt-yr">
              <div className="rt-yr-bar-wrap"><div className="rt-yr-bar" style={{ height: `${Math.round(64 * n / maxYear)}px` }} /></div>
              <div className="rt-yr-n">{n}</div>
              <div className="rt-yr-y">{y}</div>
            </div>
          ))}
        </div>
      )}

      {months.length === 0 && (
        <div className="rt-empty">No dated modern books yet. Run <code>python3 brb_pubdate_fill.py</code> on the Mac, then <code>brb.py --commit … --yes</code> to fill the Publication Date column.</div>
      )}

      {months.map((m, mi) => {
        const isOpen = open[m.key] ?? (mi === 0);
        return (
          <section key={m.key} className="rt-month">
            <button className="rt-month-hd" onClick={() => setOpen(o => ({ ...o, [m.key]: !isOpen }))}>
              <span className="rt-month-name"><span className="rt-chev">{isOpen ? "▾" : "▸"}</span> {m.label}</span>
              <span className="rt-month-meta">{m.count} book{m.count !== 1 ? "s" : ""} · <b>{money(m.total)}</b></span>
            </button>
            {isOpen && m.weeks.map(w => (
              <div key={w.key} className="rt-week">
                <div className="rt-week-hd">
                  <span className="rt-week-name">{w.label}</span>
                  <span className="rt-week-meta">{w.items.length} · <b>{money(w.total)}</b>{w.est ? <span className="rt-esttag"> est</span> : null}</span>
                </div>
                <div className="rt-grid">
                  {w.items.map((c, i) => {
                    const p = priceOf(c);
                    return (
                      <div className="rt-card" key={c.Title + c.Issue + i}>
                        <CoverImage comic={c} width={92} height={138} objectFit="contain"
                          style={{ background: "#0d0d12", border: "1px solid var(--border)" }}
                          onClick={(large) => setCoverModal({ comic: c, large })} />
                        <div className="rt-info" onClick={() => setDrawer(c)}>
                          <div className="rt-title">{c.Title} <span className="rt-iss">#{c.Issue}</span></div>
                          <div className="rt-chips">
                            {c.Publisher && <span className="rt-pub">{c.Publisher}</span>}
                            {fmtPubDate((c as { Pub_Date?: string }).Pub_Date) && <span className="rt-box">📅 {fmtPubDate((c as { Pub_Date?: string }).Pub_Date)}</span>}
                            {c.Box && <span className="rt-box">📦{c.Box}</span>}
                            {(c.Key || "").toUpperCase() === "YES" && <span className="rt-key">★</span>}
                          </div>
                          <div className="rt-price">
                            {money(p.val)}
                            <span className={`rt-ptag ${p.kind}`}>{p.kind === "cover" ? "cover" : "est"}</span>
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
.rt-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:16px}
.rt-h1{margin:0 0 4px;font-size:1.7rem}
.rt-sub{color:var(--muted,#888);margin:0;max-width:66ch;font-size:.86rem;line-height:1.45}
.rt-grand{background:var(--surface,#1a1a22);border:1.5px solid var(--red,#c0392b);border-radius:10px;padding:10px 16px;text-align:right}
.rt-grand-val{font-size:1.5rem;font-weight:800;color:var(--text,#eee);font-variant-numeric:tabular-nums}
.rt-grand-lbl{font-size:.72rem;color:var(--muted,#888);letter-spacing:.5px}
.rt-years{display:flex;gap:14px;align-items:flex-end;background:var(--surface,#1a1a22);border:1px solid var(--border,#2c2c38);border-radius:10px;padding:14px 18px;margin-bottom:22px}
.rt-yr{display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;max-width:90px}
.rt-yr-bar-wrap{height:64px;display:flex;align-items:flex-end}
.rt-yr-bar{width:34px;background:linear-gradient(#e05a4a,#c0392b);border-radius:4px 4px 0 0;min-height:3px}
.rt-yr-n{font-weight:800;font-size:.95rem;color:var(--text,#eee);font-variant-numeric:tabular-nums}
.rt-yr-y{font-size:.72rem;color:var(--muted,#888)}
.rt-empty{color:var(--muted,#888);background:var(--surface,#1a1a22);border:1px solid var(--border,#2c2c38);border-radius:10px;padding:24px;text-align:center}
.rt-empty code{color:#e6b95c}
.rt-month{margin-bottom:26px}
.rt-month-hd{display:flex;justify-content:space-between;align-items:baseline;width:100%;border:none;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer;border-bottom:2px solid var(--border,#2c2c38);padding:0 0 6px;margin-bottom:10px}
.rt-month-hd:hover .rt-month-name{color:var(--red,#e05a4a)}
.rt-month-name{font-size:1.25rem;font-weight:800}
.rt-chev{color:var(--muted,#888);font-size:.9rem}
.rt-month-meta{font-size:.85rem;color:var(--muted2,#bbb);font-variant-numeric:tabular-nums}
.rt-month-meta b{color:var(--text,#eee)}
.rt-week{margin:0 0 16px}
.rt-week-hd{display:flex;justify-content:space-between;align-items:baseline;margin:8px 0 8px;padding-left:2px}
.rt-week-name{font-size:.9rem;font-weight:700;color:var(--red,#e05a4a);letter-spacing:.3px}
.rt-week-meta{font-size:.8rem;color:var(--muted2,#bbb);font-variant-numeric:tabular-nums}
.rt-week-meta b{color:var(--text,#eee)}
.rt-esttag{color:#c99a3a;font-size:.7rem}
.rt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.rt-card{display:flex;gap:10px;background:var(--surface,#1a1a22);border:1px solid var(--border,#2c2c38);border-radius:9px;padding:8px}
.rt-info{flex:1;min-width:0;cursor:pointer;display:flex;flex-direction:column;gap:5px}
.rt-title{font-weight:700;font-size:.86rem;line-height:1.25}
.rt-iss{color:var(--red,#e05a4a)}
.rt-chips{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.rt-pub{font-size:.62rem;font-weight:700;background:var(--surface2,#26262f);border:1px solid var(--border,#2c2c38);color:var(--muted2,#bbb);border-radius:4px;padding:1px 6px}
.rt-box{font-size:.62rem;color:#8fd0ff}
.rt-key{color:#e6b95c;font-size:.72rem}
.rt-price{margin-top:auto;font-weight:800;font-size:.95rem;color:var(--text,#eee);font-variant-numeric:tabular-nums;display:flex;align-items:center;gap:6px}
.rt-ptag{font-size:.6rem;font-weight:700;border-radius:4px;padding:1px 5px}
.rt-ptag.cover{background:#14351f;color:#7fd0a6;border:1px solid #2f9e6e}
.rt-ptag.est{background:#3a2f14;color:#e6b95c;border:1px dashed #c99a3a}
`;
