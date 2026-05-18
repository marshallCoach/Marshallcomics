import { useState } from "react";
import { DATA3 } from "@/data/data3";

type Signing = {
  Creator: string;
  Deadline: string;
  Fee: string;
  Books: string;
  Strategy: string;
  source?: "urgent" | "sheet";
};

const URGENT_SIGNINGS: Signing[] = [
  {
    Creator:  "Jorge Jiménez",
    Deadline: "Jun 5, 2026 — ⚠️ CLOSES VERY SOON",
    Fee:      "$85",
    Books:
      "Absolute Batman #1 (1st print) · Action Comics #1050 (Jiménez cover) · " +
      "Robin: Son of Batman #1 · Absolute Batman #2–5 · " +
      "Any Jiménez-drawn Superman or DC Absolute covers in your collection",
    Strategy:
      "Jiménez is one of DC's hottest artists right now — Absolute Batman has " +
      "driven his market significantly. This is a Green Qualified signing (mail " +
      "your already-signed books for CGC authentication via JSA). Double-check " +
      "cgccomics.com/signature-series/ for the exact submission window. " +
      "Books authenticated at $85/item can easily sell for 3–5× raw value on " +
      "Whatnot with the green label. Submit your best Jiménez books first.",
    source: "urgent",
  },
  {
    Creator:  "Mike Mayhew",
    Deadline: "Jul 10, 2026 — HIGH PRIORITY",
    Fee:      "$80",
    Books:
      "Any Mike Mayhew painted covers in your collection · Thor variants · " +
      "Avengers painted covers · Star Wars (Dark Horse era) Mayhew covers · " +
      "X-Men painted variants · Captain America Mayhew covers",
    Strategy:
      "Mayhew is one of the most sought-after painted cover artists in comics — " +
      "his CGC SS books consistently outperform pencil-cover counterparts at auction. " +
      "This is a Green Qualified signing: mail already-signed books to CGC for JSA " +
      "authentication, or send unsigned copies for a new in-person Mayhew signing. " +
      "Painted cover CGC 9.8 SS books are wall-book material on Whatnot. " +
      "Check your variant boxes — any Mayhew trade dress or virgin covers are worth submitting. " +
      "Deadline is same day as Roy Thomas (Jul 10) — plan your CGC budget accordingly.",
    source: "urgent",
  },
  {
    Creator:  "Geoff Johns + Jason Fabok",
    Deadline: "Jun 26, 2026 — HIGH PRIORITY",
    Fee:      "$90",
    Books:
      "Doomsday Clock #1–12 (full run) · Batman: Three Jokers #1–3 · " +
      "Justice League #1 (Johns New 52 run) · Flash: Rebirth #1 · " +
      "Green Lantern: Rebirth #1 · Shazam #1 (Geoff Johns + Gary Frank) · " +
      "Any Johns-written Black Adam or JSA books you own",
    Strategy:
      "Johns is the architect of modern DC continuity and his Rebirth era " +
      "books are highly collectible. Fabok's art on Three Jokers commands " +
      "serious money. This dual signing = rare opportunity — both creators " +
      "authenticated together is a single label event. Batman: Three Jokers " +
      "#1 in CGC 9.8 SS with Johns + Fabok regularly sells for $150–300. " +
      "Submit Doomsday Clock #1 if you have it — that book is specced heavily " +
      "for DCU film announcements.",
    source: "urgent",
  },
];

const SHEET_SIGNINGS: Signing[] = DATA3.cgc_signings.map(s => ({ ...s, source: "sheet" as const }));

const ALL_SIGNINGS: Signing[] = [...URGENT_SIGNINGS, ...SHEET_SIGNINGS];

function urgencyColor(deadline: string, source?: string) {
  const d = (deadline || "").toLowerCase();
  if (source === "urgent" && d.includes("jun 5"))  return "#dc2626";
  if (source === "urgent" && d.includes("jun 26")) return "#d97706";
  if (d.includes("closed") || d.includes("likely closed")) return "#9ca3af";
  if (d.includes("jul 10") || d.includes("july")) return "#d97706";
  if (d.includes("future watch")) return "#6366f1";
  return "#6b7280";
}

function urgencyBadge(deadline: string, source?: string) {
  const d = (deadline || "").toLowerCase();
  if (source === "urgent" && d.includes("jun 5"))  return "CRITICAL";
  if (source === "urgent" && d.includes("jun 26")) return "HIGH";
  if (d.includes("closed"))                         return "CLOSED";
  if (d.includes("likely closed"))                  return "LIKELY CLOSED";
  if (d.includes("open now") || d.includes("jul 10")) return "OPEN NOW";
  if (d.includes("future watch"))                   return "WATCH";
  return "MONITOR";
}

