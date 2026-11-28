import { useMemo, useState } from "react";
import guesses from "@/data/unknownGuesses.json";
import { CoverImage } from "@/components/CoverImage";

// Boxes -> "Unknown -> Box" (Nov 28): every book whose Box # is "UNKNOWN - needs physical
// reassignment", with a guessed box from tools/unknown_location_guess.py (101 daily snapshots
// of the deployed data + where the series' other issues sit today). Read-only: when a book
// turns up, set its real box in the sheet.

interface Row {
  tier: "HIGH" | "MEDIUM" | "LOW" | "NONE"; guess_box: string; box_exists: string;
  title: string; issue: string; volume: string; year: string; entry: string;
  key: string; signed: string; evidence: string;
}
interface Dissolved { box: string; last_seen: string; books_then: number; peak: number; now_unknown: number;
  now_other_box: number; not_in_sheet: number; guessed_back: number; top_destinations: [string, number][]; }
interface Jump { box: string; day: string; before: number; after: number; change: number; }
const DATA = guesses as { generated: string; snapshots: number; from: string; to: string; rows: Row[];
  dissolved: Dissolved[]; jumps: Jump[]; unknown_size: { day: string; n: number }[] };
const DISSOLVED: Record<string, Dissolved> = Object.fromEntries(DATA.dissolved.map(d => [d.box, d]));
const fmtDay = (d: string) => new Date(d + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
const dest = (d: Dissolved) => d.top_destinations.slice(0, 3).map(([b, n]) => `${b} (${n})`).join(", ");
const TIERS = ["HIGH", "MEDIUM", "LOW", "NONE"] as const;
const TIER_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  HIGH:   { bg: "#dcfce7", fg: "#15803d", label: "High" },
  MEDIUM: { bg: "#fef3c7", fg: "#b45309", label: "Medium" },
  LOW:    { bg: "#f3f4f6", fg: "#6b7280", label: "Low" },
  NONE:   { bg: "#fee2e2", fg: "#b91c1c", label: "No guess" },
};
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const boxSort = (a: string, b: string) => {
  const na = Number(a), nb = Number(b);
  if (!a) return 1; if (!b) return -1;
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  return a.localeCompare(b, undefined, { numeric: true });
};

function Badge({ tier }: { tier: string }) {
  const t = TIER_STYLE[tier];
  return <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.5px", padding: "1px 7px", borderRadius: 3, background: t.bg, color: t.fg, whiteSpace: "nowrap" }}>{t.label.toUpperCase()}</span>;
}

