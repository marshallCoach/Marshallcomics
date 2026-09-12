// Life Archive — the separate static site, embedded in-app so it stays under the
// nav (click any other tab to go back and forth without leaving the app).
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function LifeArchive() {
  const src = `${BASE}/life-archive/index.html`;
  return (
    <div style={{ position: "relative", width: "100%", height: "calc(100vh - 150px)" }}>
      <iframe
        src={src}
        title="Life Archive"
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
      />
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: "absolute", top: 8, right: 12, fontSize: "0.75rem",
          color: "var(--muted)", textDecoration: "none", background: "var(--surface)",
          border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px",
        }}
      >
        Open full ↗
      </a>
    </div>
  );
}
