#!/usr/bin/env node

/**
 * Test S3 connection and configuration
 * Usage: node scripts/test-s3-connection.js
 */

import "../src/env.js";
import { S3Client, ListBucketsCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const config = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  bucket: process.env.AWS_S3_BUCKET,
};

function checkConfig() {
  console.log("🔍 Checking S3 Configuration...\n");

  const missing = [];
  if (!config.accessKeyId) missing.push("AWS_ACCESS_KEY_ID");
  if (!config.secretAccessKey) missing.push("AWS_SECRET_ACCESS_KEY");
  if (!config.region) missing.push("AWS_REGION");
  if (!config.bucket) missing.push("AWS_S3_BUCKET");

  if (missing.length > 0) {
    console.error("❌ Missing environment variables:");
    missing.forEach((v) => console.error(`   - ${v}`));
    console.error("\nPlease set these in your .env file");
    return false;
  }

  console.log("✅ All required environment variables are set:");
  console.log(`   AWS_REGION: ${config.region}`);
  console.log(`   AWS_S3_BUCKET: ${config.bucket}`);
  console.log(`   AWS_ACCESS_KEY_ID: ${config.accessKeyId.substring(0, 8)}...`);
  console.log(`   AWS_SECRET_ACCESS_KEY: ${config.secretAccessKey.substring(0, 4)}...\n`);

  return true;
}

async function testConnection() {
  console.log("🔌 Testing AWS connection...\n");

  const client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  try {
    const command = new ListBucketsCommand({});
    const response = await client.send(command);

    console.log("✅ Successfully connected to AWS!");
    console.log(`   Found ${response.Buckets.length} bucket(s)\n`);

    const bucketExists = response.Buckets.some((b) => b.Name === config.bucket);
    if (bucketExists) {
      console.log(`✅ Target bucket "${config.bucket}" exists\n`);
    } else {
      console.log(`⚠️  Target bucket "${config.bucket}" not found`);
      console.log("   Available buckets:");
      response.Buckets.forEach((b) => console.log(`   - ${b.Name}`));
      console.log();
    }

    return bucketExists;
  } catch (error) {
    console.error("❌ Connection failed:");
    console.error(`   ${error.message}\n`);
    if (error.Code === "InvalidAccessKeyId") {
      console.error("   → Check your AWS_ACCESS_KEY_ID");
    } else if (error.Code === "SignatureDoesNotMatch") {
      console.error("   → Check your AWS_SECRET_ACCESS_KEY");
    }
    return false;
  }
}

async function testUploadAndDelete() {
  console.log("📤 Testing upload permissions...\n");

  const client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  const testKey = `test/connection-test-${Date.now()}.txt`;
  const testContent = "This is a test file from Iraniu S3 setup";

  try {
    // Test upload
    const putCommand = new PutObjectCommand({
      Bucket: config.bucket,
      Key: testKey,
      Body: Buffer.from(testContent),
      ContentType: "text/plain",
      ACL: "public-read",
    });

    await client.send(putCommand);
    console.log(`✅ Successfully uploaded test file: ${testKey}`);

    const testUrl = `https://${config.bucket}.s3.${config.region}.amazonaws.com/${testKey}`;
    console.log(`   URL: ${testUrl}\n`);

    // Test delete
    console.log("🗑️  Testing delete permissions...\n");
    const deleteCommand = new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: testKey,
    });

    await client.send(deleteCommand);
    console.log(`✅ Successfully deleted test file\n`);

    return true;
  } catch (error) {
    console.error("❌ Upload/Delete test failed:");
    console.error(`   ${error.message}\n`);
    if (error.Code === "AccessDenied") {
      console.error("   → Check IAM user permissions (needs s3:PutObject, s3:DeleteObject)");
    }
    return false;
  }
}

async function main() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║   Iraniu S3 Connection Test Tool      ║");
  console.log("╚════════════════════════════════════════╝\n");

  const configOk = checkConfig();
  if (!configOk) {
    process.exit(1);
  }

  const connectionOk = await testConnection();
  if (!connectionOk) {
    console.log("❌ Connection test failed. Please fix the issues above.\n");
    process.exit(1);
  }

  const uploadOk = await testUploadAndDelete();
  if (!uploadOk) {
    console.log("❌ Upload test failed. Please fix the issues above.\n");
    process.exit(1);
  }

  console.log("╔════════════════════════════════════════╗");
  console.log("║   ✨ All tests passed successfully!   ║");
  console.log("╚════════════════════════════════════════╝\n");
  console.log("Your S3 configuration is working correctly.");
  console.log("You can now use S3 for file uploads in Iraniu.\n");
}

main().catch((err) => {
  console.error("\n💥 Unexpected error:", err);
  process.exit(1);
});
