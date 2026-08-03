#!/usr/bin/env node
import "./server/src/env.js";
import { getEffectiveS3Config, isS3ConfiguredFromSettings } from "./server/src/s3Settings.js";

async function checkStatus() {
  console.log("Checking S3 Configuration...\n");

  const config = await getEffectiveS3Config();
  const isConfigured = await isS3ConfiguredFromSettings();

  console.log("S3 Configuration:");
  console.log("  Access Key:", config.accessKeyId ? `${config.accessKeyId.substring(0, 8)}...` : "NOT SET");
  console.log("  Secret Key:", config.secretAccessKey ? "SET (hidden)" : "NOT SET");
  console.log("  Region:", config.region);
  console.log("  Bucket:", config.bucket || "NOT SET");
  console.log("\nStatus:", isConfigured ? "✅ S3 IS ENABLED" : "❌ S3 NOT CONFIGURED");
  console.log("\nStorage Mode:", isConfigured ? "S3" : "Local Filesystem");

  if (isConfigured) {
    console.log("\n✅ All uploads will go to S3:");
    console.log(`   https://${config.bucket}.s3.${config.region}.amazonaws.com/...`);
  } else {
    console.log("\n❌ Uploads will go to local filesystem:");
    console.log("   /root/directory-iraniu-uk/server/uploads/");
  }
}

checkStatus().catch(console.error);
