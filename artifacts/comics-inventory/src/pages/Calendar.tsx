import { useState, useMemo } from "react";
import { DATA3 } from "@/data/data3";

const events = DATA3.calendar;

function calClass(type: string) {
  const t = (type || "").toUpperCase();
  if (t.includes("WHATNOT")) return "lc-whatnot";
  if (t.includes("CGC"))     return "lc-cgc";
  if (t.includes("SPECIAL") || t.includes("JUNETEENTH")) return "lc-special";
  if (t.includes("TERRIFICON") || t.includes("NYCC") || t.includes("CON")) return "lc-con";
  return "";
}

function typeLabel(type: string) {
  const t = (type || "").replace(/🟡|🟢|🟣|🔴|⭐/g, "").trim();
  return t;
}

export default function Calendar() {
  const [q,    setQ]    = useState("");
  const [type, setType] = useState("");
  const [open, setOpen] = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return events.filter(e => {
      if (type && !(e.Type || "").toUpperCase().includes(type)) return false;
      if (!ql) return true;
      return [e.Theme, e.Books, e.Revenue, e.Prep, e.Date].join(" ").toLowerCase().includes(ql);
    });
  }, [q, type]);

  const toggle = (i: number) => setOpen(prev => {
    const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n;
  });

  const whatnotCount = events.filter(e => e.Type.toUpperCase().includes("WHATNOT")).length;
  const cgcCount     = events.filter(e => e.Type.toUpperCase().includes("CGC")).length;
  const conCount     = events.filter(e => e.Type.toUpperCase().includes("CON") || e.Type.toUpperCase().includes("TERRIFICON") || e.Type.toUpperCase().includes("NYCC")).length;

  return (
    <div>
      {/* Stats bar */}
      <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)", padding:"10px 24px", display:"flex", gap:24, flexWrap:"wrap" }}>
        {[
          { val: events.length,  lbl: "Total Events" },
          { val: whatnotCount,   lbl: "Whatnot Shows" },
          { val: cgcCount,       lbl: "CGC Actions" },
          { val: conCount,       lbl: "Conventions" },
          { val: "$9k–$18k",     lbl: "Revenue Target" },
        ].map(s => (
          <div key={s.lbl} style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.1rem", color:"var(--red)", letterSpacing:"1px" }}>{s.val}</div>
            <div style={{ fontSize:"0.6rem", letterSpacing:"1.5px", fontFamily:"'Bebas Neue',sans-serif", color:"var(--muted)" }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      <div className="filters">
        <input placeholder="Search theme, books, notes…" value={q} onChange={e=>setQ(e.target.value)} />
        <select value={type} onChange={e=>setType(e.target.value)}>
          <option value="">All Events</option>
          <option value="WHATNOT">Whatnot Shows</option>
          <option value="CGC">CGC Actions</option>
          <option value="TERRIFICON">Terrificon</option>
          <option value="NYCC">NYCC</option>
        </select>
        <button className="clear-btn" onClick={()=>{setQ("");setType("");setOpen(new Set());}}>✕ Clear</button>
      </div>

      <div className="results-bar">
        <span>{filtered.length} events</span>
      </div>

      <div className="list-view">
        {filtered.map((ev, i) => {
          const isOpen = open.has(i);
          const revenue = (ev.Revenue || "").match(/\$[\d,k–\-]+/g)?.[0] || "";
          return (
            <div key={i} className={`lcard ${calClass(ev.Type)}${isOpen ? " open" : ""}`} onClick={()=>toggle(i)}>
              <div className="lcard-head">
                <span className="lcard-date">{ev.Date}</span>
                <span className="lcard-tag">{typeLabel(ev.Type)}</span>
                <span className="lcard-title">{ev.Theme.substring(0, 80)}</span>
                {revenue && <span className="lcard-right">{revenue}</span>}
              </div>
              {isOpen && (
                <div className="lcard-expand">
                  {ev.Books  && <div className="dr"><span className="dl">Books</span><span className="dv">{ev.Books.substring(0,400)}</span></div>}
                  {ev.Prep   && <div className="dr" style={{marginTop:6}}><span className="dl">Prep</span><span className="dv">{ev.Prep.substring(0,300)}</span></div>}
                  {ev.Revenue && <div className="dr" style={{marginTop:6}}><span className="dl">Revenue</span><span className="dv" style={{color:"var(--gold)"}}>{ev.Revenue.substring(0,200)}</span></div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
