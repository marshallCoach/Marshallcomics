import { useState } from "react";

function CmdBlock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background:"var(--surface2,rgba(0,0,0,0.12))", border:"1px solid var(--border)", borderRadius:4, padding:"8px 10px", margin:"6px 0", fontFamily:"'Courier New',monospace", fontSize:"0.75rem", lineHeight:1.7, overflowX:"auto" }}>
      {children}
    </div>
  );
}

function Card({ color, title, tag, children, fullWidth }: { color: string; title: string; tag?: string; children: React.ReactNode; fullWidth?: boolean }) {
  const colors: Record<string, string> = { amber:"#e8a020", green:"#3fb950", blue:"#58a6ff", red:"#f85149", purple:"#bc8cff" };
  return (
    <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderLeft:`3px solid ${colors[color]||"var(--border)"}`, borderRadius:6, padding:"14px 16px", gridColumn: fullWidth ? "1 / -1" : undefined }}>
      <div style={{ fontFamily:"'Courier New',monospace", fontSize:"0.75rem", fontWeight:600, color:"var(--text)", marginBottom:10, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
        {title}
        {tag && <span style={{ fontSize:"0.62rem", letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--muted)", background:"var(--border)", padding:"1px 6px", borderRadius:3 }}>{tag}</span>}
      </div>
      {children}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize:"0.75rem", color:"var(--muted)", marginTop:6, lineHeight:1.5 }}>{children}</p>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"2.5px", color:"var(--muted)", marginBottom:12 }}>
      {children}
      <div style={{ flex:1, height:1, background:"var(--border)" }} />
    </div>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:12, marginBottom:36 }}>{children}</div>;
}