export default function UnknownBoxes() {
  const [tiers, setTiers] = useState<Set<string>>(new Set(["HIGH", "MEDIUM"]));
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of DATA.rows) c[r.tier] = (c[r.tier] || 0) + 1;
    return c;
  }, []);
  const retired = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of DATA.rows) if ((r.tier === "HIGH" || r.tier === "MEDIUM") && r.box_exists === "no") m[r.guess_box] = (m[r.guess_box] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, []);
  const retiredTotal = retired.reduce((n, [, k]) => n + k, 0);

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    const g: Record<string, Row[]> = {};
    for (const r of DATA.rows) {
      if (!tiers.has(r.tier)) continue;
      if (s && !`${r.title} #${r.issue} ${r.year} box ${r.guess_box}`.toLowerCase().includes(s)) continue;
      (g[r.guess_box] ||= []).push(r);
    }
    return Object.entries(g).sort((a, b) => boxSort(a[0], b[0]));
  }, [tiers, q]);
  const shown = groups.reduce((n, [, rs]) => n + rs.length, 0);

  const [showDis, setShowDis] = useState(true);
  const [showJumps, setShowJumps] = useState(false);
  const jumpDays = useMemo(() => {
    const m: Record<string, Jump[]> = {};
    for (const j of DATA.jumps) (m[j.day] ||= []).push(j);
    return Object.entries(m).sort((a, b) => b[1].length - a[1].length);
  }, []);
  const unkMoments = useMemo(() => {
    const out: { day: string; n: number }[] = [];
    let prev = -1;
    for (const x of DATA.unknown_size) { if (Math.abs(x.n - prev) >= 40 || prev < 0) out.push(x); prev = x.n; }
    return out;
  }, []);
  const toggleTier = (t: string) => setTiers(prev => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n; });
  const toggleBox = (b: string) => setOpen(prev => { const n = new Set(prev); n.has(b) ? n.delete(b) : n.add(b); return n; });

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 16px 80px", fontFamily: FONT }}>
      <div style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "1px", color: "var(--red)" }}>UNKNOWN → BOX</div>
      <div style={{ color: "var(--muted2)", fontSize: "0.88rem", margin: "4px 0 14px" }}>
        {DATA.rows.length} books marked UNKNOWN, each with a guessed box from {DATA.snapshots} daily snapshots ({DATA.from} → {DATA.to}) and where the series' other issues sit today. Nothing here changes the sheet.
      </div>

      {retiredTotal > 0 && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: "0.86rem", lineHeight: 1.45 }}>
          <b>{retiredTotal} of the confident guesses point to boxes that no longer have any books in the sheet</b> (they were emptied in the data around June). If a physical box still carries one of these labels, the books are probably inside it:{" "}
          {retired.slice(0, 10).map(([b, n], i) => <span key={b}>{i ? ", " : ""}<b>{b}</b> ({n})</span>)}{retired.length > 10 ? ", …" : ""}
        </div>
      )}

      {/* ── Dissolved boxes: what they held vs where those books are now ── */}
      <div style={{ background: "#fff", border: "1.5px solid var(--border)", borderRadius: 8, marginBottom: 12, overflow: "hidden" }}>
        <button onClick={() => setShowDis(v => !v)} style={{ width: "100%", display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", padding: "10px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: FONT }}>
          <span style={{ fontWeight: 800 }}>Dissolved boxes</span>
          <span style={{ fontSize: "0.8rem", color: "var(--muted2)" }}>{DATA.dissolved.length} boxes that held books and are empty today: their last contents, and where each of those books is now</span>
          <span style={{ marginLeft: "auto", color: "var(--muted)" }}>{showDis ? "▲" : "▼"}</span>
        </button>
        {showDis && (
          <div style={{ borderTop: "1px solid var(--border)", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", minWidth: 0 }}>
              <thead>
                <tr style={{ background: "var(--surface)", textAlign: "left" }}>
                  {["Box", "Last held", "Books then", "UNKNOWN now", "In other boxes", "Not in sheet"].map(h => <th key={h} style={{ padding: "6px 8px", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {DATA.dissolved.filter(d => d.books_then >= 5).map(d => (
                  <tr key={d.box} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "6px 8px", fontWeight: 800 }}>{d.box}</td>
                    <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{fmtDay(d.last_seen)}</td>
                    <td style={{ padding: "6px 8px" }}>{d.books_then}</td>
                    <td style={{ padding: "6px 8px", color: d.now_unknown ? "#b45309" : "var(--muted)", fontWeight: d.now_unknown ? 700 : 400 }}>{d.now_unknown}</td>
                    <td style={{ padding: "6px 8px" }}>{d.now_other_box}{d.now_other_box ? <span style={{ color: "var(--muted2)" }}> → {dest(d)}</span> : null}</td>
                    <td style={{ padding: "6px 8px", color: "var(--muted)" }}>{d.not_in_sheet}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: "8px 12px", fontSize: "0.76rem", color: "var(--muted2)", lineHeight: 1.45 }}>
              Read a row as: the box's last day with books, how many it held, then where those same books are today. "Not in sheet" = sold, merged into another row, or renamed since.
              {" "}UNKNOWN over time: {unkMoments.map((x, i) => <span key={x.day}>{i ? " → " : ""}{fmtDay(x.day)} <b>{x.n}</b></span>)}.
            </div>
          </div>
        )}
      </div>

      {/* ── Box size jumps (+15 books in one day) ── */}
      <div style={{ background: "#fff", border: "1.5px solid var(--border)", borderRadius: 8, marginBottom: 14, overflow: "hidden" }}>
        <button onClick={() => setShowJumps(v => !v)} style={{ width: "100%", display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", padding: "10px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: FONT }}>
          <span style={{ fontWeight: 800 }}>Boxes that jumped in size</span>
          <span style={{ fontSize: "0.8rem", color: "var(--muted2)" }}>{DATA.jumps.length} jumps of +15 or more books in one day, across {jumpDays.length} days</span>
          <span style={{ marginLeft: "auto", color: "var(--muted)" }}>{showJumps ? "▲" : "▼"}</span>
        </button>
        {showJumps && (
          <div style={{ borderTop: "1px solid var(--border)", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
            {jumpDays.map(([day, js]) => (
              <div key={day} style={{ fontSize: "0.8rem", lineHeight: 1.5 }}>
                <b>{fmtDay(day)}</b> <span style={{ color: "var(--muted2)" }}>· {js.length} box{js.length === 1 ? "" : "es"}</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
                  {js.sort((a, b) => b.change - a.change).map(j => (
                    <span key={j.box} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap" }}>
                      {j.box}: {j.before}→{j.after} <b style={{ color: "#15803d" }}>+{j.change}</b>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        {TIERS.map(t => {
          const on = tiers.has(t), st = TIER_STYLE[t];
          return (
            <button key={t} onClick={() => toggleTier(t)} style={{ border: `1.5px solid ${on ? st.fg : "var(--border)"}`, background: on ? st.bg : "var(--surface)", color: on ? st.fg : "var(--muted2)", borderRadius: 999, padding: "5px 12px", cursor: "pointer", fontWeight: 700, fontSize: "0.82rem", fontFamily: FONT }}>
              {st.label} · {counts[t] || 0}
            </button>
          );
        })}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search title, issue, box…"
          style={{ flex: "1 1 180px", minWidth: 0, padding: "7px 10px", border: "1.5px solid var(--border)", borderRadius: 6, fontSize: "0.88rem", fontFamily: FONT, background: "#fff" }} />
        <button onClick={() => setOpen(open.size ? new Set() : new Set(groups.map(([b]) => b)))}
          style={{ border: "1.5px solid var(--border)", background: "var(--surface)", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: "0.82rem", fontFamily: FONT }}>
          {open.size ? "Collapse all" : "Expand all"}
        </button>
      </div>
      <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: 8 }}>{shown} books in {groups.length} guessed boxes</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {groups.map(([box, rows]) => {
          const isOpen = open.has(box);
          const tc: Record<string, number> = {};
          for (const r of rows) tc[r.tier] = (tc[r.tier] || 0) + 1;
          const exists = rows[0].box_exists;
          return (
            <div key={box || "none"} style={{ background: "#fff", border: "1.5px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
              <button onClick={() => toggleBox(box)} style={{ width: "100%", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "10px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: FONT }}>
                <span style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--brown-light)" }}>{box ? `Box ${box}` : "No guess"}</span>
                {box && <span style={{ fontSize: "0.72rem", fontWeight: 700, color: exists === "yes" ? "#15803d" : "#1d4ed8" }}>{exists === "yes" ? "IN USE TODAY" : "RETIRED LABEL"}</span>}
                <span style={{ fontSize: "0.82rem", color: "var(--muted2)" }}>{rows.length} book{rows.length === 1 ? "" : "s"}</span>
                <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{TIERS.filter(t => tc[t]).map(t => <span key={t} style={{ fontSize: "0.72rem", color: TIER_STYLE[t].fg }}>{TIER_STYLE[t].label} {tc[t]}</span>)}</span>
                <span style={{ marginLeft: "auto", color: "var(--muted)" }}>{isOpen ? "▲" : "▼"}</span>
              </button>
              {isOpen && DISSOLVED[box] && (
                <div style={{ padding: "6px 12px 8px", fontSize: "0.78rem", color: "#1d4ed8", background: "#eff6ff", borderTop: "1px solid var(--border)", lineHeight: 1.45 }}>
                  Box {box} held <b>{DISSOLVED[box].books_then}</b> books on {fmtDay(DISSOLVED[box].last_seen)}. Today: <b>{DISSOLVED[box].now_unknown}</b> UNKNOWN,{" "}
                  <b>{DISSOLVED[box].now_other_box}</b> in other boxes{DISSOLVED[box].now_other_box ? ` (${dest(DISSOLVED[box])})` : ""}, {DISSOLVED[box].not_in_sheet} not in the sheet.
                  {DISSOLVED[box].now_other_box > DISSOLVED[box].now_unknown ? " Most of its box-mates moved - check those boxes first." : " Most of it never got a new box - look for a physical box still labelled " + box + "."}
                </div>
              )}
              {isOpen && (
                <div style={{ borderTop: "1px solid var(--border)" }}>
                  {rows.map(r => (
                    <div key={`${r.entry}|${r.title}|${r.issue}|${r.year}`} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
                      <CoverImage comic={{ Title: r.title, Issue: r.issue, Volume: r.volume || "1" }} width={34} height={51} style={{ borderRadius: 3, flexShrink: 0, border: "1px solid var(--border)" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: "0.9rem", overflowWrap: "anywhere" }}>{r.title} #{r.issue}</span>
                          <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{r.year}{r.volume && r.volume !== "1" ? ` · Vol ${r.volume}` : ""}{r.entry ? ` · #${r.entry}` : ""}</span>
                          <Badge tier={r.tier} />
                          {r.key === "YES" && <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#b45309" }}>KEY</span>}
                          {r.signed === "YES" && <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#7c3aed" }}>SIGNED</span>}
                        </div>
                        <div style={{ fontSize: "0.76rem", color: "var(--muted2)", marginTop: 2, overflowWrap: "anywhere" }}>{r.evidence || "no evidence in any snapshot or sibling"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
