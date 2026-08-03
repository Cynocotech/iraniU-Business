# IraniU Directory - API Documentation

## 🔑 API Authentication

### X-Api-Key Header

Your API Key for the Chatbot API:
```
2fdda709e63c6a8549267f9afcd1ec355f35821d9060fcefa1958d58a36af26d
```

## 📡 Chatbot API Endpoints

**Base URL:** `https://directory.iraniu.uk/chatbot/v1`

### Authentication Methods

You can authenticate using either:

**Option 1: X-Api-Key header**
```bash
curl https://directory.iraniu.uk/chatbot/v1/categories \
  -H "X-Api-Key: 2fdda709e63c6a8549267f9afcd1ec355f35821d9060fcefa1958d58a36af26d"
```

**Option 2: Authorization Bearer token**
```bash
curl https://directory.iraniu.uk/chatbot/v1/categories \
  -H "Authorization: Bearer 2fdda709e63c6a8549267f9afcd1ec355f35821d9060fcefa1958d58a36af26d"
```

---

## 📋 Available Endpoints

### 1. Get Categories

**Endpoint:** `GET /chatbot/v1/categories`

**Description:** Returns all active business categories with business count.

**Example:**
```bash
curl https://directory.iraniu.uk/chatbot/v1/categories \
  -H "X-Api-Key: 2fdda709e63c6a8549267f9afcd1ec355f35821d9060fcefa1958d58a36af26d"
```

**Response:**
```json
{
  "categories": [
    {
      "id": 1,
      "name": "رستوران",
      "business_count": 45
    },
    {
      "id": 2,
      "name": "صرافی",
      "business_count": 12
    }
  ]
}
```

---

### 2. Search Businesses

**Endpoint:** `GET /chatbot/v1/businesses`

**Query Parameters:**
- `category` (optional) - Filter by category name (e.g., "رستوران")
- `city` (optional) - Filter by city (e.g., "North London")
- `q` (optional) - Search in business name or description
- `limit` (optional) - Results per page (default: 10, max: 50)
- `offset` (optional) - Pagination offset (default: 0)

**Examples:**

**Search by category:**
```bash
curl "https://directory.iraniu.uk/chatbot/v1/businesses?category=رستوران&limit=5" \
  -H "X-Api-Key: 2fdda709e63c6a8549267f9afcd1ec355f35821d9060fcefa1958d58a36af26d"
```

**Search by city:**
```bash
curl "https://directory.iraniu.uk/chatbot/v1/businesses?city=London" \
  -H "X-Api-Key: 2fdda709e63c6a8549267f9afcd1ec355f35821d9060fcefa1958d58a36af26d"
```

**Free-text search:**
```bash
curl "https://directory.iraniu.uk/chatbot/v1/businesses?q=pizza" \
  -H "X-Api-Key: 2fdda709e63c6a8549267f9afcd1ec355f35821d9060fcefa1958d58a36af26d"
```

**Response:**
```json
{
  "total": 45,
  "limit": 10,
  "offset": 0,
  "results": [
    {
      "slug": "restaurant-name",
      "name": "نام رستوران",
      "category": "رستوران",
      "city": "North London",
      "address": "123 Main Street",
      "phone": "+44 20 1234 5678",
      "description": "توضیحات رستوران",
      "listing_title": "بهترین رستوران ایرانی",
      "cover_image": "https://directory.iraniu.uk/uploads/cover.jpg",
      "google_maps_url": "https://maps.google.com/...",
      "coordinates": {
        "lat": 51.5074,
        "lng": -0.1278
      },
      "profile_url": "https://directory.iraniu.uk/business?slug=restaurant-name",
      "social_links": [
        {
          "platform": "instagram",
          "url": "https://instagram.com/...",
          "icon": "fab fa-instagram"
        }
      ],
      "opening_hours": [
        {
          "day": "Saturday",
          "hours": "10:00 - 22:00"
        }
      ]
    }
  ]
}
```

---

### 3. Get Business Details

**Endpoint:** `GET /chatbot/v1/businesses/:slug`

