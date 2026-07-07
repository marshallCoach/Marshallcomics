import { useState } from "react";

const BOOKS = [
  { box: "Box 6",  title: "Savage Avengers",             issue: "#1",  price: "$15", writer: "Gerry Duggan" },
  { box: "Box 6",  title: "New Avengers",                issue: "#1",  price: "$10", writer: "Brian Michael Bendis" },
  { box: "Box 6",  title: "Secret Avengers",             issue: "#6",  price: "$12", writer: "Ed Brubaker" },
  { box: "Box 13", title: "Invincible Iron Man",         issue: "#1",  price: "$10", writer: "Warren Ellis" },
  { box: "Box 13", title: "Iron Man",                    issue: "#1",  price: "$10", writer: "Kieron Gillen" },
  { box: "Box 16", title: "The Amazing Spider-Man",      issue: "#797", price: "$8",  writer: "Dan Slott" },
  { box: "Box 16", title: "The Amazing Spider-Man",      issue: "#798", price: "$8",  writer: "Dan Slott" },
  { box: "Box 22", title: "Hulk",                        issue: "#3,5,8,10,12,14", price: "$60 lot / $8 each", writer: "Jeph Loeb", note: "List as $60 lot first. If no sale in 7 days, split into 6 × $8." },
  { box: "Box 36", title: "The Immortal Thor",           issue: "#1",  price: "$15", writer: "Al Ewing" },
  { box: "Box 43", title: "Batman",                      issue: "#616", price: "$8", writer: "Jeph Loeb" },
  { box: "Box 43", title: "Batman",                      issue: "#617", price: "$8", writer: "Jeph Loeb" },
  { box: "Box 43", title: "Batman",                      issue: "#618", price: "$8", writer: "Jeph Loeb" },
  { box: "Box 54", title: "Batman/Superman: World's Finest", issue: "#50", price: "$12", writer: "Mark Waid" },
  { box: "Box 72", title: "X-Men",                       issue: "#28", price: "$15", writer: "— (unverified, leave blank)", warn: true },
];

const TEMPLATE = `TITLE: [Series Title] #[Issue] ([Year]) — [Writer] — Raw [Condition]

DESCRIPTION:
[Series Title] #[Issue]
Writer: [Name] · Artist: [Name]
Published: [Year] by [Publisher]

Condition: [Your honest grade] — Ships bagged and boarded
Pages: Full color · Ships within 2 business days

[ONE sentence: why this issue matters]

Buyer protection: 30-day returns accepted.`;

export default function EbayListingGuide() {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const toggle = (id: string) => setOpenSection(s => s === id ? null : id);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px", fontFamily: "var(--font-body, system-ui)" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted, #888)", marginBottom: 4 }}>Organisation</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>eBay Phase 1 — Listing Guide</h1>
        <p style={{ margin: 0, color: "var(--muted, #888)", fontSize: 13 }}>19 books · Prep tonight → Photos tomorrow → List after</p>
      </div>

      {/* Pull list */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12, color: "var(--muted,#888)" }}>The 19 Books — Pull Tonight</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border,#e5e7eb)" }}>
                <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 600 }}>Box</th>
                <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 600 }}>Title</th>
                <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 600 }}>Issue</th>
                <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 600 }}>Price</th>
                <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 600 }}>Writer</th>
              </tr>
            </thead>
            <tbody>
              {BOOKS.map((b, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border,#e5e7eb)", background: b.warn ? "var(--warn-bg,#fefce8)" : undefined }}>
                  <td style={{ padding: "7px 10px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{b.box}</td>
                  <td style={{ padding: "7px 10px" }}>{b.title}</td>
                  <td style={{ padding: "7px 10px", fontVariantNumeric: "tabular-nums" }}>{b.issue}</td>
                  <td style={{ padding: "7px 10px", fontVariantNumeric: "tabular-nums", color: "#16a34a" }}>{b.price}</td>
                  <td style={{ padding: "7px 10px", color: b.warn ? "#b45309" : undefined }}>
                    {b.writer}
                    {b.warn && <span style={{ marginLeft: 6, fontSize: 11, background: "#fef08a", borderRadius: 3, padding: "1px 5px" }}>⚠ unverified</span>}
                    {b.note && <div style={{ fontSize: 11, color: "var(--muted,#888)", marginTop: 3 }}>{b.note}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Stages */}
      {[
        {
          id: "stage1", label: "Stage 1 — Tonight (no photos)",
          content: (
            <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, fontSize: 13 }}>
              <li>Pull all 19 books, stack near your photo setup.</li>
              <li>Grade each book honestly — one grade down if unsure. Write grade on a sticky note per book.</li>
              <li>Confirm eBay Seller Hub: Account Health → Above Standard, free shipping template saved, 30-day returns enabled, payment/bank linked.</li>
              <li>Charge your phone/camera — 40–60 photos minimum.</li>
            </ol>
          )
        },
        {
          id: "stage2", label: "Stage 2 — Morning Photos (natural daylight)",
          content: (
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
              <p style={{ marginTop: 0 }}><strong>Setup:</strong> Window, indirect light. No direct sun (glare). No artificial light (yellow cast). Plain neutral background. Camera directly overhead or straight-on. Flash OFF. Grid lines ON.</p>
              <p><strong>Per book — 3 photos minimum:</strong></p>
              <ol style={{ margin: "0 0 8px", paddingLeft: 20 }}>
                <li>Front cover, full book, straight-on (main listing photo)</li>
                <li>Back cover, same angle</li>
                <li>Spine close-up (shows stress/rolling, makes grade claims believable)</li>
                <li>If damage exists — close-up of the specific flaw (protects against return disputes)</li>
              </ol>
              <p style={{ margin: 0 }}><strong>Workflow:</strong> Complete all angles on one book before moving to the next. Rename or folder photos by title+issue immediately — don't sort 60 IMG_ files later.</p>
            </div>
          )
        },
        {
          id: "stage3", label: "Stage 3 — Listing",
          content: (
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
              <p style={{ marginTop: 0 }}><strong>List individually, not via bulk CSV.</strong> eBay File Exchange is for high-volume identical SKUs. 19 unique books with unique photos and conditions list faster one-at-a-time through the normal Sell flow.</p>
              <p><strong>Listing template:</strong></p>
              <pre style={{ background: "var(--code-bg,#f4f4f5)", borderRadius: 6, padding: "12px 14px", fontSize: 12, overflowX: "auto", margin: "0 0 12px" }}>{TEMPLATE}</pre>
              <p style={{ margin: 0 }}><strong>Order:</strong> List singles first (fastest, builds momentum). Save the Hulk lot decision (lot vs. split) for last.</p>
            </div>
          )
        },
        {
          id: "after", label: "After All 19 Are Listed",
          content: (
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
              <li>Confirm free shipping applied to all 19.</li>
              <li>Screenshot your listings page as a dated record.</li>
              <li>Log the listing date in the inventory (Data Gaps column or a new "Listed Date" note).</li>
            </ul>
          )
        },
      ].map(({ id, label, content }) => (
        <section key={id} style={{ marginBottom: 10, border: "1px solid var(--border,#e5e7eb)", borderRadius: 8, overflow: "hidden" }}>
          <button
            onClick={() => toggle(id)}
            style={{ width: "100%", textAlign: "left", padding: "12px 16px", background: "var(--card-bg,#fafafa)", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            {label}
            <span style={{ fontSize: 12, color: "var(--muted,#888)" }}>{openSection === id ? "▲" : "▼"}</span>
          </button>
          {openSection === id && (
            <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border,#e5e7eb)" }}>
              {content}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
