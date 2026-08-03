# Admin Panel - S3 Settings Visual Guide

## 📍 Where to Find It

**Navigation Path:**
```
Admin Login → Admin Dashboard → امنیت و ۲FA (Security & 2FA)
```

Scroll down to the bottom of the page to see the **"تنظیمات Amazon S3"** section.

## 🎨 What You'll See

### Section Header
```
╔══════════════════════════════════════════════╗
║   تنظیمات Amazon S3                          ║
╚══════════════════════════════════════════════╝
```

### Description (in Persian)
```
برای ذخیره‌سازی فایل‌های آپلود شده (تصاویر بنر صرافی، تصاویر آگهی) 
روی Amazon S3 به جای فضای دیسک سرور.
اگر خالی بگذارید، سیستم از فضای محلی سرور استفاده می‌کند.
```

### Status Box (When S3 is Active)
```
╔════════════════════════════════════════════╗
║ وضعیت فعلی: ✅ S3 فعال است               ║
║ منبع تنظیمات: دیتابیس (پنل ادمین)         ║
╚════════════════════════════════════════════╝
```

### Status Box (When Using Local Storage)
```
╔════════════════════════════════════════════╗
║ وضعیت فعلی: 📂 فضای محلی                  ║
╚════════════════════════════════════════════╝
```

### Form Fields

#### 1. AWS Access Key ID
```
┌─────────────────────────────────────────────┐
│ AWS Access Key ID                           │
├─────────────────────────────────────────────┤
│ AKIAIOSFODNN7EXAMPLE                        │ ← Text input (LTR)
└─────────────────────────────────────────────┘
```

#### 2. AWS Secret Access Key
```
┌─────────────────────────────────────────────┐
│ AWS Secret Access Key                       │
├─────────────────────────────────────────────┤
│ ••••••••••••••••••••••                      │ ← Password input
└─────────────────────────────────────────────┘
کلید فعلی: ••••EKEY (برای تغییر، کلید جدید وارد کنید)
```

#### 3. AWS Region
```
┌─────────────────────────────────────────────┐
│ AWS Region                                  │
├─────────────────────────────────────────────┤
│ us-east-1 (N. Virginia)        ▼            │ ← Dropdown
└─────────────────────────────────────────────┘

Available regions:
• us-east-1 (N. Virginia)
• us-east-2 (Ohio)
• us-west-1 (N. California)
• us-west-2 (Oregon)
• eu-west-1 (Ireland)
• eu-west-2 (London)
• eu-central-1 (Frankfurt)
• ap-southeast-1 (Singapore)
• ap-southeast-2 (Sydney)
• ap-northeast-1 (Tokyo)
```

#### 4. S3 Bucket Name
```
┌─────────────────────────────────────────────┐
│ S3 Bucket Name                              │
├─────────────────────────────────────────────┤
│ my-bucket-name                              │ ← Text input (LTR)
└─────────────────────────────────────────────┘
```

### Action Buttons
```
┌─────────────────────────┐  ┌────────────────────┐
│ ذخیرهٔ تنظیمات S3       │  │ تست اتصال S3       │
│ (Save S3 Settings)      │  │ (Test Connection)  │
└─────────────────────────┘  └────────────────────┘
   Primary button (blue)       Secondary button
```

### Success Messages

#### After Saving:
```
✅ تنظیمات S3 ذخیره شد. سرور خودکار از S3 استفاده خواهد کرد.
(S3 settings saved. Server will automatically use S3.)
```

#### After Testing:
```
✅ تست موفق! اتصال به S3 کار می‌کند.
(Test successful! S3 connection is working.)
```

### Error Messages

#### Test Failed - Access Denied:
```
❌ دسترسی رد شد. مجوزهای IAM را بررسی کنید
(Access denied. Check IAM permissions)
```

#### Test Failed - Not Configured:
```
❌ لطفاً ابتدا تنظیمات AWS S3 را کامل کنید
(Please complete AWS S3 settings first)
```

### Help Text (at bottom)
```
💡 راهنما: برای راه‌اندازی AWS S3، باکت ایجاد کنید، IAM user با دسترسی S3 
بسازید و کلیدها را اینجا وارد کنید.
مستندات کامل: S3_SETUP_GUIDE.md

✅ S3 پیکربندی شده است. تمام آپلودهای جدید به S3 می‌روند.
```

## 🎯 User Interaction Flow

### Step 1: Initial State (Empty Form)
```
[ Empty fields ]
[ Buttons enabled ]
Status: 📂 فضای محلی
```

### Step 2: Filling Form
```
[ User types Access Key ]
[ User types Secret Key ]
[ User selects Region ]
[ User types Bucket name ]
```

