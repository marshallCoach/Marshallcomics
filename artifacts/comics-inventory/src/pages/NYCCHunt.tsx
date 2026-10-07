import { useState, useMemo } from "react";
import { DATA } from "@/data/data";

// ── NYCC signing hunt — Friday + Saturday ──────────────────────────────────────
// All dollar figures, boxes and creator assignments come from Robert's own NYCC
// analysis against comics_inventory_FINAL_0510_2058.xlsx; not independently
// re-verified here. Where two notes disagreed, the later refined plan was used.

type Group = "fri" | "sat" | "verify" | "skip";
interface Book {
  g: Group; pub: "dc" | "marvel" | "skybound"; corner: string;
  title: string; issue: string; vol: string; box: string;
  dayLabel: string; dayCls: "fri" | "sat" | "verify"; who: string;
  netLow: number | null; netHigh?: number; netNote?: string; roi: string; fee: string; cover?: string;
}

const COVERS: Record<string, string> = {
  "Absolute Batman #21": "https://comicvine.gamespot.com/a/uploads/scale_medium/11/110017/10099329-wwww.jpg",
  "Absolute Batman #6": "https://comicvine.gamespot.com/a/uploads/scale_medium/11161/111615891/9663675-cover.jpg",
  "Absolute Batman #19": "https://comicvine.gamespot.com/a/uploads/scale_medium/11161/111615891/10041672-cover.jpg",
  "Absolute Batman #8": "https://comicvine.gamespot.com/a/uploads/scale_medium/11/110017/9720719-wwww.jpg",
  "Absolute Batman #5": "https://comicvine.gamespot.com/a/uploads/scale_medium/11/110017/9627063-wwww.jpg",
  "Absolute Batman #23": "https://static.wikia.nocookie.net/marvel_dc/images/1/1f/Absolute_Batman_Vol_1_23.jpg",
  "House of X #1": "https://comicvine.gamespot.com/a/uploads/scale_medium/6/67663/8183320-7505114075-77168.jpg",
  "Wolverine #8": "https://i.ebayimg.com/images/g/QL8AAeSwD6JpFiEQ/s-l960.webp",
  "Uncanny X-Men #268": "https://static.wikia.nocookie.net/marveldatabase/images/7/7e/Uncanny_X-Men_Vol_1_268.jpg",
  "Superman Unchained #1": "https://comicvine.gamespot.com/a/uploads/scale_medium/6/67663/5102326-01.jpg",
  "X-Men: Hellfire Gala #1": "https://comicvine.gamespot.com/a/uploads/scale_medium/11155/111551850/8348898-clean.jpg",
  "Supergirl: Woman of Tomorrow #4": "https://comicvine.gamespot.com/a/uploads/scale_medium/6/67663/8162862-04.jpg",
  "Batman #3": "https://static.wikia.nocookie.net/marvel_dc/images/6/68/Batman_Vol_4_3.jpg",
};
const cov = (t: string, i: string) => COVERS[`${t} #${i}`];

