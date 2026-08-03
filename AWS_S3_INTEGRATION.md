# AWS S3 Integration for Iraniu

## Overview

Your Iraniu application now supports **Amazon S3** for file storage! This integration allows you to store uploaded files (exchange banners, listing images) on AWS S3 instead of the local filesystem.

### Benefits
- ✅ Scalable storage (no local disk space limits)
- ✅ Better performance with CDN integration
- ✅ Automatic backups and durability (99.999999999% durability)
- ✅ Works across multiple servers (load balancing)
- ✅ Easy migration from local storage

## Quick Start

### 1. Set up AWS credentials

Edit your `.env` file:

```bash
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
```

### 2. Test the connection

```bash
node scripts/test-s3-connection.js
```

### 3. Restart your server

```bash
pm2 restart iraniu-server
# or
npm run start
```

### 4. Migrate existing files (optional)

```bash
# Preview migration
node scripts/migrate-to-s3.js --dry-run

# Execute migration
node scripts/migrate-to-s3.js
```

## Features

### Automatic Mode Switching

The application automatically detects if S3 is configured:
- **S3 enabled**: All new uploads go to S3
- **S3 disabled**: Falls back to local filesystem storage

### Supported Operations

- ✅ Upload new files to S3
- ✅ Replace existing files
- ✅ Delete files from S3
- ✅ Migrate existing local files to S3
- ✅ Public read access for images

### Storage Status API

Super admins can check the current storage mode:

```bash
GET /api/storage-status
Authorization: Bearer <admin-token>

Response:
{
  "mode": "s3",
  "bucket": "iraniu-uploads-production",
  "region": "us-east-1"
}
```

## Files Modified

1. **server/src/s3Upload.js** (NEW)
   - S3 client initialization
   - Upload/delete functions
   - Storage mode detection

2. **server/src/index.js** (UPDATED)
   - Exchange banner endpoints now support S3
   - Automatic fallback to local storage
   - Clean up old files on replacement/deletion

3. **server/.env.example** (UPDATED)
   - Added AWS configuration variables

4. **server/package.json** (UPDATED)
   - Added AWS SDK dependencies

## Scripts

### Test S3 Connection
```bash
node scripts/test-s3-connection.js
```
Tests your AWS credentials, bucket access, and upload/delete permissions.

### Migrate Files to S3
```bash
node scripts/migrate-to-s3.js [--dry-run]
```
Migrates existing local files to S3. Use `--dry-run` to preview changes.

## AWS Setup Required

Before using S3, you need to:

1. ✅ Create an AWS account
2. ✅ Create an S3 bucket
3. ✅ Configure bucket policy for public read access
4. ✅ Create IAM user with S3 permissions
5. ✅ Generate access keys

**See `S3_SETUP_GUIDE.md` for detailed step-by-step instructions.**

## Security Considerations

### DO:
- ✅ Store credentials in `.env` file (never commit to git)
- ✅ Use IAM user credentials (not root account)
- ✅ Create custom IAM policy with minimal permissions
- ✅ Rotate access keys regularly
- ✅ Use different buckets for dev/staging/production

### DON'T:
- ❌ Don't commit `.env` file to git
- ❌ Don't share access keys publicly
- ❌ Don't use root account credentials
- ❌ Don't give excessive S3 permissions

## How It Works

### Upload Flow

```
1. User uploads file
2. Server receives file buffer (multer)
3. Check if S3 is enabled:
   
   If S3 enabled:
   - Generate S3 key (path in bucket)
   - Upload to S3 with public-read ACL
   - Get S3 URL (https://bucket.s3.region.amazonaws.com/key)
   - Save URL to database
   
   If S3 disabled:
   - Save to local filesystem
   - Generate local URL (/uploads/...)
   - Save URL to database
```

### Delete Flow

```
1. User deletes banner
2. Check if image URL is S3 URL:
   
   If S3 URL:
   - Extract S3 key from URL
   - Delete from S3
   - Delete database record
   
   If local URL:
   - Delete local file
   - Delete database record
```

## Backwards Compatibility

The integration is **100% backwards compatible**:
- Existing local files continue to work
- No S3 credentials = automatic fallback to local storage
- No code changes needed in frontend
- URLs work transparently (S3 or local)

## Cost Estimation

Example for us-east-1 region:

**Storage**
- $0.023 per GB/month

**Requests**
- PUT/COPY/POST: $0.005 per 1,000 requests
- GET/SELECT: $0.0004 per 1,000 requests

**Example monthly cost:**
- 10 GB storage: $0.23
- 10,000 uploads: $0.05
- 100,000 downloads: $0.04
- **Total: ~$0.32/month**

## Troubleshooting

### "S3 not configured" error
- Check all 4 AWS_* variables are set in `.env`
- Restart server after adding credentials

### "Access Denied" error
- Verify IAM user has correct permissions
- Check bucket policy allows public read
- Ensure credentials are correct

### Images not loading
- Verify bucket has public read policy
- Check "Block Public Access" is disabled
- Test S3 URL directly in browser

### Need help?
Run the connection test:
```bash
node scripts/test-s3-connection.js
```

## Advanced Configuration

### CloudFront CDN (Optional)

For better performance, set up CloudFront:

1. Create CloudFront distribution pointing to your S3 bucket
2. Update image URLs to use CloudFront domain
3. Reduces latency and bandwidth costs

### S3 Versioning (Optional)

Enable versioning for file recovery:

```bash
aws s3api put-bucket-versioning \
  --bucket your-bucket-name \
  --versioning-configuration Status=Enabled
```

### Lifecycle Policies (Optional)

Automatically delete old test files:

1. Go to S3 bucket → Management → Lifecycle rules
2. Create rule to expire objects in `test/` folder after 1 day

## Support

For detailed AWS setup instructions, see: **S3_SETUP_GUIDE.md**

For testing your configuration, run: `node scripts/test-s3-connection.js`

---

**Ready to use S3?** Follow the setup guide and start uploading! 🚀
