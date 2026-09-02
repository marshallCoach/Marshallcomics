// ── Cover flags — the ONE source of truth ────────────────────────────────────
// A "flagged cover" = a book whose cover image looks wrong and needs review /
// re-fetch from Comic Vine. Every page that lets you flag a cover (the cover
// modal, the Cover Art catalog, the Cover Review roulette) reads and writes
// through here, so there is a single store, a single count, and a single export.
//
// History: two earlier implementations shared the localStorage key
// "brbFlaggedCovers_v1" but serialised it differently — CoverCatalog wrote a
// JSON *array*, the cover modal wrote a JSON *object map* — so flags made in one
// place were invisible (and got overwritten) in the other. `read()` below now
// accepts BOTH shapes and always writes back the array form, migrating on first
// touch. `write()` fires a window event so the header counter updates live.
import { useEffect, useState } from "react";

export const FLAG_KEY = "brbFlaggedCovers_v1";
export const FLAGS_CHANGED_EVENT = "brb-cover-flags-changed";

export interface FlaggedCover {
  id: string;
  Title: string;
  Issue: string;
  Box: string;
  Cover_Artist: string;
  Publisher: string;
  Year: string;
  flaggedAt: string;
}

export interface CoverLike {
  Title: string;
  Issue: string | number;
  Box?: string;
  Cover_Artist?: string;
  Publisher?: string;
  Year?: string;
}

export function coverId(c: { Title: string; Issue: string | number; Box?: string }): string {
  return `${(c.Title ?? "").trim()}|||${String(c.Issue ?? "").trim()}|||${(c.Box ?? "").trim()}`;
}

// Tolerant read: array form (canonical) OR legacy object-map form.
function read(): Map<string, FlaggedCover> {
  try {
    const raw = localStorage.getItem(FLAG_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    const list: FlaggedCover[] = Array.isArray(parsed)
      ? parsed
      : Object.values(parsed as Record<string, FlaggedCover>);
    return new Map(list.filter(f => f && f.id).map(f => [f.id, f]));
  } catch {
    return new Map();
  }
}

// Single writer — always array form, and always announces the change so any
// live counter / list re-reads.
function write(map: Map<string, FlaggedCover>): void {
  localStorage.setItem(FLAG_KEY, JSON.stringify([...map.values()]));
  emit();
}

function emit(): void {
  if (typeof window === "undefined") return;
  // Deferred: some callers write inside a React setState updater (which runs
  // during render), and a synchronous dispatch there would setState a subscribed
  // component mid-render. A microtask hops out of the render phase first.
  queueMicrotask(() => window.dispatchEvent(new CustomEvent(FLAGS_CHANGED_EVENT)));
}

export function loadFlags(): Map<string, FlaggedCover> {
  return read();
}

export function saveFlags(map: Map<string, FlaggedCover>): void {
  write(map);
}

export function flagCount(): number {
  return read().size;
}

export function isFlagged(id: string): boolean {
  return read().has(id);
}

function buildEntry(c: CoverLike): FlaggedCover {
  return {
    id: coverId(c),
    Title: c.Title,
    Issue: String(c.Issue ?? ""),
    Box: c.Box ?? "",
    Cover_Artist: c.Cover_Artist ?? "",
    Publisher: c.Publisher ?? "",
    Year: c.Year ?? "",
    flaggedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  };
}

// Toggle one cover's flag. Returns the new flagged state (true = now flagged).
export function toggleFlag(c: CoverLike): boolean {
  const map = read();
  const id = coverId(c);
  if (map.has(id)) {
    map.delete(id);
    write(map);
    return false;
  }
  map.set(id, buildEntry(c));
  write(map);
  return true;
}

export function setFlagged(c: CoverLike, on: boolean): void {
  const map = read();
  const id = coverId(c);
  if (on) map.set(id, map.get(id) ?? buildEntry(c));
  else map.delete(id);
  write(map);
}

export function removeFlag(id: string): void {
  const map = read();
  if (map.delete(id)) write(map);
}

export function clearAllFlags(): void {
  localStorage.removeItem(FLAG_KEY);
  emit();
}

// The single "export for Claude" — downloads every flagged cover as JSON.
export function exportFlags(): number {
  const all = [...read().values()];
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `flagged-covers-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return all.length;
}

// ── React hooks ──────────────────────────────────────────────────────────────
// Subscribe to the live flag count (updates the moment any cover is flagged,
// unflagged, or cleared — same tab via the custom event, other tabs via storage).
export function useFlagCount(): number {
  const [n, setN] = useState<number>(() => flagCount());
  useEffect(() => {
    const h = () => setN(flagCount());
    window.addEventListener(FLAGS_CHANGED_EVENT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(FLAGS_CHANGED_EVENT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return n;
}

// Subscribe to the full flag map (for pages that render the list).
export function useFlags(): Map<string, FlaggedCover> {
  const [map, setMap] = useState<Map<string, FlaggedCover>>(() => loadFlags());
  useEffect(() => {
    const h = () => setMap(loadFlags());
    window.addEventListener(FLAGS_CHANGED_EVENT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(FLAGS_CHANGED_EVENT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return map;
}
