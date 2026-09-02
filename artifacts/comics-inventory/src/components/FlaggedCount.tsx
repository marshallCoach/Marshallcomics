import { useFlagCount } from "@/lib/coverFlags";

// Global "flagged covers" tally, shown in the top header. Increments the instant
// any cover is flagged anywhere in the app (cover modal, Cover Art catalog,
// Cover Review) and clicks through to Cover Review to export / clear.
export default function FlaggedCount({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const n = useFlagCount();
  const active = n > 0;
  return (
    <button
      onClick={() => onNavigate("coverreview")}
      title={active ? `${n} cover${n === 1 ? "" : "s"} flagged for review — open Cover Review` : "No covers flagged — open Cover Review"}
      aria-label={`${n} flagged covers`}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: active ? "#c8102e" : "var(--surface2)",
        border: `1px solid ${active ? "#8b0000" : "var(--border)"}`,
        borderRadius: 6, padding: "5px 10px", cursor: "pointer",
        color: active ? "#fff" : "var(--muted2)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: "0.8rem", letterSpacing: "0.5px", whiteSpace: "nowrap",
        transition: "background 0.15s, color 0.15s",
      }}
    >
      <span aria-hidden>🚩</span>
      <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{n}</span>
      <span style={{ opacity: 0.85 }}>flagged</span>
    </button>
  );
}
