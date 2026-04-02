/**
 * GET جستجوی لیست — بدون React Router Form (نیاز به data router ندارد).
 */
export function getListingsLocationFromForm(form) {
  const fd = new FormData(form);
  const sp = new URLSearchParams();
  for (const [key, value] of fd.entries()) {
    sp.append(key, String(value));
  }
  const qs = sp.toString();
  return { pathname: "/listings", search: qs ? `?${qs}` : "" };
}
