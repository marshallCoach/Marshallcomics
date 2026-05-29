import { useEffect, useState, useCallback } from "react";
import { UPDATE_FIELDS, getComicFlag, setComicFlag, clearComicFlag } from "@/lib/comicFlags";
import { CoverImage, CoverModal } from "@/components/CoverImage";

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

function buildClaudePrompt(comic: DrawerComic, fields: string[], notes: string): string {
  const divider = "────────────────────────────────";
  const lines: string[] = [];

  lines.push("BOOK UPDATE REQUEST");
  lines.push(divider);
  lines.push(`Title:     ${comic.Title}`);
  lines.push(`Issue:     ${comic.Issue}${comic.Volume && comic.Volume !== "1" ? ` · Vol ${comic.Volume}` : ""}`);
  if (comic.Year)      lines.push(`Year:      ${comic.Year}`);
  if (comic.Publisher) lines.push(`Publisher: ${comic.Publisher}`);
  if (comic.Box)       lines.push(`Box:       ${comic.Box}`);
  if (comic.Era)       lines.push(`Era:       ${comic.Era}`);
  lines.push("");

  if (fields.length > 0) {
    lines.push("FIELDS TO UPDATE");
    lines.push(divider);
    fields.forEach(f => lines.push(`• ${f}`));
    lines.push("");
  }

  if (notes.trim()) {
    lines.push("NOTES");
    lines.push(divider);
    lines.push(notes.trim());
    lines.push("");
  }

  lines.push("CURRENT BOOK DATA");
  lines.push(divider);
  const dataFields: [string, string | undefined][] = [
    ["Title",        comic.Title],
    ["Issue",        comic.Issue],
    ["Volume",       comic.Volume],
    ["Publisher",    comic.Publisher],
    ["Year",         comic.Year],
    ["Box",          comic.Box],
    ["Era",          comic.Era],
    ["Universe",     comic.Universe],
    ["Imprint",      comic.Imprint],
    ["Writer",       comic.Writer],
    ["Artist",       comic.Artist],
    ["Cover Artist", comic.Cover_Artist],
    ["Arc / Event",  comic.Arc],
    ["Key",          comic.Key],
    ["Key Reason",   comic.Key_Reason],
    ["First App",    comic.First_App],
    ["Signed",       comic.Signed],
    ["Signed By",    comic.Signed_By],
    ["Personalization", comic.Personal],
    ["Condition",    comic.Condition],
    ["Value NM",     comic.Value_NM],
    ["Value VF",     comic.Value_VF],
    ["CGC Worth",    comic.CGC_Worth],
    ["Start Bid",    comic.Start_Bid],
    ["Platform",     comic.Platform],
    ["Category",     comic.Category],
    ["Story Pitch",  comic.Story_Pitch],
    ["Seller Notes", comic.Seller_Notes],
    ["Terrificon",   comic.Terrificon],
  ];
  dataFields.forEach(([label, val]) => {
    if (val && val !== "nan" && val.trim()) {
      lines.push(`${label.padEnd(16)}: ${val}`);
    }
  });
  lines.push("");
  lines.push(divider);
  lines.push("Please verify and update the flagged fields for this comic book entry.");

  return lines.join("\n");
}

