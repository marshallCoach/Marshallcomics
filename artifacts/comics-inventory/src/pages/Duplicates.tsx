import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { DATA3 } from "@/data/data3";
import type { Comic } from "@/data/data3";

// ── LocalStorage ──────────────────────────────────────────────────────────────
const LS_HIDDEN         = "brbHiddenGroups";
const LS_COPY_DECISIONS = "brbCopyDecisions";
const LS_NOTES          = "brbDupNotes";

type CopyAction = "planned" | "check";

function loadSet(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); }
  catch { return new Set(); }
}
function saveSet(key: string, s: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...s]));
}
function loadMap<T>(key: string): Map<string, T> {
  try { return new Map(Object.entries(JSON.parse(localStorage.getItem(key) || "{}"))); }
  catch { return new Map(); }
}
function saveMap<T>(key: string, m: Map<string, T>) {
  const obj: Record<string, T> = {};
  m.forEach((v, k) => { obj[k] = v; });
  localStorage.setItem(key, JSON.stringify(obj));
}

// ── Duplicate groups ──────────────────────────────────────────────────────────
interface DupGroup {
  key: string;
  title: string;
  issue: string;
  volume: string;
  publisher: string;
  year: string;
  copies: Comic[];
  flag: "same-box" | "bought-twice";
}

const comics = DATA3.comics;

const RAW_GROUPS = (() => {
  const map = new Map<string, Comic[]>();
  for (const c of comics) {
    const k = [
      c.Title.trim(),
      (c.Issue || "").trim().toLowerCase(),
      (c.Publisher || "").trim().toUpperCase(),
      (c.Year || "").trim(),
      String(c.Volume || "").trim(),
      (c.Arc || "").trim().toLowerCase(),
    ].join("|||");
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(c);
  }
  const groups: DupGroup[] = [];
  for (const [key, copies] of map) {
    if (copies.length < 2) continue;
    const [title, issue,, year, volume] = key.split("|||");
    const publisher = copies[0].Publisher || "";
    const boxes = new Set(copies.map(c => c.Box));
    const flag: DupGroup["flag"] = boxes.size < copies.length ? "same-box" : "bought-twice";
    groups.push({ key, title, issue: copies[0].Issue || issue, volume, publisher, year, copies, flag });
  }
  return groups.sort((a, b) => b.copies.length - a.copies.length || a.title.localeCompare(b.title));
})();

const TOTAL_DUP_BOOKS = RAW_GROUPS.reduce((s, g) => s + g.copies.length, 0);
const SAME_BOX_COUNT  = RAW_GROUPS.filter(g => g.flag === "same-box").length;

// ── Helpers ───────────────────────────────────────────────────────────────────
const ck = (grKey: string, ci: number) => `${grKey}|||${ci}`;

function countColor(n: number) {
  if (n >= 5) return "#dc2626";
  if (n >= 3) return "#d97706";
  return "#ca8a04";
}
function fmtVal(v: string) {
  const m = (v || "").match(/\$?(\d+(?:\.\d+)?)/);
  return m ? `$${m[1]}` : "—";
}

const COPY_META: Record<CopyAction, { label: string; color: string; bg: string; border: string }> = {
  "planned": { label: "PLANNED", color: "#d97706", bg: "#fefce8", border: "#fcd34d" },
  "check":   { label: "CHECK",   color: "#9333ea", bg: "#faf5ff", border: "#e9d5ff" },
};

// ── Component ─────────────────────────────────────────────────────────────────
interface Props { onNavigate?: (tab: string) => void; }

