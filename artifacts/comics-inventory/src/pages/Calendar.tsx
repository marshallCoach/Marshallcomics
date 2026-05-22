import { useState, useMemo } from "react";

interface CalEvent { Type: string; Date: string; Theme: string; Books: string; Revenue: string; Prep: string; sortDate: number; }

function parseSortDate(dateStr: string): number {
  const s = dateStr || "";
  const MONTHS: Record<string,number> = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  const m = s.match(/([a-z]{3})\w*[\s.]+(\d{1,2})[,\s]+(\d{4})/i);
  if (m) return parseInt(m[3])*10000 + (MONTHS[m[1].toLowerCase().slice(0,3)]||0)*100 + parseInt(m[2]);
  const m2 = s.match(/([a-z]{3})\w*\s+(\d{4})/i);
  if (m2) return parseInt(m2[2])*10000 + (MONTHS[m2[1].toLowerCase().slice(0,3)]||0)*100;
  const m3 = s.match(/by\s+([a-z]{3})/i);
  if (m3) return 20260000 + (MONTHS[(m3[1]||"").toLowerCase().slice(0,3)]||0)*100;
  return 0;
}

const rawEvents = [
  { Type:"🟣 TERRIFICON",  Date:"Aug 7–9, 2026",  Theme:"Terrificon 2026 — Jim Lee SATURDAY ONLY",  Books:"Wolverine #8 (unsigned), WildCATs #2+#11 (re-sign), Superman Unchained #1, Batman Europa #1, Flash #164, Nightwing Rebirth #1, Hawkman #1",  Revenue:"$1,500–$3,500 in potential CGC value uplift",   Prep:"Press all books before Aug 7. Hotel: Hyatt code G-TRFC. Arrive 10am Saturday for Jim Lee. Bring Agent of Slabs contact." },
  { Type:"🟣 NYCC",        Date:"Oct 8–11, 2026", Theme:"NYCC 2026 — Stan Lee BP #513 + Heritage eval",  Books:"Black Panther #513 (Stan Lee — PSA/DNA auth), Thor #169 CGC 8.0 (Heritage eval), buy budget $100–300",  Revenue:"$800–$1,500 BP#513 authenticated + Heritage networking",  Prep:"Book PSA/DNA table appointment. Bring BP#513 in hard case. Bring Thor #169 slab for Heritage evaluation." },
  { Type:"🟡 WHATNOT",     Date:"Jun 18, 2026",   Theme:"Show 1 — Black Heroes Month: Priest-Era Black Panther",  Books:"BP vol3 #1–10 (Priest), Captain Carter #1 (Hayley Atwell signed — personalized), Truth: RWB #1, Black Lightning #1",  Revenue:"$300–$600",   Prep:"Pull BP Priest run. Tell Captain Carter story (Hayley Atwell signed to Robert). Lead with emotional anchor." },
  { Type:"🟡 WHATNOT",     Date:"Jun 19, 2026",   Theme:"Juneteenth Special AM Show — Black History Keys",  Books:"Truth: RWB #1 (Baker remarked), Black Panther #513 (Stan Lee signed), Black Lightning #1, Storm keys",  Revenue:"$400–$800",   Prep:"Special Juneteenth morning show. Lead with the Stan Lee story — 'signed in his final years.'" },
  { Type:"🟡 WHATNOT",     Date:"Jun 25, 2026",   Theme:"Show 2 — Batman Family: King/Snyder Runs",  Books:"Batman #1 Snyder, Batman #21+22 The Button, Batman #50 Wedding, Vision #1 (Tom King signed), Batman #125 (Jiménez)",  Revenue:"$250–$500",   Prep:"Pull Box 15 + Box 11 (Snyder). Tom King Vision is the emotional anchor. Tell the Tom King → Vision → Batman story." },
  { Type:"🟡 WHATNOT",     Date:"Jul 2, 2026",    Theme:"Show 3 — Spider-Man Family + Carnage Keys",  Books:"ASM #361 (1st Carnage — Bagley/Sharen signed), Ultimate Fallout #4 Foil (1st Miles), Spider-Man keys",  Revenue:"$300–$600",   Prep:"ASM #361 signed by both Bagley + Sharen — dual sig story. Miles Morales is the emotional core." },
  { Type:"🟡 WHATNOT",     Date:"Jul 9, 2026",    Theme:"Show 4 — Captain America: Brubaker Complete",  Books:"Cap America Vol5 #1 (Brubaker), #25 Death of Cap, Winter Soldier arc, Sam Wilson Cap keys",  Revenue:"$200–$450",   Prep:"Box 13 = entire Brubaker/Remender/Kirkman Cap run. Frame as: 'The greatest Cap run ever written.'" },
  { Type:"🟡 WHATNOT",     Date:"Jul 16, 2026",   Theme:"Show 5 — X-Men: Krakoa Era Complete",  Books:"HoX #1, PoX #1, X-Force #1, X-Men Red, AXE complete, Immortal Thor #1 (bonus)",  Revenue:"$300–$600",   Prep:"Box 35 = Krakoa era. Frame as: 'The decade-defining X-Men run. Already ended — already collectible.'" },
  { Type:"🟡 WHATNOT",     Date:"Jul 23, 2026",   Theme:"Show 6 — Signed Books Show: The Stories Behind the Signatures",  Books:"All 48 signed books from Box 2 — Atwell, King, Hickman, Bagley, Skottie Young, Moore, etc.",  Revenue:"$500–$1,200",  Prep:"This is your biggest show. Every book has a STORY. Lead with Captain Carter. End with Stan Lee." },
  { Type:"🟡 WHATNOT",     Date:"Jul 30, 2026",   Theme:"Show 7 — DC Rebirth Era: Snyder JL / Dark Nights Metal",  Books:"Dark Knights Metal #1, Batman Who Laughs #1, Justice League #1 Snyder, Rebirth Special #1",  Revenue:"$250–$500",   Prep:"Box 11 = Snyder JL / Metal. Frame as: 'The most ambitious DC event of the 2010s.'" },
  { Type:"🟢 CGC",         Date:"By Jul 1, 2026", Theme:"CGC Press Submission — Priority Batch Before Terrificon",  Books:"Batman #656+657, Wolverine #8 (unsigned), Vision #1 (Tom King), ASM #361, Secret Wars #1, NW #1, Mockingbird #8, WildCATs #2+#11",  Revenue:"$2,000–$4,500 value uplift after grading",  Prep:"Submit all to press service by July 1 for 4-8 week turnaround. Must be back by Aug 7 for Terrificon. Ship all at once to save." },
  { Type:"🟢 CGC",         Date:"Jun 5, 2026 ⚠️", Theme:"DEADLINE: Jorge Jiménez CGC SS — Batman #125",  Books:"Batman #125 (Failsafe Part 1 — Jiménez drew it). Press and submit immediately.",  Revenue:"$120–$200 Green Qualified",  Prep:"IMMINENT DEADLINE. This is days away. Press first, then submit. Jiménez drew Failsafe arc on Batman #125." },
  { Type:"🟢 CGC",         Date:"Jun 26, 2026",   Theme:"Geoff Johns + Jason Fabok CGC SS — JL #21 + JSA",  Books:"Justice League #21, JSA books with existing unwitnessed Geoff Johns sigs",  Revenue:"$150–$300 Green/Yellow combo",  Prep:"Johns sig adds to existing unwitnessed VA sigs = yellow/green combo label. Pull books, sleeve, ship." },
  { Type:"🟢 CGC",         Date:"Jul 10, 2026",   Theme:"Roy Thomas CGC SS — 5 books, $450 fees → $820–$1,630 return",  Books:"Avengers #60, #87, King-Size #2, Marvel Premiere #1, Saga Human Torch #3",  Revenue:"$820–$1,630 (Roy Thomas co-created Wolverine, Vision, Carol Danvers, Adam Warlock)",  Prep:"Thomas co-created Wolverine. High ROI signing. Same deadline as Mike Mayhew. Submit both batches simultaneously." },
  { Type:"🟢 CGC",         Date:"Jul 10, 2026",   Theme:"Mike Mayhew CGC SS — ASM #50 Alex Ross Timeless Virgin",  Books:"ASM #50 Alex Ross Timeless Virgin cover — already signed",  Revenue:"$100–$200 Green Qualified",  Prep:"Already signed — submit via CGC × JSA green Qualified path. Same deadline as Roy Thomas." },
];

