import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-owner-pin, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface ICalEvent {
  summary: string;
  startDate: string;
  endDate: string;
  uid: string;
}

function parseICS(icsText: string): ICalEvent[] {
  const events: ICalEvent[] = [];
  const lines = icsText.replace(/\r\n /g, "").split(/\r?\n/);
  let inEvent = false;
  let current: Partial<ICalEvent> = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
    } else if (line === "END:VEVENT") {
      inEvent = false;
      if (current.startDate && current.endDate) {
        events.push({
          summary: current.summary || "Booked",
          startDate: current.startDate,
          endDate: current.endDate,
          uid: current.uid || "",
        });
      }
    } else if (inEvent) {
      if (line.startsWith("DTSTART")) {
        const val = line.split(":").pop()!;
        current.startDate = parseICalDate(val);
      } else if (line.startsWith("DTEND")) {
        const val = line.split(":").pop()!;
        current.endDate = parseICalDate(val);
      } else if (line.startsWith("SUMMARY:")) {
        current.summary = line.substring(8);
      } else if (line.startsWith("UID:")) {
        current.uid = line.substring(4);
      }
    }
  }
  return events;
}

function parseICalDate(val: string): string {
  // Handle YYYYMMDD and YYYYMMDDTHHmmssZ formats
  const clean = val.replace(/[TZ]/g, "");
  const y = clean.substring(0, 4);
  const m = clean.substring(4, 6);
  const d = clean.substring(6, 8);
  return `${y}-${m}-${d}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { property_id, owner_pin } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate access: either admin or owner
    const adminPin = Deno.env.get("ADMIN_PIN");
    const isAdmin = owner_pin === adminPin;

    if (!isAdmin) {
      const { data: prop } = await supabase
        .from("properties")
        .select("id")
        .eq("id", property_id)
        .eq("owner_pin", owner_pin)
        .single();

      if (!prop) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get property iCal URLs
    const { data: property, error: propError } = await supabase
      .from("properties")
      .select("ical_urls")
      .eq("id", property_id)
      .single();

    if (propError || !property) {
      return new Response(JSON.stringify({ error: "Property not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const icalUrls = property.ical_urls || [];
    const allEvents: ICalEvent[] = [];

    for (const url of icalUrls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const text = await res.text();
          const events = parseICS(text);
          allEvents.push(...events.map((e) => ({ ...e, sourceUrl: url })));
        }
      } catch {
        // Skip failed URLs
      }
    }

    // Clear old bookings and insert new ones
    await supabase
      .from("bookings")
      .delete()
      .eq("property_id", property_id);

    if (allEvents.length > 0) {
      const airbnbBlockedPatterns = ["airbnb (not available)", "blocked", "unavailable", "no disponible", "nicht verfügbar"];
      await supabase.from("bookings").insert(
        allEvents.map((e) => {
          const summaryLower = (e.summary || "").toLowerCase();
          const isFromBookingCom = ((e as any).sourceUrl || "").includes("booking.com");
          // Booking.com "CLOSED - Not available" = real booking
          // Airbnb "Not available" = blocked
          const isBlocked = !isFromBookingCom &&
            airbnbBlockedPatterns.some((p) => summaryLower.includes(p));
          return {
            property_id,
            summary: e.summary,
            start_date: e.startDate,
            end_date: e.endDate,
            source_url: (e as any).sourceUrl,
            status: isBlocked ? "blocked" : "booked",
          };
        })
      );
    }

    // Return bookings
    const { data: bookings } = await supabase
      .from("bookings")
      .select("*")
      .eq("property_id", property_id)
      .order("start_date");

    return new Response(JSON.stringify({ bookings: bookings || [], synced: allEvents.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
