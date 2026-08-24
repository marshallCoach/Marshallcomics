import { useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// Button that pre-downloads every cover image into the service-worker cache so
// they display offline (e.g. on a plane). Auto-caching also happens as you
// browse, but this guarantees the whole collection is available before you fly.
export default function OfflineCovers() {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "caching" | "done">("idle");
  const [pct, setPct] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => { setSupported("serviceWorker" in navigator); }, []);
  if (!supported) return null;

  async function save() {
    setState("loading");
    // gather every cover URL from covers.json
    let urls: string[] = [];
    try {
      const cov = await fetch(`${BASE}/covers.json`).then(r => r.json());
      const set = new Set<string>();
      for (const v of Object.values(cov as Record<string, { url?: string; large?: string } | null>)) {
        if (v?.url) set.add(v.url);
        if (v?.large) set.add(v.large);
      }
      urls = [...set];
    } catch { setState("idle"); return; }

    const reg = await navigator.serviceWorker.ready;
    if (!reg.active) { setState("idle"); return; }
    setTotal(urls.length); setState("caching"); setPct(0);

    const onMsg = (e: MessageEvent) => {
      const d = e.data || {};
      if (d.type === "PRECACHE_PROGRESS") setPct(Math.round((d.done / d.total) * 100));
      if (d.type === "PRECACHE_DONE") { setPct(100); setState("done"); navigator.serviceWorker.removeEventListener("message", onMsg); }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    reg.active.postMessage({ type: "PRECACHE_COVERS", urls });
  }

  const label =
    state === "loading" ? "Reading covers…"
    : state === "caching" ? `Saving ${pct}%`
    : state === "done" ? `✓ ${total.toLocaleString()} saved`
    : "✈ Save covers offline";

  return (
    <button
      onClick={() => state === "idle" && save()}
      disabled={state === "loading" || state === "caching"}
      title="Download all cover images so they display without a connection (e.g. on a plane)"
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: state === "done" ? "#16653420" : "var(--surface2)",
        border: `1px solid ${state === "done" ? "#16653455" : "var(--border)"}`,
        borderRadius: 6, padding: "5px 10px", cursor: state === "idle" ? "pointer" : "default",
        color: state === "done" ? "#166534" : "var(--muted2)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: "0.8rem", letterSpacing: "1px", whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}
