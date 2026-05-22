import { useState, useMemo } from "react";
import { DATA3 } from "@/data/data3";

const comics = DATA3.comics;

// ─── Checklist Data ────────────────────────────────────────────────────────────
interface ChecklistItem {
  sort: number;
  series: string;
  issue: string;
  year: string;
  significance: string;
  credits: string;
  value: string;
}

const CHECKLIST: ChecklistItem[] = [
  { sort:1,  series:"Tales of Suspense",             issue:"#58",              year:"1964", significance:"1st appearance of Kraken; early Cap villain run",              credits:"Don Heck / Stan Lee",                   value:"$25–60"     },
  { sort:2,  series:"Tales of Suspense",             issue:"#75",              year:"1966", significance:"Cap vs Red Skull; classic early run",                          credits:"Jack Kirby / Stan Lee",                  value:"$30–80"     },
  { sort:3,  series:"Captain America (Vol.1)",       issue:"#100",             year:"1968", significance:"1st issue of solo series; Iron Man app; KEY",                  credits:"Jack Kirby / Stan Lee",                  value:"$200–600"   },
  { sort:4,  series:"Captain America (Vol.1)",       issue:"#101",             year:"1968", significance:"Red Skull appearance; early series key",                       credits:"Jack Kirby / Stan Lee",                  value:"$40–100"    },
  { sort:5,  series:"Captain America (Vol.1)",       issue:"#103",             year:"1968", significance:"Red Skull / Cosmic Cube; Kirby classic",                       credits:"Jack Kirby / Stan Lee",                  value:"$40–100"    },
  { sort:6,  series:"Captain America (Vol.1)",       issue:"#110",             year:"1969", significance:"1st appearance of Madame Hydra (Viper); KEY",                  credits:"Jim Steranko / Stan Lee",                value:"$100–400"   },
  { sort:7,  series:"Captain America (Vol.1)",       issue:"#111",             year:"1969", significance:"Death of Steve Rogers (fake); Steranko iconic cover; KEY",     credits:"Jim Steranko / Stan Lee",                value:"$80–300"    },
  { sort:8,  series:"Captain America (Vol.1)",       issue:"#113",             year:"1969", significance:"Classic Steranko cover; last Steranko issue; KEY",             credits:"Jim Steranko / Stan Lee",                value:"$80–250"    },
  { sort:9,  series:"Captain America (Vol.1)",       issue:"#117",             year:"1969", significance:"1st appearance of THE FALCON; MAJOR KEY 🦅",                   credits:"Gene Colan / Stan Lee",                  value:"$500–4000+" },
  { sort:10, series:"Captain America (Vol.1)",       issue:"#118",             year:"1969", significance:"2nd appearance of Falcon; origin begins",                      credits:"Gene Colan / Stan Lee",                  value:"$80–250"    },
  { sort:11, series:"Captain America (Vol.1)",       issue:"#119",             year:"1969", significance:"3rd Falcon; Red Skull app",                                    credits:"Gene Colan / Stan Lee",                  value:"$60–180"    },
  { sort:12, series:"Captain America (Vol.1)",       issue:"#120",             year:"1969", significance:"Falcon joins Cap; early team dynamic",                         credits:"Gene Colan / Stan Lee",                  value:"$50–150"    },
  { sort:13, series:"Captain America (Vol.1)",       issue:"#122",             year:"1969", significance:"Falcon cover appearance; strong issue",                        credits:"Gene Colan / Stan Lee",                  value:"$40–120"    },
  { sort:14, series:"Captain America (Vol.1)",       issue:"#126",             year:"1970", significance:"Falcon featured; solid Bronze era copy",                       credits:"Gene Colan / Stan Lee",                  value:"$30–80"     },
  { sort:15, series:"Captain America (Vol.1)",       issue:"#133",             year:"1971", significance:"1st Falcon as co-star billing; KEY 🦅",                        credits:"Gene Colan / Stan Lee",                  value:"$60–200"    },
  { sort:16, series:"Captain America (Vol.1)",       issue:"#134",             year:"1971", significance:"Series renamed Cap & Falcon; transitional key",                credits:"Gene Colan / Stan Lee",                  value:"$40–120"    },
  { sort:17, series:"Captain America (Vol.1)",       issue:"#143",             year:"1971", significance:"Nick Fury app; classic Bronze era",                            credits:"John Romita Sr / Stan Lee",               value:"$30–80"     },
  { sort:18, series:"Captain America (Vol.1)",       issue:"#144",             year:"1971", significance:"Femme Force intro; Peggy Carter appears",                      credits:"John Romita Sr / Stan Lee",               value:"$30–80"     },
  { sort:19, series:"Captain America (Vol.1)",       issue:"#150",             year:"1972", significance:"Cap/Falcon early 70s; solid run issue",                        credits:"Sal Buscema / Gary Friedrich",            value:"$25–60"     },
  { sort:20, series:"Captain America (Vol.1)",       issue:"#153",             year:"1972", significance:"1st appearance of Captain America (1950s) / William Burnside; KEY", credits:"Sal Buscema / Steve Englehart",       value:"$60–200"    },
  { sort:21, series:"Captain America (Vol.1)",       issue:"#154",             year:"1972", significance:"Origin of 1950s Cap; KEY continuation",                        credits:"Sal Buscema / Steve Englehart",           value:"$50–150"    },
  { sort:22, series:"Captain America (Vol.1)",       issue:"#155",             year:"1972", significance:"Cap vs Cap; 1950s storyline climax",                           credits:"Sal Buscema / Steve Englehart",           value:"$40–120"    },
  { sort:23, series:"Captain America (Vol.1)",       issue:"#156",             year:"1973", significance:"1950s Cap storyline finale",                                   credits:"Sal Buscema / Steve Englehart",           value:"$30–80"     },
  { sort:24, series:"Captain America (Vol.1)",       issue:"#157",             year:"1973", significance:"Sharon Carter app; ongoing run",                               credits:"Sal Buscema / Steve Englehart",           value:"$25–60"     },
  { sort:25, series:"Captain America (Vol.1)",       issue:"#160",             year:"1973", significance:"Solarr 1st appearance",                                        credits:"Sal Buscema / Steve Englehart",           value:"$25–60"     },
  { sort:26, series:"Captain America (Vol.1)",       issue:"#163",             year:"1973", significance:"1st appearance of Dave Cox / Serpent Squad adjacent",          credits:"Sal Buscema / Steve Englehart",           value:"$25–60"     },
  { sort:27, series:"Captain America (Vol.1)",       issue:"#168",             year:"1973", significance:"1st appearance of Helmut Zemo (as Phoenix); KEY",              credits:"Sal Buscema / Tony Isabella",             value:"$80–300"    },
  { sort:28, series:"Captain America (Vol.1)",       issue:"#169",             year:"1974", significance:"Helmut Zemo story continues; KEY run",                         credits:"Sal Buscema / Tony Isabella",             value:"$40–100"    },
  { sort:29, series:"Captain America (Vol.1)",       issue:"#170",             year:"1974", significance:"Porcupine app; Englehart run",                                 credits:"Sal Buscema / Steve Englehart",           value:"$25–60"     },
  { sort:30, series:"Captain America (Vol.1)",       issue:"#172",             year:"1974", significance:"X-Men crossover begins; KEY",                                  credits:"Sal Buscema / Steve Englehart",           value:"$60–180"    },
  { sort:31, series:"Captain America (Vol.1)",       issue:"#173",             year:"1974", significance:"X-Men crossover part 2",                                       credits:"Sal Buscema / Steve Englehart",           value:"$50–150"    },
  { sort:32, series:"Captain America (Vol.1)",       issue:"#174",             year:"1974", significance:"X-Men crossover concludes",                                    credits:"Sal Buscema / Steve Englehart",           value:"$40–120"    },
  { sort:33, series:"Captain America (Vol.1)",       issue:"#175",             year:"1974", significance:"Secret Empire begins; Watergate allegory; KEY story arc",      credits:"Sal Buscema / Steve Englehart",           value:"$50–150"    },
  { sort:34, series:"Captain America (Vol.1)",       issue:"#176",             year:"1974", significance:"Steve Rogers quits as Cap; KEY",                              credits:"Sal Buscema / Steve Englehart",           value:"$50–150"    },
  { sort:35, series:"Captain America (Vol.1)",       issue:"#177",             year:"1974", significance:"Steve becomes Nomad; KEY",                                     credits:"Sal Buscema / Steve Englehart",           value:"$60–200"    },
  { sort:36, series:"Captain America (Vol.1)",       issue:"#178",             year:"1974", significance:"Nomad story continues",                                        credits:"Sal Buscema / Steve Englehart",           value:"$40–100"    },
  { sort:37, series:"Captain America (Vol.1)",       issue:"#179",             year:"1974", significance:"Nomad vs Patsy Walker adjacent era",                           credits:"Sal Buscema / Steve Englehart",           value:"$30–80"     },
  { sort:38, series:"Captain America (Vol.1)",       issue:"#180",             year:"1974", significance:"Steve Rogers returns as Nomad confirmed; KEY",                 credits:"Sal Buscema / Steve Englehart",           value:"$50–150"    },
  { sort:39, series:"Captain America (Vol.1)",       issue:"#181",             year:"1975", significance:"New Cap (Dave Rickford concept era); KEY story",               credits:"Frank Robbins / Steve Englehart",         value:"$40–100"    },
  { sort:40, series:"Captain America (Vol.1)",       issue:"#182",             year:"1975", significance:"Falcon solo focus issue",                                      credits:"Frank Robbins / Steve Englehart",         value:"$30–80"     },
  { sort:41, series:"Captain America (Vol.1)",       issue:"#183",             year:"1975", significance:"Steve Rogers returns as Captain America; KEY",                 credits:"Frank Robbins / Steve Englehart",         value:"$50–150"    },
  { sort:42, series:"Captain America (Vol.1)",       issue:"#186",             year:"1975", significance:"Falcon origin retconned / revealed; MAJOR KEY 🦅",             credits:"Frank Robbins / Steve Englehart",         value:"$80–250"    },
  { sort:43, series:"Captain America (Vol.1)",       issue:"#190",             year:"1975", significance:"Stunt-Master app; Bronze era solid",                           credits:"Frank Robbins / Tony Isabella",           value:"$25–60"     },
  { sort:44, series:"Captain America (Vol.1)",       issue:"#194",             year:"1975", significance:"Kirby returns to Cap; KEY creative moment",                    credits:"Jack Kirby / Jack Kirby",                value:"$50–150"    },
  { sort:45, series:"Captain America (Vol.1)",       issue:"#195",             year:"1976", significance:"Kirby era begins properly; Night People intro",                credits:"Jack Kirby / Jack Kirby",                value:"$40–100"    },
  { sort:46, series:"Captain America (Vol.1)",       issue:"#196",             year:"1976", significance:"Kirby run; Agron app",                                         credits:"Jack Kirby / Jack Kirby",                value:"$30–80"     },
  { sort:47, series:"Captain America (Vol.1)",       issue:"#197",             year:"1976", significance:"Kirby run; Falcon app",                                        credits:"Jack Kirby / Jack Kirby",                value:"$30–80"     },
  { sort:48, series:"Captain America (Vol.1)",       issue:"#198",             year:"1976", significance:"Kirby run; Arnim Zola setup",                                  credits:"Jack Kirby / Jack Kirby",                value:"$40–100"    },
  { sort:49, series:"Captain America (Vol.1)",       issue:"#200",             year:"1976", significance:"Kirby milestone issue #200; KEY",                              credits:"Jack Kirby / Jack Kirby",                value:"$60–200"    },
  { sort:50, series:"Captain America (Vol.1)",       issue:"#201",             year:"1976", significance:"Night Flyer app; Kirby run",                                   credits:"Jack Kirby / Jack Kirby",                value:"$25–60"     },
  { sort:51, series:"Captain America (Vol.1)",       issue:"#205",             year:"1977", significance:"Arnim Zola 1st full appearance; KEY",                          credits:"Jack Kirby / Jack Kirby",                value:"$60–200"    },
  { sort:52, series:"Captain America (Vol.1)",       issue:"#206",             year:"1977", significance:"Zola story continues; Kirby horror era",                       credits:"Jack Kirby / Jack Kirby",                value:"$40–100"    },
  { sort:53, series:"Captain America (Vol.1)",       issue:"#208",             year:"1977", significance:"1st appearance of Arnim Zola's android body; KEY adjacent",   credits:"Jack Kirby / Jack Kirby",                value:"$40–100"    },
  { sort:54, series:"Captain America (Vol.1)",       issue:"#212",             year:"1977", significance:"Kirby final arc; classic era close",                           credits:"Jack Kirby / Jack Kirby",                value:"$30–80"     },
  { sort:55, series:"Captain America (Vol.1)",       issue:"#214",             year:"1977", significance:"Sgt Fury crossover; Bronze era",                               credits:"Sal Buscema / Roy Thomas",                value:"$25–60"     },
  { sort:56, series:"Captain America (Vol.1)",       issue:"#217",             year:"1978", significance:"1st appearance of Marvel Man (Quasar); KEY 🌟",                credits:"Sal Buscema / Don Glut",                 value:"$80–300"    },
  { sort:57, series:"Captain America (Vol.1)",       issue:"#218",             year:"1978", significance:"Marvel Man story continues",                                   credits:"Sal Buscema / Don Glut",                 value:"$30–80"     },
  { sort:58, series:"Captain America (Vol.1)",       issue:"#222",             year:"1978", significance:"Constrictor 1st appearance; KEY",                              credits:"Sal Buscema / Peter Gillis",              value:"$50–150"    },
  { sort:59, series:"Captain America (Vol.1)",       issue:"#230",             year:"1979", significance:"Hulk crossover; Bronze era solid",                             credits:"Sal Buscema / Roger McKenzie",            value:"$30–80"     },
  { sort:60, series:"Captain America (Vol.1)",       issue:"#233",             year:"1979", significance:"Bernie Rosenthal 1st appearance; recurring character",         credits:"Sal Buscema / Roger McKenzie",            value:"$25–60"     },
  { sort:61, series:"Captain America (Vol.1)",       issue:"#241",             year:"1980", significance:"Punisher app; KEY crossover 🔫",                               credits:"Gene Colan / Roger McKenzie",             value:"$60–200"    },
  { sort:62, series:"Captain America (Vol.1)",       issue:"#245",             year:"1980", significance:"Miller era begins; pre-Dark Knight Cap",                       credits:"Roger McKenzie era",                     value:"$30–80"     },
  { sort:63, series:"Captain America (Vol.1)",       issue:"#247",             year:"1980", significance:"1st Miller Cap art; Baron Blood returns; KEY",                 credits:"John Byrne / Roger McKenzie",             value:"$60–200"    },
  { sort:64, series:"Captain America (Vol.1)",       issue:"#248",             year:"1980", significance:"Dragon Man app; Byrne run",                                    credits:"John Byrne / Roger McKenzie",             value:"$30–80"     },
  { sort:65, series:"Captain America (Vol.1)",       issue:"#249",             year:"1980", significance:"Byrne run; strong Bronze",                                     credits:"John Byrne / Roger McKenzie",             value:"$30–80"     },
  { sort:66, series:"Captain America (Vol.1)",       issue:"#250",             year:"1980", significance:"Cap for President storyline; iconic Byrne; KEY",               credits:"John Byrne / Roger McKenzie",             value:"$60–200"    },
  { sort:67, series:"Captain America (Vol.1)",       issue:"#253",             year:"1981", significance:"Baron Blood returns; Union Jack app; KEY",                     credits:"John Byrne / Roger McKenzie",             value:"$50–150"    },
  { sort:68, series:"Captain America (Vol.1)",       issue:"#254",             year:"1981", significance:"Death of Baron Blood; Byrne classic; KEY",                     credits:"John Byrne / Roger McKenzie",             value:"$50–150"    },
  { sort:69, series:"Captain America (Vol.1)",       issue:"#255",             year:"1981", significance:"Cap's origin retold; Byrne masterpiece; KEY",                  credits:"John Byrne / Roger McKenzie",             value:"$60–200"    },
  { sort:70, series:"The Falcon (Solo)",             issue:"#1",               year:"1983", significance:"1st Falcon solo series; KEY 🦅",                               credits:"Paul Smith / Jim Owsley",                value:"$40–150"    },
  { sort:71, series:"The Falcon (Solo)",             issue:"#2",               year:"1983", significance:"Falcon solo series issue 2",                                   credits:"Paul Smith / Jim Owsley",                value:"$25–60"     },
  { sort:72, series:"The Falcon (Solo)",             issue:"#3",               year:"1983", significance:"Falcon solo issue 3",                                          credits:"Paul Smith / Jim Owsley",                value:"$25–60"     },
  { sort:73, series:"The Falcon (Solo)",             issue:"#4",               year:"1983", significance:"Final issue of 1st Falcon solo; KEY (last issue)",             credits:"Paul Smith / Jim Owsley",                value:"$30–80"     },
  { sort:74, series:"Captain America (Vol.5)",       issue:"#1",               year:"2005", significance:"Brubaker era begins; Bucky/Winter Soldier setup; KEY",         credits:"Steve Epting / Ed Brubaker",             value:"$40–150"    },
  { sort:75, series:"Captain America (Vol.5)",       issue:"#1 Director's Cut",year:"2005", significance:"Director's Cut variant; Brubaker era",                         credits:"Steve Epting / Ed Brubaker",             value:"$30–100"    },
  { sort:76, series:"Captain America (Vol.5)",       issue:"#6",               year:"2005", significance:"1st Winter Soldier (Bucky revealed); MAJOR KEY ❄️",            credits:"Steve Epting / Ed Brubaker",             value:"$100–400"   },
  { sort:77, series:"Captain America (Vol.5)",       issue:"#25",              year:"2007", significance:"Death of Captain America; MAJOR KEY 💀",                        credits:"Steve Epting / Ed Brubaker",             value:"$50–200"    },
  { sort:78, series:"Captain America (Vol.5)",       issue:"#34",              year:"2008", significance:"1st Bucky as Captain America; KEY ❄️",                         credits:"Steve Epting / Ed Brubaker",             value:"$80–300"    },
  { sort:79, series:"All-New Captain America",       issue:"#1",               year:"2014", significance:"1st Sam Wilson as Captain America; KEY 🦅",                    credits:"Stuart Immonen / Rick Remender",         value:"$30–150"    },
  { sort:80, series:"Captain America: Sam Wilson",   issue:"#1",               year:"2015", significance:"Sam Wilson Cap ongoing; KEY 🦅",                               credits:"Daniel Acuña / Nick Spencer",            value:"$25–80"     },
  { sort:81, series:"Captain America: Symbol of Truth", issue:"#1",           year:"2022", significance:"Sam Wilson Cap returns; modern KEY 🦅",                         credits:"R.B. Silva / Tochi Onyebuchi",           value:"$15–40"     },
];

