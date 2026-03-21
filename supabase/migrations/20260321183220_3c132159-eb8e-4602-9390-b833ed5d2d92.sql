-- Add cleaning columns to manual_reservations
ALTER TABLE public.manual_reservations
  ADD COLUMN IF NOT EXISTS cleaning_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_cleaned_at timestamptz;

-- Add cleaning_notes, keybox_code, and cleaner_pin to properties
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS cleaning_notes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS keybox_code text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cleaner_pin text DEFAULT '';