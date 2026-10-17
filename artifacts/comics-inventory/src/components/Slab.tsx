import type { Comic } from "@/data/data";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// Four generic "post-slabbed" example photos (CGC cases). Drop the files in
// public/slabbed/ as slab-1.jpg … slab-4.jpg. Any file that isn't there yet is
// hidden gracefully (see onError below), so the UI never shows a broken image.
export const SLAB_EXAMPLES = [1, 2, 3, 4].map(n => `${BASE}/slabbed/slab-${n}.jpg`);

// A slabbed book = a graded CGC copy ("CGC 9.8"). The "⚠ NEEDS PRESSING … CGC"
// rows are pending, not yet slabbed, so they are deliberately NOT slabs.
export const isSlab = (c: Pick<Comic, "Condition">) =>
  /^cgc\s*\d/i.test(String(c.Condition || "").trim());

export const slabGrade = (c: Pick<Comic, "Condition">) =>
  String(c.Condition || "").match(/cgc\s*([\d.]+)/i)?.[1] || "";

// Deterministic pick so a given book always shows the same example slab photo.
export function slabExampleFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return SLAB_EXAMPLES[h % SLAB_EXAMPLES.length];
}

/** Small slab example photo + CGC grade, shown on each graded book. If the
 *  image file isn't present yet the photo hides itself and the grade pill
 *  stays, so the book is still clearly marked as slabbed. */
export function SlabThumb({ comic, size = 52 }: { comic: Comic; size?: number }) {
  const g = slabGrade(comic);
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 3 }} title={`Slabbed — CGC ${g}`}>
      <img
        src={slabExampleFor(`${comic.Title}|${comic.Issue}`)}
        alt="CGC slab"
        loading="lazy"
        onError={e => { e.currentTarget.style.display = "none"; }}
        style={{ width: size, height: Math.round(size * 1.5), objectFit: "cover", borderRadius: 4, boxShadow: "0 2px 7px rgba(0,0,0,0.28)" }}
      />
      {g && (
        <span style={{ fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.5px", color: "#fff", background: "#111", borderRadius: 3, padding: "1px 7px", whiteSpace: "nowrap" }}>
          CGC {g}
        </span>
      )}
    </div>
  );
}

/** Tiny "SLAB" pill for badge rows. */
export function SlabBadge({ comic }: { comic: Comic }) {
  const g = slabGrade(comic);
  return (
    <span style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: "0.875rem", letterSpacing: "1px", color: "#fff", background: "#111", borderRadius: 3, padding: "1px 6px" }}>
      SLAB{g ? ` ${g}` : ""}
    </span>
  );
}
