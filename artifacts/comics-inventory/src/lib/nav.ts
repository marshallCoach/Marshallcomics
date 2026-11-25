// Site-wide navigation from anywhere (e.g. a cover deep inside any page) without
// threading an onNavigate prop through every component. App listens for this
// event and calls its own navigateTo().
export const NAV_EVENT = "brb:navigate";

export type NavDetail = { tab: string; params?: Record<string, string> };

export function navTo(tab: string, params?: Record<string, string>) {
  window.dispatchEvent(new CustomEvent<NavDetail>(NAV_EVENT, { detail: { tab, params } }));
}

/** Open the Title page for this title (whole run, boxes, gaps) — the "(t)" link. */
export function openTitle(title: string) {
  if (title) navTo("title", { title });
}

/** Jump to Cover Review limited to ONE story arc of a title — the "(a)" link. */
export function openArc(title: string, arc: string, volume?: string) {
  if (title && arc) navTo("coverreview", { title, arc, vol: String(volume || "1") });
}
