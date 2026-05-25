import { useState, useMemo, useEffect } from "react";
import { getCoverSvgUrl, pubColors, type ComicLike } from "@/utils/coverThumbnails";

// ── Your actual pull list ────────────────────────────────────────────────────
type SeriesType = "ongoing" | "mini";
type Cadence    = "new" | "existing";

interface Series {
  publisher: string;
  title:     string;
  type:      SeriesType;
  cadence:   Cadence;
}

const SERIES: Series[] = [
  { publisher:"Marvel", title:"Avengers Armageddon",                  type:"ongoing", cadence:"new"      },
  { publisher:"DC",     title:"Barbara Gordon: Breakout",             type:"ongoing", cadence:"new"      },
  { publisher:"DC",     title:"Batman / Wonder Woman: Truth",         type:"mini",    cadence:"new"      },
  { publisher:"Marvel", title:"Bishop",                               type:"mini",    cadence:"new"      },
  { publisher:"Marvel", title:"Moonstar",                             type:"mini",    cadence:"new"      },
  { publisher:"Marvel", title:"Ultimate Impact",                      type:"mini",    cadence:"new"      },
  { publisher:"DC",     title:"Zatanna",                              type:"ongoing", cadence:"new"      },
  { publisher:"DC",     title:"Absolute Flash",                       type:"ongoing", cadence:"existing" },
  { publisher:"DC",     title:"Absolute Green Lantern",               type:"ongoing", cadence:"existing" },
  { publisher:"DC",     title:"Absolute Wonder Woman",                type:"ongoing", cadence:"existing" },
  { publisher:"DC",     title:"Batgirl",                              type:"ongoing", cadence:"existing" },
  { publisher:"DC",     title:"Batman / Static: Beyond",              type:"mini",    cadence:"existing" },
  { publisher:"DC",     title:"Batman/Superman: World's Finest",      type:"ongoing", cadence:"existing" },
  { publisher:"DC",     title:"Batwoman",                             type:"ongoing", cadence:"existing" },
  { publisher:"Other",  title:"Beneath the Trees Where Nobody Sees",  type:"ongoing", cadence:"existing" },
  { publisher:"Marvel", title:"Captain America",                      type:"ongoing", cadence:"existing" },
  { publisher:"Marvel", title:"Fantastic Four",                       type:"ongoing", cadence:"existing" },
  { publisher:"DC",     title:"Fury of Firestorm",                    type:"ongoing", cadence:"existing" },
  { publisher:"Image",  title:"G.I. Joe",                             type:"ongoing", cadence:"existing" },
  { publisher:"Marvel", title:"Inglorious X-Force",                   type:"ongoing", cadence:"existing" },
  { publisher:"DC",     title:"Justice League Unlimited",             type:"ongoing", cadence:"existing" },
  { publisher:"Marvel", title:"Miles Morales: Spider-Man",            type:"ongoing", cadence:"existing" },
  { publisher:"Marvel", title:"New Avengers",                         type:"ongoing", cadence:"existing" },
  { publisher:"Marvel", title:"Nova Centurion",                       type:"mini",    cadence:"existing" },
  { publisher:"Marvel", title:"Planet of the Apes vs. Fantastic Four",type:"mini",    cadence:"existing" },
  { publisher:"Marvel", title:"The World to Come",                    type:"mini",    cadence:"existing" },
  { publisher:"Image",  title:"Transformers",                         type:"ongoing", cadence:"existing" },
  { publisher:"Marvel", title:"Ultimate Black Panther",               type:"ongoing", cadence:"existing" },
  { publisher:"Marvel", title:"Ultimate Endgame",                     type:"mini",    cadence:"existing" },
  { publisher:"Marvel", title:"Ultimates",                            type:"ongoing", cadence:"existing" },
  { publisher:"Image",  title:"Void Rivals",                          type:"ongoing", cadence:"existing" },
  { publisher:"Marvel", title:"X-Men of Apocalypse",                  type:"mini",    cadence:"existing" },
  { publisher:"Other",  title:"Powers 25th Anniversary",              type:"ongoing", cadence:"existing" },
];

