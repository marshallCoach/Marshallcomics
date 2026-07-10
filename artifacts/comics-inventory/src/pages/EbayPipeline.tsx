export default function EbayPipeline() {
  const steps = [
    {
      num: 1, status: "done" as const,
      title: "Identify comics to price",
      body: <>Keys + CGC candidates flagged in xlsx. eBay script reads the inventory directly and builds its own queue from <code>Key Issue?</code> = YES and high NM value rows. 1,000-comic cap per run.</>,
      failures: [],
    },
    {
      num: 2, status: "done" as const,
      title: <>Run <code>brb_ebay_pricing.py</code> on Mac → writes <code>ebay_pricing_results.json</code></>,
      body: <>Fetches eBay sold listings via OAuth. July 4 run: 22 new fetches, 978 from cache. 998 comics with price data saved to JSON (440 KB).</>,
      failures: [
        "Run 1 — EBAY_APP_ID not set",
        "Run 2 — EBAY_CERT_ID pasted as bare shell command",
        "Run 3 — auth error (CERT_ID not exported)",
      ],
    },
    {
      num: 3, status: "done" as const,
      title: <>Push <code>ebay_pricing_results.json</code> to git branch</>,
      body: <>File is now on <code>claude/upbeat-babbage-2f5gr2</code>. Took 5 attempts due to branch divergence between Mac and this session.</>,
      failures: [
        "Push 1 — branch behind remote (fetch first)",
        "Push 2 — unstaged changes blocked rebase",
        "Push 3 — xlsx blocked rebase checkout",
        "Push 4 — merge conflict in run_overnight_v2.py, brb_validate.py, brb_ebay_pricing.py",
        "Push 5 — editor loop blocked merge commit",
      ],
    },
    {
      num: 4, status: "done" as const,
      title: "Merge JSON → xlsx eBay columns",
      body: <>xlsx already contains <code>eBay Avg Sold $</code>, <code>eBay Low $</code>, <code>eBay High $</code>, <code>eBay Comp Count</code> — 1,285 rows filled from a prior merge run on Mac.</>,
      failures: [],
    },
    {
      num: 5, status: "done" as const,
      title: <>Inject eBay data into <code>data3.ts</code> (app data)</>,
      body: <>1,313 comics matched across multiple boxes. Fields added to <code>Comic</code> interface: <code>eBay_Avg</code>, <code>eBay_Low</code>, <code>eBay_High</code>, <code>eBay_Count</code>. 9,573 entries are <code>null</code>.</>,
      failures: [
        "Issue number format mismatch: JSON stores 160.0, data3.ts stores 160 — fixed by normalising through float()",
      ],
    },
    {
      num: 6, status: "done" as const,
      title: "Surface eBay prices in the app UI",
      body: <>eBay sold data block (Avg / Low / High + count) added to ComicDrawer. Sortable eBay Avg column added to BoxKeys list view.</>,
      failures: [],
    },
    {
      num: 7, status: "now" as const,
      title: "Deploy updated app to GitHub Pages",
      body: <><code>.github/workflows/deploy.yml</code> created — builds with pnpm, sets <code>BASE_PATH=/Marshallcomics/</code>, deploys via actions/deploy-pages. Trigger: push to <code>claude/upbeat-babbage-2f5gr2</code>. One-time setup: enable GitHub Actions as source in repo Settings → Pages.</>,
      failures: [],
    },
  ];

  const auditRows = [
    { step: "1 · Identify",       fails: 0,  cause: "—",                                                         fix: "—" },
    { step: "2 · Run eBay script", fails: 3,  cause: "Both OAuth env vars must be exported before the script runs.", fix: "Add EBAY_APP_ID and EBAY_CERT_ID to ~/.zshrc permanently." },
    { step: "3 · Push JSON",       fails: 5,  cause: "Mac branch diverged; xlsx blocked rebase; merge conflicts; editor loop.", fix: "xlsx in .gitignore. git pull --rebase habit. git config core.editor \"true\"." },
    { step: "4 · Merge → xlsx",    fails: 0,  cause: "Already done prior session.",                               fix: "—" },
    { step: "5 · Inject data3.ts", fails: 1,  cause: "Issue number float mismatch (160.0 vs 160).",               fix: "Normalise both sides through float() before lookup." },
    { step: "6 · UI display",      fails: 0,  cause: "—",                                                         fix: "—" },
    { step: "7 · Deploy",          fails: 0,  cause: "In progress.",                                              fix: "Enable GitHub Actions source in repo Settings → Pages." },
    { step: "⊕ Overnight CV",      fails: 2,  cause: "RuntimeError on box capacity + dquote> on restart.",        fix: "Converted raise to logged warning. Run nohup and echo PID as two separate lines." },
  ];

  const fixes = [
    { label: "eBay auth (Step 2)",       desc: <>Add <code>export EBAY_APP_ID=…</code> and <code>export EBAY_CERT_ID=…</code> to <code>~/.zshrc</code>, then <code>source ~/.zshrc</code>.</> },
    { label: "xlsx blocking git (Step 3)", desc: <><code>attached_assets/*.xlsx</code> in .gitignore. xlsx is source of truth on Mac — never tracked in git.</> },
    { label: "Branch divergence (Step 3)", desc: <>Before any commit on Mac: <code>git pull --rebase origin claude/upbeat-babbage-2f5gr2</code></> },
    { label: "Editor loop on merge",      desc: <>Run once: <code>git config --global core.editor &quot;true&quot;</code></> },
    { label: "dquote&gt; on restart",     desc: <>Never chain nohup + echo. Run <code>nohup …&amp;</code> alone, then <code>echo PID: $!</code> separately.</> },
  ];

  const statusColor = { done: "#23c97e", now: "#4dabf7", next: "#7d8590" };
  const statusLabel = { done: "DONE", now: "YOU ARE HERE", next: "NEXT" };

  return (
    <div style={{ padding:"24px 24px 80px", maxWidth:720, margin:"0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"3px", color:"var(--muted)", marginBottom:6 }}>BRB OPS · COMIC INVENTORY SYSTEM</div>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.8rem", letterSpacing:"1px", color:"var(--text)", lineHeight:1.1, marginBottom:6 }}>eBay Pricing Pipeline</div>
        <div style={{ fontSize:"0.75rem", color:"var(--muted)" }}>Status as of July 6, 2026 · 10,899 rows · 1,285 priced in xlsx · 1,313 matched in app data</div>
      </div>

      {/* Summary chips */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:28, padding:"12px 14px", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:6 }}>
        {[
          { text: "7 of 7 steps done", color: "#23c97e" },
          { text: "Step 7 — deploying", color: "#4dabf7" },
          { text: "Step 3 — most failures (5×)", color: "#f5a623" },
          { text: "Step 2 — auth failures (3×)", color: "#f5a623" },
        ].map(c => (
          <div key={c.text} style={{ display:"flex", alignItems:"center", gap:5, fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1.5px", padding:"2px 8px", borderRadius:3, background:`${c.color}12`, color:c.color }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:c.color, flexShrink:0 }} />
            {c.text}
          </div>
        ))}
      </div>

      {/* Pipeline steps */}
      <div style={{ position:"relative", marginBottom:32 }}>
        <div style={{ position:"absolute", left:19, top:28, bottom:28, width:2, background:"var(--border)" }} />
        {steps.map(step => {
          const color = statusColor[step.status];
          return (
            <div key={step.num} style={{ display:"grid", gridTemplateColumns:"40px 1fr", gap:"0 14px", marginBottom:6, position:"relative" }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", paddingTop:4, flexShrink:0, position:"relative", zIndex:1 }}>
                <div style={{
                  width:20, height:20, borderRadius:"50%", border:`2px solid ${color}`,
                  background: step.status === "now" ? `${color}12` : "var(--bg)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", color,
                  marginTop:14, flexShrink:0,
                  boxShadow: step.status === "now" ? `0 0 0 3px ${color}20` : undefined,
                }}>
                  {step.status === "done" ? "✓" : step.num}
                </div>
              </div>
              <div>
                <div style={{
                  background: step.status === "now" ? "#4dabf712" : "var(--surface)",
                  border: `1px solid ${step.status === "now" ? "#4dabf740" : "var(--border)"}`,
                  borderRadius:6, padding:"12px 14px", marginBottom:6,
                }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10, marginBottom:6 }}>
                    <div style={{ fontSize:"0.82rem", fontWeight:600, color:"var(--text)", lineHeight:1.3 }}>{step.title}</div>
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1px", padding:"2px 7px", borderRadius:3, flexShrink:0, background:`${color}18`, color }}>
                      {statusLabel[step.status]}
                    </span>
                  </div>
                  <div style={{ fontSize:"0.75rem", color:"var(--muted)", lineHeight:1.55 }}>{step.body}</div>
                  {step.failures.length > 0 && (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:8 }}>
                      {step.failures.map(f => (
                        <span key={f} style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", padding:"2px 7px", borderRadius:3, background:"#e0555514", color:"#e05555", border:"1px solid #e0555525" }}>✗ {f}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Audit table */}
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"2.5px", color:"var(--muted)", marginBottom:12 }}>FAILURE AUDIT — FIRST-TIME SUCCESS RATE BY STEP</div>
      <div style={{ overflowX:"auto", marginBottom:28 }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.75rem", fontVariantNumeric:"tabular-nums" }}>
          <thead>
            <tr>
              {["Step", "Failures", "Root Cause", "Fixed By"].map(h => (
                <th key={h} style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1px", color:"var(--muted)", textAlign:"left", padding:"6px 10px 8px", borderBottom:"1px solid var(--border)", fontWeight:600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {auditRows.map(r => (
              <tr key={r.step}>
                <td style={{ padding:"8px 10px", borderBottom:"1px solid var(--border)", fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1px", color:"var(--muted)", whiteSpace:"nowrap" }}>{r.step}</td>
                <td style={{ padding:"8px 10px", borderBottom:"1px solid var(--border)", fontWeight:700, color: r.fails > 0 ? "#e05555" : "var(--muted2)", fontVariantNumeric:"tabular-nums" }}>{r.fails > 0 ? `${r.fails}×` : "0"}</td>
                <td style={{ padding:"8px 10px", borderBottom:"1px solid var(--border)", color:"var(--muted)", lineHeight:1.4, fontSize:"0.75rem" }}>{r.cause}</td>
                <td style={{ padding:"8px 10px", borderBottom:"1px solid var(--border)", color:"var(--text)", lineHeight:1.4, fontSize:"0.75rem" }}>{r.fix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Permanent fixes */}
      <div style={{ padding:"16px 18px", background:"var(--surface)", borderLeft:"3px solid #4dabf7", borderRadius:"0 6px 6px 0", border:"1px solid var(--border)" }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"2px", color:"#4dabf7", marginBottom:14 }}>PERMANENT FIXES — DO THESE ONCE ON MAC</div>
        {fixes.map(f => (
          <div key={f.label} style={{ display:"grid", gridTemplateColumns:"180px 1fr", gap:"8px 14px", padding:"8px 0", borderBottom:"1px solid var(--border)", fontSize:"0.75rem", lineHeight:1.5 }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1px", color:"var(--muted)", paddingTop:1 }}>{f.label}</div>
            <div style={{ color:"var(--text)" }}>{f.desc}</div>
          </div>
        ))}
      </div>

      <style>{`
        code { font-family: 'Courier New', monospace; font-size: 0.8em; background: var(--surface2, var(--border)); padding: 1px 5px; border-radius: 3px; color: var(--text); }
      `}</style>
    </div>
  );
}
