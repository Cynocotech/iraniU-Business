# AWS S3 Admin Panel Integration - Complete Guide

## ✨ What's New

You can now configure AWS S3 directly from the **Admin Panel** without editing `.env` files! 

### New Features:
- ✅ **Admin UI for S3 Configuration** - Set AWS credentials through the web interface
- ✅ **Test Button** - Verify S3 connection with one click
- ✅ **Live Status** - See if S3 is active or local storage is being used
- ✅ **Database Storage** - Settings stored in database (overrides .env)
- ✅ **Masked Secrets** - Secret keys are hidden for security

## 🎯 How to Use

### Option 1: Configure via Admin Panel (Recommended)

1. **Log in as Super Admin**
   ```
   Go to: Admin Panel → امنیت و ۲FA (Security & 2FA)
   ```

2. **Scroll to "تنظیمات Amazon S3" Section**
   You'll see the S3 configuration form at the bottom

3. **Fill in Your AWS Credentials:**
   - **AWS Access Key ID**: Your IAM access key (e.g., `AKIAIOSFODNN7EXAMPLE`)
   - **AWS Secret Access Key**: Your secret key (hidden with ••••)
   - **AWS Region**: Select your region (e.g., `us-east-1`)
   - **S3 Bucket Name**: Your bucket name (e.g., `iraniu-uploads-prod`)

4. **Click "ذخیرهٔ تنظیمات S3" (Save S3 Settings)**

5. **Test the Connection**
   - Click "تست اتصال S3" (Test S3 Connection)
   - If successful: ✅ You'll see "تست موفق! اتصال به S3 کار می‌کند"
   - If failed: ❌ Error message will show what's wrong

### Option 2: Configure via .env File (Traditional)

Edit `/root/directory-iraniu-uk/server/.env`:

```bash
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
```

**Note:** Admin panel settings override .env settings!

## 📊 Status Indicator

The admin panel shows:

### When S3 is Active:
```
وضعیت فعلی: ✅ S3 فعال است
منبع تنظیمات: دیتابیس (پنل ادمین)
✅ S3 پیکربندی شده است. تمام آپلودهای جدید به S3 می‌روند.
```

### When Using Local Storage:
```
وضعیت فعلی: 📂 فضای محلی
```

## 🔧 API Endpoints (For Developers)

### Get S3 Configuration
```http
GET /api/admin/s3-config
Authorization: Bearer <super-admin-token>

Response:
{
  "access_key_id": "AKIA...",
  "secret_access_key_set": true,
  "secret_access_key_masked": "••••WXYZ",
  "region": "us-east-1",
  "bucket": "my-bucket",
  "access_key_id_source": "database",
  "secret_access_key_source": "database",
  "region_source": "database",
  "bucket_source": "database",
  "is_configured": true,
  "storage_mode": "s3"
}
```

### Update S3 Configuration
```http
PATCH /api/admin/s3-config
Authorization: Bearer <super-admin-token>
Content-Type: application/json

{
  "access_key_id": "AKIAIOSFODNN7EXAMPLE",
  "secret_access_key": "wJalrXUtnFEMI/K7MDENG/...",
  "region": "us-east-1",
  "bucket": "my-bucket-name"
}
```

### Test S3 Connection
```http
POST /api/admin/s3-test
Authorization: Bearer <super-admin-token>

Success Response:
{
  "ok": true,
  "message": "تست موفق بود! فایل آزمایشی آپلود و حذف شد.",
  "test_url": "https://my-bucket.s3.us-east-1.amazonaws.com/test/..."
}

Error Response:
{
  "ok": false,
  "error": "s3_test_failed",
  "hint": "دسترسی رد شد. مجوزهای IAM را بررسی کنید"
}
```

### Clear Configuration (Revert to .env)
```http
POST /api/admin/s3-config/clear
Authorization: Bearer <super-admin-token>
```

## 🔐 Security Features

### 1. Secret Key Masking
- Secret keys are never displayed in full
- Shown as `••••WXYZ` (last 4 characters)
- Only updated when you provide a new value

### 2. Database Storage
- Credentials stored in `app_meta` table
- Encrypted connection to database
- No plaintext in logs

### 3. Source Tracking
- Shows whether settings come from:
  - `database` - Set via admin panel
  - `env` - Set in .env file
  - `none` - Not configured

### 4. Admin-Only Access
- Requires super admin authentication
- All actions logged in system logs

## 🎨 Frontend Changes

**File Updated:** `client/src/pages/admin/AdminSecurityPage.jsx`

### New State Variables:
```javascript
const [s3Config, setS3Config] = useState(null);
const [s3Form, setS3Form] = useState({
  access_key_id: "",
  secret_access_key: "",
  region: "us-east-1",
  bucket: "",
});
```

