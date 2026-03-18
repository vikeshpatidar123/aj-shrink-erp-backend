"use client";
import { useState, useMemo } from "react";
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

export type Column<T> = {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
};

interface DataTableProps<T extends { id: string }> {
  data: T[];
  columns: Column<T>[];
  searchKeys?: (keyof T)[];
  pageSize?: number;
  actions?: (row: T) => React.ReactNode;
}

export function DataTable<T extends { id: string }>({
  data, columns, searchKeys = [], pageSize = 10, actions,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      searchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(q))
    );
  }, [data, search, searchKeys]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = String((a as Record<string, unknown>)[sortKey] ?? "");
      const bv = String((b as Record<string, unknown>)[sortKey] ?? "");
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const getCellValue = (row: T, col: Column<T>): React.ReactNode =>
    col.render
      ? col.render(row)
      : String((row as Record<string, unknown>)[String(col.key)] ?? "");

  // First column used as the card title/header
  const titleCol = columns[0];
  const bodyColumns = columns.slice(1);

  return (
    <div className="flex flex-col gap-4">

      {/* ── Search ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-full sm:max-w-xs">
        <Search size={15} className="text-gray-400 flex-shrink-0" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search..."
          className="bg-transparent text-sm text-gray-700 outline-none w-full placeholder-gray-400"
        />
      </div>

      {/* ══════════════════════════════════════════════════════
          DESKTOP TABLE  (lg and above)
         ══════════════════════════════════════════════════════ */}
      <div className="hidden lg:block overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={`px-4 py-3 text-left font-semibold ${col.sortable ? "cursor-pointer select-none hover:text-gray-800" : ""} ${col.width ?? ""}`}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                >
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === String(col.key) && (
                      sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                    )}
                  </span>
                </th>
              ))}
              {actions && <th className="px-4 py-3 text-right font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="text-center py-12 text-gray-400">
                  No records found.
                </td>
              </tr>
            ) : (
              paged.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3 text-gray-700">
                      {getCellValue(row, col)}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3 text-right">{actions(row)}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════
          MOBILE / TABLET CARD VIEW  (below lg)
         ══════════════════════════════════════════════════════ */}
      <div className="lg:hidden space-y-3">
        {paged.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200 text-sm">
            No records found.
          </div>
        ) : (
          paged.map((row) => (
            <div
              key={row.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
            >
              {/* Card Header — first column as title */}
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-gray-900 truncate">
                  {getCellValue(row, titleCol)}
                </span>
                {actions && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {actions(row)}
                  </div>
                )}
              </div>

              {/* Card Body — remaining columns as label: value rows */}
              <div className="divide-y divide-gray-50">
                {bodyColumns.map((col) => (
                  <div key={String(col.key)} className="flex items-start px-4 py-2.5 gap-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-28 flex-shrink-0 pt-0.5">
                      {col.header}
                    </span>
                    <span className="text-sm text-gray-800 flex-1 min-w-0 break-words">
                      {getCellValue(row, col)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-gray-500 flex-wrap gap-2">
        <span>
          Showing {Math.min((page - 1) * pageSize + 1, sorted.length)}–{Math.min(page * pageSize, sorted.length)} of {sorted.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={15} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => Math.abs(p - page) <= 2)
            .map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-7 h-7 rounded-lg text-xs font-medium ${p === page ? "bg-blue-600 text-white" : "hover:bg-gray-100"}`}
              >
                {p}
              </button>
            ))}
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
