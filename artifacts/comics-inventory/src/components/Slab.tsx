import type { Comic } from "@/data/data";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// Real photos of specific slabbed books (CGC x JSA cases), read off each label.
// Matched to the book by Title + Issue so a given slab shows ITS OWN photo —
// never a stand-in. `grade` here is the grade printed on the slab label; where it
// disagrees with the sheet's Condition that's a data flag, not a display choice.
type SlabPhoto = { file: string; title: string; issue: string; grade: string };
export const SLAB_PHOTOS: SlabPhoto[] = [
  { file: "slab-1.jpg",  title: "Incredible Hulk",               issue: "393", grade: "9.2" },
  { file: "slab-2.jpg",  title: "Supergirl: Woman of Tomorrow",  issue: "1",   grade: "9.4" },
  { file: "slab-3.jpg",  title: "Truth: Red, White & Black",     issue: "1",   grade: "9.6" },
  { file: "slab-4.jpg",  title: "Black Lightning",               issue: "1",   grade: "7.5" },
  { file: "slab-5.jpg",  title: "Transformers",                  issue: "1",   grade: "5.5" },
  { file: "slab-6.jpg",  title: "Exiles",                        issue: "3",   grade: "8.0" },
  { file: "slab-7.jpg",  title: "WildC.A.T.s",                   issue: "11",  grade: "9.2" },
  { file: "slab-8.jpg",  title: "Vision",                        issue: "1",   grade: "8.0" },
  { file: "slab-9.jpg",  title: "Savage Dragon",                 issue: "1",   grade: "9.6" },
  { file: "slab-10.jpg", title: "Avengers",                      issue: "60",  grade: "6.5" },
  { file: "slab-11.jpg", title: "Avengers",                      issue: "62",  grade: "6.0" },
  { file: "slab-12.jpg", title: "Avengers Annual",               issue: "2",   grade: "5.5" },
  { file: "slab-13.jpg", title: "Avengers",                      issue: "87",  grade: "4.0" },
];

const normT = (t?: string) => String(t || "").toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "");
const normI = (i?: string) => String(i || "").replace(/^#/, "").replace(/\.0$/, "").trim();

const PHOTO_BY_KEY: Record<string, SlabPhoto> = Object.fromEntries(
  SLAB_PHOTOS.map(p => [`${normT(p.title)}|${normI(p.issue)}`, p])
);

/** The public URL for a slab photo file. */
export const slabFileUrl = (file: string) => `${BASE}/slabbed/${file}`;

/** The public URL of this book's own slab photo, or null if we don't have one. */
export function slabPhotoUrl(c: Pick<Comic, "Title" | "Issue">): string | null {
  const p = PHOTO_BY_KEY[`${normT(c.Title)}|${normI(c.Issue)}`];
  return p ? slabFileUrl(p.file) : null;
}

// A CGC-graded copy ("CGC 9.8"). The "⚠ NEEDS PRESSING … CGC" rows are pending,
// not yet graded, so they are deliberately excluded.
export const isCgc = (c: Pick<Comic, "Condition">) =>
  /^cgc\s*\d/i.test(String(c.Condition || "").trim());

// CC10 is the physical slab box. A book counts as "slabbed" if it lives in CC10
// OR carries a CGC grade — so the Slabbed view shows the whole box, graded or not.
export const isSlabBox = (c: Pick<Comic, "Box">) => /^cc10$/i.test(String(c.Box || "").trim());
export const isSlab = (c: Pick<Comic, "Condition" | "Box">) => isSlabBox(c) || isCgc(c);

export const slabGrade = (c: Pick<Comic, "Condition">) =>
  String(c.Condition || "").match(/cgc\s*([\d.]+)/i)?.[1] || "";

/** This book's own slab photo + CGC grade. Shows only when we actually have the
 *  matching photo; otherwise just the grade pill (so the book stays marked). */
export function SlabThumb({ comic, size = 52 }: { comic: Comic; size?: number }) {
  const g = slabGrade(comic);
  const url = slabPhotoUrl(comic);
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 3 }} title={`Slabbed — CGC ${g}`}>
      {url && (
        <img
          src={url}
          alt={`${comic.Title} #${comic.Issue} — CGC ${g} slab`}
          loading="lazy"
          onError={e => { e.currentTarget.style.display = "none"; }}
          style={{ width: size, height: Math.round(size * 1.5), objectFit: "cover", borderRadius: 4, boxShadow: "0 2px 7px rgba(0,0,0,0.28)" }}
        />
      )}
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
