const LS_KEY = "brbNeedsUpdate";

export const UPDATE_FIELDS = [
  "Writer", "Artist", "Cover Artist",
  "Arc / Event", "Universe", "Era", "Imprint",
  "Key Status", "Key Reason", "First App",
  "Condition", "Value NM", "Value VF", "CGC Worth", "Start Bid",
  "Signed", "Signed By",
  "Story Pitch", "Seller Notes",
  "Category", "Platform", "Box", "Terrificon",
];

export interface FlagEntry {
  fields: string[];
  notes: string;
}

export type FlagMap = Record<string, FlagEntry>;

export function comicFlagKey(title: string, issue: string, box: string): string {
  return `${(title || "").trim()}|||${(issue || "").trim()}|||${(box || "").trim()}`;
}

function readLS(): FlagMap {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    // Migrate old format (plain string[]) to new { fields, notes }
    const migrated: FlagMap = {};
    for (const [k, v] of Object.entries(raw)) {
      if (Array.isArray(v)) {
        migrated[k] = { fields: v as string[], notes: "" };
      } else {
        migrated[k] = v as FlagEntry;
      }
    }
    return migrated;
  } catch { return {}; }
}

export function loadAllFlags(): FlagMap {
  return readLS();
}

export function getComicFlag(key: string): FlagEntry | null {
  const all = readLS();
  return key in all ? all[key] : null;
}

export function setComicFlag(key: string, fields: string[], notes: string): void {
  const all = readLS();
  all[key] = { fields, notes };
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}

export function clearComicFlag(key: string): void {
  const all = readLS();
  delete all[key];
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}
