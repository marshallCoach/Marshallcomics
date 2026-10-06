// Absolute Batman market board — all figures are user-provided market research
// (secondary market + eBay NM raw), not derived from the inventory/eBay pipeline.

interface Row { n: number; secondary: string; ebay: string; hot?: boolean; }
const TABLE: Row[] = [
  { n: 1,  secondary: "$381.00 – $916.00+", ebay: "$275.00 – $495.00", hot: true },
  { n: 2,  secondary: "$20.00 – $40.00",    ebay: "$55.00 – $70.00" },
  { n: 3,  secondary: "$15.00 – $30.00",    ebay: "$40.00 – $60.00" },
  { n: 4,  secondary: "$10.00 – $25.00",    ebay: "$35.00 – $45.00" },
  { n: 5,  secondary: "$10.00 – $25.00",    ebay: "$15.00 – $25.00" },
  { n: 6,  secondary: "$10.00 – $20.00",    ebay: "$25.00 – $60.00", hot: true },
  { n: 7,  secondary: "$10.00 – $20.00",    ebay: "$15.00 – $25.00" },
  { n: 8,  secondary: "$10.00 – $20.00",    ebay: "$15.00 – $25.00" },
  { n: 9,  secondary: "$8.00 – $15.00",     ebay: "$45.00 – $60.00", hot: true },
  { n: 10, secondary: "$8.00 – $15.00",     ebay: "$10.00 – $20.00" },
  { n: 11, secondary: "$8.00 – $15.00",     ebay: "$10.00 – $20.00" },
  { n: 12, secondary: "$8.00 – $15.00",     ebay: "$10.00 – $20.00" },
  { n: 13, secondary: "$8.00 – $15.00",     ebay: "$34.99 – $50.00", hot: true },
  { n: 14, secondary: "$5.95 – $15.00",     ebay: "$10.00 – $15.00" },
  { n: 15, secondary: "$5.95 – $15.00",     ebay: "$10.00 – $15.00" },
  { n: 16, secondary: "$5.95 – $12.00",     ebay: "$10.00 – $15.00" },
  { n: 17, secondary: "$5.95 – $12.00",     ebay: "$8.00 – $12.00" },
  { n: 18, secondary: "$5.95 – $12.00",     ebay: "$8.00 – $12.00" },
  { n: 19, secondary: "$5.95 – $12.00",     ebay: "$8.00 – $12.00" },
  { n: 20, secondary: "$5.00 – $15.00 (NM premium)", ebay: "$5.99 – $9.99", hot: true },
  { n: 21, secondary: "$10.00 – $25.00",    ebay: "$20.00 – $25.00", hot: true },
  { n: 22, secondary: "$5.95 – $10.00",     ebay: "$5.99 – $10.00" },
  { n: 23, secondary: "$4.99 – $10.00",     ebay: "$4.99 – $10.00" },
  { n: 24, secondary: "$4.95 – $8.00",      ebay: "$4.99 – $8.00" },
];

const WHY = [
  { n: "#1",  t: "First issue of the run — the speculator anchor. Prices sit an order of magnitude above every other issue." },
  { n: "#20", t: "Robins' mech-suit debut + widespread Cover A printer defects made true NM copies rare, so clean copies carry a premium." },
  { n: "#21", t: "Introduction of the Absolute Universe Two-Face — a first-appearance spike." },
];

const C20_SECONDARY: [string, string][] = [
  ["Cover A — Dragotta 1st print", "$1.00 (damaged) – $15.00+ NM · baseline NM from $9.00"],
  ["Cover A — Dragotta 2nd print", "$4.99 – $24.99"],
  ["Robin Recruit variants (Eom, Robles, Rodriguez, Yagawa, Lindsay)", "$4.99 – $15.00"],
  ["1:25 Martin Simmonds incentive", "~$34.95"],
  ["SDCC Philip Tan Anime Robins inks", "~$29.95"],
  ["Comics Elite foil virgin (ltd 1,000)", "$4.00 – $40.00"],
  ["Dexter Soy Big Time Collectibles (One Piece Luffy homage)", "$20.00 – $35.00+"],
];
const C20_EBAY: [string, string][] = [
  ["Cover A — Dragotta 1st print (raw)", "$5.99 – $9.99"],
  ["Cover A — Dragotta 2nd print", "$4.99 – $9.99"],
  ["Kyuyong Eom variant (Robins)", "$5.59 – $7.00"],
  ["1:25 Martin Simmonds incentive (card stock)", "$9.99 – $15.00"],
  ["James Harren Felix Comic Art excl. (card stock)", "$41.99 – $50.00"],
  ["James Harren foil Felix Comic Art (SDCC 2026)", "$85.00 – $100.00"],
  ["Daniel Warren Johnson Felix Comic Art excl. (card stock)", "$84.95 – $95.00"],
  ["Dexter Soy Gear2 AQ B&W sketch secret virgin", "$42.99 – $50.00"],
  ["Dexter Soy Fan Expo GITD virgin sketch", "$69.99 – $80.00"],
  ["Gerald Parel exclusive trade dress", "$16.35 – $20.00"],
];

