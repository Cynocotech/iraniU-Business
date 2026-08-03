# IraniU Directory Deployment Complete ✅

## 🎉 Your site is now live at: https://directory.iraniu.uk ✅

**Status:** Deployed and running successfully!

## What's Been Set Up

### 1. GitHub Deploy Key
- ✅ Deploy key created and added to GitHub
- ✅ Repository cloned to `/root/directory-iraniu-uk`
- **Fingerprint:** `SHA256:cqH+rKPKD/3FpbaldoRkZO2mSc/Fvp3zdfADpBzU0GI`

### 2. PostgreSQL Database
- ✅ Database: `directory_iraniu_uk`
- ✅ User: `directory_user`
- ✅ Password: `26f026561225054737686ac538d41d44`
- ✅ Schema applied with all tables
- **Connection String:**
  ```
  postgresql://directory_user:26f026561225054737686ac538d41d44@localhost:5432/directory_iraniu_uk
  ```

### 3. Application Setup
- ✅ Node.js dependencies installed
- ✅ Client built (React/Vite)
- ✅ Server running on port 3002
- ✅ Systemd service configured: `directory-iraniu-uk.service`
- ✅ Environment variables configured

### 4. Web Server (Caddy)
- ✅ Caddy reverse proxy configured
- ✅ Automatic HTTPS/SSL enabled
- ✅ Domain: `directory.iraniu.uk` → `https://directory.iraniu.uk`

## 🔐 Admin Access

**Super Admin Login:**
- **URL:** https://directory.iraniu.uk/admin/login
- **Email:** `admin@directory.iraniu.uk`
- **Password:** `Change_This_Password_123!`

**⚠️ IMPORTANT: Change your admin password immediately after first login!**

## 📁 File Locations

- **Project Directory:** `/root/directory-iraniu-uk`
- **Environment File:** `/root/directory-iraniu-uk/server/.env`
- **Systemd Service:** `/etc/systemd/system/directory-iraniu-uk.service`
- **Caddy Config:** `/root/n8n-docker-caddy/caddy_config/Caddyfile`
- **Deploy Key (Private):** `/root/.ssh/directory_iraniu_uk_deploy_key`
- **Deploy Key (Public):** `/root/.ssh/directory_iraniu_uk_deploy_key.pub`

## 🔧 Common Commands

### Service Management
```bash
# Check service status
systemctl status directory-iraniu-uk.service

# View logs
journalctl -u directory-iraniu-uk.service -f

# Restart service
systemctl restart directory-iraniu-uk.service

# Stop service
systemctl stop directory-iraniu-uk.service

# Start service
systemctl start directory-iraniu-uk.service
```

### Application Updates
```bash
# Pull latest code from GitHub
cd /root/directory-iraniu-uk
git pull

# Install dependencies (if package.json changed)
npm install --prefix server
npm install --prefix client

# Build client (if client code changed)
npm run build --prefix client

# Restart service
systemctl restart directory-iraniu-uk.service
```

### Database Management
```bash
# Connect to database
PGPASSWORD='26f026561225054737686ac538d41d44' psql -h localhost -U directory_user -d directory_iraniu_uk

# Backup database
pg_dump -h localhost -U directory_user directory_iraniu_uk > backup_$(date +%Y%m%d).sql

# Restore database
PGPASSWORD='26f026561225054737686ac538d41d44' psql -h localhost -U directory_user -d directory_iraniu_uk < backup.sql
```

### Caddy Management
```bash
# Reload Caddy (after config changes)
docker exec caddy caddy reload --config /etc/caddy/Caddyfile

# Check Caddy status
docker ps | grep caddy

# View Caddy logs
docker logs caddy -f
```

## 🔒 Security Notes

1. **Change Admin Password:** Go to admin panel and update your password
2. **Database Password:** Stored in `/root/directory-iraniu-uk/server/.env`
3. **JWT Secret:** Already generated and configured
4. **Deploy Key:** Read-only access to GitHub repository
5. **HTTPS:** Automatically enabled by Caddy with Let's Encrypt

## 📊 Application Features