const PROBLEMS = [
  { num: "01", q: "Script exits silently / only shows SSL warning", tag: "Script", tagColor: "#3fb950",
    body: <>Almost always: <strong>(a)</strong> wrong directory — overnight script must run from <code>BRB_overnight_script_v2/</code>. <strong>(b)</strong> API key not set — use <code>nohup env COMIC_VINE_API_KEY=… python3 -u</code>. <strong>(c)</strong> Script already ran to completion — check <code>issues.json</code> entry count.</>,
    cmd: <><span style={{color:"var(--muted)"}}>% </span>COMIC_VINE_API_KEY=... python3 run_overnight_v2.py 2&gt;&amp;1 | head -30</> },
  { num: "02", q: "git pull fails — \"divergent branches\"", tag: "Git", tagColor: "#e8a020",
    body: <>Your Mac and Claude Code both have commits the other doesn't. <strong>Don't pull the full branch.</strong> Instead, checkout only the specific files you need.</>,
    cmd: <><span style={{color:"var(--muted)"}}>% </span>git fetch origin claude/upbeat-babbage-2f5gr2<br/><span style={{color:"var(--muted)"}}>% </span>git checkout origin/claude/upbeat-babbage-2f5gr2 -- brb_ebay_pricing.py</> },
  { num: "03", q: "zsh: \"no matches found\" when pasting commands", tag: "zsh", tagColor: "#bc8cff",
    body: <>zsh tries to glob <code>#</code> comments. Never paste commands that include inline comments. Run each command on its own line. Use straight ASCII quotes always — curly/smart quotes cause <code>dquote&gt;</code> errors.</>,
    cmd: null },
  { num: "04", q: "gen_data.mjs fails — \"Cannot find inventory sheet\"", tag: "Site", tagColor: "#f85149",
    body: <><strong>(a)</strong> Sheet name doesn't start with <code>✅ Clean Inventory</code> — rename it. <strong>(b)</strong> <code>Box Summary</code> sheet is missing — copy from master XLSX.</>,
    cmd: <><span style={{color:"var(--muted)"}}>% </span>python3 -c "import openpyxl; wb=openpyxl.load_workbook('attached_assets/FILE.xlsx', read_only=True); print(wb.sheetnames)"</> },
  { num: "05", q: "\"Which inventory file is authoritative right now?\"", tag: "Data", tagColor: "#58a6ff",
    body: <>Always check the <strong>Data Integrity Log tab</strong> inside the xlsx first. Current authoritative working file: <code>comics_inventory_0407_1400_VALIDATED.xlsx</code> (10,899 rows). Validator baseline: Rule 5 (5 boxes over cap) · Rule 6 (354 same-box dupes — genuine distinct copies).</>,
    cmd: null },
  { num: "06", q: "Validator shows CGC rows flagged as invalid", tag: "Data", tagColor: "#58a6ff",
    body: <>BOX_STATUS_ALLOWLIST: <code>AT CGC</code>, <code>AT MAGIC PRESSING → CGC</code>, <code>AT CGC — Roy Thomas SS</code>, <code>UNKNOWN — needs physical reassignment</code>. If a new status string appears, add it to both <code>brb_validate.py</code> and <code>brb_invalid_boxes.py</code>.</>,
    cmd: null },
  { num: "07", q: "Wrong cover image showing for a book", tag: "Site", tagColor: "#f85149",
    body: <>Null it out and re-fetch. Two commands.</>,
    cmd: <><span style={{color:"var(--muted)"}}>% </span>python3 brb_null_covers.py "Title" issue#<br/><span style={{color:"var(--muted)"}}>% </span>node fetchCovers.mjs --retry-nulls</> },
  { num: "08", q: "eBay pricing script crashes mid-run", tag: "Script", tagColor: "#3fb950",
    body: <>Results already fetched are saved. Re-run — books priced within 7 days are skipped. Most common crash: NaN issue number. Pull latest script before re-running.</>,
    cmd: <><span style={{color:"var(--muted)"}}>% </span>git fetch origin claude/upbeat-babbage-2f5gr2<br/><span style={{color:"var(--muted)"}}>% </span>git checkout origin/claude/upbeat-babbage-2f5gr2 -- brb_ebay_pricing.py<br/><span style={{color:"var(--muted)"}}>% </span>python3 brb_ebay_pricing.py --min-value 3 --limit 1000</> },
  { num: "09", q: "Overnight script ran but artists/covers still blank", tag: "Script", tagColor: "#3fb950",
    body: <><strong>(a)</strong> <code>issues.json</code> has titles logged as FILLED or SKIPPED — clear it (back up first) and re-run. <strong>(b)</strong> Output file needs to be reingested for new columns to appear on site.</>,
    cmd: <><span style={{color:"var(--muted)"}}>% </span>cp issues.json issues_backup.json &amp;&amp; echo "[]" &gt; issues.json</> },
  { num: "10", q: "Asking Claude Code to validate inventory files", tag: "Data", tagColor: "#58a6ff",
    body: <>Claude Code does not have the xlsx — it lives on your Mac only. Run <code>brb_validate.py</code> locally and paste the output into chat. Say: "here is the validator output — go rule by rule." Never accept a diagnosis without seeing the actual output first.</>,
    cmd: <><span style={{color:"var(--muted)"}}>% </span>python3 brb_validate.py 2&gt;&amp;1</> },
];

export default function OpsReference() {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (num: string) => setOpen(prev => { const n = new Set(prev); n.has(num) ? n.delete(num) : n.add(num); return n; });

  return (
    <div style={{ padding:"24px 24px 80px", maxWidth:1080, margin:"0 auto" }}>
      {/* Header */}
      <div style={{ borderBottom:"1px solid var(--border)", paddingBottom:16, marginBottom:28, display:"flex", alignItems:"baseline", gap:16, flexWrap:"wrap" }}>
        <span style={{ fontFamily:"'Courier New',monospace", fontSize:"1rem", fontWeight:600, color:"#e8a020", letterSpacing:"0.03em" }}>~/marshallcomics — ops reference</span>
        <span style={{ fontFamily:"'Courier New',monospace", fontSize:"0.75rem", color:"var(--muted)" }}>branch: claude/upbeat-babbage-2f5gr2</span>
        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"2px", padding:"2px 8px", border:"1px solid var(--border)", borderRadius:3, color:"var(--muted)" }}>JULY 2026</span>
      </div>

      {/* Environment */}
      <SectionLabel>Environment — set these first, every session</SectionLabel>
      <CardGrid>
        <Card color="amber" title="eBay Pricing API" tag="required for brb_ebay_pricing.py">
          <CmdBlock>
            <div><span style={{color:"var(--muted)"}}>% </span><span style={{color:"#e8a020"}}>export</span> EBAY_APP_ID=<span style={{color:"#58a6ff"}}>{"<your-app-id>"}</span></div>
            <div><span style={{color:"var(--muted)"}}>% </span><span style={{color:"#e8a020"}}>export</span> EBAY_CERT_ID=<span style={{color:"#58a6ff"}}>{"<your-cert-id>"}</span></div>
          </CmdBlock>
          <Note>Both vars must be <strong>exported</strong> in the same shell session. Add to <code>~/.zshrc</code> to avoid setting each time.</Note>
        </Card>
        <Card color="green" title="Comic Vine API" tag="required for overnight script">
          <CmdBlock>
            <div><span style={{color:"var(--muted)"}}>% </span><span style={{color:"#e8a020"}}>export</span> COMIC_VINE_API_KEY=<span style={{color:"#58a6ff"}}>{"<your-api-key>"}</span></div>
          </CmdBlock>
          <Note>Rate limit: 200 req/hr. Script uses 20s delay to stay safe.</Note>
        </Card>
      </CardGrid>

      {/* Python scripts */}
      <SectionLabel>Python scripts — run from ~/marshallcomics/</SectionLabel>
      <CardGrid>
        <Card color="amber" title="brb_validate.py" tag="read-only · 10 checks">
          <CmdBlock>
            <div><span style={{color:"var(--muted)"}}>% </span>python3 brb_validate.py</div>
            <div><span style={{color:"var(--muted)"}}>% </span>python3 brb_validate.py --prev attached_assets/FILE.xlsx</div>
          </CmdBlock>
          <Note>BOX_CAPACITY_DEFAULT=240; exceptions: 15=150, 23=155, 40=80, 44=200, 72=80. Current baseline: Rule 6 (354 same-box dupes) · Rule 5 (5 boxes over cap).</Note>
        </Card>
        <Card color="green" title="brb_fill_rates.py" tag="writers · artists · covers">
          <CmdBlock>
            <div><span style={{color:"var(--muted)"}}>% </span>python3 brb_fill_rates.py</div>
            <div><span style={{color:"var(--muted)"}}>% </span>python3 brb_fill_rates.py --prev comics_inventory_PREV.xlsx</div>
          </CmdBlock>
        </Card>
        <Card color="amber" title="brb_ebay_pricing.py" tag="eBay sold comps">
          <CmdBlock>
            <div><span style={{color:"var(--muted)"}}>% </span>python3 brb_ebay_pricing.py --dry-run</div>
            <div><span style={{color:"var(--muted)"}}>% </span>python3 brb_ebay_pricing.py</div>
            <div><span style={{color:"var(--muted)"}}>% </span>python3 brb_ebay_pricing.py --min-value 3 --limit 1000</div>
          </CmdBlock>
          <Note>Results saved to <code>ebay_pricing_results.json</code>. Books priced within 7 days are skipped automatically.</Note>
        </Card>
        <Card color="blue" title="brb_null_covers.py" tag="fix wrong covers">
          <CmdBlock>
            <div><span style={{color:"var(--muted)"}}>% </span>python3 brb_null_covers.py "Batman and Robin" 4.9 "U.S. Agent" 1</div>
            <div><span style={{color:"var(--muted)"}}>% </span>node fetchCovers.mjs --retry-nulls</div>
          </CmdBlock>
        </Card>
        <Card color="red" title="brb_purge.py" tag="safe row removal · audit trail">
          <CmdBlock>
            <div><span style={{color:"var(--muted)"}}>% </span>python3 brb_purge.py --dry-run --reason "phantom" "Title" issue#</div>
            <div><span style={{color:"var(--muted)"}}>% </span>python3 brb_purge.py --reason "physical audit" "Title" issue#</div>
          </CmdBlock>
          <Note>Copies purged row to <code>🗑 Purged</code> sheet and appends to <code>purge_log.json</code>. Type <strong>yes</strong> to confirm.</Note>
        </Card>
        <Card color="blue" title="brb_invalid_boxes.py" tag="find bad box numbers">
          <CmdBlock><div><span style={{color:"var(--muted)"}}>% </span>python3 brb_invalid_boxes.py</div></CmdBlock>
          <Note>Exports <code>invalid_boxes_to_fix.csv</code>. AT CGC / AT MAGIC PRESSING rows are excluded.</Note>
        </Card>
      </CardGrid>

      {/* Process management */}
      <SectionLabel>Finding &amp; killing running scripts</SectionLabel>
      <CardGrid>
        <Card color="amber" title="Find all running BRB scripts">
          <CmdBlock>
            <div><span style={{color:"var(--muted)"}}>% </span>pgrep -lf "brb_\|run_overnight"</div>
            <div><span style={{color:"var(--muted)"}}>% </span>ps aux | grep -E "brb_|run_overnight" | grep -v grep</div>
          </CmdBlock>
        </Card>
        <Card color="red" title="Kill scripts">
          <CmdBlock>
            <div><span style={{color:"var(--muted)"}}>% </span>kill 47536</div>
            <div><span style={{color:"var(--muted)"}}>% </span>pkill -f run_overnight_v2.py</div>
            <div><span style={{color:"var(--muted)"}}>% </span>pkill -f "brb_ebay_pricing|brb_purge|run_overnight_v2"</div>
          </CmdBlock>
          <Note><strong>Safe to kill anytime:</strong> overnight script writes checkpoints every 25 titles. eBay pricing saves every 10 fetches. Kill = pause, not data loss.</Note>
        </Card>
      </CardGrid>

      {/* Overnight script */}
      <SectionLabel>Overnight writer / artist / cover artist fill</SectionLabel>
      <CardGrid>
        <Card color="green" title="Start the overnight script">
          <CmdBlock>
            <div><span style={{color:"var(--muted)"}}>% </span>cd ~/marshallcomics/BRB_overnight_script_v2</div>
            <div><span style={{color:"var(--muted)"}}>% </span>nohup env COMIC_VINE_API_KEY=<span style={{color:"#58a6ff"}}>{"<your-api-key>"}</span> python3 -u run_overnight_v2.py &gt; overnight_log.txt 2&gt;&amp;1 &amp;</div>
            <div><span style={{color:"var(--muted)"}}>% </span>echo PID: $!</div>
          </CmdBlock>
          <Note>Run the <code>nohup …&amp;</code> line alone first, then <code>echo PID: $!</code> separately. Never chain them on one line.</Note>
        </Card>
        <Card color="amber" title="Check if it's running">
          <CmdBlock>
            <div><span style={{color:"var(--muted)"}}>% </span>pgrep -lf run_overnight_v2.py</div>
            <div><span style={{color:"var(--muted)"}}>% </span>tail -f overnight_log.txt</div>
            <div><span style={{color:"var(--muted)"}}>% </span>grep -c '"category": "FILLED"' issues.json</div>
          </CmdBlock>
        </Card>
        <Card color="blue" title="After it finishes — reingest the output">
          <CmdBlock>
            <div><span style={{color:"var(--muted)"}}>% </span>ls -lt ~/marshallcomics/BRB_overnight_script_v2/*.xlsx | head -3</div>
            <div><span style={{color:"var(--muted)"}}>% </span>cp BRB_overnight_script_v2/FILE.xlsx attached_assets/FILE_VALIDATED.xlsx</div>
            <div><span style={{color:"var(--muted)"}}>% </span>node gen_data.mjs</div>
          </CmdBlock>
          <Note><code>gen_data.mjs</code> needs: (1) sheet name starting with <code>✅ Clean Inventory</code>, (2) a <code>Box Summary</code> sheet present.</Note>
        </Card>
        <Card color="red" title="Reset issues.json to re-run (new logic)">
          <CmdBlock>
            <div><span style={{color:"var(--muted)"}}>% </span>cp issues.json issues_run1_backup.json</div>
            <div><span style={{color:"var(--muted)"}}>% </span>echo "[]" &gt; issues.json</div>
          </CmdBlock>
          <Note>Required when you've updated the script logic and want it to re-process all titles.</Note>
        </Card>
      </CardGrid>

      {/* Git */}
      <SectionLabel>Git — working branch: claude/upbeat-babbage-2f5gr2</SectionLabel>
      <CardGrid>
        <Card color="amber" title="Pull latest from Claude Code → your Mac">
          <CmdBlock>
            <div><span style={{color:"var(--muted)"}}>% </span>git stash -u</div>
            <div><span style={{color:"var(--muted)"}}>% </span>git pull --rebase origin claude/upbeat-babbage-2f5gr2</div>
            <div><span style={{color:"var(--muted)"}}>% </span>git stash pop</div>
          </CmdBlock>
        </Card>
        <Card color="green" title="Commit and push">
          <CmdBlock>
            <div><span style={{color:"var(--muted)"}}>% </span>git status</div>
            <div><span style={{color:"var(--muted)"}}>% </span>git add brb_ebay_pricing.py brb_validate.py</div>
            <div><span style={{color:"var(--muted)"}}>% </span>git commit -m "fix ebay: handle NaN issue numbers"</div>
            <div><span style={{color:"var(--muted)"}}>% </span>git push -u origin claude/upbeat-babbage-2f5gr2</div>
          </CmdBlock>
        </Card>
        <Card color="blue" title="Check what changed">
          <CmdBlock>
            <div><span style={{color:"var(--muted)"}}>% </span>git log --oneline -8</div>
            <div><span style={{color:"var(--muted)"}}>% </span>git show --stat HEAD</div>
            <div><span style={{color:"var(--muted)"}}>% </span>git diff --stat</div>
          </CmdBlock>
        </Card>
        <Card color="red" title="Diverged branches — fix without losing work">
          <CmdBlock>
            <div><span style={{color:"var(--muted)"}}>% </span>git fetch origin claude/upbeat-babbage-2f5gr2</div>
            <div><span style={{color:"var(--muted)"}}>% </span>git checkout origin/claude/upbeat-babbage-2f5gr2 -- FILENAME</div>
          </CmdBlock>
        </Card>
      </CardGrid>

      {/* Reingest + deploy */}
      <SectionLabel>Reingest pipeline — full sequence</SectionLabel>
      <CardGrid>
        <Card color="amber" title="Full reingest + deploy sequence" fullWidth>
          <CmdBlock>
            <div><span style={{color:"var(--muted)"}}>% </span>python3 brb_validate.py</div>
            <div><span style={{color:"var(--muted)"}}>% </span>python3 brb_fill_rates.py</div>
            <div><span style={{color:"var(--muted)"}}>% </span>node gen_data.mjs</div>
            <div><span style={{color:"var(--muted)"}}>% </span>git add artifacts/comics-inventory/src/data/data3.ts public/covers.json</div>
            <div><span style={{color:"var(--muted)"}}>% </span>git commit -m "reingest: MMDD_HHMM — N rows"</div>
            <div><span style={{color:"var(--muted)"}}>% </span>git push -u origin claude/upbeat-babbage-2f5gr2</div>
          </CmdBlock>
          <Note>GitHub Actions will auto-build and deploy to GitHub Pages on push to the branch.</Note>
        </Card>
      </CardGrid>

      {/* Divider */}
      <div style={{ height:1, background:"var(--border)", margin:"4px 0 28px" }} />

      {/* Top 10 problems */}
      <SectionLabel>10 most common asks &amp; problems</SectionLabel>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {PROBLEMS.map(p => (
          <div key={p.num} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:6, overflow:"hidden" }}>
            <div
              onClick={() => toggle(p.num)}
              style={{ padding:"11px 14px", display:"flex", alignItems:"baseline", gap:10, cursor:"pointer", userSelect:"none" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2,rgba(0,0,0,0.08))")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}
            >
              <span style={{ fontFamily:"'Courier New',monospace", fontSize:"0.68rem", color:"var(--muted)", flexShrink:0, width:22 }}>{p.num}</span>
              <span style={{ fontSize:"0.82rem", fontWeight:500, color:"var(--text)", flex:1 }}>{p.q}</span>
              <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"0.08em", textTransform:"uppercase", padding:"2px 6px", borderRadius:3, flexShrink:0, background:`${p.tagColor}15`, color:p.tagColor, border:`1px solid ${p.tagColor}30` }}>{p.tag}</span>
            </div>
            {open.has(p.num) && (
              <div style={{ padding:"0 14px 14px 46px", borderTop:"1px solid var(--border)" }}>
                <p style={{ fontSize:"0.82rem", color:"var(--muted)", margin:"10px 0 8px", lineHeight:1.6 }}>{p.body}</p>
                {p.cmd && <CmdBlock><div style={{ color:"var(--muted2,#aaa)" }}>{p.cmd}</div></CmdBlock>}
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        code { font-family: 'Courier New', monospace; font-size: 0.8em; background: var(--surface2, rgba(0,0,0,0.12)); padding: 1px 5px; border-radius: 3px; color: var(--text); }
      `}</style>
    </div>
  );
}
