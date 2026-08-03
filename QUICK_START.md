# IraniU Directory - Quick Start Guide

## 🌐 Your Site is LIVE!

**URL:** https://directory.iraniu.uk ✅

## 🔐 Login Credentials

### Super Admin Panel
- **URL:** https://directory.iraniu.uk/admin/login
- **Email:** `admin@directory.iraniu.uk`
- **Password:** `Change_This_Password_123!`

⚠️ **CHANGE YOUR PASSWORD IMMEDIATELY!**

## 📊 What's Working

✅ PostgreSQL database configured and running  
✅ Node.js application deployed  
✅ Automatic HTTPS/SSL via Caddy  
✅ Systemd service running (auto-starts on boot)  
✅ GitHub deploy key configured  

## 🚀 Quick Commands

### View Application Logs
```bash
journalctl -u directory-iraniu-uk.service -f
```

### Restart Application
```bash
systemctl restart directory-iraniu-uk.service
```

### Update from GitHub
```bash
cd /root/directory-iraniu-uk
git pull
npm run build --prefix client
systemctl restart directory-iraniu-uk.service
```

### Database Connection
```bash
PGPASSWORD='26f026561225054737686ac538d41d44' psql -h localhost -U directory_user -d directory_iraniu_uk
```

## 🔑 API Access

### X-Api-Key for Chatbot API
```
2fdda709e63c6a8549267f9afcd1ec355f35821d9060fcefa1958d58a36af26d
```

### Test API
```bash
curl https://directory.iraniu.uk/chatbot/v1/categories \
  -H "X-Api-Key: 2fdda709e63c6a8549267f9afcd1ec355f35821d9060fcefa1958d58a36af26d"
```

See `API_DOCUMENTATION.md` for complete API reference.

## 📁 Important Files

- **Project:** `/root/directory-iraniu-uk`
- **Environment:** `/root/directory-iraniu-uk/server/.env`
- **Service:** `/etc/systemd/system/directory-iraniu-uk.service`
- **Caddy Config:** `/root/n8n-docker-caddy/caddy_config/Caddyfile`

## 🔧 Firewall Rules Added

Port 3002 is now accessible from Docker networks:
- `172.18.0.0/16` (Caddy network)
- `10.0.0.0/24` (docker0 network)

## 📖 Full Documentation

See `DEPLOYMENT_COMPLETE.md` for complete setup details and troubleshooting.

## ✨ Next Steps

1. Login to admin panel
2. Change your password
3. Start adding business listings
4. Configure optional integrations (Email, Telegram, Twilio)

---

**Deployed:** 2026-06-16  
**Domain:** directory.iraniu.uk  
**Status:** ✅ Running
