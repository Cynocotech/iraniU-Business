import { db } from "./db.js";
import { parseAuthHeader } from "./authUtil.js";

export function requireSuperAdmin(req, res, next) {
  const p = parseAuthHeader(req);
  if (!p || p.typ !== "adm") {
    return res.status(401).json({ error: "unauthorized", hint: "ورود سوپرادمین لازم است" });
  }
  const a = db.prepare(`SELECT totp_setup_required, totp_enabled FROM super_admins WHERE id = ?`).get(p.sub);
  if (a && Number(a.totp_setup_required) === 1 && !a.totp_enabled) {
    return res.status(403).json({
      error: "totp_setup_required",
      hint: "ابتدا ورود دو مرحله‌ای را در امنیت و ۲FA فعال کنید",
    });
  }
  req.auth = p;
  next();
}

export function requireManager(req, res, next) {
  const p = parseAuthHeader(req);
  if (!p || p.typ !== "mgr") {
    return res.status(401).json({ error: "unauthorized", hint: "ورود مدیر لازم است" });
  }
  req.auth = p;
  next();
}

/** هر دو نقش */
export function requireManagerOrSuperAdmin(req, res, next) {
  const p = parseAuthHeader(req);
  if (!p || (p.typ !== "mgr" && p.typ !== "adm")) {
    return res.status(401).json({ error: "unauthorized" });
  }
  req.auth = p;
  next();
}
