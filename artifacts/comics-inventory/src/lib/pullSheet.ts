// Live link to Robert's Google Sheet pull list ("Magnus comics list" tab), Nov 26.
// The sheet stays private: a small Apps Script web app on the sheet (tools/pull_list_apps_script.gs)
// answers GET (read the list) and POST (set a title New / Existing / Finished / Dropped), and only for the right
// passphrase. The web-app URL + passphrase live in THIS browser only (localStorage) - they are
// never committed to the repo.
export type LiveRow = { row: number; publisher: string; title: string; type: string; status: string; grade: string; mood: string };

const KEY = "brbPullSheet_v1";
export type SheetConf = { url: string; token: string };

export function loadConf(): SheetConf | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null");
    return c && c.url && c.token ? c : null;
  } catch { return null; }
}
export function saveConf(c: SheetConf | null) {
  try { c ? localStorage.setItem(KEY, JSON.stringify(c)) : localStorage.removeItem(KEY); } catch { /* private mode */ }
}

export async function fetchRows(c: SheetConf): Promise<LiveRow[]> {
  const r = await fetch(`${c.url}?token=${encodeURIComponent(c.token)}&t=${Date.now()}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.rows as LiveRow[];
}

// text/plain body = a "simple" request, so the browser sends it straight to Apps Script
// (no CORS preflight, which Apps Script can't answer).
export const SHEET_STATUSES = ["New", "Existing", "Z - Finished", "Z - Dropped"] as const;
export type SheetStatus = typeof SHEET_STATUSES[number];

export async function setStatus(c: SheetConf, row: LiveRow, status: SheetStatus) {
  const r = await fetch(c.url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ token: c.token, row: row.row, title: row.title, status }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j;
}