const events: CalEvent[] = rawEvents.map(e => ({ ...e, sortDate: parseSortDate(e.Date) }));
export const CALENDAR_EVENTS = events;

// ── Calendar grid helpers ─────────────────────────────────────────────────────
const MONTH_NAMES = ["","January","February","March","April","May","June","July","August","September","October","November","December"];

function parseEventDates(ev: CalEvent): Array<{year:number; month:number; day:number}> {
  const s = ev.Date || "";
  const MONTHS: Record<string,number> = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  // Range: "Aug 7–9, 2026" or "Oct 8–11, 2026"
  const rm = s.match(/([a-z]{3})\w*[\s.]+(\d{1,2})[–\-](\d{1,2})[,\s]+(\d{4})/i);
  if (rm) {
    const mon = MONTHS[rm[1].toLowerCase().slice(0,3)] || 0;
    const yr  = parseInt(rm[4]);
    const out: Array<{year:number;month:number;day:number}> = [];
    for (let d = parseInt(rm[2]); d <= parseInt(rm[3]); d++) out.push({year:yr,month:mon,day:d});
    return out;
  }
  // Single: "Jun 18, 2026" or "Jun 5, 2026 ⚠️"
  const sm = s.match(/([a-z]{3})\w*[\s.]+(\d{1,2})[,\s]+(\d{4})/i);
  if (sm) return [{year:parseInt(sm[3]),month:MONTHS[sm[1].toLowerCase().slice(0,3)]||0,day:parseInt(sm[2])}];
  // "By Jul 1, 2026"
  const bm = s.match(/by\s+([a-z]{3})\w*[\s.]+(\d{1,2})[,\s]+(\d{4})/i);
  if (bm) return [{year:parseInt(bm[3]),month:MONTHS[bm[1].toLowerCase().slice(0,3)]||0,day:parseInt(bm[2])}];
  return [];
}

