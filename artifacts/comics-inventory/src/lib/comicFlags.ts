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

export type FlagMap = Record<string, string[]>;

export function comicFlagKey(title: string, issue: string, box: string): string {
  return `${(title || "").trim()}|||${(issue || "").trim()}|||${(box || "").trim()}`;
}

function readLS(): FlagMap {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
  catch { return {}; }
}

export function loadAllFlags(): FlagMap {
  return readLS();
}

export function getComicFlag(key: string): string[] | null {
  const all = readLS();
  return key in all ? all[key] : null;
}

export function setComicFlag(key: string, fields: string[]): void {
  const all = readLS();
  all[key] = fields;
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}

export function clearComicFlag(key: string): void {
  const all = readLS();
  delete all[key];
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}
