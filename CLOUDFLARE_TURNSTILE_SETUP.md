# Cloudflare Turnstile Captcha Setup

## Overview
Adding Cloudflare Turnstile (privacy-friendly captcha alternative) to Admin and Manager login pages.

## Implementation Steps

### 1. Get Cloudflare Turnstile Credentials
1. Go to https://dash.cloudflare.com/
2. Select your account → Turnstile
3. Create a new site
4. Get:
   - **Site Key** (public, goes in client)
   - **Secret Key** (private, goes in server .env)

### 2. Add to Environment Variables

Edit `server/.env`:
```bash
# Cloudflare Turnstile
TURNSTILE_SECRET_KEY=your-secret-key-here
```

### 3. Client Integration

The Turnstile widget will be added to:
- `/admin/login` (AdminLoginPage)
- `/login` (ManagerLoginPage)

**Site Key:** Replace `YOUR_SITE_KEY` with your actual Turnstile site key

### 4. Server Verification

Server will verify the captcha token before processing login:
- Endpoint: POST to Cloudflare Turnstile API
- Validates token on every login attempt
- Returns error if captcha fails

## Testing

### Development Mode
For testing, use Cloudflare's test keys:
- **Site Key (visible):** `1x00000000000000000000AA`
- **Secret Key (testing):** `1x0000000000000000000000000000000AA`

These always pass verification.

### Production
Use real keys from your Cloudflare dashboard.

## Security Benefits
- ✅ Prevents automated bot attacks
- ✅ Privacy-friendly (no tracking)
- ✅ Faster than reCAPTCHA
- ✅ Better user experience
- ✅ Works without cookies

## Files Modified
1. `client/src/pages/AdminLoginPage.jsx` - Added Turnstile widget
2. `client/src/pages/ManagerLoginPage.jsx` - Added Turnstile widget
3. `server/src/authRoutes.js` - Added server-side verification
4. `server/.env.example` - Added Turnstile config

## Configuration Options

```javascript
// Widget options
{
  sitekey: 'YOUR_SITE_KEY',
  theme: 'light', // or 'dark'
  size: 'normal', // or 'compact'
  language: 'fa', // Persian
}
```

## Support
- Docs: https://developers.cloudflare.com/turnstile/
- Dashboard: https://dash.cloudflare.com/