**Description:** Get full details for a specific business including gallery, promo, and all information.

**Example:**
```bash
curl https://directory.iraniu.uk/chatbot/v1/businesses/restaurant-name \
  -H "X-Api-Key: 2fdda709e63c6a8549267f9afcd1ec355f35821d9060fcefa1958d58a36af26d"
```

**Response:**
```json
{
  "slug": "restaurant-name",
  "name": "نام رستوران",
  "category": "رستوران",
  "city": "North London",
  "address": "123 Main Street",
  "phone": "+44 20 1234 5678",
  "description": "توضیحات کامل رستوران",
  "listing_title": "بهترین رستوران ایرانی",
  "cover_image": "https://directory.iraniu.uk/uploads/cover.jpg",
  "google_maps_url": "https://maps.google.com/...",
  "coordinates": {
    "lat": 51.5074,
    "lng": -0.1278
  },
  "profile_url": "https://directory.iraniu.uk/business?slug=restaurant-name",
  "social_links": [...],
  "opening_hours": [...],
  "gallery": [
    "https://directory.iraniu.uk/uploads/image1.jpg",
    "https://directory.iraniu.uk/uploads/image2.jpg"
  ],
  "subtitle": "رستوران سنتی ایرانی",
  "price_range": "££",
  "rating": 4.5,
  "reservation_link": "https://...",
  "promo": {
    "title": "تخفیف ویژه",
    "description": "20% تخفیف برای اولین سفارش"
  }
}
```

---

## 🔐 Admin API (JWT Authentication)

For admin operations, you need to login first to get a JWT token.

### Login as Super Admin

```bash
curl -X POST https://directory.iraniu.uk/api/auth/login/admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@directory.iraniu.uk",
    "password": "Change_This_Password_123!"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "id": 1,
    "email": "admin@directory.iraniu.uk",
    "name": "Super Admin"
  }
}
```

### Use JWT Token for Admin API

```bash
curl https://directory.iraniu.uk/api/admin/businesses \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🛠️ Configuration

### Change API Key

To change the API key:

1. Edit `/root/directory-iraniu-uk/server/.env`
2. Update `CHATBOT_API_KEY=your_new_key_here`
3. Restart service: `systemctl restart directory-iraniu-uk.service`

### Generate New API Key

```bash
openssl rand -hex 32
```

---

## 📊 API Features

✅ **Read-only access** - Chatbot API only provides read access to public data  
✅ **No rate limiting** - Currently no rate limits (consider adding if needed)  
✅ **Approved businesses only** - Only returns approved and active businesses  
✅ **Full-text search** - Search across business names and descriptions  
✅ **Pagination** - Handle large result sets with limit/offset  
✅ **Category filtering** - Filter by business category  
✅ **City filtering** - Filter by city/location  

---

## 🔒 Security Notes

- API key is stored in environment variables
- Only publicly approved businesses are accessible via API
- Admin operations require JWT authentication with 7-day expiration
- All API requests must use HTTPS
- Keep your API key secure and don't commit it to version control

---

## 📝 Example: Python Integration

```python
import requests

API_KEY = "2fdda709e63c6a8549267f9afcd1ec355f35821d9060fcefa1958d58a36af26d"
BASE_URL = "https://directory.iraniu.uk/chatbot/v1"

headers = {
    "X-Api-Key": API_KEY
}

# Get categories
response = requests.get(f"{BASE_URL}/categories", headers=headers)
categories = response.json()

# Search businesses
params = {
    "category": "رستوران",
    "city": "London",
    "limit": 10
}
response = requests.get(f"{BASE_URL}/businesses", headers=headers, params=params)
businesses = response.json()

# Get specific business
response = requests.get(f"{BASE_URL}/businesses/restaurant-slug", headers=headers)
business = response.json()
```

---

## 📞 Support

For API issues or questions:
- Check logs: `journalctl -u directory-iraniu-uk.service -f`
- Documentation: `/root/directory-iraniu-uk/API_DOCUMENTATION.md`
- Admin panel: https://directory.iraniu.uk/admin/login
