import { useState, useMemo, useCallback, useEffect } from "react";
import { DATA, type CatalogComic } from "@/data/data";
import { CoverImage, clearCoverMemCache } from "@/components/CoverImage";

const PAGE_SIZE = 16;
const FLAG_KEY  = "brbFlaggedCovers_v1";

// ── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { key: "pulled",  label: "Pulled Covers Catalog",  short: "Pulled Covers" },
  { key: "box2",    label: "Cover Box 2 Catalog",     short: "Cover Box 2"  },
  { key: "box3",    label: "Cover Box 3 Catalog",     short: "Cover Box 3"  },
  { key: "ccBoxes", label: "CC Boxes — Cool Covers",  short: "CC Boxes"     },
] as const;

type TabKey = typeof TABS[number]["key"];

// ── Flag storage helpers ─────────────────────────────────────────────────────

export interface FlaggedCover {
  id: string;
  Title: string;
  Issue: string;
  Box: string;
  Cover_Artist: string;
  Publisher: string;
  Year: string;
  flaggedAt: string;
}

function comicId(c: { Title: string; Issue: string; Box: string }) {
  return `${c.Title}|||${c.Issue}|||${c.Box}`;
}

function loadFlags(): Map<string, FlaggedCover> {
  try {
    const raw = localStorage.getItem(FLAG_KEY);
    if (!raw) return new Map();
    const arr: FlaggedCover[] = JSON.parse(raw);
    return new Map(arr.map(f => [f.id, f]));
  } catch { return new Map(); }
}

