## Unified Permission-Based Access System — IMPLEMENTED

### What Changed

1. **New `app_users` table** — stores users with name + unique 8-digit PIN
2. **New `user_property_access` table** — per-property permissions: `can_view_finance`, `can_view_cleaning`, `can_mark_cleaned`
3. **Unified `/dashboard` route** — replaces `/portal` and `/cleaner`. Shows Finance and/or Cleaning tabs based on user's permissions for the selected property
4. **Admin "Users" tab** — create/edit/delete users, assign property permissions with checkboxes
5. **`validate-pin`** — now returns `role: "user"` with per-property permissions instead of `role: "owner"` or `role: "cleaner"`
6. **`cleaner-operations`** — looks up user by PIN in `app_users` + `user_property_access` instead of `cleaner_pin` on properties
7. **`owner-data`** — looks up user by PIN and returns only properties where `can_view_finance = true`
8. **Legacy routes** `/portal` and `/cleaner` redirect to `/dashboard`

### Existing data migrated
- Owner PINs → app_users with full permissions (finance + cleaning + mark)
- Cleaner PINs → app_users with cleaning + mark permissions only
