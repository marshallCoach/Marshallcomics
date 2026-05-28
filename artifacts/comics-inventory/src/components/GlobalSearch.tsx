import { useState, useEffect, useRef, useCallback } from "react";
import { DATA3 } from "@/data/data3";
import type { NavParams } from "../App";

const comics = DATA3.comics;
const boxes  = DATA3.boxes;

const PAGES = [
  { id:"summary",     label:"Home",          section:"Inventory"    },
  { id:"everything",  label:"Every Book",    section:"Inventory"    },
  { id:"runs",        label:"Runs",          section:"Inventory"    },
  { id:"volumes",     label:"Volumes",       section:"Inventory"    },
  { id:"collection",  label:"Sales",         section:"Inventory"    },
  { id:"history",     label:"History",       section:"Inventory"    },
  { id:"stats",       label:"Stats",         section:"Inventory"    },
  { id:"dataview",    label:"Data View",     section:"Inventory"    },
  { id:"boxvisual",   label:"Box View",      section:"Organisation" },
  { id:"boxkeys",     label:"Box Keys",      section:"Organisation" },
  { id:"boxlabels",   label:"Box Labels",    section:"Organisation" },
  { id:"duplicates",  label:"Duplicates",    section:"Organisation" },
  { id:"hunting",     label:"Box Hunt",      section:"Organisation" },
  { id:"timeline",    label:"Timeline",      section:"Organisation" },
  { id:"calendar",    label:"Calendar",      section:"Business"     },
  { id:"showplanner", label:"Whatnot Shows", section:"Business"     },
  { id:"cgc",         label:"CGC Strategy",  section:"Business"     },
  { id:"signings",    label:"Signings",      section:"Business"     },
  { id:"actionplan",  label:"Action Plan",   section:"Business"     },
];

type Result =
  | { kind:"page";  id:string; label:string; section:string }
  | { kind:"comic"; title:string; issue:string; box:string; isKey:boolean; isSigned:boolean }
  | { kind:"box";   num:string; label:string; comics:number; keys:number };

function search(q: string): Result[] {
  if (!q.trim()) return [];
  const ql = q.toLowerCase();
  const results: Result[] = [];

  // Pages
  for (const p of PAGES) {
    if (p.label.toLowerCase().includes(ql) || p.section.toLowerCase().includes(ql)) {
      results.push({ kind:"page", ...p });
    }
  }

  // Boxes
  for (const b of boxes) {
    if (`box ${b.Num}`.includes(ql) || (b.Label||"").toLowerCase().includes(ql) || (b.Notes||"").toLowerCase().includes(ql)) {
      results.push({ kind:"box", num:b.Num, label:b.Label||`Box ${b.Num}`, comics:b.Comics||0, keys:b.Keys||0 });
      if (results.length >= 8) break;
    }
  }

  // Comics (title + writer + arc + key_reason)
  let comicCount = 0;
  for (const c of comics) {
    const haystack = `${c.Title} ${c.Issue} ${c.Writer} ${c.Arc} ${c.Key_Reason} ${c.First_App}`.toLowerCase();
    if (haystack.includes(ql)) {
      results.push({
        kind:"comic",
        title: c.Title,
        issue: c.Issue,
        box: c.Box,
        isKey: (c.Key||"").toUpperCase() === "YES",
        isSigned: (c.Signed||"").toUpperCase() === "YES",
      });
      comicCount++;
      if (comicCount >= 6) break;
    }
  }

  return results.slice(0, 12);
}

