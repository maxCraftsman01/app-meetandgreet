

## Root cause

The runtime error is `401 Unauthorized` from `admin-properties`, **not** a schema mismatch. The function only accepts the master env `ADMIN_PIN`:

```ts
if (pin !== Deno.env.get("ADMIN_PIN")) return json({ error: "Unauthorized" }, 401);
```

Other admin functions (`admin-users`, `admin-timeline`) use the shared `validateAdminPin()` helper, which accepts **either** the env `ADMIN_PIN` **or** any PIN belonging to an `app_users` row with `is_admin = true`. The currently logged-in admin is a DB admin, so every call to `admin-properties` (GET / POST / PUT / DELETE) returns 401.

The `properties` table schema and the insert payload from `Admin.tsx` are already in sync — every column the form sends (`name`, `owner_name`, `owner_pin`, `cleaner_pin`, `ical_urls`, `nightly_rate`, `currency`, `keybox_code`, `cleaning_notes`, `listing_urls`) exists on the table. The only NOT NULL column without a default is `owner_pin`, which the form always supplies.

So no SQL migration is required.

## Fix (minimal, focused)

Update `supabase/functions/admin-properties/index.ts`:

1. Replace the env-only PIN check with `validateAdminPin()` (matches the pattern used by `admin-users` and `admin-timeline`).
2. Add light defensive validation on POST/PUT payloads with clear error messages:
   - POST requires non-empty `name`, `owner_name`, `owner_pin`.
   - PUT requires `?id=` query param.
   - DELETE requires `?id=` query param.
   - Coerce `nightly_rate` to a number when present; default `currency` to `"EUR"`; coerce `ical_urls` / `listing_urls` to arrays if a string slips through.
3. Log Supabase errors server-side and return structured JSON `{ error: string, details?: string }` with appropriate status codes (`400` validation, `401` auth, `404` not found, `500` DB).
4. Wrap `req.json()` in try/catch so malformed bodies return `400`, not 500.

No changes to `Admin.tsx`, `PropertyFormDialog.tsx`, `_shared/auth.ts`, `_shared/cors.ts`, or any other file.

## SQL migration

None required. The `properties` schema already supports the form payload.

## Files to change

- `supabase/functions/admin-properties/index.ts` — apply the fixes above.
- Deploy `admin-properties` after the edit.

