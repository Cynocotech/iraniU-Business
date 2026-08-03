# Super Admin "Claimed" Button Feature

**Status:** ✅ DEPLOYED  
**Date:** June 16, 2026

---

## 📋 Overview

A new **"Mark as Claimed"** button has been added to business profile pages that only super admins can see. This button allows admins to manually mark a business as claimed, which removes the public "Claim Ownership" button.

---

## 🎯 Purpose

**Problem:** Sometimes businesses need to be marked as claimed without going through the normal claim process (e.g., business owner contacted directly, manual verification, etc.)

**Solution:** Super admin-only button to instantly mark business as claimed.

---

## 🔒 Security

**Visibility:**
- ✅ **Super Admin:** Button is visible
- ❌ **Managers:** Button is hidden
- ❌ **Public Users:** Button is hidden

**Authorization:**
- Button only appears when `me?.role === "superadmin"`
- Server-side verification through existing `apiPatch` endpoint
- Uses standard authentication (JWT token)

---

## 🎨 UI/UX

### Button Appearance

**Location:** On the business profile page, inside the claim banner (only when business is NOT claimed)

**Style:**
- Green background (`#10b981`)
- White text
- Secondary button style
- Text: `"✓ Mark as Claimed (Admin Only)"`

**States:**
- Normal: `"✓ Mark as Claimed (Admin Only)"`
- Loading: `"در حال ذخیره..."`
- Disabled during save

### User Flow

1. **Super admin visits unclaimed business page**
   ```
   Example: /business?slug=restaurant-xyz
   ```

2. **Sees claim banner with TWO buttons:**
   - Public button: "ادعای مالکیت" (Claim Ownership)
   - Admin button: "✓ Mark as Claimed (Admin Only)" (green)

3. **Clicks admin button**
   - Confirmation dialog appears (Persian)
   - Message: "آیا مطمئن هستید که می‌خواهید این کسب‌وکار را به عنوان "Claimed" علامت‌گذاری کنید؟"

4. **Confirms action**
   - Button shows: "در حال ذخیره..."
   - API call updates business
   - Page updates automatically

5. **Result:**
   - Claim banner disappears
   - Business now shows "آگهی تأییدشده" message
   - Public claim button no longer visible

---

## 💻 Technical Implementation

### Frontend Changes

**File:** `client/src/pages/BusinessPage.jsx`

**Added:**
1. Import `useAuth` context
2. Import `apiPatch` function
3. State: `markingClaimed` for loading state
4. Check: `isSuperAdmin = me?.role === "superadmin"`
5. Handler: `handleMarkClaimed()` function
6. UI: Conditional admin button render

**Code:**
```javascript
const { me } = useAuth();
const isSuperAdmin = me?.role === "superadmin";
const [markingClaimed, setMarkingClaimed] = useState(false);

const handleMarkClaimed = async () => {
  if (!isSuperAdmin || markingClaimed) return;
  if (!confirm(`...confirmation message...`)) return;
  
  setMarkingClaimed(true);
  try {
    const updated = await apiPatch(`/api/businesses/${slug}`, {
      claimed: 1,
    });
    setB(updated);
    alert("✅ کسب‌وکار به عنوان Claimed علامت‌گذاری شد.");
  } catch (err) {
    alert(`خطا: ${err.message}`);
  } finally {
    setMarkingClaimed(false);
  }
};
```

### Backend Changes

**No backend changes required!**

The existing endpoint is used:
- `PATCH /api/businesses/:slug`
- Field: `claimed` (already in `PATCHABLE_BUSINESS` set)
- Authorization: Handled by existing middleware

---

## 🧪 Testing

### Test as Super Admin

1. **Login as super admin:**
   ```
   URL: http://localhost:3001/admin/login
   Email: admin@directory.iraniu.uk
   Password: Change_This_Password_123!
   ```

2. **Find an unclaimed business:**
   ```sql
   SELECT slug, name_fa FROM businesses 
   WHERE claimed = 0 OR claimed IS NULL 
   LIMIT 5;
   ```

3. **Visit business page:**
   ```
   http://localhost:3001/business?slug=BUSINESS_SLUG
   ```

4. **Verify button visibility:**
   - Should see green "Mark as Claimed" button
   - Only visible to you (super admin)

5. **Click button and confirm:**
   - See confirmation dialog
   - Click OK
   - Button shows "در حال ذخیره..."

6. **Verify result:**
   - Claim banner disappears
   - "آگهی تأییدشده" message appears
   - Database updated: `claimed = 1`

### Test as Non-Admin

1. **Logout or open incognito:**
   ```
   Clear cookies or use incognito mode
   ```

2. **Visit same business page:**
   ```
   http://localhost:3001/business?slug=BUSINESS_SLUG
   ```

3. **Verify:**
   - ❌ Admin button NOT visible
   - ✅ Only public "ادعای مالکیت" button shows (if unclaimed)

---

## 📊 Database Impact

### Table: `businesses`

**Field Updated:** `claimed`

**Values:**
- `0` or `NULL` = Unclaimed (shows claim button)
- `1` = Claimed (hides claim button)

**Query to check:**
```sql
SELECT slug, name_fa, claimed 
FROM businesses 
WHERE slug = 'your-business-slug';
```

**Manual update (alternative to button):**
```sql
UPDATE businesses 
SET claimed = 1 
WHERE slug = 'your-business-slug';
```

---

## 🔄 What Happens After Claiming

### Immediate Changes

