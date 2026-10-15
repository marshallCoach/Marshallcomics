import { useMemo, useState } from "react";
import { DATA, type Comic } from "@/data/data";
import { CoverImage } from "@/components/CoverImage";

// BlackReadBrown — a storefront preview built from the live inventory. Real
// covers resolve through CoverImage (covers.json), real grades/prices/signers
// come straight off each comic. A mock bag + filters show how the shop reads.

const BLACK_HERO_TITLES = new Set([
  "black lightning", "truth: red, white & black", "black panther: the man without fear",
  "black panther", "truth", "icon", "static", "hardware", "blade", "miles morales: spider-man",
]);
const BLACK_CREATORS = new Set([
  "kyle baker", "tony isabella", "christopher priest", "reginald hudlin", "ta-nehisi coates",
  "dwayne mcduffie", "david f. walker", "john ridley",
]);

const CW = 168, CH = 252;

type Prod = {
  comic: Comic; key: string; title: string; iss: string; vol: string; yr: string;
  pub: string; pubc: string; signed: boolean; signer: string; grade: string; slab: boolean;
  price: number; priceLabel: string; tags: string[];
};

function valf(v?: string) {
  const n = parseFloat(String(v || "").replace(/[$,]/g, ""));
  return isNaN(n) ? 0 : n;
}
function money(n: number) {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
}
function pubClass(p?: string) {
  const s = (p || "").toLowerCase();
  if (s.includes("marvel")) return "marvel";
  if (s.includes("dc")) return "dc";
  if (s.includes("image")) return "image";
  return "indie";
}
function gradeOf(cond?: string): { label: string; slab: boolean } {
  const c = (cond || "").trim();
  const cgc = c.match(/(CGC|CBCS)\s*([0-9.]+)/i);
  if (cgc) return { label: `${cgc[1].toUpperCase()} ${cgc[2]}`, slab: true };
  const raw = c.match(/([0-9]+\.[0-9])/);
  if (raw) return { label: `Raw ${raw[1]}`, slab: false };
  return { label: (c.split("—")[0].trim() || "Raw").slice(0, 16), slab: false };
}

