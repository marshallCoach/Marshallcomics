import { DATA2 } from "@/data/data2";
import { DATA1 } from "@/data/data1";

const boxes = DATA2.boxes_inventory;
const keys  = DATA2.boxes_keys;
const orig  = DATA1.orig_inventory;

const totalBoxes   = boxes.length;
const totalOrig    = orig.length;
const totalAll     = totalBoxes + totalOrig;
const keyCount     = keys.length + orig.filter(c => (c.Key || "").toUpperCase() === "YES").length;
const signedCount  = [...boxes, ...orig].filter(c => (c.Signed || "").toUpperCase() === "YES").length;
const whatnotCount = boxes.filter(c => (c.Platform || "").toUpperCase() === "WHATNOT").length;
const ebayCount    = boxes.filter(c => (c.Platform || "").toUpperCase() === "EBAY").length;

// Box counts
const boxCounts: Record<string, number> = {};
boxes.forEach(c => { boxCounts[c.Box] = (boxCounts[c.Box] || 0) + 1; });

// RAG data
const RAG_ROWS = [
  { label: "Title / Issue / Publisher / Year",  status: "green", note: "100% across all 13 boxes" },
  { label: "Key Issue flag (YES/NO)",            status: "green", note: "100% — all books classified" },
  { label: "Condition",                          status: "green", note: "100% — required field complete" },
  { label: "NM & VF Values",                    status: "green", note: "100% — pricing complete post-audit" },
  { label: "Platform (Whatnot / eBay)",          status: "green", note: "100% — all books assigned" },
  { label: "Era / Universe / Collection Type",   status: "green", note: "100% — classification complete" },
  { label: "Writer / Artist",                    status: "amber", note: "Gaps in Box 3 (Robin arc) and Box 8 (Star Trek) — ~15 rows each" },
  { label: "Arc / Story",                        status: "amber", note: "78–100% by box — Box 2 lowest at ~78%" },
  { label: "Whatnot Story Pitch",                status: "amber", note: "Box 1, 4 partial; Box 5, 6, 7, 8, 9 empty" },
  { label: "Key Issue — Why",                    status: "amber", note: "1 blank in Box 3 (flagged for fix)" },
  { label: "Starting Bid",                       status: "amber", note: "Box 3 all blank — needs population" },
  { label: "1st Appearances",                    status: "red",   note: "~2% fill — optional field, sparse by design" },
  { label: "Story Arc / Event",                  status: "red",   note: "~16% fill — auto-population in progress" },
  { label: "Volume",                             status: "red",   note: "~18% fill — optional, populated where relevant" },
  { label: "Content / Solicitation Notes",       status: "red",   note: "0% — optional, deprioritised" },
  { label: "Legacy Issue #",                     status: "red",   note: "0% — optional, only for dual-numbered series" },
];

// Next steps — today is May 15 2026, deadline urgency calculated
const NEXT_STEPS = [
  {
    urgency: "critical",
    deadline: "Jun 5",
    daysAway: 21,
    title: "Jorge Jiménez signing — ship books NOW",
    detail: "Batman #125. Deadline Jun 5. Ship this week or miss the window.",
    category: "Signing",
  },
  {
    urgency: "high",
    deadline: "ASAP",
    daysAway: 0,
    title: "Submit CGC books — UFF #21-23 (Marvel Zombies trilogy)",
    detail: "Box 2. $300–500 slabbed each. Highest ceiling in the collection. Submit before any Whatnot show.",
    category: "CGC",
  },
  {
    urgency: "high",
    deadline: "ASAP",
    daysAway: 0,
    title: "Submit CGC — UC Spider-Man #1 (Miles Morales origin)",
    detail: "Box 2. $150–300 CGC 9.8. Spider-Verse tie-in demand is sustained. Submit now.",
    category: "CGC",
  },
  {
    urgency: "high",
    deadline: "ASAP",
    daysAway: 0,
    title: "Submit CGC — Young Avengers #1 & Demon Days: X-Men #1",
    detail: "Box 7. $80–200 each. MCU-bound characters. Batch with Miles submission to save shipping.",
    category: "CGC",
  },
  {
    urgency: "high",
    deadline: "ASAP",
    daysAway: 0,
    title: "Fix Box 3 Writer / Artist blanks",
    detail: "Robin: The Joker's Wild arc — ~6 Writer and ~8 Artist cells missing. QC flagged.",
    category: "Data",
  },
  {
    urgency: "high",
    deadline: "ASAP",
    daysAway: 0,
    title: "Fix Box 8 Writer / Artist blanks",
    detail: "Star Trek / licensed books — 15–17 blank credits. Lookup and populate.",
    category: "Data",
  },
  {
    urgency: "medium",
    deadline: "Jun 26",
    daysAway: 42,
    title: "Geoff Johns + Jason Fabok signing — prepare books",
    detail: "JL #21 + JSA. Deadline Jun 26. Pull books, sleeve, and arrange.",
    category: "Signing",
  },
  {
    urgency: "medium",
    deadline: "Jul 10",
    daysAway: 56,
    title: "Roy Thomas signing — 5 books = $450 → $820–1,630",
    detail: "High-value opportunity. Identify the 5 books and ship before Jul 10.",
    category: "Signing",
  },
  {
    urgency: "medium",
    deadline: "Aug 7",
    daysAway: 84,
    title: "Terrificon prep — pull and sleeve creator books",
    detail: "Tom King Trinity, Jurgens Return of Superman 30th, Silvestri X-Men vs Avengers, Claremont Wolverine. Aug 7–9.",
    category: "Show",
  },
  {
    urgency: "low",
    deadline: "Ongoing",
    daysAway: 999,
    title: "Populate Starting Bid for Box 3",
    detail: "All 58 books in Box 3 have no starting bid set. Required field for Whatnot shows.",
    category: "Data",
  },
  {
    urgency: "low",
    deadline: "Ongoing",
    daysAway: 999,
    title: "Verify: Alan Scott GL #1 (Box 4)",
    detail: "Listed as watch — confirm issue and condition. May be a CGC candidate.",
    category: "Research",
  },
  {
    urgency: "low",
    deadline: "Ongoing",
    daysAway: 999,
    title: "Naomi #1 (Titans TV) — CGC candidate check",
    detail: "Box 6. $60–120 CGC 9.8 if in good condition. Verify grade before submitting.",
    category: "CGC",
  },
];

