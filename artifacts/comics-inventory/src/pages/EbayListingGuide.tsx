import { useState } from "react";
import sellDupes from "@/data/ebaySellDupes.json";

// Primary content: DUPLICATES you can safely sell (same Title+Issue+Year held as
// 2+ copies across real storage boxes — keep one, sell the extras). Computed from
// data3.ts by brb_sell_dupes.py, so it self-maintains after every pipeline run.
// The hand-picked "original 14" quick-sell list stays at the bottom for reference.
interface Dup {
  title: string; issue: string; year: string; volume: string; publisher: string;
  writer: string; copies: number; sellable: number; sellValue: number;
  sellBoxes: string[]; keepBoxes: string[]; boxes: string[]; keepSigned: boolean; sameBox: boolean;
}
const DUPES = sellDupes.rows as Dup[];

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

const money = (n: number) => "$" + Math.round(n).toLocaleString();

export default function EbayListingGuide() {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const toggle = (id: string) => setOpenSection(s => s === id ? null : id);

  return (
    <div style={{ maxWidth: "calc(860px + var(--wide))", margin: "0 auto", padding: "24px 16px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted, #888)", marginBottom: 4 }}>Sell the extras first</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 4px" }}>eBay — Duplicates You Can Sell</h1>
        <p style={{ margin: 0, color: "var(--muted, #888)", fontSize: 14 }}>
          Books you own <b>2+ copies</b> of across your storage boxes. Keep one, sell the rest — zero cost to your collection. Auto-updates each pipeline run.
        </p>
      </div>

      {/* Headline stats */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 22 }}>
        {[
          { lbl: "Duplicate titles", val: String(sellDupes.groupCount) },
          { lbl: "Copies to sell", val: String(sellDupes.sellableCount) },
          { lbl: "Realizable value", val: money(sellDupes.estValue), hi: true },
        ].map(s => (
          <div key={s.lbl} style={{ flex: "1 1 150px", border: "1.5px solid var(--border,#e5e7eb)", borderRadius: 10, padding: "12px 14px", background: "var(--surface,#fff)" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted,#888)", fontWeight: 700 }}>{s.lbl}</div>
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.05, marginTop: 3, color: s.hi ? "#16a34a" : "var(--text)", fontVariantNumeric: "tabular-nums" }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Sellable duplicates — ranked by value */}
      <section style={{ marginBottom: 30 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, color: "var(--muted,#888)" }}>Duplicates — safe to sell · ranked by value</h2>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--muted,#888)", lineHeight: 1.5 }}>
          CC cover boxes and status boxes (AT CGC / UNKNOWN) are excluded — those are never duplicates. Value shown is what the <b>spare</b> copies are worth (NM): you keep your best copy and sell the rest, so a signed/slab copy is kept, never sold. A <b>keep slab</b> tag means one copy is signed or graded — hold that one. <b>same-box</b> means both copies sit in one box.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border,#e5e7eb)" }}>
                <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 600 }}>#</th>
                <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 600 }}>Book</th>
                <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 600 }}>Sell</th>
                <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 600 }}>Keep</th>
                <th style={{ textAlign: "right", padding: "6px 10px", fontWeight: 600 }}>Spare value</th>
              </tr>
            </thead>
            <tbody>
              {DUPES.map((d, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border,#e5e7eb)" }}>
                  <td style={{ padding: "7px 10px", color: "var(--muted,#888)", fontVariantNumeric: "tabular-nums" }}>{i + 1}</td>
                  <td style={{ padding: "7px 10px" }}>
                    <span style={{ fontWeight: 600 }}>{d.title}</span> #{d.issue}
                    <span style={{ color: "var(--muted,#888)" }}> ({d.year}){d.volume && d.volume !== "1" ? ` · Vol ${d.volume}` : ""}</span>
                    {d.keepSigned && <span style={{ marginLeft: 6, fontSize: 11, background: "var(--blue-bg,#e8f0ff)", color: "var(--blue-text,#1a4a99)", borderRadius: 3, padding: "1px 5px", fontWeight: 700 }}>keep slab</span>}
                    {d.sameBox && <span style={{ marginLeft: 6, fontSize: 11, background: "var(--warn-bg,#fef08a)", color: "#92600a", borderRadius: 3, padding: "1px 5px", fontWeight: 700 }}>same-box</span>}
                  </td>
                  <td style={{ padding: "7px 10px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{d.sellable} <span style={{ color: "var(--muted,#888)" }}>· box {d.sellBoxes.join(", ")}</span></td>
                  <td style={{ padding: "7px 10px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: "var(--muted,#888)" }}>box {d.keepBoxes.join(", ")}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: d.sellValue >= 25 ? "#16a34a" : "var(--text)", fontWeight: d.sellValue >= 25 ? 700 : 400 }}>{d.sellValue ? money(d.sellValue) : "—"}</td>
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
            <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, fontSize: 14 }}>
              <li>Pull the duplicates you're selling, stack near your photo setup.</li>
              <li>Grade each book honestly — one grade down if unsure. Write grade on a sticky note per book.</li>
              <li>Confirm eBay Seller Hub: Account Health → Above Standard, free shipping template saved, 30-day returns enabled, payment/bank linked.</li>
              <li>Charge your phone/camera — 40–60 photos minimum.</li>
            </ol>
          )
        },
        {
          id: "stage2", label: "Stage 2 — Morning Photos (natural daylight)",
          content: (
            <div style={{ fontSize: 14, lineHeight: 1.8 }}>
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
            <div style={{ fontSize: 14, lineHeight: 1.8 }}>
              <p style={{ marginTop: 0 }}><strong>List individually, not via bulk CSV.</strong> eBay File Exchange is for high-volume identical SKUs. Unique books with unique photos and conditions list faster one-at-a-time through the normal Sell flow.</p>
              <p><strong>Listing template:</strong></p>
              <pre style={{ background: "var(--code-bg,#f4f4f5)", borderRadius: 6, padding: "12px 14px", fontSize: 14, overflowX: "auto", margin: "0 0 12px" }}>{TEMPLATE}</pre>
              <p style={{ margin: 0 }}><strong>Order:</strong> List the high-value duplicates first (fastest ROI, builds momentum). Save any lot-vs-split decision for last.</p>
            </div>
          )
        },
        {
          id: "after", label: "After They're Listed",
          content: (
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
              <li>Confirm free shipping applied to all.</li>
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
            <span style={{ fontSize: 14, color: "var(--muted,#888)" }}>{openSection === id ? "▲" : "▼"}</span>
          </button>
          {openSection === id && (
            <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border,#e5e7eb)" }}>
              {content}
            </div>
          )}
        </section>
      ))}

      {/* Original 14 — hand-picked quick-sell reference */}
      <section style={{ marginTop: 34, paddingTop: 20, borderTop: "2px solid var(--border,#e5e7eb)" }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, color: "var(--muted,#888)" }}>The original 14 — hand-picked quick-sell</h2>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--muted,#888)", lineHeight: 1.5 }}>
          These were hand-selected as books that sell fast on eBay (19 physical copies, counting the Hulk lot). Kept here for reference — see the Seller Dashboard / eBay Pipeline pages for pricing and workflow detail.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
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
                    {b.warn && <span style={{ marginLeft: 6, fontSize: 14, background: "#fef08a", borderRadius: 3, padding: "1px 5px" }}>⚠ unverified</span>}
                    {b.note && <div style={{ fontSize: 14, color: "var(--muted,#888)", marginTop: 3 }}>{b.note}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p style={{ marginTop: 26, fontSize: 12, color: "var(--muted,#888)", lineHeight: 1.5 }}>
        Duplicate list generated {sellDupes.generatedAt} from {sellDupes.source} · {sellDupes.groupCount} titles with extras. Re-run <code>brb_sell_dupes.py</code> after each pipeline run to refresh.
      </p>
    </div>
  );
}
