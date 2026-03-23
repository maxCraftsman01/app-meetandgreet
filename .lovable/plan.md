

## Fix CORS Headers Across All Edge Functions

### Problem
All 9 edge functions are missing Supabase client platform headers (`x-supabase-client-platform`, etc.) from their CORS `Access-Control-Allow-Headers`. This causes PUT/POST/DELETE requests to fail with "Failed to fetch" because the browser's preflight OPTIONS request gets rejected.

### Fix
Update the `Access-Control-Allow-Headers` in every edge function to include the missing headers, while preserving each function's custom headers (like `x-admin-pin`, `x-owner-pin`, etc.).

### Files to update

| File | Current custom headers | Updated `Access-Control-Allow-Headers` |
|---|---|---|
| `admin-reservations/index.ts` | `x-admin-pin` | Add Supabase client headers |
| `admin-properties/index.ts` | `x-admin-pin` | Add Supabase client headers |
| `admin-users/index.ts` | `x-admin-pin` | Add Supabase client headers |
| `admin-timeline/index.ts` | `x-admin-pin` | Add Supabase client headers |
| `admin-pending-ical/index.ts` | `x-admin-pin` | Add Supabase client headers |
| `cleaner-operations/index.ts` | `x-cleaner-pin, x-admin-pin, x-user-pin` | Add Supabase client headers |
| `owner-data/index.ts` | `x-owner-pin, x-user-pin` | Add Supabase client headers |
| `fetch-ical/index.ts` | `x-owner-pin` | Add Supabase client headers |
| `validate-pin/index.ts` | (none) | Add Supabase client headers |

Each function's header string will follow this pattern:
```
authorization, x-client-info, apikey, content-type, [custom-headers], x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version
```

No other changes needed — just the CORS header string in each file.

