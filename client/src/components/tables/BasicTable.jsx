import { cn, renderCell } from "./utils.js";

/**
 * @typedef {{ key: string; header: string; headerClassName?: string; className?: string; cellClassName?: string | ((row: Record<string, unknown>, index: number) => string); render?: (row: Record<string, unknown>, rowIndex: number) => import("react").ReactNode }} TableColumn
 */

/** @param {"default" | "clean"} variant */
function tableShellClass(variant) {
  if (variant === "clean") {
    return "tw-overflow-x-auto tw-rounded-md tw-border tw-border-slate-200 tw-bg-white tw-shadow-none";
  }
  return "tw-overflow-x-auto tw-rounded-lg tw-border tw-border-violet-200/60 tw-bg-white/90 tw-shadow-sm";
}

/**
 * @param {{
 *   columns: TableColumn[];
 *   data: Record<string, unknown>[];
 *   className?: string;
 *   tableClassName?: string;
 *   theadClassName?: string;
 *   showHeader?: boolean;
 *   emptyCell?: string;
 *   getRowKey?: (row: Record<string, unknown>, index: number) => string | number;
 *   rowHeaderKey?: string;
 *   variant?: "default" | "clean";
 * }} props
 */
export default function BasicTable({
  columns,
  data,
  className = "",
  tableClassName = "",
  theadClassName = "",
  showHeader = true,
  emptyCell = "—",
  getRowKey,
  rowHeaderKey,
  variant = "default",
}) {
  const clean = variant === "clean";

  return (
    <div className={cn(tableShellClass(variant), className)}>
      <table
        className={cn(
          "tw-min-w-full tw-border-separate tw-border-spacing-0 tw-text-start tw-text-sm tw-text-slate-800",
          tableClassName
        )}
      >
        {showHeader ? (
          <thead
            className={cn(
              clean
                ? "tw-border-b tw-border-slate-200 tw-bg-slate-50/95"
                : "tw-border-b tw-border-violet-200/50 tw-bg-gradient-to-br tw-from-violet-50/90 tw-to-slate-50/80",
              theadClassName
            )}
          >
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    clean
                      ? "tw-px-3 tw-py-2 tw-text-xs tw-font-semibold tw-text-slate-600 md:tw-text-sm"
                      : "tw-px-3 tw-py-2.5 tw-text-xs tw-font-bold tw-uppercase tw-tracking-wide tw-text-violet-900/75 md:tw-text-sm md:tw-normal-case md:tw-tracking-normal",
                    col.headerClassName
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody
          className={cn(
            clean && "[&_tr:last-child_th]:tw-border-b-0 [&_tr:last-child_td]:tw-border-b-0"
          )}
        >
          {data.map((row, ri) => {
            const rk = getRowKey ? getRowKey(row, ri) : row.id ?? ri;
            return (
              <tr key={rk} className={typeof row._rowClassName === "string" ? row._rowClassName : undefined}>
                {columns.map((col) => {
                  const cellCn =
                    typeof col.cellClassName === "function" ? col.cellClassName(row, ri) : col.cellClassName;
                  const isRowHeader = rowHeaderKey && col.key === rowHeaderKey;
                  const Cell = isRowHeader ? "th" : "td";
                  return (
                    <Cell
                      key={col.key}
                      {...(isRowHeader ? { scope: "row" } : {})}
                      className={cn(
                        clean
                          ? "tw-border-b tw-border-slate-100 tw-px-3 tw-py-2 tw-align-top tw-text-[0.9375rem] tw-leading-relaxed"
                          : "tw-border-b tw-border-violet-100/80 tw-px-3 tw-py-2.5 tw-align-top tw-text-[0.92rem] tw-leading-relaxed last:tw-border-b-0",
                        isRowHeader &&
                          (clean
                            ? "tw-w-[38%] tw-max-w-[13rem] tw-bg-slate-50/90 tw-font-medium tw-text-slate-600 md:tw-w-[34%]"
                            : "tw-w-[38%] tw-font-semibold tw-text-violet-900/90 tw-bg-violet-50/30 md:tw-w-[32%]"),
                        !isRowHeader && clean && "tw-text-slate-800",
                        col.className,
                        cellCn
                      )}
                    >
                      {renderCell(row, col, ri, emptyCell)}
                    </Cell>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
