# Quick Start: AWS S3 Integration

## 🚀 5-Minute Setup

### Step 1: Add Credentials to .env

```bash
cd /root/directory-iraniu-uk/server
nano .env
```

Add these lines (replace with your actual values):

```bash
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
AWS_S3_BUCKET=my-bucket-name
```

Save and exit (Ctrl+X, Y, Enter)

### Step 2: Test Connection

```bash
node scripts/test-s3-connection.js
```

✅ Should see "All tests passed successfully!"

### Step 3: Restart Server

```bash
pm2 restart iraniu-server
```

### Step 4: Verify It's Working

Visit your admin panel → Exchange Banners → Upload an image

The image URL should now be:
```
https://my-bucket-name.s3.us-east-1.amazonaws.com/...
```

## 📋 Before You Start

**You need from AWS:**
1. An S3 bucket (created in AWS Console)
2. IAM user with S3 permissions
3. Access key ID and secret key

**Don't have these yet?** → See `S3_SETUP_GUIDE.md`

## 🔧 Useful Commands

```bash
# Test AWS connection
node scripts/test-s3-connection.js

# Check storage mode (as admin)
curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/storage-status

# Migrate existing files
node scripts/migrate-to-s3.js --dry-run   # Preview
node scripts/migrate-to-s3.js              # Execute

# Restart server
pm2 restart iraniu-server
```

## ✅ Success Checklist

- [ ] AWS credentials in `.env`
- [ ] Test script passes
- [ ] Server restarted
- [ ] New uploads go to S3
- [ ] Old local files still work

## ⚠️ Important

- **Never commit `.env` to git**
- Keep your AWS secret key private
- S3 is optional - works without it too

## 📖 Full Documentation

- **Complete setup guide:** `S3_SETUP_GUIDE.md`
- **Technical details:** `AWS_S3_INTEGRATION.md`
- **Implementation notes:** `IMPLEMENTATION_SUMMARY.md`

---

**That's it!** You're ready to use S3. 🎉