export default function AbsoluteBatman() {
  return (
    <div className="abw">
      <style>{css}</style>

      <header className="abw-hero">
        <div className="abw-kicker">Secondary market · Cover A only</div>
        <h1>Absolute Batman <em>Market Board</em></h1>
        <p className="abw-sub">Cover A price ranges for the full run #1–#24 — secondary platforms and eBay NM raw, side by side. Variants are excluded from the main table (card-stock Cover A kept); issue #20's full cover breakdown is below.</p>
      </header>

      <div className="abw-intro">
        Absolute Batman prices are inflated by intense speculator demand, artificial scarcity, and the popularity of the Snyder / Dragotta team. Resellers and graders hoard raw copies to manufacture FOMO, pushing retail up fast. Major plot beats — the Robins' mech-suits (#20), the Absolute Two-Face (#21) — cause immediate spikes. Print defects matter too: widespread damage on #20's Cover A made true NM copies rare, adding a premium to clean ones.
      </div>

      <section className="abw-section">
        <div className="abw-sechead"><h2>Why the hot issues spike</h2></div>
        <div className="abw-why">
          {WHY.map(w => (
            <div key={w.n} className="abw-whycard"><span className="n">{w.n}</span><span className="t">{w.t}</span></div>
          ))}
        </div>
      </section>

      <section className="abw-section">
        <div className="abw-sechead"><h2>Cover A — full run</h2><span className="abw-tag">24 issues</span>
          <p className="abw-secsub">Hot rows (⚡) are the first issue, the defect/first-appearance spikes, and issues where eBay NM runs well above card-stock secondary.</p></div>
        <div className="abw-tablewrap">
          <table className="abw-table">
            <thead><tr><th>Issue</th><th>Cover A · secondary</th><th>eBay NM raw</th></tr></thead>
            <tbody>
              {TABLE.map(r => (
                <tr key={r.n} className={r.hot ? "hot" : ""}>
                  <td className="iss">{r.hot && <span className="spark">⚡</span>}Absolute Batman #{r.n}</td>
                  <td className="num">{r.secondary}</td>
                  <td className="num ebay">{r.ebay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="abw-section">
        <div className="abw-sechead"><h2>Issue #20 — cover by cover</h2><span className="abw-tag hot">the defect book</span>
          <p className="abw-secsub">The printer-defect premium and the variant spread. Two markets, same book.</p></div>
        <div className="abw-twocol">
          <div className="abw-tablewrap">
            <div className="abw-coltitle">Secondary market</div>
            <table className="abw-table">
              <tbody>{C20_SECONDARY.map(([c, p], i) => (
                <tr key={i}><td className="cov">{c}</td><td className="num">{p}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <div className="abw-tablewrap">
            <div className="abw-coltitle">eBay NM raw</div>
            <table className="abw-table">
              <tbody>{C20_EBAY.map(([c, p], i) => (
                <tr key={i}><td className="cov">{c}</td><td className="num ebay">{p}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </section>

      <p className="abw-foot">All figures are provided market research (secondary platforms + eBay NM raw) — not pulled from your inventory or the eBay pricing pipeline, and not independently re-verified. Market prices move fast; treat these as a point-in-time snapshot.</p>
    </div>
  );
}

const css = `
.abw{max-width:1000px;margin:0 auto;padding:0 18px 60px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--text)}
.abw h1,.abw h2{margin:0;text-wrap:balance}
.abw-hero{padding:26px 0 14px;border-bottom:3px solid var(--text)}
.abw-kicker{font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);font-weight:700;margin-bottom:6px}
.abw-hero h1{font-size:clamp(2rem,6.5vw,3.3rem);line-height:.95;font-weight:800}
.abw-hero h1 em{font-style:normal;color:#1d4ed8}
.abw-sub{margin-top:9px;max-width:64ch;color:var(--muted2);font-size:1rem;line-height:1.5}
.abw-intro{margin-top:16px;border:1.5px solid var(--border);border-left:5px solid #1d4ed8;border-radius:10px;background:var(--surface);padding:13px 16px;font-size:.92rem;line-height:1.55}
.abw-section{margin-top:28px}
.abw-sechead{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;border-bottom:2px solid var(--border);padding-bottom:7px;margin-bottom:14px}
.abw-sechead h2{font-size:1.35rem;font-weight:800}
.abw-tag{font-size:.64rem;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--muted);background:var(--surface2);border:1px solid var(--border);border-radius:99px;padding:3px 9px}
.abw-tag.hot{color:#b4690e;background:rgba(180,105,14,.16);border-color:rgba(180,105,14,.4)}
.abw-secsub{flex:1 1 100%;margin:-4px 0 0;color:var(--muted2);font-size:.86rem;line-height:1.45}
.abw-why{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:11px}
.abw-whycard{background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:13px 15px;display:flex;flex-direction:column;gap:5px}
.abw-whycard .n{font-weight:800;font-size:1.2rem;color:#1d4ed8}
.abw-whycard .t{font-size:.88rem;color:var(--text2);line-height:1.45}
.abw-tablewrap{overflow-x:auto;border:1.5px solid var(--border);border-radius:12px;background:var(--surface)}
.abw-table{width:100%;border-collapse:collapse;font-size:.9rem}
.abw-table th{text-align:left;font-size:.64rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:700;padding:10px 14px;border-bottom:2px solid var(--border);background:var(--surface2);white-space:nowrap}
.abw-table td{padding:9px 14px;border-bottom:1px solid var(--border);vertical-align:top}
.abw-table tr:last-child td{border-bottom:none}
.abw-table td.iss{font-weight:700;white-space:nowrap}
.abw-table td.cov{color:var(--text2);line-height:1.35;min-width:170px}
.abw-table td.num{font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:600}
.abw-table td.num.ebay{color:#16a34a}
.abw-table tr.hot td{background:rgba(180,105,14,.07)}
.abw-table tr.hot td.iss{color:#b4690e}
.spark{margin-right:5px}
.abw-twocol{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.abw-coltitle{font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--muted);padding:10px 14px 0}
.abw-foot{margin-top:26px;border-top:1px solid var(--border);padding-top:13px;color:var(--muted);font-size:.78rem;line-height:1.5}
@media(max-width:620px){.abw-twocol{grid-template-columns:1fr}}
`;
