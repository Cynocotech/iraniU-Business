# 🔒 Security: Rate Limiting & Brute Force Protection

**Status:** ✅ ACTIVE AND CONFIGURED  
**Last Updated:** June 16, 2026

---

## 🛡️ Multi-Layer Protection

Your login system now has **3 layers of security**:

### Layer 1: Cloudflare Turnstile Captcha
- **Blocks:** Automated bots and scripts
- **Works on:** Every login attempt
- **User Impact:** Minimal (1 click)

### Layer 2: Rate Limiting (Brute Force Protection)
- **Blocks:** Repeated failed login attempts
- **Works on:** Per IP address
- **User Impact:** None for legitimate users

### Layer 3: 2FA (Two-Factor Authentication)
- **Blocks:** Compromised passwords
- **Works on:** Admin accounts with 2FA enabled
- **User Impact:** 6-digit code required

---

## ⚙️ Current Configuration

### Rate Limiting Settings

| Setting | Value | Description |
|---------|-------|-------------|
| **Max Failures** | 5 attempts | Login fails allowed before block |
| **Time Window** | 15 minutes | Period for counting failures |
| **Block Duration** | 30 minutes | How long IP stays blocked |

**Example Scenario:**
1. User enters wrong password 5 times in 15 minutes
2. IP gets blocked for 30 minutes
3. After 30 minutes, IP is automatically unblocked
4. Counter resets to 0

---

## 🔧 How It Works

### Flow Diagram

```
User Login Attempt
       ↓
[1] Cloudflare Captcha Check
       ↓ (Pass)
[2] IP Rate Limit Check
       ↓ (Not Blocked)
[3] Check Credentials
       ↓
   Valid? → SUCCESS ✅
       ↓ (Invalid)
   Record Failure
       ↓
   Count ≥ 5? → BLOCK IP 🚫
       ↓ (No)
   Allow Retry
```

### Database Tracking

Table: `identity.login_ip_throttle`

| Field | Type | Purpose |
|-------|------|---------|
| `ip` | TEXT | Client IP address |
| `fail_count` | INTEGER | Number of failures in window |
| `window_start_ms` | BIGINT | When counting window started |
| `blocked_until_ms` | BIGINT | Block expiration timestamp |

---

## 📊 Attack Prevention

### What Gets Blocked

✅ **Dictionary Attacks** - Trying common passwords  
✅ **Brute Force** - Systematically trying all combinations  
✅ **Credential Stuffing** - Using leaked password lists  
✅ **Bot Attacks** - Automated login attempts  
✅ **Distributed Attacks** - Multiple IPs (each IP tracked separately)

### What Doesn't Get Blocked

✅ **Legitimate Users** - Occasional typos are fine (< 5 in 15 min)  
✅ **Password Reset** - Rate limit only applies to login attempts  
✅ **Different IPs** - Blocks are per-IP, not per-account  
✅ **Public WiFi** - Users can switch networks to retry

---

## 🧪 Testing Rate Limiting

### Test Failed Login Protection

1. **Open incognito window** (to avoid cookies)

2. **Visit login page:**
   ```
   http://localhost:3001/admin/login
   ```

3. **Try wrong password 5 times:**
   - Email: `test@example.com`
   - Password: `wrong123` (× 5 times)
   - Complete captcha each time

4. **On 6th attempt:**
   ```json
   {
     "error": "too_many_attempts",
     "hint": "به‌دلیل تلاش‌های ناموفق متعدد، این IP موقتاً مسدود است.",
     "retry_after_sec": 1800
   }
   ```

5. **Wait 30 minutes** or **clear database:**
   ```sql
   DELETE FROM identity.login_ip_throttle WHERE ip = 'your.ip.address';
   ```

---

## 🔐 Security Best Practices

### Recommended Settings

#### Production Environment
```bash
# Stricter limits for production
AUTH_BRUTE_MAX_FAILS=5        # 5 attempts
AUTH_BRUTE_WINDOW_MS=900000   # 15 minutes
AUTH_BRUTE_BLOCK_MS=1800000   # 30 minutes
```

#### Development Environment
```bash
# More lenient for testing
AUTH_BRUTE_MAX_FAILS=10       # 10 attempts
AUTH_BRUTE_WINDOW_MS=300000   # 5 minutes
AUTH_BRUTE_BLOCK_MS=600000    # 10 minutes
```

#### High-Security Environment
```bash
# Maximum protection
AUTH_BRUTE_MAX_FAILS=3        # 3 attempts
AUTH_BRUTE_WINDOW_MS=1800000  # 30 minutes
AUTH_BRUTE_BLOCK_MS=3600000   # 60 minutes
```

---

## 📈 Monitoring & Logging

### Server Logs

Blocked IPs are logged to console:

```bash
[auth] brute-force block ip=192.168.1.100 until 2026-06-16T12:30:00.000Z (failures=5)
```

### Database Queries

**Check currently blocked IPs:**
```sql
SELECT ip, fail_count, 
       to_timestamp(blocked_until_ms/1000) as blocked_until
FROM identity.login_ip_throttle
WHERE blocked_until_ms > EXTRACT(EPOCH FROM NOW()) * 1000
ORDER BY blocked_until_ms DESC;
```

**Count total failed attempts today:**
```sql
SELECT COUNT(*) as failed_attempts
FROM identity.login_ip_throttle
WHERE window_start_ms > EXTRACT(EPOCH FROM NOW() - INTERVAL '1 day') * 1000;
```