// Show only the 14-day window steps prominently
const UPCOMING_14 = NEXT_STEPS.filter(s => s.daysAway <= 14);
const UPCOMING_REST = NEXT_STEPS.filter(s => s.daysAway > 14);

function catColor(cat: string) {
  if (cat === "CGC")      return "#8b2be2";
  if (cat === "Signing")  return "#c8102e";
  if (cat === "Data")     return "#d97706";
  if (cat === "Show")     return "#1d6fa4";
  return "#555";
}

function RagDot({ status }: { status: string }) {
  const color = status === "green" ? "#16a34a" : status === "amber" ? "#d97706" : "#dc2626";
  const label = status === "green" ? "GREEN" : status === "amber" ? "AMBER" : "RED";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: color + "18", border: `1.5px solid ${color}`,
      borderRadius: 20, padding: "2px 10px",
      fontSize: "0.65rem", fontFamily: "'Bebas Neue', sans-serif",
      letterSpacing: "1px", color,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

function UrgencyBadge({ u }: { u: string }) {
  const map: Record<string, { label: string; color: string }> = {
    critical: { label: "CRITICAL", color: "#dc2626" },
    high:     { label: "HIGH",     color: "#d97706" },
    medium:   { label: "MEDIUM",   color: "#1d6fa4" },
    low:      { label: "WATCH",    color: "#6b7280" },
  };
  const m = map[u] || map.low;
  return (
    <span style={{
      background: m.color + "15", border: `1.5px solid ${m.color}`,
      borderRadius: 3, padding: "1px 8px",
      fontSize: "0.62rem", fontFamily: "'Bebas Neue', sans-serif",
      letterSpacing: "1px", color: m.color,
    }}>{m.label}</span>
  );
}

export default function Summary() {
  const overallScore = 82.3;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 60px" }}>

      {/* Collection Overview */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.3rem", letterSpacing: "2px", color: "var(--red)", marginBottom: 16 }}>
          Collection Overview
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          {[
            { val: totalBoxes.toLocaleString(), lbl: "Boxed Books", sub: "13 boxes" },
            { val: totalOrig.toLocaleString(), lbl: "Sales Inventory", sub: "pre-box collection" },
            { val: totalAll.toLocaleString(), lbl: "Total Comics", sub: "combined" },
            { val: keyCount.toString(), lbl: "Key Issues", sub: "across all sets" },
            { val: signedCount.toString(), lbl: "Signed Books", sub: "verified signatures" },
            { val: whatnotCount.toLocaleString(), lbl: "Whatnot", sub: "platform assigned" },
            { val: ebayCount.toLocaleString(), lbl: "eBay", sub: "platform assigned" },
            { val: "$24k–$40k+", lbl: "Est. Collection Value", sub: "combined raw" },
          ].map(s => (
            <div key={s.lbl} style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 6, padding: "14px 16px" }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.6rem", color: "var(--red)", letterSpacing: "1px" }}>{s.val}</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.7rem", letterSpacing: "1.5px", color: "var(--text)" }}>{s.lbl}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--muted2)", marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Box Breakdown */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.3rem", letterSpacing: "2px", color: "var(--red)", marginBottom: 16 }}>
          Books per Box
        </h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(boxCounts).sort((a,b) => Number(a[0]) - Number(b[0])).map(([box, cnt]) => (
            <div key={box} style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 5, padding: "8px 14px", textAlign: "center", minWidth: 72 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.2rem", color: "var(--red)" }}>{cnt}</div>
              <div style={{ fontSize: "0.68rem", color: "var(--muted2)", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "1px" }}>Box {box}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Data Confidence */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 16 }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.3rem", letterSpacing: "2px", color: "var(--red)", margin: 0 }}>
            Data Confidence
          </h2>
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: "1rem", letterSpacing: "1.5px",
            background: "#16a34a18", border: "1.5px solid #16a34a", color: "#16a34a",
            borderRadius: 4, padding: "2px 12px",
          }}>
            Overall: {overallScore}%
          </span>
        </div>
        <div style={{ border: "1.5px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface2)", borderBottom: "2px solid var(--red)" }}>
                <th style={{ padding: "8px 14px", textAlign: "left", fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.68rem", letterSpacing: "1.5px", color: "var(--muted2)" }}>Field / Group</th>
                <th style={{ padding: "8px 14px", textAlign: "left", fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.68rem", letterSpacing: "1.5px", color: "var(--muted2)", width: 110 }}>Status</th>
                <th style={{ padding: "8px 14px", textAlign: "left", fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.68rem", letterSpacing: "1.5px", color: "var(--muted2)" }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {RAG_ROWS.map((row, i) => (
                <tr key={row.label} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "var(--surface)" : "transparent" }}>
                  <td style={{ padding: "9px 14px", fontSize: "0.82rem", color: "var(--text)", fontWeight: 500 }}>{row.label}</td>
                  <td style={{ padding: "9px 14px" }}><RagDot status={row.status} /></td>
                  <td style={{ padding: "9px 14px", fontSize: "0.78rem", color: "var(--muted2)" }}>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 10, fontSize: "0.72rem", color: "var(--muted2)", display: "flex", gap: 20, flexWrap: "wrap" }}>
          <span><span style={{ color: "#16a34a", fontWeight: 700 }}>● GREEN</span> — 100% complete</span>
          <span><span style={{ color: "#d97706", fontWeight: 700 }}>● AMBER</span> — minor gaps or partial fill</span>
          <span><span style={{ color: "#dc2626", fontWeight: 700 }}>● RED</span> — optional field, sparse by design</span>
        </div>
      </section>

      {/* Next Steps */}
      <section>
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.3rem", letterSpacing: "2px", color: "var(--red)", marginBottom: 6 }}>
          Next Steps
        </h2>
        <p style={{ fontSize: "0.78rem", color: "var(--muted2)", marginBottom: 16 }}>
          As of May 15, 2026 — critical and high-priority items first.
        </p>

        {UPCOMING_14.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.72rem", letterSpacing: "2px", color: "var(--muted2)", marginBottom: 8 }}>
              ⚡ WITHIN 14 DAYS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {UPCOMING_14.map((s, i) => <StepCard key={i} step={s} />)}
            </div>
          </div>
        )}

        <div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.72rem", letterSpacing: "2px", color: "var(--muted2)", marginBottom: 8, marginTop: UPCOMING_14.length > 0 ? 20 : 0 }}>
            UPCOMING & ONGOING
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {UPCOMING_REST.map((s, i) => <StepCard key={i} step={s} />)}
          </div>
        </div>
      </section>
    </div>
  );
}

