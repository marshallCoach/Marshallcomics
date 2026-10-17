import { useEffect, useMemo, useState } from "react";
import { DATA, type Comic } from "@/data/data";
import { CoverImage } from "@/components/CoverImage";

// Fields the editor exposes, in display order. Everything here is ordinary
// data work (creator credits included) — no confirmation gate. Value/credit
// corrections, box moves, condition, signing, dates all live here.
const FIELDS: { key: keyof Comic; label: string; wide?: boolean }[] = [
  { key: "Title", label: "Title", wide: true },
  { key: "Issue", label: "Issue #" },
  { key: "Volume", label: "Volume" },
  { key: "Year", label: "Year" },
  { key: "Publisher", label: "Publisher" },
  { key: "Imprint", label: "Imprint" },
  { key: "Box", label: "Box #" },
  { key: "Condition", label: "Condition" },
  { key: "Signed", label: "Signed? (Yes/No)" },
  { key: "Signed_By", label: "Signed By" },
  { key: "Value_NM", label: "Value (NM)" },
  { key: "Cover_Price", label: "Cover Price" },
  { key: "Pub_Date", label: "Publication Date" },
  { key: "Date_Added", label: "Date Added" },
  { key: "Era", label: "Era" },
  { key: "Category", label: "Category" },
  { key: "Key", label: "Key? (Yes/No)" },
  { key: "Key_Reason", label: "Key Reason" },
  { key: "First_App", label: "First Appearance" },
  { key: "Writer", label: "Writer(s)", wide: true },
  { key: "Artist", label: "Artist(s)", wide: true },
  { key: "Cover_Artist", label: "Cover Artist", wide: true },
  { key: "Seller_Notes", label: "Seller Notes", wide: true },
];

const idOf = (c: Comic) => `${c.Title}|||${c.Issue}|||${c.Volume || "1"}|||${c.Box}|||${c.Signed_By || ""}`;