// ── Per-issue tracking ───────────────────────────────────────────────────────
type IssueStatus = "expected" | "arrived" | "read" | "key" | "dropped";

interface IssueEntry {
  issueNum: string;
  status:   IssueStatus;
  notes:    string;
  addedAt:  string;
}

type SeriesData = Record<string, IssueEntry[]>; // key = series title

const LS_KEY = "brbPullList_v3";
function load(): SeriesData {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
  catch { return {}; }
}
function save(d: SeriesData) { localStorage.setItem(LS_KEY, JSON.stringify(d)); }

const ISSUE_STATUS: Record<IssueStatus, { label: string; color: string; bg: string }> = {
  expected: { label:"EXPECTED",  color:"#6b7280", bg:"#f5f5f5" },
  arrived:  { label:"ARRIVED",   color:"#1d6fa4", bg:"#e8f4fd" },
  read:     { label:"READ ✓",    color:"#16a34a", bg:"#f0faf0" },
  key:      { label:"KEY ISSUE", color:"#b45309", bg:"#fef3c7" },
  dropped:  { label:"DROPPED",   color:"#9ca3af", bg:"#f5f5f5" },
};
const ISSUE_ORDER: IssueStatus[] = ["expected","arrived","read","key","dropped"];

const PUB_ORDER = ["Marvel","DC","Image","Other"];

function normPub(p: string): string {
  const u = p.toUpperCase();
  if (u === "MARVEL") return "Marvel";
  if (u === "DC")     return "DC";
  if (u === "IMAGE")  return "Image";
  return "Other";
}

function comicLike(s: Series): ComicLike {
  return { Title: s.title, Issue: "1", Publisher: s.publisher };
}

function pubBadgeStyle(pub: string) {
  const pc = pubColors(pub);
  return { background: pc.bg, color: pc.text, border: `none` };
}

