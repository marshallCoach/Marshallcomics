import { useState, useMemo } from "react";
import { DATA3 } from "@/data/data3";
import { CoverImage } from "@/components/CoverImage";

const ALL_COMICS = DATA3.comics;
const WITH_ARTIST = ALL_COMICS.filter(c => c.Cover_Artist && c.Cover_Artist.trim() && c.Cover_Artist !== "nan");

const PAGE_SIZE = 16;

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

interface CoverComic {
  Title: string; Issue: string; Publisher: string; Year: string;
  Cover_Artist: string; Value_NM: string; Value_VF: string;
  Start_Bid: string; Category: string; Signed: string; Signed_By: string;
  Key: string; Key_Reason: string; First_App: string;
  Seller_Notes: string; Arc: string; Writer: string; Artist: string; Box: string;
}

function CoverCard({ comic, flip }: { comic: CoverComic; flip: boolean }) {
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
    <div style={{ flex: 1, padding: "22px 24px", display: "flex", flexDirection: "column", gap: 10, background: "var(--surface)" }}>
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
        border: "1.5px solid var(--border)", borderRadius: 10, overflow: "hidden",
        marginBottom: 16, minHeight: 300,
        boxShadow: "0 3px 16px rgba(0,0,0,0.07)",
        transition: "box-shadow 0.2s, transform 0.2s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.12)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 3px 16px rgba(0,0,0,0.07)"; (e.currentTarget as HTMLElement).style.transform = "none"; }}
    >
      {flip ? <>{txtCol}{imgCol}</> : <>{imgCol}{txtCol}</>}
    </article>
  );
}

const PUB_PILLS = ["All", "Marvel", "DC", "Image", "IDW", "Dark Horse", "Other"];

export default function CoverCatalog() {
  const [pub,        setPub]        = useState("All");
  const [artistQ,   setArtistQ]    = useState("");
  const [titleQ,    setTitleQ]     = useState("");
  const [whatnotOnly, setWhatnotOnly] = useState(false);
  const [keyOnly,    setKeyOnly]    = useState(false);
  const [signedOnly, setSignedOnly] = useState(false);
  const [sort,       setSort]       = useState("artist");
  const [page,       setPage]       = useState(1);

  const filtered = useMemo(() => {
    let r = WITH_ARTIST as CoverComic[];
    if (whatnotOnly) r = r.filter(c => parseNM(c.Start_Bid) >= 10);
    if (keyOnly)     r = r.filter(c => (c.Key || "").toUpperCase() === "YES");
    if (signedOnly)  r = r.filter(c => (c.Signed || "").toUpperCase() === "YES");
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
  }, [pub, artistQ, titleQ, whatnotOnly, keyOnly, signedOnly, sort]);

  const total   = filtered.length;
  const pages   = Math.ceil(total / PAGE_SIZE);
  const slice   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Stats
  const whatnotReady = WITH_ARTIST.filter(c => parseNM(c.Start_Bid) >= 10).length;
  const uniqueArtists = new Set(WITH_ARTIST.map(c => c.Cover_Artist.trim())).size;
  const signedCovers  = WITH_ARTIST.filter(c => (c.Signed || "").toUpperCase() === "YES").length;

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
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(36px, 6vw, 64px)", letterSpacing: "4px", color: "var(--text)", lineHeight: 1, marginBottom: 8 }}>COVER ART CATALOG</h1>
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
        slice.map((comic, i) => (
          <CoverCard
            key={`${comic.Title}|||${comic.Issue}|||${comic.Box}`}
            comic={comic as CoverComic}
            flip={(((page - 1) * PAGE_SIZE + i) % 2) === 1}
          />
        ))
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
    </div>
  );
}
