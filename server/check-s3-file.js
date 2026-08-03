import "./src/env.js";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getEffectiveS3Config } from "./src/s3Settings.js";

async function listFiles() {
  const config = await getEffectiveS3Config();
  
  const client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  console.log(`\nChecking bucket: ${config.bucket}\n`);

  try {
    const command = new ListObjectsV2Command({
      Bucket: config.bucket,
      MaxKeys: 50,
    });

    const response = await client.send(command);

    if (!response.Contents || response.Contents.length === 0) {
      console.log("❌ Bucket is EMPTY - No files found!");
      return;
    }

    console.log(`✅ Found ${response.Contents.length} file(s):\n`);
    
    response.Contents.forEach((item, i) => {
      const size = (item.Size / 1024).toFixed(2);
      console.log(`${i + 1}. ${item.Key}`);
      console.log(`   Size: ${size} KB`);
      console.log(`   Last Modified: ${item.LastModified}`);
      console.log();
    });

  } catch (error) {
    console.error("❌ Error listing files:", error.message);
  }
}

listFiles().catch(console.error);