// ─── Full Cap Vol.1 run (#100–#255, filling every gap) ───────────────────────
function capVol1Year(n: number): string {
  if (n <= 109) return "1968"; if (n <= 119) return "1969"; if (n <= 129) return "1970";
  if (n <= 149) return "1971"; if (n <= 169) return "1973"; if (n <= 184) return "1974";
  if (n <= 199) return "1975"; if (n <= 212) return "1977"; if (n <= 229) return "1978";
  if (n <= 249) return "1980"; return "1981";
}
const FULL_CHECKLIST: ChecklistItem[] = [
  ...CHECKLIST.filter(c => c.series !== "Captain America (Vol.1)"),
  ...Array.from({length:156}, (_,i) => {
    const n = 100 + i;
    const existing = CHECKLIST.find(c => c.series === "Captain America (Vol.1)" && c.issue === `#${n}`);
    if (existing) return existing;
    return {
      sort: 3000 + n, series: "Captain America (Vol.1)" as string,
      issue: `#${n}`, year: capVol1Year(n),
      significance: "Regular issue", credits: "—", value: "$5–15",
    } as ChecklistItem;
  }),
];

const SERIES_ORDER = [
  "Tales of Suspense",
  "Captain America (Vol.1)",
  "The Falcon (Solo)",
  "Captain America (Vol.5)",
  "All-New Captain America",
  "Captain America: Sam Wilson",
  "Captain America: Symbol of Truth",
];