- Business directory listing
- Business claims and manager dashboard
- QR code generation
- Phone click tracking
- Admin panel for managing listings
- Billing records
- Reservation system
- Call tracking (optional - requires Twilio)
- Telegram notifications (optional)

## ⚙️ Optional Configuration

### Email Notifications (SMTP)
Edit `/root/directory-iraniu-uk/server/.env`:
```env
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-smtp-password
```

### Telegram Notifications
Edit `/root/directory-iraniu-uk/server/.env`:
```env
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
TELEGRAM_DIRECTORY_CHANNEL_ID=@your-channel
```

### Twilio Call Tracking
Edit `/root/directory-iraniu-uk/server/.env`:
```env
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
```

After any `.env` changes, restart the service:
```bash
systemctl restart directory-iraniu-uk.service
```

## 🐛 Troubleshooting

### Site not loading
```bash
# Check if service is running
systemctl status directory-iraniu-uk.service

# Check application logs
journalctl -u directory-iraniu-uk.service -n 50

# Check if port is listening
netstat -tlnp | grep 3002
```

### Caddy issues
```bash
# Check Caddy logs
docker logs caddy

# Restart Caddy
docker restart caddy
```

### Database connection issues
```bash
# Check PostgreSQL is running
systemctl status postgresql

# Test database connection
PGPASSWORD='26f026561225054737686ac538d41d44' psql -h localhost -U directory_user -d directory_iraniu_uk -c "SELECT 1;"
```

## 📝 Next Steps

1. ✅ Access your site at https://directory.iraniu.uk
2. ✅ Login to admin panel at https://directory.iraniu.uk/admin/login
3. ⚠️ Change your admin password
4. 📝 Configure optional integrations (Email, Telegram, Twilio)
5. 📊 Start adding business listings
6. 🎨 Customize your directory

## 🆘 Support

- Check logs: `journalctl -u directory-iraniu-uk.service -f`
- View service status: `systemctl status directory-iraniu-uk.service`
- Database connection issues: Check `/root/directory-iraniu-uk/server/.env`

---

## 🆕 UPDATE: AWS S3 Integration Added! (2026-06-16 19:43 UTC)

### What's New
✅ **S3 File Storage** - Upload files to Amazon S3 instead of local disk
✅ **Admin Panel UI** - Configure S3 via web interface (no SSH needed!)
✅ **Test Button** - Verify S3 connection with one click
✅ **Database Config** - Settings stored in database (overrides .env)
✅ **Complete Docs** - 8 documentation files created

### How to Access
1. Go to: **Admin Panel → امنیت و ۲FA (Security & 2FA)**
2. Scroll down to: **تنظیمات Amazon S3**
3. Enter your AWS credentials
4. Click "ذخیرهٔ تنظیمات S3"
5. Click "تست اتصال S3" to verify

### Documentation
- `README_S3.md` - Master guide
- `S3_SETUP_GUIDE.md` - AWS setup walkthrough
- `S3_ADMIN_PANEL_GUIDE.md` - Admin panel usage
- `QUICK_START_S3.md` - 5-minute setup
- `AWS_S3_INTEGRATION.md` - Technical details

### API Endpoints Added
```http
GET    /api/admin/s3-config         # Get S3 configuration
PATCH  /api/admin/s3-config         # Update S3 settings  
POST   /api/admin/s3-test           # Test S3 connection
```

### Files Updated
- `server/src/s3Upload.js` - NEW
- `server/src/s3Settings.js` - NEW
- `server/src/authRoutes.js` - UPDATED (added S3 endpoints)
- `server/src/index.js` - UPDATED (S3 upload support)
- `client/src/pages/admin/AdminSecurityPage.jsx` - UPDATED (S3 UI)

**Status:** ✅ Deployed and running
**Service:** Restarted at 19:43 UTC with S3 integration

---

**Original Deployment:** 2026-06-16  
**S3 Integration Added:** 2026-06-16 19:43 UTC  
**Node.js Version:** v20.20.1  
**PostgreSQL Version:** 16.13  
**Server:** Ubuntu 24.04
