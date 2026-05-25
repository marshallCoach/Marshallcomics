import { useMemo, useState } from "react";
import { DATA3 } from "@/data/data3";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

const comics = DATA3.comics;

// ── helpers ──────────────────────────────────────────────────────────────────
function countBy<T>(arr: T[], key: (x: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of arr) { const k = key(x); out[k] = (out[k] || 0) + 1; }
  return out;
}
function topN(obj: Record<string, number>, n: number) {
  return Object.entries(obj)
    .filter(([k]) => k && k !== "Unknown" && k !== "" && k !== "Various")
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}
function parseFloat2(v: string) {
  return parseFloat((v || "").replace(/[^0-9.]/g, "") || "0");
}

// ── pre-computed data ────────────────────────────────────────────────────────
const keys     = comics.filter(c => (c.Key    || "").toUpperCase() === "YES");
const signed   = comics.filter(c => (c.Signed || "").toUpperCase() === "YES");
const annuals  = comics.filter(c => c.Title.toLowerCase().includes("annual"));
const specials = comics.filter(c =>
  c.Title.toLowerCase().includes("special") ||
  (c.Category || "").toLowerCase().includes("one-shot") ||
  c.Title.toLowerCase().includes("one-shot")
);

// Publisher distribution (consolidate)
function normPub(p: string) {
  const u = (p || "").toUpperCase();
  if (u === "DC" || u === "DC COMICS") return "DC";
  if (u === "MARVEL") return "Marvel";
  if (u === "IMAGE") return "Image";
  if (u === "IDW") return "IDW";
  if (u === "DARK HORSE") return "Dark Horse";
  if (u === "VALIANT") return "Valiant";
  if (!u || u === "INDEPENDENT" || u === "INDIE") return "Independent";
  return p || "Other";
}
const byPubRaw = countBy(comics, c => normPub(c.Publisher));
const byPub    = Object.entries(byPubRaw).sort((a,b)=>b[1]-a[1]);

// Era
const byEraRaw = countBy(comics, c => c.Era || "Unknown");
const ERA_ORDER = ["Golden","Silver","Bronze","Copper","Modern","Unknown"];
const byEra = ERA_ORDER
  .filter(e => byEraRaw[e])
  .map(e => ({ name: e, count: byEraRaw[e] }));

// Year buckets (decade)
const byDecadeRaw: Record<string, number> = {};
comics.forEach(c => {
  const yr = parseFloat2(c.Year);
  if (!yr) return;
  const dec = `${Math.floor(yr / 10) * 10}s`;
  byDecadeRaw[dec] = (byDecadeRaw[dec] || 0) + 1;
});
const byDecade = Object.entries(byDecadeRaw).sort((a,b)=>a[0].localeCompare(b[0]));

// Writers — overall and by publisher
const writerMap      = countBy(comics, c => c.Writer);
const writerDCMap    = countBy(comics.filter(c=>normPub(c.Publisher)==="DC"),   c => c.Writer);
const writerMrvlMap  = countBy(comics.filter(c=>normPub(c.Publisher)==="Marvel"),c => c.Writer);
const writerOtherMap = countBy(comics.filter(c=>normPub(c.Publisher)!=="DC"&&normPub(c.Publisher)!=="Marvel"), c => c.Writer);

// Artists
const artistMap      = countBy(comics, c => c.Artist);
const coverMap       = countBy(comics.filter(c=>c.Cover_Artist), c => c.Cover_Artist);

// Titles
const titleMap = countBy(comics, c => c.Title);

// Signers — filter out entries that are prices ($8, $10 etc), not names
const signerMapRaw = countBy(signed, c => c.Signed_By);
const signerMap = Object.fromEntries(
  Object.entries(signerMapRaw).filter(([k]) => k && !k.match(/^\$/) && k.trim().length > 2)
);

