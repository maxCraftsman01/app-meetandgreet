

## Plan: One-time identifier cleanup + future-sync edit preservation

### Confirmed via investigation
- **10 rows** in `manual_reservations` currently have hash-style `guest_name` (9 Airbnb, 1 Booking.com).
- Every one of the 9 Airbnb rows has a matching `bookings` row whose `description` contains the real Airbnb confirmation code (`HMK4RANB2E`, `HMZPJPW5YH`, `HM9D3HX28P`, etc.).
- **`fetch-ical` never writes to `manual_reservations.guest_name`** — it only updates the `bookings` mirror table and flips `status` to `Cancelled-iCal` for orphan future reservations. So your edits are already safe across syncs. No code change needed for "preserve edits" — it's the current behavior.
- Going forward, the only place a new `manual_reservations.guest_name` is created is when you click **"Confirm"** on a pending event in `PendingPayouts.tsx`. That's the one spot we'll improve so new identifiers are correct from day one.

---

### Fix #1 — One-time SQL backfill (the cleanup you asked for)

A single SQL update, run **once** via the data tool. Joins `manual_reservations` to `bookings` on `(property_id, check_in=start_date, check_out=end_date)` and rewrites `guest_name` based on what's available.

Logic per row:
1. If matching `bookings.description` contains `https://www.airbnb.com/hosting/reservations/details/<CODE>` → set `guest_name = <CODE>` (e.g. `HMK4RANB2E`).
2. Else if `bookings.uid` contains `@booking.com` → set `guest_name = 'BDC-' || left(uid_hex, 8)`.
3. Else if `bookings.uid` exists → set `guest_name = 'REF-' || left(uid_hex, 8)`.
4. Else (no matching booking row anymore) → set `guest_name = 'REF-' || left(existing_hash, 8)` (just prefix the existing hash so it visibly differs from the old format and follows the new convention).

Single statement, idempotent (only touches rows where `guest_name ~ '^[a-f0-9]{6,8}$'`):

```sql
WITH matched AS (
  SELECT
    mr.id,
    COALESCE(
      -- 1. Airbnb confirmation code from URL
      (regexp_match(b.description, '/reservations/details/([A-Z0-9]{8,12})'))[1],
      -- 2. Booking.com → BDC-<uid8>
      CASE WHEN b.uid LIKE '%@booking.com'
           THEN 'BDC-' || lower(substring((regexp_match(b.uid, '([a-f0-9]{8,})'))[1] FROM 1 FOR 8))
      END,
      -- 3. Any other source with a UID → REF-<uid8>
      CASE WHEN b.uid IS NOT NULL
           THEN 'REF-' || lower(substring((regexp_match(b.uid, '([a-f0-9]{8,})'))[1] FROM 1 FOR 8))
      END,
      -- 4. Fallback: prefix the existing hash with REF-
      'REF-' || mr.guest_name
    ) AS new_name
  FROM manual_reservations mr
  LEFT JOIN bookings b
    ON b.property_id = mr.property_id
   AND b.start_date  = mr.check_in
   AND b.end_date    = mr.check_out
  WHERE mr.guest_name ~ '^[a-f0-9]{6,8}$'
)
UPDATE manual_reservations mr
SET guest_name = matched.new_name,
    updated_at = now()
FROM matched
WHERE mr.id = matched.id
  AND matched.new_name IS NOT NULL
  AND matched.new_name <> mr.guest_name;
```

Expected result for the 10 rows currently affected: 9 will become real Airbnb codes (`HMK4RANB2E`, `HMZPJPW5YH`, …), 1 will become `BDC-edc0a958` (or similar).

I'll show you the affected rows before/after with a `SELECT` query so you can verify.

---

### Fix #2 — Improve `PendingPayouts.tsx` so future "Confirm" creates good identifiers

When you click **"Add Payout"** on a pending Airbnb/Booking event, the dialog should pre-fill the guest name field with the correct identifier extracted from the iCal data — and **let you edit it** (so you can type a real first name later if you want).

Changes:

**a)** In `admin-pending-ical/index.ts`, enrich each pending booking with a derived `identifier` field by parsing `description` for the Airbnb code, falling back to `BDC-<uid8>` or `REF-<uid8>`.

```ts
function extractIdentifier(b: any): string | null {
  if (b.description) {
    const m = b.description.match(/\/reservations\/details\/([A-Z0-9]{8,12})/i);
    if (m) return m[1].toUpperCase();
  }
  if (b.uid) {
    const hexMatch = b.uid.match(/([a-f0-9]{8,})/i);
    const hex8 = hexMatch ? hexMatch[1].substring(0, 8).toLowerCase() : null;
    if (hex8) {
      if (b.uid.toLowerCase().includes("@booking.com")) return `BDC-${hex8}`;
      return `REF-${hex8}`;
    }
  }
  return null;
}

const pending = (bookings || [])
  .filter(/* existing filter */)
  .map(b => ({ ...b, identifier: extractIdentifier(b) }));
```

**b)** In `PendingPayouts.tsx`:
- Show `identifier` in the pending list card (badge or muted text) so you immediately see "HMK4RANB2E".
- Add an editable **Guest / Reference** input in the Confirm Reservation dialog, pre-filled with `identifier`. Whatever you save is what goes into `manual_reservations.guest_name`.
- Replace the current `convertDialog.guest_name || convertDialog.summary` fallback (which produces the bad `1418fb94` output) with the new `identifier`.

This way: new confirmations get the good identifier automatically; you can override at any time; future syncs never touch your edits.

---

### Fix #3 — Update memory

Update `mem://features/ical-integration` to record:
- Airbnb iCal feeds anonymize guest names. We extract the **Airbnb confirmation code** (`HMxxxxxxxx`) from `Reservation URL:` line of `DESCRIPTION` as the per-reservation identifier.
- Booking.com → `BDC-<uid8>`. Generic → `REF-<uid8>`.
- `fetch-ical` is **read-only** for `manual_reservations.guest_name` (and all other fields). Admin edits are preserved across syncs. Sync only affects the `bookings` mirror table and the `status` field for orphan future reservations.

---

### Files to change

1. **One-time data update** (insert/update tool, not a migration) — runs the backfill SQL above.
2. `supabase/functions/admin-pending-ical/index.ts` — add `extractIdentifier()` and attach `identifier` to each pending booking.
3. `src/components/PendingPayouts.tsx` — show `identifier` in the list and as an editable, pre-filled input in the Confirm dialog.
4. `mem://features/ical-integration` — updated rules.

**No schema change. No new dependencies. Sync logic untouched** (so your edits stay protected).

---

### Verification after deploy

1. Run a `SELECT id, source, guest_name, check_in FROM manual_reservations ORDER BY check_in DESC` — all 10 hash names should be replaced with real `HM...` codes or `BDC-...` references.
2. Pick any Airbnb row, copy the `HM...` code, paste into Airbnb host dashboard search → lands on that exact reservation.
3. Trigger an iCal sync — re-run the SELECT → confirm guest_names are unchanged (sync didn't touch them).
4. Manually edit one `guest_name` (e.g. type "Maria") and sync again → confirm "Maria" is preserved.
5. Confirm a brand-new pending booking via PendingPayouts → confirm the dialog pre-fills with the proper `HMxxxxxxxx` code, and after saving it appears correctly in the master list.

Approve and I'll switch to default mode and ship.

