import { useEffect, useState, type CSSProperties } from "react";
import type { Comic } from "@/data/data";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/** A slab photo that opens a full-size lightbox pop-up on click. Hides itself if
 *  the file is missing. Stops propagation so it doesn't trigger a parent card. */
export function SlabLightboxImg({ src, alt, style }: { src: string; alt: string; style?: CSSProperties }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        onError={e => { e.currentTarget.style.display = "none"; }}
        style={{ cursor: "zoom-in", ...style }}
      />
      {open && (
        <div
          onClick={e => { e.stopPropagation(); setOpen(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24, cursor: "zoom-out" }}
        >
          <img src={src} alt={alt} style={{ maxWidth: "95vw", maxHeight: "95vh", objectFit: "contain", borderRadius: 8, boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }} />
          <button
            onClick={e => { e.stopPropagation(); setOpen(false); }}
            aria-label="Close"
            style={{ position: "fixed", top: 16, right: 20, fontSize: 28, lineHeight: 1, color: "#fff",
              background: "none", border: "none", cursor: "pointer" }}
          >×</button>
        </div>
      )}
    </>
  );
}

// Real photos of specific slabbed books (CGC x JSA cases), read off each label.
// Matched to the book by Title + Issue so a given slab shows ITS OWN photo —
// never a stand-in. `grade` here is the grade printed on the slab label; where it
// disagrees with the sheet's Condition that's a data flag, not a display choice.
// `year` / `box` (optional) pin the photo to ONE copy when you own the same title+issue
// in several volumes or boxes (Nov 23: Guardians of the Galaxy #1 exists in 5 volumes).
// label/signed/cert are read off the slab label and shown in the comic pop-up.
export type SlabPhoto = { file: string; title: string; issue: string; grade: string; year?: string; box?: string;
  label?: string; signed?: string; cert?: string; pages?: string; notes?: string };
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
  { file: "slab-14.jpg", title: "Guardians of the Galaxy",       issue: "1",   grade: "9.8", year: "2023", box: "CC10",
    label: "Signature Series", signed: "Alex Ross on 5/30/23", cert: "4260576009", pages: "White",
    notes: "Variant Edition: Guardians of the Galaxy #181 \"Timeless\" variant cover, \"Virgin\" cover" },
];

const normT = (t?: string) => String(t || "").toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "");
const normI = (i?: string) => String(i || "").replace(/^#/, "").replace(/\.0$/, "").trim();

const PHOTOS_BY_KEY = new Map<string, SlabPhoto[]>();
for (const p of SLAB_PHOTOS) {
  const k = `${normT(p.title)}|${normI(p.issue)}`;
  (PHOTOS_BY_KEY.get(k) ?? PHOTOS_BY_KEY.set(k, []).get(k)!).push(p);
}
type SlabKey = Pick<Comic, "Title" | "Issue"> & { Year?: string; Box?: string };

/** This exact copy's slab photo record (year/box must match when the photo names them). */
export function slabPhoto(c: SlabKey): SlabPhoto | null {
  const list = PHOTOS_BY_KEY.get(`${normT(c.Title)}|${normI(c.Issue)}`) ?? [];
  return list.find(p =>
    (!p.year || String(c.Year || "").slice(0, 4) === p.year) &&
    (!p.box || String(c.Box || "").trim().toUpperCase() === p.box.toUpperCase())) ?? null;
}

/** The public URL for a slab photo file. */
export const slabFileUrl = (file: string) => `${BASE}/slabbed/${file}`;

/** The public URL of this book's own slab photo, or null if we don't have one. */
export function slabPhotoUrl(c: SlabKey): string | null {
  const p = slabPhoto(c);
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
        <SlabLightboxImg
          src={url}
          alt={`${comic.Title} #${comic.Issue} — CGC ${g} slab`}
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