// Character families
const FAMILIES: { name: string; keywords: string[]; color: string; emoji: string }[] = [
  { name:"Batman Family",       keywords:["Batman","Nightwing","Robin","Batgirl","Red Hood","Batwoman","Catwoman","Joker","Harley Quinn","Gotham","Batwing","Azrael","Oracle","Commissioner"], color:"#1d6fa4", emoji:"🦇" },
  { name:"Superman Family",     keywords:["Superman","Supergirl","Superboy","Action Comics","Man of Steel","Lois Lane","Metropolis","Mon-El","Krypton"], color:"#dc2626", emoji:"🦸" },
  { name:"Spider-Man Family",   keywords:["Spider-Man","Spider Man","Amazing Spider","Spectacular Spider","Web of Spider","Venom","Carnage","Miles Morales","Spider-Gwen","Silk","Spider-Woman","Scarlet Spider"], color:"#9333ea", emoji:"🕷️" },
  { name:"X-Men / Mutants",     keywords:["X-Men","Uncanny X","New Mutants","X-Force","X-Factor","Excalibur","Wolverine","Cyclops","Storm","Cable","Deadpool","Gambit","Psylocke","Jubilee","Generation X","Exiles","Weapon X","X-23","Marauders"], color:"#f59e0b", emoji:"⚡" },
  { name:"Avengers Family",     keywords:["Avengers","Captain America","Iron Man","Thor","Hulk","Black Widow","Hawkeye","Ant-Man","Vision","Scarlet Witch","Mockingbird","War Machine","Rescue","Mighty Avengers","New Avengers","Secret Avengers","West Coast"], color:"#16a34a", emoji:"🛡️" },
  { name:"Black Panther / BP",  keywords:["Black Panther","Wakanda","Shuri","Jungle Action"], color:"#854d0e", emoji:"🐾" },
  { name:"Green Lantern Corps", keywords:["Green Lantern","GL Corps","Lantern"], color:"#22c55e", emoji:"💚" },
  { name:"Flash Family",        keywords:["The Flash","Kid Flash","Impulse","Jay Garrick","Barry Allen","Wally West"], color:"#ef4444", emoji:"💨" },
  { name:"Justice League",      keywords:["Justice League","JLA","JLI","Justice Society","JSA","Stormwatch"], color:"#3b82f6", emoji:"⚖️" },
  { name:"Teen Titans / Titans",keywords:["Teen Titans","Titans","Nightwing","Young Justice"], color:"#8b5cf6", emoji:"🌟" },
  { name:"Fantastic Four",      keywords:["Fantastic Four","FF #","Mister Fantastic","Thing","Human Torch","Invisible Woman","Silver Surfer"], color:"#f97316", emoji:"4️⃣" },
  { name:"Daredevil",           keywords:["Daredevil","Matt Murdock","Kingpin","Elektra"], color:"#b91c1c", emoji:"⚖️" },
  { name:"Wonder Woman",        keywords:["Wonder Woman","Diana","Amazons","Paradise Island","Themyscira"], color:"#db2777", emoji:"👑" },
];

function classifyFamily(c: { Title: string; Writer: string; Arc: string }) {
  const haystack = `${c.Title} ${c.Arc}`.toLowerCase();
  for (const fam of FAMILIES) {
    if (fam.keywords.some(k => haystack.includes(k.toLowerCase()))) return fam.name;
  }
  return "Other";
}

const familyMap = countBy(comics, classifyFamily);
const familyData = Object.entries(familyMap)
  .sort((a,b)=>b[1]-a[1])
  .map(([name, count]) => ({
    name,
    count,
    color: FAMILIES.find(f=>f.name===name)?.color ?? "#6b7280",
  }));

// Longest single title streak
const titleEntries = Object.entries(titleMap).sort((a,b)=>b[1]-a[1]);

// Platform
const platformMap = countBy(comics, c => c.Platform || "Unassigned");

// ── mini series & crossovers ──────────────────────────────────────────────────
const miniSeriesComics = comics.filter(c =>
  (c.Key_Reason || "").toLowerCase().includes("limited series") ||
  (c.Key_Reason || "").toLowerCase().includes("mini series") ||
  (c.Category   || "").toLowerCase().includes("limited")
);
const miniSeriesTitleCount = new Set(miniSeriesComics.map(c => c.Title)).size;
const crossoverComics = comics.filter(c => {
  const x = (c.Crossover || "").trim();
  return x !== "" && x.toLowerCase() !== "nan";
});
const crossoverEventCount = new Set(crossoverComics.map(c => c.Crossover)).size;

