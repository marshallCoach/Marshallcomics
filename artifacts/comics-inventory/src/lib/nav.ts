// Site-wide navigation from anywhere (e.g. a cover deep inside any page) without
// threading an onNavigate prop through every component. App listens for this
// event and calls its own navigateTo().
export const NAV_EVENT = "brb:navigate";

export type NavDetail = { tab: string; params?: Record<string, string> };

export function navTo(tab: string, params?: Record<string, string>) {
  window.dispatchEvent(new CustomEvent<NavDetail>(NAV_EVENT, { detail: { tab, params } }));
}

/** Jump to Cover Review filtered to every cover of this title — the "(t)" link. */
export function openTitle(title: string) {
  if (title) navTo("coverreview", { title });
}
