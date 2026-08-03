# Amazon S3 Setup Guide for Iraniu

This guide will help you set up Amazon S3 for storing uploaded files (exchange banners, listing images) instead of using local filesystem storage.

## Prerequisites

1. AWS Account
2. IAM User with S3 permissions
3. S3 Bucket created

## Step 1: Create an S3 Bucket

1. Log in to [AWS Console](https://console.aws.amazon.com/)
2. Navigate to **S3** service
3. Click **Create bucket**
4. Configure:
   - **Bucket name**: Choose a unique name (e.g., `iraniu-uploads-production`)
   - **Region**: Choose your preferred region (e.g., `us-east-1`)
   - **Block Public Access settings**: Uncheck "Block all public access" (we need public read access for images)
   - ⚠️ **Warning**: Acknowledge that objects in this bucket can be public
5. Click **Create bucket**

## Step 2: Configure Bucket Policy for Public Read Access

1. Go to your bucket → **Permissions** tab
2. Scroll to **Bucket policy** and click **Edit**
3. Paste the following policy (replace `YOUR-BUCKET-NAME` with your actual bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    }
  ]
}
```

4. Click **Save changes**

## Step 3: Create IAM User with S3 Access

1. Navigate to **IAM** service
2. Click **Users** → **Create user**
3. Set user name (e.g., `iraniu-s3-uploader`)
4. Click **Next**
5. Select **Attach policies directly**
6. Search for and select `AmazonS3FullAccess` (or create a custom policy for more security)
7. Click **Next** → **Create user**

### (Optional) Custom IAM Policy for Better Security

Instead of `AmazonS3FullAccess`, create a custom policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::YOUR-BUCKET-NAME",
        "arn:aws:s3:::YOUR-BUCKET-NAME/*"
      ]
    }
  ]
}
```

## Step 4: Create Access Keys

1. Go to **IAM** → **Users** → Select your user
2. Click **Security credentials** tab
3. Scroll to **Access keys**
4. Click **Create access key**
5. Select **Application running on an AWS compute service** (or **Other** if not on EC2)
6. Click **Next** → **Create access key**
7. **⚠️ IMPORTANT**: Copy both:
   - Access key ID
   - Secret access key
   - You won't be able to see the secret key again!

## Step 5: Configure Your Server

1. Navigate to your server directory:
```bash
cd /root/directory-iraniu-uk/server
```

2. Edit your `.env` file:
```bash
nano .env
```

3. Add the following configuration:
```bash
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
AWS_REGION=us-east-1
AWS_S3_BUCKET=iraniu-uploads-production
```

4. Save and close the file (Ctrl+X, then Y, then Enter)

## Step 6: Restart Your Server

```bash
# If using PM2
pm2 restart iraniu-server

# If running directly
npm run start
```

## Step 7: Verify S3 Integration

1. Check storage status (as super admin):
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:3001/api/storage-status
```

Expected response:
```json
{
  "mode": "s3",
  "bucket": "iraniu-uploads-production",
  "region": "us-east-1"
}
```

## Step 8: Migrate Existing Files (Optional)

If you have existing files in local storage, migrate them to S3:

```bash
# Dry run (preview what will happen)
node scripts/migrate-to-s3.js --dry-run

# Actually migrate
node scripts/migrate-to-s3.js
```

## Testing

1. Log in to your admin panel
2. Go to **Exchange Banners** section
3. Try uploading a new banner image
4. The image URL should now be an S3 URL like:
   ```
   https://iraniu-uploads-production.s3.us-east-1.amazonaws.com/exchange-banners/...
   ```

## Troubleshooting

### Error: "S3 not configured"
- Double-check all 4 environment variables are set in `.env`
- Restart your server after adding credentials

### Error: "Access Denied"
- Verify IAM user has correct permissions
- Check bucket policy allows public read access
- Ensure AWS credentials are correct

### Images not loading
- Check bucket policy is set correctly
- Verify "Block Public Access" is disabled
- Check CORS configuration if serving from different domain

### Need CORS Configuration?

If your frontend is on a different domain, add CORS rules to your S3 bucket:

1. Go to bucket → **Permissions** tab
2. Scroll to **Cross-origin resource sharing (CORS)**
3. Add:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["https://yourdomain.com"],
    "ExposeHeaders": []
  }
]
```

## Security Best Practices

1. ✅ Use IAM user credentials, not root account
2. ✅ Create custom IAM policy with minimal required permissions
3. ✅ Rotate access keys regularly
4. ✅ Never commit `.env` file to git
5. ✅ Use different buckets for development/staging/production
6. ✅ Enable S3 versioning for important data
7. ✅ Set up CloudFront CDN for better performance (optional)

## Cost Estimation

S3 pricing varies by region. Example for `us-east-1`:
- Storage: ~$0.023 per GB/month
- PUT requests: $0.005 per 1,000 requests
- GET requests: $0.0004 per 1,000 requests

For a typical small site:
- 10 GB storage + 10,000 requests/month ≈ $0.30/month

## Support

If you encounter issues:
1. Check CloudWatch logs in AWS Console
2. Review server logs: `pm2 logs iraniu-server`
3. Verify IAM permissions and bucket policy

---

✨ Your Iraniu application is now using Amazon S3 for file storage!