// ── publisher shelf colours ───────────────────────────────────────────────────
const PUB_SHELF_COLORS: Record<string, string> = {
  DC: "#1d6fa4", Marvel: "#c8102e", Image: "#f97316",
  IDW: "#22c55e", "Dark Horse": "#7c3aed", Valiant: "#8b2be2",
  Independent: "#6b7280", Other: "#94a3b8",
};
const ERA_VIZ_COLORS: Record<string, string> = {
  Golden: "#d4a800", Silver: "#94a3b8", Bronze: "#b87333",
  Copper: "#c8a165", Modern: "#c8102e", Unknown: "#6b7280",
};
const ERA_RANGE: Record<string, string> = {
  Golden: "1938–1956", Silver: "1956–1970", Bronze: "1970–1985",
  Copper: "1985–1991", Modern: "1991–now",  Unknown: "Year unknown",
};

// ── chart colours ────────────────────────────────────────────────────────────
const PIE_COLORS = ["#c8102e","#d4a800","#1d6fa4","#16a34a","#8b2be2","#d97706","#6b7280","#0ea5e9","#f43f5e","#10b981"];

// ── small helpers for rendering ──────────────────────────────────────────────
function MiniBar({ pct, color="#c8102e" }: { pct: number; color?: string }) {
  return (
    <div style={{ flex:1, height:6, background:"var(--border)", borderRadius:3, overflow:"hidden" }}>
      <div style={{ width:`${Math.min(pct,100)}%`, height:"100%", background:color, borderRadius:3, transition:"width 0.4s ease" }} />
    </div>
  );
}

function LeaderRow({ rank, name, count, total, color="#c8102e" }: {
  rank: number; name: string; count: number; total: number; color?: string;
}) {
  const pct = (count / total) * 100;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom:"1px solid var(--border)" }}>
      <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.9rem", color:"var(--muted)", minWidth:24, textAlign:"right" }}>#{rank}</span>
      <span style={{ flex:1, fontSize:"0.9rem", fontWeight: rank<=3?600:400, color:"var(--text)", minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</span>
      <MiniBar pct={pct} color={color} />
      <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.95rem", color, minWidth:34, textAlign:"right" }}>{count}</span>
    </div>
  );
}

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom:16, marginTop:36 }}>
      <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.4rem", letterSpacing:"2px", color:"var(--red)", margin:0 }}>{title}</h2>
      {sub && <div style={{ fontSize:"0.85rem", color:"var(--muted2)", marginTop:3 }}>{sub}</div>}
    </div>
  );
}

function StatTile({ val, lbl, sub, color="#c8102e" }: { val: string | number; lbl: string; sub?: string; color?: string }) {
  return (
    <div className="cstats-tile" style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:6, padding:"14px 16px", textAlign:"center", transition:"border-color 0.15s, box-shadow 0.15s, transform 0.15s" }}>
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.9rem", color, letterSpacing:"1px", lineHeight:1 }}>{val}</div>
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.75rem", letterSpacing:"1.5px", color:"var(--text)", marginTop:4 }}>{lbl}</div>
      {sub && <div style={{ fontSize:"0.75rem", color:"var(--muted2)", marginTop:3, lineHeight:1.4 }}>{sub}</div>}
    </div>
  );
}

const CUSTOM_TOOLTIP = ({ active, payload }: { active?: boolean; payload?: {name:string; value:number}[] }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:6, padding:"8px 14px", fontSize:"0.85rem" }}>
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", color:"var(--text)" }}>{payload[0].name}</div>
      <div style={{ color:"var(--red)", fontWeight:600 }}>{payload[0].value.toLocaleString()} books</div>
    </div>
  );
};

// ── main page ─────────────────────────────────────────────────────────────────
type SubView = "overview" | "writers" | "characters" | "titles";

