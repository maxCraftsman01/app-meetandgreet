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
  description: string;
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
          description: current.description || "",
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
      } else if (line.startsWith("DESCRIPTION:")) {
        current.description = line.substring(12);
      }
    }
  }
  return events;
}

function parseICalDate(val: string): string {
  const clean = val.replace(/[TZ]/g, "");
  const y = clean.substring(0, 4);
  const m = clean.substring(4, 6);
  const d = clean.substring(6, 8);
  return `${y}-${m}-${d}`;
}

function extractBookingComInfo(event: ICalEvent, sourceUrl: string): { guest_name: string; summary: string; isBookingCom: true } | null {
  const summaryLower = (event.summary || "").toLowerCase();
  const isFromBookingCom = sourceUrl.includes("booking.com");

  const isClosedPattern = summaryLower.includes("closed - not available") || summaryLower === "reserved";

  if (!isFromBookingCom && !isClosedPattern) return null;
  if (isFromBookingCom && !isClosedPattern) return null;

  // Extract reservation ref from UID
  let ref = "";
  if (event.uid) {
    const numMatch = event.uid.match(/([a-f0-9]{6,})/i);
    ref = numMatch ? numMatch[1].substring(0, 8) : "";
  }

  // Check DESCRIPTION for guest name pattern
  let guestFromDesc = "";
  if (event.description) {
    const guestMatch = event.description.match(/GUEST:\s*(.+)/i);
    if (guestMatch) guestFromDesc = guestMatch[1].trim();
  }

  const guest_name = guestFromDesc
    ? guestFromDesc + (ref ? ` (#${ref})` : "")
    : ref || "";

  const summary = ref ? `Booking.com #${ref}` : "Booking.com Guest";

  return { guest_name, summary, isBookingCom: true };
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
    const allEvents: (ICalEvent & { sourceUrl: string })[] = [];

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

    await supabase
      .from("bookings")
      .delete()
      .eq("property_id", property_id);

    if (allEvents.length > 0) {
      const airbnbBlockedPatterns = ["airbnb (not available)", "blocked", "unavailable", "no disponible", "nicht verfügbar"];

      await supabase.from("bookings").insert(
        allEvents.map((e) => {
          const bookingComInfo = extractBookingComInfo(e, e.sourceUrl);

          if (bookingComInfo) {
            return {
              property_id,
              summary: bookingComInfo.summary,
              guest_name: bookingComInfo.guest_name,
              start_date: e.startDate,
              end_date: e.endDate,
              source_url: e.sourceUrl,
              uid: e.uid || null,
              description: e.description || null,
              status: "booked",
            };
          }

          // Airbnb logic
          const summaryLower = (e.summary || "").toLowerCase();
          const isFromBookingCom = e.sourceUrl.includes("booking.com");
          const isBlocked = !isFromBookingCom &&
            airbnbBlockedPatterns.some((p) => summaryLower.includes(p));

          // Extract Airbnb guest name from DESCRIPTION or SUMMARY
          let airbnbGuestName: string | null = null;
          let airbnbSummary = e.summary;

          if (!isBlocked && !isFromBookingCom) {
            // Try DESCRIPTION field first for guest name patterns
            if (e.description) {
              const guestMatch = e.description.match(/GUEST:\s*(.+)/i);
              const nameMatch = e.description.match(/(?:^|\n)Name:\s*(.+)/i);
              const checkinName = e.description.match(/Check-in:\s*.*?\n.*?([A-Z][a-z]+ [A-Z][a-z]+)/);
              airbnbGuestName = (guestMatch?.[1] || nameMatch?.[1] || checkinName?.[1] || "").trim() || null;
            }

            // If no name from description, use SUMMARY if it looks like a real name
            // (not a platform label like "Reserved" or "Airbnb (Not available)")
            if (!airbnbGuestName && e.summary) {
              const looksLikeName = /^[A-Z][a-z]+(\s+[A-Z][a-z]*\.?)+$/.test(e.summary.trim());
              if (looksLikeName) {
                airbnbGuestName = e.summary.trim();
              }
            }

            // Build a ref from UID if available
            if (airbnbGuestName && e.uid) {
              const refMatch = e.uid.match(/([a-f0-9]{6,})/i);
              const ref = refMatch ? refMatch[1].substring(0, 8) : "";
              if (ref) {
                airbnbSummary = `Airbnb #${ref}`;
              }
            }
          }

          return {
            property_id,
            summary: airbnbSummary,
            guest_name: airbnbGuestName,
            start_date: e.startDate,
            end_date: e.endDate,
            source_url: e.sourceUrl,
            uid: e.uid || null,
            description: e.description || null,
            status: isBlocked ? "blocked" : "booked",
          };
        })
      );
    }

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
