function authHeaders() {
  try {
    const t = sessionStorage.getItem("iraniu_jwt");
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

const fetchOpts = {
  credentials: "include",
};

export async function apiGet(path) {
  const r = await fetch(path, {
    ...fetchOpts,
    headers: { ...authHeaders() },
  });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

export async function apiPost(path, body) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body ?? {}),
    ...fetchOpts,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data.hint || data.error || String(r.status));
  }
  return data;
}

export async function apiPatchJson(path, body) {
  const r = await fetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body ?? {}),
    ...fetchOpts,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.hint || data.error || String(r.status));
  return data;
}

export async function apiPatchUrl(path, body) {
  const r = await fetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body ?? {}),
    ...fetchOpts,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || String(r.status));
  return data;
}

export async function apiDelete(path) {
  const r = await fetch(path, {
    method: "DELETE",
    ...fetchOpts,
    headers: { ...authHeaders() },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.hint || data.error || String(r.status));
  return data;
}

/**
 * به‌روزرسانی آگهی — POST به مسیر تخت /api/businesses/update با { slug, ... } تا ۴۰۴ پروکسی/مسیرهای تودرتو رخ ندهد.
 */
export async function apiPatch(path, body) {
  const m = path.match(/^\/api\/businesses\/([^/?#]+)\/?$/);
  const slug = m ? decodeURIComponent(m[1]) : null;
  const payload = slug ? { slug, ...body } : body;
  const url = "/api/businesses/update";
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
    ...fetchOpts,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.hint ? `${data.error}: ${data.hint}` : data.error || String(r.status));
  return data;
}