### Step 3: Saving
```
[ Click "ذخیرهٔ تنظیمات S3" ]
↓
[ Button shows "در حال ذخیره…" ]
↓
[ Success message appears ]
Status: ✅ S3 فعال است
```

### Step 4: Testing
```
[ Click "تست اتصال S3" ]
↓
[ Button shows "در حال تست…" ]
↓
[ Success/Error message appears ]
```

## 🎨 Visual Hierarchy

```
Security Page
├── 2FA Setup Section
├── Telegram Configuration Section
├── Twilio Module Section
└── S3 Configuration Section ← NEW!
    ├── Header & Description
    ├── Status Box
    ├── Form Fields
    │   ├── Access Key ID
    │   ├── Secret Access Key
    │   ├── Region
    │   └── Bucket
    ├── Action Buttons
    ├── Messages Area
    └── Help Text
```

## 📱 Responsive Behavior

### Desktop (Wide Screen)
```
┌──────────────────────────────────────────┐
│ Form Field          [ Input Field      ] │
│ Form Field          [ Input Field      ] │
│ [ Save Button ] [ Test Button ]          │
└──────────────────────────────────────────┘
```

### Mobile (Narrow Screen)
```
┌────────────────────┐
│ Form Field         │
│ [ Input Field    ] │
│                    │
│ Form Field         │
│ [ Input Field    ] │
│                    │
│ [ Save Button    ] │
│ [ Test Button    ] │
└────────────────────┘
```

## 🔐 Security Visual Cues

### Secret Key Field
```
Before entering:
[                                    ]
Placeholder: wJalrXUtnFEMI/K7MDENG/...

After entering:
[••••••••••••••••••••••              ]

After saving:
[••••••••                            ]
کلید فعلی: ••••EKEY
```

### Status Indicators
```
✅ = Success / Active
❌ = Error / Failed
📂 = Local storage
💡 = Information
⚠️ = Warning
```

## 🎬 Animation States

### Button States
```
Normal:    [ ذخیرهٔ تنظیمات S3 ]
Hover:     [ ذخیرهٔ تنظیمات S3 ] (slightly darker)
Active:    [ در حال ذخیره… ]      (disabled, loading)
Disabled:  [ ذخیرهٔ تنظیمات S3 ]   (greyed out)
```

### Message Fade-in
```
Save clicked → Message appears with fade-in animation
Test clicked → Message replaces previous with fade
```

## 📋 Form Validation

### Visual Feedback
```
Empty required field:
[ AWS Access Key ID ]  ← No border color change
                         (relies on browser validation)

Filled field:
[ AKIA123... ]         ← Normal border

After successful save:
✅ Success message     ← Green text
```

## 🎨 Color Scheme

```
Success:  #2e7d32 (green)
Error:    #b71c1c (red)
Info:     #5d4037 (brown)
Primary:  #1976d2 (blue)
Card BG:  #f5f5f5 (light grey)
```

## 💬 All Persian Text Used

```
Header:
- تنظیمات Amazon S3 (Amazon S3 Settings)

Status:
- وضعیت فعلی (Current Status)
- S3 فعال است (S3 is active)
- فضای محلی (Local storage)
- منبع تنظیمات (Settings source)
- دیتابیس (پنل ادمین) (Database - Admin Panel)

Buttons:
- ذخیرهٔ تنظیمات S3 (Save S3 Settings)
- تست اتصال S3 (Test S3 Connection)
- در حال ذخیره… (Saving...)
- در حال تست… (Testing...)

Messages:
- تنظیمات S3 ذخیره شد (S3 settings saved)
- سرور خودکار از S3 استفاده خواهد کرد (Server will automatically use S3)
- تست موفق! اتصال به S3 کار می‌کند (Test successful! S3 connection working)
- کلید فعلی (Current key)
- برای تغییر، کلید جدید وارد کنید (To change, enter new key)

Help:
- راهنما (Guide)
- برای راه‌اندازی AWS S3 (To setup AWS S3)
- باکت ایجاد کنید (Create bucket)
- مستندات کامل (Complete documentation)
- S3 پیکربندی شده است (S3 is configured)
- تمام آپلودهای جدید به S3 می‌روند (All new uploads go to S3)
```

---

## 📸 Screenshot Checklist

To document your setup, take screenshots of:

1. ✅ Admin panel showing S3 section
2. ✅ Empty form (initial state)
3. ✅ Form with credentials filled
4. ✅ Success message after saving
5. ✅ Test button success message
6. ✅ Status showing "S3 فعال است"
7. ✅ Exchange banner upload with S3 URL

---

**This visual guide helps you understand what the admin panel looks like without needing screenshots!**
