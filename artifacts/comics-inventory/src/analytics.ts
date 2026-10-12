// GoatCounter — privacy-light page analytics (no cookies, GDPR-friendly).
// Counts each hash route of this SPA so you can finally see most/least-visited.
//
// TO TURN ON (one-time, ~2 min):
//   1. Sign up free at https://www.goatcounter.com — pick a code (e.g. "marshallcomics").
//   2. Put that code in GC_CODE below.
//   3. Commit + deploy. Visits start logging; view them at
//      https://<code>.goatcounter.com.
// Until GC_CODE is set this is a complete no-op — nothing loads, nothing is sent.
const GC_CODE = "marshallcomics"; // e.g. "marshallcomics"

export function initAnalytics(): void {
  if (!GC_CODE) return;
  const path = () => (location.hash ? location.hash.replace(/^#/, "/") : "/");
  const s = document.createElement("script");
  s.async = true;
  s.src = "//gc.zgo.at/count.js";
  s.setAttribute("data-goatcounter", `https://${GC_CODE}.goatcounter.com/count`);
  // no_onload: we count manually so each client-side hash route registers.
  s.setAttribute("data-goatcounter-settings", JSON.stringify({ no_onload: true }));
  s.onload = () => {
    const gc = (window as unknown as { goatcounter?: { count: (o: { path: string }) => void } }).goatcounter;
    const hit = () => { try { gc?.count({ path: path() }); } catch { /* ignore */ } };
    hit();
    window.addEventListener("hashchange", hit);
  };
  document.head.appendChild(s);
}