function NotesModal({ comic, comicKey, fields, notes, onFieldsChange, onNotesChange, onClose }: {
  comic: DrawerComic;
  comicKey: string;
  fields: string[];
  notes: string;
  onFieldsChange: (fields: string[]) => void;
  onNotesChange: (notes: string) => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const toggleField = (field: string) => {
    const next = fields.includes(field) ? fields.filter(f => f !== field) : [...fields, field];
    onFieldsChange(next);
    setComicFlag(comicKey, next, notes);
  };

  const handleNotesChange = (val: string) => {
    onNotesChange(val);
    setComicFlag(comicKey, fields, val);
  };

  const copyForClaude = async () => {
    const prompt = buildClaudePrompt(comic, fields, notes);
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback: select a textarea
      const ta = document.getElementById("claude-prompt-preview") as HTMLTextAreaElement;
      if (ta) { ta.select(); document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 2200); }
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const prompt = buildClaudePrompt(comic, fields, notes);

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:9000, background:"rgba(0,0,0,0.55)" }} />
      <div style={{
        position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
        zIndex:9001,
        width:"min(640px, 94vw)", maxHeight:"88vh",
        background:"var(--bg)", border:"2px solid #d97706",
        borderRadius:10, boxShadow:"0 20px 60px rgba(0,0,0,0.35)",
        display:"flex", flexDirection:"column",
        animation:"drawerSlideIn 0.18s ease-out",
      }}>
        {/* Header */}
        <div style={{ background:"#92400e", padding:"14px 18px 12px", borderRadius:"8px 8px 0 0", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"2px", color:"rgba(255,255,255,0.7)", marginBottom:3 }}>UPDATE NOTES</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.15rem", letterSpacing:"2px", color:"#fff", lineHeight:1.1 }}>
                {comic.Title} <span style={{ opacity:0.75 }}>#{comic.Issue}</span>
              </div>
              {(comic.Publisher || comic.Year || comic.Box) && (
                <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.65)", marginTop:4, fontFamily:"'Crimson Pro',serif" }}>
                  {[comic.Publisher, comic.Year, comic.Box ? `Box ${comic.Box}` : ""].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#fff", borderRadius:6, width:30, height:30, cursor:"pointer", fontSize:"1rem", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>×</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex:1, overflowY:"auto", padding:"18px 20px" }}>

          {/* Field selector */}
          <div style={{ marginBottom:18 }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"2px", color:"var(--muted)", marginBottom:8 }}>
              FIELDS NEEDING UPDATE
              {fields.length > 0 && <span style={{ marginLeft:8, color:"#d97706" }}>({fields.length} selected)</span>}
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {UPDATE_FIELDS.map(field => {
                const active = fields.includes(field);
                return (
                  <button
                    key={field}
                    onClick={() => toggleField(field)}
                    style={{
                      fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1px",
                      padding:"5px 11px",
                      border:`1.5px solid ${active ? "#d97706" : "var(--border)"}`,
                      background: active ? "#d97706" : "var(--surface2)",
                      color: active ? "#fff" : "var(--muted2)",
                      borderRadius:4, cursor:"pointer", transition:"all 0.1s",
                    }}
                  >{field}</button>
                );
              })}
            </div>
          </div>

          {/* Notes field */}
          <div style={{ marginBottom:18 }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"2px", color:"var(--muted)", marginBottom:6 }}>NOTES</div>
            <textarea
              value={notes}
              onChange={e => handleNotesChange(e.target.value)}
              placeholder="What needs to be corrected or added? Include any known values, sources, or context that will help…"
              style={{
                width:"100%", boxSizing:"border-box",
                padding:"10px 12px", minHeight:100,
                fontFamily:"'Crimson Pro',serif", fontSize:"0.92rem", lineHeight:1.6,
                color:"var(--text)", background:"var(--surface)",
                border:"1.5px solid var(--border)", borderRadius:6,
                resize:"vertical", outline:"none",
              }}
              onFocus={e => e.currentTarget.style.borderColor = "#d97706"}
              onBlur={e => e.currentTarget.style.borderColor = "var(--border)"}
            />
          </div>

          {/* Claude prompt preview */}
          <div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"2px", color:"var(--muted)", marginBottom:6 }}>CLAUDE PROMPT PREVIEW</div>
            <textarea
              id="claude-prompt-preview"
              readOnly
              value={prompt}
              style={{
                width:"100%", boxSizing:"border-box",
                padding:"10px 12px", height:160,
                fontFamily:"'Courier New',monospace", fontSize:"0.72rem", lineHeight:1.5,
                color:"var(--muted2)", background:"var(--surface)",
                border:"1px solid var(--border)", borderRadius:6,
                resize:"none", outline:"none",
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:"12px 20px", borderTop:"1px solid var(--border)", flexShrink:0, display:"flex", gap:8 }}>
          <button
            onClick={copyForClaude}
            style={{
              flex:2, padding:"10px 0",
              fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", letterSpacing:"1.5px",
              background: copied ? "#16a34a" : "#d97706",
              border:"none", borderRadius:6, color:"#fff", cursor:"pointer", transition:"background 0.2s",
            }}
          >
            {copied ? "✓ Copied to Clipboard" : "Copy for Claude →"}
          </button>
          <button
            onClick={onClose}
            style={{
              flex:1, padding:"10px 0",
              fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", letterSpacing:"1.5px",
              background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:6,
              color:"var(--muted2)", cursor:"pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}

export default function ComicDrawer({ comic, comicKey, onClose, onFlagChange }: {
  comic: DrawerComic | null;
  comicKey?: string;
  onClose: () => void;
  onFlagChange?: () => void;
}) {
  const [flagged,        setFlagged]        = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [notes,          setNotes]          = useState("");
  const [showNotes,      setShowNotes]      = useState(false);
  const [coverModalUrl,  setCoverModalUrl]  = useState<string | null | undefined>(undefined);

  // Load flag state when comic / key changes
  useEffect(() => {
    if (!comicKey) { setFlagged(false); setSelectedFields([]); setNotes(""); setShowNotes(false); return; }
    const existing = getComicFlag(comicKey);
    if (existing !== null) {
      setFlagged(true);
      setSelectedFields(existing.fields);
      setNotes(existing.notes || "");
    } else {
      setFlagged(false);
      setSelectedFields([]);
      setNotes("");
      setShowNotes(false);
    }
  }, [comicKey]);

  useEffect(() => {
    if (!comic) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showNotes) { setShowNotes(false); }
        else { onClose(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [comic, onClose, showNotes]);

  const toggleFlag = useCallback(() => {
    if (!comicKey) return;
    if (flagged) {
      clearComicFlag(comicKey);
      setFlagged(false);
      setSelectedFields([]);
      setNotes("");
      setShowNotes(false);
    } else {
      setComicFlag(comicKey, [], "");
      setFlagged(true);
    }
    onFlagChange?.();
  }, [comicKey, flagged, onFlagChange]);

  const handleFieldsChange = useCallback((fields: string[]) => {
    setSelectedFields(fields);
    onFlagChange?.();
  }, [onFlagChange]);

  const handleNotesChange = useCallback((n: string) => {
    setNotes(n);
  }, []);

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

  const hasFieldsOrNotes = selectedFields.length > 0 || notes.trim().length > 0;

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:8888, background:"rgba(0,0,0,0.4)", backdropFilter:"blur(1px)" }} />

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
                    UPDATE{selectedFields.length > 0 ? ` · ${selectedFields.length}` : ""}
                  </span>
                )}
              </div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", letterSpacing:"1px", color:"rgba(255,255,255,0.8)", marginTop:4 }}>
                {comic.Issue}
                {comic.Volume && comic.Volume !== "1" && <span style={{ marginLeft:6, fontSize:"0.7rem", background:"rgba(255,255,255,0.2)", borderRadius:3, padding:"1px 6px" }}>Vol {comic.Volume}</span>}
                {comic.Year && <span style={{ marginLeft:8, opacity:0.7 }}>{comic.Year}</span>}
              </div>
            </div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#fff", borderRadius:6, width:30, height:30, cursor:"pointer", fontSize:"1rem", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>×</button>
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

          {/* Cover image */}
          <div style={{ display:"flex", gap:14, marginBottom:14, alignItems:"flex-start" }}>
            <CoverImage
              comic={{ ...comic, Publisher: comic.Publisher ?? "", Year: comic.Year ?? "" }}
              width={80}
              height={120}
              onClick={(large) => setCoverModalUrl(large)}
              style={{ flexShrink:0, boxShadow:"0 4px 16px rgba(0,0,0,0.18)", borderRadius:5 }}
            />
            <div style={{ flex:1, minWidth:0 }}>
              {isKey && comic.Key_Reason && (
                <div style={{ background:"#fff8e0", border:"1.5px solid #fde68a", borderRadius:6, padding:"8px 12px" }}>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"2px", color:"#8a6000", marginBottom:3 }}>KEY REASON</div>
                  <div style={{ fontSize:"0.82rem", color:"#5a4000", lineHeight:1.5 }}>{comic.Key_Reason}</div>
                  {comic.First_App && <div style={{ marginTop:4, fontSize:"0.75rem", color:"#8a6000", fontWeight:600 }}>1st App: {comic.First_App}</div>}
                </div>
              )}
              {(!isKey || !comic.Key_Reason) && comic.Story_Pitch && comic.Story_Pitch.trim() && comic.Story_Pitch !== "nan" && (
                <div style={{ fontFamily:"'Crimson Pro',serif", fontSize:"0.85rem", color:"var(--muted2)", lineHeight:1.5, fontStyle:"italic" }}>
                  "{comic.Story_Pitch.substring(0, 180)}"
                </div>
              )}
            </div>
          </div>

          {/* Story pitch (full, shown below the cover/key row for keys; shown normally for non-keys) */}
          {!isKey && comic.Story_Pitch && comic.Story_Pitch.trim() && comic.Story_Pitch !== "nan" && (
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

          {/* ── DATA FLAG SECTION ── */}
          {comicKey && (
            <div style={{ marginTop:16, borderTop:"1.5px solid var(--border)", paddingTop:14 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"2px", color: flagged ? "#d97706" : "var(--muted)", marginBottom:2 }}>DATA FLAG</div>
                  {flagged ? (
                    <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                      <span style={{ fontSize:"0.75rem", color:"#92400e", fontFamily:"'Crimson Pro',serif" }}>
                        {selectedFields.length > 0
                          ? `${selectedFields.length} field${selectedFields.length === 1 ? "" : "s"} flagged`
                          : "Flagged — no fields yet"}
                      </span>
                      {notes.trim() && <span style={{ fontSize:"0.68rem", color:"var(--muted)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic" }}>· has notes</span>}
                      <button
                        onClick={() => setShowNotes(true)}
                        style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"1.5px", background:"none", border:"none", color: hasFieldsOrNotes ? "#d97706" : "var(--muted)", cursor:"pointer", padding:"0 2px", textDecoration:"underline", textDecorationStyle:"dotted" }}
                      >
                        {hasFieldsOrNotes ? "Edit Notes →" : "Open Notes →"}
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize:"0.75rem", color:"var(--muted2)", fontFamily:"'Crimson Pro',serif" }}>Mark this book's data as needing an update</div>
                  )}
                </div>
                <button
                  onClick={toggleFlag}
                  style={{
                    fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1.5px",
                    padding:"7px 13px",
                    border:`1.5px solid ${flagged ? "#d97706" : "var(--border)"}`,
                    background: flagged ? "#d97706" : "var(--surface2)",
                    color: flagged ? "#fff" : "var(--muted)",
                    borderRadius:5, cursor:"pointer", transition:"all 0.15s", flexShrink:0,
                  }}
                >
                  {flagged ? "✓ Flagged" : "+ Flag"}
                </button>
              </div>

              {/* Selected field chips summary */}
              {flagged && selectedFields.length > 0 && (
                <div style={{ marginTop:8, display:"flex", flexWrap:"wrap", gap:4 }}>
                  {selectedFields.map(f => (
                    <span key={f} style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.58rem", letterSpacing:"1px", color:"#92400e", background:"#fef3c7", border:"1px solid #fcd34d", borderRadius:3, padding:"2px 7px" }}>{f}</span>
                  ))}
                </div>
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

      {/* Notes modal */}
      {showNotes && comicKey && (
        <NotesModal
          comic={comic}
          comicKey={comicKey}
          fields={selectedFields}
          notes={notes}
          onFieldsChange={handleFieldsChange}
          onNotesChange={handleNotesChange}
          onClose={() => setShowNotes(false)}
        />
      )}

      {/* Cover modal */}
      {coverModalUrl !== undefined && (
        <CoverModal
          comic={{ ...comic, Publisher: comic.Publisher ?? "", Year: comic.Year ?? "" }}
          largeUrl={coverModalUrl}
          onClose={() => setCoverModalUrl(undefined)}
        />
      )}

      <style>{`
        @keyframes drawerSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
