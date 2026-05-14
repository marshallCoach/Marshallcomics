import { useState, useMemo } from "react";
import { DATA1 } from "@/data/data1";

const events = DATA1.calendar;

function calClass(type: string) {
  const t = (type || "").toUpperCase();
  if (t.includes("WHATNOT")) return "lc-whatnot";
  if (t.includes("CGC"))     return "lc-cgc";
  if (t.includes("JUNETEENTH") || t.includes("SPECIAL")) return "lc-special";
  if (t.includes("TERRIFICON") || t.includes("NYCC")) return "lc-con";
  return "";
}

export default function Calendar() {
  const [q, setQ]       = useState("");
  const [type, setType] = useState("");
  const [open, setOpen] = useState<Set<number>>(new Set());

  const results = useMemo(() => {
    const ql = q.toLowerCase();
    return events.filter(e => {
      if (ql && ![e.Theme, e.Featured_Books, e.Revenue_Notes, e.Prep].join(" ").toLowerCase().includes(ql)) return false;
      if (type && !(e.Event_Type || "").toUpperCase().includes(type)) return false;
      return true;
    });
  }, [q, type]);

  const clear = () => { setQ(""); setType(""); setOpen(new Set()); };
  const toggle = (i: number) => {
    setOpen(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };

  return (
    <div>
      <div className="filters">
        <input placeholder="Search theme, books, notes..." value={q} onChange={e => setQ(e.target.value)} />
        <select value={type} onChange={e => setType(e.target.value)}>
          <option value="">All Events</option>
          <option value="WHATNOT">Whatnot Shows</option>
          <option value="CGC">CGC Submissions</option>
          <option value="CON">Conventions</option>
        </select>
        <button className="clear-btn" onClick={clear}>✕ Clear</button>
      </div>

      <div className="results-bar">
        <span>{results.length} events</span>
      </div>

      <div className="list-view">
        {results.map((ev, i) => {
          const isOpen = open.has(i);
          const revenue = (ev.Revenue_Notes || "").match(/\$[\d,–\-]+/g)?.[0] || "";
          return (
            <div key={i} className={`lcard ${calClass(ev.Event_Type || "")}${isOpen ? " open" : ""}`} onClick={() => toggle(i)}>
              <div className="lcard-head">
                <span className="lcard-date">{ev.Date}</span>
                <span className="lcard-tag">{ev.Event_Type}</span>
                <span className="lcard-title">{ev.Theme}</span>
                {revenue && <span className="lcard-right">{revenue}</span>}
              </div>
              {isOpen && (
                <div className="lcard-expand">
                  {ev.Featured_Books && <div className="dr"><span className="dl">Books</span><span className="dv">{ev.Featured_Books.substring(0, 300)}</span></div>}
                  {ev.Prep          && <div className="dr" style={{ marginTop: 6 }}><span className="dl">Prep</span><span className="dv">{ev.Prep.substring(0, 300)}</span></div>}
                  {ev.Revenue_Notes && <div className="dr" style={{ marginTop: 6 }}><span className="dl">Notes</span><span className="dv">{ev.Revenue_Notes.substring(0, 200)}</span></div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
