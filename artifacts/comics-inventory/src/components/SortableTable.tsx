import { useState, useRef, useCallback, useEffect } from "react";
import { Paginator } from "./Paginator";

export interface ColDef<T> {
  key: string;
  label: string;
  defaultWidth?: number;
  sort?: (a: T, b: T) => number;
  cell: (row: T) => React.ReactNode;
}

interface Props<T> {
  cols: ColDef<T>[];
  rows: T[];
  pageSize?: number;
  expandCell?: (row: T) => React.ReactNode;
  rowKey?: (row: T, i: number) => string | number;
  defaultSortKey?: string;
  defaultSortDir?: "asc" | "desc";
}

const DEFAULT_PAGE_SIZE = 50;

export function SortableTable<T>({ cols, rows, pageSize = DEFAULT_PAGE_SIZE, expandCell, rowKey, defaultSortKey, defaultSortDir = "asc" }: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultSortDir);
  const [openRows, setOpenRows] = useState<Set<number>>(new Set());
  const [widths, setWidths]     = useState<number[]>(() => cols.map(c => c.defaultWidth ?? 140));
  const [page, setPage]         = useState(1);

  const resizingCol = useRef<number | null>(null);
  const startX      = useRef(0);
  const startWidth  = useRef(0);

  useEffect(() => { setPage(1); setOpenRows(new Set()); }, [rows]);

  const onMouseDown = useCallback((colIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    resizingCol.current = colIdx;
    startX.current = e.clientX;
    startWidth.current = widths[colIdx];
  }, [widths]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (resizingCol.current === null) return;
      const delta = e.clientX - startX.current;
      const newW  = Math.max(60, startWidth.current + delta);
      setWidths(prev => {
        const next = [...prev];
        next[resizingCol.current!] = newW;
        return next;
      });
    };
    const onUp = () => { resizingCol.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const handleSort = (col: ColDef<T>) => {
    if (!col.sort) return;
    if (sortKey === col.key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(col.key);
      setSortDir("asc");
    }
    setPage(1);
    setOpenRows(new Set());
  };

  const sorted = [...rows].sort((a, b) => {
    const col = cols.find(c => c.key === sortKey);
    if (!col?.sort) return 0;
    const result = col.sort(a, b);
    return sortDir === "asc" ? result : -result;
  });

  const pageCount  = Math.ceil(sorted.length / pageSize);
  const pageSlice  = sorted.slice((page - 1) * pageSize, page * pageSize);

  const toggleRow = (i: number) => {
    if (!expandCell) return;
    setOpenRows(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };

  const sortIndicator = (col: ColDef<T>) => {
    if (!col.sort) return null;
    if (sortKey !== col.key) return <span style={{ opacity: 0.25, marginLeft: 4 }}>↕</span>;
    return <span style={{ color: "var(--red)", marginLeft: 4 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
          <colgroup>
            {widths.map((w, i) => <col key={i} style={{ width: w }} />)}
          </colgroup>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--red)" }}>
              {cols.map((col, ci) => (
                <th
                  key={col.key}
                  style={{
                    position: "relative",
                    padding: "8px 20px 8px 12px",
                    textAlign: "left",
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: "0.7rem",
                    letterSpacing: "1.5px",
                    color: sortKey === col.key ? "var(--red)" : "var(--muted2)",
                    whiteSpace: "nowrap",
                    userSelect: "none",
                    cursor: col.sort ? "pointer" : "default",
                    overflow: "hidden",
                  }}
                  onClick={() => handleSort(col)}
                >
                  {col.label}{sortIndicator(col)}
                  <div
                    onMouseDown={e => onMouseDown(ci, e)}
                    onClick={e => e.stopPropagation()}
                    style={{
                      position: "absolute",
                      right: 0, top: 0, bottom: 0,
                      width: 6,
                      cursor: "col-resize",
                      background: "transparent",
                      zIndex: 10,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(200,16,46,0.25)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageSlice.map((row, i) => {
              const key    = rowKey ? rowKey(row, i) : i;
              const isOpen = openRows.has(i);
              return (
                <>
                  <tr
                    key={`r-${key}`}
                    onClick={() => toggleRow(i)}
                    style={{ borderBottom: "1px solid var(--border)", cursor: expandCell ? "pointer" : "default", background: isOpen ? "#fff8f8" : undefined, transition: "background 0.1s" }}
                    onMouseEnter={e => { if (!isOpen) (e.currentTarget as HTMLTableRowElement).style.background = "var(--surface2)"; }}
                    onMouseLeave={e => { if (!isOpen) (e.currentTarget as HTMLTableRowElement).style.background = ""; }}
                  >
                    {cols.map(col => (
                      <td
                        key={col.key}
                        style={{ padding: "8px 12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "middle" }}
                      >
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                  {isOpen && expandCell && (
                    <tr key={`e-${key}`} style={{ borderBottom: "2px solid #f0dada", background: "#fff8f8" }}>
                      <td colSpan={cols.length} style={{ padding: "10px 14px 14px 28px" }}>
                        {expandCell(row)}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
      <Paginator
        page={page}
        pageCount={pageCount}
        total={sorted.length}
        pageSize={pageSize}
        onChange={p => { setPage(p); setOpenRows(new Set()); }}
      />
    </div>
  );
}
