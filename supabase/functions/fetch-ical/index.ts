import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { getSupabaseClient, validateAdminPin } from "../_shared/auth.ts";

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
    if (line === "BEGIN:VEVENT") { inEvent = true; current = {}; }
    else if (line === "END:VEVENT") {
      inEvent = false;
      if (current.startDate && current.endDate) {
        events.push({ summary: current.summary || "Booked", startDate: current.startDate, endDate: current.endDate, uid: current.uid || "", description: current.description || "" });
      }
    } else if (inEvent) {
      if (line.startsWith("DTSTART")) current.startDate = parseICalDate(line.split(":").pop()!);
      else if (line.startsWith("DTEND")) current.endDate = parseICalDate(line.split(":").pop()!);
      else if (line.startsWith("SUMMARY:")) current.summary = line.substring(8);
      else if (line.startsWith("UID:")) current.uid = line.substring(4);
      else if (line.startsWith("DESCRIPTION:")) current.description = line.substring(12);
    }
  }
  return events;
}

function parseICalDate(val: string): string {
  const clean = val.replace(/[TZ]/g, "");
  return `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`;
}

function extractBookingComInfo(event: ICalEvent, sourceUrl: string): { guest_name: string; summary: string; isBookingCom: true } | null {
  const summaryLower = (event.summary || "").toLowerCase();
  const isFromBookingCom = sourceUrl.includes("booking.com");
  const isClosedPattern = summaryLower.includes("closed - not available") || summaryLower === "reserved";

  if (!isFromBookingCom && !isClosedPattern) return null;
  if (isFromBookingCom && !isClosedPattern) return null;

  let ref = "";
  if (event.uid) { const numMatch = event.uid.match(/([a-f0-9]{6,})/i); ref = numMatch ? numMatch[1].substring(0, 8) : ""; }

  let guestFromDesc = "";
  if (event.description) { const guestMatch = event.description.match(/GUEST:\s*(.+)/i); if (guestMatch) guestFromDesc = guestMatch[1].trim(); }

  const guest_name = guestFromDesc ? guestFromDesc + (ref ? ` (#${ref})` : "") : ref || "";
  const summary = ref ? `Booking.com #${ref}` : "Booking.com Guest";

  return { guest_name, summary, isBookingCom: true };
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const { property_id, owner_pin } = await req.json();
    const supabase = getSupabaseClient();
    const isAdmin = await validateAdminPin(owner_pin || "");

    if (!isAdmin) {
      // Check direct owner_pin match
      const { data: prop } = await supabase.from("properties").select("id").eq("id", property_id).eq("owner_pin", owner_pin).maybeSingle();
      if (!prop) {
        // Check if user has access via user_property_access (user logged in with their personal PIN)
        const { data: user } = await supabase.from("app_users").select("id").eq("pin", owner_pin).maybeSingle();
        const hasAccess = user ? (await supabase.from("user_property_access").select("id").eq("user_id", user.id).eq("property_id", property_id).maybeSingle()).data : null;
        if (!hasAccess) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const { data: property, error: propError } = await supabase.from("properties").select("ical_urls").eq("id", property_id).single();
    if (propError || !property) {
      return new Response(JSON.stringify({ error: "Property not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const icalUrls = property.ical_urls || [];
    const allEvents: (ICalEvent & { sourceUrl: string })[] = [];
    let successfulFetches = 0;

    for (const url of icalUrls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const text = await res.text();
          allEvents.push(...parseICS(text).map((e) => ({ ...e, sourceUrl: url })));
          successfulFetches++;
        }
      } catch { /* Skip failed URLs */ }
    }

    await supabase.from("bookings").delete().eq("property_id", property_id);

    if (allEvents.length > 0) {
      const airbnbBlockedPatterns = ["airbnb (not available)", "blocked", "unavailable", "no disponible", "nicht verfügbar"];

      await supabase.from("bookings").insert(
        allEvents.map((e) => {
          const bookingComInfo = extractBookingComInfo(e, e.sourceUrl);
          if (bookingComInfo) {
            return { property_id, summary: bookingComInfo.summary, guest_name: bookingComInfo.guest_name, start_date: e.startDate, end_date: e.endDate, source_url: e.sourceUrl, uid: e.uid || null, description: e.description || null, status: "booked" };
          }
          const summaryLower = (e.summary || "").toLowerCase();
          const isFromBookingCom = e.sourceUrl.includes("booking.com");
          const isBlocked = !isFromBookingCom && airbnbBlockedPatterns.some((p) => summaryLower.includes(p));

          let airbnbGuestName: string | null = null;
          let airbnbSummary = e.summary;

          if (!isBlocked && !isFromBookingCom) {
            if (e.description) {
              const guestMatch = e.description.match(/GUEST:\s*(.+)/i);
              const nameMatch = e.description.match(/(?:^|\n)Name:\s*(.+)/i);
              const checkinName = e.description.match(/Check-in:\s*.*?\n.*?([A-Z][a-z]+ [A-Z][a-z]+)/);
              airbnbGuestName = (guestMatch?.[1] || nameMatch?.[1] || checkinName?.[1] || "").trim() || null;
            }
            if (!airbnbGuestName && e.summary) {
              const looksLikeName = /^[A-Z][a-z]+(\s+[A-Z][a-z]*\.?)+$/.test(e.summary.trim());
              if (looksLikeName) airbnbGuestName = e.summary.trim();
            }
            if (airbnbGuestName && e.uid) {
              const refMatch = e.uid.match(/([a-f0-9]{6,})/i);
              const ref = refMatch ? refMatch[1].substring(0, 8) : "";
              if (ref) airbnbSummary = `Airbnb #${ref}`;
            }
          }

          return { property_id, summary: airbnbSummary, guest_name: airbnbGuestName, start_date: e.startDate, end_date: e.endDate, source_url: e.sourceUrl, uid: e.uid || null, description: e.description || null, status: isBlocked ? "blocked" : "booked" };
        })
      );
    }

    // ─── Reconcile manual_reservations against current iCal feed ──────────
    // Rules:
    // 1. Only run when at least one iCal URL fetched successfully (avoids data loss on transient failure).
    // 2. Only consider FUTURE reservations (check_out >= today). Past stays are immutable —
    //    Airbnb/Booking iCal feeds drop completed events, so absence does NOT mean cancellation.
    // 3. Safety threshold: if >50% of active future reservations would be cancelled in one sync
    //    AND there are at least 4 of them, skip and log a warning (likely partial/broken feed).
    let cancelledCount = 0;
    let skippedReason: string | null = null;
    if (icalUrls.length > 0 && successfulFetches > 0) {
      const today = new Date().toISOString().split("T")[0];
      const currentExternalIds = new Set(
        allEvents.map((e) => `${property_id}_${e.startDate}_${e.endDate}`)
      );

      const { data: existingManual } = await supabase
        .from("manual_reservations")
        .select("id, external_id, status, check_out")
        .eq("property_id", property_id)
        .not("external_id", "is", null)
        .neq("status", "Cancelled")
        .neq("status", "Cancelled-iCal")
        .gte("check_out", today);

      const totalActive = (existingManual || []).length;
      const orphans = (existingManual || []).filter(
        (r: any) => r.external_id && !currentExternalIds.has(r.external_id)
      );

      if (orphans.length > 0) {
        if (totalActive >= 4 && orphans.length / totalActive > 0.5) {
          console.warn(
            `[fetch-ical] Skipping reconciliation for property ${property_id}: ` +
            `${orphans.length}/${totalActive} (>50%) would be cancelled. Possible feed issue.`
          );
          skippedReason = `safety_threshold:${orphans.length}/${totalActive}`;
        } else {
          const { error: updErr } = await supabase
            .from("manual_reservations")
            .update({ status: "Cancelled-iCal", updated_at: new Date().toISOString() })
            .in("id", orphans.map((r: any) => r.id));
          if (!updErr) cancelledCount = orphans.length;
        }
      }
    }

    const { data: bookings } = await supabase.from("bookings").select("*").eq("property_id", property_id).order("start_date");

    return new Response(JSON.stringify({ bookings: bookings || [], synced: allEvents.length, cancelled: cancelledCount, skipped: skippedReason }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
