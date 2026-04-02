import BasicTable from "./BasicTable.jsx";
import { cn } from "./utils.js";

/**
 * @param {React.ComponentProps<typeof BasicTable> & {
 *   striped?: boolean;
 *   hover?: boolean;
 * }} props
 */
export default function DataTable({
  striped = true,
  hover = true,
  tableClassName = "",
  showHeader = true,
  variant = "default",
  ...rest
}) {
  const clean = variant === "clean";

  return (
    <BasicTable
      {...rest}
      variant={variant}
      showHeader={showHeader}
      tableClassName={cn(
        striped &&
          (clean
            ? "[&_tbody_tr:nth-child(even)]:tw-bg-slate-50/50"
            : "[&_tbody_tr:nth-child(even)]:tw-bg-violet-50/40"),
        hover &&
          (clean
            ? "[&_tbody_tr]:tw-transition-colors [&_tbody_tr:hover]:tw-bg-slate-100/80"
            : "[&_tbody_tr]:tw-transition-colors [&_tbody_tr:hover]:tw-bg-violet-100/50"),
        tableClassName
      )}
    />
  );
}