export default function CollectionStats() {
  const [subView, setSubView] = useState<SubView>("overview");

  const topWriters      = useMemo(() => topN(writerMap,     15), []);
  const topArtists      = useMemo(() => topN(artistMap,     12), []);
  const topCoverArtists = useMemo(() => topN(coverMap,      10), []);
  const topSigners      = useMemo(() => topN(signerMap,     10), []);
  const topTitles       = useMemo(() => topN(titleMap,      20), []);
  const topDCWriters    = useMemo(() => topN(writerDCMap,    5), []);
  const topMrvlWriters  = useMemo(() => topN(writerMrvlMap,  5), []);
  const topOtherWriters = useMemo(() => topN(writerOtherMap, 5), []);

  const uniqueWriters   = Object.keys(writerMap).filter(k => k && k !== "Various" && k !== "Unknown").length;
  const uniqueArtists   = Object.keys(artistMap).filter(k => k && k !== "Various" && k !== "Unknown").length;
  const uniquePublishers = Object.keys(byPubRaw).length;
  const deepRunTitles   = titleEntries.filter(([,v]) => v >= 10);
  const midRunTitles    = titleEntries.filter(([,v]) => v >= 4 && v < 10);

  const maxWriter  = topWriters[0]?.[1] || 1;
  const maxArtist  = topArtists[0]?.[1] || 1;
  const maxSigner  = topSigners[0]?.[1] || 1;
  const maxTitle   = topTitles[0]?.[1]  || 1;

  const pubPieData  = byPub.map(([name,value]) => ({ name, value }));
  const eraPieData  = byEra.map(e => ({ name: e.name, value: e.count }));
  const platPieData = Object.entries(platformMap)
    .filter(([k]) => k && k !== "")
    .sort((a,b)=>b[1]-a[1])
    .map(([name,value]) => ({ name, value }));
  const famPieData  = familyData.filter(f => f.count > 5).map(f => ({ name: f.name, value: f.count, color: f.color }));

  const dcTotal    = byPubRaw["DC"]     || 0;
  const mrvlTotal  = byPubRaw["Marvel"] || 0;
  const otherTotal = comics.length - dcTotal - mrvlTotal;

  return (
    <div style={{ maxWidth:1150, margin:"0 auto", padding:"24px 20px 80px" }}>

      {/* Sub-nav */}
      <div style={{ display:"flex", gap:6, marginBottom:28, flexWrap:"wrap" }}>
        {([
          ["overview",   "📊 Overview"],
          ["writers",    "✍️ Writers & Artists"],
          ["characters", "🦸 Characters & Teams"],
          ["titles",     "📚 Titles & Runs"],
        ] as [SubView, string][]).map(([id, lbl]) => (
          <button
            key={id}
            onClick={() => setSubView(id)}
            style={{
              padding:"8px 18px", borderRadius:4, cursor:"pointer", border:"1.5px solid var(--border)",
              background: subView === id ? "var(--red)" : "var(--surface)",
              color:       subView === id ? "#fff" : "var(--text)",
              fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", letterSpacing:"1.5px",
              transition:"all 0.15s",
            }}
          >{lbl}</button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════ OVERVIEW */}
      {subView === "overview" && (
        <>
          <SectionHead title="Collection at a Glance" />
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:10 }}>
            <StatTile val={comics.length.toLocaleString()} lbl="Total Comics"        sub="across all boxes"     color="#c8102e" />
            <StatTile val={keys.length.toLocaleString()}   lbl="Key Issues"          sub={`${((keys.length/comics.length)*100).toFixed(1)}% of collection`} color="#d97706" />
            <StatTile val={signed.length}                  lbl="Signed Books"        sub={`${uniqueSigners()} different signers`} color="#8b2be2" />
            <StatTile val={uniqueWriters}                  lbl="Writers"             sub="unique credited writers" color="#1d6fa4" />
            <StatTile val={uniqueArtists}                  lbl="Artists"             sub="unique credited artists" color="#16a34a" />
            <StatTile val={uniquePublishers}               lbl="Publishers"          sub="different imprints"    color="#d97706" />
            <StatTile val={deepRunTitles.length}           lbl="Deep Runs"           sub="10+ issues same title" color="#c8102e" />
            <StatTile val={annuals.length}                 lbl="Annuals"             sub="annual editions"       color="#6b7280" />
            <StatTile val={miniSeriesTitleCount}           lbl="Mini Series"         sub="limited-run titles"    color="#d97706" />
            <StatTile val={crossoverEventCount}            lbl="Crossovers"          sub={`${crossoverComics.length} issues across events`} color="#8b5cf6" />
          </div>

          {/* DC vs Marvel vs Everyone Else */}
          <SectionHead title="The Big Three" sub="How the publishers stack up in your collection" />
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:28 }}>
            {[
              { pub:"DC",     n:dcTotal,    color:"#1d6fa4", share:((dcTotal/comics.length)*100).toFixed(1) },
              { pub:"Marvel", n:mrvlTotal,  color:"#c8102e", share:((mrvlTotal/comics.length)*100).toFixed(1) },
              { pub:"Others", n:otherTotal, color:"#6b7280", share:((otherTotal/comics.length)*100).toFixed(1) },
            ].map(p => (
              <div key={p.pub} style={{ background:"var(--surface)", border:`2px solid ${p.color}40`, borderRadius:6, padding:"18px 16px", textAlign:"center" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"2.5rem", color:p.color, letterSpacing:"1px", lineHeight:1 }}>{p.n.toLocaleString()}</div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem", letterSpacing:"2px", color:"var(--text)", marginTop:4 }}>{p.pub}</div>
                <div style={{ fontSize:"0.85rem", color:"var(--muted2)", marginTop:4 }}>{p.share}% of collection</div>
                <div style={{ marginTop:10, height:6, background:"var(--border)", borderRadius:3, overflow:"hidden" }}>
                  <div style={{ width:`${p.share}%`, height:"100%", background:p.color, borderRadius:3 }} />
                </div>
              </div>
            ))}
          </div>

          {/* ── Publisher Shelf ── */}
          <div style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:6, padding:"16px" }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", letterSpacing:"2px", color:"var(--red)", marginBottom:3 }}>BY PUBLISHER</div>
            <div style={{ fontSize:"0.72rem", color:"var(--muted2)", marginBottom:12 }}>Hover any segment — proportional to your actual shelf</div>
            {/* Spine bar */}
            <div style={{ display:"flex", height:48, borderRadius:4, overflow:"hidden", marginBottom:16, gap:1 }}>
              {pubPieData.map((p, i) => {
                const pct = (p.value / comics.length) * 100;
                const color = PUB_SHELF_COLORS[p.name] ?? PIE_COLORS[i % PIE_COLORS.length];
                return (
                  <div key={p.name}
                    title={`${p.name}: ${p.value.toLocaleString()} books (${pct.toFixed(1)}%)`}
                    style={{ width:`${pct}%`, background:color, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", cursor:"default", transition:"filter 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.filter = "brightness(1.3)")}
                    onMouseLeave={e => (e.currentTarget.style.filter = "")}
                  >
                    {pct > 5 && (
                      <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.56rem", color:"rgba(255,255,255,0.92)", letterSpacing:"1px", whiteSpace:"nowrap" }}>
                        {p.name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Row list */}
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {pubPieData.map((p, i) => {
                const pct = (p.value / comics.length) * 100;
                const color = PUB_SHELF_COLORS[p.name] ?? PIE_COLORS[i % PIE_COLORS.length];
                return (
                  <div key={p.name} style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:10, height:10, borderRadius:2, background:color, flexShrink:0 }} />
                    <span style={{ flex:"0 0 120px", fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", letterSpacing:"1px", color:"var(--text2)" }}>{p.name}</span>
                    <div style={{ flex:1, height:5, background:"var(--border)", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:3 }} />
                    </div>
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", color, minWidth:44, textAlign:"right" }}>{p.value.toLocaleString()}</span>
                    <span style={{ fontSize:"0.66rem", color:"var(--muted)", minWidth:38, textAlign:"right" }}>{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Era Cards ── */}
          <div style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:6, padding:"16px" }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", letterSpacing:"2px", color:"var(--red)", marginBottom:3 }}>BY ERA</div>
            <div style={{ fontSize:"0.72rem", color:"var(--muted2)", marginBottom:12 }}>Your collection spans {byEra.filter(e => e.count > 0).length} distinct eras</div>
            {/* Era timeline strip */}
            <div style={{ display:"flex", height:10, borderRadius:4, overflow:"hidden", marginBottom:16, gap:1 }}>
              {byEra.map(e => {
                const pct = (e.count / comics.length) * 100;
                const color = ERA_VIZ_COLORS[e.name] ?? "#6b7280";
                return (
                  <div key={e.name}
                    title={`${e.name}: ${e.count.toLocaleString()} books (${pct.toFixed(1)}%)`}
                    style={{ width:`${pct}%`, background:color, transition:"filter 0.15s" }}
                    onMouseEnter={e2 => (e2.currentTarget.style.filter = "brightness(1.4)")}
                    onMouseLeave={e2 => (e2.currentTarget.style.filter = "")}
                  />
                );
              })}
            </div>
            {/* Era cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:8 }}>
              {byEra.map(e => {
                const pct = (e.count / comics.length) * 100;
                const color = ERA_VIZ_COLORS[e.name] ?? "#6b7280";
                return (
                  <div key={e.name} style={{ background:"var(--surface2)", border:`1.5px solid ${color}28`, borderRadius:5, padding:"10px 12px", borderTop:`3px solid ${color}` }}>
                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.25rem", color, letterSpacing:"1px", lineHeight:1 }}>{e.count.toLocaleString()}</div>
                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.7rem", letterSpacing:"1.5px", color:"var(--text)", marginTop:3 }}>{e.name}</div>
                    <div style={{ fontSize:"0.62rem", color:"var(--muted2)", marginTop:2 }}>{ERA_RANGE[e.name] ?? ""}</div>
                    <div style={{ marginTop:6, height:3, background:"var(--border)", borderRadius:2, overflow:"hidden" }}>
                      <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:2 }} />
                    </div>
                    <div style={{ fontSize:"0.6rem", color:"var(--muted)", marginTop:3, textAlign:"right" }}>{pct.toFixed(1)}%</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Decade bar chart */}
          <SectionHead title="By Decade" sub="When your comics were published" />
          <div style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:6, padding:"16px" }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byDecade.map(([name,count]) => ({ name, count }))} margin={{ top:4, right:4, left:0, bottom:4 }}>
                <XAxis dataKey="name" tick={{ fontSize:11, fontFamily:"'Bebas Neue',sans-serif", fill:"var(--muted)" }} />
                <YAxis tick={{ fontSize:10, fill:"var(--muted)" }} width={36} />
                <Tooltip formatter={(v:number) => [`${v} books`]} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", fontSize:"0.82rem" }} />
                <Bar dataKey="count" fill="#c8102e" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Platform mix */}
          <SectionHead title="Platform Distribution" sub="Where your books are assigned for sale" />
          <div style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:6, padding:"16px" }}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={platPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value, percent }) => `${name}: ${value} (${(percent*100).toFixed(0)}%)`} labelLine fontSize={10}>
                  {platPieData.map((_,i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CUSTOM_TOOLTIP />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Fun facts */}
          <SectionHead title="Fun Facts" />
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:10 }}>
            {[
              { fact:`1 in every ${Math.round(comics.length/keys.length)} books is a key issue`, color:"#d97706" },
              { fact:`Your most collected writer has ${topWriters[0]?.[1] || 0} books in the collection`, color:"#c8102e" },
              { fact:`${signed.length} books have autographs — that's ${((signed.length/comics.length)*100).toFixed(1)}% of everything`, color:"#8b2be2" },
              { fact:`${deepRunTitles.length} titles have 10+ issues in your collection — you committed`, color:"#1d6fa4" },
              { fact:`${byPub.length} different publishers are represented`, color:"#16a34a" },
              { fact:`The oldest era in your collection: ${byEra.find(e=>e.count>0)?.name || "Modern"}`, color:"#d97706" },
              { fact:`You own ${annuals.length} annuals — you know what you're doing`, color:"#6b7280" },
              { fact:`${topTitles[0]?.[0] || "Batman"} leads all titles with ${topTitles[0]?.[1] || 0} issues`, color:"#c8102e" },
            ].map((f, i) => (
              <div key={i} style={{ background:"var(--surface)", border:`1.5px solid ${f.color}30`, borderLeft:`3px solid ${f.color}`, borderRadius:6, padding:"12px 16px", fontSize:"0.9rem", color:"var(--text)", lineHeight:1.5 }}>
                {f.fact}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════ WRITERS */}
      {subView === "writers" && (
        <>
          {/* Top writers by publisher */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:16, marginBottom:32 }}>
            {[
              { pub:"DC",     writers:topDCWriters,   total:dcTotal,    color:"#1d6fa4" },
              { pub:"Marvel", writers:topMrvlWriters, total:mrvlTotal,  color:"#c8102e" },
              { pub:"Other",  writers:topOtherWriters,total:otherTotal, color:"#6b7280" },
            ].map(g => (
              <div key={g.pub} style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:6, padding:"16px" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem", letterSpacing:"2px", color:g.color, marginBottom:12 }}>
                  TOP WRITERS — {g.pub}
                </div>
                {g.writers.map(([name, count], i) => (
                  <LeaderRow key={name} rank={i+1} name={name} count={count} total={g.total} color={g.color} />
                ))}
              </div>
            ))}
          </div>

          {/* Overall top 15 writers */}
          <SectionHead title="Top Writers — Overall" sub="All publishers combined" />
          <div style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:6, padding:"16px", marginBottom:24 }}>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={topWriters.map(([name,count])=>({ name: name.split(" ").slice(-1)[0], fullName:name, count }))} layout="vertical" margin={{ top:4, right:40, left:4, bottom:4 }}>
                <XAxis type="number" tick={{ fontSize:10, fill:"var(--muted)" }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize:10, fontFamily:"'Bebas Neue',sans-serif", fill:"var(--muted)" }} width={80} />
                <Tooltip formatter={(v:number) => [`${v} books`]} labelFormatter={(_,payload) => payload?.[0]?.payload?.fullName || ""} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", fontSize:"0.82rem" }} />
                <Bar dataKey="count" fill="#c8102e" radius={[0,3,3,0]}>
                  {topWriters.map((_,i) => <Cell key={i} fill={i===0?"#d4a800":i<=2?"#c8102e":"#1d6fa4"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top artists */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <div style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:6, padding:"16px" }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem", letterSpacing:"2px", color:"#8b2be2", marginBottom:12 }}>TOP PENCILLERS</div>
              {topArtists.map(([name, count], i) => (
                <LeaderRow key={name} rank={i+1} name={name} count={count} total={maxArtist} color="#8b2be2" />
              ))}
            </div>
            <div style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:6, padding:"16px" }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem", letterSpacing:"2px", color:"#16a34a", marginBottom:12 }}>TOP COVER ARTISTS</div>
              {topCoverArtists.map(([name, count], i) => (
                <LeaderRow key={name} rank={i+1} name={name} count={count} total={topCoverArtists[0]?.[1]||1} color="#16a34a" />
              ))}
            </div>
          </div>

          {/* Signers hall of fame */}
          <SectionHead title="Signers Hall of Fame" sub={`${signed.length} signed books · ${topSigners.length} verified creators`} />
          <div style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:6, padding:"16px" }}>
            {topSigners.map(([name, count], i) => (
              <LeaderRow key={name} rank={i+1} name={name} count={count} total={maxSigner} color="#d97706" />
            ))}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════ CHARACTERS */}
      {subView === "characters" && (
        <>
          <SectionHead title="Character Family Breakdown" sub="How your collection maps across universes and teams" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:28 }}>
            <div style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:6, padding:"16px" }}>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={famPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} labelLine={false} label={({ name, percent }) => percent > 0.04 ? `${name.split(" ")[0]} ${(percent*100).toFixed(0)}%` : ""} fontSize={9}>
                    {famPieData.map((f, i) => <Cell key={i} fill={f.color || PIE_COLORS[i%PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CUSTOM_TOOLTIP />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:6, padding:"16px" }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", letterSpacing:"2px", color:"var(--red)", marginBottom:12 }}>FAMILY COUNT</div>
              {familyData.slice(0, 14).map(({ name, count, color }, i) => {
                const fam = FAMILIES.find(f => f.name === name);
                const label = fam ? `${fam.emoji} ${name}` : name;
                return <LeaderRow key={name} rank={i+1} name={label} count={count} total={familyData[0].count} color={color} />;
              })}
            </div>
          </div>

          {/* Teams / rosters */}
          <SectionHead title="Team Books" sub="Titles featuring superhero teams" />
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {[
              { team:"X-Men",         titles:["X-Men","Uncanny X-Men","X-Force","New Mutants","Generation X","Excalibur","X-Factor"] },
              { team:"Avengers",      titles:["Avengers","West Coast Avengers","New Avengers","Secret Avengers","Mighty Avengers","Avengers Academy"] },
              { team:"Justice League",titles:["Justice League","JLA","Justice League International","Justice League America"] },
              { team:"Titans",        titles:["Teen Titans","New Teen Titans","Titans"] },
              { team:"Fantastic Four",titles:["Fantastic Four"] },
              { team:"Guardians",     titles:["Guardians of the Galaxy"] },
            ].map(({ team, titles }) => {
              const count = comics.filter(c => titles.some(t => c.Title.includes(t))).length;
              if (!count) return null;
              return (
                <div key={team} style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:6, padding:"10px 16px", minWidth:120, textAlign:"center" }}>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.4rem", color:"var(--red)" }}>{count}</div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.7rem", letterSpacing:"1.5px", color:"var(--muted)" }}>{team}</div>
                </div>
              );
            })}
          </div>

          {/* Key character milestones */}
          <SectionHead title="Milestone Keys by Character" sub="Your most notable first appearances and key moments" />
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {comics
              .filter(c => (c.Key || "").toUpperCase() === "YES" && (c.First_App || "").trim())
              .slice(0, 30)
              .map((c, i) => (
                <div key={i} style={{ background:"var(--surface)", border:"1.5px solid #d97706", borderLeft:"3px solid #d97706", borderRadius:6, padding:"8px 12px", flex:"1 1 220px" }}>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.82rem", color:"#d97706", letterSpacing:"1px" }}>{c.First_App}</div>
                  <div style={{ fontSize:"0.8rem", color:"var(--text)", marginTop:2 }}>{c.Title} #{c.Issue}</div>
                  <div style={{ fontSize:"0.72rem", color:"var(--muted2)", marginTop:1 }}>Box {c.Box} · {c.Publisher} {c.Year}</div>
                </div>
              ))}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════ TITLES */}
      {subView === "titles" && (
        <>
          <SectionHead title="Most Issues of a Single Title" sub="Your deepest commitments as a collector" />
          <div style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:6, padding:"16px", marginBottom:24 }}>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={topTitles.slice(0,20).map(([name,count])=>({ name: name.length > 20 ? name.slice(0,18)+"…" : name, fullName:name, count }))} layout="vertical" margin={{ top:4, right:40, left:4, bottom:4 }}>
                <XAxis type="number" tick={{ fontSize:10, fill:"var(--muted)" }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize:9, fontFamily:"'Bebas Neue',sans-serif", fill:"var(--muted)" }} width={140} />
                <Tooltip formatter={(v:number) => [`${v} issues`]} labelFormatter={(_,payload) => payload?.[0]?.payload?.fullName || ""} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", fontSize:"0.82rem" }} />
                <Bar dataKey="count" radius={[0,3,3,0]}>
                  {topTitles.slice(0,20).map((_,i) => <Cell key={i} fill={i===0?"#d4a800":i<=2?"#c8102e":i<=5?"#1d6fa4":"#6b7280"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Run depth categories */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:12, marginBottom:32 }}>
            <StatTile val={deepRunTitles.length}                      lbl="Deep Runs (10+)"   sub="titles with 10+ issues in collection" color="#c8102e" />
            <StatTile val={midRunTitles.length}                       lbl="Mid Runs (4–9)"    sub="titles with 4–9 issues"              color="#d97706" />
            <StatTile val={titleEntries.filter(([,v])=>v>=2&&v<=3).length} lbl="A Few Issues (2–3)" sub="dipping a toe in"             color="#1d6fa4" />
            <StatTile val={titleEntries.filter(([,v])=>v===1).length} lbl="Single Issues"     sub="one and done (or just started)"      color="#6b7280" />
          </div>

          {/* Deep runs detail */}
          <SectionHead title="Your Deep Runs" sub="Titles where you clearly went all-in (10+ issues)" />
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {deepRunTitles.map(([title, count]) => (
              <div key={title} style={{ background:"var(--surface)", border:"1.5px solid #c8102e40", borderLeft:"3px solid #c8102e", borderRadius:6, padding:"10px 14px", flex:"1 1 200px" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.3rem", color:"#c8102e" }}>{count}</div>
                <div style={{ fontSize:"0.85rem", color:"var(--text)", fontWeight:500, marginTop:2 }}>{title}</div>
              </div>
            ))}
          </div>

          {/* Mid runs */}
          <SectionHead title="Mid Runs" sub="4–9 issues — respectable commitment" />
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {midRunTitles.map(([title, count]) => (
              <div key={title} style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:5, padding:"6px 12px", display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontFamily:"'Bebas Neue',sans-serif", color:"#d97706", fontSize:"1rem" }}>{count}</span>
                <span style={{ fontSize:"0.82rem", color:"var(--text)" }}>{title}</span>
              </div>
            ))}
          </div>

          {/* Annuals & Specials */}
          <SectionHead title="Annuals & Specials" sub={`${annuals.length} annuals in the collection`} />
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {annuals.map((c, i) => (
              <div key={i} style={{ background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:5, padding:"6px 12px", fontSize:"0.82rem", color:"var(--text)" }}>
                {c.Title} {c.Issue} <span style={{ color:"var(--muted2)", fontSize:"0.72rem" }}>Box {c.Box}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// helper needed inside component but defined outside to avoid re-creation
function uniqueSigners() {
  const set = new Set(signed.map(c => c.Signed_By).filter(Boolean));
  return set.size;
}