const BOOKS: Book[] = [
  // FRIDAY — Miller, Ewing, and Snyder/Dragotta/Martin (confirmed Fri)
  { g: "fri", pub: "dc", corner: "BATMAN", title: "Dark Knight Returns · Facsimile", issue: "4", vol: "DKR Book 4 · Miller variant cover", box: "FIND IT", dayLabel: "Miller · Fri", dayCls: "fri", who: "Frank Miller — variant cover (Wolverine #8 is at CGC)", netLow: null, netNote: "value TBD", roi: "Miller signature — set the value in your sheet", fee: "$115 Miller · $64 CGC" },
  { g: "fri", pub: "dc", corner: "BATMAN", title: "Absolute Batman", issue: "21", vol: "Vol 1", box: "FIND IT", dayLabel: "Snyder · Fri", dayCls: "fri", who: "Snyder / Dragotta", netLow: 233, roi: "+1,165% on a $20 sig", fee: "flat con fee", cover: cov("Absolute Batman", "21") },
  { g: "fri", pub: "dc", corner: "BATMAN", title: "Absolute Batman", issue: "8", vol: "Vol 1 · NM", box: "BOX 104", dayLabel: "Snyder · Fri", dayCls: "fri", who: "Snyder + Dragotta + Martin (3 free sigs)", netLow: 116, netHigh: 236, roi: "free-sig standout", fee: "$0 sig · $64 CGC", cover: cov("Absolute Batman", "8") },
  { g: "fri", pub: "dc", corner: "BATMAN", title: "Absolute Batman", issue: "6", vol: "Vol 1", box: "FIND IT", dayLabel: "Snyder · Fri", dayCls: "fri", who: "Snyder / Dragotta", netLow: 135, roi: "+676%", fee: "flat con fee", cover: cov("Absolute Batman", "6") },
  { g: "fri", pub: "dc", corner: "BATMAN", title: "Absolute Batman", issue: "19", vol: "Vol 1", box: "FIND IT", dayLabel: "Snyder · Fri", dayCls: "fri", who: "Snyder / Dragotta", netLow: 123, roi: "+615%", fee: "flat con fee", cover: cov("Absolute Batman", "19") },
  { g: "fri", pub: "dc", corner: "BATMAN", title: "Absolute Batman", issue: "5", vol: "Vol 1", box: "FIND IT", dayLabel: "Snyder · Fri", dayCls: "fri", who: "Snyder / Dragotta", netLow: 58, roi: "+291%", fee: "flat con fee", cover: cov("Absolute Batman", "5") },
  { g: "fri", pub: "dc", corner: "BATMAN", title: "Absolute Batman", issue: "23", vol: "Vol 1 · NM", box: "BOX 104", dayLabel: "Snyder · Fri", dayCls: "fri", who: "Snyder + Dragotta + Martin", netLow: 38, netHigh: 88, roi: "3 sigs on an $8 raw", fee: "$0 sig · $64 CGC", cover: cov("Absolute Batman", "23") },
  { g: "fri", pub: "dc", corner: "BATMAN", title: "Absolute Batman #20 ×4", issue: "20", vol: "Vol 1 · four copies", box: "BOX 104", dayLabel: "Snyder · Fri", dayCls: "fri", who: "Snyder + Dragotta", netLow: 104, netHigh: 264, roi: "+26–66 each ×4", fee: "$0 sig · $64 CGC ea" },
  { g: "fri", pub: "marvel", corner: "HULK", title: "Immortal Hulk", issue: "1", vol: "VG/F", box: "BOX CC4", dayLabel: "Ewing · Fri 3pm", dayCls: "fri", who: "Al Ewing", netLow: 16, netHigh: 66, roi: "+16–66", fee: "$0 sig · $64 CGC" },
  // SATURDAY — Jim Lee
  { g: "sat", pub: "marvel", corner: "X-MEN", title: "Uncanny X-Men", issue: "268", vol: "Vol 1", box: "BOX 106", dayLabel: "Lee · Sat", dayCls: "sat", who: "Jim Lee (triple) — +Williams +Claremont", netLow: null, roi: "highest ceiling in the collection", fee: "part of $250 Lee bundle", cover: cov("Uncanny X-Men", "268") },
  { g: "sat", pub: "marvel", corner: "X-MEN", title: "X-Men", issue: "1", vol: "Vol 2 · 1991", box: "BOX 106", dayLabel: "Lee · Sat", dayCls: "sat", who: "Jim Lee (triple) — +Williams +Claremont", netLow: null, roi: "best-selling comic of all time", fee: "part of $250 Lee bundle" },
  { g: "sat", pub: "dc", corner: "SUPERMAN", title: "Superman Unchained", issue: "1", vol: "Vol 1 · 8.5", box: "BOX 106", dayLabel: "Lee Sat + Snyder Fri", dayCls: "sat", who: "Lee (Sat) + Snyder (Fri) + Williams + Sinclair = full team", netLow: 101, netHigh: 181, roi: "4-sig complete creative team", fee: "$83.33 Lee", cover: cov("Superman Unchained", "1") },
  // VERIFY AT BOOTH — creator day not pinned
  { g: "verify", pub: "marvel", corner: "X-MEN", title: "House of X", issue: "1", vol: "Vol 1", box: "FIND IT", dayLabel: "Larraz · verify", dayCls: "verify", who: "Pepe Larraz", netLow: 178, roi: "+890%", fee: "$20 sig", cover: cov("House of X", "1") },
  { g: "verify", pub: "skybound", corner: "SKYBOUND", title: "Transformers", issue: "1", vol: "Vol 1", box: "FIND IT", dayLabel: "DWJ · verify", dayCls: "verify", who: "Daniel Warren Johnson", netLow: 62, roi: "+308%", fee: "$20 sig" },
  { g: "verify", pub: "dc", corner: "SUPERGIRL", title: "Supergirl: Woman of Tomorrow", issue: "4", vol: "Vol 1", box: "FIND IT", dayLabel: "King · verify", dayCls: "verify", who: "Tom King", netLow: 21, roi: "+70%", fee: "$30 King", cover: cov("Supergirl: Woman of Tomorrow", "4") },
  { g: "verify", pub: "dc", corner: "BATMAN", title: "Batman", issue: "3", vol: "Vol 3", box: "FIND IT", dayLabel: "King · verify", dayCls: "verify", who: "Tom King", netLow: 19, roi: "+65%", fee: "$30 King", cover: cov("Batman", "3") },
  // PC ONLY
  { g: "skip", pub: "marvel", corner: "X-MEN", title: "X-Men: Hellfire Gala", issue: "1", vol: "Vol 3", box: "FIND IT", dayLabel: "Lee package", dayCls: "verify", who: "Jim Lee (package rate)", netLow: -21, roi: "−25% — PC yellow-label only", fee: "$83.33 Lee", cover: cov("X-Men: Hellfire Gala", "1") },
];

