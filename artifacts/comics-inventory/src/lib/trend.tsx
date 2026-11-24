// ▲ / ▼ / – trend arrows shared by the homepage and Data Fix (Nov 24).
// Two baselines, both kept in this browser:
//   • per deploy  - brbHomeTrend_v1: a new build stamp rolls "cur" into "prev"
//   • per week    - brbWeekly_v1: one snapshot per day; compared with the newest
//                   snapshot at least 7 days old (Robert: comics/keys/boxes by week)
import { DATA } from "@/data/data";

export const BUILD_STAMP = (typeof __BUILD_TIME__ !== "undefined" && __BUILD_TIME__) ? __BUILD_TIME__ : DATA.generatedAt;
const DEPLOY_KEY = "brbHomeTrend_v1";
const WEEK_KEY = "brbWeekly_v1";

type Deploy = { stamp: string; cur: Record<string, number>; prev: Record<string, number> };

/** Record `now` for this deploy and return the previous deploy's numbers. */
export function deployPrev(now: Record<string, number>): Record<string, number> {
  try {
    const t = JSON.parse(localStorage.getItem(DEPLOY_KEY) || "null") as Deploy | null;
    const next: Deploy = !t ? { stamp: BUILD_STAMP, cur: now, prev: {} }
      : t.stamp !== BUILD_STAMP ? { stamp: BUILD_STAMP, cur: { ...t.cur, ...now }, prev: t.cur || {} }
      : { ...t, cur: { ...t.cur, ...now } };
    localStorage.setItem(DEPLOY_KEY, JSON.stringify(next));
    return next.prev || {};
  } catch { return {}; }
}

const day = (d: Date) => d.toISOString().slice(0, 10);
/** Record today's numbers; return the newest snapshot >= 7 days old (or the oldest
 *  earlier one while a week of history builds up) and its date. */
export function weekPrev(now: Record<string, number>): { prev: Record<string, number>; since: string } {
  try {
    const h = JSON.parse(localStorage.getItem(WEEK_KEY) || "{}") as Record<string, Record<string, number>>;
    const today = day(new Date());
    h[today] = { ...(h[today] || {}), ...now };
    const cutoff = day(new Date(Date.now() - 60 * 864e5));
    for (const k of Object.keys(h)) if (k < cutoff) delete h[k];
    localStorage.setItem(WEEK_KEY, JSON.stringify(h));
    const weekAgo = day(new Date(Date.now() - 7 * 864e5));
    const older = Object.keys(h).filter(k => k < today).sort();
    const pick = older.filter(k => k <= weekAgo).pop() ?? older[0];
    return pick ? { prev: h[pick], since: pick } : { prev: {}, since: "" };
  } catch { return { prev: {}, since: "" }; }
}

/** ▲ / ▼ / – with the change; green when it moved the good way. */
export function Trend({ now, prev, goodUp = true, since = "the last deploy" }:
  { now: number; prev?: number; goodUp?: boolean; since?: string }) {
  if (prev === undefined || prev === null || Number.isNaN(prev))
    return <span className="trend trend-flat" title="No earlier snapshot in this browser yet">–</span>;
  const d = now - prev;
  if (d === 0) return <span className="trend trend-flat" title={`No change since ${since}`}>–</span>;
  const good = (d > 0) === goodUp;
  return <span className={`trend ${good ? "trend-good" : "trend-bad"}`} title={`Was ${prev.toLocaleString()} on ${since}`}>{d > 0 ? "▲" : "▼"} {Math.abs(d).toLocaleString()}</span>;
}
