import { useState, useMemo, useEffect } from "react";
import { DATA3 } from "@/data/data3";
import { getCoverSvgUrl, type ComicLike } from "@/utils/coverThumbnails";

const comics = DATA3.comics;

const SHOWS = [
  { num:"1",  title:"Black Heroes Month: Priest-Era Black Panther + Signed Books",    target:"$300–$600"  },
  { num:"2",  title:"Batman Family: King/Snyder + Tom King Vision (Signed)",           target:"$250–$500"  },
  { num:"3",  title:"Spider-Man Family + Carnage Keys",                                target:"$300–$600"  },
  { num:"4",  title:"Captain America: Brubaker Complete + Sam Wilson Era",             target:"$200–$450"  },
  { num:"5",  title:"X-Men: Krakoa Era + Immortal Thor",                               target:"$300–$600"  },
  { num:"6",  title:"SIGNED BOOKS SPECIAL — Stories Behind the Signatures",            target:"$500–$1,200"},
  { num:"7",  title:"DC Rebirth Era: Snyder Justice League + Dark Nights Metal",       target:"$250–$500"  },
  { num:"8",  title:"Ultimate Marvel Universe: UXM / UFF / Ultimates Complete",        target:"$200–$400"  },
  { num:"9",  title:"Flash: Waid Era Complete (Flash #112–233)",                       target:"$150–$350"  },
  { num:"10", title:"Foil Covers + Variants + Absolute Batman",                        target:"$200–$450"  },
  { num:"11", title:"Black Panther Complete Archive: Priest / Hudlin / Coates / …",   target:"$400–$900"  },
  { num:"12", title:"Post-Terrificon Celebration Show — Best of the Collection",       target:"$300–$700"  },
];

type PullStatus = "to_pull" | "pulled" | "in_show" | "sold" | "passed";

interface PullEntry {
  id: string;
  title: string;
  issue: string;
  box: string;
  publisher: string;
  nmVal: string;
  startBid: string;
  isKey: boolean;
  isSigned: boolean;
  keyReason: string;
  signedBy: string;
  status: PullStatus;
  addedAt: string;
}

type PullData = Record<string, PullEntry[]>;

const LS_KEY = "brbPullList_v2";
function loadPull(): PullData {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
  catch { return {}; }
}
function savePull(d: PullData) { localStorage.setItem(LS_KEY, JSON.stringify(d)); }

const STATUS_META: Record<PullStatus, { label: string; color: string; bg: string }> = {
  to_pull:  { label: "TO PULL",  color: "#5b4fc8", bg: "#f3f0ff" },
  pulled:   { label: "PULLED",   color: "#1d6fa4", bg: "#e8f4fd" },
  in_show:  { label: "IN SHOW",  color: "#d97706", bg: "#fff7e0" },
  sold:     { label: "SOLD ✓",   color: "#16a34a", bg: "#f0faf0" },
  passed:   { label: "PASSED",   color: "#9ca3af", bg: "#f5f5f5" },
};

const STATUS_ORDER: PullStatus[] = ["to_pull", "pulled", "in_show", "sold", "passed"];

