

## Add Brute-Force Protection to PIN Validation

### Problem
The `validate-pin` endpoint has no rate limiting. An attacker can try all 100M 8-digit PINs without restriction.

### Solution
Create a `pin_attempts` table to track failed attempts per IP. After 5 failed attempts within 15 minutes, return 429 (Too Many Requests). Successful logins clear the counter.

### Database Migration
```sql
CREATE TABLE public.pin_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pin_attempts ENABLE ROW LEVEL SECURITY;
-- No policies = default deny for client-side (access only via service_role in edge function)

CREATE INDEX idx_pin_attempts_ip_time ON public.pin_attempts (ip_address, attempted_at DESC);
```

### Edge Function Changes (`supabase/functions/validate-pin/index.ts`)
1. Extract client IP from request headers (`x-forwarded-for` or `x-real-ip`)
2. Before PIN validation, query `pin_attempts` for the last 15 minutes from that IP
3. If count >= 5, return `429 Too Many Requests` with a `Retry-After` header
4. On failed PIN, insert a row into `pin_attempts`
5. On successful PIN, delete all rows for that IP (reset counter)
6. Add a periodic cleanup: delete rows older than 1 hour (inline, cheap query)

### Constants
- **Max attempts**: 5 per IP per 15-minute window
- **Lockout message**: "Too many attempts. Please try again later."

### No frontend changes needed
The login page already displays error messages from the API response.

