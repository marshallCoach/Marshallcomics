import { useState, useMemo } from "react";
import { DATA } from "@/data/data";
import { CoverImage } from "@/components/CoverImage";

const ALL_KEYS = DATA.comics.filter(c => (c.Key || "").toUpperCase() === "YES");
const PAGE_SIZE = 18;

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
  if (u.includes("DYNAMITE"))   return "#b45309";
  return "#5a6270";
}

interface KeyComic {
  Title: string; Issue: string; Publisher: string; Year: string;
  Key: string; Key_Reason: string; First_App: string;
  Writer: string; Artist: string; Signed: string; Signed_By: string;
  Value_NM: string; Value_VF: string; Era: string; Box: string;
  Cover_Artist: string; Arc: string; Universe: string; Imprint: string;
}

function KeyCard({ comic, flip }: { comic: KeyComic; flip: boolean }) {
  const nm = parseNM(comic.Value_NM);
  const isSigned = (comic.Signed || "").toUpperCase() === "YES";
  const hasFirst = comic.First_App && comic.First_App.trim() && comic.First_App !== "nan";
  const color = pubColor(comic.Publisher);

  const imgCol = (
    <div style={{ position: "relative", minHeight: 280, background: "#f0eeeb", flexShrink: 0, width: "42%" }}>
      <CoverImage
        comic={comic}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      {nm >= 1 && (
        <div style={{
          position: "absolute", top: 12, left: flip ? "auto" : 12, right: flip ? 12 : "auto",
          background: "var(--red)", color: "#fff",
          fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.1rem", letterSpacing: "1px",
          padding: "3px 14px",
          clipPath: "polygon(7px 0%,calc(100% - 7px) 0%,100% 50%,calc(100% - 7px) 100%,7px 100%,0% 50%)",
          zIndex: 3,
        }}>
          ${nm}
        </div>
      )}
      {isSigned && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 3,
          background: "rgba(22,101,52,0.92)", color: "#fff",
          fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.65rem", letterSpacing: "2px",
          padding: "5px 10px", textAlign: "center",
        }}>
          ✍ SIGNED {comic.Signed_By ? `— ${comic.Signed_By}` : ""}
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
        {comic.Era && comic.Era !== "nan" && (
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.62rem", letterSpacing: "1.5px", background: "var(--surface2)", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 3, padding: "2px 8px" }}>
            {comic.Era}
          </span>
        )}
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.62rem", letterSpacing: "1.5px", background: "#fff8e0", color: "#7a5500", border: "1px solid #f0d060", borderRadius: 3, padding: "2px 8px" }}>
          ★ KEY
        </span>
        {comic.Box && (
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.62rem", letterSpacing: "1.5px", background: "var(--surface2)", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 3, padding: "2px 8px" }}>
            Box {comic.Box}
          </span>
        )}
      </div>

      <div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(18px, 2.5vw, 26px)", letterSpacing: "2px", color: "var(--text)", lineHeight: 1.1 }}>
          {comic.Title}
        </div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.85rem", letterSpacing: "2px", color: "var(--red)", marginTop: 2 }}>
          {comic.Issue}{comic.Year && comic.Year !== "nan" ? ` · ${comic.Year}` : ""}
        </div>
      </div>

      {comic.Key_Reason && comic.Key_Reason !== "nan" && (
        <div style={{ background: "#fff8e0", border: "1px solid #f0d060", borderRadius: 6, padding: "8px 12px" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.58rem", letterSpacing: "2px", color: "#7a5500", marginBottom: 3 }}>KEY REASON</div>
          <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: "0.9rem", color: "#5a3800", lineHeight: 1.5 }}>{comic.Key_Reason}</div>
        </div>
      )}

      {hasFirst && (
        <div>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.6rem", letterSpacing: "2px", color: "var(--muted)" }}>1ST APP · </span>
          <span style={{ fontFamily: "'Crimson Pro', serif", fontSize: "0.88rem", color: "var(--text2)" }}>{comic.First_App}</span>
        </div>
      )}

      {(comic.Writer || comic.Artist) && (
        <div style={{ fontSize: "0.75rem", color: "var(--muted2)", lineHeight: 1.4 }}>
          {comic.Writer && comic.Writer !== "nan" && <div>W: {comic.Writer}</div>}
          {comic.Artist && comic.Artist !== "nan" && comic.Artist !== comic.Writer && <div>A: {comic.Artist}</div>}
        </div>
      )}

      {(nm > 0) && (
        <div style={{ display: "flex", gap: 14, marginTop: "auto", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
          {nm > 0 && <div><span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.6rem", letterSpacing: "1.5px", color: "var(--muted)" }}>NM </span><strong style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1rem", color: "var(--red)" }}>${comic.Value_NM}</strong></div>}
          {comic.Value_VF && comic.Value_VF !== "nan" && parseNM(comic.Value_VF) > 0 && (
            <div><span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.6rem", letterSpacing: "1.5px", color: "var(--muted)" }}>VF </span><span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.9rem", color: "var(--muted2)" }}>${comic.Value_VF}</span></div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <article style={{
      display: "flex", flexDirection: "row",
      border: "1.5px solid var(--border)", borderRadius: 10, overflow: "hidden",
      marginBottom: 16, minHeight: 280,
      boxShadow: "0 3px 16px rgba(0,0,0,0.07)",
      transition: "box-shadow 0.2s, transform 0.2s",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.13)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 3px 16px rgba(0,0,0,0.07)"; (e.currentTarget as HTMLElement).style.transform = "none"; }}
    >
      {flip ? <>{txtCol}{imgCol}</> : <>{imgCol}{txtCol}</>}
    </article>
  );
}

const PUB_PILLS = ["All", "Marvel", "DC", "Image", "IDW", "Dark Horse", "Other"];
const ERA_PILLS = ["All", "Modern", "Copper", "Bronze", "Silver", "Golden"];

export default function KeyCatalog() {
  const [pub,         setPub]         = useState("All");
  const [era,         setEra]         = useState("All");
  const [search,      setSearch]      = useState("");
  const [signedOnly,  setSignedOnly]  = useState(false);
  const [firstOnly,   setFirstOnly]   = useState(false);
  const [sort,        setSort]        = useState("value");
  const [page,        setPage]        = useState(1);

  const filtered = useMemo(() => {
    let r = ALL_KEYS as KeyComic[];
    if (pub !== "All") {
      if (pub === "Other") r = r.filter(c => !["MARVEL","DC","IMAGE","IDW","DARK HORSE"].some(p => c.Publisher.toUpperCase().includes(p)));
      else r = r.filter(c => c.Publisher.toUpperCase().includes(pub.toUpperCase()));
    }
    if (era !== "All") r = r.filter(c => (c.Era || "").toLowerCase() === era.toLowerCase());
    if (signedOnly) r = r.filter(c => (c.Signed || "").toUpperCase() === "YES");
    if (firstOnly) r = r.filter(c => c.First_App && c.First_App.trim() && c.First_App !== "nan");
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(c => c.Title.toLowerCase().includes(q) || (c.Key_Reason || "").toLowerCase().includes(q) || (c.First_App || "").toLowerCase().includes(q) || (c.Writer || "").toLowerCase().includes(q));
    }
    const sorted = [...r];
    if (sort === "value") sorted.sort((a, b) => parseNM(b.Value_NM) - parseNM(a.Value_NM));
    else if (sort === "title") sorted.sort((a, b) => a.Title.localeCompare(b.Title));
    else if (sort === "era") sorted.sort((a, b) => {
      const order = ["Golden","Silver","Bronze","Copper","Modern"];
      return order.indexOf(a.Era) - order.indexOf(b.Era);
    });
    else if (sort === "box") sorted.sort((a, b) => parseNM(a.Box) - parseNM(b.Box));
    return sorted;
  }, [pub, era, search, signedOnly, firstOnly, sort]);

  const total   = filtered.length;
  const pages   = Math.ceil(total / PAGE_SIZE);
  const slice   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const signedKeys   = ALL_KEYS.filter(c => (c.Signed || "").toUpperCase() === "YES").length;
  const firstApps    = ALL_KEYS.filter(c => c.First_App && c.First_App.trim() && c.First_App !== "nan").length;
  const totalNMVal   = Math.round(ALL_KEYS.reduce((s, c) => s + parseNM(c.Value_NM), 0));

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
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(36px, 6vw, 64px)", letterSpacing: "4px", color: "var(--text)", lineHeight: 1, marginBottom: 8 }}>KEY ISSUE CATALOG</h1>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 12 }}>
          {[
            [ALL_KEYS.length.toLocaleString(), "Key Issues"],
            [firstApps.toLocaleString(),       "First Apps"],
            [signedKeys.toString(),            "Signed Keys"],
            [`$${totalNMVal.toLocaleString()}`, "Total NM Value"],
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.6rem", letterSpacing: "2px", color: "var(--muted)", marginRight: 4 }}>ERA</span>
          {ERA_PILLS.map(e => pill(e, era === e, () => { setEra(e); setPage(1); }))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <input
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search title, key reason, first app, writer…"
            style={{ flex: "1 1 200px", minWidth: 160, padding: "6px 12px", border: "1.5px solid var(--border)", borderRadius: 6, fontFamily: "'Crimson Pro', serif", fontSize: "0.9rem", background: "var(--bg)", color: "var(--text)", outline: "none" }}
            onFocus={e => (e.target.style.borderColor = "var(--red)")}
            onBlur={e => (e.target.style.borderColor = "var(--border)")}
          />
          <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} style={{ padding: "6px 10px", border: "1.5px solid var(--border)", borderRadius: 6, fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.7rem", letterSpacing: "1px", background: "var(--bg)", color: "var(--text)", cursor: "pointer" }}>
            <option value="value">Sort: Highest Value</option>
            <option value="title">Sort: Title A–Z</option>
            <option value="era">Sort: Era (oldest first)</option>
            <option value="box">Sort: Box #</option>
          </select>
          {pill("SIGNED ONLY", signedOnly, () => { setSignedOnly(!signedOnly); setPage(1); }, "#166534")}
          {pill("1ST APP ONLY", firstOnly, () => { setFirstOnly(!firstOnly); setPage(1); }, "#1d4ed8")}
        </div>
      </div>

      {/* Result count */}
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.7rem", letterSpacing: "2px", color: "var(--muted)", marginBottom: 16 }}>
        {total.toLocaleString()} KEY{total !== 1 ? "S" : ""} · PAGE {page} OF {pages || 1}
        {search && <span> · FILTERED BY "{search}"</span>}
      </div>

      {/* Cards */}
      {slice.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)", fontFamily: "'Crimson Pro', serif", fontSize: "1rem" }}>No keys match the current filters.</div>
      ) : (
        slice.map((comic, i) => (
          <KeyCard
            key={`${comic.Title}|||${comic.Issue}|||${comic.Box}`}
            comic={comic as KeyComic}
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