export default function EditComic({ initQuery }: { initQuery?: string } = {}) {
  const comics = DATA.comics as Comic[];
  const [q, setQ] = useState(initQuery || "");
  const [selId, setSelId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [del, setDel] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return comics
      .filter(c => {
        const hay = `${c.Title} #${c.Issue} ${c.Volume} ${c.Box} ${c.Signed_By || ""}`.toLowerCase();
        return hay.includes(s);
      })
      .slice(0, 40);
  }, [q, comics]);

  const selected = useMemo(() => comics.find(c => idOf(c) === selId) || null, [selId, comics]);

  function select(c: Comic) {
    const f: Record<string, string> = {};
    for (const { key } of FIELDS) f[key as string] = String((c as any)[key] ?? "");
    setForm(f);
    setSelId(idOf(c));
    setDel(false);
    setSaved(null);
  }

  // Arriving from an (e) link on a search result: seed the query and, when it
  // resolves to a single book, open it straight away so there's no second search.
  useEffect(() => {
    if (initQuery === undefined) return;
    setQ(initQuery || "");
    setSelId(null);
    const s = (initQuery || "").trim().toLowerCase();
    if (s.length < 2) return;
    const hits = comics.filter(c =>
      `${c.Title} #${c.Issue} ${c.Volume} ${c.Box} ${c.Signed_By || ""}`.toLowerCase().includes(s));
    if (hits.length === 1) select(hits[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initQuery]);

  function setField(k: string, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
    setSaved(null);
  }

  function changedFields(): Record<string, string> {
    if (!selected) return {};
    const out: Record<string, string> = {};
    for (const { key } of FIELDS) {
      const orig = String((selected as any)[key] ?? "");
      if (form[key as string] !== orig) out[key as string] = form[key as string];
    }
    return out;
  }

  function save() {
    if (!selected) return;
    const changes = changedFields();
    if (del) {
      if (!window.confirm(`DELETE from inventory:\n\n${selected.Title} #${selected.Issue} (Vol ${selected.Volume || "1"}, Box ${selected.Box})\n\nThis exports a deletion request for review in brb_all. Are you sure?`)) return;
    } else if (Object.keys(changes).length === 0) {
      window.alert("No fields changed.");
      return;
    }
    const payload = {
      type: "comic-edit",
      exportedAt: new Date().toISOString(),
      match: {
        Title: selected.Title,
        Issue: selected.Issue,
        Volume: selected.Volume || "1",
        Box: selected.Box,
        Signed_By: selected.Signed_By || "",
      },
      delete: del,
      changes: del ? {} : changes,
    };
    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `comic_edit_${stamp}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setSaved(`comic_edit_${stamp}.json`);
  }

  const changes = changedFields();
  const changedKeys = new Set(Object.keys(changes));

  return (
    <div style={{ maxWidth: "calc(900px + var(--wide))", margin: "0 auto", padding: "20px 18px 60px" }}>
      <style>{`
        .ec-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px}
        .ec-f.wide{grid-column:1/-1}
        .ec-f label{display:block;font-size:.72rem;letter-spacing:.5px;color:var(--muted);margin-bottom:3px;text-transform:uppercase}
        .ec-f input{width:100%;box-sizing:border-box;padding:7px 9px;border-radius:6px;border:1.5px solid var(--border,#2c2c38);background:var(--surface,#1c1c24);color:var(--text,#eee);font:inherit;font-size:.9rem}
        .ec-f input.chg{border-color:#e0a21b;background:#fff6da;color:#3a2e05}
        .ec-res{border:1px solid var(--border,#2c2c38);border-radius:8px;overflow:hidden;margin-top:8px}
        .ec-row{display:block;width:100%;text-align:left;background:var(--surface,#1c1c24);border:0;border-bottom:1px solid var(--border,#2c2c38);color:var(--text,#eee);padding:8px 11px;font:inherit;font-size:.86rem;cursor:pointer}
        .ec-row:hover{background:var(--surface2,#26262f)}
        @media(max-width:560px){.ec-grid{grid-template-columns:1fr}}
      `}</style>

      <h1 style={{ margin: "0 0 4px", fontSize: "1.6rem" }}>Edit Comic Details</h1>
      <p style={{ color: "var(--muted,#888)", margin: "0 0 16px", fontSize: ".9rem", maxWidth: "62ch" }}>
        Find a comic, edit any field, and Save to export an edit file. Review and apply it on the Mac with{" "}
        <code>python3 brb_review_edits.py</code> (bundled into <code>brb_all</code>). Deletions export a removal request — nothing changes in inventory until you apply it.
      </p>

      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search title / issue / box / signer…"
        style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid var(--border,#2c2c38)", background: "var(--surface,#1c1c24)", color: "var(--text,#eee)", font: "inherit", fontSize: "0.95rem" }}
      />

      {!selected && q.trim().length >= 2 && (
        <div className="ec-res">
          {results.length === 0 ? (
            <div style={{ padding: 12, color: "var(--muted)" }}>No matches.</div>
          ) : results.map(c => (
            <button key={idOf(c)} className="ec-row" onClick={() => select(c)}>
              <b>{c.Title}</b> #{c.Issue}{c.Volume && c.Volume !== "1" ? ` · Vol ${c.Volume}` : ""} · Box {c.Box}
              {c.Signed_By ? ` · ✍ ${c.Signed_By}` : ""}{c.Condition ? ` · ${c.Condition}` : ""}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", minWidth: 0 }}>
              <CoverImage comic={selected} width={88} height={132} objectFit="contain"
                style={{ borderRadius: 4, background: "#0d0d12", border: "1px solid var(--border,#2c2c38)", flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "1.05rem" }}>{selected.Title} #{selected.Issue}</div>
                <div style={{ fontSize: ".82rem", color: "var(--muted,#888)", marginTop: 2 }}>
                  {selected.Publisher}{selected.Volume && selected.Volume !== "1" ? ` · Vol ${selected.Volume}` : ""} · Box {selected.Box}
                </div>
                {selected.Signed_By && <div style={{ fontSize: ".82rem", color: "var(--red,#c0392b)", marginTop: 2 }}>✍ {selected.Signed_By}</div>}
              </div>
            </div>
            <button onClick={() => { setSelId(null); setForm({}); setDel(false); setSaved(null); }}
              style={{ background: "var(--surface2,#26262f)", border: "1px solid var(--border,#2c2c38)", color: "var(--muted2,#aaa)", borderRadius: 6, padding: "6px 12px", cursor: "pointer", font: "inherit", fontSize: ".82rem", flexShrink: 0 }}>
              ← Pick another
            </button>
          </div>

          <div className="ec-grid">
            {FIELDS.map(({ key, label, wide }) => (
              <div key={key as string} className={`ec-f${wide ? " wide" : ""}`}>
                <label>{label}</label>
                <input
                  className={changedKeys.has(key as string) ? "chg" : ""}
                  value={form[key as string] ?? ""}
                  disabled={del}
                  onChange={e => setField(key as string, e.target.value)}
                />
              </div>
            ))}
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18, color: del ? "#e0556f" : "var(--muted2,#aaa)", cursor: "pointer", fontWeight: 600 }}>
            <input type="checkbox" checked={del} onChange={e => setDel(e.target.checked)} />
            Delete this comic from inventory
          </label>

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16 }}>
            <button onClick={save}
              style={{ background: del ? "#c0392b" : "var(--red,#c0392b)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", font: "inherit", fontWeight: 600 }}>
              {del ? "Export deletion request" : `Save & export (${Object.keys(changes).length} change${Object.keys(changes).length === 1 ? "" : "s"})`}
            </button>
            {saved && <span style={{ color: "#2ec28a", fontSize: ".86rem" }}>✓ Exported {saved} — move it to the repo and run brb_review_edits.py</span>}
          </div>
        </div>
      )}
    </div>
  );
}