function StepCard({ step }: { step: typeof NEXT_STEPS[number] }) {
  const cat = step.category;
  const cc  = catColor(cat);
  return (
    <div style={{
      display: "flex", gap: 14, alignItems: "flex-start",
      border: "1.5px solid var(--border)", borderRadius: 6,
      padding: "12px 16px", background: "var(--surface)",
    }}>
      <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 70 }}>
        <UrgencyBadge u={step.urgency} />
        <span style={{
          fontSize: "0.65rem", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "1px",
          background: cc + "18", border: `1px solid ${cc}`, color: cc,
          borderRadius: 3, padding: "1px 7px",
        }}>{cat}</span>
        {step.deadline !== "ASAP" && step.deadline !== "Ongoing" && (
          <span style={{ fontSize: "0.65rem", color: "var(--muted2)" }}>Due {step.deadline}</span>
        )}
        {step.deadline === "ASAP" && (
          <span style={{ fontSize: "0.65rem", color: "#dc2626", fontWeight: 700 }}>ASAP</span>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.9rem", letterSpacing: "1px", color: "var(--text)", marginBottom: 3 }}>{step.title}</div>
        <div style={{ fontSize: "0.78rem", color: "var(--muted2)", lineHeight: 1.5 }}>{step.detail}</div>
      </div>
    </div>
  );
}
