import { useState, useMemo, useCallback, useEffect } from "react";
import { DATA } from "@/data/data";
import { CoverImage, clearCoverMemCache } from "@/components/CoverImage";

const ALL_COMICS = DATA.comics;
const WITH_ARTIST = ALL_COMICS.filter(c => c.Cover_Artist && c.Cover_Artist.trim() && c.Cover_Artist !== "nan");

const PAGE_SIZE = 16;
const FLAG_KEY  = "brbFlaggedCovers_v1";

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
  if (u.includes("MARVEL")) return "#c8102e";
  if (u.includes("DC"))     return "#0476d0";
  if (u.includes("IMAGE"))  return "#e06c00";
  if (u.includes("IDW"))    return "#7c3aed";
  if (u.includes("DARK HORSE")) return "#374151";
  return "#5a6270";
}

// ── Types ────────────────────────────────────────────────────────────────────

interface CoverComic {
  Title: string; Issue: string; Publisher: string; Year: string;
  Cover_Artist: string; Value_NM: string; Value_VF: string;
  Start_Bid: string; Category: string; Signed: string; Signed_By: string;
  Key: string; Key_Reason: string; First_App: string;
  Seller_Notes: string; Arc: string; Writer: string; Artist: string; Box: string;
}

// ── Card ─────────────────────────────────────────────────────────────────────

