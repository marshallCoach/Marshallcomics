// Story-arc data (from brb_arc_extract → new xlsx columns → data3) + the
// "assumed Fandom link" for missing covers / missing issues.
import type { Comic } from "@/data/data";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export type ArcComic = Comic & {
  Story_Arc?: string; Arc_Part?: string; Arc_Length?: string; Arc_Finale?: string;
  Crossover_Event?: string; Arc_Confidence?: string; Arc_Source?: string;
};

export type ConfKey = "stated" | "grouped" | "inferred";
export const CONF: Record<ConfKey, { color: string; label: string; help: string }> = {
  stated:   { color: "#15803d", label: "Stated",   help: "Fandom names the arc / \"Part X of Y\"" },
  grouped:  { color: "#b45309", label: "Grouped",  help: "Consecutive issues share a story title" },
  inferred: { color: "#c2410c", label: "Inferred", help: "From solicit wording (\"new 6-issue arc\", \"concludes\")" },
};

export function confKey(s?: string): ConfKey | null {
  const t = (s || "").toLowerCase();
  if (t.includes("stat") || t.includes("explicit")) return "stated";
  if (t.includes("group")) return "grouped";
  if (t.includes("infer") || t.includes("collect")) return "inferred";
  return null;
}

const num = (s?: string) => { const n = parseFloat(String(s ?? "").replace(/^#/, "")); return Number.isFinite(n) ? n : null; };

export type ArcInfo = { name: string; part: number | null; length: number | null; finale: string; conf: ConfKey | null; source: string };

export function arcOf(c: Comic): ArcInfo | null {
  const a = c as ArcComic;
  const name = (a.Story_Arc || "").trim();
  if (!name) return null;
  return { name, part: num(a.Arc_Part), length: num(a.Arc_Length), finale: (a.Arc_Finale || "").replace(/^#/, "").trim(),
           conf: confKey(a.Arc_Confidence), source: (a.Arc_Source || "").trim() };
}

export const eventOf = (c: Comic) => ((c as ArcComic).Crossover_Event || "").trim();

/** Every issue number the arc spans (from part numbers + length), or null if unknown. */
export function arcIssueRange(members: Comic[]): number[] | null {
  for (const m of members) {
    const a = arcOf(m); const i = num(String(m.Issue));
    if (a && a.part && a.length && i !== null && Number.isInteger(i)) {
      const start = i - (a.part - 1);
      return Array.from({ length: a.length }, (_, k) => start + k);
    }
  }
  return null;
}

/** Owned members of the same arc (same title + volume + arc name) and the missing issue numbers. */
export function arcOwnership(c: Comic, all: Comic[]) {
  const a = arcOf(c);
  if (!a) return null;
  const vol = String(c.Volume || "1");
  const members = all.filter(x => x.Title === c.Title && String(x.Volume || "1") === vol && arcOf(x)?.name === a.name);
  const owned = new Set(members.map(m => num(String(m.Issue))).filter((n): n is number => n !== null));
  const range = arcIssueRange(members);
  const missing = range ? range.filter(n => !owned.has(n)) : [];
  return { members, ownedCount: range ? range.filter(n => owned.has(n)).length : owned.size, length: range?.length ?? a.length, missing };
}

// ── Assumed Fandom link ────────────────────────────────────────────────────────
let linksP: Promise<Record<string, string>> | null = null;
export function loadFandomLinks(): Promise<Record<string, string>> {
  if (!linksP) linksP = fetch(`${BASE}/fandom_links.json`).then(r => r.ok ? r.json() : {}).catch(() => ({}));
  return linksP;
}

const WIKI: Record<string, string> = { marvel: "https://marvel.fandom.com", dc: "https://dc.fandom.com" };
const wikiFor = (pub?: string) => { const p = (pub || "").toLowerCase(); return p.includes("marvel") ? WIKI.marvel : (p.includes("dc") && !p.includes("dark")) ? WIKI.dc : null; };
const pageEnc = (s: string) => encodeURIComponent(s.replace(/ /g, "_")).replace(/%3A/g, ":").replace(/%2F/g, "/").replace(/%2C/g, ",");
const issueEnc = (i: string | number) => encodeURIComponent(String(i).replace(/^#/, "").trim());
const VOL_RE = /^(https?:\/\/[^/]+)\/wiki\/(.+?)_Vol_(\d+)(?:_[^?#]*)?/;

export type FandomGuess = { url: string; basis: "your link" | "same arc" | "guess" };

/**
 * Best-effort Fandom page for a (possibly missing) issue. Prefers, in order:
 * 1. a link YOU pasted for the same title (same volume when possible) — issue swapped;
 * 2. the Arc Source of a sibling in the same title + volume — issue swapped;
 * 3. a constructed guess from title + volume (Marvel/DC only).
 */
export function fandomGuess(
  c: { Title: string; Issue: string | number; Volume?: string; Publisher?: string },
  links: Record<string, string>, siblings: Comic[] = [],
): FandomGuess | null {
  const iss = issueEnc(c.Issue);
  if (!iss) return null;
  const vol = String(c.Volume || "1").trim();
  const tl = (c.Title || "").trim().toLowerCase();
  const mine: { base: string; stem: string; vol: string }[] = [];
  for (const [k, u] of Object.entries(links)) {
    if (k.split("|||")[0] !== tl) continue;
    const m = VOL_RE.exec(u || "");
    if (m) mine.push({ base: m[1], stem: m[2], vol: m[3] });
  }
  const pickV = mine.find(x => x.vol === vol) || (new Set(mine.map(x => x.vol)).size === 1 ? mine[0] : undefined);
  if (pickV) return { url: `${pickV.base}/wiki/${pickV.stem}_Vol_${pickV.vol}_${iss}`, basis: "your link" };
  for (const s of siblings) {
    if (String(s.Volume || "1").trim() !== vol) continue;
    const m = VOL_RE.exec(((s as ArcComic).Arc_Source || "").trim());
    if (m) return { url: `${m[1]}/wiki/${m[2]}_Vol_${m[3]}_${iss}`, basis: "same arc" };
  }
  const base = wikiFor(c.Publisher);
  if (!base) return null;
  let t = (c.Title || "").trim();
  if (base === WIKI.marvel) t = t.replace(/^The\s+/i, "");   // Marvel Database drops a leading "The"
  return { url: `${base}/wiki/${pageEnc(t)}_Vol_${vol || "1"}_${iss}`, basis: "guess" };
}
