// Data Fix problem rules, shared by the Data Fix page and the homepage counter
// (Nov 24: the homepage shows how many books Data Fix still lists, so both must
// use exactly the same rules).
import type { Comic } from "@/data/data";

export type ProblemId = "series-match" | "arc-conflict" | "no-date" | "date-conflict" | "no-volume" | "no-year" | "likely-variant" | "not-in-gcd" | "no-cover" | "cover-no-data";

export const PROBLEMS: { id: ProblemId; label: string; blurb: string; color: string; vol?: boolean; yr?: boolean; info?: boolean; solutions: { key: string; label: string }[] }[] = [
  { id: "no-date",       label: "Missing publication date", blurb: "Not matched in GCD/Comic Vine — no on-sale date", color: "#c8102e",
    solutions: [{ key: "cv", label: "Try Comic Vine next run" }, { key: "no-entry", label: "No catalogue entry — accept blank" }] },
  { id: "date-conflict", label: "Year / volume conflict",    blurb: "On-sale date disagrees with Year — year or volume likely wrong", color: "#b45309", vol: true, yr: true,
    solutions: [{ key: "trust-gcd", label: "Trust the on-sale date" }, { key: "trust-year", label: "Trust my Year — fix the date" }] },
  { id: "no-volume",     label: "Missing volume",            blurb: "No volume number recorded", color: "#7c3aed", vol: true,
    solutions: [{ key: "vol1", label: "It's Volume 1" }, { key: "research", label: "Needs research" }] },
  { id: "no-year",       label: "Missing / bad year",        blurb: "Year is blank or not a 4-digit year", color: "#0e7490", yr: true,
    solutions: [{ key: "research", label: "Needs research" }] },
  { id: "likely-variant", label: "Likely variant (cover-buy)", blurb: "CC1 cover-buy. If the cover shown is correct, click “Cover's right”. Only paste a Fandom link if the cover is wrong.", color: "#db2777",
    solutions: [{ key: "confirm-variant", label: "✓ Cover's right — keep as variant" }, { key: "not-variant", label: "Not a variant (regular copy)" }] },
  { id: "not-in-gcd",    label: "Not in GCD",                blurb: "Informational — GCD has no series, but most are verified by a Fandom cover or are variants/recent. Not counted as work.", color: "#0891b2", vol: true, info: true,
    solutions: [{ key: "indie", label: "Indie — not catalogued" }, { key: "research", label: "Needs research" }] },
  { id: "cover-no-data", label: "Has a cover, but missing data", blurb: "The cover is right but credits / date / volume are blank — paste the Fandom page and the next run fills the gaps", color: "#059669",
    solutions: [{ key: "no-entry", label: "Nothing more to find — accept blanks" }] },
  { id: "no-cover",      label: "Missing cover",             blurb: "No cover image yet — paste the Fandom page link to pull one (big bucket; collapsed by default)", color: "#2563eb",
    solutions: [{ key: "no-art", label: "No art available — accept blank" }] },
];
// Fields a cover-bearing book should also have (blank / placeholder = missing).
export const DATA_FIELDS: [keyof Comic | "Pub_Date", string][] = [["Writer", "writer"], ["Artist", "artist"], ["Cover_Artist", "cover artist"], ["Pub_Date", "pub date"], ["Volume", "volume"], ["Year", "year"]];
export const missingData = (c: Comic) => DATA_FIELDS.filter(([k]) => {
  const v = String((c as unknown as Record<string, unknown>)[k] ?? "").trim();
  return !v || /^(n\/a|unknown|\?|tbd|none|nan)$/i.test(v);
}).map(([, label]) => label);
export const PROBLEM_MAP = Object.fromEntries(PROBLEMS.map(p => [p.id, p]));
// Informational problems are shown for reference but excluded from the "to go"
// count and the default (all) view — they need no per-book action here.
export const INFO_PROBLEMS = new Set<ProblemId>(PROBLEMS.filter(p => p.info).map(p => p.id));

export function comicId(c: Comic): string {
  return `${(c.Title ?? "").trim()}|||${String(c.Issue ?? "").trim()}|||${(c.Box ?? "").trim()}`;
}
export const issueNum = (v: unknown) => {
  const m = String(v ?? "").replace(/^#/, "").match(/[\d.]+/);
  return m ? parseFloat(m[0]) : Number.POSITIVE_INFINITY;
};
export function problemsFor(c: Comic): ProblemId[] {
  const out: ProblemId[] = [];
  const pd = (c as { Pub_Date?: string }).Pub_Date || "";
  const yr = (c.Year || "").trim();
  const pdY = /^(\d{4})/.exec(pd)?.[1];
  if (!pd) out.push("no-date");
  else if (pdY && /^\d{4}$/.test(yr) && Math.abs(+pdY - +yr) > 1) out.push("date-conflict");
  if (!(c.Volume || "").trim()) out.push("no-volume");
  if (!/^\d{4}$/.test(yr)) out.push("no-year");
  if ((c.Box || "").trim() === "CC1") out.push("likely-variant");
  return out;
}

// ── Live "to go" count, same rules as the Data Fix page header ──────────────
// Covers + the committed triage memory decide each book's problems; this
// browser's saved Data Fix answers (brbDataFixes_v1) are subtracted, exactly
// like the page's "N to go". Informational flags (not-in-gcd) never count.
export type DataFixCounts = { remaining: number; byProblem: { id: ProblemId; label: string; count: number }[] };

export async function dataFixCounts(comics: Comic[], base: string,
  coverUrl: (c: Comic) => string | null, coversReady: () => Promise<void>): Promise<DataFixCounts> {
  const j = (u: string) => fetch(`${base}/${u}`).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const [rf, cv] = await Promise.all([j("resolved_flags.json"), j("confirmed_variants.json"), coversReady()]);
  const resolved: Record<string, string[]> = rf && typeof rf === "object" ? rf : {};
  const variants = new Set<string>(Array.isArray(cv) ? cv : []);
  let fixes: Record<string, unknown> = {};
  try { fixes = JSON.parse(localStorage.getItem("brbDataFixes_v1") || "{}"); } catch { /* none */ }
  let remaining = 0;
  const per: Record<string, number> = {};
  for (const c of comics) {
    const id = comicId(c);
    if (id in fixes) continue;
    let ps = problemsFor(c);
    if (coverUrl(c) === null) ps.push("no-cover");
    else if (missingData(c).length) ps.push("cover-no-data");
    const done = resolved[id] || [];
    ps = ps.filter(p => !done.includes(p) && !(p === "likely-variant" && variants.has(id)) && !INFO_PROBLEMS.has(p));
    if (!ps.length) continue;
    remaining++;
    for (const p of ps) per[p] = (per[p] || 0) + 1;
  }
  const byProblem = Object.entries(per).map(([id, count]) => ({ id: id as ProblemId, label: PROBLEM_MAP[id]?.label || id, count }))
    .sort((a, b) => b.count - a.count);
  return { remaining, byProblem };
}
