import { useMemo, useState, useEffect, useCallback } from "react";
import { DATA, type Comic } from "@/data/data";
import { CoverImage } from "@/components/CoverImage";

// Fast grading flow for the ~2,388 books with no Condition. One book at a time,
// big cover, tap a grade (or press 1–6), auto-advance. Filter by box so you grade
// a physical box in one sitting. Exports a batch file → brb_review_edits.py applies
// it (and brb_all picks it up). Grading is physical work; this just makes it quick.

// Common quick grades (keys 1–6) + a finer set behind "More".
const QUICK: [string, string][] = [
  ["NM (9.4)", "Near Mint"], ["VF (8.0)", "Very Fine"], ["FN (6.0)", "Fine"],
  ["VG (4.0)", "Very Good"], ["GD (2.0)", "Good"], ["FR (1.0)", "Fair / Poor"],
];
const FINE: string[] = [
  "GM (10)", "MT (9.9)", "NM/M (9.8)", "NM+ (9.6)", "NM- (9.2)", "VF/NM (9.0)",
  "VF+ (8.5)", "VF- (7.5)", "FN/VF (7.0)", "FN+ (6.5)", "FN- (5.5)", "VG/FN (5.0)",
  "VG+ (4.5)", "VG- (3.5)", "GD/VG (3.0)", "GD+ (2.5)", "PR (0.5)",
];

const idOf = (c: Comic) => `${c.Title}|||${c.Issue}|||${c.Volume || "1"}|||${c.Box}|||${c.Signed_By || ""}`;

