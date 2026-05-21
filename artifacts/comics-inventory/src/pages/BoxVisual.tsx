import { useState, useMemo } from "react";
import { DATA3 } from "@/data/data3";

const comics = DATA3.comics;
const boxes  = DATA3.boxes;

function parseIssueNum(s: string): number {
  const n = parseFloat(String(s || "").replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 9999 : n;
}

function titleColor(index: number): string {
  const hue = (index * 137.508) % 360;
  const sat = 60 + (index % 3) * 10;
  const lit = 48 + (index % 4) * 5;
  return `hsl(${Math.round(hue)},${sat}%,${lit}%)`;
}

function getBoxComics(boxNum: string) {
  return comics.filter(c => {
    const bClean = String(c.Box || "").trim().replace(/^0+/, "");
    const bNum   = boxNum.replace(/^BOX\s*/i, "").replace(/^0+/, "");
    return bClean === bNum;
  });
}

interface TitleGroup {
  title: string;
  color: string;
  issues: typeof comics;
  keyCount: number;
  signedCount: number;
}

function buildGroups(comicsList: typeof comics): TitleGroup[] {
  const byTitle: Record<string, typeof comics> = {};
  for (const c of comicsList) {
    if (!byTitle[c.Title]) byTitle[c.Title] = [];
    byTitle[c.Title].push(c);
  }
  const titles = Object.keys(byTitle).sort((a, b) => a.localeCompare(b));
  return titles.map((title, i) => {
    const issues = byTitle[title].sort((a, b) => parseIssueNum(a.Issue) - parseIssueNum(b.Issue));
    return {
      title,
      color: titleColor(i),
      issues,
      keyCount: issues.filter(c => (c.Key || "").toUpperCase() === "YES").length,
      signedCount: issues.filter(c => (c.Signed || "").toUpperCase() === "YES").length,
    };
  });
}

export default function BoxVisual() {
  const [selectedBox,   setSelectedBox]   = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [sorted,        setSorted]        = useState(false);
  const [view,          setView]          = useState<"visual" | "runs">("visual");

  const boxComics = useMemo(() =>
    selectedBox ? getBoxComics(selectedBox) : [],
  [selectedBox]);

  const titleGroups = useMemo(() => buildGroups(boxComics), [boxComics]);

  const titleColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const g of titleGroups) m[g.title] = g.color;
    return m;
  }, [titleGroups]);

  const displayComics = useMemo(() => {
    if (sorted) return titleGroups.flatMap(g => g.issues);
    return boxComics;
  }, [sorted, boxComics, titleGroups]);

  function selectBox(num: string) {
    setSelectedBox(num);
    setSelectedTitle(null);
    setView("visual");
    setSorted(false);
  }

  const selectedBoxData    = boxes.find(b => b.Num === selectedBox);
  const selectedTitleGroup = titleGroups.find(g => g.title === selectedTitle);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "18px 18px 60px" }}>

      {/* Intro label */}
      <div style={{ marginBottom: 14, fontFamily: "'Bebas Neue',sans-serif",
        fontSize: "0.75rem", letterSpacing: "2px", color: "var(--muted)" }}>
        SELECT A BOX TO VISUALIZE ITS CONTENTS
      </div>

      {/* Box grid selector */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 6, marginBottom: 24 }}>
        {boxes.map(b => {
          const isSelected = selectedBox === b.Num;
          return (
            <button key={b.Num} onClick={() => selectBox(b.Num)} style={{
              background: isSelected ? "var(--red)" : "var(--surface)",
              border: isSelected ? "2px solid var(--red-dark)" : "1.5px solid var(--border)",
              borderRadius: 6, padding: "8px 6px", cursor: "pointer",
              textAlign: "center", transition: "all 0.15s",
              boxShadow: isSelected ? "0 2px 8px rgba(200,16,46,0.3)" : "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1rem",
                color: isSelected ? "#fff" : "var(--red)", letterSpacing: "1px", lineHeight: 1 }}>
                {b.Num.replace("BOX ", "#")}
              </div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.6rem",
                color: isSelected ? "rgba(255,255,255,0.8)" : "var(--muted)", letterSpacing: "1px", marginTop: 2 }}>
                {b.Comics} books
              </div>
              {b.Keys > 0 && (
                <div style={{ width: "100%", height: 2, marginTop: 4, borderRadius: 1,
                  background: isSelected ? "rgba(255,255,255,0.6)" : "#d4a800" }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Empty state */}
      {!selectedBox && (
        <div style={{ textAlign: "center", color: "var(--muted)", padding: "60px 20px",
          fontFamily: "'Bebas Neue',sans-serif", fontSize: "1rem", letterSpacing: "2px" }}>
          TAP ANY BOX ABOVE TO SEE ITS CONTENTS
        </div>
      )}

      {/* Box detail */}
      {selectedBox && selectedBoxData && (
        <div>
          {/* Box header */}
          <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)",
            borderRadius: 8, padding: "14px 18px", marginBottom: 14,
            display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.4rem",
                color: "var(--red)", letterSpacing: "2px", lineHeight: 1 }}>
                {selectedBoxData.Num}
              </div>
              <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--brown-light)", marginTop: 3 }}>
                {selectedBoxData.Label.replace(/^Box \d+ — /i, "")}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: 4 }}>
                {selectedBoxData.Publisher} · {selectedBoxData.YearRange}
                {selectedBoxData.DateAdded ? ` · Added: ${selectedBoxData.DateAdded}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
              {[
                { val: boxComics.length,       lbl: "COMICS" },
                { val: selectedBoxData.Keys,   lbl: "KEYS" },
                { val: selectedBoxData.Signed, lbl: "SIGNED" },
                { val: titleGroups.length,     lbl: "TITLES" },
              ].map(s => (
                <div key={s.lbl} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.3rem",
                    color: "var(--red)", letterSpacing: "1px", lineHeight: 1 }}>{s.val}</div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.58rem",
                    letterSpacing: "1.5px", color: "var(--muted)", marginTop: 2 }}>{s.lbl}</div>
                </div>
              ))}
            </div>
          </div>

          {/* View toggle */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {(["visual", "runs"] as const).map(v => (
              <button key={v} onClick={() => { setView(v); setSelectedTitle(null); }} style={{
                background: view === v ? "var(--red)" : "var(--surface)",
                color: view === v ? "#fff" : "var(--muted2)",
                border: view === v ? "1.5px solid var(--red)" : "1.5px solid var(--border)",
                borderRadius: 5, padding: "6px 18px", cursor: "pointer",
                fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.78rem", letterSpacing: "1.5px",
                transition: "all 0.15s",
              }}>
                {v === "visual" ? "Visual Box" : "By Run"}
              </button>
            ))}

            {view === "visual" && (
              <button onClick={() => { setSorted(s => !s); setSelectedTitle(null); }} style={{
                background: sorted ? "#1a1a2e" : "var(--surface)",
                color: sorted ? "#a78bfa" : "var(--muted2)",
                border: sorted ? "1.5px solid #a78bfa" : "1.5px solid var(--border)",
                borderRadius: 5, padding: "6px 18px", cursor: "pointer",
                fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.78rem", letterSpacing: "1.5px",
                transition: "all 0.15s",
                marginLeft: "auto",
              }}>
                {sorted ? "SORTED BY TITLE" : "BOX ORDER"}
              </button>
            )}
          </div>

          {/* ── VISUAL VIEW ─────────────────────────────────────────────────── */}
          {view === "visual" && (
            <div style={{ display: "grid",
              gridTemplateColumns: selectedTitle ? "1fr 300px" : "1fr",
              gap: 16, alignItems: "start" }}>

              <div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.68rem",
                  letterSpacing: "2px", color: "var(--muted)", marginBottom: 8 }}>
                  {sorted
                    ? `${titleGroups.length} TITLES · SORTED ALPHABETICALLY · CLICK A GROUP TO INSPECT`
                    : `${boxComics.length} COMICS IN BOX ORDER · COLORED BY TITLE · CLICK ANY SPINE`}
                </div>

                {/* Box graphic — horizontal scroll */}
                <div style={{
                  background: "#111",
                  border: "3px solid #3a3a3a",
                  borderTop: "8px solid #555",
                  borderBottom: "10px solid #222",
                  borderRadius: "4px 4px 2px 2px",
                  padding: "20px 16px 14px",
                  overflowX: "auto",
                  position: "relative",
                  boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
                }}>
                  <div style={{ position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)",
                    fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem",
                    letterSpacing: "3px", color: "#666" }}>
                    {selectedBoxData.Num} · {boxComics.length} COMICS
                  </div>

                  {sorted ? (
                    /* ── SORTED: groups with labels ── */
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, minWidth: "max-content" }}>
                      {titleGroups.map((group, gi) => {
                        const isActive = selectedTitle === group.title;
                        const hasSel   = !!selectedTitle;
                        return (
                          <div key={gi}
                            onClick={() => setSelectedTitle(isActive ? null : group.title)}
                            title={group.title}
                            style={{ display: "flex", flexDirection: "column", alignItems: "center",
                              gap: 4, cursor: "pointer", opacity: hasSel && !isActive ? 0.22 : 1,
                              transition: "opacity 0.15s",
                            }}>
                            {/* Title label — rotated */}
                            <div style={{
                              writingMode: "vertical-rl",
                              transform: "rotate(180deg)",
                              fontSize: "0.6rem",
                              fontFamily: "'Bebas Neue',sans-serif",
                              letterSpacing: "1px",
                              color: isActive ? group.color : "#888",
                              maxHeight: 80,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              marginBottom: 4,
                              transition: "color 0.15s",
                            }}>
                              {group.title}
                            </div>
                            {/* Spines */}
                            <div style={{ display: "flex", gap: "1px", alignItems: "flex-end" }}>
                              {group.issues.map((c, ci) => {
                                const isKey    = (c.Key    || "").toUpperCase() === "YES";
                                const isSigned = (c.Signed || "").toUpperCase() === "YES";
                                return (
                                  <div key={ci} title={`${c.Title} #${c.Issue}${isKey ? " ★KEY" : ""}${isSigned ? " ✍" : ""}`}
                                    style={{
                                      width: 5,
                                      height: isKey ? 200 : 160,
                                      background: group.color,
                                      borderTop: isKey ? "3px solid #fbbf24" : undefined,
                                      boxShadow: isSigned ? "inset 2px 0 0 #22c55e" : undefined,
                                      borderRadius: "1px 1px 0 0",
                                      flexShrink: 0,
                                    }}
                                  />
                                );
                              })}
                            </div>
                            {/* Count badge */}
                            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.55rem",
                              letterSpacing: "0.5px", color: isActive ? group.color : "#555",
                              marginTop: 2, transition: "color 0.15s" }}>
                              {group.issues.length}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* ── UNSORTED: box order, colored by title ── */
                    <div style={{ display: "flex", gap: "1px", alignItems: "flex-end", minWidth: "max-content" }}>
                      {displayComics.map((c, i) => {
                        const color    = titleColorMap[c.Title] || "#888";
                        const isKey    = (c.Key    || "").toUpperCase() === "YES";
                        const isSigned = (c.Signed || "").toUpperCase() === "YES";
                        const isSel    = selectedTitle === c.Title;
                        const hasSel   = !!selectedTitle;
                        return (
                          <div key={i}
                            title={`${c.Title} #${c.Issue}${isKey ? " ★KEY" : ""}${isSigned ? " ✍" : ""}`}
                            onClick={() => setSelectedTitle(isSel ? null : c.Title)}
                            style={{
                              width: 5,
                              height: isKey ? 200 : 160,
                              background: color,
                              opacity: hasSel && !isSel ? 0.15 : 1,
                              borderTop: isKey ? "3px solid #fbbf24" : undefined,
                              boxShadow: isSigned ? "inset 2px 0 0 #22c55e" : undefined,
                              borderRadius: "1px 1px 0 0",
                              cursor: "pointer",
                              flexShrink: 0,
                              transition: "opacity 0.12s",
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Legend */}
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10,
                  fontSize: "0.7rem", fontFamily: "'Bebas Neue',sans-serif",
                  letterSpacing: "1px", color: "var(--muted)" }}>
                  <span>
                    <span style={{ display:"inline-block", width:5, height:14, background:"#888",
                      verticalAlign:"middle", borderTop:"3px solid #fbbf24", marginRight:4, borderRadius:"1px 1px 0 0" }} />
                    KEY (tall + gold top)
                  </span>
                  <span>
                    <span style={{ display:"inline-block", width:5, height:14, background:"#22c55e",
                      verticalAlign:"middle", marginRight:4, borderRadius:"1px 1px 0 0" }} />
                    SIGNED (green left edge)
                  </span>
                  <span style={{ color: "var(--muted2)" }}>
                    each colour = one title · click to select
                  </span>
                </div>

                {/* Title index (sorted view only) */}
                {sorted && (
                  <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {titleGroups.map((g, i) => (
                      <button key={i}
                        onClick={() => setSelectedTitle(selectedTitle === g.title ? null : g.title)}
                        style={{
                          background: selectedTitle === g.title ? g.color : "var(--surface)",
                          border: `1.5px solid ${g.color}`,
                          borderRadius: 4, padding: "3px 10px", cursor: "pointer",
                          fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.65rem",
                          letterSpacing: "0.5px",
                          color: selectedTitle === g.title ? "#fff" : g.color,
                          transition: "all 0.12s",
                          maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                        {g.title}
                        <span style={{ opacity: 0.7, marginLeft: 5 }}>{g.issues.length}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Title detail panel ── */}
              {selectedTitle && selectedTitleGroup && (
                <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)",
                  borderRadius: 8, padding: "16px", position: "sticky", top: 170 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.6rem",
                      letterSpacing: "2px", color: selectedTitleGroup.color }}>TITLE DETAIL</div>
                    <button onClick={() => setSelectedTitle(null)} style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--muted)", fontSize: "1rem", lineHeight: 1, padding: 0 }}>✕</button>
                  </div>

                  <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--brown-light)",
                    lineHeight: 1.3, marginBottom: 8, borderLeft: `3px solid ${selectedTitleGroup.color}`,
                    paddingLeft: 10 }}>
                    {selectedTitleGroup.title}
                  </div>

                  <div style={{ display: "flex", gap: 14, marginBottom: 12 }}>
                    {[
                      { val: selectedTitleGroup.issues.length, lbl: "ISSUES" },
                      { val: selectedTitleGroup.keyCount,      lbl: "KEYS" },
                      { val: selectedTitleGroup.signedCount,   lbl: "SIGNED" },
                    ].map(s => (
                      <div key={s.lbl} style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.2rem",
                          color: "var(--red)", lineHeight: 1 }}>{s.val}</div>
                        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.55rem",
                          letterSpacing: "1.5px", color: "var(--muted)", marginTop: 2 }}>{s.lbl}</div>
                      </div>
                    ))}
                  </div>

                  {/* Publisher / Writer / Artist from first issue */}
                  {(() => {
                    const first = selectedTitleGroup.issues[0];
                    return (
                      <div style={{ marginBottom: 12 }}>
                        {[
                          { l: "Publisher", v: first.Publisher },
                          { l: "Writer",    v: first.Writer },
                          { l: "Artist",    v: first.Artist },
                          { l: "Era",       v: first.Era },
                        ].filter(r => r.v).map(r => (
                          <div key={r.l} style={{ display: "flex", gap: 8, marginBottom: 3, fontSize: "0.78rem" }}>
                            <span style={{ color: "var(--muted)", minWidth: 60, flexShrink: 0, fontSize: "0.7rem" }}>{r.l}</span>
                            <span style={{ color: "var(--text2)", lineHeight: 1.4 }}>{r.v.slice(0, 80)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Issue list */}
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.6rem",
                    letterSpacing: "1.5px", color: "var(--muted)", marginBottom: 6 }}>
                    ISSUES IN THIS BOX
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxHeight: 260, overflowY: "auto" }}>
                    {selectedTitleGroup.issues.map((c, i) => {
                      const isKey    = (c.Key    || "").toUpperCase() === "YES";
                      const isSigned = (c.Signed || "").toUpperCase() === "YES";
                      return (
                        <div key={i} title={c.Key_Reason || c.Arc} style={{
                          background: isKey ? "#fff8e0" : "var(--surface2)",
                          border: `1.5px solid ${isKey ? "#d4a800" : "var(--border)"}`,
                          borderRadius: 4, padding: "3px 8px",
                          fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.75rem",
                          letterSpacing: "0.5px", color: isKey ? "#8a6000" : "var(--text2)",
                        }}>
                          #{c.Issue}
                          {isKey    && <span style={{ color: "#c8102e",  marginLeft: 3 }}>★</span>}
                          {isSigned && <span style={{ color: "#22c55e",  marginLeft: 2 }}>✍</span>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Key reasons */}
                  {selectedTitleGroup.issues.some(c => c.Key_Reason) && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.6rem",
                        letterSpacing: "1.5px", color: "var(--muted)", marginBottom: 6 }}>KEY NOTES</div>
                      {selectedTitleGroup.issues.filter(c => c.Key_Reason).map((c, i) => (
                        <div key={i} style={{ fontSize: "0.75rem", color: "var(--text2)",
                          lineHeight: 1.4, marginBottom: 5, paddingLeft: 8,
                          borderLeft: "2px solid #d4a800" }}>
                          <span style={{ color: "#8a6000", fontWeight: 600 }}>#{c.Issue}</span> — {c.Key_Reason.slice(0, 120)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── RUNS VIEW ───────────────────────────────────────────────────── */}
          {view === "runs" && (
            <div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "0.7rem",
                letterSpacing: "2px", color: "var(--muted)", marginBottom: 12 }}>
                {titleGroups.length} TITLE{titleGroups.length !== 1 ? "S" : ""} IN THIS BOX — ALPHABETICAL
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {titleGroups.map((group, gi) => (
                  <RunBlock key={gi} group={group} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RunBlock({ group }: { group: TitleGroup }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 6,
      borderLeft: `3px solid ${group.color}` }}>
      <div onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
        cursor: "pointer" }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--brown-light)" }}>{group.title}</span>
          <span style={{ fontSize: "0.78rem", color: "var(--muted)", marginLeft: 8 }}>
            {group.issues.length} issue{group.issues.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          {group.keyCount > 0 && (
            <span style={{ background: "#fff8e0", color: "#8a6000", border: "1px solid #d4a800",
              borderRadius: 3, padding: "1px 6px", fontSize: "0.62rem",
              fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "1px" }}>
              {group.keyCount} KEY
            </span>
          )}
          {group.signedCount > 0 && (
            <span style={{ background: "var(--green-bg)", color: "var(--green-text)", border: "1px solid #c8e6c8",
              borderRadius: 3, padding: "1px 6px", fontSize: "0.62rem",
              fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "1px" }}>SGD</span>
          )}
        </div>
        <span style={{ color: "var(--muted)", fontSize: "0.75rem", flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "10px 14px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {group.issues.map((c, i) => {
              const isKey    = (c.Key    || "").toUpperCase() === "YES";
              const isSigned = (c.Signed || "").toUpperCase() === "YES";
              return (
                <div key={i} title={c.Key_Reason || c.Arc} style={{
                  background: isKey ? "#fff8e0" : "var(--surface2)",
                  border: isKey ? "1.5px solid #d4a800" : "1.5px solid var(--border)",
                  borderRadius: 4, padding: "3px 8px", fontSize: "0.78rem",
                  fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.5px",
                  color: isKey ? "#8a6000" : "var(--text2)",
                }}>
                  #{c.Issue}
                  {isKey    && <span style={{ color: "#c8102e", marginLeft: 3 }}>★</span>}
                  {isSigned && <span style={{ color: "#22c55e", marginLeft: 2 }}>✍</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
