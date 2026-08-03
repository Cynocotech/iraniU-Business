export function toInputDateTime(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  const t = s.replace(" ", "T");
  const m = t.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  return m ? m[1] : "";
}

export function scheduleLabel(row) {
  const now = new Date();
  const start = row?.start_at ? new Date(String(row.start_at).replace(" ", "T")) : null;
  const end = row?.end_at ? new Date(String(row.end_at).replace(" ", "T")) : null;
  if (start instanceof Date && !Number.isNaN(start.valueOf()) && start > now) return "زمان‌بندی‌شده";
  if (end instanceof Date && !Number.isNaN(end.valueOf()) && end < now) return "پایان‌یافته";
  return "در حال نمایش";
}

export function formatEndDate(value) {
  const s = String(value || "").trim();
  if (!s) return "—";
  const t = s.replace(" ", "T");
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return s;
  return `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}`;
}
