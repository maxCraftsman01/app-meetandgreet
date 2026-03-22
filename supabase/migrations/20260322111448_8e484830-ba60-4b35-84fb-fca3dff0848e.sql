
-- Users table for PIN-based auth
CREATE TABLE public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pin text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Permission mapping: user <-> property
CREATE TABLE public.user_property_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  can_view_finance boolean NOT NULL DEFAULT false,
  can_view_cleaning boolean NOT NULL DEFAULT false,
  can_mark_cleaned boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, property_id)
);

-- Migrate existing owner_pin data into app_users + access
INSERT INTO public.app_users (name, pin)
SELECT DISTINCT owner_name, owner_pin FROM public.properties
WHERE owner_pin IS NOT NULL AND owner_pin != ''
ON CONFLICT (pin) DO NOTHING;

INSERT INTO public.user_property_access (user_id, property_id, can_view_finance, can_view_cleaning, can_mark_cleaned)
SELECT au.id, p.id, true, true, true
FROM public.properties p
JOIN public.app_users au ON au.pin = p.owner_pin
ON CONFLICT (user_id, property_id) DO NOTHING;

-- Migrate existing cleaner_pin data
INSERT INTO public.app_users (name, pin)
SELECT DISTINCT 'Cleaner', cleaner_pin FROM public.properties
WHERE cleaner_pin IS NOT NULL AND cleaner_pin != ''
ON CONFLICT (pin) DO NOTHING;

INSERT INTO public.user_property_access (user_id, property_id, can_view_finance, can_view_cleaning, can_mark_cleaned)
SELECT au.id, p.id, false, true, true
FROM public.properties p
JOIN public.app_users au ON au.pin = p.cleaner_pin
WHERE p.cleaner_pin IS NOT NULL AND p.cleaner_pin != ''
ON CONFLICT (user_id, property_id) DO NOTHING;