export default function GlobalSearch({ onNavigate, onClose }: {
  onNavigate: (tab: string, params?: NavParams) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setResults(search(q));
    setCursor(0);
  }, [q]);

  const choose = useCallback((r: Result) => {
    if (r.kind === "page")  { onNavigate(r.id); onClose(); }
    if (r.kind === "box")   { onNavigate("boxvisual", { box: r.num }); onClose(); }
    if (r.kind === "comic") { onNavigate("everything", { query: r.title }); onClose(); }
  }, [onNavigate, onClose]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor(c => Math.min(c+1, results.length-1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setCursor(c => Math.max(c-1, 0)); }
    if (e.key === "Enter" && results[cursor]) choose(results[cursor]);
  }

  return (
    <div
      style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,0.55)", backdropFilter:"blur(3px)", display:"flex", alignItems:"flex-start", justifyContent:"center", paddingTop:"12vh" }}
      onClick={onClose}
    >
      <div
        style={{ width:"100%", maxWidth:640, background:"var(--bg)", borderRadius:12, border:"1.5px solid var(--border)", boxShadow:"0 24px 64px rgba(0,0,0,0.35)", overflow:"hidden" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 18px", borderBottom:"1px solid var(--border)" }}>
          <span style={{ fontSize:"1.1rem", opacity:0.4 }}>🔍</span>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search comics, boxes, pages…"
            style={{
              flex:1, border:"none", outline:"none", background:"transparent",
              fontSize:"1rem", color:"var(--text)", fontFamily:"'Crimson Pro',serif",
            }}
          />
          <kbd style={{ fontSize:"0.65rem", color:"var(--muted)", background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:4, padding:"2px 6px" }}>ESC</kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div style={{ maxHeight:360, overflowY:"auto" }}>
            {results.map((r, i) => (
              <div
                key={i}
                onClick={() => choose(r)}
                onMouseEnter={() => setCursor(i)}
                style={{
                  display:"flex", alignItems:"center", gap:12, padding:"10px 18px",
                  cursor:"pointer", borderBottom:"1px solid var(--border)",
                  background: i === cursor ? "var(--surface2)" : "transparent",
                  transition:"background 0.1s",
                }}
              >
                {r.kind === "page" && (
                  <>
                    <span style={{ fontSize:"0.85rem", opacity:0.5, flexShrink:0 }}>📄</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.9rem", letterSpacing:"1px", color:"var(--text)" }}>{r.label}</div>
                      <div style={{ fontSize:"0.72rem", color:"var(--muted)" }}>{r.section}</div>
                    </div>
                    <span style={{ fontSize:"0.65rem", color:"var(--muted)", background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:3, padding:"1px 6px" }}>PAGE</span>
                  </>
                )}
                {r.kind === "box" && (
                  <>
                    <span style={{ fontSize:"0.85rem", opacity:0.5, flexShrink:0 }}>📦</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.9rem", letterSpacing:"1px", color:"var(--text)" }}>{r.label}</div>
                      <div style={{ fontSize:"0.72rem", color:"var(--muted)" }}>{r.comics} comics · {r.keys} keys</div>
                    </div>
                    <span style={{ fontSize:"0.65rem", color:"#1d6fa4", background:"#e8f0ff", border:"1px solid #bfdbfe", borderRadius:3, padding:"1px 6px" }}>BOX</span>
                  </>
                )}
                {r.kind === "comic" && (
                  <>
                    <span style={{ fontSize:"0.85rem", opacity:0.5, flexShrink:0 }}>📖</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.88rem", letterSpacing:"0.5px", color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {r.title} {r.issue}
                      </div>
                      <div style={{ fontSize:"0.72rem", color:"var(--muted)" }}>Box {r.box}</div>
                    </div>
                    <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                      {r.isKey    && <span style={{ fontSize:"0.6rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", background:"#fff8e0", color:"#8a6000", border:"1px solid #fde68a", borderRadius:3, padding:"1px 5px" }}>KEY</span>}
                      {r.isSigned && <span style={{ fontSize:"0.6rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px", background:"#f3e8ff", color:"#7c3aed", border:"1px solid #d8b4fe", borderRadius:3, padding:"1px 5px" }}>SGD</span>}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {q.trim() && results.length === 0 && (
          <div style={{ padding:"24px 18px", textAlign:"center", color:"var(--muted)", fontSize:"0.88rem", fontFamily:"'Crimson Pro',serif" }}>
            No results for "{q}" — try a title, writer, or box number.
          </div>
        )}

        {!q && (
          <div style={{ padding:"14px 18px", display:"flex", gap:6, flexWrap:"wrap" }}>
            {["Batman","Black Panther","X-Men","Tom King","Jim Lee","Box 1","Keys","Signed"].map(s => (
              <button key={s} onClick={() => setQ(s)} style={{
                fontSize:"0.72rem", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
                background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:4,
                padding:"4px 10px", cursor:"pointer", color:"var(--muted2)",
              }}>{s}</button>
            ))}
          </div>
        )}

        <div style={{ padding:"8px 18px", borderTop:"1px solid var(--border)", fontSize:"0.65rem", color:"var(--muted)", display:"flex", gap:16 }}>
          <span><kbd style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:3,padding:"1px 5px"}}>↑↓</kbd> navigate</span>
          <span><kbd style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:3,padding:"1px 5px"}}>↵</kbd> open</span>
          <span><kbd style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:3,padding:"1px 5px"}}>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
