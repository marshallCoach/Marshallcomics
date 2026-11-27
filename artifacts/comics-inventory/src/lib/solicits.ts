// Next month's solicited issues for the pull list (Nov 26).
// Source: the Marvel Database + DC Database wikis (Fandom), read live in the browser
// (their API allows cross-site reads). Only issues the wiki already lists for that month are
// shown. Nothing is guessed. Image/Skybound/other publishers have no wiki source here.
//   Marvel: "Category:Comics Released in <Month>, <Year>"  (on-sale month)
//   DC:     "Category:<Year>, <Month>"                       (COVER month = on-sale month + 2; checked Nov 27:
//           Batgirl #25, on sale Nov 4 2026, is filed under "2027, January". So December's
//           on-sale DC books live under "2027, February", which fills in as DC solicits post.)
export type Solicit = { series: string; issue: string; page: string; wiki: "marvel" | "dc"; thumb?: string; month: string };

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function nextMonth(d = new Date(), ahead = 1): { name: string; year: number } {
  const t = d.getFullYear() * 12 + d.getMonth() + ahead;
  return { name: MONTHS[t % 12], year: Math.floor(t / 12) };
}

// Same normalisation the page uses for titles, minus a leading "The".
export const solKey = (s: string) =>
  s.toLowerCase().replace(/^the\s+/, "").replace(/&/g, "and").replace(/[^a-z0-9]/g, "");

const COLLECTED = /\b(TPB|HC|Omnibus|Epic Collection|Premier Collection|Facsimile|Library|Compendium|Treasury)\b/i;

async function members(wiki: string, cat: string): Promise<string[]> {
  const out: string[] = [];
  let cont = "";
  for (let i = 0; i < 6; i++) {
    const u = `https://${wiki}.fandom.com/api.php?action=query&list=categorymembers&cmnamespace=0&cmlimit=500&format=json&origin=*` +
              `&cmtitle=${encodeURIComponent("Category:" + cat)}${cont ? "&cmcontinue=" + encodeURIComponent(cont) : ""}`;
    const j = await (await fetch(u)).json();
    for (const m of j?.query?.categorymembers ?? []) out.push(m.title);
    cont = j?.continue?.cmcontinue;
    if (!cont) break;
  }
  return out;
}

async function thumbs(wiki: string, pages: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (let i = 0; i < pages.length; i += 50) {
    const u = `https://${wiki}.fandom.com/api.php?action=query&prop=pageimages&piprop=thumbnail&pithumbsize=240&format=json&origin=*` +
              `&titles=${encodeURIComponent(pages.slice(i, i + 50).join("|"))}`;
    try {
      const j = await (await fetch(u)).json();
      for (const p of Object.values(j?.query?.pages ?? {}) as { title: string; thumbnail?: { source: string } }[])
        if (p.thumbnail?.source) out[p.title] = p.thumbnail.source;
    } catch { /* covers are optional */ }
  }
  return out;
}

// "Avengers Vol 10 2" -> { series: "Avengers", issue: "2" }
function parsePage(t: string) {
  const m = t.match(/^(.*) Vol \d+ (\S+)$/);
  return m ? { series: m[1], issue: m[2] } : null;
}

const CACHE = "brbSolicits_v2";

// Returns { titleKey: Solicit[] } for the wanted titles only (all issues that month, lowest first).
export async function loadSolicits(titles: { title: string; publisher: string }[]): Promise<Record<string, Solicit[]>> {
  const nm = nextMonth();
  const month = `${nm.name} ${nm.year}`;
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE) || "null");
    if (c && c.month === month && c.day === new Date().toDateString()) return c.data;
  } catch { /* no cache */ }

  const want = new Set(titles.map(t => solKey(t.title)));
  const cats: [("marvel" | "dc"), string][] = [
    ["marvel", `Comics Released in ${nm.name}, ${nm.year}`],
    ["dc", (dc => `${dc.year}, ${dc.name}`)(nextMonth(new Date(), 3))],   // cover month = on-sale + 2
  ];
  const res: Record<string, Solicit[]> = {};
  for (const [wiki, cat] of cats) {
    let pages: string[] = [];
    try { pages = await members(wiki, cat); } catch { continue; }
    const hits: Solicit[] = [];
    for (const p of pages) {
      if (COLLECTED.test(p)) continue;
      const pp = parsePage(p);
      if (!pp || !want.has(solKey(pp.series))) continue;
      hits.push({ series: pp.series, issue: pp.issue, page: p, wiki, month });
    }
    const th = await thumbs(wiki, hits.map(h => h.page));
    for (const h of hits) {
      h.thumb = th[h.page];
      (res[solKey(h.series)] ||= []).push(h);
    }
  }
  for (const k in res) res[k].sort((a, b) => parseFloat(a.issue) - parseFloat(b.issue));
  try { sessionStorage.setItem(CACHE, JSON.stringify({ month, day: new Date().toDateString(), data: res })); } catch { /* ok */ }
  return res;
}

export const wikiUrl = (s: Solicit) => `https://${s.wiki}.fandom.com/wiki/${encodeURIComponent(s.page.replace(/ /g, "_"))}`;
