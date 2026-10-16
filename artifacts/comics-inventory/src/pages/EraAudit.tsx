import { useMemo, useState } from "react";
import { DATA, type Comic } from "@/data/data";

// Condition audit by age-block. The collection was built in blocks by age, so
// condition clusters by era: you tell me the typical grade for a whole block and
// we apply it as an ESTIMATE (marked "· est."), then refine outliers one-by-one
// in Condition Entry. Signed / key books are held OUT of block-apply by default —
// those deserve an individual grade. Exports the same batch file brb_review_edits
// applies.

const QUICK: [string, string][] = [
  ["NM (9.4)", "Near Mint"], ["VF (8.0)", "Very Fine"], ["FN (6.0)", "Fine"],
  ["VG (4.0)", "Very Good"], ["GD (2.0)", "Good"], ["FR (1.0)", "Fair / Poor"],
];
const FINE = ["NM/M (9.8)", "NM+ (9.6)", "NM- (9.2)", "VF/NM (9.0)", "VF+ (8.5)", "VF- (7.5)",
  "FN/VF (7.0)", "FN+ (6.5)", "VG/FN (5.0)", "VG+ (4.5)", "GD/VG (3.0)"];

const idOf = (c: Comic) => `${c.Title}|||${c.Issue}|||${c.Volume || "1"}|||${c.Box}|||${c.Signed_By || ""}`;
const isSigned = (c: Comic) => /^y/i.test(String(c.Signed || "")) || (!!c.Signed_By && !/^n\/a/i.test(c.Signed_By));
const isKey = (c: Comic) => /^(y|true)/i.test(String(c.Key || ""));
const decadeOf = (c: Comic) => { const y = parseInt(String(c.Year || "")); return isNaN(y) ? "No year" : `${Math.floor(y / 10) * 10}s`; };

