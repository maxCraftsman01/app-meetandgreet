

## Your Idea is Excellent — Here's My Analysis

Your concept of a unified `access_keys` table with permission flags is the right architectural direction. It solves several real problems:

- **Owner who cleans**: sees both finance and cleaning tabs
- **Professional cleaner**: sees only cleaning
- **Multiple properties, different roles**: one person can be owner of Property A but cleaner of Property B

### One Important Refinement

Instead of a separate `access_keys` table disconnected from users, I'd recommend a **two-table approach**:

```text
users                          user_property_access
┌──────────────┐               ┌─────────────────────────┐
│ id (uuid)    │──────────────▶│ user_id (uuid)          │
│ name (text)  │               │ property_id (uuid)      │
│ pin (text)   │               │ can_view_finance (bool)  │
│ created_at   │               │ can_view_cleaning (bool) │
└──────────────┘               │ can_mark_cleaned (bool)  │
                               └─────────────────────────┘
```

**Why this is better than your original `access_keys` idea:**
- A user logs in once with ONE PIN, then sees all their properties with the correct permissions per property
- No duplicate PINs — one person, one PIN, multiple property assignments
- Admin can see a clear list of "all users" and their assignments
- Easy to add more permissions later (e.g., `can_edit_reservations`)

### What Changes

1. **Database**: Create `users` and `user_property_access` tables. Migrate existing `owner_pin`/`cleaner_pin` data.

2. **PIN validation**: `validate-pin` looks up the `users` table, returns the user's permissions per property instead of a fixed role.

3. **Frontend routing**: Instead of routing to `/portal` or `/cleaner` based on role, route to a single `/dashboard` that dynamically shows tabs based on the user's permissions for the selected property.

4. **Admin UI**: Replace separate owner PIN / cleaner PIN fields with a "Manage Users" section where you create users (name + PIN) and assign them to properties with checkbox permissions: `☑ Finance` `☑ Cleaning`.

5. **All edge functions**: Update auth headers to use the new user-based lookup instead of owner/cleaner PIN checks on the properties table.

### What I'd Suggest Adding

- **`can_mark_cleaned`** as a separate permission from `can_view_cleaning` — sometimes an owner wants to see the cleaning schedule but not accidentally toggle it
- **Admin remains a separate env-var PIN** — no need to put admin in the database, keeps it simple and secure

### Scope Warning

This is a significant refactor — it touches the database, all edge functions, the session model, and the routing. I recommend doing it in phases:

**Phase 1**: Create tables + migration, update `validate-pin`, update session model
**Phase 2**: Build unified dashboard with permission-based tabs
**Phase 3**: Update Admin UI with user management
**Phase 4**: Remove old `owner_pin`/`cleaner_pin` columns

Shall I proceed with this phased approach, or would you prefer to adjust the plan first?