const CAL_MONTHS = [6,7,8,9,10,11,12].map(m => ({year:2026,month:m,name:MONTH_NAMES[m].toUpperCase()}));

function calClass(type: string) {
  const t = (type || "").toUpperCase();
  if (t.includes("WHATNOT")) return "lc-whatnot";
  if (t.includes("CGC"))     return "lc-cgc";
  if (t.includes("SPECIAL") || t.includes("JUNETEENTH")) return "lc-special";
  if (t.includes("TERRIFICON") || t.includes("NYCC") || t.includes("CON")) return "lc-con";
  return "";
}

function typeLabel(type: string) {
  return (type || "").replace(/🟡|🟢|🟣|🔴|⭐/g, "").trim();
}

function typeIcon(type: string) {
  const t = (type || "").toUpperCase();
  if (t.includes("WHATNOT"))   return { icon:"📺", label:"WHATNOT", bg:"#e8f5e8", color:"#1a6a1a" };
  if (t.includes("CGC"))       return { icon:"🏆", label:"CGC",     bg:"#e8f0ff", color:"#1a4a99" };
  if (t.includes("TERRIFICON"))return { icon:"🎪", label:"CON",     bg:"#f0ebff", color:"#5522aa" };
  if (t.includes("NYCC"))      return { icon:"🗽", label:"NYCC",    bg:"#f0ebff", color:"#5522aa" };
  return { icon:"📅", label:"EVENT", bg:"var(--surface2)", color:"var(--muted2)" };
}