const KEY = "nycc_loot_v2";
const fmt = (n: number) => (n < 0 ? "−$" : "+$") + Math.abs(Math.round(n)).toLocaleString();

const SECTIONS: { g: Group; title: string; tag: string; tagCls: string; sub: string }[] = [
  { g: "fri", title: "Locked for Friday", tag: "Miller · Ewing · Snyder", tagCls: "fri", sub: "Everything confirmed for Friday — including the Absolute Batman free-sig engine. This is where the money is." },
  { g: "sat", title: "Locked for Saturday", tag: "Jim Lee · 3pm · DC booth", tagCls: "sat", sub: "Your three purchased Lee slots ($250 / $83.33 each). Pull from Box 106 and bag separately." },
  { g: "verify", title: "Verify at the booth", tag: "Day not pinned", tagCls: "verify", sub: "Worth grabbing if the creator has Fri/Sat hours — confirm at the booth before committing a fee." },
  { g: "skip", title: "Personal collection only", tag: "Underwater on fees", tagCls: "verify", sub: "Sign for love, not profit — the fee costs more than the signature adds." },
];

// Top 25 key signing targets — Robert's own analysis (cover artists, key
// rationale, baseline value, net on a $20 fee). Owned · Box is read live.
interface Target { r: number; title: string; issue: string; iss: string; vol: string; cover: string; why: string; base: number; net: number; }
const TOP25: Target[] = [
  { r: 1,  title: "Absolute Batman", issue: "21", iss: "21", vol: "1", cover: "Nick Dragotta & Frank Martin", why: "DC Absolute Universe flagship hit", base: 114.99, net: 232.98 },
  { r: 2,  title: "House of X", issue: "1", iss: "1", vol: "1", cover: "Pepe Larraz", why: "Krakoa Era launch; “To me, my X-Men”", base: 90.00, net: 178.00 },
  { r: 3,  title: "Absolute Batman", issue: "6", iss: "6", vol: "1", cover: "Nick Dragotta & Frank Martin", why: "High-velocity 1st print run", base: 70.59, net: 135.30 },
  { r: 4,  title: "Absolute Batman", issue: "19", iss: "19", vol: "1", cover: "Nick Dragotta & Frank Martin", why: "Core Absolute continuity landmark", base: 65.00, net: 123.00 },
  { r: 5,  title: "Absolute Batman", issue: "8", iss: "8", vol: "1", cover: "Nick Dragotta & Frank Martin", why: "High-demand modern Snyder/Dragotta key", base: 52.14, net: 94.71 },
  { r: 6,  title: "Transformers", issue: "1", iss: "1", vol: "1", cover: "Daniel Warren Johnson", why: "Skybound relaunch; DWJ signature style", base: 37.05, net: 61.51 },
  { r: 7,  title: "Absolute Batman", issue: "5", iss: "5", vol: "1", cover: "Nick Dragotta & Frank Martin", why: "Established modern baseline key", base: 35.59, net: 58.30 },
  { r: 8,  title: "X-Men: Hellfire Gala", issue: "1", iss: "1", vol: "3", cover: "Phil Noto", why: "X-Men ’97 Disney+ animated tie-in spec", base: 28.49, net: 42.68 },
  { r: 9,  title: "Absolute Catwoman", issue: "2", iss: "2", vol: "1", cover: "Bengal", why: "Expanding Absolute DC line key", base: 24.75, net: 34.45 },
  { r: 10, title: "Absolute Batman", issue: "16", iss: "16", vol: "1", cover: "Nick Dragotta & Frank Martin", why: "Key issue in the record-breaking Absolute run", base: 23.99, net: 32.77 },
  { r: 11, title: "Dark Knights: Metal", issue: "2", iss: "2", vol: "1", cover: "Greg Capullo, Jonathan Glapion, FCO Plascencia", why: "Snyder/Capullo Dark Multiverse invasion", base: 23.49, net: 31.68 },
  { r: 12, title: "Absolute Batman", issue: "7", iss: "7", vol: "1", cover: "Nick Dragotta & Frank Martin", why: "Strong contemporary collector demand", base: 22.00, net: 28.40 },
  { r: 13, title: "X-Men", issue: "35 (Legacy #700)", iss: "35", vol: "6", cover: "Pepe Larraz & Marte Gracia", why: "Massive milestone ending the Krakoa Era", base: 20.00, net: 24.00 },
  { r: 14, title: "Absolute Batman", issue: "12", iss: "12", vol: "1", cover: "Nick Dragotta & Frank Martin", why: "Mid-run spec issue", base: 19.99, net: 23.98 },
  { r: 15, title: "Winter Soldier", issue: "1", iss: "1", vol: "1", cover: "Lee Bermejo", why: "Brubaker/Guice classic spy thriller launch", base: 17.20, net: 17.84 },
  { r: 16, title: "Absolute Batman", issue: "15", iss: "15", vol: "1", cover: "Nick Dragotta & Frank Martin", why: "Continuing collector momentum", base: 16.99, net: 17.38 },
  { r: 17, title: "Absolute Batman", issue: "1", iss: "1", vol: "1", cover: "Nick Dragotta", why: "2024’s #1 bestselling comic launch (400k+ copies)", base: 16.94, net: 17.27 },
  { r: 18, title: "Absolute Batman", issue: "23", iss: "23", vol: "1", cover: "Nick Dragotta & Frank Martin", why: "Recent high-demand release", base: 15.00, net: 13.00 },
  { r: 19, title: "Absolute Batman", issue: "2", iss: "2", vol: "1", cover: "Nick Dragotta", why: "1st print continuation of the blockbuster launch", base: 14.99, net: 12.98 },
  { r: 20, title: "Fantastic Four", issue: "35 (Legacy #680)", iss: "35", vol: "6", cover: "Variant / unlisted", why: "60 Years special milestone issue", base: 14.68, net: 12.30 },
  { r: 21, title: "Hulk", issue: "1", iss: "1", vol: "5", cover: "Ryan Ottley", why: "Cates & Ottley starship-Hulk concept", base: 13.99, net: 10.78 },
  { r: 22, title: "House of X", issue: "2", iss: "2", vol: "1", cover: "Pepe Larraz", why: "Moira MacTaggert timeline revelation twist", base: 13.77, net: 10.29 },
  { r: 23, title: "Wonder Woman", issue: "0", iss: "0", vol: "4", cover: "Cliff Chiang", why: "Azzarello/Chiang Greek god reimagining", base: 13.30, net: 9.26 },
  { r: 24, title: "Wonder Woman 75th Special", issue: "1", iss: "1", vol: "1", cover: "Cliff Chiang", why: "Anniversary milestone multi-story celebration", base: 13.30, net: 9.26 },
  { r: 25, title: "Transformers", issue: "17", iss: "17", vol: "1", cover: "Daniel Warren Johnson", why: "DWJ ongoing hit run spec", base: 12.46, net: 7.41 },
];
const tNorm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/^#/, "").replace(/\.0$/, "");

