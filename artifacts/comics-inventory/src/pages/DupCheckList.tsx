import { useState, useMemo } from "react";
import { DATA } from "@/data/data";
import type { Comic } from "@/data/data";

const LS_COPY_DECISIONS = "brbCopyDecisions";
const LS_NOTES          = "brbDupNotes";

type CopyAction = "planned" | "check";

function loadMap<T>(lsKey: string): Map<string, T> {
  try { return new Map(Object.entries(JSON.parse(localStorage.getItem(lsKey) || "{}"))); }
  catch { return new Map(); }
}

// Same grouping key as Duplicates.tsx
const GROUP_MAP = (() => {
  const map = new Map<string, Comic[]>();
  for (const c of DATA.comics) {
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
  return map;
})();

interface CheckItem { comic: Comic; grKey: string; ci: number; note: string; }

export default function DupCheckList() {
  const [copyDecisions] = useState(() => loadMap<CopyAction>(LS_COPY_DECISIONS));
  const [notes]         = useState(() => loadMap<string>(LS_NOTES));

  const checkItems = useMemo<CheckItem[]>(() => {
    const items: CheckItem[] = [];
    for (const [copyKey, action] of copyDecisions) {
      if (action !== "check") continue;
      const parts = copyKey.split("|||");
      const ci = parseInt(parts[parts.length - 1]);
      const grKey = parts.slice(0, -1).join("|||");
      const copies = GROUP_MAP.get(grKey);
      if (!copies || !copies[ci]) continue;
      items.push({ comic: copies[ci], grKey, ci, note: notes.get(grKey) || "" });
    }
    items.sort((a, b) => (Number(a.comic.Box) || 0) - (Number(b.comic.Box) || 0));
    return items;
  }, [copyDecisions, notes]);

  // Group by box for visual separation
  const byBox = useMemo(() => {
    const map = new Map<string | number, CheckItem[]>();
    for (const item of checkItems) {
      const box = item.comic.Box ?? "?";
      if (!map.has(box)) map.set(box, []);
      map.get(box)!.push(item);
    }
    return map;
  }, [checkItems]);

  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: "16px 12px 100px" }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "2rem", letterSpacing: "3px", color: "var(--red)", margin: 0, lineHeight: 1 }}>
          DUP HUNT
        </h1>
        <p style={{ fontSize: "0.82rem", color: "var(--muted2)", marginTop: 6, fontFamily: "'Crimson Pro',serif" }}>
          {checkItems.length} copies marked CHECK — pull these boxes and verify in person
        </p>
      </div>

      {/* Stat bar */}
      {checkItems.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          <div style={{ background: "var(--surface)", border: "1.5px solid #e9d5ff", borderTop: "3px solid #9333ea", borderRadius: 7, padding: "10px 16px", flex: "1 1 100px" }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.6rem", color: "#9333ea", lineHeight: 1 }}>{checkItems.length}</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.58rem", letterSpacing: "1.5px", color: "var(--muted2)", marginTop: 3 }}>COPIES TO CHECK</div>
          </div>
          <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderTop: "3px solid var(--red)", borderRadius: 7, padding: "10px 16px", flex: "1 1 100px" }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.6rem", color: "var(--red)", lineHeight: 1 }}>{byBox.size}</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.58rem", letterSpacing: "1.5px", color: "var(--muted2)", marginTop: 3 }}>BOXES TO PULL</div>
          </div>
        </div>
      )}

      {/* Items grouped by box */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {[...byBox.entries()].map(([box, items]) => (
          <div key={String(box)}>
            {/* Box header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1rem", letterSpacing: "2px", color: "#fff", background: "var(--red)", borderRadius: 5, padding: "3px 12px" }}>
                BOX {box}
              </div>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.58rem", letterSpacing: "1px", color: "var(--muted)" }}>
                {items.length} {items.length === 1 ? "COPY" : "COPIES"}
              </div>
            </div>

            {/* Comic cards in this box */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map(({ comic, grKey, ci, note }) => (
                <div key={`${grKey}|||${ci}`} style={{
                  background: "var(--surface)",
                  border: "1.5px solid #e9d5ff",
                  borderLeft: "4px solid #9333ea",
                  borderRadius: 8,
                  padding: "14px 16px",
                }}>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.15rem", letterSpacing: "1px", color: "var(--text)", lineHeight: 1.2 }}>
                    {comic.Title}
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1rem", color: "var(--red)", marginTop: 2 }}>
                    #{comic.Issue}
                  </div>
                  {comic.Arc && (
                    <div style={{ fontFamily: "'Crimson Pro',serif", fontSize: "0.82rem", color: "#7c3aed", fontStyle: "italic", marginTop: 2 }}>
                      {comic.Arc}
                    </div>
                  )}
                  <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span>{comic.Publisher}{comic.Year ? ` · ${comic.Year}` : ""}</span>
                    {comic.Volume && <span>Vol {comic.Volume}</span>}
                    {comic.Condition && (
                      <span style={{ fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.5px", fontSize: "0.65rem" }}>
                        {comic.Condition}
                      </span>
                    )}
                  </div>
                  {(comic.Writer || comic.Artist) && (
                    <div style={{ fontSize: "0.7rem", color: "var(--muted2)", marginTop: 3, fontFamily: "'Crimson Pro',serif" }}>
                      {comic.Writer && <span>W: {comic.Writer}</span>}
                      {comic.Writer && comic.Artist && <span> · </span>}
                      {comic.Artist && <span>A: {comic.Artist}</span>}
                    </div>
                  )}
                  {note && (
                    <div style={{ fontFamily: "'Crimson Pro',serif", fontSize: "0.82rem", color: "var(--text2)", marginTop: 8, fontStyle: "italic", borderTop: "1px solid #e9d5ff", paddingTop: 8 }}>
                      {note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {checkItems.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.1rem", letterSpacing: "3px", marginBottom: 8 }}>NO CHECK ITEMS</div>
          <div style={{ fontSize: "0.8rem", fontFamily: "'Crimson Pro',serif" }}>
            Mark individual copies as CHECK on the Duplicates page to build this hunt list.
          </div>
        </div>
      )}
    </div>
  );
}
