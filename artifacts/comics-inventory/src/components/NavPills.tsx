// The [ t | a ] capsule: one control, two destinations.
//   t → every cover of this title        a → this story arc only (only when arc data exists)
// The letter is the shortcut; on hover/focus it expands to its word ("title", "arc").
// Used on every cover (overlay) and inline next to titles (Every Book, cover modal).
import { openTitle, openArc } from "@/lib/nav";
import { arcOf } from "@/lib/arc";
import type { Comic } from "@/data/data";

type Props = {
  comic: { Title: string; Issue?: string | number; Volume?: string };
  overlay?: boolean;           // absolutely positioned in a cover's corner
  size?: "sm" | "md";
  onBefore?: () => void;       // e.g. close a modal before navigating
};

export function NavPills({ comic, overlay = false, size = "md", onBefore }: Props) {
  if (!comic?.Title) return null;
  const arc = arcOf(comic as Comic);
  const go = (e: React.MouseEvent, fn: () => void) => { e.stopPropagation(); e.preventDefault(); onBefore?.(); fn(); };
  return (
    <span className={`navpills${overlay ? " overlay" : ""} ${size}`} onClick={e => e.stopPropagation()}>
      <button type="button" className="np t" aria-label={`Every ${comic.Title} cover`} title={`Every ${comic.Title} cover`}
        onClick={e => go(e, () => openTitle(comic.Title))}>
        t<span className="np-word">itle</span>
      </button>
      {arc && (
        <button type="button" className="np a"
          aria-label={`Story arc: ${arc.name}${arc.length ? ` (${arc.length} parts)` : ""}`}
          title={`Story arc: ${arc.name}${arc.part && arc.length ? ` · part ${arc.part} of ${arc.length}` : ""}`}
          onClick={e => go(e, () => openArc(comic.Title, arc.name, comic.Volume))}>
          a<span className="np-word">rc</span>
        </button>
      )}
    </span>
  );
}
