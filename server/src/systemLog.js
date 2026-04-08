import { db } from "./db.js";

function safeJson(value) {
  if (!value || typeof value !== "object") return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export function writeSystemLog({
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
    db.prepare(
      `INSERT INTO system_logs
        (level, actor_type, actor_id, action, target_type, target_id, message, meta_json)
       VALUES
        (@level, @actor_type, @actor_id, @action, @target_type, @target_id, @message, @meta_json)`
    ).run({
      level: String(level || "info"),
      actor_type: String(actorType || "system"),
      actor_id: actorId == null ? null : String(actorId),
      action: String(action || "event"),
      target_type: targetType == null ? null : String(targetType),
      target_id: targetId == null ? null : String(targetId),
      message: String(message || ""),
      meta_json: safeJson(meta),
    });
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