function parseVal(s: string | undefined) {
  const n = parseFloat(String(s || "").replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

function platClass(p: string) {
  const u = (p || "").toUpperCase();
  if (u.includes("WHATNOT")) return "bwn";
  if (u === "EBAY") return "beb";
  if (u.includes("TERRIFICON")) return "bt";
  return "be";
}

export default function PullList() {
  const [showNum,    setShowNum]    = useState("1");
  const [pullData,   setPullData]   = useState<PullData>(loadPull);
  const [query,      setQuery]      = useState("");
  const [view,       setView]       = useState<"list" | "card">("list");
  const [sortBy,     setSortBy]     = useState<"status"|"title"|"box"|"value"|"added">("status");
  const [filterSt,   setFilterSt]   = useState<PullStatus|"all">("all");
  const [listQuery,  setListQuery]  = useState("");
  const [searchRes,  setSearchRes]  = useState<typeof comics>([]);

  useEffect(() => { savePull(pullData); }, [pullData]);

  const currentList = useMemo(() => pullData[showNum] || [], [pullData, showNum]);

  const show = SHOWS.find(s => s.num === showNum)!;

  // Status counts
  const counts = useMemo(() => {
    const c: Record<PullStatus, number> = { to_pull:0, pulled:0, in_show:0, sold:0, passed:0 };
    for (const e of currentList) c[e.status] = (c[e.status] || 0) + 1;
    return c;
  }, [currentList]);

  // Search the collection
  function doSearch() {
    if (!query.trim()) return setSearchRes([]);
    const q = query.trim().toLowerCase();
    const res = comics.filter(c =>
      (c.Title  || "").toLowerCase().includes(q) ||
      (c.Writer || "").toLowerCase().includes(q) ||
      (c.Arc    || "").toLowerCase().includes(q) ||
      (c.Publisher || "").toLowerCase().includes(q) ||
      String(c.Issue).includes(q)
    ).slice(0, 60);
    setSearchRes(res);
  }

  function addToList(c: typeof comics[0]) {
    const id = `${c.Title}||${c.Issue}||${c.Box}`;
    if (currentList.some(e => e.id === id)) return;
    const entry: PullEntry = {
      id,
      title:     c.Title,
      issue:     c.Issue,
      box:       c.Box,
      publisher: c.Publisher,
      nmVal:     c.Value_NM && c.Value_NM !== "nan" ? c.Value_NM : "",
      startBid:  c.Start_Bid && c.Start_Bid !== "nan" ? c.Start_Bid : "",
      isKey:     (c.Key || "").toUpperCase() === "YES",
      isSigned:  (c.Signed || "").toUpperCase() === "YES",
      keyReason: c.Key_Reason || "",
      signedBy:  c.Signed_By || "",
      status:    "to_pull",
      addedAt:   new Date().toISOString(),
    };
    setPullData(prev => ({ ...prev, [showNum]: [...(prev[showNum] || []), entry] }));
  }

  function updateStatus(id: string, status: PullStatus) {
    setPullData(prev => ({
      ...prev,
      [showNum]: (prev[showNum] || []).map(e => e.id === id ? { ...e, status } : e),
    }));
  }

  function remove(id: string) {
    setPullData(prev => ({
      ...prev,
      [showNum]: (prev[showNum] || []).filter(e => e.id !== id),
    }));
  }

  // Filter + sort the pull list
  const displayList = useMemo(() => {
    let list = currentList;
    if (filterSt !== "all") list = list.filter(e => e.status === filterSt);
    if (listQuery.trim()) {
      const q = listQuery.toLowerCase();
      list = list.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.publisher.toLowerCase().includes(q) ||
        e.box.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sortBy === "status")  return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      if (sortBy === "title")   return a.title.localeCompare(b.title);
      if (sortBy === "box")     return Number(a.box) - Number(b.box);
      if (sortBy === "value")   return parseVal(b.nmVal) - parseVal(a.nmVal);
      if (sortBy === "added")   return b.addedAt.localeCompare(a.addedAt);
      return 0;
    });
  }, [currentList, filterSt, listQuery, sortBy]);

  // Export as text
  function exportList() {
    const lines = [
      `WHATNOT SHOW ${showNum} — PULL LIST`,
      `${show.title}`,
      `Target: ${show.target}`,
      `${currentList.length} books`,
      "",
      ...STATUS_ORDER.flatMap(st => {
        const items = currentList.filter(e => e.status === st);
        if (!items.length) return [];
        return [
          `── ${STATUS_META[st].label} (${items.length}) ──`,
          ...items.map(e => `  ${e.title} #${e.issue} · Box ${e.box}${e.nmVal ? ` · NM $${e.nmVal}` : ""}${e.isKey ? " ★ KEY" : ""}${e.isSigned ? " ✍ SGD" : ""}`),
          "",
        ];
      }),
    ].join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `show_${showNum}_pull_list.txt`;
    a.click();
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 16px 80px" }}>

      {/* Show selector */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.65rem",
          letterSpacing: "2.5px", color: "var(--muted)", marginBottom: 8,
        }}>SELECT SHOW</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {SHOWS.map(s => {
            const cnt = (pullData[s.num] || []).length;
            const isActive = s.num === showNum;
            return (
              <button key={s.num} onClick={() => setShowNum(s.num)} style={{
                background: isActive ? "var(--red)" : "var(--surface)",
                color: isActive ? "#fff" : "var(--muted2)",
                border: isActive ? "1.5px solid var(--red)" : "1.5px solid var(--border)",
                borderRadius: 5, padding: "5px 12px", cursor: "pointer",
                fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.75rem",
                letterSpacing: "1px", transition: "all 0.12s", position: "relative",
              }}>
                Show {s.num}
                {cnt > 0 && (
                  <span style={{
                    marginLeft: 5, background: isActive ? "rgba(255,255,255,0.25)" : "var(--red)",
                    color: "#fff", borderRadius: 10, padding: "0 5px", fontSize: "0.6rem",
                  }}>{cnt}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Show header */}
      <div style={{
        background: "var(--surface)", border: "1.5px solid var(--border)",
        borderLeft: "4px solid var(--red)", borderRadius: 8,
        padding: "12px 16px", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.65rem",
            letterSpacing: "2px", color: "var(--red)", marginBottom: 2,
          }}>SHOW {showNum}</div>
          <div style={{ fontWeight: 600, color: "var(--brown-light)", fontSize: "0.92rem", lineHeight: 1.3 }}>
            {show.title}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.2rem",
            color: "var(--red)", letterSpacing: "1px", lineHeight: 1,
          }}>{show.target}</div>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.55rem",
            letterSpacing: "2px", color: "var(--muted)", marginTop: 1,
          }}>REVENUE TARGET</div>
        </div>
      </div>

      {/* Status summary bar */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {STATUS_ORDER.map(st => {
          const m = STATUS_META[st];
          return (
            <div key={st} style={{
              background: m.bg, border: `1.5px solid ${m.color}30`,
              borderRadius: 6, padding: "6px 12px", textAlign: "center", minWidth: 80,
            }}>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.1rem",
                color: m.color, lineHeight: 1,
              }}>{counts[st]}</div>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.52rem",
                letterSpacing: "1.5px", color: m.color, opacity: 0.8, marginTop: 1,
              }}>{m.label}</div>
            </div>
          );
        })}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={exportList} style={{
            background: "var(--surface)", border: "1.5px solid var(--border)",
            borderRadius: 5, padding: "6px 14px", cursor: "pointer",
            fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.68rem",
            letterSpacing: "1.5px", color: "var(--muted2)", transition: "all 0.12s",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--red)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--red)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--muted2)"; }}
          >EXPORT TXT ↓</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 18, alignItems: "start" }}>

        {/* ── LEFT: Pull list ── */}
        <div>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.75rem",
            letterSpacing: "2.5px", color: "var(--red)", marginBottom: 10,
          }}>PULL LIST — {currentList.length} BOOKS</div>

          {/* Controls */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            <input
              placeholder="Search pull list…"
              value={listQuery}
              onChange={e => setListQuery(e.target.value)}
              style={{
                flex: 1, minWidth: 160, padding: "7px 12px", border: "1.5px solid var(--border)",
                borderRadius: 5, fontSize: "0.82rem", fontFamily: "'Crimson Pro', serif",
                outline: "none", background: "#fff",
              }}
            />
            <select value={filterSt} onChange={e => setFilterSt(e.target.value as PullStatus | "all")} style={{
              padding: "7px 10px", border: "1.5px solid var(--border)", borderRadius: 5,
              fontSize: "0.75rem", fontFamily: "'Bebas Neue', sans-serif",
              letterSpacing: "1px", background: "#fff", cursor: "pointer",
            }}>
              <option value="all">ALL STATUSES</option>
              {STATUS_ORDER.map(st => (
                <option key={st} value={st}>{STATUS_META[st].label}</option>
              ))}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} style={{
              padding: "7px 10px", border: "1.5px solid var(--border)", borderRadius: 5,
              fontSize: "0.75rem", fontFamily: "'Bebas Neue', sans-serif",
              letterSpacing: "1px", background: "#fff", cursor: "pointer",
            }}>
              <option value="status">SORT: STATUS</option>
              <option value="title">SORT: TITLE</option>
              <option value="box">SORT: BOX</option>
              <option value="value">SORT: VALUE ↓</option>
              <option value="added">SORT: NEWEST</option>
            </select>
            <div style={{ display: "flex", gap: 4 }}>
              {(["list","card"] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  background: view === v ? "var(--red)" : "var(--surface)",
                  color: view === v ? "#fff" : "var(--muted2)",
                  border: view === v ? "1.5px solid var(--red)" : "1.5px solid var(--border)",
                  borderRadius: 5, padding: "6px 12px", cursor: "pointer",
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.68rem",
                  letterSpacing: "1px",
                }}>{v === "list" ? "≡ LIST" : "⊞ CARD"}</button>
              ))}
            </div>
          </div>

          {displayList.length === 0 ? (
            <div style={{
              background: "var(--surface)", border: "1.5px dashed var(--border)",
              borderRadius: 8, padding: "40px 20px", textAlign: "center",
              color: "var(--muted)", fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "0.9rem", letterSpacing: "2px",
            }}>
              {currentList.length === 0
                ? "SEARCH FOR BOOKS ON THE RIGHT TO BUILD YOUR PULL LIST"
                : "NO BOOKS MATCH THIS FILTER"}
            </div>
          ) : view === "list" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {displayList.map(e => (
                <PullRow key={e.id} entry={e} onStatus={updateStatus} onRemove={remove} />
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 }}>
              {displayList.map(e => (
                <PullCard key={e.id} entry={e} onStatus={updateStatus} onRemove={remove} />
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Add books ── */}
        <div style={{ position: "sticky", top: 150 }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.75rem",
            letterSpacing: "2.5px", color: "var(--red)", marginBottom: 10,
          }}>ADD BOOKS</div>

          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input
              placeholder="Search by title, writer, arc…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doSearch()}
              style={{
                flex: 1, padding: "8px 12px", border: "1.5px solid var(--border)",
                borderRadius: 5, fontSize: "0.82rem", fontFamily: "'Crimson Pro', serif",
                outline: "none", background: "#fff",
              }}
            />
            <button onClick={doSearch} style={{
              background: "var(--red)", color: "#fff", border: "none",
              borderRadius: 5, padding: "8px 14px", cursor: "pointer",
              fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.75rem",
              letterSpacing: "1px",
            }}>GO</button>
          </div>

          {searchRes.length > 0 && (
            <div style={{
              background: "#fff", border: "1.5px solid var(--border)",
              borderRadius: 8, overflow: "hidden",
              maxHeight: "calc(100vh - 340px)", overflowY: "auto",
            }}>
              <div style={{
                padding: "8px 12px", background: "var(--surface2)",
                borderBottom: "1px solid var(--border)",
                fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.62rem",
                letterSpacing: "2px", color: "var(--muted)",
              }}>
                {searchRes.length} RESULTS — CLICK TO ADD
              </div>
              {searchRes.map((c, i) => {
                const alreadyAdded = currentList.some(e => e.id === `${c.Title}||${c.Issue}||${c.Box}`);
                const isKey    = (c.Key    || "").toUpperCase() === "YES";
                const isSigned = (c.Signed || "").toUpperCase() === "YES";
                return (
                  <div key={i}
                    onClick={() => !alreadyAdded && addToList(c)}
                    style={{
                      padding: "8px 12px",
                      borderBottom: "1px solid var(--border)",
                      cursor: alreadyAdded ? "default" : "pointer",
                      opacity: alreadyAdded ? 0.45 : 1,
                      background: alreadyAdded ? "var(--surface2)" : "#fff",
                      transition: "background 0.1s",
                      display: "flex", gap: 8, alignItems: "flex-start",
                    }}
                    onMouseEnter={e => { if (!alreadyAdded) (e.currentTarget as HTMLDivElement).style.background = "#fef2f2"; }}
                    onMouseLeave={e => { if (!alreadyAdded) (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: "0.82rem", fontWeight: 600, color: "var(--brown-light)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>{c.Title}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--muted2)" }}>
                        #{c.Issue} · {c.Publisher} · Box {c.Box}
                      </div>
                      <div style={{ display: "flex", gap: 4, marginTop: 2, flexWrap: "wrap" }}>
                        {isKey    && <span className="badge bkey" style={{ fontSize:"0.55rem" }}>KEY</span>}
                        {isSigned && <span className="badge bs"   style={{ fontSize:"0.55rem" }}>SGD</span>}
                        {c.Value_NM && c.Value_NM !== "nan" && (
                          <span style={{ fontSize:"0.68rem", color:"var(--green-text)", fontWeight:600 }}>${c.Value_NM}</span>
                        )}
                        {c.Platform && (
                          <span className={`badge ${platClass(c.Platform)}`} style={{ fontSize:"0.55rem" }}>{c.Platform}</span>
                        )}
                      </div>
                    </div>
                    <div style={{
                      flexShrink: 0,
                      fontFamily: "'Bebas Neue', sans-serif",
                      fontSize: "0.65rem", letterSpacing: "1px",
                      color: alreadyAdded ? "var(--muted)" : "var(--red)",
                      paddingTop: 2,
                    }}>{alreadyAdded ? "ADDED" : "+ ADD"}</div>
                  </div>
                );
              })}
            </div>
          )}

          {searchRes.length === 0 && query.trim() === "" && (
            <div style={{
              background: "var(--surface)", border: "1.5px dashed var(--border)",
              borderRadius: 8, padding: "24px 16px", textAlign: "center",
              color: "var(--muted)", fontSize: "0.75rem",
              fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "1px",
            }}>
              SEARCH THE COLLECTION<br />
              <span style={{ fontSize: "0.65rem", letterSpacing: "0" }}>press Enter or GO</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function StatusPill({ status, onChange }: { status: PullStatus; onChange: (s: PullStatus) => void }) {
  const [open, setOpen] = useState(false);
  const m = STATUS_META[status];
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        background: m.bg, border: `1.5px solid ${m.color}`,
        borderRadius: 4, padding: "3px 9px", cursor: "pointer",
        fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.62rem",
        letterSpacing: "1px", color: m.color, whiteSpace: "nowrap",
      }}>{m.label} ▾</button>
      {open && (
        <div style={{
          position: "absolute", top: "110%", left: 0, zIndex: 200,
          background: "#fff", border: "1.5px solid var(--border)",
          borderRadius: 6, boxShadow: "0 4px 18px rgba(0,0,0,0.12)",
          overflow: "hidden", minWidth: 120,
        }}>
          {STATUS_ORDER.map(st => {
            const sm = STATUS_META[st];
            return (
              <div key={st} onClick={() => { onChange(st); setOpen(false); }} style={{
                padding: "7px 12px", cursor: "pointer",
                background: st === status ? sm.bg : "#fff",
                fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.65rem",
                letterSpacing: "1px", color: sm.color,
                borderBottom: "1px solid var(--border)",
                transition: "background 0.1s",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = sm.bg; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = st === status ? sm.bg : "#fff"; }}
              >{sm.label}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PullRow({ entry, onStatus, onRemove }: {
  entry: PullEntry;
  onStatus: (id: string, s: PullStatus) => void;
  onRemove: (id: string) => void;
}) {
  const comicLike: ComicLike = { Title: entry.title, Issue: entry.issue, Publisher: entry.publisher, Key: entry.isKey ? "YES" : "NO", Signed: entry.isSigned ? "YES" : "NO" };
  const svgUrl = getCoverSvgUrl(comicLike, { width: 36, height: 54 });
  return (
    <div style={{
      background: "#fff", border: "1.5px solid var(--border)",
      borderLeft: `3px solid ${STATUS_META[entry.status].color}`,
      borderRadius: 6, padding: "8px 12px",
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
    }}>
      <img src={svgUrl} alt={`${entry.title} #${entry.issue}`} width={36} height={54}
        style={{ borderRadius: 3, flexShrink: 0, display: "block" }} />
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{
          fontSize: "0.88rem", fontWeight: 600, color: "var(--brown-light)", lineHeight: 1.3,
          display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap",
        }}>
          {entry.title}
          {entry.isKey    && <span className="badge bkey" style={{ fontSize:"0.55rem" }}>KEY</span>}
          {entry.isSigned && <span className="badge bs"   style={{ fontSize:"0.55rem" }}>SGD</span>}
        </div>
        <div style={{ fontSize: "0.72rem", color: "var(--muted2)", marginTop: 1 }}>
          #{entry.issue} · {entry.publisher} · Box {entry.box}
          {entry.nmVal && <span style={{ color:"var(--green-text)", fontWeight:600, marginLeft:6 }}>${entry.nmVal} NM</span>}
          {entry.startBid && <span style={{ color:"var(--muted)", marginLeft:6 }}>Bid ${entry.startBid}</span>}
        </div>
        {entry.keyReason && (
          <div style={{ fontSize: "0.7rem", color: "var(--gold)", marginTop: 2, lineHeight: 1.3 }}>
            {entry.keyReason.substring(0, 80)}{entry.keyReason.length > 80 ? "…" : ""}
          </div>
        )}
      </div>
      <StatusPill status={entry.status} onChange={s => onStatus(entry.id, s)} />
      <button onClick={() => onRemove(entry.id)} style={{
        background: "none", border: "none", cursor: "pointer",
        color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1,
        padding: "2px 4px", opacity: 0.5, transition: "opacity 0.12s",
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.5"; }}
        title="Remove from list"
      >✕</button>
    </div>
  );
}

function PullCard({ entry, onStatus, onRemove }: {
  entry: PullEntry;
  onStatus: (id: string, s: PullStatus) => void;
  onRemove: (id: string) => void;
}) {
  const m = STATUS_META[entry.status];
  const comicLike: ComicLike = { Title: entry.title, Issue: entry.issue, Publisher: entry.publisher, Key: entry.isKey ? "YES" : "NO", Signed: entry.isSigned ? "YES" : "NO" };
  const svgUrl = getCoverSvgUrl(comicLike, { width: 80, height: 120 });
  return (
    <div style={{
      background: "#fff", border: "1.5px solid var(--border)",
      borderTop: `3px solid ${m.color}`,
      borderRadius: 8, overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      {/* Cover + remove row */}
      <div style={{ display: "flex", gap: 10, padding: "10px 12px 6px" }}>
        <img src={svgUrl} alt={`${entry.title} #${entry.issue}`} width={52} height={78}
          style={{ borderRadius: 4, flexShrink: 0, display: "block" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 3 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--brown-light)", lineHeight: 1.25 }}>
                {entry.title}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--muted2)", marginTop: 2 }}>
                #{entry.issue} · Box {entry.box}
              </div>
            </div>
            <button onClick={() => onRemove(entry.id)} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1, padding: 0, opacity: 0.5, marginLeft: 6,
            }}>✕</button>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
              {entry.isKey    && <span className="badge bkey" style={{ fontSize:"0.55rem" }}>KEY</span>}
              {entry.isSigned && <span className="badge bs"   style={{ fontSize:"0.55rem" }}>SGD</span>}
              {entry.nmVal && (
                <span style={{ fontSize:"0.7rem", color:"var(--green-text)", fontWeight:600 }}>${entry.nmVal}</span>
              )}
            </div>
          </div>
        </div>
      </div>
      {entry.keyReason && (
        <div style={{ fontSize: "0.7rem", color: "var(--gold)", lineHeight: 1.4, padding: "0 12px 6px" }}>
          {entry.keyReason.substring(0, 90)}{entry.keyReason.length > 90 ? "…" : ""}
        </div>
      )}
      <div style={{ padding: "0 12px 10px" }}>
        <StatusPill status={entry.status} onChange={s => onStatus(entry.id, s)} />
      </div>
    </div>
  );
}