export default function PrivateSignings() {
  const [open, setOpen] = useState<Set<number>>(new Set([0]));
  const toggle = (i: number) => setOpen(prev => {
    const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n;
  });

  return (
    <div>
      <div className="section-intro">
        <h2>CGC Private Signings — 2026</h2>
        <p>Monitor <strong>cgccomics.com/signature-series/</strong> weekly · Follow <strong>@CGCSignatureSeries</strong> on Instagram &amp; TikTok</p>
      </div>

      {/* Legend */}
      <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)", padding:"10px 24px", display:"flex", gap:16, flexWrap:"wrap", fontSize:"0.72rem", color:"var(--muted2)" }}>
        <span>🟡 <strong>Yellow SS</strong> = unsigned book + witnessed signing at show → max CGC value</span>
        <span>🟢 <strong>Green Qualified</strong> = already-signed book mailed to CGC × JSA → authenticated</span>
        <span>⚠️ <strong>Stan Lee</strong> = authenticate via PSA/DNA at NYCC — do NOT press first</span>
      </div>

      {/* Urgent banner */}
      <div style={{ background:"#fef2f2", borderBottom:"2px solid #dc2626", padding:"10px 24px", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.8rem", letterSpacing:"1.5px", color:"#dc2626" }}>
          ⚡ ACTION REQUIRED
        </span>
        <span style={{ fontSize:"0.78rem", color:"#7f1d1d" }}>
          <strong>Jiménez closes Jun 5</strong> (days away) · <strong>Johns + Fabok closes Jun 26</strong> · Roy Thomas open until Jul 10
        </span>
      </div>

      <div className="list-view">
        {ALL_SIGNINGS.map((s, i) => {
          const isOpen  = open.has(i);
          const color   = urgencyColor(s.Deadline, s.source);
          const badge   = urgencyBadge(s.Deadline, s.source);
          const isClosed = badge === "CLOSED" || badge === "LIKELY CLOSED";

          return (
            <div
              key={i}
              className={`lcard${isOpen ? " open" : ""}${isClosed ? " muted" : ""}`}
              style={{
                borderLeft: `3px solid ${color}`,
                opacity: isClosed ? 0.55 : 1,
              }}
              onClick={() => toggle(i)}
            >
              <div className="lcard-head">
                <span style={{
                  fontSize:"0.6rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
                  background:`${color}18`, border:`1px solid ${color}`, color,
                  borderRadius:3, padding:"1px 7px", whiteSpace:"nowrap", flexShrink:0,
                }}>{badge}</span>

                <span className="lcard-title">{s.Creator}</span>

                {s.Fee && !isClosed && (
                  <span className="lcard-tag">{s.Fee}/item</span>
                )}

                {s.Deadline && (
                  <span className="lcard-right" style={{ color, fontSize:"0.72rem" }}>
                    {s.Deadline.split("—")[0].trim()}
                  </span>
                )}
              </div>

              {s.Books && !isOpen && (
                <div style={{ fontSize:"0.78rem", color:"var(--muted2)", marginTop:4, paddingLeft:4 }}>
                  {s.Books.substring(0, 130)}{s.Books.length > 130 ? "…" : ""}
                </div>
              )}

              {isOpen && (
                <div className="lcard-expand">
                  {s.Books && (
                    <div className="dr">
                      <span className="dl">Books to Send</span>
                      <span className="dv">{s.Books}</span>
                    </div>
                  )}
                  {s.Strategy && (
                    <div className="dr" style={{ marginTop:8 }}>
                      <span className="dl">Strategy</span>
                      <span className="dv" style={{ fontStyle:"italic" }}>{s.Strategy}</span>
                    </div>
                  )}
                  {s.Deadline && s.Deadline.includes("—") && (
                    <div className="dr" style={{ marginTop:6 }}>
                      <span className="dl">Status</span>
                      <span className="dv" style={{ color }}>{s.Deadline.split("—").slice(1).join("—").trim()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pressing batch reminder */}
      <div style={{ margin:"24px 20px 40px", padding:"16px 20px", background:"#fff8e0", border:"1.5px solid #d4a800", borderRadius:8 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.85rem", letterSpacing:"1.5px", color:"#8a6000", marginBottom:8 }}>
          📦 PRESSING BATCH — Submit All Simultaneously Before CGC Submission
        </div>
        <div style={{ fontSize:"0.8rem", color:"#6a4800", lineHeight:1.7 }}>
          Batman #656, #657 · Wolverine #8 (UNSIGNED — keep for Terrificon yellow SS) ·
          ASM #361 · Vision #1 · Secret Wars #1 ·
          New Warriors #1 · Mockingbird #8 · WildCATs #2/#11 · Savage Dragon #1 ·
          Transformers #1 · All Avengers (Roy Thomas books)
        </div>
        <div style={{ marginTop:8, fontSize:"0.75rem", color:"#8a6000", lineHeight:1.6 }}>
          Cost: $15–25/book · Turnaround: 4–8 weeks · Submit all at once to save shipping ·{" "}
          <strong>DO NOT PRESS: Stan Lee BP #513</strong> (authenticate via PSA/DNA at NYCC first)
        </div>
      </div>
    </div>
  );
}
