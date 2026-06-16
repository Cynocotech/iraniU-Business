import { dbRun } from "./db.js";

function safeJson(value) {
  if (!value || typeof value !== "object") return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/**
 * Insert a system log row. Errors are swallowed (logging must never break a request).
 * Returns a promise; callers may await it or fire-and-forget.
 */
export async function writeSystemLog({
  level = "info",
  actorType = "system",
  actorId = null,
  action = "event",
  targetType = null,
  targetId = null,
  message = "",
  meta = null,
}) {
  try {
    await dbRun(
      `INSERT INTO system_logs
        (level, actor_type, actor_id, action, target_type, target_id, message, meta_json)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        String(level || "info"),
        String(actorType || "system"),
        actorId == null ? null : String(actorId),
        String(action || "event"),
        targetType == null ? null : String(targetType),
        targetId == null ? null : String(targetId),
        String(message || ""),
        safeJson(meta),
      ]
    );
  } catch (e) {
    console.error("system log insert failed", e?.message || e);
  }
}

export function actorFromAuth(auth) {
  if (!auth) return { actorType: "system", actorId: null };
  if (auth.typ === "adm") return { actorType: "superadmin", actorId: auth.sub };
  if (auth.typ === "mgr") return { actorType: "manager", actorId: auth.sub };
  if (auth.typ === "mgrx") return { actorType: "exchange_manager", actorId: auth.sub };
  return { actorType: "system", actorId: null };
}