export default function StorePreview() {
  const [filter, setFilter] = useState("all");
  const [bag, setBag] = useState<Prod[]>([]);
  const [bagOpen, setBagOpen] = useState(false);
  const [hearts, setHearts] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState("");

  const products = useMemo<Prod[]>(() => {
    const seen = new Set<string>();
    const rows: Prod[] = [];
    for (const c of DATA.comics as Comic[]) {
      const vol = String(c.Volume || "1").trim();
      const k = `${c.Title}|||${c.Issue}|||${vol}`;
      if (seen.has(k)) continue;
      const val = valf(c.Value_NM);
      if (val < 25) continue; // storefront floor — skip filler
      const signer = (c.Signed_By || "").split("(")[0].trim();
      const signed = !!signer && !/^n\/a/i.test(signer);
      const isKey = String(c.Key || "").toLowerCase().startsWith("y") || /true/i.test(String(c.Key));
      const creatorsBlob = `${signer} ${c.Writer || ""} ${c.Artist || ""}`.toLowerCase();
      const black = BLACK_HERO_TITLES.has(c.Title.toLowerCase().trim()) ||
        [...BLACK_CREATORS].some(x => creatorsBlob.includes(x));
      if (!(signed || isKey || black || val >= 40)) continue;
      seen.add(k);
      const g = gradeOf(c.Condition);
      const tags = ["all"];
      if (signed) tags.push("signed");
      if (isKey) tags.push("key");
      if (black) tags.push("black");
      if (val <= 80) tags.push("under80");
      rows.push({
        comic: c, key: k, title: c.Title, iss: String(c.Issue), vol, yr: String(c.Year || ""),
        pub: c.Publisher || "", pubc: pubClass(c.Publisher), signed, signer, grade: g.label, slab: g.slab,
        price: val, priceLabel: money(val), tags,
      });
    }
    rows.sort((a, b) => (Number(b.tags.includes("black")) - Number(a.tags.includes("black"))) || (b.price - a.price));
    return rows.slice(0, 48);
  }, []);

  const featured = useMemo(() =>
    products.find(p => p.signed && p.tags.includes("black")) || products.find(p => p.signed) || products[0],
    [products]);

  const shown = filter === "all" ? products : products.filter(p => p.tags.includes(filter));
  const signedRail = products.filter(p => p.signed).slice(0, 5);
  const subtotal = bag.reduce((s, p) => s + p.price, 0);

  function add(p: Prod) {
    setBag(b => [...b, p]);
    setToast(`Added ${p.title} #${p.iss}`);
    setTimeout(() => setToast(""), 1700);
  }
  function toggleHeart(k: string) {
    setHearts(h => { const n = new Set(h); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }

  const Card = ({ p }: { p: Prod }) => (
    <article className="brb-card">
      <div className="brb-art">
        {p.signed ? <span className="brb-flash">Signed</span>
          : p.tags.includes("key") ? <span className="brb-flash key">Key</span> : null}
        <button className={`brb-heart${hearts.has(p.key) ? " on" : ""}`} onClick={() => toggleHeart(p.key)} aria-label="Save">
          {hearts.has(p.key) ? "♥" : "♡"}
        </button>
        <CoverImage comic={p.comic} width={CW} height={CH} objectFit="cover"
          style={{ borderRadius: 6, background: "#0d0d12", border: "1px solid var(--border,#2c2c38)" }} />
      </div>
      <div className="brb-meta">
        <div className="brb-ptitle">{p.title} #{p.iss}</div>
        <div className="brb-psub">{p.pub || "—"}{p.yr ? ` · ${p.yr}` : ""}</div>
        <span className={`brb-grade${p.slab ? " slab" : ""}`}>{p.slab ? "🔒 " : ""}{p.grade}</span>
        {p.signed && <div className="brb-signer">✍ {p.signer}</div>}
        <div className="brb-buy">
          <span className="brb-price">{p.priceLabel}</span>
          <button className="brb-add" onClick={() => add(p)}>Add to bag</button>
        </div>
      </div>
    </article>
  );

  return (
    <div className="brb">
      <style>{CSS}</style>

      <div className="brb-annc">Free insured shipping over <b>$75</b> · Every signing authenticated · Black-owned, since 2024</div>

      <div className="brb-top">
        <div className="brb-mark">Black<span className="r">Read</span><span className="b2">Brown</span></div>
        <div className="brb-top-sub">Storefront preview · live inventory</div>
        <button className="brb-bagbtn" onClick={() => setBagOpen(true)}>
          🛍 Bag{bag.length ? <span className="brb-bagc">{bag.length}</span> : null}
        </button>
      </div>

      {/* HERO */}
      {featured && (
        <div className="brb-hero">
          <div className="brb-hero-copy">
            <span className="brb-eye">Comics by us, for everyone</span>
            <h1>The culture, <em>bagged, boarded</em> &amp; certified.</h1>
            <p className="brb-lede">A curated shop built on Black &amp; Brown heroes, the creators who made them, and the keys collectors actually want — every grade honest, every signature witnessed.</p>
            <div className="brb-stats">
              <div><b>{(DATA.comics as Comic[]).length.toLocaleString()}</b><span>Books in stock</span></div>
              <div><b>{products.filter(p => p.signed).length}</b><span>Signed &amp; certified</span></div>
              <div><b>CGC</b><span>Graded &amp; raw</span></div>
            </div>
          </div>
          <figure className="brb-feature">
            <CoverImage comic={featured.comic} width={260} height={390} objectFit="cover"
              style={{ borderRadius: 8, boxShadow: "0 24px 54px rgba(20,10,4,.3)", border: "1px solid var(--border,#2c2c38)" }} />
            <figcaption>
              <div className="ft">{featured.title} #{featured.iss}</div>
              <div className="fm">{featured.signed ? `Signed ${featured.signer} · ` : ""}{featured.grade}</div>
              <div className="fp">{featured.priceLabel}</div>
            </figcaption>
          </figure>
        </div>
      )}

      {/* COLLECTIONS */}
      <div className="brb-sec-head"><span className="brb-eye">Shop by</span><h2>Collections</h2></div>
      <div className="brb-cols">
        {([["black", "The house specialty", "Black Heroes & Creators", "c1"],
           ["signed", "Witnessed · COA", "Signed & Slabbed", "c2"],
           ["key", "First apps · Hot", "Key Issues", "c3"],
           ["under80", "Smart starts", "Under $80", "c4"]] as const).map(([f, s, b, c]) => (
          <button key={f} className={`brb-col ${c}`} onClick={() => { setFilter(f); document.getElementById("brb-grid")?.scrollIntoView({ behavior: "smooth" }); }}>
            <small>{s}</small><b>{b}</b>
          </button>
        ))}
      </div>

      {/* SIGNED RAIL */}
      {signedRail.length > 0 && (
        <>
          <div className="brb-sec-head"><span className="brb-eye">Witnessed in person</span><h2>Signed &amp; Certified</h2></div>
          <div className="brb-grid">{signedRail.map(p => <Card key={p.key} p={p} />)}</div>
        </>
      )}

      {/* MAIN GRID */}
      <div className="brb-sec-head" id="brb-grid"><span className="brb-eye">The full long box</span><h2>Shop all comics</h2></div>
      <div className="brb-filters">
        {([["all", "All"], ["black", "Black Heroes & Creators"], ["signed", "Signed"], ["key", "Key Issues"], ["under80", "Under $80"]] as const).map(([f, l]) => (
          <button key={f} className={`brb-chip${filter === f ? " on" : ""}`} onClick={() => setFilter(f)}>{l}</button>
        ))}
      </div>
      <div className="brb-count">{shown.length} book{shown.length !== 1 ? "s" : ""}</div>
      <div className="brb-grid">{shown.map(p => <Card key={p.key} p={p} />)}</div>

      {/* TRUST */}
      <div className="brb-trust">
        {[["🔏", "Every signature witnessed", "In-person signings with COA or CGC Signature Series."],
          ["📦", "Packed to survive", "Gemini mailers, full backing, insured over $75."],
          ["🔍", "Honest grades", "Raw books shown with real defects — no hero shots."],
          ["↩️", "7-day returns", "Not as described? Send it back, we cover it."]].map(([i, t, d]) => (
          <div key={t} className="brb-t"><span className="ti">{i}</span><div><b>{t}</b><span>{d}</span></div></div>
        ))}
      </div>

      {/* BAG */}
      {bagOpen && <div className="brb-scrim" onClick={() => setBagOpen(false)} />}
      <aside className={`brb-bag${bagOpen ? " open" : ""}`}>
        <div className="brb-bag-h"><b>Your bag</b><button onClick={() => setBagOpen(false)} aria-label="Close">✕</button></div>
        <div className="brb-bag-items">
          {bag.length === 0 ? <div className="brb-bag-empty">Your bag is empty.<br />The keys are calling. 📚</div>
            : bag.map((p, i) => (
              <div key={i} className="brb-li">
                <CoverImage comic={p.comic} width={42} height={63} objectFit="cover" style={{ borderRadius: 4, flexShrink: 0 }} />
                <div className="brb-lim">
                  <div className="brb-lit">{p.title} #{p.iss}</div>
                  <div className="brb-lis">{p.slab ? "🔒 " : ""}{p.grade}{p.signed ? ` · ✍ ${p.signer}` : ""}</div>
                  <div className="brb-lip">{p.priceLabel}</div>
                </div>
                <button className="brb-lix" onClick={() => setBag(b => b.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
              </div>
            ))}
        </div>
        <div className="brb-bag-foot">
          <div className="brb-bag-sub"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          <div className="brb-bag-note">{subtotal >= 75 ? "✓ Free insured shipping unlocked." : `Add ${money(75 - subtotal)} for free insured shipping.`}</div>
          <button className="brb-checkout" onClick={() => setToast("Demo checkout — no payment taken")}>Checkout</button>
        </div>
      </aside>

      {toast && <div className="brb-toast">{toast}</div>}
    </div>
  );
}

const CSS = `
.brb{--brb-red:var(--red,#c0102e);--brb-gold:#b6882f;--brb-brown:#6b4423;
  max-width:calc(1180px + var(--wide));margin:0 auto;padding:0 16px 80px;font-family:inherit}
.brb-annc{background:var(--text,#161210);color:var(--bg,#f6f1e8);text-align:center;font-size:.74rem;
  letter-spacing:.08em;text-transform:uppercase;padding:8px 10px;border-radius:0 0 8px 8px;font-weight:600}
.brb-annc b{color:var(--brb-gold)}
.brb-top{display:flex;align-items:center;gap:14px;padding:16px 2px 8px;flex-wrap:wrap}
.brb-mark{font-size:1.5rem;font-weight:800;letter-spacing:-.01em}
.brb-mark .r{color:var(--brb-red)} .brb-mark .b2{color:var(--brb-brown)}
.brb-top-sub{font-size:.76rem;color:var(--muted,#888);text-transform:uppercase;letter-spacing:.1em}
.brb-bagbtn{margin-left:auto;background:var(--text,#161210);color:var(--bg,#fff);border:none;border-radius:10px;
  padding:10px 16px;font:inherit;font-weight:700;font-size:.82rem;cursor:pointer;display:flex;align-items:center;gap:7px}
.brb-bagc{background:var(--brb-red);color:#fff;border-radius:10px;min-width:18px;height:18px;font-size:.66rem;
  display:grid;place-items:center;padding:0 5px}
.brb-eye{font-weight:700;text-transform:uppercase;letter-spacing:.16em;font-size:.68rem;color:var(--brb-red)}
.brb-hero{display:grid;grid-template-columns:1.15fr .85fr;gap:36px;align-items:center;margin:14px 0 8px;
  padding:34px;border-radius:16px;border:1px solid var(--border,#2c2c38);
  background:radial-gradient(900px 420px at 88% -20%,color-mix(in srgb,var(--brb-red) 16%,transparent),transparent 60%),
    radial-gradient(700px 420px at -10% 130%,color-mix(in srgb,var(--brb-brown) 22%,transparent),transparent 55%),var(--surface,#1c1c24)}
.brb-hero h1{font-size:clamp(2rem,4.6vw,3.3rem);line-height:1.04;margin:12px 0 0;font-weight:800;letter-spacing:-.02em}
.brb-hero h1 em{font-style:italic;color:var(--brb-red)}
.brb-lede{color:var(--muted,#888);max-width:46ch;margin:16px 0 0;font-size:1.02rem}
.brb-stats{display:flex;gap:26px;margin-top:24px;flex-wrap:wrap}
.brb-stats b{display:block;font-size:1.5rem;font-weight:800;letter-spacing:-.02em}
.brb-stats span{font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted,#888)}
.brb-feature{justify-self:center;text-align:center;margin:0}
.brb-feature figcaption .ft{font-weight:700;margin-top:14px;font-size:1.02rem}
.brb-feature figcaption .fm{font-size:.82rem;color:var(--muted,#888)}
.brb-feature figcaption .fp{font-weight:800;font-size:1.3rem;margin-top:3px}
.brb-sec-head{margin:40px 0 18px}
.brb-sec-head h2{font-size:1.7rem;font-weight:800;margin:5px 0 0;letter-spacing:-.01em}
.brb-cols{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.brb-col{position:relative;border-radius:13px;padding:20px 16px;min-height:118px;display:flex;flex-direction:column;
  justify-content:flex-end;color:#fff;border:none;cursor:pointer;text-align:left;transition:transform .2s}
.brb-col:hover{transform:translateY(-3px)}
.brb-col small{font-size:.63rem;letter-spacing:.14em;text-transform:uppercase;opacity:.85}
.brb-col b{font-size:1.18rem;margin-top:3px;line-height:1.05}
.brb-col.c1{background:linear-gradient(145deg,var(--brb-brown),#3a2413)}
.brb-col.c2{background:linear-gradient(145deg,var(--brb-gold),#6d4f12)}
.brb-col.c3{background:linear-gradient(145deg,var(--brb-red),#7c0a1b)}
.brb-col.c4{background:linear-gradient(145deg,#31373f,#12161b)}
.brb-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
.brb-chip{font-weight:700;font-size:.76rem;text-transform:uppercase;letter-spacing:.03em;border:1.5px solid var(--border,#2c2c38);
  background:var(--surface,#1c1c24);color:var(--muted,#888);border-radius:30px;padding:9px 15px;cursor:pointer;font-family:inherit}
.brb-chip:hover{color:var(--text,#eee);border-color:var(--text,#eee)}
.brb-chip.on{background:var(--text,#161210);color:var(--bg,#fff);border-color:var(--text,#161210)}
.brb-count{font-size:.8rem;color:var(--muted,#888);margin-bottom:14px}
.brb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(${CW}px,1fr));gap:22px 16px;justify-items:stretch}
.brb-card{display:flex;flex-direction:column;background:var(--surface,#1c1c24);border:1px solid var(--border,#2c2c38);
  border-radius:12px;overflow:hidden;transition:transform .2s,box-shadow .2s}
.brb-card:hover{transform:translateY(-4px);box-shadow:0 16px 32px rgba(20,10,4,.18)}
.brb-art{position:relative;padding:12px 12px 0;display:flex;justify-content:center}
.brb-art > *{width:100%!important}
.brb-flash{position:absolute;top:20px;left:0;z-index:4;font-weight:800;font-size:.6rem;text-transform:uppercase;
  letter-spacing:.07em;padding:5px 11px;color:#2a1e06;background:var(--brb-gold);box-shadow:0 5px 12px rgba(20,10,4,.25)}
.brb-flash.key{background:var(--brb-red);color:#fff}
.brb-heart{position:absolute;top:18px;right:18px;z-index:5;width:30px;height:30px;border-radius:50%;border:none;
  background:color-mix(in srgb,var(--surface,#1c1c24) 78%,transparent);color:var(--muted,#888);font-size:.92rem;
  cursor:pointer;backdrop-filter:blur(4px)}
.brb-heart.on{color:var(--brb-red)}
.brb-meta{padding:12px 14px 15px;display:flex;flex-direction:column;gap:2px;flex:1}
.brb-ptitle{font-weight:700;font-size:.9rem;line-height:1.18}
.brb-psub{font-size:.75rem;color:var(--muted,#888)}
.brb-grade{align-self:flex-start;font-weight:700;font-size:.62rem;letter-spacing:.04em;text-transform:uppercase;
  padding:3px 8px;border-radius:5px;margin-top:5px;border:1px solid var(--border,#2c2c38);color:var(--muted,#888)}
.brb-grade.slab{background:color-mix(in srgb,var(--brb-gold) 22%,transparent);border-color:transparent;color:var(--brb-gold)}
.brb-signer{font-size:.72rem;color:var(--brb-gold);font-weight:600}
.brb-buy{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:auto;padding-top:10px}
.brb-price{font-weight:800;font-size:1.14rem;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.brb-add{font-weight:700;font-size:.7rem;text-transform:uppercase;letter-spacing:.04em;background:var(--text,#161210);
  color:var(--bg,#fff);border:none;border-radius:9px;padding:9px 12px;cursor:pointer;font-family:inherit}
.brb-add:hover{background:var(--brb-red);color:#fff}
.brb-trust{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:40px;padding:26px;
  border:1px solid var(--border,#2c2c38);border-radius:14px;background:var(--surface,#1c1c24)}
.brb-t{display:flex;gap:11px;align-items:flex-start}
.brb-t .ti{font-size:1.3rem;line-height:1}
.brb-t b{font-size:.84rem;display:block}
.brb-t span{font-size:.76rem;color:var(--muted,#888)}
.brb-scrim{position:fixed;inset:0;background:rgba(10,6,2,.5);z-index:800}
.brb-bag{position:fixed;top:0;right:0;height:100%;width:min(390px,92vw);background:var(--surface,#1c1c24);z-index:810;
  transform:translateX(100%);transition:transform .3s;display:flex;flex-direction:column;box-shadow:-18px 0 50px rgba(0,0,0,.3)}
.brb-bag.open{transform:translateX(0)}
.brb-bag-h{display:flex;align-items:center;justify-content:space-between;padding:18px 18px 13px;border-bottom:1px solid var(--border,#2c2c38)}
.brb-bag-h b{font-size:1.2rem;font-weight:800}
.brb-bag-h button{background:none;border:none;color:var(--muted,#888);font-size:1.1rem;cursor:pointer}
.brb-bag-items{flex:1;overflow-y:auto;padding:4px 18px}
.brb-li{display:flex;gap:11px;padding:12px 0;border-bottom:1px solid var(--border,#2c2c38)}
.brb-lim{flex:1;min-width:0}
.brb-lit{font-weight:700;font-size:.82rem;line-height:1.2}
.brb-lis{font-size:.71rem;color:var(--muted,#888)}
.brb-lip{font-weight:800;margin-top:3px}
.brb-lix{background:none;border:none;color:var(--muted,#888);font-size:1.05rem;cursor:pointer;align-self:flex-start}
.brb-bag-empty{text-align:center;color:var(--muted,#888);padding:46px 18px;font-size:.9rem}
.brb-bag-foot{border-top:1px solid var(--border,#2c2c38);padding:15px 18px 18px}
.brb-bag-sub{display:flex;justify-content:space-between;font-weight:800;font-size:1.04rem;margin-bottom:4px}
.brb-bag-note{font-size:.72rem;color:var(--muted,#888);margin-bottom:12px}
.brb-checkout{width:100%;background:var(--brb-red);color:#fff;border:none;border-radius:11px;padding:14px;font-weight:800;
  text-transform:uppercase;letter-spacing:.06em;font-size:.82rem;cursor:pointer;font-family:inherit}
.brb-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:900;background:var(--text,#161210);
  color:var(--bg,#fff);font-weight:700;font-size:.82rem;padding:12px 20px;border-radius:30px;box-shadow:0 12px 30px rgba(0,0,0,.3)}
@media(max-width:860px){
  .brb-hero{grid-template-columns:1fr;gap:24px;padding:24px}
  .brb-feature{order:-1}
  .brb-cols{grid-template-columns:repeat(2,1fr)}
  .brb-trust{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:480px){
  .brb-grid{grid-template-columns:repeat(2,1fr);gap:14px 12px}
  .brb-hero h1{font-size:1.9rem}
}
`;