const SERIES_COLOR: Record<string, string> = {
  "Tales of Suspense":               "#c8102e",
  "Captain America (Vol.1)":         "#1d4ed8",
  "The Falcon (Solo)":               "#b45309",
  "Captain America (Vol.5)":         "#6d28d9",
  "All-New Captain America":         "#065f46",
  "Captain America: Sam Wilson":     "#0e7490",
  "Captain America: Symbol of Truth":"#9a3412",
};

const SERIES_SHORT: Record<string, string> = {
  "Tales of Suspense":               "ToS",
  "Captain America (Vol.1)":         "CA Vol.1",
  "The Falcon (Solo)":               "Falcon Solo",
  "Captain America (Vol.5)":         "CA Vol.5",
  "All-New Captain America":         "All-New CA",
  "Captain America: Sam Wilson":     "CA: Sam Wilson",
  "Captain America: Symbol of Truth":"CA: SoT",
};

function isMajorKey(sig: string) {
  return sig.includes("MAJOR KEY");
}
function isKey(sig: string) {
  return sig.toUpperCase().includes("KEY");
}

// ─── Cross-reference with data3.ts ─────────────────────────────────────────────
function seriesMatchKey(title: string, year: string): string | null {
  const t = title.toLowerCase();
  const y = parseInt(year || "0");
  if (t.includes("tales of suspense")) return "Tales of Suspense";
  if (t === "captain america" && y >= 1968 && y <= 1996) return "Captain America (Vol.1)";
  if (t === "captain america" && y >= 2004 && y <= 2012) return "Captain America (Vol.5)";
  if ((t === "falcon" || t === "the falcon") && y >= 1983 && y <= 1984) return "The Falcon (Solo)";
  if (t === "all-new captain america") return "All-New Captain America";
  if (t === "captain america: sam wilson") return "Captain America: Sam Wilson";
  if (t === "captain america: symbol of truth") return "Captain America: Symbol of Truth";
  return null;
}

