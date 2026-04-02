import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

export function isSqliteMagicBuffer(buf) {
  if (!buf || buf.length < 16) return false;
  return buf.toString("utf8", 0, 15) === "SQLite format 3\u0000";
}

/** باز کردن فقط خواندنی و وجود جدول businesses */
export function validateIraniuSqliteFile(filePath) {
  if (!fs.existsSync(filePath)) return { ok: false, error: "missing" };
  const head = Buffer.alloc(16);
  const fd = fs.openSync(filePath, "r");
  try {
    fs.readSync(fd, head, 0, 16, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (!isSqliteMagicBuffer(head)) return { ok: false, error: "not_sqlite" };
  let db;
  try {
    db = new Database(filePath, { readonly: true, fileMustExist: true });
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='businesses'`)
      .get();
    if (!row?.name) throw new Error("missing_businesses_table");
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  } finally {
    try {
      db?.close();
    } catch {
      /* ignore */
    }
  }
  return { ok: true };
}

/**
 * اگر فایل iraniu.db.uploaded وجود داشته باشد، قبل از باز کردن دیتابیس اصلی اعمال می‌شود.
 * نسخهٔ قبلی iraniu.db به iraniu.db.bak.<timestamp> تغییر نام می‌یابد.
 */
export function applyPendingSqliteImportIfAny(dbPath) {
  const dir = path.dirname(dbPath);
  const pending = path.join(dir, "iraniu.db.uploaded");
  if (!fs.existsSync(pending)) return { applied: false };

  const v = validateIraniuSqliteFile(pending);
  if (!v.ok) {
    console.error("[db] invalid pending SQLite file, removing:", v.error);
    try {
      fs.unlinkSync(pending);
    } catch {
      /* ignore */
    }
    return { applied: false, error: v.error };
  }

  const wal = `${dbPath}-wal`;
  const shm = `${dbPath}-shm`;

  try {
    if (fs.existsSync(dbPath)) {
      const bak = path.join(dir, `iraniu.db.bak.${Date.now()}`);
      fs.renameSync(dbPath, bak);
    }
    try {
      if (fs.existsSync(wal)) fs.unlinkSync(wal);
    } catch {
      /* ignore */
    }
    try {
      if (fs.existsSync(shm)) fs.unlinkSync(shm);
    } catch {
      /* ignore */
    }
    fs.renameSync(pending, dbPath);
    console.log("[db] Applied pending SQLite upload → iraniu.db");
    return { applied: true };
  } catch (e) {
    console.error("[db] Failed to apply pending SQLite import:", e);
    return { applied: false, error: String(e.message || e) };
  }
}