### New Functions:
- `loadS3Config()` - Load current config from API
- `saveS3Config()` - Save configuration
- Test button handler - Inline onClick test

## 🗄️ Backend Changes

### New Files:
1. **`server/src/s3Settings.js`** - S3 configuration management
   - `getEffectiveS3Config()` - Get config (DB overrides .env)
   - `getS3ConfigForAdmin()` - Get config for UI (masked secrets)
   - `applyS3ConfigPatch()` - Update config in database
   - `clearS3ConfigFromDb()` - Remove DB config, revert to .env

2. **Updated `server/src/s3Upload.js`** - Now reads from database
   - Uses `getEffectiveS3Config()` instead of process.env
   - Caches S3 client in `global.__s3ClientCache`
   - Clears cache when config changes

3. **Updated `server/src/authRoutes.js`** - New API endpoints
   - `GET /api/admin/s3-config`
   - `PATCH /api/admin/s3-config`
   - `POST /api/admin/s3-test`
   - `POST /api/admin/s3-config/clear`

### Database Table Used:
```sql
app_meta (
  key VARCHAR PRIMARY KEY,
  value TEXT
)
```

Keys used:
- `aws_s3_access_key_id`
- `aws_s3_secret_access_key`
- `aws_s3_region`
- `aws_s3_bucket`

## 🧪 Testing Checklist

After configuration, verify:

- [ ] Navigate to Admin → امنیت و ۲FA
- [ ] See "تنظیمات Amazon S3" section at bottom
- [ ] Fill in AWS credentials
- [ ] Click "ذخیرهٔ تنظیمات S3"
- [ ] See success message
- [ ] Status shows "✅ S3 فعال است"
- [ ] Click "تست اتصال S3"
- [ ] See "✅ تست موفق!"
- [ ] Upload a new exchange banner
- [ ] Verify image URL is S3 URL (https://bucket.s3.region.amazonaws.com/...)
- [ ] Delete banner, verify it's removed from S3

## 🔄 Priority System

Configuration is applied in this order:

1. **Database** (Admin Panel) - Highest priority
2. **.env file** - Fallback if not in database
3. **Default** - Region defaults to `us-east-1`

Example:
```
Access Key in DB: AKIA123
Access Key in .env: AKIA999

→ System uses: AKIA123 (DB wins)
```

## 🛠️ Troubleshooting

### "Access Denied" on Test
**Problem:** IAM permissions insufficient

**Solution:**
1. Go to AWS IAM Console
2. Find your user
3. Attach policy with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`
4. Test again

### "Bucket not found"
**Problem:** Bucket doesn't exist or wrong region

**Solution:**
1. Go to AWS S3 Console
2. Verify bucket name (exact match, no typos)
3. Check bucket region matches the region you selected
4. Update and test again

### Secret key not updating
**Problem:** Masked value submitted

**Solution:**
- Clear the password field completely
- Enter the full new secret key
- Save

### Settings not taking effect
**Problem:** Cache not cleared

**Solution:**
1. Restart server: `pm2 restart iraniu-server`
2. Or wait ~30 seconds for automatic cache refresh

## 📝 Migration from .env to Admin Panel

**Option A: Keep .env (works fine)**
- No action needed
- System will continue using .env values

**Option B: Migrate to Admin Panel**
1. Copy values from `.env` file
2. Paste into admin panel form
3. Save
4. Test
5. Optionally remove AWS lines from `.env`

**Note:** Admin panel values override .env, so you can keep both!

## 🎯 Benefits of Admin Panel Configuration

✅ **No SSH access needed** - Non-technical admins can configure S3
✅ **No server restart required** - Changes apply immediately  
✅ **Visual feedback** - Test button shows instant results
✅ **Audit trail** - Changes logged in system_logs table
✅ **Multiple admins** - Anyone with super admin access can manage
✅ **Masked secrets** - More secure than .env file
✅ **Easy to update** - Change credentials without file editing

## 🚀 Production Deployment

1. **Push code to production:**
   ```bash
   git pull origin main
   cd server && npm install
   cd ../client && npm install && npm run build
   ```

2. **Restart server:**
   ```bash
   pm2 restart iraniu-server
   ```

3. **Configure via admin panel:**
   - Log in as super admin
   - Go to Security settings
   - Add S3 credentials
   - Test connection
   - Done!

## 📚 Related Documentation

- **AWS Setup Guide:** `S3_SETUP_GUIDE.md`
- **Integration Overview:** `AWS_S3_INTEGRATION.md`
- **Quick Start:** `QUICK_START_S3.md`
- **Implementation Details:** `IMPLEMENTATION_SUMMARY.md`

---

✨ **You can now manage S3 configuration through the admin panel!**