export default function ConditionEntry() {
  const comics = DATA.comics as Comic[];
  const [boxFilter, setBoxFilter] = useState("all");
  const [idx, setIdx] = useState(0);
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [slab, setSlab] = useState(false);
  const [showFine, setShowFine] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  // Books that still need a real grade. "Needs a grade" must match the homepage's
  // fill-rate definition exactly, or the two disagree: the homepage counts
  // Unknown/N/A/?/TBD/None as unfilled, so those must surface here too (an empty
  // Condition is just the most common case). Without this they were invisible —
  // homepage showed hundreds "to do" while this page showed 0.
  const NEEDS_GRADE = /^(n\/a|unknown|\?|tbd|none)$/i;
  const blanks = useMemo(() =>
    comics.filter(c => { const v = String(c.Condition || "").trim(); return !v || NEEDS_GRADE.test(v); }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [comics]);

  const boxes = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of blanks) { const b = String(c.Box || "—"); m.set(b, (m.get(b) || 0) + 1); }
    return [...m.entries()].sort((a, b) =>
      (parseInt(a[0]) || 9e9) - (parseInt(b[0]) || 9e9) || a[0].localeCompare(b[0]));
  }, [blanks]);

  const queue = useMemo(() =>
    boxFilter === "all" ? blanks : blanks.filter(c => String(c.Box || "—") === boxFilter),
    [blanks, boxFilter]);

  useEffect(() => { setIdx(0); }, [boxFilter]);

  const gradedCount = Object.keys(grades).length;
  const current = queue[idx];

  const assign = useCallback((g: string) => {
    if (!current) return;
    // slab form: "CGC 9.4" from the numeric; raw form keeps the label "NM (9.4)"
    const finalVal = slab ? `CGC ${(g.match(/([0-9.]+)/) || ["", ""])[1]}` : g;
    setGrades(prev => ({ ...prev, [idOf(current)]: finalVal }));
    setSaved(null);
    setIdx(i => Math.min(i + 1, queue.length)); // advance (may land on end screen)
  }, [current, slab, queue.length]);

  const skip = useCallback(() => setIdx(i => Math.min(i + 1, queue.length)), [queue.length]);
  const back = useCallback(() => setIdx(i => Math.max(i - 1, 0)), []);

  // keyboard: 1–6 quick grades, S skip, ← back, G toggle slab
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "SELECT") return;
      if (e.key >= "1" && e.key <= "6") { const q = QUICK[+e.key - 1]; if (q) assign(q[0]); }
      else if (e.key.toLowerCase() === "s") skip();
      else if (e.key === "ArrowLeft") back();
      else if (e.key.toLowerCase() === "g") setSlab(s => !s);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [assign, skip, back]);

  function exportBatch() {
    const byId = new Map(blanks.map(c => [idOf(c), c]));
    const edits = Object.entries(grades).map(([id, cond]) => {
      const c = byId.get(id)!;
      return {
        match: { Title: c.Title, Issue: c.Issue, Volume: c.Volume || "1", Box: c.Box, Signed_By: c.Signed_By || "" },
        delete: false,
        changes: { Condition: cond },
      };
    });
    const payload = { type: "comic-edit-batch", exportedAt: new Date().toISOString(), fill_only: true, edits };
    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const name = `comic_edits_batch_${stamp}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    URL.revokeObjectURL(a.href);
    setSaved(name);
  }

  const S = { font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" };

  return (
    <div style={{ maxWidth: "calc(760px + var(--wide))", margin: "0 auto", padding: "20px 16px 60px" }}>
      <style>{`
        .ce-gbtn{font-family:inherit;font-weight:700;font-size:1rem;border:1.5px solid var(--border,#2c2c38);
          background:var(--surface,#1c1c24);color:var(--text,#eee);border-radius:11px;padding:16px 10px;cursor:pointer;
          display:flex;flex-direction:column;gap:2px;align-items:center;transition:transform .08s}
        .ce-gbtn:hover{border-color:var(--red,#c0392b);transform:translateY(-2px)}
        .ce-gbtn .k{font-size:.62rem;color:var(--muted,#888);font-weight:600}
        .ce-gbtn small{font-size:.66rem;color:var(--muted,#888);font-weight:500}
        .ce-fine{font-family:inherit;font-size:.78rem;border:1px solid var(--border,#2c2c38);background:var(--surface,#1c1c24);
          color:var(--muted2,#aaa);border-radius:8px;padding:8px 10px;cursor:pointer}
        .ce-fine:hover{border-color:var(--red,#c0392b);color:var(--text,#eee)}
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: "1.6rem" }}>Condition Entry</h1>
          <p style={{ color: "var(--muted,#888)", margin: 0, fontSize: ".88rem" }}>
            {blanks.length.toLocaleString()} books need a grade. Pull a box, grade with keys <b>1–6</b>, <b>S</b> to skip, <b>G</b> for slab.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <select value={boxFilter} onChange={e => setBoxFilter(e.target.value)}
            style={{ ...S, padding: "8px 10px", borderRadius: 8, border: "1.5px solid var(--border,#2c2c38)", background: "var(--surface,#1c1c24)", color: "var(--text,#eee)", font: "inherit", fontSize: ".84rem", maxWidth: 220 }}>
            <option value="all">All boxes ({blanks.length})</option>
            {boxes.map(([b, n]) => <option key={b} value={b}>Box {b} ({n})</option>)}
          </select>
          <button onClick={exportBatch} disabled={gradedCount === 0}
            style={{ background: gradedCount ? "var(--red,#c0392b)" : "var(--surface2,#26262f)", color: gradedCount ? "#fff" : "var(--muted,#888)", border: "none", borderRadius: 8, padding: "9px 16px", cursor: gradedCount ? "pointer" : "default", font: "inherit", fontWeight: 700, fontSize: ".82rem" }}>
            Export {gradedCount} grade{gradedCount === 1 ? "" : "s"}
          </button>
        </div>
      </div>

      {saved && <div style={{ color: "#2ec28a", fontSize: ".82rem", marginTop: 8 }}>✓ Exported {saved} — run <code>python3 brb_review_edits.py --apply</code> (or brb_all).</div>}

      {/* progress */}
      <div style={{ margin: "18px 0 14px" }}>
        <div style={{ height: 6, background: "var(--border,#2c2c38)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${queue.length ? (idx / queue.length) * 100 : 0}%`, background: "var(--red,#c0392b)", transition: "width .2s" }} />
        </div>
        <div style={{ ...S, fontSize: ".78rem", color: "var(--muted,#888)", marginTop: 5 }}>
          {Math.min(idx + (current ? 1 : 0), queue.length)} of {queue.length} in view · {gradedCount} graded this session
        </div>
      </div>

      {!current ? (
        <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--muted,#888)" }}>
          {queue.length === 0 ? "No ungraded books here. 🎉" : (
            <>
              <div style={{ fontSize: "1.1rem", color: "var(--text,#eee)", marginBottom: 8 }}>End of this box. ✅</div>
              {gradedCount > 0 && <div>Hit <b>Export {gradedCount} grades</b> above to save your work.</div>}
              <button onClick={() => setIdx(0)} style={{ marginTop: 14, background: "var(--surface2,#26262f)", border: "1px solid var(--border,#2c2c38)", color: "var(--muted2,#aaa)", borderRadius: 8, padding: "8px 14px", cursor: "pointer", font: "inherit" }}>↺ Review from start</button>
            </>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 18, alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap" }}>
            <CoverImage comic={current} width={150} height={225} objectFit="contain"
              style={{ borderRadius: 6, background: "#0d0d12", border: "1px solid var(--border,#2c2c38)", flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, lineHeight: 1.2 }}>{current.Title} #{current.Issue}</div>
              <div style={{ color: "var(--muted,#888)", fontSize: ".88rem", marginTop: 3 }}>
                {current.Publisher}{current.Volume && current.Volume !== "1" ? ` · Vol ${current.Volume}` : ""}{current.Year ? ` · ${current.Year}` : ""} · Box {current.Box}
              </div>
              {current.Signed_By && <div style={{ color: "var(--red,#c0392b)", fontSize: ".86rem", marginTop: 3 }}>✍ {current.Signed_By}</div>}
              {grades[idOf(current)] && <div style={{ color: "#2ec28a", fontSize: ".86rem", marginTop: 6 }}>Set: {grades[idOf(current)]}</div>}
              <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12, fontSize: ".86rem", cursor: "pointer", color: slab ? "var(--gold,#b6882f)" : "var(--muted2,#aaa)", fontWeight: 600 }}>
                <input type="checkbox" checked={slab} onChange={e => setSlab(e.target.checked)} />
                CGC slab (records as “CGC x.x”) · key G
              </label>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {QUICK.map(([g, name], i) => (
              <button key={g} className="ce-gbtn" onClick={() => assign(g)}>
                <span className="k">{i + 1}</span>{g}<small>{name}</small>
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={back} disabled={idx === 0} style={{ ...btn(), opacity: idx === 0 ? .5 : 1 }}>← Back</button>
            <button onClick={skip} style={btn()}>Skip (S) →</button>
            <button onClick={() => setShowFine(v => !v)} style={{ ...btn(), marginLeft: "auto" }}>{showFine ? "Hide finer grades" : "More grades…"}</button>
          </div>

          {showFine && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>
              {FINE.map(g => <button key={g} className="ce-fine" onClick={() => assign(g)}>{g}</button>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function btn(): React.CSSProperties {
  return { fontFamily: "inherit", fontSize: ".84rem", fontWeight: 600, border: "1px solid var(--border,#2c2c38)",
    background: "var(--surface,#1c1c24)", color: "var(--muted2,#aaa)", borderRadius: 9, padding: "9px 15px", cursor: "pointer" };
}