**Top attacking IPs:**
```sql
SELECT ip, fail_count, 
       to_timestamp(window_start_ms/1000) as first_attempt
FROM identity.login_ip_throttle
WHERE fail_count >= 3
ORDER BY fail_count DESC
LIMIT 10;
```

---

## 🚨 Handling False Positives

### Legitimate User Blocked

**Scenario:** User forgets password, gets blocked

**Solution Options:**

1. **Wait for auto-unblock** (30 minutes)

2. **Manual unblock via database:**
   ```sql
   DELETE FROM identity.login_ip_throttle 
   WHERE ip = 'user.ip.address';
   ```

3. **Use password reset** (not rate limited)

4. **Try from different network** (mobile data, VPN)

### Shared IP Issues

**Scenario:** Office/School - Multiple users share one IP

**Solutions:**

1. **Increase MAX_FAILS:**
   ```bash
   AUTH_BRUTE_MAX_FAILS=20  # For shared networks
   ```

2. **Track by user instead of IP:**
   (Requires code modification - not currently implemented)

3. **Whitelist trusted IPs:**
   (Requires code modification - not currently implemented)

---

## 🔧 Configuration Guide

### Environment Variables

Edit `server/.env`:

```bash
# Basic Configuration
AUTH_BRUTE_MAX_FAILS=5        # Number of attempts
AUTH_BRUTE_WINDOW_MS=900000   # Time window (ms)
AUTH_BRUTE_BLOCK_MS=1800000   # Block duration (ms)

# Advanced: Trust proxy headers (if behind nginx/cloudflare)
TRUST_PROXY=1

# Cloudflare Turnstile
TURNSTILE_SECRET_KEY=your-secret-key-here
```

### Time Conversions

**Milliseconds to Human-Readable:**

| Milliseconds | Time |
|--------------|------|
| 60000 | 1 minute |
| 300000 | 5 minutes |
| 600000 | 10 minutes |
| 900000 | 15 minutes |
| 1800000 | 30 minutes |
| 3600000 | 1 hour |
| 86400000 | 24 hours |

**Calculate custom values:**
```javascript
// 20 minutes in milliseconds
20 * 60 * 1000 = 1200000

// 2 hours in milliseconds
2 * 60 * 60 * 1000 = 7200000
```

---

## 🛠️ Advanced Features

### Disable Rate Limiting (Not Recommended)

Set very high limits:

```bash
AUTH_BRUTE_MAX_FAILS=999999
```

**Warning:** This removes protection against brute force attacks!

### Reset All Blocks

Clear all rate limit data:

```sql
TRUNCATE TABLE identity.login_ip_throttle;
```

### Export Attack Log

Generate CSV of all blocked IPs:

```sql
COPY (
  SELECT ip, fail_count, 
         to_timestamp(window_start_ms/1000) as started,
         to_timestamp(blocked_until_ms/1000) as blocked_until
  FROM identity.login_ip_throttle
  WHERE fail_count >= 5
  ORDER BY fail_count DESC
) TO '/tmp/blocked_ips.csv' WITH CSV HEADER;
```

---

## 📊 Statistics & Analytics

### Recommended Monitoring

**Daily:**
- Number of blocked IPs
- Total failed login attempts
- Average failures per IP

**Weekly:**
- Trending attack patterns
- Most attacked accounts
- Geographic distribution (if available)

**Monthly:**
- False positive rate
- Block duration effectiveness
- Attack source analysis

---

## 🎯 Success Metrics

### Current Protection Status

✅ **Captcha:** Active on all logins  
✅ **Rate Limiting:** 5 attempts / 15 min  
✅ **Block Duration:** 30 minutes  
✅ **Auto-Recovery:** Automatic after block expires  
✅ **Database Tracking:** All attempts logged  
✅ **2FA Available:** For admin accounts  

### Expected Impact

**Before Protection:**
- ⚠️ Unlimited login attempts
- ⚠️ Vulnerable to brute force
- ⚠️ No bot protection

**After Protection:**
- ✅ Max 5 attempts per 15 min
- ✅ Bots blocked by captcha
- ✅ Distributed attacks slowed
- ✅ Account takeover harder

---

## 📚 Additional Resources

**Files:**
- Implementation: `server/src/bruteForce.js`
- Auth Routes: `server/src/authRoutes.js`
- Turnstile: `server/src/turnstileVerify.js`
- Config: `server/.env`

**Documentation:**
- Cloudflare Turnstile: `CLOUDFLARE_CAPTCHA_DEPLOYED.md`
- Database Schema: `server/src/db.js`

**External:**
- OWASP Authentication: https://owasp.org/www-project-authentication/
- Rate Limiting Best Practices: https://owasp.org/www-project-api-security/

---

## ✅ Deployment Checklist

- [x] Rate limiting enabled
- [x] Configuration set in `.env`
- [x] Database table exists
- [x] Cloudflare captcha active
- [x] Server logs working
- [x] Tested with 5+ failures
- [x] Block duration verified
- [x] Auto-unblock confirmed
- [x] Error messages Persian
- [x] Documentation complete

---

**Security Level:** 🔒🔒🔒 HIGH  
**Status:** PRODUCTION READY  
**Implemented by:** Claude Sonnet 4.5  
**Project:** Iraniu UK Business Directory Platform