export default function NYCCHunt() {
  const ownedT = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const c of (DATA.comics as Array<{ Title?: string; Issue?: string; Box?: string }>)) {
      const k = `${String(c.Title || "").trim().toLowerCase()}|${tNorm(c.Issue)}`;
      (m[k] ||= []).push(String(c.Box || "?"));
    }
    return m;
  }, []);

  const [captured, setCaptured] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; }
  });

  const possible = useMemo(
    () => BOOKS.reduce((s, b) => s + (b.netLow && b.netLow > 0 ? b.netLow : 0), 0), []);
  const { loot, count } = useMemo(() => {
    let loot = 0, count = 0;
    BOOKS.forEach((b, i) => {
      if (captured["b" + i]) { count++; if (b.netLow && b.netLow > 0) loot += b.netLow; }
    });
    return { loot, count };
  }, [captured]);

  const toggle = (id: string) => setCaptured(prev => {
    const n = { ...prev }; if (n[id]) delete n[id]; else n[id] = true;
    try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* ignore */ }
    return n;
  });
  const reset = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } setCaptured({}); };

  const pct = possible ? Math.min(100, (loot / possible) * 100) : 0;

  return (
    <div className="nycc">
      <style>{nyccCSS}</style>

      <header className="nycc-hero">
        <div className="nycc-kicker">New York Comic Con · Javits Center</div>
        <h1>The <em>Signature</em> Loot Hunt</h1>
        <p className="nycc-sub">Two days on the floor — Friday and Saturday. Every target is a book you own, matched to a creator and a payday. Bag them, witness every signature, cash out at CGC before you leave Saturday. Tap a card to capture it.</p>
      </header>

      <div className="nycc-hud">
        <div className="nycc-hud-row">
          <div className="nycc-stat"><span className="lbl">Loot bagged (floor)</span><span className="val loot">${Math.round(loot).toLocaleString()}</span></div>
          <div className="nycc-stat"><span className="lbl">Targets captured</span><span className="val">{count}</span></div>
          <div className="nycc-stat"><span className="lbl">Sig fees committed</span><span className="val">$365</span></div>
          <button className="nycc-reset" onClick={reset}>Reset hunt</button>
        </div>
        <div className="nycc-bar"><i style={{ width: pct + "%" }} /></div>
        <div className="nycc-hudnote">
          {count === 0
            ? <>Floor = sum of the <b>low end</b> of each captured book's net profit. Bag them all for a <b>${Math.round(possible).toLocaleString()}</b> floor.</>
            : <>Bagged <b>{count}</b> · <b>${Math.round(loot).toLocaleString()}</b> of a <b>${Math.round(possible).toLocaleString()}</b> floor. Lee ceiling books carry no stated net.</>}
        </div>
      </div>

      {SECTIONS.map(sec => {
        const items = BOOKS.map((b, i) => ({ b, i })).filter(x => x.b.g === sec.g);
        if (!items.length) return null;
        return (
          <section key={sec.g} className="nycc-section">
            <div className="nycc-sechead">
              <h2>{sec.title}</h2>
              <span className={`nycc-tag ${sec.tagCls}`}>{sec.tag}</span>
              <p className="nycc-secsub">{sec.sub}</p>
            </div>
            <div className="nycc-grid">
              {items.map(({ b, i }) => {
                const id = "b" + i;
                const isCap = !!captured[id];
                const flame = b.netLow == null ? "" : b.netLow >= 100 ? "🔥 " : b.netLow > 0 ? "⭐ " : "🚫 ";
                return (
                  <article key={id} className={`nycc-card ${isCap ? "captured" : ""} ${b.g === "skip" ? "skip" : ""}`}>
                    <div className="nycc-stamp">Bagged ✓</div>
                    <div className={`nycc-cover ${b.pub}`}>
                      {b.cover
                        ? <img src={b.cover} alt={`${b.title} #${b.issue}`} loading="lazy"
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        : null}
                      <span className="corner">{b.corner}</span>
                      <div className="ctile"><div className="issue">#{b.issue}</div><div className="ctitle">{b.title}</div></div>
                    </div>
                    <div className="nycc-body">
                      <div className="nycc-title">{b.title} #{b.issue}<small>{b.vol}</small></div>
                      <div className="nycc-rowline">
                        <span className={`nycc-pill loc ${b.box === "FIND IT" ? "find" : ""}`}>📦 {b.box}</span>
                        <span className={`nycc-pill day ${b.dayCls}`}>{b.dayLabel}</span>
                      </div>
                      <div className="nycc-who">{b.who}</div>
                      <div className="nycc-econ">
                        {b.netLow == null
                          ? <span className="nycc-net none">{b.netNote || "ceiling play"}</span>
                          : <span className={`nycc-net ${b.netLow < 0 ? "neg" : ""}`}>
                              {fmt(b.netLow)}{b.netHigh ? "–$" + Math.round(b.netHigh).toLocaleString() : ""}
                            </span>}
                        <span className="nycc-roi">{flame}{b.roi}</span>
                      </div>
                      <div className="nycc-note">{b.fee}</div>
                      <button className="nycc-cap" onClick={() => toggle(id)}>
                        <span className="box">{isCap ? "✓" : ""}</span>{isCap ? "Captured" : "Capture"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="nycc-section">
        <div className="nycc-sechead"><h2 className="disp">Top 25 key signing targets</h2><span className="tag confirm">ranked by net on a $20 fee</span>
          <p className="sec-sub">Your highest net-profit books to get signed by confirmed NYCC creators — with the confirmed cover artist, why the issue is a key, and whether you own it (live from inventory).</p></div>
        <div className="t25-wrap">
          <table className="t25">
            <thead><tr><th>#</th><th>Book</th><th>Vol</th><th>Cover / signer</th><th>Why it's a key &amp; in demand</th><th>Baseline</th><th>Net +$20</th><th>Owned · Box</th></tr></thead>
            <tbody>
              {TOP25.map(t => {
                const boxes = ownedT[`${t.title.toLowerCase()}|${t.iss}`] || [];
                return (
                  <tr key={t.r}>
                    <td className="t25-rank">{t.r}</td>
                    <td className="t25-book">{t.title} #{t.issue}</td>
                    <td className="t25-c">{t.vol}</td>
                    <td className="t25-cov">{t.cover}</td>
                    <td className="t25-why">{t.why}</td>
                    <td className="t25-num">${t.base.toFixed(2)}</td>
                    <td className="t25-num net">+${t.net.toFixed(2)}</td>
                    <td className="t25-own">{boxes.length
                      ? <><b>{boxes.length}×</b> {boxes.slice(0, 4).map((b, i) => <span key={i} className="t25-box">{b}</span>)}</>
                      : <span className="t25-no">not owned</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="nycc-foot" style={{ marginTop: 10 }}>Cover artists, key rationale and values are your own analysis; Owned · Box is read live from the inventory. "Not owned" means no copy matched title + issue in the data (volume ignored for matching).</p>
      </section>

      <section className="nycc-section">
        <div className="nycc-sechead"><h2>The two-day plan</h2></div>
        <div className="nycc-days">
          <div className="nycc-day">
            <div className="dd">Day 1</div><h3>Friday</h3>
            <ul className="nycc-timeline">
              <li><span className="t">On open</span><span className="d"><b>Verify your bag:</b> the DKR #4 Facsimile (for Miller), Immortal Hulk #1 (CC4), and the Absolute Batman books (Box 104 + the FIND-IT issues).</span></li>
              <li><span className="t">Slot</span><span className="d"><b>Frank Miller — your purchased slot.</b> DKR #4 Facsimile (Miller variant cover). CGC witness. <em>(Wolverine #8 is still at CGC — not available.)</em></span></li>
              <li><span className="t">DC booth</span><span className="d"><b>Snyder + Dragotta + Martin.</b> Run every Absolute Batman copy — the free-sig engine. Also sign <b>Superman Unchained #1</b> here (Snyder) so it's ready for Lee on Saturday.</span></li>
              <li><span className="t">~3:00</span><span className="d"><b>Al Ewing, DC booth.</b> Immortal Hulk #1.</span></li>
              <li><span className="t">EOD</span><span className="d">Everything signed into a hard case — unwitnessed = green label = the math collapses.</span></li>
            </ul>
          </div>
          <div className="nycc-day">
            <div className="dd">Day 2</div><h3>Saturday</h3>
            <ul className="nycc-timeline">
              <li><span className="t">On open</span><span className="d">Join the <b>Jim Lee digital queue the instant it opens</b> — it caps fast. Carry UXM #268 · X-Men #1 · Superman Unchained #1.</span></li>
              <li><span className="t">~3:00</span><span className="d"><b>Jim Lee, DC booth.</b> The three Lee books. CGC witness on every signature.</span></li>
              <li><span className="t">After Lee</span><span className="d"><b>CGC booth — submit EVERYTHING</b> signed Friday + Saturday in one batch. Last day; don't leave without submitting.</span></li>
              <li><span className="t">Buy-side</span><span className="d">Raw keys grabbed as cover-buys → log to CC1 (Marvel) / CC5 (DC) when home.</span></li>
            </ul>
          </div>
        </div>
      </section>

      <section className="nycc-section">
        <div className="nycc-sechead"><h2>The money</h2><span className="nycc-tag sat">From your analysis</span>
          <p className="nycc-secsub">With Snyder confirmed Friday, the Absolute Batman engine is in play. Note: Wolverine #8 is out (still at CGC) — the Miller slot now holds the DKR #4 Facsimile, value TBD, so re-base the net once you price it.</p></div>
        <div className="nycc-money">
          <div className="mcell"><div className="lbl">Total out (if all land)</div><div className="v">~$877</div></div>
          <div className="mcell"><div className="lbl">Fees already spent</div><div className="v">$365</div></div>
          <div className="mcell hot"><div className="lbl">Est. value created</div><div className="v">$1,460–2,180</div></div>
          <div className="mcell hot"><div className="lbl">Net (full plan)</div><div className="v">+$583–1,303</div></div>
        </div>
      </section>

      <p className="nycc-foot">All dollar figures, boxes and creator assignments are from <b>your own NYCC analysis</b> against <b>comics_inventory_FINAL_0510_2058.xlsx</b> — not independently re-verified. Captures and the loot total are saved in this browser only.</p>
    </div>
  );
}

const nyccCSS = `
.nycc{max-width:1080px;margin:0 auto;padding:0 18px 60px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--text)}
.nycc h1,.nycc h2,.nycc h3{margin:0;text-wrap:balance}
.nycc-hero{padding:26px 0 16px;border-bottom:3px solid var(--text)}
.nycc-kicker{font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);font-weight:700;margin-bottom:6px}
.nycc-hero h1{font-size:clamp(2.1rem,7vw,3.6rem);line-height:.95;letter-spacing:.01em}
.nycc-hero h1 em{font-style:normal;color:var(--red)}
.nycc-sub{margin-top:10px;max-width:62ch;color:var(--muted2);font-size:1rem;line-height:1.5}
.nycc-hud{position:sticky;top:0;z-index:5;background:var(--surface);border:2px solid var(--text);border-radius:14px;margin-top:16px;padding:14px 16px;display:flex;flex-direction:column;gap:11px;box-shadow:0 6px 20px rgba(0,0,0,.14)}
.nycc-hud-row{display:flex;flex-wrap:wrap;gap:14px 22px;align-items:flex-end}
.nycc-stat{display:flex;flex-direction:column;gap:1px}
.nycc-stat .lbl{font-size:.62rem;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);font-weight:700}
.nycc-stat .val{font-size:1.8rem;line-height:1;font-weight:800;font-variant-numeric:tabular-nums}
.nycc-stat .val.loot{color:#16a34a}
.nycc-reset{margin-left:auto;background:none;border:1px solid var(--border);color:var(--muted);border-radius:8px;padding:5px 10px;font-size:.66rem;letter-spacing:.09em;text-transform:uppercase;font-weight:700;cursor:pointer}
.nycc-bar{height:12px;border-radius:99px;background:var(--surface2);border:1px solid var(--border);overflow:hidden}
.nycc-bar>i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--gold),#16a34a);transition:width .5s cubic-bezier(.2,.8,.2,1)}
.nycc-hudnote{font-size:.8rem;color:var(--muted2)}
.nycc-section{margin-top:30px}
.nycc-sechead{display:flex;align-items:baseline;gap:11px;flex-wrap:wrap;border-bottom:2px solid var(--border);padding-bottom:8px;margin-bottom:15px}
.nycc-sechead h2{font-size:1.4rem}
.nycc-tag{font-size:.64rem;letter-spacing:.11em;text-transform:uppercase;font-weight:700;padding:3px 9px;border-radius:99px;white-space:nowrap}
.nycc-tag.fri{background:rgba(124,83,232,.18);color:#7c53e8}
.nycc-tag.sat{background:rgba(22,163,74,.18);color:#16a34a}
.nycc-tag.verify{background:rgba(180,105,14,.2);color:#b4690e}
.nycc-secsub{flex:1 1 100%;margin:-4px 0 0;color:var(--muted2);font-size:.88rem;line-height:1.45}
.nycc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:13px}
.nycc-card{position:relative;display:grid;grid-template-columns:92px 1fr;background:var(--surface);border:1.5px solid var(--border);border-radius:14px;overflow:hidden;box-shadow:0 2px 7px rgba(0,0,0,.08)}
.nycc-card.captured{border-color:#16a34a;background:rgba(22,163,74,.06)}
.nycc-card.skip{opacity:.74}
.nycc-cover{position:relative;min-width:0;background:#333;color:#fff;display:flex;flex-direction:column;justify-content:space-between;padding:7px}
.nycc-cover.dc{background:linear-gradient(160deg,#2a5bd7,#13308a)}
.nycc-cover.marvel{background:linear-gradient(160deg,#e23048,#9c0c23)}
.nycc-cover.skybound{background:linear-gradient(160deg,#2f8d68,#17533c)}
.nycc-cover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.nycc-cover .corner{position:relative;z-index:1;align-self:flex-start;background:rgba(0,0,0,.42);border:1px solid rgba(255,255,255,.5);border-radius:3px;font-size:.5rem;letter-spacing:.07em;font-weight:700;padding:2px 4px;text-transform:uppercase;line-height:1.05}
.nycc-cover .ctile{position:relative;z-index:1}
.nycc-cover img~.ctile,.nycc-cover img~.corner{opacity:0}
.nycc-cover .issue{font-size:2rem;line-height:.85;font-weight:800;text-shadow:0 2px 0 rgba(0,0,0,.35)}
.nycc-cover .ctitle{font-size:.58rem;font-weight:700;letter-spacing:.03em;text-transform:uppercase;opacity:.95;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.nycc-body{min-width:0;padding:11px 13px;display:flex;flex-direction:column;gap:7px}
.nycc-title{font-weight:800;font-size:1rem;line-height:1.12}
.nycc-title small{display:block;font-weight:600;color:var(--muted);font-size:.73rem;margin-top:2px}
.nycc-rowline{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.nycc-pill{font-size:.6rem;letter-spacing:.07em;text-transform:uppercase;font-weight:700;padding:2px 7px;border-radius:99px;white-space:nowrap;border:1px solid transparent}
.nycc-pill.loc{background:var(--surface2);border-color:var(--border);color:var(--text)}
.nycc-pill.loc.find{color:#b4690e;border-color:rgba(180,105,14,.4)}
.nycc-pill.day{color:#fff}
.nycc-pill.day.fri{background:#7c53e8}
.nycc-pill.day.sat{background:#16a34a}
.nycc-pill.day.verify{background:#b4690e}
.nycc-who{font-size:.82rem;color:var(--muted2)}
.nycc-econ{display:flex;flex-wrap:wrap;gap:3px 13px;align-items:baseline}
.nycc-net{font-size:1.4rem;font-weight:800;color:#16a34a;font-variant-numeric:tabular-nums}
.nycc-net.neg{color:var(--red)}
.nycc-net.none{color:var(--muted);font-size:1rem;font-weight:700}
.nycc-roi{font-size:.74rem;font-weight:700;color:var(--gold)}
.nycc-note{font-size:.76rem;color:var(--muted)}
.nycc-cap{margin-top:auto;display:flex;align-items:center;gap:8px;justify-content:center;background:none;border:1.5px dashed var(--border);color:var(--muted);border-radius:9px;padding:8px;cursor:pointer;font-size:.72rem;letter-spacing:.11em;text-transform:uppercase;font-weight:700}
.nycc-card.captured .nycc-cap{border-style:solid;border-color:#16a34a;color:#16a34a;background:rgba(22,163,74,.12)}
.nycc-cap .box{width:16px;height:16px;border-radius:4px;border:2px solid currentColor;display:grid;place-items:center;font-size:.7rem}
.nycc-stamp{position:absolute;top:9px;right:9px;z-index:2;font-size:.78rem;font-weight:800;letter-spacing:.06em;color:#16a34a;border:2.5px solid #16a34a;border-radius:6px;padding:2px 7px;transform:rotate(-7deg);opacity:0;transition:opacity .2s}
.nycc-card.captured .nycc-stamp{opacity:1}
.nycc-days{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.nycc-day{background:var(--surface);border:1.5px solid var(--border);border-radius:14px;padding:16px}
.nycc-day .dd{font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--gold);margin-bottom:8px}
.nycc-day h3{font-size:1.4rem;font-weight:800;margin-bottom:10px}
.nycc-timeline{list-style:none;margin:0;padding:0;display:grid;gap:9px}
.nycc-timeline li{display:grid;grid-template-columns:64px 1fr;gap:9px;align-items:start}
.nycc-timeline .t{font-size:.72rem;font-weight:700;text-align:center;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:2px 0;color:var(--text)}
.nycc-timeline .d{font-size:.88rem;line-height:1.4;color:var(--text2)}
.nycc-money{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:11px}
.nycc-money .mcell{background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:13px 15px}
.nycc-money .lbl{font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--muted)}
.nycc-money .v{font-size:1.6rem;font-weight:800;margin-top:3px;font-variant-numeric:tabular-nums}
.nycc-money .mcell.hot .v{color:#16a34a}
.nycc-foot{margin-top:28px;border-top:1px solid var(--border);padding-top:13px;color:var(--muted);font-size:.78rem;line-height:1.5}
.t25-wrap{overflow-x:auto;border:1.5px solid var(--border);border-radius:12px;background:var(--surface)}
.t25{width:100%;border-collapse:collapse;font-size:.86rem}
.t25 th{text-align:left;font-size:.6rem;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);font-weight:700;padding:9px 12px;border-bottom:2px solid var(--border);background:var(--surface2);white-space:nowrap}
.t25 td{padding:8px 12px;border-bottom:1px solid var(--border);vertical-align:top}
.t25 tr:last-child td{border-bottom:none}
.t25-rank{font-weight:800;color:var(--muted2);font-variant-numeric:tabular-nums}
.t25-book{font-weight:700;white-space:nowrap}
.t25-c{color:var(--muted);font-variant-numeric:tabular-nums}
.t25-cov{color:var(--text2);min-width:130px}
.t25-why{color:var(--muted2);min-width:200px;line-height:1.35}
.t25-num{font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:600}
.t25-num.net{color:#16a34a}
.t25-own{white-space:nowrap;font-size:.8rem}
.t25-box{display:inline-block;background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:1px 6px;margin:0 3px 2px 0;font-weight:700;font-variant-numeric:tabular-nums}
.t25-no{color:var(--muted)}
@media(max-width:620px){.nycc-days{grid-template-columns:1fr}}
`;
