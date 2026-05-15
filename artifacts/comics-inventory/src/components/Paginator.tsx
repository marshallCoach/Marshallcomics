interface Props {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export function Paginator({ page, pageCount, total, pageSize, onChange }: Props) {
  if (pageCount <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  const pages: (number | "…")[] = [];
  if (pageCount <= 7) {
    for (let i = 1; i <= pageCount; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(pageCount - 1, page + 1); i++) pages.push(i);
    if (page < pageCount - 2) pages.push("…");
    pages.push(pageCount);
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 4px 4px",
      flexWrap: "wrap",
      gap: 8,
    }}>
      <span style={{ fontSize: "0.75rem", color: "var(--muted2)", fontFamily: "'Crimson Pro', serif" }}>
        Showing {from}–{to} of {total}
      </span>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          style={btnStyle(false, page === 1)}
        >← Prev</button>

        {pages.map((p, i) =>
          p === "…"
            ? <span key={`e${i}`} style={{ padding: "0 4px", color: "var(--muted2)", fontSize: "0.78rem" }}>…</span>
            : <button
                key={p}
                onClick={() => onChange(p as number)}
                style={btnStyle(p === page, false)}
              >{p}</button>
        )}

        <button
          onClick={() => onChange(page + 1)}
          disabled={page === pageCount}
          style={btnStyle(false, page === pageCount)}
        >Next →</button>
      </div>
    </div>
  );
}

function btnStyle(active: boolean, disabled: boolean): React.CSSProperties {
  return {
    padding: "4px 10px",
    fontSize: "0.75rem",
    fontFamily: "'Bebas Neue', sans-serif",
    letterSpacing: "1px",
    border: active ? "1.5px solid var(--red)" : "1.5px solid var(--border)",
    borderRadius: 3,
    background: active ? "var(--red)" : "var(--surface)",
    color: active ? "#fff" : disabled ? "var(--muted2)" : "var(--text)",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.4 : 1,
    minWidth: 36,
  };
}