function saveFlags(map: Map<string, FlaggedCover>) {
  localStorage.setItem(FLAG_KEY, JSON.stringify([...map.values()]));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseNM(v: string) {
  const m = (v || "").match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function pubColor(pub: string) {
  const u = pub.toUpperCase();
  if (u.includes("MARVEL"))     return "#c8102e";
  if (u.includes("DC"))         return "#0476d0";
  if (u.includes("IMAGE"))      return "#e06c00";
  if (u.includes("IDW"))        return "#7c3aed";
  if (u.includes("DARK HORSE")) return "#374151";
  return "#5a6270";
}

// ── Card ─────────────────────────────────────────────────────────────────────

function CoverCard({
  comic, flip, flagged, onToggleFlag,
}: {
  comic: CatalogComic;
  flip: boolean;
  flagged: boolean;
  onToggleFlag: () => void;
}) {
  const nm       = parseNM(comic.Value_NM);
  const bid      = parseNM(comic.Start_Bid);
  const isSigned = (comic.Signed || "").toUpperCase() === "YES";
  const isKey    = (comic.Key    || "").toUpperCase() === "YES";
  const color    = pubColor(comic.Publisher);
  const hasFlag  = !!(comic.Flag && comic.Flag.trim());

  // Notes text: prefer CoverNotes, fall back to Notes
  const notesText = (comic.CoverNotes || comic.Notes || "").trim();
  const isVariant = (comic.Issue || "").toLowerCase().includes("variant") ||
    notesText.toLowerCase().includes("variant");

  const imgCol = (
    <div style={{ position: "relative", minHeight: 300, background: "#1a1628", flexShrink: 0, width: "42%" }}>
      <CoverImage
        comic={comic}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      {bid >= 1 && (
        <div style={{
          position: "absolute", top: 12, left: flip ? "auto" : 12, right: flip ? 12 : "auto",
          background: "var(--red)", color: "#fff",
          fontFamily: "'Bebas Neue', sans-serif", fontSize: "1rem", letterSpacing: "1px",
          padding: "3px 12px",
          clipPath: "polygon(7px 0%,calc(100% - 7px) 0%,100% 50%,calc(100% - 7px) 100%,7px 100%,0% 50%)",
          zIndex: 3,
        }}>
          ${bid} START
        </div>
      )}
      {/* Flag button (incorrect cover art) */}
      <button
        onClick={e => { e.stopPropagation(); onToggleFlag(); }}
        title={flagged ? "Remove incorrect cover flag" : "Flag as incorrect cover"}
        style={{
          position: "absolute", bottom: 44, right: 8, zIndex: 4,
          background: flagged ? "#c8102e" : "rgba(255,255,255,0.85)",
          border: flagged ? "2px solid #8b0000" : "2px solid #ccc",
          borderRadius: "50%", width: 32, height: 32,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.95rem", lineHeight: 1,
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          transition: "all 0.15s",
        }}
      >
        {flagged ? "🚩" : "🏳"}
      </button>
      {comic.Cover_Artist && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 3,
          background: "rgba(0,0,0,0.82)", color: "rgba(255,255,255,0.85)",
          fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.62rem", letterSpacing: "2px",
          padding: "5px 10px", textAlign: "center",
        }}>
          ART: {comic.Cover_Artist}
        </div>
      )}
    </div>
  );

  const txtCol = (
    <div style={{ flex: 1, padding: "22px 24px", display: "flex", flexDirection: "column", gap: 10, background: flagged ? "#fff5f5" : "var(--surface)", transition: "background 0.2s" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.62rem", letterSpacing: "1.5px", background: color, color: "#fff", borderRadius: 3, padding: "2px 8px" }}>
          {comic.Publisher || "Unknown"}
        </span>
        {isKey && (
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.62rem", letterSpacing: "1.5px", background: "#fff8e0", color: "#7a5500", border: "1px solid #f0d060", borderRadius: 3, padding: "2px 8px" }}>★ KEY</span>
        )}
        {isVariant && (
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.62rem", letterSpacing: "1.5px", background: "#7c3aed", color: "#fff", borderRadius: 3, padding: "2px 8px" }}>VARIANT</span>
        )}
        {isSigned && (
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.62rem", letterSpacing: "1.5px", background: "#166534", color: "#fff", borderRadius: 3, padding: "2px 8px" }}>✍ SIGNED</span>
        )}
        {hasFlag && (
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.62rem", letterSpacing: "1.5px", background: "#f59e0b", color: "#1a1a1a", borderRadius: 3, padding: "2px 8px" }}>⭐ FLAGGED</span>
        )}
        {flagged && (
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.62rem", letterSpacing: "1.5px", background: "#c8102e", color: "#fff", borderRadius: 3, padding: "2px 8px" }}>🚩 INCORRECT COVER</span>
        )}
      </div>

      <div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(18px, 2.2vw, 24px)", letterSpacing: "2px", color: "var(--text)", lineHeight: 1.1 }}>
          {comic.Title}
        </div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.82rem", letterSpacing: "2px", color: "var(--red)", marginTop: 2 }}>
          {comic.Issue}{comic.Year && comic.Year !== "nan" ? ` · ${comic.Year}` : ""}
        </div>
      </div>

      {comic.Cover_Artist && (
        <div style={{ borderLeft: "3px solid var(--red)", paddingLeft: 10 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.58rem", letterSpacing: "2px", color: "var(--muted)", marginBottom: 2 }}>COVER ARTIST</div>
          <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1rem", color: "var(--text2)", fontWeight: 600 }}>{comic.Cover_Artist}</div>
        </div>
      )}

      {isKey && comic.Key_Reason && comic.Key_Reason !== "nan" && (
        <div style={{ background: "#fff8e0", border: "1px solid #f0d060", borderRadius: 5, padding: "7px 10px" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.58rem", letterSpacing: "2px", color: "#7a5500", marginBottom: 2 }}>KEY REASON</div>
          <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: "0.85rem", color: "#5a3800", lineHeight: 1.4 }}>{comic.Key_Reason.substring(0, 120)}</div>
        </div>
      )}

      {/* Sort pile tag (Cover Box 2 / 3) */}
      {comic.SortPile && comic.SortPile.trim() && (
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.6rem", letterSpacing: "1.5px", color: "var(--muted2)", background: "var(--surface2)", borderRadius: 4, padding: "3px 8px", alignSelf: "flex-start" }}>
          {comic.SortPile}
        </div>
      )}

      {/* Cover notes / general notes */}
      {notesText && notesText !== "nan" && (
        <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: "0.85rem", color: "var(--muted2)", lineHeight: 1.5, fontStyle: "italic" }}>
          "{notesText.substring(0, 160)}"
        </div>
      )}

      {comic.Writer && comic.Writer !== "nan" && (
        <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
          W: {comic.Writer}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: "auto", paddingTop: 8, borderTop: "1px solid var(--border)", alignItems: "center", flexWrap: "wrap" }}>
        {nm > 0 && (
          <div>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.58rem", letterSpacing: "1.5px", color: "var(--muted)" }}>NM </span>
            <strong style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.95rem", color: "var(--red)" }}>${comic.Value_NM}</strong>
          </div>
        )}
        {bid > 0 && (
          <div style={{ background: "rgba(200,16,46,0.07)", border: "1px solid rgba(200,16,46,0.2)", borderRadius: 4, padding: "3px 10px" }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.58rem", letterSpacing: "1.5px", color: "var(--muted)" }}>WHATNOT START </span>
            <strong style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.9rem", color: "var(--red)" }}>${comic.Start_Bid}</strong>
          </div>
        )}
        {comic.Box && (
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.58rem", letterSpacing: "1.5px", color: "var(--muted)", marginLeft: "auto" }}>BOX {comic.Box}</span>
        )}
      </div>
    </div>
  );

  return (
    <article
      style={{
        display: "flex", flexDirection: "row",
        border: flagged ? "2px solid #c8102e" : "1.5px solid var(--border)",
        borderRadius: 10, overflow: "hidden",
        marginBottom: 16, minHeight: 300,
        boxShadow: flagged ? "0 0 0 3px rgba(200,16,46,0.15)" : "0 3px 16px rgba(0,0,0,0.07)",
        transition: "box-shadow 0.2s, transform 0.2s, border-color 0.2s",
      }}
      onMouseEnter={e => { if (!flagged) { (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.12)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = flagged ? "0 0 0 3px rgba(200,16,46,0.15)" : "0 3px 16px rgba(0,0,0,0.07)"; (e.currentTarget as HTMLElement).style.transform = "none"; }}
    >
      {flip ? <>{txtCol}{imgCol}</> : <>{imgCol}{txtCol}</>}
    </article>
  );
}

// ── Flagged export modal ──────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type RefetchState = "idle" | "running" | "done";

interface Candidate {
  id: number;
  name: string;
  issue_number: string;
  volume: string;
  image_url: string | null;
  large_url: string | null;
  cover_date: string;
}

function FlaggedModal({ flags, onClose, onClear }: { flags: FlaggedCover[]; onClose: () => void; onClear: (id: string) => void }) {
  const [refetchState, setRefetchState]       = useState<RefetchState>("idle");
  const [refetchProgress, setRefetchProgress] = useState(0);
  const [refetchResults, setRefetchResults]   = useState<{ found: number; notFound: number } | null>(null);
  const [candidates, setCandidates]           = useState<Map<string, Candidate[]>>(new Map());
  const [picking, setPicking]                 = useState<string | null>(null);

  async function refetchAllCovers() {
    if (!flags.length) return;
    setRefetchState("running");
    setRefetchProgress(0);
    setRefetchResults(null);
    setCandidates(new Map());
    let found = 0, notFound = 0;
    const newCandidates = new Map<string, Candidate[]>();
    for (let i = 0; i < flags.length; i++) {
      const f = flags[i];
      clearCoverMemCache(f.Title, f.Issue);
      try {
        const params = new URLSearchParams({ title: f.Title, issue: f.Issue, publisher: f.Publisher, year: f.Year, refresh: "1" });
        const res = await fetch(`${BASE}/api/covers/search?${params}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json() as { cover_url?: string | null; candidates?: Candidate[] };
          if (data.cover_url) found++; else notFound++;
          if (data.candidates?.length) newCandidates.set(f.id, data.candidates.filter(c => c.image_url));
        } else { notFound++; }
      } catch { notFound++; }
      setRefetchProgress(i + 1);
    }
    setCandidates(new Map(newCandidates));
    setRefetchResults({ found, notFound });
    setRefetchState("done");
  }

  async function pickCover(flag: FlaggedCover, candidate: Candidate) {
    setPicking(flag.id);
    try {
      clearCoverMemCache(flag.Title, flag.Issue);
      await fetch(`${BASE}/api/covers/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: flag.Title, issue: flag.Issue, url: candidate.image_url, large: candidate.large_url }),
        cache: "no-store",
      });
      onClear(flag.id);
    } catch { /* non-fatal */ }
    setPicking(null);
  }

  const csv = [
    "Title,Issue,Box,Cover Artist,Publisher,Year,Flagged At",
    ...flags.map(f => `"${f.Title}","${f.Issue}","${f.Box}","${f.Cover_Artist}","${f.Publisher}","${f.Year}","${f.flaggedAt}"`),
  ].join("\n");

  function downloadCSV() {
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: "incorrect-covers.csv" });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--surface)", borderRadius: 12, maxWidth: 640, width: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.3)", border: "1.5px solid var(--border)" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1.5px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.62rem", letterSpacing: "3px", color: "var(--red)", marginBottom: 2 }}>COVER AUDIT</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.5rem", letterSpacing: "2px", color: "var(--text)" }}>🚩 INCORRECT COVERS ({flags.length})</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "var(--muted)" }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px" }}>
          {flags.length === 0 ? (
            <p style={{ fontFamily: "'Crimson Pro', serif", color: "var(--muted)", textAlign: "center", padding: "32px 0" }}>No covers flagged yet.</p>
          ) : (
            flags.map(f => {
              const cands = candidates.get(f.id) ?? [];
              const isPicking = picking === f.id;
              return (
                <div key={f.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1rem", letterSpacing: "1.5px", color: "var(--text)" }}>{f.Title} #{f.Issue}</div>
                      <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: "0.82rem", color: "var(--muted)" }}>
                        {f.Cover_Artist} · {f.Publisher} · Box {f.Box} · {f.Year}
                      </div>
                    </div>
                    <button onClick={() => onClear(f.id)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.6rem", letterSpacing: "1px", color: "var(--muted)", flexShrink: 0 }}>REMOVE</button>
                  </div>
                  {cands.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.58rem", letterSpacing: "2px", color: "#1d4ed8", marginBottom: 6 }}>PICK THE CORRECT COVER — CLICK TO CONFIRM AND UNFLAG</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {cands.map((c, ci) => (
                          <button key={c.id} onClick={() => pickCover(f, c)} disabled={isPicking}
                            title={`${c.volume} #${c.issue_number}${c.cover_date ? " · " + c.cover_date : ""}`}
                            style={{ padding: 0, border: ci === 0 ? "2px solid #1d4ed8" : "2px solid var(--border)", borderRadius: 5, cursor: isPicking ? "default" : "pointer", overflow: "hidden", background: "#111", opacity: isPicking ? 0.6 : 1, position: "relative", flexShrink: 0 }}>
                            <img src={c.image_url ?? ""} alt={`${c.volume} #${c.issue_number}`}
                              style={{ display: "block", width: 60, height: 90, objectFit: "cover" }}
                              onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} />
                            {ci === 0 && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#1d4ed8", fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.5rem", letterSpacing: "1px", color: "#fff", textAlign: "center", padding: "2px 0" }}>BEST</div>}
                          </button>
                        ))}
                        <button onClick={() => onClear(f.id)} title="None correct — unflag anyway"
                          style={{ width: 60, height: 90, border: "2px dashed var(--border)", borderRadius: 5, cursor: "pointer", background: "var(--surface2)", color: "var(--muted)", fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.52rem", letterSpacing: "1px", flexShrink: 0 }}>
                          NONE<br/>RIGHT
                        </button>
                      </div>
                    </div>
                  )}
                  {refetchState === "done" && cands.length === 0 && (
                    <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: 6, fontStyle: "italic" }}>Comic Vine returned no cover images for this issue.</div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {flags.length > 0 && (
          <div style={{ padding: "16px 24px", borderTop: "1.5px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button onClick={refetchAllCovers} disabled={refetchState === "running"} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.7rem", letterSpacing: "1.5px", padding: "8px 18px", borderRadius: 5, border: "none", cursor: refetchState === "running" ? "default" : "pointer", background: refetchState === "running" ? "#999" : "#1d4ed8", color: "#fff", opacity: refetchState === "running" ? 0.7 : 1 }}>
                {refetchState === "running" ? `FETCHING ${refetchProgress}/${flags.length}…` : refetchState === "done" ? "↻ RE-FETCH AGAIN" : "↻ RE-FETCH FROM COMIC VINE"}
              </button>
              {refetchState === "running" && (
                <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden", minWidth: 80 }}>
                  <div style={{ height: "100%", background: "#1d4ed8", borderRadius: 3, width: `${Math.round((refetchProgress / flags.length) * 100)}%`, transition: "width 0.2s" }} />
                </div>
              )}
              {refetchState === "done" && refetchResults && (
                <span style={{ fontFamily: "'Crimson Pro', serif", fontSize: "0.82rem", color: "var(--muted)" }}>{refetchResults.found} new covers found · {refetchResults.notFound} still missing</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={downloadCSV} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.7rem", letterSpacing: "1.5px", padding: "8px 18px", background: "var(--red)", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer" }}>↓ DOWNLOAD CSV</button>
              <button onClick={() => navigator.clipboard.writeText(csv).catch(() => {})} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.7rem", letterSpacing: "1.5px", padding: "8px 18px", background: "var(--surface2)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: 5, cursor: "pointer" }}>COPY TO CLIPBOARD</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

const PUB_PILLS = ["All", "Marvel", "DC", "Image", "IDW", "Dark Horse", "Other"];

export default function CoverCatalog() {
  const [activeTab,    setActiveTab]    = useState<TabKey>("pulled");
  const [pub,          setPub]          = useState("All");
  const [artistQ,      setArtistQ]      = useState("");
  const [titleQ,       setTitleQ]       = useState("");
  const [keyOnly,      setKeyOnly]      = useState(false);
  const [signedOnly,   setSignedOnly]   = useState(false);
  const [flaggedOnly,  setFlaggedOnly]  = useState(false);
  const [sort,         setSort]         = useState("title");
  const [page,         setPage]         = useState(1);
  const [showModal,    setShowModal]    = useState(false);

  const [flags, setFlags] = useState<Map<string, FlaggedCover>>(() => loadFlags());
  useEffect(() => { saveFlags(flags); }, [flags]);

  // Switch tabs and reset filters/page
  function switchTab(key: TabKey) {
    setActiveTab(key);
    setPage(1);
    setPub("All");
    setArtistQ("");
    setTitleQ("");
    setKeyOnly(false);
    setSignedOnly(false);
    setFlaggedOnly(false);
  }

  const toggleFlag = useCallback((comic: CatalogComic) => {
    const id = comicId(comic);
    setFlags(prev => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.set(id, {
          id,
          Title:        comic.Title,
          Issue:        comic.Issue,
          Box:          comic.Box,
          Cover_Artist: comic.Cover_Artist,
          Publisher:    comic.Publisher,
          Year:         comic.Year,
          flaggedAt:    new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        });
      }
      return next;
    });
  }, []);

  const clearFlag = useCallback((id: string) => {
    setFlags(prev => { const next = new Map(prev); next.delete(id); return next; });
  }, []);

  // Comics for the active tab
  const tabComics = useMemo(() => DATA.catalogs[activeTab], [activeTab]);

  // Tab-level stats (computed from raw tab comics, not filtered)
  const tabStats = useMemo(() => ({
    total:   tabComics.length,
    keys:    tabComics.filter(c => (c.Key || "").toUpperCase() === "YES").length,
    signed:  tabComics.filter(c => (c.Signed || "").toUpperCase() === "YES").length,
    artists: new Set(tabComics.map(c => c.Cover_Artist).filter(a => a && a !== "nan")).size,
  }), [tabComics]);

  const filtered = useMemo(() => {
    let r = tabComics as CatalogComic[];
    if (keyOnly)     r = r.filter(c => (c.Key    || "").toUpperCase() === "YES");
    if (signedOnly)  r = r.filter(c => (c.Signed || "").toUpperCase() === "YES");
    if (flaggedOnly) r = r.filter(c => flags.has(comicId(c)));
    if (pub !== "All") {
      if (pub === "Other") r = r.filter(c => !["MARVEL","DC","IMAGE","IDW","DARK HORSE"].some(p => c.Publisher.toUpperCase().includes(p)));
      else r = r.filter(c => c.Publisher.toUpperCase().includes(pub.toUpperCase()));
    }
    if (artistQ.trim()) {
      const q = artistQ.toLowerCase();
      r = r.filter(c => c.Cover_Artist.toLowerCase().includes(q));
    }
    if (titleQ.trim()) {
      const q = titleQ.toLowerCase();
      r = r.filter(c => c.Title.toLowerCase().includes(q) || c.Issue.toLowerCase().includes(q));
    }
    const sorted = [...r];
    if (sort === "artist") sorted.sort((a, b) => (a.Cover_Artist || "zzz").localeCompare(b.Cover_Artist || "zzz") || a.Title.localeCompare(b.Title));
    else if (sort === "value") sorted.sort((a, b) => parseNM(b.Value_NM) - parseNM(a.Value_NM));
    else if (sort === "title") sorted.sort((a, b) => a.Title.localeCompare(b.Title));
    return sorted;
  }, [tabComics, pub, artistQ, titleQ, keyOnly, signedOnly, flaggedOnly, sort, flags]);

  const total  = filtered.length;
  const pages  = Math.ceil(total / PAGE_SIZE);
  const slice  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const flagCount = flags.size;

  function pill(label: string, active: boolean, onClick: () => void, color?: string) {
    return (
      <button key={label} onClick={onClick} style={{
        fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.68rem", letterSpacing: "1.5px",
        padding: "4px 12px", borderRadius: 20, cursor: "pointer", transition: "all 0.15s",
        background: active ? (color || "var(--red)") : "var(--surface)",
        color: active ? "#fff" : "var(--muted2)",
        border: `1.5px solid ${active ? (color || "var(--red)") : "var(--border)"}`,
      }}>{label}</button>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px 80px" }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.7rem", letterSpacing: "4px", color: "var(--red)", marginBottom: 4 }}>BLACKREADBROWN COLLECTION</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(36px, 6vw, 64px)", letterSpacing: "4px", color: "var(--text)", lineHeight: 1, marginBottom: 0 }}>COVER ART CATALOG</h1>
          {flagCount > 0 && (
            <button onClick={() => setShowModal(true)} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.68rem", letterSpacing: "1.5px", padding: "8px 16px", background: "#c8102e", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, alignSelf: "center", boxShadow: "0 2px 8px rgba(200,16,46,0.3)" }}>
              🚩 {flagCount} INCORRECT COVER{flagCount !== 1 ? "S" : ""} FLAGGED
            </button>
          )}
        </div>
        <div style={{ height: 2, background: "linear-gradient(90deg, var(--red), transparent)", maxWidth: 280, marginTop: 12 }} />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "2px solid var(--border)", overflowX: "auto" }}>
        {TABS.map(tab => {
          const count = DATA.catalogs[tab.key].length;
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => switchTab(tab.key)} style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "0.72rem", letterSpacing: "1.5px",
              padding: "10px 18px",
              border: "none", borderBottom: isActive ? "3px solid var(--red)" : "3px solid transparent",
              background: "none",
              color: isActive ? "var(--red)" : "var(--muted2)",
              cursor: "pointer",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
              marginBottom: "-2px",
            }}>
              {tab.short}
              <span style={{ marginLeft: 6, opacity: 0.7, fontSize: "0.62rem" }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Active tab stats */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
        {[
          [tabStats.total.toLocaleString(), "Books"],
          [tabStats.keys.toString(),        "Keys"],
          [tabStats.signed.toString(),      "Signed"],
          [tabStats.artists.toString(),     "Artists"],
        ].map(([n, l]) => (
          <div key={l} style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.5rem", color: "var(--red)", letterSpacing: "1px" }}>{n}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.58rem", letterSpacing: "2px", color: "var(--muted)" }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "14px 16px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.6rem", letterSpacing: "2px", color: "var(--muted)", marginRight: 4 }}>PUBLISHER</span>
          {PUB_PILLS.map(p => pill(p, pub === p, () => { setPub(p); setPage(1); }))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <input
            value={artistQ} onChange={e => { setArtistQ(e.target.value); setPage(1); }}
            placeholder="Filter by cover artist…"
            style={{ flex: "1 1 160px", minWidth: 140, padding: "6px 12px", border: "1.5px solid var(--border)", borderRadius: 6, fontFamily: "'Crimson Pro', serif", fontSize: "0.9rem", background: "var(--bg)", color: "var(--text)", outline: "none" }}
            onFocus={e => (e.target.style.borderColor = "var(--red)")}
            onBlur={e => (e.target.style.borderColor = "var(--border)")}
          />
          <input
            value={titleQ} onChange={e => { setTitleQ(e.target.value); setPage(1); }}
            placeholder="Filter by title…"
            style={{ flex: "1 1 140px", minWidth: 120, padding: "6px 12px", border: "1.5px solid var(--border)", borderRadius: 6, fontFamily: "'Crimson Pro', serif", fontSize: "0.9rem", background: "var(--bg)", color: "var(--text)", outline: "none" }}
            onFocus={e => (e.target.style.borderColor = "var(--red)")}
            onBlur={e => (e.target.style.borderColor = "var(--border)")}
          />
          <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} style={{ padding: "6px 10px", border: "1.5px solid var(--border)", borderRadius: 6, fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.7rem", letterSpacing: "1px", background: "var(--bg)", color: "var(--text)", cursor: "pointer" }}>
            <option value="title">Sort: Title A–Z</option>
            <option value="artist">Sort: Artist A–Z</option>
            <option value="value">Sort: Highest Value</option>
          </select>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {pill("KEYS ONLY", keyOnly, () => { setKeyOnly(!keyOnly); setPage(1); }, "#7a5500")}
          {pill("SIGNED ONLY", signedOnly, () => { setSignedOnly(!signedOnly); setPage(1); }, "#166534")}
          {pill(`🚩 FLAGGED${flagCount > 0 ? ` (${flagCount})` : ""}`, flaggedOnly, () => { setFlaggedOnly(!flaggedOnly); setPage(1); }, "#c8102e")}
        </div>
      </div>

      {/* Result count */}
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.7rem", letterSpacing: "2px", color: "var(--muted)", marginBottom: 16 }}>
        {total.toLocaleString()} COVER{total !== 1 ? "S" : ""} · PAGE {page} OF {pages || 1}
      </div>

      {/* Cards */}
      {slice.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)", fontFamily: "'Crimson Pro', serif", fontSize: "1rem" }}>No covers match the current filters.</div>
      ) : (
        slice.map((comic, i) => {
          const id = comicId(comic);
          return (
            <CoverCard
              key={id}
              comic={comic}
              flip={(((page - 1) * PAGE_SIZE + i) % 2) === 1}
              flagged={flags.has(id)}
              onToggleFlag={() => toggleFlag(comic)}
            />
          );
        })
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 32, flexWrap: "wrap" }}>
          <button onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            disabled={page === 1}
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.7rem", letterSpacing: "1.5px", padding: "6px 14px", border: "1.5px solid var(--border)", borderRadius: 5, background: "var(--surface)", color: page === 1 ? "var(--muted)" : "var(--text)", cursor: page === 1 ? "default" : "pointer" }}>
            ← PREV
          </button>
          {Array.from({ length: Math.min(pages, 9) }, (_, i) => {
            const p = pages <= 9 ? i + 1 : (page <= 5 ? i + 1 : page - 4 + i);
            if (p < 1 || p > pages) return null;
            return (
              <button key={p} onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.7rem", letterSpacing: "1px", padding: "6px 11px", border: `1.5px solid ${p === page ? "var(--red)" : "var(--border)"}`, borderRadius: 5, background: p === page ? "var(--red)" : "var(--surface)", color: p === page ? "#fff" : "var(--text)", cursor: "pointer" }}>
                {p}
              </button>
            );
          })}
          <button onClick={() => { setPage(p => Math.min(pages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            disabled={page === pages}
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.7rem", letterSpacing: "1.5px", padding: "6px 14px", border: "1.5px solid var(--border)", borderRadius: 5, background: "var(--surface)", color: page === pages ? "var(--muted)" : "var(--text)", cursor: page === pages ? "default" : "pointer" }}>
            NEXT →
          </button>
        </div>
      )}

      {/* Flagged modal */}
      {showModal && (
        <FlaggedModal
          flags={[...flags.values()]}
          onClose={() => setShowModal(false)}
          onClear={clearFlag}
        />
      )}
    </div>
  );
}
