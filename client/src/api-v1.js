const TOKEN_KEY = "iraniu_user_jwt";

export function getV1Token() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}
export function setV1Token(t) {
  try { localStorage.setItem(TOKEN_KEY, t); } catch {}
}
export function clearV1Token() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

function authHeaders() {
  const t = getV1Token();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function v1Fetch(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include",
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.hint || data.error || String(r.status));
    err.code = data.error;
    throw err;
  }
  return data;
}

export const v1Get = (path) => v1Fetch("GET", path, undefined);
export const v1Post = (path, body) => v1Fetch("POST", path, body);
export const v1Patch = (path, body) => v1Fetch("PATCH", path, body);
export const v1Delete = (path) => v1Fetch("DELETE", path, undefined);
