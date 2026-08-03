import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getEffectiveS3Config, isS3ConfiguredFromSettings } from "./s3Settings.js";

/**
 * S3 Upload utility for Iraniu
 * Handles file uploads to Amazon S3 with proper error handling
 */

/**
 * Get S3 client with configuration from database or environment
 */
async function getS3Client() {
  if (!global.__s3ClientCache) {
    const config = await getEffectiveS3Config();

    const clientConfig = {
      region: config.region || "us-east-1",
    };

    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      };
    }

    global.__s3ClientCache = new S3Client(clientConfig);
  }
  return global.__s3ClientCache;
}

/**
 * Check if S3 is configured (from database or environment)
 */
export async function isS3Enabled() {
  return await isS3ConfiguredFromSettings();
}

/**
 * Upload a file buffer to S3
 * @param {Buffer} buffer - File buffer
 * @param {string} key - S3 object key (path in bucket)
 * @param {string} contentType - MIME type
 * @returns {Promise<{url: string, key: string}>}
 */
export async function uploadToS3(buffer, key, contentType) {
  if (!(await isS3Enabled())) {
    throw new Error("S3 not configured. Set AWS credentials in Admin Panel or .env file");
  }

  const config = await getEffectiveS3Config();
  const bucket = config.bucket;
  const client = await getS3Client();

  try {
    const upload = new Upload({
      client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        // ACL removed - use bucket policy instead
      },
    });

    await upload.done();

    // Construct public URL
    const url = `https://${bucket}.s3.${config.region}.amazonaws.com/${key}`;

    return { url, key };
  } catch (error) {
    console.error("S3 upload error:", error);
    throw new Error(`S3 upload failed: ${error.message}`);
  }
}

/**
 * Delete a file from S3
 * @param {string} key - S3 object key
 */
export async function deleteFromS3(key) {
  if (!(await isS3Enabled())) {
    return; // Silently skip if S3 not enabled
  }

  const config = await getEffectiveS3Config();
  const bucket = config.bucket;
  const client = await getS3Client();

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
  } catch (error) {
    console.error("S3 delete error:", error);
    // Don't throw - deletion failures shouldn't break the flow
  }
}

/**
 * Extract S3 key from URL
 * @param {string} url - S3 URL
 * @returns {Promise<string|null>} - S3 key or null if not an S3 URL
 */
export async function extractS3KeyFromUrl(url) {
  if (!url) return null;

  const config = await getEffectiveS3Config();
  const bucket = config.bucket;
  if (!bucket) return null;

  // Match: https://{bucket}.s3.{region}.amazonaws.com/{key}
  const pattern = new RegExp(`https://${bucket}\\.s3\\.[^/]+\\.amazonaws\\.com/(.+)$`);
  const match = url.match(pattern);

  return match ? match[1] : null;
}

/**
 * Generate S3 key for exchange banner
 */
export function generateExchangeBannerKey(originalFilename) {
  const ext = originalFilename.match(/\.(png|jpg|jpeg|webp|gif)$/i)?.[0] || ".jpg";
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `exchange-banners/exchange-banner-${timestamp}-${random}${ext}`;
}

/**
 * Get storage mode (local or s3)
 */
export async function getStorageMode() {
  return (await isS3Enabled()) ? "s3" : "local";
}
