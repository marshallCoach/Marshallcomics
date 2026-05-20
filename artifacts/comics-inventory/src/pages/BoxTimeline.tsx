import { useMemo } from "react";
import { DATA3 } from "@/data/data3";

const boxes  = DATA3.boxes;
const comics = DATA3.comics;

const MONTH_ORDER: Record<string, number> = {
  jan:0, feb:1, mar:2, apr:3, may:4, jun:5,
  jul:6, aug:7, sep:8, oct:9, nov:10, dec:11,
};

function parseDate(s: string): number {
  if (!s || s.toLowerCase().includes("original") || s.toLowerCase().includes("session")) return 0;
  const m = s.match(/([a-z]+)\s*\.?\s*(\d{1,2})[,.]?\s*(\d{4})?/i);
  if (!m) return 1;
  const mon = MONTH_ORDER[(m[1]||"").toLowerCase().slice(0,3)] ?? 0;
  const day = parseInt(m[2])||1;
  const yr  = parseInt(m[3]||"2025");
  return yr * 10000 + mon * 100 + day;
}

export default function BoxTimeline() {
  const entries = useMemo(() => {
    return boxes
      .map(b => {
        const comicsInBox = comics.filter(c => {
          const bNum = b.Num.replace("BOX ","").replace(/^0/,"");
          const cBox = String(c.Box||"").replace(/^0/,"");
          return cBox === bNum || `BOX ${c.Box.padStart(2,"0")}` === b.Num;
        });
        return {
          ...b,
          sortKey: parseDate(b.DateAdded),
          comicCount: comicsInBox.length || b.Comics,
          keys: b.Keys,
          signed: b.Signed,
        };
      })
      .sort((a, b) => a.sortKey - b.sortKey);
  }, []);

  const maxCount = Math.max(...entries.map(e => e.comicCount));

  const groups = useMemo(() => {
    const g: Record<string, typeof entries> = {};
    for (const e of entries) {
      const label = e.sortKey === 0 ? "Original Session" : (e.DateAdded || "Unknown");
      const key = label;
      if (!g[key]) g[key] = [];
      g[key].push(e);
    }
    return Object.entries(g);
  }, [entries]);

  const totalComics = entries.reduce((s, e) => s + e.comicCount, 0);
  const totalKeys   = entries.reduce((s, e) => s + e.keys, 0);
  const totalSigned = entries.reduce((s, e) => s + e.signed, 0);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "18px 18px 60px" }}>

      {/* Summary bar */}
      <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginBottom:24, padding:"14px 18px",
        background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:8 }}>
        {[
          { val: entries.length,           lbl: "Boxes Catalogued" },
          { val: totalComics.toLocaleString(), lbl: "Total Comics" },
          { val: totalKeys,                lbl: "Key Issues" },
          { val: totalSigned,              lbl: "Signed Books" },
          { val: groups.length,            lbl: "Entry Sessions" },
        ].map(s => (
          <div key={s.lbl} style={{ textAlign:"center", flex:"1 1 100px" }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.5rem", color:"var(--red)", letterSpacing:"1px", lineHeight:1 }}>{s.val}</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.65rem", letterSpacing:"1.5px", color:"var(--muted)", marginTop:3 }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.8rem", letterSpacing:"2px", color:"var(--red)", marginBottom:16 }}>
        COLLECTION TIMELINE — BOXES BY DATE ADDED
      </div>

      <div style={{ position:"relative", paddingLeft:28 }}>
        {/* Vertical line */}
        <div style={{ position:"absolute", left:10, top:8, bottom:8, width:2, background:"var(--border)", borderRadius:2 }} />

        {groups.map(([dateLabel, groupBoxes], gi) => (
          <div key={gi} style={{ marginBottom:32, position:"relative" }}>
            {/* Date dot */}
            <div style={{
              position:"absolute", left:-22, top:3,
              width:14, height:14, borderRadius:"50%",
              background: dateLabel === "Original Session" ? "#4a3018" : "var(--red)",
              border:"2px solid var(--surface)",
              boxShadow:"0 0 0 2px " + (dateLabel === "Original Session" ? "#4a3018" : "var(--red)") + "20",
            }} />

            {/* Date label */}
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", letterSpacing:"2px",
              color: dateLabel === "Original Session" ? "var(--brown)" : "var(--red)",
              marginBottom:10 }}>
              {dateLabel.toUpperCase()}
            </div>

            {/* Boxes in this session */}
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {groupBoxes.map(box => {
                const pct = maxCount > 0 ? (box.comicCount / maxCount) * 100 : 0;
                const shortLabel = box.Label.replace(/^Box \d+ — /,"").replace(/^BOX \d+ — /i,"");
                return (
                  <div key={box.Num} style={{
                    background:"var(--surface)", border:"1.5px solid var(--border)",
                    borderRadius:6, padding:"12px 16px",
                    borderLeft:"4px solid var(--red)",
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8, flexWrap:"wrap" }}>
                      <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1rem",
                        color:"var(--red)", letterSpacing:"1px", minWidth:56 }}>
                        {box.Num}
                      </span>
                      <span style={{ fontSize:"0.9rem", fontWeight:600, color:"var(--brown-light)", flex:1 }}>
                        {shortLabel}
                      </span>
                      <div style={{ display:"flex", gap:10, flexShrink:0 }}>
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem",
                          color:"var(--text)", letterSpacing:"0.5px" }}>
                          {box.comicCount} <span style={{ color:"var(--muted)", fontSize:"0.65rem", letterSpacing:"1px" }}>COMICS</span>
                        </span>
                        {box.keys > 0 && (
                          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.75rem",
                            background:"#fff8e0", color:"#8a6000", border:"1px solid #d4a800",
                            borderRadius:3, padding:"1px 7px", letterSpacing:"1px" }}>
                            {box.keys} KEY{box.keys !== 1 ? "S" : ""}
                          </span>
                        )}
                        {box.signed > 0 && (
                          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.75rem",
                            background:"var(--green-bg)", color:"var(--green-text)", border:"1px solid #c8e6c8",
                            borderRadius:3, padding:"1px 7px", letterSpacing:"1px" }}>
                            {box.signed} SIGNED
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bar */}
                    <div style={{ height:6, background:"var(--border)", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ width:`${pct}%`, height:"100%", background:"var(--red)",
                        borderRadius:3, transition:"width 0.4s ease" }} />
                    </div>

                    {/* Meta row */}
                    <div style={{ display:"flex", gap:12, marginTop:6, fontSize:"0.75rem", color:"var(--muted)", flexWrap:"wrap" }}>
                      {box.Publisher && <span>{box.Publisher}</span>}
                      {box.YearRange && <span>{box.YearRange}</span>}
                      {box.Description && <span style={{ color:"var(--muted2)", fontStyle:"italic" }}>{box.Description.slice(0,80)}{box.Description.length>80?"…":""}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Target marker */}
        <div style={{ position:"relative", marginBottom:16 }}>
          <div style={{ position:"absolute", left:-22, top:3,
            width:14, height:14, borderRadius:"50%",
            background:"var(--border)", border:"2px dashed var(--muted)", }} />
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", letterSpacing:"2px",
            color:"var(--muted)", marginBottom:8 }}>
            TARGET: 65 BOXES
          </div>
          <div style={{ background:"var(--surface2)", border:"1.5px dashed var(--border)", borderRadius:6,
            padding:"10px 16px", color:"var(--muted)", fontSize:"0.82rem", fontStyle:"italic" }}>
            {65 - entries.length} more boxes to catalogue. You're {Math.round((entries.length/65)*100)}% of the way there.
          </div>
        </div>
      </div>
    </div>
  );
}
