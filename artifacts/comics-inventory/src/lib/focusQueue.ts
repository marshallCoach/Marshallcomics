// Focus list: Data Fix hands Edit Comic an ordered list of problem books so you can
// step ‹ Prev / Next › through them without going back to search (Nov 23, Robert:
// "go back and forth through the problems … so I can have focused time").
// Kept in sessionStorage: survives page switches, gone when the tab closes.

export type FocusItem = {
  title: string;
  issue: string;
  box?: string;
  volume?: string;
  problem: string;          // shown on the Edit page
  next?: string;            // suggested next move, shown under the problem
  link?: string;            // best-guess page to check (Fandom, Image Comics…)
  linkLabel?: string;
};
export type FocusQueue = { label: string; items: FocusItem[]; idx: number };

const KEY = "brbFocusQueue_v1";

export function getFocusQueue(): FocusQueue | null {
  try {
    const q = JSON.parse(sessionStorage.getItem(KEY) || "null");
    return q && Array.isArray(q.items) && q.items.length ? q : null;
  } catch { return null; }
}

export function setFocusQueue(q: FocusQueue | null) {
  try { q ? sessionStorage.setItem(KEY, JSON.stringify(q)) : sessionStorage.removeItem(KEY); } catch { /* private mode */ }
}

export const focusQuery = (it: FocusItem) => `${it.title} #${String(it.issue).replace(/^#/, "")}`;

/** Start a focus session at item `idx` and open it on the Edit Comic page. */
export function openFocus(label: string, items: FocusItem[], idx: number) {
  if (!items.length) return;
  const i = Math.max(0, Math.min(idx, items.length - 1));
  setFocusQueue({ label, items, idx: i });
  window.dispatchEvent(new CustomEvent("brb:navigate", { detail: { tab: "editcomic", query: focusQuery(items[i]) } }));
}

/** Best-guess Fandom issue page from title / volume / issue (Marvel or DC), else a search. */
export function fandomGuess(c: { Title: string; Issue: string | number; Volume?: string; Publisher?: string }): string {
  const p = String(c.Publisher || "").toLowerCase();
  const iss = String(c.Issue ?? "").replace(/^#/, "").trim();
  const host = p.includes("marvel") ? "marvel.fandom.com" : (p === "dc" || p.startsWith("dc ") || p.includes("dc comics")) ? "dc.fandom.com" : "";
  if (!host || !/^[\d.]+$/.test(iss)) {
    const q = encodeURIComponent(`${c.Title} ${iss} comic`);
    return `https://www.google.com/search?q=${q}+site%3Afandom.com`;
  }
  const page = `${c.Title.replace(/ /g, "_")}_Vol_${String(c.Volume || "1").trim() || "1"}_${iss}`;
  return `https://${host}/wiki/${encodeURIComponent(page).replace(/%2F/g, "/").replace(/%3A/g, ":")}`;
}
