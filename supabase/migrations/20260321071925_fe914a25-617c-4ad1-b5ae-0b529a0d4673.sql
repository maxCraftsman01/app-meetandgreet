
-- Properties table
CREATE TABLE public.properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  owner_pin TEXT NOT NULL CHECK (length(owner_pin) = 8),
  ical_urls TEXT[] DEFAULT '{}',
  nightly_rate NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Bookings table to cache parsed iCal events
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  summary TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'booked',
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookings_property_id ON public.bookings(property_id);
CREATE INDEX idx_bookings_dates ON public.bookings(start_date, end_date);

-- Enable RLS on both tables
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- No public access policies - all access goes through edge functions with service_role key