// Build a set of "series|issue" for owned comics
const ownedSet = new Set<string>();
for (const c of comics) {
  const sk = seriesMatchKey(c.Title, String(c.Year || ""));
  if (sk) {
    const iss = String(c.Issue || "").trim().replace(/^#/, "");
    ownedSet.add(`${sk}|${iss}`);
  }
}

function checkOwned(item: ChecklistItem): boolean {
  const iss = item.issue.replace(/^#/, "");
  return ownedSet.has(`${item.series}|${iss}`);
}

// Comic Vine search link
function comicVineUrl(item: ChecklistItem) {
  const q = encodeURIComponent(`${item.series} ${item.issue}`);
  return `https://comicvine.gamespot.com/search/?q=${q}&resources=issue`;
}

type FilterMode = "all" | "owned" | "missing" | "keys";

export default function CapFalconChecklist() {
  const [filter,       setFilter]       = useState<FilterMode>("all");
  const [seriesFilter, setSeriesFilter] = useState<string>("all");
  const [expanded,     setExpanded]     = useState<Set<number>>(new Set());

  const enriched = useMemo(() =>
    FULL_CHECKLIST.map(item => ({ ...item, owned: checkOwned(item) }))
  , []);

  const ownedCount    = enriched.filter(e => e.owned).length;
  const missingCount  = enriched.length - ownedCount;
  const keyItems      = enriched.filter(e => isKey(e.significance));
  const ownedKeys     = keyItems.filter(e => e.owned).length;
  const majorKeys     = enriched.filter(e => isMajorKey(e.significance));
  const ownedMajors   = majorKeys.filter(e => e.owned).length;
  const missingMajors = majorKeys.filter(e => !e.owned);

  const filtered = useMemo(() => {
    return enriched.filter(item => {
      if (seriesFilter !== "all" && item.series !== seriesFilter) return false;
      if (filter === "owned"   && !item.owned)         return false;
      if (filter === "missing" && item.owned)          return false;
      if (filter === "keys"    && !isKey(item.significance)) return false;
      return true;
    });
  }, [enriched, filter, seriesFilter]);

  // Group filtered by series for display
  const groupedBySeries = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    for (const item of filtered) {
      if (!groups[item.series]) groups[item.series] = [];
      groups[item.series].push(item);
    }
    return groups;
  }, [filtered]);

  const visibleSeries = SERIES_ORDER.filter(s => groupedBySeries[s]?.length);

  function toggleExpand(sort: number) {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(sort) ? n.delete(sort) : n.add(sort);
      return n;
    });
  }

  const pct = Math.round((ownedCount / enriched.length) * 100);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 18px 60px" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem",
          letterSpacing:"3px", color:"var(--muted)", marginBottom:4 }}>
          COLLECTOR'S RUN CHECKLIST
        </div>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"2.2rem",
          letterSpacing:"4px", color:"var(--red)", lineHeight:1, marginBottom:6 }}>
          CAPTAIN AMERICA &amp; THE FALCON
        </div>
        <div style={{ fontSize:"0.95rem", color:"var(--muted2)", fontFamily:"'Crimson Pro',serif",
          lineHeight:1.6, maxWidth:620 }}>
          Full Cap Vol.1 run (#100–#255) plus key issues from 6 other series — 1964 to 2022.
          Owned issues are highlighted in the collection. Every gap is shown.
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background:"var(--surface)", border:"1.5px solid var(--border)",
        borderRadius:10, padding:"16px 20px", marginBottom:20,
        display:"flex", gap:24, flexWrap:"wrap", alignItems:"center" }}>
        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"2.2rem",
            color:"var(--red)", lineHeight:1 }}>{ownedCount}</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem",
            letterSpacing:"2px", color:"var(--muted)", marginTop:2 }}>OWNED</div>
        </div>
        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"2.2rem",
            color:"var(--muted2)", lineHeight:1 }}>{missingCount}</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem",
            letterSpacing:"2px", color:"var(--muted)", marginTop:2 }}>MISSING</div>
        </div>
        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"2.2rem",
            color:"#8a6000", lineHeight:1 }}>{ownedKeys}/{keyItems.length}</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem",
            letterSpacing:"2px", color:"var(--muted)", marginTop:2 }}>KEYS OWNED</div>
        </div>
        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"2.2rem",
            color:"#7c3aed", lineHeight:1 }}>{ownedMajors}/{majorKeys.length}</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem",
            letterSpacing:"2px", color:"var(--muted)", marginTop:2 }}>MAJOR KEYS</div>
        </div>
        <div style={{ flex:1, minWidth:160 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem",
              letterSpacing:"2px", color:"var(--muted)" }}>RUN COMPLETION</span>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.9rem",
              color:"var(--red)" }}>{pct}%</span>
          </div>
          <div style={{ background:"var(--border)", borderRadius:99, height:8, overflow:"hidden" }}>
            <div style={{ background:"var(--red)", height:"100%", borderRadius:99,
              width:`${pct}%`, transition:"width 0.6s ease" }}/>
          </div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.55rem",
            letterSpacing:"1.5px", color:"var(--muted)", marginTop:4 }}>
            {ownedCount} OF {enriched.length} ISSUES
          </div>
        </div>
      </div>

      {/* Missing major keys callout */}
      {missingMajors.length > 0 && (
        <div style={{ background:"#fff8e0", border:"1.5px solid #d4a800",
          borderLeft:"4px solid #d4a800", borderRadius:8,
          padding:"12px 16px", marginBottom:20 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem",
            letterSpacing:"2px", color:"#8a6000", marginBottom:8 }}>
            🎯 MAJOR KEYS YOU'RE MISSING — THE GRAILS
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {missingMajors.map(item => (
              <a key={item.sort} href={comicVineUrl(item)} target="_blank" rel="noopener noreferrer"
                style={{ display:"inline-flex", flexDirection:"column",
                  background:"#fff", border:"1.5px solid #d4a800", borderRadius:6,
                  padding:"8px 12px", textDecoration:"none",
                  transition:"box-shadow 0.12s, transform 0.12s",
                  minWidth:140 }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 4px 12px rgba(212,168,0,0.3)"; (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none"; (e.currentTarget as HTMLAnchorElement).style.transform = "none"; }}
              >
                <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem",
                  letterSpacing:"1px", color:"#8a6000", lineHeight:1 }}>
                  {item.issue}
                </span>
                <span style={{ fontSize:"0.72rem", color:"var(--muted2)", marginTop:2,
                  fontFamily:"'Crimson Pro',serif" }}>
                  {item.series.replace("Captain America","CA").replace("(Vol.","v")}
                </span>
                <span style={{ fontSize:"0.7rem", color:"#8a6000", marginTop:3,
                  fontFamily:"'Crimson Pro',serif", fontStyle:"italic", lineHeight:1.3 }}>
                  {item.significance.split(";")[0].replace(" MAJOR KEY","").replace(/[🦅❄️💀🌟🔫]/gu,"")}
                </span>
                <span style={{ fontSize:"0.62rem", color:"var(--muted)", marginTop:4,
                  fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>
                  {item.value} → search ↗
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
        {/* Owned/missing filter */}
        <div style={{ display:"flex", gap:4, background:"var(--surface)",
          border:"1.5px solid var(--border)", borderRadius:7, padding:3 }}>
          {(["all","owned","missing","keys"] as FilterMode[]).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? "var(--red)" : "none",
              color: filter === f ? "#fff" : "var(--muted2)",
              border:"none", borderRadius:5, padding:"5px 12px", cursor:"pointer",
              fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.7rem", letterSpacing:"1.5px",
              transition:"all 0.12s",
            }}>
              {f === "all" ? `ALL (${enriched.length})`
                : f === "owned" ? `OWNED (${ownedCount})`
                : f === "missing" ? `MISSING (${missingCount})`
                : `KEYS (${keyItems.length})`}
            </button>
          ))}
        </div>

        {/* Series filter pills */}
        <div style={{ display:"flex", gap:5, flexWrap:"wrap", alignItems:"center" }}>
          <button onClick={() => setSeriesFilter("all")} style={{
            background: seriesFilter === "all" ? "var(--brown-light)" : "var(--surface)",
            color: seriesFilter === "all" ? "#fff" : "var(--muted2)",
            border:`1.5px solid ${seriesFilter === "all" ? "var(--brown-light)" : "var(--border)"}`,
            borderRadius:20, padding:"4px 12px", cursor:"pointer",
            fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"1.5px",
            transition:"all 0.12s",
          }}>ALL SERIES</button>

          {SERIES_ORDER.map(s => {
            const count = enriched.filter(e => e.series === s).length;
            const ownedInSeries = enriched.filter(e => e.series === s && e.owned).length;
            const col = SERIES_COLOR[s];
            const active = seriesFilter === s;
            return (
              <button key={s} onClick={() => setSeriesFilter(active ? "all" : s)} style={{
                background: active ? col : "var(--surface)",
                color: active ? "#fff" : col,
                border:`1.5px solid ${col}`,
                borderRadius:20, padding:"4px 12px", cursor:"pointer",
                fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1px",
                transition:"all 0.12s", whiteSpace:"nowrap",
              }}>
                {SERIES_SHORT[s]}
                <span style={{ opacity:0.75, marginLeft:5 }}>{ownedInSeries}/{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Issue count for current filter */}
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem",
        letterSpacing:"2px", color:"var(--muted)", marginBottom:14 }}>
        SHOWING {filtered.length} ISSUE{filtered.length !== 1 ? "S" : ""}
        {seriesFilter !== "all" ? ` · ${seriesFilter.toUpperCase()}` : ""}
        {filter !== "all" ? ` · ${filter.toUpperCase()}` : ""}
      </div>

      {/* Series sections */}
      {visibleSeries.map(seriesName => {
        const items = groupedBySeries[seriesName];
        const ownedInSeries = items.filter(i => i.owned).length;
        const col = SERIES_COLOR[seriesName];
        const sp  = Math.round((ownedInSeries / items.length) * 100);

        return (
          <div key={seriesName} style={{ marginBottom: 28 }}>
            {/* Series header */}
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10,
              borderBottom:`2px solid ${col}`, paddingBottom:8 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.1rem",
                  letterSpacing:"2.5px", color:col, lineHeight:1 }}>
                  {seriesName}
                </div>
                <div style={{ fontSize:"0.75rem", color:"var(--muted)", marginTop:3 }}>
                  {ownedInSeries}/{items.length} issues
                  {" · "}
                  <span style={{ color: items.filter(i=>isKey(i.significance)&&i.owned).length > 0 ? "#8a6000" : "var(--muted)" }}>
                    {items.filter(i=>isKey(i.significance)&&i.owned).length}/{items.filter(i=>isKey(i.significance)).length} keys
                  </span>
                </div>
              </div>
              {/* Mini progress bar */}
              <div style={{ width:100 }}>
                <div style={{ background:"var(--border)", borderRadius:99, height:6, overflow:"hidden" }}>
                  <div style={{ background:col, height:"100%", width:`${sp}%`,
                    borderRadius:99, transition:"width 0.5s ease" }}/>
                </div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem",
                  letterSpacing:"1.5px", color:"var(--muted)", marginTop:3, textAlign:"right" }}>
                  {sp}%
                </div>
              </div>
            </div>

            {/* Issue rows */}
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {items.map(item => {
                const isExpanded = expanded.has(item.sort);
                const owned      = item.owned;
                const major      = isMajorKey(item.significance);
                const key        = isKey(item.significance);
                const rowBg = major ? "#fffdf0"
                            : key   ? "#fafaf8"
                            : owned ? "#fdf2f8"
                            : "var(--surface)";
                const borderL = major ? "#d4a800"
                              : key   ? "#ccc"
                              : owned ? col
                              : "var(--border)";
                return (
                  <div key={item.sort}
                    style={{
                      background: rowBg,
                      border:`1.5px solid ${major ? "#d4a800" : "var(--border)"}`,
                      borderLeft:`4px solid ${borderL}`,
                      borderRadius:7,
                      overflow:"hidden",
                    }}
                  >
                    {/* Main row */}
                    <div
                      onClick={() => toggleExpand(item.sort)}
                      style={{ display:"flex", gap:10, alignItems:"center",
                        padding:"10px 14px", cursor:"pointer" }}
                    >
                      {/* Owned indicator */}
                      <div style={{
                        width:22, height:22, borderRadius:"50%", flexShrink:0,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        background: owned ? "#fce4ec" : "var(--surface2)",
                        border: `2px solid ${owned ? "#e91e63" : "var(--border)"}`,
                        fontSize:"0.7rem",
                        transition:"all 0.15s",
                      }}>
                        {owned ? "✓" : ""}
                      </div>

                      {/* Issue number */}
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem",
                        letterSpacing:"1px", color: owned ? col : "var(--muted2)",
                        minWidth:70, flexShrink:0 }}>
                        {item.issue}
                      </div>

                      {/* Year */}
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem",
                        letterSpacing:"1px", color:"var(--muted)", minWidth:36, flexShrink:0 }}>
                        {item.year}
                      </div>

                      {/* Significance */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{
                          fontSize:"0.85rem",
                          color: major ? "#8a6000" : key ? "var(--text2)" : "var(--muted2)",
                          fontWeight: major ? 700 : key ? 600 : 400,
                          fontFamily: major || key ? "'Crimson Pro',serif" : "inherit",
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                        }}>
                          {item.significance}
                        </div>
                      </div>

                      {/* Badges */}
                      <div style={{ display:"flex", gap:5, flexShrink:0, alignItems:"center" }}>
                        {major && (
                          <span style={{ background:"#d4a800", color:"#fff", borderRadius:4,
                            padding:"2px 7px", fontFamily:"'Bebas Neue',sans-serif",
                            fontSize:"0.58rem", letterSpacing:"1px" }}>MAJOR</span>
                        )}
                        {key && !major && (
                          <span className="badge bkey" style={{ fontSize:"0.58rem" }}>KEY</span>
                        )}
                        {owned ? (
                          <span style={{ background:"#fce4ec", color:"#880e4f", border:"1px solid #f48fb1",
                            borderRadius:4, padding:"2px 7px", fontFamily:"'Bebas Neue',sans-serif",
                            fontSize:"0.58rem", letterSpacing:"1px" }}>OWNED</span>
                        ) : (
                          <span style={{ background:"var(--surface2)", color:"var(--muted)",
                            border:"1px solid var(--border)", borderRadius:4, padding:"2px 7px",
                            fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem",
                            letterSpacing:"1px" }}>NEED</span>
                        )}
                        <span style={{ color:"var(--muted)", fontSize:"0.75rem", marginLeft:2 }}>
                          {isExpanded ? "▲" : "▼"}
                        </span>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div style={{ borderTop:`1px solid ${major ? "#f0e080" : "var(--border)"}`,
                        padding:"12px 14px 14px 50px",
                        background: major ? "#fefdf5" : "var(--surface)" }}>
                        <div style={{ display:"flex", gap:20, flexWrap:"wrap", marginBottom:10 }}>
                          <div>
                            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem",
                              letterSpacing:"2px", color:"var(--muted)", marginBottom:3 }}>CREDITS</div>
                            <div style={{ fontSize:"0.85rem", color:"var(--text2)",
                              fontFamily:"'Crimson Pro',serif" }}>{item.credits}</div>
                          </div>
                          <div>
                            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem",
                              letterSpacing:"2px", color:"var(--muted)", marginBottom:3 }}>EST. VALUE RAW</div>
                            <div style={{ fontSize:"0.85rem", color:"#16a34a", fontWeight:700 }}>{item.value}</div>
                          </div>
                          <div>
                            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem",
                              letterSpacing:"2px", color:"var(--muted)", marginBottom:3 }}>STATUS</div>
                            <div style={{ fontSize:"0.85rem", color: owned ? "#880e4f" : "var(--muted2)",
                              fontWeight:600 }}>{owned ? "✓ In Collection" : "Not yet owned"}</div>
                          </div>
                        </div>

                        {!owned && (
                          <a href={comicVineUrl(item)} target="_blank" rel="noopener noreferrer"
                            style={{ display:"inline-flex", alignItems:"center", gap:6,
                              background:"var(--red)", color:"#fff", borderRadius:5,
                              padding:"6px 14px", textDecoration:"none",
                              fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem",
                              letterSpacing:"1.5px", transition:"opacity 0.12s" }}
                            onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.opacity = "0.85"}
                            onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.opacity = "1"}
                          >
                            SEARCH ON COMIC VINE ↗
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div style={{ textAlign:"center", padding:"40px 20px", color:"var(--muted)",
          fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem", letterSpacing:"3px" }}>
          NO ISSUES MATCH THESE FILTERS
        </div>
      )}
    </div>
  );
}
