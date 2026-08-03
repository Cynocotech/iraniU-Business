/**
 * AWS S3 Configuration stored in app_meta table
 * Allows super admin to configure S3 via UI instead of .env
 */

import { dbGet, dbRun } from "./db.js";

const META_KEYS = {
  ACCESS_KEY_ID: "aws_s3_access_key_id",
  SECRET_ACCESS_KEY: "aws_s3_secret_access_key",
  REGION: "aws_s3_region",
  BUCKET: "aws_s3_bucket",
};

/**
 * Get S3 configuration from database
 */
async function getS3ConfigFromDb() {
  const rows = await Promise.all([
    dbGet(`SELECT value FROM app_meta WHERE key = $1`, [META_KEYS.ACCESS_KEY_ID]),
    dbGet(`SELECT value FROM app_meta WHERE key = $1`, [META_KEYS.SECRET_ACCESS_KEY]),
    dbGet(`SELECT value FROM app_meta WHERE key = $1`, [META_KEYS.REGION]),
    dbGet(`SELECT value FROM app_meta WHERE key = $1`, [META_KEYS.BUCKET]),
  ]);

  return {
    accessKeyId: rows[0]?.value || null,
    secretAccessKey: rows[1]?.value || null,
    region: rows[2]?.value || null,
    bucket: rows[3]?.value || null,
  };
}

/**
 * Get effective S3 configuration (DB overrides .env)
 */
export async function getEffectiveS3Config() {
  const dbConfig = await getS3ConfigFromDb();

  return {
    accessKeyId: dbConfig.accessKeyId || process.env.AWS_ACCESS_KEY_ID || null,
    secretAccessKey: dbConfig.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || null,
    region: dbConfig.region || process.env.AWS_REGION || "us-east-1",
    bucket: dbConfig.bucket || process.env.AWS_S3_BUCKET || null,
  };
}

/**
 * Check if S3 is fully configured
 */
export async function isS3ConfiguredFromSettings() {
  const config = await getEffectiveS3Config();
  return !!(config.accessKeyId && config.secretAccessKey && config.region && config.bucket);
}

/**
 * Get S3 configuration for admin UI (masks secret key)
 */
export async function getS3ConfigForAdmin() {
  const dbConfig = await getS3ConfigFromDb();
  const effective = await getEffectiveS3Config();

  const maskSecret = (secret) => {
    if (!secret) return null;
    if (secret.length <= 8) return "••••";
    return `••••${secret.slice(-4)}`;
  };

  return {
    // Current effective values (from DB or .env)
    access_key_id: effective.accessKeyId || "",
    secret_access_key_set: !!effective.secretAccessKey,
    secret_access_key_masked: maskSecret(effective.secretAccessKey),
    region: effective.region || "us-east-1",
    bucket: effective.bucket || "",

    // Sources
    access_key_id_source: dbConfig.accessKeyId ? "database" : process.env.AWS_ACCESS_KEY_ID ? "env" : "none",
    secret_access_key_source: dbConfig.secretAccessKey ? "database" : process.env.AWS_SECRET_ACCESS_KEY ? "env" : "none",
    region_source: dbConfig.region ? "database" : process.env.AWS_REGION ? "env" : "default",
    bucket_source: dbConfig.bucket ? "database" : process.env.AWS_S3_BUCKET ? "env" : "none",

    // Overall status
    is_configured: await isS3ConfiguredFromSettings(),
    storage_mode: (await isS3ConfiguredFromSettings()) ? "s3" : "local",
  };
}

/**
 * Update S3 configuration in database
 */
export async function applyS3ConfigPatch(patch) {
  const updates = [];

  if ("access_key_id" in patch) {
    const value = String(patch.access_key_id || "").trim();
    if (value) {
      updates.push(
        dbRun(
          `INSERT INTO app_meta (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [META_KEYS.ACCESS_KEY_ID, value]
        )
      );
    } else {
      updates.push(dbRun(`DELETE FROM app_meta WHERE key = $1`, [META_KEYS.ACCESS_KEY_ID]));
    }
  }

  if ("secret_access_key" in patch) {
    const value = String(patch.secret_access_key || "").trim();
    if (value && !value.startsWith("••")) {
      // Only update if not masked
      updates.push(
        dbRun(
          `INSERT INTO app_meta (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [META_KEYS.SECRET_ACCESS_KEY, value]
        )
      );
    }
  }

  if ("region" in patch) {
    const value = String(patch.region || "").trim();
    if (value) {
      updates.push(
        dbRun(
          `INSERT INTO app_meta (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [META_KEYS.REGION, value]
        )
      );
    } else {
      updates.push(dbRun(`DELETE FROM app_meta WHERE key = $1`, [META_KEYS.REGION]));
    }
  }

  if ("bucket" in patch) {
    const value = String(patch.bucket || "").trim();
    if (value) {
      updates.push(
        dbRun(
          `INSERT INTO app_meta (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [META_KEYS.BUCKET, value]
        )
      );
    } else {
      updates.push(dbRun(`DELETE FROM app_meta WHERE key = $1`, [META_KEYS.BUCKET]));
    }
  }

  await Promise.all(updates);

  // Reload S3 client with new settings (force reinit)
  if (global.__s3ClientCache) {
    delete global.__s3ClientCache;
  }

  return getS3ConfigForAdmin();
}

/**
 * Clear all S3 settings from database (revert to .env)
 */
export async function clearS3ConfigFromDb() {
  await Promise.all([
    dbRun(`DELETE FROM app_meta WHERE key = $1`, [META_KEYS.ACCESS_KEY_ID]),
    dbRun(`DELETE FROM app_meta WHERE key = $1`, [META_KEYS.SECRET_ACCESS_KEY]),
    dbRun(`DELETE FROM app_meta WHERE key = $1`, [META_KEYS.REGION]),
    dbRun(`DELETE FROM app_meta WHERE key = $1`, [META_KEYS.BUCKET]),
  ]);

  if (global.__s3ClientCache) {
    delete global.__s3ClientCache;
  }

  return getS3ConfigForAdmin();
}
