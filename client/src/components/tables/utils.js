/** @param {...(string | undefined | false | null)} parts */
export function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

/**
 * @param {Record<string, unknown>} row
 * @param {{ key: string; render?: (row: Record<string, unknown>, rowIndex: number) => import("react").ReactNode }} column
 * @param {number} rowIndex
 * @param {string} emptyCell
 */
export function renderCell(row, column, rowIndex, emptyCell) {
  if (typeof column.render === "function") {
    return column.render(row, rowIndex);
  }
  const v = row[column.key];
  if (v === null || v === undefined || v === "") return emptyCell;
  return v;
}
