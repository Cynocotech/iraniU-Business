import { cn, renderCell } from "./utils.js";
import DataTable from "./DataTable.jsx";

/**
 * Desktop: DataTable (zebra + hover). Mobile: stacked cards — key/value pairs when `rowHeaderKey` + 2 columns, else one field per column.
 *
 * @param {{
 *   columns: { key: string; header?: string; headerClassName?: string; className?: string; cellClassName?: string | ((row: Record<string, unknown>, index: number) => string); render?: (row: Record<string, unknown>, rowIndex: number) => import("react").ReactNode }[];
 *   data: Record<string, unknown>[];
 *   className?: string;
 *   tableClassName?: string;
 *   theadClassName?: string;
 *   showHeader?: boolean;
 *   emptyCell?: string;
 *   getRowKey?: (row: Record<string, unknown>, index: number) => string | number;
 *   striped?: boolean;
 *   hover?: boolean;
 *   cardClassName?: string;
 *   rowHeaderKey?: string;
 *   variant?: "default" | "clean";
 * }} props
 */
export default function ResponsiveTable({
  columns,
  data,
  className = "",
  tableClassName = "",
  theadClassName = "",
  showHeader = true,
  emptyCell = "—",
  getRowKey,
  striped = true,
  hover = true,
  cardClassName = "",
  rowHeaderKey,
  variant = "default",
}) {
  const clean = variant === "clean";
  const keyValueMobile =
    Boolean(rowHeaderKey) &&
    columns.length === 2 &&
    columns.some((c) => c.key === rowHeaderKey);

  const cardArticle = (extra) =>
    cn(
      clean
        ? "tw-overflow-hidden tw-rounded-md tw-border tw-border-slate-200 tw-bg-white tw-px-3 tw-py-2.5 tw-shadow-none sm:tw-px-3.5"
        : "tw-overflow-hidden tw-rounded-xl tw-border tw-border-violet-200/70 tw-bg-gradient-to-b tw-from-white tw-to-violet-50/30 tw-px-3 tw-py-3 tw-shadow-sm sm:tw-px-4",
      !clean && striped && extra && "tw-from-violet-50/50 tw-to-slate-50/40",
      clean && striped && extra && "tw-bg-slate-50/60",
      cardClassName
    );

  const dtClass = clean
    ? "tw-mb-1 tw-text-xs tw-font-semibold tw-text-slate-500"
    : "tw-mb-1.5 tw-text-[0.72rem] tw-font-bold tw-uppercase tw-tracking-wide tw-text-violet-900/75";

  return (
    <>
      <div className={cn("tw-hidden md:tw-block", className)}>
        <DataTable
          columns={columns}
          data={data}
          tableClassName={tableClassName}
          theadClassName={theadClassName}
          showHeader={showHeader}
          emptyCell={emptyCell}
          getRowKey={getRowKey}
          striped={striped}
          hover={hover}
          rowHeaderKey={rowHeaderKey}
          variant={variant}
        />
      </div>

      <div className={cn(clean ? "tw-space-y-2 md:tw-hidden" : "tw-space-y-3 md:tw-hidden", className)}>
        {data.map((row, ri) => {
          const rk = getRowKey ? getRowKey(row, ri) : row.id ?? ri;
          const [c0, c1] = columns;

          if (keyValueMobile && c0 && c1) {
            const ddExtra =
              typeof c1.cellClassName === "function" ? c1.cellClassName(row, ri) : c1.cellClassName;
            return (
              <article key={rk} className={cardArticle(striped && ri % 2 === 1)}>
                <dl className="tw-m-0">
                  <dt className={dtClass}>{renderCell(row, c0, ri, emptyCell)}</dt>
                  <dd
                    className={cn(
                      "tw-m-0 tw-text-sm tw-font-normal tw-leading-relaxed tw-text-slate-800",
                      ddExtra
                    )}
                  >
                    {renderCell(row, c1, ri, emptyCell)}
                  </dd>
                </dl>
              </article>
            );
          }

          return (
            <article
              key={rk}
              className={cn(
                clean
                  ? "tw-overflow-hidden tw-rounded-md tw-border tw-border-slate-200 tw-bg-white tw-shadow-none"
                  : "tw-overflow-hidden tw-rounded-xl tw-border tw-border-violet-200/70 tw-bg-gradient-to-b tw-from-white tw-to-violet-50/30 tw-shadow-sm",
                !clean && striped && ri % 2 === 1 && "tw-from-violet-50/50 tw-to-slate-50/40",
                clean && striped && ri % 2 === 1 && "tw-bg-slate-50/60",
                cardClassName
              )}
            >
              <dl className={cn(clean ? "tw-divide-y tw-divide-slate-100" : "tw-divide-y tw-divide-violet-100/90")}>
                {columns.map((col) => {
                  const ddExtra =
                    typeof col.cellClassName === "function" ? col.cellClassName(row, ri) : col.cellClassName;
                  return (
                    <div key={col.key} className="tw-px-3 tw-py-2.5 sm:tw-px-4">
                      <dt
                        className={cn(
                          "tw-mb-1",
                          clean
                            ? "tw-text-xs tw-font-semibold tw-text-slate-500"
                            : "tw-text-[0.72rem] tw-font-bold tw-uppercase tw-tracking-wide tw-text-violet-900/65"
                        )}
                      >
                        {col.header || col.key}
                      </dt>
                      <dd className={cn("tw-text-sm tw-leading-relaxed tw-text-slate-800", ddExtra)}>
                        {renderCell(row, col, ri, emptyCell)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </article>
          );
        })}
      </div>
    </>
  );
}
