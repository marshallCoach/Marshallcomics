import { useEffect, useState, useCallback } from "react";
import { UPDATE_FIELDS, getComicFlag, setComicFlag, clearComicFlag } from "@/lib/comicFlags";

export type DrawerComic = {
  Title: string;
  Issue: string;
  Volume?: string;
  Publisher?: string;
  Year?: string;
  Writer?: string;
  Artist?: string;
  Cover_Artist?: string;
  Arc?: string;
  Era?: string;
  Universe?: string;
  Key?: string;
  Key_Reason?: string;
  First_App?: string;
  Signed?: string;
  Signed_By?: string;
  Personal?: string;
  Condition?: string;
  CGC_Worth?: string;
  Value_NM?: string;
  Value_VF?: string;
  Start_Bid?: string;
  Platform?: string;
  Category?: string;
  Seller_Notes?: string;
  Story_Pitch?: string;
  Box?: string;
  Terrificon?: string;
  Imprint?: string;
};

export default function ComicDrawer({ comic, comicKey, onClose, onFlagChange }: {
  comic: DrawerComic | null;
  comicKey?: string;
  onClose: () => void;
  onFlagChange?: () => void;
}) {
  const [flagged,       setFlagged]       = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [showFields,    setShowFields]    = useState(false);

  // Load flag state when comic changes
  useEffect(() => {
    if (!comicKey) { setFlagged(false); setSelectedFields([]); setShowFields(false); return; }
    const existing = getComicFlag(comicKey);
    if (existing !== null) {
      setFlagged(true);
      setSelectedFields(existing);
      setShowFields(existing.length > 0);
    } else {
      setFlagged(false);
      setSelectedFields([]);
      setShowFields(false);
    }
  }, [comicKey]);

  useEffect(() => {
    if (!comic) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [comic, onClose]);

  const toggleFlag = useCallback(() => {
    if (!comicKey) return;
    if (flagged) {
      clearComicFlag(comicKey);
      setFlagged(false);
      setSelectedFields([]);
      setShowFields(false);
    } else {
      setComicFlag(comicKey, []);
      setFlagged(true);
      setShowFields(true);
    }
    onFlagChange?.();
  }, [comicKey, flagged, onFlagChange]);

  const toggleField = useCallback((field: string) => {
    if (!comicKey) return;
    setSelectedFields(prev => {
      const next = prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field];
      setComicFlag(comicKey, next);
      onFlagChange?.();
      return next;
    });
  }, [comicKey, onFlagChange]);

  if (!comic) return null;

  const isKey    = (comic.Key    || "").toUpperCase() === "YES";
  const isSigned = (comic.Signed || "").toUpperCase() === "YES";
  const cvUrl    = `https://comicvine.gamespot.com/search/?q=${encodeURIComponent(comic.Title+" "+comic.Issue)}&resources=issue`;

  const pubColor: Record<string, string> = {
    MARVEL:"#c8102e", DC:"#1d6fa4", IMAGE:"#f97316", IDW:"#22c55e",
    "DARK HORSE":"#7c3aed", VALIANT:"#8b2be2",
  };
  const accentColor = pubColor[(comic.Publisher||"").toUpperCase()] || "#6b7280";

  function Row({ label, val }: { label: string; val?: string }) {
    if (!val || val === "nan" || val.trim() === "") return null;
    return (
      <div style={{ display:"flex", gap:8, padding:"7px 0", borderBottom:"1px solid var(--border)" }}>
        <div style={{ flex:"0 0 110px", fontSize:"0.68rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1.5px", color:"var(--muted)", paddingTop:1 }}>{label}</div>
        <div style={{ flex:1, fontSize:"0.85rem", color:"var(--text)", lineHeight:1.5 }}>{val}</div>
      </div>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position:"fixed", inset:0, zIndex:8888, background:"rgba(0,0,0,0.4)", backdropFilter:"blur(1px)" }}
      />

      {/* Drawer */}
      <div style={{
        position:"fixed", top:0, right:0, bottom:0, zIndex:8889,
        width:"min(480px, 92vw)",
        background:"var(--bg)",
        borderLeft:"2px solid var(--border)",
        boxShadow:"-12px 0 40px rgba(0,0,0,0.2)",
        display:"flex", flexDirection:"column",
        animation:"drawerSlideIn 0.22s ease-out",
      }}>

        {/* Header strip */}
        <div style={{ background: flagged ? "#92400e" : accentColor, padding:"14px 18px 12px", flexShrink:0, transition:"background 0.2s" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div style={{ flex:1, paddingRight:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.3rem", letterSpacing:"2px", color:"#fff", lineHeight:1.1 }}>{comic.Title}</div>
                {flagged && (
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem", letterSpacing:"1.5px", background:"rgba(255,255,255,0.25)", color:"#fff", border:"1px solid rgba(255,255,255,0.4)", borderRadius:3, padding:"2px 7px", flexShrink:0 }}>
                    UPDATE NEEDED{selectedFields.length > 0 ? ` · ${selectedFields.length}` : ""}
                  </span>
                )}
              </div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", letterSpacing:"1px", color:"rgba(255,255,255,0.8)", marginTop:4 }}>
                {comic.Issue}
                {comic.Volume && comic.Volume !== "1" && <span style={{ marginLeft:6, fontSize:"0.7rem", background:"rgba(255,255,255,0.2)", borderRadius:3, padding:"1px 6px" }}>Vol {comic.Volume}</span>}
                {comic.Year && <span style={{ marginLeft:8, opacity:0.7 }}>{comic.Year}</span>}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#fff", borderRadius:6, width:30, height:30, cursor:"pointer", fontSize:"1rem", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}
            >×</button>
          </div>

          {/* Badges */}
          <div style={{ display:"flex", gap:5, marginTop:8, flexWrap:"wrap" }}>
            {comic.Publisher && <span style={{ fontSize:"0.6rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", background:"rgba(255,255,255,0.2)", color:"#fff", borderRadius:3, padding:"2px 7px" }}>{comic.Publisher}</span>}
            {comic.Era       && <span style={{ fontSize:"0.6rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", background:"rgba(255,255,255,0.15)", color:"rgba(255,255,255,0.9)", borderRadius:3, padding:"2px 7px" }}>{comic.Era}</span>}
            {comic.Box       && <span style={{ fontSize:"0.6rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", background:"rgba(255,255,255,0.15)", color:"rgba(255,255,255,0.9)", borderRadius:3, padding:"2px 7px" }}>Box {comic.Box}</span>}
            {isKey    && <span style={{ fontSize:"0.6rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", background:"#fff8e0", color:"#8a6000", borderRadius:3, padding:"2px 7px" }}>★ KEY</span>}
            {isSigned && <span style={{ fontSize:"0.6rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", background:"#f3e8ff", color:"#7c3aed", borderRadius:3, padding:"2px 7px" }}>✍ SIGNED</span>}
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex:1, overflowY:"auto", padding:"16px 18px" }}>

          {/* Key reason callout */}
          {isKey && comic.Key_Reason && (
            <div style={{ background:"#fff8e0", border:"1.5px solid #fde68a", borderRadius:6, padding:"10px 14px", marginBottom:12 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"2px", color:"#8a6000", marginBottom:4 }}>KEY REASON</div>
              <div style={{ fontSize:"0.88rem", color:"#5a4000", lineHeight:1.5 }}>{comic.Key_Reason}</div>
              {comic.First_App && <div style={{ marginTop:6, fontSize:"0.78rem", color:"#8a6000", fontWeight:600 }}>1st App: {comic.First_App}</div>}
            </div>
          )}

          {/* Story pitch */}
          {comic.Story_Pitch && comic.Story_Pitch.trim() && comic.Story_Pitch !== "nan" && (
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:6, padding:"10px 14px", marginBottom:12, fontFamily:"'Crimson Pro',serif", fontSize:"0.92rem", color:"var(--text)", lineHeight:1.6, fontStyle:"italic" }}>
              "{comic.Story_Pitch}"
            </div>
          )}

          {/* Data rows */}
          <Row label="Writer"       val={comic.Writer} />
          <Row label="Artist"       val={comic.Artist} />
          <Row label="Cover Artist" val={comic.Cover_Artist} />
          <Row label="Arc / Event"  val={comic.Arc} />
          <Row label="Universe"     val={comic.Universe} />
          <Row label="Imprint"      val={comic.Imprint} />
          <Row label="Condition"    val={comic.Condition} />
          <Row label="Value NM"     val={comic.Value_NM} />
          <Row label="Value VF"     val={comic.Value_VF} />
          <Row label="CGC Worth"    val={comic.CGC_Worth} />
          <Row label="Start Bid"    val={comic.Start_Bid} />
          <Row label="Platform"     val={comic.Platform} />
          <Row label="Category"     val={comic.Category} />
          <Row label="Terrificon"   val={comic.Terrificon} />

          {/* Signing details */}
          {isSigned && (
            <div style={{ background:"#f3e8ff", border:"1px solid #d8b4fe", borderRadius:6, padding:"10px 14px", marginTop:8 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"2px", color:"#7c3aed", marginBottom:4 }}>SIGNATURE</div>
              {comic.Signed_By && <div style={{ fontSize:"0.88rem", color:"#4c1d95", fontWeight:600 }}>Signed by: {comic.Signed_By}</div>}
              {comic.Personal && <div style={{ fontSize:"0.82rem", color:"#6d28d9", marginTop:4 }}>"{comic.Personal}"</div>}
            </div>
          )}

          {/* Seller notes */}
          {comic.Seller_Notes && comic.Seller_Notes.trim() && comic.Seller_Notes !== "nan" && (
            <div style={{ marginTop:8, padding:"10px 14px", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:6 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"2px", color:"var(--muted)", marginBottom:4 }}>SELLER NOTES</div>
              <div style={{ fontSize:"0.82rem", color:"var(--muted2)", lineHeight:1.5 }}>{comic.Seller_Notes}</div>
            </div>
          )}

          {/* ── NEEDS UPDATE SECTION ── */}
          {comicKey && (
            <div style={{ marginTop:16, borderTop:"1.5px solid var(--border)", paddingTop:14 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: flagged && showFields ? 12 : 0 }}>
                <div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.68rem", letterSpacing:"2px", color: flagged ? "#d97706" : "var(--muted)", marginBottom:2 }}>
                    DATA FLAG
                  </div>
                  <div style={{ fontSize:"0.75rem", color:"var(--muted2)", fontFamily:"'Crimson Pro',serif" }}>
                    {flagged
                      ? selectedFields.length > 0
                        ? `${selectedFields.length} field${selectedFields.length === 1 ? "" : "s"} need updating`
                        : "Flagged — select fields below"
                      : "Mark this book's data as needing an update"}
                  </div>
                </div>
                <button
                  onClick={toggleFlag}
                  style={{
                    fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"1.5px",
                    padding:"7px 14px",
                    border:`1.5px solid ${flagged ? "#d97706" : "var(--border)"}`,
                    background: flagged ? "#d97706" : "var(--surface2)",
                    color: flagged ? "#fff" : "var(--muted)",
                    borderRadius:5, cursor:"pointer", transition:"all 0.15s", flexShrink:0,
                  }}
                >
                  {flagged ? "✓ FLAGGED" : "+ NEEDS UPDATE"}
                </button>
              </div>

              {/* Field selector — only when flagged */}
              {flagged && (
                <>
                  <button
                    onClick={() => setShowFields(v => !v)}
                    style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:5, padding:"4px 0", marginBottom:8 }}
                  >
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"1.5px", color:"var(--muted)" }}>
                      {showFields ? "▲ HIDE FIELDS" : "▼ SELECT FIELDS NEEDING UPDATE"}
                    </span>
                    {selectedFields.length > 0 && (
                      <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem", letterSpacing:"1px", color:"#d97706", background:"#fefce8", border:"1px solid #fcd34d", borderRadius:3, padding:"1px 6px" }}>
                        {selectedFields.length} selected
                      </span>
                    )}
                  </button>

                  {showFields && (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                      {UPDATE_FIELDS.map(field => {
                        const active = selectedFields.includes(field);
                        return (
                          <button
                            key={field}
                            onClick={() => toggleField(field)}
                            style={{
                              fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"1px",
                              padding:"5px 10px",
                              border:`1.5px solid ${active ? "#d97706" : "var(--border)"}`,
                              background: active ? "#d97706" : "var(--surface2)",
                              color: active ? "#fff" : "var(--muted2)",
                              borderRadius:4, cursor:"pointer", transition:"all 0.1s",
                            }}
                          >{field}</button>
                        );
                      })}
                    </div>
                  )}

                  {selectedFields.length > 0 && (
                    <div style={{ marginTop:10, display:"flex", flexWrap:"wrap", gap:4 }}>
                      {selectedFields.map(f => (
                        <span key={f} style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"1px", color:"#92400e", background:"#fef3c7", border:"1px solid #fcd34d", borderRadius:3, padding:"2px 8px" }}>{f}</span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div style={{ padding:"12px 18px", borderTop:"1px solid var(--border)", flexShrink:0, display:"flex", gap:8 }}>
          <a
            href={cvUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ flex:1, textAlign:"center", padding:"9px 0", background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:6, fontSize:"0.7rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", color:"var(--text)", textDecoration:"none" }}
          >
            Search Comic Vine →
          </a>
          <button
            onClick={onClose}
            style={{ flex:1, padding:"9px 0", background: flagged ? "#d97706" : accentColor, border:"none", borderRadius:6, fontSize:"0.7rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", color:"#fff", cursor:"pointer" }}
          >
            Close
          </button>
        </div>
      </div>

      <style>{`
        @keyframes drawerSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