export default function EraAudit() {
  const comics = DATA.comics as Comic[];
  const [groupBy, setGroupBy] = useState<"decade" | "era">("decade");
  const [excludeValuable, setExcludeValuable] = useState(true);
  const [markEst, setMarkEst] = useState(true);
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [openFine, setOpenFine] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const blanks = useMemo(() => comics.filter(c => !String(c.Condition || "").trim()), [comics]);

  const blocks = useMemo(() => {
    const m = new Map<string, Comic[]>();
    for (const c of blanks) {
      const k = groupBy === "decade" ? decadeOf(c) : (c.Era || "(no era)");
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    return [...m.entries()]
      .map(([label, items]) => {
        const eligible = excludeValuable ? items.filter(c => !isSigned(c) && !isKey(c)) : items;
        return { label, items, eligible, held: items.length - eligible.length };
      })
      .sort((a, b) => b.eligible.length - a.eligible.length);
  }, [blanks, groupBy, excludeValuable]);

  const gradedCount = Object.keys(grades).length;

  function applyBlock(block: { eligible: Comic[] }, grade: string) {
    const val = markEst ? `${grade} · est.` : grade;
    setGrades(prev => {
      const n = { ...prev };
      for (const c of block.eligible) n[idOf(c)] = val;
      return n;
    });
    setSaved(null);
  }
  function clearBlock(block: { items: Comic[] }) {
    setGrades(prev => {
      const n = { ...prev };
      for (const c of block.items) delete n[idOf(c)];
      return n;
    });
    setSaved(null);
  }
  function blockAssigned(block: { items: Comic[] }) {
    return block.items.reduce((s, c) => s + (grades[idOf(c)] ? 1 : 0), 0);
  }

  function exportBatch() {
    const byId = new Map(blanks.map(c => [idOf(c), c]));
    const edits = Object.entries(grades).map(([id, cond]) => {
      const c = byId.get(id)!;
      return { match: { Title: c.Title, Issue: c.Issue, Volume: c.Volume || "1", Box: c.Box, Signed_By: c.Signed_By || "" }, delete: false, changes: { Condition: cond } };
    });
    const payload = { type: "comic-edit-batch", exportedAt: new Date().toISOString(), fill_only: true, note: "era-audit estimates", edits };
    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const name = `comic_edits_batch_${stamp}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    URL.revokeObjectURL(a.href);
    setSaved(name);
  }

  const tog: React.CSSProperties = { fontFamily: "inherit", fontSize: ".78rem", fontWeight: 600, border: "1.5px solid var(--border,#2c2c38)", background: "var(--surface,#1c1c24)", color: "var(--muted2,#aaa)", borderRadius: 20, padding: "6px 13px", cursor: "pointer" };
  const togOn: React.CSSProperties = { ...tog, background: "var(--red,#c0392b)", borderColor: "var(--red,#c0392b)", color: "#fff" };

  return (
    <div style={{ maxWidth: "calc(820px + var(--wide))", margin: "0 auto", padding: "20px 16px 60px" }}>
      <style>{`
        .ea-g{font-family:inherit;font-weight:700;font-size:.82rem;border:1.5px solid var(--border,#2c2c38);
          background:var(--surface,#1c1c24);color:var(--text,#eee);border-radius:9px;padding:9px 12px;cursor:pointer}
        .ea-g:hover{border-color:var(--red,#c0392b)}
        .ea-g small{color:var(--muted,#888);font-weight:500;margin-left:5px}
        .ea-fine{font-family:inherit;font-size:.75rem;border:1px solid var(--border,#2c2c38);background:var(--surface,#1c1c24);
          color:var(--muted2,#aaa);border-radius:7px;padding:6px 9px;cursor:pointer}
        .ea-fine:hover{border-color:var(--red,#c0392b);color:var(--text,#eee)}
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: "1.6rem" }}>Condition Audit by Age-Block</h1>
          <p style={{ color: "var(--muted,#888)", margin: 0, fontSize: ".88rem", maxWidth: "60ch" }}>
            You built the collection in blocks by age — so tell me the typical grade for each block and we apply it as an <b>estimate</b>. Refine outliers one-by-one in Condition Entry. {blanks.length.toLocaleString()} books still need a grade.
          </p>
        </div>
        <button onClick={exportBatch} disabled={gradedCount === 0}
          style={{ background: gradedCount ? "var(--red,#c0392b)" : "var(--surface2,#26262f)", color: gradedCount ? "#fff" : "var(--muted,#888)", border: "none", borderRadius: 8, padding: "10px 16px", cursor: gradedCount ? "pointer" : "default", font: "inherit", fontWeight: 700, fontSize: ".82rem", whiteSpace: "nowrap" }}>
          Export {gradedCount} grade{gradedCount === 1 ? "" : "s"}
        </button>
      </div>

      {saved && <div style={{ color: "#2ec28a", fontSize: ".82rem", marginTop: 8 }}>✓ Exported {saved} — run <code>python3 brb_review_edits.py --apply</code> (or brb_all).</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0 20px", alignItems: "center" }}>
        <span style={{ fontSize: ".76rem", color: "var(--muted,#888)", textTransform: "uppercase", letterSpacing: ".1em" }}>Group</span>
        <button style={groupBy === "decade" ? togOn : tog} onClick={() => setGroupBy("decade")}>By decade</button>
        <button style={groupBy === "era" ? togOn : tog} onClick={() => setGroupBy("era")}>By era</button>
        <span style={{ width: 1, height: 20, background: "var(--border,#2c2c38)", margin: "0 4px" }} />
        <button style={excludeValuable ? togOn : tog} onClick={() => setExcludeValuable(v => !v)} title="Keep signed & key books out of bulk estimate">{excludeValuable ? "✓ " : ""}Hold out signed/key</button>
        <button style={markEst ? togOn : tog} onClick={() => setMarkEst(v => !v)} title="Append · est. so these read as estimates">{markEst ? "✓ " : ""}Mark as estimate</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {blocks.map(block => {
          const assigned = blockAssigned(block);
          return (
            <div key={block.label} style={{ border: "1px solid var(--border,#2c2c38)", borderRadius: 12, padding: "16px 18px", background: "var(--surface,#1c1c24)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: "1.15rem", fontWeight: 700 }}>{block.label}</div>
                <div style={{ fontSize: ".82rem", color: "var(--muted,#888)" }}>
                  {block.eligible.length.toLocaleString()} to grade{block.held > 0 && <> · <span style={{ color: "var(--gold,#b6882f)" }}>{block.held} signed/key held out</span></>}
                  {assigned > 0 && <> · <span style={{ color: "#2ec28a" }}>{assigned} set</span></>}
                </div>
              </div>
              <div style={{ fontSize: ".8rem", color: "var(--muted2,#aaa)", margin: "4px 0 12px" }}>
                e.g. {block.items.slice(0, 4).map(c => `${c.Title} #${c.Issue}`).join(" · ")}
              </div>
              <div style={{ fontSize: ".84rem", fontWeight: 600, marginBottom: 8 }}>Typical grade for this block?</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {QUICK.map(([g, name]) => (
                  <button key={g} className="ea-g" onClick={() => applyBlock(block, g)} disabled={block.eligible.length === 0}>
                    {g}<small>{name}</small>
                  </button>
                ))}
                <button className="ea-g" style={{ background: "transparent" }} onClick={() => setOpenFine(openFine === block.label ? null : block.label)}>More…</button>
                {assigned > 0 && <button className="ea-g" style={{ background: "transparent", color: "var(--muted,#888)" }} onClick={() => clearBlock(block)}>Clear</button>}
              </div>
              {openFine === block.label && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {FINE.map(g => <button key={g} className="ea-fine" onClick={() => applyBlock(block, g)}>{g}</button>)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 20, padding: "14px 16px", border: "1px dashed var(--border,#2c2c38)", borderRadius: 10, fontSize: ".84rem", color: "var(--muted2,#aaa)" }}>
        <b>How this reads:</b> block estimates are marked “· est.” so they’re never mistaken for a hand-grade. The {blanks.filter(c => isSigned(c) || isKey(c)).length} signed/key books are held out — grade those individually in <b>Condition Entry</b>, where they’re worth the per-book look.
      </div>
    </div>
  );
}
