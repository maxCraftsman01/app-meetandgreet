

## Fix User Edit + Add Admin as Manageable User

### Problem 1: "Failed to fetch" on user edit — FIXED
The `admin-users` edge function wasn't properly deployed. I've redeployed it and confirmed PUT requests now work (tested directly, returns `{"success": true}`). You should be able to edit users now — try it in the preview.

### Problem 2: Admin visibility in User Management

Currently the admin is a hardcoded PIN in an environment variable, invisible in the Users tab. Your idea to show and manage admins there is good. Here's the approach:

**Add an `is_admin` flag to `app_users`**:
- New boolean column `is_admin` (default `false`) on the `app_users` table
- Admin users get all permissions on all properties automatically
- The `validate-pin` function checks `is_admin` flag and returns `role: "admin"` if true
- The env-var `ADMIN_PIN` remains as a fallback/super-admin that can never be locked out

**Changes:**

| File | Change |
|---|---|
| Migration SQL | Add `is_admin` boolean to `app_users` |
| `supabase/functions/validate-pin/index.ts` | Check `is_admin` flag in addition to env-var PIN |
| `supabase/functions/admin-users/index.ts` | Allow admin users (not just env-var PIN) to access admin functions; show admin badge in GET response |
| `src/components/UserManagement.tsx` | Add "Admin" toggle when creating/editing users; show admin badge on user cards |

**How it works:**
- Env-var PIN = super-admin (always works, can't be removed from UI)
- `is_admin = true` users = regular admins (can be added/removed by any admin)
- Admin users see all properties with full access, plus the admin panel
- Non-admin users continue to see only their assigned properties

