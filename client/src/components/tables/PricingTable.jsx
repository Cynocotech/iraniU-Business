import DataTable from "./DataTable.jsx";
import { cn } from "./utils.js";

/**
 * Matrix-style pricing / plan comparison. Highlights one column (e.g. recommended tier).
 *
 * @param {{
 *   columns: { key: string; header: string; headerClassName?: string; className?: string; cellClassName?: string | ((row: Record<string, unknown>, index: number) => string); render?: (row: Record<string, unknown>, rowIndex: number) => import("react").ReactNode }[];
 *   data: Record<string, unknown>[];
 *   className?: string;
 *   tableClassName?: string;
 *   caption?: import("react").ReactNode;
 *   featuredColumnKey?: string;
 *   striped?: boolean;
 *   hover?: boolean;
 *   showHeader?: boolean;
 *   emptyCell?: string;
 *   getRowKey?: (row: Record<string, unknown>, index: number) => string | number;
 *   rowHeaderKey?: string;
 *   variant?: "default" | "clean";
 * }} props
 */
export default function PricingTable({
  columns,
  data,
  className = "",
  tableClassName = "",
  caption,
  featuredColumnKey,
  striped = true,
  hover = true,
  showHeader = true,
  emptyCell = "—",
  getRowKey,
  rowHeaderKey,
  variant = "default",
}) {
  const clean = variant === "clean";

  const enhanced = columns.map((col) => ({
    ...col,
    headerClassName: cn(
      col.headerClassName,
      featuredColumnKey &&
        col.key === featuredColumnKey &&
        (clean
          ? "tw-bg-slate-100 tw-text-slate-800"
          : "tw-bg-gradient-to-br tw-from-violet-600 tw-to-violet-700 tw-text-white tw-shadow-inner")
    ),
    className: cn(
      col.className,
      featuredColumnKey &&
        col.key === featuredColumnKey &&
        (clean
          ? "tw-border-x tw-border-slate-200 tw-bg-slate-50/90 tw-font-medium tw-text-slate-900"
          : "tw-border-x tw-border-violet-300/80 tw-bg-violet-50/95 tw-font-medium tw-text-violet-950")
    ),
  }));

  return (
    <div
      className={cn(
        clean
          ? "tw-overflow-hidden tw-rounded-md tw-border tw-border-slate-200 tw-bg-white tw-shadow-none"
          : "tw-overflow-hidden tw-rounded-2xl tw-border-2 tw-border-violet-300/70 tw-bg-white tw-shadow-md tw-shadow-violet-200/40",
        className
      )}
    >
      {caption ? (
        <div
          className={cn(
            "tw-border-b tw-px-3 tw-py-2 tw-text-center tw-text-sm tw-font-medium",
            clean
              ? "tw-border-slate-100 tw-bg-slate-50/90 tw-text-slate-700"
              : "tw-border-violet-100 tw-bg-gradient-to-r tw-from-violet-50 tw-to-slate-50 tw-px-4 tw-py-3 tw-font-semibold tw-text-violet-950"
          )}
        >
          {caption}
        </div>
      ) : null}
      <DataTable
        columns={enhanced}
        data={data}
        striped={striped}
        hover={hover}
        showHeader={showHeader}
        emptyCell={emptyCell}
        getRowKey={getRowKey}
        rowHeaderKey={rowHeaderKey}
        variant={variant}
        tableClassName={cn(
          "[&_th]:tw-text-center [&_td]:tw-align-middle [&_tbody_td]:tw-text-center",
          rowHeaderKey && "[&_tbody_th]:tw-text-start [&_tbody_th]:tw-font-semibold",
          tableClassName
        )}
        className="tw-rounded-none tw-border-0 tw-shadow-none"
      />
    </div>
  );
}
