/**
 * Legacy SQLite-upload support has been removed during the migration to PostgreSQL.
 * These stubs remain so any lingering imports keep working; SQLite file uploads
 * are no longer accepted by the API.
 */

export function isSqliteMagicBuffer(_buf) {
  return false;
}

export function validateIraniuSqliteFile(_filePath) {
  return { ok: false, error: "sqlite_upload_disabled" };
}

export function applyPendingSqliteImportIfAny(_dbPath) {
  return { applied: false };
}