// ── Component ────────────────────────────────────────────────────────────────
export default function PullList() {
  const [data,       setData]       = useState<SeriesData>(load);
  const [view,       setView]       = useState<"card"|"list">("list");
  const [query,      setQuery]      = useState("");
  const [filterPub,  setFilterPub]  = useState<string>("All");
  const [filterType, setFilterType] = useState<"all"|"ongoing"|"mini">("all");
  const [filterNew,  setFilterNew]  = useState<"all"|"new"|"existing">("all");
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [addingFor,  setAddingFor]  = useState<string|null>(null);
  const [newIssue,   setNewIssue]   = useState("");
  const [newNote,    setNewNote]    = useState("");

  useEffect(() => { save(data); }, [data]);

  const publishers = ["All", ...PUB_ORDER];

  const filtered = useMemo(() => {
    let list = SERIES;
    if (filterPub !== "All") list = list.filter(s => normPub(s.publisher) === filterPub);
    if (filterType !== "all") list = list.filter(s => s.type === filterType);
    if (filterNew  !== "all") list = list.filter(s => s.cadence === filterNew);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(s => s.title.toLowerCase().includes(q) || s.publisher.toLowerCase().includes(q));
    }
    return list;
  }, [query, filterPub, filterType, filterNew]);

  // Counts for header
  const totalIssues = Object.values(data).reduce((n, arr) => n + arr.length, 0);
  const readCount   = Object.values(data).reduce((n, arr) => n + arr.filter(i => i.status === "read" || i.status === "key").length, 0);
  const keyCount    = Object.values(data).reduce((n, arr) => n + arr.filter(i => i.status === "key").length, 0);

  function addIssue(title: string) {
    if (!newIssue.trim()) return;
    const entry: IssueEntry = {
      issueNum: newIssue.trim(),
      status:   "expected",
      notes:    newNote.trim(),
      addedAt:  new Date().toISOString(),
    };
    setData(prev => ({ ...prev, [title]: [...(prev[title] || []), entry] }));
    setNewIssue("");
    setNewNote("");
    setAddingFor(null);
  }

  function updateStatus(title: string, idx: number, status: IssueStatus) {
    setData(prev => {
      const arr = [...(prev[title] || [])];
      arr[idx] = { ...arr[idx], status };
      return { ...prev, [title]: arr };
    });
  }

  function removeIssue(title: string, idx: number) {
    setData(prev => {
      const arr = [...(prev[title] || [])];
      arr.splice(idx, 1);
      return { ...prev, [title]: arr };
    });
  }

  function exportTxt() {
    const lines = [
      "BLACKREADBROWN — ACTIVE PULL LIST",
      `${SERIES.length} series · ${totalIssues} issues tracked`,
      "",
      ...PUB_ORDER.flatMap(pub => {
        const s = SERIES.filter(s => normPub(s.publisher) === pub);
        if (!s.length) return [];
        return [
          `── ${pub.toUpperCase()} ──`,
          ...s.map(s => {
            const issues = data[s.title] || [];
            const latest = issues[issues.length-1];
            return `  ${s.title} [${s.type === "mini" ? "MINI" : "ONGOING"}]${latest ? ` · Latest: #${latest.issueNum} (${ISSUE_STATUS[latest.status].label})` : ""}`;
          }),
          "",
        ];
      }),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines], { type:"text/plain" }));
    a.download = "blackreadbrown_pull_list.txt";
    a.click();
  }

  // Group for card view
  const byPub = useMemo(() => {
    const groups: Record<string, Series[]> = {};
    for (const s of filtered) {
      const p = normPub(s.publisher);
      groups[p] = [...(groups[p] || []), s];
    }
    return groups;
  }, [filtered]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 16px 80px" }}>

      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:14, flexWrap:"wrap", marginBottom:12 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"2rem", letterSpacing:"3px", color:"var(--red)", lineHeight:1 }}>
            PULL LIST
          </div>
          <div style={{ fontFamily:"'Crimson Pro',serif", color:"var(--muted2)", fontSize:"0.92rem", marginTop:2 }}>
            {SERIES.filter(s=>s.cadence==="new").length} new titles · {SERIES.filter(s=>s.cadence==="existing").length} ongoing · {SERIES.filter(s=>s.type==="mini").length} minis
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
          {[
            { n: SERIES.length,    l:"TITLES",  c:"var(--red)"     },
            { n: totalIssues,      l:"TRACKED", c:"#1d6fa4"        },
            { n: readCount,        l:"READ",     c:"#16a34a"        },
            { n: keyCount,         l:"KEYS",     c:"#b45309"        },
          ].map(s => (
            <div key={s.l} style={{
              background:"var(--surface)", border:"1.5px solid var(--border)",
              borderRadius:6, padding:"6px 14px", textAlign:"center", minWidth:72,
            }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.3rem", color:s.c, lineHeight:1 }}>{s.n}</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.52rem", letterSpacing:"1.5px", color:"var(--muted)", marginTop:1 }}>{s.l}</div>
            </div>
          ))}
          <div style={{ marginLeft:"auto", display:"flex", gap:6, alignItems:"center" }}>
            <button onClick={exportTxt} style={{
              background:"var(--surface)", border:"1.5px solid var(--border)",
              borderRadius:5, padding:"6px 14px", cursor:"pointer",
              fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem",
              letterSpacing:"1.5px", color:"var(--muted2)",
            }}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor="var(--red)";(e.currentTarget as HTMLButtonElement).style.color="var(--red)";}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor="var(--border)";(e.currentTarget as HTMLButtonElement).style.color="var(--muted2)";}}
            >EXPORT TXT ↓</button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
          <input
            placeholder="Search titles…"
            value={query}
            onChange={e=>setQuery(e.target.value)}
            style={{
              padding:"7px 12px", border:"1.5px solid var(--border)", borderRadius:5,
              fontSize:"0.82rem", fontFamily:"'Crimson Pro',serif",
              outline:"none", background:"#fff", minWidth:180,
            }}
          />
          {/* Publisher pills */}
          <div style={{ display:"flex", gap:4 }}>
            {publishers.map(p => {
              const isActive = filterPub === p;
              const pc = p === "All" ? null : pubColors(p);
              return (
                <button key={p} onClick={()=>setFilterPub(p)} style={{
                  background: isActive ? (pc?.bg ?? "var(--red)") : "var(--surface)",
                  color: isActive ? (pc?.text ?? "#fff") : "var(--muted2)",
                  border: isActive ? `1.5px solid ${pc?.bg ?? "var(--red)"}` : "1.5px solid var(--border)",
                  borderRadius:4, padding:"5px 11px", cursor:"pointer",
                  fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem", letterSpacing:"1px",
                }}>{p}</button>
              );
            })}
          </div>
          <select value={filterType} onChange={e=>setFilterType(e.target.value as typeof filterType)} style={{
            padding:"6px 10px", border:"1.5px solid var(--border)", borderRadius:5,
            fontSize:"0.72rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
            background:"#fff", cursor:"pointer",
          }}>
            <option value="all">ONGOING + MINI</option>
            <option value="ongoing">ONGOING ONLY</option>
            <option value="mini">MINI ONLY</option>
          </select>
          <select value={filterNew} onChange={e=>setFilterNew(e.target.value as typeof filterNew)} style={{
            padding:"6px 10px", border:"1.5px solid var(--border)", borderRadius:5,
            fontSize:"0.72rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
            background:"#fff", cursor:"pointer",
          }}>
            <option value="all">NEW + EXISTING</option>
            <option value="new">NEW TITLES</option>
            <option value="existing">EXISTING</option>
          </select>
          {/* View toggle */}
          <div style={{ display:"flex", gap:4, marginLeft:"auto" }}>
            {(["card","list"] as const).map(v => (
              <button key={v} onClick={()=>setView(v)} style={{
                background: view===v ? "var(--red)" : "var(--surface)",
                color: view===v ? "#fff" : "var(--muted2)",
                border: view===v ? "1.5px solid var(--red)" : "1.5px solid var(--border)",
                borderRadius:5, padding:"6px 12px", cursor:"pointer",
                fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem", letterSpacing:"1px",
              }}>{v==="card" ? "⊞ CARD" : "≡ LIST"}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CARD VIEW ── */}
      {view === "card" && (
        <div>
          {PUB_ORDER.filter(p => byPub[p]?.length).map(pub => (
            <div key={pub} style={{ marginBottom:28 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                <div style={{
                  fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.7rem",
                  letterSpacing:"3px", color: pubColors(pub).bg,
                }}>
                  {pub.toUpperCase()}
                </div>
                <div style={{ flex:1, height:1, background:"var(--border)" }}/>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1.5px", color:"var(--muted)" }}>
                  {byPub[pub].length} TITLE{byPub[pub].length!==1?"S":""}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:8 }}>
                {byPub[pub].map(s => (
                  <SeriesCard
                    key={s.title}
                    series={s}
                    issues={data[s.title]||[]}
                    expanded={expandedId===s.title}
                    addingFor={addingFor===s.title}
                    newIssue={addingFor===s.title?newIssue:""}
                    newNote={addingFor===s.title?newNote:""}
                    onToggle={()=>setExpandedId(id=>id===s.title?null:s.title)}
                    onStartAdd={()=>{setAddingFor(s.title);setExpandedId(s.title);}}
                    onCancelAdd={()=>{setAddingFor(null);setNewIssue("");setNewNote("");}}
                    onNewIssueChange={setNewIssue}
                    onNewNoteChange={setNewNote}
                    onAddIssue={()=>addIssue(s.title)}
                    onStatusChange={(idx,st)=>updateStatus(s.title,idx,st)}
                    onRemove={idx=>removeIssue(s.title,idx)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === "list" && (
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          {filtered.map(s => (
            <SeriesRow
              key={s.title}
              series={s}
              issues={data[s.title]||[]}
              expanded={expandedId===s.title}
              addingFor={addingFor===s.title}
              newIssue={addingFor===s.title?newIssue:""}
              newNote={addingFor===s.title?newNote:""}
              onToggle={()=>setExpandedId(id=>id===s.title?null:s.title)}
              onStartAdd={()=>{setAddingFor(s.title);setExpandedId(s.title);}}
              onCancelAdd={()=>{setAddingFor(null);setNewIssue("");setNewNote("");}}
              onNewIssueChange={setNewIssue}
              onNewNoteChange={setNewNote}
              onAddIssue={()=>addIssue(s.title)}
              onStatusChange={(idx,st)=>updateStatus(s.title,idx,st)}
              onRemove={idx=>removeIssue(s.title,idx)}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{
          padding:"48px 20px", textAlign:"center",
          fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.9rem",
          letterSpacing:"2px", color:"var(--muted)",
          border:"1.5px dashed var(--border)", borderRadius:8,
        }}>NO TITLES MATCH THIS FILTER</div>
      )}
    </div>
  );
}

// ── Shared props ─────────────────────────────────────────────────────────────
interface SeriesProps {
  series:           Series;
  issues:           IssueEntry[];
  expanded:         boolean;
  addingFor:        boolean;
  newIssue:         string;
  newNote:          string;
  onToggle:         () => void;
  onStartAdd:       () => void;
  onCancelAdd:      () => void;
  onNewIssueChange: (v: string) => void;
  onNewNoteChange:  (v: string) => void;
  onAddIssue:       () => void;
  onStatusChange:   (idx: number, st: IssueStatus) => void;
  onRemove:         (idx: number) => void;
}

// ── Issue status inline dropdown ─────────────────────────────────────────────
function StatusPill({ status, onChange }: { status: IssueStatus; onChange: (s: IssueStatus) => void }) {
  const [open, setOpen] = useState(false);
  const m = ISSUE_STATUS[status];
  return (
    <div style={{ position:"relative" }}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        background:m.bg, border:`1.5px solid ${m.color}40`,
        borderRadius:4, padding:"2px 8px", cursor:"pointer",
        fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem",
        letterSpacing:"1px", color:m.color, whiteSpace:"nowrap",
      }}>{m.label} ▾</button>
      {open && (
        <div style={{
          position:"absolute", top:"110%", left:0, zIndex:300,
          background:"#fff", border:"1.5px solid var(--border)",
          borderRadius:6, boxShadow:"0 4px 18px rgba(0,0,0,0.12)",
          overflow:"hidden", minWidth:120,
        }}>
          {ISSUE_ORDER.map(st => {
            const sm = ISSUE_STATUS[st];
            return (
              <div key={st} onClick={()=>{onChange(st);setOpen(false);}} style={{
                padding:"7px 12px", cursor:"pointer",
                background: st===status ? sm.bg : "#fff",
                fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem",
                letterSpacing:"1px", color:sm.color,
                borderBottom:"1px solid var(--border)",
              }}
                onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.background=sm.bg;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.background=st===status?sm.bg:"#fff";}}
              >{sm.label}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Add issue form ────────────────────────────────────────────────────────────
function AddIssueForm({ newIssue, newNote, onIssue, onNote, onAdd, onCancel }: {
  newIssue: string; newNote: string;
  onIssue: (v:string)=>void; onNote: (v:string)=>void;
  onAdd: ()=>void; onCancel: ()=>void;
}) {
  return (
    <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap", marginTop:8, padding:"8px 10px", background:"var(--surface)", borderRadius:5 }}>
      <input placeholder="#" value={newIssue} onChange={e=>onIssue(e.target.value)}
        onKeyDown={e=>e.key==="Enter"&&onAdd()}
        style={{ width:54, padding:"5px 8px", border:"1.5px solid var(--border)", borderRadius:4, fontSize:"0.8rem", fontFamily:"'Crimson Pro',serif", outline:"none", background:"#fff" }}
      />
      <input placeholder="Note (optional)" value={newNote} onChange={e=>onNote(e.target.value)}
        onKeyDown={e=>e.key==="Enter"&&onAdd()}
        style={{ flex:1, minWidth:100, padding:"5px 8px", border:"1.5px solid var(--border)", borderRadius:4, fontSize:"0.8rem", fontFamily:"'Crimson Pro',serif", outline:"none", background:"#fff" }}
      />
      <button onClick={onAdd} style={{ background:"var(--red)", color:"#fff", border:"none", borderRadius:4, padding:"5px 12px", cursor:"pointer", fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem", letterSpacing:"1px" }}>ADD</button>
      <button onClick={onCancel} style={{ background:"none", border:"1.5px solid var(--border)", borderRadius:4, padding:"5px 10px", cursor:"pointer", fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem", letterSpacing:"1px", color:"var(--muted)" }}>✕</button>
    </div>
  );
}

// ── Issues list ───────────────────────────────────────────────────────────────
function IssueList({ issues, onStatusChange, onRemove }: {
  issues: IssueEntry[];
  onStatusChange: (idx:number, st:IssueStatus)=>void;
  onRemove: (idx:number)=>void;
}) {
  if (!issues.length) return (
    <div style={{ padding:"8px 0", color:"var(--muted)", fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"1.5px" }}>
      NO ISSUES TRACKED YET
    </div>
  );
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:4, marginTop:8 }}>
      {[...issues].reverse().map((iss, ri) => {
        const idx = issues.length - 1 - ri;
        const m = ISSUE_STATUS[iss.status];
        return (
          <div key={idx} style={{
            display:"flex", alignItems:"center", gap:8,
            padding:"5px 8px", borderRadius:4,
            background: m.bg, border:`1px solid ${m.color}20`,
          }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.75rem", color:m.color, minWidth:28 }}>#{iss.issueNum}</div>
            {iss.notes && <div style={{ flex:1, fontSize:"0.72rem", color:"var(--muted2)", fontStyle:"italic" }}>{iss.notes}</div>}
            {!iss.notes && <div style={{ flex:1 }}/>}
            <StatusPill status={iss.status} onChange={st=>onStatusChange(idx,st)} />
            <button onClick={()=>onRemove(idx)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--muted)", fontSize:"0.8rem", opacity:0.45, padding:"0 2px" }}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.opacity="1";}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.opacity="0.45";}}
            >✕</button>
          </div>
        );
      })}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
function SeriesCard(p: SeriesProps) {
  const { series: s, issues, expanded } = p;
  const pc     = pubColors(s.publisher);
  const cl     = comicLike(s);
  const svgUrl = getCoverSvgUrl(cl, { width:60, height:90 });
  const latest = issues[issues.length-1];
  const isNew  = s.cadence === "new";

  return (
    <div style={{
      background:"#fff", border:"1.5px solid var(--border)",
      borderTop:`3px solid ${pc.bg}`,
      borderRadius:8, overflow:"hidden",
      display:"flex", flexDirection:"column",
      transition:"box-shadow 0.12s",
    }}>
      {/* Header */}
      <div style={{ display:"flex", gap:10, padding:"10px 10px 8px", cursor:"pointer" }} onClick={p.onToggle}>
        <img src={svgUrl} alt={s.title} width={44} height={66}
          style={{ borderRadius:3, flexShrink:0, display:"block" }} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", gap:4, marginBottom:4, flexWrap:"wrap" }}>
            <span style={{
              fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.55rem", letterSpacing:"1px",
              padding:"1px 6px", borderRadius:3,
              ...pubBadgeStyle(s.publisher),
            }}>{s.publisher.toUpperCase()}</span>
            <span style={{
              fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.55rem", letterSpacing:"1px",
              padding:"1px 6px", borderRadius:3,
              background: s.type==="mini" ? "#f3f0ff" : "#f0faf0",
              color:       s.type==="mini" ? "#5b4fc8"  : "#16a34a",
            }}>{s.type==="mini" ? "MINI" : "ONGOING"}</span>
            {isNew && (
              <span style={{
                fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.55rem", letterSpacing:"1px",
                padding:"1px 6px", borderRadius:3, background:"#fef3c7", color:"#b45309",
              }}>NEW</span>
            )}
          </div>
          <div style={{ fontSize:"0.84rem", fontWeight:700, color:"var(--brown-light)", lineHeight:1.25 }}>
            {s.title}
          </div>
          {latest && (
            <div style={{ fontSize:"0.68rem", color: ISSUE_STATUS[latest.status].color, marginTop:3, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"0.5px" }}>
              #{latest.issueNum} — {ISSUE_STATUS[latest.status].label}
            </div>
          )}
          {!latest && (
            <div style={{ fontSize:"0.67rem", color:"var(--muted)", marginTop:3, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"0.5px" }}>
              {issues.length} ISSUE{issues.length!==1?"S":""} TRACKED
            </div>
          )}
        </div>
        <div style={{ color:"var(--muted)", fontSize:"0.75rem", alignSelf:"flex-start", paddingTop:2 }}>
          {expanded ? "▲" : "▼"}
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ padding:"0 10px 10px", borderTop:"1px solid var(--border)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:8, marginBottom:4 }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1.5px", color:"var(--muted)" }}>
              ISSUES — {issues.length}
            </div>
            {!p.addingFor && (
              <button onClick={p.onStartAdd} style={{
                background:"var(--red)", color:"#fff", border:"none",
                borderRadius:4, padding:"3px 10px", cursor:"pointer",
                fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"1px",
              }}>+ ADD ISSUE</button>
            )}
          </div>
          {p.addingFor && (
            <AddIssueForm
              newIssue={p.newIssue} newNote={p.newNote}
              onIssue={p.onNewIssueChange} onNote={p.onNewNoteChange}
              onAdd={p.onAddIssue} onCancel={p.onCancelAdd}
            />
          )}
          <IssueList issues={issues} onStatusChange={p.onStatusChange} onRemove={p.onRemove} />
        </div>
      )}
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────
function SeriesRow(p: SeriesProps) {
  const { series: s, issues, expanded } = p;
  const pc     = pubColors(s.publisher);
  const cl     = comicLike(s);
  const svgUrl = getCoverSvgUrl(cl, { width:32, height:48 });
  const latest = issues[issues.length-1];
  const isNew  = s.cadence === "new";

  return (
    <div style={{ background:"#fff", border:"1.5px solid var(--border)", borderLeft:`3px solid ${pc.bg}`, borderRadius:6 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", cursor:"pointer" }} onClick={p.onToggle}>
        <img src={svgUrl} alt={s.title} width={28} height={42}
          style={{ borderRadius:2, flexShrink:0, display:"block" }} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", gap:5, alignItems:"baseline", flexWrap:"wrap" }}>
            <span style={{ fontSize:"0.88rem", fontWeight:700, color:"var(--brown-light)" }}>{s.title}</span>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.55rem", letterSpacing:"1px", color:pc.bg }}>{s.publisher.toUpperCase()}</span>
            <span style={{
              fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.55rem", letterSpacing:"1px",
              color: s.type==="mini" ? "#5b4fc8" : "#16a34a",
            }}>{s.type==="mini" ? "MINI" : "ONGOING"}</span>
            {isNew && <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.55rem", letterSpacing:"1px", color:"#b45309" }}>NEW</span>}
          </div>
          {latest && (
            <div style={{ fontSize:"0.7rem", color:ISSUE_STATUS[latest.status].color, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"0.5px", marginTop:1 }}>
              Latest: #{latest.issueNum} — {ISSUE_STATUS[latest.status].label}
              {latest.notes && <span style={{ color:"var(--muted)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic", marginLeft:6 }}>{latest.notes}</span>}
            </div>
          )}
        </div>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1px", color:"var(--muted)", marginRight:6 }}>
          {issues.length > 0 ? `${issues.length} ISS` : ""}
        </div>
        <div style={{ color:"var(--muted)", fontSize:"0.75rem" }}>{expanded ? "▲" : "▼"}</div>
      </div>

      {expanded && (
        <div style={{ padding:"0 12px 10px", borderTop:"1px solid var(--border)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:8 }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1.5px", color:"var(--muted)" }}>
              ISSUES — {issues.length}
            </div>
            {!p.addingFor && (
              <button onClick={p.onStartAdd} style={{
                background:"var(--red)", color:"#fff", border:"none",
                borderRadius:4, padding:"3px 10px", cursor:"pointer",
                fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"1px",
              }}>+ ADD ISSUE</button>
            )}
          </div>
          {p.addingFor && (
            <AddIssueForm
              newIssue={p.newIssue} newNote={p.newNote}
              onIssue={p.onNewIssueChange} onNote={p.onNewNoteChange}
              onAdd={p.onAddIssue} onCancel={p.onCancelAdd}
            />
          )}
          <IssueList issues={issues} onStatusChange={p.onStatusChange} onRemove={p.onRemove} />
        </div>
      )}
    </div>
  );
}