export default function Calendar() {
  const [q,       setQ]       = useState("");
  const [type,    setType]    = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [view,    setView]    = useState<"list" | "card" | "cal">("list");
  const [open,    setOpen]    = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    let list = events.filter(e => {
      if (type && !(e.Type || "").toUpperCase().includes(type)) return false;
      if (!ql) return true;
      return [e.Theme, e.Books, e.Revenue, e.Prep, e.Date].join(" ").toLowerCase().includes(ql);
    });
    list = [...list].sort((a, b) =>
      sortDir === "asc" ? a.sortDate - b.sortDate : b.sortDate - a.sortDate
    );
    return list;
  }, [q, type, sortDir]);

  const toggle = (i: number) => setOpen(prev => {
    const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n;
  });

  const dayEventMap = useMemo(() => {
    const m: Record<string, CalEvent[]> = {};
    for (const ev of events) {
      for (const {year,month,day} of parseEventDates(ev)) {
        const k = `${year}-${month}-${day}`;
        if (!m[k]) m[k] = [];
        m[k].push(ev);
      }
    }
    return m;
  }, []);

  const whatnotCount = events.filter(e => e.Type.toUpperCase().includes("WHATNOT")).length;
  const cgcCount     = events.filter(e => e.Type.toUpperCase().includes("CGC")).length;
  const conCount     = events.filter(e => e.Type.toUpperCase().includes("TERRIFICON") || e.Type.toUpperCase().includes("NYCC")).length;

  return (
    <div>
      {/* Stats bar */}
      <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)", padding:"10px 20px",
        display:"flex", gap:20, flexWrap:"wrap", alignItems:"center" }}>
        {[
          { val: events.length,  lbl: "Events" },
          { val: whatnotCount,   lbl: "Whatnot" },
          { val: cgcCount,       lbl: "CGC" },
          { val: conCount,       lbl: "Cons" },
          { val: "$9k–$18k",     lbl: "Revenue" },
        ].map(s => (
          <div key={s.lbl} style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.1rem", color:"var(--red)", letterSpacing:"1px" }}>{s.val}</div>
            <div style={{ fontSize:"0.6rem", letterSpacing:"1.5px", fontFamily:"'Bebas Neue',sans-serif", color:"var(--muted)" }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)",
        padding:"10px 18px", display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
        <input
          placeholder="Search events…"
          value={q} onChange={e => setQ(e.target.value)}
          style={{ background:"var(--bg)", border:"1.5px solid var(--border)", color:"var(--text)",
            padding:"7px 12px", borderRadius:5, fontFamily:"'Crimson Pro',serif", fontSize:"0.88rem",
            flex:"1 1 160px", minWidth:120 }}
        />
        <select value={type} onChange={e => setType(e.target.value)}
          style={{ background:"var(--bg)", border:"1.5px solid var(--border)", color:"var(--text)",
            padding:"7px 10px", borderRadius:5, fontFamily:"'Crimson Pro',serif", fontSize:"0.88rem" }}>
          <option value="">All Types</option>
          <option value="WHATNOT">Whatnot</option>
          <option value="CGC">CGC</option>
          <option value="TERRIFICON">Terrificon</option>
          <option value="NYCC">NYCC</option>
        </select>

        {/* Sort direction */}
        <button
          onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
          title={sortDir === "asc" ? "Oldest first — click for newest first" : "Newest first — click for oldest first"}
          style={{ background:"var(--surface2)", border:"1.5px solid var(--border)", borderRadius:5,
            padding:"7px 14px", cursor:"pointer", fontFamily:"'Bebas Neue',sans-serif",
            fontSize:"0.72rem", letterSpacing:"1.5px", color:"var(--text2)",
            display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap",
            transition:"border-color 0.15s" }}>
          {sortDir === "asc" ? "↑ DATE ASC" : "↓ DATE DESC"}
        </button>

        {/* View toggle */}
        <div style={{ display:"flex", border:"1.5px solid var(--border)", borderRadius:5, overflow:"hidden", flexShrink:0 }}>
          {(["list","card","cal"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              background: view===v ? "var(--red)" : "var(--surface2)",
              color: view===v ? "#fff" : "var(--muted2)",
              border:"none", padding:"7px 14px", cursor:"pointer",
              fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.72rem", letterSpacing:"1.5px",
              transition:"all 0.15s",
            }}>
              {v === "list" ? "☰ LIST" : v === "card" ? "⊞ CARDS" : "📅 CAL"}
            </button>
          ))}
        </div>

        {(q || type) && (
          <button onClick={() => { setQ(""); setType(""); setOpen(new Set()); }}
            style={{ background:"transparent", color:"var(--muted2)", border:"1.5px solid var(--border)",
              padding:"7px 14px", borderRadius:5, cursor:"pointer", fontFamily:"'Bebas Neue',sans-serif",
              fontSize:"0.72rem", letterSpacing:"1.5px" }}>
            ✕ CLEAR
          </button>
        )}
      </div>

      {/* Results count */}
      <div style={{ padding:"6px 20px", fontSize:"0.72rem", color:"var(--muted)",
        fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1.5px",
        borderBottom:"1px solid var(--border)", background:"var(--surface2)" }}>
        {filtered.length} of {events.length} events · sorted {sortDir === "asc" ? "earliest first" : "latest first"}
      </div>

      {/* LIST VIEW */}
      {view === "list" && (
        <div className="list-view">
          {filtered.map((ev, i) => {
            const isOpen = open.has(i);
            const revenue = (ev.Revenue || "").match(/\$[\d,k–\-]+/g)?.[0] || "";
            const ti = typeIcon(ev.Type);
            return (
              <div key={i} className={`lcard ${calClass(ev.Type)}${isOpen ? " open" : ""}`} onClick={() => toggle(i)}>
                <div className="lcard-head">
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.88rem",
                    color:"var(--red)", minWidth:90, letterSpacing:"0.5px" }}>{ev.Date}</span>
                  <span style={{ background:ti.bg, color:ti.color, border:`1px solid ${ti.color}22`,
                    borderRadius:3, padding:"1px 7px", fontSize:"0.62rem",
                    fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px",
                    whiteSpace:"nowrap", flexShrink:0 }}>
                    {ti.icon} {ti.label}
                  </span>
                  <span className="lcard-title">{ev.Theme.substring(0, 90)}</span>
                  {revenue && <span className="lcard-right">{revenue}</span>}
                  <span style={{ color:"var(--muted)", fontSize:"0.7rem", flexShrink:0 }}>{isOpen?"▲":"▼"}</span>
                </div>
                {isOpen && (
                  <div className="lcard-expand">
                    {ev.Books   && <div className="dr"><span className="dl">Books</span><span className="dv">{ev.Books}</span></div>}
                    {ev.Prep    && <div className="dr" style={{marginTop:6}}><span className="dl">Prep</span><span className="dv">{ev.Prep}</span></div>}
                    {ev.Revenue && <div className="dr" style={{marginTop:6}}><span className="dl">Revenue</span><span className="dv" style={{color:"var(--gold)"}}>{ev.Revenue}</span></div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CALENDAR GRID VIEW */}
      {view === "cal" && (
        <div style={{ padding:"16px 18px 40px" }}>
          {/* Legend */}
          <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:18, alignItems:"center" }}>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem", letterSpacing:"1.5px", color:"var(--muted)" }}>LEGEND:</span>
            {[
              { label:"Whatnot Show", bg:"#e8f5e8", color:"#1a6a1a" },
              { label:"CGC",          bg:"#e8f0ff", color:"#1a4a99" },
              { label:"Convention",   bg:"#f0ebff", color:"#5522aa" },
            ].map(t => (
              <div key={t.label} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:14, height:14, borderRadius:3, background:t.bg, border:`1.5px solid ${t.color}55` }} />
                <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.62rem", letterSpacing:"1px", color:"var(--muted2)" }}>{t.label}</span>
              </div>
            ))}
          </div>

          {/* Month grids */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:16 }}>
            {CAL_MONTHS.map(({ year, month, name }) => {
              const firstDay     = new Date(year, month-1, 1).getDay();
              const daysInMonth  = new Date(year, month, 0).getDate();
              const cells: (number|null)[] = [];
              for (let i=0; i<firstDay; i++) cells.push(null);
              for (let d=1; d<=daysInMonth; d++) cells.push(d);
              while (cells.length % 7 !== 0) cells.push(null);

              const monthEvDays = Object.entries(dayEventMap)
                .filter(([k]) => { const [y,m2] = k.split("-").map(Number); return y===year && m2===month; })
                .sort(([a],[b]) => parseInt(a.split("-")[2]) - parseInt(b.split("-")[2]));

              const hasAny = monthEvDays.length > 0;

              return (
                <div key={`${year}-${month}`} style={{
                  background:"var(--surface)", border:`1.5px solid ${hasAny?"rgba(200,16,46,0.25)":"var(--border)"}`,
                  borderRadius:8, padding:"12px 14px",
                }}>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.88rem",
                    letterSpacing:"3px", color: hasAny ? "var(--red)" : "var(--muted2)",
                    marginBottom:10, lineHeight:1 }}>
                    {name} {year}
                  </div>

                  {/* Day headers */}
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:1, marginBottom:3 }}>
                    {["S","M","T","W","T","F","S"].map((d,i) => (
                      <div key={i} style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.54rem",
                        letterSpacing:"0.5px", color:"var(--muted)", textAlign:"center" }}>{d}</div>
                    ))}
                  </div>

                  {/* Day cells */}
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
                    {cells.map((d, idx) => {
                      if (!d) return <div key={idx} style={{ paddingTop:6 }} />;
                      const k = `${year}-${month}-${d}`;
                      const dayEvs = dayEventMap[k] || [];
                      const has = dayEvs.length > 0;
                      const ti = has ? typeIcon(dayEvs[0].Type) : null;
                      return (
                        <div key={idx}
                          title={has ? dayEvs.map(e => e.Theme.substring(0,55)).join("; ") : undefined}
                          style={{
                            textAlign:"center", fontFamily:"'Bebas Neue',sans-serif",
                            fontSize:"0.7rem", letterSpacing:"0.5px", lineHeight:1,
                            padding:"4px 1px", borderRadius:4,
                            background: has ? ti!.bg : "transparent",
                            color: has ? ti!.color : "var(--text)",
                            border: has ? `1px solid ${ti!.color}44` : "1px solid transparent",
                            fontWeight: has ? 700 : 400,
                            cursor: has ? "help" : "default",
                          }}>
                          {d}
                          {dayEvs.length > 1 && (
                            <div style={{ fontSize:"0.44rem", lineHeight:1, marginTop:1, color:ti!.color }}>×{dayEvs.length}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Event list for this month */}
                  {hasAny && (
                    <div style={{ marginTop:10, borderTop:"1px solid var(--border)", paddingTop:8, display:"flex", flexDirection:"column", gap:4 }}>
                      {monthEvDays.flatMap(([k, evs]) =>
                        evs.map(ev => ({ ev, day: parseInt(k.split("-")[2]) }))
                      ).map(({ ev, day }, i) => {
                        const ti2 = typeIcon(ev.Type);
                        return (
                          <div key={i} style={{ display:"flex", gap:6, alignItems:"flex-start" }}>
                            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.66rem",
                              color:ti2.color, minWidth:18, flexShrink:0, marginTop:1 }}>{day}</div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.6rem",
                                letterSpacing:"0.5px", color:ti2.color, lineHeight:1.3 }}>
                                {ti2.icon} {ev.Theme.substring(0,48)}{ev.Theme.length>48?"…":""}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CARD VIEW */}
      {view === "card" && (
        <div style={{ padding:"12px 18px", display:"grid",
          gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:10 }}>
          {filtered.map((ev, i) => {
            const isOpen = open.has(i);
            const ti = typeIcon(ev.Type);
            return (
              <div key={i} onClick={() => toggle(i)} style={{
                background:"var(--surface)", border:"1.5px solid var(--border)",
                borderLeft:`4px solid ${ti.color}`, borderRadius:6, padding:"14px",
                cursor:"pointer", transition:"box-shadow 0.15s",
                boxShadow: isOpen ? "0 2px 10px rgba(0,0,0,0.10)" : "0 1px 3px rgba(0,0,0,0.04)",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <span style={{ background:ti.bg, color:ti.color, border:`1px solid ${ti.color}22`,
                    borderRadius:3, padding:"1px 8px", fontSize:"0.62rem",
                    fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"1px" }}>
                    {ti.icon} {ti.label}
                  </span>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.82rem",
                    color:"var(--red)", marginLeft:"auto", letterSpacing:"0.5px" }}>{ev.Date}</span>
                </div>
                <div style={{ fontSize:"0.9rem", fontWeight:600, color:"var(--brown-light)", lineHeight:1.35, marginBottom:6 }}>
                  {ev.Theme}
                </div>
                {ev.Revenue && (
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"0.78rem",
                    color:"var(--gold)", letterSpacing:"0.5px" }}>
                    {ev.Revenue.match(/\$[\d,k–\-]+(?:–\$[\d,k]+)?/)?.[0] || ""}
                  </div>
                )}
                {isOpen && (
                  <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid var(--border)", fontSize:"0.82rem", color:"var(--muted2)" }}>
                    {ev.Books && <div style={{ marginBottom:6 }}><strong style={{ color:"var(--muted)" }}>Books: </strong>{ev.Books}</div>}
                    {ev.Prep  && <div style={{ marginBottom:6 }}><strong style={{ color:"var(--muted)" }}>Prep: </strong>{ev.Prep}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