1. **Claim Banner:**
   - Before: Shows with "ادعای مالکیت" button
   - After: Replaced with "آگهی تأییدشده" message

2. **Public Users:**
   - Can no longer see claim button
   - See "Owner Verified" badge

3. **Managers:**
   - Can login and access dashboard
   - Can edit business if they own it

### CSS Classes

Body classes automatically update:
- Removes: `business-page--unclaimed`
- Adds: `business-page--claimed`

---

## 🎯 Use Cases

### When to Use This Button

1. **Manual Verification:**
   - Business owner contacted you directly
   - Verified ownership through documents
   - Want to mark as claimed without claim flow

2. **Migration:**
   - Importing businesses from old system
   - Already verified ownership
   - Bulk marking as claimed

3. **Support:**
   - User had trouble with claim process
   - You verified them manually
   - Quick admin action needed

4. **Testing:**
   - Testing claimed vs unclaimed views
   - Need to toggle status quickly

### When NOT to Use

1. **Normal Claims:** Let users go through the claim process
2. **Unverified:** Don't mark as claimed without verification
3. **Disputes:** Use proper claim review process

---

## 🛡️ Security Considerations

### Authorization Check

**Client-side:**
```javascript
isSuperAdmin = me?.role === "superadmin"
```

**Server-side:**
- Uses existing JWT authentication
- `apiPatch` sends token in headers
- Server validates token and permissions

### Potential Issues

**Q: Can a manager see this button?**  
A: No. Button only renders when `role === "superadmin"`

**Q: Can someone manipulate the client code to show the button?**  
A: They could show it, but the API call would fail without superadmin JWT token

**Q: What if someone tries to PATCH directly?**  
A: Server validates authentication. Only authenticated users with proper permissions can update.

---

## 📝 Error Handling

### Possible Errors

**1. Network Error:**
```javascript
catch (err) {
  alert(`خطا: ${err.message}`);
}
```

**2. Unauthorized:**
- API returns 401/403
- Error message shown
- Button re-enabled

**3. Business Not Found:**
- API returns 404
- Error message shown

**4. Validation Error:**
- API returns 400
- Error message shown

### User Feedback

**Success:**
```
✅ کسب‌وکار به عنوان Claimed علامت‌گذاری شد.
```

**Error:**
```
خطا: [error message]
```

---

## 🔧 Configuration

### Enable/Disable Feature

To hide the button (without removing code):

**Option 1: Remove superadmin role**
```javascript
// Temporary disable
const isSuperAdmin = false; // me?.role === "superadmin"
```

**Option 2: Feature flag (future)**
```javascript
const ENABLE_ADMIN_CLAIM_BUTTON = true;
const isSuperAdmin = ENABLE_ADMIN_CLAIM_BUTTON && me?.role === "superadmin";
```

---

## 📈 Monitoring

### Track Usage

**Database query:**
```sql
-- Businesses marked claimed (check recent updates)
SELECT slug, name_fa, claimed 
FROM businesses 
WHERE claimed = 1
ORDER BY id DESC 
LIMIT 20;
```

**Audit log (future enhancement):**
Could add logging:
- Who marked it as claimed
- When
- Previous state

---

## 🎨 Customization

### Change Button Text

**File:** `client/src/pages/BusinessPage.jsx`

```javascript
{markingClaimed ? "در حال ذخیره..." : "✓ Mark as Claimed (Admin Only)"}
```

Change to:
```javascript
{markingClaimed ? "Saving..." : "✓ Verified"}
// or
{markingClaimed ? "Saving..." : "🔒 Lock Claim"}
```

### Change Button Style

```javascript
style={{
  background: "#10b981",  // Green
  color: "white",
  border: "none"
}}
```

Change to:
```javascript
style={{
  background: "#3b82f6",  // Blue
  color: "white",
  border: "none"
}}
```

---

## ✅ Deployment Checklist

- [x] Code added to BusinessPage.jsx
- [x] Auth context imported
- [x] Handler function implemented
- [x] Button rendered conditionally
- [x] Confirmation dialog added
- [x] Error handling implemented
- [x] Client built successfully
- [x] Server restarted
- [x] Tested as super admin
- [x] Tested as non-admin
- [x] Documentation created

---

## 📚 Related Features

**Claim Process:**
- Public claim page: `/claim`
- Claim requests table: `claim_requests`
- Admin claim review: `/admin/claims`

**Business Management:**
- Manager dashboard: `/dashboard`
- Business edit: `/dashboard/edit`
- Link manager to business: Admin panel

---

## 🎓 Future Enhancements

### Possible Improvements

1. **Unclaim Button:**
   - Add button to revert claimed status
   - Super admin only
   - "Mark as Unclaimed"

2. **Audit Log:**
   - Track who claimed it
   - When
   - Reason

3. **Bulk Actions:**
   - Mark multiple businesses as claimed
   - Admin businesses list page
   - Checkbox selection

4. **Claim Reason:**
   - Optional text field
   - "Why marking as claimed?"
   - Store in database

5. **Link Manager:**
   - After marking as claimed
   - Prompt to link a manager
   - Quick workflow

---

## 📊 Statistics

**Files Modified:** 1  
**Lines Added:** ~30  
**New Dependencies:** 0  
**Backend Changes:** 0  
**Breaking Changes:** 0  

---

**Status:** ✅ LIVE AND WORKING  
**Implemented by:** Claude Sonnet 4.5  
**Project:** Iraniu UK Business Directory Platform
