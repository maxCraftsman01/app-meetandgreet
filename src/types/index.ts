// ─── Shared Types ──────────────────────────────────────────

export interface Property {
  id: string;
  name: string;
  owner_name: string;
  owner_pin?: string;
  nightly_rate: number;
  currency: string;
  ical_urls: string[];
  active_bookings?: number;
  cleaner_pin?: string;
  keybox_code?: string;
  cleaning_notes?: string;
  listing_urls?: string[];
}

export interface Booking {
  id: string;
  property_id: string;
  summary: string;
  guest_name: string | null;
  start_date: string;
  end_date: string;
  status: string;
  source_url: string | null;
}

export interface ManualReservation {
  id: string;
  property_id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  source: string;
  net_payout: number;
  status: string;
  is_blocked?: boolean;
  created_at?: string;
  updated_at?: string;
  cleaning_status?: string;
  last_cleaned_at?: string | null;
  external_id?: string | null;
}

export interface CleanerTask {
  property_id: string;
  property_name: string;
  keybox_code: string;
  cleaning_notes: string;
  status: "idle" | "same-day" | "checkout-only" | "arrival-pending" | "arrival-ready";
  reservation_id: string | null;
  guest_name: string | null;
  check_in: string | null;
  check_out_guest: string | null;
}

export interface TicketMedia {
  id: string;
  media_type: string;
  storage_path: string;
}

export interface Ticket {
  id: string;
  property_id: string;
  created_by_role: string;
  created_by_user_id?: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  repair_cost: number;
  visible_to_owner: boolean;
  visible_to_cleaner: boolean;
  cost_visible_to_owner: boolean;
  created_at: string;
  resolved_at: string | null;
  ticket_media: TicketMedia[];
  properties?: { name: string };
}

export interface PropertyStatus {
  id: string;
  name: string;
  owner_name: string;
  status: "idle" | "same-day" | "checkout-only" | "arrival-pending" | "arrival-ready";
  today_checkout: boolean;
  today_checkin: boolean;
  cleaning_done: boolean;
  arrival_reservation: { id: string; guest_name: string } | null;
  keybox_code: string;
  cleaning_notes: string;
}

export interface CalendarEvent {
  date: string;
  property_id: string;
  property_name: string;
  status: string;
  guest_name: string | null;
  check_out_guest: string | null;
  reservation_id: string | null;
  keybox_code: string | null;
  cleaning_notes: string | null;
}

// ─── API Response Types ────────────────────────────────────

export interface ValidatePinResponse {
  role: "admin" | "user";
  token: string;
  user_id?: string;
  user_name?: string;
  properties?: import("@/lib/session").PropertyAccess[];
}

export interface OwnerDataResponse {
  properties: Property[];
  bookings: Booking[];
  manual_reservations: ManualReservation[];
}

export interface FetchIcalResponse {
  synced: number;
  bookings: Booking[];
}