function CoverCard({
  comic, flip, flagged, onToggleFlag,
}: {
  comic: CoverComic;
  flip: boolean;
  flagged: boolean;
  onToggleFlag: () => void;
}) {
  const nm      = parseNM(comic.Value_NM);
  const bid     = parseNM(comic.Start_Bid);
  const isSigned = (comic.Signed || "").toUpperCase() === "YES";
  const isKey    = (comic.Key    || "").toUpperCase() === "YES";
  const color   = pubColor(comic.Publisher);

  const isConnecting = (comic.Category || "").toLowerCase().includes("connect") ||
    (comic.Seller_Notes || "").toLowerCase().includes("connect");
  const isVariant = (comic.Issue || "").toLowerCase().includes("variant") ||
    (comic.Seller_Notes || "").toLowerCase().includes("variant");

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
      {/* Flag button */}
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
        {isConnecting && (
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.62rem", letterSpacing: "1.5px", background: "#1d4ed8", color: "#fff", borderRadius: 3, padding: "2px 8px" }}>CONNECTING</span>
        )}
        {isVariant && (
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.62rem", letterSpacing: "1.5px", background: "#7c3aed", color: "#fff", borderRadius: 3, padding: "2px 8px" }}>VARIANT</span>
        )}
        {isSigned && (
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.62rem", letterSpacing: "1.5px", background: "#166534", color: "#fff", borderRadius: 3, padding: "2px 8px" }}>✍ SIGNED</span>
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

      {comic.Seller_Notes && comic.Seller_Notes !== "nan" && comic.Seller_Notes.trim() && (
        <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: "0.85rem", color: "var(--muted2)", lineHeight: 1.5, fontStyle: "italic" }}>
          "{comic.Seller_Notes.substring(0, 160)}"
        </div>
      )}

      {(comic.Writer || comic.Artist) && (
        <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
          {comic.Writer && comic.Writer !== "nan" && <span>W: {comic.Writer}</span>}
          {comic.Artist && comic.Artist !== "nan" && <span style={{ marginLeft: 8 }}>A: {comic.Artist}</span>}
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
  const [picking, setPicking]                 = useState<string | null>(null); // flagId being confirmed

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
        const params = new URLSearchParams({
          title: f.Title, issue: f.Issue,
          publisher: f.Publisher, year: f.Year,
          refresh: "1",
        });
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
      onClear(flag.id); // remove the flag — cover is now confirmed correct
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

  function copyToClipboard() {
    navigator.clipboard.writeText(csv).catch(() => {});
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
                  {/* Header row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1rem", letterSpacing: "1.5px", color: "var(--text)" }}>{f.Title} #{f.Issue}</div>
                      <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: "0.82rem", color: "var(--muted)" }}>
                        {f.Cover_Artist} · {f.Publisher} · Box {f.Box} · {f.Year}
                      </div>
                    </div>
                    <button onClick={() => onClear(f.id)} title="Remove flag" style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.6rem", letterSpacing: "1px", color: "var(--muted)", flexShrink: 0 }}>REMOVE</button>
                  </div>

                  {/* Candidate thumbnail picker — shown after re-fetch */}
                  {cands.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.58rem", letterSpacing: "2px", color: "#1d4ed8", marginBottom: 6 }}>
                        PICK THE CORRECT COVER — CLICK TO CONFIRM AND UNFLAG
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {cands.map((c, ci) => (
                          <button
                            key={c.id}
                            onClick={() => pickCover(f, c)}
                            disabled={isPicking}
                            title={`${c.volume} #${c.issue_number}${c.cover_date ? " · " + c.cover_date : ""}`}
                            style={{
                              padding: 0, border: ci === 0 ? "2px solid #1d4ed8" : "2px solid var(--border)",
                              borderRadius: 5, cursor: isPicking ? "default" : "pointer",
                              overflow: "hidden", background: "#111",
                              opacity: isPicking ? 0.6 : 1,
                              position: "relative", flexShrink: 0,
                            }}
                          >
                            <img
                              src={c.image_url ?? ""}
                              alt={`${c.volume} #${c.issue_number}`}
                              style={{ display: "block", width: 60, height: 90, objectFit: "cover" }}
                              onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
                            />
                            {ci === 0 && (
                              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#1d4ed8", fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.5rem", letterSpacing: "1px", color: "#fff", textAlign: "center", padding: "2px 0" }}>BEST</div>
                            )}
                          </button>
                        ))}
                        <button
                          onClick={() => onClear(f.id)}
                          title="None of these are right — unflag anyway"
                          style={{ width: 60, height: 90, border: "2px dashed var(--border)", borderRadius: 5, cursor: "pointer", background: "var(--surface2)", color: "var(--muted)", fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.52rem", letterSpacing: "1px", flexShrink: 0 }}
                        >
                          NONE<br/>RIGHT
                        </button>
                      </div>
                      <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: "0.72rem", color: "var(--muted)", marginTop: 4, fontStyle: "italic" }}>
                        Best match is outlined in blue. Click any thumbnail to confirm it as correct — the flag clears automatically.
                      </div>
                    </div>
                  )}

                  {/* No candidates message */}
                  {refetchState === "done" && cands.length === 0 && (
                    <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: 6, fontStyle: "italic" }}>
                      Comic Vine returned no cover images for this issue.
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {flags.length > 0 && (
          <div style={{ padding: "16px 24px", borderTop: "1.5px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Re-fetch row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={refetchAllCovers}
                disabled={refetchState === "running"}
                style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.7rem", letterSpacing: "1.5px",
                  padding: "8px 18px", borderRadius: 5, border: "none", cursor: refetchState === "running" ? "default" : "pointer",
                  background: refetchState === "running" ? "#999" : "#1d4ed8", color: "#fff",
                  opacity: refetchState === "running" ? 0.7 : 1,
                }}
              >
                {refetchState === "running"
                  ? `FETCHING ${refetchProgress}/${flags.length}…`
                  : refetchState === "done"
                  ? "↻ RE-FETCH AGAIN"
                  : "↻ RE-FETCH FROM COMIC VINE"}
              </button>
              {refetchState === "running" && (
                <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden", minWidth: 80 }}>
                  <div style={{ height: "100%", background: "#1d4ed8", borderRadius: 3, width: `${Math.round((refetchProgress / flags.length) * 100)}%`, transition: "width 0.2s" }} />
                </div>
              )}
              {refetchState === "done" && refetchResults && (
                <span style={{ fontFamily: "'Crimson Pro', serif", fontSize: "0.82rem", color: "var(--muted)" }}>
                  {refetchResults.found} new covers found · {refetchResults.notFound} still missing — close and scroll to see updates
                </span>
              )}
            </div>
            {/* Export row */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={downloadCSV} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.7rem", letterSpacing: "1.5px", padding: "8px 18px", background: "var(--red)", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer" }}>
                ↓ DOWNLOAD CSV
              </button>
              <button onClick={copyToClipboard} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.7rem", letterSpacing: "1.5px", padding: "8px 18px", background: "var(--surface2)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: 5, cursor: "pointer" }}>
                COPY TO CLIPBOARD
              </button>
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
  const [pub,          setPub]          = useState("All");
  const [artistQ,      setArtistQ]      = useState("");
  const [titleQ,       setTitleQ]       = useState("");
  const [whatnotOnly,  setWhatnotOnly]  = useState(false);
  const [keyOnly,      setKeyOnly]      = useState(false);
  const [signedOnly,   setSignedOnly]   = useState(false);
  const [flaggedOnly,  setFlaggedOnly]  = useState(false);
  const [sort,         setSort]         = useState("artist");
  const [page,         setPage]         = useState(1);
  const [showModal,    setShowModal]    = useState(false);

  // Persistent flag state
  const [flags, setFlags] = useState<Map<string, FlaggedCover>>(() => loadFlags());

  useEffect(() => { saveFlags(flags); }, [flags]);

  const toggleFlag = useCallback((comic: CoverComic) => {
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

  const filtered = useMemo(() => {
    let r = WITH_ARTIST as CoverComic[];
    if (whatnotOnly)  r = r.filter(c => parseNM(c.Start_Bid) >= 10);
    if (keyOnly)      r = r.filter(c => (c.Key || "").toUpperCase() === "YES");
    if (signedOnly)   r = r.filter(c => (c.Signed || "").toUpperCase() === "YES");
    if (flaggedOnly)  r = r.filter(c => flags.has(comicId(c)));
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
    if (sort === "artist") sorted.sort((a, b) => a.Cover_Artist.localeCompare(b.Cover_Artist) || a.Title.localeCompare(b.Title));
    else if (sort === "value") sorted.sort((a, b) => parseNM(b.Value_NM) - parseNM(a.Value_NM));
    else if (sort === "bid")   sorted.sort((a, b) => parseNM(b.Start_Bid) - parseNM(a.Start_Bid));
    else if (sort === "title") sorted.sort((a, b) => a.Title.localeCompare(b.Title));
    return sorted;
  }, [pub, artistQ, titleQ, whatnotOnly, keyOnly, signedOnly, flaggedOnly, sort, flags]);

  const total   = filtered.length;
  const pages   = Math.ceil(total / PAGE_SIZE);
  const slice   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const whatnotReady  = WITH_ARTIST.filter(c => parseNM(c.Start_Bid) >= 10).length;
  const uniqueArtists = new Set(WITH_ARTIST.map(c => c.Cover_Artist.trim())).size;
  const signedCovers  = WITH_ARTIST.filter(c => (c.Signed || "").toUpperCase() === "YES").length;
  const flagCount     = flags.size;

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
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.7rem", letterSpacing: "4px", color: "var(--red)", marginBottom: 4 }}>BLACKREADBROWN COLLECTION</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(36px, 6vw, 64px)", letterSpacing: "4px", color: "var(--text)", lineHeight: 1, marginBottom: 0 }}>COVER ART CATALOG</h1>
          {flagCount > 0 && (
            <button onClick={() => setShowModal(true)} style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.68rem", letterSpacing: "1.5px",
              padding: "8px 16px", background: "#c8102e", color: "#fff",
              border: "none", borderRadius: 6, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, alignSelf: "center",
              boxShadow: "0 2px 8px rgba(200,16,46,0.3)",
            }}>
              🚩 {flagCount} INCORRECT COVER{flagCount !== 1 ? "S" : ""} FLAGGED
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 12 }}>
          {[
            [WITH_ARTIST.length.toLocaleString(), "Credited Covers"],
            [uniqueArtists.toString(),             "Cover Artists"],
            [signedCovers.toString(),              "Signed"],
            [whatnotReady.toString(),              "Whatnot Ready"],
          ].map(([n, l]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.5rem", color: "var(--red)", letterSpacing: "1px" }}>{n}</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.58rem", letterSpacing: "2px", color: "var(--muted)", textTransform: "uppercase" }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ height: 2, background: "linear-gradient(90deg, var(--red), transparent)", maxWidth: 280, marginTop: 12 }} />
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
            <option value="artist">Sort: Artist A–Z</option>
            <option value="value">Sort: Highest Value</option>
            <option value="bid">Sort: Highest Start Bid</option>
            <option value="title">Sort: Title A–Z</option>
          </select>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {pill(`WHATNOT READY (${whatnotReady})`, whatnotOnly, () => { setWhatnotOnly(!whatnotOnly); setPage(1); }, "#c8102e")}
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
              comic={comic as CoverComic}
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