export default function Duplicates({ onNavigate }: Props) {
  const [hidden,        setHidden]        = useState<Set<string>>(         () => loadSet(LS_HIDDEN));
  const [copyDecisions, setCopyDecisions] = useState<Map<string, CopyAction>>(() => loadMap<CopyAction>(LS_COPY_DECISIONS));
  const [notes,         setNotes]         = useState<Map<string, string>>(   () => loadMap<string>(LS_NOTES));

  const [query,      setQuery]      = useState("");
  const [filter,     setFilter]     = useState<"active" | "all" | "same-box" | "bought-twice" | "hidden">("active");
  const [sort,       setSort]       = useState<"count" | "alpha">("count");
  const [openKeys,   setOpenKeys]   = useState<Set<string>>(() => new Set(RAW_GROUPS.map(g => g.key)));
  const [showAll,    setShowAll]    = useState(false);
  const [groupBy,    setGroupBy]    = useState<"title" | "box">("title");
  const [openBoxes,  setOpenBoxes]  = useState<Set<string>>(new Set());
  const [showOutput,      setShowOutput]      = useState(false);
  const [showClaude,      setShowClaude]      = useState(false);
  const [copied,          setCopied]          = useState(false);
  const [copiedClaude,    setCopiedClaude]    = useState(false);
  const outputRef = useRef<HTMLTextAreaElement>(null);
  const claudeRef = useRef<HTMLTextAreaElement>(null);

  // Toggle hide on a group
  const toggleHide = useCallback((grKey: string) => {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(grKey)) next.delete(grKey);
      else next.add(grKey);
      saveSet(LS_HIDDEN, next);
      return next;
    });
  }, []);

  // Per-group note
  const updateNote = useCallback((grKey: string, note: string) => {
    setNotes(prev => {
      const next = new Map(prev);
      if (note.trim()) next.set(grKey, note);
      else next.delete(grKey);
      saveMap(LS_NOTES, next);
      return next;
    });
  }, []);

  // Per-copy decision
  const setCopyDecision = useCallback((key: string, action: CopyAction) => {
    setCopyDecisions(prev => {
      const next = new Map(prev);
      if (next.get(key) === action) next.delete(key);
      else next.set(key, action);
      saveMap(LS_COPY_DECISIONS, next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    const emptySet = new Set<string>();
    const emptyMap = new Map<string, CopyAction>();
    const emptyNotes = new Map<string, string>();
    setHidden(emptySet);
    setCopyDecisions(emptyMap);
    setNotes(emptyNotes);
    saveSet(LS_HIDDEN, emptySet);
    saveMap(LS_COPY_DECISIONS, emptyMap);
    saveMap(LS_NOTES, emptyNotes);
  }, []);

  const exportData = useCallback((
    hiddenSnap: Set<string>,
    decisionsSnap: Map<string, CopyAction>,
    notesSnap: Map<string, string>
  ) => {
    const decisionsObj: Record<string, CopyAction> = {};
    decisionsSnap.forEach((v, k) => { decisionsObj[k] = v; });
    const notesObj: Record<string, string> = {};
    notesSnap.forEach((v, k) => { notesObj[k] = v; });
    const payload = {
      version: 1,
      exported: new Date().toISOString(),
      hidden: [...hiddenSnap],
      copyDecisions: decisionsObj,
      notes: notesObj,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `brb-duplicates-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const importData = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const raw = JSON.parse(e.target?.result as string);
          if (!raw || raw.version !== 1) { alert("Unrecognised backup file."); return; }
          const newHidden    = new Set<string>(raw.hidden || []);
          const newDecisions = new Map<string, CopyAction>(Object.entries(raw.copyDecisions || {}));
          const newNotes     = new Map<string, string>(Object.entries(raw.notes || {}));
          setHidden(newHidden);
          setCopyDecisions(newDecisions);
          setNotes(newNotes);
          saveSet(LS_HIDDEN, newHidden);
          saveMap(LS_COPY_DECISIONS, newDecisions);
          saveMap(LS_NOTES, newNotes);
        } catch { alert("Could not read file — make sure it's a valid BRB duplicates backup."); }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  // Auto-hide: note + all classified, OR all copies PLANNED
  useEffect(() => {
    setHidden(prev => {
      const next = new Set(prev);
      let changed = false;
      for (const gr of RAW_GROUPS) {
        if (next.has(gr.key)) continue;
        const allPlanned    = gr.copies.every((_, ci) => copyDecisions.get(ck(gr.key, ci)) === "planned");
        const hasNote       = !!(notes.get(gr.key) || "").trim();
        const allClassified = gr.copies.every((_, ci) => copyDecisions.has(ck(gr.key, ci)));
        if (allPlanned || (hasNote && allClassified)) { next.add(gr.key); changed = true; }
      }
      if (!changed) return prev;
      saveSet(LS_HIDDEN, next);
      return next;
    });
  }, [notes, copyDecisions]);

  const filtered = useMemo(() => {
    let g = RAW_GROUPS;
    if (filter === "active")       g = g.filter(gr => !hidden.has(gr.key));
    else if (filter === "hidden")  g = g.filter(gr => hidden.has(gr.key));
    else if (filter === "same-box")     g = g.filter(gr => !hidden.has(gr.key) && gr.flag === "same-box");
    else if (filter === "bought-twice") g = g.filter(gr => !hidden.has(gr.key) && gr.flag === "bought-twice");
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      g = g.filter(gr => gr.title.toLowerCase().includes(q) || gr.issue.toLowerCase().includes(q));
    }
    if (sort === "alpha") g = [...g].sort((a, b) => a.title.localeCompare(b.title));
    return g;
  }, [query, filter, sort, hidden]);

  const visible = showAll ? filtered : filtered.slice(0, 80);

  // Groups by box
  const byBox = useMemo(() => {
    const map = new Map<string, DupGroup[]>();
    for (const gr of filtered) {
      const boxes = [...new Set(gr.copies.map(c => c.Box).filter(Boolean))];
      for (const box of boxes) {
        if (!map.has(box)) map.set(box, []);
        map.get(box)!.push(gr);
      }
    }
    return [...map.entries()].sort((a, b) => {
      const na = parseInt(a[0]) || 9999;
      const nb = parseInt(b[0]) || 9999;
      return na - nb;
    });
  }, [filtered]);

  // Groups with any per-copy decision
  const classifiedGroups = useMemo(() => {
    const keys = new Set<string>();
    for (const copyKey of copyDecisions.keys()) {
      const grKey = copyKey.split("|||").slice(0, -1).join("|||");
      keys.add(grKey);
    }
    return keys;
  }, [copyDecisions]);

  // Output text
  const outputText = useMemo(() => {
    if (copyDecisions.size === 0 && notes.size === 0) return "";
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const lines: string[] = [`DUPLICATE REVIEW — BlackReadBrown Comics`, `Date: ${today}`, `Hidden (not real dups): ${hidden.size} groups`, `Classified copies: ${copyDecisions.size}`, ``];

    const perCopyGroups = new Map<string, { planned: {ci: number; c: Comic}[]; check: {ci: number; c: Comic}[] }>();
    for (const [copyKey, action] of copyDecisions) {
      const parts = copyKey.split("|||");
      const ci = parseInt(parts[parts.length - 1]);
      const grKey = parts.slice(0, -1).join("|||");
      const gr = RAW_GROUPS.find(g => g.key === grKey);
      if (!gr) continue;
      if (!perCopyGroups.has(grKey)) perCopyGroups.set(grKey, { planned: [], check: [] });
      const entry = perCopyGroups.get(grKey)!;
      entry[action].push({ ci, c: gr.copies[ci] });
    }

    if (perCopyGroups.size > 0) {
      lines.push(`── COPY DECISIONS (${perCopyGroups.size} groups) ──`, ``);
      let idx = 1;
      for (const [grKey, { planned, check }] of perCopyGroups) {
        const gr = RAW_GROUPS.find(g => g.key === grKey)!;
        lines.push(`${idx++}. ${gr.title} ${gr.issue}${gr.volume ? ` Vol ${gr.volume}` : ""} · ${gr.publisher}${gr.year ? ` (${gr.year})` : ""}`);
        if (planned.length) {
          lines.push(`   PLANNED (${planned.length}): ${planned.map(p => `Copy ${p.ci+1} Box ${p.c.Box}`).join(", ")}`);
        }
        if (check.length) {
          lines.push(`   CHECK (${check.length}): ${check.map(p => `Copy ${p.ci+1} Box ${p.c.Box}`).join(", ")}`);
        }
        const n = notes.get(grKey);
        if (n) lines.push(`   Note: ${n}`);
        lines.push(``);
      }
    }

    // Groups with notes but no copy decisions
    const noteOnlyGroups = [...notes.entries()].filter(([grKey]) => !perCopyGroups.has(grKey));
    if (noteOnlyGroups.length > 0) {
      lines.push(`── NOTES ONLY (${noteOnlyGroups.length} groups) ──`, ``);
      noteOnlyGroups.forEach(([grKey, note], i) => {
        const gr = RAW_GROUPS.find(g => g.key === grKey);
        if (!gr) return;
        lines.push(`${i+1}. ${gr.title} ${gr.issue}${gr.volume ? ` Vol ${gr.volume}` : ""} · ${gr.publisher}${gr.year ? ` (${gr.year})` : ""}`);
        lines.push(`   Note: ${note}`, ``);
      });
    }

    const remaining = RAW_GROUPS.length - hidden.size;
    lines.push(`${remaining} groups still active (${hidden.size} dismissed).`);
    return lines.join("\n");
  }, [copyDecisions, hidden, notes]);

  // Claude script — all notes in a structured prompt
  const claudeScript = useMemo(() => {
    if (notes.size === 0) return "";
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const lines: string[] = [
      `DUPLICATE REVIEW NOTES — BlackReadBrown Comics`,
      `Date: ${today}`,
      ``,
      `Roberto's collection has ${RAW_GROUPS.length} detected duplicate groups. Below are notes from the manual review session.`,
      `Active: ${RAW_GROUPS.length - hidden.size} | Dismissed: ${hidden.size}`,
      ``,
    ];

    // Groups with notes, sorted: check copies first, then planned, then notes-only
    const withNotes = [...notes.entries()].map(([grKey, note]) => {
      const gr = RAW_GROUPS.find(g => g.key === grKey);
      if (!gr) return null;
      const checkCopies  = gr.copies.filter((_, ci) => copyDecisions.get(ck(gr.key, ci)) === "check");
      const plannedCopies = gr.copies.filter((_, ci) => copyDecisions.get(ck(gr.key, ci)) === "planned");
      return { gr, note, checkCopies, plannedCopies };
    }).filter(Boolean) as { gr: DupGroup; note: string; checkCopies: Comic[]; plannedCopies: Comic[] }[];

    const checkGroups   = withNotes.filter(x => x.checkCopies.length > 0);
    const plannedGroups = withNotes.filter(x => x.checkCopies.length === 0 && x.plannedCopies.length > 0);
    const noteOnlyGrps  = withNotes.filter(x => x.checkCopies.length === 0 && x.plannedCopies.length === 0);

    if (checkGroups.length > 0) {
      lines.push(`── NEEDS VERIFICATION (${checkGroups.length} groups) ──`);
      lines.push(`These copies are marked CHECK — Roberto needs to physically verify them.`, ``);
      checkGroups.forEach(({ gr, note, checkCopies }, i) => {
        lines.push(`${i+1}. ${gr.title} ${gr.issue}${gr.volume ? ` Vol ${gr.volume}` : ""} · ${gr.publisher}${gr.year ? ` (${gr.year})` : ""}`);
        lines.push(`   Check copies: ${checkCopies.map(c => `Box ${c.Box}`).join(", ")}`);
        lines.push(`   Note: ${note}`, ``);
      });
    }

    if (plannedGroups.length > 0) {
      lines.push(`── PLANNED DUPLICATES (${plannedGroups.length} groups) ──`);
      lines.push(`Intentional extras kept for selling or trading.`, ``);
      plannedGroups.forEach(({ gr, note, plannedCopies }, i) => {
        lines.push(`${i+1}. ${gr.title} ${gr.issue}${gr.volume ? ` Vol ${gr.volume}` : ""} · ${gr.publisher}${gr.year ? ` (${gr.year})` : ""}`);
        lines.push(`   Planned copies: ${plannedCopies.map(c => `Box ${c.Box}`).join(", ")}`);
        lines.push(`   Note: ${note}`, ``);
      });
    }

    if (noteOnlyGrps.length > 0) {
      lines.push(`── NOTES (${noteOnlyGrps.length} groups) ──`, ``);
      noteOnlyGrps.forEach(({ gr, note }, i) => {
        lines.push(`${i+1}. ${gr.title} ${gr.issue}${gr.volume ? ` Vol ${gr.volume}` : ""} · ${gr.publisher}${gr.year ? ` (${gr.year})` : ""}`);
        lines.push(`   Note: ${note}`, ``);
      });
    }

    return lines.join("\n");
  }, [notes, copyDecisions, hidden]);

  const active = RAW_GROUPS.length - hidden.size;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 80px" }}>

      {/* ── HEADER ── */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "2rem", letterSpacing: "3px", color: "var(--red)", margin: 0, lineHeight: 1 }}>
            DUPLICATE DETECTOR
          </h1>
          <p style={{ fontSize: "0.82rem", color: "var(--muted2)", marginTop: 6, fontFamily: "'Crimson Pro',serif", maxWidth: 600 }}>
            Same title + issue + publisher + year + volume + arc appearing more than once.
            Hit <strong>HIDE</strong> on any group that isn't a real accidental duplicate.
            Expand to classify individual copies as Planned or Check.
          </p>
        </div>
        {onNavigate && (
          <button
            onClick={() => onNavigate("dupchecklist")}
            style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.72rem", letterSpacing: "2px", padding: "9px 18px", border: "2px solid #9333ea", background: "#faf5ff", color: "#9333ea", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, alignSelf: "flex-start" }}
          >
            CHECK LIST →
          </button>
        )}
      </div>

      {/* ── STAT TILES ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
        {[
          { val: RAW_GROUPS.length.toLocaleString(), lbl: "Total Groups",    sub: "same title+issue+pub+year+vol", color: "#dc2626" },
          { val: active.toLocaleString(),            lbl: "Active",          sub: "real dups still to review",    color: "#d97706" },
          { val: hidden.size.toLocaleString(),       lbl: "Dismissed",       sub: "hidden — not real duplicates", color: "#6b7280" },
          { val: classifiedGroups.size.toLocaleString(), lbl: "Classified",  sub: "groups with copy decisions",   color: "#16a34a" },
        ].map((s, i) => (
          <div key={i} style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderTop: `3px solid ${s.color}`, borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.8rem", color: s.color, letterSpacing: "2px", lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", letterSpacing: "2px", color: "var(--muted2)", marginTop: 4 }}>{s.lbl}</div>
            <div style={{ fontSize: "0.65rem", color: "var(--muted)", marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── BACKUP / RESTORE ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.6rem", letterSpacing: "1.5px", color: "var(--muted)", flexShrink: 0 }}>BACKUP</span>
        <button
          onClick={() => exportData(hidden, copyDecisions, notes)}
          style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.62rem", letterSpacing: "1.5px", padding: "5px 14px", border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--muted2)", borderRadius: 4, cursor: "pointer" }}>
          ↓ EXPORT JSON
        </button>
        <button
          onClick={importData}
          style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.62rem", letterSpacing: "1.5px", padding: "5px 14px", border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--muted2)", borderRadius: 4, cursor: "pointer" }}>
          ↑ RESTORE FROM FILE
        </button>
        <span style={{ fontSize: "0.7rem", color: "var(--muted)", fontFamily: "'Crimson Pro',serif" }}>
          Export saves all your notes, decisions &amp; dismissed groups to a file you keep.
        </span>
      </div>

      {/* ── COPY DECISION LEGEND ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ fontSize: "0.68rem", color: "var(--muted)", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "1px" }}>PER-COPY:</div>
        {(Object.entries(COPY_META) as [CopyAction, typeof COPY_META[CopyAction]][]).map(([action, meta]) => {
          const count = [...copyDecisions.values()].filter(v => v === action).length;
          return (
            <div key={action} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.7rem", color: "var(--muted2)" }}>
              <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.58rem", letterSpacing: "1.5px", color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`, padding: "2px 6px", borderRadius: 3 }}>{meta.label}</span>
              {count > 0 && <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.58rem", color: meta.color }}>({count} copies)</span>}
            </div>
          );
        })}
        <div style={{ marginLeft: "auto", fontSize: "0.68rem", color: "var(--muted)", fontFamily: "'Crimson Pro',serif", fontStyle: "italic" }}>
          Expand any group to tag individual copies
        </div>
      </div>

      {/* ── CONTROLS ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <input
          placeholder="Search title or issue…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ flex: "1 1 220px", padding: "8px 12px", border: "1.5px solid var(--border)", borderRadius: 6, fontSize: "0.85rem", fontFamily: "'Crimson Pro',serif", background: "var(--surface)", color: "var(--text2)" }}
        />
        <select value={filter} onChange={e => { setFilter(e.target.value as typeof filter); setShowAll(false); }}
          style={{ padding: "8px 10px", border: "1.5px solid var(--border)", borderRadius: 6, fontSize: "0.82rem", background: "var(--surface)", color: "var(--text2)", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "1px" }}>
          <option value="active">Active Only</option>
          <option value="all">All Groups</option>
          <option value="same-box">Same Box</option>
          <option value="bought-twice">Bought Twice</option>
          <option value="hidden">Dismissed ({hidden.size})</option>
        </select>
        <select value={sort} onChange={e => setSort(e.target.value as typeof sort)}
          style={{ padding: "8px 10px", border: "1.5px solid var(--border)", borderRadius: 6, fontSize: "0.82rem", background: "var(--surface)", color: "var(--text2)", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "1px" }}>
          <option value="count">Most Copies First</option>
          <option value="alpha">A → Z</option>
        </select>
        <div style={{ display: "flex", gap: 5, marginLeft: "auto", alignItems: "center" }}>
          {(["title", "box"] as const).map(v => (
            <button key={v} onClick={() => setGroupBy(v)} style={{
              fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.62rem", letterSpacing: "1.5px",
              padding: "5px 12px", cursor: "pointer", borderRadius: 5, transition: "all 0.15s",
              background: groupBy === v ? "var(--red)" : "var(--surface2)",
              color:      groupBy === v ? "#fff"       : "var(--muted2)",
              border:     groupBy === v ? "1.5px solid var(--red)" : "1.5px solid var(--border)",
            }}>
              {v === "title" ? "BY TITLE" : "BY BOX"}
            </button>
          ))}
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: 8, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "1px" }}>
            {filtered.length.toLocaleString()} GROUPS
          </div>
        </div>
      </div>

      {/* ── BOX VIEW ── */}
      {groupBy === "box" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {byBox.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "2px" }}>NO GROUPS MATCH</div>
          )}
          {byBox.map(([boxNum, groups]) => {
            const isBoxOpen = openBoxes.has(boxNum);
            return (
              <div key={boxNum} style={{ border: "1.5px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                {/* Box section header */}
                <div
                  onClick={() => setOpenBoxes(prev => { const next = new Set(prev); if (next.has(boxNum)) next.delete(boxNum); else next.add(boxNum); return next; })}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--surface2)", cursor: "pointer", userSelect: "none" }}>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.1rem", letterSpacing: "2px", color: "var(--red)", lineHeight: 1 }}>BOX {boxNum}</div>
                  <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.58rem", letterSpacing: "1.5px", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted2)", borderRadius: 3, padding: "2px 8px" }}>
                    {groups.length} {groups.length === 1 ? "GROUP" : "GROUPS"}
                  </span>
                  <div style={{ marginLeft: "auto", color: "var(--muted)", fontSize: "0.7rem" }}>{isBoxOpen ? "▲" : "▼"}</div>
                </div>

                {isBoxOpen && (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {groups.map(gr => {
                      const isOpen   = openKeys.has(gr.key);
                      const isHidden = hidden.has(gr.key);
                      const flagColor = gr.flag === "same-box" ? "#dc2626" : "#d97706";
                      const copiesInBox     = gr.copies.filter(c => c.Box === boxNum);
                      const otherBoxes      = [...new Set(gr.copies.filter(c => c.Box !== boxNum).map(c => c.Box).filter(Boolean))].sort((a, b) => parseInt(a) - parseInt(b));
                      const grCopyCounts    = { planned: 0, check: 0 };
                      gr.copies.forEach((_, ci) => { const v = copyDecisions.get(ck(gr.key, ci)); if (v) grCopyCounts[v]++; });
                      const hasCopyDecisions = grCopyCounts.planned > 0 || grCopyCounts.check > 0;
                      const groupNote = notes.get(gr.key) || "";

                      return (
                        <div key={gr.key} style={{ borderTop: "1px solid var(--border)", background: isHidden ? "var(--surface2)" : hasCopyDecisions ? "#fefce8" : "var(--surface)", opacity: isHidden ? 0.55 : 1 }}>
                          {/* Compact row */}
                          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", flexWrap: "wrap" }}>
                            {/* Copy count */}
                            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.1rem", color: isHidden ? "#9ca3af" : flagColor, lineHeight: 1, flexShrink: 0, minWidth: 22, textAlign: "center" }}>
                              {gr.copies.length}
                              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.38rem", letterSpacing: "1px", color: "var(--muted)" }}>COPIES</div>
                            </div>
                            {/* Title + boxes */}
                            <div
                              onClick={() => !isHidden && setOpenKeys(prev => { const next = new Set(prev); if (next.has(gr.key)) next.delete(gr.key); else next.add(gr.key); return next; })}
                              style={{ flex: 1, minWidth: 0, cursor: isHidden ? "default" : "pointer" }}>
                              <div>
                                <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.88rem", letterSpacing: "1px", color: isHidden ? "var(--muted)" : "var(--text)", textDecoration: isHidden ? "line-through" : "none" }}>{gr.title}</span>
                                <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.82rem", color: "var(--red)", marginLeft: 6 }}>{gr.issue}</span>
                                {gr.year && <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.58rem", letterSpacing: "1px", color: "var(--muted)", marginLeft: 6 }}>({gr.year})</span>}
                              </div>
                              <div style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
                                <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.54rem", letterSpacing: "1px", color: "#fff", background: "var(--red)", padding: "2px 8px", borderRadius: 3 }}>×{copiesInBox.length} HERE</span>
                                {otherBoxes.map(b => (
                                  <span key={b} style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.54rem", letterSpacing: "1px", color: "var(--muted2)", background: "var(--surface2)", border: "1px solid var(--border)", padding: "2px 7px", borderRadius: 3 }}>also Box {b}</span>
                                ))}
                              </div>
                            </div>
                            {/* Flag badge */}
                            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.52rem", letterSpacing: "1.5px", color: isHidden ? "#9ca3af" : flagColor, background: (isHidden ? "#9ca3af" : flagColor) + "14", border: `1px solid ${(isHidden ? "#9ca3af" : flagColor)}40`, padding: "2px 7px", borderRadius: 3, flexShrink: 0 }}>
                              {gr.flag === "same-box" ? "SAME BOX" : "BOUGHT TWICE"}
                            </span>
                            {/* Decision summary badges */}
                            {hasCopyDecisions && (
                              <div style={{ display: "flex", gap: 4 }}>
                                {grCopyCounts.planned > 0 && <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.52rem", letterSpacing: "1px", color: COPY_META.planned.color, background: COPY_META.planned.bg, border: `1px solid ${COPY_META.planned.border}`, padding: "2px 6px", borderRadius: 3 }}>{grCopyCounts.planned}P</span>}
                                {grCopyCounts.check   > 0 && <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.52rem", letterSpacing: "1px", color: COPY_META.check.color,   background: COPY_META.check.bg,   border: `1px solid ${COPY_META.check.border}`,   padding: "2px 6px", borderRadius: 3 }}>{grCopyCounts.check}C</span>}
                              </div>
                            )}
                            {/* HIDE / SHOW */}
                            <button onClick={e => { e.stopPropagation(); toggleHide(gr.key); setOpenKeys(prev => { const next = new Set(prev); next.delete(gr.key); return next; }); }}
                              style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.52rem", letterSpacing: "1px", padding: "4px 10px", border: `1.5px solid ${isHidden ? "#16a34a" : "#9ca3af"}`, background: isHidden ? "#f0faf4" : "var(--surface2)", color: isHidden ? "#16a34a" : "#9ca3af", borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                              {isHidden ? "RESTORE" : "HIDE"}
                            </button>
                            {/* Expand toggle */}
                            {!isHidden && (
                              <button onClick={() => setOpenKeys(prev => { const next = new Set(prev); if (next.has(gr.key)) next.delete(gr.key); else next.add(gr.key); return next; })}
                                style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, width: 24, height: 24, cursor: "pointer", color: "var(--muted)", fontSize: "0.7rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                {isOpen ? "▲" : "▼"}
                              </button>
                            )}
                          </div>

                          {/* Expanded copy table */}
                          {isOpen && !isHidden && (
                            <div style={{ borderTop: "1px solid var(--border)" }}>
                              <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                                  <thead>
                                    <tr style={{ background: "var(--surface2)", borderBottom: "1.5px solid var(--border)" }}>
                                      {["#","BOX","VOL","WRITER","ARTIST","ARC / STORY","COND","KEY","SGD","NM","VF","PLANNED","CHECK"].map(h => (
                                        <th key={h} style={{ padding: "6px 8px", textAlign: h === "PLANNED" || h === "CHECK" ? "center" : "left", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.58rem", letterSpacing: "1.5px", color: h === "PLANNED" ? COPY_META.planned.color : h === "CHECK" ? COPY_META.check.color : "var(--muted)", fontWeight: 400 }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {gr.copies.map((c, ci) => {
                                      const inThisBox = c.Box === boxNum;
                                      const boxCopies = gr.copies.filter(x => x.Box === c.Box).length;
                                      const isKey    = (c.Key    || "").toUpperCase() === "YES";
                                      const isSigned = (c.Signed || "").toUpperCase() === "YES";
                                      const copyKey  = ck(gr.key, ci);
                                      const copyDec  = copyDecisions.get(copyKey);
                                      const rowBg    = copyDec === "check" ? "#faf5ff" : copyDec === "planned" ? "#fefce8" : inThisBox ? "#fff4f0" : boxCopies > 1 ? "#fff8f8" : "transparent";
                                      return (
                                        <tr key={ci} style={{ borderBottom: "1px solid var(--border)", background: rowBg }}>
                                          <td style={{ padding: "7px 10px", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", color: "var(--muted)" }}>#{ci + 1}</td>
                                          <td style={{ padding: "6px 10px", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                                            <span style={{ color: inThisBox ? "#fff" : "var(--red)", background: inThisBox ? "var(--red)" : "transparent", padding: inThisBox ? "2px 6px" : "0", borderRadius: 3 }}>Box {c.Box}</span>
                                          </td>
                                          <td style={{ padding: "7px 8px", color: "var(--muted2)", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.72rem" }}>{c.Volume ? `V${c.Volume}` : "—"}</td>
                                          <td style={{ padding: "7px 8px", color: "var(--text2)", maxWidth: 110, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.Writer || "—"}</td>
                                          <td style={{ padding: "7px 8px", color: "var(--text2)", maxWidth: 110, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.Artist || "—"}</td>
                                          <td style={{ padding: "7px 8px", color: "#7c3aed", maxWidth: 130, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Crimson Pro',serif", fontSize: "0.78rem", fontStyle: "italic" }}>{c.Arc || "—"}</td>
                                          <td style={{ padding: "7px 8px", color: "var(--muted2)", whiteSpace: "nowrap" }}>{c.Condition || "—"}</td>
                                          <td style={{ padding: "7px 8px" }}>{isKey    && <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.56rem", color: "#d97706", background: "#d9770618", border: "1px solid #d9770640", padding: "2px 5px", borderRadius: 3 }}>KEY</span>}</td>
                                          <td style={{ padding: "7px 8px" }}>{isSigned && <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.56rem", color: "#8b2be2", background: "#8b2be218", border: "1px solid #8b2be240", padding: "2px 5px", borderRadius: 3 }}>SGD</span>}</td>
                                          <td style={{ padding: "7px 8px", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.8rem",  color: "var(--red)",    whiteSpace: "nowrap" }}>{fmtVal(c.Value_NM)}</td>
                                          <td style={{ padding: "7px 8px", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.75rem", color: "var(--muted2)", whiteSpace: "nowrap" }}>{fmtVal(c.Value_VF)}</td>
                                          <td style={{ padding: "7px 8px", textAlign: "center" }}>
                                            <button onClick={() => setCopyDecision(copyKey, "planned")} style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.52rem", padding: "3px 7px", border: `1.5px solid ${copyDec === "planned" ? COPY_META.planned.color : "var(--border)"}`, background: copyDec === "planned" ? COPY_META.planned.color : "var(--surface2)", color: copyDec === "planned" ? "#fff" : "var(--muted)", borderRadius: 3, cursor: "pointer" }}>
                                              {copyDec === "planned" ? "✓" : "+"}
                                            </button>
                                          </td>
                                          <td style={{ padding: "7px 8px", textAlign: "center" }}>
                                            <button onClick={() => setCopyDecision(copyKey, "check")} style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.52rem", padding: "3px 7px", border: `1.5px solid ${copyDec === "check" ? COPY_META.check.color : "var(--border)"}`, background: copyDec === "check" ? COPY_META.check.color : "var(--surface2)", color: copyDec === "check" ? "#fff" : "var(--muted)", borderRadius: 3, cursor: "pointer" }}>
                                              {copyDec === "check" ? "✓" : "?"}
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                              <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", background: "#fafaf8" }}>
                                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.56rem", letterSpacing: "1.5px", color: "var(--muted)", marginBottom: 5 }}>NOTE</div>
                                <textarea value={groupNote} onChange={e => updateNote(gr.key, e.target.value)} placeholder="Add a note…" rows={2}
                                  style={{ width: "100%", padding: "7px 10px", border: "1.5px solid var(--border)", borderRadius: 5, fontSize: "0.82rem", fontFamily: "'Crimson Pro',serif", color: "var(--text2)", background: "#fff", resize: "vertical", boxSizing: "border-box", outline: "none" }}
                                  onFocus={e => { e.currentTarget.style.borderColor = "var(--red)"; }}
                                  onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── GROUP LIST (by title) ── */}
      {groupBy === "title" && <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {visible.map(gr => {
          const isOpen    = openKeys.has(gr.key);
          const isHidden  = hidden.has(gr.key);
          const cc        = countColor(gr.copies.length);
          const flagColor = gr.flag === "same-box" ? "#dc2626" : "#d97706";
          const boxes     = [...new Set(gr.copies.map(c => c.Box))].filter(Boolean);

          const grCopyCounts = { planned: 0, check: 0 };
          gr.copies.forEach((_, ci) => {
            const v = copyDecisions.get(ck(gr.key, ci));
            if (v) grCopyCounts[v]++;
          });
          const hasCopyDecisions = grCopyCounts.planned > 0 || grCopyCounts.check > 0;
          const groupNote = notes.get(gr.key) || "";

          return (
            <div key={gr.key} style={{
              background: isHidden ? "var(--surface2)" : hasCopyDecisions ? "#fefce8" : "var(--surface)",
              border: `1.5px solid ${isHidden ? "var(--border)" : hasCopyDecisions ? "#fcd34d" : "var(--border)"}`,
              borderLeft: `4px solid ${isHidden ? "#9ca3af" : hasCopyDecisions ? "#d97706" : flagColor}`,
              borderRadius: 8,
              overflow: "hidden",
              opacity: isHidden ? 0.55 : 1,
            }}>

              {/* ── GROUP HEADER ── */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>

                {/* Copy count */}
                <div style={{ flexShrink: 0, textAlign: "center", minWidth: 32 }}>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.3rem", color: isHidden ? "#9ca3af" : hasCopyDecisions ? "#d97706" : cc, lineHeight: 1 }}>{gr.copies.length}</div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.42rem", letterSpacing: "1.5px", color: "var(--muted)" }}>COPIES</div>
                </div>

                {/* Title */}
                <div
                  onClick={() => !isHidden && setOpenKeys(prev => { const next = new Set(prev); if (next.has(gr.key)) next.delete(gr.key); else next.add(gr.key); return next; })}
                  style={{ flex: 1, minWidth: 0, cursor: isHidden ? "default" : "pointer", userSelect: "text" }}
                >
                  <div>
                    <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.95rem", letterSpacing: "1px",
                      color: isHidden ? "var(--muted)" : "var(--text)",
                      textDecoration: isHidden ? "line-through" : "none" }}>
                      {gr.title}
                    </span>
                    <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.85rem", color: isHidden ? "var(--muted)" : "var(--red)", marginLeft: 6 }}>
                      {gr.issue}
                    </span>
                    {gr.volume && (
                      <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.6rem", letterSpacing: "1px",
                        color: "var(--muted2)", marginLeft: 6, background: "var(--surface2)",
                        border: "1px solid var(--border)", padding: "1px 5px", borderRadius: 3 }}>
                        VOL {gr.volume}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.67rem", color: "var(--muted)", marginTop: 2, display: "flex", gap: "4px 10px", flexWrap: "wrap" }}>
                    <span>{gr.publisher}{gr.year ? ` · ${gr.year}` : ""}</span>
                    <span>{boxes.slice(0,5).map(b => `Box ${b}`).join(", ")}{boxes.length > 5 ? ` +${boxes.length-5}` : ""}</span>
                    {grCopyCounts.planned > 0 && (
                      <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.56rem", letterSpacing: "1px", color: COPY_META.planned.color, background: COPY_META.planned.bg, border: `1px solid ${COPY_META.planned.border}`, padding: "1px 5px", borderRadius: 3 }}>
                        {grCopyCounts.planned} PLANNED
                      </span>
                    )}
                    {grCopyCounts.check > 0 && (
                      <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.56rem", letterSpacing: "1px", color: COPY_META.check.color, background: COPY_META.check.bg, border: `1px solid ${COPY_META.check.border}`, padding: "1px 5px", borderRadius: 3 }}>
                        {grCopyCounts.check} CHECK
                      </span>
                    )}
                    {groupNote && (
                      <span style={{ fontSize: "0.67rem", fontFamily: "'Crimson Pro',serif", fontStyle: "italic", color: "var(--muted2)" }} title={groupNote}>
                        ✏ {groupNote.length > 50 ? groupNote.slice(0, 50) + "…" : groupNote}
                      </span>
                    )}
                  </div>
                </div>

                {/* Flag badge */}
                <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.55rem", letterSpacing: "1.5px",
                  color: isHidden ? "#9ca3af" : flagColor,
                  background: (isHidden ? "#9ca3af" : flagColor) + "14",
                  border: `1px solid ${(isHidden ? "#9ca3af" : flagColor)}40`,
                  padding: "2px 7px", borderRadius: 3, flexShrink: 0 }}>
                  {gr.flag === "same-box" ? "SAME BOX" : "BOUGHT TWICE"}
                </span>

                {/* HIDE / SHOW button */}
                <button
                  onClick={e => { e.stopPropagation(); toggleHide(gr.key); setOpenKeys(prev => { const next = new Set(prev); next.delete(gr.key); return next; }); }}
                  title={isHidden ? "Restore to active list" : "Dismiss — not a real duplicate"}
                  style={{
                    fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.56rem", letterSpacing: "1px",
                    padding: "4px 10px",
                    border: `1.5px solid ${isHidden ? "#16a34a" : "#9ca3af"}`,
                    background: isHidden ? "#f0faf4" : "var(--surface2)",
                    color: isHidden ? "#16a34a" : "#9ca3af",
                    borderRadius: 4, cursor: "pointer", transition: "all 0.12s", whiteSpace: "nowrap", flexShrink: 0,
                  }}
                >
                  {isHidden ? "RESTORE" : "HIDE"}
                </button>

                {/* Expand toggle — only when not hidden */}
                {!isHidden && (
                  <button
                    onClick={() => setOpenKeys(prev => { const next = new Set(prev); if (next.has(gr.key)) next.delete(gr.key); else next.add(gr.key); return next; })}
                    style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, width: 24, height: 24, cursor: "pointer", color: "var(--muted)", fontSize: "0.7rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {isOpen ? "▲" : "▼"}
                  </button>
                )}
              </div>

              {/* ── EXPANDED COPIES ── */}
              {isOpen && !isHidden && (
                <div style={{ borderTop: "1px solid var(--border)" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                      <thead>
                        <tr style={{ background: "var(--surface2)", borderBottom: "1.5px solid var(--border)" }}>
                          {["#","BOX","VOL","WRITER","ARTIST","ARC / STORY","CONDITION","KEY","SIGNED","NM","VF","PLANNED","CHECK"].map(h => (
                            <th key={h} style={{ padding: "6px 8px", textAlign: h === "PLANNED" || h === "CHECK" ? "center" : "left", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.58rem", letterSpacing: "1.5px", color: h === "PLANNED" ? COPY_META.planned.color : h === "CHECK" ? COPY_META.check.color : "var(--muted)", fontWeight: 400 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {gr.copies.map((c, ci) => {
                          const boxCopies = gr.copies.filter(x => x.Box === c.Box).length;
                          const boxDup   = boxCopies > 1;
                          const isKey    = (c.Key    || "").toUpperCase() === "YES";
                          const isSigned = (c.Signed || "").toUpperCase() === "YES";
                          const copyKey  = ck(gr.key, ci);
                          const copyDec  = copyDecisions.get(copyKey);
                          const rowBg    = copyDec === "check" ? "#faf5ff" : copyDec === "planned" ? "#fefce8" : boxDup ? "#fff8f8" : "transparent";

                          return (
                            <tr key={ci} style={{ borderBottom: "1px solid var(--border)", background: rowBg }}>
                              <td style={{ padding: "7px 10px", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", color: "var(--muted)" }}>#{ci + 1}</td>
                              <td style={{ padding: "7px 10px", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.78rem", color: "var(--red)", whiteSpace: "nowrap" }}>
                                Box {c.Box}{boxDup && <span style={{ marginLeft: 3, fontSize: "0.5rem", color: "#dc2626" }}>⚠</span>}
                              </td>
                              <td style={{ padding: "7px 8px", color: "var(--muted2)", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.72rem" }}>{c.Volume ? `V${c.Volume}` : "—"}</td>
                              <td style={{ padding: "7px 8px", color: "var(--text2)", maxWidth: 140, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={c.Writer || ""}>{c.Writer || "—"}</td>
                              <td style={{ padding: "7px 8px", color: "var(--text2)", maxWidth: 140, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={c.Artist || ""}>{c.Artist || "—"}</td>
                              <td style={{ padding: "7px 8px", color: "#7c3aed", maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Crimson Pro',serif", fontSize: "0.78rem", fontStyle: "italic" }} title={c.Arc || ""}>{c.Arc || "—"}</td>
                              <td style={{ padding: "7px 8px", color: "var(--muted2)", whiteSpace: "nowrap" }}>{c.Condition || "—"}</td>
                              <td style={{ padding: "7px 8px" }}>
                                {isKey && <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.56rem", color: "#d97706", background: "#d9770618", border: "1px solid #d9770640", padding: "2px 5px", borderRadius: 3 }}>KEY</span>}
                              </td>
                              <td style={{ padding: "7px 8px" }}>
                                {isSigned && <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.56rem", color: "#8b2be2", background: "#8b2be218", border: "1px solid #8b2be240", padding: "2px 5px", borderRadius: 3 }}>SGD</span>}
                              </td>
                              <td style={{ padding: "7px 8px", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.8rem", color: "var(--red)", whiteSpace: "nowrap" }}>{fmtVal(c.Value_NM)}</td>
                              <td style={{ padding: "7px 8px", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.75rem", color: "var(--muted2)", whiteSpace: "nowrap" }}>{fmtVal(c.Value_VF)}</td>

                              {/* PLANNED toggle */}
                              <td style={{ padding: "7px 8px", textAlign: "center" }}>
                                <button
                                  onClick={() => setCopyDecision(copyKey, "planned")}
                                  title="Mark this copy as Planned (intentional extra)"
                                  style={{
                                    fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.52rem", letterSpacing: "1px",
                                    padding: "3px 7px",
                                    border: `1.5px solid ${copyDec === "planned" ? COPY_META.planned.color : "var(--border)"}`,
                                    background: copyDec === "planned" ? COPY_META.planned.color : "var(--surface2)",
                                    color: copyDec === "planned" ? "#fff" : "var(--muted)",
                                    borderRadius: 3, cursor: "pointer", transition: "all 0.1s",
                                  }}>
                                  {copyDec === "planned" ? "✓" : "+"}
                                </button>
                              </td>

                              {/* CHECK toggle */}
                              <td style={{ padding: "7px 8px", textAlign: "center" }}>
                                <button
                                  onClick={() => setCopyDecision(copyKey, "check")}
                                  title="Flag this copy as Needs Checking"
                                  style={{
                                    fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.52rem", letterSpacing: "1px",
                                    padding: "3px 7px",
                                    border: `1.5px solid ${copyDec === "check" ? COPY_META.check.color : "var(--border)"}`,
                                    background: copyDec === "check" ? COPY_META.check.color : "var(--surface2)",
                                    color: copyDec === "check" ? "#fff" : "var(--muted)",
                                    borderRadius: 3, cursor: "pointer", transition: "all 0.1s",
                                  }}>
                                  {copyDec === "check" ? "✓" : "?"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* ── NOTE TAKER ── */}
                  <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", background: "#fafaf8" }}>
                    <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.56rem", letterSpacing: "1.5px", color: "var(--muted)", marginBottom: 5 }}>NOTE</div>
                    <textarea
                      value={groupNote}
                      onChange={e => updateNote(gr.key, e.target.value)}
                      placeholder="Add a note about this group — why it's a dup, what to do with it, context…"
                      rows={2}
                      style={{ width: "100%", padding: "7px 10px", border: "1.5px solid var(--border)", borderRadius: 5, fontSize: "0.82rem", fontFamily: "'Crimson Pro',serif", color: "var(--text2)", background: "#fff", resize: "vertical", boxSizing: "border-box", outline: "none" }}
                      onFocus={e => { e.currentTarget.style.borderColor = "var(--red)"; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
                    />
                  </div>
                  <div style={{ padding: "7px 14px 9px", background: (gr.flag === "same-box" ? "#dc2626" : "#d97706") + "08", borderTop: "1px solid var(--border)", fontSize: "0.72rem", color: "var(--muted2)", fontFamily: "'Crimson Pro',serif", display: "flex", alignItems: "center", gap: 12 }}>
                    <span>
                      {gr.flag === "same-box"    && "⚠ Two or more copies share a box — likely a data entry error unless you own multiple copies."}
                      {gr.flag === "bought-twice" && "↗ Same book in different boxes — likely purchased more than once."}
                    </span>
                    <button
                      onClick={() => { toggleHide(gr.key); setOpenKeys(prev => { const next = new Set(prev); next.delete(gr.key); return next; }); }}
                      style={{ marginLeft: "auto", fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.56rem", letterSpacing: "1px", padding: "3px 10px", border: "1px solid #9ca3af", background: "none", color: "#9ca3af", borderRadius: 3, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                      HIDE THIS GROUP
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>}

      {/* Show all — title view only */}
      {groupBy === "title" && filtered.length > 80 && !showAll && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={() => setShowAll(true)}
            style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.85rem", letterSpacing: "2px", color: "var(--red)", background: "none", border: "1.5px solid var(--red)", borderRadius: 6, padding: "10px 28px", cursor: "pointer" }}>
            SHOW ALL {filtered.length.toLocaleString()} GROUPS
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.1rem", letterSpacing: "3px", marginBottom: 8 }}>
            {filter === "active" && hidden.size > 0 ? "ALL GROUPS DISMISSED" : "NO MATCHES"}
          </div>
          <div style={{ fontSize: "0.8rem" }}>
            {filter === "active" && hidden.size > 0
              ? `You've dismissed all ${hidden.size} groups. Switch to "All Groups" or "Dismissed" to review them.`
              : "Try adjusting your search or filter."}
          </div>
        </div>
      )}

      {/* ── OUTPUT PANEL ── */}
      {(copyDecisions.size > 0 || hidden.size > 0) && (
        <div style={{ marginTop: 32, borderTop: "2px solid var(--border)", paddingTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.2rem", letterSpacing: "3px", color: "var(--red)", margin: 0 }}>
              REVIEW OUTPUT
            </h2>
            {hidden.size > 0 && (
              <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", letterSpacing: "1.5px", background: "#f3f4f6", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 3, padding: "2px 8px" }}>
                {hidden.size} DISMISSED
              </span>
            )}
            {copyDecisions.size > 0 && (
              <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", letterSpacing: "1.5px", background: "#fefce8", color: "#d97706", border: "1px solid #fcd34d", borderRadius: 3, padding: "2px 8px" }}>
                {copyDecisions.size} COPY DECISIONS
              </span>
            )}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {copyDecisions.size > 0 && (
                <button onClick={() => setShowOutput(v => !v)}
                  style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.72rem", letterSpacing: "1.5px", padding: "7px 18px", border: "1.5px solid var(--red)", background: showOutput ? "var(--red)" : "none", color: showOutput ? "#fff" : "var(--red)", borderRadius: 4, cursor: "pointer" }}>
                  {showOutput ? "HIDE OUTPUT" : "GENERATE OUTPUT"}
                </button>
              )}
              <button onClick={clearAll}
                style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", letterSpacing: "1px", padding: "7px 14px", border: "1px solid var(--border)", background: "none", color: "var(--muted)", borderRadius: 4, cursor: "pointer" }}>
                CLEAR ALL
              </button>
            </div>
          </div>

          {showOutput && copyDecisions.size > 0 && (
            <div style={{ position: "relative", marginBottom: 16 }}>
              <textarea
                ref={outputRef}
                readOnly
                value={outputText}
                style={{ width: "100%", minHeight: 260, padding: "14px 16px", fontFamily: "monospace", fontSize: "0.8rem", lineHeight: 1.6, background: "#0f1a12", color: "#4ade80", border: "1.5px solid #1e3a22", borderRadius: 8, resize: "vertical", boxSizing: "border-box" }}
                onFocus={e => e.target.select()}
              />
              <button
                onClick={() => { navigator.clipboard.writeText(outputText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
                style={{ position: "absolute", top: 10, right: 10, fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", letterSpacing: "1.5px", padding: "5px 14px", border: `1.5px solid ${copied ? "#16a34a" : "#2d6a3f"}`, background: copied ? "#16a34a" : "#1e3a22", color: copied ? "#fff" : "#4ade80", borderRadius: 4, cursor: "pointer" }}>
                {copied ? "COPIED ✓" : "COPY"}
              </button>
            </div>
          )}

          {/* ── NOTES FOR CLAUDE ── */}
          {claudeScript && (
            <div style={{ marginTop: 16, borderTop: "1px dashed var(--border)", paddingTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.75rem", letterSpacing: "2px", color: "#6d28d9" }}>
                  NOTES FOR CLAUDE
                </div>
                <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.58rem", letterSpacing: "1px", background: "#ede9fe", color: "#7c3aed", border: "1px solid #ddd6fe", borderRadius: 3, padding: "2px 7px" }}>
                  {notes.size} GROUPS WITH NOTES
                </span>
                <button
                  onClick={() => setShowClaude(v => !v)}
                  style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", letterSpacing: "1.5px", padding: "5px 14px", border: "1.5px solid #7c3aed", background: showClaude ? "#7c3aed" : "none", color: showClaude ? "#fff" : "#7c3aed", borderRadius: 4, cursor: "pointer" }}>
                  {showClaude ? "HIDE" : "SHOW SCRIPT"}
                </button>
              </div>
              {showClaude && (
                <div style={{ position: "relative" }}>
                  <textarea
                    ref={claudeRef}
                    readOnly
                    value={claudeScript}
                    style={{ width: "100%", minHeight: 260, padding: "14px 16px", fontFamily: "monospace", fontSize: "0.8rem", lineHeight: 1.6, background: "#1a0f2e", color: "#c4b5fd", border: "1.5px solid #4c1d95", borderRadius: 8, resize: "vertical", boxSizing: "border-box" }}
                    onFocus={e => e.target.select()}
                  />
                  <button
                    onClick={() => { navigator.clipboard.writeText(claudeScript).then(() => { setCopiedClaude(true); setTimeout(() => setCopiedClaude(false), 2000); }); }}
                    style={{ position: "absolute", top: 10, right: 10, fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem", letterSpacing: "1.5px", padding: "5px 14px", border: `1.5px solid ${copiedClaude ? "#6d28d9" : "#4c1d95"}`, background: copiedClaude ? "#6d28d9" : "#2e1065", color: copiedClaude ? "#fff" : "#c4b5fd", borderRadius: 4, cursor: "pointer" }}>
                    {copiedClaude ? "COPIED ✓" : "COPY"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
