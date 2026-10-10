// One source of truth for turning a creator CELL — e.g. "Stan Lee, Jack Kirby
// & Various" or "John Romita, Jr. / Klaus Janson" — into individual, trimmed
// creator names. Multi-creator cells were previously counted as single blobs,
// which (a) inflated "unique creator" counts (every combo = a fake person) and
// (b) scattered a prolific creator's total across every combo string. Split
// here so both the unique counts and the top-creator rankings count real people.
//
// "Various"/"Unknown"/studio markers are not individual people and are dropped;
// use isVarious() to tally those books separately instead of letting them vanish.

const SPLIT = /\s*(?:,|;|\/|&|\+|\band\b|\bwith\b)\s*/i;
const SUFFIX = /^(?:jr|sr|ii|iii|iv)\.?$/i;
const JUNK = /^(?:various(?:\s+artists?|\s+writers?)?|unknown|nan|n\/a|tba|tbd|inc\.?|co\.?|llc|studios?)$/i;

export function isVarious(cell: string | undefined | null): boolean {
  const v = (cell ?? "").trim().toLowerCase();
  return v === "various" || v === "various artists" || v === "various writers";
}

// Individual creator names in a cell, de-junked. Empty array for blank/nan/Various.
export function splitCreators(cell: string | undefined | null): string[] {
  const raw = (cell ?? "").trim();
  if (!raw || raw.toLowerCase() === "nan") return [];
  const parts = raw.split(SPLIT).map(p => p.trim()).filter(Boolean);
  // A bare suffix ("Jr.", "III") is part of the preceding name, not its own
  // person — re-attach it so "John Romita, Jr." stays one creator.
  const merged: string[] = [];
  for (const p of parts) {
    if (SUFFIX.test(p) && merged.length) merged[merged.length - 1] += `, ${p}`;
    else merged.push(p);
  }
  return merged.filter(p => !JUNK.test(p));
}

// Tally individual creators across a list of rows. Returns name -> book count.
export function tallyCreators<T>(rows: T[], pick: (r: T) => string | undefined | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) for (const name of splitCreators(pick(r))) out[name] = (out[name] || 0) + 1;
  return out;
}
